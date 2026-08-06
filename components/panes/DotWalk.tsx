"use client";

/* ============================================================
   `blueprint.dot`, at full width, walked as the reader scrolls.

   ── What the author asked for ──
   Make the `<slug>/blueprint.dot` panel bigger, and highlight the
   important tag in blue while the page scrolls — "the same approach
   as the home's node-card walk, but in the cyanotype BLUE register
   rather than the walk's copper, so the two stay distinct".

   ── What "bigger" is worth, measured ──
   The panel this replaces on a blueprint page was a `SourcePanel`
   in a half-grid: a 564x320 scroll box against 713x578 of content,
   so it hid 45% of the file down the page and 21% of it across.
   This band is `container-page` wide, which is 1152px at 1440, and
   it gives the listing two thirds of that: 727px of column against
   a longest line of about 690px, and every line of every blueprint
   in the archive on screen at once.

   THAT IS WHY THERE IS NO REEL. `CardWalk` slides a 52-line card
   through a 24-row window because the card cannot fit; the longest
   `blueprint.dot` in the archive is 27 lines, which is 558px of
   listing. The walk is only "which block is being read now", so
   `shiftFor`, the window clip and the reel's transform are all
   absent — and with them the two phone regressions
   `CardWalk.tsx:327-346` records. Nothing here sets a height or a
   transform at any width.

   ── Blue, and never copper, and never cyan ──
   `app/globals.css` gives the copper pole one job: the node card.
   The card figure and this one are two layers of the same spec and
   a reader has to tell them apart at a glance, so this is the
   cyanotype register, and the two figures now use an identical
   marking grammar in two hues — which is the strongest version of
   what was asked for.

   Not cyan: cyan is interactive sitewide and a lit line beside the
   page's cyan controls would read as "click me". Not amber: amber
   is `ComingSoonBadge` and `.route-box` and nothing else, and this
   file is the most literally-built thing on the page.

   Contrast, computed against the grounds this figure actually
   mixes — `bg-surface-2/40` over `bg-void` for the listing (#0a0b14),
   `bg-blueprint-line/10` over that for a live row (#141c2b):

     blueprint-line          9.09 : 1   /  7.91 : 1  on a live row
     blueprint-line at 80%   6.10 : 1   /  5.53 : 1  (the 11px step
                                                      number, AA)
     blueprint-line at 60%   3.87 : 1   /  3.70 : 1  (the rule, a
                                                      non-text
                                                      boundary, 3:1)
     blueprint-ink          14.95 : 1   / 13.01 : 1
     muted                   7.66 : 1   /  6.66 : 1  (a tag not yet
                                                      reached)

   The copper figure's equivalents are 8.4 / 5.4 / 3.6, so the two
   registers are matched weight for weight as well as job for job.

   ── One DOM, and the static layout is the finished drawing ──
   `CardWalk`'s reasoning, unchanged and load-bearing here too.
   Every choreography class carries `lg:` AND is emitted only when
   `motion` is true, and `motion` is false on the server and on the
   first client render. So the prerendered markup is the whole file,
   every step in the rail with its body open, no clipping and no
   pinning: a phone reader, a reader who asked for stillness and a
   crawler all get the listing entire.
   ============================================================ */

import { useMemo } from "react";

import { stagesShown, useScrollProgress } from "@/components/viz/useScrollProgress";
import { cx } from "@/lib/format";

import {
  lineSpan,
  resolveDotSteps,
  tokenizeDot,
  type DotStep,
  type DotTokenKind,
} from "./dot-walk";

/* ==================== geometry ==================== */

/**
 * The row height, DECLARED rather than inherited from the mono face's metrics.
 *
 * Everything below is arithmetic on this number, and the sticky offset is half of the
 * total. A row that came out 21.6px because of the face's default leading would pin the
 * figure off-centre by half a line per line of file — twelve pixels on the starter, and
 * more on nothing, which is the kind of drift nobody attributes to a line-height.
 */
const LINE = 20;
/** `py-2` at both ends of the listing box, plus its 1px border on each side. */
const LIST_CHROME = 16 + 2;
/** The figure's own frame: 1px border each side, `sm:p-5` at both ends. */
const FRAME = 2 + 40;
/** The figcaption row, at the site's 11px mono floor. */
const CAPTION = 18;
/** `gap-4` between the figcaption and the grid under it. */
const GAP = 16;

/** How tall the figure stands at `lg`, which is what the sticky offset halves. */
function figureHeight(lineCount: number): number {
  return FRAME + CAPTION + GAP + lineCount * LINE + LIST_CHROME;
}

/**
 * The track, in vh, so the pin travel scales with the viewport the way `CardWalk`'s does.
 *
 * Paced against that walk rather than guessed. `CardWalk` runs nine steps over 190vh, which
 * at a 900px reference viewport is a reported span of 810px and 86px of scroll per step —
 * about one trackpad flick, which is the floor before a walk starts skipping steps. 11vh
 * per step reproduces it: five steps give 155vh, a 495px span and 95px a step; three steps
 * give 133vh, 297px and the same 95px.
 *
 * The floor matters more here than there, because six of the nine blueprints resolve to
 * exactly three steps and a track under about 130vh has no room to settle before the first
 * one attaches.
 */
function trackVh(stepCount: number): number {
  return Math.max(130, 100 + stepCount * 11);
}

/* ==================== the marking, in the blueprint register ==================== */

/** Whether a block has been reached, and whether it is the one being read now. */
type BandState = "pending" | "attached" | "active";

const TOKEN_CLASS: Record<Exclude<DotTokenKind, "card">, string> = {
  plain: "",
  comment: "text-dim",
  keyword: "text-muted",
  /* Node ids and either end of an edge: the ink of the register, which is also what
     `components/ui/SourcePanel.tsx` already paints code in. Half the register was in
     place before this figure existed. */
  id: "text-blueprint-ink",
  arrow: "text-blueprint-ink",
  attr: "text-dim",
  string: "text-muted",
  punct: "text-dim",
};

/*
 * THE IMPORTANT TAG.
 *
 * `card="id@version"` is the one attribute DarkPrint adds to DOT, and the three tokens of
 * it are marked as one kind by `dot-walk.ts` precisely so they can be lit together. Base
 * class is the lit one, because the static layout has every step shown: a reader without
 * script sees the join in blue on every node line, which is the whole claim of the figure.
 *
 * The `lg:` half is the live state. `active` adds a ground as well as the colour, which is
 * the one place this figure paints a chip rather than only a hue — the block that declares
 * the nodes is the beat the author named, and a marker-pen band over five identical
 * attributes says "these five, now" in a way a colour change on already-blue text cannot.
 */
const CARD_MARKED = "text-blueprint-line";
const CARD_LIVE: Record<BandState, string> = {
  pending: "lg:text-muted",
  attached: "lg:text-blueprint-line",
  active: "lg:bg-blueprint-line/15 lg:text-blueprint-line",
};

/*
 * The row ground, and why only the ACTIVE block gets one.
 *
 * `YamlListing` grounds every attached run, and it can: nine annotations cover part of a
 * 52-line card, so a marked row means something against the unmarked ones around it. Here
 * the steps TILE the file — every statement belongs to exactly one block — so grounding
 * everything attached ends the walk with the whole listing lit, which is the same as
 * nothing being lit. The rule below carries "which lines are this step"; the ground
 * carries "and this is the one you are reading".
 */
const ROW_LIVE: Record<BandState, string> = {
  pending: "lg:bg-transparent",
  attached: "lg:bg-transparent",
  active: "lg:bg-blueprint-line/10",
};

/* The rule is a boundary rather than a word, so it is held to 3:1 and not 4.5:1: the
   register's line at 60% measures 3.87:1 on the listing's ground, and the active state is
   the same colour at full, 9.09:1. Blank lines and the closing brace carry no block, so the
   rule breaks between blocks and each step reads as its own bracket down the margin. */
const RULE_MARKED = "border-blueprint-line/60";
const RULE_LIVE: Record<BandState, string> = {
  pending: "lg:border-blueprint-line/25",
  attached: "lg:border-blueprint-line/60",
  active: "lg:border-blueprint-line",
};

/* A step number IS a word, so the attached weight is 80% (6.10:1 at rest, 5.53:1 on a live
   row) rather than the rule's 60%. Below 80 the register stops clearing AA at 11px. */
const STEP_MARKED = "text-blueprint-line/80";
const STEP_LIVE: Record<BandState, string> = {
  pending: "lg:text-dim/60",
  attached: "lg:text-blueprint-line/80",
  active: "lg:text-blueprint-line",
};

interface LineMark {
  state: BandState;
  /** Printed once per block, on its first line. */
  step?: number;
}

/** Line number to marker, for the whole document. One pass over 27 lines, per render. */
function markLines(
  steps: readonly DotStep[],
  shown: number,
  active: number,
): Map<number, LineMark> {
  const marks = new Map<number, LineMark>();
  steps.forEach((step, index) => {
    const state: BandState =
      index === active ? "active" : index < shown ? "attached" : "pending";
    for (let line = step.from; line <= step.to; line += 1) {
      marks.set(line, { state, ...(line === step.from ? { step: step.step } : {}) });
    }
  });
  return marks;
}

/* ==================== small helpers ==================== */

/** Two digits, so the numbers form a column rather than a ragged edge. */
function ordinal(step: number): string {
  return String(step).padStart(2, "0");
}

/** Backticked identifiers in a step's body render as inline code. */
function body(text: string): React.ReactNode[] {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code
        key={i}
        className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px] text-fg"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

/* ==================== the figure ==================== */

export function DotWalk({
  source,
  title,
  className,
}: {
  /** The DOT document, verbatim, read off the archive by the server half. */
  source: string;
  /** `<slug>/blueprint.dot`, the name the file is stored and downloaded under. */
  title: string;
  className?: string;
}) {
  /* `.trimEnd()`, the way `SectionNodeIsCard` trims the card before handing it to
     `CardWalk`. Every file in `content/blueprints/` ends with a newline, and splitting on
     it yields a final empty line: the starter drew 28 rows for a 27-line file, printed
     "28 lines, as the archive stores them" under a file that has 27, and added 20px to the
     figure — which the sticky offset then halved, pinning the whole walk ten pixels high. */
  const text = useMemo(() => source.trimEnd(), [source]);
  const lines = useMemo(() => tokenizeDot(text), [text]);
  const steps = useMemo(() => resolveDotSteps(text), [text]);

  const { ref, progress, motion } = useScrollProgress<HTMLElement>({ steps: 120 });

  /* `tail: 0`, and the argument is `CardWalk`'s, restated because it has been got wrong
     once already. Everything after the last step attaches is dead scroll, so a tail
     reserve moves the last step EARLIER and lengthens the freeze it was meant to shorten.
     There is no dezoom here to spend a reserve on either. `head: 0.04` is the settle:
     the figure locks centred and stands still for a beat before step 2 arrives. */
  const shown = motion
    ? stagesShown(progress, steps.length, { head: 0.04, tail: 0 })
    : steps.length;
  const active = motion ? Math.min(steps.length, Math.max(1, shown)) - 1 : -1;

  const marks = markLines(steps, shown, active);
  const gutter = String(lines.length).length;

  /* Both numbers are DERIVED and travel as custom properties, which is the fix for the
     hazard `geometry.ts` and `CardWalk` both carry: a figure height retyped as a rem
     constant beside the row count that decides it, where moving one and not the other pins
     the walk off-centre by the difference. This walk runs over nine different files of
     between 16 and 27 lines, so a constant could not have been right for more than one of
     them anyway.

     `max(4rem, …)` is a floor and not a nicety: half a 27-line figure is 317px, so
     `50vh - 317px` goes negative below a 634px viewport and the figcaption would pin under
     the 4rem sticky `SiteHeader`. A window that short cannot hold the whole figure either
     way; the floor decides which end gets cut, and the top is where the file names itself. */
  const half = figureHeight(lines.length) / 2;
  const shell = {
    "--dot-track": `${trackVh(steps.length)}vh`,
    "--dot-top": `max(4rem, calc(50vh - ${half}px))`,
  } as React.CSSProperties;

  return (
    <section
      ref={ref}
      aria-label={`${title}, walked one block at a time`}
      style={shell}
      className={cx(motion && "lg:h-[var(--dot-track)]", className)}
    >
      <div className={cx(motion && "lg:sticky lg:top-[var(--dot-top)]")}>
        {/* Plain ground and one hairline, the frame `CardWalk` and
            `/what-a-blueprint-is`'s figures use. Not a `.panel`: this band is the page's
            one figure and a panel frame would file it with `Tool scopes`. */}
        <figure className="flex flex-col gap-4 rounded-xl border border-line bg-void p-4 sm:p-5">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] leading-[18px] text-dim">
            <span className="flex items-baseline gap-2">
              {/* The register's own glyph, not `SourcePanel`'s cyan one: there are no
                  controls in this header, and cyan on a figure with nothing to click is
                  the site's interactive colour spent on a decoration. */}
              <span className="text-blueprint-line" aria-hidden>
                ▤
              </span>
              <span className="text-muted">{title}</span>
            </span>
            <span className="flex items-baseline gap-3">
              <span>{lines.length} lines, as the archive stores them</span>
              {/* What the fade on the right edge means, said in words — and `xl:hidden`,
                  because at `xl` there is nothing behind it and a hint that points at
                  nothing is the same defect as a cut that looks like a bug.

                  The arithmetic: the longest line in the archive is 89 characters
                  (`starter-software-factory:14`, `nightly-data-janitor`, `schema-forge-etl`),
                  which is 690px of listing including both margins, and the column is 725px
                  once `container-page` caps at 1152 — from a 1200px viewport up. 1280 is
                  the nearest breakpoint below which the hint is still true. The 24px fade
                  starts at 701px, so even at `xl` it covers blank box and never text.

                  `aria-hidden` because the region below announces itself and its length,
                  and an arrow read aloud is noise. */}
              <span aria-hidden className="shrink-0 whitespace-nowrap text-dim/70 xl:hidden">
                scroll →
              </span>
            </span>
          </figcaption>

          {/* 2fr against 1fr. At 1440 that is 727px of listing against 363px of rail:
              the listing clears the longest line in the archive (about 690px at 12px
              mono) with nothing cut, and the rail holds a step's body in three lines at
              13px. Below `lg` the two stack and the listing keeps its own height. */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            {/* A scroll container with no focusable child cannot be reached from the
                keyboard at all (WCAG 2.1.1, Level A): below `lg` this box is 340px wide
                against 690px of content, so without a tab stop half of every long line is
                available to a mouse and to nobody else. `role="region"` with a name is
                what makes the stop worth having. */}
            <div
              tabIndex={0}
              role="region"
              aria-label={`${title}, ${lines.length} lines`}
              className={cx(
                "min-w-0 overflow-x-auto rounded-lg border border-line bg-surface-2/40 py-2",
                /* On the container's own box and never on the listing inside it: the mask
                   is painted over the part that stays still while the content scrolls
                   under it. 1.5rem, and the listing fits its column at `lg`, so what the
                   fade covers there is blank box rather than text. */
                "[mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)]",
              )}
            >
              <div className="w-max min-w-full font-mono text-[12px]">
                {lines.map((line) => {
                  const mark = marks.get(line.no);
                  const state = mark?.state ?? "pending";
                  const marked = mark !== undefined;
                  return (
                    <div
                      key={line.no}
                      /* Declared, never inherited — see `LINE`. */
                      style={{ height: LINE }}
                      className={cx(
                        "flex items-center",
                        marked && motion && ROW_LIVE[state],
                      )}
                    >
                      <span
                        aria-hidden
                        /* 11px, not 10 and certainly not 9: the site's mono floor is 11px
                           with no exceptions, and this marker is the static layout's whole
                           answer to a leader line — the number a reader who never sees the
                           choreography uses to find which step a block belongs to. */
                        className={cx(
                          "w-6 shrink-0 select-none self-stretch border-l-2 pl-1 text-[11px] leading-[20px]",
                          marked ? RULE_MARKED : "border-transparent",
                          marked && STEP_MARKED,
                          marked && motion && RULE_LIVE[state],
                          marked && motion && STEP_LIVE[state],
                        )}
                      >
                        {/* Two digits, the same spelling the rail uses. `YamlListing`
                            prints its marker bare because a nine-step walk is always one
                            digit and the two columns never disagree; this walk resolves
                            between three and six steps per blueprint, and "5" in the
                            margin beside "05" on the rail is two spellings of one number
                            in one figure. 18px of column holds two 11px mono digits with
                            5px to spare. */}
                        {mark?.step === undefined ? "" : ordinal(mark.step)}
                      </span>
                      <span
                        aria-hidden
                        className="shrink-0 select-none pr-3 pl-1 text-right text-dim/80"
                        /* `select-none` on both margins for the reason `YamlListing` gives:
                           a reader dragging across ten lines wants ten lines of DOT on the
                           clipboard, not ten lines with a number welded to the front. */
                        style={{ width: `${gutter + 1.5}ch` }}
                      >
                        {line.no}
                      </span>
                      <span className="whitespace-pre">
                        {line.tokens.map((token, i) => (
                          <span
                            key={i}
                            className={cx(
                              token.kind === "card"
                                ? CARD_MARKED
                                : TOKEN_CLASS[token.kind],
                              token.kind === "card" && motion && CARD_LIVE[state],
                            )}
                          >
                            {token.text}
                          </span>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Every step's head is on screen from the start, so the figure says how many
                parts this file has before it has walked any of them, and the one being
                read opens under its own head. */}
            <ol className="flex min-w-0 flex-col">
              {steps.map((step, i) => {
                const reached = !motion || i < shown;
                const isOpen = i === active;
                return (
                  <li
                    key={step.step}
                    className="border-t border-line/70 py-2.5 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        aria-hidden
                        className={cx(
                          "shrink-0 font-mono text-[11px] tabular-nums transition-colors",
                          isOpen
                            ? "text-blueprint-line"
                            : reached
                              ? "text-dim"
                              : "text-faint",
                        )}
                      >
                        {ordinal(step.step)}
                      </span>
                      <p
                        className={cx(
                          "min-w-0 flex-1 font-mono text-[13px] leading-snug transition-colors",
                          isOpen ? "text-fg" : reached ? "text-muted" : "text-dim",
                        )}
                      >
                        {step.title}
                      </p>
                      {/* `text-dim` and not `text-faint`: `--color-faint` is 1.83:1 and is
                          reserved for decorative separators, and this is the only thing
                          joining a step to its lines. */}
                      <span
                        className={cx(
                          "shrink-0 font-mono text-[11px] tabular-nums transition-colors",
                          isOpen ? "text-blueprint-line" : "text-dim",
                        )}
                      >
                        {lineSpan(step.from, step.to)}
                      </span>
                    </div>

                    {/* Open under its own head while the walk runs; all of them open in the
                        static layout, which is what makes the prerendered markup readable
                        without script. */}
                    <p
                      className={cx(
                        "mt-1.5 pl-[1.9rem] text-[13px] leading-relaxed text-muted",
                        motion && !isOpen && "lg:hidden",
                      )}
                    >
                      {body(step.body)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </figure>
      </div>
    </section>
  );
}
