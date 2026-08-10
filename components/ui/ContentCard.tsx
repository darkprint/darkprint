import Link from "next/link";
import type { AnyContent } from "@/lib/types";
import { cx } from "@/lib/format";
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
        /* One clock for one gesture. Pointing at a tile used to produce three arrivals:
           the article transitioned `all` over 200ms, the title had no transition at all
           and snapped to cyan in the same frame, and the drawing scaled over 300ms — so
           the element the eye is actually on was the one that moved first and alone. All
           three now run at `--dur-base` (180ms) on `--ease-out`.

           `transition-all` is also what made the hover expensive: it animates every
           animatable property, and the one it did animate is a 40px-blur box-shadow
           repainted off the GPU on every frame, on a three-column grid that fires
           continuously as the pointer crosses the page. The property list is explicit.

           `hoverable:` gates hover on `(hover: hover) and (pointer: fine)`; without it a
           tapped tile on a phone keeps its lit border until the route changes. Press is
           the >200px band: 0.99. `:active` matches ancestors of the activated element, so
           pressing anywhere on the stretched hit target presses the whole card.

           `scale` is listed alongside `transform` on purpose. Tailwind v4 compiles
           `scale-[0.99]` to the individual `scale` property, not to a `transform`
           function — measured in Chrome, a list naming only `transform` leaves the press
           untransitioned and the card snaps between the two sizes. (v4's own
           `transition-transform` shorthand expands to `transform, translate, scale,
           rotate` for the same reason; this is the explicit spelling of that.) */
        "group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-[border-color,box-shadow,transform,scale] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-line-bright hoverable:hover:shadow-[0_12px_40px_-24px_var(--color-cyan)] hoverable:active:scale-[0.99]",
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
      <div className="flex flex-col gap-1.5 px-4 pb-3 pt-4">
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
            of unequal summary length still align their author rows across the grid. The
            summary moved above the drawing, so the tags carry the stretch now. */}
        <div className="flex flex-1 flex-wrap content-start gap-1.5">
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
          <span className="font-mono text-[11px] text-emerald">
            ✓ resolved · {item.requiredTools.length} tool{item.requiredTools.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </article>
  );
}
