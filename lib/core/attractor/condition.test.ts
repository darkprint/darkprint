/* ============================================================
   Tests for the condition expression parser (spec §10).

   The suite is written in two halves that are not symmetric, and
   the asymmetry is the point.

   **Positives** are §10.6's five examples plus the forms the
   grammar admits around them. Every one must parse, and the
   clauses that come back are asserted field by field, so a parser
   that answers "no problems" without having read anything cannot
   pass them.

   **Negatives** are the forms §10.2 refuses. Each asserts the
   `ConditionProblemCode` it was refused UNDER, never merely that
   something was refused: a suite that only counts problems is
   green against a parser that rejects everything, and green
   against one that rejects the right things for the wrong reason.

   Both halves were checked by mutation rather than by reading. A
   parser stubbed to accept everything must red every negative
   cell, and one stubbed to refuse everything must red every
   positive cell; a cell that survives either stub is asserting
   nothing. The counts are in the lane report.
   ============================================================ */

import { describe, expect, it } from "vitest";
import * as conditionModule from "./condition";
import { parseCondition, type ConditionClause, type ConditionProblemCode } from "./condition";

/** The clauses of an expression that must parse, or a failure naming what was reported. */
function clausesOf(src: string): readonly ConditionClause[] {
  const result = parseCondition(src);
  if (result.clauses === undefined) {
    throw new Error(
      `\`${src}\` did not parse: ${result.problems.map((p) => `${p.code} ${p.message}`).join("; ")}`,
    );
  }
  return result.clauses;
}

/** The codes an expression was refused under, in the order they were reported. */
function codesOf(src: string): ConditionProblemCode[] {
  return parseCondition(src).problems.map((p) => p.code);
}

/* ============================================================
   the five examples in §10.6, which must all parse
   ============================================================ */

describe("§10.6's examples", () => {
  it("routes on success", () => {
    expect(clausesOf("outcome=success")).toEqual([
      { key: "outcome", keyKind: "outcome", operator: "=", value: "success", quoted: false, offset: 0 },
    ]);
  });

  it("routes on failure", () => {
    expect(clausesOf("outcome=fail")).toEqual([
      { key: "outcome", keyKind: "outcome", operator: "=", value: "fail", quoted: false, offset: 0 },
    ]);
  });

  it("routes on success AND a context flag", () => {
    expect(clausesOf("outcome=success && context.tests_passed=true")).toEqual([
      { key: "outcome", keyKind: "outcome", operator: "=", value: "success", quoted: false, offset: 0 },
      {
        key: "context.tests_passed",
        keyKind: "context",
        operator: "=",
        value: "true",
        quoted: false,
        offset: 19,
      },
    ]);
  });

  it("routes when a context value is not a specific value", () => {
    expect(clausesOf("context.loop_state!=exhausted")).toEqual([
      {
        key: "context.loop_state",
        keyKind: "context",
        operator: "!=",
        value: "exhausted",
        quoted: false,
        offset: 0,
      },
    ]);
  });

  it("routes on the preferred label", () => {
    expect(clausesOf("preferred_label=Fix")).toEqual([
      {
        key: "preferred_label",
        keyKind: "preferred_label",
        operator: "=",
        value: "Fix",
        quoted: false,
        offset: 0,
      },
    ]);
  });
});

/* ============================================================
   the rest of what §10.2 admits
   ============================================================ */

describe("the forms the grammar admits", () => {
  it("takes a quoted String literal and hands back its content", () => {
    const [clause] = clausesOf('preferred_label="Fix it now"');
    expect(clause.value).toBe("Fix it now");
    expect(clause.quoted).toBe(true);
  });

  it("resolves the escapes §2.4's String rule names", () => {
    expect(clausesOf('outcome="a\\"b\\nc\\td\\\\e"')[0].value).toBe('a"b\nc\td\\e');
  });

  it("does not split on a `&&` inside a String", () => {
    const clauses = clausesOf('preferred_label="fix && ship"');
    expect(clauses).toHaveLength(1);
    expect(clauses[0].value).toBe("fix && ship");
  });

  it("takes an Integer, a signed Integer and a Boolean", () => {
    expect(clausesOf("context.retries=3")[0].value).toBe("3");
    expect(clausesOf("context.delta=-1")[0].value).toBe("-1");
    expect(clausesOf("context.ok=false")[0].value).toBe("false");
  });

  it("takes a decimal, which §10.5 compares as text like everything else", () => {
    // Deliberate, and argued in `condition.ts`'s header: §7.2 grades this rule on
    // operators and keys, and `parse_literal` returns the text unexamined. A refusal here
    // would be a rule DarkPrint invented, against an expression that runs.
    expect(clausesOf("context.confidence=0.8")[0].value).toBe("0.8");
  });

  it("takes the punctuation `BareLiteral` allows in its tail", () => {
    expect(clausesOf("context.branch=feature-x")[0].value).toBe("feature-x");
    expect(clausesOf("context.ref=refs:heads.main")[0].value).toBe("refs:heads.main");
  });

  it("takes a multi-segment context Path", () => {
    const [clause] = clausesOf("context.review.round.state=open");
    expect(clause.key).toBe("context.review.round.state");
    expect(clause.keyKind).toBe("context");
  });

  it("ignores whitespace around the operator and the conjunction", () => {
    expect(clausesOf("  outcome  =  success   &&   context.a != b  ")).toHaveLength(2);
  });

  it("chains more than two clauses", () => {
    expect(
      clausesOf("outcome=success && context.a=1 && context.b!=2 && preferred_label=Go"),
    ).toHaveLength(4);
  });

  it("reports no problems at all when the expression is well-formed", () => {
    expect(parseCondition("outcome=success").problems).toEqual([]);
  });
});

/* ============================================================
   what §10.2 refuses, each under the code it is refused for
   ============================================================ */

describe("an operator the grammar does not have", () => {
  it("refuses `==`, which is the commonest way to write `=` wrong", () => {
    expect(codesOf('context.verdict == "approve"')).toEqual(["unknown-operator"]);
  });

  it("says to write `=` instead", () => {
    expect(parseCondition("outcome == success").problems[0].hint).toContain("Write `=`");
  });

  it("refuses a nonsense operator run", () => {
    expect(codesOf("outcome =! success")).toEqual(["unknown-operator"]);
  });
});

describe("§10.7's future operators, which are refused on purpose", () => {
  const FUTURE: readonly string[] = Object.freeze([
    "context.attempts > 3",
    "context.confidence >= 0.8",
    "context.confidence < 0.8",
    "context.confidence <= 0.8",
    "outcome=success || outcome=partial_success",
    "!context.approved",
    "context.label contains fix",
    "context.label matches ^fix",
  ]);

  it.each(FUTURE)("refuses `%s`", (src) => {
    expect(codesOf(src)).toContain("future-operator");
  });

  it("names §10.7 in the message, so the reader sees `not yet` rather than `never`", () => {
    const [found] = parseCondition("context.attempts > 3").problems;
    expect(found.message).toContain("§10.7");
  });

  it("says the guard has to be rewritten rather than corrected", () => {
    expect(parseCondition("context.attempts > 3").problems[0].hint).toContain("rewritten");
  });
});

describe("parentheses, which §10.2 has no production for", () => {
  it("refuses an unbalanced one", () => {
    expect(codesOf("(outcome=success && context.a=b")).toEqual(["parenthesis"]);
  });

  it("says so, in as many words", () => {
    expect(parseCondition("(outcome=success && context.a=b").problems[0].message).toContain(
      "unbalanced",
    );
  });

  it("refuses a balanced one too, because grouping is not in the grammar", () => {
    expect(codesOf("(outcome=success)")).toEqual(["parenthesis"]);
    expect(parseCondition("(outcome=success)").problems[0].message).toContain("no grouping");
  });

  it("reports the bracket once rather than once per clause inside it", () => {
    // The code is asserted beside the count: a bare `toHaveLength(1)` is green against any
    // parser that refuses everything with one problem, which the refuse-all mutation showed.
    expect(codesOf("(outcome=success && context.a=b && context.c=d)")).toEqual(["parenthesis"]);
  });
});

describe("an empty expression", () => {
  it("refuses one that is empty", () => {
    expect(codesOf("")).toEqual(["empty-expression"]);
  });

  it("refuses one that is only whitespace", () => {
    expect(codesOf("    ")).toEqual(["empty-expression"]);
  });

  it("says what §3.3 does with it, which is to take the edge unconditionally", () => {
    // The one place the report has to be true under BOTH readings of the spec: §10.5
    // returns true for an empty condition and §3.3 routes the edge as unguarded, so the
    // author who wrote `condition=""` has an edge nothing holds back.
    expect(parseCondition("").problems[0].hint).toContain("unconditional");
  });
});

describe("a bare identifier, where §10.2 needs a comparison", () => {
  it("refuses a bare key", () => {
    expect(codesOf("context.tests_pass")).toEqual(["bare-key"]);
  });

  it("refuses a bare literal, which is the same shape", () => {
    // `condition="false"` is the string `bundle/types.ts` names as the cheapest thing an
    // author could write to make a leaking edge look closed. It does not parse either.
    expect(codesOf("false")).toEqual(["bare-key"]);
  });

  it("suggests the comparison, qualified when the key was not", () => {
    expect(parseCondition("tests_pass").problems[0].hint).toContain("context.tests_pass=true");
    expect(parseCondition("outcome").problems[0].hint).toContain("outcome=true");
  });

  it("discloses that §10.5's evaluator would take the edge anyway", () => {
    expect(parseCondition("context.tests_pass").problems[0].hint).toContain("§10.5");
  });
});

describe("a key that is not one of the three", () => {
  it("refuses an unqualified key", () => {
    expect(codesOf("tests_passed=true")).toEqual(["unknown-key"]);
  });

  it("says to qualify it, and discloses that §10.4 would resolve it anyway", () => {
    const [found] = parseCondition("tests_passed=true").problems;
    expect(found.hint).toContain("context.tests_passed");
    expect(found.hint).toContain("§10.4");
  });

  it("refuses `context.` with no path after it", () => {
    expect(codesOf("context.=true")).toEqual(["unknown-key"]);
  });

  it("refuses a path segment that is not an Identifier", () => {
    expect(codesOf("context.loop-state=open")).toEqual(["unknown-key"]);
    expect(codesOf("context.2nd=open")).toEqual(["unknown-key"]);
    expect(codesOf("context.a..b=open")).toEqual(["unknown-key"]);
  });

  it("refuses a key that is close but not exact, because §10.3 is case-sensitive", () => {
    expect(codesOf("Outcome=success")).toEqual(["unknown-key"]);
  });

  it("refuses something on the left that is not a key at all", () => {
    expect(codesOf('ctx["a b"]=1')).toEqual(["bad-key"]);
  });

  it("refuses a clause with nothing on the left", () => {
    expect(codesOf("=success")).toEqual(["missing-key"]);
  });
});

describe("a literal the grammar cannot read", () => {
  it("refuses a clause with nothing on the right", () => {
    expect(codesOf("outcome=")).toEqual(["missing-literal"]);
  });

  it("refuses an unquoted value with a space in it", () => {
    expect(codesOf("preferred_label=Fix it")).toEqual(["bad-literal"]);
  });

  it("refuses a character outside `BareLiteral`", () => {
    expect(codesOf("context.path=a/b")).toEqual(["bad-literal"]);
  });

  it("refuses a String that never closes", () => {
    expect(codesOf('preferred_label="Fix it')).toEqual(["unterminated-string"]);
  });
});

describe("a conjunction with a clause missing", () => {
  it("refuses a trailing `&&`", () => {
    expect(codesOf("outcome=success &&")).toEqual(["empty-clause"]);
  });

  it("refuses a leading `&&`", () => {
    expect(codesOf("&& outcome=success")).toEqual(["empty-clause"]);
  });

  it("refuses a doubled `&&`", () => {
    expect(codesOf("outcome=success && && context.a=b")).toEqual(["empty-clause"]);
  });

  it("discloses that §10.5 skips it, so the `&&` is a no-op rather than a refusal", () => {
    expect(parseCondition("outcome=success &&").problems[0].hint).toContain("§10.5");
  });

  it("refuses a clause with no operator in it at all", () => {
    expect(codesOf("outcome success")).toEqual(["missing-operator"]);
  });
});

/* ============================================================
   properties of the report itself
   ============================================================ */

describe("the report", () => {
  const BROKEN: readonly string[] = Object.freeze([
    "",
    "outcome == success",
    "context.attempts > 3",
    "(outcome=success)",
    "context.tests_pass",
    "tests_passed=true",
    "outcome=",
    "=success",
    "outcome=success &&",
    "outcome success",
    'preferred_label="Fix it',
    "context.path=a/b",
    'ctx["a b"]=1',
  ]);

  it.each(BROKEN)("carries a hint for `%s`, because every one has a fix", (src) => {
    const found = parseCondition(src).problems;
    expect(found.length).toBeGreaterThan(0);
    for (const one of found) expect(one.hint.length).toBeGreaterThan(0);
  });

  it.each(BROKEN)("withholds the clauses for `%s` rather than half-parsing it", (src) => {
    expect(parseCondition(src).clauses).toBeUndefined();
  });

  it("points at the offset the problem starts at", () => {
    expect(parseCondition("outcome=success && context.attempts > 3").problems[0].offset).toBe(36);
    // A clause with no tokens has no offset of its own, so it takes the one just past the
    // `&&` that should have been followed by something.
    expect(parseCondition("outcome=success && ").problems[0].offset).toBe(18);
  });

  it("reports every broken clause rather than stopping at the first", () => {
    expect(codesOf("tests_passed=true && context.attempts > 3")).toEqual([
      "unknown-key",
      "future-operator",
    ]);
  });

  it("reports one problem per clause, not one per rule the clause trips", () => {
    // `>=` and an unqualified key in the same clause. The operator is the one that
    // explains the most, so it is the one reported.
    expect(codesOf("attempts >= 3")).toEqual(["future-operator"]);
  });

  it("never throws, whatever it is handed", () => {
    const nasty = ['"', "\\", "&&&&", "===", "()", " ", "a".repeat(5000), `context.${".".repeat(500)}`];
    for (const src of nasty) expect(() => parseCondition(src)).not.toThrow();
  });
});

/* ============================================================
   the API's own boundary
   ============================================================ */

describe("what the module does NOT export", () => {
  /**
   * `bundle/types.ts` states the rule this cell guards: a conditional edge counts exactly
   * as much as an unconditional one in every risk reading, because the guard is evaluated
   * at run time against data DarkPrint never sees. This module is the first thing in the
   * tree that could plausibly evaluate one, so the absence of an evaluator is asserted
   * rather than left to the header.
   */
  it("publishes the parser and nothing that could answer `is this edge taken`", () => {
    expect(Object.keys(conditionModule).sort()).toEqual(["parseCondition"]);
  });

  it("takes one argument, so there is nowhere to pass a context or an outcome", () => {
    expect(parseCondition.length).toBe(1);
  });
});
