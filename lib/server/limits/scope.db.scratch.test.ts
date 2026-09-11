/* ============================================================
   The key scope against Postgres — Q3, owner ruling 2026-09-05

   Every claim this feature makes is a claim about a ROW: that a
   key minted before `0010_key_scope` reads as `read`, that a
   `scope` column decides a grant, and that revoking or demoting a
   key changes the answer for a caller already holding its
   `ResolvedKey`. A stub `Db` cannot answer any of them. The
   sibling `keys.test.ts` records a `.where()` as the bare string
   `"where"` and discards the argument, so both of the clauses this
   file exists to defend are invisible there and stay green when
   either is deleted.

   ── what a skip means ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap: an unsourced shell turns every assertion below
   into silence at exit 0. The cell outside the guarded block says
   which world ran, so a result cannot be read as green when
   nothing was measured.

   ── refusal is measured as EFFECT ──
   T230's convention, and it is the right one here for a sharper
   reason than consistency. `writeActorFor` answering `undefined`
   is what a route would branch on, but `undefined` is also what a
   broken query answers, and a cell asserting only that would pass
   against a function that never grants anything. So each refusal
   is paired with a real store write driven through the actor the
   key produced, and the assertion is what `api_key` holds
   afterwards — which is unambiguous whichever way the code got
   there.
   ============================================================ */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "@/lib/db";
import { can, type Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { issueKey, resolveKey, revokeKey, writeActorFor } from "./index";
import type { ResolvedKey } from "./types";

const hasDb = Boolean(process.env.DATABASE_URL);

/** Named so a reader can tell a refusal from a grant without reading `can`. */
const ANONYMOUS: Actor = { kind: "anonymous" };

it("declares which world this file ran in, so a skipped run cannot read as a clean one", () => {
  /* Outside the guarded block deliberately. Every cell below is skipped without a database,
     and a suite whose only possible outputs are "green" and "silent" has no failing state to
     report. This one always runs and always says which happened. */
  expect(
    hasDb,
    "DATABASE_URL is unset, so every cell in this file was skipped and the scope has been " +
      "measured against nothing. Source the environment first: `set -a; . ./.env.example; set +a`.",
  ).toBe(true);
});

describe.skipIf(!hasDb)("api_key.scope against Postgres", () => {
  let testDb: TestDb;
  let db: Db;
  let probe = 0;

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;
  }, 120_000);

  afterAll(async () => {
    await testDb?.drop();
  });

  /** An account with a real handle, because `Actor.handle` is one of the things asserted. */
  async function account(handle: string): Promise<{ id: string; handle: string }> {
    probe += 1;
    const unique = `${handle}-${probe}-${process.pid % 10000}`;
    const [row] = await db
      .insert(schema.account)
      .values({ githubId: `gh-${unique}`, githubLogin: unique, handle: unique })
      .returning({ id: schema.account.id });
    return { id: row!.id, handle: unique };
  }

  const owner = (accountId: string, handle: string | null): Actor => ({
    kind: "account",
    accountId,
    handle,
  });

  /** Mint a key and present its secret back, which is the only way to get a `ResolvedKey`. */
  async function held(
    accountId: string,
    scope: "read" | "write" | undefined,
    label = "harness",
  ): Promise<{ keyId: string; brand: ResolvedKey }> {
    const { record, secret } =
      scope === undefined
        ? await issueKey(db, owner(accountId, null), accountId, label)
        : await issueKey(db, owner(accountId, null), accountId, label, scope);
    const brand = await resolveKey(db, secret);
    expect(brand, "the fixture could not present the secret it just minted").toBeDefined();
    return { keyId: record.keyId, brand: brand! };
  }

  /**
   * What a write route does with a presented key: derive an actor, or act as nobody.
   *
   * The fallback is `anonymous` rather than a throw because that is the shape a route has to
   * take, and because it makes the refusal cells measure the whole path instead of stopping
   * at the `undefined`.
   */
  async function actorFor(brand: ResolvedKey): Promise<Actor> {
    return (await writeActorFor(db, brand)) ?? ANONYMOUS;
  }

  async function revokedAtOf(keyId: string): Promise<Date | null> {
    const [row] = await db
      .select({ revokedAt: schema.apiKey.revokedAt })
      .from(schema.apiKey)
      .where(eq(schema.apiKey.id, keyId));
    return row?.revokedAt ?? null;
  }

  /* ============================================================
     the refusal — the cell this whole change is falsified against
     ============================================================ */

  it("a read-scoped key is refused by a write, and the write does not happen", async () => {
    const acct = await account("reader");
    const { brand } = await held(acct.id, "read", "read-only");
    /* A second key, so the write has a real subject whose state can be read back. Revoking it
       is a genuine store write gated by `can(actor, "write", { kind: "account" })` — the same
       gate every keyed write route would sit behind. */
    const { keyId: target } = await held(acct.id, "read", "the-target");

    expect(
      await writeActorFor(db, brand),
      "A read-scoped key must produce no actor. The sentence `ApiKeys.tsx` has shown every " +
        "holder since T280 is that a key `authorizes no write`, and the owner's 2026-09-05 " +
        "ruling keeps it true of every key not minted with `write`.",
    ).toBeUndefined();

    const actor = await actorFor(brand);
    await expect(
      revokeKey(db, actor, target),
      "a read-scoped key reached a write verb and was not refused",
    ).rejects.toThrow();

    expect(
      await revokedAtOf(target),
      "The refusal is measured as effect. `writeActorFor` answering `undefined` and the write " +
        "actually not landing are different claims, and only the second one is the promise.",
    ).toBeNull();
  }, 60_000);

  it("a write-scoped key produces an actor the write accepts, and the write lands", async () => {
    const acct = await account("writer");
    const { brand } = await held(acct.id, "write", "the-harness");
    const { keyId: target } = await held(acct.id, "read", "the-target");

    const actor = await actorFor(brand);
    expect(
      actor.kind,
      "Without this the refusal cell above passes against an implementation that grants " +
        "nothing at all, which is a broken query rather than a scope.",
    ).toBe("account");
    expect(can(actor, "write", { kind: "account", accountId: acct.id })).toBe(true);

    await revokeKey(db, actor, target);
    expect(await revokedAtOf(target)).not.toBeNull();
  }, 60_000);

  /* ============================================================
     liveness — the brand proves provenance and never liveness
     ============================================================ */

  it("a brand minted before a revoke does not authorise a write after it", async () => {
    const acct = await account("revoked");
    const { keyId, brand } = await held(acct.id, "write", "about-to-go");
    const { keyId: target } = await held(acct.id, "read", "the-target");

    /* The brand is taken FIRST and the revoke happens after, which is the whole hazard: a
       long-lived request or a queued job holds a record that was true when it was read. */
    expect(await writeActorFor(db, brand)).toBeDefined();
    await revokeKey(db, owner(acct.id, acct.handle), keyId);

    expect(
      await writeActorFor(db, brand),
      "§11.0 Q3: the `ResolvedKey` brand proves PROVENANCE, not LIVENESS. A value held across " +
        "a revoke must not buy a write, which is only true if the row is read again here.",
    ).toBeUndefined();

    await expect(revokeKey(db, await actorFor(brand), target)).rejects.toThrow();
    expect(await revokedAtOf(target)).toBeNull();
  }, 60_000);

  it("a brand minted before a demotion does not authorise a write after it", async () => {
    const acct = await account("demoted");
    const { keyId, brand } = await held(acct.id, "write", "about-to-drop");
    const { keyId: target } = await held(acct.id, "read", "the-target");

    expect(await writeActorFor(db, brand)).toBeDefined();
    /* Separate from the revoke cell above on purpose. The two clauses sit in one `and()`, and
       a pair of conjuncts can mask each other: with only a revoke cell, deleting
       `scope = 'write'` reds nothing. This is the axis that measures that clause. */
    await db.update(schema.apiKey).set({ scope: "read" }).where(eq(schema.apiKey.id, keyId));

    expect(
      await writeActorFor(db, brand),
      "the scope clause is not being read at the moment of the grant",
    ).toBeUndefined();
    await expect(revokeKey(db, await actorFor(brand), target)).rejects.toThrow();
    expect(await revokedAtOf(target)).toBeNull();
  }, 60_000);

  /* ============================================================
     grandfathering — the claim the migration makes about a set
     ============================================================ */

  it("a row written without naming a scope reads as read-only, which is what backfills every key already minted", async () => {
    const acct = await account("legacy");
    /* Written the way a pre-0010 INSERT wrote it: no `scope` at all. This is the shape of
       every row in production, since the column did not exist when they were written. */
    const [row] = await db
      .insert(schema.apiKey)
      .values({ accountId: acct.id, tokenHash: `legacy-${probe}-${process.pid}`, label: "legacy" })
      .returning({ id: schema.apiKey.id, scope: schema.apiKey.scope });

    expect(
      row?.scope,
      "The column's default IS the grandfathering. A row that could be written without a scope " +
        "and read back as anything else would break the promise for the keys the ruling is " +
        "specifically about.",
    ).toBe("read");
  }, 60_000);

  it("issueKey mints read when no scope is asked for, so a caller that has not learned about scopes cannot mint a write key", async () => {
    const acct = await account("defaulted");
    const { brand } = await held(acct.id, undefined, "no-scope-asked");

    expect(brand.scope).toBe("read");
    expect(
      await writeActorFor(db, brand),
      "`issueKey`'s scope parameter is optional so the route another lane owns keeps " +
        "compiling. That is only safe if the value it defaults to is the least privilege.",
    ).toBeUndefined();
  }, 60_000);

  /* ============================================================
     what the actor carries
     ============================================================ */

  it("the actor carries the account's real handle, so the handle guard does not refuse a key holder", async () => {
    const acct = await account("handled");
    const { brand } = await held(acct.id, "write");

    const actor = await writeActorFor(db, brand);
    expect(actor).toBeDefined();
    expect(
      actor?.kind === "account" ? actor.handle : "(not an account actor)",
      "`requireHandle` refuses an account actor whose handle is null as *sign-up unfinished*. " +
        "A fabricated `handle: null` would refuse a key holder whose account has one, with a " +
        "message about a condition that is not true.",
    ).toBe(acct.handle);
  }, 60_000);

  it("the actor names the account the key was issued for, and not another one", async () => {
    const mine = await account("mine");
    const theirs = await account("theirs");
    /* A second account holding its own write key, so "returns an accountId" and "returns the
       right one" are different results rather than the same one. */
    await held(theirs.id, "write", "theirs");
    const { brand } = await held(mine.id, "write", "mine");

    const actor = await writeActorFor(db, brand);
    expect(actor?.kind === "account" ? actor.accountId : undefined).toBe(mine.id);
    expect(can(actor ?? ANONYMOUS, "write", { kind: "account", accountId: theirs.id })).toBe(false);
  }, 60_000);

  it("no key can mint an operator, whatever its scope", async () => {
    const acct = await account("notoperator");
    const { brand } = await held(acct.id, "write");
    /* D-50-13 at the other door: `SessionPayload` carries no `kind` so no route can build an
       operator, and `api_key` carries none either. `can`'s operator grant stays unreachable
       through this constructor as well as through that one. */
    expect((await writeActorFor(db, brand))?.kind).toBe("account");
  }, 60_000);
});
