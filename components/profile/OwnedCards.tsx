import Link from "next/link";

import { HUMAN_PRESENCE_MARK } from "@/lib/format";
import { nodeHref } from "@/lib/href";
import { Button } from "@/components/ui/Button";
import { MetaPill } from "@/components/ui/MetaPill";
import type { NodeTile } from "./load";
import { SupportPill } from "./parts";

/* ============================================================
   Your cards: the same panel `OwnedBundles` draws, over the other thing an account holds.

   The two owner lists on this profile are the same object at two scales, so they are the
   same shape: one bordered panel, one row per item, a header that says how many and a note
   at the foot that says which half of a row is counted and which is seeded. A shelf of
   tiles said the opposite, that a card is something you browse rather than something you
   own, which is exactly the reading the blueprints tab spent this pass correcting.

   ── What this list is made of ──
   Every row is a document in `content/cards/`, joined to this handle by the `author:`
   field inside its own bytes. There is no private half: a card is in the archive or it
   does not exist, which is why the header counts once where the blueprint header counts
   public and private apart. `/settings` says a rename keeps the old handle reserved for
   this reason, the join is the published document rather than a table somebody can edit.

   ── The one control, and why it is switched off ──
   Nothing on this site writes a card. `/build` composes a bundle out of cards that already
   exist, so a New card button would be the first control on the profile whose destination
   does not exist at all. The row keeps the overflow affordance the blueprint row has, drawn
   and disabled with the reason in its title, and that is the whole owner surface.
   ============================================================ */

/** One authored card, as its owner's row rather than as a gallery tile. */
function Row({ tile }: { tile: NodeTile }) {
  const { record, typeLabel, usedIn, support } = tile;
  const { card } = record;

  return (
    <div className="flex flex-col gap-5 border-b border-line p-5 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={nodeHref(record.id)}
            className="font-display text-lg font-semibold text-cyan transition-colors hoverable:hover:text-cyan-bright"
          >
            {card.name}
          </Link>
          <MetaPill tone="surface">{typeLabel}</MetaPill>
          <MetaPill>v{record.version}</MetaPill>
          {/* Violet, from `HUMAN_PRESENCE_MARK`, like every other row on the site that says
              where a person acts. Doc 2 §1.1: an author's own shelf is the last place a
              human node should be marked in the colour reserved for defects. */}
          {card.requiresHuman && (
            <span className={`font-mono text-[11px] ${HUMAN_PRESENCE_MARK.className}`}>
              {HUMAN_PRESENCE_MARK.glyph} human in the loop
            </span>
          )}
        </div>

        <p className="max-w-[52ch] text-sm leading-relaxed text-muted">{card.action}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px]">
          <span className="text-dim">{record.id}</span>
          {/* The figure the promotion story would read, and the only one on this row that
              is a fact about the archive rather than about the card: how many blueprints
              pin this exact version. */}
          <span className={usedIn > 0 ? "text-emerald" : "text-dim"}>
            {usedIn > 0
              ? `used in ${usedIn} blueprint${usedIn === 1 ? "" : "s"}`
              : "no blueprint pins it yet"}
          </span>
          <SupportPill count={support} />
        </div>
      </div>

      {/* One control and no caption under it. The blueprint row captions its private rows
          because a private row is the one thing on that list a reader cannot check; every
          row here is a published document, so a per-row note would be the same eight words
          eight times over a fact the panel's own footer already states once. */}
      <div className="flex shrink-0 flex-col items-start gap-2 sm:w-[200px] sm:items-end">
        <Button
          size="sm"
          variant="outline"
          disabled
          aria-label="More actions"
          title="Nothing here edits a card. A card is a document in content/cards/, and this build has no write path to one."
          className="w-8 px-0!"
        >
          <span aria-hidden>⋯</span>
        </Button>
      </div>
    </div>
  );
}

export function OwnedCards({ tiles }: { tiles: readonly NodeTile[] }) {
  const inUse = tiles.filter((tile) => tile.usedIn > 0).length;

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-4">
        <h2 className="label-lead">Your cards</h2>
        <span className="font-mono text-[11px] text-dim">
          {tiles.length} published · {inUse} in use
        </span>
      </div>

      {tiles.map((tile) => (
        <Row key={tile.record.ref} tile={tile} />
      ))}

      <div className="flex flex-col gap-4 bg-surface-2/50 px-5 py-4 sm:flex-row sm:gap-5">
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          The model
        </span>
        <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
          <p>
            A card is a versioned document, not a record in an account. Every row here is a
            file in <span className="font-mono text-fg">content/cards/</span> that names
            this handle in its own <span className="font-mono text-fg">author</span> field,
            which is why there is no private half to this list and no draft: a card is in
            the archive or it is nowhere.
          </p>
          <p>
            <span className="text-emerald">✓ counted</span> covers the name, the type, the
            version and the blueprints that pin it, all read off the archive at build time.
            The star figure beside a row is{" "}
            <span className="text-amber">◐ seeded</span> community support, because there is
            no ballot behind it.
          </p>
        </div>
      </div>
    </section>
  );
}
