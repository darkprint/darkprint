/* ============================================================
   DarkPrint backend — the registry's ordering rules
   Every order this module returns is the one the in-memory index
   already states (`lib/core/archive/registry.ts:48-92`), reproduced
   here because the stored projection is built from rows rather than
   through `buildRegistry`. Kept in one file so thirteen readers
   cannot drift apart on what "sorted" means.
   ============================================================ */

import { compareVersionStrings } from "@/lib/core";
import type { BlueprintKey, BlueprintSummary, CardSummary } from "./types";

/** Code-unit comparison, not `localeCompare` — the order must not depend on the host locale. */
export function cmpString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Freeze in place and hand back the original binding. Nothing a reader returns may be
 * edited by its caller: one snapshot serves every reader in a request, so a caller sorting
 * a result in place would reorder what the next reader hands back.
 */
export function frozen<T>(items: T[]): T[] {
  Object.freeze(items);
  return items;
}

/**
 * Blueprint order: by slug, then by owner handle. Slug leads because that is the order
 * `blueprints()` has always had (AC1 pins "the order the build produces today", and today
 * every seed bundle is under one handle per B-20); the handle is the tiebreak that makes it
 * a total order now that two owners may hold the same slug.
 */
export function cmpBlueprintKeys(a: BlueprintKey, b: BlueprintKey): number {
  const bySlug = cmpString(a.slug, b.slug);
  if (bySlug !== 0) return bySlug;
  return cmpString(a.ownerHandle, b.ownerHandle);
}

export function cmpBlueprints(a: BlueprintSummary, b: BlueprintSummary): number {
  return cmpBlueprintKeys(a, b);
}

/** `cards()` order: id ascending, then version descending so the current one leads. */
export function cmpCards(a: CardSummary, b: CardSummary): number {
  const byId = cmpString(a.id, b.id);
  if (byId !== 0) return byId;
  const byVersion = compareVersionStrings(b.version, a.version);
  if (byVersion !== 0) return byVersion;
  // Equal (or unorderable) versions still need a total order, or two reads of one set
  // could disagree — the defect T010's `listReleases` shipped without a tiebreak for.
  return cmpString(a.ref, b.ref);
}

/**
 * Release order within one bundle: highest semver first, tiebroken on row id (D-80-03).
 * The head is the current release. Matches T020's merged rule — "latest is the highest
 * semver, not the most recent row" — rather than T010's `created_at` ordering.
 */
export function cmpReleasesCurrentFirst(
  a: { version: string; id: string },
  b: { version: string; id: string },
): number {
  const byVersion = compareVersionStrings(b.version, a.version);
  if (byVersion !== 0) return byVersion;
  return cmpString(a.id, b.id);
}
