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
// Read-only import of the build-time derivation in `components/explain/starter-isolation`.
// That module runs the analyzer over the starter bundle with one edge added and hands back
// what the engine said; re-deriving it here would give the site two answers to one
// question, and the answer this page needs is the exact `bundle/prohibition-violated`
// sentence. It was written for `/what-it-isnt`, which drew both graphs; that page is gone
// and this page and `components/panes/absences.ts` are what keep the module alive.
import {
  errorsOf,
  isolationDemo,
  ADDED_DOT_LINE,
} from "@/components/explain/starter-isolation";
import { getNodeCard } from "@/lib/content";

// SEAM-14 LIVE: the vocabulary and the usage count beside each term are read from the
// registry (T080) and from search (T200) rather than from `content/` at build time. The
// merged route is `GET /api/search/terms`; this page consumes the MODULE rather than the
// route (D-260-13). The annotation travels with the read: it was on `/ontology`, then on
// `/spec/ontology`, and it is here because this is where the query now runs.

/* ============================================================
   /spec/card — layer 2 of the spec language, and the vocabulary
   that fills it.

   Redesign spec §4.1, on the author's reading of the single page:
   "the spec language is ok, but you should reorganize the content
   otherwise it is a very long single page that makes the user
   leave." §4.1 asks each layer page to open with its figure, and
   §3 says which figure this one gets: the annotated node card that
   was the landing's centrepiece, moved to the page whose subject
   it is.

   ── `/spec/ontology` FOLDED IN HERE, 2026-09-06 ──
   The owner asked whether the vocabulary should exist as a spec of
   its own at all, and accepted the answer that it should not have a
   ROUTE of its own: "The motivations you provided are sound. Apply
   them."

   The reason is a fact about the vocabulary rather than about page
   length. Every term in it exists to be a legal value of a CARD
   FIELD. `type` takes a node type, `phase` takes phases, `tools`
   takes tool capabilities, `risk_markers` takes risk markers, and a
   port's `type` and every entry of `cannot` take a data type. The
   DOT layer never names a term; it names a card, and the card names
   the terms. A separate document listing all of them by kind asked a
   reader to hold a glossary in their head while reading the schema
   that consumes it, and the two pages had to agree about a set
   neither of them owned.

   So the terms are printed beside the field that takes them, in the
   reference list below, and the kinds table that used to open the
   ontology page is dissolved into it: what a kind names is now the
   sentence about the field, and how many terms it holds is the count
   over the chips. `card/wrong-term-kind` is the rule that makes this
   the right shape. Each field takes exactly ONE kind, and a term
   from another kind is refused by id even though it resolves.

   What came across whole, because losing any of it would make this a
   downgrade rather than a fold: search, the kind filter, the
   core-or-local filter, the per-term usage count, the whole listing
   of every term, and the `local` marker that says a namespaced term
   belongs to one archive. All six are `VocabularyBrowser` over
   `OntologyCatalog`, in the last band, unchanged.

   ── THE SPECIFICATION IS STATIC AND THE REGISTRY IS NOT, and the
      page is split on that line rather than on layout ──
   The chips beside each field are the CURATED CORE, read off
   `CORE_ONTOLOGY` through the engine's own view while the page
   renders. The band at the foot is the REGISTRY: every core term
   plus every term a published bundle declares in its own namespace,
   with a live usage count beside each, which needs a query.

   So the terms a field will accept are a claim about the
   specification and they are in the prerendered shell, and the
   enumeration of what has actually been published is an async child
   behind a `Suspense` boundary. `app/upload/page.tsx` splits on the
   same line for the same reasons and records the third one: a
   synchronous default export keeps the page renderable by
   `renderToStaticMarkup`, which shows the boundary's fallback rather
   than crashing on it, and that is what keeps
   `components/site/honesty.test.ts` collectible over this route. Two
   sentences on this page are pinned there, both of them in the
   reference band, and an async default export would have taken the
   whole ledger down with them.

   The two halves cannot disagree, because they answer different
   questions and say which they are answering: the chip caption says
   curated, and the band's lead names the curated count and then says
   what the registry adds to it.

   The boundary is drawn UNDER the band's heading rather than around
   the whole band. `#every-term-heading` is a link target, and a
   fragment whose element arrives with the stream is one a hash
   navigation can scroll past, silently, because
   `components/site/anchors.test.ts` reads the source and finds the id
   whichever half declares it.

   What did NOT come across. The ontology page opened with a
   paragraph counting the curated set and a five-row table of kinds;
   both are gone, since the same facts now sit against the fields.
   And the argument for a separate route is recorded rather than
   deleted: that page specified the vocabulary as a document, which
   let it say things no field needs, and the last of those (how a
   bundle coins a term in its own namespace) had already been removed
   by the owner on the same day. Nothing on the site now tells a
   reader how to write one. That gap is older than this fold and it
   survives it; `components/ontology/canonical-route.test.ts` holds
   the mechanism against the engine so the absence stays visible.

   ── The centrepiece is imported, and it still reads the archive ──
   `SectionNodeCard` calls `cardSource("code-builder@1.0.0")` and
   hands the bytes to the scene, which tokenises them in the
   browser. So the listing a reader scrolls through is the file in
   `content/cards/`, byte for byte, and the nine annotations are
   resolved against that text rather than typed beside it
   (`components/home/nodecard/annotations.ts`). Replacing it with a
   transcription would have cost the one property it was built for,
   and §3 says so directly: "it reads the real card through
   `cardSource` and that must survive the move."

   ── The figure listens rather than scrolls ──
   The author, of this page: "in /spec/card avoid the effect on
   scrolling of the card panel (keep it for the other pages). I
   prefer here the approach adopted in /spec/topology for the panel
   starter-software-factory/blueprint.dot."

   So `SectionNodeCard` mounts `CardBreakdown`, which is the node
   card under the interaction `/spec/topology`'s DOT figure already
   uses: nine real buttons in the rail, `useRovingListbox` from
   `components/panes/listbox.ts` so the whole rail is one tab stop
   with the arrow keys walking it, `aria-pressed` for the state and
   a polite live region for the consequence. A click lights the
   lines that part is about. Nothing on this page reads a scroll
   position any more.

   **"keep it for the other pages" is the load-bearing clause.**
   `CardWalk` — the scroll walk this page used to mount — still
   renders on the landing through
   `components/home/SectionNodeIsCard.tsx`, and it is still guarded
   there by the case in `nodecard.test.ts` that asserts its source
   contains no `<button` and no `onClick`. That is why this is a
   second component rather than a `mode` prop: a prop would have put
   the buttons inside the walk's file and forced the guard that
   keeps nine controls off the landing's beat to be loosened.
   `CardBreakdown`'s header argues the whole split.

   ── What this page carried and no longer does ──
   The band titled "The split" is gone on the author's instruction.
   It held the enforcement argument: a lead, `EnforcementFigure`,
   two panels, and the resolver's own refusal quoted off the build.
   Two sentences in it are pinned by `components/site/honesty.test.
   ts`, which is the repository's first non-negotiable, so they were
   REHOMED rather than dropped and both are still in the open:

     · "both are legitimate, and a reader has to be able to tell
       which is which without running anything" is the last
       sentence of the `will_not` entry below. It moved once more
       with the prohibition split: it had been rehomed onto
       `cannot`, which was then one field holding both kinds of
       entry, and the split gave the unchecked half a field of its
       own. The sentence is now a description of the schema rather
       than a warning about it, and it is still half of this
       page's thesis — without it the symmetry has one side and a
       promise nothing checks reads as a promise that failed.

     · "error bundle/prohibition-violated", the severity in word
       form beside the code, is the quoted diagnostic under the
       field list. It is read off the engine's own `Diagnostic`
       rather than typed, exactly as before.

   `EnforcementFigure` loses its only page mount in that change.
   `components/viz/scene-labels.test.ts` renders it directly, so
   nothing fails; that is a figure the suite protects and no page
   shows, and it wants a deliberate decision from whoever owns
   `components/spec/`. `components/spec/LatticeFigure.tsx` is in the
   same position since the ontology page dropped it, and for the same
   reason: that suite's ROSTER and its two `DRAWERS` assertions are
   what a deletion has to go through.

   ── The reference is open, and it names the subfields ──
   The field table used to sit behind `components/ui/More.tsx`. The
   author: "It has to stay opened not collapsable. Here it is
   important to describe the role of each subfield." So the
   `<details>` is gone, and the list under the table is the part
   §4.3's disclosure had been hiding the need for: `CARD_ROWS` is a
   table of top-level wire keys, and several of those keys hold
   structure the table has no column for — a port's four keys, the
   two list fields that look alike and are not, the two prohibition
   fields that answer to different readers. No count is written into
   either the docblock or the prose: the one that was there
   ("fifteen rows") was already wrong about a table this page does
   not own. Every claim in that list is `lib/core/card/schema.ts` or
   `lib/core/card/validate.ts`, and each one says what the subfield
   DOES rather than restating its name.

   ── No width cap anywhere on this page, from this pass on ──
   Three paragraphs and the field list carried `.prose-lane`, each
   defended in a comment with the line length it fixed. The owner has
   overruled that argument twice ("the subdescription of the title
   should occupy the full horizontal span", and again about the
   vocabulary panels on 2026-09-05), and this page is about to join
   the surfaces `components/ontology/full-width.test.ts` holds to it.
   The measurements were real and the rule beats them. What replaces
   the lane on the field list is a 15rem key column, the device
   `TermTable` already uses for the same job: the row is narrowed by
   the column beside it rather than by a cap that leaves the panel
   short of every other edge on the page.

   ── Route config: per-request, and it has to be ──
   `dynamic = "force-dynamic"` below, and the reasoning is on the
   export. It arrived with the vocabulary: this segment was static
   while everything on it came from `content/`.
   ============================================================ */

export const metadata: Metadata = {
  title: "The node card, in YAML",
  description:
    "Layer 2 of a DarkPrint blueprint: one YAML card per node, saying what it is, what instructs it, what arrives, what leaves and what must never arrive, with the field-by-field list of what the engine checks and the vocabulary each field draws its values from.",
};

const HERE = "/spec/card";

/**
 * PER-REQUEST, AND THE NEGATIVE IT SATISFIES IS ABOUT THE BUILD (D-260-05).
 *
 * This segment was static until the vocabulary arrived on it, and the declaration is the
 * whole of what makes it dynamic: Next prerenders a page it cannot see a request-time
 * dependency in, and it cannot see one in a drizzle query. With no `searchParams`, no
 * `cookies()` and no `headers()`, the three registry shelves all came out `○ Static` in the
 * build's route table, read from Postgres once at deploy and frozen there. `VocabularyList`
 * below runs `searchTerms` and `cards`, so this segment inherits that defect without this
 * line, and nothing in the source would show it.
 *
 * A `Suspense` boundary does not make a segment dynamic on its own. The declaration is
 * about the SEGMENT and the boundary is about the order the parts of it arrive in, so both
 * are needed and neither substitutes for the other.
 *
 * ── Why this spelling and not `connection()`, which is the prettier one ──
 * `connection()` is Next 16's request-time marker and its own documented example is a
 * synchronous database driver. Measured, it throws ``connection` was called outside a
 * request scope` when a page function is invoked directly, which is the only way a `node`
 * environment cell can render one; a route segment export makes the same claim to the
 * compiler and leaves the function callable. `revalidate = 0` would do equally well.
 * `dynamic` is the spelling the rest of this codebase would recognise, and `t262`'s
 * per-request guard names `dynamic = "force-dynamic"` by hand as the deliberate-dynamic
 * value it would widen for.
 *
 * ── What this costs, priced rather than discovered later ──
 * Three reads that used to happen once at deploy now happen on every request: `getNodeCard`,
 * which parses one card out of `content/`; `isolationDemo()`, which runs the analyzer over
 * the starter bundle with one edge added; and the core ontology view the field chips are
 * built from. All three are pure functions over files that ship in the deployment, all
 * three are memoised by their own modules, and none of them touches the network. The
 * registry query is the expensive one and it is the read the fold exists to keep honest,
 * and it is the one held behind the boundary so the rest of the page does not wait for it.
 *
 * ── The version caveat, left here because the task that trips it will not be looking ──
 * Next 16 REMOVES `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` once
 * `cacheComponents` is enabled. It is off in `next.config.ts` today, which is why this
 * works. The follow-up that enables it repo-wide has to replace this line on every route
 * carrying it, and `connection()` is what it should replace it with, because by then the
 * rendering path is the framework's rather than a directly-invoked function.
 *
 * The page's first paint still needs no JavaScript. That is a statement about the HTML the
 * server sends and not about when it was rendered.
 */
export const dynamic = "force-dynamic";

/**
 * Who is asking, and it is nobody.
 *
 * A local term is not a row with a visibility column, it inherits its bundle's, so the
 * anonymous read is what keeps a private bundle's vocabulary off this page: by never
 * putting the bundle in the universe rather than by a filter downstream that has to
 * remember. That rule is `lib/server/search`'s and this page does not restate it, it only
 * says who it is.
 */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/**
 * The canonical h2, spelled the way `components/ui/SectionHeading.tsx` spells it.
 *
 * Every band below opens with a `.label-lead` and one of these. The sub-sections used to
 * draw at `text-2xl` (24px), which is neither of the two display steps the site has, and
 * carried no mono cue at all — so on a page whose `h1` and whose figure each spend a cyan
 * `.eyebrow`, the two sections after them were typographically indistinguishable.
 * `.label-lead` is the answer rather than a third eyebrow: the eyebrow names a page or a
 * full-bleed band, and this page has spent both.
 *
 * Composed with `cx` rather than in a template literal, because
 * `components/ontology/full-width.test.ts` reads double-quoted class lists and its premise
 * cell fails on a surface that hands a class attribute a template literal instead, which a
 * quoted-string reader cannot see into. This page is one of its surfaces from this pass on.
 * The token that cell looks for is deliberately not spelled here: its earlier version
 * matched a plain substring, and a comment quoting the shape its own guard forbids is the
 * failure this repository has hit seven times.
 */
const BAND_H2 =
  "font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]";

/**
 * The merged vocabulary: the curated core, with every local term a public blueprint's
 * current release declares layered over it.
 *
 * ONE VIEW FOR THE WHOLE BAND, which is the hazard `OntologyCatalog` records as the reason
 * it takes a view as a prop: a band that read one source for its lead and another for its
 * rows is free to print a total in a sentence and list a different one underneath. The
 * chips higher up the page are a deliberate second read and not that defect. They are the
 * curated core and they say so, where this is every term the registry publishes; two
 * questions, each answered by the source that owns it.
 *
 * Two readers because there are two corpora and only one of them is in the database
 * (D-200-17). The core is `CORE_ONTOLOGY`, which `openView` merges over; a local term
 * travels with the release that declares it, so it arrives through `searchTerms`, the
 * module that owns reading them and deciding which bundles' releases may be read at all.
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
 * ── Why the terms are here and not in a glossary ──
 * This list is the fold of `/spec/ontology` into this page (header docblock). The table
 * `CARD_ROWS` draws answers "what holds it" per top-level wire key, which is the right
 * shape for a reference and the wrong shape for the fields that hold structure: `inputs ·
 * outputs` is one row over a port with four keys in it, `tools · risk_markers` is one row
 * over two lists that answer different questions, and `cannot` and `will_not` are two rows
 * a reader has to read against each other to see what separates them. It is also the wrong
 * shape for every field whose value comes out of a controlled vocabulary, because a column
 * that says "a term id" leaves the reader to go and find which ids.
 *
 * `values` names the kind, and the entry prints the curated terms of that kind under the
 * role. The kind is not a presentation choice: `checkTerm` in `lib/core/card/validate.ts`
 * is called with exactly one `TermKind` per field, and a term of any other kind is refused
 * with `card/wrong-term-kind` even though it resolves. So a chip row is what the validator
 * accepts there, minus the namespaced terms a bundle may have declared for the same kind.
 * That limit is why every chip row is captioned `curated` rather than left as a bare count,
 * and the band at the foot states the rest of it in words: all of them, the curated ones
 * these rows draw on, plus every term a published bundle declares in its own namespace. A
 * list of legal values that quietly under-reports is the one way this fold could mislead a
 * card author, so the shortfall is named in both places rather than in neither.
 *
 * Every sentence is `lib/core/card/schema.ts` or `lib/core/card/validate.ts` read back, and
 * the point of each entry is the ROLE: what the field decides, and what goes wrong when it
 * is absent or wrong. An entry that said "`type`: the port's type" would be the table again
 * at greater length.
 *
 * The prohibition pair is last on purpose, `cannot` then `will_not`: the quoted refusal
 * under this list is the engine's answer to the first of the two, and the three read as
 * one argument in that order.
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
        counts the node as a person or a process, and whether{" "}
        <Id>command</Id> is owed. An id the vocabulary does not carry is a{" "}
        <Id>card/unknown-term</Id>, and a term of another kind is a{" "}
        <Id>card/wrong-term-kind</Id> rather than a silent pass.
      </>
    ),
  },
  {
    key: "inputs[].name · outputs[].name",
    role: (
      <>
        The end of an edge rather than a label. A DOT edge writes{" "}
        <Id>{'[out="build", in="brief"]'}</Id> to say which pair of ports it joins, so a
        port name is an address the topology layer spells out loud. Unique within a side:
        two inputs both called <Id>brief</Id> leave the resolver no way to decide which one
        an edge meant, and it raises <Id>card/duplicate-port</Id> rather than picking one.
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
        instantiated with, and the only thing this node ever sees.
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
        silence. A flag that is quietly ignored reads as a flag that works.
      </>
    ),
  },
  {
    key: "phase[]",
    values: "phase",
    role: (
      <>
        Where in the lifecycle the node sits. Any number of the five, and the wire key takes
        a single term or a sequence because both spellings read naturally in YAML. The five
        are closed and nobody may add one: a namespaced entry is a{" "}
        <Id>card/namespaced-phase</Id> and anything else is a{" "}
        <Id>card/unknown-phase</Id>. An empty list is a complete answer and never a hole,
        because the phases describe the factory rather than every node in it, and an intake,
        a retrieval step or a memory store stands in none of them. Nothing that renders a
        card may draw the empty case as missing data.
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
        What makes the node dangerous, and what that costs it. The weight is set by the
        vocabulary rather than by the card, so a locally coined marker with no{" "}
        <Id>defaultWeight</Id> counts zero: a card can declare a risk the scoring never
        sees, which is the one outcome worth knowing about before you write one.
      </>
    ),
  },
  {
    key: "params.*",
    role: (
      <>
        Free in shape, but it must survive a JSON round trip, because the card is hashed
        as JSON into its digest. A value that cannot be serialised cannot be hashed. A
        card that cannot be hashed cannot be pinned by a blueprint. So{" "}
        <Id>card/bad-type</Id> is raised where the value is written, not at the
        point where two digests disagree.
      </>
    ),
  },
  {
    key: "cannot[]",
    role: (
      <>
        The same <Id>data-type</Id> terms a port takes, listed above, and nothing else. Each
        entry is a prohibition the resolver enforces: an incoming edge able to carry that
        type, or a narrower kind of it, fails the bundle. A sentence written here is a{" "}
        <Id>card/unknown-term</Id>, because the engine has no way to hold a graph to a
        sentence and this is the field it holds graphs to.
      </>
    ),
  },
  {
    key: "will_not[]",
    role: (
      <>
        The prohibitions the author states and the engine cannot check: &ldquo;never opens
        a shell&rdquo;, &ldquo;does not edit the code under test&rdquo;. Nothing reads
        them, and they are addressed to whoever runs the node and to the agent that reads
        the specification. These two fields were one field until the split, and the reason
        they are two is the sentence that used to sit here apologising for it. Both are
        legitimate. A reader has to be able to tell which is which without running
        anything.
      </>
    ),
  },
];

/**
 * The terms a field will accept, printed as the ids a card has to spell.
 *
 * The id and not the label, which is the reverse of every other listing of the vocabulary
 * on this site. `VocabularyBrowser` leads with "Human in the loop" because a reader
 * arriving at a listing wants to know what a term MEANS; a reader at this point in the page
 * is holding a field and needs the string that goes in it, and the label is one click away
 * on the term's own page.
 *
 * CURATED, AND THE CAPTION SAYS SO. These come off `CORE_ONTOLOGY` and carry no local
 * term, which is what lets them render in the synchronous shell (the header docblock
 * argues the split). A namespaced term a bundle declares is legal in the same field, and it
 * is in the band at the foot of the page with the violet `local` marker beside it. Printing
 * one bundle's private coinage in a chip row headed "curated" would be the fold quietly
 * changing what the word means; leaving the count unlabelled would be worse, because a
 * reader would take it for the whole set.
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
 * ASYNC, AND THEREFORE ONLY REACHABLE INSIDE THE `Suspense` BOUNDARY the page wraps it in.
 * The page's own header argues why the split runs along this line; `app/upload/page.tsx`
 * splits the same way and its `TargetedUploadFlow` records the consequence that matters
 * here, which is that `renderToStaticMarkup` cannot await a component like this one and
 * shows the boundary's fallback instead of crashing on it.
 *
 * It opens its own view rather than taking one from the page, because the page has no view
 * to give it: the shell reads the curated core, which is a constant, and this reads the
 * registry, which is a query.
 */
async function VocabularyList() {
  const { db } = getSharedDbClient();

  const view = await vocabularyView(db);
  const { terms } = view.ontology;
  /* Only the namespaced half is needed here. The curated count is the shell's, read off
     `CORE_ONTOLOGY` beside the heading; what this listing has to know is which rows are
     local, so the browser can mark them and its origin filter can separate them. */
  const localIds = new Set(partitionTerms(terms).local.map((term) => term.id));

  /* Every published card VERSION, not the newest of each.
     ------------------------------------------------------------
     `termUsageOver`'s own rule, and the reason it is `cards()` here where `/nodes` takes
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

  /* The listing's rows, flattened on the server so `VocabularyBrowser` never touches the
     engine. Composed here rather than inside the browser because the usage count is a
     registry fact and the weight comes through the engine's own lookup, and neither is
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
    /* Through the engine's own lookup, not off the term. Doc 3 §4 moved the seven core
       weights into `DARKPRINT_CONFIG.security.weights`, so a core marker's own
       `defaultWeight` is always unset and reading it alone would print no weight for any
       of them. `markerWeight` is the order the engine uses: configuration first, then the
       term's own value, which survives for a locally namespaced marker. */
    const weight = markerWeight(term);
    if (weight !== undefined) row.weight = weight;
    /* The successor and nothing else. The row used to carry the ontology version the term
       was deprecated in, which no row printed and which stopped naming anything when the
       vocabulary stopped being versioned (owner, 2026-09-05). */
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
 * What stands in the listing's place while the query runs.
 *
 * The BAND is not in here, and that is the whole point of where the boundary sits. Its
 * heading declares `#every-term-heading`, which `app/ontology/[...term]/page.tsx` links back
 * to and the Learn rail can list; an id that arrives with the stream is an id a hash
 * navigation can miss, and it would miss it silently, because `components/site/anchors.test.
 * ts` walks the source and would find the id either way. So the heading renders with the
 * shell and only the rows wait.
 *
 * `aria-hidden`, because a screen reader announcing "loading" for a region nobody navigated
 * to is noise, and the heading above it has already said what is coming. The height holds
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
 *
 * SYNCHRONOUS ON PURPOSE. Everything above the vocabulary band is `content/`, the engine's
 * own core ontology and two constants, and the header docblock argues at length why the
 * registry read is a child rather than an `await` here.
 */
export default function SpecCardPage() {
  const { page } = specNeighbours(HERE);

  /* The curated core, through the engine's own view rather than off `CORE_ONTOLOGY.terms`
     directly: `byKind` is where the kind index and the sort live, and a page that filtered
     the array itself would be a second implementation of both. No extensions passed, which
     is the whole of what makes these chips a statement about the specification. */
  const coreView: OntologyView = ontologyView(CORE_ONTOLOGY);

  /* Doc 3 §2's own order, which is the lifecycle rather than the alphabet.
     `byKind("phase")` sorts by id and would open the five with `debugging`. */
  const phases = CORE_PHASE_IDS.map((id) => coreView.get(id)).filter(
    (term): term is OntologyTerm => term !== undefined,
  );
  const termsOf = (kind: TermKind): readonly OntologyTerm[] =>
    kind === "phase" ? phases : coreView.byKind(kind);

  // The engine's own sentence about the prohibition the card above declares. Quoted
  // rather than paraphrased, and guarded rather than indexed blindly: a page arguing that
  // a declaration is enforced should drop the quotation rather than invent one if the
  // demonstration ever stops being derivable.
  /* The same card `SectionNodeCard` annotates, parsed, for the reach panel above it. */
  const reachCard = getNodeCard("code-builder")?.card;

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
            /* The second sentence arrived with the vocabulary, 2026-09-06. A reader who
               came here for the schema has to learn on the first screen that the words the
               schema takes are on this page too, because the route that used to hold them
               is gone and its name is what they would otherwise go looking for. */
            lead="The validator reads JSON on the same schema as the YAML. A published version is never edited in place, so a change means a new file and a new version number. Every word a card is allowed to use is defined below, beside the field that takes it."
          />
        </div>
      </header>

      {/* ---------- what one card reaches, moved here 2026-08-08 ----------
          The author asked this panel off `/what-a-blueprint-is` and onto this page, "just
          below" the lead above.

          It belongs here and it was the odd one out there. `/what-a-blueprint-is` answers
          what a blueprint IS in three parts and a run; this figure is six named fields with
          two paragraphs of fine print each, which is reference material about one file
          format. This page is that file format, and the reader who arrives here has already
          decided to study a card rather than to find out what one is.

          Above `SectionNodeCard` rather than below it, because the annotated listing walks
          nine parts of a real document and this names the six fields that decide a node's
          reach. Fields, then the file.

          Every value is read off `code-builder@1.0.0`, the card the rest of the site opens
          with. A page explaining what `mcp` and the prohibition fields are, illustrated with invented
          values, would be teaching a schema nobody ships. */}
      {reachCard !== undefined && (
        <section id="card-reach" className="scroll-mt-24 border-b border-line bg-void py-12 sm:py-16">
          <div className="container-page">
            <WhatACardReaches
              model={reachCard.model ?? "inherits"}
              tools={reachCard.tools.length > 0 ? reachCard.tools.join(", ") : "none"}
              mcp={reachCard.mcp.length > 0 ? reachCard.mcp.join(", ") : "none"}
              skill={reachCard.skill ?? "none"}
              /* The first entry of each, and both fields are read rather than one being
                 derived from the other by position. This page used to pass
                 `cannot[0]` for the term and read `cannot[1]` as the prose two figures
                 down, which worked only because the archive's one enforced card happened
                 to write them in that order. The two fields make the read say what it
                 means. */
              cannot={
                reachCard.cannot.length > 0 ? (reachCard.cannot[0] ?? "") : "no type refused"
              }
              willNot={
                reachCard.willNot.length > 0
                  ? (reachCard.willNot[0] ?? "")
                  : "nothing undertaken"
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

      {/* The figure this page opens with: the card the whole page is about, annotated
          line by line, read straight out of `content/cards/`, and broken into nine parts
          a reader picks rather than scrolls through. */}
      <SectionNodeCard />

      {/* ---------- the reference, in the open ----------
          A band, not a row in a flex stack. The seam is a `border-t` and a ground
          change, the same device `/towards-a-dark-factory` marks its bands with. The band
          that used to sit between this and the figure is gone, so the figure's `bg-void`
          runs straight into this one's and the rule is what divides them. */}
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
            {/* No count in the sentence. The docblock this page shipped with said
                "fifteen rows" over a `CARD_ROWS` that has sixteen, because `provenance`
                was added and the prose was not: a number typed beside a list somebody
                else owns goes stale silently, and there is nothing here worth spending a
                render on `CARD_ROWS.length` for. */}
            <p className="text-sm text-muted">
              One row per wire key. The third column is the point. A diagnostic code is
              greppable. The build and{" "}
              <SpecLink href="/upload">the upload check</SpecLink> print it. It is the
              difference between a promise and a rule you can go and trip on purpose.
            </p>
            <CheckLegend />
            <CheckTable
              rows={CARD_ROWS}
              caption="What the engine checks on a node card, and what it leaves to the author"
            />
          </div>

          {/* ---------- the fold: the vocabulary, field by field ----------
              This replaced a list of nested keys, and it replaced the whole of
              `/spec/ontology` at the same time (header docblock). A field that draws its
              value from the vocabulary now prints that vocabulary under it, so a reader
              looking at `phase[]` sees the five phases without going anywhere.

              ── The layout, and why the reading lane came off ──
              One row per field, the key in a 15rem column and the prose beside it. It was
              a two-column grid of short definitions with `.prose-lane` on the paragraph
              above it, and both went: the entries are no longer short, since the ones
              that take a term carry a row of chips, and the lane is the width cap the
              owner has overruled twice. The key column is what narrows the line now, which is the arrangement
              `TermTable` uses for exactly this reason and defends in its own comment.

              ── Not a `<details>` ──
              The chip rows are the longest thing in this band, and folding them away
              would put the vocabulary one interaction further from the field than it was
              on its own route, which would make the fold a regression wearing a tidier
              layout. */}
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
                      reads as the table continued rather than as a second, differently
                      typed reference. Deliberately NOT copper: that register belongs to
                      the figure above, where it marks the runs of one real file. */}
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
            {/* The strip the vocabulary page drew under its counts, and it moved with the
                counts. Every id in the lists above and every number beside them comes out
                of `CORE_ONTOLOGY` through the engine's own view, which is the difference
                between this page and the site quoting itself: a term renamed in the core
                is renamed here, and one removed disappears rather than being printed by a
                page that still remembers it.

                WHAT IT DELIBERATELY DOES NOT CLAIM is a moment. The ontology page's
                version of this line said the ids were read "on the request that draws the
                page", which was true of a band reading the registry and would be a
                half-truth here: these come from a constant compiled into the deployment,
                and the request-time read is the band at the foot. An honesty strip that
                overstates where its numbers come from is worse than none. */}
            <p className="border-t border-line pt-3 font-mono text-[11px] tracking-[0.06em] text-dim">
              every id above is read off the engine&rsquo;s own core ontology, not typed
              into this page
            </p>
          </div>

          {refusal !== undefined && (
            <div className="flex flex-col gap-3">
              {/* No reading lane, on the author's instruction (2026-08-08). This is a
                  one-sentence caption for the panel directly under it, and the panel is
                  full width. Capped it broke over three lines and ended a third of the way
                  across, with an `<Id>` chip carrying a DOT statement wrapping inside it:
                  a caption narrower than the thing it captions reads as a different column
                  rather than as a label. */}
              <p className="text-[15px] leading-relaxed text-muted">
                The sentence below comes from the resolver during the build, not
                from this page. It runs over the starter bundle with{" "}
                <Id>{ADDED_DOT_LINE}</Id> inserted.
              </p>
              <div className="rounded-lg border border-line bg-surface-2 p-4">
                {/* The severity in word form, beside the code, from the same table the
                    validator's own lists use. An earlier length pass deleted the sentence
                    that carried "at error severity" and left the word only on a figure's
                    `<svg>` plate; that figure is now off the page too, so this is the one
                    place on `/spec/card` where the severity is a word a reader can find.
                    Read off the diagnostic rather than typed, so it cannot drift from what
                    the engine actually returned. `honesty.test.ts` pins the pair. */}
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
              {/* Pointed at the topology layer when `/what-it-isnt` was removed. The
                  sentence had to change with the href, not just follow it: the old target
                  drew the clean and leaked graphs side by side and quoted the analyzer on
                  both, and nothing on the site does that now. What survives is the
                  prohibition drawn as an edge the starter graph does not have. */}
              <p className="text-sm text-dim">
                <SpecLink href="/spec/topology">The topology layer</SpecLink> draws the
                same prohibition as an edge that the starter graph does not have. The
                drawing sits beside the card that declares it.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---------- every term, which used to be a route ----------

          The whole vocabulary, after the fields that consume it. This is the second half
          of the fold and the reason the first half can stay short: the chips above answer
          "what may I write here", and a reader who wants the set itself, with what each
          term means and how many cards name it, gets it without leaving the page.

          ── Why after the fields and not before them ──
          The reader arriving on this page is holding a schema. The set of legal values for
          a field is part of that schema; a listing of every word in the vocabulary is a
          different question, asked by a reader who already knows which kind they want. An
          enumeration above the reference would open a schema page with a wall of rows,
          which is the same argument the ontology page made for putting its own listing
          second.

          ── What the fold had to keep, and does ──
          Search, the kind filter, the core-or-local filter and the per-term usage count
          all come with `VocabularyBrowser`, which is unchanged and still sits on the
          shared `RegistryFilterBar` that `/blueprints` and `/nodes` use. `OntologyCatalog`
          comes with it as its unfiltered view rather than being deleted as a duplicate: it
          is the only drawing of the vocabulary that groups by kind, hangs the subtypes off
          their parents and puts the note on how to read a kind under the terms of that
          kind, and the browser shows exactly one of the two at a time, chosen by what the
          reader just typed. Two exhaustive listings on one site is the duplication this
          codebase deletes; two arrangements of one listing, one on screen at a time, is
          not.

          The catalog renders on the server and travels through the client boundary as
          children, which is what lets it draw subsumption rails no serialisable row shape
          could carry. It takes the view and the usage index this page already read rather
          than opening its own, so the chips above and the rows below describe one
          vocabulary. */}
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
            {/* No total. The browser prints a live `results/total` in its own filter bar
                and again above the rows, so a number here would be a second count of the
                same set, typed in the half of the page that cannot see it. The curated
                count is this half's own and it is the one the chips above are drawn
                from. */}
            <p className="text-[15px] leading-relaxed text-muted">
              The {CORE_ONTOLOGY.terms.length}{" "}
              curated terms the fields above draw on, and every term a published bundle
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

      {/* The rail closes the page on the opposite ground, and with no `border-t` of its
          own: `SpecPager` draws one at container width, and a full-bleed rule 64px above
          an inset rule is two lines saying one thing. The ground change is the seam, and
          the run is now header void, reference void behind its own rule, the listing
          `bg-surface/40`, and this one void again. */}
      <section className="bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
