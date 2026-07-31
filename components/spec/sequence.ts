/* ============================================================
   The five spec routes, as one ordered list.

   Redesign spec §4.1 splits `/spec` into an overview and three
   layer pages, and asks that they "read as a sequence". A sequence
   needs somewhere to say what comes after what, and the choice is
   between four pages each naming their own neighbours and one list
   they all derive from. The list wins for the reason the split was
   made at all: the author left the single page because it was long,
   and four pages whose pagers disagree about the order is a worse
   failure than the length was.

   The lifecycle-scoring pass adds a fifth stop, `SPEC_SCORING`, for
   how the engine grades what the first three describe. It is not a
   fourth layer — `SPEC_LAYERS` stays the three it always was — so it
   is appended to `SPEC_SEQUENCE` rather than folded in among them.

   So this file owns the order, the labels and the one-line question
   each page answers, and every surface reads it: the overview's
   three doors and its scoring callout, each child's crumb, and the
   previous/next pager at the foot of all five.

   Plain TypeScript, no JSX and no React, so `spec-routes.test.ts`
   can import it under `environment: "node"` and hold the pages on
   disk against it.

   Nothing dynamic lives here. The ontology door prints a live term
   count, and that number is read off the engine on the page that
   renders it rather than frozen into this list, which is the same
   rule the rest of the site follows about figures it quotes.
   ============================================================ */

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
  /** The one line the page answers, shown on the door and under the pager arrow. */
  question: string;
}

/** A layer page, which additionally names a file and the engine code that reads it. */
export interface SpecLayerPage extends SpecPage {
  /** The format, as the chip on the door reads it. */
  format: string;
  /** Where the file sits inside a bundle. */
  file: string;
  /** Which part of the engine reads it. */
  source: string;
  /** The door's chip colour, as a variable in `app/globals.css`. */
  color: string;
  /**
   * The in-page id this layer had while `/spec` was one page.
   *
   * The split turned `/spec#card`, `/spec#topology` and `/spec#ontology` into three
   * dead fragments: a fragment never reaches the server, so no redirect can carry one
   * onto the child route it became. Putting the old id back on the door means an
   * external link or a bookmark lands on the paragraph about that layer, one click from
   * the page it moved to, rather than silently at the top of `/spec`.
   */
  anchor: string;
}

/**
 * The entry point, and the one page that answers the author's original question.
 *
 * Their words: "probably we need a page reporting in details what is the documentation,
 * ie the spec language we use in darkprint. Probably it is the ontology, right?" The
 * overview answers it in one line and hands the reader three doors.
 */
export const SPEC_OVERVIEW: SpecPage = {
  href: "/spec",
  step: "00",
  nav: "Overview",
  eyebrow: "The documentation",
  title: "The spec language",
  question: "What a blueprint is written in, and which parts the engine checks.",
};

/** The three layers, in the order a reader resolves them: graph, card, vocabulary. */
export const SPEC_LAYERS: readonly SpecLayerPage[] = [
  {
    href: "/spec/topology",
    step: "01",
    nav: "Topology",
    eyebrow: "Layer 01 of 03",
    title: "The topology, in DOT",
    question: "Which nodes exist, and what flows between them.",
    format: "DOT",
    file: "blueprint.dot",
    source: "lib/core/dot/ · lib/core/attractor/",
    color: "var(--color-cyan)",
    anchor: "topology",
  },
  {
    href: "/spec/card",
    step: "02",
    nav: "Node card",
    eyebrow: "Layer 02 of 03",
    title: "The node card, in YAML",
    question: "What one node is, in enough detail to instantiate it.",
    format: "YAML, JSON accepted",
    file: "cards/id@version.yaml",
    source: "lib/core/card/schema.ts",
    color: "var(--color-amber)",
    anchor: "card",
  },
  {
    href: "/spec/ontology",
    step: "03",
    nav: "Ontology",
    eyebrow: "Layer 03 of 03",
    title: "The ontology, the vocabulary both draw from",
    question: "Which identifiers the first two are allowed to use.",
    format: "a versioned term list",
    file: "ontology/extensions.yaml",
    source: "lib/core/ontology/",
    color: "var(--color-emerald)",
    anchor: "ontology",
  },
];

/**
 * How the engine grades what the three layers describe.
 *
 * A plain `SpecPage`, not a `SpecLayerPage`: it names no `format`, no `file` inside a
 * bundle and no engine `source`, because it is not a fourth document a blueprint is
 * written in. `SPEC_LAYERS` stays length three and the site's "three layers" copy stays
 * true; this is a different kind of page, added after the layers rather than folded among
 * them. Lifecycle-scoring spec §4.2.
 *
 * `title` reuses the exact phrase every inline link to this content already uses,
 * "How a blueprint is graded" (`components/blueprint/Explainability.tsx`'s link text and
 * `components/home/SectionExample.tsx`'s), so the text a reader clicks and the heading
 * they land on are the same words.
 */
export const SPEC_SCORING: SpecPage = {
  href: "/spec/scoring",
  step: "04",
  nav: "Scoring",
  eyebrow: "The six radar axes",
  title: "How a blueprint is graded",
  question: "How the six radar axes are read, and which four are seeded.",
};

/** The reading order, overview first, scoring last. */
export const SPEC_SEQUENCE: readonly SpecPage[] = [
  SPEC_OVERVIEW,
  ...SPEC_LAYERS,
  SPEC_SCORING,
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
  if (at === -1) throw new Error(`\`${href}\` is not part of the spec sequence`);
  return {
    page: SPEC_SEQUENCE[at],
    position: at + 1,
    total: SPEC_SEQUENCE.length,
    previous: at > 0 ? SPEC_SEQUENCE[at - 1] : undefined,
    next: at < SPEC_SEQUENCE.length - 1 ? SPEC_SEQUENCE[at + 1] : undefined,
  };
}
