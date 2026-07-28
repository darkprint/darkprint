/* ============================================================
   The hero draws a bundle the site ships, and this is what keeps
   it that way.

   Spec §0.4: nothing may be described as working that is not
   built. The hero's whole argument rests on the drawing being a
   real blueprint rather than an illustration of one, so the node
   ids, the edge list and the labels below are checked against
   `content/blueprints/starter-software-factory/blueprint.dot`
   with the engine's own parser, and the phase under each box is
   checked against the card that node declares. Edit the DOT and
   this file says which part of the picture went stale.

   The rest is the two rules a drawing can break silently: a glyph
   outside its own frame, and a wire that starts drawing before the
   boxes it connects are there.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseDot } from "@/lib/core";
import { VIZ } from "@/components/viz";

import { HERO_CHIP_START, HERO_NARROW, HERO_WIDE, type HeroLayout } from "./graph";

/** Repo root: this file is `<root>/components/hero/`. */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const BLUEPRINT = "content/blueprints/starter-software-factory/blueprint.dot";

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

const parsed = parseDot(read(BLUEPRINT));

const LAYOUTS: [string, HeroLayout][] = [
  ["wide", HERO_WIDE],
  ["narrow", HERO_NARROW],
];

describe("the hero draws the starter blueprint", () => {
  it("parses the source it claims to draw", () => {
    // Everything below reads `parsed.graph`. A parse that failed would make each of them
    // vacuously true.
    expect(parsed.graph, `${BLUEPRINT} did not parse`).toBeDefined();
    expect(parsed.graph?.nodes).toHaveLength(5);
    expect(parsed.graph?.edges).toHaveLength(5);
  });

  it.each(LAYOUTS)("%s: the boxes are the DOT's nodes, in its order", (_name, layout) => {
    expect(layout.nodes.map((node) => node.id)).toEqual(
      parsed.graph?.nodes.map((node) => node.id),
    );
  });

  it.each(LAYOUTS)("%s: the wires are the DOT's edges, in its order", (_name, layout) => {
    expect(layout.edges.map((edge) => `${edge.source} -> ${edge.target}`)).toEqual(
      parsed.graph?.edges.map((edge) => `${edge.source} -> ${edge.target}`),
    );
  });

  it("labels each wire with what the DOT says it carries", () => {
    // Only the wide placement carries labels; the narrow one drops them so its boxes can
    // stay legible on a phone, and `graph.ts` states why.
    expect(HERO_WIDE.edges.map((edge) => edge.label)).toEqual(
      parsed.graph?.edges.map((edge) => edge.attrs.label),
    );
    expect(HERO_NARROW.edges.every((edge) => edge.label === undefined)).toBe(true);
  });

  it("names the phase each node's own card declares", () => {
    // The sheet's title block reads "five nodes, one per phase", which is a claim about
    // `content/cards/` rather than about the drawing.
    for (const node of parsed.graph?.nodes ?? []) {
      const ref = node.attrs.card;
      expect(ref, `${node.id} declares no card`).toBeTruthy();
      const card = read(`content/cards/${ref}.yaml`);
      const declared = /^phase:\s*(\S+)\s*$/m.exec(card)?.[1];
      const drawn = HERO_WIDE.nodes.find((box) => box.id === node.id)?.phase;
      expect(drawn, `${node.id} is not in the drawing`).toBe(declared);
    }
  });
});

describe("the drawing fits the frame it reserves", () => {
  it.each(LAYOUTS)("%s: every box is inside the viewBox", (_name, layout) => {
    const outside = layout.nodes.filter(
      (node) =>
        node.x - VIZ.node.width / 2 < 0 ||
        node.x + VIZ.node.width / 2 > layout.width ||
        node.y - VIZ.node.height / 2 < 0 ||
        node.y + VIZ.node.height / 2 > layout.height,
    );
    expect(outside.map((node) => node.id)).toEqual([]);
  });

  it.each(LAYOUTS)("%s: every wire endpoint is inside the viewBox", (_name, layout) => {
    const points = layout.edges.flatMap((edge) => [edge.from, edge.to]);
    const outside = points.filter(
      ([x, y]) => x < 0 || x > layout.width || y < 0 || y > layout.height,
    );
    expect(outside).toEqual([]);
  });

  it.each(LAYOUTS)("%s: no two boxes overlap", (_name, layout) => {
    const overlaps: string[] = [];
    for (const a of layout.nodes) {
      for (const b of layout.nodes) {
        if (a.id >= b.id) continue;
        const apart =
          Math.abs(a.x - b.x) >= VIZ.node.width || Math.abs(a.y - b.y) >= VIZ.node.height;
        if (!apart) overlaps.push(`${a.id} / ${b.id}`);
      }
    }
    expect(overlaps).toEqual([]);
  });
});

describe("the choreography follows the graph", () => {
  it.each(LAYOUTS)("%s: no wire draws before both of its ends", (_name, layout) => {
    const landed = new Map(layout.nodes.map((node) => [node.id, node.start]));
    for (const edge of layout.edges) {
      expect(edge.start).toBeGreaterThan(landed.get(edge.source) ?? 0);
      expect(edge.start).toBeGreaterThan(landed.get(edge.target) ?? 0);
    }
  });

  it("settles the classification after the last wire", () => {
    const last = Math.max(...HERO_WIDE.edges.map((edge) => edge.start));
    expect(HERO_CHIP_START).toBeGreaterThan(last);
  });

  it("runs both placements on one clock", () => {
    // The two are in the DOM at once and the timeline drives them together, so a beat
    // that differed between them would show up the moment a tablet changed orientation.
    expect(HERO_NARROW.nodes.map((node) => node.start)).toEqual(
      HERO_WIDE.nodes.map((node) => node.start),
    );
    expect(HERO_NARROW.edges.map((edge) => edge.start)).toEqual(
      HERO_WIDE.edges.map((edge) => edge.start),
    );
  });
});

/* --------------------- the copy the hero puts on screen --------------------- */

const COPY_FILES = ["components/hero/Hero.tsx", "components/hero/HeroGraph.tsx"];

/**
 * Comments out, so what is left is roughly what a reader sees. Same method and same
 * reason as `components/build/path.test.ts`: a comment that quotes a rule is the rule
 * being honoured, and reading it as a breach would push the next author to stop writing
 * the reason down.
 */
function visibleCopy(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"])\/\/.*$/, "$1"))
    .join("\n");
}

describe("the hero's copy obeys doc 2", () => {
  it.each(COPY_FILES)("%s uses no em dash as a pause", (path) => {
    // §2.5 lists it first among the four AI-writing patterns to keep off the site.
    const offending = visibleCopy(read(path))
      .split("\n")
      .map((line, i) => ({ line: line.trim(), at: i + 1 }))
      .filter((entry) => entry.line.includes("—"));
    expect(offending.map((e) => `${path}:${e.at}  ${e.line}`)).toEqual([]);
  });

  it.each(COPY_FILES)("%s puts no verdict on the classification", (path) => {
    /* §1.1: the class is a description. The hero is where a badge would most naturally
       grow, since it is the one surface with a single graph on it and nothing to compare
       that graph against. */
    const text = visibleCopy(read(path)).toLowerCase();
    for (const phrase of [
      "autonomy level",
      "fully autonomous",
      "out of 4",
      "highest level",
      "falls short",
      "maximum autonomy",
      "badge",
      "award",
    ]) {
      expect(text, `${path} contains "${phrase}"`).not.toContain(phrase);
    }
  });

  it.each([...COPY_FILES, "components/hero/graph.ts"])(
    "%s hardcodes no colour",
    (path) => {
      // Every colour on the site is a variable in `app/globals.css`; a literal here is
      // invisible until the palette moves and then it is wrong on one drawing only.
      expect(visibleCopy(read(path))).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    },
  );
});
