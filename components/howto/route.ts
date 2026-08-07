/* ============================================================
   The two pages of `/towards-a-dark-factory`, as one list.

   Redesign spec §4.2 renamed `/how-to-build-a-dark-factory` and
   folded `/which-tasks` into the new parent on the author's direct
   instruction: "/which-tasks should be placed in The climb part
   which I'd rename Towards a Dark Factory". That fold made three
   routes out of two, and this pass finishes it by making them two.

   ── Why three became two (2026-08-07) ──
   The three stops asked two questions, not three. "Where am I, and
   is the work in front of me a candidate?" is read before anything
   is built; "what did it actually take?" is evidence, read once, by
   somebody already convinced. The old parent was neither: strip the
   ladder it imported and the risk section it had borrowed from stop
   3 and what was left was a three-sentence lead and an index of two
   links — a table of contents wearing a stop's clothes.

   So `/towards-a-dark-factory/which-tasks` stopped being a route
   and its parent became it. `next.config.ts` 308s the old path, and
   the old `/which-tasks` redirect now goes there in one hop rather
   than two.

   The count matters beyond tidiness. "Dark factory" is one shape a
   blueprint can take — the case where all five lifecycle phases run
   unattended — and the site's spine is blueprints and nodes. Three
   of nineteen routes, a header slot, a Learn entry AND a footer
   column of its own is a headline's footprint for a special case.
   Two routes and one Learn entry each is not.

   Written once, here, because §4.2 also asks the pages to carry
   next and previous links so they read as a sequence. A pager that
   took its neighbour's title as a prop would let two pages disagree
   about what the other one is called, which is the failure this
   file exists to make impossible: the sequence has one definition
   and every page reads its own position out of it.
   ============================================================ */

export interface RouteStop {
  href: string;
  /**
   * The nav label, and the page's own name.
   *
   * Short, because it appears inside a pager card. It is the `h1` of the page it points
   * at, character for character. It used to be "Where you are today" for the parent,
   * which was that page's fourth name — the header said "Towards a Dark Factory", the
   * `h1` said the same, the footer's own column said "Autonomy, and the levels", and
   * this said a third thing. The footer column is gone and so is the fourth name.
   *
   * `blurb` went with the two-door index at the foot of the parent, which was the only
   * thing that read it. With one other page in the sequence, an index of "the one other
   * page" is the pager.
   */
  label: string;
}

/** In reading order. The filter first, because it is the one that locates the reader. */
export const CLIMB_ROUTE: readonly RouteStop[] = [
  { href: "/towards-a-dark-factory", label: "Towards a Dark Factory" },
  { href: "/towards-a-dark-factory/the-climb", label: "The climb" },
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
 * `position` and `total` come back with the neighbours so a caller that wants to count
 * does not search the list a second time and get a different answer from it. `RoutePager`
 * no longer draws a count — see its header — but the two stay on the return type because
 * they are what makes "not found" impossible to read as "first".
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
