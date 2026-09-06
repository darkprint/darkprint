import type { Metadata } from "next";

import type { OntologyTerm, OntologyView, TermKind } from "@/lib/core";
import { CORE_PHASE_IDS, partitionTerms } from "@/lib/core";
import { getSharedDbClient } from "@/lib/db";
import { openView } from "@/lib/server/ontology";
import type { Actor } from "@/lib/server/policy";
import { cards } from "@/lib/server/registry";
import { searchTerms } from "@/lib/server/search";
import { Id } from "@/components/spec/parts";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { OntologyCatalog } from "@/components/ontology/OntologyCatalog";
import { markerWeight, termUsageOver } from "@/components/ontology/TermTable";
import {
  VocabularyBrowser,
  type VocabularyRow,
} from "@/components/ontology/VocabularyBrowser";
import { cx } from "@/lib/format";

// SEAM-14 LIVE: the vocabulary and its usage column are read from the registry (T080) and
// from search (T200) rather than from `content/` at build time. The merged route is
// `GET /api/search/terms`; this page consumes the MODULE rather than the route (D-260-13).
// The annotation arrived with the browser when `/ontology` was deleted on 2026-09-06; it
// was on that route's page file and a seam anchor has to sit where the read happens.

/* ============================================================
   /spec/ontology — layer 3, and the answer to the author's
   original question about which of the three the spec language is.

   The page is two bands: what the vocabulary is and how big it is,
   then every term in it. Every number in both is read off the
   engine on the request that draws the page, which is what keeps
   this page from being the site quoting itself.

   ── The vocabulary browser moved here, and that is a reversal ──
   The owner, 2026-09-06: "move the ontology page in the
   /spec/ontology substituing the "every term" box. Then, you can
   delete the /ontology page".

   So the second band is `VocabularyBrowser` over `OntologyCatalog`,
   standing where an amber route box used to link across to
   `/ontology`, and that route is deleted. The argument the box
   embodied is worth keeping even though it lost: this page
   specified the FORMAT and the index listed the WORDS, two
   questions on two routes, and `components/ontology/canonical-route.
   test.ts` was written to stop either one absorbing the other. It
   now asserts the merge instead. What that split bought was a
   browse target the chrome could name without landing a reader on a
   specification document; what it cost was a reader holding a term
   having to choose between two pages that both claimed the word.
   The owner priced the second higher. That is a call about the site
   and not a defect in the code, and the reasoning for the split is
   recorded rather than deleted so a fourth pass knows what it is
   trading away if it splits them again.

   ── Specification, then enumeration, and the seam is where the
   reader needs it ──
   Bands run: the five kinds and their counts, then every term. A
   reader meets what a term IS before they meet 55 of them. Putting
   the enumeration first would have opened a specification with a
   wall of rows.

   ── Route config: per-request, and it has to be ──
   `dynamic = "force-dynamic"` below. The page reads the registry
   now, and Next cannot see a request-time dependency in a drizzle
   query: with no `searchParams`, no `cookies()` and no `headers()`
   this segment would come out `○ Static` in the build's route table
   and be read from Postgres ONCE, at deploy. `app/ontology/page.tsx`
   carried the same declaration for the same reason and its full
   reasoning, including why `connection()` is the wrong spelling
   here, is on the export itself.

   ── What was cut, and why (this pass) ──
   **The lattice figure and its caption.** The drawing of
   `acceptance-criteria ⊂ structured ⊂ any` with the fan of sibling
   types, and the caption restating the two isolation checks, opened
   the page. Both are gone on the author's word: the subsumption
   argument belongs to the isolation story, not to the page whose
   subject is the size and governance of the vocabulary, and reading
   a lattice was the first thing this route asked of a stranger.
   `components/spec/LatticeFigure.tsx` is deliberately KEPT: it is
   still rendered and measured by `components/viz/scene-labels.test.
   ts`, which walks the tree for scene drawers. It has no mount on
   any route now — if a later pass wants it gone, that test's ROSTER
   and its two `DRAWERS` assertions go in the same commit.

   **The exits band.** Four buttons to `/build` (a route deleted on
   2026-09-06), `/ontology`, `/nodes` and `/upload`, under a
   paragraph about the validator running in the tab. `SpecPager` already closes the page with the
   next stop in the sequence, and the same four routes are in the
   header and footer nav; the band was a third copy of the site map
   at the end of a spec page. Checked before cutting: the limit
   statement it carried ("nothing is uploaded, there is no account
   and no publishing step") is stated where a reader can actually
   act on it — `UploadFlow.tsx` says it in the open beside its own
   controls, and `/build` did the same until that route was deleted
   — and `components/site/honesty.test.ts` holds no entry over this page, so no guarded sentence left the
   site with the band. If the band ever comes back, it comes back
   with that sentence.

   **The last two bands, 2026-09-06.** One stated how a bundle adds
   a term of its own; the other tabled what the validator refuses
   about the vocabulary. The owner ordered both off the page, on the
   ground that the vocabulary stopped being versioned. Two things a
   later pass has to know.

   Neither band's heading, nor the name of the rules constant the
   first one rendered, nor the name of the row data the second one
   drew, is reproduced anywhere in this file, and that is
   deliberate. `components/ontology/canonical-route.test.ts` is a
   string check over these bytes, and a comment quoting a string its
   own guard reads would satisfy that guard against a page that no
   longer draws the thing. `docs/DECISIONS.md` D-144 records the
   same restraint for the same guard and is the row to read first.

   What the site now ships and no longer states. A bundle still
   declares its own terms in `ontology/extensions.yaml`, the
   resolver still merges them over the core, and the engine still
   refuses a namespaced term that reaches no curated parent. None of
   that changed with these bands. The nearest thing to a statement
   of it left on the site is the listing band's own lead, which says
   the total is the curated core plus every term a published bundle
   declares in its own namespace, and the origin filter and local
   marker the browser draws. A reader who wants to COIN one has
   nowhere on the site to learn the rules. That is a real loss and
   it is recorded here rather than replaced with a smaller surface,
   which the instruction did not ask for.

   Nothing under `components/spec/` was deleted. The legend and the
   table component the second band mounted are shared, and both
   still draw on `/spec/card` and `/spec/topology`. Its row data is
   an export of `components/spec/rows.ts` that this page was the
   only reader of, so that export is now unused; the file is not
   this lane's to edit and the dead export is reported instead.

   No `generateStaticParams` and no `dynamicParams` either way: this
   is a fixed segment with no dynamic params to generate (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`). The
   page is a server component and takes no props.
   ============================================================ */

/* "The ontology file (YAML)", not "Ontology", and the two siblings already read this way —
   `/spec/card` is "The node card, in YAML" and `/spec/topology` is "The blueprint file
   (DOT)". This one was the exception, and it stopped being affordable on 2026-08-12 when
   the index route took the bare word on the author's instruction: two routes, two tabs, and
   both of them saying "Ontology · DarkPrint". The page's own `h1` still says Ontology,
   because that is the thing this document specifies.

   The collision is gone with the index (2026-09-06) and the title stays anyway. It reads
   as one of three siblings in the spec sequence, which is the set a reader meets it in,
   and taking the bare word back would only make this tab indistinguishable from the
   chrome row that points at it. */
export const metadata: Metadata = {
  title: "The ontology file (YAML)",
  description:
    "Layer 3 of a DarkPrint blueprint is one ontology of phases, node types, data types, tool capabilities and risk markers. Every identifier in the graph and the cards is finally resolved there.",
};

const HERE = "/spec/ontology";

/**
 * PER-REQUEST, AND THE NEGATIVE IT SATISFIES IS ABOUT THE BUILD (D-260-05).
 *
 * This segment was static until the vocabulary browser arrived on it. It is not any more,
 * and the declaration is the whole of what makes that true: Next prerenders a page it
 * cannot see a request-time dependency in, and it cannot see one in a drizzle query. With
 * no `searchParams`, no `cookies()` and no `headers()`, the three registry shelves all came
 * out `○ Static` in the build's route table, read from Postgres once at deploy and frozen
 * there. This page now reads the same registry, so it inherits the same defect without the
 * same declaration, and nothing in the source would show it.
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
 * The vocabulary this page both specifies and lists: the curated core, with every local
 * term a public blueprint's current release declares merged over it.
 *
 * ONE VIEW FOR THE WHOLE PAGE, and that is the point of reading it here rather than in two
 * places. The band above the listing counts the core and names the phases; the listing
 * enumerates every row and marks which of them the core does not have. A page that read
 * `getOntologyView()` for the prose and the registry for the rows would be free to print
 * one total in a paragraph while listing a different one in the panel underneath it, and
 * `OntologyCatalog` records that hazard as the reason it takes the view as a prop.
 *
 * Two readers because there are two corpora and only one of them is in the database
 * (D-200-17). The core is `CORE_ONTOLOGY`, which `openView` merges over; a local term
 * travels with the release that declares it, so it arrives through `searchTerms`, the
 * module that owns reading them and deciding which bundles' releases may be read at all.
 *
 * The core half is not per-registry and never was: there is one core, nothing publishes a
 * second, and every card in the registry is resolved against it. Swapping this page off
 * `getOntologyView()` therefore moves no count in the specification band. What it moves is
 * the set of NAMESPACED terms, which is genuinely per-registry, and which the listing and
 * its total have to agree with.
 */
async function vocabularyView(db: ReturnType<typeof getSharedDbClient>["db"]): Promise<OntologyView> {
  const local = await searchTerms(db, ANONYMOUS, { origin: "local" });
  return openView(local.hits.map((hit) => hit.item));
}

/**
 * The canonical h2, spelled the way `components/ui/SectionHeading.tsx` spells it.
 *
 * Every band below opens with a `.label-lead` and one of these. The sub-sections used to
 * draw at `text-2xl` (24px), which is neither of the two display steps the site has, and
 * carried no mono cue at all — so the three sections after the title were
 * typographically indistinguishable, and the count of curated terms, which is the page's
 * headline fact, opened on nothing but whitespace. `.label-lead` is the answer rather
 * than a second cyan eyebrow: the eyebrow names a page or a full-bleed band, and it is
 * rationed to one of each.
 */
const BAND_H2 =
  "font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]";

/**
 * The five kinds, in the order the vocabulary band lists them.
 *
 * The author's note was that the page is confusing, and this is the first of the three
 * causes: the five kinds were named inside a sentence of counts, so a reader met
 * "{n} node types, {n} data types, {n} tool capabilities" with nothing anywhere saying what
 * a tool capability IS or how it differs from a risk marker. A count is not a definition.
 * The table gives each kind a line of its own and puts the count in a column beside it,
 * which is the same information a reader can now scan by kind rather than parse by comma.
 *
 * ── Two of the four columns are engine-derived and the other two are copy ──
 * `names` is written here because the engine has no prose about a KIND — it holds terms,
 * not a description of the categories they fall into. The count and the example are read
 * off `view` on the request and never typed: `coreOf` counts the kind, and `example` is a
 * lookup key rather than a printed string, resolved through `view.get` so the chip renders
 * the term's own id and disappears rather than lying if that term is ever renamed away.
 *
 * Which term illustrates a kind is a judgement nothing in the data encodes — the first or
 * the alphabetically-least term of each kind is `ci` for tools, which teaches a reader
 * nothing — so the choice is the hand-off's and only the choice is written down.
 */
const KINDS = [
  {
    kind: "phase",
    label: "phase",
    names: "where in the lifecycle a node sits",
    example: "planning",
  },
  {
    kind: "node-type",
    label: "node type",
    names: "what kind of actor a node is",
    example: "human-gate",
  },
  {
    kind: "data-type",
    label: "data type",
    names: "what travels along an edge, and what may not",
    example: "acceptance-criteria",
  },
  {
    kind: "tool",
    label: "tool capability",
    names: "what a node is allowed to reach for",
    example: "git",
  },
  {
    kind: "risk-marker",
    label: "risk marker",
    names: "what makes a node dangerous, and what that costs it",
    example: "isolation-breach",
  },
] as const satisfies readonly {
  kind: TermKind;
  label: string;
  names: string;
  example: string;
}[];

export default async function SpecOntologyPage() {
  const { page } = specNeighbours(HERE);
  const { db } = getSharedDbClient();

  const view = await vocabularyView(db);
  const { terms } = view.ontology;

  /* The curated core, counted apart from the namespaced terms layered on it. `terms` is
     the merged view. Everything describing the shared contract counts `core`; the
     namespaced terms reach the page only through `localIds`, which marks them in the
     listing. */
  const { core, local } = partitionTerms(terms);
  const coreOf = (kind: Parameters<typeof view.byKind>[0]): number =>
    partitionTerms(view.byKind(kind)).core.length;

  // Doc 3 §2's own order, which is the lifecycle rather than the alphabet.
  const phases = CORE_PHASE_IDS.map((id) => view.get(id)).filter(
    (term): term is OntologyTerm => term !== undefined,
  );

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

  const localIds = new Set(local.map((term) => term.id));

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
    /* The successor and nothing else. The row used to carry `since` as well, the ontology
       version the term was deprecated in, which no row printed and which stopped naming
       anything when the vocabulary stopped being versioned (owner, 2026-09-05). */
    if (term.deprecated !== undefined) {
      row.deprecated =
        term.deprecated.replacedBy === undefined
          ? {}
          : { replacedBy: term.deprecated.replacedBy };
    }
    return row;
  });

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-5">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            /* The lead names the two layers that reach into this one rather than the
               relation between its entries. It read "One versioned list of identifiers, and
               the subsumption relation between them", which put the page's hardest word in
               its first sentence and left a reader who had just come off the card page
               without the connection to what they had been reading. Naming which layer
               contributes which kind is the same information a beat earlier. */
            lead="One list of the words a blueprint may use, and how they relate. The graph names phases and node types. The cards name data types, tools and risk markers. This is where all of them are defined."
          />
        </div>
      </header>

      {/* ---------- the size and shape of the curated set ----------
          A band, not a row in a flex stack. The five sections of this page used to sit
          inside one `container-page flex flex-col gap-14 py-14`, so this heading — the
          page's headline fact — began with 56px of whitespace above it and nothing else
          — while `/towards-a-dark-factory`, in the same nav group, marks every seam with
          a full-bleed edge and a ground change. Same device here: `border-t` and an
          alternating ground, no new token and no new colour. */}
      <section
        className="border-t border-line bg-void py-16 sm:py-20"
        aria-labelledby="vocabulary-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The vocabulary</span>
            {/* The heading names the five kinds instead of counting the terms. The count is
                still the band's headline fact and it is in the paragraph under this and in
                a column of the table, where it is one of five counts rather than the only
                one — which is the point of the change: "{n} curated terms" is a size, and a
                reader who does not yet know what a term IS cannot use a size. */}
            <h2 id="vocabulary-heading" className={cx(BAND_H2, "scroll-mt-24")}>
              Five kinds of term, in one list
            </h2>
          </div>
          {/* NO measure on any text on this page, and it is not an exception any more.
              --------------------------------------------------------
              This comment used to argue the band as the one place `.prose-lane` came off,
              on the grounds that its paragraphs are the vocabulary's own inventory rather
              than running prose — counts and phase ids set in `<Id>` chips, which the eye
              lands on whole rather than tracking to the end of a line, so the 36rem measure
              was breaking a list a reader scans into three and four lines.

              The argument was right and the scope was wrong. The author's ruling, given
              again on 2026-08-11 and twice before it: text occupies the full horizontal
              space. `components/ui/SectionHeading.tsx` records the earlier two against its
              own lead — "the subdescription of the title should occupy the full horizontal
              span … the text should reach the right" — and this pass had reintroduced caps
              across four files by copying `max-width: 820px` out of the mocks, which is
              exactly the drift that ruling exists to stop. Every one of them is gone.

              So the band runs to `container-page` because everything on this page does. If
              a measure ever comes back it comes back as a decision somebody argues for, not
              as a default a mock happened to carry. */}
          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              Every structural field on the two layers above references this list. One
              list of {core.length} curated terms stops two authors from naming the same
              thing twice.
            </p>
          </div>

          {/* The five kinds, explained before they are counted.
              ------------------------------------------------------------
              A real `<table>`: five kinds against four facts is a grid of related values
              with headers on both axes, and a reader compares `terms` down the column and
              `what it names` across the row. The spec check table is not reused for it,
              even though the sibling layer pages draw one: that component takes `CheckRow`s
              and draws a severity column, and bending it into a generic table would make
              one component answer two questions.

              It scrolls inside its own box rather than folding, and carries the three
              attributes that keeps reachable by keyboard. `components/ui/SourcePanel.tsx`
              and `components/spec/CheckTable.tsx` both solved this exact case in this repo
              and this is the same fix. Neither is mounted on this page since the last two
              bands came off (header docblock); they are cited as precedent. */}
          <div
            tabIndex={0}
            role="group"
            aria-label="The five kinds of term, scrollable"
            className="overflow-x-auto rounded-lg border border-line"
          >
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <caption className="sr-only">
                The five kinds of term: what each one names, how many the core defines, and
                one example of each.
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="label px-5 py-3 font-normal">
                    Kind
                  </th>
                  <th scope="col" className="label px-5 py-3 font-normal">
                    What it names
                  </th>
                  <th scope="col" className="label px-5 py-3 text-right font-normal">
                    Terms
                  </th>
                  <th scope="col" className="label px-5 py-3 font-normal">
                    For example
                  </th>
                </tr>
              </thead>
              <tbody>
                {KINDS.map((entry) => {
                  /* Resolved rather than printed. `example` is a lookup key chosen for what
                     it teaches, and what reaches the page is the term's own id, so a rename
                     in the core arrives here on the next request and a removal leaves the
                     cell empty instead of naming a term that no longer exists. */
                  const example = view.get(entry.example);
                  return (
                    <tr key={entry.kind} className="border-b border-line last:border-b-0">
                      <th
                        scope="row"
                        className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] font-normal text-fg"
                      >
                        {entry.label}
                      </th>
                      <td className="px-5 py-3.5 text-[15px] leading-relaxed text-muted">
                        {entry.names}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[15px] tabular-nums text-fg">
                        {coreOf(entry.kind)}
                      </td>
                      <td className="px-5 py-3.5">
                        {example !== undefined && <Id>{example.id}</Id>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* The strip the mock draws under the table, and it is not decoration: every
                number in the column above it and every id beside them is read off the engine,
                which is the difference between this page and the site quoting itself. Saying
                so under the table is cheaper than a reader wondering.

                It said "at build time" until 2026-09-06, and that stopped being true the
                moment this page started reading the registry per request. An honesty strip
                that names the wrong moment is worse than none: a reader who checks it would
                find the counts moving between two builds and conclude the strip lies about
                everything else too. Reworded to what the segment config now guarantees. */}
            <p className="border-t border-line px-5 py-2.5 font-mono text-[11px] tracking-[0.06em] text-dim">
              every count and every id on this page is read off the engine on the request
              that draws it
            </p>
          </div>

          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              {/* A comma where the mock writes a pause dash. `app/spec/ontology/page.tsx` is
                  walked by `workspace.test.ts`'s route check and `APP_EXEMPT` covers
                  `app/nodes`, `app/ontology`, `app/upload`, `app/blueprints/[slug]` and
                  `app/u` — not this one. */}
              The phases are closed. Nobody may add one. They stay in lifecycle order,{" "}
              {phases.map((phase, i) => (
                <span key={phase.id}>
                  {i > 0 && " "}
                  <Id>{phase.id}</Id>
                </span>
              ))}
              . The other four kinds are open.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- every term, which used to be a door to another route ----------

          A route box labelled `Every term` stood at the end of the band above, beside the
          line "This page is the format; that one is the words". Both are gone and the room
          replaces the door, on the owner's instruction of 2026-09-06 quoted in the header
          docblock. A door to a page that no longer exists is worse than no door, and that
          sentence described a split the same instruction abolished.

          ── Why a band of its own and not a block inside the vocabulary band ──
          It is a full listing on a page whose one other band is prose and a table, and it
          is the longest thing here by an order of magnitude. Left
          inside the band above it would have made that band's own closing paragraph, the
          one about the phases being closed, read as a caption on 55 rows. A ground change
          and a heading say plainly that the document has stopped specifying and started
          enumerating.

          ── Why here and not at the end of the page ──
          The reader who has just been told there are five kinds and how many of each wants
          to know whether the word they need is already in the set. So the order is: what
          the kinds are, then every term. Two bands stood after this one until 2026-09-06
          and the order was argued against them as well; the header docblock records what
          they were. An enumeration at the very top would open a specification with a wall
          of rows.

          ── What the merge had to keep, and does ──
          Search, the kind filter, the core-or-local filter and the per-term usage count all
          come with `VocabularyBrowser`, which is unchanged and still sits on the shared
          `RegistryFilterBar` that `/blueprints` and `/nodes` use. `OntologyCatalog` comes
          with it as its unfiltered view rather than being deleted as a duplicate: it is the
          only drawing of the vocabulary that groups by kind, hangs the subtypes off their
          parents and puts the note on how to read a kind under the terms of that kind, and
          the browser shows exactly one of the two at a time, chosen by what the reader just
          typed. Two exhaustive listings on one site is the duplication this codebase
          deletes; two arrangements of one listing, one on screen at a time, is not.

          The catalog renders on the server and travels through the client boundary as
          children, which is what lets it draw subsumption rails no serialisable row shape
          could carry. It takes the view and the usage index this page already read rather
          than opening its own, so both halves describe one vocabulary.

          What did NOT come across: the side rail the deleted index wrapped its page in,
          five rows pointing at the catalog's kind anchors. Those anchors only exist while
          nothing is filtered, so half the rail's rows went nowhere the moment a reader
          typed, and this route closes with `SpecPager` rather than a rail. It is a real
          loss for a reader scanning by kind and it is recorded rather than absorbed. */}
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
            <p className="text-[15px] leading-relaxed text-muted">
              All {terms.length} of them: the {core.length} curated terms above plus every
              term a published bundle declares in its own namespace, with each one&rsquo;s
              parent and how many cards name it. Search, or filter by kind and origin, and
              the grouped view below swaps for the matching rows.
            </p>
          </div>

          <VocabularyBrowser terms={rows}>
            <OntologyCatalog view={view} usage={usage} />
          </VocabularyBrowser>
        </div>
      </section>

      {/* The rail closes the page, and it carries the page's ground rule now that the two
          bands that used to state it are gone (header docblock).
          ------------------------------------------------------------
          Grounds alternate `bg-void` and `bg-surface/40` so every seam is a full-bleed edge
          AND a ground change, which is the device `/towards-a-dark-factory` uses in the
          same nav group. The run is: header void, the vocabulary band void behind its own
          `border-t`, the listing `bg-surface/40`, and this one void again. The header and
          the band under it are the one pair that share a ground; two rules 64px apart do
          the separating there, because the header is the page title and not a band.

          Removing the last two bands moved nothing. The listing was already `bg-surface/40`
          and this was already `bg-void`, so the final seam still changes ground. Still no
          `border-t` of its own: `SpecPager` draws one at container width, and a full-bleed
          rule 64px above an inset rule is two lines saying one thing. */}
      <section className="bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-8">
          {/* The Design box that stood at the right end of this row is gone, 2026-09-06.
              ------------------------------------------------------------
              It was added on 2026-08-08 on the author's instruction — "add a right light
              box on the bottom with name Design your blueprint which connects to /build" —
              because this page ended the sequence and a reader who had read all three
              reference pages was handed nothing to do with them. It stopped being a
              hand-built box when the crosswalk was inserted after this page and the pager
              drew that arrow itself.

              The owner deleted `/build` and `components/build/**` on 2026-09-06 ("it is not
              useful and make confusion"), so there is no longer a route that uses all three
              formats at once to point at. The pager below has a PREVIOUS and a NEXT of its
              own and needs no `after`; the slot stays on `SpecPager` for a page that
              genuinely has a spare end. */}
          <SpecPager
            href={HERE}
            /* No `after`. See the note above the pager for the box that used to sit in
               that slot and the route it pointed at. */
          />
        </div>
      </section>
    </>
  );
}
