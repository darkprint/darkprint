import Link from "next/link";
import { notFound } from "next/navigation";

import type { NodeCard } from "@/lib/core";
import { DARKPRINT_CONFIG, parseCardRef, shortDigest } from "@/lib/core";
import { getSharedDbClient } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import {
  actorFrom,
  getPublicAuthor,
  publicAuthorsByIds,
  resolveOwner,
} from "@/lib/server/accounts";
import { getAggregate } from "@/lib/server/ballot";
import { getBundle, listReleases, parseStoredVocabulary } from "@/lib/server/archive";
import { getSignals } from "@/lib/server/counters";
import { forksOf } from "@/lib/server/lineage";
import type { NoteRecord } from "@/lib/server/notes";
import { listNotes } from "@/lib/server/notes";
import { getProfile } from "@/lib/server/profiles";
import { blueprint, card, draftBundle, graphsOf, scoresOf } from "@/lib/server/registry";
import { reportedCost } from "@/lib/server/runs";
import { releaseFiles, serveCardSource } from "@/lib/server/export";
import {
  BUNDLE_README,
  BUNDLE_VOCABULARY,
  TOPOLOGY_DOT,
  cardFilePath,
} from "@/lib/content/bundle-export";
import { blueprintViewOver } from "@/lib/content/view";
import type { CommunitySignals } from "@/lib/data/community";
import type { Blueprint } from "@/lib/types";
import { blueprintFileHref } from "@/lib/href";
import {
  CRITERIA_OUT_OF_BAND_CODE,
  CRITERIA_RELAYED_CODE,
  CRITERIA_SUSPECTED_CODE,
  CRITERIA_UNANCHORED_CODE,
} from "@/lib/criteria-state";
import { prettyDate } from "@/lib/format";
import { authorFor } from "@/components/profile/author";
import { readSession } from "@/components/profile/session";
import { KindBadge } from "@/components/ui/Badge";
import { AutonomyMeter } from "@/components/ui/AutonomyMeter";
import { TagPill } from "@/components/ui/TagPill";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { MetricBars } from "@/components/ui/MetricBars";
import { More } from "@/components/ui/More";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { AttractorCompatibility } from "@/components/blueprint/AttractorCompatibility";
import { absencesFor } from "@/components/panes/absences";
import { buildPaneModel, type PaneNodeInput } from "@/components/panes/build";
import { DotBreakdown } from "@/components/panes/DotBreakdown";
import { SynchronisedPanes } from "@/components/panes/SynchronisedPanes";
import { BundlePanel, type BundleNode } from "@/components/blueprint/BundlePanel";
import { BundleHeader } from "@/components/bundle/BundleHeader";
import { DraftLanding, type DraftLandingBundle } from "@/components/bundle/DraftLanding";
import { FileTree } from "@/components/bundle/FileTree";
import { History } from "@/components/bundle/History";
import { Forks, Releases, VisibilitySwitch } from "@/components/bundle/Aside";
import { VoteControl } from "@/components/bundle/VoteControl";
import { filesFromPaths, releaseDownloadCommand } from "@/components/bundle/load";
import { DownloadPanel, type DownloadCard } from "@/components/blueprint/DownloadPanel";
import { Comments, type NoteView } from "@/components/blueprint/Comments";
import { ForkAction } from "@/components/blueprint/ForkAction";
import { ToolScopes } from "@/components/blueprint/Requirements";
import { EvidenceLayers } from "@/components/blueprint/EvidenceLayers";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-03 LIVE: the blueprint is read from the registry (T080) per request.
// SEAM-19 LIVE: the folder is served by `/api/files/blueprints/{owner}/{slug}/d/{digest}/…`.
// SEAM-75 LIVE (T280): POST /api/blueprints/{owner}/{slug}/star — the star pill.
// SEAM-79 LIVE (T280): GET/POST /api/blueprints/{owner}/{slug}/notes and its /{noteId},
// /{noteId}/vote siblings — `Comments`' `live` prop.
// SEAM-20/57/67/70/71/74 LIVE (T280): watch, fork, visibility, votes — see the mounts below.

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
 * A module constant rather than something derived per bundle, because these are the page's
 * own structure and not the blueprint's: every slug renders all of them, and the two that
 * live outside this file — `#evidence` in `EvidenceLayers` and `#community-notes` in
 * `Comments` — are mounted unconditionally alongside the ones declared here. A bundle with
 * no comments still draws the section that says so.
 *
 * The count in the rail's own meta is read off `.length` rather than typed beside it. It
 * was typed, and it was wrong within one edit: `At a glance` left on 2026-08-11 and the
 * heading went on claiming eight sections over seven rows.
 *
 * No `active`. `SideRail` reads that as "no row is the page you are on", which is the truth
 * here: every row is an anchor into the page a reader is already reading. Lighting one
 * would need a scroll-spy, and a rail that claims a position it is not tracking is worse
 * than a rail that claims none.
 */
const BLUEPRINT_SECTIONS: readonly SideRailItem[] = [
  /* `#overview` stood here, first. It was a four-cell definition list of the domain, the
     node and handoff counts, the tool-scope count, the digest and the date, and the author
     removed it on 2026-08-11 as not informative enough to open the page with. It was not:
     every one of those facts is already drawn somewhere a reader is going anyway. The
     domain and the date are in the header band, the digest is in the version line and in
     `Use this release`, the shape is the graph two sections down, and the tool-scope count
     is a number over a list `Requirements` prints in full. A panel of pointers at other
     panels is what a page has instead of a first section, not one. */
  { href: "#files", label: "Files", step: "01" },
  { href: "#blueprint-workspace", label: "Graph and cards", step: "02" },
  { href: "#evidence", label: "Evidence", step: "03" },
  { href: "#history", label: "History", step: "04" },
  { href: "#use-this-blueprint", label: "Use this release", step: "05" },
  { href: "#blueprint-source", label: "Source", step: "06" },
  { href: "#community-notes", label: "Community notes", step: "07" },
];

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
 * page that draws its community numbers from `star`, `VoteControl` and `Comments`' `live`
 * mode instead — never a seeded stand-in with nowhere left to read it from.
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

export default async function Page({ params }: PageProps<"/blueprints/[owner]/[slug]">) {
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
  const isOwner = actor.kind === "account" && account !== undefined && actor.accountId === account.accountId;
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
  let signals: Awaited<ReturnType<typeof getSignals>> | undefined;
  let aggregate: Awaited<ReturnType<typeof getAggregate>> | undefined;
  let cost: Awaited<ReturnType<typeof reportedCost>>;
  let notesPage: Awaited<ReturnType<typeof listNotes>> = { notes: [], cursor: null };
  let forkRows: Awaited<ReturnType<typeof forksOf>> = [];
  if (record !== undefined) {
    [signals, aggregate, cost, notesPage, forkRows] = await Promise.all([
      getSignals(db, actor, { kind: "blueprint", refId: record.id }),
      getAggregate(db, actor, record.id),
      reportedCost(db, actor, summary.digest),
      listNotes(db, actor, { kind: "blueprint", refId: record.id }),
      forksOf(db, actor, record.id),
    ]);
  }

  /* Public forks, resolved to their owners' handles: `forksOf` already answers only public
     rows (its own doc — a private fork is invisible upstream in every direction, Q1), so the
     page adds nothing to that filter. `BundleRecord.ownerId` is an account id and this
     panel's rows want a handle, which is exactly what `publicAuthorsByIds` batches — one
     query for however many distinct forkers there are, rather than one `getPublicAuthor`
     per row. */
  const forkOwnerIds = [...new Set(forkRows.map((f) => f.ownerId))];
  const forkAuthors = forkOwnerIds.length === 0 ? new Map() : await publicAuthorsByIds(db, forkOwnerIds);
  const publicForks = forkRows.map((f) => ({
    owner: forkAuthors.get(f.ownerId)?.handle ?? "unknown",
    slug: f.slug,
    note: f.summary ?? "",
  }));

  /* The AUTHOR's real watcher count (T131, live since T280 wires a button onto it) —
     `profileFor(owner).watchers` was the fixture this replaces; `getProfile` answers the
     same shape `/u/<owner>` reads, over `count(*)` on `follow` rather than a seeded row. */
  const ownerProfile = await getProfile(db, actor, owner);
  const watchers = ownerProfile?.watchers ?? 0;

  /* `blueprintViewOver` still takes a `community: CommunitySignals` for the fields `live`
     does not cover (downloads, votes, comments, featured, seed) — see `EMPTY_COMMUNITY`'s
     own doc for why this page hands it zeros rather than `communityFor(slug)`'s fixture.
     `live` (B7's `AssembledViewInput` addition, `lib/content/view.ts`) is what turns the
     three community axes and the cost axis real: the three read `aggregate.<k>.value`, the
     cost axis follows D-180-01 (never normalized onto the 0–100 scorecard axis), and
     `signals` travels with the bag for `sampleSize`-shaped reads elsewhere. */
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
        ontologyVersion: scorecard.ontologyVersion,
        diagnostics: [...drawing.diagnostics],
      },
      community: EMPTY_COMMUNITY,
      diagnostics: drawing.diagnostics,
      live: { aggregate, cost, signals },
    }),
    /* The one field the projection cannot set: it builds from a manifest, and a manifest
       carries an author rather than an owner. */
    ownerHandle: owner,
  };

  const paragraphs = bp.description.split("\n\n").filter((p) => p.trim().length);

  /* Every download URL on this page is the release's DIGEST address (D-261-04). The static
     mirror under `public/bundles/<slug>/` is written from `content/` before a build, so it
     holds nothing at all for a blueprint published since the last deploy — AC3 and AC4
     cannot both be true of it. The mirror stays; this page stops linking it. */
  const at = { digest: summary.digest };
  const paths = folder?.files ?? [];
  const topologyHref = blueprintFileHref(owner, slug, at, TOPOLOGY_DOT);
  const downloadCards: DownloadCard[] = [...new Set(summary.cardRefs)]
    .sort()
    .map((ref) => ({ ref, href: blueprintFileHref(owner, slug, at, cardFilePath(ref)) }));
  /* `StoredVocabulary.terms` is `readonly unknown[] | null` deliberately — D-133-02 F1
     records what happened when readers took `unknown` off the barrel and each re-derived
     the shape. `parseStoredVocabulary` is the one published reading and it refuses a row
     that reached a bad shape without passing `addRelease`, so a malformed overlay costs
     this panel and never the page. */
  const overlay =
    current?.vocabulary === undefined
      ? undefined
      : parseStoredVocabulary(current.vocabulary, "blueprint page");
  const vocabulary =
    overlay === undefined || overlay.terms.length === 0
      ? undefined
      : { file: BUNDLE_VOCABULARY, termIds: overlay.terms.map((term) => term.id) };
  const clone = {
    command: releaseDownloadCommand(owner, slug, at, paths),
    cliCommand: `darkprint clone ${owner}/${slug}`,
  };

  const updatedAt = (current?.createdAt ?? record?.updatedAt ?? new Date()).toISOString();
  const shortened = `${summary.digest.slice(0, 13)}…`;
  const sections = {
    files: filesFromPaths(paths, updatedAt),
    hrefFor: (file: { kind: string; path: string }) =>
      file.kind === "dir" ? undefined : blueprintFileHref(owner, slug, at, file.path),
    readmeHref: blueprintFileHref(owner, slug, at, BUNDLE_README),
    fileFootnote: `${paths.length} entries · ${new Set(summary.cardRefs).size} pinned cards inside cards/`,
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
    releases: releases
      .slice()
      .reverse()
      .map((release) => ({
        version: release.version,
        at: release.createdAt.toISOString(),
        files: paths.length,
        size: "on disk",
        latest: release.digest === summary.digest,
      })),
  };

  // `graph.nodes` and `cardRefs` are both the resolved bundle's nodes mapped one to one, in
  // the same order, so the index is the join between a drawn node and its card.
  const bundleNodes: BundleNode[] = bp.graph.nodes.map((node, i) => {
    const ref = bp.cardRefs[i] ?? "";
    const parsed = parseCardRef(ref);
    return {
      nodeId: node.id,
      label: node.label,
      cardId: parsed?.id ?? ref,
      version: parsed?.version ?? "",
    };
  });

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

  // An error-severity diagnostic never reaches this page — `graphsOf` answers absent for a
  // release carrying one — so what is left is the engine's own footnotes.
  const notes = bp.analysis.diagnostics.filter((d) => d.severity !== "error");
  const explainedCodes = new Set<string>([
    CRITERIA_UNANCHORED_CODE,
    CRITERIA_OUT_OF_BAND_CODE,
    CRITERIA_SUSPECTED_CODE,
    CRITERIA_RELAYED_CODE,
  ]);
  const explainedNotes = notes.filter((d) => explainedCodes.has(d.code));
  const otherNotes = notes.filter((d) => !explainedCodes.has(d.code));


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
      meta={`${BLUEPRINT_SECTIONS.length} sections`}
      items={BLUEPRINT_SECTIONS}
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
      watchers={watchers}
      forks={publicForks.length}
      saveId={`blueprint:${bp.slug}`}
      /* No `support` any more: it read `bp.votes`, which was this page's stand-in for a
         seeded star count before T280 wired a real one. `star` below is the live
         replacement, and `bp.votes` is `EMPTY_COMMUNITY`'s `0` now — passing it through
         would be printing an index figure with nothing behind it and no marker beside it,
         which is `autonomy-surfaces.test.ts`'s own rule (`no surface prints a seeded
         index figure as a fact`). `BundleHeader`'s `support === undefined` branch draws a
         plain bookmark, which is the honest fallback for the one theoretical case below
         where `star` itself is absent. */
      clone={clone}
      /* T280: the three seeded halves of this note each got a live control of their own
         (the star pill, Watch, Fork), so the sentence narrows to the one clause that is
         still true of every bundle here — a page render is a snapshot over HTTP, never the
         thing `git clone` would give a reader. Omitted rather than restated: it is exactly
         `BundleHeader`'s own default for a bundle with a `clone`, so passing it again would
         be a second place this sentence could drift from that default. */
      star={{
        api: `/api/blueprints/${owner}/${slug}/star`,
        // `signals` is undefined only in the theoretical race `record`'s own comment
        // names — zero and unstarred are the same answer `getSignals` gives a target
        // nothing has happened to yet, so the fallback is the live reader's own zero.
        count: signals?.starCount ?? 0,
        starred: signals?.starredByCaller ?? false,
        signedIn: actor.kind === "account",
      }}
      watch={{ api: `/api/authors/${owner}/watch`, watchers, signedIn: actor.kind === "account" }}
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
      <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <KindBadge kind={bp.kind} />
            {/* The per-node reading goes with the class, the way it does on the gallery
                tile. Without it the meter can only render the half of itself that a graph
                with nobody in it earns — the dark factory token is gated on the flag, and
                both counterpart statements are gated on having the contributions — so the
                header of a supervised blueprint showed one token and the header of a
                closed-loop one showed two. That is the asymmetry the meter is built to
                avoid: a graph where a person acts answers with the nodes they act at,
                which is more said about it rather than less. */}
            <AutonomyMeter
              autonomy={bp.autonomy}
              contributions={bp.analysis.autonomy.contributions}
            />
          </div>
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
      {/* Long description, collapsed by default. PROJECT.md §3.1 first moved this above
          the four panes; a later pass moved it into the header. The band took the title,
          the summary and the badges with it, and this stayed here rather than going up
          with them: it is the only optional part of what the header used to be, and a
          disclosure inside an identity band would put four paragraphs between the name of
          the thing and the first section about it.
          `More` is a native `<details>` (already used by `DownloadPanel` and the
          disclosures further down), which keeps the prose in the prerendered HTML
          regardless of `open`. */}
      {paragraphs.length > 0 && (
        <More summary="Read more" bare>
          {paragraphs.map((p, i) => (
            <p
              key={`${i}-${p.slice(0, 16)}`}
              className="text-[15px] leading-relaxed text-muted"
            >
              {p}
            </p>
          ))}
        </More>
      )}

      {/* `At a glance` stood here and is gone; `BLUEPRINT_SECTIONS` above records why. One
          fact it carried is not drawn anywhere else on this page: the publication date. It
          moves onto the version line rather than being lost, which is where a reader is
          already reading a digest and asking how old it is. */}

      {/* ---------- Files ----------
          The folder, before the drawing. A bundle is a folder before it is a page, and a
          reader who has just read what this is asks what they would get. Over the same
          array `releaseDownloadCommand` builds its URLs from — `releaseFiles`' answer for
          this release — so the listing here, the command in `Get the folder` and the files
          the server will actually hand over are three renderings of one list. The owner's
          view is no longer a second page to keep in step: it is this one, under a different
          actor (D-261-08(1)). */}
      <div className="mt-10">
        <FileTree
          files={sections.files}
          lastChange={sections.lastChange}
          author={bp.author}
          hrefFor={sections.hrefFor}
          readmeHref={sections.readmeHref}
          footnote={sections.fileFootnote}
        />
      </div>

      {/* ---------- Body ---------- */}
      {/* Panel reorg spec §A2, revised three times: the Score card rode in
          `SynchronisedPanes`'s own `aside` slot, sticky beside the graph — Requirements
          and Bundle moved out of that column entirely, because stacking all three
          there made the column taller than the graph's own natural height, which
          left `position: sticky` with no slack to move Score within (a box already
          exactly as tall as the row it sits in has nowhere to go as the page
          scrolls). Score then moved into the page's own right column, the graph left
          the grid altogether to be as wide as the body, and the graph is now back in
          the grid's two-thirds column with Score beside it — see its mount below for
          what that is worth and what it costs.
          The body used to be `mx-auto max-w-4xl`, which is 896px inside this page's
          1152px `container-page`. The author read the result: the panels have to occupy
          the same horizontal space as the title section above them, and a body inset by
          128px a side under a full-width header reads as two pages stacked.

          The 2:1 graph/aside split still happens inside this one column; the column is
          now the page's.

          It does **not** fix the radar's clipped axis labels, which render as "Reli" and
          "rity" here. That was worth checking rather than assuming: the aside went from
          under 300px to about 370px and the labels are clipped exactly as before, so they
          are being cut by the figure's own bounds and not by the column around it. See
          `components/viz/RadarChart.tsx`. */}
      {/* Two columns, the node page's shape.
          ------------------------------------------------------------
          The author: the panels "should be placed like the structure we have in the node
          webapge where each box on the left occupised 2/3 of the column and the right
          part is made by this attached ... I want the radard panel behaving like the one
          attached for the node card; this up to the community notes which stay like now."

          `SynchronisedPanes` used to own a 2:1 split of its own, for the graph row alone,
          with the Score card in its `aside`. Everything under that row went full width,
          so the page had one shape for its first screen and another for the rest, and the
          Score card stopped being sticky the moment the graph ended.

          The split is the page's and runs the whole body, graph included: the left column
          carries the graph, the panels and the engine's working, and the right one carries
          Score and Bundle and stays put while the left scrolls. `lg:self-start` is what lets
          `sticky` move at all — a column stretched to the row's height has nowhere to go.

          Comments stay full width below, as asked. */}

      {/* ---------- the body grid, and why it has four children rather than two ----------
          The author: on narrow screens the Score panel goes DIRECTLY BELOW the block the
          "Jump to a node" label opens, using CSS grid `order`/`row-start` and not a second
          copy of the markup. `architecture/website.md` has recorded that behaviour since
          the two-column pass; the page never had it. Score was the first child of a
          sticky aside that sat after the whole left column, so below `lg` — where the
          grid collapses to one column and DOM order IS reading order — it landed 2,619px
          down the page, behind Tool scopes and an ~1,800px explainability block. Measured
          on `starter-software-factory` at 390: the "Jump to a node" label at y=1245, Score
          at y=3864.

          `order` alone cannot fix that, and this is the trap worth writing down: `order`
          reorders SIBLINGS inside one container. Score is a child of the aside and the
          skeleton pane is a grandchild of the left column, so no value of `order` on the
          two grid children can interleave one into the other. Something has to become a
          grid item, which is what `display: contents` does — below `lg` the aside has no
          box of its own and Score and Bundle are direct children of this grid.

          So the grid has four children, in DOM order: the graph panel, Score, Bundle, and
          then everything that used to follow the graph in the same column.

            below lg   one column, DOM order, with `order-1` holding Bundle last:
                       graph + skeleton → SCORE → tool scopes + explainability → bundle
            at lg      `lg:flex` gives the aside its box back and `lg:row-span-2` gives it
                       both rows, so the three grid areas are exactly what they were:
                       graph (row 1, cols 1-2), aside (col 3, rows 1-2, sticky), the rest
                       (row 2, cols 1-2). Nothing about the wide layout moves.

          `lg:row-span-2` is not decoration. Without it the aside is trapped in row 1 and
          `position: sticky` stops moving once row 1 ends — a regression invisible in a
          screenshot of the top of the page.

          `min-w-0` moves onto Score and onto Bundle's wrapper for the same reason: below
          `lg` the aside is not a box any more, so the overflow guard cannot live on it.

          `components/panes/archive-labels.test.ts` reads this file's SOURCE TEXT and pins
          four things in order — the grid literal, then the two-thirds column class, then
          the panes mount, then the aside — because every canvas measurement in that file
          is computed from them. It matches on the column class WITH ITS CLOSING QUOTE, so
          prose above the grid may not spell that class out; this sentence used to and
          moved the first match 328 characters before the grid literal, which fails with a
          message about a column that had not moved. All four still hold: the wrapper is
          still the first `lg:col-span-2` and still precedes the mount, and the aside still
          follows it. */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div id="blueprint-workspace" className="scroll-mt-24 flex min-w-0 flex-col gap-8 lg:col-span-2">
        {/* The graph and the card skeleton, consolidated: doc 2 §5.1's pane 1 and pane 2, the
            first thing in the body after the header. Clicking a node — or picking one from
            the dropdown beside the card skeleton — moves the same `selection` both panes
            share, and the card it resolves opens its own page through the skeleton's "Open
            card" link. The raw DOT and the raw card YAML (the four-pane view's panes 3 and
            4) are not redrawn here; `DownloadPanel` below already links to those exact bytes.

            ── This panel is in the column, and what that costs, measured ──
            It spent one commit outside the grid at the full width of the body, because the
            width of the box is the only lever on how large a schematic is drawn: every
            archive drawing is width-bound at every viewport, so a taller pane buys literally
            nothing and a wider one buys everything. The author has ruled for the LAYOUT.
            Two thirds of the body is a 729px canvas at 1440 against the body's 1124, and on
            a six-column drawing that is a whole-graph fit of 0.599 against 0.943 — so
            `AgentNode`'s 11px kind row renders at 6.6 CSS px here and its 14px name at 8.4,
            where the full body gave 10.4 and 13.2. The site holds its figures to 10 CSS px,
            and `starter-software-factory` at 12.1 is the only blueprint that clears it in
            this column. The trade is the author's, made with the numbers in front of them:
            the panels "should be placed like the structure we have in the node webpage where
            each box on the left occupies 2/3 of the column", and reorg spec §A2 wants a
            reader to get "the glance and the grade in one glance of the page" — which is
            Score, sticky, beside the drawing.

            What did NOT come back with the layout is the crop. The fit still draws every
            blueprint whole at every width, with no floor under it; the drawing is smaller in
            this column, not cut off. `components/graph/framing.ts` carries the table of what
            each blueprint measures where, and `components/panes/archive-labels.test.ts`
            asserts both halves — whole everywhere, and the 6.6 CSS px floor this column
            actually achieves rather than the one the site would prefer. */}
        <SynchronisedPanes model={paneModel} graph={bp.graph} />
        </div>

        {/* The right column: the reading, then the folder it came from. Bundle moved
            here from the full-width run below, on the author's instruction, so the two
            things a reader checks against the graph travel with it.

            `contents` below `lg`, a flex column at `lg` — see the note on the grid above
            for what that buys and what `lg:row-span-2` is holding up. */}
        <aside
          aria-label="The reading, and the folder it came from"
          className="contents lg:sticky lg:top-20 lg:col-span-1 lg:row-span-2 lg:flex lg:min-w-0 lg:flex-col lg:gap-8 lg:self-start"
        >
          <section className="panel min-w-0 p-5">
            <div className="mb-3 flex items-center justify-between">
              <PanelLabel>Score</PanelLabel>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                6-metric card
              </span>
            </div>
            <div className="flex justify-center">
              <ScoreRadar metrics={bp.metrics} size={280} />
            </div>
            <MetricBars
              metrics={bp.metrics}
              autonomy={bp.autonomy}
              compact
              audit={{
                securityRaw: bp.analysis.security.raw,
                securityMarkers: bp.analysis.security.penalties.length,
              }}
              className="mt-4"
            />
          </section>

          {/* T280: casting a ballot, beside the card it moves — the scorecard region, as
              the phase-B contract asks, rather than a form buried under the fold. `aggregate`
              is undefined only in the theoretical race `record`'s own comment above names;
              a bundle with no live aggregate to show gets no control rather than a blank one. */}
          {aggregate !== undefined && (
            <div className="min-w-0">
              <VoteControl
                api={`/api/blueprints/${owner}/${slug}/votes`}
                aggregate={aggregate}
                signedIn={actor.kind === "account"}
              />
            </div>
          )}

          {/* No wrapper of its own, once: `BundlePanel` draws its own bordered panel with
              its own "Bundle" header, so putting it inside a `panel` titled "Bundle"
              printed the word twice. It has a bare `<div>` now for two jobs the dissolved
              aside can no longer do — `order-1` keeps it LAST below `lg`, where it is a
              sibling of Score and of both left-column blocks rather than a child of a box
              that already ordered it, and `min-w-0` is the overflow guard that used to sit
              on the aside. `lg:order-none` is defensive rather than needed: inside the
              flex column at `lg` it is already the last child. */}
          <div className="order-1 min-w-0 lg:order-none">
            <BundlePanel
              digest={bp.digest}
              // Doc 3 §8: the version a score was computed under, which the engine
              // takes from the view the bundle was resolved against. Both metrics
              // carry the same value; a test in `lib/core` asserts they and
              // `BlueprintAnalysis.ontologyVersion` can never disagree. The manifest
              // used to declare a version of its own beside it, and no longer does.
              scoredOntologyVersion={bp.analysis.autonomy.ontologyVersion}
              nodes={bundleNodes}
              pinnedCards={new Set(summary.cardRefs).size}
              diagnostics={otherNotes}
              explainedNotes={explainedNotes}
            />
          </div>

          {/* Panels the accounts pass adds to the aside, all about the bundle as a thing
              somebody owns rather than as a reading. They sit after Bundle for the same
              reason Bundle sits after Score: the page argues from the graph outward, and
              who has copied this, and who may change it, are the last questions, not the
              first. `VisibilitySwitch` renders only for the owner — a stranger has no
              write ahead of them here, and drawing the switch for a reading they cannot
              act on would be showing a control that always refuses. */}
          <div className="order-1 flex min-w-0 flex-col gap-8 lg:order-none">
            <Forks forks={publicForks} />
            <Releases
              releases={sections.releases}
              fetchable={folder !== undefined}
              {...(isOwner ? { publishHref: `/upload?owner=${owner}&slug=${slug}` } : {})}
            />
            {isOwner && (
              <VisibilitySwitch
                visibility={record?.visibility ?? "public"}
                live={{ api: `/api/bundles/${owner}/${slug}/visibility` }}
              />
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
        {/* Tool scopes and the engine's working, in the same column as the graph and
            under the "Jump to a node" block `SynchronisedPanes` renders below it — moved
            out of the sticky aside column (see the comment above) so the graph and
            Score keep their own natural sizes instead of the column being stretched
            to hold three panels' worth of content. */}
        {/* Two panels where there was one called "Requirements". The models are a
            suggestion the author ran on and a reader may override; what the graph is
            allowed to reach is a fact about its blast radius and the input to the
            security reading, so it stands on its own. */}
        {/* Open, not folded. The author: "Make suggested model box and tool scope
            always open and not collapsed." Both are short, both answer a question a
            reader has while looking at the graph beside them, and a disclosure over four
            lines costs a click to save nothing. */}
        {/* "Suggested models" stood here and is gone. The author: the model "should be
            listed in the node description as a entry", and it already is: `model` is a
            Behaviour row in the card skeleton directly above, per node, read off the card
            it belongs to. The panel aggregated the same field across the graph and put a
            second answer on the same screen.

            `Tool scopes` stays, and the difference is worth stating rather than assuming:
            what a graph is allowed to reach is the input to the security reading, so the
            union of it is a fact about the blueprint and not just a per-node one. If that
            reasoning does not hold for you either, the panel goes the same way. */}
        <section className="panel flex flex-col gap-3 p-5">
          <PanelLabel>Tool scopes</PanelLabel>
          <ToolScopes tools={bp.requiredTools} />
        </section>


        {/* Explainability: the engine's own working for Autonomy and Security, in
            that order. `BlueprintCanvas` no longer draws its own schematic (the
            merged graph panel above already covers that) and no longer takes a Score
            panel as `children` either, now that Score lives in the aside beside the
            graph instead — it owns only the client boundary that shares a
            `highlighted` node id across Explainability's own sub-lists, so clicking a
            contribution row and a finding row naming the same node still cross-light
            each other. */}
        <BlueprintCanvas graph={bp.graph} analysis={bp.analysis} />

        {/* SEAM-41's answer, on a page for the first time. `lintAttractor` has been
            exported for an editor since it shipped and the seam row says "no dedicated
            UI", so every blueprint here has had a computable "would a runner read this
            file" verdict that no reader was ever shown. It sits under Explainability
            because it is a reading of the same artefact and belongs with the other two,
            and it takes `bp.graph.dot` — the same source `DotBreakdown` lists further
            down — so the verdict and the file a reader is looking at cannot part.

            Outside `BlueprintCanvas` deliberately. That component exists to share one
            `highlighted` node id across Explainability's sub-lists, and these findings are
            about the DOT's text rather than about nodes in the schematic; folding them in
            would put rows that cannot cross-light inside the mechanism whose whole job is
            cross-lighting. It is also a server component and stays one here. */}
        {/* No margin of its own, like `Tool scopes` and `BlueprintCanvas` above it. The
            column owns the spacing (`lg:gap-8`, and the outer grid's below `lg`, where the
            aside is `contents`), so a panel that added one would sit further from its
            neighbour than the two above it do. */}
        <AttractorCompatibility dot={bp.graph.dot} file={paneModel.dotFile} />

        </div>

      </div>

      {/* Comments and the download, full width under both columns. Community notes
          "stay like now", per the author. */}
      <div className="mt-8 flex flex-col gap-8">
        {/* `live`'s three fields (owner: B7, CONTRACT-FE.md's pin): `sampleSize` is the
            weakest of the three ballot axes — sufficiency reads as the thinnest sample
            behind a number, not the thickest — `minSample` is the same threshold
            `Aggregate.isSample` is computed against, and `runs` is this exact release's
            reported-and-surviving run count (D-180-02: `reportedCost` scopes to one
            digest's modal model group, never the bundle's history). Read against the
            component's own additive prop rather than against a merged implementation
            (EvidenceLayers.tsx is B7's this wave), so the exact fields it keys off may
            still move; reported per the phase-B contract's instruction for a pin B7 has
            not landed yet. */}
        <EvidenceLayers
          blueprint={bp}
          {...(aggregate !== undefined
            ? {
                live: {
                  sampleSize: Math.min(
                    aggregate.efficacy.sampleSize,
                    aggregate.reliability.sampleSize,
                    aggregate.transparency.sampleSize,
                  ),
                  minSample: DARKPRINT_CONFIG.telemetry.minRuns,
                  runs: cost?.runs ?? 0,
                },
              }
            : {})}
        />

        <History entries={sections.history} />

        <details
          id="use-this-blueprint"
          className="group scroll-mt-24 rounded-xl border border-cyan/35 bg-surface p-5 sm:p-7"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-5 [&::-webkit-details-marker]:hidden">
            <div className="max-w-2xl">
              <PanelLabel>Exact release</PanelLabel>
              <h2 className="mt-2 font-display text-2xl font-semibold text-fg">Use this blueprint</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Take the complete bundle. Adapt it locally. Validate the result before
                you run or publish it. DarkPrint distributes these files. Your own harness
                decides how to execute them.
              </p>
            </div>
            <span className="mt-1 inline-flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
              <span className="group-open:hidden">Show files</span>
              <span className="hidden group-open:inline">Hide files</span>
              <span
                aria-hidden
                className="text-lg transition-transform duration-150 group-open:rotate-45"
              >
                +
              </span>
            </span>
          </summary>
          <div className="mt-5 border-t border-line pt-5">
            <div className="flex justify-end">
              <ForkAction />
            </div>
            <p className="my-4 break-all font-mono text-[11px] text-dim">
              digest {bp.digest}
            </p>
            <DownloadPanel
              topologyHref={topologyHref}
              readmeHref={blueprintFileHref(owner, slug, at, BUNDLE_README)}
              {...(vocabulary === undefined
                ? {}
                : {
                    vocabulary: {
                      href: blueprintFileHref(owner, slug, at, vocabulary.file),
                      termIds: vocabulary.termIds,
                    },
                  })}
              cards={downloadCards}
              clone={clone}
            />
          </div>
        </details>

        {/* ---------- the file itself, at the width the file needs ----------
            The author asked for the `<slug>/blueprint.dot` panel to be BIGGER, for the
            important tag to light up in blue, and — this pass — for the highlight to be
            driven by a CLICK on the rail beside the file rather than by the page's scroll
            position. The scroll choreography that stood here for one release is gone, not
            gated: `components/panes/DotBreakdown.tsx` records what replaced it.

            Both asks are answered by taking the listing out of a column. The page carried
            `blueprint.dot` only as a download button, and the panel the ask describes —
            `components/ui/SourcePanel.tsx` — is a half-grid box that measures 564x320
            against 713x578 of content wherever it is mounted: 45% of the file hidden
            downward, 21% of it hidden sideways, in a box a reader has to scroll inside a
            page they are already scrolling. Full width is 1152px here, the listing takes
            two thirds of that, and every line of every blueprint in the archive is on
            screen at once with no nested scrolling of any kind.

            WHY IT IS HERE AND NOT IN THE LEFT COLUMN. Two thirds of the body is 757px, and
            the same 2:1 figure inside it would give the listing 463px against a longest
            line of about 690px — which is smaller than the panel this replaces, not
            bigger. A figure whose whole argument is "you can read the file" cannot be
            width-starved to sit beside something.

            It follows the two columns and precedes the community notes, which keeps the
            drawing, the reading and the folder together above it and leaves this as the
            last thing the page says in its own voice: here is the source, and here is what
            each part of it is.

            `components/panes/DotBreakdown.tsx` carries the register and the contrast
            numbers; `components/panes/dot-breakdown.ts` derives every block from the file
            so that nine different DOTs cannot drift out of a hand-typed table. The same
            figure is mounted on `/spec/topology`, over the same file, which is why it takes
            its source and its title as props and holds no knowledge of either page.

            No `downloadName` here. This page already offers `blueprint.dot` in its
            `Download` disclosure a few hundred pixels below, and two buttons for the same
            bytes is two answers to one question. `/spec/topology`, which has no such
            disclosure, passes one. */}
        <div id="blueprint-source" className="scroll-mt-24">
          <DotBreakdown source={bp.graph.dot} title={`${bp.slug}/${paneModel.dotFile}`} />
        </div>

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
