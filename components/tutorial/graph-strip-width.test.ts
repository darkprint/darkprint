/* ============================================================
   Nothing in the graph strip may walk out of the track it sits in
   ------------------------------------------------------------
   The strip is a grid of fixed and near-fixed tracks — 128px for a
   connector, `minmax(150px,1fr)` for a node — and three of the values
   it draws are vocabulary the reader types: the node's `type`, and the
   two port types either end of an edge. A span holding one of those
   with no width cap overflows its track VISIBLY and lands on the boxes
   either side, at every viewport, not only on a phone. §11.0 Q11 asked
   for 390 and 768; this one was found by reading and is width
   independent.

   ── why this is a source check ──
   The same reason `wizard-shape.test.ts` gives: proving it properly
   means measuring a laid-out box, this suite runs in `node`, and jsdom
   is a dependency the constraint sheet refuses. So this checks the
   construction rather than the geometry: every span in the strip that
   renders a reader-typed value carries a cap on the same element.

   It is deliberately narrow. It does not prove nothing overlaps. It
   proves the three caps that stop the overlap are still there, and it
   names what each of them is for.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const RAW = readFileSync(`${HERE}GraphStrip.tsx`, "utf8");

/**
 * The file with its block comments removed.
 *
 * Load-bearing rather than tidiness: the comment above the type pill NAMES the class it
 * replaced, so a `not.toMatch(/shrink-0/)` over the raw text reds against the corrected
 * file. A checker that cannot see past its subject's own explanation of itself is
 * checking the explanation. Line comments are left alone; none of them sits inside a JSX
 * opener, which is the only place these cells read.
 */
const STRIP = RAW.replace(/\/\*[\s\S]*?\*\//g, " ");

/**
 * The source of one function, from its `function` line to the next one at column zero.
 *
 * Read per function rather than over the whole file so a cap in `NodeBox` cannot answer
 * for a missing cap in `EdgeConnector`: the two draw different values into different
 * tracks and each has to carry its own.
 */
function block(name: string): string {
  const at = STRIP.indexOf(`function ${name}(`);
  if (at === -1) throw new Error(`no \`${name}\` in GraphStrip.tsx`);
  const rest = STRIP.slice(at + name.length);
  const next = rest.search(/\n(?:export )?function /);
  return next === -1 ? rest : rest.slice(0, next);
}

/**
 * The `<span …>` openers in a block, with what each one wraps.
 *
 * A self-closing span wraps NOTHING, and saying so is the difference between this reading
 * the file and reading its neighbour: the status dot in `NodeBox` is `<span … />`, so a
 * search for its closing tag runs past it and picks up the node name in the span below.
 * That miscount is what the first version of this did, and it reported two spans rendering
 * `node.name` where the file has one.
 */
function spans(source: string): { opener: string; body: string }[] {
  return [...source.matchAll(/<span\b[^>]*?(\/?)>/g)].map((m) => {
    const opener = m[0];
    if (m[1] === "/") return { opener, body: "" };
    const from = m.index + opener.length;
    const to = source.indexOf("</span>", from);
    return { opener, body: source.slice(from, to === -1 ? undefined : to) };
  });
}

/** Every span opener that carries `needle` in the element it opens. */
function spansRendering(source: string, needle: string): string[] {
  return spans(source)
    .filter((span) => span.body.includes(needle))
    .map((span) => span.opener);
}

/** A cap that stops the element growing past the box it is in, however it then behaves. */
const CAPPED = /max-w-full|min-w-0/;

describe("the graph strip caps every value the reader types", () => {
  it("does not pass vacuously", () => {
    /* The file has to be the file, and the two blocks have to be the two blocks: a rename
       would otherwise turn every cell below into a statement about an empty string, and
       `block` throwing is a louder failure than a green run. */
    expect(STRIP.length).toBeGreaterThan(4000);
    expect(block("NodeBox").length).toBeGreaterThan(500);
    expect(block("EdgeConnector").length).toBeGreaterThan(300);
    /* And the reader has to find spans that exist and miss ones that do not, or it is a
       matcher that reds nothing whatever the file says. */
    expect(spansRendering(block("EdgeConnector"), "edge.shape")).toHaveLength(1);
    expect(spansRendering(block("EdgeConnector"), "edge.nothing")).toHaveLength(0);
    expect(CAPPED.test("font-mono text-[11px]")).toBe(false);
    /* And the comment stripper has to have run, or the cells below read the prose that
       names the classes rather than the classes. */
    expect(RAW).toContain("rather than `shrink-0`");
    expect(STRIP).not.toContain("rather than `shrink-0`");
    expect(STRIP).toContain("min-w-0 truncate rounded-sm");
  });

  it("caps the type pill, which sits in a 150px node column", () => {
    /* `shrink-0` is what this replaced: a pill that refuses to shrink walks out of the box
       at about nineteen characters, and `node.type` is free text with a datalist over it
       rather than a closed set. */
    const pill = spansRendering(block("NodeBox"), "node.type");
    expect(pill).toHaveLength(1);
    expect(pill[0]).toMatch(CAPPED);
    expect(pill[0]).not.toMatch(/shrink-0/);
  });

  it("caps the node name in the same row", () => {
    const name = spansRendering(block("NodeBox"), "node.name");
    expect(name).toHaveLength(1);
    expect(name[0]).toMatch(CAPPED);
  });

  it("caps both ends of an edge, which sit in a 128px connector column", () => {
    /* `unstructured-text ≠ acceptance-criteria` is 39 characters in a 112px box. */
    const ends = spansRendering(block("EdgeConnector"), "edge.from");
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatch(/max-w-full/);
  });

  it("lets the mismatch wrap rather than truncating it", () => {
    /* Not a style preference. `≠` is the entire content of that line, and
       `unstructured-tex…` reads as a pair that matches — a truncation that says the
       opposite of what the value says. The shape line below it truncates because losing
       the tail of a record shape costs a reader nothing they cannot see in the file. */
    const ends = spansRendering(block("EdgeConnector"), "edge.from");
    expect(ends[0]).not.toMatch(/\btruncate\b/);
    expect(ends[0]).toMatch(/break-words/);
    expect(spansRendering(block("EdgeConnector"), "edge.shape")[0]).toMatch(/\btruncate\b/);
  });
});
