/* ============================================================
   The linking policy, which is the security-relevant half of
   multi-provider sign-in.

   `resolveFromProvider` decides which account a provider identity
   lands in, and exactly one of its branches is dangerous: linking
   by email. Linking on an address a provider has NOT proved is a
   documented account-takeover route — register `you@example.com`
   at any provider that will assert it unverified, sign in, and be
   inside the existing account. So the cell that matters most here
   is the NEGATIVE one: an unverified address must not link, and it
   must red loudly if that ever changes.

   Driven against a real Postgres because the whole verb is a
   sequence of statements racing a unique index; a fake would be
   asserting that this file's own mock behaves the way it was
   written to.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { resolveFromProvider } from "./identities";

let testDb: TestDb;
let db: Db;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.client.db;
}, 60_000);

afterAll(async () => {
  await testDb?.drop();
});

/** The `account` row behind an id, for the assertions that are about storage. */
async function accountRow(accountId: string) {
  const [row] = await db
    .select({
      id: schema.account.id,
      githubId: schema.account.githubId,
      email: schema.account.email,
    })
    .from(schema.account)
    .where(eq(schema.account.id, accountId))
    .limit(1);
  return row;
}

describe("resolveFromProvider", () => {
  it("resolves a repeat sign-in to the SAME account", async () => {
    const first = await resolveFromProvider(db, {
      provider: "google",
      providerId: "sub-repeat",
      login: "repeat",
      email: "repeat@example.test",
      emailVerified: true,
    });
    const second = await resolveFromProvider(db, {
      provider: "google",
      providerId: "sub-repeat",
      login: "repeat-renamed",
      email: "repeat@example.test",
      emailVerified: true,
    });
    expect(second.accountId).toBe(first.accountId);

    /* And exactly one identity row for that subject — the unique index doing its job
       rather than a second row shadowing the first. */
    const rows = await db
      .select({ id: schema.accountIdentity.id })
      .from(schema.accountIdentity)
      .where(eq(schema.accountIdentity.providerId, "sub-repeat"));
    expect(rows).toHaveLength(1);
  }, 60_000);

  it("links a VERIFIED address to the account that already holds it", async () => {
    const github = await resolveFromProvider(db, {
      provider: "github",
      providerId: "gh-link",
      login: "linker",
      email: "linker@example.test",
      emailVerified: true,
    });

    const google = await resolveFromProvider(db, {
      provider: "google",
      providerId: "sub-link",
      login: "linker",
      email: "linker@example.test",
      emailVerified: true,
    });

    expect(
      google.accountId,
      "a verified address already known to the registry is the same person, so the second " +
        "provider joins the account rather than minting a duplicate",
    ).toBe(github.accountId);
    expect(google.linked).toBe(true);

    /* Two identities, one account: the shape the whole table exists for. */
    const identities = await db
      .select({ provider: schema.accountIdentity.provider })
      .from(schema.accountIdentity)
      .where(eq(schema.accountIdentity.accountId, github.accountId));
    expect(identities.map((row) => row.provider).sort()).toEqual(["github", "google"]);
  }, 60_000);

  it("REFUSES to link an UNVERIFIED address, even when it matches exactly", async () => {
    const owner = await resolveFromProvider(db, {
      provider: "github",
      providerId: "gh-victim",
      login: "victim",
      email: "victim@example.test",
      emailVerified: true,
    });

    /* The attack this branch exists to refuse: a provider asserting an address it has not
       proved. If this ever returns `owner.accountId`, an attacker who can get any provider
       to claim a victim's address is inside the victim's account. */
    const impostor = await resolveFromProvider(db, {
      provider: "google",
      providerId: "sub-impostor",
      login: "impostor",
      email: "victim@example.test",
      emailVerified: false,
    });

    expect(
      impostor.accountId,
      "an unverified address must never link: this is the account-takeover path, and the " +
        "cost of refusing is a duplicate account, which is recoverable",
    ).not.toBe(owner.accountId);
    expect(impostor.linked).toBe(false);
  }, 60_000);

  it("gives a Google-first account a namespaced legacy id rather than a bare subject", async () => {
    const google = await resolveFromProvider(db, {
      provider: "google",
      providerId: "sub-namespaced",
      login: "namespaced",
      email: "namespaced@example.test",
      emailVerified: true,
    });
    const row = await accountRow(google.accountId);
    expect(
      row?.githubId,
      "`account.github_id` is NOT NULL and unique and cannot be widened (the base-table " +
        "shape is frozen), so a non-GitHub first provider stores a namespaced value there. " +
        "A BARE subject id could collide with a real GitHub id, which is digits.",
    ).toBe("google:sub-namespaced");
  }, 60_000);

  it("refuses an empty subject id before opening a connection", async () => {
    await expect(
      resolveFromProvider(db, {
        provider: "google",
        providerId: "",
        login: "empty",
        email: null,
        emailVerified: false,
      }),
    ).rejects.toThrow("resolveFromProvider: the account store failed.");
  }, 60_000);

  it("mints separate accounts for two identities with no email at all", async () => {
    /* `null` must not match `null`. A missing address is not evidence that two people are
       the same person, and SQL's own `= NULL` semantics happen to agree — this cell is here
       so a future rewrite using `IS NOT DISTINCT FROM` reds instead of quietly merging
       every address-less account into one. */
    const a = await resolveFromProvider(db, {
      provider: "google",
      providerId: "sub-null-a",
      login: "a",
      email: null,
      emailVerified: false,
    });
    const b = await resolveFromProvider(db, {
      provider: "google",
      providerId: "sub-null-b",
      login: "b",
      email: null,
      emailVerified: false,
    });
    expect(b.accountId).not.toBe(a.accountId);
  }, 60_000);
});
