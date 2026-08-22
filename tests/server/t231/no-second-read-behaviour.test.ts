/* ============================================================
   T231 AC3, the ABSENCE OF AN EFFECT

   `no-second-read.test.ts` pins the absence of a HANDLE — no
   `db` parameter, no `@/lib/db` import, no client factory, no
   `schema` — and its header defers this file explicitly: *"A
   behavioural cell is owed after the merge by whoever holds a
   tree with the gate slot."* This is that cell, built by T231's
   adversary on the merged tree and adopted here because it lands
   in this partition beside the handle cells it completes.

   ── why BOTH, measured rather than argued ──
   The adversary ran E4 — a `check.ts` holding its own `new Pool()`
   from `pg`, reaching a real database while naming neither
   `@/lib/db`, nor `getSharedDbClient`/`createDbClient`, nor
   `schema` — against the two instruments at once:

       the handle cells      8 passed / 0 failed   BLIND
       this cell             6 of 6 FAIL           CAUGHT

   **This catches exactly the case the handle cells provably
   cannot**, which is why the handle file's disclosed limitation is
   retired here rather than merely disclosed. Neither instrument
   subsumes the other: a handle can be absent while an effect
   happens, and — on a tree where the module is unbuilt — an effect
   can be absent for reasons that say nothing about the handle.

   ── THE TRAP, which cost the adversary a green it would have
      shipped ──
   Its first version wrapped the pool returned by `createDbClient`
   and reported **zero on all six paths**. The falsifier caught it:
   a `checkLimit` deliberately mutated to call
   `getSharedDbClient().db.select().from(schema.apiKey)` **still
   reported zero on all six**, while the driver threw
   `DrizzleQueryError` — the query demonstrably reaching Postgres.

   `getSharedDbClient()` is a DIFFERENT pool, cached on
   `globalThis` behind `Symbol.for("darkprint.db.sharedClient")`,
   and the wrapper never saw it. And because `checkLimit` accepts
   no pool at all, *"it did not use the pool I handed it"* was very
   nearly a tautology dressed as a measurement — **a zero from an
   instrument that could only ever report zero.**

   So the observer is at **`pg`'s `Client.prototype.query`**, which
   every pool in the process routes through, including one a module
   reaches for privately. `describe("the observer", …)` is what
   establishes that, and **without it every zero here is
   worthless.** It is a cell and not a comment for that reason.

   Two further instrument bugs the adversary found the same way,
   both avoided here by construction rather than by care:
   instrumenting `pool.query` **and** the checked-out client
   double-counts, because `pg` implements `pool.query` by checking
   a client out — so only the client door is counted; and
   re-wrapping an already-wrapped pooled client on reuse NESTS the
   counter — so the patch is installed once, on the prototype, and
   asserted idempotent. Both bugs inflate, so neither could have
   produced a false zero, but both make the numbers unreadable.

   ── what this cell needs, and what it does not ──
   **No scratch database.** `checkLimit` takes no `db`, so the
   question is *does this process issue a query*, never *what does
   it return*. The AC3 cells reach no database at all — that is
   the criterion. Only the CONTROLS connect, read-only, to the
   existing `darkprint`. Nothing is created, dropped or written.
   ============================================================ */

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, getSharedDbClient, type DbClient } from "@/lib/db";

import { SUBJECT_TIERS } from "./contract";

/* ── the observer ──────────────────────────────────────────── */

type QueryFn = (...args: unknown[]) => unknown;
const CLIENT_PROTO = (pg as unknown as { Client: { prototype: { query: QueryFn } } }).Client
  .prototype;

let realQuery: QueryFn | undefined;
let queries = 0;
let seen: string[] = [];

/** Marks the installed wrapper, so a second install is detectable rather than silent. */
const INSTALLED = Symbol.for("darkprint.t231.queryObserver");

beforeAll(() => {
  /* `Client.prototype` is PROCESS-GLOBAL. Installed here and restored in `afterAll`, or
     every later suite in this vitest worker inherits the counter — which is the kind of
     defect that surfaces as somebody else's mystery three files away. */
  const current = CLIENT_PROTO.query as QueryFn & { [INSTALLED]?: true };
  if (current[INSTALLED] === true) {
    throw new Error(
      "the query observer is already installed on `pg.Client.prototype`. Re-wrapping NESTS " +
        "the counter and every number in this file doubles — the adversary measured exactly " +
        "that when a pooled client was re-wrapped on reuse.",
    );
  }
  realQuery = current;
  const wrapper = function (this: unknown, ...args: unknown[]): unknown {
    queries += 1;
    const first = args[0] as { text?: string } | string | undefined;
    seen.push(String(typeof first === "object" ? (first?.text ?? first) : first).slice(0, 60));
    return (realQuery as QueryFn).apply(this, args);
  } as QueryFn & { [INSTALLED]?: true };
  wrapper[INSTALLED] = true;
  CLIENT_PROTO.query = wrapper;
});

afterAll(async () => {
  if (realQuery !== undefined) CLIENT_PROTO.query = realQuery;
  if (owned !== undefined) await owned.close();
});

/** Counts the queries one call issues. A refusal is a fine outcome; a query on the way is not. */
async function count(
  fn: () => Promise<unknown>,
): Promise<{ n: number; sql: string[]; result: unknown }> {
  queries = 0;
  seen = [];
  let result: unknown;
  try {
    result = await fn();
  } catch {
    /* Swallowed deliberately: this measures QUERIES, not outcomes, and several of the paths
       below are expected to refuse. A throw that mattered would show up as a red in
       `behaviour.test.ts`, which is where outcomes are asserted. */
  }
  return { n: queries, sql: [...seen], result };
}

/**
 * The control every zero in this file needs, and the reason it is not optional.
 *
 * **A call that did nothing issues no queries.** On a tree where `checkLimit` still has
 * T230's `(db, subject, bucket, options)` shape, `check(subject, "read")` puts the subject
 * in `db` and the bucket in `subject` — every argument in the wrong slot, an unconfigured
 * refusal, and **six perfect zeros that measure nothing.** Measured, not imagined: this
 * file passed 10 of 10 that way before this guard existed.
 *
 * So each AC3 cell proves its call reached the ceiling it was aiming at. A negative needs a
 * control that can fail, and this is the one that can.
 */
function expectedCeiling(verdict: unknown, limit: number, where: string): void {
  const v = verdict as { allowed?: unknown; limit?: unknown } | undefined;
  expect(
    v?.limit,
    `${where}: the call answered \`limit: ${String(v?.limit)}\` where the configured ceiling ` +
      `is ${limit}, so it did not do the work whose cost this cell is measuring. A zero from ` +
      `a call that did nothing is not evidence about AC3.\n` +
      `  The usual cause is an argument in the wrong slot — a signature that has not been ` +
      `repaired yet, which \`published-shape.test.ts\` reports directly.`,
  ).toBe(limit);
  expect(v?.allowed, `${where}: the probe call was refused, so it measures the wrong branch`).toBe(
    true,
  );
}

let owned: DbClient | undefined;

/* ── the subjects ──────────────────────────────────────────── */

const IP = "203.0.113.7";
/**
 * The keyed arm, through the cast AC1 exists to make impossible at a real call site — the
 * same labelled lie `behaviour.test.ts` tells, for the same reason and with the same limit:
 * it is a subject SHAPE here, never a claim about a row.
 */
const KEY = {
  keyId: "00000000-0000-4000-8000-000000000000",
  accountId: "00000000-0000-4000-8000-000000000001",
  label: "ac3",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  revokedAt: null,
} as unknown;

type Subject = Record<string, unknown>;
const anonymous: Subject = { tier: "anonymous", ip: IP };
const account: Subject = { tier: "account", accountId: "acc-1", ip: IP };
const keyed: Subject = { tier: "key", key: KEY, ip: IP };

type Check = (subject: Subject, bucket: string) => Promise<unknown>;

async function limits(): Promise<Record<string, unknown>> {
  return (await import("@/lib/server/limits")) as unknown as Record<string, unknown>;
}

/* ── the observer's own falsification ──────────────────────── */

describe("the observer, falsified before any zero below is read", () => {
  it("is installed on the prototype, so no instance can route around it", () => {
    /*
     * The structural half, and it needs no I/O. A client constructed AFTER the patch — one
     * this file never hands to anything, standing in for a pool a module makes privately —
     * carries the same wrapped method. That is what "at the driver door" means, and it is
     * the property the adversary's first version lacked.
     */
    const fresh = new pg.Client({ connectionString: "postgres://unused@127.0.0.1:1/none" });
    expect(
      (fresh as unknown as { query: QueryFn }).query,
      "a freshly constructed `pg.Client` does not carry the observer, so a module holding " +
        "its own pool would be invisible — which is the defect that made the first version " +
        "of this cell report zero against a `checkLimit` that was demonstrably querying.",
    ).toBe(CLIENT_PROTO.query);
  });

  it("counts a query issued through a pool this file never handed to anything", async () => {
    /*
     * The live half, and the one that answers the trap directly. `getSharedDbClient()` is
     * the pool cached on `globalThis` that the first version was blind to — nothing here
     * passes it anywhere; the observer sees it because it is at the driver.
     */
    const { n } = await count(() => getSharedDbClient().query("select 1", []));
    expect(
      n,
      "the observer did not see a query on the SHARED pool. That pool is cached on " +
        "`globalThis` behind `Symbol.for(\"darkprint.db.sharedClient\")`, and being blind to " +
        "it is exactly how six zeros were produced by an instrument that could only ever " +
        "report zero.",
    ).toBeGreaterThan(0);
  });

  it("counts a query on a pool this file owns, and counts it ONCE", async () => {
    owned ??= createDbClient(process.env.DATABASE_URL as string);
    const { n, sql } = await count(() => owned!.query("select 1", []));
    expect(n, `a raw \`select 1\` counted ${n} times: ${sql.join(" ; ")}`).toBe(1);
  });
});

/* ── AC3 ───────────────────────────────────────────────────── */

describe("AC3 — no path through `checkLimit` issues a query", () => {
  for (const [name, subject, ceiling] of [
    ["anonymous", anonymous, 600],
    ["account", account, 600],
    ["key", keyed, 6_000],
  ] as const) {
    it(`\`checkLimit\` issues none for a ${name} subject on a configured bucket`, async () => {
      const check = (await limits()).checkLimit as Check;
      const { n, sql, result } = await count(() => check(subject, "read"));
      expectedCeiling(result, ceiling, `checkLimit/${name}`);
      expect(
        n,
        `\`checkLimit\` issued ${n} quer${n === 1 ? "y" : "ies"} for a ${name} subject.\n` +
          `  ${sql.join(" ; ")}\n` +
          `  AC3: no second database read on any path — the repair is a type, not a lookup. ` +
          `D-230-05 as ruled: \`checkLimit\` touches \`db\` on NO path, keyed included; the ` +
          `one indexed read the clause licenses is \`resolveKey\`'s, at the route.`,
      ).toBe(0);
    });
  }

  it("issues none for the bucket nobody configured", async () => {
    /* The refusing branch is a different path through the function and D-230-04 makes it
       load-bearing, so it is measured rather than assumed to share the others' zero. */
    const check = (await limits()).checkLimit as Check;
    const { n, sql, result } = await count(() => check(keyed, "no-such-bucket"));
    /* This is the ONE cell here that cannot fully self-verify, and saying so is cheaper than
       leaving a reader to find it: a call with its arguments in the wrong slots also lands on
       the refusing branch, so `allowed: false, limit: 0` does not by itself prove the call was
       well-formed. It leans on its three siblings, which do prove it, and on
       `published-shape.test.ts`, which reports a mismatched signature directly. */
    const v = result as { allowed?: unknown; limit?: unknown } | undefined;
    expect(v?.allowed, `the unconfigured bucket ADMITTED the request (D-230-04)`).toBe(false);
    expect(v?.limit, `the unconfigured verdict does not carry \`limit: 0\``).toBe(0);
    expect(n, `the unconfigured branch issued ${n}: ${sql.join(" ; ")}`).toBe(0);
  });

  it("covers every published arm of the subject union", () => {
    /* The domain the loop above quantifies over, asserted rather than assumed: an arm added
       to `LimitSubject` and not to this file would be measured by nothing. */
    expect(SUBJECT_TIERS).toEqual(["anonymous", "account", "key"]);
  });
});

describe("AC3 — nor does `enforceLimit`, including well past the ceiling", () => {
  /*
   * Past the ceiling is where a lazy implementation would go looking: the refusing path is
   * the one with a reason to consult something durable, and it is the path a counter that
   * "only reads when it has to" would betray itself on.
   */
  it("issues none across 700 anonymous calls against a 600 ceiling", async () => {
    const enforce = (await limits()).enforceLimit as Check;
    const { n, sql } = await count(async () => {
      for (let i = 0; i < 700; i += 1) {
        await enforce({ tier: "anonymous", ip: "198.51.100.9" }, "read").catch(() => undefined);
      }
    });
    expect(n, `700 calls issued ${n} queries: ${sql.slice(0, 4).join(" ; ")}`).toBe(0);
  });

  it("issues none across 6100 keyed calls against a 6000 ceiling", async () => {
    const enforce = (await limits()).enforceLimit as Check;
    const { n, sql } = await count(async () => {
      for (let i = 0; i < 6_100; i += 1) {
        await enforce(keyed, "read").catch(() => undefined);
      }
    });
    expect(n, `6100 keyed calls issued ${n} queries: ${sql.slice(0, 4).join(" ; ")}`).toBe(0);
  });
});
