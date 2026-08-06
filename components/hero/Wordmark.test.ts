/* ============================================================
   The one invariant this file can check without a browser: a
   server render — which is what a no-JS reader and a
   `prefers-reduced-motion` reader both get, per `useReveal`'s
   `static` phase — still shows "DarkPrint" as plain, findable text,
   the two buttons are already there at full strength, and the
   letter-trace overlay (Task 6) is never visible in that state.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Wordmark } from "@/components/hero/Wordmark";
import { plainText } from "@/components/ui/visible-text";

const render = () => renderToStaticMarkup(createElement(Wordmark));

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

  /**
   * The first viewport used to print "N blueprints · N node cards · N ontology terms"
   * under the two buttons. The author removed it. The counts are not gone from the site —
   * `components/home/SectionDoors.tsx` prints the same three on beat 5, next to the
   * sentence that says they are exact, and `beats.test.ts` holds that. This case exists so
   * the line does not drift back into the hero unnoticed, which is how it got here.
   */
  it("does not print the archive counts in the first viewport", () => {
    const text = plainText(render());
    expect(text).not.toMatch(/\d+\s+blueprints/);
    expect(text).not.toMatch(/\d+\s+node cards/);
    expect(text).not.toMatch(/\d+\s+ontology terms/);
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
