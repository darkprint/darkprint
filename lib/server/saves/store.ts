/* ============================================================
   DarkPrint backend — saves: the one way this module talks to the
   database
   Every published reader and writer goes through `withStore`, so
   what crosses this line is either a value, an ownership decision,
   or a `SaveStoreError` naming the operation. Nothing else leaves.

   ── Why it converts every rejection EXCEPT the one decision ──
   T081's wrapper converts unconditionally, and its argument is
   sound there: a classifier that tries to name "which faults can
   carry the statement" fails OPEN on the clause the wrapper exists
   for, because a rejection raised while a query is in flight may
   come from drizzle, from `pg`, from the socket, or from a driver
   version that has not shipped. That argument is about FAULTS and
   it is inherited here whole.

   What differs is that this module authors a decision (D-140-02),
   so one class must pass through unwrapped, and it is recognised
   by identity rather than by shape. The predicate names one
   imported class and nothing else, so it cannot fail open the way
   a driver-fault classifier would: anything it does not recognise
   is sealed, which is the safe direction.

   ── The already-sealed arm ──
   A sanitizer applied twice does not sanitize twice, it RELABELS —
   it would replace the operation that actually failed with
   whichever one happened to be outermost, so a rendering would
   name a reader that was still working.

   No published function calls another today: `migrateLocalSaves`
   shares `insertSaves` with `saveTarget` rather than calling it,
   deliberately, so the two never nest. The arm is kept anyway
   because the property it protects is about the wrapper rather
   than about today's call graph, and because it is the arm that
   stops the next composition from being wrong silently.
   ============================================================ */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { NotAccountOwnerError } from "@/lib/server/accounts";
import { SaveStoreError } from "./errors";
import type { SaveTarget } from "./types";

/**
 * A rejection that is somebody's decision rather than the database failing.
 *
 * One member, and it is another module's class by ruling (D-140-02). Sealing it would
 * replace "not this account's owner" — an answer a caller can act on — with a store
 * fault, turning a refusal about authority into one about availability.
 */
function isDecision(err: unknown): boolean {
  return err instanceof NotAccountOwnerError;
}

/** Runs `work`, letting the one decision through and sealing everything else. */
export async function withStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isDecision(err)) throw err;
    if (err instanceof SaveStoreError) throw err;
    throw new SaveStoreError(operation, err);
  }
}

/* --------------------- the statements --------------------- */

/**
 * Every save row an account holds, newest first.
 *
 * **D-140-08: `saved_at DESC, target_kind ASC, ref_id ASC`.** Newest-first is what a bookmark
 * list is everywhere in the product, and a tie-break is what stops two rows written in the
 * same instant coming back in an order Postgres is free to vary — an unordered read would
 * make every downstream assertion flaky for a reason nobody could reproduce.
 *
 * **The first version tie-broke on `save.id` and that defeated its own reason.** `id` is
 * `uuid().primaryKey().defaultRandom()`, so rows that tie on `created_at` were ordered by a
 * RANDOM value: not merely unobservable through `SaveRecord`, but arbitrary and unstable
 * between two runs of the same data. A random tie-break is an unordered read with extra
 * steps, for exactly the rows that tie.
 *
 * `(target_kind, ref_id)` is total for the reason that matters: `save_account_target_key` is
 * unique on `(account_id, target_kind, target_id)`, so within one account no two rows tie on
 * all three. **And it is total in terms a caller can compute from the records alone**, which
 * `id` never was — a blind author can predict this order from `SaveRecord`; it could not
 * predict one keyed on a column no published shape carries.
 *
 * **`target_kind` is cast to `text` before sorting, and that is D-140-09 rather than a
 * flourish.** `ORDER BY` on a Postgres enum sorts by DECLARATION order, not alphabetically.
 * `target_kind` is declared `["blueprint", "card", "term"]` (`lib/db/schema.ts:46`), which
 * happens to be alphabetical too — so an uncast sort agrees with the ruled order **today, by
 * coincidence rather than by design**.
 *
 * D-140-09 rules the contract LEXICOGRAPHIC on the string, because that is what a caller can
 * compute from `SaveRecord`, which publishes three fields and no ordinal. The cast makes the
 * module sort the strings the contract names, so **the declaration order stops being
 * load-bearing here at all** — satisfied by construction rather than by a premise.
 *
 * Two reasons the coincidence was not safe to lean on. Measured across all five `pgEnum`s,
 * **three already declare semantically** — `visibility` is `[public, private]`,
 * `target_actor_kind` is `[star, note_vote]`, `actor_kind` is `[owner, operator, system]` —
 * so the house habit is the failure mode and `target_kind` is the exception. And the guard
 * that would catch a member landing out of order lives in `tests/**`, which this module
 * cannot see and may not write: **a dependency and its defence in different files, where
 * deleting the defence leaves the dependency unobserved and nothing reds.**
 *
 * **`saved_at` is truncated to milliseconds before sorting, and that is D-140-11 — the same
 * argument as the cast, one term over.** `save.created_at` is `timestamptz` and carries
 * MICROSECONDS; `SaveRecord.savedAt` is a JS `Date` and carries milliseconds. So an uncast
 * sort orders on precision the published record does not carry: two rows 100 microseconds
 * apart are **tied for every caller and strictly ordered for the store**, and no caller can
 * predict which comes first because the deciding digits never cross. Measured on this
 * column: `2026-08-20 19:17:22.956849+00` reaches a caller as `...956Z`.
 *
 * Truncating makes the sort key exactly the value that crosses, so the tie-break below
 * decides precisely the rows a caller sees as tied — which is what D-140-09's *computable
 * from the published fields* means at the first term rather than the second.
 *
 * It is the same class of gap as the enum ordinal and it was found the same way: by asking
 * what a caller holding only `SaveRecord` could compute. **Neither was reachable through any
 * test that existed** — this one fired in none of the adversary's runs — which is why both
 * are by-construction changes rather than fixes for observed defects.
 *
 * Its own falsification is EMPTY and that is the signature of a by-construction change
 * rather than an objection to one: reverting the cast reds nothing until a member exists out
 * of alphabetical order AND is saved. Nothing here catches a reachable input, and it is not
 * claimed to.
 */
export async function saveRowsFor(
  db: Db,
  accountId: string,
): Promise<readonly (typeof schema.save.$inferSelect)[]> {
  return await db
    .select()
    .from(schema.save)
    .where(eq(schema.save.accountId, accountId))
    .orderBy(
      /* D-140-11: truncated to the millisecond `savedAt` actually carries. */
      desc(sql`date_trunc('milliseconds', ${schema.save.createdAt})`),
      /* D-140-09: lexicographic on the string, never the enum ordinal. */
      asc(sql`${schema.save.targetKind}::text`),
      asc(schema.save.targetId),
    );
}

/**
 * Inserts the targets an account does not already hold, and does nothing about the rest.
 *
 * **`ON CONFLICT DO NOTHING` against `save_account_target_key`, never select-then-insert.**
 * T005's own suite states why and holds the discriminating fact: both shapes see one row
 * when a single caller saves twice, so nothing in this task's tests can tell them apart —
 * and under two concurrent callers the select-then-insert is wrong. The constraint is what
 * enforces AC2; this statement is what defers to it.
 *
 * The input is de-duplicated first. Two identical targets inside one `VALUES` list conflict
 * with each other rather than with a stored row, and that is a property of the statement
 * rather than of the constraint — deduplicating in process makes the answer the same
 * whatever the driver does with a self-conflict, which is one fewer thing resting on a
 * behaviour nobody here measured.
 *
 * An empty list returns before a statement is built: drizzle refuses an empty `values()`,
 * so this guard is what makes "migrate nothing" mean nothing rather than a store fault.
 */
export async function insertSaves(
  db: Db,
  accountId: string,
  targets: readonly SaveTarget[],
): Promise<void> {
  const seen = new Set<string>();
  const rows: (typeof schema.save.$inferInsert)[] = [];
  for (const target of targets) {
    /* A separator that cannot occur in a kind, so no two distinct targets collide into one
       key. The kind is one of three literals and none contains a space. */
    const key = `${target.kind} ${target.refId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ accountId, targetKind: target.kind, targetId: target.refId });
  }
  if (rows.length === 0) return;

  await db.insert(schema.save).values(rows).onConflictDoNothing({
    target: [schema.save.accountId, schema.save.targetKind, schema.save.targetId],
  });
}

/**
 * Removes one target from an account's set. Removing what is not there is not an error —
 * AC2's idempotence read in the other direction, and the same answer either way.
 *
 * Keyed on all three columns rather than on the row id: the id is not something a caller
 * holds, and `(account, kind, refId)` is the identity the unique index already declares.
 */
export async function deleteSave(db: Db, accountId: string, target: SaveTarget): Promise<void> {
  await db
    .delete(schema.save)
    .where(
      and(
        eq(schema.save.accountId, accountId),
        eq(schema.save.targetKind, target.kind),
        eq(schema.save.targetId, target.refId),
      ),
    );
}

/* --------------------- what the AC3 filter reads --------------------- */

/** `(id, ownerId, visibility)` for the bundles among `ids`. */
export async function bundleRowsIn(
  db: Db,
  ids: readonly string[],
): Promise<readonly { id: string; ownerId: string; visibility: "public" | "private" }[]> {
  if (ids.length === 0) return [];
  return await db
    .select({
      id: schema.bundle.id,
      ownerId: schema.bundle.ownerId,
      visibility: schema.bundle.visibility,
    })
    .from(schema.bundle)
    .where(inArray(schema.bundle.id, [...ids]));
}

/**
 * `(cardId, ownerId, visibility)` for every VERSION of the cards among `cardIds`.
 *
 * Every version, not the latest: D-140-03 rules a card visible when any version is, which
 * is the semantics `lib/server/registry`'s snapshot already applies to these same rows.
 */
export async function cardVersionRowsIn(
  db: Db,
  cardIds: readonly string[],
): Promise<readonly { cardId: string; ownerId: string; visibility: "public" | "private" }[]> {
  if (cardIds.length === 0) return [];
  return await db
    .select({
      cardId: schema.cardVersion.cardId,
      ownerId: schema.cardVersion.ownerId,
      visibility: schema.cardVersion.visibility,
    })
    .from(schema.cardVersion)
    .where(inArray(schema.cardVersion.cardId, [...cardIds]));
}

/** Every `(id, version)` the ontology has published. The caller picks the current one. */
export async function ontologyVersionRows(
  db: Db,
): Promise<readonly { id: string; version: string }[]> {
  return await db
    .select({ id: schema.ontologyVersion.id, version: schema.ontologyVersion.version })
    .from(schema.ontologyVersion);
}

/** Which of `termIds` exist in one ontology version. */
export async function termIdsIn(
  db: Db,
  ontologyVersionId: string,
  termIds: readonly string[],
): Promise<readonly string[]> {
  if (termIds.length === 0) return [];
  const rows = await db
    .select({ termId: schema.ontologyTerm.termId })
    .from(schema.ontologyTerm)
    .where(
      and(
        eq(schema.ontologyTerm.ontologyVersionId, ontologyVersionId),
        inArray(schema.ontologyTerm.termId, [...termIds]),
      ),
    );
  return rows.map((row) => row.termId);
}
