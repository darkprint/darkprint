/* ============================================================
   Storable versus approved, held to its own four rules.

   The classification in `gate.ts` is a decision about whose work
   the product will refuse, so the cells below are written against
   the RULES rather than against the table: three of them would red
   if somebody moved a code between the two answers without moving
   the reason with it, and one of them measures the engine's real
   behaviour rather than the table's claim about it.

   ── the two lists are written against different questions ──
   `STORAGE_BLOCKING_CODES` is derived from `DIAGNOSTIC_GATE` and
   `INFERRED_CODES` is not. That is the whole reason a disjointness
   cell means anything: a derived pair would be disjoint by
   construction and would prove nothing. Both are still written by
   the same author in the same edit, which the cell cannot fix — its
   job is the NEXT edit, where somebody adds an inferred code to the
   blocking set without noticing they have given a reading a veto.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  ADDRESS_FIELDS,
  AUTHOR_DECLARED_BLOCKING_CODES,
  DIAGNOSTIC_GATE,
  INFERRED_CODES,
  RELEASE_BLOCKING_CODES,
  STORAGE_BLOCKING_CODES,
  blocksRelease,
  blocksStorage,
  gateClassOf,
  isReleasable,
  isStorable,
  releaseBlockers,
  storageBlockers,
} from "./gate";
import { lintAttractor } from "./attractor/lint";
import { parseDot } from "./dot/parser";
import { error, info, warning, hasErrors, type Diagnostic, type DiagnosticCode } from "./diagnostics";

const CODES = Object.keys(DIAGNOSTIC_GATE) as DiagnosticCode[];

describe("rule 1 — storable is near-unconditional", () => {
  it("refuses on twelve codes out of the whole union, and no more", () => {
    /* A number, deliberately, and it is the assertion this file exists for: the point of
       naming the blocking set is that somebody can look at how big it is. A change that
       makes the product refuse a thirteenth kind of artefact has to move this line, in the
       same commit, with the reason beside it in `gate.ts`. */
    expect(STORAGE_BLOCKING_CODES.length).toBe(12);
    expect(CODES.length).toBeGreaterThan(50);
  });

  it("classifies every code in the union, and nothing outside it", () => {
    // The `Record<DiagnosticCode, GateClass>` already refuses to compile for a missing or
    // an extra member. This is the runtime half: a value nobody has a rule for.
    for (const code of CODES) {
      expect([
        "unreadable",
        "unaddressable",
        "author-declared",
        "unresolved-reference",
        "approval",
      ]).toContain(gateClassOf(code));
    }
  });

  it("keeps every blocking code's ground stated, and every ground non-empty", () => {
    /* Three grounds, and each one has to have a member: a ground with nothing in it is a
       sentence in the header describing a rule the table does not implement. */
    const grounds = new Set(STORAGE_BLOCKING_CODES.map(gateClassOf));
    expect([...grounds].sort()).toEqual(["author-declared", "unaddressable", "unreadable"]);
  });
});

describe("D-109 — the gate splits by lifecycle stage", () => {
  /* Owner ruling of 2026-08-30. A draft is near-unconditional; a release additionally has to
     resolve. These cells hold the shape of that split rather than its size, because the two
     failure modes are opposite: a release gate that admits everything storage does is the
     ruling not implemented, and a draft gate that refuses what release refuses is the ruling
     implemented backwards. Both look green against a single-list assertion. */

  it("makes release a strict superset of storage, so the stages are a ladder", () => {
    const storage = new Set<string>(STORAGE_BLOCKING_CODES);
    for (const code of STORAGE_BLOCKING_CODES) expect(RELEASE_BLOCKING_CODES).toContain(code);
    // Strict: if the two lists were equal the split would be a rename, and every cell below
    // would pass against a gate that never moved.
    expect(RELEASE_BLOCKING_CODES.filter((code) => !storage.has(code))).toEqual([
      "bundle/missing-card",
      "bundle/unpinned-card",
    ]);
  });

  it("holds a node with no card storable and unreleasable, in both directions", () => {
    const dangling = error("bundle/missing-card", "node points at no card");
    expect(blocksStorage(dangling)).toBe(false);
    expect(blocksRelease(dangling)).toBe(true);
    expect(isStorable([dangling])).toBe(true);
    expect(isReleasable([dangling])).toBe(false);
    expect(releaseBlockers([dangling])).toEqual([dangling]);
    expect(storageBlockers([dangling])).toEqual([]);
  });

  it("keeps an inference out of BOTH gates, which is rule 4 surviving the split", () => {
    /* The whole risk of adding a stage is that it becomes a back door for the readings rule
       4 kept out. A port that does not fit is the load-bearing example: it is the most
       useful thing the engine says about a release and it still refuses nothing. */
    for (const code of ["bundle/port-mismatch", "bundle/type-mismatch", "card/unknown-term"] as const) {
      expect(blocksStorage(error(code, "x"))).toBe(false);
      expect(blocksRelease(error(code, "x")), `${code} gained a veto at release`).toBe(false);
    }
    const inferred = new Set<string>(INFERRED_CODES);
    expect(RELEASE_BLOCKING_CODES.filter((code) => inferred.has(code))).toEqual([]);
  });

  it("keeps the author's own prohibition blocking at both stages", () => {
    const declared = error("bundle/prohibition-violated", "x");
    expect(blocksStorage(declared)).toBe(true);
    expect(blocksRelease(declared)).toBe(true);
  });
});

describe("rule 3 — an author-declared prohibition may still block", () => {
  it("is exactly one code, and it is the one the card's own author asked for", () => {
    expect(AUTHOR_DECLARED_BLOCKING_CODES).toEqual(["bundle/prohibition-violated"]);
    expect(STORAGE_BLOCKING_CODES).toContain("bundle/prohibition-violated");
  });

  it("blocks, where the reading of the same graph beside it does not", () => {
    /* The discriminating pair. Both are `bundle/` errors about the same topology; one is
       the author saying "this node must never receive an `acceptance-criteria`" and the
       other is DarkPrint saying "these two ports do not fit". Only the first refuses. */
    expect(blocksStorage(error("bundle/prohibition-violated", "x"))).toBe(true);
    expect(blocksStorage(error("bundle/type-mismatch", "x"))).toBe(false);
  });
});

describe("rule 4 — nothing DarkPrint infers may ever block", () => {
  it("shares no code with the blocking set", () => {
    const blocking = new Set<string>(STORAGE_BLOCKING_CODES);
    const overlap = INFERRED_CODES.filter((code) => blocking.has(code));
    expect(
      overlap,
      "a code DarkPrint works out for itself has been given a veto over somebody else's work",
    ).toEqual([]);
  });

  it("names only codes the union actually has", () => {
    // `INFERRED_CODES` is a `DiagnosticCode[]`, so a name the union dropped fails to
    // compile — but a name it still has and nothing emits would pass. This asks the table.
    const known = new Set<string>(CODES);
    expect(INFERRED_CODES.filter((code) => !known.has(code))).toEqual([]);
  });

  it("covers every code the analyzers and the Attractor linter report", () => {
    /* The two namespaces that are entirely readings. Stated as a subset rather than as a
       list, so a tenth Attractor rule or a seventh analysis code joins rule 4 on the day it
       lands rather than on the day somebody remembers. */
    const inferred = new Set<string>(INFERRED_CODES);
    const readings = CODES.filter(
      (code) => code.startsWith("analysis/") || code.startsWith("attractor/"),
    );
    expect(readings.length).toBeGreaterThan(10);
    expect(readings.filter((code) => !inferred.has(code))).toEqual([]);
  });
});

describe("the severity narrowing", () => {
  it("reads the code AND the severity, so a mild instance of a blocking code does not refuse", () => {
    /* `card/bad-type` is an ERROR for a document that is not a mapping and an INFO for a
       key the schema does not know — `card/validate.ts` accepts a card written against a
       later schema on purpose. Classifying the code and stopping there would turn that
       acceptance into a refusal. */
    expect(blocksStorage(error("card/bad-type", "not a mapping"))).toBe(true);
    expect(blocksStorage(info("card/bad-type", "unknown key"))).toBe(false);
    expect(blocksStorage(warning("card/bad-type", "unknown key"))).toBe(false);
  });

  it("narrows the two coarse codes by the field they already name", () => {
    /* `card/missing-field` and `card/bad-type` each cover a legibility failure and an
       ordinary defect, and `card/validate.ts` already tells them apart in `location.path`:
       no path means the whole document is not a card, and a path names the one field that
       is wrong. Only the two fields that carry the address refuse.

       The discriminating case is a card with no `spec`, which `darkprint import` writes on
       purpose for an Attractor node that carried no `prompt`. Refusing it would mean
       DarkPrint cannot hold a legible, addressed, attributed card because one field is
       still to be written. */
    expect(ADDRESS_FIELDS).toEqual(["id", "version"]);
    const at = (path?: string) => (path === undefined ? {} : { location: { path } });

    expect(blocksStorage(error("card/missing-field", "no id", at("id")))).toBe(true);
    expect(blocksStorage(error("card/missing-field", "no version", at("version")))).toBe(true);
    expect(blocksStorage(error("card/missing-field", "no spec", at("spec")))).toBe(false);
    expect(blocksStorage(error("card/missing-field", "no action", at("action")))).toBe(false);

    // No path is the whole-document case, which is the one that is genuinely unreadable.
    expect(blocksStorage(error("card/bad-type", "not a mapping", at()))).toBe(true);
    expect(blocksStorage(error("card/bad-type", "phases is a number", at("phase")))).toBe(false);
    expect(blocksStorage(error("card/bad-type", "version is a number", at("version")))).toBe(true);

    /* And nothing else is narrowed: a code outside `FIELD_SCOPED` refuses whatever it points
       at, so a `card/bad-id` with a path is still a refusal. */
    expect(blocksStorage(error("card/bad-id", "not an identifier", at("id")))).toBe(true);
    expect(blocksStorage(error("dot/parse-error", "unterminated", at("anything")))).toBe(true);
  });

  it("answers a different question from `hasErrors`, on the same list", () => {
    /* The whole of item 02 in four lines. A bundle whose only error is DarkPrint's reading
       of it has errors and is storable, and the two functions have to disagree about it or
       nothing has been separated. */
    const ds: Diagnostic[] = [
      error("bundle/type-mismatch", "the port types do not fit"),
      error("card/unknown-term", "no such term"),
      warning("analysis/criteria-leak-suspected", "a path exists"),
    ];
    expect(hasErrors(ds)).toBe(true);
    expect(isStorable(ds)).toBe(true);
    expect(storageBlockers(ds)).toEqual([]);
  });

  it("still refuses what cannot be read or addressed", () => {
    const ds: Diagnostic[] = [
      error("dot/parse-error", "unterminated string"),
      error("card/bad-id", "not an identifier"),
      warning("bundle/orphan-card", "nothing pins it"),
    ];
    expect(isStorable(ds)).toBe(false);
    expect(storageBlockers(ds).map((d) => d.code)).toEqual(["dot/parse-error", "card/bad-id"]);
  });

  it("holds an empty list and a list of readings storable", () => {
    expect(isStorable([])).toBe(true);
    expect(isStorable(CODES.map((code) => warning(code, "x")))).toBe(true);
  });

  it("keeps the blockers in the order they were given", () => {
    // `storageBlockers` is a filter and a caller renders it; re-ordering here would put a
    // second sort in front of `sortDiagnostics` and the two would disagree.
    const ds = [error("card/bad-id", "second"), error("dot/parse-error", "first")];
    expect(storageBlockers(ds).map((d) => d.message)).toEqual(["second", "first"]);
  });
});

describe("what the engine really does, against what the table says", () => {
  it("never reports an inferred finding at error severity today", () => {
    /* The table is a claim about which codes MAY refuse. This is the other half: the two
       namespaces rule 4 is mostly about are emitted as warnings and info throughout, which
       is why re-pointing a gate at `blocksStorage` cannot change what they do. Measured
       against the shipped emitters rather than asserted, by driving the linter over a
       source that breaks four of its rules at once. */
    const ds = attractorFindings();
    expect(ds.length).toBeGreaterThan(3);
    for (const d of ds) {
      expect(d.severity, `${d.code} is an error, and rule 4 says a reading may not refuse`).not.toBe(
        "error",
      );
      expect(gateClassOf(d.code)).toBe("approval");
    }
  });
});

/**
 * The Attractor linter's real output over a source that breaks several of its rules.
 *
 * A witness, not the subject: `gate.ts` classifies codes and this reads what the shipped
 * emitters actually stamp on them, so the cell above compares two things with different
 * authors instead of comparing the table to itself.
 */
function attractorFindings(): Diagnostic[] {
  /* Every rule broken here is one Attractor's grammar rejects and DOT's does not, so the
     source parses and the linter is the only thing complaining: a `strict digraph`, a `#`
     comment, a quoted node id, and a node carrying the reserved `type` override. */
  const src =
    'strict digraph d {\n  # a hash comment\n  "quoted" [label="a", type="codergen"];\n  "quoted" -> work;\n}\n';
  const parsed = parseDot(src, "topology.dot");
  if (parsed.graph === undefined) throw new Error("the witness source did not parse");
  return lintAttractor(parsed.graph, src, "topology.dot");
}
