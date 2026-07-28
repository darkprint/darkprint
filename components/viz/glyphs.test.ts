/* ============================================================
   Two rules that live in a signature and in a stylesheet, so a
   source scan is what checks them. Same method as
   `components/ui/autonomy-surfaces.test.ts`, and for the same
   reason it was written: the rules below had already been stated
   in prose in this repo and lost anyway on the surfaces that never
   read the prose.

   1. Doc 2 §1.1. `HumanMark` is violet by construction. Not by
      convention, not by a default a caller can override: there is
      no argument that reaches its colour, and this file fails if
      one is ever added.
   2. No hex. Every colour in this tree is a reference to a
      variable in `app/globals.css`, because a literal is invisible
      until the palette moves and then it is wrong on one drawing
      out of nine.

   Plus the geometry, which is ordinary arithmetic and is checked
   as such: seven other scenes wire their nodes with it.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { HUMAN_PRESENCE_MARK } from "@/lib/format";

import {
  arrowHeadPath,
  edgeMidpoint,
  edgePath,
  nodePort,
} from "./Glyphs";
import { VIZ, VIZ_SELECTOR, VIZ_TONE, toneColor } from "./tokens";

const HERE = fileURLToPath(new URL(".", import.meta.url));

function read(name: string): string {
  return readFileSync(HERE + name, "utf8");
}

/** Block comments out. Prose about a rule is not a breach of it. */
function withoutBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

const GLYPHS = read("Glyphs.tsx");
const FILES = ["tokens.ts", "Sheet.tsx", "Glyphs.tsx", "useReveal.ts", "useScrollProgress.ts"];

/* --------------------- 1. the human mark's colour --------------------- */

/**
 * The signature, split into the destructuring and the type that describes it.
 *
 * The type is what the rule is about: a prop that does not exist cannot be passed, so the
 * check is on the declared keys rather than on any runtime behaviour.
 */
function humanMarkPropKeys(): string[] {
  const start = GLYPHS.indexOf("export function HumanMark(");
  expect(start, "HumanMark is gone from Glyphs.tsx").toBeGreaterThan(-1);
  const end = GLYPHS.indexOf("}) {", start);
  expect(end, "HumanMark's signature does not close as expected").toBeGreaterThan(start);

  const signature = withoutBlockComments(GLYPHS.slice(start, end));
  const typeAt = signature.indexOf("}: {");
  expect(typeAt, "HumanMark has no inline props type to read").toBeGreaterThan(-1);

  return [...signature.slice(typeAt + 4).matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
}

describe("HumanMark is violet by construction", () => {
  /**
   * The four the component needs, and nothing that could repaint it. Asserted as a set
   * rather than as an absence list, because the next colour-bearing prop somebody reaches
   * for will be spelled something the absence list does not contain.
   */
  it("declares only geometry, a label and an id", () => {
    expect(new Set(humanMarkPropKeys())).toEqual(new Set(["x", "y", "label", "id"]));
  });

  it("declares no prop that could carry a colour", () => {
    const keys = humanMarkPropKeys();
    for (const banned of ["tone", "className", "style", "color", "fill", "stroke"]) {
      expect(keys, `HumanMark must not accept "${banned}"`).not.toContain(banned);
    }
  });

  /** It paints from the constant, so the rule stays in one place for the whole site. */
  it("takes its colour from HUMAN_PRESENCE_MARK and from no tone", () => {
    const body = withoutBlockComments(
      GLYPHS.slice(GLYPHS.indexOf("export function HumanMark(")),
    );
    expect(body).toContain("HUMAN_PRESENCE_MARK.color");
    expect(body).toContain("HUMAN_PRESENCE_MARK.glyph");
    expect(body).not.toContain("toneColor");
    expect(body).not.toContain("VIZ_TONE");
  });

  /**
   * The tone table has both colours in it, so the one thing worth asserting is that they
   * are two entries and not one. `--color-signal` is spent on defects; a graph where a
   * person acts has not got one.
   */
  it("keeps the human tone apart from the alarm tone", () => {
    expect(VIZ_TONE.human).toBe(HUMAN_PRESENCE_MARK.color);
    expect(toneColor("human")).toBe(HUMAN_PRESENCE_MARK.color);
    expect(VIZ_TONE.human).not.toBe(VIZ_TONE.signal);
  });

  /** The alarm colour is reachable through a tone name, and named nowhere in the glyphs. */
  it("never names the alarm colour in the drawing vocabulary", () => {
    const stripped = withoutBlockComments(GLYPHS);
    expect(stripped).not.toContain("--color-signal");
    expect(stripped).not.toContain("text-signal");
  });
});

/* --------------------- 2. no hex --------------------- */

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

/* --------------------- 3. the selectors seven scenes will target --------------------- */

describe("the anime.js selectors match what the glyphs write", () => {
  /**
   * `VIZ_SELECTOR` is the contract the other scenes drive their timelines through, and it
   * is a string on one side of the file and an attribute on the other. Nothing but a scan
   * connects them.
   */
  it.each(Object.entries(VIZ_SELECTOR))("%s is written by a glyph", (_name, selector) => {
    const attribute = selector.slice(1, -1);
    expect(GLYPHS).toContain(attribute);
  });
});

/* --------------------- 4. the wiring arithmetic --------------------- */

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
