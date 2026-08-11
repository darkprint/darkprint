/* ============================================================
   The mark: its edges are arithmetic, and its favicon is a copy.

   Two things about `Logo.tsx` can go wrong silently, and both have
   gone wrong once already in the drawing this component replaced.

   **The edges.** They run between two node centres, trimmed at each
   end so they stop at the rim rather than under the disc. The first
   draft hand-typed them and shipped a horizontal edge between two
   nodes at different heights: it connected nothing, and it looked
   fine at a glance because a short line at a shallow angle reads as
   straight. `edge()` computes them now, and this holds the output
   against the values the hand-off states — the only way to know the
   formula and the intended drawing still agree.

   **The favicon.** `app/icon.svg` is fetched by the browser with no
   stylesheet behind it, so it cannot use the theme variables every
   other surface reads. It carries four hexes, and a copy that can
   drift is exactly what "never write a hex" exists to prevent. This
   reads both files and fails when they stop agreeing.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { edge, inkFloorInset } from "./Logo";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("the edges are computed, not typed", () => {
  /**
   * The two edges of the full-size mark, as the hand-off states them. Both were produced
   * by the formula; if the formula changes, these change with it and this case is the
   * conversation about whether that was intended.
   */
  it("trims each edge at both ends, at the full size", () => {
    expect(edge({ x: 21, y: 40, tone: "trigger" }, { x: 35, y: 36, tone: "planner" }, 5)).toBe(
      "M25.81 38.63L30.19 37.37",
    );
    expect(edge({ x: 35, y: 36, tone: "planner" }, { x: 47, y: 44, tone: "ship" }, 5)).toBe(
      "M39.16 38.77L42.84 41.23",
    );
  });

  /**
   * The defect the formula exists to prevent, stated as a property: an edge between two
   * nodes at different heights is not horizontal. A hand-typed constant is how that
   * shipped, and it is invisible at a glance.
   */
  it("never draws a level line between nodes at different heights", () => {
    const path = edge({ x: 21, y: 40, tone: "trigger" }, { x: 35, y: 36, tone: "planner" }, 5);
    const [, y1, y2] = /M[\d.]+ ([\d.]+)L[\d.]+ ([\d.]+)/.exec(path) ?? [];
    expect(Number(y1)).not.toBe(Number(y2));
  });

  /** And it stops short of both discs rather than running under them. */
  it("keeps the whole trim inside the distance between the centres", () => {
    const a = { x: 24, y: 41, tone: "trigger" as const };
    const b = { x: 42, y: 41, tone: "ship" as const };
    const path = edge(a, b, 6);
    expect(path).toBe("M30 41L36 41");
    // Both ends moved inward by the port, so the drawn length is |d| - 2·port.
    expect(36 - 30).toBe(Math.hypot(b.x - a.x, b.y - a.y) - 12);
  });
});

describe("the mark stands on the wordmark's baseline", () => {
  /**
   * The lockup is two halves and one of them is easy to lose.
   *
   * `SiteHeader` sets `items-baseline`, which puts the mark's BOX bottom on the type's
   * baseline; `align="baseline"` then pushes the drawing down by its own empty band so the
   * INK lands there instead. Drop either half and the mark hangs low again, silently: the
   * header still renders, nothing throws, and the defect is 3.6px that nobody measures
   * twice. So both halves are asserted against the source.
   */
  it("keeps both halves of the lockup in the header", () => {
    const header = read("components/site/SiteHeader.tsx");
    expect(header).toContain("items-baseline");
    expect(header).toContain('<Logo size={24} align="baseline" />');
  });

  /**
   * The inset is the air under the drawing, derived rather than measured.
   *
   * `FRONT_FLAP` bottoms out at 56 in the 64 box and its stroke is centred on the path, so
   * the lowest ink sits at `56 + stroke/2` and the rest of the box is empty. At the 24 rung
   * the stroke is 3, which puts the floor at 57.5 and leaves 6.5 of the 64 empty: 2.4375px
   * once the box is 24 across. That number is what the transform spends, and it is here so
   * a change to the flap or to a rung's stroke fails against the drawing rather than
   * shifting the header by a pixel nobody notices.
   */
  it("computes the inset from the flap and the stroke, at every rung", () => {
    const floor = (stroke: number) => 56 + stroke / 2;
    const expected = (size: number, stroke: number) => ((64 - floor(stroke)) / 64) * size;

    expect(inkFloorInset(24)).toBeCloseTo(2.4375, 6);
    expect(inkFloorInset(24)).toBeCloseTo(expected(24, 3), 6);
    expect(inkFloorInset(64)).toBeCloseTo(expected(64, 1.8), 6);
    expect(inkFloorInset(32)).toBeCloseTo(expected(32, 2.4), 6);
    // The 16 rung strokes hardest, so it leaves the least air under the drawing.
    expect(inkFloorInset(16)).toBeCloseTo(expected(16, 4.5), 6);
  });

  /** And the flap the arithmetic reads still bottoms out where it says it does. */
  it("reads the floor off the flap the component actually draws", () => {
    const logo = read("components/site/Logo.tsx");
    const flap = /const FRONT_FLAP =\s*\n?\s*"([^"]+)"/.exec(logo)?.[1];
    // "…v22a4 4 0 0 1-4 4…": 26 down to 26+4+22 = 52, then the corner arc adds the last 4.
    expect(flap).toContain("V28");
    expect(flap).toContain("v22a4 4 0 0 1-4 4");
    expect(26 + 4 + 22 + 4).toBe(56);
  });
});

describe("the favicon and the theme agree", () => {
  const icon = read("app/icon.svg");
  const globals = read("app/globals.css");

  /** Each hex in the icon, against the token it is a copy of. */
  const COPIES: [token: string, hex: string][] = [
    ["--color-blueprint-deep", "#061c52"],
    ["--color-blueprint-line", "#74b4ff"],
    ["--color-cyan-bright", "#7dd3fc"],
    ["--color-emerald", "#34d399"],
  ];

  it("names a token for every colour it hard-codes", () => {
    const hexes = new Set([...icon.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0].toLowerCase()));
    expect(hexes.size).toBeGreaterThan(0);
    for (const hex of hexes) {
      expect(
        COPIES.some(([, known]) => known === hex),
        `app/icon.svg paints ${hex}, which is not one of the four tokens it copies`,
      ).toBe(true);
    }
  });

  it.each(COPIES)("%s is still %s in the theme", (token, hex) => {
    expect(
      globals,
      `app/icon.svg copies ${hex} for ${token}; app/globals.css no longer says that`,
    ).toContain(`${token}: ${hex};`);
    expect(icon).toContain(hex);
  });

  /**
   * The 16px rung drops the back plate and the tab: at that size they are two grey pixels.
   * The flap's own path is what is left, and it has to be the same one the component draws
   * or the favicon is a different silhouette from the mark it is a rung of.
   */
  it("draws the 16px rung: the flap, one edge, two solid discs, no plate", () => {
    const logo = read("components/site/Logo.tsx");
    const flap = /const FRONT_FLAP =\s*\n?\s*"([^"]+)"/.exec(logo)?.[1];
    expect(flap, "Logo.tsx no longer declares FRONT_FLAP").toBeDefined();
    expect(icon).toContain(flap!);
    // And not the plate, whose path the component keeps for the three larger rungs.
    const plate = /const BACK_PLATE =\s*\n?\s*"([^"]+)"/.exec(logo)?.[1];
    expect(plate).toBeDefined();
    expect(icon).not.toContain(plate!);
    expect([...icon.matchAll(/<circle/g)]).toHaveLength(2);
  });
});
