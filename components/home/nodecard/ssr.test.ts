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

   ── Two mounts, both rendered ──
   `NodeCardStage` was the second half of this file and is deleted:
   `/spec/card` mounted it, that page now mounts `CardWalk` with the
   long bodies, and the tests that were only ever about the stage's
   own parts — the leader line, the dezoom's graph, the link in its
   tail — went with the component rather than being loosened until
   they passed over something else.

   Everything the stage's block proved that is a property of the
   LISTING rather than of the stage is held below over `CardWalk`,
   which is the component that now carries it on both routes: every
   line present, coloured with spans, every annotation open at once,
   every run marked in the margin, and no choreography class on the
   server. `WALK` is the landing's mount and `REFERENCE` is
   `/spec/card`'s, because the one thing that differs between them
   is which set of bodies is in the markup and both sets have to
   survive prerendering.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NODE_CARD_ANNOTATIONS } from "./annotations";
import { CardWalk } from "./CardWalk";

const CARD = readFileSync(
  join(process.cwd(), "content/cards/code-builder@1.0.0.yaml"),
  "utf8",
).trimEnd();

/** The landing's mount: `CardWalk`'s own short wording for the nine parts. */
const WALK = renderToStaticMarkup(
  createElement(CardWalk, { source: CARD, cardRef: "code-builder@1.0.0" }),
);

/** `/spec/card`'s mount: an empty override, so every note falls through to `note.body`. */
const REFERENCE = renderToStaticMarkup(
  createElement(CardWalk, {
    source: CARD,
    cardRef: "code-builder@1.0.0",
    bodies: {},
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
function textOf(html: string): string {
  return unescape(html.replace(/<[^>]*>/g, ""));
}

const SURFACES = [
  ["the landing's mount", WALK],
  ["/spec/card's mount", REFERENCE],
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

  it("colours it with spans rather than painting it", () => {
    // The key colour is the copper register's line, not cyan: the figure's whole ground
    // is one accent now, and a second one inside it would read as a mistake.
    expect(WALK).toContain('<span class="text-copper-line">model</span>');
    expect(WALK).not.toContain("<img");
    expect(WALK).not.toContain("<canvas");
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
  it("marks every annotated run in the listing itself", () => {
    expect(WALK).toContain("bg-copper/25");
    expect(WALK).toContain("border-copper-line/60");
    for (const step of NODE_CARD_ANNOTATIONS.map((_, i) => i + 1)) {
      expect(WALK).toContain(`>${step}</span>`);
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
   reads. It now covers `/spec/card` as well as the landing, which
   is the route the trap was originally documented on.
   ============================================================ */

describe("the walk lays out for a phone before it lays out for a screen", () => {
  it.each(SURFACES)(
    "%s writes no transform into the markup, at any breakpoint",
    (_name, html) => {
      // The property may be set — it is inert until an `lg:` utility reads it. The
      // declaration may not be.
      expect(html).not.toContain("transform:translateY");
      expect(html).not.toContain("transform: translateY");
      expect(html, "a bare transform declaration is not width-gated").not.toMatch(
        /style="[^"]*(?<!-)\btransform:/,
      );
    },
  );

  it.each(SURFACES)("%s passes the reel's shift as a custom property", (_name, html) => {
    expect(html).toContain("--walk-reel:0px");
    expect(html).toContain("--walk-window:");
  });

  it.each(SURFACES)(
    "%s emits none of the choreography's classes on the server",
    (_name, html) => {
      for (const gated of [
        "lg:sticky",
        "lg:h-[190vh]",
        "lg:overflow-y-hidden",
        // `lg:sr-only`, because that is what the eight closed bodies now carry. It was
        // `lg:hidden` until this pass; the class changed and this list has to change with
        // it, or the check passes over a class the component no longer emits.
        "lg:sr-only",
      ]) {
        expect(html, `choreography class leaked: ${gated}`).not.toContain(gated);
      }
    },
  );

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
