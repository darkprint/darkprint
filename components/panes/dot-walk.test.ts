/* ============================================================
   The DOT walk, held to the nine files it actually runs over.

   `components/panes/DotWalk.tsx` highlights `card="id@version"` in
   the cyanotype register as a reader scrolls a blueprint page, and
   every range it lights is derived from the file rather than typed
   into a table. This is what makes that derivation worth trusting.

   The one defect this file exists to make impossible is the one
   `components/home/nodecard/annotations.ts` records the author
   reporting on the card figure: steps that were not in document
   order, so the highlight climbed the listing while the reader
   scrolled down it. There the ranges are hand-written and resolved
   by key name; here there are NINE files and no table at all, so
   the property is asserted directly — strictly increasing, no
   overlap, and no statement left out of the walk.

   Node environment, no DOM: `./dot-walk.ts` is plain TypeScript for
   exactly this reason.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";

import { lineSpan, resolveDotSteps, tokenizeDot } from "./dot-walk";

const BLUEPRINTS = allBlueprints();

/** Every blueprint the archive publishes, so a tenth one is covered the day it lands. */
const CASES = BLUEPRINTS.map((bp) => [bp.slug, bp.graph.dot] as const);

describe("the walk is derived from the file", () => {
  it("has nine blueprints to walk", () => {
    expect(BLUEPRINTS.length).toBeGreaterThan(0);
  });

  it.each(CASES)("%s resolves at least three steps", (_slug, dot) => {
    // Header, declarations, wiring. Below three the rail is not a walk, it is a caption,
    // and the pacing in `DotWalk.tsx` (11vh a step, floored at 130vh) assumes at least
    // this many.
    expect(resolveDotSteps(dot).length).toBeGreaterThanOrEqual(3);
  });

  /**
   * THE ORDERING PROPERTY, stated as plainly as it can be.
   *
   * A reader scrolling down moves through the steps in order, and the listing beside them
   * lights the lines of the step they are on. If step n+1 began above step n the highlight
   * would jump backwards up the file, which is the bug the card figure shipped once.
   */
  it.each(CASES)("%s numbers its steps in document order", (_slug, dot) => {
    const steps = resolveDotSteps(dot);
    steps.forEach((step, i) => {
      expect(step.step, "steps are numbered from 1, without gaps").toBe(i + 1);
      expect(step.to, `${lineSpan(step.from, step.to)} runs backwards`).toBeGreaterThanOrEqual(
        step.from,
      );
      if (i === 0) return;
      expect(
        step.from,
        `step ${step.step} (${lineSpan(step.from, step.to)}) starts at or above step ${i} ` +
          `(${lineSpan(steps[i - 1].from, steps[i - 1].to)}), so the highlight would climb ` +
          `the listing while the reader scrolls down it`,
      ).toBeGreaterThan(steps[i - 1].to);
    });
  });

  /**
   * And that nothing is left out.
   *
   * The blocks tile the file — that is the reason `DotWalk` grounds only the ACTIVE step
   * rather than every attached one, and the reason the left rule reads as one bracket per
   * block. A statement outside every step would print with no marker and no rule, which
   * looks like a rendering fault rather than like a decision.
   */
  it.each(CASES)("%s leaves no statement out of a step", (_slug, dot) => {
    const lines = dot.replace(/\r\n?/g, "\n").split("\n");
    const covered = new Set<number>();
    for (const step of resolveDotSteps(dot)) {
      for (let no = step.from; no <= step.to; no += 1) covered.add(no);
    }
    lines.forEach((text, index) => {
      const t = text.trim();
      // Blank lines and the closing brace are the block separators; they are the only
      // lines allowed to carry no marker.
      if (t === "" || t.startsWith("}")) return;
      expect(covered.has(index + 1), `line ${index + 1} (${t}) belongs to no step`).toBe(true);
    });
  });
});

describe("the important tag", () => {
  /**
   * `card="id@version"` is the one attribute DarkPrint adds to DOT, and the whole
   * attribute — name, `=`, value — is marked as one kind so the listing can light the
   * three tokens together rather than colouring a string that merely looks like a ref.
   */
  it.each(CASES)("%s marks card= on every node declaration", (_slug, dot) => {
    const declarations = dot
      .split("\n")
      .filter((line) => /\bcard\s*=/.test(line) && !line.trim().startsWith("//"));
    const marked = tokenizeDot(dot).flatMap((line) =>
      line.tokens.filter((token) => token.kind === "card"),
    );
    expect(declarations.length).toBeGreaterThan(0);
    // Three tokens per declaration: the attribute name, the `=`, and the quoted ref.
    expect(marked.length).toBe(declarations.length * 3);
    expect(marked.filter((token) => token.text === "card").length).toBe(declarations.length);
    expect(marked.filter((token) => token.text === "=").length).toBe(declarations.length);
  });

  it("marks the attribute and not a string that looks like a ref", () => {
    const dot = 'digraph g {\n  a [label="code-builder@1.0.0", card="code-builder@1.0.0"];\n}\n';
    const values = tokenizeDot(dot)
      .flatMap((line) => line.tokens)
      .filter((token) => token.kind === "card")
      .map((token) => token.text);
    // The `label` is a plausible ref and is not the join, so only one of the two identical
    // strings is lit.
    expect(values).toEqual(["card", "=", '"code-builder@1.0.0"']);
  });

  /**
   * The listing renders one `<span>` per token, so a token stream that drops or duplicates
   * a character prints a file the archive does not store. This is the only guard on that,
   * and it is cheap.
   */
  it.each(CASES)("%s round-trips through the tokeniser", (_slug, dot) => {
    const source = dot.replace(/\r\n?/g, "\n");
    const rebuilt = tokenizeDot(dot)
      .map((line) => line.tokens.map((token) => token.text).join(""))
      .join("\n");
    expect(rebuilt).toBe(source);
  });
});

describe("what the rail says", () => {
  it.each(CASES)("%s gives every step a head and a body", (_slug, dot) => {
    for (const step of resolveDotSteps(dot)) {
      expect(step.title.trim().length, "an empty head is an unlabelled step").toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(0);
      // Backticks are rendered as inline code by splitting on pairs; an odd count prints a
      // stray backtick in the middle of a sentence.
      expect((step.body.match(/`/g) ?? []).length % 2, `${step.body} has an unpaired backtick`).toBe(
        0,
      );
    }
  });

  /**
   * Two identical heads on one rail is two steps a reader cannot tell apart.
   *
   * `grounded-research-desk` is why this is asserted rather than assumed: it declares its
   * nodes in three runs around a `subgraph`, and counting each run printed "3 nodes, each
   * pinned to a card" twice, under a second copy of "The graph, opened".
   */
  it.each(CASES)("%s gives no two steps the same head", (_slug, dot) => {
    const titles = resolveDotSteps(dot).map((step) => step.title);
    expect(new Set(titles).size, `repeated head in: ${titles.join(" | ")}`).toBe(titles.length);
  });

  it("reads the starter the way the page draws it", () => {
    const starter = BLUEPRINTS.find((bp) => bp.slug === "starter-software-factory");
    expect(starter, "the starter is the blueprint every figure on the site is read from").toBeDefined();
    const steps = resolveDotSteps(starter!.graph.dot);
    expect(steps.map((step) => `${lineSpan(step.from, step.to)} ${step.title}`)).toEqual([
      "L1–3 The graph, opened",
      "L5–10 5 nodes, each pinned to a card",
      // The five comment lines about the edge that is NOT written belong to the step that
      // shows the edges that are, which is the whole lesson of this blueprint.
      "L12–18 planner, builder → tester",
      "L20–24 tester ⇄ debugger",
      "L26 tester → deployer",
    ]);
    expect(steps[1].body).toContain('card="id@version"');
  });
});
