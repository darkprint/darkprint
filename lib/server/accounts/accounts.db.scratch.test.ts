/* ============================================================
   T050 implementer's scratch harness — the half that needs
   Postgres. Not the blind suite (`tests/server/t050/**`, written
   against the contract in a worktree that has never seen this
   file); scratch coverage does not count as verification
   (docs/ORCHESTRATION.md, Agent A).

   ── The injection, and why it is asserted rather than trusted ──
   Every route here reaches `getSharedDbClient()`, which opens
   `DATABASE_URL` — the SHARED development database. T070's route
   scratch test points the shared slot at a scratch database and
   notes that its own routes "only read, so nothing here can write
   to the shared database even if the slot were missed."

   **These routes write.** So the same missed injection that cost
   T070 nothing would put five PATCH handlers, an account upsert
   and a handle allocation into the shared development database —
   and the run would look green. The behavioural self-check T070
   uses is real but it is a *test*, so it runs after other tests
   may already have written. This file therefore asserts the slot
   by IDENTITY in `beforeAll` and throws if it does not hold, so
   no test body can run against the wrong server at all.

   Control bytes are imported, never retyped (T-01).
   ============================================================ */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getSharedDbClient, schema, type Db, type DbClient } from "@/lib/db";
import { decodeSession, encodeSession, SESSION_COOKIE_NAME } from "@/lib/server/auth";
import { HandleTakenError, InvalidNameError } from "@/lib/server/naming";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { nulInside } from "@/tests/support/control-bytes";
import { GET as getAccountRoute } from "@/app/api/account/route";
import { PATCH as patchHandleRoute } from "@/app/api/account/handle/route";
import { PATCH as patchProfileRoute } from "@/app/api/account/profile/route";
import { HandleRequiredError, InvalidProfileError } from "./errors";
import { changeHandle } from "./handle";
import { upsertFromGitHub } from "./github";
import { getAccount, getPublicAuthor } from "./read";
import { setDefaultVisibility, setEmail, updateProfile } from "./write";

const SECRET = "t050-scratch-secret";
process.env.SESSION_SECRET = SECRET;

/** `Symbol.for`, so this is the same slot `getSharedDbClient()` caches on. */
const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("lib/server/accounts against Postgres", () => {
  let testDb: TestDb;
  let previous: DbClient | undefined;
  let db: Db;

  const owner = (accountId: string, handle: string | null): Actor => ({
    kind: "account",
    accountId,
    handle,
  });

  /** An account row, straight to the store — the readers under test are not the setup. */
  async function seedAccount(
    githubId: string,
    handle: string | null,
    extra: Partial<typeof schema.account.$inferInsert> = {},
  ): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId, githubLogin: githubId, handle, ...extra })
      .returning({ id: schema.account.id });
    if (handle !== null) {
      await db
        .insert(schema.handleReservation)
        .values({ handle, accountId: row.id, status: "active" });
    }
    return row.id;
  }

  async function reservation(handle: string) {
    const [row] = await db
      .select()
      .from(schema.handleReservation)
      .where(eq(schema.handleReservation.handle, handle));
    return row;
  }

  async function storedHandle(accountId: string): Promise<string | null | undefined> {
    const [row] = await db
      .select({ handle: schema.account.handle })
      .from(schema.account)
      .where(eq(schema.account.id, accountId));
    return row?.handle;
  }

  function signedRequest(url: string, session: { accountId: string; handle: string | null }, init?: RequestInit): Request {
    return new Request(url, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        cookie: `${SESSION_COOKIE_NAME}=${encodeSession(session, SECRET)}`,
      },
    });
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    const withShared = globalThis as GlobalWithSharedClient;
    previous = withShared[SHARED_CLIENT_KEY];
    withShared[SHARED_CLIENT_KEY] = testDb.client;
    db = testDb.client.db;

    /* Fails CLOSED, before any test body runs. Every route below WRITES, so a missed
       injection is not a test measuring the wrong server — it is five PATCH handlers
       mutating the shared development database while the run reports green. */
    if (getSharedDbClient() !== testDb.client) {
      throw new Error(
        "The shared client slot is NOT the scratch database. Every route in this file writes, " +
          "so running on would mutate the shared development database. Refusing to run.",
      );
    }
  });

  afterEach(async () => {
    /* Children before parents, and `handle_reservation` before `account` — it carries the FK. */
    await db.delete(schema.handleReservation);
    await db.delete(schema.account);
  });

  afterAll(async () => {
    const withShared = globalThis as GlobalWithSharedClient;
    if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previous;
    await testDb.drop();
  });

  describe("upsertFromGitHub", () => {
    it("creates an account with no handle, which is AC1's legal state", async () => {
      const result = await upsertFromGitHub(db, { githubId: "gh-1", githubLogin: "mara" });
      expect(result.handle).toBeNull();
      expect(await storedHandle(result.accountId)).toBeNull();
    });

    it("AC3: a GitHub rename moves the login and nothing else", async () => {
      const first = await upsertFromGitHub(db, { githubId: "gh-1", githubLogin: "mara" });
      await changeHandle(db, owner(first.accountId, null), first.accountId, "mara-veil");

      const renamed = await upsertFromGitHub(db, { githubId: "gh-1", githubLogin: "mara-new" });
      expect(renamed.accountId).toBe(first.accountId);
      expect(renamed.handle).toBe("mara-veil");

      const [row] = await db.select().from(schema.account).where(eq(schema.account.id, first.accountId));
      expect(row.githubLogin).toBe("mara-new");
    });

    it("AC6: sixteen concurrent callers for one identity leave exactly one row", async () => {
      const results = await Promise.all(
        Array.from({ length: 16 }, () => upsertFromGitHub(db, { githubId: "gh-race", githubLogin: "racer" })),
      );
      const rows = await db.select().from(schema.account).where(eq(schema.account.githubId, "gh-race"));
      expect(rows).toHaveLength(1);
      expect(new Set(results.map((r) => r.accountId)).size).toBe(1);
    });
  });

  describe("the two readers", () => {
    it("AC2: an owner obtains the email and nobody else obtains a shape that has one", async () => {
      const id = await seedAccount("gh-2", "mara-veil", { email: "mara@veiga.dev", bio: "Builds." });

      const mine = await getAccount(db, owner(id, "mara-veil"), id);
      expect(mine?.email).toBe("mara@veiga.dev");

      const strangerId = await seedAccount("gh-3", "k0bra");
      expect(await getAccount(db, owner(strangerId, "k0bra"), id)).toBeUndefined();
      expect(await getAccount(db, { kind: "anonymous" }, id)).toBeUndefined();

      const author = await getPublicAuthor(db, "mara-veil");
      expect(Object.keys(author ?? {})).not.toContain("email");
      expect(JSON.stringify(author)).not.toContain("veiga.dev");
    });

    it("answers undefined for an unknown handle and for one the grammar refuses", async () => {
      expect(await getPublicAuthor(db, "nobody-at-all")).toBeUndefined();
      /* Refused before the driver: a `text` parameter carrying a NUL raises 22021, and
         the refusal here is the grammar rather than the store. */
      expect(await getPublicAuthor(db, nulInside("mara"))).toBeUndefined();
      expect(await getPublicAuthor(db, "Not A Handle")).toBeUndefined();
    });
  });

  describe("the three field writers", () => {
    it("applies a patch, clears on null, and leaves an unmentioned key alone", async () => {
      const id = await seedAccount("gh-4", "mara-veil", { displayName: "Mara", bio: "Builds." });
      const actor = owner(id, "mara-veil");

      const updated = await updateProfile(db, actor, id, { displayName: "Mara Veiga" });
      expect(updated.author.displayName).toBe("Mara Veiga");
      expect(updated.author.bio).toBe("Builds.");

      const cleared = await updateProfile(db, actor, id, { bio: null });
      expect("bio" in cleared.author).toBe(false);
      expect(cleared.author.displayName).toBe("Mara Veiga");
    });

    it("a present key carrying undefined leaves the column alone rather than clearing it", async () => {
      const id = await seedAccount("gh-4b", "mara-veil", { displayName: "Mara", bio: "Builds." });
      const actor = owner(id, "mara-veil");

      /* Unreachable from HTTP — `JSON.parse` produces no `undefined` — and reachable
         from any later task that spreads a partly-built object. The two readings differ
         by data loss, so the safe one is asserted rather than assumed. */
      const untouched = await updateProfile(db, actor, id, { bio: undefined, displayName: undefined });
      expect(untouched.author.bio).toBe("Builds.");
      expect(untouched.author.displayName).toBe("Mara");

      const [row] = await db.select().from(schema.account).where(eq(schema.account.id, id));
      expect(row.bio).toBe("Builds.");
    });

    it("a refused value writes NOTHING, which a return-value assertion cannot see", async () => {
      const id = await seedAccount("gh-5", "mara-veil", { displayName: "Mara", avatarHue: 210 });
      const actor = owner(id, "mara-veil");

      await expect(
        updateProfile(db, actor, id, { displayName: "Renamed", avatarHue: 40000 }),
      ).rejects.toThrow(InvalidProfileError);

      /* The point of the case: the patch carried one good field and one bad one, and a
         module validating as it writes would have stored the good one. */
      const [row] = await db.select().from(schema.account).where(eq(schema.account.id, id));
      expect(row.displayName).toBe("Mara");
      expect(row.avatarHue).toBe(210);
    });

    it("AC1: an unfinished sign-up cannot write its own fields", async () => {
      const id = await seedAccount("gh-6", null);
      const actor = owner(id, null);
      await expect(updateProfile(db, actor, id, { bio: "hi" })).rejects.toThrow(HandleRequiredError);
      await expect(setEmail(db, actor, id, "a@b.c")).rejects.toThrow(HandleRequiredError);
      await expect(setDefaultVisibility(db, actor, id, "public")).rejects.toThrow(HandleRequiredError);
    });

    it("stores the trimmed email it validated, and clears on null", async () => {
      const id = await seedAccount("gh-7", "mara-veil");
      const actor = owner(id, "mara-veil");
      expect((await setEmail(db, actor, id, "  mara@veiga.dev  ")).email).toBe("mara@veiga.dev");
      expect((await setEmail(db, actor, id, null)).email).toBeNull();
    });

    it("moves the default visibility", async () => {
      const id = await seedAccount("gh-8", "mara-veil");
      const record = await setDefaultVisibility(db, owner(id, "mara-veil"), id, "private");
      expect(record.defaultVisibility).toBe("private");
    });
  });

  describe("changeHandle: AC4 and D-70-06, both halves", () => {
    it("allocates the first handle and reserves it active", async () => {
      const id = await seedAccount("gh-9", null);
      const record = await changeHandle(db, owner(id, null), id, "mara-veil");
      expect(record.author.handle).toBe("mara-veil");
      expect(await storedHandle(id)).toBe("mara-veil");
      const row = await reservation("mara-veil");
      expect(row.status).toBe("active");
      expect(row.releasedAt).toBeNull();
    });

    it("a rename releases the old handle and the column follows", async () => {
      const id = await seedAccount("gh-10", null);
      await changeHandle(db, owner(id, null), id, "mara-veil");
      await changeHandle(db, owner(id, "mara-veil"), id, "mara-new");

      expect(await storedHandle(id)).toBe("mara-new");
      expect((await reservation("mara-veil")).status).toBe("released");
      expect((await reservation("mara-new")).status).toBe("active");
    });

    it("AC4 first half: no OTHER account may ever have the released handle", async () => {
      const mara = await seedAccount("gh-11", null);
      await changeHandle(db, owner(mara, null), mara, "mara-veil");
      await changeHandle(db, owner(mara, "mara-veil"), mara, "mara-new");

      const kobra = await seedAccount("gh-12", null);
      await expect(changeHandle(db, owner(kobra, null), kobra, "mara-veil")).rejects.toThrow(HandleTakenError);
      expect(await storedHandle(kobra)).toBeNull();
    });

    it("AC4 second half (D-70-06): the ORIGINAL holder reclaims it, and D-70-22's state is legal", async () => {
      const mara = await seedAccount("gh-13", null);
      await changeHandle(db, owner(mara, null), mara, "mara-veil");
      await changeHandle(db, owner(mara, "mara-veil"), mara, "mara-new");

      const back = await changeHandle(db, owner(mara, "mara-new"), mara, "mara-veil");
      expect(back.author.handle).toBe("mara-veil");

      /* D-70-22: the reclaimed row is `active` WITH a non-null `released_at`. That is
         legal and expected, and it is why `released_at IS NOT NULL` is not a test for
         "released" — `status` is the sole authority. Asserted rather than described,
         because this is the state nothing had tested before. */
      const row = await reservation("mara-veil");
      expect(row.status).toBe("active");
      expect(row.releasedAt).not.toBeNull();
    });

    it("a refused claim rolls back: the caller keeps the handle it had", async () => {
      const kobra = await seedAccount("gh-14", null);
      await changeHandle(db, owner(kobra, null), kobra, "k0bra");
      const mara = await seedAccount("gh-15", null);
      await changeHandle(db, owner(mara, null), mara, "mara-veil");

      await expect(changeHandle(db, owner(mara, "mara-veil"), mara, "k0bra")).rejects.toThrow(HandleTakenError);

      /* Release-last is what makes this true: had the old handle been released first,
         a caller losing the race would have surrendered it to get nothing. */
      expect(await storedHandle(mara)).toBe("mara-veil");
      expect((await reservation("mara-veil")).status).toBe("active");
    });

    it("renaming to the handle you already hold is a no-op, not a release", async () => {
      const id = await seedAccount("gh-16", null);
      await changeHandle(db, owner(id, null), id, "mara-veil");
      await changeHandle(db, owner(id, "mara-veil"), id, "mara-veil");
      expect(await storedHandle(id)).toBe("mara-veil");
      expect((await reservation("mara-veil")).status).toBe("active");
    });

    it("an illegal handle is refused by the grammar and writes nothing", async () => {
      const id = await seedAccount("gh-17", null);
      await expect(changeHandle(db, owner(id, null), id, "Not A Handle")).rejects.toThrow(InvalidNameError);
      expect(await storedHandle(id)).toBeNull();
      expect(await reservation("Not A Handle")).toBeUndefined();
    });
  });

  describe("the routes", () => {
    it("AC5: no session is problem+json 401 and never a fixture", async () => {
      const response = await getAccountRoute(new Request("https://darkprint.io/api/account"));
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toBe("application/problem+json");
      const body = (await response.json()) as { type: string };
      expect(body.type).toBe("https://darkprint.io/problems/unauthorized");
    });

    it("serves the signed-in account's own record", async () => {
      const id = await seedAccount("gh-18", "mara-veil", { email: "mara@veiga.dev" });
      const response = await getAccountRoute(
        signedRequest("https://darkprint.io/api/account", { accountId: id, handle: "mara-veil" }),
      );
      expect(response.status).toBe(200);
      expect(((await response.json()) as { email: string }).email).toBe("mara@veiga.dev");
    });

    it("403s a handle-less session on a write route, distinguishably from 401", async () => {
      const id = await seedAccount("gh-19", null);
      const response = await patchProfileRoute(
        signedRequest("https://darkprint.io/api/account/profile", { accountId: id, handle: null }, {
          method: "PATCH",
          body: JSON.stringify({ bio: "hi" }),
        }),
      );
      expect(response.status).toBe(403);
      expect(((await response.json()) as { type: string }).type).toBe(
        "https://darkprint.io/problems/handle-required",
      );
    });

    it("D-50-06: the handle route accepts a handle-less session AND re-mints the cookie", async () => {
      const id = await seedAccount("gh-20", null);
      const response = await patchHandleRoute(
        signedRequest("https://darkprint.io/api/account/handle", { accountId: id, handle: null }, {
          method: "PATCH",
          body: JSON.stringify({ handle: "mara-veil" }),
        }),
      );
      expect(response.status).toBe(200);

      /* Without this the account keeps `handle: null` in its signed token for thirty
         days and stays 403'd out of every route it just qualified for. There is no
         other observer of it: `withSession` never reads the database. */
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
      const value = /darkprint_session=([^;]+)/.exec(setCookie ?? "")?.[1];
      expect(decodeSession(value, SECRET)).toEqual({ accountId: id, handle: "mara-veil" });
    });

    it("maps a taken handle to 409 with T070's message unaltered", async () => {
      const kobra = await seedAccount("gh-21", null);
      await changeHandle(db, owner(kobra, null), kobra, "k0bra");
      const mara = await seedAccount("gh-22", null);

      const response = await patchHandleRoute(
        signedRequest("https://darkprint.io/api/account/handle", { accountId: mara, handle: null }, {
          method: "PATCH",
          body: JSON.stringify({ handle: "k0bra" }),
        }),
      );
      expect(response.status).toBe(409);
      expect(((await response.json()) as { detail: string }).detail).toBe(
        "allocateHandle: the handle `k0bra` is not available.",
      );
    });

    it("400s a non-string handle rather than raising a TypeError from the grammar", async () => {
      const id = await seedAccount("gh-23", null);
      const response = await patchHandleRoute(
        signedRequest("https://darkprint.io/api/account/handle", { accountId: id, handle: null }, {
          method: "PATCH",
          body: JSON.stringify({ handle: null }),
        }),
      );
      expect(response.status).toBe(400);
    });
  });

  describe("D-50-21 at the transport: a naming fault the closed port cannot reach", () => {
    /* **Scratch coverage, not verification** (docs/ORCHESTRATION.md, Agent A).

       The blind axis could not write this cell and the reason is structural rather
       than an omission: `changeHandle` reads the account row BEFORE it calls
       `allocateHandle`, so a closed port fails at the first call and yields
       `AccountStoreError` every time. The naming arm is unreachable from the transport
       by any input — today, and more so once D-50-20 locks that row first.

       It IS reachable with a live database whose `handle_reservation` is missing: the
       account read succeeds, `allocateHandle` raises 42P01 through the real driver,
       the real `lib/server/naming` wraps it into a genuine `NamingStoreError`, and the
       wrapper must answer the envelope with `allocateHandle` still named. One
       expectation carries both the envelope clause and the not-re-wrapped clause.

       A RENAME rather than a DROP, and the difference is reversibility: a dropped
       table has to be re-created from DDL restated here, which is a second copy of
       `lib/db/schema.ts` that can drift. A rename is undone by its inverse, in a
       `finally`, so the table is back whatever the assertions do.

       It does NOT close the composition gap: nothing observes D-50-20's ordering, so
       an implementation that reached naming FIRST would break that ruling and make
       this cell transport-reachable, and this test passes under both orderings. */
    it("answers problem+json 500 naming allocateHandle, from a real 42P01", async () => {
      const id = await seedAccount("gh-42p01", null);
      await db.execute(sql`alter table handle_reservation rename to handle_reservation_hidden`);
      try {
        const response = await patchHandleRoute(
          signedRequest("https://darkprint.io/api/account/handle", { accountId: id, handle: null }, {
            method: "PATCH",
            body: JSON.stringify({ handle: "mara-veil" }),
          }),
        );
        expect(response.status).toBe(500);
        expect(response.headers.get("content-type")).toBe("application/problem+json");
        const body = (await response.json()) as { type: string; detail: string };
        expect(body.type).toBe("https://darkprint.io/problems/store-failed");
        expect(body.detail).toBe("allocateHandle: the database call failed.");
        /* The account read got past, which is what makes this the NAMING arm rather
           than the account one — the discriminator between the two 500s. */
        expect(body.detail).not.toContain("changeHandle");
        expect(body.detail).not.toContain("getAccount");
        /* And a real driver error carries the statement; none of it may render. */
        const raw = JSON.stringify(body);
        for (const tell of ["42P01", "handle_reservation", "insert into", "relation"]) {
          expect(raw).not.toContain(tell);
        }
      } finally {
        await db.execute(sql`alter table handle_reservation_hidden rename to handle_reservation`);
      }
    });
  });

  describe("no residue in the shared database", () => {
    it("every write in this file went to the scratch database", async () => {
      /* The behavioural half of the injection check. `getSharedDbClient()` is asserted
         by identity in `beforeAll`; this re-reads it at the END, so a test that swapped
         the slot back mid-file is caught too. */
      expect(getSharedDbClient()).toBe(testDb.client);
    });
  });
});
