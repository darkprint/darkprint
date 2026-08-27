/* ============================================================
   T140 — D-13, and the message form D-140-02 published

   ── the exact pin IS writable now, and it is written ──
   D-140-02 publishes `SaveStoreError` with the form
   `<operation>: the saves store failed.`, so the strongest
   assertion this run asks for is available: `message` equals a
   LITERAL built here and never imported from the module. An
   expectation built from the module under test asserts that the
   module agrees with itself and passes unchanged the day the
   template starts interpolating a driver value.

   ── and the pin does not retire the scans ──
   Asked rather than assumed, because a stronger instrument can make
   a weaker one unreachable and nothing reds when it does. What
   passes an exact `message` pin: a rejection that is not a
   `SaveStoreError` at all; a leak through `String(err)`,
   `JSON.stringify(err)` or an own enumerable key; and any path that
   does not produce that string. So the pin, the deny scan, the
   caller-VALUE check and the four sealing clauses are all here and
   they fail differently.

   ── D-140-06: the caller's own VALUE is forbidden, and that is
      newly assertable ──
   Ruled toward T050's convention — the operation and the caller's
   own FIELD NAME, never the value — because a `refId` echoed back
   to a non-owner is an existence oracle, which is the thing AC1
   exists to close. T070's looser convention would have reopened it
   through the error surface. Until that ruling a value check would
   have redded one of two shipped conventions; now it is owed, and
   it is a PROVENANCE check: the values are minted here and the
   only route into a rendering is the module putting them there.

   ── three fault CLASSES, because a wrapper can catch one and miss
      the others ──
   A module that wraps its query errors and not its connection
   errors passes any sweep that only closes a port; one that wraps
   connect failures and lets a live SQLSTATE through passes any
   sweep that only drives a dead socket. The three below fail in
   three different places in the driver:

     1. the socket never opens          (ECONNREFUSED)
     2. the socket opens and the server refuses the ROLE
     3. the connection is fine and the STATEMENT fails (42P01)

   Only the third binds the caller's values, which is why the
   D-140-06 cells live there and why the ruling calls this task's
   fault path "D-13's clause verbatim rather than a closed-port
   approximation".

   ── and every axis is TWO-FACTOR ──
   T081's blind author deleted thirteen of its own cells because
   they asserted one message against two unreachable servers whose
   driver errors were byte-identical — the equality held between two
   things already equal, whatever the module did, and it reddened
   under zero of seven mutations including the one that leaks the
   driver outright. So each axis here first measures what the RAW
   driver produces and asserts the tell is genuinely in it. A green
   from the sweep then means the module suppressed something that
   was really there; without the control it means nothing at all,
   and the two greens are the same colour.

   Axis 2's control carries the other half of that lesson: its
   planted token is a random ROLE NAME, which the driver puts in its
   own message and which appears in NO statement and NO bound
   parameter. That is the `sqlstate` shape — a value a deny set
   derived from the statement structurally cannot see.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { and, eq } from "drizzle-orm";

import { createDbClient, schema, type Db, type DbClient } from "@/lib/db";

import {
  PUBLISHED_NAMES,
  accountActor,
  assertNoConnectionValue,
  assertNoDriverProse,
  assertSealed,
  bind,
  bindSaveStoreError,
  plantedToken,
  rejection,
  storeFailedMessage,
  type PublishedName,
  type Target,
} from "./contract";
import { closeDatabase, openDatabase, seedAccount, type Scratch } from "./fixtures";

/**
 * A target that is well-formed under the published union, carrying a refId minted HERE.
 *
 * The token is random and alphanumeric, so it cannot arrive in any rendering except by the
 * module putting it there — D-140-06's provenance check, and the reason it cannot over-match
 * the way T-04's SQLSTATE tells matched a fixture's own pid.
 */
const PROBE_TARGET: Target = { kind: "blueprint", refId: `t140probe-${plantedToken()}` };

/**
 * Every published function driven as the OWNER of the account, so policy passes and the call
 * reaches the store. The whole surface, derived from `PUBLISHED_NAMES` rather than listed, with
 * a `default` that reds on a sixth function instead of skipping it.
 */
function callOf(
  name: PublishedName,
  db: unknown,
  accountId: string,
): (fn: (...args: unknown[]) => unknown) => Promise<unknown> {
  const actor = accountActor(accountId, "owner");
  switch (name) {
    case "listSaves":
    case "countSaves":
      return async (fn) => fn(db, actor, accountId);
    case "saveTarget":
    case "unsaveTarget":
      return async (fn) => fn(db, actor, accountId, PROBE_TARGET);
    case "migrateLocalSaves":
      return async (fn) => fn(db, actor, accountId, [PROBE_TARGET]);
    default:
      throw new Error(
        `No store-fault probe exists for the published function \`${name}\`.\n` +
          `  This is a BROKEN TEST, not a failed criterion: the block gained a function that ` +
          `takes \`db: Db\`, so a store fault is reachable through it and this sweep does not ` +
          `drive it. Add its argument shape — do not narrow the sweep.`,
      );
  }
}

/**
 * Every clause a store fault owes, in one place, so each axis asserts the same thing.
 *
 * The `instanceof` is against the class bound from T140's OWN barrel by the name D-140-02
 * publishes — a fault that arrives as a bare `Error` carrying the right words satisfies a
 * message pin perfectly and fails here, which is the difference between the two.
 *
 * The MESSAGE form is deliberately not asserted here. `<operation>` being the published
 * function's own name is a reading, and it lives in cells of its own below so a red on the
 * wording is diagnosable as a naming question rather than one that takes these four clauses
 * down with it.
 */
async function assertStoreFault(err: unknown, where: string): Promise<void> {
  const SaveStoreError = await bindSaveStoreError();
  assertSealed(err, where);
  assertNoDriverProse(err, where);
  expect(
    err,
    `${where} rejected with something that is not a \`SaveStoreError\`. D-140-02 publishes the ` +
      `class for D-13, and \`tests/store-modules-seal-their-faults.test.ts\` requires it to ` +
      `exist at all — an absent class leaks by not existing. Received: ` +
      `${(err as Error)?.constructor?.name ?? typeof err}.`,
  ).toBeInstanceOf(SaveStoreError);
}

/**
 * A scratch database whose `save` table has been dropped, so every published function raises a
 * LIVE statement fault carrying a real statement and real bound parameters.
 *
 * Module scope rather than inside one `describe`, because two blocks need it and a second
 * instance would drop a second table in a second database for no reason. Memoised as the
 * promise, rejection included, and never in a `beforeAll` — a hook that throws runs no test and
 * moves the SKIPPED count instead of the failed one.
 */
let droppedWorld: Promise<{ s: Scratch; accountId: string }> | undefined;

function dropped(): Promise<{ s: Scratch; accountId: string }> {
  if (droppedWorld === undefined) {
    droppedWorld = (async () => {
      const s = await openDatabase();
      const account = await seedAccount(s, "faulty");
      /* The account is seeded FIRST: after this the table T140 writes is gone. */
      await s.query("drop table if exists save cascade");
      return { s, accountId: account.id };
    })();
    droppedWorld.catch(() => {});
  }
  return droppedWorld;
}

const closedPortClients: DbClient[] = [];

function clientAt(url: string): DbClient {
  const client = createDbClient(url);
  closedPortClients.push(client);
  return client;
}

afterAll(async () => {
  for (const client of closedPortClients.splice(0)) {
    try {
      await client.close();
    } catch {
      /* Teardown is not under test. */
    }
  }
  await closeDatabase();
});

/* ============================================================
   Axis 1 — the socket never opens
   ============================================================ */

describe("D-13: a connection that cannot be made is refused without the driver's prose", () => {
  const url = `postgresql://t140probe:${plantedToken()}@127.0.0.1:1/darkprint_t140_${plantedToken()}`;

  it("the control: the raw driver error genuinely carries a tell", async () => {
    /*
     * Without this the whole axis is an equality between two things already equal. Note what it
     * does NOT claim: the connection string's password and database name are NOT asserted to be
     * in the raw error, because they are not — pg reports `connect ECONNREFUSED 127.0.0.1:1` and
     * nothing else. Asserting their absence downstream would have been a guard that cannot
     * fail, which is why this axis leans on the deny set and axis 2 carries the provenance
     * token.
     */
    const client = clientAt(url);
    let raw: unknown;
    try {
      await client.query("select 1");
      throw new Error(
        "A query against 127.0.0.1:1 SUCCEEDED. Something is listening on port 1, so this axis " +
          "is not measuring a refused connection and its greens below mean nothing.",
      );
    } catch (err) {
      raw = err;
    }
    expect(
      String((raw as Error)?.message ?? raw),
      "the driver must actually produce something D-13 forbids, or the sweep below is green " +
        "against a fault that carries nothing to leak",
    ).toContain("ECONNREFUSED");
  });

  it.each(PUBLISHED_NAMES)("%s refuses, sealed and silent about the driver", async (name) => {
    const fn = await bind(name as PublishedName);
    const client = clientAt(url);
    const accountId = randomUUID();
    const where = `${name} against a closed port`;

    const err = await rejection(
      callOf(name as PublishedName, client.db, accountId)(fn),
      where,
    );

    await assertStoreFault(err, where);
  });
});

/* ============================================================
   Axis 2 — the server refuses the ROLE, and the role name is the
   provenance token
   ============================================================ */

describe("D-13: an authentication failure is refused without the value only the driver knows", () => {
  const role = `t140${plantedToken()}`;
  let url: string | undefined;

  function authUrl(): string {
    if (url === undefined) {
      const base = new URL(process.env.DATABASE_URL ?? "");
      base.username = role;
      base.password = plantedToken();
      url = base.toString();
    }
    return url;
  }

  it("the control: the raw driver error genuinely carries the planted role name", async () => {
    const client = clientAt(authUrl());
    let raw: unknown;
    try {
      await client.query("select 1");
      throw new Error(
        `A query authenticated as the role \`${role}\`, which nothing created. This axis is not ` +
          `measuring an authentication failure and its greens below mean nothing.`,
      );
    } catch (err) {
      raw = err;
    }
    const message = String((raw as Error)?.message ?? raw);
    expect(
      message,
      "The role name is minted by this suite and appears in no statement and no bound parameter, " +
        "so it is a value a deny set DERIVED FROM THE STATEMENT cannot see — which is exactly " +
        "the shape that kept T081's AC3 scan green on a document carrying a SQLSTATE. If the " +
        "server does not name the role, this axis has no provenance token and the sweep below " +
        "is reporting the deny set's result twice.",
    ).toContain(role);
  });

  it.each(PUBLISHED_NAMES)("%s refuses, sealed and silent about the role", async (name) => {
    const fn = await bind(name as PublishedName);
    const client = clientAt(authUrl());
    const accountId = randomUUID();
    const where = `${name} against a server that refuses the role`;

    const err = await rejection(callOf(name as PublishedName, client.db, accountId)(fn), where);

    await assertStoreFault(err, where);
    assertNoConnectionValue(err, [role], where);
  });
});

/* ============================================================
   Axis 3 — the connection is fine and the STATEMENT fails

   The only axis that reaches a live driver error carrying a real
   statement and real bound parameters, which is D-13's clause
   verbatim. It is also the only one where the module's own table
   name and column list are in the error, so a wrapper that
   re-renders `cause.message` anywhere leaks the query itself.
   ============================================================ */

describe("D-13: a statement that fails is refused without the statement", () => {
  it("the control: the raw driver error genuinely carries the statement and the SQLSTATE", async () => {
    const { s } = await dropped();
    let raw: unknown;
    try {
      await s.query('select count(*) from "save"');
      throw new Error(
        "`save` still exists after `drop table`, so this axis is not measuring a failed " +
          "statement and its greens below mean nothing.",
      );
    } catch (err) {
      raw = err;
    }
    const message = String((raw as Error)?.message ?? raw);
    expect(message, "the driver names the missing relation").toContain('relation "save"');
    expect(
      (raw as { code?: unknown })?.code,
      "42P01, which is a value in neither the statement nor its bound parameters",
    ).toBe("42P01");
  });

  it("the control: the driver's own rendering carries the caller's BOUND VALUES", async () => {
    /*
     * D-140-06's cells assert that no caller value reaches a rendering. Without this they are an
     * assertion that something absent is absent — the thirteen-cell shape T081 deleted. So the
     * same query the module runs is driven THROUGH DRIZZLE here, binding both values, and its
     * error is required to carry them. Through `pg` directly it would not: `pg` reports
     * `relation "save" does not exist` and drops the parameters, and it is drizzle's own
     * `params:` rendering that makes D-13's bound-parameter clause reachable at all.
     */
    const { s, accountId } = await dropped();
    let raw: unknown;
    try {
      await (s.db as Db)
        .select()
        .from(schema.save)
        .where(
          and(
            eq(schema.save.accountId, accountId),
            eq(schema.save.targetId, PROBE_TARGET.refId),
          ),
        );
      throw new Error("The query against a dropped `save` table SUCCEEDED.");
    } catch (err) {
      raw = err;
    }
    const rendered = `${String((raw as Error)?.message ?? raw)}\n${JSON.stringify(raw)}`;
    expect(
      rendered,
      "if the driver does not render the bound parameters, the caller-VALUE cells below are " +
        "asserting the absence of something that was never there, and their greens mean nothing",
    ).toContain(accountId);
    expect(rendered).toContain(PROBE_TARGET.refId);
  });

  it.each(PUBLISHED_NAMES)("%s refuses, sealed and silent about the query", async (name) => {
    const { s, accountId } = await dropped();
    const fn = await bind(name as PublishedName);
    const where = `${name} against a database whose \`save\` table is gone`;

    const err = await rejection(callOf(name as PublishedName, s.db, accountId)(fn), where);

    await assertStoreFault(err, where);
    /*
     * D-140-06, and axis 3 is the ONLY place it is reachable: this is the one fault whose
     * statement binds the caller's own values, so it is the one where a wrapper that re-renders
     * `cause.message` puts them in front of a caller. The control above proves the driver
     * really carried both.
     */
    assertNoConnectionValue(err, [accountId, PROBE_TARGET.refId], where);
  });

  it("two different callers of one function get the same message, byte for byte", async () => {
    /*
     * D-13's clause verbatim — "no rejection may carry the failed statement or its BOUND
     * PARAMETERS" — asserted as an invariance rather than as a search, because a message that
     * varies with the caller's arguments is carrying them however carefully it is worded, and a
     * deny list cannot enumerate every value a caller might send.
     *
     * T081's precedent: one reader with two different argument lists gives a byte-identical
     * message. Kept ALONGSIDE the deny set rather than instead of it — the two catch different
     * failures and neither is complete.
     */
    const { s, accountId } = await dropped();
    const saveTarget = await bind("saveTarget");
    const where = "saveTarget with two different targets";

    const a = await rejection(
      saveTarget(s.db, accountActor(accountId, "owner"), accountId, {
        kind: "blueprint",
        refId: randomUUID(),
      }),
      where,
    );
    const b = await rejection(
      saveTarget(s.db, accountActor(accountId, "owner"), accountId, {
        kind: "card",
        refId: plantedToken(),
      }),
      where,
    );

    expect(
      (a as Error)?.message,
      "a store fault names the operation and nothing else, so two calls that differ only in what " +
        "the caller sent must render identically. A message that moves with the argument is " +
        "carrying the argument.",
    ).toBe((b as Error)?.message);
  });
});

/* ============================================================
   The message form, on its own

   Kept apart from the four sealing clauses deliberately. `message`
   equalling `<operation>: the saves store failed.` rests on ONE
   reading — that `<operation>` is the published function's own name
   — and that reading is not in the block. It is the convention
   `archive` (`${operation}: the write failed.`), `accounts`
   (`${operation}: the account store failed.`) and `registry`
   (D-81-01, ruled) have all shipped, so it is the strongly
   signalled reading rather than a guess; but it is still a reading,
   and a red here should send somebody to the naming question
   instead of to the wrapper.

   The literal is written out. A test that builds its expectation
   from the module under test — importing the template, reusing a
   format helper, reconstructing it from an exported constant —
   asserts that the module agrees with itself, and passes unchanged
   the day the template starts interpolating a driver value. A later
   change that derives this from the module is a REMOVED ASSERTION.
   ============================================================ */

describe("D-140-02: the store fault's message is exactly the published form", () => {
  it.each(PUBLISHED_NAMES)("%s", async (name) => {
    const { s, accountId } = await dropped();
    const fn = await bind(name as PublishedName);
    const where = `${name} against a database whose \`save\` table is gone`;

    const err = await rejection(callOf(name as PublishedName, s.db, accountId)(fn), where);

    expect(
      (err as Error).message,
      `D-140-02 publishes \`SaveStoreError "<operation>: the saves store failed."\`, and ` +
        `\`<operation>\` is READ here as the published function's own name. A message equal to ` +
        `a known string cannot contain a statement, a bound parameter or a SQLSTATE, which is ` +
        `what makes D-13 hold BY CONSTRUCTION on this path rather than by a substring scan.`,
    ).toBe(storeFailedMessage(name));
  });

  it("the thirteen renderings of one fault are all the same fault", async () => {
    /*
     * The invariance the pin cannot give. `message` is pinned; `String(err)` and
     * `JSON.stringify(err)` are separate channels, and T081's F1 is the standing reminder that
     * the strongest instrument in a task can be a whitelist over one of them while a leak walks
     * out through another.
     */
    const { s, accountId } = await dropped();
    const fn = await bind("saveTarget");
    const where = "saveTarget against a dropped table";
    const err = (await rejection(callOf("saveTarget", s.db, accountId)(fn), where)) as Error;

    expect(
      String(err).endsWith(storeFailedMessage("saveTarget")),
      "`String(err)` is `${name}: ${message}`, so it must END at the pinned message — anything " +
        "appended is a second channel carrying what `message` was pinned to exclude.\n" +
        `  String(err): ${String(err).slice(0, 300)}\n` +
        "  Note what this deliberately does NOT pin: `err.name`. No published clause requires " +
        "it to be `\"SaveStoreError\"`, and the shipped convention sets it on the PROTOTYPE " +
        "because an own `name` would break `Object.keys(err) === []`. Pinning the prefix would " +
        "be a suite filling the contract's silence.",
    ).toBe(true);
    expect(JSON.stringify(err), "B-21: the enumerable surface is empty").toBe("{}");
  });
});
