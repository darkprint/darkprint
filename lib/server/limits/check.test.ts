/* ============================================================
   AC5, and it is a NEGATIVE, so it is measured rather than
   observed.

   *An anonymous read below the ceiling is never delayed or
   challenged.* The block says how: **by measuring that
   `checkLimit` on an under-ceiling read performs no write**, not
   by observing that a response came back. A counter that writes
   on every read passes a latency-free test on an idle machine and
   falls over under load.

   The instrument is a `Proxy`-backed `Db` recording ANY property
   access, asserting `touched()` is empty — a proof the resource
   was never reached rather than a stronger assertion about a
   return value. T050 reached the same instrument from the other
   side, for five guards its own sanitized error surface could not
   separate.

   **The Proxy is itself controlled.** A recorder that records
   nothing satisfies `touched() === []` for every implementation,
   including one that opens a connection — the anti-vacuity
   control this run charges three times for measuring an adjacent
   quantity. So the first test touches the Proxy on purpose and
   requires it to notice.

   Nothing here needs a database, so it runs off-slot.
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { checkLimit, enforceLimit } from "./check";
import { DEFAULT_LIMITS, UNCONFIGURED_BACKOFF_MS, limitFor } from "./config";
import type { LimitConfig } from "./config";
import { createSlotCounter } from "./counter";
import { RateLimitedError } from "./errors";

/** Records every property read on the object handed to the module. */
function recordingDb(): { db: Db; touched: () => readonly string[] } {
  const seen: string[] = [];
  const db = new Proxy(
    {},
    {
      get(_target, property) {
        seen.push(String(property));
        return undefined;
      },
      has(_target, property) {
        seen.push(`has:${String(property)}`);
        return false;
      },
    },
  ) as Db;
  return { db, touched: () => seen };
}

const CONFIG: LimitConfig = {
  read: {
    anonymous: { limit: 3, windowMs: 60_000 },
    account: { limit: 5, windowMs: 60_000 },
    key: { limit: 9, windowMs: 60_000 },
  },
};

const ANON = { accountId: null, keyId: null, ip: "203.0.113.7" };
const ACCOUNT = { accountId: "acc-1", keyId: null, ip: "203.0.113.7" };
const KEYED = { accountId: "acc-1", keyId: "key-1", ip: "203.0.113.7" };

/** A counter whose clock the test owns, so a window can be crossed without sleeping. */
function fixedCounter(startAt = 1_000_000) {
  let t = startAt;
  return {
    counter: createSlotCounter({ slots: 1024, seed: 1, now: () => t }),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("the no-write instrument can fail", () => {
  it("the recording Db notices a property read", () => {
    const { db, touched } = recordingDb();
    /* Two-factor: without this the assertions below are satisfied by a recorder that
       records nothing, whatever the module does. Called directly rather than through the
       module, so the control does not depend on the mechanism it is controlling for. */
    void (db as unknown as Record<string, unknown>).select;
    expect(touched()).toEqual(["select"]);
  });
});

describe("AC5: an under-ceiling read reaches no database", () => {
  it("an anonymous under-ceiling read touches the Db on no property", async () => {
    const { counter } = fixedCounter();
    const { db, touched } = recordingDb();
    const verdict = await checkLimit(db, ANON, "read", { config: CONFIG, counter });
    expect(verdict.allowed).toBe(true);
    expect(touched()).toEqual([]);
  });

  it("an OVER-ceiling read touches the Db on no property either", async () => {
    /* The criterion is about the under-ceiling case and this is the wider claim: there is
       no path through `checkLimit` that reaches a connection, so the instrument cannot be
       satisfied by an implementation that only defers its write until the ceiling. */
    const { counter } = fixedCounter();
    const { db, touched } = recordingDb();
    for (let i = 0; i < 5; i += 1) await checkLimit(db, ANON, "read", { config: CONFIG, counter });
    expect(touched()).toEqual([]);
  });

  it("a keyed read touches the Db on no property, so the claim is total over tiers", async () => {
    const { counter } = fixedCounter();
    const { db, touched } = recordingDb();
    await checkLimit(db, KEYED, "read", { config: CONFIG, counter });
    expect(touched()).toEqual([]);
  });
});

describe("the verdict", () => {
  it("counts the request being judged, so remaining falls from the first call", async () => {
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    const first = await checkLimit(db, ANON, "read", { config: CONFIG, counter });
    expect(first).toMatchObject({ allowed: true, limit: 3, remaining: 2 });
  });

  it("allows exactly `limit` requests and refuses the next", async () => {
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    const seen: boolean[] = [];
    for (let i = 0; i < 4; i += 1) {
      seen.push((await checkLimit(db, ANON, "read", { config: CONFIG, counter })).allowed);
    }
    expect(seen).toEqual([true, true, true, false]);
  });

  it("never reports a negative remaining", async () => {
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    let last = 0;
    for (let i = 0; i < 10; i += 1) {
      last = (await checkLimit(db, ANON, "read", { config: CONFIG, counter })).remaining;
    }
    expect(last).toBe(0);
  });

  it("resets when the window rolls", async () => {
    const { counter, advance } = fixedCounter();
    const { db } = recordingDb();
    for (let i = 0; i < 4; i += 1) await checkLimit(db, ANON, "read", { config: CONFIG, counter });
    advance(60_000);
    const after = await checkLimit(db, ANON, "read", { config: CONFIG, counter });
    expect(after).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("resetAt is the window start plus its length, not a duration from now", async () => {
    const { counter } = fixedCounter(1_000_000);
    const { db } = recordingDb();
    const verdict = await checkLimit(db, ANON, "read", { config: CONFIG, counter });
    expect(verdict.resetAt.getTime()).toBe(1_000_000 + 60_000);
  });
});

describe("AC3: a key raises the ceiling, and it is an ordering rather than a value", () => {
  it("key >= account >= anonymous for the same bucket", async () => {
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    const anon = await checkLimit(db, ANON, "read", { config: CONFIG, counter });
    const account = await checkLimit(db, ACCOUNT, "read", { config: CONFIG, counter });
    const keyed = await checkLimit(db, KEYED, "read", { config: CONFIG, counter });
    /* Asserted as an ordering because the numbers are the owner's and still `TBD:`. This
       holds against any ceilings anybody chooses, which is the property the contract can
       carry while the values are open. */
    expect(account.limit).toBeGreaterThanOrEqual(anon.limit);
    expect(keyed.limit).toBeGreaterThanOrEqual(account.limit);
  });

  it("the tiers count separately, so an anonymous flood cannot spend a key's budget", async () => {
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    for (let i = 0; i < 20; i += 1) await checkLimit(db, ANON, "read", { config: CONFIG, counter });
    const keyed = await checkLimit(db, KEYED, "read", { config: CONFIG, counter });
    expect(keyed.allowed).toBe(true);
  });
});

describe("an unconfigured bucket refuses rather than passing", () => {
  it("refuses a bucket nobody configured", async () => {
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    /* D-70-18's shape at a `Record` index: a lookup answering `undefined`, read as "no
       limit", is a criterion satisfiable by never limiting anything. This is the assertion
       that makes AC2 false-able. */
    const verdict = await checkLimit(db, ANON, "unconfigured", { config: CONFIG, counter });
    expect(verdict).toMatchObject({ allowed: false, limit: 0, remaining: 0 });
  });

  it("refuses a bucket named by a prototype property rather than by the config", async () => {
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    /* `Object.prototype.constructor` is reachable by a bare index read on a `Record`, and it
       would answer a FUNCTION where the type says `BucketLimit`. T060's never-inherit ruling
       at a config lookup. */
    for (const bucket of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      const verdict = await checkLimit(db, ANON, bucket, { config: CONFIG, counter });
      expect(verdict.allowed, `bucket ${bucket}`).toBe(false);
    }
  });

  it("F-230-M: its resetAt is in the FUTURE, so a client honouring it does not hot-loop", async () => {
    /* The field was `new Date(0)`. D-230-09 publishes `resetAt` as a MACHINE-READABLE member
       so a client parses it instead of regexing the sentence, and `http.ts` declines a
       `retry-after` deliberately — so this is the whole recovery signal. An epoch instant
       computes a wait of zero: retry, refused, retry, at full request rate, forever.

       Bracketed between two real clock reads rather than pinned to a literal. The instant is
       relative to now because the module reads `Date.now()` rather than carrying a second
       clock beside the counter's, and the bracket is exact to the duration of the call. */
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    const before = Date.now();
    const verdict = await checkLimit(db, ANON, "unconfigured", { config: CONFIG, counter });
    const after = Date.now();
    expect(verdict.resetAt.getTime()).toBeGreaterThan(after);
    expect(verdict.resetAt.getTime()).toBeGreaterThanOrEqual(before + UNCONFIGURED_BACKOFF_MS);
    expect(verdict.resetAt.getTime()).toBeLessThanOrEqual(after + UNCONFIGURED_BACKOFF_MS);
  });

  it("its window is not the zero sentinel, and resetAt is that window's start plus it", async () => {
    /* `windowMs: 0` rendered as `per 0ms` inside the EXACT-MATCHED form. `describeWindow`'s
       comment says a configured window it cannot describe does not exist — true, and the
       assumption the sentinel broke, since an unconfigured bucket has no configured window.

       The second half is D-230-03's bindable property, `resetAt = windowStart + windowMs`,
       held for this verdict as for every other. Without it the two fields could be chosen
       independently and one of them could go back to being a sentinel on its own. */
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    const before = Date.now();
    const verdict = await checkLimit(db, ANON, "unconfigured", { config: CONFIG, counter });
    const after = Date.now();
    expect(verdict.windowMs).toBeGreaterThan(0);
    const windowStart = verdict.resetAt.getTime() - verdict.windowMs;
    expect(windowStart).toBeGreaterThanOrEqual(before);
    expect(windowStart).toBeLessThanOrEqual(after);
  });

  it("its refusal is distinguishable from a cell somebody closed on purpose", async () => {
    /* D-230-04's intent is that adding a bucket without a number is LOUD rather than free.
       `write`/`anonymous` is a deliberately closed cell and renders `limit of 0 per hour`; an
       unconfigured bucket rendering the same sentence would be indistinguishable from it to
       the developer who mistyped a bucket name, and the refusal would read as a decision
       somebody took. The window is the only part of the exact-matched form that can separate
       them, so this is the assertion that it does.

       Derived from `DEFAULT_LIMITS` rather than from the literal hour, so it stays true if
       the owner ever rules a window that is not an hour. The length check is the anti-vacuity
       control: over an empty table every `toBeGreaterThan` below would pass. */
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    const verdict = await checkLimit(db, ANON, "unconfigured", { config: CONFIG, counter });
    const configuredWindows = Object.values(DEFAULT_LIMITS).flatMap((tiers) =>
      Object.values(tiers).map((cell) => cell.windowMs),
    );
    expect(configuredWindows).toHaveLength(9);
    for (const windowMs of configuredWindows) {
      expect(verdict.windowMs).toBeGreaterThan(windowMs);
    }
  });

  it("an unconfigured bucket consumes no slot", async () => {
    /* It must not be possible to fill the fixed array by naming buckets nobody configured —
       which would be D-40-B's clause arriving through the refusal path. */
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    for (let i = 0; i < 50; i += 1) {
      await checkLimit(db, ANON, `nope-${i}`, { config: CONFIG, counter });
    }
    const verdict = await checkLimit(db, ANON, "read", { config: CONFIG, counter });
    expect(verdict.remaining).toBe(2);
  });
});

describe("enforceLimit refuses rather than reporting", () => {
  it("returns the verdict while under the ceiling", async () => {
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    await expect(enforceLimit(db, ANON, "read", { config: CONFIG, counter })).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("throws RateLimitedError past it, naming the bucket, the number, the window and the instant", async () => {
    const { counter } = fixedCounter(1_000_000);
    const { db } = recordingDb();
    for (let i = 0; i < 3; i += 1) await enforceLimit(db, ANON, "read", { config: CONFIG, counter });
    /* The expected message is a LITERAL here rather than built from the module. A test that
       imports its expectation from the subject asserts that the subject agrees with itself,
       and passes unchanged the day the wording starts interpolating something it should not. */
    await expect(enforceLimit(db, ANON, "read", { config: CONFIG, counter })).rejects.toThrow(
      new RateLimitedError(
        "read: limit of 3 per minute reached; resets at 1970-01-01T00:17:40.000Z.",
      ),
    );
  });

  it("refuses an unconfigured bucket rather than passing it", async () => {
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    await expect(
      enforceLimit(db, ANON, "unconfigured", { config: CONFIG, counter }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe("the ruled ceilings, as shipped", () => {
  const HOUR = 60 * 60 * 1000;

  it("is the owner's matrix, cell for cell", () => {
    /* Written out as LITERALS rather than derived from the table under test, which would
       assert the table agrees with itself. Nine cells, because the reporting of this task was
       that four ruled quantities fill three of nine — so the nine is the number that has to
       be visible, and a tenth bucket or a fourth tier reds here. */
    const cell = (bucket: string, tier: "anonymous" | "account" | "key") =>
      limitFor(DEFAULT_LIMITS, bucket, tier);
    expect(cell("read", "anonymous")).toEqual({ limit: 600, windowMs: HOUR });
    expect(cell("read", "account")).toEqual({ limit: 600, windowMs: HOUR });
    expect(cell("read", "key")).toEqual({ limit: 6_000, windowMs: HOUR });
    expect(cell("write", "anonymous")).toEqual({ limit: 0, windowMs: HOUR });
    expect(cell("write", "account")).toEqual({ limit: 120, windowMs: HOUR });
    expect(cell("write", "key")).toEqual({ limit: 120, windowMs: HOUR });
    expect(cell("upload", "anonymous")).toEqual({ limit: 0, windowMs: HOUR });
    expect(cell("upload", "account")).toEqual({ limit: 30, windowMs: HOUR });
    expect(cell("upload", "key")).toEqual({ limit: 30, windowMs: HOUR });
    expect(Object.keys(DEFAULT_LIMITS).sort()).toEqual(["read", "upload", "write"]);
  });

  it("a refused cell actually refuses, rather than being a zero nobody reads", async () => {
    /* `limit: 0` is only a refusal if the arithmetic makes it one. `allowed: count <= limit`
       with the request already counted is what does it, and this is the measurement of that
       rather than the claim — a cell written as `REFUSED` that admitted one request would
       satisfy the matrix equality above perfectly, because that one asserts the VALUE and
       this one asserts what the value does. */
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    const anon = { accountId: null, keyId: null, ip: "203.0.113.7" };
    for (const bucket of ["write", "upload"]) {
      const verdict = await checkLimit(db, anon, bucket, { counter });
      expect(verdict.allowed, bucket).toBe(false);
      expect(verdict.limit, bucket).toBe(0);
      expect(verdict.remaining, bucket).toBe(0);
    }
  });

  it("a key raises the read ceiling tenfold and changes nothing else", async () => {
    /* AC3 made literal by the fill: the key's ENTIRE effect is reads. A middle ceiling for
       signed-in callers was declined, so `account` and `anonymous` must agree on `read` and
       `account` and `key` must agree on `write` and `upload`. Three equalities, and each is a
       different way the fill could have been transcribed wrongly. */
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    const ip = "203.0.113.7";
    const anon = await checkLimit(db, { accountId: null, keyId: null, ip }, "read", { counter });
    const acct = await checkLimit(db, { accountId: "a", keyId: null, ip }, "read", { counter });
    const keyed = await checkLimit(db, { accountId: "a", keyId: "k", ip }, "read", { counter });
    expect(acct.limit).toBe(anon.limit);
    expect(keyed.limit).toBe(anon.limit * 10);

    const acctW = await checkLimit(db, { accountId: "a", keyId: null, ip }, "write", { counter });
    const keyedW = await checkLimit(db, { accountId: "a", keyId: "k", ip }, "write", { counter });
    expect(keyedW.limit).toBe(acctW.limit);
  });

  it("a bucket outside the table still refuses, so filling it changed nothing there", async () => {
    /* D-230-04 survives the emptiness ending. That property was what made an empty table safe
       and it is easy to lose in the edit that populates one. */
    const { counter } = fixedCounter();
    const { db } = recordingDb();
    const anon = { accountId: null, keyId: null, ip: "203.0.113.7" };
    expect((await checkLimit(db, anon, "search", { counter })).allowed).toBe(false);
  });
});
