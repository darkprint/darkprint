/* ============================================================
   DarkPrint backend — ballot: the two pure guards, falsified
   AC6 and B-11's range are both decidable without a database, and
   both are decided before any statement is built. These cells are
   the implementer's own; the blind suite measures the criteria.
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/server/policy";
import { BallotRefusedError } from "./errors";
import { requireScores, requireVoter, voterIdOf } from "./guards";

const ACCOUNT: Actor = { kind: "account", accountId: "acc-1", handle: "berti" };
const OPERATOR: Actor = { kind: "operator", accountId: "ops-1" };
const ANONYMOUS: Actor = { kind: "anonymous" };

describe("AC6 — an anonymous ballot is refused", () => {
  it("refuses an anonymous actor with the `not-signed-in` kind", () => {
    expect(() => requireVoter(ANONYMOUS)).toThrow(BallotRefusedError);
    try {
      requireVoter(ANONYMOUS);
      expect.unreachable("requireVoter accepted an anonymous actor");
    } catch (err) {
      /* The KIND, not the sentence. A caller maps three refusals to three statuses and
         must not have to read English to do it. */
      expect((err as BallotRefusedError).kind).toBe("not-signed-in");
    }
  });

  it("admits a signed-in account and an operator, and answers each its own id", () => {
    expect(voterIdOf(ACCOUNT)).toBe("acc-1");
    expect(voterIdOf(OPERATOR)).toBe("ops-1");
  });
});

describe("AC6 — the shapes that separate delegating to `can` from comparing an id", () => {
  /**
   * T060's ruling: an empty-string id never matches, because `""` is what an unset column
   * and a half-built session row both look like.
   */
  it("refuses an account whose id is the empty string", () => {
    expect(voterIdOf({ kind: "account", accountId: "", handle: null })).toBeUndefined();
  });

  /** Possession of the `operator` discriminant is not authority. */
  it("refuses an operator carrying no id", () => {
    expect(voterIdOf({ kind: "operator" } as unknown as Actor)).toBeUndefined();
  });

  /**
   * **The one shape that tells the two implementations apart.** An actor whose `accountId`
   * is REAL but not its OWN — inherited from a prototype — reads as a string to any `typeof`
   * check and is refused by `can`, which fetches every field through `Object.hasOwn`.
   *
   * A `voterIdOf` that returned the id after its own `typeof` test would pass every other
   * cell in this file and grant here, which is why this one exists.
   */
  it("refuses an actor that INHERITS its account id rather than owning it", () => {
    const inherited = Object.create({ kind: "account", accountId: "acc-1" }) as Actor;
    expect((inherited as { accountId?: string }).accountId).toBe("acc-1");
    expect(voterIdOf(inherited)).toBeUndefined();
  });

  it("refuses a malformed actor rather than throwing on it", () => {
    expect(voterIdOf(null as unknown as Actor)).toBeUndefined();
    expect(voterIdOf("operator" as unknown as Actor)).toBeUndefined();
  });
});

describe("B-11 — 0 to 100, refused before a statement is built", () => {
  it("accepts both ends of the range", () => {
    expect(() => requireScores({ efficacy: 0, reliability: 100, transparency: 50 })).not.toThrow();
  });

  it("refuses each end's first step outside it", () => {
    for (const ballot of [{ efficacy: -1 }, { efficacy: 101 }]) {
      expect(() => requireScores(ballot)).toThrow(BallotRefusedError);
    }
  });

  it("refuses on every metric, not only the first", () => {
    expect(() => requireScores({ reliability: 101 })).toThrow(BallotRefusedError);
    expect(() => requireScores({ transparency: -1 })).toThrow(BallotRefusedError);
  });

  /**
   * **The check constraint cannot hold this half.** `ballot.efficacy` is `smallint`, and
   * Postgres does not refuse `87.5` for one — it ROUNDS it, so a fractional vote would be
   * stored as a different number than the caller cast and `ballot_metric_range` would see
   * nothing wrong.
   */
  it("refuses a fraction, which the database would silently round", () => {
    expect(() => requireScores({ efficacy: 87.5 })).toThrow(BallotRefusedError);
  });

  it("refuses NaN and both infinities, each of which is a `number` and not a score", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => requireScores({ efficacy: value })).toThrow(BallotRefusedError);
    }
  });

  it("names the metric it refused and never the value the caller sent", () => {
    try {
      requireScores({ transparency: 101 });
      expect.unreachable("requireScores accepted 101");
    } catch (err) {
      const refusal = err as BallotRefusedError;
      expect(refusal.kind).toBe("out-of-range");
      expect(refusal.message).toContain("transparency");
      /* D-140-06: the caller's own FIELD NAME, never the caller's own VALUE. */
      expect(refusal.message).not.toContain("101");
    }
  });

  /** Absent means no opinion, so an empty ballot has nothing to be out of range. */
  it("checks only the members the caller actually sent", () => {
    expect(() => requireScores({})).not.toThrow();
    expect(() => requireScores({ efficacy: 50 })).not.toThrow();
  });
});

describe("D-13 hygiene, on the class this module mints", () => {
  it("renders as {} and keeps its stack", () => {
    const err = new BallotRefusedError("not-signed-in", "castBallot: not signed in.");
    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
    expect(typeof err.stack).toBe("string");
    expect(err.name).toBe("BallotRefusedError");
    /* Non-enumerable, so the leak walk cannot see it and neither can `JSON.stringify` —
       but a caller reading `.kind` still can. */
    expect(err.kind).toBe("not-signed-in");
  });
});
