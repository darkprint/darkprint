/* ============================================================
   D-40-20: the ruled formula is normative as a NUMBER, and this
   module computes it by a different procedure.

   That trade is only safe if the two agree, so the agreement is a
   measured property here rather than a claim in a docstring. The
   corpus is deliberately not "things I expected to matter": it is
   every shape `JSON.stringify` treats specially, because the
   failure mode of a hand-written serialiser is exactly the case
   its author did not think of.

   What the walk is allowed to differ on, and does: a submission
   already past `maxBytes` stops being counted, because past the
   bound only the comparison is ever needed. Every case below is
   measured under a limit large enough that the full number is
   produced.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { contentVocabulary, readContent } from "@/lib/content/read";
import {
  CircularReferenceError,
  DEFAULT_ENGINE_LIMITS,
  LimitExceededError,
  validateBundle,
} from "./index";
import { measureSubmission, resolveLimits } from "./limits";

const GENEROUS = resolveLimits({ maxBytes: 50 * 1024 * 1024 });

/** The formula, run literally, as the thing to agree with. */
function formula(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

describe("the bounded walk computes the ruled number exactly", () => {
  const corpus: [string, unknown][] = [
    ["empty object", {}],
    ["empty array", []],
    ["null", { a: null }],
    ["booleans", { t: true, f: false }],
    ["integers", { a: 0, b: -1, c: 1000000 }],
    ["negative zero", { a: -0 }],
    ["exponent form", { a: 1e21, b: 1e-7, c: 1.5e300 }],
    ["non-finite becomes null", { a: NaN, b: Infinity, c: -Infinity }],
    ["undefined is dropped in an object", { a: 1, b: undefined, c: 2 }],
    ["undefined becomes null in an array", { a: [1, undefined, 2] }],
    ["a function is dropped in an object", { a: 1, b: () => 0 }],
    ["a function becomes null in an array", { a: [1, (): number => 0, 2] }],
    ["quotes and backslashes", { a: 'he said "hi"\\' }],
    ["control characters escape long", { a: "line\nbreak\ttab" }],
    ["multi-byte", { a: "café" }],
    ["astral plane", { a: "\u{1F600}\u{1F680}" }],
    ["multi-byte in a KEY", { "clé-é": "v" }],
    ["nested empties", { a: { b: { c: [[], {}] } } }],
    ["array of objects", { a: [{ x: 1 }, { y: 2 }, { z: 3 }]}],
    ["a Date, through toJSON", { a: new Date(0) }],
    ["shared substructure counts per path", (() => {
      const shared = { deep: "value", n: 1 };
      return { a: shared, b: shared, c: [shared, shared] };
    })()],
    ["an object with no enumerable keys", Object.defineProperty({}, "hidden", { value: 1 })],
  ];

  for (const [name, value] of corpus) {
    it(`agrees with JSON.stringify: ${name}`, () => {
      expect(measureSubmission("probe", value, GENEROUS)).toBe(formula(value));
    });
  }

  it("agrees on every archive submission, which is the shape that actually ships", () => {
    const extensions = contentVocabulary()?.terms;
    const archive = readContent();
    expect(archive.length).toBe(9);

    for (const loaded of archive) {
      const submission = {
        manifest: loaded.bundle.manifest,
        dot: loaded.bundle.dot,
        cardFiles: loaded.bundle.cardFiles,
        extensions,
      };
      expect(measureSubmission("probe", submission, GENEROUS), loaded.slug).toBe(
        formula(submission),
      );
    }
  });

  /**
   * The one place a `seen` set would have been the tempting fix and is forbidden.
   *
   * Memoising a shared subtree counts it once where the formula counts it per path, which
   * changes the number for exactly the inputs the bounding was written for. The corpus case
   * above pins the agreement; this pins that the agreement is not accidental, by checking
   * the count grows with the sharing.
   */
  it("counts shared substructure once per path, as the formula does", () => {
    const shared = { deep: "value" };
    const once = { a: shared };
    const twice = { a: shared, b: shared };
    expect(measureSubmission("probe", once, GENEROUS)).toBe(formula(once));
    expect(measureSubmission("probe", twice, GENEROUS)).toBe(formula(twice));
    expect(measureSubmission("probe", twice, GENEROUS)).toBeGreaterThan(
      measureSubmission("probe", once, GENEROUS),
    );
  });
});

describe("D-40-B — the measurement is bounded by the limit, not by the input graph", () => {
  /** n levels of `{ a: below, b: below }` is 2^n paths over n+1 objects. */
  function diamond(depth: number): unknown {
    let node: unknown = { leaf: true };
    for (let i = 0; i < depth; i += 1) node = { a: node, b: node };
    return node;
  }

  function submission(extra: unknown) {
    return {
      manifest: { slug: "p", title: "P", summary: "s", tags: [], ontologyVersion: "0.1.0", extra },
      dot: "digraph g { a -> b }",
      cardFiles: {},
    };
  }

  /**
   * Depth 25 is 33 554 432 paths over 26 objects. Under the literal formula this threw a
   * bare `RangeError` — the string exceeded V8's maximum length — from a module that
   * publishes a typed refusal, and the depths below it allocated hundreds of megabytes to
   * decide that 2 MB had been exceeded.
   *
   * The assertion is the class, and the timeout is the measurement: a walk that is still
   * O(2^n) cannot finish this at all, so a regression reports as a timeout rather than as a
   * wrong answer.
   */
  it("refuses a depth-25 diamond with a typed error rather than a RangeError", () => {
    const started = Date.now();
    expect(() => validateBundle(submission(diamond(25)) as never)).toThrow(LimitExceededError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("refuses depth 30 just as quickly, which the literal formula could not attempt", () => {
    const started = Date.now();
    expect(() => validateBundle(submission(diamond(30)) as never)).toThrow(LimitExceededError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("still measures a submission that fits, at the same depths", () => {
    /* The other end: bounding the cost must not make an acceptable submission unmeasurable.
       A depth-10 diamond is 1024 paths and well inside the default. */
    expect(() => validateBundle(submission(diamond(10)) as never)).not.toThrow();
  });
});

describe("D-40-C — a cycle is a typed refusal, not a TypeError", () => {
  it("refuses a circular manifest", () => {
    const manifest: Record<string, unknown> = {
      slug: "p",
      title: "P",
      summary: "s",
      tags: [],
      ontologyVersion: "0.1.0",
    };
    manifest.self = manifest;
    expect(() =>
      validateBundle({ manifest, dot: "digraph g { a }", cardFiles: {} } as never),
    ).toThrow(CircularReferenceError);
  });

  it("refuses circular extensions, which is the second door", () => {
    const term: Record<string, unknown> = {
      id: "probe/x",
      kind: "risk-marker",
      label: "P",
      description: "d",
      since: "0.1.0",
    };
    term.self = term;
    expect(() =>
      validateBundle({
        manifest: { slug: "p", title: "P", summary: "s", tags: [], ontologyVersion: "0.1.0" },
        dot: "digraph g { a }",
        cardFiles: {},
        extensions: [term],
      } as never),
    ).toThrow(CircularReferenceError);
  });

  /**
   * Shared substructure is not a cycle, and the `open` set is path-scoped so that it cannot
   * be mistaken for one. Without that, every archive submission carrying a repeated term
   * object would be refused — the mutation that turns `open.delete` into a no-op.
   */
  it("does not mistake legitimate sharing for a cycle", () => {
    const shared = { deep: "value" };
    expect(() =>
      validateBundle({
        manifest: {
          slug: "p",
          title: "P",
          summary: "s",
          tags: [],
          ontologyVersion: "0.1.0",
          a: shared,
          b: shared,
        },
        dot: "digraph g { a }",
        cardFiles: {},
      } as never),
    ).not.toThrow();
  });

  it("renders as nothing and keeps its trace, like every other published class", () => {
    const error = new CircularReferenceError("validateBundle");
    expect(Object.keys(error)).toEqual([]);
    expect(JSON.stringify(error)).toBe("{}");
    expect(typeof error.stack).toBe("string");
    expect(error.propertyIsEnumerable("cause")).toBe(false);
    expect(error.message).toBe("validateBundle: the submission contains a circular reference.");
    /* The repo-wide guard constructs every class with one and two arguments. */
    expect(() => new CircularReferenceError()).not.toThrow();
  });
});

describe("the default is still a property of the archive after the procedure changed", () => {
  it("keeps every default above the archive's own maximum, measured through the walk", () => {
    const extensions = contentVocabulary()?.terms;
    let maxBytes = 0;
    for (const loaded of readContent()) {
      maxBytes = Math.max(
        maxBytes,
        measureSubmission(
          "probe",
          {
            manifest: loaded.bundle.manifest,
            dot: loaded.bundle.dot,
            cardFiles: loaded.bundle.cardFiles,
            extensions,
          },
          GENEROUS,
        ),
      );
    }
    expect(DEFAULT_ENGINE_LIMITS.maxBytes).toBeGreaterThan(maxBytes);
  });
});
