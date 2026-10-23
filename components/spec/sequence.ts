/* ============================================================
   The Learn routes, grouped as a welcoming start and an optional
   reference, then kept in one ordered list for the rail and pager.

   Routes and their URLs stay stable. Grouping is presentational:
   public links, existing pages and the ordinary next/previous chain
   remain available.
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
 * Which of the two reader-facing Learn groups a stop belongs to.
 *
 * These labels distinguish the short authoring path from the optional reference pages.
 */
export type SpecRun = "specification" | "practice";

/** Reader-facing names for the two Learn groups. */
export const RUNS: Record<SpecRun, string> = {
  specification: "Start here",
  practice: "Reference",
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
 * The entry point for readers making or adapting a blueprint.
 *
 * It introduces the folder and points to a walkthrough. The reference pages remain close by
 * for readers who need a format, capability, or Attractor mapping.
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
  question: "What blueprints are, what you can reuse, and which files define one.",
  sections: [
    { id: "bundle", label: "The blueprint contents" },
    { id: "parts", label: "The three parts" },
    { id: "run", label: "What surrounds a run" },
  ],
};

/**
 * The reference page mapping a bundle to the file a runner takes.
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
 * It is a reference, not a required authoring step. The page maps DarkPrint fields to the
 * Attractor format for readers who plan to use that runner; the four reference pages remain
 * separate from the short Start here path.
 *
 * It is not a layer. A blueprint is three files and this page adds no format a reader has to
 * write; `SPEC_LAYERS` is where the layer pages are.
 *
 * `eyebrow` deliberately breaks the layers' "Layer 0n of 03" pattern. Reusing it would have
 * announced a fourth layer in the one word a reader scanning the header reads first.
 */
export const SPEC_CROSSWALK: SpecPage = {
  href: "/spec/attractor",
  step: "05",
  run: "practice",
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
 * The layer reference pages, in the order a reader resolves the files: graph, then card.
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
    run: "practice",
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
    run: "practice",
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
    /* One row per band, in page order. The curated ids a field may take sit under that
       field inside the reference, so the vocabulary has two ways in from the rail: the
       reference, and the whole set at the foot. `spec-routes.test.ts` holds this order
       against the page's render, because the rail draws whatever order this list is in
       and nothing else would notice a band moving. */
    sections: [
      { id: "card-reach", label: "Reach and limits" },
      { id: "node-card", label: "A real card, annotated" },
      { id: "fields-heading", label: "Field reference" },
      { id: "checks-heading", label: "What the validator checks" },
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

const TUTORIAL: SpecPage = {
  href: "/tutorial",
  step: "01",
  run: "specification",
  nav: "Write your first blueprint",
  eyebrow: "Tutorial",
  title: "Write your first blueprint",
  question: "Describe a task, reuse what fits, and adapt it into a blueprint.",
  sections: [
    { id: "install", label: "Install the DarkPrint skill" },
    { id: "open-live", label: "Open a live page" },
    { id: "design", label: "Describe the task" },
    { id: "enrich", label: "Enrich over MCP" },
    { id: "keep", label: "Keep it" },
  ],
};

const CAPABILITIES: SpecPage = {
  href: "/capabilities",
  step: "04",
  run: "practice",
  nav: "What you can do",
  eyebrow: "Reference",
  title: "What you can do",
  question: "Every operation, where it lives, and what it does.",
  sections: [
    { id: "intent-title", label: "By intent" },
    { id: "cli", label: "Command line" },
    { id: "mcp", label: "MCP" },
    { id: "skill", label: "The blueprint-writing skill" },
  ],
};

/** The short route for readers making or adapting a blueprint. */
export const LEARN_START: readonly SpecPage[] = [SPEC_OVERVIEW, TUTORIAL];

/** Format and capability references remain available without extending the start path. */
export const LEARN_REFERENCE: readonly SpecPage[] = [
  ...SPEC_LAYERS,
  CAPABILITIES,
  SPEC_CROSSWALK,
];

/** Preserve the former export for any existing code importing that page pair. */
export const LEARN_PRACTICE: readonly SpecPage[] = [CAPABILITIES, TUTORIAL];

/** One continuous pager chain, presented as a short start path followed by references. */
export const SPEC_SEQUENCE: readonly SpecPage[] = [
  ...LEARN_START,
  ...LEARN_REFERENCE,
];

/**
 * Where a stop sits inside its own run, counting only the numbered ones.
 *
 * The rail's meta line counts the numbered stops in Start here or Reference, rather than
 * counting across the whole sequence.
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
