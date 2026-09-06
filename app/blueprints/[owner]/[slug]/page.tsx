import Link from "next/link";
import { notFound } from "next/navigation";

import type { NodeCard } from "@/lib/core";
import { shortDigest } from "@/lib/core";
import { getSharedDbClient } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { actorFrom, getPublicAuthor, resolveOwner } from "@/lib/server/accounts";
import { getBundle, listReleases } from "@/lib/server/archive";
import { getSignals } from "@/lib/server/counters";
import { forksOf } from "@/lib/server/lineage";
import type { NoteRecord } from "@/lib/server/notes";
import { listNotes } from "@/lib/server/notes";
import { blueprint, card, draftBundle, graphsOf, scoresOf } from "@/lib/server/registry";
import { releaseFiles, serveCardSource } from "@/lib/server/export";
import { BUNDLE_CARDS_DIR, BUNDLE_README } from "@/lib/content/bundle-export";
import { blueprintViewOver } from "@/lib/content/view";
import type { CommunitySignals } from "@/lib/data/community";
import type { Blueprint } from "@/lib/types";
import { blueprintFileHref } from "@/lib/href";
import { prettyDate } from "@/lib/format";
import { authorFor } from "@/components/profile/author";
import { readSession } from "@/components/profile/session";
import { KindBadge } from "@/components/ui/Badge";
import { TagPill } from "@/components/ui/TagPill";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";
import { absencesFor } from "@/components/panes/absences";
import { buildPaneModel, type PaneNodeInput } from "@/components/panes/build";
import { SynchronisedPanes } from "@/components/panes/SynchronisedPanes";
import { BundleHeader } from "@/components/bundle/BundleHeader";
import { DraftLanding, type DraftLandingBundle } from "@/components/bundle/DraftLanding";
import { CodeMenu } from "@/components/bundle/CodeMenu";
import { FileTree } from "@/components/bundle/FileTree";
import { History } from "@/components/bundle/History";
import { ReadmePanel } from "@/components/bundle/ReadmePanel";
import { cardFilesFromPaths, filesFromPaths } from "@/components/bundle/load";
import { Comments, type NoteView } from "@/components/blueprint/Comments";
import { ToolScopes } from "@/components/blueprint/Requirements";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-03 LIVE: the blueprint is read from the registry (T080) per request.
// SEAM-19 LIVE: the folder is served by `/api/files/blueprints/{owner}/{slug}/d/{digest}/…`.
// SEAM-75 LIVE (T280): POST /api/blueprints/{owner}/{slug}/star — the star pill.
// SEAM-79 LIVE (T280): GET/POST /api/blueprints/{owner}/{slug}/notes and its /{noteId},
// /{noteId}/vote siblings — `Comments`' `live` prop.
// SEAM-20/70/71 LIVE (T280): star and fork — see the mounts below.
// SEAM-57 (watch) and SEAM-67 (visibility) are no longer anchored here. The owner took the
// Watch pill off the band and the visibility switch off this page entirely on 2026-09-06;
// both routes are untouched and both still have a reader — `ProfileHeader` for the watch,
// and the owner's own blueprint list for the visibility switch.
// SEAM-74 (votes) is no longer anchored here. The owner removed the whole scoring reading
// from this page, so the ballot control and the panels it fed came off with it; the write
// itself is untouched and still answers at /api/blueprints/{owner}/{slug}/votes.

/* ============================================================
   /blueprints/[owner]/[slug] — the canonical public page for a bundle.

   B-09 made a slug unique per OWNER rather than per registry, so this is the one address a
   blueprint has (D-261-01). `/blueprints/<slug>` and `/u/<owner>/<slug>` both 308 onto it:
   the first because the old public URL never carried an owner, the second because it was
   the same resource under a second name.
   ============================================================ */

/**
 * Per request, and the deletion above it is the criterion.
 *
 * `dynamicParams = false` and a `generateStaticParams` over `allBlueprints()` stood here.
 * Both are exactly what a registry that grows between deploys cannot serve: a blueprint
 * published after the last deploy was a 404 at its own URL until somebody rebuilt (AC3).
 *
 * ── Why this spelling and not `connection()` ──
 * `connection()` is Next 16's request-time marker and the prettier one, and it THROWS when
 * a page function is invoked directly in a node-environment cell (D-260-09). A segment
 * export is inert under that invocation instead, which is what the merged browse routes
 * already use. Recorded with it, because this task measured the limit: **the export
 * protects the SPELLING, not the BODY** (D-261-11) — what actually breaks a cell that calls
 * this function is `getSharedDbClient()` below, and no marker can help with that. The two
 * tests that used to invoke a page this way were rewritten to render components instead.
 *
 * The Next 16 caveat the browse routes carry applies here too: `dynamic`, `dynamicParams`,
 * `revalidate` and `fetchCache` are removed once `cacheComponents` is on, and this line is
 * what a task turning that switch on has to replace.
 */
export const dynamic = "force-dynamic";

/** A reader with no session. `Object.freeze` so a caller cannot make it somebody. */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/** Who is asking, for a page whose answer differs for the owner of a private bundle. */
async function actorNow(): Promise<Actor> {
  const session = await readSession();
  return session === undefined ? ANONYMOUS : actorFrom(session);
}

export async function generateMetadata({ params }: PageProps<"/blueprints/[owner]/[slug]">) {
  const { owner, slug } = await params;
  const { db } = getSharedDbClient();
  const summary = await blueprint(db, await actorNow(), owner, slug);
  if (summary === undefined) return { title: "Blueprint not found" };
  return { title: summary.manifest.title, description: summary.manifest.summary };
}

/**
 * The rail every blueprint page draws, on the left.
 *
 * This was a `PageContents` panel at the foot of the header, and the author asked it into a
 * rail: "In each blueprint we have `On this blueprint` as a panel. Make it on the left as
 * you did for the pages in Learn." Same destinations, same order; what changes is that a
 * reader four screens down can still see where they are, which is the whole reason the
 * Learn pages have one.
 *
 * ── Why this is a function now, and it is one row's fault ──
 * It was a module constant, on the argument that these are the page's own structure and not
 * the blueprint's: every slug rendered all of them. `#readme` breaks that. The panel is
 * drawn from `ReleaseFiles.readme`, which is `undefined` for a release that ships no
 * `README.md`, and a rail row is a promise that the anchor it names is on the page. So the
 * one row that depends on the bundle is passed in, and the rest are still the page's own —
 * including `#community-notes`, which is declared in `Comments` rather than here and is
 * mounted unconditionally, because a bundle with no comments still draws the section that
 * says so.
 *
 * The count in the rail's own meta is read off `.length` rather than typed beside it, and
 * the step numbers are stamped from the index for the same reason. Both were typed once,
 * and the count was wrong within one edit: `At a glance` left on 2026-08-11 and the heading
 * went on claiming eight sections over seven rows. A conditional row makes hand-typed steps
 * strictly worse than that — two different bundles would need two different tables.
 *
 * No `active`. `SideRail` reads that as "no row is the page you are on", which is the truth
 * here: every row is an anchor into the page a reader is already reading. Lighting one
 * would need a scroll-spy, and a rail that claims a position it is not tracking is worse
 * than a rail that claims none.
 */
function blueprintSections(hasReadme: boolean): readonly SideRailItem[] {
  const rows: { href: string; label: string }[] = [
    /* `#overview` stood here, first. It was a four-cell definition list of the domain, the
       node and handoff counts, the tool-scope count, the digest and the date, and the author
       removed it on 2026-08-11 as not informative enough to open the page with. It was not:
       every one of those facts is already drawn somewhere a reader is going anyway. The
       domain and the date are in the header band, the digest is in the version line and on
       the Bundle panel, the shape is the graph two sections down, and the tool-scope count
       is a number over a list `Requirements` prints in full. A panel of pointers at other
       panels is what a page has instead of a first section, not one. */
    /* The graph opens the reading now, and the rail follows the page rather than leading it.
       The owner moved it up on 2026-09-06: the long description block that used to sit above
       the file list came off, and "the graph panel (extend full horizontal length as the
       other elements)" took its place. The rows below are the page top to bottom, and the
       step numbers are stamped from that order rather than typed beside it.

       `Tool scopes` is the one section above the graph that has no row. It is a four-line
       panel directly under the band, in view before a reader has scrolled at all, and a rail
       row is for a place a reader has to travel to. */
    { href: "#blueprint-workspace", label: "Graph and cards" },
    { href: "#files", label: "Files" },
    { href: "#blueprint-readme", label: "Readme" },
    /* `#evidence` stood here, third. It was `EvidenceLayers`' three-column panel, and it left
       with the rest of the scoring reading on the owner's instruction to simplify this page.
       Two of its three columns existed to say what a ballot and a run report could not tell a
       reader yet, which is an answer only a page carrying a score has the question for. */
    { href: "#history", label: "History" },
    /* `#use-this-blueprint` stood here, fourth, labelled `Use this release`. The owner asked
       the panel behind it off the page: "remove ... the Exact release panel". Its download
       did not leave with it — it is the `Code` control on the file list's own header row now,
       which is GitHub's shape and the same instruction's other half — so the rail row is not
       repointed at a second name for `#files`. It is the section that is gone, not the thing
       it offered.

       `#blueprint-source` stood after it, labelled `Source`: the `topology.dot` breakdown,
       removed on the same instruction. The file itself is still one click away in the
       listing above and in the Code menu, and `/spec/topology` still draws the same figure
       over the same file. */
    { href: "#community-notes", label: "Community notes" },
  ];
  /* Filtered rather than conditionally pushed, so the order above stays readable as the
     page's order top to bottom. */
  return rows
    .filter((row) => hasReadme || row.href !== "#blueprint-readme")
    .map((row, index) => ({ ...row, step: String(index + 1).padStart(2, "0") }));
}

/** Small mono heading for the in-page panels. */
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
      {children}
    </span>
  );
}

/**
 * `blueprintViewOver` still takes a `community: CommunitySignals` (B7's, unchanged shape) —
 * every field it feeds besides `metrics` (downloads, votes, comments, featured, seed) is a
 * value this page no longer sources from `lib/data/community.ts` (T280's global rule: that
 * fixture stops feeding pages this wave owns). Zero and empty are the honest values for a
 * page that draws its community numbers from `star` and `Comments`' `live` mode instead,
 * never a seeded stand-in with nowhere left to read it from.
 *
 * `metrics` is the one field nothing on this page reads any more. The six-metric card and
 * the ballot beside it came off on the owner's instruction, and the projection has no way
 * to omit the array, so it is still built from these zeros and then dropped. That is also
 * why the `live` bag stopped being passed: `metricsFor` is its only consumer, so keeping it
 * would have cost a `getAggregate` and a `reportedCost` per request for numbers no reader
 * can see.
 */
const EMPTY_COMMUNITY: CommunitySignals = {
  downloads: 0,
  votes: 0,
  comments: [],
  efficacy: 0,
  reliability: 0,
  transparency: 0,
  cost: 0,
};

/**
 * `NoteRecord` (server, `Date`, nullable `PublicAuthor` fields) -> `NoteView` (the wire
 * shape `Comments`' `live` prop and `components/blueprint/Comments.tsx`'s own client-side
 * `viewOf` both agree on — this is the SAME mapping run once here for the first page and
 * again in the browser for every page after, because a server component and a `"use
 * client"` file cannot share one function without crossing the boundary).
 */
function noteViewFrom(note: NoteRecord, viewerHandle: string | undefined): NoteView {
  const handle = note.author.handle ?? "unknown";
  // Destructured rather than `note.votes` below: a note's own up-vote count is a live
  // `COUNT(note_vote)` and has nothing to do with `CommunitySignals.votes` (the seeded
  // fixture figure `autonomy-surfaces.test.ts` polices), but the two read alike as a bare
  // substring and this page dropped its own "seeded" sentence when `bp.votes` did.
  const { votes } = note;
  return {
    id: note.id,
    author: {
      handle,
      displayName: note.author.displayName ?? handle,
      ...(note.author.avatarHue !== null ? { avatarHue: note.author.avatarHue } : {}),
    },
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    votes,
    deleted: note.deleted,
    mine: viewerHandle !== undefined && note.author.handle === viewerHandle,
  };
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/blueprints/[owner]/[slug]">) {
  const { owner, slug } = await params;
  const actor = await actorNow();
  const { db } = getSharedDbClient();

  /* THE VISIBILITY GATE, AND IT IS T060's RATHER THAN THIS PAGE'S.
     ------------------------------------------------------------
     `blueprint()` narrows to what this actor may read, so a private bundle answers
     `undefined` for everyone but its owner and this route 404s (AC6, B-03). The page makes
     no visibility decision of its own: a second copy of that rule here is the defect this
     project charges hardest, and it is also how an existence oracle gets rebuilt one layer
     up after the API closed it. */
  const summary = await blueprint(db, actor, owner, slug);
  if (summary === undefined) {
    /* DRAFT BRANCH (0007_drafts, T280): a bundle that has an account and a name and no
       release yet — GitHub's empty-repo state. `blueprint()` answered undefined for
       exactly the same two reasons `draftBundle()` would (B-03: absent and unreadable
       collapse to one answer), so trying it second is never a second visibility opinion —
       it is the one question `blueprint()` cannot answer on its own, "is there a bundle
       here with nothing published yet", asked of the reader built for it. */
    const draft = await draftBundle(db, actor, owner, slug);
    if (draft === undefined) notFound();

    const account = await resolveOwner(db, owner);
    const isOwner = actor.kind === "account" && account !== undefined && actor.accountId === account.accountId;
    const publicOwner = await getPublicAuthor(db, owner);
    const ownerAuthor = authorFor(
      publicOwner ?? { handle: owner, displayName: null, avatarHue: null, validator: false },
    );

    const view: DraftLandingBundle = {
      ownerHandle: draft.ownerHandle,
      slug: draft.slug,
      visibility: draft.visibility,
      createdAt: draft.createdAt.toISOString(),
      ...(draft.title !== undefined ? { title: draft.title } : {}),
      ...(draft.summary !== undefined ? { summary: draft.summary } : {}),
      ...(draft.description !== undefined ? { description: draft.description } : {}),
    };

    return (
      <DraftLanding
        draft={view}
        owner={ownerAuthor}
        isOwner={isOwner}
        {...(isOwner ? { visibilityApi: `/api/bundles/${owner}/${slug}/visibility` } : {})}
      />
    );
  }

  const key = { ownerHandle: owner, slug };
  const [drawings, scorecard] = await Promise.all([
    graphsOf(db, actor, [key]),
    scoresOf(db, actor, owner, slug),
  ]);
  const drawing = drawings.get(`${owner}/${slug}`);

  /* A BLUEPRINT WITH NO SCORECARD OR NO DRAWING IS A 404 HERE, AND THE SHELF AGREES.
     ------------------------------------------------------------
     `/blueprints` skips exactly these rows (D-260-29) rather than drawing a placeholder,
     because `autonomy.autonomyClass` is the field doc 2 §1.1 guards most tightly and a page
     inventing a classification nobody computed is worse than a page that is not there. The
     detail route has no third option: it renders the scorecard as its subject. A bundle
     that does not resolve has the same answer for the same reason — the schematic is the
     row, and `graphsOf` answers absent for a release carrying error diagnostics. */
  if (drawing === undefined || scorecard === undefined) notFound();

  /* The OWNER, which is not the AUTHOR. Re-attribution moves ownership and not authorship
     (D-250-18), so the handle in the URL and the handle in the manifest are two different
     facts that happen to agree across the archive's nine. `getBundle` is called AFTER the
     gate above and only for the label: it takes no actor, so using it to decide what to
     render would be re-implementing the rule `blueprint()` just applied. */
  const account = await resolveOwner(db, owner);
  const record = account === undefined ? undefined : await getBundle(db, account.accountId, slug);
  const publicOwner = await getPublicAuthor(db, owner);
  const ownerAuthor = authorFor(publicOwner ?? {
    handle: owner,
    displayName: null,
    avatarHue: null,
    validator: false,
  });
  /* An `isOwner` stood here. `VisibilitySwitch` was its last reader on this branch, and the
     owner moved that control off the page on 2026-09-06 — so the published view now renders
     the same thing for the owner and for a stranger, which is the whole of what "such option
     should be visible only on the user account list of the blueprints" asks for. The DRAFT
     branch above still computes its own, because `DraftLanding` still draws the switch.

     `account` is not idle with it: `record` is `getBundle(db, account.accountId, slug)`, and
     the release list, the visibility pill and every live signal below hang off `record`. */
  const viewerHandle = actor.kind === "account" ? (actor.handle ?? undefined) : undefined;

  /* Releases, newest last, and the vocabulary the CURRENT release declares. One read
     answers three questions the archive answered with three: the version history, the
     release list, and whether this bundle ships a local `ontology/extensions.yaml`. */
  const releases = record === undefined ? [] : await listReleases(db, record.id);
  const current = releases.find((r) => r.digest === summary.digest);
  const folder = await releaseFiles(db, actor, { ownerHandle: owner, slug });

  /* THE LIVE SIGNALS (T280), all keyed on the bundle's own row id — `BlueprintSummary`
     carries none (`FavoriteStar.tsx`'s own header records why a save can't reach it
     either), so every one of these reads waits on `record`, which is `getBundle`'s. That is
     never a wider gate than the one already passed: `record` resolves whenever `summary`
     does, because both come from the same row, and the `undefined` arm below is only the
     theoretical race between the two reads a request-scoped page cannot close. */
  /* `getAggregate` and `reportedCost` were the second and third reads here. Both went with
     the scoring reading: the ballot aggregate had two consumers on this page (the vote
     control and the evidence panel) and the cost aggregate had one, and after the cut the
     only thing either could still reach was `blueprintViewOver`'s `live` bag, whose sole
     output is `bp.metrics`. Nothing renders that array now, so the two round trips bought a
     number no reader could see. Neither server module is otherwise idle: the votes route and
     the runs route each call their own. */
  let signals: Awaited<ReturnType<typeof getSignals>> | undefined;
  let notesPage: Awaited<ReturnType<typeof listNotes>> = { notes: [], cursor: null };
  let forkRows: Awaited<ReturnType<typeof forksOf>> = [];
  if (record !== undefined) {
    [signals, notesPage, forkRows] = await Promise.all([
      getSignals(db, actor, { kind: "blueprint", refId: record.id }),
      listNotes(db, actor, { kind: "blueprint", refId: record.id }),
      forksOf(db, actor, record.id),
    ]);
  }

  /* `forksOf` already answers only public rows (its own doc — a private fork is invisible
     upstream in every direction, Q1), so the page adds nothing to that filter and reads the
     COUNT off the rows for the header's Fork button.

     A `publicAuthorsByIds` batch stood here, resolving every forker's account id to a handle
     so the aside's `Forks` panel could link each copy. The owner asked that panel off the
     page, and the count is the only thing left that reads this — so the second query went
     with the rows it was for rather than being kept warm for a panel nothing mounts. */

  /* A `getProfile(db, actor, owner)` stood here for the OWNER's watcher count, which the
     header's Watch pill printed. The owner asked that pill off the band on 2026-09-06 and
     the read went with it rather than being kept warm: it was a fifth round trip per request
     for a figure nothing draws. `getProfile` is untouched and `/u/<owner>` still reads it,
     which is the page whose subject that number actually is. */

  /* `blueprintViewOver` still takes a `community: CommunitySignals` — see
     `EMPTY_COMMUNITY`'s own doc for why this page hands it zeros rather than
     `communityFor(slug)`'s fixture, and for why no `live` bag goes with it any more. */
  const bp: Blueprint = {
    ...blueprintViewOver({
      manifest: summary.manifest,
      digest: summary.digest,
      cardRefs: summary.cardRefs,
      graph: drawing.graph,
      requiredAgents: drawing.requiredAgents,
      requiredTools: drawing.requiredTools,
      analysis: {
        autonomy: scorecard.autonomy,
        security: scorecard.security,
        phaseCoverage: scorecard.phaseCoverage,
        diagnostics: [...drawing.diagnostics],
      },
      community: EMPTY_COMMUNITY,
      diagnostics: drawing.diagnostics,
    }),
    /* The one field the projection cannot set: it builds from a manifest, and a manifest
       carries an author rather than an owner. */
    ownerHandle: owner,
  };

  /* A `paragraphs` split of `bp.description` stood here, rendered as the first block of the
     body. The owner asked it off on 2026-09-06: "remove the description in the blueprint
     template above the panel that lists the files". The SHORT summary is untouched and still
     the last line of the identity band, which is the part the owner's own screenshot marked
     as staying. `bp.description` is still projected by `blueprintViewOver` and still read on
     `/blueprints`' tiles; this page simply no longer draws the long form. */

  /* Every download URL on this page is the release's DIGEST address (D-261-04). The static
     mirror under `public/bundles/<slug>/` is written from `content/` before a build, so it
     holds nothing at all for a blueprint published since the last deploy — AC3 and AC4
     cannot both be true of it. The mirror stays; this page stops linking it. */
  const at = { digest: summary.digest };
  const paths = folder?.files ?? [];
  /* `topologyHref`, a sorted `downloadCards` list and a `parseStoredVocabulary` reading of
     the release's local vocabulary stood here. All three fed `DownloadPanel`, which the
     owner asked off this page with the `Exact release` section around it, and none of them
     is a second reader's input: the same files are reachable one row down in the listing
     and one click away in the `Code` menu, which lists `paths` whole rather than the three
     names the panel singled out. `parseStoredVocabulary` is untouched and still the one
     published reading of that column; this page simply no longer asks it anything. */
  /* Every file the release holds, as a link at its immutable digest address (D-261-04) —
     built from the same `paths` array the listing above it is built from, so the rows a
     reader scans and the files the `Code` menu hands over cannot name two different
     folders. */
  const codeFiles = paths.map((path) => ({
    path,
    href: blueprintFileHref(owner, slug, at, path),
  }));
  /* The bundle's own `README.md`, carried through `releaseFiles` off the export it already
     built (see its docblock: no second pass and no second query). `undefined` is a real
     answer — a release with no README, which nothing `addRelease` accepts can produce today
     — and it draws no panel at all rather than an empty box with DarkPrint's own prose in
     it. A sentence written here would reach a reader as the bundle author's. */
  const readme = folder?.readme;

  const updatedAt = (current?.createdAt ?? record?.updatedAt ?? new Date()).toISOString();
  const shortened = `${summary.digest.slice(0, 13)}…`;
  /* THE FOLDER THE READER ASKED FOR, GitHub's way (owner, 2026-09-06: "the cards folder is
     not clickable. Make it clickable and once click, it show the list of the cards inside").
     ------------------------------------------------------------
     A URL and not component state. `?path=cards` is a real address: the browser's own Back
     button walks out of the folder, the view survives a reload, and a link into it can be
     pasted to somebody. A disclosure widget or a `useState` toggle gives none of those, and
     the instruction asked for the shape GitHub has rather than for an expander.

     Reading `searchParams` costs this route nothing, which is NOT true of the two shelves.
     `app/blueprints/page.tsx` argues at length that it will not read them, because a server
     component that reads `searchParams` cannot answer the first paint without one and AC5 is
     that the shelf is in the HTML. Both halves of that are answered here: this page is
     already `force-dynamic` (:84), and with no parameter it renders the root listing, so the
     folder is in the first paint either way. */
  const inCards = ((await searchParams).path) === BUNDLE_CARDS_DIR;
  const folderHref = `/blueprints/${owner}/${slug}?path=${BUNDLE_CARDS_DIR}`;
  const rootHref = `/blueprints/${owner}/${slug}`;
  const cardRows = cardFilesFromPaths(paths, updatedAt);

  const sections = {
    files: inCards ? cardRows : filesFromPaths(paths, updatedAt),
    /* At the root the `cards/` row is the one entry that is not a file, so it points at the
       folder rather than at a download. Inside it every row is a real file again. */
    hrefFor: (file: { kind: string; path: string }) =>
      file.kind === "dir" ? folderHref : blueprintFileHref(owner, slug, at, file.path),
    upHref: inCards ? rootHref : undefined,
    crumb: inCards ? { owner, slug, dir: BUNDLE_CARDS_DIR, rootHref } : undefined,
    readmeHref: inCards ? undefined : blueprintFileHref(owner, slug, at, BUNDLE_README),
    fileFootnote: inCards
      ? `${cardRows.length} card${cardRows.length === 1 ? "" : "s"} in ${BUNDLE_CARDS_DIR}/`
      : `${paths.length} entries · ${new Set(summary.cardRefs).size} pinned cards inside cards/`,
    lastChange: {
      author: summary.manifest.author ?? owner,
      message: bp.summary,
      digest: shortened,
      at: updatedAt,
    },
    /* REAL HISTORY, newest first, and the sentence that said there was none comes off with
       it (F18, D-261-07(7)). The archive held one folder per bundle, so the shipped copy
       said "this is the whole history there is: no earlier snapshot of it was ever
       published" — true of `content/` and false the moment releases are append-only rows. */
    history: releases
      .slice()
      .reverse()
      .map((release) => ({
        version: release.version,
        digest: `${release.digest.slice(0, 13)}…`,
        ...(release.digest === summary.digest ? { tag: "latest" as const } : {}),
        message: release.manifest.summary,
        author: release.manifest.author ?? owner,
        at: release.createdAt.toISOString(),
      })),
    /* `releases` was mapped here into per-release rows for the `Releases` panel, which
       came off on 2026-09-05. The RAW `releases` list is untouched and still read three
       times: `history` above it, the release count in the header, and the fork button's
       `sourceVersion`. Only this projection had a single consumer. */
  };

  /* `bundleNodes` stood here, joining `graph.nodes` to `cardRefs` by index for
     `BundlePanel`'s node list. It had that one consumer and went with the panel. The join
     itself is not lost: `paneModel` below builds the same correspondence for the
     synchronised panes, which is the surface that still draws it. */

  /* Doc 2 §5.1's four panes, and the card documents behind panes 2 and 4 come from the
     registry now (D-261-12). `cardSource` walked `content/`, so a blueprint published since
     the last deploy would have shown a source pane with nothing in it — and AC3's whole
     point is that such a blueprint gets the SAME page as the nine, source included, which
     is why the reduction was refused rather than disclosed and kept.

     `serveCardSource` is the published per-card reader for a PAGE RENDER — `serveCard`'s
     bytes minus B-14's download event (T280: `release-files.ts`'s own rule, "a listing is
     not a download", extended to a card rendered inline on its own page). It takes the same
     actor as everything above, so a card private to somebody else is absent here exactly as
     it is absent from `summary.cardRefs`. **Cost, disclosed: TWO reads per DISTINCT ref** —
     the resolved card and its document — deduplicated, because a graph may instantiate one
     card at two nodes and the document does not differ. Bytes rather than text on the wire
     is `ServedFile`'s shape, decoded once here; the panes want a string. */
  const distinctRefs = [...new Set(bp.cardRefs.filter((ref) => ref !== ""))];
  const resolved = new Map<string, NodeCard>();
  const documents = new Map<string, string>();
  await Promise.all(
    distinctRefs.map(async (ref) => {
      const [summaryFor, served] = await Promise.all([
        card(db, actor, ref),
        serveCardSource(db, actor, ref),
      ]);
      if (summaryFor !== undefined) resolved.set(ref, summaryFor.card);
      if (served !== undefined) documents.set(ref, new TextDecoder().decode(served.bytes));
    }),
  );

  const paneNodes: PaneNodeInput[] = bp.graph.nodes.map((node, i) => {
    const ref = bp.cardRefs[i] ?? "";
    const entry: PaneNodeInput = { nodeId: node.id, label: node.label };
    if (ref !== "") entry.ref = ref;
    const parsed = resolved.get(ref);
    if (parsed !== undefined) entry.card = parsed;
    const yaml = documents.get(ref);
    if (yaml !== undefined) entry.yaml = yaml;
    return entry;
  });
  const paneModel = buildPaneModel({
    slug: bp.slug,
    title: bp.title,
    dot: bp.graph.dot,
    nodes: paneNodes,
    absences: absencesFor(
      bp.slug,
      paneNodes.map((node) => node.nodeId),
    ),
  });

  const railSections = blueprintSections(readme !== undefined);

  /* The diagnostics split stood here. An error-severity diagnostic never reaches this page
     (`graphsOf` answers absent for a release carrying one), so what remained were the
     engine's footnotes, divided into the four criteria codes `Explainability` used to
     expand and everything else. Both halves fed `BundlePanel` and nothing else, and they
     went with it on 2026-09-05.

     THIS PAGE NOW DRAWS NO DIAGNOSTICS AT ALL, and that is a loss rather than a tidy: eight
     of the nine shipped bundles carry `analysis/criteria-leak-unanchored`, which is the
     check doc 3 §4.1 calls the most important in the system. `/upload` still renders them
     for a bundle being validated, which is a different reader at a different moment.
     §11.0 carries the row; nothing here should imply it is covered. */


  return (
    /* The rail wraps everything, band included.
       ------------------------------------------------------------
       The band was outside it for one pass, full-bleed above the rail the way the hand-off
       draws it — and the result was a left column that began 310px down the page with the
       band's own full-width rule cutting across the top of it, so the vertical line a
       reader follows was broken into two pieces. The author read it as fragmentation and
       asked for the node page's treatment, where the rail runs from the header to the
       footer in one unbroken column and the page's own header sits in the right-hand one.

       So the band keeps its `border-b bg-surface` and now spans the right column rather
       than the viewport. Nothing else about it moves. */
    <SideRail
      label="On this blueprint"
      meta={`${railSections.length} sections`}
      items={railSections}
      ariaLabel="On this blueprint"
    >
    {/* ---------- The band, shared with `/u/<owner>/<slug>` ----------
        Owner and name, the visibility pill, the four actions and the version line, in the
        same component the owner's view of a bundle mounts. That is the whole restructure:
        a published blueprint and a bundle somebody holds privately are one kind of thing
        seen from two sides, and until this pass the two pages disagreed about what a
        bundle even looks like at the top.

        What did NOT move is the argument below it. The sections keep their scroll
        order and are not tabs: they are one reading top to bottom, and tabbing them would
        put the explainability panel — the thing that makes a score checkable — behind a
        click. */}
    <BundleHeader
      owner={ownerAuthor}
      slug={bp.slug}
      /* AC6 reaching the browser: the column, not a literal. `visibility="public"` was hard
         coded here because the archive held only published bundles and had nowhere to read
         it from; `bundle.visibility` is a real column now, and `Aside.tsx`'s "nothing stores
         a visibility" marker comes off in this same commit (D-261-01). An absent record can
         only mean a bundle the gate above already let through, so `public` is the honest
         default rather than a guess. */
      visibility={record?.visibility ?? "public"}
      validator={ownerAuthor.validator}
      title={bp.title}
      summary={bp.summary}
      forks={forkRows.length}
      saveId={`blueprint:${bp.slug}`}
      /* No `support` any more: it read `bp.votes`, which was this page's stand-in for a
         seeded star count before T280 wired a real one. `star` below is the live
         replacement, and `bp.votes` is `EMPTY_COMMUNITY`'s `0` now — passing it through
         would be printing an index figure with nothing behind it and no marker beside it,
         which is `autonomy-surfaces.test.ts`'s own rule (`no surface prints a seeded
         index figure as a fact`). `BundleHeader`'s `support === undefined` branch draws a
         plain bookmark, which is the honest fallback for the one theoretical case below
         where `star` itself is absent. */
      star={{
        api: `/api/blueprints/${owner}/${slug}/star`,
        // `signals` is undefined only in the theoretical race `record`'s own comment
        // names — zero and unstarred are the same answer `getSignals` gives a target
        // nothing has happened to yet, so the fallback is the live reader's own zero.
        count: signals?.starCount ?? 0,
        starred: signals?.starredByCaller ?? false,
        signedIn: actor.kind === "account",
      }}
      fork={{
        api: `/api/bundles/${owner}/${slug}/fork`,
        // `current` is `releases.find` over the same digest `blueprint()` just resolved,
        // so absent here is only the theoretical race the block above names — falling
        // back to the newest release rather than an empty string, which `forkBundle`'s
        // own `noSuchRelease` would refuse either way.
        sourceVersion: current?.version ?? releases.at(-1)?.version ?? "",
        signedIn: actor.kind === "account",
        ...(viewerHandle !== undefined ? { viewerHandle } : {}),
      }}
      /* THE DOWNLOAD, IN THE BAND, THIRD.
         ------------------------------------------------------------
         The owner: "remove the Code button and move on top right on the side right of the
         Star; the order should be: star, fork, download blueprint." It spent one pass as a
         `Code` dropdown on the file list's own header row and this is where it lands. What
         it hands over is unchanged — the clone command for this release and every file in
         it, at its digest address.

         Absent when there is no release. `folder` is `undefined` for a bundle whose files
         this actor cannot fetch, and a control whose command names a version it does not
         have would be a control that refuses. `folder.version` and not `current?.version`:
         it is the version `releaseFiles` actually resolved, so the command, the listing
         below and the hrefs all name one release. */
      download={
        folder === undefined ? undefined : (
          <CodeMenu
            command={`darkprint clone ${owner}/${slug} --version ${folder.version}`}
            files={codeFiles}
          />
        )
      }
      breadcrumb={
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/blueprints" className="transition-colors hover:text-cyan">
            ← Blueprints
          </Link>
          <span className="mx-2 text-faint">/</span>
          <span className="text-muted">{bp.category}</span>
        </nav>
      }
      below={
        /* The date joins the version line rather than being lost with `At a glance`.
           Everything else that panel carried is drawn somewhere a reader is going anyway,
           and this was the exception: nothing else on the page says when the bundle was
           published. It belongs beside the digest, which is the other half of the same
           question, how old is what I am about to take. */
        <span className="font-mono text-[11px] text-dim">
          version <span className="text-fg">{shortDigest(bp.digest)}</span> ·{" "}
          {releases.length} release{releases.length === 1 ? "" : "s"} · published{" "}
          {prettyDate(bp.createdAt)}
        </span>
      }
    >
      {/* ONE ROW, everything left-aligned. Owner instruction, 2026-09-06: "set the blueprint
          chip on the same row of the other chips all on the left."

          It was a `flex-col` of two rows, and neither of them was a deliberate arrangement
          any more. `AutonomyMeter` used to sit beside the kind badge carrying the class and
          the per-node reading; the component itself was deleted on 2026-09-06, and
          the per-node reading; the owner asked that reading off this page, off the gallery
          tile and off the pinned card in the same pass, so a reader does not meet on a shelf
          what the detail page no longer says. What was left was a row holding one chip,
          stacked above a row of tags, with the column gap still spacing two things that no
          longer needed separating. The registry still computes `autonomy`; nothing here
          draws it.

          The tags keep their own container rather than being flattened into the row. Two
          rhythms are doing two jobs: `gap-3` separates the KIND from the tags because they
          are different kinds of statement, and `gap-1.5` holds the tags to each other
          because they are a list. Flattening would have had to pick one number and would
          have changed tag spacing to satisfy an instruction about the badge. If the tags
          wrap they wrap inside their own box, which keeps them reading as one group. */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <KindBadge kind={bp.kind} />
        {bp.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {bp.tags.map((t) => (
              <TagPill
                key={t}
                label={t}
                href={`/blueprints?tag=${encodeURIComponent(t)}`}
              />
            ))}
          </div>
        )}
      </div>
    </BundleHeader>

    <div className="container-page py-10 lg:py-12">
      {/* ---------- Tool scopes, directly under the band ----------
          The owner: "move the tool scopes right below the section attached", the section
          being the identity band — breadcrumb, `owner / slug`, the title, the summary, the
          kind badge and the tags. So it opens the body.

          It reads as the first section rather than as a stray panel because of what it is:
          what a graph is allowed to reach is the input to the security reading, so the union
          of it is a fact about the blueprint and not a per-node one. A reader deciding
          whether to take this folder is owed it before the drawing, not after.

          The long description block stood here until 2026-09-06 and came off with the same
          instruction; see the `paragraphs` note above for what survives it.

          "Suggested models" stood beside this under one heading called "Requirements". The
          author: the model "should be listed in the node description as a entry", and it
          already is — `model` is a Behaviour row in the card skeleton the graph below opens,
          per node, read off the card it belongs to. */}
      <section className="panel flex flex-col gap-3 p-5">
        <PanelLabel>Tool scopes</PanelLabel>
        <ToolScopes tools={bp.requiredTools} />
      </section>

      {/* ---------- The graph ----------
          Doc 2 §5.1's pane 1 and pane 2 together: the drawing, and the card skeleton for
          whichever node is selected. Clicking a node — or picking one from the dropdown
          beside the skeleton — moves the same `selection` both panes share, and the card it
          resolves opens its own page through the skeleton's "Open card" link.

          FULL WIDTH, and that is the owner's instruction of 2026-09-06: "move on that part
          the The graph panel (extend full horizontal length as the other elements)". It sat
          in a two-thirds column of a three-column body grid, and the grid existed to put an
          aside beside it. The aside's last panel was the visibility switch, which left this
          page in the same instruction, so the grid had nothing left to hold and went with it
          rather than being kept as an empty third track.

          WHAT THAT BUYS, because the cost of the column was measured and written down and
          the gain has to be too. Every archive drawing is width-bound at every viewport, so
          the width of the box is the only lever on how large a schematic renders. What the
          column cost, measured while it existed: a 729px canvas at 1440, a whole-graph fit
          of 0.599, and `AgentNode`'s 11px kind row rendering at 6.6 CSS px. The site holds
          its figures to 10 CSS px, and one blueprint out of nine cleared that line in this
          column. At the container's full width most of them do.

          The gain is deliberately NOT stated here as a number. It was, for a wave, and the
          numbers were a canvas the page had already stopped drawing in: this comment is
          downstream of a chain that has moved three times, most recently when `framing.ts`
          picked up the side rail's own 256px track (`RAIL_WIDTH`, `RAIL_FROM`) that an
          earlier re-derivation had missed. Every current figure belongs to
          `components/panes/archive-labels.test.ts` and `canvasWidthAt`, both of which
          measure; this file does not.

          `components/panes/archive-labels.test.ts` computes every canvas it measures from
          `canvasWidthAt`, which is what turns a viewport into a canvas width now that the
          column is gone. `columnCanvasWidthAt` went with the column, along with
          `BODY_GRID_GAP`, `BODY_GRID_COLUMNS`, `GRAPH_COLUMN_SPAN` and `COLUMN_FROM`, and
          this sentence named it for a wave after it stopped existing. That file's own rule
          ("any improvement fails too and gets celebrated") is what makes it the place the
          figures live: it pins the achieved type size per blueprint and per width and names
          the ones still under the 10px floor rather than rounding them away. The numbers are
          its; nothing here should restate them, and a re-measure there is owed whenever the
          chain from viewport to canvas moves. */}
      <div id="blueprint-workspace" className="mt-10 scroll-mt-24">
        <SynchronisedPanes model={paneModel} graph={bp.graph} />
      </div>

      {/* ---------- Files ----------
          The folder, under the drawing. Over the same array the header's download control
          builds its URLs from — `releaseFiles`' answer for this release — so the listing
          here, the command in the band, the file links in the band and the files the server
          will actually hand over are four renderings of one list. The owner's view is no
          longer a second page to keep in step: it is this one, under a different actor
          (D-261-08(1)). */}
      <div className="mt-10">
        <FileTree
          files={sections.files}
          lastChange={sections.lastChange}
          author={bp.author}
          hrefFor={sections.hrefFor}
          readmeHref={sections.readmeHref}
          footnote={sections.fileFootnote}
          upHref={sections.upHref}
          crumb={
            sections.crumb === undefined ? undefined : (
              <>
                <Link
                  href={sections.crumb.rootHref}
                  className="text-muted transition-colors hoverable:hover:text-cyan"
                >
                  {sections.crumb.owner} / {sections.crumb.slug}
                </Link>
                <span aria-hidden className="mx-1.5 text-faint">
                  /
                </span>
                <span className="text-fg">{sections.crumb.dir}</span>
              </>
            )
          }
          /* No `actions`. This row carried the `Code` control for one pass, GitHub's shape,
             and the owner moved it into the header band on 2026-09-06 — see the `download`
             prop on `BundleHeader` above. `FileTree`'s slot stays and is now unused; its own
             docblock says so rather than implying a caller. */
        />
      </div>

      {/* ---------- The README, GitHub's way ----------
          The owner asked for GitHub's arrangement, in these words: "adopt the github
          solution where the README is used to visualize in markdown the information about
          the repository (adopt the same graphical approach)". So the file list is followed
          by the bundle's own `README.md`, rendered — the same file the download ships,
          generated by `bundleReadme`, not a second description this page writes and then
          has to keep in step with the first.

          Four panels came off the page in this pass and the README is what stands in their
          place. It carries two things they carried, which is why the trade is not a
          reduction: the full bundle digest with the instruction for recomputing it, printed
          by the `Exact release` panel until today, and doc 1 §0.1.3's execution sentence
          ("This runs on your machine … It executes nothing and holds none of your provider
          keys") — in the bundle author's own file now rather than in this page's chrome.

          Nothing at all when there is no README — see `readme` above for why no placeholder
          prose goes here. */}
      {readme !== undefined && (
        /* The anchor is on a wrapper, which is `#blueprint-workspace`'s idiom two sections
           down and not a preference. `ReadmePanel` declares an `id="readme"` of its own for
           its `aria-labelledby`, and `components/site/anchors.test.ts` requires the element
           an anchor points AT to carry the header's scroll offset — that class belongs to
           whoever owns the panel, and a caller cannot put it on a tag in another file. So
           the rail points at a target this page declares, with the offset on it, and the
           panel's own id stays what it was for: naming its heading. */
        <div id="blueprint-readme" className="mt-8 scroll-mt-24">
          <ReadmePanel source={readme} file={BUNDLE_README} />
        </div>
      )}

      {/* ---------- WHAT THE BODY GRID TOOK WITH IT ----------
          A `grid gap-8 lg:grid-cols-3` stood here, with the graph in a `lg:col-span-2`
          column and a sticky `<aside>` beside it. The aside is gone and so is the grid: the
          owner moved the graph to full width and moved the aside's last panel off this page,
          and a two-column grid with one column is a third of a 1200px page left permanently
          blank.

          `VisibilitySwitch` is the panel that moved rather than went. The owner: "remove the
          panel visibility from the blueprint card; such option should be visible only on the
          user account list of the blueprints." It is not drawn in THIS rendering, including
          for the owner. It is still drawn on this route's OTHER branch: `DraftLanding`, for
          a bundle with no release, is handed the live switch further up this file.

          THE MOVE HAS LANDED, and this note said it was owed for a wave after it did.
          `components/profile/OwnedBundles.tsx` draws a `RowVisibility` per row on
          `/u/[username]`, over the same SEAM-67 route. That is the shelf's own component
          rather than this file's export, which is why `components/bundle/Aside.tsx` still
          exports `VisibilitySwitch` with `DraftLanding` as its one caller. A published
          bundle's owner has a control again, and nothing here should say otherwise.

          Four panels the aside had already lost are recorded here rather than being lost
          with the container: `Forks` (the owner: "remove the fork panel from blueprint" —
          the header's Fork button still makes one and prints how many exist), `Releases`
          (`History` below still lists what changed and when), `BundlePanel`, and the Score
          card with `VoteControl` under it. The digest `BundlePanel` printed survives in the
          rendered README above.

          ONE THING DID NOT SURVIVE, and it is a loss rather than a tidy. `BundlePanel` was
          the only surface on this page that drew the validator's diagnostics, and eight of
          the nine shipped bundles carry `analysis/criteria-leak-unanchored`, which doc 3
          §4.1 calls the most important check in the system. A reader of a published
          blueprint sees no validation output here at all. `/upload` still renders them for a
          bundle being validated, which is a different reader at a different moment, and
          `#security-explained` and `#explainability-heading` now resolve only there. §11.0
          records the gap. */}

      {/* History and the community notes, at the same width as everything above them. */}
      <div className="mt-8 flex flex-col gap-8">
        {/* `EvidenceLayers` opened this run: three columns headed Structural evidence,
            Community assessment and Run evidence, the last two stating how thin the sample
            behind a ballot and a run report was. It goes with the rest of the scoring
            reading. Its three honesty statements went with it, and each one was about
            something this page no longer shows: that a static risk-marker reading is not a
            security audit (the reading is gone), that no eligible ballot closes a radar
            polygon (there is no radar), and that DarkPrint does not watch a run happen and
            reports no cost (no cost row is drawn). The last of those three is the claim
            worth naming, because it is true of the product and not only of this page:
            `/reading-the-radar` still makes it, over the same components. */}

        <History entries={sections.history} />

        {/* `#use-this-blueprint` stood here: a `<details>` under the eyebrow `Exact release`
            and the heading `Use this blueprint`, holding `ForkAction`, the full digest and
            `DownloadPanel`. The owner asked it off the page, and chose where its download
            goes — the `Code` control on the file list above, which lists every file rather
            than the three the panel named. Where the other three things it carried stand,
            re-checked rather than carried forward:

              the full digest   the README below the listing prints it in full beside the
                                instruction for recomputing it. This line used to add
                                `BundlePanel` "in the aside", and both halves of that went:
                                the aside on 2026-09-06 and `BundlePanel` off this route
                                before it. The README is the only surface here that carries
                                the digest now.
              `ForkAction`      an explanation of forking that pointed at the header's own
                                Fork button. The button is live and unchanged. THE PANEL HAS
                                NO MOUNT: a grep over `app/` and `components/` for its own
                                JSX opening tag finds nothing, and no file in the tree
                                imports it. The token is described rather than written out,
                                because a needle quoted in prose is a needle a source-reading
                                guard cannot tell from a mount. `/nodes/[...id]`
                                was the last route that drew it, under `kind="node"`, and
                                that slot holds `components/nodes/CardForkButton.tsx` now.
                                Its own docblock records the same thing; whether an unmounted
                                component survives is the owner's call.
              the honesty line  "DarkPrint distributes these files. Your own harness decides
                                how to execute them." The claim is doc 1 §0.1.3's and it is
                                NOT dropped: the README this page now renders makes it in
                                the bundle author's own words ("This runs on your machine.
                                DarkPrint hands out the files and analyses them statically.
                                It executes nothing and holds none of your provider keys").
                                This line used to add that `DownloadPanel` carried its own
                                copy on `/build`; that route and the whole of
                                `components/build/` are deleted, so the README is where the
                                claim lives.

            `DownloadPanel` is not deleted either, and it has no caller left. The one that
            mounted it was `components/build/DownloadStep.tsx`, which went with `/build`, so
            the component is in the same standing as `ForkAction` above: it compiles, and
            nothing on the site renders it. Said here rather than left for a reader to infer
            a mount from a file that is still in the tree. */}

        {/* `#blueprint-source` stood here: `DotBreakdown` over `bp.graph.dot`, the file
            listed block by block at the full width of the body, with the rail beside it
            lighting the part a reader clicks. The owner asked it off this page ("remove
            ... the topology.dot panel at the bottom").

            The component stays and so does every other mount of it: `/spec/topology` draws
            the same figure over the specification's own example, and `BlueprintWalk` on the
            home page draws it over a bundle's. The file itself is one click away in the
            listing above and in the `Code` menu on it, which is what a GitHub repository
            page offers for a file it does not render. */}

        {/* `comments` still has to be passed — the frozen prop `Comments` always required —
            even though `live` wins the render; `EMPTY_COMMUNITY` is what makes it `[]`
            rather than a fixture this page no longer reads. */}
        <Comments
          comments={bp.comments}
          live={{
            target: { kind: "blueprint", refId: record?.id ?? "" },
            apiBase: `/api/blueprints/${owner}/${slug}/notes`,
            initial: {
              notes: notesPage.notes.map((n) => noteViewFrom(n, viewerHandle)),
              cursor: notesPage.cursor,
            },
            viewer: {
              signedIn: actor.kind === "account",
              ...(viewerHandle !== undefined ? { handle: viewerHandle } : {}),
            },
          }}
        />
      </div>
    </div>
    </SideRail>
  );
}
