/* ============================================================
   Spec §3.2's hardest sentence, checked before a build has to:

     "The YAML is **real text in the DOM**, syntax-coloured with
      spans. Not an image, not painted by JS. It must be selectable,
      and it must survive into the prerendered HTML."

   The build's own grep over `.next/server/app/*.html` is the final
   word on that, and it is also forty seconds away and only runs
   when somebody remembers. This renders the scene the way the
   server does and reads the string that comes out, so a change that
   moves the listing behind an effect fails here, in the file that
   explains why it may not.

   The stage is a client component and this renders it anyway, which
   is the point: `"use client"` is an instruction to the bundler
   about where the code is *sent*, and every client component on an
   SSG site is still rendered to HTML at build time. Effects do not
   run under `renderToStaticMarkup`, so what comes back is exactly
   the state a reader without JS gets.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NODE_CARD_ANNOTATIONS } from "./annotations";
import { CardWalk } from "./CardWalk";
import { NodeCardStage } from "./NodeCardStage";

const CARD = readFileSync(
  join(process.cwd(), "content/cards/code-builder@1.0.0.yaml"),
  "utf8",
).trimEnd();

const HTML = renderToStaticMarkup(
  createElement(NodeCardStage, {
    source: CARD,
    cardRef: "code-builder@1.0.0",
    cardHref: "/nodes/code-builder",
    darkFactory: true,
  }),
);

/**
 * The five characters React escapes on the way into an attribute or a text node. A test
 * that compares source text to markup without undoing them fails on every apostrophe,
 * which is most sentences.
 */
function unescape(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/** Tags out, entities resolved. Enough to ask whether a sentence is readable text. */
const TEXT = unescape(HTML.replace(/<[^>]*>/g, ""));

describe("the card is in the markup before any script runs", () => {
  it("carries every line of the YAML", () => {
    // Against the un-escaped text rather than the markup, so the assertion is about what
    // a reader selects and copies rather than about the bytes React chose to escape.
    for (const line of CARD.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      expect(TEXT, `line missing: ${trimmed}`).toContain(trimmed);
    }
  });

  it("colours it with spans rather than painting it", () => {
    // The key colour is the copper register's line, not cyan: the figure's whole ground
    // is one accent now, and a second one inside it would read as a mistake.
    expect(HTML).toContain('<span class="text-copper-line">model</span>');
    expect(HTML).not.toContain("<img");
    expect(HTML).not.toContain("<canvas");
  });

  /**
   * The whole point of the three-phase gate in `useReveal`: the server renders the
   * finished state, so a reader with no JS and a reader who asked for no motion get
   * every annotation open at once, which is what spec §3.2 requires in as many words.
   */
  it("opens every annotation at once", () => {
    for (const annotation of NODE_CARD_ANNOTATIONS) {
      expect(TEXT).toContain(annotation.title);
      // The longest stretch of plain prose in the body. `Ticked` splits on backticks and
      // wraps the odd segments in `<code>`, so a whole sentence never survives tag
      // stripping as one string, and three bodies open on an identifier.
      const prose = annotation.body
        .split("`")
        .filter((_, i) => i % 2 === 0)
        .map((part) => part.trim())
        .sort((a, b) => b.length - a.length)[0];
      expect(prose?.length ?? 0).toBeGreaterThan(20);
      expect(TEXT).toContain(prose);
    }
  });

  it("emits none of the choreography's classes on the server", () => {
    // `motion` is false until the client has looked, so the prerendered markup is the
    // stacked layout. A `lg:` class in here means the gate has been bypassed and the
    // no-JS reader is looking at a clipped window that will never scroll.
    for (const gated of ["lg:sticky", "lg:h-[504px]", "lg:h-[420vh]", "lg:hidden", "lg:bg-"]) {
      expect(HTML, `choreography class leaked: ${gated}`).not.toContain(gated);
    }
  });

  /**
   * The static answer to the leader line. There is no drawn connection without the
   * choreography, so every run is marked in the listing's margin and each carries its step
   * number, which is how a reader with no JS still knows which places on the card the
   * notes below are about.
   *
   * The two classes are the copper register's, not the blueprint one's. They are asserted
   * by name because the marking is the whole of the static layout's pointing: a rename
   * that dropped one of them would leave a listing that still renders and no longer says
   * which lines each note is about.
   */
  it("marks every annotated run in the listing itself", () => {
    expect(HTML).toContain("bg-copper/25");
    expect(HTML).toContain("border-copper-line/60");
    for (const step of NODE_CARD_ANNOTATIONS.map((_, i) => i + 1)) {
      expect(HTML).toContain(`>${step}</span>`);
    }
  });

  it("links to the page that shows the same card in full", () => {
    expect(HTML).toContain('href="/nodes/code-builder"');
  });

  it("draws the graph the card lands in, with the absent edge named", () => {
    expect(TEXT).toContain("code-builder");
    expect(TEXT).toContain("acceptance-criteria");
    expect(HTML).toContain("stroke-dasharray");
  });

  /** Doc 2 §1.1. The classification is a reading of a shape and never a rank. */
  it("prints the classification without an autonomy ordinal", () => {
    expect(TEXT).toContain("dark factory");
    expect(TEXT.toLowerCase()).not.toContain("autonomy level");
    expect(TEXT.toLowerCase()).not.toContain("level 4");
  });
});

/* ============================================================
   The landing's copy of the same walk, and the one class of bug
   this pair of components has now shipped twice.

   `CardWalk` gates its choreography two ways at once. `motion` is
   false on the server and on the first client render, so nothing
   choreographed is emitted at all; and every choreographed class
   carries `lg:`, so even once `motion` flips, a phone is left with
   the stacked listing at its own height.

   Those two gates only agree while the values they carry are in
   CLASSES. An inline `style` has no breakpoint. The reel shipped
   its shift as `style={{ transform }}` beside a window clip written
   as `lg:h-[…] lg:overflow-y-hidden`, and the pair came apart at
   exactly the place the file's own comment says it must not: on a
   390px phone the transform ran to -638px against a container that
   never clips, sliding 28 of 52 lines out of the top of a box that
   then opened 647px of empty space under the last one.

   So this is not a test about a transform. It is a test that no
   geometry reaches the un-prefixed markup: whatever the walk moves,
   it moves through a custom property that only an `lg:` utility
   reads.
   ============================================================ */

const WALK = renderToStaticMarkup(
  createElement(CardWalk, { source: CARD, cardRef: "code-builder@1.0.0" }),
);

describe("the landing's walk lays out for a phone before it lays out for a screen", () => {
  it("writes no transform into the markup, at any breakpoint", () => {
    // The property may be set — it is inert until an `lg:` utility reads it. The
    // declaration may not be.
    expect(WALK).not.toContain("transform:translateY");
    expect(WALK).not.toContain("transform: translateY");
    expect(WALK, "a bare transform declaration is not width-gated").not.toMatch(
      /style="[^"]*(?<!-)\btransform:/,
    );
  });

  it("passes the reel's shift as a custom property instead", () => {
    expect(WALK).toContain("--walk-reel:0px");
    expect(WALK).toContain("--walk-window:");
  });

  it("emits none of the choreography's classes on the server", () => {
    for (const gated of ["lg:sticky", "lg:h-[190vh]", "lg:overflow-y-hidden", "lg:hidden"]) {
      expect(WALK, `choreography class leaked: ${gated}`).not.toContain(gated);
    }
  });

  it("stands the listing at its full height, with every line in it", () => {
    const text = unescape(WALK.replace(/<[^>]*>/g, ""));
    for (const line of CARD.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      expect(text, `line missing: ${trimmed}`).toContain(trimmed);
    }
  });

  /**
   * The listing scrolls sideways at every width and has no focusable child of its own, so
   * without a stop of its own the last thirty-odd characters of seventeen rows are
   * reachable with a mouse and by no other means (WCAG 2.1.1, Level A).
   */
  it("gives the sideways scroller a keyboard stop and a name", () => {
    expect(WALK).toContain('tabindex="0"');
    expect(WALK).toContain('role="region"');
    expect(WALK).toContain('aria-label="code-builder@1.0.0, 52 lines"');
  });
});
