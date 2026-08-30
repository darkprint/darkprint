/* ============================================================
   Spec §3.2's hardest sentence, checked before a build has to:

     "The YAML is **real text in the DOM**, syntax-coloured with
      spans. Not an image, not painted by JS. It must be selectable,
      and it must survive into the prerendered HTML."

   The build's own grep over `.next/server/app/*.html` is the final
   word on that, and it is also forty seconds away and only runs
   when somebody remembers. This renders the walk the way the server
   does and reads the string that comes out, so a change that moves
   the listing behind an effect fails here, in the file that
   explains why it may not.

   The walk is a client component and this renders it anyway, which
   is the point: `"use client"` is an instruction to the bundler
   about where the code is *sent*, and every client component on an
   SSG site is still rendered to HTML at build time. Effects do not
   run under `renderToStaticMarkup`, so what comes back is exactly
   the state a reader without JS gets.

   ── Two mounts, two components, both rendered ──
   `NodeCardStage` was the second half of this file and is deleted:
   `/spec/card` mounted it, then mounted `CardWalk` with the long
   bodies, and the tests that were only ever about the stage's own
   parts — the leader line, the dezoom's graph, the link in its tail
   — went with the component rather than being loosened until they
   passed over something else.

   The two surfaces have forked again, and this time the fork is the
   INTERACTION rather than a prop. The author asked `/spec/card` to
   "avoid the effect on scrolling of the card panel (keep it for the
   other pages)", so the landing draws `CardWalk` and that page
   draws `CardBreakdown`, which is `components/panes/DotBreakdown`'s
   click-driven pattern over the same nine annotations.

   **Both are rendered here, and the assertions that are about the
   LISTING are held over both.** That is the point of the split
   surviving in this file rather than one component being dropped
   from it: every line present, coloured with spans, every
   annotation open at once, every run marked in the margin, and no
   client-only geometry in the server's HTML. Those are properties
   of the card figure, not of either interaction, and a change that
   broke one of them in one mount only is exactly what a shared
   `YamlListing` makes easy.

   The blocks below that are about ONE mount say which and why: the
   reel's custom properties are `CardWalk`'s alone, and the rail of
   buttons is `CardBreakdown`'s alone.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NODE_CARD_ANNOTATIONS } from "./annotations";
import { CardBreakdown } from "./CardBreakdown";
import { CardWalk } from "./CardWalk";
import { getNodeCard } from "@/lib/content";

const CARD = readFileSync(
  join(process.cwd(), "content/cards/code-builder@1.0.0.yaml"),
  "utf8",
).trimEnd();

/**
 * The same card, parsed, for the face the walk now opens on.
 *
 * Read through `lib/content` rather than parsed here: the face is `CardStackFigure`, which
 * takes a `NodeCard`, and building one by hand in a test is how a fixture drifts from the
 * document beside it. This is the archive's own reading of the same file `CARD` holds.
 */
const PARSED = getNodeCard("code-builder", "1.0.0")?.card;
if (PARSED === undefined) throw new Error("code-builder@1.0.0 is not in the archive");

/** The landing's mount: `CardWalk`'s own short wording for the nine parts. */
const WALK = renderToStaticMarkup(
  createElement(CardWalk, { source: CARD, cardRef: "code-builder@1.0.0", card: PARSED }),
);

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

const SURFACES = [
  ["the landing's walk", WALK],
  ["/spec/card's breakdown", REFERENCE],
] as const;

describe("the card is in the markup before any script runs", () => {
  it.each(SURFACES)("%s carries every line of the YAML", (_name, html) => {
    // Against the un-escaped text rather than the markup, so the assertion is about what
    // a reader selects and copies rather than about the bytes React chose to escape.
    const text = textOf(html);
    for (const line of CARD.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      expect(text, `line missing: ${trimmed}`).toContain(trimmed);
    }
  });

  it.each(SURFACES)("%s colours it with spans rather than painting it", (_name, html) => {
    // The key colour is the copper register's line, not cyan: the figure's whole ground
    // is one accent now, and a second one inside it would read as a mistake.
    expect(html).toContain('<span class="text-copper-line">model</span>');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<canvas");
  });

  /**
   * The whole point of the three-phase gate in `useReveal`: the server renders the
   * finished state, so a reader with no JS and a reader who asked for no motion get
   * every annotation open at once, which is what spec §3.2 requires in as many words.
   *
   * Held over `/spec/card`'s mount specifically, because that is the one carrying
   * `annotations.ts`'s bodies. The landing overrides all nine with shorter wording, so
   * asserting the reference prose over `WALK` would assert nothing at all — and if the
   * override ever grew to cover a step the reference page needs in full, this is where it
   * would be caught.
   *
   * It matters more under the click-driven mount than it did under the walk: every body on
   * `/spec/card` now lives inside a `<button>`, and a body moved out of the control (into a
   * `<details>`, or behind the pick) would leave the reference prose in the markup and stop
   * it being the thing the reader clicked. `openText` is not used here on purpose — this
   * asks only that the sentences are present as text, and the case below asks that the
   * pick is what changes rather than what reveals.
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

  /** The landing's own nine, so its shorter set is prerendered too and not merely typed. */
  it("opens every annotation at once, with the landing's wording", () => {
    const text = textOf(WALK);
    for (const annotation of NODE_CARD_ANNOTATIONS) {
      expect(text).toContain(annotation.title);
    }
    expect(text).toContain("The first four lines fix identity");
  });

  /**
   * The static answer to the leader line, which the stage drew and this does not. There
   * is no drawn connection here at any width, so every run is marked in the listing's
   * margin and each carries its step number, which is how a reader knows which places on
   * the card the notes beside it are about.
   *
   * The two classes are the copper register's, not the blueprint one's. They are asserted
   * by name because the marking is the whole of the figure's pointing: a rename that
   * dropped one of them would leave a listing that still renders and no longer says which
   * lines each note is about.
   */
  /*
   * The rule and the number are held over BOTH mounts, because they are what carries the
   * claim without script on either route. The row GROUND is the walk's alone: the
   * breakdown grounds only the run a reader picked, which is `DotBreakdown`'s rule and is
   * argued at `Grounding` in `YamlListing`. Splitting the assertion rather than dropping
   * it is the point — a change that took the brackets off the breakdown would leave a
   * no-JS reader nine open notes and nothing joining them to the file.
   */
  it.each(SURFACES)("%s brackets and numbers every annotated run", (_name, html) => {
    expect(html).toContain("border-copper-line/60");
    // Two digits, the spelling both rails use. `>1</span>` would also match the gutter's
    // line number for line 1, which is why the marker is asserted in its padded form.
    for (const step of NODE_CARD_ANNOTATIONS.map((_, i) => i + 1)) {
      expect(html).toContain(`>${String(step).padStart(2, "0")}</span>`);
    }
  });

  it("bands every run on the landing, and only the picked one on /spec/card", () => {
    expect(WALK).toContain("bg-copper/25");
    expect(REFERENCE).not.toContain("bg-copper/25");
  });

  /**
   * And that the click-driven mount has picked NOTHING before a click.
   *
   * `CardBreakdown`'s pick is a ground swap on one run — `bg-copper-line/15` instead of the
   * marked `bg-copper/25` — so a component that opened on part 1 would take the marked
   * ground off one of the nine and would make the first client render differ from this
   * markup. Asserted as an absence, which is the only way to state "the resting state is
   * the finished drawing" over a string.
   */
  it("/spec/card's breakdown highlights nothing until a reader asks", () => {
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
   fifth — focus visible — is `app/globals.css`'s
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
   * `<span class="block">` — and a browser that reparents a stray `<p>` would move nine
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
   The one class of bug this figure has now shipped twice.

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

   It covered `/spec/card` as well while that route drew the walk.
   It does not any more, and the reason is the strongest possible
   one: the breakdown has no reel, no window and no pin, so there is
   nothing on that route to gate. The case below states that as an
   absence rather than leaving the coverage to look accidental.
   ============================================================ */

describe("the walk lays out for a phone before it lays out for a screen", () => {
  it("writes no transform into the markup, at any breakpoint", () => {
    // The property may be set — it is inert until an `lg:` utility reads it. The
    // declaration may not be.
    expect(WALK).not.toContain("transform:translateY");
    expect(WALK).not.toContain("transform: translateY");
    expect(WALK, "a bare transform declaration is not width-gated").not.toMatch(
      /style="[^"]*(?<!-)\btransform:/,
    );
  });

  it("passes the reel's shift as a custom property", () => {
    expect(WALK).toContain("--walk-reel:0px");
    expect(WALK).toContain("--walk-window:");
  });

  it("emits none of the choreography's classes on the server", () => {
    for (const gated of [
      "lg:sticky",
      "lg:h-[190vh]",
      "lg:overflow-y-hidden",
      // `lg:sr-only`, because that is what the eight closed bodies now carry. It was
      // `lg:hidden` until this pass; the class changed and this list has to change with
      // it, or the check passes over a class the component no longer emits.
      "lg:sr-only",
    ]) {
      expect(WALK, `choreography class leaked: ${gated}`).not.toContain(gated);
    }
  });

  /**
   * The other side of the fork, and the sentence the author's instruction turns on: the
   * effect is off `/spec/card` and kept everywhere else.
   *
   * A `mode` prop would have made this unassertable — the walk's classes would be in the
   * same file and one boolean away — which is half the argument for two components. As it
   * stands the breakdown imports no `geometry.ts` and no `useScrollProgress`, and the
   * markup can be asked directly whether any of it leaked. The listing's own height is the
   * point: 52 rows drawn whole, with no window to clip them to and nothing to slide.
   */
  it("leaves every trace of the reel off /spec/card", () => {
    for (const gone of [
      "--walk-reel",
      "--walk-window",
      "lg:sticky",
      "lg:h-[190vh]",
      "lg:overflow-y-hidden",
      "lg:sr-only",
    ]) {
      expect(REFERENCE, `the walk's ${gone} reached the breakdown`).not.toContain(gone);
    }
    // And no vertical clip of any kind on the listing box, at any width. That is the shape
    // the trap took the last two times: a height beside `overflow-x: auto` resolves to a
    // box that scrolls on BOTH axes, which is a 52-line file inside a nested scroller. The
    // row heights `YamlListing` declares are not this and never were — they are per-row and
    // are what `geometry.ts` exists to be able to compute against.
    expect(REFERENCE).not.toContain("overflow-y");
    expect(REFERENCE, "a height on the listing box").not.toMatch(/class="[^"]*\bh-\[/);
  });

  /**
   * The listing scrolls sideways at every width and has no focusable child of its own, so
   * without a stop of its own the last thirty-odd characters of seventeen rows are
   * reachable with a mouse and by no other means (WCAG 2.1.1, Level A). Both mounts draw
   * the same scroller and both need the same stop.
   */
  it.each(SURFACES)("%s gives the sideways scroller a keyboard stop and a name", (_n, html) => {
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="region"');
    // 53 -> 52 -> 51: `requires_human` was withdrawn from the card schema and left every
    // document in `content/cards/`, and `ontology_version` followed it. The name states
    // how much the scroller holds, so it moves with the file.
    expect(html).toContain('aria-label="code-builder@1.0.0, 51 lines"');
  });
});
