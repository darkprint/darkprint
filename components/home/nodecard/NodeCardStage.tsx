"use client";

/* ============================================================
   The choreography, and the two layouts it degrades into.

   Spec §3.2 asks for one thing to be true in three situations at
   once, and the shape of this file is what that costs:

     lg and up, motion allowed  the sticky reel. The listing scrolls
                                inside a window, nine annotations
                                attach one at a time, a leader line
                                is drawn from the run being read to
                                the note about it, and at the end the
                                card shrinks into one box of the
                                starter factory.
     below lg                   the stacked list. No sticky scaffold,
                                no clipped window, no leader. The
                                whole card at its natural height with
                                the nine notes under it. "The
                                sticky-scroll choreography must not
                                trap a phone reader."
     reduced motion, or no JS   the same stacked list, at any width.
                                "All seven annotations visible at
                                once in a readable static layout."
                                The spec counted seven, the figure
                                now carries nine, and that sentence
                                was always about *all* of them.

   One DOM serves all three, which is the only way the second half of
   §1 can hold: the YAML has to be in `.next/server/app/index.html`,
   and it can only be there once. So the layouts are not branches in
   the render, they are classes that appear:

     - every choreography class carries the `lg:` prefix, which is
       what keeps the phone out of it, and is emitted only when
       `motion` is true, which is what keeps a reader who asked for
       stillness out of it;
     - `motion` is false on the server and on the first client
       render (`useReveal`'s gate, read through `useScrollProgress`),
       so the prerendered markup *is* the static layout and hydration
       agrees with it before anything moves.

   One thing is added on top of all three rather than taken from any
   of them: at `lg` each of the nine heads is a button that puts the
   page where its own step is the one being read. The rail collapses
   eight heads out of nine, so the argument's later notes depend on
   earlier ones the reader can no longer see, and scrolling back up by
   feel through a pinned section is not a way to re-read a sentence.
   The button is additive in the strict sense — it exists only where
   `motion` is true, so the static list is the list it always was.

   ── The register, and the one accent that survives it ──
   The sheet is drawn on `copper` rather than on `blueprint`, on the
   author's instruction, and inside a figure whose whole ground is
   one accent a second accent reads as a mistake. So the marks that
   used to be cyan — the leader, the run being read, the step
   numbers, the head's hover — are the register's own line colour,
   and cyan is left with exactly one job in here: the focus ring,
   which `app/globals.css` sets unlayered on every focusable element
   on the site. A keyboard reader's "you are here" is a sitewide
   guarantee and does not get a per-figure spelling. Everything else
   is copper, and `YamlListing` says the same thing about the
   listing's own tokens.

   The dezoom is written straight to the DOM from `onProgress` rather
   than through React state. The reel and the nine steps are
   discrete and re-render happily a hundred times across the scroll;
   a scale factor is continuous, and quantising it to whole percent
   would step visibly. `useScrollProgress` exists partly for this:
   its `onProgress` is "the unrounded value delivered inside the
   animation frame". React sets no style on the element those
   properties are written to, so the two never fight over it.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { animate } from "animejs";

import { MOTION, Sheet, VIZ, VIZ_LINE } from "@/components/viz";
import { EASE_OUT } from "@/components/viz/easing";
import { stagesShown, useScrollProgress } from "@/components/viz/useScrollProgress";
import { Ticked } from "@/components/ui/Ticked";
import { cx } from "@/lib/format";

import { resolveAnnotations } from "./annotations";
import { DezoomGraph, LANDING_ORIGIN } from "./DezoomGraph";
import {
  NC,
  STAGE_HEIGHT,
  STEP_RESERVE,
  bandCentre,
  dezoom,
  leaderPath,
  railCentre,
  reelShift,
  stepScrollTop,
} from "./geometry";
import { YamlListing } from "./YamlListing";
import { tokenizeYaml } from "./yaml";

/**
 * Constant, and defined out here so React sees the same object on every render and stops
 * touching `style` on that element after mount. The dezoom's custom properties are
 * written to it imperatively, and a style prop rebuilt each render would race them.
 */
const CARD_STYLE: React.CSSProperties = { transformOrigin: LANDING_ORIGIN };

/**
 * The stage's height, hoisted for the same reason and set at every width. It is inert
 * until the `lg:h-[var(--nc-stage)]` utility reads it, which is only emitted with motion.
 */
const STAGE_STYLE = { "--nc-stage": STAGE_HEIGHT } as React.CSSProperties;

/** Two digits, so the rail's numbers form a column rather than a ragged edge. */
function two(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function NodeCardStage({
  source,
  cardRef,
  cardHref,
  darkFactory,
}: {
  /** The card document, verbatim, read off `content/` at build time. */
  source: string;
  /** `code-builder@1.0.0`, for the sheet's title block. */
  cardRef: string;
  /** `/nodes/code-builder`, which shows the same card in full. */
  cardHref: string;
  darkFactory: boolean;
}) {
  const lines = useMemo(() => tokenizeYaml(source), [source]);
  const annotations = useMemo(() => resolveAnnotations(source), [source]);

  const cardBoxRef = useRef<HTMLDivElement | null>(null);
  const graphBoxRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const leaderRef = useRef<SVGPathElement | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  const { ref, progress, motion } = useScrollProgress<HTMLDivElement>({
    onProgress: (value) => {
      const card = cardBoxRef.current;
      const graph = graphBoxRef.current;
      if (card === null || graph === null) return;
      const state = dezoom(value);
      card.style.setProperty("--nc-scale", String(state.scale));
      card.style.setProperty("--nc-fade", String(state.fade));
      graph.style.setProperty("--nc-graph", String(state.graph));
      // Once the graph has taken the frame, it is what a pointer should land on. The
      // card is still in the layout at a fifth of its size and would otherwise swallow
      // clicks over the middle of the drawing.
      const landed = state.graph > 0.6;
      card.style.setProperty("--nc-card-pe", landed ? "none" : "auto");
      graph.style.setProperty("--nc-graph-pe", landed ? "auto" : "none");
    },
  });

  /*
   * How far the reader has got. With motion gated off `progress` is 1, so `shown` is
   * every step and `active` is none of them: that is the static layout, where all nine
   * notes are open at once and no single one is being read.
   */
  const count = annotations.length;
  const shown = motion ? stagesShown(progress, count, STEP_RESERVE) : count;
  const active = motion ? Math.max(0, shown - 1) : -1;

  const current = annotations[Math.max(active, 0)];
  const shift = current === undefined ? 0 : reelShift(current.from, lines.length);
  const leader =
    current === undefined
      ? ""
      : leaderPath(bandCentre(current, shift), railCentre(active), NC.gutter);

  /*
   * The leader reaches for each step as it attaches.
   *
   * `pathLength={1}` is what makes this need no measurement: the browser rescales the
   * path's own length to 1, so a dash array of 1 is exactly the whole run whatever the
   * elbow's real geometry is, and anime.js only has to walk the offset. The attribute in
   * the markup is `0`, so with no JS the leader is drawn.
   *
   * It used to walk that offset from 1 — from nothing — over 420ms. But `d` is recomputed
   * in the same render, so the elbow was already standing somewhere else by the time the
   * draw began: the line vanished, jumped, and rebuilt itself from the listing edge on
   * every step, which reads as a glitch rather than as a connection. From 0.35 the run is
   * already there and only its last third travels, so what the reader sees is the leader
   * reaching across to its new head. Two thirds of the distance in half the time.
   *
   * `revert()` and not `pause()` on the way out. A paused animation leaves its inline
   * `stroke-dashoffset` behind wherever it stopped, so an interrupted step stranded a
   * partly drawn leader that nothing would ever finish; reverting hands the element back
   * to the `strokeDashoffset={0}` in the markup, which is the drawn state.
   *
   * `offsetParent` is null while an element is `display: none`, which is the gutter's
   * state through the whole stacked layout. Reading it is how this asks "is the
   * choreography on screen" without a second media query; spec §2a keeps `matchMedia` to
   * one place and this is not it.
   */
  useEffect(() => {
    if (!motion) return;
    const path = leaderRef.current;
    const gutter = gutterRef.current;
    if (path === null || gutter === null || gutter.offsetParent === null) return;
    const drawn = animate(path, {
      strokeDashoffset: [0.35, 0],
      // Shorter than the reel's own 500ms glide underneath it, so the line has arrived by
      // the time the run it points at stops moving.
      duration: 240,
      ease: EASE_OUT,
    });
    const body = listRef.current?.querySelector('[data-nc-body="active"]');
    const raised =
      body === null || body === undefined
        ? undefined
        : animate(body, {
            opacity: [0, 1],
            translateY: [8, 0],
            duration: MOTION.slow,
            ease: EASE_OUT,
          });
    return () => {
      drawn.revert();
      raised?.revert();
    };
  }, [motion, active]);

  /*
   * Any of the nine notes, on demand.
   *
   * The rail collapses eight of the nine heads at `lg`, so a reader who has reached note 09
   * ("What must never arrive") cannot re-read note 05 ("What it can reach") that the
   * ninth depends on without scrolling back up by feel. `stepScrollTop` inverts the
   * `progress -> step` map the whole section is driven by, so a head can put the page
   * exactly where that step is the one being read.
   *
   * Below `lg` there is no pin to travel and no reel to drive, and the same `offsetParent`
   * probe the leader uses answers that without a second `matchMedia`. There, every note is
   * already open, so "go to note 4" means bringing note 4 to the top of the screen.
   */
  const goToStep = useCallback(
    (index: number) => {
      const section = ref.current;
      const gutter = gutterRef.current;
      if (section === null) return;
      if (gutter === null || gutter.offsetParent === null) {
        listRef.current?.children.item(index)?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
        return;
      }
      const rect = section.getBoundingClientRect();
      window.scrollTo({
        top: stepScrollTop(index, count, window.scrollY + rect.top, rect.height, window.innerHeight),
        behavior: "smooth",
      });
    },
    [count, ref],
  );

  return (
    <div ref={ref} style={STAGE_STYLE} className={cx("relative", motion && "lg:h-[var(--nc-stage)]")}>
      <div className={cx("relative", motion && "lg:sticky lg:top-24")}>
        {/* ---------- the card, which shrinks ---------- */}
        <div
          ref={cardBoxRef}
          style={CARD_STYLE}
          className={cx(
            motion &&
              "lg:relative lg:z-10 lg:[transform:scale(var(--nc-scale,1))] lg:[opacity:var(--nc-fade,1)] lg:[pointer-events:var(--nc-card-pe,auto)] lg:will-change-transform",
          )}
        >
          <Sheet
            /* The copper register, not the blueprint one, and it is the whole of the
               author's fourth request: "I'd like that the dominating colour is orange
               instead of blue in the node card." The sheet decides the ground, the
               graticule, the frame and the ink in one place, so the listing inside it and
               the leader drawn beside it follow without being handed a colour.

               It is NOT amber. Amber is spent sitewide on "not built yet" and "this box
               leaves the page", and this figure is the most built thing on the site.
               `app/globals.css` declares the four copper variables with the measured
               contrast and that reason. */
            register="copper"
            /* The label is set in uppercase by the sheet, so the card's ref goes in the
               title block instead: `code-builder@1.0.0` is an identifier and an
               identifier a reader might type is wrong in capitals. */
            label="node card"
            title={`${cardRef} · ${lines.length} lines, as the archive stores them`}
            note={
              <Link href={cardHref} className="underline decoration-line-bright underline-offset-4">
                open the card
              </Link>
            }
          >
            <div
              className={cx(
                "flex flex-col gap-8",
                /* 28px of gutter and a 20rem rail, which is 96px more column for the
                   listing than the 44/22rem it had. The card's longest row measures 784px
                   and the listing had 708: sixteen of the fifty-two rows were cut, and the
                   `action`, `spec`, `description` and `notes` blocks the annotations are
                   about are exactly the long ones. At 756px two rows overflow. 20rem is
                   the floor for the rail: an annotation body is capped at 300 characters
                   against a 132px box, which is six lines at 13px in a 320px column and
                   seven in anything narrower. */
                motion &&
                  "lg:grid lg:grid-cols-[minmax(0,1fr)_28px_minmax(0,20rem)] lg:items-start lg:gap-0",
              )}
            >
              {/* ---------- the listing ---------- */}
              <div
                /* A scroll container with no focusable child cannot be reached from the
                   keyboard at all (WCAG 2.1.1, Level A): there is nothing to tab to, so
                   whatever runs past the right edge is available to a mouse and to nobody
                   else. `role="region"` with a name is what makes the stop worth having.
                   `CardWalk` carries the same pair over the same listing. */
                tabIndex={0}
                role="region"
                aria-label={`${cardRef}, ${lines.length} lines`}
                className={cx(
                  "overflow-x-auto rounded border border-copper/70 bg-void/70",
                  /* The right edge, faded, so what is left over reads as an edge rather
                     than as a cut. Widening the column takes the overflow from sixteen
                     rows to two, and no column this figure can be given holds a 102
                     character line beside nine notes. It has to be on THIS element and
                     not on the reel inside it: the mask is painted over the scroll
                     container's own box, which is the part that stays still while the
                     content moves under it.

                     1.5rem, where `CardWalk` uses 3rem over the same listing, because the
                     two are hiding different amounts. There, 137px runs past the edge and
                     the fade has to be legible as an edge in its own right. Here it is
                     30px on two rows out of fifty-two, and a 3rem fade reached back far
                     enough to dim the last three characters of every 95-character line
                     that *does* fit, which states a truncation that is not there. */
                  "[mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)]",
                  /* `NC.window`, retyped. Tailwind v4 scans source text for arbitrary
                     values, so this cannot read the constant; `geometry.ts` says so beside
                     the number and `nodecard.test.ts` holds the pair together. */
                  motion && "lg:h-[504px] lg:overflow-y-hidden",
                )}
              >
                <div
                  style={{ "--nc-reel": `${shift}px` } as React.CSSProperties}
                  /* The transition is on `transform` and the value comes from a custom
                     property: changing the property recomputes the transform, and the
                     transform is what interpolates. So the listing glides to the next
                     run rather than cutting to it, without the reel needing a frame
                     loop of its own. */
                  className={cx(
                    motion &&
                      "lg:transition-transform lg:duration-500 lg:ease-out lg:[transform:translateY(var(--nc-reel,0px))]",
                  )}
                >
                  <YamlListing
                    lines={lines}
                    annotations={annotations}
                    shown={shown}
                    active={active}
                    live={motion}
                  />
                </div>
              </div>

              {/* ---------- the leader ---------- */}
              <div ref={gutterRef} className={cx("hidden", motion && "lg:block")} aria-hidden>
                <svg
                  width={NC.gutter}
                  height={NC.window}
                  viewBox={`0 0 ${NC.gutter} ${NC.window}`}
                  fill="none"
                  strokeLinecap="round"
                >
                  <path
                    ref={leaderRef}
                    d={leader}
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={0}
                    /* The sheet's own line colour, read through the variable the sheet
                       sets on itself, so the leader is copper here and would follow any
                       register this figure is ever drawn on without a second decision. */
                    stroke={VIZ_LINE}
                    strokeWidth={VIZ.stroke.thin}
                  />
                </svg>
              </div>

              {/* ---------- the nine notes ---------- */}
              <ol
                ref={listRef}
                className={cx(
                  "flex list-none flex-col gap-5",
                  motion && "lg:h-[504px] lg:gap-1.5 lg:overflow-hidden",
                )}
              >
                {annotations.map((annotation, index) => {
                  const attached = index < shown;
                  const isActive = index === active;
                  return (
                    <li key={annotation.id} className="flex flex-col">
                      <div
                        className={cx(
                          "flex items-baseline gap-3",
                          /* `relative` only with motion, because it is only there to hold
                             the head button's stretched hit target, and the static list
                             has no button in it. */
                          motion && "relative lg:h-9 lg:items-center lg:overflow-hidden",
                        )}
                      >
                        {/* Same split as the listing's marking: the base classes are the
                            finished state, and only the `lg:` half tracks the step. A
                            note whose body is open beside it must not have a heading
                            greyed out as unreached, which is what a phone would show. */}
                        {/* Copper, at the two weights the register can afford to spend
                            on 11px text: full is 7.6:1 on the sheet's ground and 80% is
                            5.3:1, both past AA, while 70% lands at 4.3 and 60% at 3.6.
                            The unreached state stays `text-dim`, which is a neutral and
                            says "not yet" without claiming the register. */}
                        <span
                          className={cx(
                            "shrink-0 font-mono text-[11px] text-copper-line/80",
                            motion &&
                              (isActive
                                ? "lg:text-copper-line"
                                : attached
                                  ? "lg:text-copper-line/80"
                                  : "lg:text-dim/60"),
                          )}
                        >
                          {two(annotation.step)}
                        </span>
                        {/* The heading stays a heading and the button goes inside it.
                            `<h3>` is flow content and a button may only hold phrasing
                            content, so the other way round is invalid markup and flattens
                            the heading out of the document outline; an accordion header
                            has this shape for the same reason. The button's own text is
                            the note's title, so its accessible name is what the reader
                            sees rather than "01 What it can reach L19-21".

                            NO STRETCHED `after:inset-0` HIT TARGET, and this is the second
                            attempt: one was written, and a press scale on the same element
                            silently unbuilds it. `transform` makes an element the
                            containing block for its own absolutely positioned pseudo, so
                            the instant `:active` applied, the target collapsed from the
                            320px row to the 132px title, `mouseup` landed outside the
                            element `mousedown` had gone to, and Chrome dispatched the click
                            on the row instead of on the button. The head simply did not
                            respond to a click on its right half. `lg:h-9` gives the button
                            the row's own height instead: a 132x36 target, past WCAG 2.5.8's
                            24x24 floor, and it presses as itself. */}
                        <h3
                          className={cx(
                            "text-sm font-medium text-fg",
                            motion && !attached && "lg:text-dim",
                          )}
                        >
                          {motion ? (
                            <button
                              type="button"
                              onClick={() => goToStep(index)}
                              aria-current={isActive ? "step" : undefined}
                              className="cursor-pointer text-left transition-[transform,scale,color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:text-copper-line hoverable:active:scale-[0.97] lg:flex lg:h-9 lg:items-center"
                            >
                              {annotation.title}
                            </button>
                          ) : (
                            annotation.title
                          )}
                        </h3>
                        <span className="ml-auto shrink-0 font-mono text-[11px] text-dim">
                          {annotation.from === annotation.to
                            ? `L${annotation.from}`
                            : `L${annotation.from}–${annotation.to}`}
                        </span>
                      </div>
                      {/* `lg:sr-only`, never `lg:hidden`.

                          Only one body is on screen at a time under the choreography, and
                          `display: none` took the other six out of the accessibility tree
                          as well as out of the layout: at lg with motion allowed, six of
                          the nine annotations were unreachable by a screen reader and by
                          find-in-page, and the only way to them was to scroll a 420vh
                          section. `sr-only` is `position: absolute` with a 1px clip, so it
                          contributes exactly the same nothing to the layout and the reel
                          steps as it did before, and the text stays readable.

                          The sizing classes move under `isActive` with it. Tailwind orders
                          utilities by their place in the generated sheet rather than by the
                          order they appear in the attribute, so `lg:h-[132px]` beside
                          `lg:sr-only` is a race over `height` that this sidesteps. */}
                      <div
                        data-nc-body={isActive ? "active" : "idle"}
                        className={cx(
                          "mt-2 text-[13px] leading-relaxed text-muted",
                          motion && isActive && "lg:mt-0 lg:h-[132px] lg:overflow-hidden lg:pt-1",
                          motion && !isActive && "lg:sr-only",
                        )}
                      >
                        <Ticked text={annotation.body} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Sheet>
        </div>

        {/* ---------- where it lands ---------- */}
        <div
          ref={graphBoxRef}
          className={cx(
            "mt-10",
            motion &&
              "lg:absolute lg:inset-0 lg:z-0 lg:mt-0 lg:flex lg:items-center lg:[opacity:var(--nc-graph,1)] lg:[pointer-events:var(--nc-graph-pe,none)]",
          )}
        >
          {/* Capped, so the drawing plus its caption stay inside the height the card
              gives this overlay. Uncapped on a 1440 screen the caption lands below the
              sheet the graph is supposed to be replacing. */}
          <DezoomGraph
            cardHref={cardHref}
            darkFactory={darkFactory}
            className="w-full lg:mx-auto lg:max-w-4xl"
          />
        </div>
      </div>
    </div>
  );
}
