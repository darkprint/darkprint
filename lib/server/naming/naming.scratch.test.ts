/**
 * Scratch coverage against a real database, run by the implementer only — does not
 * count as verification (docs/ORCHESTRATION.md, Agent A). One case per acceptance
 * criterion in backend.md's T070 section, plus the two things the criteria rest on
 * and do not state: that the derived primary-key constraint name matches a real
 * 23505, and that nothing this module raises leaks anything.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { RESERVED_PROFILE_SEGMENTS } from "@/components/profile/tabs";
import { createDbClient, schema, type DbClient } from "@/lib/db";
import { createTestDb, resetTestDb, type TestDb } from "../../../tests/support/db";
import type { Availability } from "./index";

import { pgErrorCode, pgErrorConstraint } from "./pg-error";
import {
  allocateHandle,
  checkHandle,
  checkSlug,
  HandleTakenError,
  InvalidNameError,
  MAX_NAME_LENGTH,
  NamingStoreError,
  releaseHandle,
  validateCardId,
  validateNamespace,
} from "./index";

/**
 * A well-formed uuid no `account` row can carry, used to fire a **real** foreign-key
 * violation rather than to stand in for one. `account.id` is `uuid().defaultRandom()`,
 * a v4 uuid whose version nibble is always `4`; the nil uuid's is `0`.
 */
const NO_SUCH_ACCOUNT = "00000000-0000-0000-0000-000000000000";

/** A legal name of exactly `length` characters, deterministic so a red is reproducible. */
function nameOfLength(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[i % alphabet.length];
  return out;
}

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("lib/server/naming", () => {
  /* `| undefined` is the honest type: `beforeAll` can fail before assigning it. */
  let testDb: TestDb | undefined;
  let client: DbClient;

  beforeAll(async () => {
    testDb = await createTestDb();
    client = testDb.client;
  });

  beforeEach(async () => {
    await resetTestDb(client);
  });

  afterAll(async () => {
    /* Optional-call rather than `testDb.drop()`: a `beforeAll` that failed leaves it
       unassigned and an unguarded deref throws out of the teardown, burying the real
       cause under a TypeError. */
    await testDb?.drop();
  });

  async function accountId(githubLogin: string): Promise<string> {
    const [row] = await client.db
      .insert(schema.account)
      .values({ githubId: githubLogin, githubLogin })
      .returning();
    return row.id;
  }

  async function giveBundle(ownerId: string, slug: string): Promise<void> {
    /* T100 creates bundles; this arranges the row directly so AC2 and AC3 can be
       observed through `checkSlug` without reaching into another task's surface. */
    await client.db.insert(schema.bundle).values({ ownerId, slug, visibility: "public" });
  }

  it("AC1: every slug the profile tabs occupy is refused as a bundle name", async () => {
    const owner = await accountId("gh-ac1");
    for (const segment of RESERVED_PROFILE_SEGMENTS) {
      const answer = await checkSlug(client.db, owner, segment);
      expect(answer.available, segment).toBe(false);
    }
    /* The converse, or the criterion is met by a `checkSlug` that refuses everything. */
    expect((await checkSlug(client.db, owner, "frontline-triage")).available).toBe(true);
  });

  it("AC2: two owners may both hold `frontline-triage`", async () => {
    const hachi = await accountId("gh-hachi");
    const orin = await accountId("gh-orin");
    await giveBundle(hachi, "frontline-triage");

    expect((await checkSlug(client.db, hachi, "frontline-triage")).available).toBe(false);
    expect((await checkSlug(client.db, orin, "frontline-triage")).available).toBe(true);
  });

  it("AC3: one owner may not hold `frontline-triage` twice", async () => {
    const hachi = await accountId("gh-hachi-3");
    expect((await checkSlug(client.db, hachi, "frontline-triage")).available).toBe(true);
    await giveBundle(hachi, "frontline-triage");
    expect((await checkSlug(client.db, hachi, "frontline-triage")).available).toBe(false);
  });

  it("AC4: a released handle cannot be claimed by a second account, ever", async () => {
    const first = await accountId("gh-first");
    const second = await accountId("gh-second");

    await allocateHandle(client.db, first, "mara-veil");
    await releaseHandle(client.db, first, "mara-veil");

    await expect(allocateHandle(client.db, second, "mara-veil")).rejects.toBeInstanceOf(HandleTakenError);
    expect((await checkHandle(client.db, "mara-veil")).available).toBe(false);

    /* The row is what keeps the key occupied. A `releaseHandle` that deleted would pass
       every line above except this one, and would reopen the name forever. */
    const [row] = await client.db
      .select()
      .from(schema.handleReservation)
      .where(eq(schema.handleReservation.handle, "mara-veil"));
    expect(row).toBeDefined();
    expect(row.status).toBe("released");
    expect(row.releasedAt).not.toBeNull();
  });

  it("AC5: eight concurrent allocations of one handle yield exactly one success", async () => {
    const accounts = await Promise.all(
      Array.from({ length: 8 }, (_, i) => accountId(`gh-race-${i}`)),
    );

    const outcomes = await Promise.allSettled(
      accounts.map((id) => allocateHandle(client.db, id, "contested")),
    );

    const won = outcomes.filter((o) => o.status === "fulfilled");
    const lost = outcomes.filter((o) => o.status === "rejected");
    expect(won).toHaveLength(1);
    /* Every loser loses for the published reason. A `SELECT`-then-`INSERT` would put
       several here as raw driver errors, or would let several through. */
    for (const outcome of lost) {
      expect((outcome as PromiseRejectedResult).reason).toBeInstanceOf(HandleTakenError);
    }
    expect(lost).toHaveLength(7);

    const rows = await client.db
      .select()
      .from(schema.handleReservation)
      .where(eq(schema.handleReservation.handle, "contested"));
    expect(rows).toHaveLength(1);
  });

  it("AC6: a suggestion for a taken name is itself free when it is returned", async () => {
    const first = await accountId("gh-suggest-1");
    await allocateHandle(client.db, first, "mara-veil");

    const answer = await checkHandle(client.db, "mara-veil");
    expect(answer.available).toBe(false);
    expect(answer.suggestion).toBeDefined();
    /* Free is checked by allocating it, not by asking the same question twice: the
       claim is that the name could be taken, and only taking it proves that. */
    const second = await accountId("gh-suggest-2");
    await expect(allocateHandle(client.db, second, answer.suggestion!)).resolves.toBeUndefined();
  });

  it("AC6: a suggestion is never one of the reserved slugs, and skips taken candidates", async () => {
    const owner = await accountId("gh-suggest-3");
    await giveBundle(owner, "cards-2");

    const answer = await checkSlug(client.db, owner, "cards");
    expect(answer.available).toBe(false);
    expect(answer.suggestion).toBe("cards-3");
    expect(RESERVED_PROFILE_SEGMENTS).not.toContain(answer.suggestion);
  });

  it("AC4/AC5: the key still arbitrates, and the refusal carries NO driver error", async () => {
    /* This case used to assert a 23505 on the derived constraint name. D-70-06 replaced the
       bare insert with `ON CONFLICT (handle) DO UPDATE … WHERE`, so a conflicting row that
       fails the `setWhere` is simply not updated and Postgres raises nothing: the refusal is
       an empty `returning`. Rewritten rather than deleted, because the claim it was making —
       the key decides, not code — is still the one that matters; only its evidence moved. */
    const first = await accountId("gh-pkey-1");
    const second = await accountId("gh-pkey-2");
    await allocateHandle(client.db, first, "taken-twice");
    const err = (await allocateHandle(client.db, second, "taken-twice").catch((e: unknown) => e)) as Error;

    expect(err).toBeInstanceOf(HandleTakenError);
    expect(String(err)).toBe("HandleTakenError: allocateHandle: the handle `taken-twice` is not available.");

    /* **The own property must be absent, not present-and-undefined.** `super(message, { cause })`
       passed unconditionally gives every error an own non-enumerable `cause` holding `undefined`,
       which satisfies all four hygiene clauses — so a module that stopped carrying the driver
       error entirely would render identically to one that never had a cause to carry. A dropped
       cause and a cause never passed are indistinguishable in every rendering; only the
       descriptor separates them. (T030's trap, reinstated here by the one refusal in this module
       that legitimately has no cause.) */
    expect(Object.getOwnPropertyDescriptor(err, "cause")).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(err, "cause")).toBe(false);

    /* And the row did not move: the loser changed nothing. */
    const rows = await client.db
      .select()
      .from(schema.handleReservation)
      .where(eq(schema.handleReservation.handle, "taken-twice"));
    expect(rows.map((row) => row.accountId)).toEqual([first]);
    expect(rows.map((row) => row.status)).toEqual(["active"]);
  });

  it("AC4 second half: the original holder reclaims, and the descriptor check has a control", async () => {
    const holder = await accountId("gh-reclaim");
    await allocateHandle(client.db, holder, "mine-again");
    await releaseHandle(client.db, holder, "mine-again");
    expect((await checkHandle(client.db, "mine-again")).reason).toBe("reserved");

    await expect(allocateHandle(client.db, holder, "mine-again")).resolves.toBeUndefined();

    const rows = await client.db
      .select()
      .from(schema.handleReservation)
      .where(eq(schema.handleReservation.handle, "mine-again"));
    expect(rows, "reclaiming updates the one row rather than adding a second").toHaveLength(1);
    expect(rows[0].status).toBe("active");
    expect(rows[0].accountId).toBe(holder);
    expect((await checkHandle(client.db, "mine-again")).reason).toBe("taken");

    /* The control the descriptor assertion above needs: an error that DOES carry a cause must
       show a descriptor. Without it, `toBeUndefined()` would pass against a module that never
       attaches a cause anywhere, which is the state it exists to detect. */
    const withCause = (await checkSlug(client.db, "not-a-uuid", "frontline-triage").catch(
      (e: unknown) => e,
    )) as Error;
    expect(Object.getOwnPropertyDescriptor(withCause, "cause")).toBeDefined();
    expect(withCause.cause).toBeDefined();
  });

  it("a rejection renders as the published form and nothing else", async () => {
    const first = await accountId("gh-leak-1");
    const second = await accountId("gh-leak-2");
    await allocateHandle(client.db, first, "sealed");
    const err = (await allocateHandle(client.db, second, "sealed").catch((e: unknown) => e)) as Error;

    /* Expected strings are literals. Building them from the module would assert that it
       agrees with itself and would pass unchanged if the template started interpolating
       a driver value (`backend.md`, the whitelist-enforcement clause). */
    expect(err.message).toBe("allocateHandle: the handle `sealed` is not available.");
    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
    expect(JSON.stringify({ detail: err.message })).toBe(
      '{"detail":"allocateHandle: the handle `sealed` is not available."}',
    );
    expect(typeof err.stack).toBe("string");

    /* This case asserted `err.cause` was DEFINED until D-70-06. That was true of the bare
       insert, where the refusal was a translated 23505; under `ON CONFLICT … WHERE` the
       loser is refused by the index with no driver error in existence, so a correct
       implementation has nothing to carry. Inverted rather than deleted — the claim worth
       keeping is that the property is genuinely **absent**, not present holding `undefined`.
     *
     * `propertyIsEnumerable` is the line this replaces and it can no longer tell those
     * apart: it answers false for an absent property and a non-enumerable one alike. The
     * descriptor is the only rendering that separates them, which is the point — a module
     * that stopped carrying driver errors everywhere would pass every other assertion in
     * this file unchanged. Its control is in the reclaim case, where an error that does
     * have a cause must show a descriptor. */
    expect(Object.getOwnPropertyDescriptor(err, "cause")).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });

  it("an invalid name is refused before the driver is reached", async () => {
    const owner = await accountId("gh-invalid");
    const invalid = "Mara Veil";

    const err = (await allocateHandle(client.db, owner, invalid).catch((e: unknown) => e)) as Error;
    expect(err).toBeInstanceOf(InvalidNameError);
    expect(err.message).toBe("allocateHandle: `Mara Veil` is not a valid handle.");
    expect(Object.prototype.hasOwnProperty.call(err, "cause")).toBe(false);

    /* The round-trip half of the grammar, observed at the store rather than only at
       `validateNamespace`: `parseCardRef` trims, so a bare parse would let " mara-veil"
       through and reserve `mara-veil` — a different primary key from the one asked for,
       with nothing anywhere reporting the substitution. */
    await expect(allocateHandle(client.db, owner, " mara-veil")).rejects.toBeInstanceOf(InvalidNameError);
    expect(await checkHandle(client.db, " mara-veil")).toEqual({ available: false, reason: "illegal" });

    /* Nothing was written, and the check path answers rather than throwing. */
    const rows = await client.db.select().from(schema.handleReservation);
    expect(rows).toHaveLength(0);
    expect(await checkHandle(client.db, invalid)).toEqual({ available: false, reason: "illegal" });
    expect(await checkSlug(client.db, owner, invalid)).toEqual({ available: false, reason: "illegal" });
  });

  /* ---------- D-70-08: `Availability.reason` ---------- */

  it("D-70-08/D-70-14a: a refusal says which of the three published reasons it is", async () => {
    const owner = await accountId("gh-reason");
    await allocateHandle(client.db, owner, "mara-veil");
    await giveBundle(owner, "frontline-triage");

    expect(await checkHandle(client.db, "mara-veil")).toEqual({
      available: false,
      reason: "taken",
      suggestion: "mara-veil-2",
    });
    expect(await checkSlug(client.db, owner, "frontline-triage")).toEqual({
      available: false,
      reason: "taken",
      suggestion: "frontline-triage-2",
    });
    expect(await checkSlug(client.db, owner, "saved")).toEqual({
      available: false,
      reason: "reserved",
      suggestion: "saved-2",
    });

    /* `reason` is absent when there is nothing to explain, rather than set to a falsy
       member — `toEqual` here is exact, so a stray key reds. */
    expect(await checkHandle(client.db, "k0bra")).toEqual({ available: true });
    expect(await checkSlug(client.db, owner, "incident-commander")).toEqual({ available: true });

    /* D-70-14a: the third refusal kind, ruled into the union after round 2. It carries no
       suggestion, and that is asserted by `toEqual` being exact rather than stated in prose. */
    expect(await checkHandle(client.db, "Mara Veil")).toEqual({
      available: false,
      reason: "illegal",
    });
    expect(await checkSlug(client.db, owner, "Mara Veil")).toEqual({
      available: false,
      reason: "illegal",
    });

    /* Every refusal now carries a reason, and every availability carries none. Asserted over
       the three kinds together rather than one at a time, so a fourth refusal path added
       later with no reason reds here instead of answering `undefined` to a caller
       branching on it. */
    for (const answer of [
      await checkHandle(client.db, "mara-veil"),
      await checkHandle(client.db, "Mara Veil"),
      await checkSlug(client.db, owner, "frontline-triage"),
      await checkSlug(client.db, owner, "saved"),
      await checkSlug(client.db, owner, "Mara Veil"),
    ]) {
      expect(answer.available).toBe(false);
      expect(answer.reason, JSON.stringify(answer)).toBeDefined();
    }
  });

  /* ---------- D-70-16: a handle or slug is ONE URL segment ---------- */

  it("D-70-16: a separator is refused for a handle and a slug, and still legal in a card id", async () => {
    const owner = await accountId("gh-sep");
    const namespaced = "berti/solver-a";

    /* A handle is one segment of `/u/{handle}` and a slug one of
       `/blueprints/{owner}/{slug}`, so a name carrying `/` is unaddressable by routes
       that already exist. Refused at every entry point, not only at the validator. */
    expect(await checkHandle(client.db, namespaced)).toEqual({ available: false, reason: "illegal" });
    expect(await checkSlug(client.db, owner, namespaced)).toEqual({ available: false, reason: "illegal" });
    await expect(allocateHandle(client.db, owner, namespaced)).rejects.toBeInstanceOf(InvalidNameError);
    await expect(releaseHandle(client.db, owner, namespaced)).rejects.toBeInstanceOf(InvalidNameError);
    expect(validateNamespace(namespaced)).toHaveLength(1);
    expect(await client.db.select().from(schema.handleReservation)).toEqual([]);

    /* The converse, which is what keeps the narrowing from over-reaching: `CARD_ID`'s
       namespace form is for card ids, and D-70-16 narrowed handles and slugs only. A
       `validateCardId` that started refusing this would be the fix going too far. */
    expect(validateCardId(namespaced)).toEqual([]);
    expect(validateCardId("solver-a")).toEqual([]);
  });

  /* ---------- D-70-17: the bound is published, so it is pinned as a literal ---------- */

  it("D-70-17: MAX_NAME_LENGTH is 255 and reaches callers through the barrel", () => {
    /* Written as a literal on purpose. The published block's own warning is that a test
       importing the constant it bounds moves with it — so the *value* is pinned here
       against the number the contract publishes, and the relative assertion below is
       the one that is allowed to move. */
    expect(MAX_NAME_LENGTH).toBe(255);
    expect(validateNamespace("a".repeat(255))).toEqual([]);
    expect(validateNamespace("a".repeat(256))).toHaveLength(1);
  });

  /* ---------- D-70-13: the check may not promise what the store cannot hold ---------- */

  it("D-70-13: everything the grammar admits, the store accepts", async () => {
    const owner = await accountId("gh-maxlen");
    const atLimit = nameOfLength(MAX_NAME_LENGTH);
    expect(atLimit).toHaveLength(MAX_NAME_LENGTH);

    /* The invariant, driven end to end rather than asserted about the constant: whatever
       `MAX_NAME_LENGTH` is set to, a name of exactly that length must survive the write.
       Raising it past what a btree index tuple can hold reds here rather than reaching a
       user as `checkHandle` promising a name `allocateHandle` answers 54000 for. */
    expect(await checkHandle(client.db, atLimit)).toEqual({ available: true });
    await expect(allocateHandle(client.db, owner, atLimit)).resolves.toBeUndefined();

    const overLimit = nameOfLength(MAX_NAME_LENGTH + 1);
    expect(await checkHandle(client.db, overLimit)).toEqual({
      available: false,
      reason: "illegal",
    });
    const err = (await allocateHandle(client.db, owner, overLimit).catch((e: unknown) => e)) as Error;
    /* `InvalidNameError`, not `NamingStoreError`: the two answers agree, and the refusal
       names the caller's mistake instead of reporting a fault. */
    expect(err).toBeInstanceOf(InvalidNameError);
    expect(err).not.toBeInstanceOf(NamingStoreError);
    expect(err.message).toBe(`allocateHandle: \`${overLimit}\` is not a valid handle.`);

    /* And nothing over the bound reached the driver: one row, the one at the limit. */
    const rows = await client.db.select().from(schema.handleReservation);
    expect(rows.map((row) => row.handle)).toEqual([atLimit]);
  });

  /* ---------- D-70-18: a well-formed refusal is OWED a suggestion ---------- */

  it("D-70-18: a suggestion survives the first window of variants being wholly held", async () => {
    const owner = await accountId("gh-window");
    await allocateHandle(client.db, owner, "busy");
    /* Enough variants to exhaust the FIRST window, which is the whole point of the case.
       Its first version held 39 of them and reddened nothing when the widening loop was
       cut to a single window — 39 fits inside one window, so the test asserted an outcome
       the first query already produced and could not distinguish the loop from its
       absence. Found by mutating `WINDOWS` to 1 and reading a zero rather than filing it:
       64 held variants is what makes the second window load-bearing. */
    for (let n = 2; n <= 65; n++) await allocateHandle(client.db, owner, `busy-${n}`);

    const answer = await checkHandle(client.db, "busy");
    expect(answer).toEqual({ available: false, reason: "taken", suggestion: "busy-66" });

    /* AC6 still binds whenever one is returned: free at the moment it was returned, and
       proved free by taking it rather than by asking the same question twice. */
    const second = await accountId("gh-window-2");
    await expect(allocateHandle(client.db, second, answer.suggestion!)).resolves.toBeUndefined();
  });

  it("D-70-18: a name at the length bound is still owed a suggestion that fits", async () => {
    const owner = await accountId("gh-bound-suggest");
    const atLimit = nameOfLength(MAX_NAME_LENGTH);
    await allocateHandle(client.db, owner, atLimit);

    /* The boundary is where "required" would otherwise be unsatisfiable: every variant of
       a full-length name overflows, so the stem is cut to leave room for the suffix. */
    const answer = await checkHandle(client.db, atLimit);
    expect(answer.available).toBe(false);
    expect(answer.reason).toBe("taken");
    expect(answer.suggestion).toBeDefined();
    expect(answer.suggestion!.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
    expect(validateNamespace(answer.suggestion!)).toEqual([]);
    /* D-70-20: the generator SHORTENS rather than only appending, and it shortens by
       exactly as much as the suffix needs — `<253 chars>-2`, not a stem cut to some fixed
       reserved width. Pinned as an equality against the caller's own name so an
       appending-only generator and an over-eager one both red. */
    expect(answer.suggestion).toBe(`${atLimit.slice(0, MAX_NAME_LENGTH - 2)}-2`);
    expect(answer.suggestion).toHaveLength(MAX_NAME_LENGTH);
    /* And it is a real name, not merely a legal string: the store takes it. */
    const second = await accountId("gh-bound-suggest-2");
    await expect(allocateHandle(client.db, second, answer.suggestion!)).resolves.toBeUndefined();
  });

  it("D-70-18/19/21: the whole reason x name-kind product, every cell reachable", async () => {
    const owner = await accountId("gh-product");
    const other = await accountId("gh-product-2");
    await allocateHandle(client.db, owner, "mara-veil");
    await allocateHandle(client.db, other, "was-mine");
    await releaseHandle(client.db, other, "was-mine");
    await giveBundle(owner, "frontline-triage");

    /* Built from the ruling's own product of reasons and name kinds rather than from the
       assertions that happen to exist — the enumeration that missed `reserved x handle`
       was assembled the second way. Every cell below is REACHABLE, which is the other
       half of that rule: a case nobody can produce is a green reporting coverage of
       nothing, and asserting a dead cell is the same mistake as omitting a live one. */
    const cells: ReadonlyArray<readonly [string, Availability]> = [
      ["taken x handle", await checkHandle(client.db, "mara-veil")],
      ["reserved x handle (D-70-19, released)", await checkHandle(client.db, "was-mine")],
      ["taken x slug", await checkSlug(client.db, owner, "frontline-triage")],
      ["reserved x slug", await checkSlug(client.db, owner, "saved")],
      ["illegal x handle", await checkHandle(client.db, "Mara Veil")],
      ["illegal x slug", await checkSlug(client.db, owner, "Mara Veil")],
      ["available x handle", await checkHandle(client.db, "k0bra")],
      ["available x slug", await checkSlug(client.db, owner, "incident-commander")],
    ];

    const seen = new Map(cells.map(([label, answer]) => [label, answer]));
    expect(seen.get("taken x handle")!.reason).toBe("taken");
    /* D-70-19: a released row is not somebody's handle, it is a name AC4 keeps out of
       everyone's reach forever. Under `taken` this cell was dead and the enum was half
       live for handles. */
    expect(seen.get("reserved x handle (D-70-19, released)")!.reason).toBe("reserved");
    expect(seen.get("taken x slug")!.reason).toBe("taken");
    expect(seen.get("reserved x slug")!.reason).toBe("reserved");

    for (const [label, answer] of cells) {
      if (answer.available) {
        /* D-70-21: the other side of the quantifier, which D-70-18 left silent. */
        expect(answer.reason, label).toBeUndefined();
        expect(answer.suggestion, label).toBeUndefined();
      } else if (answer.reason === "illegal") {
        expect(answer.suggestion, label).toBeUndefined();
      } else {
        expect(answer.suggestion, label).toBeDefined();
      }
    }
  });

  /* ---------- D-70-11: the fault door, on all four operations ----------
     Three questions, and the count alone answers none of them (T070's adversary):
     ARRIVAL — does anything require the fault to reach the caller at all;
     IDENTITY — can a test tell this class from a bare `Error` or from a sibling;
     MESSAGE — is the message pinned, or free to start interpolating the driver's.
     Every fault below is a REAL driver error at the call site a caller uses — a
     malformed uuid, a foreign key that does not resolve, a pool that has been closed.
     None is a hand-built error object: a test that constructs the failure proves the
     assertion works, not that the guard does. */

  it("D-70-11: checkSlug's read fault arrives, is identifiable, and says nothing else", async () => {
    const err = (await checkSlug(client.db, "not-a-uuid", "frontline-triage").catch(
      (e: unknown) => e,
    )) as Error;

    /* ARRIVAL: the answer must not be an answer. Swallowing this and returning
       `{available:true}` would report an unavailable name as free. */
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NamingStoreError);
    /* IDENTITY: distinguishable from the module's other classes and from a bare Error.
       `instanceof NamingStoreError` is what a substitution — same message, plain
       `new Error` — has to fail. */
    expect(err).not.toBeInstanceOf(HandleTakenError);
    expect(err).not.toBeInstanceOf(InvalidNameError);
    expect(Object.getPrototypeOf(err)).not.toBe(Error.prototype);
    /* MESSAGE: an exact literal. Interpolating `String(cause)` reds here, and that is
       D-13 — `DrizzleQueryError.message` opens with the statement and every parameter. */
    expect(err.message).toBe("checkSlug: the database call failed.");
    expect(pgErrorCode(err.cause)).toBe("22P02");
  });

  it("D-70-11: allocateHandle's write fault arrives rather than resolving", async () => {
    /* The serious door. Swallowing this and resolving tells the caller it holds a handle
       no row exists for — a sign-up that reports success and reserved nothing. */
    const err = (await allocateHandle(client.db, NO_SUCH_ACCOUNT, "orphaned").catch(
      (e: unknown) => e,
    )) as Error;

    expect(err).toBeInstanceOf(NamingStoreError);
    expect(err).not.toBeInstanceOf(HandleTakenError);
    expect(err.message).toBe("allocateHandle: the database call failed.");
    expect(pgErrorCode(err.cause)).toBe("23503");

    /* And the fault is real rather than decorative: no row was written. */
    const rows = await client.db.select().from(schema.handleReservation);
    expect(rows).toEqual([]);
  });

  it("D-70-11: releaseHandle's write fault arrives rather than passing silently", async () => {
    /* `releaseHandle` resolves for a handle nobody holds, by ruling (D-70-02), so a
       swallowed fault here is invisible by construction — which is exactly why it needs
       a case of its own rather than being read off the other three. */
    const err = (await releaseHandle(client.db, "not-a-uuid", "held").catch(
      (e: unknown) => e,
    )) as Error;

    expect(err).toBeInstanceOf(NamingStoreError);
    expect(err.message).toBe("releaseHandle: the database call failed.");
    expect(pgErrorCode(err.cause)).toBe("22P02");
  });

  it("D-70-11: checkHandle's read fault arrives, and the rendering carries nothing", async () => {
    /* A database that is not there, which is the fault `NamingStoreError` was admitted for
       in the first place — "a database being down must not be swallowed as a conflict"
       (D-70-05). `checkHandle` takes no id to malform, so the reachable fault is
       infrastructural rather than an input.
     *
     * The first version of this case used a second scratch database and closed the client
     * under it, and it **leaked that database on every run**: `TestDb.drop()` begins with
     * `client.close()`, `pool.end()` raises on a pool already ended, and the `.catch` I had
     * put around `drop()` swallowed it before the `DROP DATABASE` ever ran. Fifteen
     * abandoned databases on the shared server, one per full-suite run, produced by the
     * test written to prove faults are not swallowed. A refused connection needs no
     * database at all, so there is nothing left to clean up. */
    const down = createDbClient("postgres://darkprint:darkprint@127.0.0.1:1/darkprint");
    const err = (await checkHandle(down.db, "mara-veil").catch((e: unknown) => e)) as Error;
    await down.close();

    expect(err).toBeInstanceOf(NamingStoreError);
    expect(err.message).toBe("checkHandle: the database call failed.");

    /* The whitelist, pinned by exact match rather than scanned for forbidden substrings.
       The driver error on `cause` carries the statement and the parameters; none of it
       may appear in any rendering a route or a log reaches for. */
    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
    expect(JSON.stringify({ detail: err.message })).toBe(
      '{"detail":"checkHandle: the database call failed."}',
    );
    expect(String(err)).toBe("NamingStoreError: checkHandle: the database call failed.");
    expect(err.propertyIsEnumerable("cause")).toBe(false);
    expect(err.cause).toBeDefined();
    expect(typeof err.stack).toBe("string");
  });

  it("releaseHandle is scoped to the account that holds the handle", async () => {
    const first = await accountId("gh-release-1");
    const second = await accountId("gh-release-2");
    await allocateHandle(client.db, first, "held");

    await releaseHandle(client.db, second, "held");
    const [afterOther] = await client.db
      .select()
      .from(schema.handleReservation)
      .where(eq(schema.handleReservation.handle, "held"));
    expect(afterOther.status).toBe("active");

    await releaseHandle(client.db, first, "held");
    const [released] = await client.db
      .select()
      .from(schema.handleReservation)
      .where(
        and(eq(schema.handleReservation.handle, "held"), eq(schema.handleReservation.accountId, first)),
      );
    expect(released.status).toBe("released");

    /* Idempotent: a second release leaves the first `released_at` standing rather than
       walking it forward, which is what the `status = 'active'` half of the WHERE buys. */
    const firstReleasedAt = released.releasedAt;
    await releaseHandle(client.db, first, "held");
    const [again] = await client.db
      .select()
      .from(schema.handleReservation)
      .where(eq(schema.handleReservation.handle, "held"));
    expect(again.releasedAt).toEqual(firstReleasedAt);
  });
});
