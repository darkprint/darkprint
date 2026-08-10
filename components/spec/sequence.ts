/* ============================================================
   The seven Learn routes, as one ordered list.

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
   document a blueprint is written in. `SPEC_SEQUENCE` is back to
   four, and `spec-routes.test.ts` walks `app/spec` to make sure a
   fifth child never reappears without an entry here.

   So this file owns the order, the labels and the one-line question
   each page answers, and every surface reads it: the three doors on
   `/what-a-blueprint-is`, each child's crumb, and the previous/next
   pager at the foot of all four.

   Plain TypeScript, no JSX and no React, so `spec-routes.test.ts`
   can import it under `environment: "node"` and hold the pages on
   disk against it.

   Nothing dynamic lives here. The ontology door prints a live term
   count, and that number is read off the engine on the page that
   renders it rather than frozen into this list, which is the same
   rule the rest of the site follows about figures it quotes.
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

/** What every page in the sequence carries. */
export interface SpecPage {
  /** The route. Also the identity of the entry. */
  href: string;
  /** Two digits, shown in the crumb and on the door. */
  step: string;
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
   * term discs on the layer pages, the governance layers on `/ontology`), so a reader
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
 * overview answers it in one line and hands the reader three doors.
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
  nav: "What a blueprint is",
  eyebrow: "What a blueprint is",
  title: "What a blueprint is",
  question: "What a blueprint is for, and the three files one is written in.",
  sections: [
    { id: "bundle", label: "The bundle" },
    { id: "parts", label: "The three parts" },
    { id: "run", label: "What surrounds a run" },
  ],
};

/**
 * The three layers, in the order a reader resolves them: graph, card, vocabulary.
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
 */
export const SPEC_LAYERS: readonly SpecLayerPage[] = [
  {
    href: "/spec/topology",
    step: "01",
    nav: "Topology",
    eyebrow: "Layer 01 of 03",
    title: "The blueprint file (DOT)",
    question: "Which nodes exist, and what flows between them.",
    sections: [
      { id: "dot-file-heading", label: "The DOT file" },
      { id: "dot-checks-heading", label: "Validator checks" },
    ],
    format: "DOT",
    file: "blueprint.dot",
    source: "lib/core/dot/ · lib/core/attractor/",
    color: "var(--color-blueprint-line)",
    anchor: "topology",
  },
  {
    href: "/spec/card",
    step: "02",
    nav: "Node card",
    eyebrow: "Layer 02 of 03",
    title: "The node card (YAML)",
    question: "What one node is, in enough detail to instantiate it.",
    sections: [
      { id: "card-reach", label: "Reach and limits" },
      { id: "node-card", label: "A real card, annotated" },
      { id: "fields-heading", label: "Field reference" },
    ],
    format: "YAML, JSON accepted",
    file: "cards/id@version.yaml",
    source: "lib/core/card/schema.ts",
    color: "var(--color-copper-line)",
    anchor: "card",
  },
  {
    href: "/spec/ontology",
    step: "03",
    nav: "Ontology",
    eyebrow: "Layer 03 of 03",
    title: "Ontology",
    question: "Which identifiers the first two are allowed to use.",
    sections: [
      { id: "vocabulary-heading", label: "Core vocabulary" },
      { id: "phases", label: "Term catalog" },
      { id: "overlay-heading", label: "Local overlay" },
      { id: "ontology-checks-heading", label: "Validator checks" },
    ],
    format: "a versioned term list",
    file: "ontology/extensions.yaml",
    source: "lib/core/ontology/",
    color: "var(--color-emerald)",
    anchor: "ontology",
  },
];

/** The three application pages that follow the file-format reference. */
export const LEARN_PRACTICE: readonly SpecPage[] = [
  /**
   * The sandbox, and it used to be half of a page called "Create".
   *
   * `/build` carried two things: `CreateEntry`, which installs the authoring skill and
   * writes you a brief, and `BuildWorkspace`, which lets you turn three dials on one
   * five-node graph and watch the reading move. The author asked them apart: "split the
   * page /build into two pages. One containing the skill part and listed on the navbar and
   * the `Customize the starter blueprint` move only among the Learn pages."
   *
   * So the skill half went to `/skill`, which was already the page about the skill and was
   * reachable from the footer alone, and it took the navbar's "Create" with it. What is left
   * here is the worked example, and it is renamed to what it is. Two things follow from
   * that and both are load-bearing:
   *
   * 1. The label had to change. `components/site/nav.test.ts` forbids one label on two
   *    routes, and "Create" now belongs to `/skill`. Calling this "Create" as well would be
   *    two names for two pages that a reader would read as one.
   * 2. `title` matches `nav` matches the `h2` the section already carried, per this site's
   *    "one route, one name" doctrine: the words on the rail are the words at the top of
   *    what loads.
   *
   * It stays at `/build` and stays step 04. Moving the path would have broken every inbound
   * link for a rename, and the sequence position is about where the sandbox sits in the
   * reading order, which the split did not change.
   */
  {
    href: "/build",
    step: "04",
    nav: "Customize the starter blueprint",
    eyebrow: "Optional worked example",
    title: "Customize the starter blueprint",
    question: "Turn three dials on one worked graph and watch every reading move with them.",
    sections: [{ id: "workspace-heading", label: "Blueprint workspace" }],
  },
  {
    href: "/reading-the-radar",
    step: "05",
    nav: "How a blueprint is graded",
    eyebrow: "The scorecard",
    title: "How a blueprint is graded",
    question: "Read each score by its source and inspect the shipped weights.",
    sections: [
      { id: "scorecard", label: "The scorecard" },
      { id: "the-notes", label: "How to read it" },
      { id: "auto-heading", label: "Where scores come from" },
      { id: "weights", label: "Weights and penalties" },
    ],
  },
  {
    href: "/towards-a-dark-factory",
    step: "06",
    nav: "Towards a Dark Factory",
    eyebrow: "The route",
    title: "Towards a Dark Factory",
    question: "Decide which work can run unattended inside a deliberate harness.",
    /* Empty on purpose, and it is the reason `sections` is required rather than optional.
       This page is one argument from the ladder to the two sources under it, with no headed
       sections to jump between and no `PageContents` panel to move: it never had one. The
       rail gives it a row and no children, which is what a reader should see. */
    sections: [],
  },
];

/**
 * The reading order: the door, then the three layers in the order a reader resolves them.
 *
 * A fifth stop stood here, `SPEC_SCORING` at `/spec/scoring`, for how the engine grades
 * what the three layers describe. The IA pass took it out of the sequence and off the
 * route tree together: the author asked the grading door off the spec index, and a page
 * that stays a numbered spec stop while its parent index has been deleted is the same
 * instruction refused twice. Its content merged into `/reading-the-radar`, which now
 * carries the picture and the arithmetic under the title every inline link on the site
 * already uses for it, and `next.config.ts` 308s the old path there.
 *
 * The gap that leaves is deliberate. Grading is a reading OF a blueprint, not a fourth
 * document one is written in, so it belongs beside the scorecard a reader met it on
 * rather than in a sequence about file formats.
 */
export const SPEC_SEQUENCE: readonly SpecPage[] = [
  SPEC_OVERVIEW,
  ...SPEC_LAYERS,
  ...LEARN_PRACTICE,
];

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
