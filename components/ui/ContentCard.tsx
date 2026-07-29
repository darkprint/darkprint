import Link from "next/link";
import type { AnyContent } from "@/lib/types";
import { compact, cx } from "@/lib/format";
import { contentHref } from "@/lib/href";
import { GraphThumbnail } from "@/components/graph/GraphThumbnail";
import { Avatar } from "./Avatar";
import { KindBadge } from "./Badge";
import { AutonomyMeter } from "./AutonomyMeter";
import { FavoriteStar } from "./FavoriteStar";
import { TagPill } from "./TagPill";

/**
 * The two index figures, marked as seeded at the point of display.
 *
 * Doc 2 §0.4: nothing may be described as working that is not built, and there is no
 * ballot and no download counter. These are rows in `lib/data/community.ts`, and the tile
 * used to print them bare while `/how-to-build-a-dark-factory` said one click away that
 * the site has "no accounts, no votes and no telemetry". `◐` is the marker `/u/` and the
 * blueprint scorecard already use for exactly this class of number, and the glyph carries
 * a word beside it for a reader who cannot separate amber from dim.
 */
function Meta({ downloads, votes }: { downloads: number; votes: number }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-dim">
      <span className="text-amber" aria-hidden title="Seeded — no ballot and no counter">
        ◐
      </span>
      <span className="sr-only">Seeded index figures, with no ballot or counter behind them:</span>
      <span title="Downloads — a seeded row in the index">↓ {compact(downloads)}</span>
      <span title="Votes — a seeded row in the index">▲ {compact(votes)}</span>
    </div>
  );
}

/** Gallery / profile card for one blueprint: schematic, kind, autonomy and signals. */
export function ContentCard({
  item,
  className,
}: {
  item: AnyContent;
  className?: string;
}) {
  return (
    <article
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-all duration-200 hover:border-line-bright hover:shadow-[0_12px_40px_-24px_var(--color-cyan)]",
        className,
      )}
    >
      {/* The whole card's click target. `z-10` and transparent: it sits above the
          plain-flow content below for hit-testing (so clicking anywhere on the card
          navigates), and below the star (`z-20`), which is the one thing on the card
          that has to stay independently clickable. */}
      <Link href={contentHref(item)} className="absolute inset-0 z-10">
        <span className="sr-only">{item.title}</span>
      </Link>

      <FavoriteStar
        id={`blueprint:${item.slug}`}
        className="absolute right-2 top-2 z-20"
      />

      {/* The name, over the drawing rather than under it (author's request,
          2026-07-29). A shelf is scanned by name, and the drawing is what you look at
          once a name has stopped you; underneath, every tile opened with an untitled
          picture and the reader had to travel to the caption to find out whose it was.

          `pr-8` on the heading and not on the block: the star is `absolute right-2
          top-2`, so it now sits on this row, and padding the whole block would move the
          drawing's left edge off the card's grid as well. */}
      <div className="px-4 pb-3 pt-4">
        <h3 className="pr-8 font-display text-lg font-semibold leading-snug text-fg group-hover:text-cyan">
          {item.title}
        </h3>
      </div>

      {/* preview */}
      <div className="relative h-40 overflow-hidden border-y border-line bg-blueprint-deep/40 bp-grid">
        <GraphThumbnail
          graph={item.graph}
          className="h-full w-full p-2 opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
          ariaLabel={`${item.title} pipeline preview`}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* The class is named and no number is drawn (doc 2 §1.1), and it comes with the
            engine's own per-node reading so the tile can say how many nodes hand control
            back to a person rather than how far the graph is from running unattended.
            `showDarkFactory={false}` (2026-07-29, author's call): the grid is a shelf of
            designs and a tile carrying the dark-factory token read as one more badge than
            the grid needed; the blueprint header and upload preview still show it. The
            grid it sits in offers autonomy as a filter and never as a sort, so nothing
            here gathers those tiles at the top either way. */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <KindBadge kind={item.kind} />
          <AutonomyMeter
            autonomy={item.autonomy}
            contributions={item.analysis.autonomy.contributions}
            size="sm"
            showDarkFactory={false}
          />
        </div>

        {/* `flex-1` stays on whatever sits between the badges and the tag row, so tiles
            of unequal summary length still align their author rows across the grid. */}
        <p className="flex-1 line-clamp-2 text-sm leading-snug text-muted">
          {item.summary}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {item.tags.slice(0, 3).map((t) => (
            <TagPill key={t} label={t} />
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between border-t border-line pt-3">
          {/* The author row reaches its own profile (author's request, 2026-07-29).
              `relative z-20` for the same reason `FavoriteStar` has it: the card's
              stretched `<Link>` sits at `z-10` over everything in plain flow, so a
              nested link without a stacking context of its own is covered by it and
              the whole tile navigates to the blueprint instead. `w-fit` keeps the hit
              area on the name rather than across the empty half of the row. */}
          <Link
            href={`/u/${item.author.username}`}
            className="group/author relative z-20 flex w-fit items-center gap-2"
          >
            <Avatar author={item.author} size="sm" />
            <span className="text-xs text-muted group-hover/author:text-fg">
              {item.author.displayName}
            </span>
          </Link>
          <Meta downloads={item.downloads} votes={item.votes} />
        </div>
      </div>
    </article>
  );
}
