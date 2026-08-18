/* ============================================================
   DarkPrint backend — accounts: the one way this module talks to
   the database
   Two things live here because both have to hold on every path,
   and a rule applied per call site is a rule with a call site
   that forgot it.

   **Every driver fault leaves as `AccountStoreError`, and on this
   task that is AC2 rather than hygiene.** A `DrizzleQueryError`'s
   `message` opens with the statement and every bound parameter
   (D-13) — and on `setEmail` the bound parameter IS the email.
   AC2 says no `email` value appears in any rejection *including
   one about the email*, so an unwrapped fault escaping this module
   makes the criterion false through a path no test of the happy
   case can see. The wrapper carries the operation alone: no
   statement, no parameter, no SQLSTATE. `cause` keeps the
   original for the server log.

   **A decision is never wrapped as a fault.** `changeHandle` calls
   into `@/lib/server/naming` inside a transaction, and that module
   raises `HandleTakenError` for a refused claim and
   `InvalidNameError` for a name the grammar rejects — both are
   answers, and D-50-08 requires the routes to map them to 409 and
   400 with their messages **unaltered**, so that each message
   keeps one author. Swallowing them into a store fault would turn
   both into a 500.
   ============================================================ */

import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { HandleTakenError, InvalidNameError, NamingStoreError } from "@/lib/server/naming";
import { AccountError, accountStoreError } from "./errors";

/**
 * A rejection that is somebody's decision rather than the database failing.
 *
 * `NamingStoreError` is on this list although it *is* a fault: it is already
 * sanitized by the module that raised it, and re-wrapping it would replace a message
 * naming `allocateHandle` with one naming `changeHandle`, moving the operation named
 * in the rendering away from the operation that actually failed.
 */
function isDecision(err: unknown): boolean {
  return (
    err instanceof AccountError ||
    err instanceof HandleTakenError ||
    err instanceof InvalidNameError ||
    err instanceof NamingStoreError
  );
}

/** Runs `work`, letting decisions through and sanitizing everything else. */
export async function withStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isDecision(err)) throw err;
    throw accountStoreError(operation, err);
  }
}

/** The whole row, by id. `undefined` when no such account exists. */
export async function accountRowById(
  db: Db,
  accountId: string,
): Promise<typeof schema.account.$inferSelect | undefined> {
  const [row] = await db.select().from(schema.account).where(eq(schema.account.id, accountId)).limit(1);
  return row;
}

/** The whole row, by handle. `undefined` when no account holds it. */
export async function accountRowByHandle(
  db: Db,
  handle: string,
): Promise<typeof schema.account.$inferSelect | undefined> {
  const [row] = await db.select().from(schema.account).where(eq(schema.account.handle, handle)).limit(1);
  return row;
}
