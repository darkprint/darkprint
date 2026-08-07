import Link from "next/link";

import { neighbours } from "./route";

/* ============================================================
   Next and previous, across the two pages of §4.2.

   The spec asks for sub-routes with a pager rather than in-page
   accordions, for a reason the author gave in one sentence: the
   pages were too dense and readers skipped. A page that ends is a
   page somebody finishes, and the pager is what makes the next one
   findable without going back to the nav.

   A server component. It renders one or two links and reads its
   neighbours out of `route.ts`, so a page passes the one thing
   only it knows, which is where it is.

   ── The rail is gone, and that is doc 2 §1.1 work ──
   This drew `SpecPager`'s rail: an `<ol>` of every stop, numbered,
   under a line reading "TOWARDS A DARK FACTORY · 1 OF 3". It was
   copied here when the sequence had three stops and a reader
   leaving a long page could reasonably ask how far through they
   were.

   Two things killed it. The sequence has two stops now, and a
   progress track over two entries says nothing previous/next does
   not already say. And a numbered track is a ladder: this route is
   named "**Towards** a Dark Factory", it opens on a five-rung list,
   and §1.1 binds hardest here — a graph with a person standing in
   it is a first-class blueprint and never a rung somebody failed to
   climb. Three devices were telling the reader to ascend. The rail
   is the cheapest of the three to delete and it is deleted.

   `SpecPager` keeps its rail. Four stops, and its subject is a
   notation rather than a maturity scale, so neither reason applies
   there. The two components are deliberately NOT merged: they read
   their own sequence out of their own file, and one pager taking a
   sequence as a prop would be one more place for the two to
   disagree about a route — which is the failure `route.ts` and
   `sequence.ts` both exist to make impossible.

   Both pagers were full-width slabs until 2026-08-07, when the
   author asked for the opposite: "I don't like the extension of
   the orange box for moving through pages... Just keep the heading
   title removing the subtitle and reduce the horizontal size." So
   the `blurb` line is gone from both — from `route.ts` entirely
   here, since the two-door index that was its last reader went with
   the merge — and the cards hug their content.
   ============================================================ */

/* `route-box`, not `panel`: these leave the page, and the author asked for the boxes that
   do to be visually distinct from the ones carrying a concept. `app/globals.css` records
   why the distinction is shape as well as hue — and the shrink keeps every part of that
   shape: a 12px-radius rectangle, the 2px rule down the leading edge, and two stacked
   lines. `ComingSoonBadge` is a full-round pill of one line with no rule, so the two stay
   tellable apart by silhouette. A one-line version of this box would not be.

   These two cards are now the only amber on the whole route. `WhichTasksGlance` spent it
   on three arcs, a disc and a caption callout, and `WhichTasksChecks` on a top rule; both
   are recoloured, so the site's rule — amber means `ComingSoonBadge` or "this box leaves
   the page", and nothing else — holds here without exception.

   `max-w-[19rem]` is sized off the longest label in `CLIMB_ROUTE` ("Towards a Dark
   Factory"), which fits on one line inside it; the cap is shared with `SpecPager`, whose
   titles are longer and wrap to two. */
const CARD =
  "route-box group inline-flex max-w-full flex-col gap-1.5 px-4 py-3 sm:max-w-[19rem]";

export function RoutePager({ href }: { href: string }) {
  /* `neighbours` throws on a path the route does not carry, so a typo stops the build
     instead of shipping a pager with both arrows missing. This used to run its own
     `findIndex` beside it to draw a count, and both returned "not found" quietly. */
  const { previous, next } = neighbours(href);

  return (
    <nav
      aria-label="Towards a Dark Factory"
      className="flex flex-col items-start gap-4 border-t border-line pt-8 sm:flex-row"
    >
      {previous !== undefined && (
        <Link href={previous.href} rel="prev" className={CARD}>
          <span className="route-label">
            <span aria-hidden>← </span>previous
          </span>
          {/* `hoverable:` gates the hover on `(hover: hover) and (pointer: fine)`: a tap
              on a phone has no "leave", so an ungated `group-hover` latches the amber on
              whichever exit was last touched. */}
          <span className="font-display text-base font-semibold leading-snug text-fg transition-colors hoverable:group-hover:text-amber-bright">
            {previous.label}
          </span>
        </Link>
      )}
      {next !== undefined && (
        <Link href={next.href} rel="next" className={`${CARD} sm:ms-auto sm:text-right`}>
          <span className="route-label">
            next<span aria-hidden> →</span>
          </span>
          <span className="font-display text-base font-semibold leading-snug text-fg transition-colors hoverable:group-hover:text-amber-bright">
            {next.label}
          </span>
        </Link>
      )}
    </nav>
  );
}
