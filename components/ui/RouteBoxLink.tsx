import type { ReactNode } from "react";
import Link from "next/link";

import { cx } from "@/lib/format";

/* ============================================================
   One signpost, written once.
   ------------------------------------------------------------
   `app/globals.css` gives `.route-box` one job — "this box leaves the page" — and one of
   amber's two sanctioned spends sitewide. A primitive that carries a reserved colour has
   to have exactly one definition, and until this file existed it had four call sites and
   three copies of its class string:

     · `components/ui/OnwardRoutes.tsx`   (the standalone pages' tail)
     · `components/spec/SpecPager.tsx`    (the spec sequence's arrows)
     · `components/howto/RoutePager.tsx`  (the climb's arrows)
     · `components/build/BuildWorkspace.tsx` (the two theory exits above the workspace)

   The first three each spelled `route-box group inline-flex max-w-full flex-col gap-1.5
   px-4 py-3 sm:max-w-[19rem]` by hand, byte for byte, and `OnwardRoutes`' docblock said
   in as many words that the right end state was one primitive and that "whoever opens a
   pager next should pull the string out to one place rather than write it a fourth time."
   `BuildWorkspace` was the fourth. This is that extraction.

   What is NOT extracted is the sequence each pager walks. `SpecPager` and `RoutePager`
   both refuse to share a sequence — see their docblocks; one pager taking an order as a
   prop would be one more place for two files to disagree about a route — and that
   argument is about the ORDER, not about the card. Each keeps its own neighbour lookup
   and its own labels; only the shape is shared.

   ── The shape, and why every part of it is load-bearing ──
   Amber's other job is `ComingSoonBadge`, and `app/globals.css` states that the two are
   told apart by SHAPE rather than hue: "A pill states a status about the thing beside it.
   A bar with an arrow points away." So this card is, and must stay:

     · a 12px-radius RECTANGLE (`--radius-lg`), never `rounded-full`;
     · a 2px amber rule down the leading edge, which the badge has nowhere;
     · TWO stacked lines — a mono `.route-label` over a 16px display title — where the
       badge is a single uppercase line of 11px mono;
     · an ARROW in the label, which the badge never carries. Every call site passes one.

   Do not take this down to one line, and do not round it: that is where the two amber
   surfaces would converge, and both pagers' docblocks name it as the failure mode.

   `inline-flex` rather than a grid cell so the box hugs its content; a `grid-cols-2`
   around these stretches them straight back to half the measure, which is the panel
   geometry the author rejected on 2026-08-07 ("Make the box smaller, avoid the subtitle
   and make the title more clear. As they look, they do not seem even buttons.").
   `max-w-[19rem]` is the cap all four call sites were sized at — the longest title any of
   them carries, `SPEC_LAYERS`' "The ontology, the vocabulary both draw from", wraps to two
   lines well inside it.

   ── `hoverable:`, now on all four ──
   The hover brightening is gated on `(hover: hover) and (pointer: fine)`. A tap on a phone
   has no "leave", so an ungated `group-hover` latches the amber on whichever exit was last
   touched and leaves it looking selected. Three of the four call sites already gated it;
   `SpecPager` did not, while `OnwardRoutes` and `RoutePager` both claimed in their
   docblocks to be "the same construction as both pagers". Unifying here makes that claim
   true and costs one variant token on the one call site that was missing it — the single
   rendered difference this extraction introduces outside `/build`, recorded rather than
   preserved, because preserving it would mean shipping a primitive whose behaviour depends
   on which file constructed it.

   A server component: no state, no effects, and nothing here needs a client boundary.
   ============================================================ */

/* The card. One string, one place. Read the docblock above before changing a token of it —
   each one is answering `ComingSoonBadge`. */
const CARD =
  "route-box group inline-flex max-w-full flex-col gap-1.5 px-4 py-3 sm:max-w-[19rem]";

export function RouteBoxLink({
  href,
  label,
  title,
  rel,
  className,
}: {
  href: string;
  /**
   * The mono eyebrow. A node rather than a string because every call site puts an arrow
   * in it and the arrow is `aria-hidden` — a pager writes "Next →", `OnwardRoutes` writes
   * the destination's own path, and both need the glyph out of the accessible name.
   */
  label: ReactNode;
  /** The destination's name, as its own nav entry and `h1` spell it. One route, one name. */
  title: ReactNode;
  /** `next`/`prev` on a pager arrow; omitted everywhere else, where it would be a lie. */
  rel?: "next" | "prev";
  /** Positioning only — `sm:ms-auto sm:text-right` for the right-hand arrow of a pager. */
  className?: string;
}) {
  return (
    <Link href={href} rel={rel} className={cx(CARD, className)}>
      <span className="route-label">{label}</span>
      <span className="font-display text-base font-semibold leading-snug text-fg transition-colors hoverable:group-hover:text-amber-bright">
        {title}
      </span>
    </Link>
  );
}
