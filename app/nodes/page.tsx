import type { Metadata } from "next";
import { GridBand } from "@/components/ui/GridBand";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { NodeBrowser, type NodeTypeTerm } from "@/components/nodes/NodeBrowser";
import type { NodeSummary } from "@/components/nodes/NodeCardSummary";
import { authorFor } from "@/components/profile/author";
import type { TermKind } from "@/lib/core";
import { requiresHuman } from "@/lib/core";
import { getSharedDbClient } from "@/lib/db";
import { getPublicAuthor } from "@/lib/server/accounts";
import { openView } from "@/lib/server/ontology";
import type { Actor } from "@/lib/server/policy";
import { latestCards, usersOfMany } from "@/lib/server/registry";
import type { Author } from "@/lib/types";

// The card library is read from the registry rather than from
// `content/` at build time. `GET /api/cards` never existed; the merged route is
// `GET /api/search/cards`, and this page consumes the MODULE rather than the route
// (D-260-13) because a server component that reads `searchParams` cannot stay a server
// component, and the first paint is what this page is for.

export const metadata: Metadata = {
  title: "Node cards",
  description:
    "Every node card in the DarkPrint registry: the reusable steps blueprints are built from, grouped by type. Each card shows its type, lifecycle phases, inputs and outputs, tools and risk markers. Filter by type, phase, human involvement or risk.",
};

/**
 * Who is asking, and it is nobody (D-260-13).
 *
 * The shelf is public, so the read is made as an anonymous visitor whoever is looking. This
 * states the caller rather than deciding what a caller may see: T060 owns that, and passing
 * the reader's own actor here would be this page asking for private rows it must never
 * render. Frozen for `lib/server/profiles/read.ts`'s reason — one value, shared, and nothing
 * may widen it in place.
 */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

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

export default async function NodesPage() {
  const { db } = getSharedDbClient();

  /* The vocabulary this build resolves against.
     ------------------------------------------------------------
     There used to be an absent case here, answered before it was asked: `openView` read the
     newest published version out of Postgres and threw for a version it did not hold, so a
     registry nobody had seeded had no labels and every `label` below fell back to the id.
     The vocabulary is in the process now, so the shelf is labelled on an empty registry the
     same way it is on a full one. A term id the vocabulary does not know still falls back to
     itself, which is the case that was always the interesting one.

     A view rather than the flat `id -> label` map `lib/server/search/cards.ts` builds for
     its facets. `resolve` follows a deprecation redirect and checks the kind; a map does
     neither, so a card still naming a renamed term would print the raw id here and its own
     label everywhere else on the site. */
  const ontology = openView();
  const labelOf = (id: string, kind: TermKind): string =>
    ontology.resolve(id, kind)?.term.label ?? id;

  /* `latestCards` and NOT `cards`, and the difference is visible on this shelf today.
     ------------------------------------------------------------
     `cards(db, actor)` is every indexed VERSION; `latestCards` is the newest version of
     every distinct id. The archive holds 57 card documents under 53 ids — `acceptance-
     verifier`, `bounded-retry`, `intent-router` and `schema-gate` each ship two — so
     reading the wrong one puts four cards on this page twice, under the same name, with
     nothing on either tile saying which version it is.

     It is also why this page does not go through `searchCards`: that searcher's universe is
     `cards()`, by design, because an API answering "every version" is the right answer for
     a query. A SHELF wants one tile per card. */
  const records = await latestCards(db, ANONYMOUS);

  /* One account read per distinct author rather than one per card.
     ------------------------------------------------------------
     53 tiles are written by a handful of people, and `getPublicAuthor` is a query each.
     Resolved once here and shared, the way `components/profile/load.ts` resolves the one
     account its whole shelf belongs to. */
  const authors = await authorsOf(db, records.map((record) => record.card.author));

  /**
   * How many blueprints pin each card, over EVERY version of it.
   *
   * `CardSummary.usedIn` is the wrong figure by one word: it counts blueprints pinning
   * *this exact version*, and `NodeSummary.usedIn` is "blueprints pinning any version of
   * this card". Four ids on this shelf have two published versions, so a blueprint holding
   * an older pin would drop out of the count on the tile for the newer one.
   *
   * `usersOf` is T080's own answer to that question and is used rather than re-derived: the
   * same union could be assembled from `blueprints()`'s `cardRefs`, and that assembly would
   * be a second implementation of a join the registry already publishes.
   *
   * `usersOfMany` is the batch form that comment promised: ONE snapshot, every id answered
   * from its `usersById` index. The per-row `usersOf` disclosure that stood here priced 53
   * snapshots per page load; T260's cutover made the page dynamic and turned that price
   * from a build-time cost into a per-request one, which is what armed the swap.
   */
  const usersByCard = await usersOfMany(db, ANONYMOUS, records.map((record) => record.id));
  const usedIn = new Map(
    records.map((record) => [record.id, (usersByCard.get(record.id) ?? []).length] as const),
  );

  const nodes: NodeSummary[] = records.map((record) => {
    const { card } = record;
    const author = card.author === undefined ? undefined : authors.get(card.author);
    return {
      id: record.id,
      version: record.version,
      ref: record.ref,
      name: card.name,
      action: card.action,
      type: card.type,
      typeLabel: labelOf(card.type, "node-type"),
      /* Zero, one or several — the card decides. Resolved here on the server, in the
         order the card wrote them, so the browser filters plain data and never has to
         ask the ontology anything. An id the vocabulary does not know is shown as
         written rather than guessed at. */
      phases: card.phases.map((id) => ({ id, label: labelOf(id, "phase") })),
      tools: [...card.tools],
      /* Derived from `type` through the vocabulary, the same call `computeAutonomy` makes,
         so a tile and the blueprint page that resolves the same card cannot disagree about
         where the people are.

         `false` when this registry has published no vocabulary at all, and the tile then
         draws no marker rather than the word "unattended" — the same degradation as the
         labels above, which fall back to the raw id. With no terms there is no
         subsumption to ask about, and answering "nobody is here" would be a claim. */
      requiresHuman: ontology !== undefined && requiresHuman(ontology, card.type),
      riskMarkers: card.riskMarkers.map((marker) => labelOf(marker, "risk-marker")),
      usedIn: usedIn.get(record.id) ?? 0,
      /* Resolved here rather than in the tile, and left `undefined` when no account holds
         the handle. The tile turns this into a link to `/u/<username>`, so an unresolved
         author has to fall out before it reaches the markup. Same lookup a profile page
         does, through the same two functions. */
      ...(author === undefined ? {} : { author }),
    };
  });

  /**
   * The node-type vocabulary, for the shelf's chrome.
   *
   * `NodeSummary` carries `type` and `typeLabel` and nothing else, which is everything the
   * filters and the tiles need and one field short of what a group header needs: the type's
   * one-line definition. Resolving it in the browser would mean shipping the ontology to the
   * client to answer eight questions that are settled the moment the page renders.
   *
   * Every node type the vocabulary carries, not only the ones the card library happens to
   * use: the type filter lists them all so a reader can see that a type exists and has no
   * card yet. The browser numbers the group headers over the types that have cards, so the
   * numbers a reader sees run without gaps.
   *
   * `byKind` returns them sorted by id; the browser re-sorts by label, next to the rule that
   * says the grid is ordered that way, so the two orders cannot come apart.
   *
   * `description` is dropped rather than blanked when a term carries none — a local overlay
   * may define a node type with an empty one, and the header draws no line rather than an
   * empty one. `OntologyTerm.description` is a required string, so this only fires on the
   * empty case, and it is the reason the prop's field is optional.
   */
  const types: NodeTypeTerm[] = (ontology?.byKind("node-type") ?? []).map((term) => {
    const description = term.description.trim();
    return {
      id: term.id,
      label: term.label,
      ...(description === "" ? {} : { description }),
    };
  });

  return (
    /* The hero's graph paper over the head of the shelf, on the author's instruction that
       both registry galleries carry it. The host is full-bleed so the band is: `container-page`
       is 1200px centred, and an `inset-x-0` layer inside it would stop at the gutters and
       show two vertical edges the mask never fades. See `GridBand` for why it is a band, why
       the `GridSpotlight` does not come with it, and why this host may not be
       `overflow-hidden` — the filter bar and the spine are both sticky inside it. */
    <div className="relative">
      <GridBand />
      <div className="container-page relative py-12 sm:py-16">
      {/* The lead was 45 words: three sentences defining the noun, then three
          properties of the archive. A shelf's job is to say what is on it. */}
      <SectionHeading
        as="h1"
        eyebrow="Registry"
        title="Node cards"
        /* No counts, on the author's instruction 2026-08-08. `architecture/ontology.md`'s
           rule is that a written count goes stale the moment content lands, which is why
           both of these were interpolated rather than typed; the author's point is the one
           the rule does not cover — a reader on the shelf is about to see how many there
           are, and two numbers in the deck are the page counting itself out loud. */
        lead="A node card describes one step of a blueprint: what it does, what it takes in and sends out, and what it refuses. These are all the cards in the registry, grouped by the kind of step they are."
        className="mb-10"
      />
      {/* No `Suspense`, and no `useSearchParams` behind it — see `NodeBrowser`.
          ------------------------------------------------------------
          The filters were briefly read with `useSearchParams`, which the Next docs say
          must be wrapped in a `Suspense` boundary or the production build fails. Adding
          the boundary made the build pass and quietly cost the page everything it is
          for: measured against `next start`, `/nodes` came back **56KB containing zero
          `<article>` elements**, because the same doc says calling that hook makes the
          client tree up to the nearest boundary client-rendered. All 53 cards left the
          prerendered HTML.

          On an archive whose claim is that it can be read rather than trusted, a shelf
          that ships no shelf is the worse bug. The browser keeps its URL state using
          plain history APIs instead, and this page renders every card into the markup
          the server sends. That is AC5, and it survived the cutover for the same reason
          it was won: the reading happens here, not in the browser. */}
      <NodeBrowser nodes={nodes} types={types} />
      </div>
    </div>
  );
}

/**
 * The `Author` for each distinct handle a card names, skipping the ones nobody holds.
 *
 * Two absences collapse to the same answer and the tile renders both the same way: a card
 * declaring no author, and one naming a handle no account holds. A card whose account has
 * since released its handle is the third, and it lands in the second: `authorFor` fills a
 * null handle with `""`, and `NodeCardSummary` builds `/u/${username}` with no chance to
 * refuse, so an empty handle would ship a link to `/u/`. It falls out here instead, which is
 * the only place that can see it.
 *
 * `authorFor` is `components/profile/author.ts`'s, not a second copy. The mapping from a
 * `PublicAuthor` to the `Author` the components read decides three fallbacks — the display
 * name, the hue, and what an absent bio means — and a page inventing its own would disagree
 * with every profile on the site about a reader's name.
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
