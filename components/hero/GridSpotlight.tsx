"use client";

import { useEffect, useRef } from "react";

/* ============================================================
   The graph paper lights up under the pointer.

   A second copy of the section's own `tech-grid`, masked to a circle that follows the
   cursor. Where the pointer is, the two layers add and the ruling roughly doubles; a few
   hundred pixels away the mask has fallen to nothing and the background is exactly what it
   was. Nothing else about the hero moves.

   ── Why a second grid rather than a glow ──
   A radial wash of cyan under the cursor would be a light source, and `components/ui/
   Button.tsx` already rules on that: a zero-offset coloured halo "says this element is
   emitting light, which is decoration". This is not emitting anything. It reveals what is
   already drawn, which is the register the whole site is in — the grid is the one part of
   the old visual language the author kept, and brightening it is the honest way to make it
   respond.

   ── What it costs when it does not run ──
   Nothing. The layer starts at `opacity: 0` and is `aria-hidden` and `pointer-events-none`,
   so the server render, a reader with no JavaScript and a reader on a touchscreen all get
   the hero exactly as it was. This is the second element on the site allowed to ship
   `opacity-0` in its markup, and for the same reason as the first: `Wordmark`'s trace
   overlay is a JS-only decorative layer whose resting state is invisible. A layer whose
   whole subject is where the pointer is has no honest resting position before there is one.

   ── Fine pointers only ──
   `(hover: hover) and (pointer: fine)` is the JS spelling of the `hoverable:` variant this
   codebase gates every hover affordance behind. On a touchscreen `pointermove` fires on
   drag, which would leave a bright patch wherever the reader last scrolled and no way to
   move it — a highlight that cannot follow anything is a smudge.

   ── Why the position is a CSS variable and not React state ──
   A `setState` per pointer event re-renders the tree on every mouse move. The position is
   presentation, so it goes straight onto the element as two custom properties, written
   inside one `requestAnimationFrame` so a burst of events costs one paint.
   ============================================================ */

/** How far the highlight reaches. Two major rules of the 48px grid, so it reads as a patch
    of paper rather than as a dot or as a wash over the whole column. */
const RADIUS = 260;

export function GridSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = ref.current;
    const section = layer?.parentElement;
    if (layer === null || section === undefined || section === null) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    /* Written straight from the handler, with no `requestAnimationFrame` in between.
       ------------------------------------------------------------
       There was one, on the usual reasoning that a pointer fires faster than the screen
       refreshes. It does not, here: the browser already coalesces `pointermove` to one
       event per frame unless a listener asks for the backlog with `getCoalescedEvents`,
       which this one does not. So the throttle was scheduling a frame to do work that was
       already once per frame, and it carried a pending-frame flag that stays set if a
       callback never runs — a background tab throttles `rAF` to nothing, and one dropped
       callback would have left the flag high and swallowed every later move for the life of
       the page. Two custom properties are a style write, not a layout read; the read above
       them is one `getBoundingClientRect` on an element whose box does not change. */
    const onMove = (event: PointerEvent) => {
      const box = section.getBoundingClientRect();
      layer.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
      layer.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
      layer.style.opacity = "1";
    };

    /* The fade out is the element's own transition, so leaving is as cheap as arriving and
       the layer does not have to be told where the pointer went. */
    const onLeave = () => {
      layer.style.opacity = "0";
    };

    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    /* Says the layer is live, and it is the only way to tell from outside. Everything else
       this component does is invisible until a pointer moves, so "hydrated and listening"
       and "never ran" look identical in the DOM — which is exactly the state a decorative
       effect fails silently into. */
    layer.dataset.spotlight = "live";
    return () => {
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      delete layer.dataset.spotlight;
      layer.style.opacity = "0";
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="tech-grid pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out"
      style={{
        /* The mask is on `--spot-x/y`, which the effect writes. Before the first move they
           are unset and the fallback puts the circle at the section's centre — where the
           layer is invisible anyway, so a reader never sees the default, and a browser that
           refuses the custom property gets a circle rather than a full-strength second grid
           over the whole hero. */
        maskImage: `radial-gradient(circle ${RADIUS}px at var(--spot-x, 50%) var(--spot-y, 50%), black, transparent 70%)`,
        WebkitMaskImage: `radial-gradient(circle ${RADIUS}px at var(--spot-x, 50%) var(--spot-y, 50%), black, transparent 70%)`,
      }}
    />
  );
}
