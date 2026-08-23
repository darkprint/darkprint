/* ============================================================
   DarkPrint backend — notes: the parent a note hangs from
   T060 publishes `Resource = { kind: "note"; authorId; parent: {
   ownerId; visibility } }`, so every authorization question about
   a note is asked WITH its parent. This file is where the parent
   comes from, and it authors no rule of its own.

   ── A card has no "visibility" and D-140-03 says so in terms ──
   `card_version` carries an owner and a visibility ONCE PER
   VERSION, and a card is visible when ANY version is. That ruling
   states the consequence directly: **there is no "the card's
   visibility" to compute, because the rows do not carry one.**

   So this file does not compute one. It picks **the row that
   grants the read** — the bundle itself for a blueprint, and for a
   card the first version the reader may see — and hands that row
   to `can` as the parent. Nothing is synthesised: every pair that
   reaches `can` is a pair some row actually holds.

   That choice is what makes the two answers agree by construction
   rather than by being kept in step. `readable` below is one line
   over the published `visibleTo`, which is where D-140-03 rules
   the re-derivation belongs (`lib/server/registry/snapshot.ts` has
   the identical composition and does not publish it; `saves` makes
   it a second time for the same reason). And `canOnNote`'s read
   arm is `parentOwner || parentPublic` over the pair it is given.
   A row that satisfies `readable` satisfies exactly one of those
   two, so a parent found here is a parent `can` grants a read on
   — and when nothing is readable there is no parent to pass and
   the caller denies without asking.

   ── Why the parent is loaded for a WRITE too, where it is unread ──
   `canOnNote`'s `write` and `delete` arms consult `authorId` and
   nothing else, so the parent could be anything. It is loaded and
   real anyway, for two reasons that outlast today's call graph: a
   fabricated pair would be the "the card's visibility" D-140-03
   says does not exist, minted at the one place nobody would look
   for it; and **a reader must be able to see a note's parent
   before acting on the note**, so the load is not overhead — it is
   the gate that stops an author editing their own note under a
   blueprint that went private, and stops an id-walker learning
   which notes exist under one.
   ============================================================ */

import type { Db } from "@/lib/db";
import { visibleTo, type Actor } from "@/lib/server/policy";
import { bundleOwnerRows, cardVersionOwnerRows } from "./store";
import type { NoteTarget } from "./types";

/** The pair `can` takes as a note's parent: some row's own owner and visibility. */
export type NoteParent = { ownerId: string; visibility: "public" | "private" };

/**
 * The one visibility predicate, over a row that carries an owner and a visibility.
 *
 * `visibleTo` answers `"all"` for the reading actor when it owns the row and when it is a
 * genuine operator, and `"public"` for everyone else — so an owner sees its private things
 * and a visitor sees only what is public. Identical to `lib/server/saves/visible.ts`'s, and
 * identical because both are one line over T060's answer rather than because one copied the
 * other (D-140-03).
 */
function readable(actor: Actor, row: NoteParent): boolean {
  return visibleTo(actor, row.ownerId) === "all" || row.visibility === "public";
}

/**
 * The parent row that lets `actor` read this target, or `undefined` if none does.
 *
 * `undefined` covers three cases a caller must not be able to tell apart: the target is
 * private to somebody else, the target does not exist, and the `refId` could never name one.
 * Distinguishing them would name which private blueprints are real, which is the oracle AC1
 * closes at the listing — so the answer, and the refusal built on it, are the same for all
 * three.
 *
 * **The first readable version, for a card.** Which one is unobservable through anything
 * this module publishes: `NoteRecord` carries no parent, and every consumer of the pair asks
 * a question — owner, or public — that every readable row answers the same way. Picking one
 * is how the pair `can` requires gets a value without a card acquiring a visibility it does
 * not have.
 */
export async function parentFor(
  db: Db,
  actor: Actor,
  target: NoteTarget,
): Promise<NoteParent | undefined> {
  const rows =
    target.kind === "blueprint"
      ? await bundleOwnerRows(db, target.refId)
      : await cardVersionOwnerRows(db, target.refId);
  return rows.find((row) => readable(actor, row));
}
