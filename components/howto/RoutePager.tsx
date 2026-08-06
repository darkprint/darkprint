import Link from "next/link";

import { CLIMB_ROUTE, neighbours } from "./route";

/* ============================================================
   Next and previous, across the three pages of §4.2.

   The spec asks for sub-routes with a pager rather than in-page
   accordions, for a reason the author gave in one sentence: the
   pages were too dense and readers skipped. A page that ends is a
   page somebody finishes, and the pager is what makes the next one
   findable without going back to the nav.

   A server component. It renders two links and reads its
   neighbours out of `route.ts`, so a page passes the one thing
   only it knows, which is where it is.

   ── The rail, and why it was worth copying ──
   `SpecPager` has drawn a five-stop rail with `aria-current` on the
   current stop since the spec pages were split; this drew "TOWARDS
   A DARK FACTORY · 1 OF 3" and two arrows and nothing else. Both
   sequences sit in the same Learn nav group, so a reader crossing
   from one to the other lost the ability to see the stops at all —
   a pager with two arrows says what is adjacent and never how far
   through you are, which is the question somebody who left a long
   page is actually asking. The rail is the same markup as
   `SpecPager`'s, pointed at `CLIMB_ROUTE`, numbering its stops the
   way the overview's two doors number theirs.

   The two components are deliberately NOT merged. They read their
   own sequence out of their own file, and one pager that took a
   sequence as a prop would be one more place for the two to
   disagree about a route — which is the failure `route.ts` and
   `sequence.ts` both exist to make impossible.

   Both pagers were full-width slabs until 2026-08-07, when the
   author asked for the opposite: "I don't like the extension of
   the orange box for moving through pages... Just keep the heading
   title removing the subtitle and reduce the horizontal size." So
   the `blurb` line is gone from both and the cards hug their
   content. The stretch that used to differ between them —
   `flex-1` here, `sm:col-start-2` there — is moot: neither fills a
   row now, and both push a lone NEXT to the end of the row rather
   than reserving space for an arrow that does not exist.
   ============================================================ */

/* `route-box`, not `panel`: these two leave the page, and the author asked for the boxes
   that do to be visually distinct from the ones carrying a concept. `app/globals.css`
   records why the distinction is shape as well as hue — and the shrink keeps every part
   of that shape: a 12px-radius rectangle, the 2px rule down the leading edge, and two
   stacked lines. `ComingSoonBadge` is a full-round pill of one line with no rule, so the
   two stay tellable apart by silhouette. A one-line version of this box would not be.

   `max-w-[19rem]` is sized off the longest label in `CLIMB_ROUTE` ("Which tasks it can
   take"), which fits on one line inside it; the cap is shared with `SpecPager`, whose
   titles are longer and wrap to two. */
const CARD =
  "route-box group inline-flex max-w-full flex-col gap-1.5 px-4 py-3 sm:max-w-[19rem]";

export function RoutePager({
  href,
  arrows = true,
}: {
  href: string;
  /**
   * Whether to draw the previous/next cards under the rail.
   *
   * `/towards-a-dark-factory` passes `false`. It is the parent of the sequence rather
   * than a stop inside it, and it already ends on a two-door index naming both children
   * in route order; the pager's NEXT card was the same amber door to the same
   * destination a second time, ~1100px below the first with a whole section wedged
   * between them. `.route-box` is a promise that a box leaves the page, and firing it
   * three times for two destinations is how a reader stops being able to tell a new door
   * from one they already read. The rail stays there: it is the only thing on that page
   * that shows all three stops at once.
   */
  arrows?: boolean;
}) {
  /* Position and count come out of the same lookup as the neighbours. This used to run
     its own `findIndex` beside `neighbours`, and both returned "not found" quietly: a page
     the route did not carry rendered "· 0 of 3" with no arrows. `neighbours` throws now,
     so a typo stops the build instead of shipping. */
  const { position, total, previous, next } = neighbours(href);

  return (
    <nav
      aria-label="Towards a Dark Factory"
      className="flex flex-col gap-5 border-t border-line pt-8"
    >
      {/* The sequence's name and the rail read as one title block, so they sit closer to
          each other than either does to the cards. The name is not in the rail: every
          entry there is a page title, and none of them says which sequence it belongs
          to. */}
      <div className="flex flex-col gap-2">
        <p className="label">
          Towards a Dark Factory · {position} of {total}
        </p>
        {/* `aria-current="page"` on this page's own entry, and it stays a `span` rather
            than a link to itself, which is a stop that goes nowhere. Same construction as
            `SpecPager`'s rail. */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px]">
          {CLIMB_ROUTE.map((stop, i) => {
            const step = String(i + 1).padStart(2, "0");
            return (
              <li key={stop.href} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden className="text-faint">
                    ·
                  </span>
                )}
                {stop.href === href ? (
                  <span aria-current="page" className="text-cyan">
                    {step} {stop.label}
                  </span>
                ) : (
                  <Link
                    href={stop.href}
                    className="text-dim transition-colors hoverable:hover:text-fg"
                  >
                    {step} {stop.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {arrows && (previous !== undefined || next !== undefined) && (
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          {previous !== undefined && (
            <Link href={previous.href} rel="prev" className={CARD}>
              <span className="route-label">
                <span aria-hidden>← </span>previous
              </span>
              {/* `hoverable:` gates the hover on `(hover: hover) and (pointer: fine)`:
                  a tap on a phone has no "leave", so an ungated `group-hover` latches
                  the amber on whichever exit was last touched. */}
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
        </div>
      )}
    </nav>
  );
}
