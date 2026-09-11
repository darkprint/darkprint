import { Eyebrow } from "darkprint";

/**
 * The site's one small-caps label tier for a page or a full-bleed band. Always followed by
 * an `h1`/`h2` in the real callers (`app/new/page.tsx`, `app/upload/page.tsx`); the plain
 * sibling line below is that heading, reproduced as ordinary markup rather than through
 * `SectionHeading` (a different assignment) so the eyebrow is seen the way a reader meets
 * it — a word above a title, not floating alone.
 */
export const OverAPageTitle = () => (
  <div className="flex flex-col gap-2">
    <Eyebrow>New</Eyebrow>
    <h1 className="font-display text-3xl font-semibold text-fg">Start a blueprint</h1>
  </div>
);

/** Mid-page, ahead of a form section rather than a route's own `h1` — `app/upload/page.tsx`'s validation step. */
export const OverASection = () => (
  <div className="flex flex-col gap-2">
    <Eyebrow className="mt-5">Validate before release</Eyebrow>
    <p className="text-sm text-muted">Every check in doc 3 runs against the folder before it can publish.</p>
  </div>
);
