/* ============================================================
   DarkPrint backend — phases(), cardsByPhase(), tags(), categories()
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { CardSummary } from "./types";
import { loadSnapshot } from "./snapshot";
import { withRegistryStore } from "./store";

/** Frozen and shared: every empty bucket is the same value, and none of them is an error. */
const EMPTY_BUCKET: readonly CardSummary[] = Object.freeze([]);

/**
 * The phases the indexed cards declare, in lifecycle order. Descriptive, never a score
 * (doc 2 §1.1): this is the set of phases that are here, not a fraction of five.
 */
export async function phases(db: Db, actor: Actor): Promise<readonly string[]> {
  return withRegistryStore("phases", async () => (await loadSnapshot(db, actor)).phases);
}

/**
 * Every indexed card declaring `phase`, in `cards()` order. Empty for a phase no card
 * declares — which is a fact about the index and not an error (AC3), and is true of an
 * arbitrary string exactly as it is of one of the five: nothing here checks `phase`
 * against a known set first, so there is no branch where a known phase answers `[]` and an
 * unknown one answers anything else.
 *
 * `phase` reaches the index as a Map key and never reaches the refusal: `withRegistryStore`
 * is given the literal `"cardsByPhase"`, so no caller-supplied string can enter a rendering.
 */
export async function cardsByPhase(db: Db, actor: Actor, phase: string): Promise<readonly CardSummary[]> {
  return withRegistryStore(
    "cardsByPhase",
    async () => (await loadSnapshot(db, actor)).byPhase.get(phase) ?? EMPTY_BUCKET,
  );
}

/** Distinct tags over every blueprint `actor` may read, sorted. */
export async function tags(db: Db, actor: Actor): Promise<readonly string[]> {
  return withRegistryStore("tags", async () => (await loadSnapshot(db, actor)).tags);
}

/** Distinct categories over every blueprint `actor` may read, sorted. */
export async function categories(db: Db, actor: Actor): Promise<readonly string[]> {
  return withRegistryStore("categories", async () => (await loadSnapshot(db, actor)).categories);
}
