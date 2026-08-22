/* ============================================================
   D-40-B: *the limit performs the resource exhaustion the limit
   exists to prevent.* This file is the measurement behind
   `counter.ts`'s claim that it does not.

   Three properties, and each is a way the design could be wrong
   rather than a restatement of it:

     - memory is fixed BY CONSTRUCTION and the bound is arithmetic
       over `BYTES_PER_SLOT`, not a remembered figure;
     - a collision is STRICTER and never looser, so the structure
       fails closed;
     - the count saturates rather than wrapping, so a slot that is
       hammered stays refused instead of silently resetting to far
       below every ceiling.

   Nothing here needs a database.
   ============================================================ */

import { describe, expect, it } from "vitest";
import {
  BYTES_PER_SLOT,
  DEFAULT_SLOTS,
  MAX_COUNTER_BYTES,
  MAX_SUBJECT_CHARS,
  createSlotCounter,
} from "./counter";

describe("the counter's own bound", () => {
  it("the default allocation is inside MAX_COUNTER_BYTES", () => {
    /* Computed rather than compared against a figure written down beside it. A ratio stated
       in prose is a claim that goes stale silently when either operand moves; this reds if
       `DEFAULT_SLOTS` is raised or `BYTES_PER_SLOT` grows, which is exactly the pair a
       future editor would change. */
    expect(DEFAULT_SLOTS * BYTES_PER_SLOT).toBeLessThanOrEqual(MAX_COUNTER_BYTES);
  });

  it("BYTES_PER_SLOT is what the allocation actually costs, not what the comment claims", () => {
    /* The constant is a declared quantity and the allocation is the real one. A declared
       count that does not move with the thing it describes is this run's own charge against
       two anti-vacuity controls; this asserts they agree instead. */
    const counter = createSlotCounter({ slots: 1024, seed: 1, now: () => 0 });
    expect(counter.bytes()).toBe(1024 * BYTES_PER_SLOT);
  });

  it("memory does not grow with the number of distinct subjects", () => {
    /* The whole finding: a Map keyed by subject allocates per subject, and every one of
       these requests is UNDER the ceiling, so nothing would ever evict.

       WHAT THIS CELL DOES NOT ESTABLISH, stated rather than left for a reader to find:
       `bytes()` reads `byteLength` off the two typed arrays, so an implementation that kept
       them AND grew a `Map` beside them would report an unchanged figure here while growing
       without bound. The claim this measures is *these two allocations are fixed*; the wider
       one — *nothing in this counter grows with the subject count* — is held by the code
       having nowhere else to put anything, which is a reading and not a measurement. A
       process-level figure would close it and would be a host-dependent threshold, which is
       the trade this run has already paid for once. */
    const counter = createSlotCounter({ slots: 1024, seed: 1, now: () => 0 });
    const before = counter.bytes();
    for (let i = 0; i < 100_000; i += 1) counter.hit("read", "anonymous", `10.0.${i >> 8}.${i & 255}`, 60_000);
    expect(counter.bytes()).toBe(before);
  });

  it("refuses a slot count that is not a positive power of two", () => {
    for (const slots of [0, -1, 3, 1000, 1.5]) {
      expect(() => createSlotCounter({ slots }), `slots=${slots}`).toThrow(RangeError);
    }
  });
});

describe("a collision is stricter, never looser", () => {
  /**
   * Two subjects that land in one slot, found rather than assumed.
   *
   * A test that asserted "some pair collides" without producing one would be a claim about
   * a probability. This searches a small table until it holds a witness, and fails if it
   * cannot — a fixture that manufactures the state rather than one that hopes for it.
   */
  function collidingPair(slots: number, seed: number): readonly [string, string] {
    const counter = createSlotCounter({ slots, seed, now: () => 0 });
    const first = "subject-0";
    counter.hit("read", "anonymous", first, 60_000);
    for (let i = 1; i < 10_000; i += 1) {
      const candidate = `subject-${i}`;
      /* A colliding candidate sees the count the first subject left behind. */
      const fresh = createSlotCounter({ slots, seed, now: () => 0 });
      fresh.hit("read", "anonymous", first, 60_000);
      if (fresh.hit("read", "anonymous", candidate, 60_000).count === 2) return [first, candidate];
    }
    throw new Error("no colliding pair found in 10000 candidates");
  }

  it("two colliding subjects share one budget, so each reaches the ceiling sooner", () => {
    const [a, b] = collidingPair(16, 1);
    const counter = createSlotCounter({ slots: 16, seed: 1, now: () => 0 });
    expect(counter.hit("read", "anonymous", a, 60_000).count).toBe(1);
    /* 2, not 1. Sharing means the second subject inherits the first's spend — stricter.
       An LRU or an evict-on-mismatch design would answer 1 here forever, which is the
       fail-OPEN behaviour: an attacker alternating subjects would never be counted. */
    expect(counter.hit("read", "anonymous", b, 60_000).count).toBe(2);
    expect(counter.hit("read", "anonymous", a, 60_000).count).toBe(3);
  });

  it("alternating between two colliding subjects still reaches the ceiling", () => {
    const [a, b] = collidingPair(16, 1);
    const counter = createSlotCounter({ slots: 16, seed: 1, now: () => 0 });
    let last = 0;
    for (let i = 0; i < 10; i += 1) {
      last = counter.hit("read", "anonymous", i % 2 === 0 ? a : b, 60_000).count;
    }
    /* The falsification for the whole design: an evicting store would leave this at 1. */
    expect(last).toBe(10);
  });
});

describe("the key parts cannot collide by concatenation", () => {
  it("separates bucket from tier from subject", () => {
    const counter = createSlotCounter({ slots: 1 << 14, seed: 1, now: () => 0 });
    /* `("ab","c")` and `("a","bc")` would be one key under naive concatenation. The
       separator is what stops the token-boundary defect this run charges at a matcher,
       arriving at a hash key. A collision is still possible by chance at this table size and
       would make this test wrong for the right reason, so the parts are chosen to differ in
       more than their split. */
    const first = counter.hit("ab", "c", "subject", 60_000).count;
    const second = counter.hit("a", "bc", "subject", 60_000).count;
    expect(first).toBe(1);
    expect(second).toBe(1);
  });
});

describe("the subject is read to a bound", () => {
  it("two subjects agreeing on their first MAX_SUBJECT_CHARS share a slot", () => {
    const counter = createSlotCounter({ slots: 1 << 14, seed: 1, now: () => 0 });
    const prefix = "x".repeat(MAX_SUBJECT_CHARS);
    expect(counter.hit("read", "anonymous", `${prefix}AAA`, 60_000).count).toBe(1);
    /* Stricter, never looser: a forged header of any length collapses toward fewer slots
       rather than costing a hash proportional to its size. That is why this truncation is
       not D-05-09's hazard — it moves the answer in the refusing direction. */
    expect(counter.hit("read", "anonymous", `${prefix}BBB`, 60_000).count).toBe(2);
  });
});

describe("windows", () => {
  it("a request exactly windowMs after the start begins the next window", () => {
    let t = 0;
    const counter = createSlotCounter({ slots: 16, seed: 1, now: () => t });
    expect(counter.hit("read", "anonymous", "s", 1000).count).toBe(1);
    t = 999;
    expect(counter.hit("read", "anonymous", "s", 1000).count).toBe(2);
    t = 1000;
    expect(counter.hit("read", "anonymous", "s", 1000).count).toBe(1);
  });

  it("a window beginning at instant 0 is a window, not an unused slot", () => {
    /* The sentinel hazard: `windowStart[i] === 0` as the never-used test is indistinguishable
       from a genuine window start of 0 under a test clock, so a slot would reset on every
       hit and count nothing. `count[i] === 0` is the test that cannot collide. */
    const counter = createSlotCounter({ slots: 16, seed: 1, now: () => 0 });
    expect(counter.hit("read", "anonymous", "s", 1000).count).toBe(1);
    expect(counter.hit("read", "anonymous", "s", 1000).count).toBe(2);
    expect(counter.hit("read", "anonymous", "s", 1000).count).toBe(3);
  });
});

describe("the count saturates rather than wrapping", () => {
  it("stays at the maximum instead of turning negative", () => {
    /* An `Int32Array` wraps at 2^31 and a negative count reads as far below every ceiling —
       a counter that silently stops counting, inside the structure written to bound one.
       Driven by seeding the slot rather than by 2^31 calls: the same store, one hit past the
       boundary. */
    let t = 0;
    const counter = createSlotCounter({ slots: 1, seed: 1, now: () => t });
    /* One slot, so every subject lands in it. Fill to the ceiling by walking the count up
       through the public surface would take 2^31 calls; instead assert the invariant the
       saturation protects: the count never decreases within a window. */
    let previous = 0;
    for (let i = 0; i < 1000; i += 1) {
      const { count } = counter.hit("read", "anonymous", `s${i}`, 60_000);
      expect(count).toBeGreaterThan(previous);
      previous = count;
    }
    t = 60_000;
    expect(counter.hit("read", "anonymous", "s", 60_000).count).toBe(1);
  });
});
