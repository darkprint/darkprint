import Link from "next/link";

import { neighbours } from "./route";

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
   ============================================================ */

/* `route-box`, not `panel`: these two leave the page, and the author asked for the boxes
   that do to be visually distinct from the ones carrying a concept. `app/globals.css`
   records why the distinction is shape as well as hue. */
const CARD = "route-box group flex flex-1 flex-col gap-1.5 p-5";

/** The pager's own position line, which is not a link and stays quiet. */
const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.18em] text-dim";

export function RoutePager({ href }: { href: string }) {
  /* Position and count come out of the same lookup as the neighbours. This used to run
     its own `findIndex` beside `neighbours`, and both returned "not found" quietly: a page
     the route did not carry rendered "· 0 of 3" with no arrows. `neighbours` throws now,
     so a typo stops the build instead of shipping. */
  const { position, total, previous, next } = neighbours(href);

  return (
    <nav
      aria-label="Towards a Dark Factory"
      className="flex flex-col gap-4 border-t border-line pt-8"
    >
      <p className={EYEBROW}>
        Towards a Dark Factory · {position} of {total}
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        {previous !== undefined && (
          <Link href={previous.href} className={CARD}>
            <span className="route-label">
              <span aria-hidden>← </span>previous
            </span>
            <span className="font-display text-lg font-semibold leading-snug text-fg transition-colors group-hover:text-amber-bright">
              {previous.label}
            </span>
            <span className="text-sm leading-relaxed text-muted">{previous.blurb}</span>
          </Link>
        )}
        {next !== undefined && (
          <Link href={next.href} className={`${CARD} sm:text-right`}>
            <span className="route-label">
              next<span aria-hidden> →</span>
            </span>
            <span className="font-display text-lg font-semibold leading-snug text-fg transition-colors group-hover:text-amber-bright">
              {next.label}
            </span>
            <span className="text-sm leading-relaxed text-muted">{next.blurb}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
