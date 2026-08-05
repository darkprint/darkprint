import Link from "next/link";

import { cx } from "@/lib/format";

/* ============================================================
   Where a page that is not in a sequence sends its reader next.

   `app/globals.css` states the law in its own words: "every box
   whose job is to send a reader somewhere else wears this, and
   nothing else does." The two sequences honour it — `SpecPager`
   across the five `/spec` stops, `RoutePager` across the three of
   `/towards-a-dark-factory` — and both are pagers, so they only
   exist for a page with a neighbour.

   That left the standalone pages with nothing. Measured across the
   Learn section: `/concepts`, `/reading-the-radar`,
   `/what-a-blueprint-is`, `/build` and `/install` carried **zero**
   `.route-box` between them, and three of those are the pages a
   cold reader arrives on. `/what-a-blueprint-is` has six panels
   whose entire job is to send the reader somewhere — `href` and
   `hrefLabel` are required props on each — and not one was
   signposted. The amber language existed and was unspent exactly
   where it was needed most.

   The pairing was one-way too. `/reading-the-radar` links across to
   `/spec/scoring` for the arithmetic and says so in its own header
   comment; `/spec/scoring` is last in its sequence, so its only
   tail box is `← Previous` and the return trip did not exist.

   Two destinations, not five: a page that ends by offering
   everything has not ended. Server component, no state, no props
   beyond the pair.
   ============================================================ */

export interface OnwardRoute {
  href: string;
  /** The label a reader clicks. Short: it sits inside a box, not in a sentence. */
  label: string;
  /** One line on why they would. */
  blurb: string;
}

export function OnwardRoutes({
  routes,
  label = "Where to next",
  className,
}: {
  routes: readonly OnwardRoute[];
  /** Names the region. Overridable so a page can say what the pair have in common. */
  label?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cx("flex flex-col gap-4 border-t border-line pt-8", className)}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">{label}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {routes.map((route) => (
          <Link key={route.href} href={route.href} className="route-box flex flex-col gap-1.5 p-5">
            <span className="route-label">Read next</span>
            <span className="font-display text-lg font-semibold text-fg">{route.label}</span>
            <span className="text-sm leading-relaxed text-muted">{route.blurb}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
