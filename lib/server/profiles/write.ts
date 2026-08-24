/* ============================================================
   DarkPrint backend — the five write verbs T131 publishes

   `setPins`, `toggleFollow`, `toggleSupport`, and D-131-10's
   `setFollow`/`setSupport`. T130 published a reader and nothing
   else; these are the first writes this module has ever had, which
   is why `errors.ts` grew its first refusal class beside them.

   ── the two authorization questions are DIFFERENT, and so are
      their answers ──
   A pin is an edit TO an account: `setPins` therefore asks
   `can(actor, "write", { kind: "account", accountId })`, T060's
   merged predicate, which grants the owner and grants a genuine
   operator (D-131-07 — the refusal sentences say "owner" because
   that is the common case, not because it is the policy). A follow
   and a support are acts BY an account, so those two ask only who
   is acting; there is no resource whose ownership is in question,
   and inventing one would be a second copy of a decision T060 owns.

   Neither question is answered with an `if` over `actor.kind` and
   an id comparison. That comparison IS `can`, one module over,
   already ruled and already tested.

   ── FOUR verbs over two relations, and the pairing is D-131-10 ──
   `toggleFollow`/`toggleSupport` FLIP: that is the UI's own
   semantics (one button, one meaning) and it is what the inherited
   T130 cells drive. `setFollow`/`setSupport` REACH a state and are
   idempotent by construction, because POST and DELETE are, and no
   HTTP retry is safe against a toggling POST.

   The set-verbs exist because the routes could not be built
   correctly without them. This module published only toggles, and
   nothing published answers "does this caller already follow?"
   BEFORE a write -- `followedByCaller` arrives after the flip -- so
   an idempotent route had to flip, look, and flip back. That kept
   the criterion and cost a second write and a real window where
   the row is gone and a concurrent `getProfile` reads a `watchers`
   one lower than it was before and after. One statement plus the
   count replaces both.

   ── why a toggle is a DELETE-then-INSERT inside a transaction ──
   T150's own recorded trap: a `SELECT`-then-`INSERT` passes every
   sequential test and loses under two callers. `DELETE ...
   RETURNING` answers "was there a row?" and removes it in one
   statement, so the read and the decision cannot be separated by
   another caller's write. The insert that follows carries
   `onConflictDoNothing`, so the losing side of a genuine race ends
   in the same state rather than raising 23505 at a caller who did
   nothing wrong. The unique index is what makes both true; this
   code cannot provide idempotency on its own and does not try.
   ============================================================ */

import { and, eq } from "drizzle-orm";
import type { PinnedRef } from "@/lib/data/profiles";
import { can, type Actor } from "@/lib/server/policy";
import { schema, type Db } from "@/lib/db";

import { malformedPin, noSuchAccount, notSignedIn, tooManyPins } from "./errors";
import { getProfile } from "./read";
import { countSupport, countWatchers } from "./social";
import { withProfileStore } from "./store";
import type { ProfileRecord } from "./types";

/**
 * AC3's published bound: "at most two, which is what the two-column grid holds".
 *
 * A constant rather than a literal at the two sites that need it, so the check and the
 * refusal's own sentence cannot drift apart. **It is enforced HERE and not in the DDL**, and
 * that is deliberate (D-131-08): a `CHECK` on `profile_pin.position` would make this refusal
 * unfalsifiable — strip the guard below and the driver answers first, turning a refusal into
 * a store fault and leaving a cell that pins the refusal measuring the database instead.
 */
const MAX_PINS = 2;

/** The acting account, or a refusal. Both `account` and `operator` carry one (T060's `Actor`). */
function actingAccountId(operation: string, actor: Actor): string {
  if (typeof actor !== "object" || actor === null) throw notSignedIn(operation);
  if (actor.kind === "account" || actor.kind === "operator") return actor.accountId;
  throw notSignedIn(operation);
}

/**
 * `pins` as the union, or a refusal — the ONLY validation `setPins` performs beyond arity.
 *
 * **It checks the shape and nothing about the world** (D-131-04, A7). Whether a slug names a
 * bundle, whether a ref names a card version, whether either is visible to anybody: none of
 * that is asked here, and asking it would remove the reader's witnesses. AC3's fixture is a
 * pin whose target is deleted AFTERWARDS, and a store that refuses an unresolvable pin has
 * no such pin to delete out from under. Resolution lives in `getProfile`, per actor.
 *
 * `Object.hasOwn` rather than `in` or a bare property read, on T060's 2026-08-14 ruling:
 * a field that exists only on a prototype reads as absent rather than as whatever the
 * prototype supplies, so a caller cannot smuggle a `kind` through `Object.create`.
 */
function validPin(value: unknown): PinnedRef | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  if (!Object.hasOwn(value, "kind")) return undefined;
  const kind = (value as Record<string, unknown>).kind;
  if (kind === "blueprint") {
    if (!Object.hasOwn(value, "slug")) return undefined;
    const slug = (value as Record<string, unknown>).slug;
    return typeof slug === "string" && slug.length > 0 ? { kind: "blueprint", slug } : undefined;
  }
  if (kind === "node") {
    if (!Object.hasOwn(value, "ref")) return undefined;
    const ref = (value as Record<string, unknown>).ref;
    return typeof ref === "string" && ref.length > 0 ? { kind: "node", ref } : undefined;
  }
  return undefined;
}

/**
 * Replace `accountId`'s pins with `pins`, and answer the profile as `actor` now sees it.
 *
 * **A REPLACEMENT, not an append.** The stored set is exactly what the caller sent, in the
 * order the caller sent it — `position` carries that order, because `pinned` is an array
 * whose first entry is the first card drawn. An empty array clears the pins and is a legal
 * call rather than a refusal: "at most two" has no floor.
 *
 * **The whole write is one transaction**, so a caller never observes an account with the old
 * pins deleted and the new ones not yet written. Two concurrent `setPins` for one account
 * serialise on the unique index rather than interleaving into a mixed set.
 *
 * Returns `ProfileRecord` — the block's own shape, so a caller that just wrote gets the
 * resolved, actor-filtered read back without a second round trip. That read runs AFTER the
 * transaction commits: inside it, the pins would be visible to this transaction and to
 * nobody else, and the record would describe a state no other caller could see.
 */
export async function setPins(
  db: Db,
  actor: Actor,
  accountId: string,
  pins: readonly PinnedRef[],
): Promise<ProfileRecord> {
  /* For the refusal, not for the id — `can` below makes the ownership comparison and this
     function has no use for the acting account otherwise. It runs FIRST so that an
     unidentified caller is told it is not signed in rather than that the account does not
     exist: both are refusals, but only one of them is true of an account that is sitting
     right there. Unreachable through HTTP either way, `withSession` answering 401 before
     the verb is entered; it is a direct caller that gets the difference. */
  actingAccountId("setPins", actor);

  if (pins.length > MAX_PINS) throw tooManyPins("setPins", MAX_PINS);
  const validated = pins.map((pin) => {
    const ok = validPin(pin);
    if (ok === undefined) throw malformedPin("setPins", pin);
    return ok;
  });

  /* T060's predicate, consumed. `can` grants the account itself and a genuine operator, and
     refuses everybody else — including an actor tagged `operator` with no `accountId`, which
     `isOperator` treats as unidentified rather than as authority. */
  if (!can(actor, "write", { kind: "account", accountId })) throw noSuchAccount("setPins");

  const handle = await withProfileStore("setPins", async () => {
    const [row] = await db
      .select({ handle: schema.account.handle })
      .from(schema.account)
      .where(eq(schema.account.id, accountId))
      .limit(1);
    if (row === undefined || row.handle === null) return undefined;

    await db.transaction(async (tx) => {
      await tx.delete(schema.profilePin).where(eq(schema.profilePin.accountId, accountId));
      if (validated.length > 0) {
        await tx.insert(schema.profilePin).values(
          validated.map((pin, position) => ({
            accountId,
            position,
            kind: pin.kind,
            ref: pin.kind === "blueprint" ? pin.slug : pin.ref,
          })),
        );
      }
    });
    return row.handle;
  });

  /* An account with no handle has no profile page, and "no handle" and "no account" are one
     answer to a caller (B-03). Checked after the id read rather than before, because the id
     is what `can` just decided about. */
  if (handle === undefined) throw noSuchAccount("setPins");

  const record = await getProfile(db, actor, handle);
  /* The account was there a statement ago and is not now — a rename or a deletion landed
     between the write and the read. The same answer, for `read.ts`'s own reason. */
  if (record === undefined) throw noSuchAccount("setPins");
  return record;
}

/** The account behind a handle, or `undefined` — one answer for absent and handle-less. */
async function accountIdFor(db: Db, handle: string): Promise<string | undefined> {
  const [row] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(eq(schema.account.handle, handle))
    .limit(1);
  return row?.id;
}

/**
 * Follow `handle` if the caller does not, unfollow if they do (AC4).
 *
 * **A flip, and the count that comes back is DERIVED from the rows in the same transaction**
 * — never a counter incremented beside them. That is AC4's own sentence: "the watcher count
 * equals the follower count" is a consistency criterion between two things that could
 * drift, so there is only ever one of them.
 *
 * **Following yourself is not refused**, and that is a decision rather than an oversight:
 * nothing in the published contract forbids it, and a refusal this module invented would be
 * behaviour no blind author could have bound to. Reported upward rather than assumed.
 */
export async function toggleFollow(
  db: Db,
  actor: Actor,
  handle: string,
): Promise<{ watchers: number; followedByCaller: boolean }> {
  const follower = actingAccountId("toggleFollow", actor);

  const answer = await withProfileStore("toggleFollow", async () => {
    const followed = await accountIdFor(db, handle);
    if (followed === undefined) return undefined;

    return await db.transaction(async (tx) => {
      const removed = await tx
        .delete(schema.follow)
        .where(
          and(eq(schema.follow.followerId, follower), eq(schema.follow.followedId, followed)),
        )
        .returning({ id: schema.follow.id });

      if (removed.length === 0) {
        await tx
          .insert(schema.follow)
          .values({ followerId: follower, followedId: followed })
          .onConflictDoNothing();
      }

      return {
        watchers: await countWatchers(tx, followed),
        followedByCaller: removed.length === 0,
      };
    });
  });

  if (answer === undefined) throw noSuchAccount("toggleFollow");
  return answer;
}

/**
 * Reach `following` for the caller, whatever the current state (D-131-10).
 *
 * **Idempotent BY CONSTRUCTION rather than by checking first.** `following: true` is one
 * `INSERT … ON CONFLICT DO NOTHING` and `following: false` is one `DELETE`, and both are
 * already no-ops when the state is what was asked for. Nothing reads the row before writing
 * it, so there is no read-then-decide for a second caller to interleave with, and the count
 * is taken in the same transaction as the write it describes.
 *
 * **`followedByCaller` is `following` and is not re-read.** Inside this transaction the
 * statement above has run, so the answer is known; re-reading it would be a second question
 * with the same answer and a chance to disagree with itself.
 *
 * The `onConflictDoNothing` is doing real work rather than guarding a case that cannot
 * happen: without it, two concurrent follows raise 23505 at whichever caller loses, and that
 * caller did nothing wrong — the unique index is the idempotency guarantee, and this is the
 * clause that lets a caller benefit from it instead of being refused by it.
 */
export async function setFollow(
  db: Db,
  actor: Actor,
  handle: string,
  following: boolean,
): Promise<{ watchers: number; followedByCaller: boolean }> {
  const follower = actingAccountId("setFollow", actor);

  const answer = await withProfileStore("setFollow", async () => {
    const followed = await accountIdFor(db, handle);
    if (followed === undefined) return undefined;

    return await db.transaction(async (tx) => {
      if (following) {
        await tx
          .insert(schema.follow)
          .values({ followerId: follower, followedId: followed })
          .onConflictDoNothing();
      } else {
        await tx
          .delete(schema.follow)
          .where(
            and(eq(schema.follow.followerId, follower), eq(schema.follow.followedId, followed)),
          );
      }
      return { watchers: await countWatchers(tx, followed), followedByCaller: following };
    });
  });

  if (answer === undefined) throw noSuchAccount("setFollow");
  return answer;
}

/**
 * Endorse `handle` if the caller does not, withdraw it if they do (D-131-05).
 *
 * The same shape as `toggleFollow` and deliberately so — one row per supporter, count
 * derived, flip inside a transaction. The two are separate tables rather than one table with
 * a kind column because they are separate relations that happen to share a shape: a follow
 * is a subscription and a support is an endorsement, and a shared `kind` column is what would
 * let a bug in one arrive as rows in the other.
 */
export async function toggleSupport(
  db: Db,
  actor: Actor,
  handle: string,
): Promise<{ support: number; supportedByCaller: boolean }> {
  const supporter = actingAccountId("toggleSupport", actor);

  const answer = await withProfileStore("toggleSupport", async () => {
    const supported = await accountIdFor(db, handle);
    if (supported === undefined) return undefined;

    return await db.transaction(async (tx) => {
      const removed = await tx
        .delete(schema.accountSupport)
        .where(
          and(
            eq(schema.accountSupport.supporterId, supporter),
            eq(schema.accountSupport.supportedId, supported),
          ),
        )
        .returning({ id: schema.accountSupport.id });

      if (removed.length === 0) {
        await tx
          .insert(schema.accountSupport)
          .values({ supporterId: supporter, supportedId: supported })
          .onConflictDoNothing();
      }

      return {
        support: await countSupport(tx, supported),
        supportedByCaller: removed.length === 0,
      };
    });
  });

  if (answer === undefined) throw noSuchAccount("toggleSupport");
  return answer;
}

/**
 * Reach `supporting` for the caller, whatever the current state (D-131-10).
 *
 * `setFollow`'s shape and `setFollow`'s reasons, over the endorsement relation. Written out
 * rather than folded into one generic over a table: the two relations name their columns
 * differently, and a helper parameterised over column references buys four lines and costs
 * every reader the indirection.
 */
export async function setSupport(
  db: Db,
  actor: Actor,
  handle: string,
  supporting: boolean,
): Promise<{ support: number; supportedByCaller: boolean }> {
  const supporter = actingAccountId("setSupport", actor);

  const answer = await withProfileStore("setSupport", async () => {
    const supported = await accountIdFor(db, handle);
    if (supported === undefined) return undefined;

    return await db.transaction(async (tx) => {
      if (supporting) {
        await tx
          .insert(schema.accountSupport)
          .values({ supporterId: supporter, supportedId: supported })
          .onConflictDoNothing();
      } else {
        await tx
          .delete(schema.accountSupport)
          .where(
            and(
              eq(schema.accountSupport.supporterId, supporter),
              eq(schema.accountSupport.supportedId, supported),
            ),
          );
      }
      return { support: await countSupport(tx, supported), supportedByCaller: supporting };
    });
  });

  if (answer === undefined) throw noSuchAccount("setSupport");
  return answer;
}
