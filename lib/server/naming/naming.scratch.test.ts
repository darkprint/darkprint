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
import { schema, type DbClient } from "@/lib/db";
import { createTestDb, resetTestDb, type TestDb } from "../../../tests/support/db";
import { HANDLE_PRIMARY_KEY_CONSTRAINT } from "./constraint";
import { pgErrorCode, pgErrorConstraint } from "./pg-error";
import {
  allocateHandle,
  checkHandle,
  checkSlug,
  HandleTakenError,
  InvalidNameError,
  releaseHandle,
} from "./index";

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

  it("the primary key is the arbiter: a duplicate arrives as 23505 on the derived name", async () => {
    /* The one claim `constraint.ts` cannot check by reading: `handle_reservation_pkey`
       is Postgres's default name for the unnamed inline key, and a wrong guess would
       turn every duplicate into a generic store error with AC4 and AC5 quietly unmet.
       Reaching `HandleTakenError` at all is that check. */
    const first = await accountId("gh-pkey-1");
    const second = await accountId("gh-pkey-2");
    await allocateHandle(client.db, first, "taken-twice");
    const err = (await allocateHandle(client.db, second, "taken-twice").catch((e: unknown) => e)) as Error;
    expect(err).toBeInstanceOf(HandleTakenError);
    expect(HANDLE_PRIMARY_KEY_CONSTRAINT).toBe("handle_reservation_pkey");
    expect(pgErrorCode(err.cause)).toBe("23505");
    expect(pgErrorConstraint(err.cause)).toBe(HANDLE_PRIMARY_KEY_CONSTRAINT);
    expect(String(err)).toBe("HandleTakenError: allocateHandle: the handle `taken-twice` is not available.");
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
    expect(err.propertyIsEnumerable("cause")).toBe(false);
    expect(err.cause).toBeDefined();
    expect(typeof err.stack).toBe("string");
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
    expect(await checkHandle(client.db, " mara-veil")).toEqual({ available: false });

    /* Nothing was written, and the check path answers rather than throwing. */
    const rows = await client.db.select().from(schema.handleReservation);
    expect(rows).toHaveLength(0);
    expect(await checkHandle(client.db, invalid)).toEqual({ available: false });
    expect(await checkSlug(client.db, owner, invalid)).toEqual({ available: false });
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
