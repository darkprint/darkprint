/* ============================================================
   The three pages of `/towards-a-dark-factory`, as one list.

   Redesign spec §4.2 renames `/how-to-build-a-dark-factory` and
   folds `/which-tasks` into it on the author's direct instruction:
   "/which-tasks should be placed in The climb part which I'd
   rename Towards a Dark Factory". Spec §3 sends the 1-5 ladder to
   the overview at the same time.

   Written once, here, because §4.2 also asks the three to carry
   next and previous links so they read as a sequence. A pager that
   took its neighbour's title as a prop would let two pages disagree
   about what the third one is called, which is the failure this
   file exists to make impossible: the sequence has one definition
   and every page reads its own position out of it.
   ============================================================ */

export interface RouteStop {
  href: string;
  /** The nav label. Short, because it appears inside a pager button. */
  label: string;
  /** What the page answers, for the pager's second line. */
  blurb: string;
}

/** In reading order. The overview first, because it is the one that locates the reader. */
export const CLIMB_ROUTE: readonly RouteStop[] = [
  {
    href: "/towards-a-dark-factory",
    label: "Where you are today",
    blurb: "The five levels, and the gap between 2 and 5.",
  },
  {
    href: "/towards-a-dark-factory/which-tasks",
    label: "Which tasks it can take",
    blurb: "Four questions, settled before you draw a node.",
  },
  {
    href: "/towards-a-dark-factory/the-climb",
    label: "The climb",
    blurb: "Four phases, holdout scenarios, and what it cost.",
  },
];

/**
 * Where `href` sits in the route, and the stop on either side of it.
 *
 * Throws on a path the route does not carry, exactly as `specNeighbours` does in
 * `components/spec/sequence.ts`, and for the reason written there: a pager is rendered by
 * a page that knows its own path, so an argument the list does not carry is a typo in a
 * route. It used to return `{}`, and the caller's own `findIndex` then returned -1, so a
 * mistyped or newly added page shipped a footer reading "Towards a Dark Factory · 0 of 3"
 * with both arrows missing and nothing anywhere reporting it. A build that stops is how
 * that gets noticed.
 *
 * `position` and `total` come back with the neighbours so the caller does not search the
 * list a second time and get a different answer from it.
 */
export function neighbours(href: string): {
  position: number;
  total: number;
  previous?: RouteStop;
  next?: RouteStop;
} {
  const at = CLIMB_ROUTE.findIndex((stop) => stop.href === href);
  if (at === -1) throw new Error(`\`${href}\` is not part of the Towards a Dark Factory route`);
  return {
    position: at + 1,
    total: CLIMB_ROUTE.length,
    previous: at > 0 ? CLIMB_ROUTE[at - 1] : undefined,
    next: at < CLIMB_ROUTE.length - 1 ? CLIMB_ROUTE[at + 1] : undefined,
  };
}
