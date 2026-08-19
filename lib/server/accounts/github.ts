/* ============================================================
   DarkPrint backend — accounts: the GitHub identity
   B-02: GitHub OAuth establishes credentials and the handle is
   chosen separately (B-05), so the OAuth subject and the handle
   are different columns and neither moves the other.

   This is the upsert `app/api/auth/github/callback` used to run
   inline. It moves here rather than staying in the route because
   T050 owns both, the route is now one of five that must agree on
   how a row is reached, and a statement in a route file is a
   statement no other caller can reuse or test.

   **Keyed on `github_id`, never on `github_login`, and that IS
   AC3.** The login is a display value that moves whenever its
   owner renames on GitHub; the id does not. So a rename updates
   `github_login`, leaves `handle` untouched, and every row keyed
   off this account keeps pointing at the same account.

   **AC6 is the unique index, not code.** `account_github_id_key`
   arbitrates, and this is one statement whose conflict it settles
   — of N concurrent callers for one identity, exactly one row
   exists afterwards however many fired. A `SELECT` then `INSERT`
   would pass every sequential test in the suite and fail only
   under concurrency, which is the one thing the criterion exists
   to catch. Same shape, same reason, as T070's AC5.

   **The door on `githubId` is closed (D-50-17), and "the OAuth
   callback can never send that" was the wrong argument.** The
   column is `NOT NULL` and `""` satisfies it, so an empty id is
   storable — and two of them collide on `account_github_id_key`
   as ONE identity, which is AC6 read backwards. The reason it
   sat open for a round is the interesting part: the callback
   supplies these values from `resolveGithubIdentity`, so no
   REQUEST can produce an empty one. **That is a fact about the
   route and not about the barrel.** This module is published to
   twelve tasks that call it in-process, so it has two front doors
   and only one of them is parsed.

   `githubLogin` is deliberately not checked: it carries no unique
   index, so an empty one is a display value nobody can collide
   with, and refusing it would be a bound with no criterion.
   ============================================================ */

import { schema, type Db } from "@/lib/db";
import { AccountStoreError, accountStoreError } from "./errors";

/**
 * Creates the account for a GitHub identity, or refreshes the login of the one that
 * already exists, and answers what a session needs to be minted: the account id, and
 * whether a handle has been chosen yet.
 *
 * `handle` comes back **as stored**, which for a first sign-in is `null`. That is not
 * a shortcut: AC1 rules a session with `handle: null` signed in and incomplete, and
 * `PATCH /api/account/handle` is the one route that accepts one.
 */
export async function upsertFromGitHub(
  db: Db,
  input: { githubId: string; githubLogin: string },
): Promise<{ accountId: string; handle: string | null }> {
  /* Before a connection is opened, like every other door in this module. The form is
     `AccountStoreError`'s because the whitelist is closed and none of the other three
     names a caller's malformed identity; D-50-17 rules that it covers this. */
  if (input.githubId.length === 0) {
    throw accountStoreError("upsertFromGitHub", new Error("githubId is empty"));
  }

  try {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId: input.githubId, githubLogin: input.githubLogin })
      .onConflictDoUpdate({
        target: schema.account.githubId,
        /* `handle` is deliberately absent from this set, and its absence is AC3. The
           login moves; nothing else about the identity does. */
        set: { githubLogin: input.githubLogin, updatedAt: new Date() },
      })
      .returning({ id: schema.account.id, handle: schema.account.handle });

    /* Unreachable through `ON CONFLICT DO UPDATE` with no `setWhere` — every conflict
       updates and every update returns — but reached as a fault rather than as an
       undefined dereference if a later migration adds a predicate that can refuse. */
    if (row === undefined) {
      throw accountStoreError("upsertFromGitHub", new Error("the upsert returned no row"));
    }
    return { accountId: row.id, handle: row.handle };
  } catch (err) {
    if (err instanceof AccountStoreError) throw err;
    /* A database being down must not leave carrying `DrizzleQueryError.message`, which
       opens with the statement and every bound parameter (D-13). */
    throw accountStoreError("upsertFromGitHub", err);
  }
}
