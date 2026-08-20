/* ============================================================
   DarkPrint backend — saves: AC3's filter
   "A save whose target went private or was deleted is handled by a
   stated rule and does not break the list." The stated rule is the
   block's: **the row survives and the listing omits it.** Deleting
   the row would make a target that goes private and later public
   again lose a bookmark permanently; a tombstone would tell the
   owner that something exists which they may not see.

   ── Three kinds, and the third asks a DIFFERENT QUESTION ──
   D-140-03, and the asymmetry is deliberate rather than an
   omission:

   * **blueprint** — `bundle` carries `owner_id` and `visibility`,
     so the question is visibility and `visibleTo` answers it.
   * **card** — `card_version` carries both, once PER VERSION, and
     a card is visible when ANY version is. That is the semantics
     `lib/server/registry`'s snapshot already applies to these same
     rows, and T140 must not mint a second one for them.
   * **term** — `ontology_term` has no owner column at all and B-07
     keeps terms public, so there is no visibility question to ask.
     The question is EXISTENCE, and AC3's *deleted* is a term that
     is not in the current ontology version.

   **Cards ask *visible* and terms ask *exists*. Those are
   different predicates and neither reduces to the other.**

   ── Whose actor ──
   **D-140-05: `visibleTo` is given the READING actor, never the
   save's owner.** The two differ for exactly one caller — an
   operator reading somebody else's list containing a save of a
   private target — and an operator seeing a bookmark its owner
   cannot is operator authority working. The alternative would make
   this the one module in the tree where `visibleTo`'s first
   argument is somebody other than the caller.

   ── Why `readable` is re-derived rather than imported ──
   `lib/server/registry/snapshot.ts:54` has the identical
   composition and does NOT publish it: it is internal to that
   module and deep paths are not importable (D-01). D-140-03 rules
   the re-derivation from published `visibleTo`, which is where the
   decision actually lives — so the two agree because they are both
   one line over T060's answer, not because one copied the other.
   ============================================================ */

import { compareVersionStrings } from "@/lib/core";
import type { Db } from "@/lib/db";
import { visibleTo, type Actor } from "@/lib/server/policy";
import {
  bundleRowsIn,
  cardVersionRowsIn,
  ontologyVersionRows,
  saveRowsFor,
  termIdsIn,
} from "./store";
import type { SaveRecord, SaveTargetKind } from "./types";

/**
 * The one visibility predicate, over a row that carries an owner and a visibility.
 *
 * `visibleTo` answers `"all"` for the reading actor when it owns the row and when it is a
 * genuine operator, and `"public"` for everyone else — so an owner sees its private things
 * and a visitor sees only what is public.
 */
function readable(actor: Actor, row: { ownerId: string; visibility: "public" | "private" }): boolean {
  return visibleTo(actor, row.ownerId) === "all" || row.visibility === "public";
}

/**
 * A `bundle.id` is a `uuid` column while `save.target_id` is `text`, so a stored `refId`
 * that is not a well-formed uuid cannot name a bundle — and handing it to the driver
 * raises `22P02` and takes the whole listing down with it.
 *
 * Dropping it here is not a new rule: a refId no bundle can carry is a target that is not
 * there, which is exactly the case AC3 already rules as omitted. So the filter changes
 * which ERROR is possible and never which rows are listed, and no rejection is invented
 * for an input the contract does not refuse on the way in.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The term ids the CURRENT ontology version carries, out of `wanted`. */
async function presentTermIds(db: Db, wanted: readonly string[]): Promise<ReadonlySet<string>> {
  if (wanted.length === 0) return new Set();
  const versions = await ontologyVersionRows(db);
  if (versions.length === 0) return new Set();

  /* "Current" is a total order this repository already defines, and it is by SEMVER rather
     than by insertion time: `compareVersionStrings` is `@/lib/core`'s, published and pure,
     and `getLatestOntologyVersion` picks its maximum the same way. Consumed rather than
     re-derived, so a saved term and the ontology agree about which version is current by
     sharing the comparator instead of by two functions happening to sort alike. */
  const current = versions.reduce((best, row) =>
    compareVersionStrings(row.version, best.version) > 0 ? row : best,
  );
  return new Set(await termIdsIn(db, current.id, wanted));
}

/**
 * An account's saves, filtered to the targets `actor` may see, newest first.
 *
 * **This is the single query `listSaves` and `countSaves` both read**, which is what makes
 * AC3's "the count matches the listing" true by construction rather than by two functions
 * being kept in step. A separate `COUNT(*)` is the defect that criterion exists to catch:
 * it is the natural way to write a count and it forgets the filter.
 *
 * The caller has already decided whether `actor` may read this account's set at all. This
 * function answers the different question of which of its targets survive the filter.
 */
export async function visibleSaves(
  db: Db,
  actor: Actor,
  accountId: string,
): Promise<readonly SaveRecord[]> {
  const rows = await saveRowsFor(db, accountId);
  if (rows.length === 0) return [];

  const refsOf = (kind: SaveTargetKind): string[] => [
    ...new Set(rows.filter((row) => row.targetKind === kind).map((row) => row.targetId)),
  ];

  const bundleRefs = refsOf("blueprint").filter((refId) => UUID.test(refId));
  const cardRefs = refsOf("card");
  const termRefs = refsOf("term");

  const [bundles, cardVersions, terms] = await Promise.all([
    bundleRowsIn(db, bundleRefs),
    cardVersionRowsIn(db, cardRefs),
    presentTermIds(db, termRefs),
  ]);

  const visibleBundles = new Set(
    bundles.filter((row) => readable(actor, row)).map((row) => row.id),
  );
  /* ANY version, per D-140-03: one readable version makes the card visible, so a card whose
     newest release went private stays in a reader's list while an older public version
     still stands. A `Set` built from the readable rows expresses that directly — there is
     no "the card's visibility" to compute, because the rows do not carry one. */
  const visibleCards = new Set(
    cardVersions.filter((row) => readable(actor, row)).map((row) => row.cardId),
  );

  const survives = (kind: SaveTargetKind, refId: string): boolean => {
    switch (kind) {
      case "blueprint":
        return visibleBundles.has(refId);
      case "card":
        return visibleCards.has(refId);
      case "term":
        return terms.has(refId);
      default:
        /* An unreachable kind through the published type, and the honest answer for a row
           whose kind this module does not recognise is that it does not survive: an unknown
           kind cannot be resolved to a target, so it is a target that is not there. */
        return false;
    }
  };

  return rows
    .filter((row) => survives(row.targetKind, row.targetId))
    .map((row) => ({
      targetKind: row.targetKind,
      refId: row.targetId,
      savedAt: row.createdAt,
    }));
}
