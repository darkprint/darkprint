/* ============================================================
   DarkPrint backend — cards(), latestCards(), versionsOf(), card()
   ============================================================ */

import { cardRef, parseCardRef } from "@/lib/core";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { CardRef } from "@/lib/server/types";
import type { CardSummary } from "./types";
import { loadSnapshot } from "./snapshot";
import { withRegistryStore } from "./store";

const NONE: readonly CardSummary[] = Object.freeze([]);

/** Every indexed card version `actor` may read: id ascending, then version descending. */
export async function cards(db: Db, actor: Actor): Promise<readonly CardSummary[]> {
  return withRegistryStore("cards", async () => (await loadSnapshot(db, actor)).cards);
}

/** The newest version of every distinct card id, sorted by id. */
export async function latestCards(db: Db, actor: Actor): Promise<readonly CardSummary[]> {
  return withRegistryStore("latestCards", async () => (await loadSnapshot(db, actor)).latest);
}

/**
 * Every indexed version of one card id, newest first. Empty for an id nothing pins and for
 * one whose every version is private to somebody else — the same value, for B-03's reason.
 */
export async function versionsOf(db: Db, actor: Actor, cardId: string): Promise<readonly CardSummary[]> {
  return withRegistryStore(
    "versionsOf",
    async () => (await loadSnapshot(db, actor)).byId.get(cardId) ?? NONE,
  );
}

/**
 * One card version by ref, or `undefined`. The lookup is on the canonical `id@version`
 * spelling, so a ref that arrives padded (`parseCardRef` trims) still finds its row, and a
 * ref that is not a pinned reference at all — unversioned, malformed, `solver-a@latest` —
 * is `undefined` rather than a scan.
 *
 * Note where the short-circuit sits relative to the store: an unparseable ref answers
 * `undefined` WITHOUT reaching Postgres, so a probe driving this reader with a ref that
 * does not parse never reaches the driver and measures nothing about the fault path. It is
 * inside the wrapper all the same, because the boundary is the reader's body rather than
 * the query — see `store.ts`.
 */
export async function card(db: Db, actor: Actor, ref: CardRef): Promise<CardSummary | undefined> {
  return withRegistryStore("card", async () => {
    const parsed = parseCardRef(ref);
    if (parsed === undefined) return undefined;
    return (await loadSnapshot(db, actor)).byRef.get(cardRef(parsed.id, parsed.version));
  });
}
