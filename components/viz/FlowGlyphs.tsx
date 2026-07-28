/* ============================================================
   The luminous-flow glyphs: a lit disc, a curve with a light
   travelling it, an absence, and the mark for where a person acts.

   Redesign spec §1. The register the author chose is a dark room
   with the machines lit, so a node is a glow rather than a box and
   an edge is a curve with something moving along it. Nothing here
   paints a rectangle and nothing here carries a sub-label; the
   brief is "suggestive and atmospheric, almost no text", and the
   text that remains is one label per glyph.

   Four properties this file is responsible for, in the order they
   are easiest to lose:

   1. Every label is real DOM at SSR time. No label is painted from
      script, none is behind `display:none`, and the only thing the
      stylesheet in `flow.ts` moves is `opacity`.
   2. Every glyph that carries a label is focusable and has an
      accessible name, so a keyboard reveals exactly what a pointer
      reveals. A drawing only a mouse user can read is broken.
   3. `HumanFlowNode` is violet by construction. It accepts no tone,
      no class, no style and no fill, so there is no argument a
      caller can pass that would repaint it, and `FlowTone` has no
      `human` member so a plain disc cannot stand in for it either.
   4. A scene rendered by a server component works. Nothing below is
      a client component and nothing below imports `animejs`, so a
      static figure costs no script at all and an animated one adds
      `useLuminousFlow` on top of the same markup.

   The static markup is the finished drawing. `useLuminousFlow`
   takes it apart and puts it back together again, and it only ever
   runs where the reader has not asked for less motion.
   ============================================================ */

import { HUMAN_PRESENCE_MARK, cx } from "@/lib/format";

import { arrowHeadPath, type Point } from "./Glyphs";
import {
  FLOW,
  FLOW_ABSENT_TONE,
  FLOW_CSS,
  FLOW_LABELS_ATTR,
  flowRun,
  pointAtT,
  flowToneColor,
  focusRadius,
  haloRadii,
  hitRadius,
  labelOffset,
  pulseDasharray,
  ringRadius,
  type FlowReveal,
  type FlowRunOptions,
  type FlowTone,
} from "./flow";
import { VIZ, VIZ_INK, VIZ_KNOCKOUT, toneColor } from "./tokens";
/* Type only, so nothing here crosses the client boundary `useReveal.ts` declares. */
import type { RevealPhase } from "./useReveal";

/**
 * A knockout behind a label so it stays readable over the graticule and over a halo.
 *
 * `paint-order: stroke` draws the outline first and the fill over it, which cuts a hole in
 * whatever is behind the glyphs without a rectangle that has to be kept the same size as
 * the text. The stroke is narrower than the one in `Glyphs.tsx` because these labels are
 * smaller and a 4-unit outline on an 11-unit word closes up the counters.
 */
const KNOCKOUT = {
  paintOrder: "stroke" as const,
  stroke: VIZ_KNOCKOUT,
  strokeWidth: 3,
  strokeLinejoin: "round" as const,
  pointerEvents: "none" as const,
};

/** Painted parts take no pointer events; one hit shape per glyph is the whole target. */
const INERT = { pointerEvents: "none" as const };

/** Attribute values stay readable. `0.05 * 2.4` writes 15 digits into the markup. */
function r3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * The mark the rest of the site already puts in front of an absent row.
 *
 * Named here rather than typed inline so the tables, the ledger and this drawing keep
 * spelling the absence the same way. `Glyphs.tsx` writes the same character.
 */
const ABSENT_GLYPH = "◌";

/* ==================== the stylesheet and the scene ==================== */

/**
 * The label rule, as a stylesheet, emitted once for the whole document.
 *
 * React 19 deduplicates a `<style>` carrying `href` and `precedence` and hoists it into the
 * head, so a page with nine scenes ships one copy. It renders as an ordinary inline
 * `<style>` if that ever stops happening, which is still correct and still SSR-safe, so
 * nothing here depends on the hoist.
 *
 * It sits beside the `<svg>` rather than inside it. A `<style>` inside an `<svg>` is valid
 * and would work, but it is created in the SVG namespace, and React's resource handling is
 * specified over HTML elements.
 */
export function FlowStyle() {
  return (
    <style href="darkprint-luminous-flow" precedence="viz">
      {FLOW_CSS}
    </style>
  );
}

export function FlowScene({
  width,
  height,
  label,
  description,
  labels = "always",
  phase = "static",
  children,
  className,
  id,
  ref,
}: {
  /** viewBox width in scene units. Every metric in `flow.ts` is in the same units. */
  width: number;
  height: number;
  /**
   * The figure's accessible name, required.
   *
   * `role="group"` rather than `role="img"`, and the difference matters here. An `img`
   * makes its whole subtree presentational, which would silence the focusable nodes inside
   * and leave a keyboard user landing on things a screen reader announces as nothing. A
   * group keeps its children in the accessibility tree and still announces its own name.
   */
  label: string;
  /**
   * The topology in a sentence, for a reader who is not going to walk the nodes.
   *
   * Rendered as `<desc>`, which maps to the accessible description. Spec §1 asks for this
   * so a screen reader gets what the figure shows without chasing it node by node.
   */
  description?: string;
  /**
   * Whether labels may wait for a pointer or a focus ring.
   *
   * `"always"` on the server and by default, which is what makes a figure with no script
   * a figure with all of its labels showing. `useLuminousFlow` passes `"hover"` after it
   * has mounted and confirmed the reader has not asked for reduced motion.
   */
  labels?: FlowReveal;
  /**
   * Which of `useReveal`'s three situations this is.
   *
   * `armed` is the one frame of risk in the whole contract: script has run and the scene
   * has not yet reached the viewport, so the markup is still the finished drawing and a
   * reader scrolling fast could see it before the timeline takes it apart. Holding the
   * whole scene at zero opacity while armed closes that, and it stays on the scene rather
   * than on the caller's `className` so a scene cannot forget it. `static` and `shown`
   * both render at full opacity, which is what keeps the server's HTML legible.
   */
  phase?: RevealPhase;
  children: React.ReactNode;
  className?: string;
  /** Written as `data-viz-scene`, for an anime.js scope rooted on this element. */
  id?: string;
  ref?: React.Ref<SVGSVGElement>;
}) {
  return (
    <>
      <FlowStyle />
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        /* Belt and braces against layout shift: `height: auto` on a viewBox'd svg is
           enough in current browsers, and the declared ratio is what reserves the box
           before the svg is laid out at all. */
        style={{ aspectRatio: `${width} / ${height}` }}
        className={cx(
          "block h-auto w-full transition-opacity duration-500 ease-out",
          phase === "armed" ? "opacity-0" : "opacity-100",
          className,
        )}
        role="group"
        aria-label={label}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        fontFamily={VIZ.font.family}
        data-viz-flow=""
        data-viz-scene={id}
        {...{ [FLOW_LABELS_ATTR]: labels }}
      >
        {description !== undefined && <desc>{description}</desc>}
        {children}
      </svg>
    </>
  );
}

/* ==================== a group a scene may move ==================== */

/**
 * Somewhere in the scene, holding something a scene animates with a transform.
 *
 * ── The defect this exists to make unrepeatable ──
 * anime.js moves an element by writing the CSS `transform` property onto `style`
 * (`animejs/dist/modules/core/styles.js` sets `targetStyle.transform`). An SVG `transform`
 * attribute is a presentation attribute, which is the lowest priority thing in the
 * cascade, so an inline `transform: scale(1)` does not compose with
 * `transform="translate(210 200)"`. It **replaces** it, and the element snaps to the
 * scene's origin the first time the timeline touches it.
 *
 * Beat 3 of the landing shipped that way: `<g data-beat="card" transform="translate(210
 * 200)">` animated to `scale: 1`, and the card the beat exists to show was drawn half off
 * the left edge of the sheet with its centre above the node it hangs from. The prerendered
 * HTML was correct, which is why nothing caught it: the attribute is in the markup, and
 * only a browser running the timeline moves the element off it.
 *
 * So position and motion are two elements here. The outer group carries the translate and
 * nothing ever animates it; the inner group carries no transform at all and is the only
 * thing a timeline is handed. `FLOW_CSS` gives it `transform-box: fill-box` so a scale
 * opens it about its own centre rather than about the corner of the view box.
 */
export function FlowLift({
  x,
  y,
  id,
  children,
}: {
  /** Where the group sits, in scene units. Written on the anchor, never on the target. */
  x: number;
  y: number;
  /** Written as `data-viz-id` on the animated group, so a timeline can name it. */
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <g data-viz="lift-anchor" transform={`translate(${x} ${y})`}>
      <g data-viz="lift" data-viz-id={id}>
        {children}
      </g>
    </g>
  );
}

/* ==================== the label, and what makes it reachable ==================== */

/**
 * The props every label-bearing glyph shares, so the reveal contract is written once.
 *
 * `tabIndex` is present whenever there is a label, whatever the reveal mode. A label that
 * is showing already still gains a focus ring that tells a keyboard reader where they are,
 * and a rule with one branch is a rule that survives five scenes being authored at once.
 */
function focusProps(name: string | undefined, reveal: FlowReveal) {
  if (name === undefined) return { "data-viz-reveal": reveal };
  return {
    "data-viz-reveal": reveal,
    tabIndex: 0,
    role: "img",
    "aria-label": name,
  };
}

/* ==================== the node ==================== */

export function FlowNode({
  x,
  y,
  label,
  name,
  tone = "line",
  r = FLOW.node.r,
  lit = false,
  reveal = "hover",
  id,
}: {
  /** Centre of the node. */
  x: number;
  y: number;
  /** The one line this node says. There is no second line in this register. */
  label?: string;
  /** A fuller accessible name, where the visible label is an abbreviation. */
  name?: string;
  /** Role, as a colour. `human` is absent from `FlowTone`; see `HumanFlowNode`. */
  tone?: FlowTone;
  /** Radius of the lit core. The halo, the ring and the hit area all scale off it. */
  r?: number;
  /** Burn brighter. For the beat where one node in a graph comes up. */
  lit?: boolean;
  /** `"always"` for a label that carries the figure's argument. */
  reveal?: FlowReveal;
  /** Written as `data-viz-id`, so a timeline can name this node. */
  id?: string;
}) {
  const color = flowToneColor(tone);
  const [outer, middle, inner] = haloRadii(r);
  const [dimmest, mid, brightest] = FLOW.halo.opacity;
  const boost = lit ? FLOW.node.litBoost : 1;
  const accessibleName = name ?? label;

  return (
    <g data-viz="node-anchor" transform={`translate(${x} ${y})`}>
      <g
        data-viz="node"
        data-viz-id={id}
        data-viz-lit={lit ? "on" : undefined}
        {...focusProps(accessibleName, reveal)}
      >
        {/* The disc on its own, so a scene can scale it about its own centre without
            dragging the label below it sideways. `FLOW_SELECTOR.bloom` has the reason. */}
        <g data-viz="bloom">
          <circle data-viz="glow" r={outer} fill={color} opacity={r3(dimmest * boost)} {...INERT} />
          <circle data-viz="glow" r={middle} fill={color} opacity={r3(mid * boost)} {...INERT} />
          <circle
            data-viz="glow"
            r={inner}
            fill={color}
            opacity={r3(brightest * boost)}
            {...INERT}
          />
          <circle r={r} fill={color} opacity={FLOW.node.core} {...INERT} />
          <circle
            r={ringRadius(r)}
            stroke={color}
            strokeWidth={FLOW.node.ring}
            opacity={lit ? FLOW.node.litRingOpacity : FLOW.node.ringOpacity}
            {...INERT}
          />
        </g>
        {/* The drawn focus indicator. `flow.ts` says why it is a circle and not an outline.
            Hidden by a presentation attribute rather than by the stylesheet alone, so a
            glyph dropped into a plain `Scene` outside a `FlowScene` still draws correctly;
            `FLOW_CSS` beats a presentation attribute and turns it on at the focus ring. */}
        <circle
          data-viz="focus-ring"
          r={focusRadius(r)}
          stroke={VIZ_INK}
          strokeWidth={FLOW.focus.ring}
          opacity={0}
          {...INERT}
        />
        {/* The whole of the node's pointer and focus target: every painted part above is
            inert, so a halo overlapping its neighbour cannot steal a hover. */}
        <circle r={hitRadius(r)} fill="none" pointerEvents="all" />
        {label !== undefined && (
          <text
            data-viz="label"
            y={labelOffset(r)}
            textAnchor="middle"
            fontSize={FLOW.label.size}
            fill={VIZ_INK}
            {...KNOCKOUT}
          >
            {label}
          </text>
        )}
      </g>
    </g>
  );
}

/**
 * A node where a person stands.
 *
 * Doc 2 §1.1, and the reason this component takes no colour of any kind. The mark is
 * violet because `HUMAN_PRESENCE_MARK` in `lib/format.ts` says so, and the props below
 * carry no `tone`, no `className`, no `style` and no `fill`, so there is no argument a
 * caller can pass that would repaint it. The prettier register does not relax this: the
 * halo is violet, the ring is violet, the pause glyph is the same glyph the tables and the
 * legends use, and `FlowTone` has no `human` member, so a scene cannot draw a plain disc
 * in violet and call it the same thing.
 *
 * The core is a knockout rather than a fill, because the glyph has to read out of it. That
 * is the one visual difference from `FlowNode`, and it is the difference between a node
 * that runs on its own and a node that waits for somebody.
 *
 * `flow.test.ts` reads this signature and fails if a colour-bearing prop is ever added.
 */
export function HumanFlowNode({
  x,
  y,
  label,
  r = 9,
  reveal = "hover",
  id,
}: {
  /** Centre of the mark. */
  x: number;
  y: number;
  /** What the person does here. */
  label?: string;
  /** Radius of the ringed core. Larger than a `FlowNode` so the glyph fits inside it. */
  r?: number;
  reveal?: FlowReveal;
  id?: string;
}) {
  const color = HUMAN_PRESENCE_MARK.color;
  const [outer, middle, inner] = haloRadii(r);
  const [dimmest, mid, brightest] = FLOW.halo.opacity;
  const core = ringRadius(r);
  const accessibleName =
    label === undefined ? undefined : `${label}, where a person acts`;

  return (
    <g data-viz="node-anchor" transform={`translate(${x} ${y})`}>
      <g data-viz="human" data-viz-id={id} {...focusProps(accessibleName, reveal)}>
        <g data-viz="bloom">
          <circle data-viz="glow" r={outer} fill={color} opacity={dimmest} {...INERT} />
          <circle data-viz="glow" r={middle} fill={color} opacity={mid} {...INERT} />
          <circle data-viz="glow" r={inner} fill={color} opacity={brightest} {...INERT} />
          <circle
            r={core}
            fill={VIZ_KNOCKOUT}
            stroke={color}
            strokeWidth={VIZ.stroke.thin}
            {...INERT}
          />
          <text
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={VIZ.font.mark}
            fill={color}
            {...INERT}
          >
            {HUMAN_PRESENCE_MARK.glyph}
          </text>
        </g>
        <circle
          data-viz="focus-ring"
          r={focusRadius(r)}
          stroke={color}
          strokeWidth={FLOW.focus.ring}
          opacity={0}
          {...INERT}
        />
        <circle r={hitRadius(r)} fill="none" pointerEvents="all" />
        {label !== undefined && (
          <text
            data-viz="label"
            y={labelOffset(r)}
            textAnchor="middle"
            fontSize={FLOW.label.size}
            fill={color}
            {...KNOCKOUT}
          >
            {label}
          </text>
        )}
      </g>
    </g>
  );
}

/* ==================== the edge ==================== */

export function FlowEdge({
  from,
  to,
  bend = 0,
  fromRadius,
  toRadius,
  gap,
  label,
  labelT = 0.5,
  name,
  tone = "line",
  arrow = true,
  pulse = true,
  spark = false,
  reveal = "hover",
  id,
}: {
  /** Centre of the node the run leaves. */
  from: Point;
  /** Centre of the node it arrives at. */
  to: Point;
  /** Sideways offset of the control point. 0 draws a straight run. `FLOW.edge.bend` has
      the two the site uses. */
  bend?: number;
  /** Radius of the node at each end, where a scene draws one larger than the default. */
  fromRadius?: number;
  toRadius?: number;
  gap?: number;
  /** What the edge carries. The site's graphs label their edges by data type. */
  label?: string;
  /** Where along the curve the label sits, 0 at the source and 1 at the target. Default
      0.5. A scene moves it to pull two labels apart; see `pointAtT`. */
  labelT?: number;
  name?: string;
  /** `tone="signal"` is for an edge that breaks a rule, and for nothing else. */
  tone?: FlowTone;
  arrow?: boolean;
  /** The short bright segment travelling the curve. Off for a run that is context. */
  pulse?: boolean;
  /** Render a dot for `svg.createMotionPath` as well. Off unless a scene asks. */
  spark?: boolean;
  reveal?: FlowReveal;
  id?: string;
}) {
  const color = flowToneColor(tone);
  const options: FlowRunOptions = { bend, fromRadius, toRadius, gap };
  const run = flowRun(from, to, options);
  const accessibleName = name ?? label;
  /* `labelT` slides the label along its own curve. Left at 0.5 this is `run.midpoint`
     exactly; a scene moves it only to separate two labels whose curves pass close, which
     is the one collision a placement cannot fix by moving a node. */
  const labelPoint = labelT === 0.5 ? run.midpoint : pointAtT(run.start, run.control, run.end, labelT);

  return (
    <g data-viz="edge" data-viz-id={id} {...focusProps(accessibleName, reveal)}>
      {/* The focus indicator for a run is the run itself, lit from underneath. Drawn
          first so the curve stays on top of it, and held off by its own attribute so a
          glyph outside a `FlowScene` does not paint it; `FLOW_CSS` turns it on at focus. */}
      {accessibleName !== undefined && (
        <path
          data-viz="focus-ring"
          d={run.d}
          stroke={VIZ_INK}
          strokeWidth={FLOW.edge.pulse + FLOW.focus.spread}
          opacity={0}
          {...INERT}
        />
      )}
      <path
        data-viz="flow-line"
        d={run.d}
        stroke={color}
        strokeWidth={FLOW.edge.line}
        opacity={FLOW.edge.lineOpacity}
        {...INERT}
      />
      {/* Two paths on one curve. `svg.createDrawable` reveals the line above by writing
          `stroke-dasharray`, and the dasharray below is the whole of what makes this a
          short travelling segment, so the two can never be the same element. */}
      {pulse && (
        <path
          data-viz="pulse"
          d={run.d}
          stroke={color}
          strokeWidth={FLOW.edge.pulse}
          pathLength={1}
          strokeDasharray={pulseDasharray()}
          strokeDashoffset={FLOW.pulse.rest}
          {...INERT}
        />
      )}
      {arrow && (
        <path
          d={arrowHeadPath(run.end, run.control)}
          stroke={color}
          strokeWidth={FLOW.edge.line}
          opacity={FLOW.edge.arrowOpacity}
          {...INERT}
        />
      )}
      {/* Parked on the start of the curve so the static drawing is finished. The hook
          zeroes it before handing it to `createMotionPath`, which positions by transform
          and would otherwise add the curve's offset to this one twice. */}
      {spark && (
        <circle
          data-viz="spark"
          cx={run.start[0]}
          cy={run.start[1]}
          r={FLOW.edge.sparkRadius}
          fill={color}
          {...INERT}
        />
      )}
      {label !== undefined && (
        <text
          data-viz="label"
          x={labelPoint[0]}
          y={labelPoint[1] - FLOW.label.edgeGap}
          textAnchor="middle"
          fontSize={FLOW.label.size}
          fill={toneColor("dim")}
          {...KNOCKOUT}
        >
          {label}
        </text>
      )}
      {/* A 1-unit curve is not a pointer target. This one is invisible and fat and takes
          events on its stroke alone, so the box around a diagonal run stays out of it. */}
      {accessibleName !== undefined && (
        <path d={run.d} stroke="transparent" strokeWidth={FLOW.edge.hit} pointerEvents="stroke" />
      )}
    </g>
  );
}

/**
 * The edge that is not there.
 *
 * Doc 2 §5.2: "la lezione centrale non sta in un nodo, sta in un arco che non c'è." The
 * only way to draw an absence is to draw the place it would have gone, so this is the same
 * curve as `FlowEdge` and everything that makes a present edge present is withheld from
 * it: no halo, no travelling light, a dash instead of a continuous run, and a neutral tone
 * instead of the sheet's own drawing colour. Four differences rather than one, because
 * this register is atmospheric and a single difference gets lost in it.
 *
 * It used to be a fifth difference, a hairline, and that was the one that went too far.
 * `FLOW_ABSENT_TONE` and `FLOW.edge.absent` both carry the measurement: at `faint` and one
 * unit the run scored 1.78:1 on the sheet and painted at 0.74 CSS px on a phone, so the
 * site's central argument was legible only through its label.
 *
 * Never the alarm colour. An absent edge in the starter blueprint is the design working,
 * and `--color-signal` would say a defect had been found.
 *
 * Its label defaults to `"always"`. This is the argument the whole site is built on, and a
 * reader who never moves a pointer still has to be able to read it.
 */
export function FlowAbsence({
  from,
  to,
  bend = 0,
  fromRadius,
  toRadius,
  gap,
  label,
  name,
  arrow = true,
  reveal = "always",
  id,
}: {
  from: Point;
  to: Point;
  bend?: number;
  fromRadius?: number;
  toRadius?: number;
  gap?: number;
  /** The prohibition this edge would violate, e.g. `acceptance-criteria`. */
  label?: string;
  name?: string;
  arrow?: boolean;
  reveal?: FlowReveal;
  id?: string;
}) {
  const color = flowToneColor(FLOW_ABSENT_TONE);
  const run = flowRun(from, to, { bend, fromRadius, toRadius, gap });
  const accessibleName =
    name ?? (label === undefined ? undefined : `${label}, an edge that is deliberately absent`);

  return (
    <g data-viz="absent-edge" data-viz-id={id} {...focusProps(accessibleName, reveal)}>
      {accessibleName !== undefined && (
        <path
          data-viz="focus-ring"
          d={run.d}
          stroke={VIZ_INK}
          strokeWidth={FLOW.edge.absent + FLOW.focus.spread}
          opacity={0}
          {...INERT}
        />
      )}
      <path
        d={run.d}
        stroke={color}
        strokeWidth={FLOW.edge.absent}
        strokeDasharray={VIZ.dash.absent}
        {...INERT}
      />
      {arrow && (
        <path
          d={arrowHeadPath(run.end, run.control)}
          stroke={color}
          strokeWidth={FLOW.edge.absent}
          {...INERT}
        />
      )}
      {label !== undefined && (
        <text
          data-viz="label"
          x={run.midpoint[0]}
          y={run.midpoint[1] - FLOW.label.edgeGap}
          textAnchor="middle"
          fontSize={FLOW.label.size}
          fill={toneColor("dim")}
          {...KNOCKOUT}
        >
          {`${ABSENT_GLYPH} ${label}`}
        </text>
      )}
      {accessibleName !== undefined && (
        <path d={run.d} stroke="transparent" strokeWidth={FLOW.edge.hit} pointerEvents="stroke" />
      )}
    </g>
  );
}
