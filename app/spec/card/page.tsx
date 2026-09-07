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
import { CheckLegend, CheckTable } from "@/components/spec/CheckTable";
import { Id, SpecLink } from "@/components/spec/parts";
import { CARD_ROWS } from "@/components/spec/rows";
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

   The vocabulary has no page of its own because every term in it
   exists to be a legal value of a card field: `type` takes a node
   type, `phase` takes phases, `tools` takes tool capabilities,
   `risk_markers` takes risk markers, and a port's `type` and every
   entry of `cannot` take a data type. So the terms are printed beside
   the field that takes them, and the whole listing closes the page.

   The specification is static and the registry is not, and the page
   is split on that line. The chips beside each field are the curated
   core, read off `CORE_ONTOLOGY` while the page renders; the band at
   the foot is the registry, every core term plus every term a
   published blueprint declares in its own namespace, with a live
   usage count, which needs a query. The enumeration is therefore an
   async child behind a `Suspense` boundary and the default export
   stays synchronous, which keeps the page renderable by
   `renderToStaticMarkup` and keeps `components/site/honesty.test.ts`
   collectible over the two sentences it pins here.

   The boundary sits under the band's heading rather than around the
   band, because `#every-term-heading` is a link target and an id that
   arrives with the stream is one a hash navigation can scroll past.

   `SectionNodeCard` mounts `CardBreakdown`, the annotated card picked
   with a click rather than walked with a scroll, on the owner's
   instruction to keep the scroll walk for the landing only. The card
   is read through `cardSource`, byte for byte.
   ============================================================ */

export const metadata: Metadata = {
  title: "The node card (YAML)",
  description:
    "One YAML card per node in a DarkPrint blueprint: what the step is, the instruction it is handed, the model and tools it may use, what arrives and what must never arrive. Every field, the diagnostic that fires when it is wrong, and the vocabulary each field draws from.",
};

const HERE = "/spec/card";

/**
 * Per request, because `VocabularyList` below runs a registry query and Next prerenders a
 * page it cannot see a request-time dependency in: without this line the segment came out
 * static, read from Postgres once at deploy and frozen there. A `Suspense` boundary does not
 * make a segment dynamic on its own; the declaration is about the segment and the boundary
 * about the order its parts arrive in.
 *
 * `connection()` is Next 16's request-time marker and would be the prettier spelling, but
 * it throws when a page function is invoked directly, which is the only way a `node` test
 * can render one. Next 16 removes `dynamic` once `cacheComponents` is enabled; that
 * follow-up should replace this line with `connection()` on every route carrying it.
 *
 * The cost: `getNodeCard`, `isolationDemo()` and the core ontology view now run per request.
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
 * One field of the card, what its value means, and which kind of term it draws that value
 * from.
 *
 * `CARD_ROWS` answers "what holds it" per top-level key, which is the wrong shape for the
 * fields that hold structure (a port has four keys, `cannot` and `will_not` read against
 * each other) and for every field whose value comes out of the vocabulary. `values` names
 * the kind, and the entry prints the curated terms of that kind under the role: `checkTerm`
 * in `lib/core/card/validate.ts` is called with exactly one `TermKind` per field, and a term
 * of another kind is refused with `card/wrong-term-kind` even though it resolves. The chip
 * rows are captioned `curated` because a namespaced term a blueprint declares is legal in
 * the same field and lives in the band at the foot.
 *
 * Every sentence is `lib/core/card/schema.ts` or `lib/core/card/validate.ts` read back. The
 * prohibition pair is last on purpose: the quoted refusal under this list is the validator's
 * answer to the first of the two.
 */
const FIELDS: readonly {
  key: string;
  role: React.ReactNode;
  /** The kind whose terms are the legal values here, when the field takes one. */
  values?: TermKind;
}[] = [
  {
    key: "type",
    values: "node-type",
    role: (
      <>
        What kind of actor the node is, and the only field that decides it. Everything
        downstream reads it: the shape the exporter draws, whether the autonomy reading
        counts the node as a person or a process, and whether the node must carry a shell
        command in <Id>params.tool_command</Id>, which only <Id>shell-tool</Id> does. Three
        of the values below are categories (<Id>human-in-the-loop</Id>, <Id>evaluative</Id>,{" "}
        <Id>orchestration</Id>): the validator accepts them, but the exporter has no shape
        for a category and falls back to <Id>box</Id>, so write the concrete subtype. An id
        the vocabulary does not carry is a <Id>card/unknown-term</Id>, and a term of another
        kind is a <Id>card/wrong-term-kind</Id> rather than a silent pass.
      </>
    ),
  },
  {
    key: "inputs[].name · outputs[].name",
    role: (
      <>
        The end of an edge rather than a label. A DOT edge writes{" "}
        <Id>{'[out="build", in="brief"]'}</Id> to say which pair of ports it joins, so a
        port name is an address the topology can point at. Unique within a side: two inputs
        both called <Id>brief</Id> leave the resolver no way to decide which one an edge
        meant, and it raises <Id>card/duplicate-port</Id> rather than picking one.
      </>
    ),
  },
  {
    key: "inputs[].type · outputs[].type",
    values: "data-type",
    role: (
      <>
        What travels along an edge, and the only subfield the resolver pairs on. An edge
        holds when the source&rsquo;s output type is the target&rsquo;s input type or a
        narrower kind of it, which is why the set below is a tree rather than a list.
        Everything a card says about what actually moves is carried by this one word; the
        rest of the port is written for a person.
      </>
    ),
  },
  {
    key: "inputs[].description · outputs[].description",
    role: (
      <>
        Free text for whoever wires the graph, read by nothing. It is where a port says the
        part its type cannot: that <Id>brief</Id> is the ordered build steps the run was
        started with, and the only thing this node ever sees.
      </>
    ),
  },
  {
    key: "inputs[].required",
    role: (
      <>
        Inputs only, and true unless the card says otherwise. On an output it describes
        nothing, because an output is not something a node needs, and the validator reports{" "}
        <Id>card/bad-type</Id> against the exact path rather than dropping the key in
        silence.
      </>
    ),
  },
  {
    key: "phase[]",
    values: "phase",
    role: (
      <>
        Where in the lifecycle the node sits. Any number of the five, and the key takes a
        single term or a sequence because both spellings read naturally in YAML. The five
        are closed and nobody may add one: a namespaced entry is a{" "}
        <Id>card/namespaced-phase</Id> and anything else is a{" "}
        <Id>card/unknown-phase</Id>. An empty list is a complete answer and never a hole,
        because the phases describe the blueprint rather than every node in it, and an
        intake, a retrieval step or a memory store stands in none of them. An empty list is
        shown as empty, never as missing.
      </>
    ),
  },
  {
    key: "tools[] · mcp[]",
    values: "tool",
    role: (
      <>
        What the node is allowed to reach for. Two lists that look alike and answer
        different questions. A <Id>tools</Id> entry is a capability term, so it either
        resolves or raises <Id>card/unknown-term</Id>. An <Id>mcp</Id> entry is the name a
        concrete server is registered under on the machine that runs the graph, which the
        vocabulary has no term for and is not going to grow one. <Id>tools</Id> says what
        the node is permitted to do and <Id>mcp</Id> says which process supplies it; a node
        can carry either without the other, and merging them would lose the question each
        one answers.
      </>
    ),
  },
  {
    key: "risk_markers[]",
    values: "risk-marker",
    role: (
      <>
        What could go wrong if this step misbehaves, as terms from the vocabulary. Seven core
        markers carry a weight in DarkPrint&rsquo;s configuration, and Security subtracts
        each one it finds. A marker coined in a blueprint&rsquo;s own namespace sets its own
        weight. A marker with no weight, including the two category terms{" "}
        <Id>execution-risk</Id> and <Id>isolation-breach</Id>, subtracts nothing: the risk
        is declared but never scored. The curated values below are the core set; the
        listing at the foot of the page adds every marker a published blueprint declares in
        its own namespace.
      </>
    ),
  },
  {
    key: "params.*",
    role: (
      <>
        Free in shape, but it must survive a JSON round trip. The digest is a hash of the
        card&rsquo;s JSON form, and a blueprint pins a card by that digest. A value that
        cannot be serialised is refused where it is written (<Id>card/bad-type</Id>), rather
        than later, when two digests disagree.
      </>
    ),
  },
  {
    key: "cannot[]",
    role: (
      <>
        The same <Id>data-type</Id> terms a port takes, listed above, and nothing else. Each
        entry is a prohibition the resolver enforces: an incoming edge able to carry that
        type, or a narrower kind of it, fails the whole blueprint. A sentence written here is
        a <Id>card/unknown-term</Id>, because the validator has no way to hold a graph to a
        sentence and this is the field it holds graphs to.
      </>
    ),
  },
  {
    key: "will_not[]",
    role: (
      <>
        The prohibitions the author states and the validator cannot check: &ldquo;never opens
        a shell&rdquo;, &ldquo;does not edit the code under test&rdquo;. Nothing reads
        them, and they are addressed to whoever runs the node and to the model that is
        handed the specification at run time. <Id>cannot</Id> holds the rules the validator
        enforces and <Id>will_not</Id> the ones it cannot. Both are legitimate. A reader has
        to be able to tell which is which without running anything.
      </>
    ),
  },
];

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
  const termsOf = (kind: TermKind): readonly OntologyTerm[] =>
    kind === "phase" ? phases : coreView.byKind(kind);

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
            lead="One YAML file per node: what the step is, what it is told to do, which model and tools it may use, what arrives and what must never arrive. The validator accepts the same fields as JSON. A published version is never edited in place, so a change means a new file and a new version number. Every term a field may take is listed beside it below."
          />
        </div>
      </header>

      {/* The six fields that decide a node's reach, above the annotated card: fields, then
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
                 position, which once worked only because the archive's one enforced card
                 happened to write them in that order. */
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
          `content/cards/`, and broken into nine parts a reader picks rather than scrolls
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
          </div>

          <div className="flex flex-col gap-5">
            {/* No count in the sentence: a number typed beside a table somebody else owns
                goes stale silently. */}
            <p className="text-sm text-muted">
              One row per top-level key in the file. The third column names the diagnostic
              code the validator prints, on{" "}
              <SpecLink href="/upload">the upload page</SpecLink> and in the build, when the
              rule is broken. A code can be grepped for and tripped on purpose, which is what
              separates a checked rule from a promise.
            </p>
            <CheckLegend />
            <CheckTable
              rows={CARD_ROWS}
              caption="What the validator checks on a node card, and what it leaves to the author"
            />
          </div>

          {/* One row per field, the key in a 15rem column and the prose beside it, with the
              vocabulary a field draws from printed under it. Never a `<details>`: folding the
              chip rows away would put the vocabulary one interaction further from the field
              than it was on its own route. */}
          <div className="flex flex-col gap-5">
            <h3 id="field-values-heading" className="label-lead scroll-mt-24">
              What each field may hold
            </h3>
            <p className="text-sm text-muted">
              Several rows above apply to more than one thing, and the ones that take a
              term draw it from one controlled vocabulary. What each key decides, what it
              costs to leave it out or to get it wrong, and the curated ids that go in
              it.
            </p>
            <dl className="flex flex-col">
              {FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="grid gap-x-8 gap-y-1.5 border-t border-line py-5 md:grid-cols-[15rem_1fr]"
                >
                  {/* Spelled exactly as `CheckTable` spells its row heads, so the list
                      reads as the table continued. Deliberately not copper: that register
                      belongs to the figure above, where it marks the runs of one real file. */}
                  <dt className="font-mono text-[12px] leading-relaxed text-fg">
                    {field.key}
                  </dt>
                  <dd className="min-w-0 text-sm leading-relaxed text-muted">
                    {field.role}
                    {field.values !== undefined && (
                      <FieldTerms terms={termsOf(field.values)} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {/* Every id and count above comes out of `CORE_ONTOLOGY` through the engine's
                own view: a term renamed in the core is renamed here, and one removed
                disappears. The strip claims no moment, because these come from a constant
                compiled into the deployment and the request-time read is the band at the
                foot. */}
            <p className="border-t border-line pt-3 font-mono text-[11px] tracking-[0.06em] text-dim">
              every id above comes from the engine&rsquo;s own core vocabulary
            </p>
          </div>

          {refusal !== undefined && (
            <div className="flex flex-col gap-3">
              {/* No reading lane: this is a one-sentence caption for the panel directly under
                  it, and the panel is full width. */}
              <p className="text-[15px] leading-relaxed text-muted">
                The message below is the validator&rsquo;s own output rather than text
                written for this page. It comes from adding one edge,{" "}
                <Id>{ADDED_DOT_LINE}</Id>, to the starter blueprint.
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

      {/* The whole vocabulary, after the fields that consume it: the chips above answer
          "what may I write here", and a reader who wants the set itself, with what each
          term means and how many cards name it, gets it without leaving the page. The
          catalog renders on the server and travels through the client boundary as
          children, which is what lets it draw subsumption rails no serialisable row shape
          could carry. */}
      <section
        className="border-t border-line bg-surface/40 py-16 sm:py-20"
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
              The {CORE_ONTOLOGY.terms.length}{" "}
              curated terms the fields above draw on, and every term a published blueprint
              declares in its own namespace, with each
              one&rsquo;s parent and how many cards name it. Search, or filter by kind and
              origin, and the grouped view below swaps for the matching rows.
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
