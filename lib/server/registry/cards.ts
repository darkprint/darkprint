/* ============================================================
   DarkPrint backend — cards(), latestCards(), versionsOf(), card()
   ============================================================ */

import { cardRef, parseCardRef } from "@/lib/core";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { CardRef } from "@/lib/server/types";
import type { CardSummary } from "./types";
import { loadSnapshot } from "./snapshot";

const NONE: readonly CardSummary[] = Object.freeze([]);

/** Every indexed card version `actor` may read: id ascending, then version descending. */
export async function cards(db: Db, actor: Actor): Promise<readonly CardSummary[]> {
  return (await loadSnapshot(db, actor)).cards;
}

/** The newest version of every distinct card id, sorted by id. */
export async function latestCards(db: Db, actor: Actor): Promise<readonly CardSummary[]> {
  return (await loadSnapshot(db, actor)).latest;
}

/**
 * Every indexed version of one card id, newest first. Empty for an id nothing pins and for
 * one whose every version is private to somebody else — the same value, for B-03's reason.
 */
export async function versionsOf(db: Db, actor: Actor, cardId: string): Promise<readonly CardSummary[]> {
  return (await loadSnapshot(db, actor)).byId.get(cardId) ?? NONE;
}

/**
 * One card version by ref, or `undefined`. The lookup is on the canonical `id@version`
 * spelling, so a ref that arrives padded (`parseCardRef` trims) still finds its row, and a
 * ref that is not a pinned reference at all — unversioned, malformed, `solver-a@latest` —
 * is `undefined` rather than a scan.
 */
export async function card(db: Db, actor: Actor, ref: CardRef): Promise<CardSummary | undefined> {
  const parsed = parseCardRef(ref);
  if (parsed === undefined) return undefined;
  return (await loadSnapshot(db, actor)).byRef.get(cardRef(parsed.id, parsed.version));
}
