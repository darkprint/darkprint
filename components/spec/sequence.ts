/* ============================================================
   The Learn routes, as one ordered list.

   Redesign spec §4.1 splits `/spec` into an overview and three
   layer pages, and asks that they "read as a sequence". A sequence
   needs somewhere to say what comes after what, and the choice is
   between four pages each naming their own neighbours and one list
   they all derive from. The list wins for the reason the split was
   made at all: the author left the single page because it was long,
   and four pages whose pagers disagree about the order is a worse
   failure than the length was.

   ── The IA pass, 2026-08-07: two routes left this list ──
   `/spec` is gone. The author asked for the overview page deleted
   and its three children kept reachable, and the page that becomes
   their door is `/what-a-blueprint-is`, which already linked all
   three under the same three headings. So `SPEC_OVERVIEW` is that
   route now: stop 00 still exists, the crumb and the rail still have
   a parent, and `next.config.ts` 308s `/spec` onto it.

   `SPEC_SCORING` is gone too, and it is a deletion rather than a
   move. The author asked the grading door off the spec index, and
   `/spec/scoring` merged into `/reading-the-radar` — one page for
   the picture and the arithmetic, outside this sequence, because
   grading is a reading OF the three layers rather than a fourth
   document a blueprint is written in. `spec-routes.test.ts` walks
   `app/spec` to make sure a fifth child never reappears without an
   entry here.

   ── And the worked example left, 2026-09-06 ──
   The owner deleted `/build` and its component tree: "it is not
   useful and make confusion". `SANDBOX` was exported by name for
   the header's Learn menu and the footer's Learn column, so its
   removal is three files, and the essay renumbers 06 → 05 the way
   it did in 2026-09-04's deletion below.

   ── And the grading page itself left, 2026-09-04 ──
   The author asked "How a blueprint is graded" off the site. It was
   stop 05, between the sandbox and the essay, so the row comes out
   and the essay takes 05 the way the sandbox took 04 when it was
   promoted: a sequence with a hole where a number should be tells a
   reader they missed a page. `next.config.ts` 308s
   `/reading-the-radar` onto `/build`, which was the stop that stood
   before it, and `/spec/scoring` was repointed there in the same
   change rather than chaining through a route that now redirects.
   Both were repointed again onto `/what-a-blueprint-is` when
   `/build` itself went, for the same no-chaining reason.

   ── And one route arrived, 2026-09-05 ──
   `SPEC_CROSSWALK` at `/spec/attractor`, on the owner's §11.0 Q20
   (b) ruling: the mapping between a bundle and the file an Attractor
   runner takes gets a page rather than a clause appended to each
   field row on `/spec/card`. It takes 04 in the specification run
   and the practice run moves down a rung, which is the treatment
   this file already applies in the other direction when a stop is
   deleted. It is NOT a fourth entry in `SPEC_LAYERS`: a blueprint is
   still three files, and the layer pages still say which of them
   they specify. (Two pages and three layers since the fold below,
   which is why the card entry's eyebrow names two.) See the constant
   for the rest of the argument.

   ── And that route moved to the front, 2026-09-06 ──
   The owner asked whether the ontology should exist at all, or
   whether everything should unify under the Attractor spec, because
   two specification documents read as two rival standards. The
   finding was that the vocabulary describes a layer Attractor leaves
   open, and that what makes the two read as rivals is the ORDER a
   reader meets them in: `/spec/topology` documents a DOT carrying
   two attributes Attractor's Appendix A does not have, and the page
   explaining that stood after three DarkPrint documents. The owner:
   "The motivations you provided are sound. Apply them."

   So `SPEC_CROSSWALK` is stop 01 and the layers move down a rung.
   The reader who already knows Attractor meets the mapping before
   the first DarkPrint format rather than after all of them, and the
   two attributes they will not recognise have been named as ours a
   page earlier.

   `/spec/ontology` is DELETED in the same change, and it is a fold
   rather than a deletion of the subject: every term in that document
   exists to be a legal value of a card field, so each is printed
   beside the field that consumes it on `/spec/card`. `SPEC_LAYERS`
   is two entries. What that cost is recorded on the constant itself,
   because the deleted entry carried two claims the site made nowhere
   else.

   So this file owns the order, the labels and the one-line question
   each page answers, and every surface reads it: the doors on
   `/what-a-blueprint-is`, each child's crumb, and the previous/next
   pager at the foot of every stop.

   Plain TypeScript, no JSX and no React, so `spec-routes.test.ts`
   can import it under `environment: "node"` and hold the pages on
   disk against it.

   Nothing dynamic lives here. The ontology door printed a live term
   count and that number was read off the engine on the page that
   rendered it rather than frozen into this list; the door is gone
   with the stop, and the rule it was an instance of still holds for
   whatever quotes a figure next.
   ============================================================ */

/**
 * One in-page section, as the left rail lists it under the page it belongs to.
 *
 * These were seven `PageContents` panels, one per route, each declared inline in the page
 * that drew it. The author asked them into the rail: "add to each entry also the subtopic
 * of the given page listed on `On this page` indented by one and clickable", and the panel
 * off the page.
 *
 * Moving the list here rather than leaving it in the page and reading it back is what makes
 * that possible at all. `LearnShell` is a client component that renders the rail for whichever
 * route is active; it cannot import a server page to ask what sections that page has. One
 * ordered list every surface derives from is the same argument this file already makes about
 * the order itself, applied one level down.
 *
 * `id` carries no `#`. The rail adds it, and a page that wants to link its own section
 * writes `#${id}` — one spelling of the anchor, in one place, so the two cannot drift.
 */
export interface SpecSection {
  /** The element id on the page. Must exist, with `scroll-mt-24`, or the link goes nowhere. */
  id: string;
  /** What the rail prints. Short: it is indented under a label that already gives context. */
  label: string;
}

/**
 * Which of the two runs a stop belongs to.
 *
 * The rail was one flat list of seven and the reader saw one course. Stops 00–03 are a
 * specification — what the three files are and what the validator does with them — and
 * what follows is a reading OF that specification. `LEARN_PRACTICE` has been its own
 * constant in this file since before the split, so the code already knew; the reader did
 * not, and was told they were two-sevenths through a course when they had come for DOT
 * syntax.
 *
 * The grouping is PRESENTATIONAL. There is still one list, one `specNeighbours()` walk and
 * one pager, and a reader stepping from 03 to 04 crosses the boundary in the ordinary way —
 * the pager just names the run they are stepping into.
 */
export type SpecRun = "specification" | "practice";

/** What each run is called, wherever one is named. One string, two surfaces. */
export const RUNS: Record<SpecRun, string> = {
  specification: "Specification",
  practice: "In practice",
};

/** What every page in the sequence carries. */
export interface SpecPage {
  /** The route. Also the identity of the entry. */
  href: string;
  /**
   * Two digits, shown in the crumb, on the door and in the rail.
   *
   * Optional since the sandbox stopped being a stop. An optional worked example is not a
   * step in a sequence: numbering it told a reader they had four of six done when they had
   * finished the specification entire, and offered them a detour as though it were the
   * road. It keeps its place in the reading order and loses the number.
   */
  step?: string;
  /** Which run this stop belongs to. */
  run: SpecRun;
  /** A word at the rail row's right end. The sandbox says what kind of stop it is. */
  meta?: string;
  /** Drawn indented under the stop above it, with a `└` where the number would be. */
  indent?: boolean;
  /** Short label, for the pager and the crumb. */
  nav: string;
  /** The mono line above the page's own `h1`. */
  eyebrow: string;
  /** The page's `h1`. */
  title: string;
  /**
   * The one line the page answers, shown on the door.
   *
   * The pager dropped it on 2026-08-07: a door is where a reader picks between three
   * pages they have not seen, and a pager is the foot of one they have read, where the
   * title is enough and the extra line only widened the amber box. The doors moved off
   * `/spec` onto `/what-a-blueprint-is` the same day and kept it.
   */
  question: string;
  /**
   * The page's own sections, in the order they appear on it.
   *
   * Required, and empty is a legitimate value rather than a missing one: a page with no
   * headed sections declares `[]` and the rail gives it no children. Making it optional
   * would let a page that grew three sections keep an entry that silently has none.
   */
  sections: readonly SpecSection[];
}

/** A layer page, which additionally names a file and the engine code that reads it. */
export interface SpecLayerPage extends SpecPage {
  /** The format, as the chip on the door reads it. */
  format: string;
  /** Where the file sits inside a bundle. */
  file: string;
  /** Which part of the engine reads it. */
  source: string;
  /**
   * The door's chip colour, as a variable in `app/globals.css`.
   *
   * ── The three hues, and why they are these three (2026-08-07) ──
   * The author named them: "topology/DOT = blueprint-pole blue, node card/YAML = the
   * copper orange it already uses, ontology/vocabulary = emerald green."
   *
   * Topology was `--color-cyan`. Cyan is this site's *interactive* semantic, and a chip
   * is a label rather than a control, so the swap both answers the instruction and
   * removes a semantic misuse. `--color-blueprint-line` (#74b4ff) is the cyanotype pole
   * the graticule under every figure is drawn in, which is the register a DOT graph
   * belongs to.
   *
   * The node card was `--color-amber`, and that was the violation. `app/globals.css`
   * says it in its own words: amber is spent on `ComingSoonBadge` and `.route-box` and
   * on nothing else, and the node card's orange "must never become" it — which is why
   * `--color-copper-line` (#ff8a4d) exists at oklch hue 46 against amber's 75. Copper IS
   * the orange the author means; amber is the gold this site reserves for "not built
   * yet" and "this box leaves the page". This chip sits inside a `.route-box` on
   * `/what-a-blueprint-is`, so amber here was "not built yet" printed on the one format
   * the engine parses most strictly.
   *
   * The ontology keeps `--color-emerald`, and this EXTENDS what emerald means. Its
   * standing job on this site is "a figure read off the engine" — a computed score, a
   * live term count. The vocabulary chip is a format name, not a computed reading. The
   * extension is deliberate and it is narrow: emerald is the ontology's colour
   * everywhere it is drawn already (the resolved `◆` values in the spec figures, the
   * term discs on the layer pages, the kind panels on `/ontology`), so a reader
   * meets the same green on the door and inside the page it opens. Read the rule as
   * "emerald = resolved against the engine, whether as a number or as a term" and both
   * uses fall under it.
   *
   * ── Measured, not assumed ──
   * Chip text on `--color-surface-2` (#0f121e), which is the chip's own ground:
   * blueprint-line 8.63:1, copper-line 7.99:1, emerald 9.70:1. All three clear AA 4.5:1
   * for text and AAA 7:1 as well, at 11px mono. On the band ground under it
   * (`--color-surface`, #0a0c16) they read 9.02 / 8.35 / 10.14. The chip's `border-line`
   * hairline is 1.26:1 and is decorative: the information is carried by the word inside
   * it, which is why the border is not held to the 3:1 non-text ratio.
   */
  color: string;
  /**
   * The in-page id this layer had while `/spec` was one page.
   *
   * The split turned `/spec#card`, `/spec#topology` and `/spec#ontology` into three
   * dead fragments: a fragment never reaches the server, so no redirect can carry one
   * onto the child route it became. Putting the old id back on the door means an
   * external link or a bookmark lands on the paragraph about that layer, one click from
   * the page it moved to, rather than silently at the top of the overview.
   *
   * It survives the deletion of `/spec` for the same reason it was written. A browser
   * re-applies the original fragment to a `Location` that carries none, so a bookmark
   * on `/spec#card` follows the 308 to `/what-a-blueprint-is` and then looks for `#card`
   * there. The three bands on that page carry these ids, with `scroll-mt-24`.
   */
  anchor: string;
}

/**
 * The entry point, and the one page that answers the author's original question.
 *
 * Their words: "probably we need a page reporting in details what is the documentation,
 * ie the spec language we use in darkprint. Probably it is the ontology, right?" The
 * overview answers it in one line and hands the reader a door per layer page.
 *
 * ── Why this is `/what-a-blueprint-is` and no longer `/spec` ──
 * The IA pass deleted `/spec` on the author's instruction and asked that its three
 * children stay reachable. `/what-a-blueprint-is` was already the page that linked all
 * three, under the layers' own headings and beside three figures read off the archive,
 * so it was the door in everything but name. Making it stop 00 rather than inventing a
 * fourth parent means the crumb, the rail and the pager keep working unchanged and the
 * three layer pages keep a place to come back to.
 *
 * `nav` is what the rail prints beside `step`. "Overview" would have named a page whose
 * `h1` says something else, and this site's own doctrine is one route, one name.
 */
export const SPEC_OVERVIEW: SpecPage = {
  href: "/what-a-blueprint-is",
  step: "00",
  run: "specification",
  nav: "What a blueprint is",
  eyebrow: "What a blueprint is",
  title: "What a blueprint is",
  question: "What a blueprint is for, and the three files one is written in.",
  sections: [
    { id: "bundle", label: "The blueprint contents" },
    { id: "parts", label: "The three parts" },
    { id: "run", label: "What surrounds a run" },
  ],
};

/**
 * Stop 01: the crosswalk between a bundle and the file a runner takes.
 *
 * ── why this is a route and not a column ──
 * The 2026-09-04 audit asked whether DarkPrint is a file registry a person who already
 * knows the Attractor specification can use without re-learning anything, and put the owner
 * two ways to close the gap: append an Attractor clause to each field row on `/spec/card`,
 * or give the mapping a page. The owner chose the page (§11.0 Q20 b), on two grounds. It is
 * one URL you can hand a stranger, and a page rendered from the exporter's own constants
 * cannot drift from what the exporter writes — where a clause per field row is a dozen
 * sentences that each go stale on their own.
 *
 * ── why stop 01, having been stop 04 ──
 * It arrived as the last question the specification run left open: having read what the
 * three files are, what does the thing that runs them actually see. The owner reversed that
 * on 2026-09-06 ("The motivations you provided are sound. Apply them"), on the finding this
 * file's header records: `/spec/topology` documents a DOT carrying `card=` and `in=`,
 * neither of which is in Attractor's Appendix A, and the page that says whose they are was
 * three DarkPrint documents further on. A reader who arrives already knowing Attractor met
 * two unexplained attributes first and a rival standard second.
 *
 * So the question it answers is asked before the formats rather than after them, and every
 * layer moves down a rung. That is the treatment this file applies whenever a stop is
 * inserted or removed, and for the reason recorded on the essay below: a sequence with a
 * hole where a number should be tells a reader they missed a page.
 *
 * It is still not a layer. A blueprint is three files and this page adds no format a reader
 * has to write; `SPEC_LAYERS` is where the layers are, and two pages are left in it.
 *
 * `eyebrow` deliberately breaks the layers' "Layer 0n of 03" pattern. Reusing it would have
 * announced a fourth layer in the one word a reader scanning the header reads first.
 */
export const SPEC_CROSSWALK: SpecPage = {
  href: "/spec/attractor",
  step: "01",
  run: "specification",
  nav: "Attractor crosswalk",
  eyebrow: "Compatibility",
  title: "The Attractor crosswalk",
  question:
    "Which card field becomes which node attribute, and what a runner reads that a blueprint cannot say.",
  sections: [
    { id: "crosswalk-heading", label: "The crosswalk" },
    { id: "shapes-heading", label: "Types and handlers" },
    { id: "classes-heading", label: "The class attribute" },
    { id: "unexpressed-heading", label: "The gap" },
    { id: "not-a-pipeline-heading", label: "Not a pipeline" },
  ],
};

/**
 * The layer pages, in the order a reader resolves the files: graph, then card.
 *
 * ── `title` is the site's name for the route, not a headline ──
 * Renamed on 2026-08-08. They were "The topology, in DOT", "The node card, in YAML" and
 * "The ontology, the vocabulary both draw from" — three sentences, each a good `h1` and none
 * of them the words the header and the footer use. The author asked the page titles to match
 * the Learn menu, and the pager's arrows with them: a NEXT box reading "The ontology, the
 * vocabulary both draw from" beside a menu row reading "The vocabulary" is two names for one
 * destination on one screen.
 *
 * This field feeds three surfaces, which is why one edit fixes all of them: each page's `h1`
 * (`title={page.title}`), both `SpecPager` arrows, and the three cards at the foot of
 * `/what-a-blueprint-is`. `nav.test.ts` requires one label per route and the site now has
 * one, so `NAV_TITLE` — the third copy that page carried to bridge the gap — is deleted with
 * this change rather than left to drift.
 *
 * `question` is what the old titles were really doing: naming the file is the title's job,
 * saying what the file answers is the question's, and they were sharing the work.
 *
 * ── Two entries since 2026-09-06, and what the third one was carrying ──
 * The vocabulary's page folded into `/spec/card` and `/spec/ontology` was deleted, so the
 * third entry went with it. A door cannot be repointed at `/spec/card`: `app/what-a-blueprint-is`
 * draws one band per entry and `WhereNext` one link per entry, so a second entry at that
 * href would put two names on one route on one screen, which is the defect
 * `components/site/nav.test.ts` opens with.
 *
 * The entry was the only place two claims were written, and both are accounted for rather
 * than dropped:
 *
 * - `file: "ontology/extensions.yaml"`. `tests/server/t260/frozen-tests.test.ts` names it
 *   the last statement on the site that the local overlay exists at all, the rest having
 *   been removed on the owner's instruction. It is REHOMED onto the card entry's `file`,
 *   which is the door to the page that now prints the terms, and the two paths are joined
 *   the way `source` already joins two modules on the topology entry.
 * - `anchor: "ontology"`. That id is drawn on `/what-a-blueprint-is` so a bookmark on the
 *   pre-split `/spec#ontology` still lands on the band about the vocabulary. With no third
 *   entry there is no third band, and the fragment now lands at the top of the page. It is
 *   NOT rehomed here, because `anchor` is held to `href` by `spec-routes.test.ts` one entry
 *   at a time and a second id on the card band is that page's to declare. Recorded as an
 *   absence so it reads as a cost somebody priced.
 */
export const SPEC_LAYERS: readonly SpecLayerPage[] = [
  {
    href: "/spec/topology",
    step: "02",
    run: "specification",
    nav: "Topology",
    eyebrow: "Layer 01 of 03",
    title: "The topology file (DOT)",
    question: "Which nodes exist, and what flows between them.",
    sections: [
      { id: "dot-file-heading", label: "The DOT file" },
      { id: "dot-checks-heading", label: "Validator checks" },
    ],
    format: "DOT",
    file: "topology.dot",
    source: "lib/core/dot/ · lib/core/attractor/",
    color: "var(--color-blueprint-line)",
    anchor: "topology",
  },
  {
    href: "/spec/card",
    step: "03",
    run: "specification",
    nav: "Node card",
    /* "Layers 02 and 03 of 03", where the entry above keeps the single-layer form.
       ------------------------------------------------------------
       The vocabulary's page folded into this one on 2026-09-06, so this route documents
       two of a blueprint's three files: the card, and the terms its `type`, `phases`,
       `riskMarkers`, `tools` and port types have to be drawn from. An eyebrow reading
       "Layer 02 of 03" over a page that also specifies layer 03 would send a reader looking
       for a third document that no longer has one, which is what the sequence's own hole
       rule refuses one level up. The count stays "of 03" because a blueprint is still three
       files; what changed is how many pages describe them. */
    eyebrow: "Layers 02 and 03 of 03",
    title: "The node card (YAML)",
    question: "What one node is, in enough detail to instantiate it.",
    /* Five rows since the fold, and five is what the two stops had between them.
       ------------------------------------------------------------
       `/spec/ontology` listed "Core vocabulary" and "Every term"; this page now declares
       both of those ids, so the rail keeps the same number of ways in and the reader who
       used to find the vocabulary in the rail still finds it. `every-term-heading` is the
       catalog band whole. `field-values-heading` is the fold itself, and it is an `h3`
       inside the field reference rather than a band of its own, which is the one place
       this list departs from "one row per band": the row is a claim about an id the page
       declares with `scroll-mt-24`, and dropping it would put the vocabulary further from
       the rail than it was on its own route. */
    sections: [
      { id: "card-reach", label: "Reach and limits" },
      { id: "node-card", label: "A real card, annotated" },
      { id: "fields-heading", label: "Field reference" },
      { id: "field-values-heading", label: "What each field may hold" },
      { id: "every-term-heading", label: "Every term" },
    ],
    format: "YAML, JSON accepted",
    /* Two paths, joined the way `source` above joins two modules. The second one arrived
       with the fold: `tests/server/t260/frozen-tests.test.ts` records that this string is
       the last place on the site the overlay file is named at all, and the entry that used
       to carry it is deleted. `/what-a-blueprint-is` draws this line under the door, so the
       claim keeps a reader. */
    file: "cards/id@version.yaml · ontology/extensions.yaml",
    source: "lib/core/card/schema.ts · lib/core/ontology/",
    color: "var(--color-copper-line)",
    anchor: "card",
  },
];

/**
 * The second run: what a reading of the specification looks like.
 *
 * One page. The specification says what the three files are, and this run is the question a
 * reader asks having read it: whether the work belonged to an agent at all.
 *
 * It was three until 2026-09-04, when the author asked the grading page off the site, and
 * two until 2026-09-06, when the owner deleted the sandbox at `/build` ("it is not useful
 * and make confusion"). It reads 04 since the vocabulary's stop folded into `/spec/card`
 * later the same day, having read 05 through the two deletions before it, and it renumbers
 * every time for the reason recorded there: a sequence with a hole where a number should be
 * tells a reader they missed a page.
 *
 * A one-entry constant is still a constant. The rail groups by run and prints "Practice",
 * and inlining this into `SPEC_SEQUENCE` would leave the grouping reading a shape nothing
 * names — which is how the run quietly stops being a run the next time a page is added.
 *
 * **"Towards a Dark Factory" is here and stays here.** It left for one pass, on the
 * hand-off's decision 3, and the author asked for it back: a reader who has been through
 * the specification is exactly the reader who then asks which work belongs to an agent at
 * all, and that question is what the second run is for. The landing keeps its own link to
 * it under the two doors — a page can be reached twice.
 *
 * `LEARN_PRACTICE` stays a constant rather than being inlined: it is what the second run
 * IS, and the rail's grouping reads it.
 */
export const LEARN_PRACTICE: readonly SpecPage[] = [
  {
    href: "/towards-a-dark-factory",
    step: "04",
    run: "practice",
    nav: "Towards a Dark Factory",
    eyebrow: "Four levels",
    title: "Towards a Dark Factory",
    question: "Decide which work can run unattended inside a deliberate harness.",
    /* Empty until 2026-08-11, on the reading that this page is one argument with no headed
       sections to jump between. Two of the three below were already headed and simply had
       no id: the sources block carries an `h3`, and the cyan panel carries doc 2 §1's hook,
       the loudest sentence on the page and the one a reader comes back for. A section a
       reader can see and cannot address is not an unsectioned page, it is an unaddressable
       one, and this is the only stop in either run whose rail row went nowhere.

       Still no `PageContents` panel. The rail's indented list is the whole deliverable and
       this page never had a panel; adding one would put a second table of contents above
       the fold of the one page in the sequence that reads as a single argument. */
    sections: [
      { id: "levels", label: "The ladder" },
      { id: "the-gap", label: "The gap" },
      { id: "sources", label: "Where this framing comes from" },
    ],
  },
  /* Two practice stops after the essay: the index of what the surfaces do, then the
     walkthrough that uses them. Both left the AI Tools menu because a reader consults them
     while learning, and Learn is where the chrome puts what a reader consults. */
  {
    href: "/capabilities",
    step: "05",
    run: "practice",
    nav: "What you can do",
    eyebrow: "Reference",
    title: "What you can do",
    question:
      "Every operation, from the site, a terminal or your agent, and whether it works today.",
    sections: [
      { id: "intent-title", label: "By intent" },
      { id: "cli", label: "Command line" },
      { id: "mcp", label: "MCP" },
      { id: "skill", label: "The blueprint-writing skill" },
    ],
  },
  {
    href: "/tutorial",
    step: "06",
    run: "practice",
    nav: "Write your first blueprint",
    eyebrow: "Tutorial",
    title: "Write your first blueprint",
    question:
      "Make one: the blueprint-writing skill interviews you and the graph draws itself as you answer.",
    sections: [],
  },
];

/**
 * The reading order: the door, the crosswalk, then the layers in resolution order.
 *
 * A fifth stop stood here, `SPEC_SCORING` at `/spec/scoring`, for how the engine grades
 * what the three layers describe. The IA pass took it out of the sequence and off the
 * route tree together: the author asked the grading door off the spec index, and a page
 * that stays a numbered spec stop while its parent index has been deleted is the same
 * instruction refused twice. Its content merged into `/reading-the-radar`.
 *
 * That page is gone as well since 2026-09-04, on the author's instruction, and grading no
 * longer has a stop of its own anywhere in Learn. Both old paths 308'd onto `/build` until
 * the owner deleted that route on 2026-09-06, and `next.config.ts` repointed both onto
 * `/what-a-blueprint-is` rather than chaining them through a third redirect.
 *
 * The sequence is five stops: the door, the Attractor crosswalk, the two layer pages, the
 * essay. It was six until the vocabulary's stop folded into `/spec/card` on 2026-09-06, and
 * seven before the worked example at `/build` went with its route.
 *
 * `SPEC_CROSSWALK` is spread in by name rather than folded into `SPEC_LAYERS`, and it now
 * stands BEFORE it. Two reasons, and only the second one is new. The doors on
 * `/what-a-blueprint-is` are read off `SPEC_LAYERS`, and the crosswalk is not a layer: it
 * names no file a reader writes. And the mapping is what a reader who already knows
 * Attractor needs before they meet a DOT with `card=` in it, which is the whole of the
 * 2026-09-06 reordering recorded at the top of this file.
 */
export const SPEC_SEQUENCE: readonly SpecPage[] = [
  SPEC_OVERVIEW,
  SPEC_CROSSWALK,
  ...SPEC_LAYERS,
  ...LEARN_PRACTICE,
];

/**
 * Where a stop sits inside its own run, counting only the numbered ones.
 *
 * The rail's meta line reads "Specification · 3 of 4", which is the question a reader who
 * came for DOT syntax is actually asking: how much of THIS is left. The sandbox is excluded
 * from both halves, because a stop with no number is not one of four.
 *
 * Returns `undefined` for the sandbox itself: it has no position to print, and the rail
 * falls back to naming the run alone.
 */
export function runPosition(
  href: string,
): { run: SpecRun; position: number; total: number } | undefined {
  const page = SPEC_SEQUENCE.find((entry) => entry.href === href);
  if (page === undefined || page.step === undefined) return undefined;
  const numbered = SPEC_SEQUENCE.filter(
    (entry) => entry.run === page.run && entry.step !== undefined,
  );
  return {
    run: page.run,
    position: numbered.indexOf(page) + 1,
    total: numbered.length,
  };
}

/** Where a page sits in the sequence, and what stands on either side of it. */
export interface SpecNeighbours {
  page: SpecPage;
  /** One-based position, for "2 of 4". */
  position: number;
  total: number;
  previous?: SpecPage;
  next?: SpecPage;
}

/**
 * The page at `href` and its neighbours.
 *
 * Throws on an unknown route rather than returning `undefined`. A pager is rendered by a
 * page that knows its own path, so an argument the list does not carry is a typo in a
 * route that would otherwise ship as a footer with both arrows missing, and a build that
 * stops is how that gets noticed.
 */
export function specNeighbours(href: string): SpecNeighbours {
  const at = SPEC_SEQUENCE.findIndex((page) => page.href === href);
  if (at === -1) throw new Error(`\`${href}\` is not part of the Learn sequence`);
  return {
    page: SPEC_SEQUENCE[at],
    position: at + 1,
    total: SPEC_SEQUENCE.length,
    previous: at > 0 ? SPEC_SEQUENCE[at - 1] : undefined,
    next: at < SPEC_SEQUENCE.length - 1 ? SPEC_SEQUENCE[at + 1] : undefined,
  };
}
