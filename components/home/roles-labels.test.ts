/* ============================================================
   Every word in the roles figure, measured where it actually lands.

   `graph.test.ts` holds the *placement* to its frame: no disc off
   the sheet, no node label off the sheet, no two node labels
   stacked. All three passed while the narrow figure shipped reading
   `builu` and `failure Testence`, because the labels that collided
   were on EDGES, and an edge label's position is not a property of
   `graph.ts` at all. It falls out of the run's curve, the loop
   shift, and `labelT` — three things that live in
   `SectionRoles.tsx` — so no test over `LANDING_PLACEMENTS` could
   have seen it.

   The caption under the drawing failed the same way from the other
   direction: as an SVG `<text>` it was one unwrappable line of 55
   characters centred on the debugger, spanning 336 units in a
   360-unit frame, so a fifth of it was clipped off the right edge on
   every phone. `graph.test.ts` measures node labels and the
   absence, and that string was neither.

   So this file does not model the geometry. It renders the
   component, walks the SVG, resolves each `<text>` through the
   translations above it, and compares boxes. Anything a scene does
   to move a label — a bend, a shift, a `labelT`, a new annotation —
   is included by construction, which is the property the arithmetic
   version lacked.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FLOW } from "@/components/viz";

import { SectionRoles } from "./SectionRoles";

/**
 * Advance width of one character as a fraction of the font size.
 *
 * The figures set `VIZ.font.family`, which resolves to the mono stack, and 0.6 is the
 * advance of the monospace faces this site loads. It is the same constant `graph.test.ts`
 * measures with, and it is an approximation in the safe direction for a collision test:
 * a real glyph is narrower, so a box that clears here clears on the page.
 */
const ADVANCE = 0.6;

interface Placed {
  text: string;
  x: number;
  y: number;
  size: number;
  /** Half the advance width, so a box is `x ± half`. */
  half: number;
}

interface Frame {
  width: number;
  height: number;
  labels: Placed[];
}

/** `translate(a b)` or `translate(a, b)`, which is all these scenes emit. */
function translationOf(attrs: string): [number, number] {
  const m = /transform="translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)"/.exec(attrs);
  return m === null ? [0, 0] : [Number(m[1]), Number(m[2])];
}

/**
 * Every `<text>` in one `<svg>`, in absolute frame units.
 *
 * A hand-rolled walk rather than a DOM: the suite is `environment: "node"` and the only
 * transform these glyphs emit is a translation, so the resolver is a stack of offsets.
 * A scene that starts emitting `scale` or `rotate` on a group would need more, and the
 * assertion below that every frame yields labels is what would fail first.
 */
function labelsIn(svg: string): Placed[] {
  const out: Placed[] = [];
  const stack: [number, number][] = [[0, 0]];
  const token = /<(\/?)(g|text|svg)([^>]*?)(\/?)>|([^<]+)/g;
  let pending: { at: [number, number]; size: number; x: number; y: number } | null = null;
  let buffer = "";

  for (let m = token.exec(svg); m !== null; m = token.exec(svg)) {
    const [, closing, tag, attrs = "", selfClosing, textRun] = m;

    if (textRun !== undefined) {
      if (pending !== null) buffer += textRun;
      continue;
    }
    if (tag === "g" || tag === "svg") {
      if (closing === "/") stack.pop();
      else if (selfClosing !== "/") {
        const [dx, dy] = translationOf(attrs);
        const top = stack[stack.length - 1];
        stack.push([top[0] + dx, top[1] + dy]);
      }
      continue;
    }
    // <text>
    if (closing === "/") {
      if (pending !== null) {
        const text = buffer.replace(/\s+/g, " ").trim();
        if (text !== "") {
          out.push({
            text,
            x: pending.at[0] + pending.x,
            y: pending.at[1] + pending.y,
            size: pending.size,
            half: (text.length * pending.size * ADVANCE) / 2,
          });
        }
        pending = null;
        buffer = "";
      }
      continue;
    }
    const size = /font-size="([\d.]+)"/.exec(attrs);
    const x = /\bx="([-\d.]+)"/.exec(attrs);
    const y = /\by="([-\d.]+)"/.exec(attrs);
    pending = {
      at: stack[stack.length - 1],
      size: size === null ? FLOW.label.size : Number(size[1]),
      x: x === null ? 0 : Number(x[1]),
      y: y === null ? 0 : Number(y[1]),
    };
    buffer = "";
  }
  return out;
}

function framesOf(markup: string): Frame[] {
  const svgs = markup.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
  return svgs.map((svg) => {
    const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    if (box === null) throw new Error("a scene rendered without a viewBox");
    return { width: Number(box[1]), height: Number(box[2]), labels: labelsIn(svg) };
  });
}

const FRAMES = framesOf(renderToStaticMarkup(createElement(SectionRoles)));

describe("the roles figure is legible at both sizes", () => {
  it("renders both placements, with words in each", () => {
    // A walk that silently found nothing would pass every assertion below it.
    expect(FRAMES).toHaveLength(2);
    for (const frame of FRAMES) expect(frame.labels.length).toBeGreaterThanOrEqual(8);
    // The narrow frame first, which is the one the phone renders and the one that broke.
    expect(FRAMES[0].width).toBeLessThan(FRAMES[1].width);
  });

  it.each([0, 1])("frame %i: no word is clipped by the sheet", (index) => {
    const frame = FRAMES[index];
    for (const label of frame.labels) {
      expect(
        label.x - label.half,
        `"${label.text}" starts ${(label.half - label.x).toFixed(0)} units off the left`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        label.x + label.half,
        `"${label.text}" runs ${(label.x + label.half - frame.width).toFixed(0)} units past the right`,
      ).toBeLessThanOrEqual(frame.width);
      expect(label.y, `"${label.text}" sits below the sheet`).toBeLessThanOrEqual(frame.height);
    }
  });

  it.each([0, 1])("frame %i: no two words are written over each other", (index) => {
    const frame = FRAMES[index];
    const overlaps: string[] = [];
    for (let i = 0; i < frame.labels.length; i += 1) {
      for (let j = i + 1; j < frame.labels.length; j += 1) {
        const a = frame.labels[i];
        const b = frame.labels[j];
        // Baselines closer than one line height, with the boxes meeting horizontally.
        const line = Math.max(a.size, b.size) * 1.1;
        const apart = Math.abs(a.y - b.y) >= line || Math.abs(a.x - b.x) >= a.half + b.half;
        if (!apart) overlaps.push(`"${a.text}" over "${b.text}"`);
      }
    }
    expect(overlaps).toEqual([]);
  });
});
