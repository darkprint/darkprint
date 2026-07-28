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
  font: {
    family: "var(--font-mono), monospace",
    label: 12,
    sub: 10,
    mark: 13,
  },
} as const;

/**
 * The two registers a sheet can be drawn on.
 *
 * `grid` names a class that already exists in `app/globals.css`. `.bp-grid` is the
 * cyanotype graticule and wants a blue ground under it; `.tech-grid` is the dark pole's
 * coarser rule. Nothing new is added to the stylesheet for this.
 */
export const SHEET_REGISTER = {
  blueprint: {
    ink: "var(--color-blueprint-ink)",
    line: "var(--color-blueprint-line)",
    surface: "color-mix(in oklab, var(--color-blueprint-deep) 62%, var(--color-void))",
    border: "var(--color-blueprint)",
    grid: "bp-grid",
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
 * What an anime.js selector may rely on.
 *
 * Every glyph writes a `data-viz` attribute naming what it is, so a scene can drive its
 * own parts without threading a ref through four components:
 * `animate(`${VIZ_SELECTOR.edge}`, { … })` inside a `createScope` rooted on the scene.
 * These strings are the contract; the attribute values are not otherwise load-bearing.
 */
export const VIZ_SELECTOR = {
  node: '[data-viz="node"]',
  edge: '[data-viz="edge"]',
  absentEdge: '[data-viz="absent-edge"]',
  human: '[data-viz="human"]',
  label: '[data-viz="label"]',
} as const;

/** The stable handle a glyph gets from its `id` prop: `[data-viz-id="builder"]`. */
export function vizId(id: string): string {
  return `[data-viz-id="${id}"]`;
}
