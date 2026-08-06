/* ============================================================
   The one invariant this file can check without a browser: a
   server render — which is what a no-JS reader and a
   `prefers-reduced-motion` reader both get, per `useReveal`'s
   `static` phase — still shows "DarkPrint" as plain, findable text,
   the two buttons and the three counts are already there at full
   strength, and the letter-trace overlay (Task 6) is never visible in
   that state.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Wordmark, type WordmarkCounts } from "@/components/hero/Wordmark";
import { plainText } from "@/components/ui/visible-text";

/* Fixed rather than `PLATFORM_STATS`: this file renders the component in isolation, and the
   point of the case below is that whatever the server counted reaches the markup. The wiring
   to the real archive is `Hero`'s, and `components/home/beats.test.ts` renders that. */
const STATS: WordmarkCounts = { blueprints: 9, nodes: 53, terms: 27 };

const render = () => renderToStaticMarkup(createElement(Wordmark, { stats: STATS }));

describe("Wordmark", () => {
  it("renders the finished name and claim as real text with no client JS", () => {
    const text = plainText(render());
    expect(text).toContain("DarkPrint");
    expect(text).toContain("Autonomy you can read as a graph.");
  });

  it("does not cut the heading into per-letter spans on the server", () => {
    // `useReveal`'s `static` phase never runs the layout effect, so `splitText` never
    // executes server-side and `data-mark="mark"` stays one plain text node.
    expect(render()).not.toContain("dp-char");
  });

  it("renders the letter-trace overlay invisible by default", () => {
    // The trace overlay is a JS-only entrance effect; a reader who never runs the
    // animation must never see a half-drawn letter outline.
    const html = render();
    expect(html).toContain('data-mark="trace"');
    expect(html).toMatch(/data-mark="trace"[^>]*class="[^"]*opacity-0/);
  });

  /**
   * The first viewport used to offer a reader nothing to act on but a chip marked COMING
   * SOON: the two buttons that open the registry sat at 90% scroll depth, and on a phone
   * the header collapses into a hamburger, so viewport 1 carried no visible control at all.
   * Both of these are ordinary markup with no `opacity-0` default, which is what makes them
   * survive `static` — the animation only moves what is already finished.
   */
  it("offers the same two doors the landing closes on, in the same words", () => {
    const html = render();
    expect(html).toContain('href="/blueprints"');
    expect(html).toContain('href="/build"');
    const text = plainText(html);
    expect(text).toContain("Browse the blueprints");
    expect(text).toContain("Build your own");
  });

  it("prints the counts it was handed, so the first screen carries proof", () => {
    const text = plainText(render());
    expect(text).toContain("9 blueprints");
    expect(text).toContain("53 node cards");
    expect(text).toContain("27 ontology terms");
  });

  it("still says the CLI setup is not live yet", () => {
    const text = plainText(render()).toLowerCase();
    expect(text).toContain("npx darkprint setup");
    expect(text).toContain("coming soon");
  });

  it("renders every affordance at full opacity with no script", () => {
    // Same invariant `beats.test.ts` holds over the whole landing, checked here at the
    // element that would break it first. The trace overlay is the one deliberate
    // exception and its own resting state is invisible, so it comes out first.
    const html = render().replace(/<svg[^>]*data-mark="trace"[\s\S]*?<\/svg>/, "");
    expect(html).not.toContain("opacity-0");
  });
});
