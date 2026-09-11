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

  it("marks the bookmark decorative and puts the meaning on the button", () => {
    const html = renderToStaticMarkup(createElement(FavoriteStar, { id: "blueprint:x" }));
    expect(html).toContain('<button type="button"');
    expect(html).toMatch(/<svg[^>]*aria-hidden/);
  });

  /* ============================================================
     WHAT THIS CELL REPLACED, and why the replacement is not a loosening.

     It read: "keeps the favorite action separate from a read-only seeded support count",
     and it asserted `>Save<`, the absence of `>Star<`, and the title "Seeded support
     count; no community backend is connected".

     All three described renderings this component no longer has. The owner folded Save
     into Star on 2026-09-05 — one control, one concept — and the seeded `count`/`seeded`
     pill went with `BundleHeader`'s `support` prop, its only caller. The disclaimer was
     deleted WITH the figure it disclaimed, which is the single case the honesty rule
     allows; a marker kept over a figure nothing draws guards nothing.

     What is asserted in its place is the fold itself and the cost the owner accepted for
     it: one control, and a signed-out reader told why they cannot keep anything rather
     than clicking into silence.
     ============================================================ */
  it("draws ONE control for a live star, not a bookmark beside a pill", () => {
    const html = renderToStaticMarkup(
      createElement(FavoriteStar, {
        id: "node:abc@1.0.0",
        star: { api: "/api/cards/abc/star", count: 214, starred: false, signedIn: true },
      }),
    );
    expect(html.match(/<button/g) ?? [], "the star and the save are two buttons again").toHaveLength(
      1,
    );
    expect(html).toContain(">Star<");
    expect(html, "the folded control still offers a separate Save").not.toContain(">Save<");
    expect(html).toContain('aria-label="Star this. 214 stars."');
    expect(html).toContain("214");
  });

  /*
   * D-262-07's direction, after the fold. The seeded figure lost its bookmark and kept its
   * marker: the fold is about how many controls a reader sees, and the `◐` is about whether
   * the number under it was read from anything. `ac3-honesty.test.ts` guards the glyph in
   * this file's code; this cell guards that it reaches the markup with the sentence.
   */
  it("keeps the marker and the disclaimer on a seeded figure", () => {
    const html = renderToStaticMarkup(
      createElement(FavoriteStar, { id: "blueprint:x", count: 214, seeded: true }),
    );
    expect(html).toContain("◐");
    expect(html).toContain("Seeded support count; no community backend is connected");
    expect(html).toContain('aria-label="214 community stars, seeded"');
    expect(html, "a seeded figure is not a control, so it cannot be enabled").toContain(
      "disabled",
    );
  });

  it("marks a held star pressed and labels it as one", () => {
    const html = renderToStaticMarkup(
      createElement(FavoriteStar, {
        id: "node:abc@1.0.0",
        star: { api: "/api/cards/abc/star", count: 9, starred: true, signedIn: true },
      }),
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(">Starred<");
  });

  /*
   * The accepted cost, stated rather than swallowed. A signed-out reader used to keep a
   * bookmark in their own browser; after the fold there is nowhere for it to go, so the
   * control has to say that instead of doing nothing when it is clicked.
   */
  it("switches the star off for a signed-out reader and says why in the title", () => {
    const html = renderToStaticMarkup(
      createElement(FavoriteStar, {
        id: "node:abc@1.0.0",
        star: { api: "/api/cards/abc/star", count: 3, starred: false, signedIn: false },
      }),
    );
    expect(html).toContain("disabled");
    /* The `title`, not the `aria-label`: both carry the sentence, and only one of them is
       read by a sighted reader hovering a control that will not move. */
    expect(html, "a switched-off control with no title says nothing to the reader it refuses")
      .toMatch(/title="Sign in to star this\.[^"]*"/);
  });
});
