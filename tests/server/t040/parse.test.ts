/* ============================================================
   T040 AC3 — a DOT that fails to parse

   "a DOT that fails to parse returns a diagnostic carrying line
   and column"

   ── presence is not identity ──
   A test asserting that `line` and `column` are DEFINED is passed
   by an implementation reporting 1:1 for every failure — the
   presence-wearing-identity's-clothes shape this run has charged at
   a field, at a class and at a domain. So the fixtures are a PAIR
   whose only difference is where the fault sits, and both positions
   are pinned. A constant reds on one of the two.

   The sibling entry points are held to the same standard in
   `siblings.test.ts`; this file is `validateBundle` alone.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { asLoadBundleResult, bind, codesOf, errorsOf, returning } from "./contract";
import {
  EIGHT_NODE_BUNDLE,
  MALFORMED_CARD_WITH_LEADING_BLANKS,
  MALFORMED_CARD_YAML,
  NOT_A_GRAPH,
  UNPARSEABLE_LINE_2,
  UNPARSEABLE_LINE_3,
  UNPARSEABLE_POSITIONS,
  caseFor,
  withDot,
} from "./fixtures";

describe("AC3: validateBundle over a DOT that does not parse", () => {
  for (const source of [UNPARSEABLE_LINE_2, UNPARSEABLE_LINE_3]) {
    const at = UNPARSEABLE_POSITIONS[source];
    it(`reports the parse failure at ${at.line}:${at.column}`, async () => {
      const validateBundle = await bind("validateBundle");
      const input = withDot(caseFor(EIGHT_NODE_BUNDLE).input, source);

      const result = asLoadBundleResult(
        returning(() => validateBundle(input), "validateBundle(unparseable dot)"),
        "validateBundle(unparseable dot)",
      );

      const parseErrors = result.diagnostics.filter((d) => d.code === "dot/parse-error");
      expect(parseErrors).toHaveLength(1);

      const [d] = parseErrors;
      expect(d.severity).toBe("error");
      expect(d.location?.line, "AC3 names line").toBe(at.line);
      expect(d.location?.column, "AC3 names column").toBe(at.column);
      /* The file is what tells a reader WHICH of the submitted documents failed. A position
         with no file is a position in nothing when the submission carries eight card files
         beside the DOT. */
      expect(d.location?.file, "the position needs a document to be a position in").toBe(
        "blueprint.dot",
      );
    });
  }

  /* The other half of AC3, and the one a caller branches on: a DOT that did not parse yields no
     blueprint, so there is nothing to score and the result says so instead of scoring an empty
     graph. `analysis/empty-graph` exists precisely so a vacuous 4 cannot read as a clean bill
     of health, and an implementation that manufactured a blueprint here would produce one. */
  it("returns no blueprint and no analysis when the topology never existed", async () => {
    const validateBundle = await bind("validateBundle");
    const input = withDot(caseFor(EIGHT_NODE_BUNDLE).input, UNPARSEABLE_LINE_2);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(unparseable dot)"),
      "validateBundle(unparseable dot)",
    );

    expect(result.blueprint).toBeUndefined();
    expect(result.analysis).toBeUndefined();
    expect(codesOf(result.diagnostics)).toEqual(["dot/parse-error"]);
  });

  /* The cards are still eight well-formed documents. A module reporting every card as a
     problem because the DOT failed would be answering a question nobody asked, and "the
     diagnostics are EXACTLY one code" above is what holds it. Repeated here against the other
     failure shape, where the fault is the first token rather than a statement in the middle. */
  it("says nothing about the cards when the DOT is not a graph at all", async () => {
    const validateBundle = await bind("validateBundle");
    const input = withDot(caseFor(EIGHT_NODE_BUNDLE).input, NOT_A_GRAPH);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(not a graph)"),
      "validateBundle(not a graph)",
    );

    expect(codesOf(result.diagnostics)).toEqual(["dot/parse-error"]);
    expect(result.diagnostics[0].location?.line).toBe(1);
    expect(result.diagnostics[0].location?.column).toBe(1);
    expect(errorsOf(result.diagnostics)).toHaveLength(1);
  });

  /* **Card positions are against the bytes the caller sent**, the bundle-level twin of the
     same check on `validateCardSource`. Found by a mutation chosen for not being on this
     file's list: `text.trim()` on each card before resolution reddened nothing, because every
     card fixture here began at line 1 column 1 and trimming was a no-op against them — an
     equivalent mutant manufactured by the fixtures rather than by the patch.

     A DIFFERENCE rather than a literal, so it holds whatever line the parser reports. */
  it("reports a card's parse position against the card as submitted", async () => {
    const validateBundle = await bind("validateBundle");
    const whole = caseFor(EIGHT_NODE_BUNDLE).input;

    const lineOf = (cardText: string): number | undefined => {
      const result = asLoadBundleResult(
        returning(
          () => validateBundle({ ...whole, cardFiles: { "cards/x@1.0.0.yaml": cardText } }),
          "validateBundle(card position)",
        ),
        "validateBundle(card position)",
      );
      return result.diagnostics.find((d) => d.code === "card/parse-error")?.location?.line;
    };

    const plain = lineOf(MALFORMED_CARD_YAML);
    const shifted = lineOf(MALFORMED_CARD_WITH_LEADING_BLANKS);

    expect(plain, "the unprefixed card reports a parse position at all").toBeTypeOf("number");
    expect(shifted).toBe((plain ?? 0) + 2);
  });

  /* An empty DOT is a submission and not a non-submission. The distinction matters because the
     wizard locks every step until a `.dot` is present, so anything reaching here has one — and
     answering "nothing wrong" for an empty buffer would report a blueprint nobody wrote as
     fine. Measured against base: `dot/parse-error` at 1:1, "found end of input". */
  it("refuses an empty DOT rather than resolving an empty graph", async () => {
    const validateBundle = await bind("validateBundle");
    const input = withDot(caseFor(EIGHT_NODE_BUNDLE).input, "");

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(empty dot)"),
      "validateBundle(empty dot)",
    );

    expect(result.blueprint).toBeUndefined();
    expect(codesOf(errorsOf(result.diagnostics))).toContain("dot/parse-error");
  });
});
