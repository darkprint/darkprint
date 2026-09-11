/* ============================================================
   Spec §3.2's hardest sentence, checked before a build has to:

     "The YAML is **real text in the DOM**, syntax-coloured with
      spans. Not an image, not painted by JS. It must be selectable,
      and it must survive into the prerendered HTML."

   The build's own grep over `.next/server/app/*.html` is the final
   word on that, and it is also forty seconds away and only runs
   when somebody remembers. This renders `/spec/card`'s breakdown the
   way the server does and reads the string that comes out, so a
   change that moves the listing behind an effect fails here, in the
   file that explains why it may not.

   The breakdown is a client component and this renders it anyway,
   which is the point: `"use client"` is an instruction to the
   bundler about where the code is *sent*, and every client component
   on an SSG site is still rendered to HTML at build time. Effects do
   not run under `renderToStaticMarkup`, so what comes back is
   exactly the state a reader without JS gets.

   `/spec/card` is the one mount of the listing. The landing draws
   the card as a figure (`CardStackFigure`) and no listing at all, so
   every assertion here is about this route.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NODE_CARD_ANNOTATIONS } from "./annotations";
import { CardBreakdown } from "./CardBreakdown";

const CARD = readFileSync(
  join(process.cwd(), "content/cards/code-builder@1.0.0.yaml"),
  "utf8",
).trimEnd();

/**
 * `/spec/card`'s mount: the click-driven breakdown, which takes no wording override at all
 * and reads `annotations.ts`'s long reference bodies straight off `note.body`.
 */
const REFERENCE = renderToStaticMarkup(
  createElement(CardBreakdown, { source: CARD, cardRef: "code-builder@1.0.0" }),
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
function textOf(html: string): string {
  return unescape(html.replace(/<[^>]*>/g, ""));
}

describe("the card is in the markup before any script runs", () => {
  it("carries every line of the YAML", () => {
    // Against the un-escaped text rather than the markup, so the assertion is about what
    // a reader selects and copies rather than about the bytes React chose to escape.
    const text = textOf(REFERENCE);
    for (const line of CARD.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      expect(text, `line missing: ${trimmed}`).toContain(trimmed);
    }
  });

  it("colours it with spans rather than painting it", () => {
    // The key colour is the copper register's line, not cyan: the figure's whole ground
    // is one accent, and a second one inside it would read as a mistake.
    expect(REFERENCE).toContain('<span class="text-copper-line">model</span>');
    expect(REFERENCE).not.toContain("<img");
    expect(REFERENCE).not.toContain("<canvas");
  });

  /**
   * The server renders the finished state, so a reader with no JS and a reader who asked
   * for no motion get every annotation open at once, which is what spec §3.2 requires in
   * as many words.
   *
   * Every body lives inside a `<button>`, so a body moved out of the control (into a
   * `<details>`, or behind the pick) would leave the reference prose in the markup and stop
   * it being the thing the reader clicked. This asks only that the sentences are present as
   * text; the case below asks that the pick is what changes rather than what reveals.
   */
  it("opens every annotation at once, with the reference wording", () => {
    const text = textOf(REFERENCE);
    for (const annotation of NODE_CARD_ANNOTATIONS) {
      expect(text).toContain(annotation.title);
      // The longest stretch of plain prose in the body. `body()` splits on backticks and
      // wraps the odd segments in `<code>`, so a whole sentence never survives tag
      // stripping as one string, and three bodies open on an identifier.
      const prose = annotation.body
        .split("`")
        .filter((_, i) => i % 2 === 0)
        .map((part) => part.trim())
        .sort((a, b) => b.length - a.length)[0];
      expect(prose?.length ?? 0).toBeGreaterThan(20);
      expect(text).toContain(prose);
    }
  });

  /**
   * Every run is marked in the listing's margin and each carries its step number, which
   * is how a reader knows which places on the card the notes beside it are about. The
   * classes are the copper register's and are asserted by name because the marking is the
   * whole of the figure's pointing: a rename that dropped one of them would leave a listing
   * that still renders and no longer says which lines each note is about.
   */
  it("brackets and numbers every annotated run", () => {
    expect(REFERENCE).toContain("border-copper-line/60");
    // Two digits, the spelling the rail uses. `>1</span>` would also match the gutter's
    // line number for line 1, which is why the marker is asserted in its padded form.
    for (const step of NODE_CARD_ANNOTATIONS.map((_, i) => i + 1)) {
      expect(REFERENCE).toContain(`>${String(step).padStart(2, "0")}</span>`);
    }
  });

  /**
   * The click-driven mount has picked NOTHING before a click. The pick is a ground swap on
   * one run (`bg-copper-line/15` in place of the marked `bg-copper/25`), so a component
   * that opened on part 1 would make the first client render differ from this markup.
   * Asserted as an absence, which is the only way to state "the resting state is the
   * finished drawing" over a string.
   */
  it("highlights nothing until a reader asks", () => {
    expect(REFERENCE).not.toContain("bg-copper/25");
    expect(REFERENCE).not.toContain("bg-copper-line/15");
    expect(REFERENCE).not.toContain('aria-pressed="true"');
  });
});

/* ============================================================
   `/spec/card`'s rail, which is where the interaction lives.

   The author asked this page for "the approach adopted in
   /spec/topology", and the requirements that came with it are the
   ones a highlight-on-click figure gets wrong by default: real
   buttons, keyboard-operable, focus visible, selected state
   announced, and every line and every block present without JS.

   Four of those five are decided in the MARKUP and so are checked
   here, against the string a reader with no script receives. The
   fifth, focus visible, is `app/globals.css`'s
   `:where(a, button, …):focus-visible` rule, which every `<button>`
   on the site inherits by being a button, and which is why the
   first case below is worth more than it looks: a rail of `<div>`s
   with click handlers would satisfy every other assertion in this
   file and take no focus ring, no Enter, no Space and no place in
   the tab order.
   ============================================================ */

describe("the parts are picked with real buttons", () => {
  it("draws one button per part, each carrying its own pressed state", () => {
    const buttons = REFERENCE.match(/<button\b/g) ?? [];
    expect(buttons.length).toBe(NODE_CARD_ANNOTATIONS.length);
    const pressed = REFERENCE.match(/aria-pressed="false"/g) ?? [];
    expect(pressed.length).toBe(NODE_CARD_ANNOTATIONS.length);
  });

  /**
   * One tab stop for the rail, not nine.
   *
   * `useRovingListbox` is the whole reason this is a roving `tabindex` rather than nine
   * ordinary buttons: nine stops between the card and whatever follows it is a reader
   * walking the entire figure to get past it. With nothing picked the hook parks the stop
   * on the first row, so the rail is reachable and the arrow keys take it from there.
   */
  it("makes the whole rail one tab stop with the arrow keys inside it", () => {
    expect((REFERENCE.match(/tabindex="0"/g) ?? []).length).toBe(
      // The rail's first button, plus the sideways scroller's own stop.
      2,
    );
    expect((REFERENCE.match(/tabindex="-1"/g) ?? []).length).toBe(
      NODE_CARD_ANNOTATIONS.length - 1,
    );
  });

  /** A composite the reader arrows through, with no name, is a stop that announces nothing. */
  it("names the rail and mounts the live region before it has anything to say", () => {
    expect(REFERENCE).toContain('aria-label="Parts of code-builder@1.0.0"');
    expect(REFERENCE).toContain('aria-live="polite"');
  });

  /**
   * `<p>` is flow content and is invalid inside a `<button>`. The body has to be inside the
   * control, because the thing a reader clicks has to be the thing they read, so it is a
   * `<span class="block">`, and a browser that reparents a stray `<p>` would move nine
   * reference bodies out of nine buttons in a way nothing else here would notice.
   */
  it("keeps each body inside the control, as phrasing content", () => {
    // Per button rather than over the whole string: the live region at the foot of the
    // figure IS a `<p>`, and a lazy match from the first `<button` would reach it and fail
    // over markup that is correct.
    const insides = REFERENCE.split("</button>")
      .slice(0, -1)
      .map((chunk) => chunk.slice(chunk.lastIndexOf("<button")));
    expect(insides.length).toBe(NODE_CARD_ANNOTATIONS.length);
    for (const inside of insides) {
      expect(inside, "flow content inside a button").not.toMatch(/<(p|div|ol|ul|li)[\s>]/);
    }
  });
});

/* ============================================================
   The listing stands at its own height at every width.

   A height beside `overflow-x: auto` resolves to a box that scrolls
   on BOTH axes, which is a 52-line file inside a nested scroller,
   and a transform in an un-prefixed `style` slides rows out of a box
   that never clips on a phone. Neither may reach the markup: the row
   heights `YamlListing` declares are per-row and are what
   `geometry.ts` exists to compute against.
   ============================================================ */

describe("the listing lays out for a phone before it lays out for a screen", () => {
  it("writes no transform and no vertical clip into the markup", () => {
    expect(REFERENCE).not.toContain("transform:translateY");
    expect(REFERENCE).not.toContain("transform: translateY");
    expect(REFERENCE, "a bare transform declaration is not width-gated").not.toMatch(
      /style="[^"]*(?<!-)\btransform:/,
    );
    expect(REFERENCE).not.toContain("overflow-y");
    expect(REFERENCE, "a height on the listing box").not.toMatch(/class="[^"]*\bh-\[/);
    for (const gone of ["lg:sticky", "lg:overflow-y-hidden", "lg:sr-only"]) {
      expect(REFERENCE, `a pinned-walk class reached the breakdown: ${gone}`).not.toContain(gone);
    }
  });

  /**
   * The listing scrolls sideways at every width and has no focusable child of its own, so
   * without a stop of its own the last thirty-odd characters of seventeen rows are
   * reachable with a mouse and by no other means (WCAG 2.1.1, Level A).
   */
  it("gives the sideways scroller a keyboard stop and a name", () => {
    expect(REFERENCE).toContain('tabindex="0"');
    expect(REFERENCE).toContain('role="region"');
    // The name states how much the scroller holds, so it moves with the file.
    expect(REFERENCE).toContain('aria-label="code-builder@1.0.0, 51 lines"');
  });
});
