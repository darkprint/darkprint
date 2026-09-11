import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import type { OntologyTerm, OntologyView, TermKind } from "@/lib/core";
import { CORE_ONTOLOGY, CORE_PHASE_IDS, ontologyView, partitionTerms } from "@/lib/core";
import { getSharedDbClient } from "@/lib/db";
import { openView } from "@/lib/server/ontology";
import type { Actor } from "@/lib/server/policy";
import { cards } from "@/lib/server/registry";
import { searchTerms } from "@/lib/server/search";
import { WhatACardReaches } from "@/components/explain/ConceptFigures";
import { SectionNodeCard } from "@/components/home/SectionNodeCard";
import { OntologyCatalog } from "@/components/ontology/OntologyCatalog";
import { markerWeight, termUsageOver } from "@/components/ontology/TermTable";
import {
  VocabularyBrowser,
  type VocabularyRow,
} from "@/components/ontology/VocabularyBrowser";
import { CheckCell, CheckLegend, prose } from "@/components/spec/CheckTable";
import { Id, SpecLink } from "@/components/spec/parts";
import { CARD_ROWS, type CardRow } from "@/components/spec/rows";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SEVERITY_META } from "@/components/ui/severity";
import { cx } from "@/lib/format";
import { termHref } from "@/lib/href";
// `components/explain/starter-isolation` runs the validator over the starter with one edge
// added and hands back what it said; re-deriving that here would give the site two answers
// to one question, and the answer this page needs is the exact refusal sentence.
import {
  errorsOf,
  isolationDemo,
  ADDED_DOT_LINE,
} from "@/components/explain/starter-isolation";
import { getNodeCard } from "@/lib/content";

/* ============================================================
   /spec/card: the node card, and the vocabulary that fills it.

   Five bands, in the order a reader can follow: what a card reaches,
   one real card annotated, every field once, what the validator
   checks, and the whole vocabulary. The vocabulary has no page of its
   own because every term in it exists to be a legal value of a card
   field: `type` takes a node type, `phase` takes phases, `tools`
   takes tool capabilities, `risk_markers` takes risk markers, and a
   port's `type` and every entry of `cannot` take a data type. So the
   curated ids are printed under the field that takes them, and the
   whole listing closes the page.

   Each field has one home. `CARD_ROWS` carries what a field holds
   and the diagnostic beside it, the chips under a row are the ids it
   may take, and the reach figure and the annotated card above the
   reference say what the same fields do on one real file. A fact
   stated in one of those is not restated in another.

   The specification is static and the registry is not, and the page
   is split on that line. The chips are the curated core, read off
   `CORE_ONTOLOGY` while the page renders; the band at the foot is
   the registry, every core term plus every term a published
   blueprint declares in its own namespace, with a live usage count,
   which needs a query. The enumeration is therefore an async child
   behind a `Suspense` boundary and the default export stays
   synchronous, which keeps the page renderable by
   `renderToStaticMarkup` and keeps `components/site/honesty.test.ts`
   collectible over the two sentences it pins here.

   The boundary sits under the band's heading rather than around the
   band, because `#every-term-heading` is a link target and an id that
   arrives with the stream is one a hash navigation can scroll past.
   ============================================================ */

export const metadata: Metadata = {
  title: "The node card (YAML)",
  description:
    "One YAML card per node in a DarkPrint blueprint: what the step is, the instruction it is handed, the model and tools it may use, what arrives and what must never arrive. Every field, the diagnostic that fires when it is wrong, and the vocabulary each field draws from.",
};

const HERE = "/spec/card";

/**
 * Per request, because `VocabularyList` below runs a registry query and Next prerenders a
 * page it cannot see a request-time dependency in: without this line the segment comes out
 * static, read from Postgres once at deploy and frozen there. A `Suspense` boundary does not
 * make a segment dynamic on its own; the declaration is about the segment and the boundary
 * about the order its parts arrive in.
 *
 * `connection()` is Next 16's request-time marker and would be the prettier spelling, but
 * it throws when a page function is invoked directly, which is the only way a `node` test
 * can render one. Next 16 removes `dynamic` once `cacheComponents` is enabled; that
 * follow-up should replace this line with `connection()` on every route carrying it.
 *
 * The cost: `getNodeCard`, `isolationDemo()` and the core ontology view run per request.
 * All three are pure functions over files that ship in the deployment and all three are
 * memoised; the registry query is the expensive one and it is the one held behind the
 * boundary.
 */
export const dynamic = "force-dynamic";

/**
 * Who is asking, and it is nobody. A local term inherits its blueprint's visibility, so the
 * anonymous read is what keeps a private blueprint's vocabulary off this page, by never
 * putting the blueprint in the universe rather than by a filter downstream.
 */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/**
 * The canonical band `h2`, spelled the way `components/ui/SectionHeading.tsx` spells it.
 * Composed with `cx` rather than in a template literal, because
 * `components/ontology/full-width.test.ts` reads double-quoted class lists.
 */
const BAND_H2 =
  "font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]";

/**
 * The merged vocabulary: the curated core, with every local term a public blueprint's
 * current release declares layered over it.
 *
 * One view for the whole band, which is the hazard `OntologyCatalog` records as the reason
 * it takes a view as a prop: a band reading one source for its lead and another for its
 * rows is free to print a total in a sentence and list a different one underneath. Two
 * readers because there are two corpora and only one is in the database: the core is
 * `CORE_ONTOLOGY`, and a local term travels with the release that declares it, so it
 * arrives through `searchTerms`, which owns deciding whose releases may be read at all.
 */
async function vocabularyView(
  db: ReturnType<typeof getSharedDbClient>["db"],
): Promise<OntologyView> {
  const local = await searchTerms(db, ANONYMOUS, { origin: "local" });
  return openView(local.hits.map((hit) => hit.item));
}

/**
 * The terms a field will accept, printed as the ids a card has to spell rather than the
 * labels: a reader at this point in the page is holding a field and needs the string that
 * goes in it. The caption says curated because these come off `CORE_ONTOLOGY` and carry no
 * local term; a reader who took the count for the whole set would be misled.
 */
function FieldTerms({ terms }: { terms: readonly OntologyTerm[] }) {
  if (terms.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="font-mono text-[11px] tracking-[0.06em] text-dim">
        {terms.length} curated {terms.length === 1 ? "value" : "values"}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {terms.map((term) => (
          <li key={term.id}>
            <Link
              href={termHref(term.id)}
              className="block rounded-full border border-line px-2.5 py-0.5 font-mono text-[12px] text-fg transition-colors hoverable:hover:border-cyan hoverable:hover:text-cyan"
            >
              {term.id}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One field of the card, read in one place: the key, what it holds, the curated ids it may
 * take and what holds it. Three columns above `md` and a stack below, and the check cell is
 * the one `/spec/topology`'s table draws, so the two layers read as one document. Never a
 * `<details>`: folding the chips away puts the vocabulary one interaction further from the
 * field that takes it.
 */
function FieldEntry({ row, terms }: { row: CardRow; terms: readonly OntologyTerm[] }) {
  return (
    <div className="grid gap-x-8 gap-y-3 border-t border-line py-5 md:grid-cols-[13rem_minmax(0,1fr)_14rem]">
      <dt className="font-mono text-[12px] leading-relaxed text-fg">{row.name}</dt>
      <dd className="min-w-0 text-sm leading-relaxed text-muted">
        <p>{prose(row.what)}</p>
        <FieldTerms terms={terms} />
      </dd>
      <dd className="min-w-0">
        <CheckCell check={row.check} />
      </dd>
    </div>
  );
}

/**
 * The listing that closes the page: every term the registry publishes, in the browser.
 *
 * Async, and therefore only reachable inside the `Suspense` boundary the page wraps it in.
 * It opens its own view because the page has none to give it: the shell reads the curated
 * core, which is a constant, and this reads the registry, which is a query.
 */
async function VocabularyList() {
  const { db } = getSharedDbClient();

  const view = await vocabularyView(db);
  const { terms } = view.ontology;
  /* Only the namespaced half is needed here: the browser marks local rows and its origin
     filter separates them. */
  const localIds = new Set(partitionTerms(terms).local.map((term) => term.id));

  /* Every published card version rather than the newest of each, which is `termUsageOver`'s
     own rule: a term a card dropped between 1.0.0 and 1.1.0 still shows that card, because
     the registry still carries the version that names it. The list is deduplicated by card
     id afterwards. `usedIn` is spelled `owner/slug`, the identity a blueprint has. */
  const usage = termUsageOver(
    (await cards(db, ANONYMOUS)).map((card) => ({
      id: card.id,
      card: card.card,
      usedIn: card.usedIn.map((key) => `${key.ownerHandle}/${key.slug}`),
    })),
  );

  /* Flattened on the server so `VocabularyBrowser` never touches the engine: the usage count
     is a registry fact and the weight comes through the engine's own lookup, and neither is
     available to a client component. */
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
    /* Through the engine's own lookup rather than off the term: the seven core weights live
       in `DARKPRINT_CONFIG.security.weights`, so a core marker's own `defaultWeight` is
       always unset. `markerWeight` reads configuration first, then the term's own value,
       which survives for a locally namespaced marker. */
    const weight = markerWeight(term);
    if (weight !== undefined) row.weight = weight;
    /* The successor and nothing else: the vocabulary is not versioned, so there is no
       version a term was deprecated in. */
    if (term.deprecated !== undefined) {
      row.deprecated =
        term.deprecated.replacedBy === undefined
          ? {}
          : { replacedBy: term.deprecated.replacedBy };
    }
    return row;
  });

  return (
    <VocabularyBrowser terms={rows}>
      <OntologyCatalog view={view} usage={usage} />
    </VocabularyBrowser>
  );
}

/**
 * What stands in the listing's place while the query runs. `aria-hidden`, because a screen
 * reader announcing "loading" for a region nobody navigated to is noise; the height holds
 * the page still so the pager below does not jump when the listing lands.
 */
function VocabularyListSkeleton() {
  return (
    <div className="flex min-h-[240px] items-center" aria-hidden>
      <span className="font-mono text-xs text-dim">Loading the vocabulary…</span>
    </div>
  );
}

/**
 * The specification itself, which needs no database and is not held behind one.
 * Synchronous on purpose; the header argues why the registry read is a child rather than
 * an `await` here.
 */
export default function SpecCardPage() {
  const { page } = specNeighbours(HERE);

  /* The curated core, through the engine's own view rather than off `CORE_ONTOLOGY.terms`
     directly: `byKind` is where the kind index and the sort live. No extensions passed,
     which is what makes these chips a statement about the specification. */
  const coreView: OntologyView = ontologyView(CORE_ONTOLOGY);

  /* Lifecycle order rather than the alphabet: `byKind("phase")` sorts by id and would open
     the five with `debugging`. */
  const phases = CORE_PHASE_IDS.map((id) => coreView.get(id)).filter(
    (term): term is OntologyTerm => term !== undefined,
  );
  const termsOf = (kind: TermKind | undefined): readonly OntologyTerm[] => {
    if (kind === undefined) return [];
    return kind === "phase" ? phases : coreView.byKind(kind);
  };

  /* The same card `SectionNodeCard` annotates, parsed, for the reach panel above it. */
  const reachCard = getNodeCard("code-builder")?.card;

  /* The validator's own sentence about the prohibition the card above declares, quoted
     rather than paraphrased and guarded rather than indexed blindly: a page arguing that a
     declaration is enforced should drop the quotation rather than invent one if the
     demonstration ever stops being derivable. */
  const demo = isolationDemo();
  const refusal =
    demo === undefined
      ? undefined
      : errorsOf(demo.leaked).find(
          (d) => d.code === "bundle/prohibition-violated",
        );

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-5">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            lead="One YAML file per node: what the step is, what it is told to do, which model and tools it may use, what arrives and what must never arrive. The validator accepts the same fields as JSON. A published version is never edited in place, so a change means a new file and a new version number."
          />
        </div>
      </header>

      {/* The seven fields that decide a node's reach, above the annotated card: fields, then
          the file. Every value is read off `code-builder@1.0.0`, the card the rest of the
          site opens with, so the figure cannot end up teaching a schema nobody ships. */}
      {reachCard !== undefined && (
        <section id="card-reach" className="scroll-mt-24 border-b border-line bg-void py-12 sm:py-16">
          <div className="container-page">
            <WhatACardReaches
              model={reachCard.model ?? "inherits"}
              tools={reachCard.tools.length > 0 ? reachCard.tools.join(", ") : "none"}
              mcp={reachCard.mcp.length > 0 ? reachCard.mcp.join(", ") : "none"}
              skill={reachCard.skill ?? "none"}
              /* Both fields are read rather than one being derived from the other by
                 position: the archive's one enforced card happens to write them in that
                 order, and a figure should not depend on it. */
              cannot={
                reachCard.cannot.length > 0 ? (reachCard.cannot[0] ?? "") : "no type refused"
              }
              willNot={
                reachCard.willNot.length > 0
                  ? (reachCard.willNot[0] ?? "")
                  : "nothing promised"
              }
              riskMarkers={
                reachCard.riskMarkers.length > 0
                  ? reachCard.riskMarkers.join(", ")
                  : "none declared"
              }
            />
          </div>
        </section>
      )}

      {/* The card the whole page is about, annotated line by line, read straight out of
          `content/cards/` and broken into nine parts a reader picks rather than scrolls
          through. */}
      <SectionNodeCard />

      <section
        className="border-t border-line bg-void py-16 sm:py-20"
        aria-labelledby="fields-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The reference</span>
            <h2 id="fields-heading" className={cx(BAND_H2, "scroll-mt-24")}>
              Every field, and what holds it
            </h2>
            {/* No count in the sentence: a number typed beside a list somebody else owns
                goes stale silently. Every id under a field comes out of `CORE_ONTOLOGY`
                through the engine's own view, so a term renamed in the core is renamed
                here and one removed disappears. */}
            <p className="text-[15px] leading-relaxed text-muted">
              The ids under a field are the curated core, spelled as a card has to spell
              them.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <CheckLegend />
            <dl className="flex flex-col border-b border-line">
              {CARD_ROWS.map((row) => (
                <FieldEntry key={row.name} row={row} terms={termsOf(row.values)} />
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section
        className="border-t border-line bg-surface/40 py-16 sm:py-20"
        aria-labelledby="checks-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The checks</span>
            <h2 id="checks-heading" className={cx(BAND_H2, "scroll-mt-24")}>
              What the validator checks
            </h2>
            <p className="text-[15px] leading-relaxed text-muted">
              Every code beside a field is a real diagnostic. The validator prints it on{" "}
              <SpecLink href="/upload">the upload page</SpecLink> and in the build when the
              rule is broken, so a code can be grepped for and tripped on purpose, which is
              what separates a checked rule from a promise.
            </p>
          </div>

          {refusal !== undefined && (
            <div className="flex flex-col gap-3">
              {/* No reading lane: this is a one-sentence caption for the panel directly under
                  it, and the panel is full width. */}
              <p className="text-[15px] leading-relaxed text-muted">
                This message is the validator&rsquo;s own output rather than text written for
                this page. It comes from adding one edge, <Id>{ADDED_DOT_LINE}</Id>, to the
                starter blueprint.
              </p>
              <div className="rounded-lg border border-line bg-surface-2 p-4">
                {/* The severity in word form, beside the code, from the same table the
                    validator's own lists use, and read off the diagnostic rather than typed.
                    This is the one place on the page where the severity is a word a reader
                    can find; `honesty.test.ts` pins the pair. */}
                <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                  <span style={{ color: SEVERITY_META[refusal.severity].color }}>
                    {SEVERITY_META[refusal.severity].word}
                  </span>
                  <span className="text-signal">{refusal.code}</span>
                </p>
                <p className="mt-2 font-mono text-[12px] leading-relaxed text-fg">
                  {refusal.message}
                </p>
                {refusal.hint !== undefined && (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-dim">
                    {refusal.hint}
                  </p>
                )}
              </div>
              <p className="text-sm text-dim">
                <SpecLink href="/spec/topology">The topology page</SpecLink> shows the same
                prohibition from the other side: the starter&rsquo;s DOT file, where the
                planner -&gt; builder edge is deliberately absent.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* The whole vocabulary, after the fields that consume it: the chips under a field
          answer "what may I write here", and a reader who wants the set itself, with what
          each term means and how many cards name it, gets it without leaving the page. The
          catalog renders on the server and travels through the client boundary as
          children, which is what lets it draw subsumption rails no serialisable row shape
          could carry. */}
      <section
        className="border-t border-line bg-void py-16 sm:py-20"
        aria-labelledby="every-term-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">Every term</span>
            <h2 id="every-term-heading" className={cx(BAND_H2, "scroll-mt-24")}>
              The whole vocabulary, and what names each term
            </h2>
            {/* No total here: the browser prints a live `results/total` in its own filter
                bar, and a number typed in the half of the page that cannot see it would be
                a second count of the same set. */}
            <p className="text-[15px] leading-relaxed text-muted">
              The {CORE_ONTOLOGY.terms.length} curated terms the fields draw on, and every
              term a published blueprint declares in its own namespace, each with its parent
              and how many cards name it.
            </p>
          </div>

          <Suspense fallback={<VocabularyListSkeleton />}>
            <VocabularyList />
          </Suspense>
        </div>
      </section>

      {/* No `border-t` of its own: `SpecPager` draws one at container width. */}
      <section className="bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
