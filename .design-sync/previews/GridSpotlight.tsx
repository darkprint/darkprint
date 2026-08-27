import { GridSpotlight } from "darkprint";

/**
 * Takes no props and paints nothing on its own: it is a pointer-tracked mask over the
 * hero's own `tech-grid` ground, mounted at `opacity-0` until a fine pointer moves across
 * the section (`components/hero/GridSpotlight.tsx`'s own header explains why — a resting
 * state that shows something would be a state no reader with no mouse, or a printer, or
 * this capture, ever actually sees). So the honest static render is the host section as
 * `Hero.tsx` mounts it, with the layer present and doing its real job of nothing yet.
 */
export const InTheHero = () => (
  <section className="tech-grid relative isolate min-h-[420px] overflow-hidden rounded-xl border border-line bg-void p-10">
    <GridSpotlight />
    <div className="relative flex flex-col gap-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">
        darkprint
      </p>
      <h2 className="font-display text-2xl font-semibold text-fg">
        Blueprints for dark factories
      </h2>
    </div>
  </section>
);

/**
 * What the mask draws, forced visible from outside the component (a CSS override scoped
 * to this cell, not a change to the component itself) so the radial cut is legible in a
 * capture that cannot move a pointer. The wrapper carries no `tech-grid` of its own, so
 * the only ruling on screen is the circle this layer actually cuts — `--spot-x`/`--spot-y`
 * default to the section's centre, which is exactly where this pins it.
 */
export const WhatItDraws = () => (
  <section className="force-spotlight-visible relative isolate min-h-[420px] overflow-hidden rounded-xl border border-line bg-void p-10">
    <style>{`.force-spotlight-visible [class*="tech-grid"][class*="opacity-0"] { opacity: 1 !important; }`}</style>
    <GridSpotlight />
    <div className="relative flex flex-col gap-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">
        darkprint
      </p>
      <h2 className="font-display text-2xl font-semibold text-fg">
        The second grid layer, lit
      </h2>
    </div>
  </section>
);
