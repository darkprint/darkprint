/* ============================================================
   T071 — fixtures, the two bounds as literals, and the setup
   failure that must red in a CELL

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── the numbers are read from the rulings, never from the module ──
   Both constants are written out here. §T070's Published signatures
   block says why for the storage bound — "Do NOT import it into a
   boundary test: a test that imports the constant it bounds moves
   with it" — and the same argument transfers to the product bound
   word for word. A boundary test that imports the constant it is
   bounding asserts "does the module agree with itself" and stays
   green while the constant moves.

   `surface.test.ts` is the one file that reads the module's own
   values, and it reads them to CHECK them against these literals
   rather than to use them. That is what stops the two from drifting
   apart silently, and it is the shape D-70-15 named: the number is
   safe because a test holds it, not because it is small.

   ── the setup failure is deliberately NOT left in the hook ──
   Measured on this run: under one broken writer, 127 merged cells
   went SILENT — a throw in `beforeAll` stands the run down rather
   than failing it, so it adds nothing to the failed-test column and
   a handoff reading the test total calls a red run green. Thirteen
   cells in a suite that recorded the setup failure and re-raised it
   per cell went red on the same defect.

   So `openDatabase` records rather than throws, and `scratch()`
   re-raises inside whichever cell asked for a database. Every cell
   that needs one gets its own red naming the criterion it belongs
   to; a cell that needs no database — AC4's attribute, AC5's walk —
   is unaffected by a Postgres that is down, which is correct: those
   criteria do not depend on one.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { type Scratch, dropScratchDatabases, scratchDatabase } from "./contract";

export type { Scratch };

/* --------------------- the two bounds --------------------- */

/**
 * §T071, D-70-15 owner-ruled 2026-08-18, published on the barrel by D-071-01(4).
 *
 * The PRODUCT bound: "what the product will accept". A handle longer than this is not
 * well-formed, and by D-70-18 an ill-formed name is refused with no suggestion.
 */
export const MAX_HANDLE_LENGTH = 32;

/**
 * §T070, D-70-15/D-70-16. The STORAGE bound: "what the btree tuple actually holds".
 *
 * AC3 keeps it at 255 and keeps it meaning something different. The two coexist, and the whole
 * of AC3's negative half is that this one did not move and did not narrow — a bound put in
 * D-70-04's shared grammar instead of in a handle-specific predicate would drag slugs, card ids
 * and namespaces down to 32 with it, which §T071's `Out of scope` line forbids by name.
 */
export const MAX_NAME_LENGTH = 255;

/** A legal name of exactly `n` characters. `a`-repeated matches `[a-z0-9]+` at every length. */
export function nameOfLength(n: number): string {
  return "a".repeat(n);
}

/**
 * A legal name of exactly `n` characters that is distinct per call.
 *
 * `nameOfLength` alone is not enough wherever two names in one cell must differ while both
 * sitting at a bound — an over-length handle and the truncation a bad implementation would
 * derive from it are the same string under `nameOfLength`, which is the point in AC2 and a
 * confound everywhere else.
 */
let distinct = 0;
export function distinctNameOfLength(n: number, tag = "t071"): string {
  distinct += 1;
  const head = `${tag}${distinct}`;
  if (head.length > n) throw new Error(`distinctNameOfLength(${n}): "${head}" already exceeds it.`);
  return `${head}${"a".repeat(n - head.length)}`;
}

/* --------------------- the database each file owns --------------------- */

let current: Scratch | undefined;
let setupFailure: unknown;

/** Records rather than throws — see the header. One scratch database per file; vitest gives
 *  each file its own worker. */
export async function openDatabase(): Promise<void> {
  try {
    current = await scratchDatabase();
  } catch (err) {
    setupFailure = err;
  }
}

/**
 * The scratch database, or this file's setup failure re-raised HERE, inside the cell.
 *
 * A cell that reds because Postgres was unreachable says so and counts as a failure; the same
 * defect left in the hook would have counted as nothing at all.
 */
export function scratch(): Scratch {
  if (setupFailure !== undefined) {
    throw new Error(
      `this file's scratch database could not be created, so the criterion below was never ` +
        `driven. Re-raised in the cell rather than left in \`beforeAll\`, where it would have ` +
        `produced a SKIP and added nothing to the failed-test column.\n` +
        `  ${setupFailure instanceof Error ? setupFailure.message : String(setupFailure)}`,
      { cause: setupFailure },
    );
  }
  if (current === undefined) {
    throw new Error(`\`beforeAll\` has not run, so there is no scratch database to hand back.`);
  }
  return current;
}

/** What the published signatures call `db`: `Db = NodePgDatabase<typeof schema>`. */
export function db(): unknown {
  return scratch().db;
}

/** This file's scratch connection string, for the route half's `getSharedDbClient()`. */
export function databaseUrl(): string {
  return scratch().url;
}

export async function closeDatabase(): Promise<void> {
  await dropScratchDatabases();
  current = undefined;
}

/** Empty the tables this suite writes. `cascade` — nothing else reaches this database. */
export async function clean(): Promise<void> {
  if (setupFailure !== undefined || current === undefined) return;
  await current.query("truncate handle_reservation, bundle, account cascade");
}

/* --------------------- rows T050 and T100 write in production --------------------- */

/**
 * An account with no handle. `account.handle` is nullable and carries `account_handle_key`;
 * Postgres admits any number of NULLs under a unique index, so N handleless accounts coexist.
 *
 * Left null on purpose: T071 allocates into `handle_reservation`, and an account pre-seeded
 * with a handle would make a premise depend on which of the two tables the module reads.
 */
export async function createAccount(): Promise<string> {
  const github = randomUUID();
  const [row] = await scratch().query(
    "insert into account (github_id, github_login) values ($1, $2) returning id",
    [github, `gh-${github.slice(0, 8)}`],
  );
  return row.id as string;
}

export interface ReservationRow {
  handle: string;
  accountId: string | null;
  status: string;
}

/**
 * Every `handle_reservation` row for one handle.
 *
 * An array rather than a row: "nothing was stored" is a claim about how many rows exist as
 * much as about their contents, and a helper returning the first would make zero and one
 * indistinguishable at the call site.
 */
export async function reservationsFor(handle: string): Promise<ReservationRow[]> {
  const rows = await scratch().query(
    "select handle, account_id, status from handle_reservation where handle = $1",
    [handle],
  );
  return rows.map((r) => ({
    handle: r.handle as string,
    accountId: (r.account_id ?? null) as string | null,
    status: r.status as string,
  }));
}

/** Every handle currently in `handle_reservation`, for the "nothing at all was written" half. */
export async function allReservedHandles(): Promise<string[]> {
  const rows = await scratch().query("select handle from handle_reservation order by handle");
  return rows.map((r) => r.handle as string);
}
