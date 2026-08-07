"use client";

/* ============================================================
   The card, walked one part at a time. Both mounts of it.

   ── What the author asked for, twice ──
   First for the landing: "I'd like you reprohose in the home in the
   current Every node is a card the idea reported in spec/card,
   where you scroll down and you can show all the component of a
   card. But in a lightweight version without using as background
   the blueprint."

   Then, of the reference page the lightweight version was derived
   from: "make /spec/card's scrollable node panel the same as the
   home's", and "it should scroll in the middle of the screen". So
   this file is now what BOTH `/` and `/spec/card` draw, and the
   fork it was written as a copy of — `NodeCardStage`, 534 lines, a
   `calc(100vh + 2500px)` track, a leader line and a dezoom — is
   deleted rather than kept as a second answer to one question.

   ── What "lightweight" cost, item by item ──
   Recorded because these are deletions from the reference page as
   well now, and none of them is free:

     the Sheet          the blue graticule ground, which is the one
                        thing the author named. This sits on plain
                        `bg-void` behind a hairline, the same frame
                        `/what-a-blueprint-is`'s figures use.
     the leader         an elbow drawn from the run being read to
                        the note about it, with the pixel geometry
                        that costs. The listing's own highlight and
                        the open note say the same thing here.
     the dezoom         the card shrinking into a node of the
                        starter graph at the end. `/spec/card` was
                        its only mount, so asking for the home's
                        version of this figure took it off the site;
                        `components/viz/scene-labels.test.ts` and
                        `ssr.test.ts` record the same removal where
                        they used to measure it.
     the reserve        the track is 190vh rather than 420, because
                        there is no dezoom to reserve a quarter of
                        the scroll for.
     the per-head       every rail head was a `<button>` scrolling
     buttons            the page to its own step. Nothing here is
                        clickable: the reader's gesture is the only
                        control, which is what makes the pin honest.

   What survives is the part the author asked for both times: nine
   parts of a real card, arriving one at a time, each marking its
   own lines.

   ── The one thing that differs between the two mounts ──
   `bodies`. The landing gets 25-word wording written for it; the
   reference page gets `annotations.ts`'s 45-word bodies, which are
   the ones `nodecard.test.ts` holds to the diagnostic codes the
   site can be grepped for. Everything else — the window, the
   pacing, the sticky offset, the ground — is the same figure.

   ── Why one DOM and not two ──
   The choreography classes all carry `lg:` and are emitted only
   when `motion` is true, and `motion` is false on the server and on
   the first client render. So the prerendered markup is the static
   layout: the whole listing, all nine notes, no clipping. A phone
   reader and a reader who asked for stillness get that, and so does
   a crawler.
   ============================================================ */

import { useMemo } from "react";

import { stagesShown, useScrollProgress } from "@/components/viz/useScrollProgress";
import { cx } from "@/lib/format";

import { resolveAnnotations } from "./annotations";
import { NC, reelShift } from "./geometry";
import { YamlListing } from "./YamlListing";
import { tokenizeYaml } from "./yaml";

/**
 * The chrome around the window the listing scrolls inside.
 *
 * `NC.rows` whole rows, and nothing else. The arithmetic, because it has gone wrong
 * three times in the same place:
 *
 *   window   24 × NC.line = 528px of YAML, whole rows only
 *   chrome   PAD_Y = 2, the 1px border on each side and NOTHING MORE
 *   declared 528 + 2 = 530px, which `box-sizing: border-box` resolves to a 528px
 *            padding box — and the padding box is where `overflow: hidden` clips
 *
 * The trap, and it is not the obvious one. PAD_Y was 16 and counted `py-2` at both ends;
 * raising it to 18 to cover the border is still wrong, and measurement says so: with
 * `padding: 8px 0` the rows start 8px down and the clip is 544px, so 536px of window
 * holds 24 rows and the top eight pixels of a twenty-fifth. **A scroll container's
 * bottom padding does not hold a blank strip open at the bottom of the window.** It sits
 * after the last line of the file, 1160px down, and the space it appeared to reserve at
 * the visible edge is filled by the next row of content.
 *
 * The same argument runs at the top the moment the reel moves. Every shift `reelShift`
 * returns is a whole multiple of `NC.line`, so with the padding gone the window shows 24
 * whole rows in every state it can be in, and with 8px of padding it shows the bottom
 * 8px of one row, 23 whole ones, and the top 14px of another — in every state except the
 * first. Hence `lg:py-0`: the padding is right on a phone, where the listing stands at
 * its own height and has no window to align to, and wrong the instant there is one.
 */
const PAD_Y = 2;

/**
 * The landing's wording for the nine parts. Roughly 25 words each, against the 45 that
 * `annotations.ts` carries.
 *
 * The long bodies stay where they are and are not edited: they are `/spec/card`'s, and
 * `nodecard.test.ts` holds three of them to the diagnostic codes the site can be checked
 * on (`bundle/prohibition-violated`, `bundle/port-mismatch`, `llm_model`). That is
 * reference material and it belongs on the reference page, which reaches it by passing
 * `bodies={{}}` — an empty override, so every note falls through to `note.body`.
 *
 * What the landing needs from the same nine parts is smaller: which part of a card this
 * is, and why anyone would write it down. Beat 3 carried 670 of the landing's 1090 words
 * with the reference sentences in it, on the page whose job is to get a reader as far as
 * the archive. The `L1–4` marks in the listing do the pointing that a sentence naming
 * line numbers would otherwise have to.
 *
 * Keyed by `AnnotationSpec.id`, and anything unkeyed falls back to the long body, so a
 * new part appears here in full rather than not at all.
 *
 * Measured before the reference bodies were let into this layout: the notes column is
 * 433px at `lg`, one body is open at a time, and the nine heads plus the longest of the
 * long bodies come to 470px against the listing's 530px window beside them. So the
 * figure's height — and therefore the sticky half-height below — is the listing's in
 * both mounts, and the two wordings do not need two constants.
 */
const WALK_BODY: Record<string, string> = {
  identity:
    "The first four lines fix identity. `code-builder` is the id a graph pins by version, " +
    "`agent` means a model runs this box, and `implementation` places it in the lifecycle.",
  action:
    "One line for what the node does. Nothing in the engine reads it, and it travels into " +
    "the download unchanged, for whoever opens the card next.",
  spec:
    "The brief an agent is handed when the graph is instantiated on your own machine. It has " +
    "to stand alone: whatever reads it never sees the rest of the graph.",
  // "the compiled export", not `factory.dot`: the author asked for that name off the
  // landing, and this walk renders there. Still true — the model line lands in the
  // compiled file and not in `blueprint.dot`, which carries no `model` line at all.
  model:
    "Which model the agent is instantiated with. The compiled export carries it, and " +
    "a card that names none inherits whatever the run supplies.",
  skill:
    "A pointer to where the behaviour is written. The engine reads nothing at the other end, " +
    "so no skill document travels in the download. You supply it.",
  reach:
    "`tools` is empty and `mcp` names one server, so this node touches the filesystem and " +
    "nothing else. A factory's whole reach reads off its cards before anything runs.",
  inputs:
    "One input, and it carries a type. `brief` is a `plan`, an ontology term rather than free " +
    "text, so the resolver can check an incoming edge against it.",
  outputs:
    "One output, typed the same way. `build` is `code`, and it is what the edge to the " +
    "acceptance tester carries. A downstream mismatch fails the bundle.",
  cannot:
    "The prohibition, and the engine holds the graph to it. An edge carrying " +
    "`acceptance-criteria` into this node fails the bundle rather than warning about it.",
};

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
  bodies = WALK_BODY,
}: {
  /** The card document, verbatim, read off the archive by the server half. */
  source: string;
  cardRef: string;
  /**
   * Per-step wording, keyed by `AnnotationSpec.id`, overriding `annotations.ts`.
   *
   * Defaults to the landing's short set. `/spec/card` passes `{}`, which is not the same
   * as passing nothing: an empty record overrides no step, so every note falls through to
   * its long reference body. The two mounts differ here and nowhere else.
   */
  bodies?: Record<string, string>;
}) {
  const lines = useMemo(() => tokenizeYaml(source), [source]);
  const notes = useMemo(() => resolveAnnotations(source), [source]);

  const { ref, progress, motion } = useScrollProgress<HTMLDivElement>({ steps: 120 });

  /* Pacing, worked out rather than guessed, at a 1440 × 900 reference viewport.
     ------------------------------------------------------------
     `scrollProgress` measures the pin as `height - viewport`. That is exact only when the
     sticky child is a full screen tall, and this one measures 612.5px pinned at
     `50vh - 19.25rem` = 142px, so the two clocks disagree by a fixed amount:

       reported span   R = 1710 - 900               = 810px  (progress 0 → 1)
       real pin        P = 1710 - 612.5 - 142       = 955px  (lock → release)

     P - R = 146px in which the figure is still pinned and `progress` is already 1. That
     gap is structural: it is `viewport - figureHeight - stickyTop`, which for a centred
     figure is `viewport/2 - figureHeight/2`. It shrinks only as the figure grows, which
     is one more thing C bought.

     Everything after the last step is dead scroll, so the last step is pushed as late as
     the arithmetic allows. The last of nine attaches at `head + (8/9)(1 - head - tail)`:

       tail 0.04  → 0.867 → 702px → 253px frozen
       tail 0     → 0.893 → 723px → 232px frozen

     which is one step's worth of dwell on the last note plus the structural 146px, and is
     the floor. THE PLAN SAID `tail: 0.20`; that is the wrong direction and it is recorded
     here rather than silently followed. A tail reserve moves the last step EARLIER, and
     lengthens the gap the change was written to close. There is still no dezoom here to
     spend a reserve on.

     The track was 240vh, came down to 170vh when that was where 436px of frozen scroll
     was going, and is 190vh now that the walk carries nine parts rather than seven. The
     20vh buys the pace back exactly: a step is `(1/9) × 0.96 × 810 = 86px`, which is the
     number seven steps had at 170vh. Two more notes at the same pace, for a fifth of a
     screen of landing. Leave the pace alone and each step would have fallen to 67px,
     which is under a single trackpad flick and would have made the walk skip. */
  const shown = motion ? stagesShown(progress, notes.length, { head: 0.04, tail: 0 }) : notes.length;
  const active = motion ? Math.min(notes.length, Math.max(1, shown)) - 1 : -1;
  const open = active >= 0 ? notes[active] : undefined;

  return (
    <div ref={ref} className={cx(motion && "lg:h-[190vh]")}>
      {/* Centred while pinned, not tucked under the header.
          ------------------------------------------------------------
          The author: it "should start scrolling the list of fields when it is in the
          middle of the page and not when it is high". `top-24` pinned the figure 96px
          down, so the walk began with it against the top edge.

          `calc(50vh - 19.25rem)` is half a viewport less half the figure, which centres
          it at any height. It also buys the settle the author is asking for for free: the
          figure locks when the track's top reaches that offset, and `scrollProgress` only
          starts counting once the top passes zero, so the figure sits centred and still
          for those pixels before step 2 arrives.

          19.25rem, not 16.5: the figure grew with `NC.rows` and half of it grew with it. The
          two numbers have to move together or the walk pins off-centre, high by the
          difference. 308px is half of the 612.5px the figure measures at `lg` — 530 of
          window, 24 of `sm:p-6` at each end, 16 of `gap-4` and 18.5 of figcaption.

          `max(4rem, …)` is the floor the old comment claimed for free and no longer got.
          Half the figure is 308px, so `50vh - 19.25rem` turns negative below a 616px
          viewport and would pin the figcaption under the 4rem sticky header. A window
          that short cannot hold the whole figure either way; what the floor decides is
          which end gets cut, and the top is where the card names itself. */}
      <div
        className={cx(motion && "lg:sticky lg:top-[max(4rem,calc(50vh_-_19.25rem))]")}
      >
        {/* Plain ground, one hairline. The author named the graticule as the thing to
            drop, and it is the whole difference between a figure the landing carries and
            a plate that reads as its own page. */}
        <figure className="flex flex-col gap-4 rounded-xl border border-line bg-void p-4 sm:p-6">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-dim">
            <span className="text-muted">{cardRef}</span>
            <span className="flex items-baseline gap-3">
              <span>{lines.length} lines, as the archive stores them</span>
              {/* What the fade on the listing's right edge means, said in words.
                  A card's `spec` runs past any column this figure can be given, macOS
                  draws no scrollbar at rest, and the cut then reads as a bug rather than
                  as an edge. `aria-hidden` because the region below announces itself and
                  its length, and an arrow read aloud is noise. */}
              <span aria-hidden className="shrink-0 whitespace-nowrap text-dim/70">
                scroll →
              </span>
            </span>
          </figcaption>

          {/* 1.5fr against 1fr, not 1.05.
              ------------------------------------------------------------
              Measured at 1440: the listing had 552px of column against 784px of content,
              so 17 of the 52 rows lost their last ~32 characters and sentences ended
              mid-word ("...emit the source it describes, addin"). At 1.5fr the listing
              measures 647px and the notes keep 433px, which still holds the shortened
              bodies in three lines at 13px. 137px of a folded `spec` still runs past the
              edge and always will — no column this figure can be given holds it — so what
              is left over is marked as an edge rather than left to look like a cut. */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
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
              /* A scroll container with no focusable child cannot be reached from the
                 keyboard at all (WCAG 2.1.1, Level A): there is nothing to tab to, so the
                 32 characters past the right edge are available to a mouse and to nobody
                 else. `role="region"` with a name is what makes the stop worth having —
                 "code-builder@1.0.0, 52 lines" rather than an unlabelled group. */
              tabIndex={0}
              role="region"
              aria-label={`${cardRef}, ${lines.length} lines`}
              className={cx(
                "min-w-0 overflow-x-auto rounded-lg border border-line bg-surface-2/40 py-2",
                /* The right edge, faded, so the truncation is a statement and not a
                   glitch. It has to be on THIS element and not on the reel inside it: the
                   mask is painted over the scroll container's own box, which is the part
                   that stays still while the content moves under it. Put on the reel it
                   would scroll away with the text. */
                "[mask-image:linear-gradient(to_right,black_calc(100%_-_3rem),transparent)]",
                motion && "lg:h-[var(--walk-window)] lg:overflow-y-hidden lg:py-0",
              )}
              /* The height goes through a custom property so the `lg:` prefix can gate it.
                 As an inline `height` it applied at every width, and a fixed height beside
                 `overflow-x: auto` makes the box scrollable on both axes, so a phone got a
                 264px nested scroller holding a 52-line file. `NodeCardStage`'s own note
                 states the rule this broke: "the sticky-scroll choreography must not trap
                 a phone reader". Below `lg` the listing now stands at its full height and
                 the page scrolls past it. */
              style={{ "--walk-window": `${NC.window + PAD_Y}px` } as React.CSSProperties}
            >
              <div
                /* The reel's shift goes through a custom property for exactly the reason
                   the height above does, and it was the half of that fix that got missed.
                   As an inline `transform` it applied at every width while the window clip
                   it drives is `lg:`-only, because `motion` tracks
                   `prefers-reduced-motion` and knows nothing about width. Measured on a
                   390px phone: the transform reached -638px against a container that
                   never clips, 28 of the 52 lines were slid above the box's top edge with
                   no way to get them back, and 647px of empty bordered box opened under
                   the last line. `NodeCardStage` proves the pattern — the property is set
                   at every width and only the `lg:` utility reads it. */
                className={cx(
                  motion &&
                    "lg:transition-transform lg:duration-500 lg:ease-out lg:[transform:translateY(var(--walk-reel,0px))]",
                )}
                style={
                  {
                    "--walk-reel":
                      motion && open !== undefined
                        ? `${reelShift(open.from, lines.length)}px`
                        : "0px",
                  } as React.CSSProperties
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

            {/* The nine parts. Every title is on screen from the start, so the figure
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
                          /* Copper, because the listing beside it is: the card's register
                             is one colour and the number telling a reader which note is
                             open belongs to it. 8.7:1 on `bg-void`. */
                          isOpen ? "text-copper-line" : reached ? "text-dim" : "text-faint",
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
                      {/* `text-dim` and not `text-faint`. `--color-faint` is #3b4058 at
                          1.83:1 and `app/globals.css` reserves it for decorative
                          separators; this is the only thing telling a reader which lines
                          each part is about, and eight of the nine wear it at any moment,
                          so the whole column was below the contrast floor. */}
                      <span
                        className={cx(
                          "shrink-0 font-mono text-[11px] tabular-nums transition-colors",
                          isOpen ? "text-copper-line" : "text-dim",
                        )}
                      >
                        {span(note.from, note.to)}
                      </span>
                    </div>

                    {/* Open under its own head while the walk is running; all nine open
                        in the static layout, which is what makes the prerendered markup
                        readable without script.

                        `lg:sr-only`, and not `lg:hidden`. This carried `lg:hidden` —
                        `display: none`, which takes an element out of the accessibility
                        tree as well as out of the layout — so eight of the nine bodies
                        were unreachable to a screen reader, to find-in-page and to a text
                        extractor at `lg`, and the only route to them was scrolling a
                        190vh section one step at a time. `NodeCardStage` had the same bug
                        once and fixed it this way; that component is deleted and this is
                        the fix carried across rather than lost with it. `sr-only` is
                        `position: absolute` with a 1px clip, so the reel steps exactly as
                        it did and the column measures the same. */}
                    <p
                      className={cx(
                        "mt-1.5 pl-[1.9rem] text-[13px] leading-relaxed text-muted",
                        motion && !isOpen && "lg:sr-only",
                      )}
                    >
                      {body(bodies[note.id] ?? note.body)}
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
