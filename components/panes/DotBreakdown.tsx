"use client";

/* ============================================================
   `topology.dot`, at full width, broken into blocks you can pick.

   ── What the author asked for ──
   "The panel in each blueprint representing the blueprint.dot is ok
   but avoid the scrollable animation there. Just enable the click on
   the right list and then it highlights the .dot parts corresponding
   on the left." And: the same figure on `/spec/topology`, under
   "One file, and the attribute DarkPrint adds".

   This DELIBERATELY REPLACES the scroll-linked walk this file
   carried for one release. There is no flag and no preference: the
   pin, the vh track, the sticky offset and `useScrollProgress` are
   gone from here entirely. What is left is a figure that highlights
   nothing until a reader asks it to, and highlights exactly the
   block they asked for when they do.

   THE THREE THINGS THAT SURVIVED THE REWRITE, because they were
   never about scrolling:

   ── 1. Width, measured ──
   The panel this replaces on both surfaces was a `SourcePanel` in a
   half-grid: 564x320 of scroll box against a 690px longest line and
   a 27-line file, so it hid 45% of the file down the page and 21% of
   it across. This band is `container-page` wide, which is 1152px at
   1440, and it gives the listing two thirds of that: 727px of column
   against that 690px line, and every line of every blueprint in the
   archive on screen at once. That is why there is still no reel and
   no window clip — `CardWalk` slides a 52-line card through a 24-row
   viewport because the card cannot fit; the longest `topology.dot`
   in the archive is 27 lines, which is 558px of listing. Nothing
   here sets a height or a transform at any width.

   ── 2. Blue, and never copper, and never cyan ──
   `app/globals.css` gives the copper pole one job: the node card.
   The card figure and this one are two layers of the same spec and a
   reader has to tell them apart at a glance, so this is the
   cyanotype register.

   Not cyan for the MARKING: cyan is interactive sitewide and a lit
   line beside the page's cyan controls would read as "click me". The
   two controls in the figcaption ARE clickable and so they are cyan
   on hover, which is the rule applied rather than bent. Not amber:
   amber is `ComingSoonBadge` and `.route-box` and nothing else.

   Contrast, computed against the grounds this figure actually mixes
   — `bg-surface-2/40` over `bg-void` for the listing (#0a0b14),
   `bg-blueprint-line/10` over that for a picked row (#141c2b):

     blueprint-line          9.09 : 1   /  7.91 : 1  on a picked row
     blueprint-line at 80%   6.10 : 1   /  5.53 : 1  (the 11px step
                                                      number, AA)
     blueprint-line at 60%   3.87 : 1   /  3.70 : 1  (the rule, a
                                                      non-text
                                                      boundary, 3:1)
     blueprint-ink          14.95 : 1   / 13.01 : 1
     muted                   7.66 : 1   /  6.66 : 1

   ── 3. The static layout is the finished drawing ──
   Nothing here is emitted conditionally on a media query or on a
   mount. `selected` is `null` on the server, on the first client
   render and for every reader without script, and in that state
   every block wears the marked register it wears today: the join in
   blue on every node line, a rule down the margin per block, a step
   number on each block's first line, and every step in the rail with
   its body open. The highlight is strictly ADDITIVE — see
   `PICK_*` below. A click never takes colour away from the blocks it
   did not pick, because the figure's standing claim is that the join
   is on EVERY node line and a click is not an argument against it.

   ── Why the rail is buttons and one tab stop ──
   Each rail row is a real `<button type="button" aria-pressed>`: it
   is operable with Enter and Space natively, it takes the site's
   focus ring, and its state is a fact ARIA already has a word for.
   The rows are wired through `./listbox.ts`'s `useRovingListbox`,
   the same hook `SourcePane` uses, so the arrow keys walk the blocks
   with selection following focus — which reproduces the walk this
   figure used to perform on scroll, under the reader's own hand —
   and the whole rail is ONE tab stop rather than six between the
   file and whatever follows it.

   The body of a step is a `<span class="block">` and not a `<p>`:
   `<p>` is flow content and is invalid inside a button, and losing
   the body out of the control would mean the thing a reader clicks
   is not the thing they read.
   ============================================================ */

import { useCallback, useMemo, useRef, useState } from "react";

import { cx } from "@/lib/format";

import { useRovingListbox } from "./listbox";
import {
  lineSpan,
  resolveDotSteps,
  tokenizeDot,
  type DotStep,
  type DotTokenKind,
} from "./dot-breakdown";

/* ==================== geometry ==================== */

/**
 * The row height, DECLARED rather than inherited from the mono face's metrics.
 *
 * The mono face's default leading puts a 12px line at 21.6px, and the gutter marker beside
 * it is 11px with `leading-[20px]`. Two different line boxes in one row is how a marker
 * column drifts off the code it marks, a fraction of a line per line, until the number in
 * the margin sits beside the wrong statement near the bottom of a 27-line file.
 *
 * (This constant used to have five companions — `LIST_CHROME`, `FRAME`, `CAPTION`, `GAP`
 * and the `figureHeight`/`trackVh` arithmetic on top of them. All six existed to compute a
 * sticky offset and a vh track for the scroll walk. They are gone with it; this one is not
 * derived from anything and still sets the row.)
 */
const LINE = 20;

/**
 * The site's sticky `SiteHeader`, in px, plus a line of air.
 *
 * Read off `--z` ladder's header, which is `h-16`. Only `revealRow` uses it, and only to
 * decide that a row hidden UNDER the header is a row that is not on screen.
 */
const HEADER_CLEARANCE = 64 + 16;

/* ==================== the marking, in the blueprint register ==================== */

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
 * THE IMPORTANT TAG, and the four registers a pick lights.
 *
 * `card="id@version"` is the one attribute DarkPrint adds to DOT, and the three tokens of
 * it are marked as one kind by `dot-breakdown.ts` precisely so they can be lit together.
 *
 * Every `*_MARKED` class is unconditional — server, no-JS, nothing picked. Every `PICK_*`
 * class is added on top of it for the one block the reader chose. Nothing is ever removed:
 * the previous version of this figure dimmed unreached blocks to `text-muted`, which was
 * defensible while a scroll position meant "you have not read this yet" and is not
 * defensible when the reader's click means only "show me this one".
 *
 * `PICK_CARD` adds a ground as well as the colour — the one place this figure paints a
 * chip rather than only a hue. A marker-pen band over five identical attributes says
 * "these five" in a way a colour change on already-blue text cannot.
 */
const CARD_MARKED = "text-blueprint-line";
const PICK_CARD = "bg-blueprint-line/15";

/*
 * The row ground, and why only the PICKED block gets one.
 *
 * The steps TILE the file — every statement belongs to exactly one block, which
 * `dot-breakdown.test.ts` asserts against all nine blueprints — so grounding more than one
 * ends with the whole listing lit, which is the same as nothing being lit. The rule carries
 * "which lines are this block"; the ground carries "and this is the one you picked".
 */
const PICK_ROW = "bg-blueprint-line/10";

/* The rule is a boundary rather than a word, so it is held to 3:1 and not 4.5:1: the
   register's line at 60% measures 3.87:1 on the listing's ground, and the picked state is
   the same colour at full, 9.09:1. Blank lines and the closing brace carry no block, so the
   rule breaks between blocks and each step reads as its own bracket down the margin. */
const RULE_MARKED = "border-blueprint-line/60";
const PICK_RULE = "border-blueprint-line";

/* A step number IS a word, so the resting weight is 80% (6.10:1 at rest, 5.53:1 on a
   picked row) rather than the rule's 60%. Below 80 the register stops clearing AA at 11px. */
const STEP_MARKED = "text-blueprint-line/80";
const PICK_STEP = "text-blueprint-line";

interface LineMark {
  /** True on every line of the block the reader picked. */
  picked: boolean;
  /** Printed once per block, on its first line. */
  step?: number;
  /** 0-based step index, on the block's first line only: what `revealRow` scrolls to. */
  opens?: number;
}

/** Line number to marker, for the whole document. One pass over 27 lines, per render. */
function markLines(steps: readonly DotStep[], selected: number | null): Map<number, LineMark> {
  const marks = new Map<number, LineMark>();
  steps.forEach((step, index) => {
    const picked = index === selected;
    for (let line = step.from; line <= step.to; line += 1) {
      marks.set(line, {
        picked,
        ...(line === step.from ? { step: step.step, opens: index } : {}),
      });
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

/**
 * A step's title, said aloud.
 *
 * `edgeTitle` spells its heads with `→` and `⇄` because they are the shortest true drawing
 * of an edge and of a loop. Neither has a reliable spoken form — VoiceOver reads `⇄` as
 * "left right arrow" mid-sentence and NVDA reads it as nothing at all — so the live region
 * gets words. The visible head keeps its glyphs; this is the same title, respelled.
 */
function spoken(title: string): string {
  // \u21c4 and \u2192 escaped so the pattern survives being read as non-UTF-8; the
  // literal glyphs would stop matching without erroring.
  return title.replace(/\s*\u21c4\s*/g, " and ").replace(/\s*\u2192\s*/g, " to ");
}

/**
 * Bring a row on screen, minimally, and only when a reader has just asked for it.
 *
 * Below `lg` the rail stacks UNDER a listing that is up to 556px tall, so picking the last
 * block highlights lines that are entirely off screen — the one problem the scroll walk did
 * not have, because it only ran at `lg`. `scrollIntoView` is the obvious fix and the wrong
 * one twice over: it ignores the 4rem sticky header, and `inline: "nearest"` on a row that
 * is wider than its own horizontal scroll box snaps the listing back to column 0 under a
 * reader who had scrolled right to read a long line.
 *
 * So: measure, move vertically, and move as little as possible. A row already in view moves
 * nothing at all, which is every pick at `lg`. `Math.min` on the second branch is for a
 * block taller than the viewport: pulling its BOTTOM into view would push its first line —
 * the one carrying the step number — off the top.
 *
 * No `behavior`, deliberately. `behavior: "auto"` is CSSOM-View's "use the element's own
 * `scroll-behavior`", and `app/globals.css` already sets `html { scroll-behavior: smooth }`
 * with an `auto` override under `prefers-reduced-motion`. Reading the media query a second
 * time here would be a second answer to a question the stylesheet has already answered, and
 * spec §2a allows the site exactly one `matchMedia`.
 */
function revealRow(row: HTMLElement): void {
  const rect = row.getBoundingClientRect();
  const floor = window.innerHeight - 16;
  const above = rect.top - HEADER_CLEARANCE;
  let delta = 0;
  if (above < 0) delta = above;
  else if (rect.bottom > floor) delta = Math.min(rect.bottom - floor, above);
  if (delta === 0) return;
  window.scrollBy({ top: delta });
}

/* ==================== the figure ==================== */

export function DotBreakdown({
  source,
  title,
  downloadName,
  walkTo,
  className,
}: {
  /** The DOT document, verbatim, read off the archive by the server half. */
  source: string;
  /** `<slug>/topology.dot`, the name the file is stored and downloaded under. */
  title: string;
  /**
   * Offer the file as a download, under this name.
   *
   * Optional because the two surfaces differ on exactly this point. `/spec/topology`
   * replaced a `SourcePanel` that had a download button, and dropping it would be a
   * regression the reader did not ask for; a blueprint page carries the same file in its
   * own `Download` disclosure a few hundred pixels below, and a second button for the same
   * bytes is two answers to one question.
   */
  downloadName?: string;
  /**
   * Drive the figure from outside, one block at a time.
   *
   * `undefined` leaves it exactly as `/spec/topology` has it: nothing lit until a reader
   * picks a block, and every note listed beside the file so the whole argument can be read
   * at once. That is right for a page somebody is studying.
   *
   * A number turns it into a walk. The block is lit, and the notes column renders THAT NOTE
   * ONLY. The author asked for this on the landing (2026-08-08): "while scrolling highlights
   * the part of the code the right the identify and make the text elements appear when
   * highlighting a given part and disappear when moving to the next".
   *
   * The vertical saving is the point. Five notes stacked run about three times the listing's
   * height, so the landing's swap reserved a box sized for a column nobody was reading yet
   * and left the drawing floating in the empty half of it. One note is shorter than the
   * listing, so the figure is as tall as its own code.
   */
  walkTo?: number;
  className?: string;
}) {
  /* `.trimEnd()`, the way `SectionNodeIsCard` trims the card before handing it to
     `CardWalk`. Every file in `content/blueprints/` ends with a newline, and splitting on
     it yields a final empty line: the starter drew 28 rows for a 27-line file and printed
     "28 lines, as the archive stores them" under a file that has 27. */
  const text = useMemo(() => source.trimEnd(), [source]);
  const lines = useMemo(() => tokenizeDot(text), [text]);
  const steps = useMemo(() => resolveDotSteps(text), [text]);

  /**
   * The whole of this figure's state: which block, or none.
   *
   * `null` and not `0`. A figure that opens with its first block lit has answered a
   * question nobody asked, and it would make the first render differ from the server's.
   */
  const [picked, setPicked] = useState<number | null>(null);

  /* A driven figure ignores its own state: the scroll is the only thing choosing, and a
     click that lit a different block would fight the next scroll frame for it. `walkTo` is
     clamped rather than trusted, so a caller's arithmetic cannot index past the file. */
  const driven = walkTo !== undefined;
  const selected = driven
    ? Math.min(Math.max(walkTo, 0), Math.max(0, steps.length - 1))
    : picked;
  const [copied, setCopied] = useState(false);

  /** One entry per block, pointing at the row that opens it. Filled by the listing below. */
  const rowRefs = useRef<(HTMLElement | null)[]>([]);

  const pick = useCallback((index: number) => {
    setPicked(index);
    const row = rowRefs.current[index];
    if (row !== null && row !== undefined) revealRow(row);
  }, []);

  /* Every block is pickable: unlike `SourcePane`, whose rows include braces and blank lines
     that name nothing, a step is a block by construction and there is nothing here to skip
     over. */
  const selectable = useMemo(() => steps.map(() => true), [steps]);

  const list = useRovingListbox({
    selectable,
    activeIndex: selected ?? -1,
    onActivate: pick,
  });

  const marks = markLines(steps, selected);
  const gutter = String(lines.length).length;

  const chosen = selected === null ? undefined : steps[selected];

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  const href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;

  /* Plain ground and one hairline, the frame `CardWalk` and `/what-a-blueprint-is`'s
     figures use. Not a `.panel`: this band is the page's one figure and a panel frame would
     file it with `Tool scopes`. */
  return (
    <figure
      className={cx(
        "flex flex-col gap-4 rounded-xl border border-line bg-void p-4 sm:p-5",
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-mono text-[11px] leading-[18px] text-dim">
        <span className="flex items-center gap-2">
          {/* The register's own glyph and not `SourcePanel`'s cyan one. Cyan is spent in
              this header on the two things that are actually clickable, to the right. */}
          <span className="text-blueprint-line" aria-hidden>
            ▤
          </span>
          <span className="text-muted">{title}</span>
        </span>
        {/* `flex-wrap` on the group and `whitespace-nowrap` on the count, which is the fix
            for a real 390 defect: without them the count is the only shrinkable thing in
            the row, so it broke into three ragged lines beside two buttons instead of the
            group taking a second line. Now the count holds its line and the controls drop
            under it. */}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="whitespace-nowrap">
            {lines.length} lines, as the archive stores them
          </span>
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
          {downloadName !== undefined && (
            <a
              href={href}
              download={downloadName}
              aria-label={`Download ${downloadName}`}
              className="rounded border border-line px-2 py-0.5 text-muted transition-colors hoverable:hover:border-cyan hoverable:hover:text-cyan"
            >
              download
            </a>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "DOT source copied to the clipboard" : "Copy the DOT source"}
            className="rounded border border-line px-2 py-0.5 text-muted transition-colors hoverable:hover:border-cyan hoverable:hover:text-cyan"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
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
              const marked = mark !== undefined;
              const picked = mark?.picked === true;
              /* Hoisted out of the `ref` so the callback closes over a `number` rather than
                 over the map entry: TypeScript cannot narrow `mark?.opens` inside a closure,
                 and the cast that silences it is a cast that would survive the property
                 being renamed. */
              const opens = mark?.opens;
              return (
                <div
                  key={line.no}
                  ref={
                    opens === undefined
                      ? undefined
                      : (element) => {
                          rowRefs.current[opens] = element;
                        }
                  }
                  /* Declared, never inherited — see `LINE`. */
                  style={{ height: LINE }}
                  className={cx("flex items-center", picked && PICK_ROW)}
                >
                  <span
                    aria-hidden
                    /* 11px, not 10 and certainly not 9: the site's mono floor is 11px
                       with no exceptions, and this marker is what joins a block of the
                       file to the numbered button that describes it. */
                    className={cx(
                      "w-6 shrink-0 select-none self-stretch border-l-2 pl-1 text-[11px] leading-[20px]",
                      marked ? RULE_MARKED : "border-transparent",
                      marked && STEP_MARKED,
                      picked && PICK_RULE,
                      picked && PICK_STEP,
                    )}
                  >
                    {/* Two digits, the same spelling the rail uses. `YamlListing`
                        prints its marker bare because a nine-step walk is always one
                        digit and the two columns never disagree; this figure resolves
                        between three and six blocks per blueprint, and "5" in the
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
                          token.kind === "card" ? CARD_MARKED : TOKEN_CLASS[token.kind],
                          token.kind === "card" && picked && PICK_CARD,
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

        {/* The rail: one button per block, every body open, all of it in the server's
            HTML. `aria-label` on the list because the roving tab stop makes this a
            composite the reader arrows through, and a composite with no name is a stop
            that announces nothing. */}
        <ol
          aria-label={`Blocks of ${title}`}
          onKeyDown={list.onKeyDown}
          className="flex min-w-0 flex-col"
        >
          {/* Every step, in every mode. A driven figure showed ONLY the selected one for one
              revision, and the author asked for the rail back: "on the right are always
              present the title of the 5 sections and when scrolling each of them in an
              ordered way, get uncollapsed much like in the card node yaml below."

              They are right, and the node card is the precedent to follow: `CardWalk` has
              always drawn all nine heads with one body open, so the figure says how many
              parts a file has before it has walked any of them, and a reader can see what
              is coming. One head at a time said nothing about the shape of the file, and it
              made the panel's height change under the reader as each note replaced the
              last. The BODY is what collapses now, which is the thing the original change
              was actually about. */}
          {steps.map((step, i) => {
            const isPicked = i === selected;
            return (
              <li key={step.step} className="border-t border-line/70 first:border-t-0">
                <button
                  type="button"
                  aria-pressed={isPicked}
                  tabIndex={list.tabIndexFor(i)}
                  ref={list.setRef(i)}
                  onClick={() => list.onClickIndex(i)}
                  /* `transition-[color,border-color]` and never the `transition-colors`
                     shorthand: that shorthand includes `outline-color`, and this element
                     takes the site's focus ring. `app/globals.css` kills the transition
                     while focused anyway, and relying on that would be a rule held up by
                     another rule's side effect. */
                  /* `hoverable:` and never a bare `hover:`, per `app/globals.css`: a touch
                     pointer has no "leave", so a tapped row on a phone would latch its
                     hover rule and sit there looking picked beside the row that IS. And
                     the hover rule is 30%, not 60% or 100% — a hint that this row can be
                     picked, at a weight nobody could mistake for the picked one, whose
                     number and line span go blue as well. */
                  className={cx(
                    "group flex w-full flex-col gap-1.5 border-l-2 py-2.5 pl-2.5 text-left transition-[color,border-color]",
                    i === 0 && "pt-0",
                    isPicked
                      ? PICK_RULE
                      : "border-transparent hoverable:hover:border-blueprint-line/30",
                  )}
                >
                  <span className="flex items-baseline gap-3">
                    <span
                      aria-hidden
                      className={cx(
                        "shrink-0 font-mono text-[11px] tabular-nums transition-[color]",
                        isPicked ? "text-blueprint-line" : "text-dim",
                      )}
                    >
                      {ordinal(step.step)}
                    </span>
                    <span
                      className={cx(
                        "min-w-0 flex-1 font-mono text-[13px] leading-snug transition-[color]",
                        isPicked ? "text-fg" : "text-muted hoverable:group-hover:text-fg",
                      )}
                    >
                      {step.title}
                    </span>
                    {/* `text-dim` and not `text-faint`: `--color-faint` is 1.83:1 and is
                        reserved for decorative separators, and this is the only thing
                        joining a block to its lines. */}
                    <span
                      className={cx(
                        "shrink-0 font-mono text-[11px] tabular-nums transition-[color]",
                        isPicked ? "text-blueprint-line" : "text-dim",
                      )}
                    >
                      {lineSpan(step.from, step.to)}
                    </span>
                  </span>

                  {/* A `<span class="block">` and not a `<p>`: flow content is invalid
                      inside a button.

                      Open in every state when a reader is CLICKING — there is no collapse
                      to shift the rail under their cursor as they go down it — and only on
                      the selected step when the scroll is choosing, which is what the
                      author asked for and what `CardWalk` does with its nine.

                      `sr-only` and never `hidden`, the fix `CardWalk`'s own note records:
                      `display: none` takes an element out of the accessibility tree as well
                      as out of the layout, so four of the five bodies would be unreachable
                      to a screen reader, to find-in-page and to a text extractor, with the
                      only route to them being a 300vh scroll one step at a time. `sr-only`
                      is a 1px clip, so the rail measures the same and the words are still
                      there. */}
                  <span
                    className={cx(
                      "block pl-[1.9rem] text-[13px] leading-relaxed text-muted",
                      driven && !isPicked && "sr-only",
                    )}
                  >
                    {body(step.body)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Mounted always and empty until a pick, the device `SynchronisedPanes` uses: a live
          region inserted at the moment it has something to say is a region a screen reader
          has not been watching. `aria-pressed` carries the button's own state; this carries
          the consequence — which lines of the OTHER pane just changed. Spelled in words,
          because `lineSpan`'s en dash reads as "L12 dash 18" or as nothing. */}
      <p aria-live="polite" className="sr-only">
        {chosen === undefined
          ? ""
          : `Block ${chosen.step} of ${steps.length}, ${spoken(chosen.title)}, highlighted ` +
            (chosen.from === chosen.to
              ? `on line ${chosen.from} of ${title}.`
              : `on lines ${chosen.from} to ${chosen.to} of ${title}.`)}
      </p>
    </figure>
  );
}
