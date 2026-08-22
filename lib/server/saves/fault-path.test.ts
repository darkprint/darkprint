/* ============================================================
   DarkPrint backend — T140's fault path and its one decision,
   measured
   D-13, and on this module it is not optional-by-construction the
   way T081's was: every `save` write binds `account_id`,
   `target_kind` and `target_id`, and the reader binds
   `account_id`. So a driver error here really does carry the
   account's identity and the caller's `refId`, and this file is
   the measurement of what stands between them and a caller.

   ── Why a closed port and not a stub ──
   The rejection that arrives is a REAL `DrizzleQueryError`
   produced by the shipped driver, not a fixture somebody wrote to
   look like one. A stub proves the wrapper catches what you hand
   it; a live fault proves it catches what the driver produces. It
   needs no database and no gate slot.

   ── The two-factor control, which comes FIRST ──
   A rejection whose cause carries neither the statement nor the
   bound value satisfies the deny check trivially — so a green
   would be evidence that the probe never reached the driver rather
   than that nothing escaped. Every case below therefore asserts
   the sentinel IS in the cause chain before asserting it is NOT in
   any rendering. **The deny check only measures anything on the
   cases where the control fires**, and an absent instrument reads
   exactly like a clean one.

   ── Why this file exists at all, given `error-hygiene` ──
   `tests/error-hygiene.test.ts` builds its domain from
   `git ls-tree backend lib/server/`, the SHIPPED tree. So
   `lib/server/saves` is invisible to it until the merge commit,
   and `SaveStoreError` is measured by nothing until then. This
   file is what covers the gap in the interval where the class
   exists and the guard cannot see it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDbClient, type Db, type DbClient } from "@/lib/db";
import { NotAccountOwnerError } from "@/lib/server/accounts";
import type { Actor } from "@/lib/server/policy";
import {
  SaveStoreError,
  countSaves,
  listSaves,
  migrateLocalSaves,
  saveTarget,
  unsaveTarget,
  type SaveRecord,
  type SaveTargetKind,
} from "@/lib/server/saves";

/**
 * Port 1 is reserved and nothing listens on it. The credentials are junk on purpose: this
 * URL reaches a committed file, so anything it leaked would still be nobody's secret.
 */
const CLOSED_PORT_URL = "postgres://probe:probe@127.0.0.1:1/darkprint_t140_closed_port";

/**
 * Sentinels distinctive enough that a substring match means something. The account is
 * uuid-shaped because `save.account_id` is a `uuid` column and a malformed one would change
 * which error the driver produces; the ref is not, because `target_id` is `text`.
 */
const ACCOUNT = "00000000-0000-4000-8000-000000140140";
const REF = "t140-leak-sentinel-90210";

const OWNER: Actor = { kind: "account", accountId: ACCOUNT, handle: "t140-owner" };

let client: DbClient;
let db: Db;

beforeAll(() => {
  client = createDbClient(CLOSED_PORT_URL);
  db = client.db;
});

afterAll(async () => {
  await client.close();
});

/** Every message on an error's cause chain, joined. Bounded so a cycle cannot hang it. */
function causeChainText(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = (err as { cause?: unknown }).cause;
  for (let depth = 0; current !== undefined && current !== null && depth < 16; depth += 1) {
    if (current instanceof Error) parts.push(current.message);
    else parts.push(String(current));
    current = (current as { cause?: unknown }).cause;
  }
  return parts.join("\n");
}

async function rejectionOf(work: () => Promise<unknown>): Promise<unknown> {
  try {
    await work();
  } catch (err) {
    return err;
  }
  return undefined;
}

/** Every rendering a route or a log might reach for. */
function renderingsOf(err: Error): readonly string[] {
  return [
    err.message,
    String(err),
    JSON.stringify(err),
    JSON.stringify({ detail: err.message }),
    Object.keys(err).join(","),
  ];
}

/* ============================================================
   The published record shape
   ============================================================ */

type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

/**
 * `SaveRecord` is exactly the block's three members, none optional.
 *
 * **This assertion is unfalsifiable from the blind tree and that is why it lives here.**
 * With the module absent `SaveRecord` resolves to `any`, and `Exact<any, T>` is `true` for
 * every `T` — so the blind suite's copy passes whatever this module later publishes, and
 * `tsc` resolves to the worktree rather than to any reference. It can only be made to fail
 * where the real type exists, which is here.
 *
 * Falsified by making a member optional and by adding a fourth: both produce TS2322 on the
 * line below, and the number in the handback is that mutation, not this green.
 */
const RECORD_SHAPE_IS_EXACT: Exact<
  SaveRecord,
  { targetKind: SaveTargetKind; refId: string; savedAt: Date }
> = true;
void RECORD_SHAPE_IS_EXACT;

/* ============================================================
   D-13 over a live driver fault
   ============================================================ */

describe("every published function seals a real driver fault", () => {
  /**
   * The five, each with the sentinels it binds. A reader binds the account only; a writer
   * binds the account, the kind and the ref — which is why the writers are the cases where
   * D-13's bound-parameter clause actually has something to catch.
   */
  const CASES: readonly { operation: string; binds: readonly string[]; run: () => Promise<unknown> }[] = [
    { operation: "listSaves", binds: [ACCOUNT], run: () => listSaves(db, OWNER, ACCOUNT) },
    { operation: "countSaves", binds: [ACCOUNT], run: () => countSaves(db, OWNER, ACCOUNT) },
    {
      operation: "saveTarget",
      binds: [ACCOUNT, REF],
      run: () => saveTarget(db, OWNER, ACCOUNT, { kind: "blueprint", refId: REF }),
    },
    {
      operation: "unsaveTarget",
      binds: [ACCOUNT, REF],
      run: () => unsaveTarget(db, OWNER, ACCOUNT, { kind: "card", refId: REF }),
    },
    {
      operation: "migrateLocalSaves",
      binds: [ACCOUNT, REF],
      run: () => migrateLocalSaves(db, OWNER, ACCOUNT, [{ kind: "term", refId: REF }]),
    },
  ];

  it("rejects with SaveStoreError naming the operation and nothing else", async () => {
    for (const { operation, run } of CASES) {
      const err = await rejectionOf(run);
      expect(err, `${operation} resolved against a closed port`).toBeInstanceOf(SaveStoreError);
      /* The exact form, written out rather than imported. A test that builds its expectation
         from the module under test asserts the module agrees with itself, and goes on
         passing the day the wording starts interpolating something it should not. */
      expect((err as Error).message).toBe(`${operation}: the saves store failed.`);
    }
  });

  it("carries no bound parameter into any rendering, on cases where the driver really carried one", async () => {
    const measured: string[] = [];
    const unreached: string[] = [];

    for (const { operation, binds, run } of CASES) {
      const err = await rejectionOf(run);
      expect(err).toBeInstanceOf(SaveStoreError);
      const chain = causeChainText(err);

      /* TWO-FACTOR, and it decides whether the deny check below means anything. The value
         has to be IN the driver's own error for its absence from the rendering to be a
         property of this module rather than of the driver never having seen it. */
      const carried = binds.filter((value) => chain.includes(value));
      if (carried.length !== binds.length) {
        unreached.push(
          `${operation}: the cause chain carries ${carried.length} of ${binds.length} bound values, ` +
            `so this case measured nothing about what a driver error can leak`,
        );
        continue;
      }
      measured.push(operation);

      for (const rendering of renderingsOf(err as Error)) {
        for (const value of binds) {
          expect(
            rendering.includes(value),
            `${operation} leaked a bound parameter into a rendering: ${JSON.stringify(rendering.slice(0, 160))}`,
          ).toBe(false);
        }
      }
    }

    expect(unreached, "cases whose driver error carried no bound value").toEqual([]);
    expect(measured.length, "cases where the deny check actually measured something").toBe(CASES.length);
  });

  it("renders as {} at both arities and keeps its stack", () => {
    /* D-13's hygiene clause, applied here because `error-hygiene`'s domain is the shipped
       tree and this module is not on it until the merge commit. Both arities, because
       `cause` is installed on HasProperty rather than on the value — a constructor that
       passed the option conditionally would satisfy the clause under one shape only. */
    for (const args of [["probe detail"], ["probe detail", { code: "23505" }]] as const) {
      const instance = new SaveStoreError(...(args as [string, unknown]));
      expect(Object.keys(instance)).toEqual([]);
      expect(JSON.stringify(instance)).toBe("{}");
      expect(Object.prototype.propertyIsEnumerable.call(instance, "cause")).toBe(false);
      expect(Object.getOwnPropertyDescriptor(instance, "cause")).not.toBeUndefined();
      expect(typeof instance.stack).toBe("string");
      expect(instance.name).toBe("SaveStoreError");
    }
  });
});

/* ============================================================
   The one decision, and that it is not sealed on the way out
   ============================================================ */

describe("an ownership denial is a decision and reaches the caller unwrapped", () => {
  const STRANGER: Actor = {
    kind: "account",
    accountId: "11111111-1111-4111-8111-111111111111",
    handle: "somebody-else",
  };

  const WRITERS: readonly { operation: string; run: (actor: Actor) => Promise<unknown> }[] = [
    {
      operation: "saveTarget",
      run: (actor) => saveTarget(db, actor, ACCOUNT, { kind: "blueprint", refId: REF }),
    },
    {
      operation: "unsaveTarget",
      run: (actor) => unsaveTarget(db, actor, ACCOUNT, { kind: "blueprint", refId: REF }),
    },
    {
      operation: "migrateLocalSaves",
      run: (actor) => migrateLocalSaves(db, actor, ACCOUNT, [{ kind: "blueprint", refId: REF }]),
    },
  ];

  it("throws the class @/lib/server/accounts publishes, not one minted here", async () => {
    for (const { operation, run } of WRITERS) {
      const err = await rejectionOf(() => run(STRANGER));
      /* `instanceof` against the IMPORTED class. A locally minted class of the same name
         passes every check that compares names and fails exactly this one. */
      expect(err, `${operation} did not refuse a stranger`).toBeInstanceOf(NotAccountOwnerError);
      expect(err).not.toBeInstanceOf(SaveStoreError);
      expect((err as Error).message).toBe(`${operation}: not this account's owner.`);
    }
  });

  it("names no value the caller supplied", async () => {
    for (const { run } of WRITERS) {
      const err = await rejectionOf(() => run(STRANGER));
      for (const rendering of renderingsOf(err as Error)) {
        /* D-140-06: the operation and a field name, never a value. A `refId` echoed back to
           a non-owner is an existence oracle, which is the thing AC1 exists to close. */
        expect(rendering.includes(REF)).toBe(false);
        expect(rendering.includes(ACCOUNT)).toBe(false);
        expect(rendering.includes(STRANGER.kind === "account" ? STRANGER.accountId : "")).toBe(false);
      }
    }
  });

  it("refuses before a statement is built, so a denial never reaches the driver", async () => {
    /* The discriminator a message cannot give. Both a refusal and a store fault are
       rejections; only "the resource was never touched" separates a guard that ran from one
       that was skipped and happened to fail downstream anyway. */
    for (const { operation, run } of WRITERS) {
      let touched = false;
      const spy = new Proxy(
        {},
        {
          get(_target, key) {
            if (key !== "then") touched = true;
            return undefined;
          },
        },
      ) as Db;
      const err = await rejectionOf(() =>
        operation === "migrateLocalSaves"
          ? migrateLocalSaves(spy, STRANGER, ACCOUNT, [{ kind: "blueprint", refId: REF }])
          : operation === "saveTarget"
            ? saveTarget(spy, STRANGER, ACCOUNT, { kind: "blueprint", refId: REF })
            : unsaveTarget(spy, STRANGER, ACCOUNT, { kind: "blueprint", refId: REF }),
      );
      expect(err).toBeInstanceOf(NotAccountOwnerError);
      expect(touched, `${operation} reached the database for a caller it had already refused`).toBe(
        false,
      );
      void run;
    }
  });
});

/* ============================================================
   AC1's readers answer a value, and the same value three ways
   ============================================================ */

describe("a caller who may not see the set gets the answer an empty owner gets", () => {
  const STRANGER: Actor = {
    kind: "account",
    accountId: "22222222-2222-4222-8222-222222222222",
    handle: "visitor",
  };
  const ANONYMOUS: Actor = { kind: "anonymous" };

  /**
   * Identity that is REAL BUT NOT ITS OWN — the one shape that separates delegating to
   * `can` from re-implementing ownership as `actor.accountId === accountId`. Every field is
   * inherited, so `Object.hasOwn` reads them as absent and T060 denies; a bare comparison
   * reads the prototype's value and grants.
   */
  const INHERITED = Object.create({
    kind: "account",
    accountId: ACCOUNT,
    handle: "borrowed",
  }) as Actor;

  const DENIED: readonly { label: string; actor: Actor }[] = [
    { label: "a signed-in stranger", actor: STRANGER },
    { label: "an anonymous caller", actor: ANONYMOUS },
    { label: "an actor inheriting the owner's id", actor: INHERITED },
  ];

  it("answers a frozen empty list and a zero, without reaching the database", async () => {
    for (const { label, actor } of DENIED) {
      let touched = false;
      const spy = new Proxy(
        {},
        {
          get(_target, key) {
            if (key !== "then") touched = true;
            return undefined;
          },
        },
      ) as Db;

      /* The calls are allowed to REJECT rather than answer, and `touched` is asserted
         either way. A denied caller that wrongly proceeds reaches the spy, whose every
         property is `undefined`, so the module throws before an assertion on the return
         value could run — and the red a reader would meet is then a stack trace into
         `store.ts` rather than the sentence naming which actor shape got through. The
         instrument has to be the assertion that fires, not one the failure jumps over. */
      const list = await listSaves(spy, actor, ACCOUNT).catch(() => "REJECTED" as const);
      const count = await countSaves(spy, actor, ACCOUNT).catch(() => "REJECTED" as const);

      expect(touched, `${label} reached the database for a set it may not see`).toBe(false);
      expect(list, `${label} was given a listing`).toEqual([]);
      expect(count, `${label} was given a count`).toBe(0);
      /* D-140-01: `0` rather than `undefined`, and the criterion is that this is the SAME
         answer an owner with no saves gets — so `not yours`, `no such account` and `yours
         and empty` stay indistinguishable, which is B-03 satisfied rather than violated.
         What AC1 forbids is the TRUE count, and it is refused by never running the query. */
      expect(touched, `${label} reached the database for a set it may not see`).toBe(false);
    }
  });

  it("hands back a list a caller cannot mutate into somebody else's", async () => {
    const list = await listSaves(db, ANONYMOUS, ACCOUNT);
    expect(Object.isFrozen(list)).toBe(true);
  });

  it("an operator is not a denied caller", async () => {
    /* B-13's break-glass subject, and the half of AC1 that says "every caller but its owner
       AND THE OPERATOR". A denial that also refused an operator would satisfy every cell
       above and make the criterion's second clause dead. Measured against the closed port:
       the operator gets far enough to fail at the driver, which the three above never do. */
    const OPERATOR: Actor = { kind: "operator", accountId: "33333333-3333-4333-8333-333333333333" };
    const err = await rejectionOf(() => listSaves(db, OPERATOR, ACCOUNT));
    expect(err, "an operator was refused before the query instead of being allowed to run it")
      .toBeInstanceOf(SaveStoreError);
  });
});
