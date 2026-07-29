import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FavoriteStar } from "@/components/ui/FavoriteStar";

/**
 * `environment: "node"` (vitest.config.ts) has no `window` and no `localStorage`, which
 * is exactly the reader this suite can stand in for: the server, and the client's first
 * paint before its effects run. Real click-and-toggle behavior needs a DOM this repo's
 * suite doesn't carry, so it isn't asserted here — `npm run dev` is where that gets
 * checked by hand.
 */
describe("FavoriteStar", () => {
  it("renders unfavorited with no window, and does not throw", () => {
    const html = renderToStaticMarkup(createElement(FavoriteStar, { id: "blueprint:x" }));
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Add to favorites"');
    expect(html).not.toContain("text-amber");
  });

  it("marks the star decorative and puts the meaning on the button", () => {
    const html = renderToStaticMarkup(createElement(FavoriteStar, { id: "blueprint:x" }));
    expect(html).toContain('<button type="button"');
    expect(html).toMatch(/<svg[^>]*aria-hidden/);
  });
});
