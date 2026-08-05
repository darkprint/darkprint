"use client";

/* ============================================================
   The landing's card, walked one part at a time.

   ── What the author asked for ──
   "I'd like you reprohose in the home in the current Every node is
   a card the idea reported in spec/card, where you scroll down and
   you can show all the component of a card. But in a lightweight
   version without using as background the blueprint."

   So this is `NodeCardStage`'s idea at a third of its weight, and
   the reversal of a decision this file's own predecessor recorded:
   the beat carried an annotated listing, redesign spec §2 ruled a
   YAML block off the landing, and the listing moved whole to
   `/spec/card`. It is back, deliberately, in a form the landing can
   carry. `SectionNodeIsCard` says so where the old note stood, so
   the next author does not move it off again on the strength of a
   spec line the author has since overruled.

   ── What "lightweight" cost, item by item ──
   `NodeCardStage` is 361 lines and a 420vh track. Four of its parts
   are gone:

     the Sheet          the blue graticule ground, which is the one
                        thing the author named. This sits on plain
                        `bg-void` behind a hairline, the same frame
                        `/what-a-blueprint-is`'s figures use.
     the leader         an elbow drawn from the run being read to
                        the note about it, with the pixel geometry
                        that costs. The listing's own highlight and
                        the open note say the same thing here.
     the dezoom         the card shrinking into a node of the
                        starter graph at the end. That is the
                        payoff of a page about the card layer, and
                        on a landing beat it is a second subject.
     the reserve        the track is 240vh against 420, because
                        there is no dezoom to reserve a quarter of
                        the scroll for.
     the tail link      "read this card", taken out on the author's
                        instruction along with beat 2's "Open this
                        blueprint". `beats.test.ts` records what
                        that costs and what still holds.

   What survives is the part the author asked for: seven parts of a
   real card, arriving one at a time, each marking its own lines.

   ── Why one DOM and not two ──
   `NodeCardStage`'s reasoning, unchanged and load-bearing here too.
   The choreography classes all carry `lg:` and are emitted only
   when `motion` is true, and `motion` is false on the server and on
   the first client render. So the prerendered markup is the static
   layout: the whole listing, all seven notes, no clipping. A phone
   reader and a reader who asked for stillness get that, and so does
   a crawler.
   ============================================================ */

import { useMemo } from "react";

import { stagesShown, useScrollProgress } from "@/components/viz/useScrollProgress";
import { cx } from "@/lib/format";

import { resolveAnnotations } from "./annotations";
import { NC } from "./geometry";
import { YamlListing } from "./YamlListing";
import { tokenizeYaml } from "./yaml";

/**
 * The window the listing scrolls inside.
 *
 * Eighteen whole rows, and the container's own padding added on top of them. Twelve rows
 * with the padding inside the height left 11.27 rows of room, so the clip fell through the
 * middle of a line of YAML and the figure opened on half a sentence. It is also the height
 * that balances the rail beside it: seven heads and one open body come to roughly 520px,
 * and twelve rows came to 264.
 */
const ROWS = 18;
const PAD_Y = 16;
const WINDOW = ROWS * NC.line;

/** Rows kept above the run being read, so a reader sees what comes before it. */
const PARK = 3;

/**
 * How far to slide the listing so the run starting at `from` sits under the head-room.
 *
 * `geometry.ts` has `reelShift` and it is not reused: it clamps against `NC.window`, the
 * full stage's 420px, and this window is 264. Sharing it would let the listing slide past
 * its own last line by exactly the difference.
 */
function shiftFor(from: number, totalLines: number): number {
  const wanted = (from - 1 - PARK) * NC.line;
  const furthest = Math.max(0, totalLines * NC.line - WINDOW);
  const y = Math.min(Math.max(wanted, 0), furthest);
  // Negating zero gives -0, which stringifies into `translateY(-0px)`.
  return y === 0 ? 0 : -y;
}

/** Two digits, so the numbers form a column rather than a ragged edge. */
function ordinal(step: number): string {
  return String(step).padStart(2, "0");
}

/** `L17` for one line, `L24-27` for a run. */
function span(from: number, to: number): string {
  return from === to ? `L${from}` : `L${from}–${to}`;
}

/** Backticked identifiers in an annotation body render as inline code. */
function body(text: string): React.ReactNode[] {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px] text-fg">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

export function CardWalk({
  source,
  cardRef,
}: {
  /** The card document, verbatim, read off the archive by the server half. */
  source: string;
  cardRef: string;
}) {
  const lines = useMemo(() => tokenizeYaml(source), [source]);
  const notes = useMemo(() => resolveAnnotations(source), [source]);

  const { ref, progress, motion } = useScrollProgress<HTMLDivElement>({ steps: 120 });

  /* Pacing, and why these two numbers are what they are.
     ------------------------------------------------------------
     `scrollProgress` measures the pin as `height - viewport`, which is exact when the
     sticky child is a full screen tall. This one is about 530px, so the real pin lasts
     `height - 530` and the reported progress reaches 1 well before the figure lets go. The
     first build ran all seven steps inside the opening 45% of the section and then held
     step 7 pinned for the rest, which is the worst version of this pattern: a reader
     scrolls and nothing answers.

     Two numbers fix it without touching the shared hook, which `NodeCardStage` also
     drives. The track is sized so the reported progress and the real pin end close
     together, and the tail reserve is small because there is no dezoom here to spend it
     on: the last note only needs to be readable, not to hand over to a second figure. */
  const shown = motion ? stagesShown(progress, notes.length, { head: 0.04, tail: 0.04 }) : notes.length;
  const active = motion ? Math.min(notes.length, Math.max(1, shown)) - 1 : -1;
  const open = active >= 0 ? notes[active] : undefined;

  return (
    <div ref={ref} className={cx(motion && "lg:h-[240vh]")}>
      {/* Centred while pinned, not tucked under the header.
          ------------------------------------------------------------
          The author: it "should start scrolling the list of fields when it is in the
          middle of the page and not when it is high". `top-24` pinned the figure 96px
          down, so the walk began with it against the top edge.

          `calc(50vh - 16.5rem)` is half a viewport less half the figure, which centres it
          at any height and degrades to a small positive offset on a short screen rather
          than to a negative one. It also buys the settle the author is asking for for
          free: the figure locks when the track's top reaches that offset, and
          `scrollProgress` only starts counting once the top passes zero, so the figure
          sits centred and still for those pixels before step 2 arrives. */}
      <div
        className={cx(motion && "lg:sticky lg:top-[calc(50vh-16.5rem)]")}
      >
        {/* Plain ground, one hairline. The author named the graticule as the thing to
            drop, and it is the whole difference between a figure the landing carries and
            a plate that reads as its own page. */}
        <figure className="flex flex-col gap-4 rounded-xl border border-line bg-void p-4 sm:p-6">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-dim">
            <span className="text-muted">{cardRef}</span>
            <span>
              {lines.length} lines, as the archive stores them
            </span>
          </figcaption>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
            {/* The listing. Clipped to a window and slid, but only while the
                choreography runs; otherwise it stands at its own height and a reader
                scrolls the page past it. */}
            {/* `overflow-x-auto` always, and the height clip only while the walk runs.
                The pair is `NodeCardStage`'s, and it is the only combination that works:
                a card's `spec` runs past any column this figure could be given, so the
                listing has to scroll sideways, and CSS resolves `overflow-y: hidden`
                beside `overflow-x: auto` back to `auto` if you write it the other way
                round. A fixed height plus `overflow-y-hidden` states the clip without
                asking the two axes to disagree. */}
            <div
              className={cx(
                "min-w-0 overflow-x-auto rounded-lg border border-line bg-surface-2/40 py-2",
                motion && "lg:h-[var(--walk-window)] lg:overflow-y-hidden",
              )}
              /* The height goes through a custom property so the `lg:` prefix can gate it.
                 As an inline `height` it applied at every width, and a fixed height beside
                 `overflow-x: auto` makes the box scrollable on both axes, so a phone got a
                 264px nested scroller holding a 52-line file. `NodeCardStage`'s own note
                 states the rule this broke: "the sticky-scroll choreography must not trap
                 a phone reader". Below `lg` the listing now stands at its full height and
                 the page scrolls past it. */
              style={{ "--walk-window": `${WINDOW + PAD_Y}px` } as React.CSSProperties}
            >
              <div
                className={cx(motion && "lg:transition-transform lg:duration-500 lg:ease-out")}
                style={
                  motion && open !== undefined
                    ? { transform: `translateY(${shiftFor(open.from, lines.length)}px)` }
                    : undefined
                }
              >
                <YamlListing
                  lines={lines}
                  annotations={notes}
                  shown={shown}
                  active={active}
                  live={motion}
                />
              </div>
            </div>

            {/* The seven parts. Every title is on screen from the start, so the figure
                says how many parts a card has before it has walked any of them, and the
                one being read opens under its own head. */}
            <ol className="flex min-w-0 flex-col">
              {notes.map((note, i) => {
                const reached = !motion || i < shown;
                const isOpen = i === active;
                return (
                  <li
                    key={note.id}
                    className="border-t border-line/70 py-2.5 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        aria-hidden
                        className={cx(
                          "shrink-0 font-mono text-[11px] tabular-nums transition-colors",
                          isOpen ? "text-cyan" : reached ? "text-dim" : "text-faint",
                        )}
                      >
                        {ordinal(note.step)}
                      </span>
                      <h3
                        className={cx(
                          "min-w-0 flex-1 text-[15px] font-medium leading-snug transition-colors",
                          isOpen ? "text-fg" : reached ? "text-muted" : "text-dim",
                        )}
                      >
                        {note.title}
                      </h3>
                      <span
                        className={cx(
                          "shrink-0 font-mono text-[11px] tabular-nums transition-colors",
                          isOpen ? "text-cyan" : "text-faint",
                        )}
                      >
                        {span(note.from, note.to)}
                      </span>
                    </div>

                    {/* Open under its own head while the walk is running; all seven open
                        in the static layout, which is what makes the prerendered markup
                        readable without script. */}
                    <p
                      className={cx(
                        "mt-1.5 pl-[1.9rem] text-[13px] leading-relaxed text-muted",
                        motion && !isOpen && "lg:hidden",
                      )}
                    >
                      {body(note.body)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </figure>
      </div>
    </div>
  );
}
