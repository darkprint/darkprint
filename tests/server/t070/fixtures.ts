/* ============================================================
   T070 — fixtures and the database each suite owns

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── the database ──
   `scratchDatabase()` (in `contract.ts`) creates a migrated
   `darkprint_test_<uuid>` of its own and hands back the connection
   string with it, because the route half of this suite needs to name
   it: a route handler gets its `Db` from `getSharedDbClient()`, which
   reads `DATABASE_URL`.

   ── why this file writes rows T070 does not own ──
   T070's `Out of scope` line is explicit: "creating the account
   (T050) or the bundle (T100) the name is for". So the rows those two
   tasks will one day write are inserted here directly. That is test
   setup, not a second implementation of anything T070 publishes —
   nothing in this file decides whether a name is available.

   **`seatHandle` writes both places on purpose.** D-70-14b puts the
   handle-to-id lookup in the route, and does not say which table it
   reads: `account.handle` is the account's *current* handle, while
   `handle_reservation` also carries every handle it ever released. A
   fixture that wrote only one would make the route tests pass or fail
   on a choice the contract leaves open. T050 writes both at sign-up,
   so both is also what production looks like.

   ── the names this file mints ──
   D-70-04 settled what round 1 had to report: **one grammar for
   handles, slugs and namespaces**, `CARD_ID` through the engine's
   exported `parseCardRef`/`cardRef`, checked by ROUND-TRIP rather
   than by parsing. Every minted name below is legal under it.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { createDbClient } from "@/lib/db";
import { type Scratch, dropScratchDatabases, scratchDatabase } from "./contract";

export type { Scratch };

/** One scratch database per suite file; vitest gives each file its own worker. */
export async function openDatabase(): Promise<Scratch> {
  return scratchDatabase();
}

export async function closeDatabase(): Promise<void> {
  await dropScratchDatabases();
}

/**
 * Empty the three tables this suite writes.
 *
 * `cascade` rather than a hand-ordered delete list: this is a scratch database nothing else
 * reaches, and an ordering maintained by hand is one more thing that can drift from the schema.
 */
export async function clean(s: Scratch): Promise<void> {
  await s.query("truncate handle_reservation, bundle, account cascade");
}

/** What the published signatures call `db`: `Db = NodePgDatabase<typeof schema>`. */
export function db(s: Scratch): unknown {
  return s.db;
}

/* --------------------- names --------------------- */

let counter = 0;

function mint(kind: string): string {
  counter += 1;
  return `t070-${kind}-${counter}`;
}

/** A handle nothing has claimed, legal under the one grammar D-70-04 settled. */
export function freeHandle(): string {
  return mint("handle");
}

/** A bundle slug nothing has claimed and no profile tab occupies. */
export function freeSlug(): string {
  return mint("slug");
}

/**
 * D-70-15's bound, and the number comes from the ruling rather than from the module.
 *
 * "**D-70-15 stays open and is the owner's.** 255 is a *storage* bound and the test is what
 * makes it safe rather than the number: it allocates a name of exactly `MAX_NAME_LENGTH`
 * through the published surface, so raising the constant past what a btree tuple holds reds
 * there instead of reaching a user."
 *
 * So `MAX_NAME_LENGTH` is **allocatable** and one more is not. The constant itself is not in
 * the Published signatures block, so nothing here binds it by name — a blind suite cannot
 * import a number it was not published, and importing it would make the boundary test agree
 * with whatever the module happens to say.
 */
export const MAX_NAME_LENGTH = 255;

/** A legal name of exactly `n` characters. `a`-repeated matches `[a-z0-9]+` at every length. */
export function nameOfLength(n: number): string {
  return "a".repeat(n);
}

/* --------------------- rows T050 and T100 will one day write --------------------- */

/**
 * An account with no handle.
 *
 * `account.handle` is nullable and carries `account_handle_key`; Postgres admits any number of
 * NULLs under a unique index, so N handleless accounts coexist. Left null by default on
 * purpose: T070 allocates into `handle_reservation`, and an account row pre-seeded with a
 * handle would make a test's premise depend on which of the two tables the module reads.
 */
export async function createAccount(s: Scratch): Promise<string> {
  const github = randomUUID();
  const [row] = await s.query(
    "insert into account (github_id, github_login) values ($1, $2) returning id",
    [github, `gh-${github.slice(0, 8)}`],
  );
  return row.id as string;
}

export async function createAccounts(s: Scratch, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) ids.push(await createAccount(s));
  return ids;
}

/**
 * Give an existing account a handle, in both places a reader could look — see the header.
 * Written by hand rather than through `allocateHandle`, so a route fixture does not depend on
 * the module the route is being tested through.
 */
export async function seatHandle(s: Scratch, accountId: string, handle: string): Promise<void> {
  await s.query("update account set handle = $1 where id = $2", [handle, accountId]);
  await s.query(
    "insert into handle_reservation (handle, account_id, status) values ($1, $2, 'active')",
    [handle, accountId],
  );
}

/** An account that already holds `handle`. The shape T050 leaves behind after sign-up. */
export async function createAccountWithHandle(s: Scratch, handle: string): Promise<string> {
  const id = await createAccount(s);
  await seatHandle(s, id, handle);
  return id;
}

/** The `(owner, slug)` row `bundle_owner_slug_key` is unique over. T100's write, done by hand. */
export async function createBundle(s: Scratch, ownerId: string, slug: string): Promise<void> {
  await s.query("insert into bundle (owner_id, slug) values ($1, $2)", [ownerId, slug]);
}

/* --------------------- reading back what the module wrote --------------------- */

export interface ReservationRow {
  handle: string;
  accountId: string | null;
  status: string;
  releasedAt: Date | null;
}

/**
 * Every `handle_reservation` row for one handle.
 *
 * Returned as an array rather than a row: "the row is never deleted" is a claim about how many
 * rows exist as much as about their contents, and a helper that returned the first one would
 * make a zero and a one indistinguishable at the call site.
 */
export async function reservationsFor(s: Scratch, handle: string): Promise<ReservationRow[]> {
  const rows = await s.query(
    "select handle, account_id, status, released_at from handle_reservation where handle = $1",
    [handle],
  );
  return rows.map((r) => ({
    handle: r.handle as string,
    accountId: (r.account_id ?? null) as string | null,
    status: r.status as string,
    releasedAt: (r.released_at ?? null) as Date | null,
  }));
}

/* --------------------- a database that is not there --------------------- */

/**
 * A `Db` whose server refuses the connection, for the one fault door that cannot be reached by
 * handing a caller a bad value.
 *
 * D-70-05 accepts `NamingStoreError` because "a fault has to leave and must not carry
 * `DrizzleQueryError.message`", and a fault is not only a malformed parameter — the ordinary
 * production fault is the database being unreachable. Port 1 is reserved and never listening,
 * so `connect` fails with ECONNREFUSED before any statement is sent, which is the one shape a
 * SQLSTATE-keyed catch block cannot classify: **there is no SQLSTATE**. A module that maps
 * faults by reading `cause.code` and falls through to a re-throw leaks the driver's error here
 * and nowhere else.
 *
 * `createDbClient` attaches a pool `error` listener of its own, so a refused connection cannot
 * take the worker down with an unhandled `EventEmitter` error.
 */
export function deadDb(): { db: unknown; close: () => Promise<void> } {
  const client = createDbClient("postgres://darkprint:darkprint@127.0.0.1:1/darkprint");
  return {
    db: client.db,
    close: async () => {
      try {
        await client.close();
      } catch {
        /* a pool that never connected has nothing to end; teardown is not under test */
      }
    },
  };
}
