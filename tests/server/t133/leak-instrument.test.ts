/* ============================================================
   T133 — the leak instrument measured against the shapes that
   evade D-13's hygiene clause

   ── THESE CELLS MEASURE THIS SUITE, NOT THE MODULE ──
   Said first, because a reader counting cells is entitled to know
   which of them can ever say anything about an implementation.
   These cannot. Every one of them exercises `stringsIn` and
   `renderedFully` from `./contract` against errors this file builds
   by hand. A green establishes that the instrument SEES a shape; it
   establishes nothing about whether anything ever puts a value
   there. The AC4 cells in `write-refuses.test.ts` are the ones that
   ask that question, and they are only worth their green if these
   hold.

   ── why the file exists at all ──
   T133's adversary charged the instrument, not the implementation.
   Mutation M8 put the caller's vocabulary on the refusal as a
   **non-enumerable own property**, predicted zero reds, and observed
   zero across 6202 cells -- then falsified the inertness on a second
   axis rather than believing the zero: the value was demonstrably on
   the error and `renderedFully` demonstrably could not see it, while
   `Object.keys` stayed `[]` and `JSON.stringify` stayed `"{}"`.

   **The two guards were in tension and neither said so.** The shape
   that satisfies D-13's four-part hygiene clause exactly is the one
   shape an enumerable-only walk cannot read. `stringsIn` is widened
   to `Object.getOwnPropertyNames` plus symbols plus the prototype
   chain; this file is the falsification of that widening, in both
   directions, kept as cells rather than run once and described --
   because a widened instrument that still cannot see is worse than a
   narrow one that admits it, and a widening nothing observes is a
   widening that can silently regress.

   ── the shape of each cell is the charge itself ──
   Each evading shape is asserted to satisfy the hygiene clause AND
   to be visible to the scan AND to be invisible to the narrow walk,
   in the same cell. That is the tension stated as an assertion
   rather than as prose: if a future simplification of `stringsIn`
   narrows it back, the hygiene half still passes and the visibility
   half reds, which is exactly the signal M8 could not produce.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { nonce, renderedFully, stringsIn } from "./contract";

/** The narrow walk the instrument used to do, kept so the widening has a control. */
function enumerableOnly(value: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<unknown>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      found.push(current);
      continue;
    }
    if (current === null || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);
    if (current instanceof Error) found.push(current.message, current.name, current.stack ?? "");
    for (const [key, entry] of Object.entries(current)) {
      found.push(key);
      stack.push(entry);
    }
  }
  return found;
}

/**
 * A refusal built the way D-133-01 requires: `name` on the PROTOTYPE, nothing assigned in
 * the constructor, so `Object.keys` is `[]` and `JSON.stringify` is exactly `"{}"`.
 */
class CleanRefusal extends Error {}
Object.defineProperty(CleanRefusal.prototype, "name", {
  value: "CleanRefusal",
  enumerable: false,
  writable: true,
  configurable: true,
});

function refusal(): Error {
  return new CleanRefusal("addRelease: `vocabulary` is not the published shape.");
}

/** The four-part hygiene clause, so every cell below can assert the tension in one line. */
function satisfiesHygiene(error: Error): boolean {
  return (
    Object.keys(error).length === 0 &&
    JSON.stringify(error) === "{}" &&
    typeof error.stack === "string" &&
    error.stack.length > 0
  );
}

describe("the leak instrument sees what D-13's hygiene clause hides", () => {
  it("reads a NON-ENUMERABLE own property — the shape M8 used", () => {
    const n = nonce();
    const error = refusal();
    Object.defineProperty(error, "offered", {
      value: { text: `terms:\n  - id: ${n}\n` },
      enumerable: false,
      writable: false,
      configurable: true,
    });

    /* Half one: it passes the hygiene clause. This is not incidental -- it is why the
       mutation was invisible, and asserting it here is what keeps the tension recorded. */
    expect(
      satisfiesHygiene(error),
      "This fixture no longer satisfies D-13's four-part clause, so it is not the shape M8 " +
        "used and this cell has stopped measuring the tension it exists for.",
    ).toBe(true);

    /* Half two: and the instrument reads it anyway. */
    expect(
      renderedFully(error).includes(n),
      "`renderedFully` cannot see a non-enumerable own property. That is the state T133's " +
        "adversary found: a leak shaped to satisfy the hygiene clause exactly evades the " +
        "scan, and every AC4 cell in this suite goes green over it.",
    ).toBe(true);

    /* And the control, which is the direction that shows the widening did the work rather
       than something else having changed. */
    expect(
      enumerableOnly(error).some((s) => s.includes(n)),
      "The narrow `Object.entries` walk found it, so this fixture does not discriminate and " +
        "the widening is not what this cell is measuring.",
    ).toBe(false);
  });

  it("reads a SYMBOL-KEYED property", () => {
    const n = nonce();
    const error = refusal();
    (error as unknown as Record<symbol, unknown>)[Symbol.for("darkprint.offeredVocabulary")] = {
      text: `terms:\n  - id: ${n}\n`,
    };

    expect(satisfiesHygiene(error)).toBe(true);
    expect(
      renderedFully(error).includes(n),
      "A symbol key is the next hop from the one M8 took: invisible to `Object.keys`, to " +
        "`JSON.stringify` and to `Object.getOwnPropertyNames` alike, and reachable by " +
        "`Object.getOwnPropertySymbols` and by `util.inspect(err, { showHidden: true })`.",
    ).toBe(true);
    expect(enumerableOnly(error).some((s) => s.includes(n))).toBe(false);
  });

  it("reads a property that lives on the PROTOTYPE", () => {
    const n = nonce();
    class PerCallRefusal extends CleanRefusal {}
    Object.defineProperty(PerCallRefusal.prototype, "offered", {
      value: { text: `terms:\n  - id: ${n}\n` },
      enumerable: false,
      configurable: true,
    });
    const error: Error = new PerCallRefusal(
      "addRelease: `vocabulary` is not the published shape.",
    );

    /* The shape this repository's own convention makes plausible rather than exotic:
       D-133-01 puts a class's fields on the PROTOTYPE precisely so they stay off
       `Object.keys`. A per-call subclass carrying caller data there satisfies the letter of
       that convention and defeats an own-properties-only scan. */
    expect(satisfiesHygiene(error)).toBe(true);
    expect(
      renderedFully(error).includes(n),
      "The scan does not walk the prototype chain. Its own docblock claimed it did, before " +
        "the adversary's charge -- an instrument describing a walk it was not doing.",
    ).toBe(true);
    expect(enumerableOnly(error).some((s) => s.includes(n))).toBe(false);
  });

  it("still reads the ordinary shapes, and still terminates on a cyclic one", () => {
    /* The control for all three above: a widening that broke the cases the scan already
       handled would pass every cell in this file and red the whole AC4 family for a reason
       nobody would look for here. */
    const n = nonce();
    const plain = refusal();
    (plain as unknown as Record<string, unknown>).detail = [{ [`key-${n}`]: `value-${n}` }];
    expect(renderedFully(plain).includes(n)).toBe(true);
    expect(stringsIn(plain).some((s) => s.includes(`key-${n}`))).toBe(true);

    const cyclic: Record<string, unknown> = { text: `id: ${n}` };
    cyclic.self = cyclic;
    const wrapped = new CleanRefusal("addRelease: `vocabulary` is not the published shape.", {
      cause: cyclic,
    });
    expect(
      renderedFully(wrapped).includes(n),
      "A cyclic `cause` is the shape T010's D-12 round found dying with `RangeError`; the " +
        "seen-set is what keeps this scan from doing the same.",
    ).toBe(true);
  });
});
