/* ============================================================
   DarkPrint backend — blueprints() and blueprint()
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { BlueprintSummary } from "./types";
import { keyOf, loadSnapshot } from "./snapshot";
import { withRegistryStore } from "./store";

/** Every blueprint `actor` may read, by slug then owner handle. */
export async function blueprints(db: Db, actor: Actor): Promise<readonly BlueprintSummary[]> {
  return withRegistryStore("blueprints", async () => (await loadSnapshot(db, actor)).blueprints);
}

/**
 * One blueprint by its two-part key (B-09), or `undefined` — for a key nothing holds and
 * for one the caller may not see alike. The two answers are deliberately the same value:
 * B-03 returns 404 rather than 403 so existence does not leak, and a caller able to tell
 * "no such bundle" from "not yours" has the leak back whatever the status code says.
 *
 * `undefined` is a value and not a refusal, which is why nothing here throws and why this
 * module publishes no decision for `withRegistryStore` to pass through (D-13, `errors.ts`).
 */
export async function blueprint(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
): Promise<BlueprintSummary | undefined> {
  return withRegistryStore("blueprint", async () =>
    (await loadSnapshot(db, actor)).byKey.get(keyOf({ ownerHandle, slug })),
  );
}
