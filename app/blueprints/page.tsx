import type { Metadata } from "next";
import Link from "next/link";

import { GridBand } from "@/components/ui/GridBand";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { authorFor } from "@/components/profile/author";
import { getSharedDbClient } from "@/lib/db";
import { getPublicAuthor } from "@/lib/server/accounts";
import type { Actor } from "@/lib/server/policy";
/* T132's two batch readers (D-132-01), owed to this page under D-260-14 and D-260-21 and
   merged as 35. They are batch because a client-side-filtering shelf needs a drawing and a
   scorecard for EVERY tile on EVERY request: per-tile readers were one registry snapshot
   plus three statements per blueprint, per load. */
import {
  graphsOf,
  scoresFor,
  type BlueprintKey,
  type BlueprintSchematic,
  type Scores,
} from "@/lib/server/registry";
import { searchBlueprints } from "@/lib/server/search";
/* `BundleManifest` is the ENGINE's shape, taken through `lib/server/types` the way
   `lib/server/search/blueprints.ts` takes it. `lib/types` deliberately never imports
   `lib/core`, so the manifest is not on the contract the components read. */
import type { BundleManifest } from "@/lib/server/types";
import { AUTONOMY_BLURB } from "@/lib/format";
import type { Author, Blueprint, BlueprintAnalysisView } from "@/lib/types";

// The shelf is read from search and the registry rather
// than from `content/` at build time. The merged route is `GET /api/search/blueprints`; this
// page consumes the MODULE rather than the route (D-260-13).

export const metadata: Metadata = {
  title: "Blueprints",
  description:
    "Browse published blueprints for agent workflows. Filter by category, lifecycle phase and autonomy class, read each one as a graph, and download the folder.",
};

/** Who is asking, and it is nobody (D-260-13). Frozen so nothing may widen it in place. */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/**
 * The one hue an author with no account is drawn in.
 *
 * `components/profile/author.ts` keeps this number as a module constant and does not export
 * it, so this is the same value written down twice rather than imported — flagged rather
 * than quietly duplicated. The archive-backed page used a per-name hash instead, which is
 * the nicer picture and the one thing here that is NOT worth reproducing: that hash is also
 * module-private, and a second copy of a hash is a second colour scheme the day either is
 * touched.
 */
const UNSET_HUE = 210;

/**
 * AC1 IS A NEGATIVE ABOUT THE BUILD, AND MOVING THE READ OFF `content/` DOES NOT SATISFY IT
 * (D-260-05).
 *
 * Next prerenders a page it cannot see a request-time dependency in, and it cannot see one in
 * a drizzle query: with no `searchParams`, no `cookies()` and no `headers()`, all three
 * shelves came out `○ Static` in the build's route table — read from Postgres ONCE, at
 * deploy, and frozen there. That is the same defect the cutover exists to remove, one store
 * further along, and nothing in the source shows it.
 *
 * ── Why this spelling and not `connection()`, which is the prettier one ──
 *
 * `connection()` is Next 16's request-time marker and its own documented example is a
 * synchronous database driver, so it was the first choice and it is the wrong one HERE:
 * **measured, it throws ``connection` was called outside a request scope` when a page function
 * is invoked directly.** D-260-09 rules a per-route cell that renders each of these three
 * shelves against a seeded store, and in a `node` environment the only way to render one is to
 * call its default export — so `connection()` would red that cell against a correct page. A
 * route segment export is a module-level declaration: it makes the same claim to the compiler
 * and leaves the function callable.
 *
 * `revalidate = 0` would do equally well. `dynamic` is the spelling the rest of this codebase
 * would recognise, and `t262`'s per-request guard names `dynamic = "force-dynamic"` by hand as
 * the deliberate-dynamic value it would widen for.
 *
 * ── The version caveat, left here because the task that trips it will not be looking ──
 *
 * Next 16 REMOVES `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` once
 * `cacheComponents` is enabled, and it is absent from this version's route segment config
 * table for that reason. `cacheComponents` is off in `next.config.ts` today, which is why this
 * works and why `use cache` was unavailable to B-15. **The follow-up that enables it repo-wide
 * has to replace this line on all three routes**, and `connection()` is what it should replace
 * it with — by then the rendering path is the framework's, not a directly-invoked function.
 *
 * AC5 is untouched either way: it asks that the first paint need no JavaScript, which is a
 * statement about the HTML the server sends and not about when it was rendered. The shelf is
 * still fully server-rendered, now rather than at deploy.
 */
export const dynamic = "force-dynamic";

/**
 * The index of the Blueprints surface — doc 1 §0 names the section **Blueprints**
 * and gives "Gallery" only as its former name.
 *
 * The lead says what a blueprint *is*, at the author's request (2026-07-29), and that is
 * the one job it has now. It used to count the shelf and split it by whether a graph had
 * a person in it, which put a classification in front of a reader before the thing being
 * classified had been described.
 *
 * Two earlier drafts of this lead are worth not rediscovering. It once opened "Every dark
 * factory in the registry", which made a classification into a condition of entry and was
 * false about three of the nine besides; doc 2 §1.1 names that exact reading as the
 * barrier the principle exists to remove, where somebody looks at their own pipeline,
 * sees a manual step, and concludes they are not far enough along to publish. It later
 * offered to order the shelf "by what is downloaded or upvoted", which advertised two
 * counters this site does not have. Neither idea belongs in a sentence that only has to
 * define the noun.
 *
 * Doc 2 §1.1 still governs the controls under it: "Nella galleria l'autonomia è un
 * **filtro**, non un ordinamento di merito." Autonomy and phase coverage narrow the grid
 * the way a category does, and neither is a key it can be ordered by.
 *
 * ── What the cutover changed, and what it deliberately did not ──
 *
 * The shelf is read per request from the registry (D-260-05), so a blueprint published
 * after the last deploy is on it without a rebuild. Nothing about the CONTROLS moved: every
 * filter, the ordering and the fork stance are still decided in `GalleryBrowser` over the
 * full public set, which is why this page asks for the universe (`forks: "all"`) rather
 * than passing the reader's stance through — see the call below.
 *
 * `searchParams` is still not read here, and the reason has NOT changed — an earlier draft of
 * this comment asserted that the route was already rendering per request, while nothing in the
 * file made that so. It was prerendered, and the adversary round found it in the build's own
 * route table. The route segment export above is what makes that assertion true. Recorded
 * quietly deleted, because the belief travelled further than the defect did.
 *
 * The reason itself stands as it always did: a server component that reads `searchParams`
 * cannot answer the first paint without one, and AC5 is that the shelf is in the HTML.
 */
export default async function BlueprintsPage() {
  const { db } = getSharedDbClient();

  /* THE UNIVERSE, NOT THE READER'S SHELF (D-260-06).
     ------------------------------------------------------------
     `forks: "all"` because this page filters client-side: `GalleryBrowser.tsx:194` reads
     `params.get("forks") ?? "rolled"` and applies the stance itself. Asking with no `forks`
     key would resolve to `rolled` on the API and strip every published fork BEFORE the
     client saw the list, leaving `Forks: all` a control that silently does nothing.

     That is not this page acquiring a default. It is this page declining to apply one:
     there is exactly one authority for the stance and it is the client's, which is where it
     already was. D-260-03 forbids a page-side default ALONGSIDE a delegated one, and this
     is the opposite arrangement.

     No other key is sent, for the same reason — under D-260-06 this cutover consumes the
     API's DATA and not its FILTERING. */
  const results = await searchBlueprints(db, ANONYMOUS, { forks: "all" });
  const summaries = results.hits.map((hit) => hit.item);
  const keys: BlueprintKey[] = summaries.map((bp) => ({
    ownerHandle: bp.ownerHandle,
    slug: bp.slug,
  }));

  /* Two batch reads for the whole shelf rather than two per tile (D-132-01).
     ------------------------------------------------------------
     Both are unconditional: a page that filters client-side needs a scorecard and a drawing
     for EVERY tile on EVERY request, which is the case `lib/server/search/blueprints.ts`
     escapes by fetching scorecards only when a costly key is set. Per-tile readers would be
     one registry snapshot plus three score queries per blueprint, per load. */
  const graphs = await graphsOf(db, ANONYMOUS, keys);
  const scores = await scoresFor(db, ANONYMOUS, keys);

  const authors = await authorsOf(
    db,
    summaries.map((bp) => manifestOf(bp.manifest).author),
  );

  const blueprints: Blueprint[] = [];
  for (const bp of summaries) {
    const key = `${bp.ownerHandle}/${bp.slug}`;
    const drawing = graphs.get(key);
    const scorecard = scores.get(key);
    /* A BLUEPRINT WITHOUT A SCORECARD IS OFF THE SHELF.
       ------------------------------------------------------------
       That used to be every blueprint. D-260-24 measured that nothing in the product wrote
       `release.scored_ontology_version_id`, which `scoresOf` required, so it and any batch
       form of it answered `undefined` for every blueprint ever published and this shelf
       rendered EMPTY. `publish.ts` closed that by resolving the version to a row id, and the
       vocabulary-version registry that made the resolution possible has since been removed —
       so the scorecard's version is read off the stored `autonomy`, which `publish.ts` has
       always written. A blueprint whose release carries no score is still off the shelf, and
       that is still the honest outcome rather than a bug in this loop.

       The alternative was to draw the row with a placeholder class, and it is refused on
       principle: `autonomy.autonomyClass` is the one field doc 2 §1.1 guards most tightly,
       and a page inventing a classification nobody computed is worse than a page that says
       it has nothing to show. `searchBlueprints` already takes this position for the same
       reason — a half-written scorecard is not a scorecard.

       A missing DRAWING is the same decision for a different reason: `ContentRow` reads
       `item.graph` for its schematic and its node and edge counts, and a row with no
       drawing is not the row this shelf ships (D-260-14 refused that option by name). */
    if (drawing === undefined || scorecard === undefined) continue;
    blueprints.push(viewOf(bp, drawing, scorecard, authors));
  }

  /* Straight off the response's facets, which are computed from the VOCABULARY and never
     from the hit set (D-200-18) — so the category list is complete even when a reader has
     narrowed the shelf to nothing. Keyed by the URL parameter name, which is why it is
     `cat` here and `category` nowhere. */
  const categories = [...(results.facets.cat ?? [])];

  return (
    /* One container, not two.
       ------------------------------------------------------------
       The heading block and the shelf used to sit in separate `container-page` wrappers,
       the second carrying its own `py-16 sm:py-20` — so the gap between the lead and the
       first control was the second wrapper's top padding, 80px, and this page opened with
       a different amount of air from the two registry indexes built out of the same
       `SectionHeading`. Measured at 1440 with the lead bottom at y=252 on all three:
       `/blueprints` 80px, `/nodes` 40px, `/ontology` 40px.

       40px is the canonical `block` tier, which the vertical scale names for exactly this
       step (SectionHeading → content), and it is what both siblings already spend. So
       `mb-10` here rather than the `mb-16` the brief reached for: 64px is the `section`
       tier — section↔section — and taking it would have unified nothing, it would have
       made this page the odd one out in the other direction.

       Still one container. What is new outside it is a full-bleed host for the hero's graph
       paper, on the author's instruction that both registry galleries carry it — a decorative
       layer and nothing else, with no padding of its own, so the measurement above is
       untouched. `inset-x-0` inside `container-page` would have stopped at the 1200px gutters
       and shown two vertical edges the mask never fades. See `GridBand`. */
    <div className="relative">
      <GridBand />
      <div className="container-page relative py-12 sm:py-16">
      {/* `h1`, which every other index on the site passes and this one did not. It
          mattered less while this page was one heading; the sr-only "The shelf" `h2`
          under it means a page whose outline starts at level two gives a screen reader
          a sibling `h2` and no title. */}
      <SectionHeading
        as="h1"
        className="mb-10"
        eyebrow="Registry"
        title="Blueprints"
        lead={
          <>
            A blueprint is a folder of plain text: one graph file plus one card per node.
            DarkPrint draws the graph and checks the files; running them is done with your
            own tools.{" "}
            <Link
              href="/what-a-blueprint-is"
              className="text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright"
            >
              What a blueprint is <span aria-hidden>&rarr;</span>
            </Link>
          </>
        }
      />

      {/* Visually gone at the author's request, and still in the outline. The browser
          below labels each of its controls and carries no heading of its own, so
          deleting this outright would leave the grid as the one region on the page a
          screen reader reaches with no name, under an `h1` that names the whole route. */}
      <h2 className="sr-only">The shelf</h2>
      <GalleryBrowser blueprints={blueprints} categories={categories} />
      </div>
    </div>
  );
}

/** `BlueprintSummary.manifest` is `jsonb` and reaches this page unvalidated, exactly as it
    reaches `lib/server/search/blueprints.ts` — so it is narrowed the same way there and
    here rather than trusted, and a row missing a field costs its own tile and never the
    whole shelf. */
function manifestOf(manifest: unknown): Partial<BundleManifest> {
  return typeof manifest === "object" && manifest !== null ? (manifest as BundleManifest) : {};
}

/**
 * One row of the shelf, assembled from the four readers that each own part of it.
 *
 * ── The fields this shape requires and this shelf never reads ──
 *
 * `Blueprint` is `lib/types.ts`'s and it is the shape of a BUILD-TIME ARCHIVE record: it
 * carries a scorecard's `metrics`, an autonomy `blurb`, `downloads`, `votes` and
 * `comments`, none of which `GalleryBrowser` or `ContentRow` reads and none of which any
 * published backend reader returns. They are filled with the empty value of their own type
 * and that is a statement about this page rather than about the registry — nothing here
 * claims a blueprint has zero downloads, because nothing here renders the number.
 *
 * `downloads` and `votes` in particular: `components/ui/autonomy-surfaces.test.ts` holds
 * D-31/D-57's prohibition by finding files that READ `.downloads` or `.votes`. This file
 * reads neither; it writes a zero into a field the shelf dropped when it stopped reading
 * the archive, which is D-260-08's third direction — the figure did not become real, it
 * vanished — and there is no marker to move because there was never a marker on this page.
 *
 * `blurb` is NOT among them any more. It was an empty string here, because the constant was
 * module-private and the only consumable path would have tripped D-260-05(a)'s token; it now
 * lives in `lib/format.ts` and is read from there (D-260-30), so a required field carrying a
 * placeholder is one fewer thing on this page.
 */
function viewOf(
  bp: { ownerHandle: string; slug: string; manifest: unknown; digest: string; cardRefs: readonly string[] },
  drawing: BlueprintSchematic,
  scorecard: Scores,
  authors: ReadonlyMap<string, Author>,
): Blueprint {
  const manifest = manifestOf(bp.manifest);
  const analysis: BlueprintAnalysisView = {
    autonomy: scorecard.autonomy,
    security: scorecard.security,
    phaseCoverage: scorecard.phaseCoverage,
    /* `Scores` carries no diagnostics and T080 is right not to invent them: a diagnostic is
       a finding about a bundle at resolution time, and the stored scorecard is the three
       axes. The shelf renders none of them. */
    diagnostics: [],
  };
  return {
    kind: "blueprint",
    slug: bp.slug,
    /* The one granted line this Forbidden file takes from T261 (D-261-07). `bp.ownerHandle`
       was read three lines up to key the two batch maps and then dropped, and B-09 makes it
       half of the address every row on this shelf links to: `ContentRow` cannot build the
       canonical URL from a record that does not carry an owner. */
    ownerHandle: bp.ownerHandle,
    title: manifest.title ?? bp.slug,
    summary: manifest.summary ?? "",
    description: manifest.description ?? "",
    tags: Array.isArray(manifest.tags) ? [...manifest.tags] : [],
    category: manifest.category ?? "",
    author: authorOf(manifest.author, authors),
    autonomy: {
      autonomyClass: scorecard.autonomy.autonomyClass,
      label: scorecard.autonomy.label,
      isDarkFactory: scorecard.autonomy.isDarkFactory,
      level: scorecard.autonomy.level,
      /* The engine owns the class and its label; the sentence under them is the site's,
         and it is keyed on the class rather than on the 1-to-4 band for the reason doc 2
         §1.1 gives. Read from `lib/format.ts` (D-260-30) so the shelf and the archive-backed
         page say the same thing about a class — a second copy of four sentences of shipped
         copy is a second copy the day an author edits one. */
      blurb: AUTONOMY_BLURB[scorecard.autonomy.autonomyClass],
    },
    metrics: [],
    graph: drawing.graph,
    requiredAgents: [...drawing.requiredAgents],
    requiredTools: [...drawing.requiredTools],
    /* The `?? ""` is the shipped coalescing (`lib/content/view.ts:104-105`) and not a new
       branch: both manifest fields are OPTIONAL, and `GalleryBrowser` orders on
       `(updatedAt || createdAt).localeCompare(...)`, which needs a string. Measured against
       the shipped comparator rather than reasoned about: `"2026-07-01".localeCompare("")` is
       `1`, so a bundle carrying neither date sorts LAST and then by title (D-260-11). */
    createdAt: manifest.createdAt ?? "",
    updatedAt: manifest.updatedAt ?? manifest.createdAt ?? "",
    downloads: 0,
    votes: 0,
    comments: [],
    analysis,
    digest: bp.digest,
    cardRefs: [...bp.cardRefs],
  };
}

/**
 * The `Author` for a manifest handle, resolved against the account table when one holds it.
 *
 * ── An accountless handle is the honest end state, not a gap (D-260-25, D-250-11) ──
 *
 * The archive publishes under one account and creates no others, so a manifest may name a
 * handle nothing resolves: the six archive authors hold no accounts, and every release
 * published before the registry was renamed still carries the handle it was written with.
 * The current release of each archive bundle names the registry account and does resolve,
 * which is what the account column moving cannot do to bytes already stored.
 *
 * `NodeSummary.author` is optional and `/nodes` drops it, which is the interim D-260-25
 * ruled for that surface. **`Blueprint.author` is REQUIRED, so this page cannot drop it**
 * — it renders the handle plainly, with no display name and no hue of its own, which is
 * what `lib/content/view.ts:261` already does for the same case: *"it renders as plainly
 * unknown rather than silently attributed to somebody else."*
 *
 * What is still owed, and is not this task's: `ContentRow` builds `/u/${username}` with no
 * chance to refuse, so an accountless handle links to a profile that 404s. That is
 * D-260-25's ruled end state (d) — render the handle as TEXT, no profile link — on a file
 * outside T260's `Owns`, exactly as it is owed for `NodeCardSummary.tsx`.
 */
function authorOf(handle: string | undefined, authors: ReadonlyMap<string, Author>): Author {
  const known = handle === undefined ? undefined : authors.get(handle);
  if (known !== undefined) return known;
  const name = handle ?? "unknown";
  return { username: name, displayName: name, avatarHue: UNSET_HUE, validator: false };
}

/**
 * One account read per distinct handle the shelf names, skipping the ones nobody holds.
 *
 * `authorFor` is `components/profile/author.ts`'s rather than a second copy: it decides
 * three fallbacks — the display name, the hue, and what an absent bio means — and a page
 * inventing its own would disagree with every profile on the site about a reader's name.
 * Its exported signature is frozen under D-260-22 for that reason.
 */
async function authorsOf(
  db: ReturnType<typeof getSharedDbClient>["db"],
  handles: readonly (string | undefined)[],
): Promise<ReadonlyMap<string, Author>> {
  const distinct = [...new Set(handles.filter((h): h is string => h !== undefined && h !== ""))];
  const resolved = await Promise.all(
    distinct.map(async (handle) => [handle, await getPublicAuthor(db, handle)] as const),
  );
  const authors = new Map<string, Author>();
  for (const [handle, account] of resolved) {
    if (account === undefined || account.handle === null || account.handle === "") continue;
    authors.set(handle, authorFor(account));
  }
  return authors;
}
