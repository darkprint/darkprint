import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GridSpotlight } from "@/components/hero/GridSpotlight";

/* ============================================================
   What the server sends, which is the half a test can hold.

   The spotlight's subject is where the pointer is, so its interesting behaviour cannot be
   asserted here: `renderToStaticMarkup` produces a string, there is no pointer and no
   effect. What CAN be asserted is that the layer arrives inert — invisible, silent, and
   incapable of intercepting anything — because every one of those is a property a reader
   with no JavaScript, a reader on a touchscreen and a crawler all depend on, and every one
   of them fails silently if it breaks.

   The effect's own liveness is observable through `data-spotlight`, which it sets on attach
   and removes on cleanup. That attribute exists for exactly this reason: everything else
   the component does is invisible until a pointer moves, so "hydrated and listening" and
   "never ran" look identical in the DOM.
   ============================================================ */

const render = () => renderToStaticMarkup(createElement(GridSpotlight));

describe("GridSpotlight", () => {
  it("arrives invisible, inert and unnamed", () => {
    const html = render();
    expect(html).toContain("aria-hidden");
    expect(html).toContain("pointer-events-none");
    /* The one element on this site besides `Wordmark`'s trace overlay allowed to ship
       `opacity-0`, and for the same reason: a JS-only decorative layer whose resting state
       is invisible. A layer whose whole subject is the pointer has no honest position
       before there is one. */
    expect(html).toContain("opacity-0");
    // Not live until an effect says so, so the markup cannot claim to be listening.
    expect(html).not.toContain("data-spotlight");
  });

  it("reveals the grid rather than adding a light of its own", () => {
    const html = render();
    /* `tech-grid` is the section's own graticule drawn a second time. The alternative was a
       cyan radial under the cursor, and `components/ui/Button.tsx` rules against exactly
       that: a zero-offset coloured halo says the element is emitting light, which is
       decoration. This one reveals what is already drawn. */
    expect(html).toContain("tech-grid");
    expect(html).not.toMatch(/background(-image)?:[^"]*radial-gradient/);
  });

  it("masks to a circle at the pointer, with a centred fallback", () => {
    const html = render();
    // Both spellings, because Safari still wants the prefix for mask-image.
    expect(html).toMatch(/mask-image:radial-gradient\(circle \d+px at var\(--spot-x, ?50%\)/);
    expect(html).toContain("-webkit-mask-image");
  });
});
