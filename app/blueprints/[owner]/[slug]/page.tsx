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
import { buildPaneModel, paneNodesFor } from "@/components/panes/build";
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
  const actor = await actorNow();
  const summary = await blueprint(db, actor, owner, slug);
  if (summary === undefined) return { title: "Blueprint not found" };
  /* Two more reads for the description's prefix. A search result needs to say what kind
     of page this is; the node count and the autonomy class are what tell one blueprint
     from another in a list of titles. */
  const [drawings, scorecard] = await Promise.all([
    graphsOf(db, actor, [{ ownerHandle: owner, slug }]),
    scoresOf(db, actor, owner, slug),
  ]);
  const drawing = drawings.get(`${owner}/${slug}`);
  const shape =
    drawing === undefined || scorecard === undefined
      ? "Blueprint"
      : `Blueprint (${drawing.graph.nodes.length} node${drawing.graph.nodes.length === 1 ? "" : "s"}, ${scorecard.autonomy.label})`;
  return { title: summary.manifest.title, description: `${shape}: ${summary.manifest.summary}` };
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
    /* The rows are the page top to bottom, and the step numbers are stamped from that order
       rather than typed beside it. The tool capabilities panel has no row: it sits directly
       under the band, in view before a reader has scrolled, and a rail row is for a place a
       reader has to travel to. */
    { href: "#blueprint-workspace", label: "Graph and cards" },
    { href: "#files", label: "Files" },
    { href: "#blueprint-readme", label: "Readme" },
    { href: "#history", label: "History" },
    { href: "#community-notes", label: "Community notes" },
  ];
  /* Filtered rather than conditionally pushed, so the order above stays readable as the
     page's order top to bottom. */
  return rows
    .filter((row) => hasReadme || row.href !== "#blueprint-readme")
    .map((row, index) => ({ ...row, step: String(index + 1).padStart(2, "0") }));
}

/** The calendar day of a timestamp, which is the shape `prettyDate` formats. */
function isoDay(at: Date): string {
  return at.toISOString().slice(0, 10);
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

    return <DraftLanding draft={view} owner={ownerAuthor} isOwner={isOwner} />;
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
  /* No `isOwner` on this branch: the published view renders the same thing for the owner
     and for a stranger, which is what "such option should be visible only on the user
     account list of the blueprints" asks for. The draft branch above computes one because
     its quick-setup panel is owner-only.

     `account` is not idle for it: `record` is `getBundle(db, account.accountId, slug)`, and
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
  /* The bundle's own `README.md`, carried through `releaseFiles` off the export it already
     built (see its docblock: no second pass and no second query). `undefined` is a real
     answer — a release with no README, which nothing `addRelease` accepts can produce today
     — and it draws no panel at all rather than an empty box with DarkPrint's own prose in
     it. A sentence written here would reach a reader as the bundle author's. */
  const readme = folder?.readme;

  const updatedAt = isoDay(current?.createdAt ?? record?.updatedAt ?? new Date());
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
        at: isoDay(release.createdAt),
      })),
    /* `releases` was mapped here into per-release rows for the `Releases` panel, which
       came off on 2026-09-05. The RAW `releases` list is untouched and still read three
       times: `history` above it, the release count in the header, and the fork button's
       `sourceVersion`. Only this projection had a single consumer. */
  };

  /* `bundleNodes` stood here, joining `graph.nodes` to `cardRefs` by index for
     the Bundle panel's node list. It had that one consumer and went with the panel. The join
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

  /* Joined through the DOT, never by position: `summary.cardRefs` is sorted and distinct
     while `bp.graph.nodes` is in DOT order, so an index join showed the first node whichever
     card sorted first. */
  const paneNodes = paneNodesFor(bp.graph.nodes, bp.graph.dot, resolved, documents);
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
     expand and everything else. Both halves fed the Bundle panel and nothing else, and they
     went with it on 2026-09-05.

     THIS PAGE NOW DRAWS NO DIAGNOSTICS AT ALL, and that is a loss rather than a tidy: eight
     of the nine shipped bundles carry `analysis/criteria-leak-unanchored`, which is the
     check doc 3 §4.1 calls the most important in the system. `/upload` still renders them
     for a bundle being validated, which is a different reader at a different moment.
     §11.0 carries the row; nothing here should imply it is covered. */

  const header = (
    <BundleHeader
      owner={ownerAuthor}
      slug={bp.slug}

      visibility={record?.visibility ?? "public"}
      validator={ownerAuthor.validator}
      title={bp.title}
      summary={bp.summary}
      forks={forkRows.length}
      saveId={`blueprint:${bp.slug}`}

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

      download={
        folder === undefined ? undefined : (
          <CodeMenu
            download={{
              href: `/api/bundles/${owner}/${slug}/archive?digest=${encodeURIComponent(folder.digest)}`,
              name: `${slug}-${folder.version}.tgz`,
            }}
            cloneCommand={`npx -y darkprint clone ${owner}/${slug}`}
          />
        )
      }
      breadcrumb={
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/blueprints" className="transition-colors hoverable:hover:text-cyan">
            ← Blueprints
          </Link>
          <span className="mx-2 text-faint">/</span>
          <span className="text-muted">{bp.category}</span>
        </nav>
      }
      below={

        <span className="font-mono text-[11px] text-dim">
          {current !== undefined && (
            <>
              release <span className="text-fg">{current.version}</span> ·{" "}
            </>
          )}
          digest {shortDigest(bp.digest)} · {releases.length} release
          {releases.length === 1 ? "" : "s"}

          {current !== undefined && <> · published {prettyDate(isoDay(current.createdAt))}</>}
        </span>
      }
    >

      <div className="flex flex-wrap items-center gap-2">
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
  );

  return (
    <SideRail
      layout="tabs"
      header={header}
      label="On this blueprint"
      meta={`${railSections.length} sections`}
      items={railSections}
      ariaLabel="On this blueprint"
      compact
    >

    <div className="container-page py-6 lg:py-8">

      <div id="blueprint-workspace" className="scroll-mt-32">
        <SynchronisedPanes model={paneModel} graph={bp.graph} presentation="detail" />
      </div>

      <section className="mt-6 border-b border-line pb-6">
        <ToolScopes tools={bp.requiredTools} />
      </section>

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

        />
      </div>

      {readme !== undefined && (

        <div id="blueprint-readme" className="mt-8 scroll-mt-32">
          <ReadmePanel source={readme} file={BUNDLE_README} />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-8">

        <History entries={sections.history} />

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
