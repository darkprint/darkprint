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
import { MCP_CONNECT_COMMAND, MCP_ROUTE } from "@/lib/mcp";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";

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
    expect(text).toContain("Design your own");
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

  /**
   * The twin of `beats.test.ts`'s case over the whole landing, at the element that carries
   * it — and it had to get STRICTER on 2026-08-07 rather than merely change.
   *
   * It used to read `expect(text).not.toContain("coming soon")` over the whole hero, which
   * was the right assertion while there was one chip: the chip had printed
   * `npx darkprint setup` under a `ComingSoonBadge`, spending the highest-attention
   * position on the site on a command nobody could run, and the badge left with the string
   * it qualified.
   *
   * The hero prints two commands now, one per half of setup, and exactly one of them runs.
   * A hero-wide "no badge anywhere" would now be false, and the lazy repair — deleting the
   * clause — would leave nothing checking that the badge is on the RIGHT chip. A badge on
   * the skill chip would be as wrong as no badge on the MCP chip, in opposite directions,
   * and the flat text of the hero cannot tell them apart.
   *
   * So this reads each chip's own markup and holds it to its own rule. `chip()` slices one
   * anchor out of the rendered HTML; anchors do not nest, so the non-greedy match ends at
   * that chip's own `</a>`.
   */
  const chip = (html: string, href: string) => {
    const match = html.match(new RegExp(`<a[^>]*href="${href}"[\\s\\S]*?</a>`));
    if (match === null) throw new Error(`the hero draws no chip pointing at ${href}`);
    return match[0];
  };

  it("prints the command that runs with nothing marking it unbuilt", () => {
    const skill = chip(render(), SKILL_ROUTE);
    expect(plainText(skill).toLowerCase()).toContain(SKILL_INSTALL_COMMAND.toLowerCase());
    expect(plainText(skill).toLowerCase()).not.toContain("coming soon");
  });

  /**
   * The other direction, and the one that matters more. There is no MCP server and no
   * `darkprint` package, so this chip prints a command that cannot work, in the hero, one
   * click from a terminal. Doc 2 §0.4 wants the marker beside the thing it qualifies, and
   * a reader copying a command out of a hero does not read a paragraph first.
   */
  it("marks the command that does not run, on the chip itself", () => {
    const mcp = chip(render(), MCP_ROUTE);
    expect(plainText(mcp).toLowerCase()).toContain(MCP_CONNECT_COMMAND.toLowerCase());
    expect(plainText(mcp).toLowerCase()).toContain("coming soon");
  });

  /** The string the whole exercise was to be rid of. It stays gone. */
  it("never prints the invented setup command again", () => {
    expect(plainText(render()).toLowerCase()).not.toContain("npx darkprint setup");
  });

  it("renders every affordance at full opacity with no script", () => {
    // Same invariant `beats.test.ts` holds over the whole landing, checked here at the
    // element that would break it first. The trace overlay is the one deliberate
    // exception and its own resting state is invisible, so it comes out first.
    const html = render().replace(/<svg[^>]*data-mark="trace"[\s\S]*?<\/svg>/, "");
    expect(html).not.toContain("opacity-0");
  });
});
