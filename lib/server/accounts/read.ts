/* ============================================================
   DarkPrint backend — accounts: the two readers
   AC2's structural half. `getAccount` is the only function in the
   module that can return an `email`, it takes an `Actor`, and it
   answers `undefined` rather than throwing when that actor may not
   read the row — so "not yours" and "no such account" are one
   value, and the route maps it. B-03's rule about 404 over 403,
   applied one layer down where it is a return value rather than a
   status.
   ============================================================ */

import { can, type Actor } from "@/lib/server/policy";
import { validateNamespace } from "@/lib/server/naming";
import type { Db } from "@/lib/db";
import { accountRecordOf, publicAuthorOf } from "./records";
import { accountRowByHandle, accountRowById, withStore } from "./store";
import type { AccountRecord, PublicAuthor } from "./types";

/**
 * The owner's own record, or `undefined`.
 *
 * No handle-required check: reading your own row is exactly what an account with an
 * unfinished sign-up needs to do, and AC1 makes that state legal rather than broken.
 */
export async function getAccount(
  db: Db,
  actor: Actor,
  accountId: string,
): Promise<AccountRecord | undefined> {
  if (!can(actor, "read", { kind: "account", accountId })) return undefined;
  return await withStore("getAccount", async () => {
    const row = await accountRowById(db, accountId);
    return row === undefined ? undefined : accountRecordOf(row);
  });
}

/**
 * The public shape behind a handle, or `undefined`. No `Actor`, because there is
 * nothing here a visitor may not see — that is what `PublicAuthor` having no `email`
 * field means.
 *
 * The grammar is checked before the driver, and the predicate is **derived rather
 * than restated**: `validateNamespace` is T070's published pure validator over
 * `isNameSegment`, and a handle is a namespace (D-70-04). So a tightening there is a
 * tightening here for free — which matters now, because T071 narrows the handle bound
 * to 32 characters in that same file and nothing in this module names a length.
 *
 * Why check at all, when the answer for an illegal handle is `undefined` either way:
 * `handle` is a `text` column and `pg` sends `text` as UTF-8, so an unpaired
 * surrogate reaching the `SELECT` arrives as U+FFFD and this function would answer
 * about a name nobody typed. T070's argument, at the one other door into the same
 * column.
 */
export async function getPublicAuthor(db: Db, handle: string): Promise<PublicAuthor | undefined> {
  /* `typeof` first, and the reason is the two-front-doors rule rather than paranoia:
     `validateNamespace` reaches `isNameSegment`, which reads `.length` off its argument
     — total for a string and a `TypeError` for `null`. No route can send one, since a
     handle arrives as a path segment or a checked JSON field; T130 and T262 call this
     in-process and can. A handle that is not a string is held by nobody, which is what
     `undefined` already means here, so no new rejection is invented for it. */
  if (typeof handle !== "string") return undefined;
  if (validateNamespace(handle).length > 0) return undefined;
  return await withStore("getPublicAuthor", async () => {
    const row = await accountRowByHandle(db, handle);
    return row === undefined ? undefined : publicAuthorOf(row);
  });
}
