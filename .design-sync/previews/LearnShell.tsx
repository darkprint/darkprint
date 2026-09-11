import { LearnShell } from "darkprint";

// LearnShell picks its rail off `usePathname()`, and a preview card is on no
// route, so at the default "/" it takes its "not a Learn route" branch and the
// SideRail it exists to draw never appears. The navigation shim reads this
// global per render, which puts the card on a real page from SPEC_SEQUENCE.
if (typeof window !== "undefined") window.__dsPathname = "/spec/card";

/**
 * The one call the app makes, in `app/layout.tsx`: every route is wrapped, and
 * only a Learn route grows the rail. The children below stand in for the page
 * body so the rail has something to sit beside.
 */
export const OnALearnRoute = () => (
  <LearnShell>
    <div className="px-8 py-10">
      <p className="eyebrow">Run 2 · the card</p>
      <h1 className="font-display text-3xl font-semibold text-fg">The node card, in YAML</h1>
      <p className="mt-3 text-muted">
        Every node in a graph resolves to one card: what it may reach, what it may never
        see, and the one line the engine checks it against.
      </p>
    </div>
  </LearnShell>
);
