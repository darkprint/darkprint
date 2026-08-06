/* ============================================================
   Where the frame is allowed to fall, as a contract rather than a screenshot.
   ------------------------------------------------------------
   `frame.ts` is pure, exported, and read by every schematic on the site: `BlueprintGraph`
   applies it to the framing a reader arrives at, and `components/build/stage-labels.test.ts`
   recomputes it to measure the result. It had no test of its own, which meant the only
   thing holding its rule in place was one page's measurement at one width — and the rule is
   four decisions deep (where the candidates come from, which of them are legal, how they
   are ranked, and what happens when there are none).

   ── What this file is, and what it is not ──
   It states the FUNCTION's contract. The numbers below are its inputs, not a copy of the
   page's: `0.9` here is "some floor", not `FRAME_MIN_ZOOM`, and nothing in this file would
   notice if `BlueprintGraph.tsx` changed its own. That is deliberate — the page's numbers
   are pinned against their source in `stage-labels.test.ts`, which is where a claim about
   the page belongs, and a second copy of them here would be a second thing to drift.

   What is taken from production, because the rule is written in terms of it, is
   `BLOCK_TEXT_INSET`: the module protects a block's WORDS, and the words are 13 units
   inside its box on each side.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { BLOCK_TEXT_INSET, BLOCK_WIDTH } from "./block";
import { frameAcross, type Block, type FrameOptions } from "./frame";

/** A floor, a ceiling and some air. See the header: these are inputs, not the page's. */
const OPTIONS: FrameOptions = { minZoom: 0.9, maxZoom: 1.6, padding: { x: 0.18, y: "52px" } };

/** `count` columns on the site's own 200-unit pitch, `rows` blocks standing in each. */
function columns(count: number, rows = 1): Block[] {
  const blocks: Block[] = [];
  for (let column = 0; column < count; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      blocks.push({ x: column * 200, width: BLOCK_WIDTH });
    }
  }
  return blocks;
}

/** The frame `frameAcross` chose, back in flow units: where it starts and how wide it is. */
function span(blocks: readonly Block[], canvasWidth: number, options = OPTIONS) {
  const frame = frameAcross(blocks, canvasWidth, options);
  if (frame === undefined) throw new Error("expected a frame, got none");
  return { start: -frame.x / frame.zoom, width: canvasWidth / frame.zoom, zoom: frame.zoom };
}

/** Every block whose text is drawn whole inside the frame. */
function whole(blocks: readonly Block[], start: number, width: number): Block[] {
  return blocks.filter(
    (block) =>
      block.x + BLOCK_TEXT_INSET >= start - 1e-6 &&
      block.x + block.width - BLOCK_TEXT_INSET <= start + width + 1e-6,
  );
}

describe("frameAcross — when it speaks at all", () => {
  it("says nothing about a drawing that already fits", () => {
    // Three columns are 550 units across; 1124px of canvas fits them at better than 1.
    expect(frameAcross(columns(3), 1124, OPTIONS)).toBeUndefined();
  });

  it("says nothing about a drawing it cannot reason about", () => {
    expect(frameAcross([], 322, OPTIONS)).toBeUndefined();
    expect(frameAcross(columns(3), 0, OPTIONS)).toBeUndefined();
    expect(frameAcross(columns(3), -10, OPTIONS)).toBeUndefined();
    // Every block at the same place with no width: a drawing with no extent across.
    expect(frameAcross([{ x: 40, width: 0 }], 322, OPTIONS)).toBeUndefined();
  });

  it("moves the frame and never magnifies", () => {
    /* The property `frame.ts`'s header records at length: the zoom is one number for both
       axes, this module is entitled to reason about one of them, so it hands back exactly
       the floor the fit had already been clamped to. A version that zoomed in to fit a
       whole number of columns read beautifully across and cut the same blocks top and
       bottom. */
    for (const width of [200, 314, 322, 500, 700]) {
      expect(span(columns(6), width).zoom).toBe(OPTIONS.minZoom);
    }
  });
});

describe("frameAcross — the answer never cuts a word", () => {
  it("keeps both frame edges out of every block's text, at every width it speaks at", () => {
    const cut: string[] = [];
    for (const count of [2, 3, 4, 6, 7, 9]) {
      const blocks = columns(count, count % 3 === 0 ? 2 : 1);
      for (let width = 120; width <= 900; width += 7) {
        const frame = frameAcross(blocks, width, OPTIONS);
        if (frame === undefined) continue;
        const start = -frame.x / frame.zoom;
        for (const edge of [start, start + width / frame.zoom]) {
          for (const block of blocks) {
            const from = block.x + BLOCK_TEXT_INSET;
            const to = block.x + block.width - BLOCK_TEXT_INSET;
            if (from < edge && to > edge) {
              cut.push(`${count} columns, canvas ${width}: edge ${edge.toFixed(1)} in [${from}, ${to}]`);
            }
          }
        }
      }
    }
    expect(cut).toEqual([]);
  });

  it("draws a frame edge through a block's padding rather than losing the column", () => {
    /* The 26 units of margin a block carries are the slack that keeps a one-unit miss from
       costing a whole column, and it is the reason this module measures words and not
       boxes. Seven columns in 314px of canvas: the frame is 348.9 units and two columns
       span 350, so protecting the box rejected every two-column frame over 1.1 units of
       padding and left the reader one block with 134px of empty graticule beside it. */
    const blocks = columns(7);
    const { start, width } = span(blocks, 314);
    expect(width).toBeCloseTo(348.889, 3);
    expect(whole(blocks, start, width)).toHaveLength(2);
    // And the price: at most one block's own padding is clipped, on each side.
    const overhang = blocks
      .filter((block) => block.x < start + width && block.x + block.width > start)
      .map((block) =>
        Math.max(start - block.x, block.x + block.width - (start + width), 0),
      );
    expect(Math.max(...overhang)).toBeLessThanOrEqual(BLOCK_TEXT_INSET);
  });
});

describe("frameAcross — the ranking", () => {
  it("prefers the frame that shows the most drawing", () => {
    /* Six columns in 314px. Every frame position that shows two columns beats every one
       that shows one, however much nearer the centre the second is. */
    const blocks = columns(6);
    const { start, width } = span(blocks, 314);
    expect(whole(blocks, start, width).length).toBeGreaterThanOrEqual(2);
  });

  it("counts a column once however many blocks stand in it", () => {
    /* `wordsShown` unions the text columns rather than summing over blocks, and the
       difference is not academic: summed, a frame over a two-row column outscores the same
       frame over a one-row column, "most drawing" turns into "most rows", and the archive's
       six-column schematics were dragged off centre with 56px of blank down one side. */
    for (const width of [314, 322, 500, 700, 731]) {
      const one = span(columns(6, 1), width);
      const three = span(columns(6, 3), width);
      expect(three.start, `six columns at ${width}px`).toBeCloseTo(one.start, 6);
    }
  });

  it("does not shave a block's border off to move nearer the centre", () => {
    /* Reading the rule off the words rather than the boxes handed the module 13 units of
       slack per side, and the slack is there to buy whole columns, not to be spent. Three
       columns in 322px: the frame is 357.8 units and the centred framing wants to sit at
       96.1, so the nearest legal position that clips nothing is 0 and the nearest of all is
       13 — the first word's own left edge, with the block's border and padding off-frame.
       `boxesClipped` is why the reader gets a whole block instead. */
    const blocks = columns(3);
    const { start, width } = span(blocks, 322);
    expect(start).toBeCloseTo(0, 6);
    for (const block of blocks) {
      const shown = Math.min(block.x + block.width, start + width) - Math.max(block.x, start);
      expect(shown <= 0 || shown === block.width, `block at ${block.x}`).toBe(true);
    }
  });

  it("takes the leftmost of two framings that are equally good and equally off-centre", () => {
    /* This is the tie the starter lands on at 390, and it decides which columns `/build`
       draws. Three columns, 322px of canvas: the frame is 357.8 units, the centred framing
       would sit at 96.1, and TWO positions show both of the columns they can hold while
       standing exactly 96.1 units from it — 0 (the first two columns) and 192.2 (the last
       two). Nothing about the drawing separates them, so the rule takes the leftmost, which
       is where the pipeline starts. */
    const blocks = columns(3);
    const { start, width } = span(blocks, 322);
    const centred = (0 + 550) / 2 - width / 2;
    expect(Math.abs(0 - centred)).toBeCloseTo(Math.abs(192.222 - centred), 3);
    expect(whole(blocks, 0, width)).toHaveLength(2);
    expect(whole(blocks, 192.2222222, width)).toHaveLength(2);
    expect(start).toBeCloseTo(0, 6);
  });

  it("gives the same answer whichever order the blocks arrive in", () => {
    /* The sort's keys are rounded to a millionth for exactly this reason. Compared
       unrounded, two candidates that are the same position reached by two arithmetic routes
       differ in the last bit of a double and the drawing moves a column; compared against a
       tolerance, the comparator stops being transitive and `Array.prototype.sort` is
       entitled to return anything at all. */
    const blocks = columns(7, 2);
    const shuffled = [...blocks].reverse();
    for (const width of [200, 314, 322, 431, 500, 700]) {
      expect(span(shuffled, width).start, `canvas ${width}px`).toBeCloseTo(
        span(blocks, width).start,
        9,
      );
    }
  });
});

describe("frameAcross — when no framing shows anything", () => {
  it("falls back to the centred framing rather than framing an empty field", () => {
    /* One block whose own text is wider than the whole frame. Every position that would
       show part of it cuts it, and the only LEGAL frames are the empty fields to its left
       and right — which is why the fallback is not written as "no candidates": there are
       candidates, and they are all blank canvas. A blank canvas is not a framing, so the
       module hands back React Flow's own centred one and lets the guard report the cut. */
    const blocks: Block[] = [{ x: 0, width: 900 }];
    const canvasWidth = 200;
    const { start, width } = span(blocks, canvasWidth);
    expect(width).toBeCloseTo(canvasWidth / OPTIONS.minZoom, 6);
    expect(start).toBeCloseTo(900 / 2 - width / 2, 6);
    // And it really is cut — this is the case the fallback exists to be honest about.
    expect(whole(blocks, start, width)).toHaveLength(0);
  });

  it("never takes that branch on a drawing made of real blocks", () => {
    /* The block this site draws is `BLOCK_WIDTH` wide and the narrowest frame any page
       asks for is more than twice that, so the fallback above is a guard and not a
       behaviour. Stated as a test so that stops being an assertion in a comment. */
    for (const count of [1, 2, 3, 5, 7]) {
      for (let width = 140; width <= 900; width += 11) {
        const blocks = columns(count);
        const frame = frameAcross(blocks, width, OPTIONS);
        if (frame === undefined) continue;
        const start = -frame.x / frame.zoom;
        expect(
          whole(blocks, start, width / frame.zoom).length,
          `${count} columns, canvas ${width}px`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
