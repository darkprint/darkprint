/* ============================================================
   The drawing's units, before any scene picks up a pen.

   Spec §2a asks for a vocabulary rather than a toolkit: eight
   scenes are authored separately and they have to look like one
   hand drew them. Anything a scene author would otherwise choose
   for themselves — a stroke weight, a dash rhythm, a node's
   proportions, a colour — is decided once here and named, so that
   the way two drawings differ is what they show and not how they
   were drawn.

   Every colour is a reference to a variable declared in
   `app/globals.css`. No hex appears in this tree, and
   `glyphs.test.ts` scans for one, because a literal here is
   invisible until the palette moves and then it is wrong on one
   drawing out of nine.
   ============================================================ */

import { HUMAN_PRESENCE_MARK } from "@/lib/format";

/**
 * The two variables a `Sheet` sets on itself, and every glyph reads.
 *
 * A glyph that named `--color-blueprint-line` directly would be a cyanotype glyph, and the
 * same drawing has to work on the dark surface too (doc's two poles: the lights-off factory
 * and the blueprint). Reading through the sheet's own variable means one `NodeBox` is
 * legible on both registers without the caller choosing a colour for it. The fallback is
 * the blueprint register, so a glyph dropped into a bare `<svg>` outside a sheet still
 * draws rather than inheriting nothing.
 */
export const VIZ_LINE = "var(--viz-line, var(--color-blueprint-line))";
export const VIZ_INK = "var(--viz-ink, var(--color-blueprint-ink))";

/**
 * A node box needs to knock the graticule out from behind its label, and a flat surface
 * colour would be wrong on both registers. Mixing towards the void keeps the box reading
 * as a hole cut in the grid on either one.
 */
export const VIZ_KNOCKOUT = "color-mix(in oklab, var(--color-void) 78%, transparent)";

/**
 * The tones a scene may spend, and what each one means.
 *
 * `human` is the site's violet and `signal` is the site's alarm pink, and they are two
 * entries rather than one because doc 2 §1.1 turns on the difference: where a person acts
 * is a description of a design, and the alarm colour is spent on defects only. `signal`
 * exists for the one drawing that has a defect to show (the edge that fails a bundle with
 * `bundle/prohibition-violated`); nothing else should reach for it, and `HumanMark` cannot,
 * because it takes no tone at all.
 */
export const VIZ_TONE = {
  /** The sheet's drawing colour. The default for structure. */
  line: VIZ_LINE,
  /** The sheet's text colour. The default for a label. */
  ink: VIZ_INK,
  /** A line that is present but subordinate: a leader, a dimension, a bracket. */
  dim: "var(--color-dim)",
  /** A line that stands for something absent. */
  faint: "var(--color-faint)",
  cyan: "var(--color-cyan)",
  emerald: "var(--color-emerald)",
  amber: "var(--color-amber)",
  /** Where a person acts. `lib/format.ts` owns the value; §1.1 owns the reason. */
  human: HUMAN_PRESENCE_MARK.color,
  /** A defect, and nothing else. */
  signal: "var(--color-signal)",
} as const;

export type VizTone = keyof typeof VIZ_TONE;

/** Resolve a tone name to the CSS value a glyph paints with. */
export function toneColor(tone: VizTone): string {
  return VIZ_TONE[tone];
}

/**
 * The metrics. All of them are scene units, which are viewBox units, so a scene that
 * declares `width={720}` gets a 132-unit node box whatever size it renders at.
 *
 * Four stroke weights and no more. A drawing reads as one drawing when its line weights
 * are countable: hairlines for the frame and the dimensions, `base` for everything
 * structural, `bold` for the one thing a scene is about.
 */
export const VIZ = {
  stroke: { hair: 0.75, thin: 1, base: 1.4, bold: 2.2 },
  node: { width: 132, height: 46, radius: 4 },
  /** The arrowhead is drawn, not a `<marker>`: markers need document-unique ids and a
      page carries nine scenes. */
  arrow: { length: 8.5, spread: 3.6 },
  dash: {
    /** An edge that is not there. */
    absent: "6 5",
    /** A leader line from an annotation to the thing it annotates. */
    leader: "3 4",
  },
  /**
   * Sizes in **viewBox units**, not CSS pixels — which is the whole hazard.
   *
   * A label inside an `<svg>` renders at its units times (rendered CSS width ÷ viewBox
   * width). `components/viz/flow.ts` already writes this down for the `FLOW` figures and
   * gives the floor, `FLOW.frame.legible = 10`, with the note that treating the viewport
   * as the rendered width once shipped the landing's labels at 8.1 CSS px. The same
   * reasoning was never applied to these tokens.
   *
   * Measured across the site before this change, all on a 378px viewport and none
   * `aria-hidden`: the since-deleted `SpecLayers` put 44 text nodes at 8.44px and its
   * term-kind row at
   * 6.76px; `EnforcementFigure` put the two sentences carrying its entire argument at
   * 6.76px; `LatticeFigure`'s annotations landed at 8.44px; `SectionLevels` reached
   * 6.98px. Every one of those is `sub`, and every one is below the floor the same repo
   * had already written down.
   *
   * `sub` is 12 so a figure rendering as small as 0.85 scale still clears 10 CSS px.
   * `label` follows it up to keep the two tiers distinct. This makes figures wider
   * rather than smaller, which the sheets absorb: they already scroll inside labelled
   * `role="group"` containers on a phone.
   */
  font: {
    family: "var(--font-mono), monospace",
    label: 14,
    sub: 12,
    mark: 15,
  },
} as const;

/**
 * The three registers a sheet can be drawn on.
 *
 * `grid` names a class that already exists in `app/globals.css`. `.bp-grid` is the
 * cyanotype graticule and wants a blue ground under it; `.copper-grid` is the same
 * graticule in warm ink; `.tech-grid` is the dark pole's coarser rule.
 *
 * `copper` exists for one figure and states its own subject: the annotated node card,
 * where what is on the paper is a document rather than a drawing. It is a register and
 * not a colour a caller picks, so the choice is made once per sheet and every glyph
 * inside it follows through `--viz-line` / `--viz-ink` without being told. Its four
 * variables are declared in `app/globals.css` beside the blueprint pole's, with the
 * measured contrast and the reason it is not amber.
 */
export const SHEET_REGISTER = {
  blueprint: {
    ink: "var(--color-blueprint-ink)",
    line: "var(--color-blueprint-line)",
    surface: "color-mix(in oklab, var(--color-blueprint-deep) 62%, var(--color-void))",
    border: "var(--color-blueprint)",
    grid: "bp-grid",
  },
  copper: {
    ink: "var(--color-copper-ink)",
    line: "var(--color-copper-line)",
    surface: "color-mix(in oklab, var(--color-copper-deep) 62%, var(--color-void))",
    border: "var(--color-copper)",
    grid: "copper-grid",
  },
  dark: {
    ink: "var(--color-fg)",
    line: "var(--color-line-bright)",
    surface: "color-mix(in oklab, var(--color-surface) 92%, transparent)",
    border: "var(--color-line)",
    grid: "tech-grid",
  },
} as const;

export type SheetRegister = keyof typeof SHEET_REGISTER;

/**
 * The drawing's clock, on the same footing as its colours and its stroke weights.
 *
 * This file is where the repo's own rule — never a literal at a call site — points, and
 * until now it had nothing to say about time: nineteen distinct hand-typed durations
 * (120, 150, 180, 200, 220, 260, 420, 480, 500, 520, 560, 600, 640, 700, 780, 1400,
 * 2400, 2600, 5000) and five easing families were spread across six files with no shared
 * source, so two scenes could not agree on what "fast" meant even when both authors
 * wanted the same thing.
 *
 * Every value here mirrors a custom property declared in `app/globals.css` — `--ease-out`,
 * `--ease-in-out`, `--dur-press`, `--dur-fast`, `--dur-base`, `--dur-slow`, `--dur-reveal`
 * — so a CSS transition on a DOM control and a JS timeline on an SVG figure move on one
 * clock. Change a number in one place and change it in the other; they are two spellings
 * of a single decision, not two decisions.
 *
 * The easings are strings because a stylesheet needs a string: `easeOut` below is the
 * exact payload of `--ease-out`, so the four control points are written once and the DOM
 * and the SVG demonstrably move on one curve.
 *
 * ── THEY MAY NOT BE HANDED TO anime.js ──
 * This docblock used to claim the opposite, and the claim cost the site every curve it
 * had. anime.js 4.5.0 has REMOVED the `cubicBezier(x1,y1,x2,y2)` string form: `parseEase`
 * (dist/bundles/anime.esm.js:3578) matches the prefix against a `deprecated` list, warns,
 * and returns `none`, which is `t => t`. A timeline given `MOTION.easeOut` plays LINEAR
 * while reading as correct in the source — which is what every luminous figure was doing.
 * A JS call site imports `EASE_OUT` / `EASE_IN_OUT` from `./easing`, which derives the
 * anime.js easing function from these same two tokens. That module is not re-exported
 * from `index.ts` because it pulls in the engine; this file must stay render-safe.
 *
 * ── Why `outQuad` is retired as the site default ──
 * It is very nearly linear on opacity: a quadratic ease-out spends most of its travel at a
 * near-constant rate, so a node arriving reads as a *dissolve* — a flat cross-fade of the
 * kind a slideshow does — rather than as a lamp switching on. The lamp is the luminous
 * register's whole gesture: a lit disc with a halo is supposed to come up fast and settle,
 * the way a filament does. `easeOut` here (0.23, 1, 0.32, 1) puts almost all of the change
 * in the first third and then eases into rest, which is that shape.
 *
 * ── Why `inOutQuad` is retired on any stroke draw ──
 * It ease-INs. A pen stroke drawn with it starts slow at exactly the moment the reader is
 * watching it begin — the eye is already on the origin of the line, waiting, and the line
 * creeps. Draws take `easeOut`: the pen is already moving when it lands. `easeInOut`
 * survives here for the one job it is honest at, moving a thing that was already at rest
 * from one settled position to another settled position.
 *
 * `pulse` is a loop period rather than a transition duration — the interval of the slow
 * travelling pulse on a luminous edge — and is named here so the several scenes that carry
 * one breathe together.
 */
export const MOTION = {
  /** THE default curve. Every entrance, every hover, every press, every draw. */
  easeOut: "cubicBezier(0.23,1,0.32,1)",
  /** Rest-to-rest moves only: a panel that slides, a value that counts. Never a draw. */
  easeInOut: "cubicBezier(0.77,0,0.175,1)",
  /** 120ms — `:active` feedback. Below this a press reads as a glitch, above it as lag. */
  press: 120,
  /** 160ms — a small thing appearing or swapping: a caret, a dropdown, a tab panel. */
  fast: 160,
  /** 180ms — hover and colour changes. The site's ordinary transition. */
  base: 180,
  /** 420ms — a figure's own parts arriving: a node fading up, an edge drawing. */
  slow: 420,
  /** 520ms — the longest single step a reveal may take. */
  reveal: 520,
  /** 2600ms — the loop period of a travelling pulse on a luminous edge. */
  pulse: 2600,
} as const;

/*
 * `VIZ_SELECTOR` and `vizId` used to close this file: the anime.js contract for the CAD
 * glyphs. Both are gone with those glyphs (redesign spec §1; `Glyphs.tsx` carries the
 * author's own words on the register). `FLOW_SELECTOR` and `flowId` in `flow.ts` are the
 * one selector contract now, and they keep the same attribute values, so a scene converted
 * from one register to the other selects the same things by the same names.
 */
