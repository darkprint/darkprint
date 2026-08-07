import Link from "next/link";

import { cx } from "@/lib/format";

/* ============================================================
   Where a page that is not in a sequence sends its reader next.

   `app/globals.css` states the law in its own words: "every box
   whose job is to send a reader somewhere else wears this, and
   nothing else does." The two sequences honour it — `SpecPager`
   across the four stops of the spec sequence, `RoutePager` across
   the three of `/towards-a-dark-factory` — and both are pagers, so
   they only exist for a page with a neighbour.

   That left the standalone pages with nothing. Measured across the
   Learn section when this was written: `/concepts`,
   `/reading-the-radar`, `/what-a-blueprint-is`, `/build` and
   `/install` carried **zero** `.route-box` between them, and three
   of those are the pages a cold reader arrives on. The amber
   language existed and was unspent exactly where it was needed
   most.

   `/install` is no longer one of them. The author, 2026-08-07,
   naming this component's tail on `/build` and then this: "We found
   such buttons also in the install mcp page. in this page you can
   just delete them." So that premise above holds for `/build` and
   `/reading-the-radar` and no longer for `/install`, which now ends
   on its own paragraph with one inline link to `/blueprints` in it.
   That is a deliberate reversal of the case this file was written
   on, recorded here rather than left standing as a claim the site
   contradicts. Two mounts remain.

   ── Why these are signposts and not panels ──
   The author, same day: "In /build the buttons to the bottom should
   look like buttons for moving to the pages. Make the box smaller,
   avoid the subtitle and make the title more clear. As they look,
   they do not seem even buttons."

   They did not. Measured on `/build` at 1440 before this pass: a
   `grid sm:grid-cols-2` of `p-5` boxes at 568 x 121 px each — card
   geometry, a sentence of blurb inside, and a `.route-label` that
   read "Read next" identically on both, so the one slot whose job is
   to say where you are going carried zero information twice. The
   header's cyan "Upload blueprint" pill sat 700px up the same screen
   pointing at the same `/upload`: two visual languages for one link.

   The fix was already written in this repo. `SpecPager` and
   `RoutePager` were shrunk on 2026-08-07 to a content-hugging card —
   `route-box group inline-flex max-w-full flex-col gap-1.5 px-4 py-3
   sm:max-w-[19rem]`, a `.route-label` with an arrow in it, and a
   16px display title — and this now carries the same card, byte for
   byte, so a reader meets one shape for "this leaves the page"
   across all three surfaces. On `/build` that takes each box from
   568 x 121 to a content-width card capped at 304px.

   ── How this stays tellable apart from `ComingSoonBadge` ──
   This is the question a smaller amber box has to answer, because
   amber has exactly two jobs sitewide and the other one is that
   badge. `app/globals.css` says the two are told apart by SHAPE, not
   hue: "A pill states a status about the thing beside it. A bar with
   an arrow points away."

   Every part of that shape survives the shrink, and the shrink adds
   the one part this component was missing:
     · a 12px-radius RECTANGLE (`--radius-lg`), never `rounded-full`;
     · the 2px amber rule down the leading edge, which the badge has
       nowhere;
     · TWO stacked lines — a mono label over a display title — where
       the badge is one uppercase line of 11px mono;
     · an ARROW, which the badge never carries. This was the only
       `.route-box` on the site that did not point. It does now.
   The badge is `rounded-full px-2.5 py-1` and states a fact; this is
   a rectangle with a rule and an arrow and goes somewhere. Do not
   take it down to one line — that is where the two would converge,
   and `SpecPager`'s docblock names that as the failure mode.

   ── The label says where, not "read next" ──
   The eyebrow carries the destination's own path plus the arrow, so
   the two cards never again say the same word twice, and a reader
   knows which route they are about to be on before they take it. The
   title underneath is the destination's name as the nav and its own
   `h1` spell it — one route, one name.

   ── One card, three files ──
   The class string below is byte-identical to `CARD` in
   `components/howto/RoutePager.tsx` and to the inline string in
   `components/spec/SpecPager.tsx`. The right end state is one
   exported `RouteBoxLink` primitive consumed by all three, with each
   pager keeping its own neighbour lookup (their docblocks refuse to
   share a SEQUENCE, which is a different argument from sharing a
   card). That extraction is not made here because this pass owns
   this file and the two call sites below it and not the pagers;
   whoever opens a pager next should pull the string out to one
   place rather than write it a fourth time.

   Server component, no state, no props beyond the pair. Two
   destinations, not five: a page that ends by offering everything
   has not ended.
   ============================================================ */

/* Shared with both pagers. `max-w-[19rem]` is the cap they were sized at; the longest
   title this component carries ("What a blueprint is", "Browse the blueprints") fits on
   one line well inside it. `inline-flex` rather than a grid cell so the box hugs its
   content — a `sm:grid-cols-2` would stretch it straight back to half the measure, which
   is the panel geometry the author objected to. */
const CARD =
  "route-box group inline-flex max-w-full flex-col gap-1.5 px-4 py-3 sm:max-w-[19rem]";

export interface OnwardRoute {
  href: string;
  /** The label a reader clicks. Short: it sits inside a box, not in a sentence. */
  label: string;
  /**
   * @deprecated Not rendered since 2026-08-07. The author asked the subtitle off these
   * boxes — a sentence is what turns a control back into a callout. Kept optional only so
   * a call site that still passes one keeps compiling; drop it at the call site and this
   * field goes with the last of them.
   */
  blurb?: string;
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
      {/* `.label` rather than a hand-typed `font-mono text-[11px] uppercase tracking-
          [0.18em] text-dim`, which is the same four utilities spelled out and the exact
          drift the three mono tiers exist to stop. */}
      <p className="label">{label}</p>
      {/* A row of signposts, not a two-column grid: the boxes are content-sized now.
          `flex-wrap` because three of these would otherwise run off a narrow tablet. */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap">
        {routes.map((route) => (
          <Link key={route.href} href={route.href} className={CARD}>
            <span className="route-label">
              {route.href} <span aria-hidden>→</span>
            </span>
            {/* `hoverable:` gates the hover on `(hover: hover) and (pointer: fine)`: a tap
                on a phone has no "leave", so an ungated `group-hover` latches the amber on
                whichever exit was last touched. Same construction as both pagers. */}
            <span className="font-display text-base font-semibold leading-snug text-fg transition-colors hoverable:group-hover:text-amber-bright">
              {route.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
