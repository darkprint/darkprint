/* ============================================================
   T231 — what the union must still DO, driven at runtime

   Every cell here loads `@/lib/server/limits` dynamically and
   casts through a locally-declared function type. That is
   deliberate and it is a separation of instruments rather than a
   convenience: **`published-shape.test.ts` is the only file in
   this partition that makes a type-level claim**, so the set of
   `tsc` errors this suite produces is exactly the set that file
   is about and can be read as one number. A cell here that reds
   is vitest reporting behaviour, never a compile.

   None of these needs a database. That is not an accident of what
   they test — D-231-01 removes the handle, so a `checkLimit` cell
   that needed one would be testing something the signature no
   longer permits. The counter is injected through
   `CheckLimitOptions` so cells do not share the process-wide
   singleton and cannot order-depend on each other.

   ── expected state before the implementation lands ──
   These cells drive D-231-01's subject union, which does not
   exist yet, so they RED against the shipped module. That is the
   blind position and not a defect. What matters is that each red
   names the criterion it is about, which is why the arms are
   built by a named helper rather than inline.

   ── the keyed arm is unreachable from here, and that is AC1 ──
   A `ResolvedKey` is unforgeable outside `keys.ts`, so no cell in
   this file can build one honestly and the keyed arm is driven
   through a labelled cast. **The cast is what AC1 forbids at a
   real call site**, and it appears here only where the criterion
   under test is a runtime one. Its presence is a measurement in
   itself: a suite that cannot construct the keyed arm without
   lying is a suite watching the brand work.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { SUBJECT_TIERS } from "./contract";

interface Verdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  windowMs: number;
}

type Subject = Record<string, unknown>;
type Check = (subject: Subject, bucket: string, options?: Record<string, unknown>) => Promise<Verdict>;
type TierOf = (subject: Subject) => string;

async function limits(): Promise<Record<string, unknown>> {
  return (await import("@/lib/server/limits")) as unknown as Record<string, unknown>;
}

/** A fresh counter per cell, so no cell inherits another's spend. */
async function counter(): Promise<Record<string, unknown>> {
  const mod = await limits();
  const create = mod.createSlotCounter as (o?: Record<string, unknown>) => Record<string, unknown>;
  return create({ seed: 1 });
}

const anonymous = (ip = "203.0.113.7"): Subject => ({ tier: "anonymous", ip });
const account = (accountId = "acc-1", ip = "203.0.113.7"): Subject => ({
  tier: "account",
  accountId,
  ip,
});

/**
 * The keyed arm, through the cast AC1 exists to make impossible at a real call site.
 *
 * Written out rather than hidden in a fixture so a reader sees the lie being told. Nothing
 * here claims the record is unrevoked — the brand proves PROVENANCE, never non-revocation
 * (F-231-B as amended), so `revokedAt` is present and null only because that is what
 * `resolveKey`'s WHERE guarantees at runtime, not what the type does.
 */
const keyed = (keyId = "key-1", accountId = "acc-1", ip = "203.0.113.7"): Subject => ({
  tier: "key",
  key: {
    keyId,
    accountId,
    label: "test",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    revokedAt: null,
  },
  ip,
});

describe("AC1 — the tier follows the arm, and the arms are the three D-231-01 publishes", () => {
  it("`tierOf` answers each arm's own tier", async () => {
    const mod = await limits();
    const tierOf = mod.tierOf as TierOf;

    const answers = [tierOf(anonymous()), tierOf(account()), tierOf(keyed())];
    expect(
      answers,
      `\`tierOf\` no longer agrees with the subject's arm. Under D-231-01 the arm IS the ` +
        `tier — that is what makes the precondition structural — so a disagreement here ` +
        `means the tier is still being inferred from which field happened to be filled.`,
    ).toEqual([...SUBJECT_TIERS]);
  });

  it("the published arms are exactly three, counted from the contract module", () => {
    /* The domain the loop above quantifies over, asserted rather than assumed: a
       `SUBJECT_TIERS` that lost a member would make the cell above pass over two arms and
       report nothing about the third. */
    expect(SUBJECT_TIERS).toEqual(["anonymous", "account", "key"]);
  });
});

describe("AC3/AC5 — the verdict is still the counter's, and the arms do not share slots", () => {
  it("answers D-230-10's five members and nothing else", async () => {
    const mod = await limits();
    const check = mod.checkLimit as Check;
    const verdict = await check(anonymous(), "read", { counter: await counter() });

    expect(
      Object.keys(verdict).sort(),
      `\`LimitVerdict\`'s key set has moved. D-230-10 added \`windowMs\` as the fifth and ` +
        `the blind author's exact-equality assertion over this set is what caught it.`,
    ).toEqual(["allowed", "limit", "remaining", "resetAt", "windowMs"]);
    expect(verdict.allowed).toBe(true);
    expect(verdict.limit).toBe(600);
    expect(verdict.remaining).toBe(599);
  });

  it("does not let an account and an anonymous caller sharing one string share one slot", async () => {
    /*
     * The shipped comment names this hazard at the old subject: "Reading `ip` for a keyed
     * subject would let one caller's requests count against two slots depending on which
     * field a route happened to fill." The union removes the ambiguity about WHICH field
     * decides; it does not by itself keep the two key spaces apart.
     *
     * Same string, different arms. If the counter keys on the identifier without the tier,
     * the second call sees 598 and this cell reds.
     */
    const mod = await limits();
    const check = mod.checkLimit as Check;
    const shared = await counter();

    const first = await check(anonymous("collide"), "read", { counter: shared });
    const second = await check(account("collide", "collide"), "read", { counter: shared });

    expect(first.remaining).toBe(599);
    expect(
      second.remaining,
      `an account and an anonymous caller carrying the same string spent one budget. The ` +
        `counter's key must carry the TIER as well as the identifier, or a route that fills ` +
        `one field rather than another moves a caller between budgets.`,
    ).toBe(599);
  });

  it("gives the keyed arm the key ceiling, which is the leak the brand closes", async () => {
    /*
     * 6 000 against 600 is F-230-J's end-to-end number, and the reason the type matters:
     * `listKeys` lists revoked rows, they are structurally `ApiKeyRecord`, and today one can
     * be handed straight to `checkLimit` for the raised ceiling. This cell asserts the
     * ceiling is still raised for a genuinely keyed subject — the criterion is that only a
     * `resolveKey` product can reach this arm, not that the arm stops working.
     */
    const mod = await limits();
    const check = mod.checkLimit as Check;
    const verdict = await check(keyed(), "read", { counter: await counter() });

    expect(verdict.limit).toBe(6_000);
    expect(verdict.remaining).toBe(5_999);
  });
});

describe("D-230-04/F-230-M — an unconfigured bucket refuses, for a year", () => {
  it("refuses rather than passing, and never at the epoch", async () => {
    const mod = await limits();
    const check = mod.checkLimit as Check;
    const before = Date.now();
    const verdict = await check(anonymous(), "no-such-bucket", { counter: await counter() });
    const after = Date.now();

    expect(
      verdict.allowed,
      `an unconfigured bucket ADMITTED the request. D-230-04: a config lookup returning ` +
        `\`undefined\` read as "no limit" is a criterion satisfiable by never limiting ` +
        `anything.`,
    ).toBe(false);
    expect(verdict.limit).toBe(0);

    /* The assertion EXCLUDES the bad output. `resetAt` is the entire recovery signal —
       `http.ts` declines a `retry-after` deliberately — and the epoch tells a correct client
       to retry at once, forever. Bracketed between two real clock reads rather than pinned
       to a constant, because the branch reads its own clock. */
    const YEAR = 365 * 24 * 60 * 60 * 1000;
    expect(verdict.resetAt.getTime(), `\`resetAt\` is the Unix epoch (F-230-M)`).not.toBe(0);
    expect(verdict.resetAt.getTime()).toBeGreaterThanOrEqual(before + YEAR);
    expect(verdict.resetAt.getTime()).toBeLessThanOrEqual(after + YEAR);
    expect(verdict.windowMs, `\`windowMs\` is the 0 that rendered as \`per 0ms\``).toBe(YEAR);
  });

  it("spends no slot on the bucket nobody configured", async () => {
    /* "No window to roll and nothing to count": an unconfigured bucket must not be able to
       consume a configured bucket's budget through a shared counter. */
    const mod = await limits();
    const check = mod.checkLimit as Check;
    const shared = await counter();

    await check(anonymous(), "no-such-bucket", { counter: shared });
    const real = await check(anonymous(), "read", { counter: shared });
    expect(real.remaining).toBe(599);
  });
});

describe("F-231-E, settled — `enforceLimit` refuses by THROWING", () => {
  it("throws a `RateLimitedError` rather than answering a value a caller can drop", async () => {
    /*
     * The published line was `Promise<Response | undefined>` and it is WITHDRAWN. A guard
     * that returns a union depends on every caller checking the union, and a caller who
     * forgets runs the handler anyway — which is T000's reason for `withSession` being a
     * wrapper, quoted in `check.ts`'s own header, and it is T230's AC2 that a forgotten
     * check makes false.
     */
    const mod = await limits();
    const enforce = mod.enforceLimit as Check;
    const RateLimited = mod.RateLimitedError as new (m: string) => Error;
    const shared = await counter();

    /* `write` refuses an anonymous caller outright, so one call reaches the throw. */
    await expect(enforce(anonymous(), "write", { counter: shared })).rejects.toBeInstanceOf(
      RateLimited,
    );
  });

  it("carries the context the published 429 is rendered from", async () => {
    const mod = await limits();
    const enforce = mod.enforceLimit as Check;
    const rateLimitContext = mod.rateLimitContext as (e: Error) => { bucket: string } | undefined;

    const err = await enforce(anonymous(), "write", { counter: await counter() }).then(
      () => undefined,
      (e: Error) => e,
    );

    expect(err, `\`enforceLimit\` did not refuse an anonymous \`write\``).toBeInstanceOf(Error);
    expect(
      rateLimitContext(err as Error)?.bucket,
      `the thrown error carries no context, so \`withLimitsErrors\` would re-throw it rather ` +
        `than render D-230-09's 429 — the arm for what the wrapper does not recognise.`,
    ).toBe("write");
  });
});
