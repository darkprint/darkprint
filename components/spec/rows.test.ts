/* ============================================================
   The four Attractor claims this site had backwards, held down.

   Every sentence guarded here was shipped WRONG for a release, and
   each one was wrong in a way no gate could see: the copy modules
   are plain data, nothing renders them under assertion, and a
   reversed precedence reads exactly as fluently as the right one.
   Flipping `model` back to "a stylesheet outranks the card's line"
   reddened nothing in `components/spec`, `components/site` or
   `app/spec` before this file existed.

   So the guard is over the DATA the pages render, never over the
   source text. Three of the modules below carry a comment that
   QUOTES the inverted claim, on purpose, so the next person to read
   the row knows which way it fell and why. A checker that scanned
   the file would charge the explanation for the error it explains.
   `ConceptFigures.tsx` is the one exception, because its sentence
   is a JSX attribute and there is nothing to import; the extraction
   below takes the string literal only, and the assertion never sees
   the comment above it.

   ── Why §8.5 and not §2.6 ──
   Attractor spec §2.6's one-line gloss on `llm_model` is
   "Overridable by stylesheet". It names the field and does not rank
   it against anything, and reading it as a ranking is exactly how
   three surfaces on this site came to say the sheet wins. §8.3
   settles it in a sentence ("Explicit node attributes always
   override stylesheet values") and §8.5 settles it as an ordered
   list with the transform's own rule underneath. Citing §8.5 is
   therefore part of the claim and not decoration: a sentence that
   cites §2.6 has cited the thing that produced the error.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { NODE_CARD_ANNOTATIONS } from "@/components/home/nodecard/annotations";
import { FIELD_NOTE } from "@/components/panes/field-notes";
import { CARD_ROWS, TOPOLOGY_ROWS } from "./rows";

/* --------------------- the model stylesheet, spec §8.5 --------------------- */

/**
 * The `model` sentence on every surface that carries one.
 *
 * Four of them, in four packages, and they are one claim. They were not four before: the
 * card table and the node-card walk said the sheet wins, the reach figure said "and
 * overridable" without saying which way, and `FIELD_NOTE` alone had it right. A reader
 * who visited two of the four got two answers.
 */
const MODEL_SENTENCES: readonly (readonly [string, string])[] = [
  ["CARD_ROWS", CARD_ROWS.find((row) => row.name === "model")?.what ?? ""],
  ["FIELD_NOTE", FIELD_NOTE.model],
  [
    "NODE_CARD_ANNOTATIONS",
    NODE_CARD_ANNOTATIONS.find((step) => step.id === "model")?.body ?? "",
  ],
  ["ConceptFigures", conceptFiguresModelNote()],
];

/**
 * The `note` on the `model` row of `WhatACardReaches`, read out of the source.
 *
 * Anchored on `field="model"` and then on the first `note="` after it, so the docblock
 * between the two — which quotes the wrong reading in order to explain it — is never part
 * of what the assertions see.
 */
function conceptFiguresModelNote(): string {
  // Resolved off this file's own URL and not off the cwd, the way `roles.test.ts` and
  // `honesty.test.ts` do it: a suite run from a subdirectory would otherwise read nothing
  // and throw, which reads as a broken test rather than as a moved file.
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const source = readFileSync(join(root, "components/explain/ConceptFigures.tsx"), "utf8");
  const match = /field="model"[\s\S]*?note="([^"]*)"/.exec(source);
  if (match === null) throw new Error("no model row with a note in ConceptFigures.tsx");
  return match[1];
}

describe("the model stylesheet, in the direction spec §8.5 gives it", () => {
  /**
   * The inverted readings, quoted from the four sentences that actually shipped them.
   *
   * Literal phrases and not a pattern for the subject of "outranks", because the first
   * attempt at this guard was that pattern and it reddened three CORRECT sentences: a
   * sentence that ranks the field above the sheet names the sheet a few words earlier
   * ("an explicit field here outranks the sheet"), and no window small enough to exclude
   * it is large enough to catch "A model stylesheet in the graph would outrank it".
   *
   * Each entry below has been run against the repaired copy, where it matches nothing,
   * and against the sentence it was taken from, where it matches. The cost of a list is
   * that a fifth way of saying it backwards would pass; the cost of the pattern was that
   * saying it forwards failed, which is worse in both directions.
   */
  const INVERTED = [
    /\bwould outrank\b/i,
    /\boverrid\w*\b[^.]*\bstylesheet\b/i,
    /\b(model_)?stylesheets?\b[^.]*\boutranks?\b[^.]*\b(node|card|field|attribute|line)\b/i,
    /\bsheet outranks?\b/i,
  ];

  it.each(MODEL_SENTENCES)("%s says something about the sheet at all", (_where, text) => {
    // The premise. A sentence that stopped naming the stylesheet would pass every
    // assertion below by saying nothing, which is the failure this whole file is about.
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toContain("stylesheet");
  });

  it.each(MODEL_SENTENCES)("%s does not put the sheet above the card", (_where, text) => {
    for (const pattern of INVERTED) {
      expect(pattern.test(text), `${text}\n  matched ${pattern}`).toBe(false);
    }
  });

  /**
   * The three shapes the repaired sentences use, and a fourth is allowed to be added
   * here. What is not allowed is a sentence with no direction in it at all: the reach
   * figure said "written the way the provider writes it, and overridable", which is true
   * of both readings and so corroborates whichever one the reader arrived with.
   */
  const DIRECTED = [
    // "an explicit field here outranks the sheet"
    /\b(field|attribute|line|one)\b[^.;]{0,40}\boutranks?\b/i,
    // "spec §8.5 ranks an explicit node attribute above every stylesheet rule"
    /\branks?\b[^.;]*\b(attribute|field|line)\b[^.;]*\babove\b/i,
    // "a stylesheet on the graph is a default for the nodes that name no model"
    /\b(stylesheet|sheet)\b[^.;]*\bdefault\b[^.;]*\b(no|none)\b/i,
  ];

  it.each(MODEL_SENTENCES)("%s says the node's own line wins", (_where, text) => {
    const directed = DIRECTED.some((pattern) => pattern.test(text));
    expect(directed, `no direction in: ${text}`).toBe(true);
  });

  /**
   * §2.6 is the gloss that produced the error. A citation of it here is not a small
   * imprecision: it hands the next reader the sentence the inversion was derived from.
   */
  it.each(MODEL_SENTENCES)("%s cites no section that does not rank the two", (_where, text) => {
    expect(text).not.toContain("§2.6");
  });

  it("cites §8.5 where the sentence cites anything", () => {
    const cited = MODEL_SENTENCES.filter(([, text]) => text.includes("§"));
    expect(cited.length).toBeGreaterThan(0);
    for (const [where, text] of cited) {
      expect(text, where).toContain("§8.5");
    }
  });
});

/* --------------------- the DOT reference, spec §2.8 and §3.3 --------------------- */

describe("the topology table files each attribute where the runner reads it", () => {
  const row = (fragment: string) =>
    TOPOLOGY_ROWS.find((r) => r.name.includes(fragment));

  /**
   * `shape` sat in one row with `rankdir` and `style` under the word "Graphviz layout".
   * It is the handler selector (§2.8), which makes it the attribute a compiled file's
   * behaviour hangs off, and filing it with the layout attributes is the single largest
   * understatement the DOT table made.
   */
  it("does not file shape with the layout attributes", () => {
    const layout = TOPOLOGY_ROWS.filter((r) => /graphviz layout/i.test(r.what));
    expect(layout.length).toBeGreaterThan(0);
    for (const r of layout) {
      expect(r.name.toLowerCase(), `${r.name} is filed as layout`).not.toContain("shape");
      expect(r.what.toLowerCase()).not.toContain("shape");
    }
  });

  it("gives shape its own row, as the handler selector", () => {
    const shape = row("shape");
    expect(shape, "no row names shape").toBeDefined();
    expect(shape?.what).toContain("§2.8");
    expect(shape?.what.toLowerCase()).toContain("handler");
  });

  /**
   * `label` is compared against nothing HERE and is a routing key THERE (§3.3 Step 2).
   * The row gave only the first reading, which is true of DarkPrint and false of the
   * artefact the same page tells the reader to compile.
   */
  it("gives the edge label both of its readings", () => {
    const label = row("label=");
    expect(label, "no row names the edge label").toBeDefined();
    expect(label?.what).toMatch(/compares it against nothing|compared against nothing/i);
    expect(label?.what).toContain("§3.3");
  });

  it.each([
    ["condition", "condition="],
    ["weight", "weight="],
  ])("names %s and cites the algorithm that reads it", (_key, fragment) => {
    const found = row(fragment);
    expect(found, `no row names ${fragment}`).toBeDefined();
    expect(found?.what).toContain("§3.3");
  });

  /**
   * The surprise, and the reason the two rows above are not enough on their own: a fork
   * with no guard on either edge is not a validation error anywhere. §3.3 falls through
   * to weight and then to Step 5, which settles it on the spelling of the target ids.
   */
  it("says what an unguarded fork does", () => {
    const fork = TOPOLOGY_ROWS.find((r) => /lexicograph/i.test(r.what));
    expect(fork, "no row states the lexical tiebreak").toBeDefined();
    expect(fork?.what).toContain("§3.3");
    expect(fork?.what.toLowerCase()).toContain("weight");
  });
});
