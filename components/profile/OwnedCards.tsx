"use client";

import { NodeCardSummary, type NodeSummary } from "@/components/nodes/NodeCardSummary";
import { useQueryState } from "@/components/ui/useQueryState";
import { shelfEmptyMessage } from "./parts";

/* ============================================================
   Your cards: the same grid `/nodes` draws, over the other thing an account holds.

   This used to be its own row list, on the argument that a shelf of tiles reads as "a card
   is something you browse" rather than "something you own." That argument held only as
   long as a card had no private half — true when this was written, false now that the
   author asked for private cards to exist. A private card is a real `card_version` row
   now, the same table a public one lives in (T132), and `NodeCardSummary` itself grew a
   `visibility` field for exactly this row, so one tile still draws both kinds: a public
   card takes its usual appearance, a private one gets the violet border and pill that
   file's own docblock explains.

   `cards` arrives pre-resolved as `NodeSummary[]` — the caller (`components/profile/
   load.ts`) is where `cardsOwnedBy`'s live rows become the one shape this tile draws, so
   this file does not need to know it is reading the registry, only that every entry in the
   list says `visibility` for itself.

   ── What is still lost, from the pre-tile row ──
   The row's owner-only overflow control (`⋯`, disabled, "nothing edits a card") and the
   per-row `usedIn` phrasing ("no blueprint pins it yet") do not have a slot on the tile.
   The control was never wired to anything — `/build` composes a bundle out of existing
   cards, so nothing here was ever going to write one — and `usedIn` is still on the tile as
   the plain "used in N blueprints" line `/nodes` itself prints, real for a private card now
   too: nothing stops the owner's own bundle from pinning their own private card.

   ── The visibility filter, and the find box beside it ──
   Same mechanism as `OwnedBundles`: `useQueryState` reads `?visibility=`, written by the
   same `VisibilityFilter` component, and `?q=`, written by `FindBox` in the toolbar above
   this shelf — no prop passed between either control and the list they narrow.
   ============================================================ */

export function OwnedCards({
  cards,
  owner,
}: {
  cards: readonly NodeSummary[];
  /** Whether the seeded signed-in handle is the one whose shelf this is. */
  owner: boolean;
}) {
  const publicCount = cards.filter((c) => c.visibility !== "private").length;
  const privateCount = cards.length - publicCount;
  const inUse = cards.filter((c) => c.usedIn > 0).length;

  const { params } = useQueryState();
  const visibility = params.get("visibility");
  const query = params.get("q") ?? "";
  const needle = query.trim().toLowerCase();

  const byVisibility =
    visibility === null
      ? cards
      : cards.filter((c) => (c.visibility ?? "public") === visibility);
  const visible =
    needle === ""
      ? byVisibility
      : byVisibility.filter((c) =>
          [c.name, c.action, c.typeLabel, c.ref].some((field) =>
            field.toLowerCase().includes(needle),
          ),
        );

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label-lead">{owner ? "Your cards" : "Published cards"}</h2>
        <span className="font-mono text-[11px] text-dim">
          {owner
            ? `${publicCount} public · ${privateCount} private`
            : `${cards.length} published · ${inUse} in use`}
        </span>
      </div>

      {visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-line bg-surface/40 px-5 py-8 text-center font-mono text-[13px] text-dim">
          {shelfEmptyMessage("cards", visibility, query)}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <NodeCardSummary key={card.ref} node={card} />
        ))}
      </div>

      {/* `The model` panel removed on the owner's instruction, 2026-09-06. It explained that
          a card belongs to an account and is public or private, and then what THIS shelf
          shows, in a branch per reader.

          One sentence went that the owner never saw, and it is named here rather than left
          to be missed: the VISITOR branch disclosed that private cards are never listed on
          this page and that no count on it includes one. The shelf is actor-scoped, so that
          is still true of the code (`ownedCards(db, actor, handle)` returns public rows only
          to a stranger) and it is no longer said. The instruction quoted the two paragraphs
          an owner is shown, which are the two an owner can see; the third went with the
          panel that held it. Nothing asserted it, so nothing red. */}
    </section>
  );
}
