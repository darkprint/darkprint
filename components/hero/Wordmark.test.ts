/* ============================================================
   The one invariant this file can check without a browser: a
   server render — which is what a no-JS reader and a
   `prefers-reduced-motion` reader both get, per `useReveal`'s
   `static` phase — still shows "DarkPrint" as plain, findable text,
   and the new letter-trace overlay (Task 6) is never visible in
   that state.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Wordmark } from "@/components/hero/Wordmark";
import { plainText } from "@/components/ui/visible-text";

describe("Wordmark", () => {
  it("renders the finished name and claim as real text with no client JS", () => {
    const html = renderToStaticMarkup(createElement(Wordmark));
    const text = plainText(html);
    expect(text).toContain("DarkPrint");
    expect(text).toContain("Autonomy you can read as a graph.");
  });

  it("does not cut the heading into per-letter spans on the server", () => {
    // `useReveal`'s `static` phase never runs the layout effect, so `splitText` never
    // executes server-side and `data-mark="mark"` stays one plain text node.
    const html = renderToStaticMarkup(createElement(Wordmark));
    expect(html).not.toContain("dp-char");
  });

  it("renders the letter-trace overlay invisible by default", () => {
    // The trace overlay is a JS-only entrance effect; a reader who never runs the
    // animation must never see a half-drawn letter outline.
    const html = renderToStaticMarkup(createElement(Wordmark));
    expect(html).toContain('data-mark="trace"');
    expect(html).toMatch(/data-mark="trace"[^>]*class="[^"]*opacity-0/);
  });
});
