import Link from "next/link";
import type { AnyContent } from "@/lib/types";
import { cx, prettyDate } from "@/lib/format";
import { blueprintRecordHref } from "@/lib/href";
import { GraphThumbnail } from "@/components/graph/GraphThumbnail";
import { Avatar } from "./Avatar";
import { KindBadge } from "./Badge";
import { FavoriteStar } from "./FavoriteStar";
import { TagPill } from "./TagPill";

/**
 * What this tile draws numbers from, and what it does not.
 *
 * There used to be two seeded index figures here — downloads and votes, printed bare with
 * a `◐` beside them, under a docblock citing doc 2 §0.4 for why they were marked. Both came
 * off the tile before this pass, not in it: the footer below carries `forks` (a fact the
 * CALLER counts, over the only population that can hold a public one) and `updatedAt`
 * instead, and neither is a vote or a download count. T280 makes a real ballot and a real
 * download counter exist elsewhere on the site (the blueprint detail page, `/u/<owner>`);
 * this shelf still draws neither one, which is why the docblock that used to sit here — the
 * one describing them — is gone rather than reworded to describe code this file no longer
 * has.
 */
/* ============================================================
   The tile, and where identity sits on it.

   One identity per card, at the top. The author used to be a chip in the footer, under the
   drawing, which meant a shelf of nine tiles named nine people in the last row of each and
   named the bundle nowhere — a reader could not tell `guarded-merge-bot` from
   `guarded-merge-bot-hardened` without opening both. The owner line is how a registry
   addresses a thing: `owner / slug`, in mono, above the name it is called.

   `pr-8` on the line for the same reason the heading has it: the bookmark is `absolute
   right-2 top-2` and now sits on this row.

   The footer keeps `✓ resolved · N tools` and takes what the author chip left: when the
   bundle was last touched, and how many published forks it has. Neither is a version —
   there is no version field on a blueprint and the archive holds one snapshot per bundle,
   so a `v1.3.0` here would be a number nothing produced.
   ============================================================ */

/**
 * The shell every card-like surface takes: the frame, the one hover clock, the press.
 *
 * Exported because `./ContentRow.tsx` is the same object at a different aspect and the
 * reasoning below is what must not fork. A row is a card that happens to be wide — if the
 * hover clock, the press band or the border story ever differ between the two, the shelf has
 * two kinds of card on it and nobody decided that.
 *
 * ── One clock for one gesture ──
 * Pointing at a tile used to produce three arrivals: the article transitioned `all` over
 * 200ms, the title had no transition at all and snapped to cyan in the same frame, and the
 * drawing scaled over 300ms — so the element the eye is actually on was the one that moved
 * first and alone. All three now run at `--dur-base` (180ms) on `--ease-out`.
 *
 * `transition-all` is also what made the hover expensive: it animates every animatable
 * property, and the one it did animate is a 40px-blur box-shadow repainted off the GPU on
 * every frame, on a three-column grid that fires continuously as the pointer crosses the
 * page. The property list is explicit.
 *
 * `hoverable:` gates hover on `(hover: hover) and (pointer: fine)`; without it a tapped tile
 * on a phone keeps its lit border until the route changes. Press is the >200px band: 0.99.
 * `:active` matches ancestors of the activated element, so pressing anywhere on the
 * stretched hit target presses the whole card.
 *
 * `scale` is listed alongside `transform` on purpose. Tailwind v4 compiles `scale-[0.99]` to
 * the individual `scale` property, not to a `transform` function — measured in Chrome, a
 * list naming only `transform` leaves the press untransitioned and the card snaps between
 * the two sizes. (v4's own `transition-transform` shorthand expands to `transform,
 * translate, scale, rotate` for the same reason; this is the explicit spelling of that.)
 */
export const CARD_SHELL =
  "group relative overflow-hidden rounded-lg border border-line bg-surface transition-[border-color,box-shadow,transform,scale] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-line-bright hoverable:hover:shadow-[0_12px_40px_-24px_var(--color-cyan)] hoverable:active:scale-[0.99]";

/** Gallery / profile card for one blueprint: schematic, kind, autonomy and signals. */
export function ContentCard({
  item,
  forks = 0,
  lineage,
  className,
}: {
  item: AnyContent;
  /**
   * Published forks of this bundle. Counted by the caller over the only population that
   * can hold one, and public only: a private fork is never announced on its upstream.
   *
   * Doc 2 §1.1 keeps league tables off this shelf, so the count states a fact on a tile and
   * never orders the page. There is no `forks` sort and there must not be one.
   */
  forks?: number;
  /** Where this bundle came from, when it came from somewhere. Drawn as a line, not a type. */
  lineage?: { owner: string; slug: string };
  className?: string;
}) {
  return (
    <article className={cx(CARD_SHELL, "flex flex-col", className)}>
      {/* The whole card's click target. `z-10` and transparent: it sits above the
          plain-flow content below for hit-testing (so clicking anywhere on the card
          navigates), and below the star (`z-20`), which is the one thing on the card
          that has to stay independently clickable. */}
      <Link href={blueprintRecordHref(item)} className="absolute inset-0 z-10">
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
      <div className="flex flex-col gap-1.5 px-4 pb-3 pt-4">
        {/* `relative z-20` for the reason the bookmark has it: the card's stretched `<Link>`
            sits at `z-10` over everything in plain flow, so the avatar's own link would be
            covered by it and the whole tile would navigate to the blueprint instead. */}
        <span className="relative z-20 flex w-fit items-center gap-2 pr-8 font-mono text-xs">
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
          <span className="pr-8 font-mono text-[11px] text-dim">
            forked from {lineage.owner} / {lineage.slug}
          </span>
        )}
        <h3 className="pr-8 font-display text-lg font-semibold leading-snug text-fg transition-colors duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:group-hover:text-cyan">
          {item.title}
        </h3>
        {/* What it is for, directly under the name and above the drawing.
            It used to sit fourth, under the preview and the two badges, clamped to two
            lines. A name and a picture are what a reader recognises once they already
            know the registry; somebody arriving with a goal has neither, and the sentence
            saying what the thing does was the one part of the tile they needed first.
            Doc 2 §0: the site exists to get people downloading these, and a shelf nobody
            can scan by purpose does not.

            Three lines, not two: the preview below gave up 48px (h-40 → h-28) and this is
            the sentence a reader decides by, so it is where that height goes. Two lines
            truncated most summaries mid-clause, which is the worst possible place to stop
            a sentence whose whole job is to say what the pipeline is for. */}
        <p className="line-clamp-3 pr-8 text-sm leading-snug text-muted">{item.summary}</p>
      </div>

      {/* preview */}
      {/* `h-28` and not `h-40`: at 160px the drawing was the largest element on a 401px
          card and carried the least information — nine graphs at that size are visually
          interchangeable, and the shelf is scanned by name and by sentence. 112px is
          enough to read a constellation of lit discs as a shape, and the 48px it gives
          back buys the summary its third line above. */}
      <div className="relative h-28 overflow-hidden border-y border-line bg-blueprint-deep/40 bp-grid">
        {/* `nodeLabels={false}`: this frame is 353 wide and 94 high inside its padding on
            the grid (743 wide on the shelf's featured tile), the archive's viewBoxes run
            from 498×304 to 1298×304 — 1098×484 for the widest fan-out — and
            `preserveAspectRatio="xMidYMid meet"` takes the smaller of the two ratios. So
            the uniform scale is 0.194 to 0.321 across the nine, and an 11-unit node name
            would land between **2.1 and 3.5 CSS pixels** against a 10 CSS px floor.

            Measured after `lib/content/layout.ts` took the row gap from 140 to 180, which
            is what moved these numbers: every viewBox grew down, and the ones that were
            already the widest on the shelf did not grow across. Note what that does to the
            `h-40` → `h-28` story above — the eight grid tiles split evenly by which axis
            binds them, not uniformly by width: `checkpoint-resume-runner`,
            `frontline-triage`, `guarded-merge-bot` and `incident-commander` are wide enough
            to overflow the 352.7:94 frame sideways and stay width-bound, so the 48px this
            gave back cost them no scale at all. `nightly-data-janitor`,
            `grounded-research-desk`, `adversarial-consensus-line` and `schema-forge-etl`
            are height-bound instead — among them the 1098×484 widest fan-out — and for
            those the 48px reduction is a real cost: `grounded-research-desk`'s uniform
            scale drops from 0.298 to 0.194, a 35% loss. The glyph, the kind colour and
            the topology all survive that scale; the words never did. See the prop's own
            comment. */}
        <GraphThumbnail
          graph={item.graph}
          nodeLabels={false}
          className="h-full w-full p-2 opacity-90 transition-transform duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:group-hover:scale-[1.03]"
          ariaLabel={`${item.title} pipeline preview`}
        />
        {/* The soft landing into the card body, re-proportioned with the frame: it was
            40px of 160 (25%) and would have been 40px of 112 (36%), which put the whole
            bottom rank of nodes under the fade. 24px of 112 restores the ratio. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface to-transparent" />
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* `AutonomyMeter` sat opposite the kind badge here, naming the class and the
            per-node reading behind it. It came off with the whole scoring reading on the
            owner's instruction: the detail page no longer draws that reading, and a shelf
            that classifies what the page it links to will not is a shelf making a claim
            nobody can follow up. `GalleryBrowser` still filters on autonomy, which is a way
            into the shelf rather than a statement printed on a tile.
            `justify-between` goes with it: one badge has nothing to be pushed away from. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <KindBadge kind={item.kind} />
        </div>

        {/* `flex-1` stays on whatever sits between the badges and the tag row, so tiles
            of unequal summary length still align their author rows across the grid. The
            summary moved above the drawing, so the tags carry the stretch now. */}
        <div className="flex flex-1 flex-wrap content-start gap-1.5">
          {item.tags.slice(0, 3).map((t) => (
            <TagPill key={t} label={t} />
          ))}
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3 font-mono text-[11px]">
          {/* The author chip left this row for the owner line at the top: one identity per
              card, and the shelf now names the bundle rather than nine people. What moved
              in is what a reader asks next — when it last changed, and whether anybody has
              built on it. */}
          <span className="text-dim">
            {prettyDate(item.updatedAt)}
            {forks > 0 && (
              <>
                {" · "}
                {forks} fork{forks === 1 ? "" : "s"}
              </>
            )}
          </span>
          <span className="text-emerald">
            ✓ resolved · {item.requiredTools.length} tool{item.requiredTools.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </article>
  );
}
