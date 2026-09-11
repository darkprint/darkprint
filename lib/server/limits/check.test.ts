/* ============================================================
   AC5, and it is a NEGATIVE, so it is measured rather than
   observed.

   *An anonymous read below the ceiling is never delayed or
   challenged.* The block says how: **by measuring that
   `checkLimit` on an under-ceiling read performs no write**, not
   by observing that a response came back. A counter that writes
   on every read passes a latency-free test on an idle machine and
   falls over under load.

   **The `Proxy`-backed `Db` that used to measure it is GONE, and
   what replaced it is stronger (T231, C3).** The instrument was a
   `Db` recording any property access, asserting `touched()` was
   empty. It needed a `db` parameter to hand the Proxy — and
   D-230-05 had already established that parameter was never used
   on any path, so the module carried a parameter for the sake of
   the cell that measured it not being used.

   `db` has left both signatures. A function that CANNOT REACH a
   connection is a stronger claim than one observed not to, and it
   is checked by the compiler on every build rather than by a cell
   somebody has to run. What stands in its place here is an
   equality on `check.ts`'s own import list, below — the claim
   *this file cannot reach the database* stated where it can red.

   Nothing here needs a database, so it runs off-slot.
   ============================================================ */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkLimit, enforceLimit } from "./check";
import { KEY_SCOPES, isKeyScope } from "./types";
import { DEFAULT_LIMITS, UNCONFIGURED_BACKOFF_MS, limitFor } from "./config";
import type { LimitConfig } from "./config";
import { createSlotCounter, type SlotCounter } from "./counter";
import { RateLimitedError } from "./errors";
import type { ApiKeyRecord, LimitSubject, ResolvedKey } from "./types";

const CONFIG: LimitConfig = {
  read: {
    anonymous: { limit: 3, windowMs: 60_000 },
    account: { limit: 5, windowMs: 60_000 },
    key: { limit: 9, windowMs: 60_000 },
  },
};

/**
 * A record shaped exactly as `listKeys` returns them — the forgeable half of the pair.
 *
 * Live, not revoked, so the cells below separate the BRAND from the revocation state. A
 * revoked record would let a reader think the compile error is about `revokedAt`, and it is
 * not: the brand proves provenance and nothing about revocation.
 */
const UNRESOLVED: ApiKeyRecord = {
  keyId: "KEYIDLITERAL-1111-4111-8111-111111111111",
  accountId: "acc-1",
  label: "a listed key",
  /* `write`, so this record is the most privileged thing `listKeys` could hand back. The
     compile error the cells below assert is about the BRAND, and a `read` here would let a
     reader think the scope was doing the refusing. */
  scope: "write",
  createdAt: new Date(0),
  revokedAt: null,
};

/**
 * What `resolveKey` answers, forged HERE by a cast because nothing else can make one.
 *
 * The cast is the demonstration rather than a workaround: a colocated test can reach for it
 * and a caller in another module cannot, because the brand is a `unique symbol` `types.ts`
 * declares and does not export. `@ts-expect-error` below is what measures that.
 */
const RESOLVED = UNRESOLVED as ResolvedKey;

const ANON: LimitSubject = { tier: "anonymous", ip: "203.0.113.7" };
const ACCOUNT: LimitSubject = { tier: "account", accountId: "acc-1", ip: "203.0.113.7" };
const KEYED: LimitSubject = { tier: "key", key: RESOLVED, ip: "203.0.113.7" };

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

describe("AC5: this file cannot reach a database, which is stronger than not reaching one", () => {
  it("check.ts imports nothing that could open a connection", () => {
    /* The T231 replacement for the `Proxy`-backed `Db`. That instrument needed a `db`
       parameter to hand the Proxy, and D-230-05 had already ruled the parameter unused on
       every path — so the module carried an argument so that a cell could watch it not be
       used. With `db` off the signature there is nothing to hand a Proxy and the claim moves
       up a level: this file has no route to a connection at all.

       An EQUALITY on the whole import list rather than a `not.toContain("@/lib/db")`. A
       containment check absorbs a fifth import silently, and the failure this is guarding
       against is somebody restoring database access — which would arrive as an import
       nobody enumerated. The equality also cannot be blinded by the file's own prose: it
       matches `import ... from "..."` statements anchored to line boundaries, so the four
       mentions of `Db` and `lib/db/schema.ts` in the header comment are not candidates.

       The list length is the anti-vacuity control: a regex that matched nothing would
       satisfy `not.toContain` for every possible file, and satisfies this for none. */
    const source = readFileSync(new URL("./check.ts", import.meta.url), "utf8");
    const imported = [...source.matchAll(/^import[\s\S]*?from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(
      imported,
      `check.ts's import list changed. AC5's no-access half is held by this list being ` +
        `exactly the four module-local files, so an import that can reach a connection reds ` +
        `here rather than in a cell somebody has to think to write.`,
    ).toEqual(["./config", "./counter", "./types", "./errors"]);
  });

  it("neither published function declares a Db parameter", () => {
    /* The runtime half of the same claim, and it is what `surface.test.ts` reads from the
       other side: `checkLimit` declares `(subject, bucket)` with `options` defaulted, so
       `.length` is 2. A restored `db` would move it to 3 whichever end it was added at. */
    expect(checkLimit.length).toBe(2);
    expect(enforceLimit.length).toBe(2);
  });

  it("an under-ceiling read reaches the counter and nothing else", async () => {
    /* AC5's no-WRITE half, which is still a runtime question: the counter is the only thing
       `checkLimit` touches, and this is the cell that says so by owning it. `hit` is the
       whole of the interface, so a call that went anywhere else would have to invent a
       collaborator this counter does not provide. */
    const { counter } = fixedCounter();
    const calls: string[] = [];
    const watched: SlotCounter = {
      hit: (bucket, tier, subject, windowMs) => {
        calls.push(`${bucket}/${tier}/${subject}`);
        return counter.hit(bucket, tier, subject, windowMs);
      },
      bytes: () => counter.bytes(),
    };
    const verdict = await checkLimit(ANON, "read", { config: CONFIG, counter: watched });
    expect(verdict.allowed).toBe(true);
    expect(calls).toEqual(["read/anonymous/203.0.113.7"]);
  });
});

describe("T231: the key precondition is a type rather than caller discipline", () => {
  it("refuses a bare keyId string, which is what the old subject accepted", () => {
    /* The measurement T231 exists because of: `checkLimit` was handed `keyId: string | null`
       and any caller could fill it with a string no `resolveKey` ever produced. Each
       `@ts-expect-error` below is an assertion that reds AT TYPECHECK if the shape ever
       admits its line again — the directive itself errors when the code under it compiles,
       so these are green-against-red rather than comments about an intention. */
    // @ts-expect-error a bare keyId is exactly what T231 closes: the union has no such member
    void ((): LimitSubject => ({ tier: "key", keyId: "key-1", ip: "203.0.113.7" }));
    // @ts-expect-error and the key arm cannot be satisfied by a string in the right place
    void ((): LimitSubject => ({ tier: "key", key: "key-1", ip: "203.0.113.7" }));
  });

  it("refuses an ApiKeyRecord, which is what listKeys hands a caller", () => {
    /* The leak that actually mattered. `listKeys` returns `ApiKeyRecord[]` INCLUDING revoked
       rows — deliberately, because `revokedAt` moving to an instant is AC4's only
       HTTP-observable form — and those records were structurally identical to `resolveKey`'s.
       A caller could take one and buy the key tier's ceiling with it. `UNRESOLVED` is a LIVE
       record on purpose: the refusal is about provenance, not about revocation. */
    // @ts-expect-error an unbranded record is not what resolveKey returns, live or revoked
    void ((): LimitSubject => ({ tier: "key", key: UNRESOLVED, ip: "203.0.113.7" }));
    /* The same refusal against a freshly INFERRED object type rather than one annotated
       `ApiKeyRecord`, so the first directive cannot be passing because of how `UNRESOLVED` is
       declared. Bound to a const first because `@ts-expect-error` suppresses the line that
       follows it, and a multi-line literal reports its error several lines in — a directive
       that misses its error reds as unused, which is a guard that fails for the right reason
       at the wrong moment. */
    const inferred = {
      keyId: "KEYIDLITERAL-2222-4222-8222-222222222222",
      accountId: "acc-1",
      label: "written out in place",
      createdAt: new Date(0),
      revokedAt: null,
    };
    // @ts-expect-error nor is one written out in place, so it is the BRAND and not the const
    void ((): LimitSubject => ({ tier: "key", key: inferred, ip: "203.0.113.7" }));
  });

  it("holds the brand on exactly two of its seven compile-time directives", () => {
    /* A reader counting directives in this file gets seven and could conclude seven of them
       hold the brand. They do not, and the difference was MEASURED rather than reasoned: deleting
       the brand from `ResolvedKey` leaves exactly the two directives in the cell above
       unused, and every other one still errors for a reason the UNION supplies — a string is
       not a record, the account arm has no `key`, the key arm has no `accountId`. Those are
       real assertions about a real property and they are not evidence about the brand.

       So the count is pinned rather than described. An eighth directive lands here and makes
       whoever added it say which of the two claims it belongs to.

       Anchored to line start, which is what stops this counting its own pattern: the regex
       lives on a line beginning with `const`, so a pattern requiring the line to OPEN with a
       comment marker cannot match at it. A check blinded by quoting the string it looks for
       is a check that reads green either way. */
    const source = readFileSync(new URL("./check.test.ts", import.meta.url), "utf8");
    const directives = source.match(/^\s*\/\/ @ts-expect-error/gm) ?? [];
    expect(
      directives,
      `the compile-time directive count moved. Two of them hold the ResolvedKey brand and ` +
        `five hold the LimitSubject union; a new one belongs to one of those claims and the ` +
        `cell above says which is which.`,
    ).toHaveLength(7);
  });

  it("refuses a tier that disagrees with the identifier beside it", () => {
    /* The union's other half. The old record let a caller fill `accountId` and `keyId`
       together and had `tierOf` decide what that meant; here each arm admits exactly the one
       identifier its tier names, so the two cannot disagree. */
    // @ts-expect-error the account arm has no key
    void ((): LimitSubject => ({ tier: "account", key: RESOLVED, ip: "203.0.113.7" }));
    // @ts-expect-error the key arm carries accountId once, inside the record
    void ((): LimitSubject => ({ tier: "key", key: RESOLVED, accountId: "acc-1", ip: "1.2.3.4" }));
    // @ts-expect-error the anonymous arm carries no identifier at all
    void ((): LimitSubject => ({ tier: "anonymous", accountId: "acc-1", ip: "203.0.113.7" }));
  });

  it("still accepts what resolveKey returns, so the refusals above are not vacuous", async () => {
    /* The positive control, and it is the half that separates a working brand from a type
       nothing can satisfy. Every `@ts-expect-error` above would still be green if
       `LimitSubject` were uninhabitable; this is the cell that says the key arm has a
       member. */
    const { counter } = fixedCounter();
    const verdict = await checkLimit(KEYED, "read", { config: CONFIG, counter });
    expect(verdict.limit).toBe(9);
  });

  it("does not publish a way to mint one, and does not publish tierOf either", async () => {
    /* A brand with an exported constructor is a compile error with an escape hatch beside it,
       and a mint could be spelled anything — `asResolvedKey`, `brandKey`, `unsafeKey`. A
       pattern over names I could think of would cover the spellings I thought of, which is
       the shape of guard that reads as coverage while covering less.

       So this is an EQUALITY over the barrel's whole value surface. `A floor absorbs
       additions silently and then stops detecting removals` is `contract.ts`'s own sentence
       for why, one directory over. It reds for a mint under any name; it also reds for
       `tierOf` coming back, which is the second claim this cell holds and the reason the two
       are not separate cells — they are one question about what this barrel publishes.

       Types are absent by construction rather than by filtering: `ResolvedKey` and
       `LimitSubject` are `export type`, so they have no runtime witness to appear here.
       That is the property being asserted, not an omission from the list. */
    const barrel: Record<string, unknown> = await import("./index");
    expect(
      Object.keys(barrel).sort(),
      `the limits barrel's value surface changed. Two things this cell holds: nothing here ` +
        `may construct a ResolvedKey — only resolveKey may, and a published mint reopens ` +
        `exactly what T231 closes — and tierOf stays gone, because an exported tierOf hands ` +
        `a caller a Tier detached from the subject it came from.`,
    ).toEqual([
      "BYTES_PER_SLOT",
      "DEFAULT_LIMITS",
      "DEFAULT_SLOTS",
      "InvalidLabelError",
      /* The scope vocabulary, published so a route narrowing `scope` out of a JSON body quotes
         the union rather than retyping its two literals. A value and not a type, so it has a
         runtime witness and belongs in this equality. */
      "KEY_SCOPES",
      "LimitsStoreError",
      "MAX_COUNTER_BYTES",
      "MAX_LABEL_LENGTH",
      "MAX_PARAM_DEPTH",
      "MAX_SUBJECT_CHARS",
      "MAX_UPLOAD_KB",
      "NotKeyOwnerError",
      "RateLimitedError",
      "SECRET_LENGTH",
      "SECRET_PREFIX",
      "TIER_ORDER",
      "armsNotDisjoint",
      "checkLimit",
      "createSlotCounter",
      "enforceLimit",
      "isKeyScope",
      "issueKey",
      "limitFor",
      "listKeys",
      "rateLimitContext",
      "rateLimited",
      "readJsonObject",
      "resolveKey",
      "revokeKey",
      /* D-120-10: the per-ACCOUNT revoke, added when T120's deletion needed to close the
         ghost-keys hole and `revokeKey` binds its WHERE to the CALLER's accountId. It
         constructs no ResolvedKey and hands out no Tier, so both properties this cell
         holds survive it. Amended in the same commit as the export, the equality's own
         sanctioned path. */
      "revokeKeysFor",
      "withLimitsErrors",
      /* Q3's key-to-actor path, and it belongs in THIS cell rather than beside itself. The
         claim the equality holds is that nothing on this barrel can construct authority out
         of a value a caller already has: `writeActorFor` is async and reads the row, which is
         why it is admissible here where a synchronous `asWriteActor(key)` would not be. */
      "writeActorFor",
    ]);
  });
});

describe("the verdict", () => {
  it("counts the request being judged, so remaining falls from the first call", async () => {
    const { counter } = fixedCounter();
    const first = await checkLimit(ANON, "read", { config: CONFIG, counter });
    expect(first).toMatchObject({ allowed: true, limit: 3, remaining: 2 });
  });

  it("allows exactly `limit` requests and refuses the next", async () => {
    const { counter } = fixedCounter();
    const seen: boolean[] = [];
    for (let i = 0; i < 4; i += 1) {
      seen.push((await checkLimit(ANON, "read", { config: CONFIG, counter })).allowed);
    }
    expect(seen).toEqual([true, true, true, false]);
  });

  it("never reports a negative remaining", async () => {
    const { counter } = fixedCounter();
    let last = 0;
    for (let i = 0; i < 10; i += 1) {
      last = (await checkLimit(ANON, "read", { config: CONFIG, counter })).remaining;
    }
    expect(last).toBe(0);
  });

  it("resets when the window rolls", async () => {
    const { counter, advance } = fixedCounter();
    for (let i = 0; i < 4; i += 1) await checkLimit(ANON, "read", { config: CONFIG, counter });
    advance(60_000);
    const after = await checkLimit(ANON, "read", { config: CONFIG, counter });
    expect(after).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("resetAt is the window start plus its length, not a duration from now", async () => {
    const { counter } = fixedCounter(1_000_000);
    const verdict = await checkLimit(ANON, "read", { config: CONFIG, counter });
    expect(verdict.resetAt.getTime()).toBe(1_000_000 + 60_000);
  });
});

describe("AC3: a key raises the ceiling, and it is an ordering rather than a value", () => {
  it("key >= account >= anonymous for the same bucket", async () => {
    const { counter } = fixedCounter();
    const anon = await checkLimit(ANON, "read", { config: CONFIG, counter });
    const account = await checkLimit(ACCOUNT, "read", { config: CONFIG, counter });
    const keyed = await checkLimit(KEYED, "read", { config: CONFIG, counter });
    /* Asserted as an ordering because the numbers are the owner's and still `TBD:`. This
       holds against any ceilings anybody chooses, which is the property the contract can
       carry while the values are open. */
    expect(account.limit).toBeGreaterThanOrEqual(anon.limit);
    expect(keyed.limit).toBeGreaterThanOrEqual(account.limit);
  });

  it("the tiers count separately, so an anonymous flood cannot spend a key's budget", async () => {
    const { counter } = fixedCounter();
    for (let i = 0; i < 20; i += 1) await checkLimit(ANON, "read", { config: CONFIG, counter });
    const keyed = await checkLimit(KEYED, "read", { config: CONFIG, counter });
    expect(keyed.allowed).toBe(true);
  });
});

describe("an unconfigured bucket refuses rather than passing", () => {
  it("refuses a bucket nobody configured", async () => {
    const { counter } = fixedCounter();
    /* D-70-18's shape at a `Record` index: a lookup answering `undefined`, read as "no
       limit", is a criterion satisfiable by never limiting anything. This is the assertion
       that makes AC2 false-able. */
    const verdict = await checkLimit(ANON, "unconfigured", { config: CONFIG, counter });
    expect(verdict).toMatchObject({ allowed: false, limit: 0, remaining: 0 });
  });

  it("refuses a bucket named by a prototype property rather than by the config", async () => {
    const { counter } = fixedCounter();
    /* `Object.prototype.constructor` is reachable by a bare index read on a `Record`, and it
       would answer a FUNCTION where the type says `BucketLimit`. T060's never-inherit ruling
       at a config lookup. */
    for (const bucket of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      const verdict = await checkLimit(ANON, bucket, { config: CONFIG, counter });
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
    const before = Date.now();
    const verdict = await checkLimit(ANON, "unconfigured", { config: CONFIG, counter });
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
    const before = Date.now();
    const verdict = await checkLimit(ANON, "unconfigured", { config: CONFIG, counter });
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
       control: over an empty table every `toBeGreaterThan` below would pass. Twelve is four
       buckets by three tiers, the `live` bucket included. */
    const { counter } = fixedCounter();
    const verdict = await checkLimit(ANON, "unconfigured", { config: CONFIG, counter });
    const configuredWindows = Object.values(DEFAULT_LIMITS).flatMap((tiers) =>
      Object.values(tiers).map((cell) => cell.windowMs),
    );
    expect(configuredWindows).toHaveLength(15);
    for (const windowMs of configuredWindows) {
      expect(verdict.windowMs).toBeGreaterThan(windowMs);
    }
  });

  it("an unconfigured bucket consumes no slot", async () => {
    /* It must not be possible to fill the fixed array by naming buckets nobody configured —
       which would be D-40-B's clause arriving through the refusal path. */
    const { counter } = fixedCounter();
    for (let i = 0; i < 50; i += 1) {
      await checkLimit(ANON, `nope-${i}`, { config: CONFIG, counter });
    }
    const verdict = await checkLimit(ANON, "read", { config: CONFIG, counter });
    expect(verdict.remaining).toBe(2);
  });
});

describe("enforceLimit refuses rather than reporting", () => {
  it("returns the verdict while under the ceiling", async () => {
    const { counter } = fixedCounter();
    await expect(enforceLimit(ANON, "read", { config: CONFIG, counter })).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("throws RateLimitedError past it, naming the bucket, the number, the window and the instant", async () => {
    const { counter } = fixedCounter(1_000_000);
    for (let i = 0; i < 3; i += 1) await enforceLimit(ANON, "read", { config: CONFIG, counter });
    /* The expected message is a LITERAL here rather than built from the module. A test that
       imports its expectation from the subject asserts that the subject agrees with itself,
       and passes unchanged the day the wording starts interpolating something it should not. */
    await expect(enforceLimit(ANON, "read", { config: CONFIG, counter })).rejects.toThrow(
      new RateLimitedError(
        "read: limit of 3 per minute reached; resets at 1970-01-01T00:17:40.000Z.",
      ),
    );
  });

  it("refuses an unconfigured bucket rather than passing it", async () => {
    const { counter } = fixedCounter();
    await expect(
      enforceLimit(ANON, "unconfigured", { config: CONFIG, counter }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe("the ruled ceilings, as shipped", () => {
  const HOUR = 60 * 60 * 1000;

  it("is the owner's matrix, cell for cell", () => {
    /* Written out as LITERALS rather than derived from the table under test, which would
       assert the table agrees with itself. Twelve cells: the owner's nine, plus the three of
       the `live` bucket the live tutorial channel writes to, which is the one bucket an
       anonymous caller may write to because that page exists to be used before the reader
       has an account. The count is the number that has to be visible, and a fifth bucket or
       a fourth tier reds here. */
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
    expect(cell("live", "anonymous")).toEqual({ limit: 60, windowMs: HOUR });
    expect(cell("live", "account")).toEqual({ limit: 120, windowMs: HOUR });
    expect(cell("live", "key")).toEqual({ limit: 120, windowMs: HOUR });
    expect(cell("poll", "anonymous")).toEqual({ limit: 3_600, windowMs: HOUR });
    expect(cell("poll", "account")).toEqual({ limit: 3_600, windowMs: HOUR });
    expect(cell("poll", "key")).toEqual({ limit: 3_600, windowMs: HOUR });
    expect(Object.keys(DEFAULT_LIMITS).sort()).toEqual(["live", "poll", "read", "upload", "write"]);
  });

  it("a refused cell actually refuses, rather than being a zero nobody reads", async () => {
    /* `limit: 0` is only a refusal if the arithmetic makes it one. `allowed: count <= limit`
       with the request already counted is what does it, and this is the measurement of that
       rather than the claim — a cell written as `REFUSED` that admitted one request would
       satisfy the matrix equality above perfectly, because that one asserts the VALUE and
       this one asserts what the value does. */
    const { counter } = fixedCounter();
    const anon: LimitSubject = { tier: "anonymous", ip: "203.0.113.7" };
    for (const bucket of ["write", "upload"]) {
      const verdict = await checkLimit(anon, bucket, { counter });
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
    const ip = "203.0.113.7";
    const anon = await checkLimit({ tier: "anonymous", ip }, "read", { counter });
    const acct = await checkLimit({ tier: "account", accountId: "a", ip }, "read", { counter });
    const keyed = await checkLimit({ tier: "key", key: RESOLVED, ip }, "read", { counter });
    expect(acct.limit).toBe(anon.limit);
    expect(keyed.limit).toBe(anon.limit * 10);

    const acctW = await checkLimit({ tier: "account", accountId: "a", ip }, "write", { counter });
    const keyedW = await checkLimit({ tier: "key", key: RESOLVED, ip }, "write", { counter });
    expect(keyedW.limit).toBe(acctW.limit);
  });

  it("a bucket outside the table still refuses, so filling it changed nothing there", async () => {
    /* D-230-04 survives the emptiness ending. That property was what made an empty table safe
       and it is easy to lose in the edit that populates one. */
    const { counter } = fixedCounter();
    const anon: LimitSubject = { tier: "anonymous", ip: "203.0.113.7" };
    expect((await checkLimit(anon, "search", { counter })).allowed).toBe(false);
  });
});

/* ============================================================
   `isKeyScope`, the narrowing the mint route leans on.

   Added 2026-09-05. Until then `isKeyScope` appeared in this file only inside the barrel's
   name equality, which asserts it is EXPORTED and nothing about what it does. That is the
   shape of coverage that passes against a function returning `true` for everything.

   It matters because of where it is spent. `app/api/account/keys/route.ts` uses it to decide
   a 400, on a value that arrives as `unknown` off a JSON body, and the route makes the same
   type-check-here / vocabulary-check-there split its `label` arm makes. A permissive guard
   would put an unknown string into `issueKey` and leave the store to refuse it later, or not.
   ============================================================ */
describe("isKeyScope", () => {
  it("admits exactly the two scopes, and KEY_SCOPES is the same set", () => {
    expect(KEY_SCOPES.filter((s) => !isKeyScope(s))).toEqual([]);
    expect([...KEY_SCOPES].sort()).toEqual(["read", "write"]);
  });

  it("refuses everything else a JSON body can carry", () => {
    /* `unknown` is the real parameter type, so the hostile cases are values a body actually
       produces rather than only strings: the route hands this straight off `readJsonObject`.
       `"READ"` is here because the column is a Postgres enum and the comparison is
       case-sensitive at both ends, so an accepted `"READ"` would fail at the insert instead
       of at the request, which is a 500 for what is plainly a client's mistake. */
    for (const value of [
      "READ", "Write", "admin", "", " read", "read ", "readwrite",
      7, 0, true, false, null, undefined, [], {}, ["read"], { scope: "read" },
    ]) {
      expect(isKeyScope(value), JSON.stringify(value) ?? "undefined").toBe(false);
    }
  });
});
