/* ============================================================
   DarkPrint backend — accounts: the three field writers
   Every writable field on this task is a scalar, which is why
   T-02 does not apply here (stated in the contract rather than
   assumed): no caller-built object reaches storage, so there is
   no shared substructure for a well-formedness walk to re-expand.
   What does reach storage is read off `patch` one key at a time,
   through `Object.hasOwn`.

   **`Object.hasOwn`, not `in` and not a truthiness test**, for the
   two reasons T060 gives for the same choice: a field that exists
   only on a prototype reads as absent rather than as whatever the
   prototype supplies, and — the half that matters more here — a
   PATCH has to tell "not mentioned" from "explicitly null". Both
   spell `undefined` under a plain read, and they mean opposite
   things: leave the bio alone, or clear it.

   **And a key that IS present carrying `undefined` counts as not
   mentioned, which is the conservative reading and the one the
   published type states.** `displayName?: string | null` says a
   field may be absent (`?`) or explicitly null; `undefined` is the
   first of those, not the second. The two readings differ only for
   an in-process caller — `JSON.parse` cannot produce an
   `undefined` value, so no request can reach this — and they
   differ by DATA LOSS: a later task spreading a partly-built
   object (`{ bio: maybeUndefined }`) would clear a bio nobody
   asked to clear, silently and permanently. Skipping loses a
   caller's bug; clearing loses a user's text.

   **Validation runs after authorization**, so a caller who is not
   the owner never receives feedback about a value they were never
   going to be allowed to set. `guards.ts` states the ordering and
   why.
   ============================================================ */

import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { invalidProfileError, notAccountOwnerError } from "./errors";
import { requireAccountOwner, requireHandle } from "./guards";
import { accountRecordOf } from "./records";
import { accountRowById, withStore } from "./store";
import type { AccountRecord } from "./types";
import {
  isValidAvatarHue,
  isValidBio,
  isValidDisplayName,
  isValidEmail,
  isValidVisibility,
  normalizeEmail,
} from "./validate";

/** The columns any of the three writers may set. Never `patch` itself — see the header. */
type AccountPatch = Partial<typeof schema.account.$inferInsert>;

/**
 * Applies a patch and answers the stored row.
 *
 * `updatedAt` moves on every write and only on a write: an empty patch never reaches
 * here, because a no-op is not a modification and stamping one would make
 * "when did this account last change" answer a question nobody asked.
 */
async function applyPatch(
  operation: string,
  db: Db,
  accountId: string,
  patch: AccountPatch,
): Promise<AccountRecord> {
  return await withStore(operation, async () => {
    const [row] = await db
      .update(schema.account)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.account.id, accountId))
      .returning();

    /* No row means no such account. Unreachable while a session can only name an
       account that existed when the cookie was minted and nothing deletes one — T120
       owns deletion and has not run — and it is the right answer on the day it can:
       an actor cannot be the owner of a row that is not there. Uses a published form
       rather than inventing a fifth. */
    if (row === undefined) throw notAccountOwnerError(operation);
    return accountRecordOf(row);
  });
}

/** The current record, for a write that turned out to have nothing to write. */
async function currentRecord(operation: string, db: Db, accountId: string): Promise<AccountRecord> {
  return await withStore(operation, async () => {
    const row = await accountRowById(db, accountId);
    if (row === undefined) throw notAccountOwnerError(operation);
    return accountRecordOf(row);
  });
}

/**
 * The columns a profile patch asks for, validated. **Pure**, and separated from
 * `updateProfile` for a reason this run has charged before: every rule it applies —
 * absent versus null versus undefined, validate-before-write, an empty patch being a
 * no-op — was otherwise observable only through a database, so a fix to any of them
 * would land unobserved in every environment without one. A pure function is a rule
 * with an in-tree witness.
 *
 * Throws before returning anything, so a patch carrying one good field and one bad one
 * writes NEITHER. That ordering is the whole of it: a module validating as it wrote
 * would store the good field and then refuse, and no assertion on the return value
 * could see it.
 *
 * Not exported from the barrel — it is this module's shape, not its promise.
 */
export function shapeProfilePatch(
  operation: string,
  patch: { displayName?: string | null; bio?: string | null; avatarHue?: number | null },
): AccountPatch {
  /* `Object.hasOwn(null, ...)` is a `TypeError`. A patch that is not an object asked
     for no columns, which is exactly what an empty result means, so it is answered
     rather than refused — no invented rejection form, and nothing is destroyed either
     way, so the disposal rule for ambiguous input does not arise. */
  if (typeof patch !== "object" || patch === null) return {};

  const columns: AccountPatch = {};
  if (Object.hasOwn(patch, "displayName") && patch.displayName !== undefined) {
    const displayName: unknown = patch.displayName;
    if (!isValidDisplayName(displayName)) throw invalidProfileError(operation, "displayName");
    columns.displayName = displayName;
  }
  if (Object.hasOwn(patch, "bio") && patch.bio !== undefined) {
    const bio: unknown = patch.bio;
    if (!isValidBio(bio)) throw invalidProfileError(operation, "bio");
    columns.bio = bio;
  }
  if (Object.hasOwn(patch, "avatarHue") && patch.avatarHue !== undefined) {
    const avatarHue: unknown = patch.avatarHue;
    if (!isValidAvatarHue(avatarHue)) throw invalidProfileError(operation, "avatarHue");
    columns.avatarHue = avatarHue;
  }
  return columns;
}

/**
 * The three fields `/settings`' Public profile section edits (SEAM-44).
 *
 * A key absent from `patch` leaves its column alone; a key present and `null` clears
 * it. An empty patch is a no-op that answers the current record rather than an error
 * — nothing was asked for and nothing failed, and refusing it would make a form that
 * submits an unchanged section look broken.
 */
export async function updateProfile(
  db: Db,
  actor: Actor,
  accountId: string,
  patch: { displayName?: string | null; bio?: string | null; avatarHue?: number | null },
): Promise<AccountRecord> {
  const operation = "updateProfile";
  requireAccountOwner(operation, actor, accountId);
  requireHandle(operation, actor);

  const columns = shapeProfilePatch(operation, patch);
  if (Object.keys(columns).length === 0) return await currentRecord(operation, db, accountId);
  return await applyPatch(operation, db, accountId, columns);
}

/**
 * `null` clears the address. No validity predicate beyond non-empty (D-50-12) and the
 * field is **unverified** — nothing sends a verification, so a regex here would assert
 * a validity nobody establishes and would refuse legal addresses to do it.
 *
 * The rejection names the field and never the value, which is AC2 applied to a
 * rendering rather than to a response body: "no `email` value appears in any
 * rejection, including one *about* the email".
 */
export async function setEmail(
  db: Db,
  actor: Actor,
  accountId: string,
  email: string | null,
): Promise<AccountRecord> {
  const operation = "setEmail";
  requireAccountOwner(operation, actor, accountId);
  requireHandle(operation, actor);
  const value: unknown = email;
  if (!isValidEmail(value)) throw invalidProfileError(operation, "email");
  return await applyPatch(operation, db, accountId, { email: normalizeEmail(value) });
}

/**
 * What a new bundle defaults to (SEAM-48). Checked at runtime although the parameter
 * is typed to two literals: the type is a promise the compiler keeps for TypeScript
 * callers, and the caller that matters is a route holding a parsed JSON body, where
 * the value is whatever was sent.
 */
export async function setDefaultVisibility(
  db: Db,
  actor: Actor,
  accountId: string,
  visibility: "public" | "private",
): Promise<AccountRecord> {
  const operation = "setDefaultVisibility";
  requireAccountOwner(operation, actor, accountId);
  requireHandle(operation, actor);
  if (!isValidVisibility(visibility)) throw invalidProfileError(operation, "visibility");
  return await applyPatch(operation, db, accountId, { defaultVisibility: visibility });
}
