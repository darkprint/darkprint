"use client";

/* ============================================================
   The choreography, and the two layouts it degrades into.

   Spec §3.2 asks for one thing to be true in three situations at
   once, and the shape of this file is what that costs:

     lg and up, motion allowed  the sticky reel. The listing scrolls
                                inside a window, seven annotations
                                attach one at a time, a leader line
                                is drawn from the run being read to
                                the note about it, and at the end the
                                card shrinks into one box of the
                                starter factory.
     below lg                   the stacked list. No sticky scaffold,
                                no clipped window, no leader. The
                                whole card at its natural height with
                                the seven notes under it. "The
                                sticky-scroll choreography must not
                                trap a phone reader."
     reduced motion, or no JS   the same stacked list, at any width.
                                "All seven annotations visible at
                                once in a readable static layout."

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

   The dezoom is written straight to the DOM from `onProgress` rather
   than through React state. The reel and the seven steps are
   discrete and re-render happily a hundred times across the scroll;
   a scale factor is continuous, and quantising it to whole percent
   would step visibly. `useScrollProgress` exists partly for this:
   its `onProgress` is "the unrounded value delivered inside the
   animation frame". React sets no style on the element those
   properties are written to, so the two never fight over it.
   ============================================================ */

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { animate } from "animejs";

import { Sheet, VIZ, toneColor } from "@/components/viz";
import { stagesShown, useScrollProgress } from "@/components/viz/useScrollProgress";
import { Ticked } from "@/components/nodes/VersionHistory";
import { cx } from "@/lib/format";

import { resolveAnnotations } from "./annotations";
import { DezoomGraph, LANDING_ORIGIN } from "./DezoomGraph";
import {
  NC,
  STEP_RESERVE,
  bandCentre,
  dezoom,
  leaderPath,
  railCentre,
  reelShift,
} from "./geometry";
import { YamlListing } from "./YamlListing";
import { tokenizeYaml } from "./yaml";

/**
 * Constant, and defined out here so React sees the same object on every render and stops
 * touching `style` on that element after mount. The dezoom's custom properties are
 * written to it imperatively, and a style prop rebuilt each render would race them.
 */
const CARD_STYLE: React.CSSProperties = { transformOrigin: LANDING_ORIGIN };

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
   * every step and `active` is none of them: that is the static layout, where all seven
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
   * The leader draws itself as each step attaches.
   *
   * `pathLength={1}` is what makes this need no measurement: the browser rescales the
   * path's own length to 1, so a dash array of 1 is exactly the whole run whatever the
   * elbow's real geometry is, and anime.js only has to walk the offset from 1 to 0. The
   * attribute in the markup is `0`, so with no JS the leader is drawn.
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
      strokeDashoffset: [1, 0],
      duration: 420,
      ease: "outQuad",
    });
    const body = listRef.current?.querySelector('[data-nc-body="active"]');
    const raised =
      body === null || body === undefined
        ? undefined
        : animate(body, { opacity: [0, 1], translateY: [8, 0], duration: 420, ease: "outQuad" });
    return () => {
      drawn.pause();
      raised?.pause();
    };
  }, [motion, active]);

  return (
    <div ref={ref} className={cx("relative", motion && "lg:h-[420vh]")}>
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
                motion &&
                  "lg:grid lg:grid-cols-[minmax(0,1fr)_44px_minmax(0,22rem)] lg:items-start lg:gap-0",
              )}
            >
              {/* ---------- the listing ---------- */}
              <div
                className={cx(
                  "overflow-x-auto rounded border border-blueprint/70 bg-void/70",
                  motion && "lg:h-[420px] lg:overflow-y-hidden",
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
                    stroke={toneColor("cyan")}
                    strokeWidth={VIZ.stroke.thin}
                  />
                </svg>
              </div>

              {/* ---------- the seven notes ---------- */}
              <ol
                ref={listRef}
                className={cx(
                  "flex list-none flex-col gap-5",
                  motion && "lg:h-[420px] lg:gap-1.5 lg:overflow-hidden",
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
                          motion && "lg:h-9 lg:items-center lg:overflow-hidden",
                        )}
                      >
                        {/* Same split as the listing's marking: the base classes are the
                            finished state, and only the `lg:` half tracks the step. A
                            note whose body is open beside it must not have a heading
                            greyed out as unreached, which is what a phone would show. */}
                        <span
                          className={cx(
                            "shrink-0 font-mono text-[11px] text-cyan/70",
                            motion &&
                              (isActive
                                ? "lg:text-cyan"
                                : attached
                                  ? "lg:text-cyan/60"
                                  : "lg:text-dim/60"),
                          )}
                        >
                          {two(annotation.step)}
                        </span>
                        <h3
                          className={cx(
                            "text-sm font-medium text-fg",
                            motion && !attached && "lg:text-dim",
                          )}
                        >
                          {annotation.title}
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
                          the seven annotations were unreachable by a screen reader and by
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
