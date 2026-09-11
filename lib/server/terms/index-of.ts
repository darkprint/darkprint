/* ============================================================
   DarkPrint backend — building the usage index

   One pass over the registry's card index, accumulating three
   distinct-sets per term. Nothing here queries Postgres directly:
   the rows come from `cards()`, which is T080's read model, so the
   pin resolution, the current-release rule and the visibility
   filter each have exactly one implementation in this tree.

   ── Why the actor is `anonymous` and not the caller's ──
   AC3 is a correctness constraint on the shared vocabulary rather
   than a privacy nicety (D-82): private blueprints and cards
   contribute to NO count, or the shared vocabulary can be steered
   with content nobody can see. That makes the counts absolute —
   one answer, the same for every reader — where `visibleTo`
   answers `"all"` for an owner and an operator. Passing the
   caller's actor down would give an owner counts inflated by their
   own private cards, which is the number AC3 says nothing may
   move; it would also make two callers disagree about whether a
   term is promotable, and promotion is a property of the archive.

   `cards(db, ANONYMOUS)` is exactly T080's public projection: a
   private bundle is not in the index, a private card is not in the
   index, and `usedIn` is filtered to the blueprints the actor may
   read. Both halves of AC3 are filtered at the source and neither
   is re-implemented here.

   ── Why versions collapse and blueprints do not ──
   The counts are of DISTINCT cards, blueprints and authors (AC2).
   A card is its `id`: a term a card dropped between 1.0.0 and
   1.1.0 still shows the card, because the archive still carries
   the version that names it and a published version is immutable.
   A blueprint is its whole `(ownerHandle, slug)` key: since B-09
   the registry is multi-owner, so counting bare slugs would fold
   `alice/foo` and `bob/foo` into one blueprint and understate
   every threshold. Invisible on today's single-account seed, wrong
   the moment there are two.
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { cards } from "@/lib/server/registry";
import type { BlueprintKey, CardSummary } from "@/lib/server/registry";

import { termIdsOf } from "./sites";
import type { TermUsage } from "./types";

/**
 * The one actor the index is ever built for.
 *
 * Frozen and module-scoped rather than constructed per call, the way `registry/actor.ts`
 * holds its own: it is a constant of this module's reading of AC3, and a caller cannot be
 * handed something it might mutate.
 */
const PUBLIC_ONLY: Actor = Object.freeze({ kind: "anonymous" });

/** What the index answers for a term the archive does not name (AC4). Zero, never absent. */
export function noUsage(termId: string): TermUsage {
  return { termId, cards: 0, blueprints: 0, authors: 0 };
}

interface Draft {
  cards: Set<string>;
  blueprints: Set<string>;
  authors: Set<string>;
}

/**
 * An injective encoding of a two-part blueprint key, used only as a `Set` member.
 *
 * `JSON.stringify` of the pair rather than `` `${ownerHandle}/${slug}` `` because the join
 * is injective by construction and needs no argument about which characters a handle or a
 * slug can hold. It is not `snapshot.ts`'s `keyOf`: that one is a deep path the registry
 * barrel does not publish (D-01), and unlike `keyOf`'s output this string is never
 * rendered, compared against anything outside this file, or counted as anything but a set
 * member — only `Set.size` ever reads it, so the spelling is unobservable.
 */
function keyMember(key: BlueprintKey): string {
  return JSON.stringify([key.ownerHandle, key.slug]);
}

/**
 * The author credited for one card version.
 *
 * **OPEN, reported as T210-02 before a line of this was written and not yet ruled.** The
 * contract publishes `authors: number` and never says whose name it counts. This reads
 * `NodeCard.author`, the card body's own service field, which is what the shipped
 * `termUsageIndex` counts and what the dispatch note points at. The alternative is
 * `card_version.owner_id`, the account — measured against the seeded store, that reading
 * gives every term in the archive exactly ONE author against a `distinctAuthors: 3`
 * threshold, because B-20 puts all seed content under one handle, so AC5's list would be
 * empty for a reason that has nothing to do with the code.
 *
 * The field is optional and the empty string is not a name, so a card with neither credits
 * no author rather than crediting a blank one. Isolated in one function so a ruling the
 * other way is one edit and not a sweep.
 */
function authorOf(row: CardSummary): string | undefined {
  const author = row.card.author;
  return typeof author === "string" && author !== "" ? author : undefined;
}

/**
 * Every term the public archive names, and how much of it names them.
 *
 * Terms absent from the map are named by nothing; `usageOf` answers `noUsage` for those
 * rather than letting the absence reach a caller as `undefined` (AC4). The map holds only
 * terms with a non-zero count, which is what keeps it a projection of the archive rather
 * than of the vocabulary — a term the ontology declares and nobody uses has no row here
 * and is not thereby missing.
 */
export async function buildIndex(db: Db): Promise<ReadonlyMap<string, TermUsage>> {
  const drafts = new Map<string, Draft>();

  for (const row of await cards(db, PUBLIC_ONLY)) {
    const author = authorOf(row);
    for (const termId of termIdsOf(row.card)) {
      let draft = drafts.get(termId);
      if (draft === undefined) {
        draft = { cards: new Set(), blueprints: new Set(), authors: new Set() };
        drafts.set(termId, draft);
      }
      draft.cards.add(row.id);
      for (const key of row.usedIn) draft.blueprints.add(keyMember(key));
      if (author !== undefined) draft.authors.add(author);
    }
  }

  const index = new Map<string, TermUsage>();
  for (const [termId, draft] of drafts) {
    index.set(termId, {
      termId,
      cards: draft.cards.size,
      blueprints: draft.blueprints.size,
      authors: draft.authors.size,
    });
  }
  return index;
}
