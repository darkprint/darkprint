import Link from "next/link";

import { GraphThumbnail } from "@/components/graph/GraphThumbnail";
import { cx, prettyDate } from "@/lib/format";
import { contentHref } from "@/lib/href";
import type { AnyContent } from "@/lib/types";

import { Avatar } from "./Avatar";
import { AutonomyMeter } from "./AutonomyMeter";
import { CARD_SHELL } from "./ContentCard";
import { FavoriteStar } from "./FavoriteStar";

/* ============================================================
   One blueprint as a row, for the `/blueprints` shelf.

   ── A sibling component, not a `layout="row"` prop on `ContentCard` ──
   The hand-off allowed either and asked for the choice to be written down. This is the
   second file, and the reason is that the two shapes share a frame and almost no
   composition. `ContentCard` argues its own order at length — the name over the drawing, the
   summary at three lines under it, a badge row, tags carrying the `flex-1` stretch so nine
   tiles align their footers, and a footer of date and tools. A row keeps none of that
   ordering: three zones side by side, no tags, no badges, and two elements the tile does not
   have at all. A `layout` prop would make nearly every line in that file conditional on a
   shape it was not written for, and the file is mounted on `/u/` profiles and in the upload
   preview, which have no stake in this shelf.

   What the two DO share is the frame, and that is imported rather than copied: `CARD_SHELL`
   carries the hover clock, the press band and the border story, so a row cannot drift into
   being a second kind of card by accident.

   ── What a row is for ──
   `GalleryBrowser` offers phase coverage, autonomy class and dark-factory as ways into the
   shelf and the tile showed none of them, so a reader filtered on three axes the grid never
   displayed. A grid of nine posters is for browsing; choosing between nine is a comparison,
   and a comparison wants rows — every axis the filter bar offers can be read down a column.

   ── The drawing gets BIGGER, which is the part worth checking rather than assuming ──
   The tile spent 112px on a frame its own comment concedes is illegible ("nine graphs at
   that size are visually interchangeable"). Measured on the built page rather than off that
   comment, the eight grid tiles draw into 352.7x94 and the archive's nine viewBoxes are
   498x304, 1098x124, 1098x278 (x2), 1098x304 (x3), 1098x484 and 1298x304. The row's frame is
   380x132 with a 1px border and the svg's own `p-2`, so the drawable is 362x114 — wider AND
   half again as tall, and every one of the nine gains uniform scale. The table is in the
   commit that built this.

   `nodeLabels` stays `false`. At 0.24-0.38 an 11-unit label still lands well under the 10px
   floor, which is the same arithmetic that turned it off on the tile.
   ============================================================ */

/**
 * The thumbnail frame, in CSS pixels, and the one number in this file that is a design
 * decision rather than a consequence.
 *
 * 380 is the hand-off's column and 132 its height. Everything else about the drawing follows
 * from them: the border takes 1px a side and `GraphThumbnail`'s own `p-2` takes 8 more, so
 * the drawable is 362x114 and `preserveAspectRatio="xMidYMid meet"` does the rest.
 */
const THUMB = { width: 380, height: 132 } as const;

export function ContentRow({
  item,
  forks = 0,
  lineage,
  className,
}: {
  item: AnyContent;
  /**
   * Published forks of this bundle, counted by the caller over the only population that can
   * hold one, and public only: a private fork is never announced on its upstream.
   *
   * Doc 2 §1.1 keeps league tables off this shelf, so the count states a fact on a row and
   * never orders the page. There is no `forks` sort and there must not be one — and a list
   * shape makes that easier to violate than a grid did, because a sortable column header is
   * one line of code.
   */
  forks?: number;
  /** Where this bundle came from, when it came from somewhere. A line, not a type. */
  lineage?: { owner: string; slug: string };
  className?: string;
}) {
  return (
    <article
      className={cx(
        CARD_SHELL,
        /* Three zones. The middle one is `minmax(0,1fr)` and not `1fr`, which is the whole
           reason the summary wraps instead of pushing the coverage strip off the row: a grid
           track defaults to `min-content` as its floor, and a long unbroken word in a title
           would otherwise widen the track past its share. Below `lg` the row stacks — 380 +
           236 + two 24px gaps leaves 76px for identity at 1024, which is not a column. */
        "grid grid-cols-1 items-center gap-6 p-[18px] lg:grid-cols-[380px_minmax(0,1fr)_236px]",
        className,
      )}
    >
      {/* The whole row's click target. `z-10` and transparent: above the plain-flow content
          for hit-testing, below the star at `z-20`, which is the one thing on the row that
          has to stay independently clickable. Unchanged from the tile, and the z ladder with
          it. */}
      <Link href={contentHref(item)} className="absolute inset-0 z-10">
        <span className="sr-only">{item.title}</span>
      </Link>

      <FavoriteStar id={`blueprint:${item.slug}`} className="absolute right-2 top-2 z-20" />

      {/* ---------- zone 1: the drawing ---------- */}
      <div
        className="relative overflow-hidden rounded-md border border-line bg-blueprint-deep/40 bp-grid"
        style={{ height: THUMB.height }}
      >
        <GraphThumbnail
          graph={item.graph}
          nodeLabels={false}
          className="h-full w-full p-2 opacity-90 transition-transform duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:group-hover:scale-[1.03]"
          ariaLabel={`${item.title} pipeline preview`}
        />
      </div>

      {/* ---------- zone 2: who made it, and what it is for ---------- */}
      <div className="flex min-w-0 flex-col gap-1.5">
        {/* `relative z-20` for the reason the bookmark has it: the row's stretched `<Link>`
            sits at `z-10` over everything in plain flow, so the avatar's own link would be
            covered by it and the whole row would navigate to the blueprint instead. */}
        <span className="relative z-20 flex w-fit max-w-full items-center gap-2 font-mono text-xs">
          <Avatar author={item.author} size="sm" link />
          <Link
            href={`/u/${item.author.username}`}
            className="text-muted transition-colors hoverable:hover:text-fg"
          >
            {item.author.username}
          </Link>
          <span aria-hidden className="text-faint">
            /
          </span>
          <span className="min-w-0 truncate text-cyan">{item.slug}</span>
          {lineage !== undefined && (
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-dim">
              forked
            </span>
          )}
        </span>
        {lineage !== undefined && (
          <span className="font-mono text-[11px] text-dim">
            forked from {lineage.owner} / {lineage.slug}
          </span>
        )}
        <h3 className="font-display text-lg font-semibold leading-snug text-fg transition-colors duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:group-hover:text-cyan">
          {item.title}
        </h3>
        {/* Three lines, as on the tile and for the tile's reason: this is the sentence a
            reader decides by, and two lines truncated most summaries mid-clause. A row has
            more measure than a tile did, so three lines here is a longer read than three
            lines there — which is the point of the shape. */}
        <p className="line-clamp-3 text-sm leading-snug text-muted">{item.summary}</p>

        {/* The shape line lands here in part 2, and the meter is what it replaces. Kept for
            now so this commit changes the geometry and drops nothing: the class is named and
            no number is drawn (doc 2 §1.1), with the engine's own per-node reading.
            `showDarkFactory={false}` is the author's 2026-07-29 call — the shelf offers the
            token as a filter and a row carrying it read as one badge more than the shelf
            needed. */}
        <div className="pt-0.5">
          <AutonomyMeter
            autonomy={item.autonomy}
            contributions={item.analysis.autonomy.contributions}
            size="sm"
            showDarkFactory={false}
          />
        </div>
      </div>

      {/* ---------- zone 3: coverage and the date ---------- */}
      {/* The coverage strip arrives in part 2 and is the reason the row exists. What is here
          now is the tile's own footer pair, moved: when it last changed, whether it resolves,
          and how many published forks it has. */}
      <div className="flex flex-col gap-2.5 font-mono text-[11px]">
        <span className="text-dim">
          {prettyDate(item.updatedAt)}
          {forks > 0 && (
            <>
              {" · "}
              {forks} fork{forks === 1 ? "" : "s"}
            </>
          )}
        </span>
        <span className="text-emerald">✓ resolved</span>
      </div>
    </article>
  );
}
