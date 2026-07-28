/* ============================================================
   The tokens, and the geometry every scene wires its edges with.

   No hex: every colour in this tree is a reference to a variable
   in `app/globals.css`, because a literal is invisible until the
   palette moves and then it is wrong on one drawing out of nine.

   Plus the wiring arithmetic, which is ordinary arithmetic and is
   checked as such. `flow.ts` trims every luminous curve with
   `edgeControl` and draws every arrowhead with `arrowHeadPath`, so
   these four functions carry the whole site's edges.

   ── What left this file, and where it went ──
   Two blocks are gone with the CAD register they were about
   (redesign spec §1; `Glyphs.tsx` carries the author's words on
   it). The doc 2 §1.1 block asserted that `HumanMark` was violet by
   construction and declared no prop that could repaint it;
   `flow.test.ts` makes the identical assertions, function by
   function, over `HumanFlowNode`, which is the component that draws
   a person now. The `VIZ_SELECTOR` block checked that every
   selector string matched an attribute a glyph wrote; `flow.test.ts`
   does the same over `FLOW_SELECTOR`, which keeps the same values.
   Neither rule was weakened. Both moved with their subject.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  arrowHeadPath,
  edgeMidpoint,
  edgePath,
  nodePort,
} from "./Glyphs";
import { VIZ, VIZ_TONE } from "./tokens";

const HERE = fileURLToPath(new URL(".", import.meta.url));

function read(name: string): string {
  return readFileSync(HERE + name, "utf8");
}

const FILES = ["tokens.ts", "Sheet.tsx", "Glyphs.tsx", "useReveal.ts", "useScrollProgress.ts"];

/* --------------------- 1. no hex --------------------- */

describe("every colour is a variable", () => {
  it.each(FILES)("%s contains no hex literal", (name) => {
    const found = [...read(name).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
    expect(found).toEqual([]);
  });

  it("resolves every tone to a CSS reference", () => {
    for (const [tone, value] of Object.entries(VIZ_TONE)) {
      expect(value, `tone "${tone}"`).toMatch(/^(var|color-mix)\(/);
    }
  });
});

/* --------------------- 2. the wiring arithmetic --------------------- */

describe("nodePort", () => {
  /** A node is placed by its centre, so an edge leaving it starts half a box away. */
  it("returns the four sides of the default box", () => {
    const half = { x: VIZ.node.width / 2, y: VIZ.node.height / 2 };
    expect(nodePort(100, 200, "left")).toEqual([100 - half.x, 200]);
    expect(nodePort(100, 200, "right")).toEqual([100 + half.x, 200]);
    expect(nodePort(100, 200, "top")).toEqual([100, 200 - half.y]);
    expect(nodePort(100, 200, "bottom")).toEqual([100, 200 + half.y]);
  });

  it("pushes the port clear of the border when asked", () => {
    expect(nodePort(100, 200, "right", { width: 100, pad: 6 })).toEqual([156, 200]);
    expect(nodePort(100, 200, "top", { height: 40, pad: 6 })).toEqual([100, 174]);
  });
});

describe("edgePath", () => {
  it("draws a straight run as a line", () => {
    expect(edgePath([0, 0], [100, 0])).toBe("M 0 0 L 100 0");
  });

  it("draws a bent run as a quadratic through a perpendicular control point", () => {
    // Horizontal run, so the control point moves straight up by the bend.
    expect(edgePath([0, 0], [100, 0], -20)).toBe("M 0 0 Q 50 -20 100 0");
    // Vertical run, same bend, control point moves sideways by the same amount. The offset
    // is perpendicular to the run so one number reads the same whichever way two nodes lie.
    expect(edgePath([0, 0], [0, 100], -20)).toBe("M 0 0 Q 20 50 0 100");
  });
});

describe("edgeMidpoint", () => {
  it("is the midpoint of a straight run", () => {
    expect(edgeMidpoint([0, 0], [100, 40])).toEqual([50, 20]);
  });

  /** t = 0.5 on the quadratic, which is half the bend rather than all of it. */
  it("sits on the curve of a bent run, not on the control point", () => {
    expect(edgeMidpoint([0, 0], [100, 0], -20)).toEqual([50, -10]);
  });
});

describe("arrowHeadPath", () => {
  it("points the head along the run and closes on the tip", () => {
    const d = arrowHeadPath([100, 0], [0, 0]);
    const tip = `L ${100} ${0} L`;
    expect(d).toContain(tip);
    // Both barbs sit behind the tip by the configured length, one to each side.
    const back = 100 - VIZ.arrow.length;
    expect(d).toBe(
      `M ${back} ${VIZ.arrow.spread} L 100 0 L ${back} ${-VIZ.arrow.spread}`,
    );
  });

  it("survives a zero-length run instead of dividing by it", () => {
    expect(arrowHeadPath([50, 50], [50, 50])).not.toContain("NaN");
  });
});
