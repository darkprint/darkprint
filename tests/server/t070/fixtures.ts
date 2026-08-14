/* ============================================================
   T070 — fixtures and the database each suite owns

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── the database ──
   `createTestDb()` from `tests/support` creates a scratch database
   named `darkprint_test_<uuid>`, migrates it, and drops it on
   `drop()`. It never opens the shared development database that
   `DATABASE_URL` names; that is the whole reason T000 built it
   (D-08, two suites driving one database and racing each other's
   teardown). backend.md says blind suites from T020 onward may use
   it, so this one does.

   One live consequence, inherited and reported rather than worked
   around: `testEnv()` demands all five variables, so this suite
   cannot run without `S3_*` exported, and it never touches object
   storage.

   ── why this file writes rows T070 does not own ──
   T070's `Out of scope` line is explicit: "creating the account
   (T050) or the bundle (T100) the name is for". So the rows those
   two tasks will one day write are inserted here directly through
   `lib/db`'s schema, which is merged and is T000's. That is test
   setup, not a second implementation of anything T070 publishes —
   nothing in this file allocates a handle or decides a slug.

   ── the handles this file mints ──
   **T070 publishes no handle grammar.** The contract cites
   `CARD_ID`/`REF_VERSION` for *ids* and B-05 for what a handle
   *means*, and never says which strings are valid handles. So every
   minted handle here is deliberately conservative — lowercase
   alphanumerics and single interior hyphens, the intersection of
   every plausible reading — and no test in this suite asserts that
   some particular string is refused *as a grammar violation*. That
   gap is reported to the orchestrator; it is not filled by guessing,
   because a guessed grammar is a candidate list in a new hat.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { schema } from "@/lib/db";
import { type TestDb, createTestDb, resetTestDb } from "../../support";

export type { TestDb };

/** One scratch database per suite file; vitest gives each file its own worker. */
export async function openDatabase(): Promise<TestDb> {
  return createTestDb();
}

export async function clean(t: TestDb): Promise<void> {
  await resetTestDb(t.client);
}

/** What the published signatures call `db`: `Db = NodePgDatabase<typeof schema>` (`lib/db/client.ts:11`). */
export function db(t: TestDb) {
  return t.client.db;
}

/* --------------------- names --------------------- */

let counter = 0;

function mint(kind: string): string {
  counter += 1;
  return `t070-${kind}-${counter}`;
}

/** A handle nothing has claimed. Conservative by construction — see the header. */
export function freeHandle(): string {
  return mint("handle");
}

/** A bundle slug nothing has claimed and no profile tab occupies. */
export function freeSlug(): string {
  return mint("slug");
}

/* --------------------- rows T050 and T100 will one day write --------------------- */

/**
 * An account with no handle.
 *
 * `account.handle` is nullable and carries `account_handle_key`; Postgres admits any number of
 * NULLs under a unique index, so N handleless accounts coexist. Left null on purpose: T070
 * allocates into `handle_reservation`, and an account row pre-seeded with a handle would make a
 * test's premise depend on which of the two tables the module reads.
 */
export async function createAccount(t: TestDb): Promise<string> {
  const github = randomUUID();
  const [row] = await t.client.db
    .insert(schema.account)
    .values({ githubId: github, githubLogin: `gh-${github.slice(0, 8)}` })
    .returning({ id: schema.account.id });
  return row.id;
}

export async function createAccounts(t: TestDb, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) ids.push(await createAccount(t));
  return ids;
}

/** The `(owner, slug)` row `bundle_owner_slug_key` is unique over. T100's write, done by hand. */
export async function createBundle(t: TestDb, ownerId: string, slug: string): Promise<void> {
  await t.client.db.insert(schema.bundle).values({ ownerId, slug });
}

/* --------------------- reading back what the module wrote --------------------- */

export interface ReservationRow {
  handle: string;
  accountId: string | null;
  status: string;
  reservedAt: Date;
  releasedAt: Date | null;
}

/**
 * Every `handle_reservation` row for one handle.
 *
 * Returned as an array rather than a row: "the row is never deleted" is a claim about how many
 * rows exist as much as about their contents, and a helper that returned the first one would
 * make a zero and a one indistinguishable at the call site.
 */
export async function reservationsFor(t: TestDb, handle: string): Promise<ReservationRow[]> {
  const { rows } = await t.client.query<{
    handle: string;
    account_id: string | null;
    status: string;
    reserved_at: Date;
    released_at: Date | null;
  }>(
    "select handle, account_id, status, reserved_at, released_at " +
      "from handle_reservation where handle = $1",
    [handle],
  );
  return rows.map((r) => ({
    handle: r.handle,
    accountId: r.account_id,
    status: r.status,
    reservedAt: r.reserved_at,
    releasedAt: r.released_at,
  }));
}
