/* ============================================================
   DarkPrint backend — cards(), latestCards(), versionsOf(), card()
   and cardsOwnedBy(), the one card reader outside the pin index
   ============================================================ */

import { eq } from "drizzle-orm";
import { cardRef, parseCardRef } from "@/lib/core";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { CardRef, NodeCard } from "@/lib/server/types";
import type { CardSummary } from "./types";
import { cmpCards, frozen } from "./order";
import { loadSnapshot, readable } from "./snapshot";
import { withRegistryStore } from "./store";

const NONE: readonly CardSummary[] = Object.freeze([]);
/** The `usedIn` of a row no visible blueprint pins. Shared, so it is one frozen array. */
const EMPTY_KEYS = Object.freeze([]) as readonly never[];
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

/**
 * Every card version this handle OWNS that `actor` may read: id ascending, then version
 * descending, the same order `cards()` uses.
 *
 * **The one reader deliberately outside the pin index (D-132-02 C-1, reading (a)).** Every
 * other card reader answers from `loadSnapshot`, which indexes only the versions some
 * current release pins — right for the registry's question, *which cards does this site
 * carry*, and wrong for *which cards does this person own*. The two sets differ by exactly
 * a row nobody pins: a card published and never wired into a blueprint, or one whose only
 * user moved to a newer version. A count built on the index drops those silently, which is
 * why T130's `counts.cards` could not be built on it and why this reader exists.
 *
 * **Ownership is `card_version.owner_id`, not `card.author`.** The body's `author` is
 * optional content the uploader wrote and is not the row's ownership (D-130-04); the column
 * is `NOT NULL` and authoritative. The handle is joined to it rather than compared to the
 * body, so a card whose `author` field says something else is still counted for whoever
 * holds the row.
 *
 * **Visibility is the shared predicate, never a second copy.** `readable()` is the same
 * function `loadSnapshot` applies to bundles and cards, so an owner sees their private rows
 * and a visitor does not, and nothing here decides that question a second time — which is
 * the whole content of D-130-04's prohibition on `lib/server/profiles/**` doing this.
 *
 * **`usedIn` comes from the published join and is `[]` for an unpinned row**, which is a
 * true statement about it: no visible blueprint pins that exact version. The index's own
 * invariant — an indexed card with no users is impossible — is a property of `cards()` and
 * not of the record, and this reader is not `cards()`.
 *
 * Empty for a handle no account holds, for one whose cards are all private to somebody
 * else, and for one that owns none — the same value, for B-03's reason.
 *
 * **Disclosed cost:** it loads a snapshot for the join on top of its own statement, the same
 * trade `usersOf` states in `joins.ts`. A caller reading a profile therefore reads the
 * registry twice, once through `blueprints()` and once here. That is the price of D-130-04
 * paid one more time, and it is written down rather than discovered.
 */
export async function cardsOwnedBy(
  db: Db,
  actor: Actor,
  ownerHandle: string,
): Promise<readonly CardSummary[]> {
  return withRegistryStore("cardsOwnedBy", async () => {
    const rows = (
      await db
        .select({
          cardId: schema.cardVersion.cardId,
          version: schema.cardVersion.version,
          digest: schema.cardVersion.digest,
          body: schema.cardVersion.body,
          ownerId: schema.cardVersion.ownerId,
          visibility: schema.cardVersion.visibility,
        })
        .from(schema.cardVersion)
        .innerJoin(schema.account, eq(schema.account.id, schema.cardVersion.ownerId))
        .where(eq(schema.account.handle, ownerHandle))
    ).filter((row) => readable(actor, row));
    if (rows.length === 0) return NONE;

    /* Read AFTER the rows and only when there are some: a handle owning nothing is the
       common case for a visitor's profile, and it answers without reading the registry. */
    const snapshot = await loadSnapshot(db, actor);
    return frozen(
      rows
        .map((row): CardSummary => {
          const ref = cardRef(row.cardId, row.version);
          return Object.freeze({
            ref,
            id: row.cardId,
            version: row.version,
            digest: row.digest,
            card: row.body as NodeCard,
            // The published join, read for this exact version. `[]` when the index does not
            // hold the row at all, which is what an unpinned card's users are.
            usedIn: snapshot.byRef.get(ref)?.usedIn ?? EMPTY_KEYS,
            // Read straight from the row rather than the snapshot: this is the one reader
            // that returns an owner's own private cards (D-132-04 C-C), so a caller needs to
            // tell them apart from the public rows in the same array.
            visibility: row.visibility,
          });
        })
        .sort(cmpCards),
    );
  });
}

