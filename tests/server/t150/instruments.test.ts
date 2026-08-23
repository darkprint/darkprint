/* ============================================================
   T150 — the instruments, falsified against hand-built inputs

   Not a criterion. Every cell in this suite rests on four helpers
   in `contract.ts` — `assertSignalState`, `assertSealed`,
   `assertNoValue` and `movedTables` — and a helper that only ever
   ACCEPTS is resolution rather than discrimination. So each pair
   below is good-input-accepted beside bad-input-REJECTED, over
   values built here rather than produced by anything under test.

   ── this file found a defect in its own subject, which is why it
      is on the branch rather than in a scratchpad ──
   `renderingsOf` shipped with four channels — `message`,
   `String(err)`, `JSON.stringify(err)`, and own property NAMES —
   and discriminated on eight of nine shapes. The ninth passed: a
   driver string on a **non-enumerable own property**.

   All four are blind to it, and each for its own reason. `message`
   does not see it. `String(err)` is `name: message`.
   `JSON.stringify` walks enumerable properties only and renders
   `{}`. And the names channel held `query` while the leak was in
   its VALUE — looking in the right place and comparing the wrong
   half.

   That shape is not exotic. **It is what a module reaches for when
   it is trying to satisfy D-13's hygiene clause**, because burying
   a driver payload where a structured log renders `{}` is exactly
   what the clause rewards. The clause and the scan are in tension
   and the scan was on the losing side. `renderingsOf` gained an
   `own` channel and this file gained the three cells at the bottom,
   which check the widening for FALSE positives — a stack carries
   this repository's own paths and frame names, so a deny list that
   was safe over `message` alone could start matching path text.

   Found by falsifying the function, never by reading it. Kept here
   so the next reader who simplifies `renderingsOf` back to
   `JSON.stringify` reds instead of silently re-opening it.
   ============================================================ */

import { describe, expect, it } from "vitest";
import {
  assertSignalState,
  assertSealed,
  assertNoValue,
  movedTableNames,
  movedTables,
  rejection,
  outcomeOf,
  fireAll,
  type Snapshot,
} from "./contract";

const GOOD = { starCount: 1, downloadCount: 2, noteCount: 3, starredByCaller: false };

describe("assertSignalState", () => {
  it("accepts the published shape", () => {
    expect(assertSignalState(GOOD, "x")).toEqual(GOOD);
  });
  it.each([
    ["numeric-as-STRING", { ...GOOD, starCount: "1" }],
    ["missing starredByCaller", { starCount: 1, downloadCount: 2, noteCount: 3 }],
    ["starredByCaller undefined", { ...GOOD, starredByCaller: undefined }],
    ["starredByCaller truthy non-boolean", { ...GOOD, starredByCaller: 1 }],
    ["an extra member", { ...GOOD, votes: 4 }],
    ["a negative count", { ...GOOD, noteCount: -1 }],
    ["a fractional count", { ...GOOD, downloadCount: 1.5 }],
    ["null", null],
    ["an array", []],
  ])("REJECTS %s", (_label, value) => {
    expect(() => assertSignalState(value, "x")).toThrow();
  });
});

describe("assertSealed", () => {
  it("accepts a sealed message", () => {
    expect(() => assertSealed(new Error("toggleStar: the counter store failed."), "x")).not.toThrow();
  });
  it("REJECTS the statement in `message`", () => {
    expect(() => assertSealed(new Error('select * from "target" where kind = $1'), "x")).toThrow();
  });
  it("REJECTS a driver error on an ENUMERABLE own property", () => {
    const e = new Error("toggleStar: the counter store failed.");
    (e as unknown as Record<string, unknown>).cause = 'insert into "target_actor" ...';
    expect(() => assertSealed(e, "x")).toThrow();
  });
  it("REJECTS a driver error on a NON-ENUMERABLE own property", () => {
    /* the shape a JSON.stringify walk cannot see; getOwnPropertyNames is why this reds */
    const e = new Error("toggleStar: the counter store failed.");
    Object.defineProperty(e, "query", { value: "duplicate key value", enumerable: false });
    expect(() => assertSealed(e, "x")).toThrow();
  });
});

describe("assertNoValue", () => {
  it("accepts an error that carries none of the minted values", () => {
    expect(() =>
      assertNoValue(new Error("toggleStar: the counter store failed."), ["t150-blueprint-1-abcdef01"], "x"),
    ).not.toThrow();
  });
  it("REJECTS a refId echoed into the message", () => {
    expect(() =>
      assertNoValue(new Error("toggleStar: t150-blueprint-1-abcdef01 failed"), ["t150-blueprint-1-abcdef01"], "x"),
    ).toThrow();
  });
});

describe("movedTables", () => {
  const snap = (m: Record<string, string[]>): Snapshot => new Map(Object.entries(m));
  it("reports nothing when the row SETS are equal", () => {
    expect(movedTableNames(snap({ a: ["1", "2"], b: [] }), snap({ a: ["2", "1"], b: [] }))).toEqual([]);
  });
  it("REJECTS equal COUNTS with different contents — 2 vs 2, different rows", () => {
    /* the leak-stamp failure mode: equal counts are not equal state */
    expect(movedTableNames(snap({ a: ["1", "2"] }), snap({ a: ["1", "3"] }))).toEqual(["a"]);
  });
  it("sees a removal as well as an addition", () => {
    const d = movedTables(snap({ a: ["1", "2"] }), snap({ a: ["1"] }));
    expect(d).toEqual([{ table: "a", added: [], removed: ["2"] }]);
  });
  it("sees a duplicate row added to a table that already had one", () => {
    expect(movedTableNames(snap({ a: ["1"] }), snap({ a: ["1", "1"] }))).toEqual(["a"]);
  });
});

describe("rejection", () => {
  it("returns the error when the call rejects", async () => {
    const e = new Error("no");
    expect(await rejection(Promise.reject(e), "x")).toBe(e);
  });
  it("THROWS when the call resolved — an absent refusal is the defect", async () => {
    await expect(rejection(Promise.resolve({ ok: 1 }), "x")).rejects.toThrow(/RESOLVED/);
  });
});

describe("fireAll", () => {
  it("starts every call before awaiting any", async () => {
    const started: number[] = [];
    const gate: (() => void)[] = [];
    const results = await Promise.all([
      fireAll(4, (i) => {
        started.push(i);
        return new Promise((r) => gate.push(() => r(i)));
      }).then((x) => {
        return x;
      }),
      (async () => {
        /* all four must be started before any resolves */
        expect(started).toEqual([0, 1, 2, 3]);
        gate.forEach((g) => g());
      })(),
    ]);
    expect((results[0] as PromiseSettledResult<unknown>[]).map((r) => r.status)).toEqual([
      "fulfilled", "fulfilled", "fulfilled", "fulfilled",
    ]);
  });
  it("converts a SYNCHRONOUS throw into a rejection instead of aborting the loop", async () => {
    /* without the try, caller 0 throwing would leave 1..3 unstarted and turn a race into a
       two-caller sequence, reporting a green concurrency criterion for nobody's race */
    const started: number[] = [];
    const r = await fireAll(4, (i) => {
      started.push(i);
      if (i === 0) throw new Error("sync");
      return Promise.resolve(i);
    });
    expect(started).toEqual([0, 1, 2, 3]);
    expect(r.map((x) => x.status)).toEqual(["rejected", "fulfilled", "fulfilled", "fulfilled"]);
  });
});

describe("outcomeOf", () => {
  it("distinguishes a value from a rejection", async () => {
    expect((await outcomeOf(() => 1)).settled).toBe("value");
    expect((await outcomeOf(() => { throw new Error("x"); })).settled).toBe("rejected");
  });
});

/* ── added after the `own` channel was widened: does the widening FALSE-POSITIVE? ──
   `own` now renders every own property value, and `stack` is an own property of every Error.
   A stack carries this repository's own file paths and function names, so a deny list that was
   safe over `message` alone could start matching path text. Both cells below are the
   good-input-accepted half that the widening could have broken. */
describe("the widened `own` channel does not false-positive", () => {
  function insertIntoTargetActorRow(): never {
    /* a function name chosen to be as close to the deny list as a real call frame gets */
    throw new Error("toggleStar: the counter store failed.");
  }
  function selectTargetRow(): never {
    return insertIntoTargetActorRow();
  }
  it("accepts a real error thrown through realistically-named frames", () => {
    try {
      selectTargetRow();
    } catch (e) {
      expect(() => assertSealed(e, "x")).not.toThrow();
      return;
    }
    throw new Error("unreachable");
  });
  it("accepts a real error against minted values that resemble this file's own path", () => {
    try {
      selectTargetRow();
    } catch (e) {
      /* `t150-blueprint-…` vs the path segment `t150/` — near, and must not collide */
      expect(() =>
        assertNoValue(e, ["t150-blueprint-9-deadbeef", "0d1a5f4e-1111-2222-3333-444455556666"], "x"),
      ).not.toThrow();
      return;
    }
    throw new Error("unreachable");
  });
  it("ACCEPTS the sanctioned `cause` chain, statement and bound values included", () => {
    /*
     * The correction that cost the most to get right, and it went the OPPOSITE way to the
     * morning's widening.
     *
     * Following `cause` reds the real module, and that red is a **false charge**:
     * `err.cause.message` and `err.cause.query` carry the failed statement and the bound
     * `refId`, and that is the tree's ratified convention. `lib/server/registry/errors.ts:12-15`
     * states the clause as five merged modules apply it — *"`Object.keys(err)` is empty and
     * `JSON.stringify(err)` is exactly `"{}"`; **`cause` is present but non-enumerable**; `stack`
     * is retained. Whitelist, not blacklist — the only thing any rendering carries is the
     * operation."* — and `tests/error-hygiene.test.ts` constructs every class at both arities
     * and passes them.
     *
     * So D-13 governs what a RENDERING carries, `cause` is the one sanctioned carrier, and a
     * scanner that descends into it charges a module for a decision something else already made.
     *
     * This is the exact error shape the real module produces, rebuilt here.
     */
    const driver = new Error(
      'Failed query: select "id", "star_count" from "target" where ("target"."kind" = $1)',
    );
    (driver as unknown as Record<string, unknown>).query =
      'select "id", "star_count" from "target" where ("target"."kind" = $1)';
    (driver as unknown as Record<string, unknown>).params = ["card", "t150-probe-ref-9999"];
    const sealed = new Error("getSignals: the counter store failed.", { cause: driver });
    expect(() => assertSealed(sealed, "x")).not.toThrow();
    expect(() => assertNoValue(sealed, ["t150-probe-ref-9999"], "x")).not.toThrow();
  });

  it("STILL REJECTS a driver payload stashed on the ERROR ITSELF, non-enumerably", () => {
    /*
     * The morning's finding, re-pinned after the `cause` exemption so the two hazards stay
     * separable. `cause` is sanctioned; anywhere else is not, and burying it non-enumerably is
     * precisely the shape that renders as `{}` in a structured log.
     *
     * Without this cell the exemption above would be indistinguishable from deleting the check.
     */
    const e = new Error("toggleStar: the counter store failed.");
    Object.defineProperty(e, "query", {
      value: 'insert into "target_actor" (target_id) values ($1)',
      enumerable: false,
    });
    expect(() => assertSealed(e, "x")).toThrow();
  });

  it("STILL REJECTS a bound value stashed on the error itself", () => {
    const e = new Error("toggleStar: the counter store failed.");
    Object.defineProperty(e, "boundParams", {
      value: ["t150-probe-ref-9999"],
      enumerable: false,
    });
    expect(() => assertNoValue(e, ["t150-probe-ref-9999"], "x")).toThrow();
  });
});
