"use client";

/* ============================================================
   The download, as a folder you can open.

   The author asked for reactbits.dev's `Folder` on beat 4's Download panel, with the
   three files appearing on hover. This is that component, ported rather than pasted, and
   the three things that changed are the three that would otherwise have broken rules this
   site already holds.

   ── 1. It opens on hover, not on click ──
   The original toggles `open` in `onClick` and gives hover a smaller gesture: the lid
   skews and the papers peek up. The author asked for the file names on mouse over, so the
   open state is driven by pointer enter/leave.

   A hover-only disclosure would be a figure only a mouse user can read, which is the
   defect `components/home/beats.test.ts` names in the site's own words. So it opens on
   focus too, and it keeps a click toggle for touch, where there is no hover at all.

   The three names are REAL TEXT AT FULL OPACITY at every moment. The first draft faded
   them with `opacity-0` when shut and that beat's own guard caught it: nothing on the
   landing may ship `opacity-0`, because the static phase covers the server, a reader with
   JS off and a reader who asked for reduced motion, and a name hidden by opacity is
   invisible to all three. The fix was in the original all along — the papers stack BEHIND
   the two front flaps, so a shut folder covers its contents by z-order and needs no
   opacity at all.

   ── 2. No hex, and no `darkenColor` ──
   The original computes three paper shades and a folder back from a hex string. This site
   paints from CSS variables — `components/viz/flow.test.ts` fails on a hex literal in a
   scene, and the reason generalises: a colour computed in JS cannot participate in the
   token system, so it drifts the day a token moves. The folder is `--color-blueprint-line`
   over `--color-blueprint`, which is the cyanotype register every artefact box on this
   page already uses, and the papers are the sheet's own surfaces.

   ── 3. The papers carry the real folder ──
   `beats.test.ts` holds this panel to naming `blueprint.dot`, `cards/`, `README.md` and
   `AGENTS.md`, because the landing may not draw a folder shape that is not the shape that
   downloads. Three papers, four names: the two documents share the third, which is how the
   listing this replaces already grouped them.
   ============================================================ */

import { useState } from "react";

import { cx } from "@/lib/format";

/** What is in the folder, in the order the registry stores it. */
const PAPERS = ["blueprint.dot", "cards/*.yaml", "README.md · AGENTS.md"] as const;

/**
 * Where each paper goes when the folder is open.
 *
 * The original's shape — fanned left, right and up — opened wider, and the reason is that
 * the original's papers are BLANK. Overlap costs nothing when there is nothing to read;
 * at the original's offsets the middle paper covered the ends of the other two and the
 * drawing said `bluepri…` and `…s/*.yaml`. These three clear each other: the outer pair
 * sit further out and less rotated, and the third goes straight up rather than across.
 *
 * Written as classes rather than inline styles so the closed state can be a plain
 * translate and the transition has one property to animate rather than a string swap.
 */
const OPEN_AT = [
  "-translate-x-[142%] -translate-y-[42%] -rotate-[10deg]",
  "translate-x-[42%] -translate-y-[42%] rotate-[10deg]",
  "-translate-x-1/2 -translate-y-[124%] rotate-0",
] as const;

export function Folder({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cx("flex items-end justify-center pb-6 pt-14", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label="What is in the folder"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((was) => !was)}
        className={cx(
          /* `transition-transform` and not a hand-written list: Tailwind v4 expands the
             shorthand to `transform, translate, scale, rotate`, and an explicit list naming
             only `transform` silently drops the last three. `components/ui/Button.tsx`
             records the same trap at length. */
          "group relative block rounded-md transition-transform duration-200 ease-out",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan",
          open ? "-translate-y-2" : "hoverable:hover:-translate-y-1",
        )}
      >
        {/* The back of the folder, and its tab. */}
        <span
          aria-hidden
          className="relative block h-[76px] w-[104px] rounded-[2px_8px_8px_8px] bg-blueprint-line/30"
        >
          <span className="absolute bottom-[97%] left-0 block h-[9px] w-[34px] rounded-t-[4px] bg-blueprint-line/30" />
        </span>

        {/* The three papers. Real text at full opacity always; only transform moves. */}
        <span className="pointer-events-none absolute inset-0 block">
          {PAPERS.map((name, i) => (
            <span
              key={name}
              className={cx(
                "absolute bottom-[8%] left-1/2 z-20 flex items-center justify-center rounded-[6px] border px-1.5 text-center font-mono text-[9px] leading-tight",
                "border-blueprint-line/40 bg-blueprint-ink/95 text-blueprint",
                "transition-transform duration-300 ease-out",
                i === 0 && "h-[78%] w-[74%]",
                i === 1 && "h-[78%] w-[82%]",
                i === 2 && "h-[78%] w-[90%]",
                /* No `opacity-0` in the closed state, and this is the one rule that
                   shaped the component. `beats.test.ts` fails any beat whose markup ships
                   `opacity-0`, because `useReveal`'s static phase covers the server, a
                   reader with JS off and a reader who asked for reduced motion — and a
                   name hidden by opacity is invisible to all three.

                   The original does not need opacity either, and that is where the fix
                   came from: the papers sit at `z-20` and the two front flaps at `z-30`,
                   so a closed folder covers its own contents by stacking order. Open, the
                   papers translate clear of the flaps' box and the stacking stops
                   mattering. The three names are therefore full-opacity real text at every
                   moment, tucked inside a shut folder rather than faded out of one. */
                open ? OPEN_AT[i] : "-translate-x-1/2 translate-y-[10%]",
              )}
            >
              {name}
            </span>
          ))}
        </span>

        {/* The two front flaps, skewed apart on open. Drawn after the papers so they cover
            them when the folder is shut. */}
        {[15, -15].map((skew) => (
          <span
            key={skew}
            aria-hidden
            className={cx(
              "absolute inset-0 z-30 block origin-bottom rounded-[4px_8px_8px_8px] bg-blueprint-line/55",
              "transition-transform duration-300 ease-out",
              open && (skew === 15 ? "skew-x-[15deg] scale-y-[0.55]" : "-skew-x-[15deg] scale-y-[0.55]"),
            )}
          />
        ))}
      </button>
    </div>
  );
}
