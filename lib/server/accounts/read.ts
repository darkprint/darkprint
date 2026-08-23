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
import { accountRowByHandle, accountRowById, accountRowsByIds, withStore } from "./store";
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
/**
 * Public authors for a set of account ids, in ONE query.
 *
 * D-WAVE-03. `getPublicAuthor` is keyed by HANDLE, and a page of rows carries account
 * ids — so a caller rendering ten authors had two moves and both were bad: ten lookups
 * for handles it does not have, or a second construction of `PublicAuthor` in its own
 * module. That second one is the inline join D-100-01 retired and the two-authors shape
 * this run charges hardest, so the reader is published here instead, where
 * `publicAuthorOf` already lives.
 *
 * Returns a `Map` rather than an array because a caller needs it keyed, and building the
 * index at the call site is where an author gets attached to the wrong row. **An id with
 * no account is ABSENT from the map rather than mapped to `undefined`** — `has` and `get`
 * then answer the same question, and a caller cannot mistake "no such account" for "an
 * account with no fields".
 *
 * A non-string or duplicate id is dropped rather than refused: this is a reader, the ids
 * come from rows the caller already holds, and there is no caller-supplied string here to
 * validate the way a handle is. An empty input short-circuits without touching the driver.
 */
export async function publicAuthorsByIds(
  db: Db,
  ids: readonly string[],
): Promise<Map<string, PublicAuthor>> {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (unique.length === 0) return new Map();
  return await withStore("publicAuthorsByIds", async () => {
    const rows = await accountRowsByIds(db, unique);
    return new Map(rows.map((row) => [row.id, publicAuthorOf(row)]));
  });
}

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

/**
 * The account behind a handle, reduced to the two facts a publish needs: whose row it is,
 * and what visibility that owner publishes at by default.
 *
 * **Added by D-100-01, and it exists because nothing published could answer the question.**
 * `PublishInput` names an owner by handle while `createBundle` takes an `ownerId`, and no
 * export of any `lib/server/*` barrel bridged the two: `getPublicAuthor` returns
 * `PublicAuthor`, whose whole design is to carry nothing owner-only and which therefore has
 * no id (`types.ts`, AC2's structural half); `getAccount` already needs the id; T070's
 * `checkHandle` answers a boolean. The only construction in the tree was an inline join on
 * `schema.account`, spelled twice in `lib/server/registry` (`scores.ts`, `snapshot.ts`), and
 * a third copy at the one door that WRITES through it is a copy worth retiring rather than
 * adding.
 *
 * **No `Actor`, and no `can` call, deliberately.** This is not a read of somebody's account:
 * it is the resolution of a name into the subject an authorization question is then asked
 * ABOUT. Taking an actor here would invite the caller to treat a successful resolve as a
 * grant, and the grant is T060's — `can(actor, "publish", { kind: "bundle", ownerId, ... })`,
 * asked by the caller with what this returns. Everything in the answer is either already
 * public (a handle is how the site addresses an author) or is a default the caller needs to
 * write a row on that account's behalf, and neither is `email`.
 *
 * `defaultVisibility` travels with the id rather than being fetched separately because a
 * publish that omitted a visibility needs it in the same breath and a second round trip
 * would let the two answers come from different moments. A user who set their account to
 * private must not have something published publicly by a default that was not theirs.
 *
 * The grammar guard and the `typeof` guard are `getPublicAuthor`'s, for its reasons
 * unchanged: `handle` is a `text` column, `pg` sends `text` as UTF-8, and an unpaired
 * surrogate reaching the `SELECT` arrives as U+FFFD, so this would answer about a name
 * nobody typed.
 */
export async function resolveOwner(
  db: Db,
  handle: string,
): Promise<{ accountId: string; defaultVisibility: "public" | "private" } | undefined> {
  if (typeof handle !== "string") return undefined;
  if (validateNamespace(handle).length > 0) return undefined;
  return await withStore("resolveOwner", async () => {
    const row = await accountRowByHandle(db, handle);
    return row === undefined ? undefined : { accountId: row.id, defaultVisibility: row.defaultVisibility };
  });
}
