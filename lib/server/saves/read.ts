/* ============================================================
   DarkPrint backend — saves: the two readers
   AC1's structural half. Both take an `Actor`, both answer a VALUE
   for a caller who may not see the set, and the two values are the
   same ones an owner with an empty set gets.

   **That indistinguishability is the criterion, not a shortcut.**
   B-03 answers 404 over 403 so existence does not leak, and one
   layer down that is a return value rather than a status: *no such
   account*, *not yours* and *yours and empty* have to be one
   answer, or a caller able to tell them apart has the leak back.

   ── D-140-01, and why `0` is the right denial ──
   The block published `countSaves(...): Promise<number>` beside
   prose saying *a visitor gets `undefined`-equivalent behaviour,
   not zero*. Ruled toward the signature, and the prose's stated
   reason — *answering zero for a set you may not see tells the
   caller the set exists* — is **withdrawn**: an owner with no
   saves also gets 0, so the three cases stay indistinguishable and
   B-03 is satisfied rather than violated. What AC1 is actually
   about is answering a non-owner the TRUE count, and that is
   refused here by never running the query.

   **A denied read opens no connection.** The check is a predicate
   evaluated before `withStore`, so nothing reaches the driver —
   which is a stronger statement than "the answer was empty", and
   the one a `Db` proxy can observe. A module that sanitizes its
   rejections cannot use its own error surface as an oracle, so the
   evidence for a refusal has to be that the resource was never
   touched.
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { maySeeSaves } from "./guards";
import { withStore } from "./store";
import type { SaveRecord } from "./types";
import { visibleSaves } from "./visible";

/** Frozen, so a caller cannot mutate the value every denial shares. */
const NO_SAVES: readonly SaveRecord[] = Object.freeze([]);

/**
 * An account's saves, newest first, filtered to what `actor` may see.
 *
 * A save whose target went private or was deleted is omitted and its row survives (AC3).
 */
export async function listSaves(
  db: Db,
  actor: Actor,
  accountId: string,
): Promise<readonly SaveRecord[]> {
  if (!maySeeSaves(actor, accountId)) return NO_SAVES;
  return await withStore("listSaves", async () => await visibleSaves(db, actor, accountId));
}

/**
 * How many saves that same read would return.
 *
 * **Derived from the same filtered query, which is what AC3 requires and why this is not a
 * `COUNT(*)`.** A separate aggregate is the natural way to write a count and it is the one
 * that forgets the filter — it would report the private and deleted targets `listSaves`
 * omits, so an owner would be told a number no listing can produce. Here the two cannot
 * disagree, because there is one query and the count is its length.
 *
 * The cost is stated rather than hidden: this materialises the rows to count them. A save
 * set is a person's bookmarks, so the row count is small by construction, and the criterion
 * asks for agreement rather than for an aggregate.
 */
export async function countSaves(db: Db, actor: Actor, accountId: string): Promise<number> {
  if (!maySeeSaves(actor, accountId)) return 0;
  return await withStore(
    "countSaves",
    async () => (await visibleSaves(db, actor, accountId)).length,
  );
}
