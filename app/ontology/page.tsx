import type { Metadata } from "next";

import type { OntologyTerm, OntologyView } from "@/lib/core";
import { partitionTerms } from "@/lib/core";
import { getSharedDbClient } from "@/lib/db";
import { openView } from "@/lib/server/ontology";
import type { Actor } from "@/lib/server/policy";
import { cards } from "@/lib/server/registry";
import { searchTerms } from "@/lib/server/search";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";
import { markerWeight, termUsageOver } from "@/components/ontology/TermTable";
import { OntologyCatalog } from "@/components/ontology/OntologyCatalog";
import {
  VocabularyBrowser,
  type VocabularyRow,
} from "@/components/ontology/VocabularyBrowser";

// SEAM-14 LIVE: the vocabulary and its usage column are read from the registry (T080) and
// from search (T200) rather than from `content/` at build time. The merged route is
// `GET /api/search/terms`; this page consumes the MODULE rather than the route (D-260-13).

/* ============================================================
   /ontology — the ontology, browsable.

   ── This route did not exist ──
   `app/ontology/[...term]/` is a catch-all, and a catch-all does not match its own parent,
   so `/ontology` answered 404 while `README.md` described it as the browser and
   `next.config.ts` 308'd `/ontologies` onto it — a redirect that landed on a 404. Nothing
   noticed because nothing linked it: until the nav pass the chrome had no entry for the
   ontology at all, which is precisely the third problem that pass names.

   ── It was called "Vocabulary" here until 2026-08-12 ──
   Two routes, two questions: this one lists the words a blueprint and a card are allowed to
   use, and `/spec/ontology` is the specification of the format those words are written in.
   `components/site/nav.test.ts` forbids one label on two routes, so one of them had to be a
   synonym, and this page took it.

   The author ruled the other way: "adopt the term Ontology also for /ontology page … be
   consistent through all the website." The word is `/ontology` in the URL, `ontology/` in a
   bundle and `ontologyVersion` on a score, and the chrome was the only surface disagreeing.
   (A card carried an `ontology_version` too when that instruction was given.)
   The spec row is now "Ontology file (YAML)", the shape its siblings in that menu already
   had — see `SiteHeader`'s decision 1.

   Every figure on this page is counted off the registry, on the request that renders it.
   The usage column is the one worth naming: it says how many published cards name each
   term, which is what makes "curated and small on purpose" checkable rather than asserted.
   It used to be counted off `content/` at build time, which meant a card published after
   the last deploy did not move a single number here until somebody rebuilt the site.
   ============================================================ */

export const metadata: Metadata = {
  title: "Ontology",
  description:
    "Every term a blueprint and a node card are allowed to use: node types, data types, tools, risk markers and the five phases, with what each one costs and how many cards name it.",
};

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
 * Who is asking, and it is nobody (D-260-13).
 *
 * A local term is not a row with a visibility column — it inherits its bundle's — so the
 * anonymous read is what keeps a private bundle's vocabulary off this page, by never
 * putting the bundle in the universe rather than by a filter downstream that has to
 * remember. That rule is `lib/server/search`'s and this page does not restate it; it only
 * says who it is.
 */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/**
 * The rail's rows: the catalog's five kinds, then the governance band under them.
 *
 * A module constant rather than something derived from the ontology, because these are the
 * CATALOG's sections and not the vocabulary's: the five kinds are what `OntologyCatalog`
 * draws panels for, in the order it draws them, and a build where the archive gained a
 * sixth kind would need the panel before it needed the row.
 *
 * ── What the rail maps, and what it does not ──
 * These fragments exist while the catalog is on screen, which is whenever nothing is
 * filtered. Set a search or a kind and `VocabularyBrowser` swaps the catalog for its flat
 * results, so the sections a row points at are not on the page and the row goes nowhere.
 * That is stated in the rail's own footer rather than hidden: it is the honest half of a
 * page that deliberately shows one enumeration at a time, and the alternative — a rail that
 * disappears when a reader types — is a chrome that moves under them.
 *
 * No `active`. `SideRail` reads that as "no row is the page you are on", which is the truth
 * here: every row is an anchor into the page a reader is already reading, and
 * `RailScrollSpy` lights whichever one they have scrolled into.
 */
const VOCABULARY_SECTIONS: readonly SideRailItem[] = [
  { href: "#phases", label: "Phases", step: "01" },
  { href: "#node-types", label: "Node types", step: "02" },
  { href: "#risk-markers", label: "Risk markers", step: "03" },
  { href: "#data-types", label: "Data types", step: "04" },
  { href: "#tools", label: "Tool capabilities", step: "05" },
  { href: "#governance", label: "Core and local", step: "06" },
];

/**
 * The vocabulary this page describes: the published core, with every local term a public
 * blueprint's current release declares merged over it.
 *
 * Two readers because there are two corpora and only one of them is in the database
 * (D-200-17). The core is `CORE_ONTOLOGY`, which `openView` merges over; a local term
 * travels with the release that declares it, so it arrives through `searchTerms`, which is
 * the module that owns reading them and deciding which bundles' releases may be read at
 * all. Passing them back in as `openView`'s extensions is what makes the subsumption rails
 * and `partitionTerms` see the same vocabulary the rows do — a view built from the core
 * alone would draw a page that says this archive carries no local terms while listing them
 * three panels down.
 *
 * ── There is no longer an empty case, and the reason it existed has gone ──
 * The core half used to be `ontology_term` rows for the newest published version, and this
 * function answered an EMPTY view when the registry had published none: rendering the
 * page's chrome over nothing was the truthful answer, and falling back to `CORE_ONTOLOGY`
 * would have described the engine's bundled default while claiming to describe what the
 * registry holds. Those are the same vocabulary now. Nothing writes a version of the core
 * anywhere, every card in the registry is resolved against `CORE_ONTOLOGY`, and this page
 * reads exactly what the resolver reads. The local half is still genuinely per-registry and
 * is still read from it.
 */
async function vocabularyView(db: ReturnType<typeof getSharedDbClient>["db"]): Promise<OntologyView> {
  const local = await searchTerms(db, ANONYMOUS, { origin: "local" });
  return openView(local.hits.map((hit) => hit.item));
}

export default async function Page() {
  const { db } = getSharedDbClient();

  const view = await vocabularyView(db);

  /* Every published card VERSION, not the newest of each.
     ------------------------------------------------------------
     `termUsageOver`'s own rule and the reason it is `cards()` here where `/nodes` takes
     `latestCards()`: a term a card dropped between 1.0.0 and 1.1.0 still shows that card,
     because the archive still carries the version that names it. The list is deduplicated
     by card id afterwards, so counting every version does not double-count a card.

     `usedIn` is spelled `owner/slug` rather than bare `slug`, which is the identity B-09
     gave a blueprint. The archive-backed caller still passes slugs and both are correct for
     their own corpus; see `UsageSource`. */
  const usage = termUsageOver(
    (await cards(db, ANONYMOUS)).map((card) => ({
      id: card.id,
      card: card.card,
      usedIn: card.usedIn.map((key) => `${key.ownerHandle}/${key.slug}`),
    })),
  );

  const { terms, version } = view.ontology;
  const { local } = partitionTerms(terms);
  const localIds = new Set(local.map((term) => term.id));

  const rows: VocabularyRow[] = terms.map((term: OntologyTerm) => {
    const row: VocabularyRow = {
      id: term.id,
      kind: term.kind,
      label: term.label,
      description: term.description,
      local: localIds.has(term.id),
      usedBy: usage.get(term.id)?.cards.length ?? 0,
    };
    if (term.broader !== undefined) row.broader = term.broader;
    /* Through the engine's own lookup, not off the term. Doc 3 §4 moved the seven core
       weights into `DARKPRINT_CONFIG.security.weights`, so a core marker's own
       `defaultWeight` is always unset and reading it alone would print no weight for any
       of them. `markerWeight` is the order the engine uses: configuration first, then the
       term's own value, which survives for a locally namespaced marker. */
    const weight = markerWeight(term);
    if (weight !== undefined) row.weight = weight;
    if (term.deprecated !== undefined) {
      row.deprecated =
        term.deprecated.replacedBy === undefined
          ? { since: term.deprecated.since }
          : { since: term.deprecated.since, replacedBy: term.deprecated.replacedBy };
    }
    return row;
  });

  return (
    <SideRail
      label="The vocabulary"
      meta={`${VOCABULARY_SECTIONS.length} sections`}
      items={VOCABULARY_SECTIONS}
      ariaLabel="On this page"
    >
    <div className="container-page flex flex-col gap-10 py-10 lg:py-12">
      <SectionHeading
        as="h1"
        eyebrow="Ontology"
        title="The words a blueprint is written in"
        lead="One curated set of identifiers, plus whatever a bundle declares in its own namespace. A card may only name a term that resolves here. That is what makes an edge checkable."
      />

      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/spec/ontology" variant="outline" size="sm">
          What a term is, and how the overlay works
        </ButtonLink>
        {/* The `✓ counted` marker and its source line came off on the owner's instruction
            (2026-08-25). The claim they carried is unchanged and still true — every figure
            on this page is read off the registry on the request that draws it, usage
            included — it simply no longer needs announcing beside numbers nobody doubts.
            If a figure here ever stops being counted, the marker comes back with it. */}
      </div>

      {/* The catalog is the page's resting state and the filter bar sits over it, so the
          reader who came to read gets the five kinds with their trees and their notes, and
          the reader who came holding a word gets the flat matching rows. `OntologyCatalog`
          renders here on the server and travels through the client boundary as children,
          which is what lets it draw the subsumption rails that no serialisable row shape
          could carry. It takes the view and the usage index this page already read rather
          than opening its own, so both halves of the page describe one vocabulary. */}
      <VocabularyBrowser terms={rows} version={version}>
        <OntologyCatalog view={view} usage={usage} />
      </VocabularyBrowser>
    </div>
    </SideRail>
  );
}
