/* ============================================================
   Where every word in a luminous scene actually lands.

   ── The defect this exists to make findable ──
   `components/home/graph.test.ts` holds the roles placement to its
   frame: no disc off the sheet, no node label off the sheet, no two
   node labels stacked. All three passed while the narrow figure
   shipped reading `builu` and `failure Testence`, because the
   labels that collided were on EDGES, and an edge label's position
   is not a property of a placement file at all. It falls out of the
   run's curve, the loop shift and `labelT`, three things that live
   in the scene's own JSX, so no test over a table of centres could
   have seen it. The caption under the same drawing failed from the
   other direction: 55 characters centred on one node span 336 units
   in a 360-unit frame, so a fifth of it was clipped off the right
   edge on every phone, and it was neither a node label nor a disc.

   So this module models no geometry. It renders a component the way
   the server renders it, walks the `<svg>`, resolves each `<text>`
   through the translations above it, and hands back boxes. Anything
   a scene does to move a label (a bend, a shift, a `labelT`, a new
   annotation) is included by construction, which is the property
   the arithmetic version lacked.

   ── Why it is here and not inside a test file ──
   `components/ui/visible-text.ts` records the reason: a helper that
   is itself a `*.test.ts` registers its own suites once per
   importer, so `vitest` reports the same failures several times and
   a `.only` in one file silences another. This is a plain module,
   and `vitest.config.ts` collects `*.test.ts` alone, so importing
   it costs a caller nothing.

   ── What it refuses to guess ──
   Four things make a walker like this lie rather than fail, and
   all four throw here instead:

     a transform this resolver cannot compose, so a label is
     measured somewhere it is not drawn;
     a transform on an element this walker does not resolve
     transforms for at all, which is the same defect made quiet;
     a `<text>` with no size, whose box would be invented;
     a markup string carrying no scene at all, which passes every
     assertion a caller could write over the result.

   ── What it does not model, stated so nobody reads more into a
      green run than is there ──
   Only `<text>` and stroked `<rect>` are measured. An edge's curve,
   its arrowhead and a node's rings are drawn by `FlowGlyphs.tsx`
   from a centre and a radius and are not collected here, so a word
   sitting on a curve is a defect this module cannot see. Paint
   order is not modelled either: a filled shape drawn after a label
   would cover it and nothing below would say so.
   ============================================================ */

import { renderToStaticMarkup } from "react-dom/server";

/**
 * Advance width of one character as a fraction of the font size.
 *
 * Geist Mono measured 0.600 em (next/font's fallback `size-adjust: 134.59%` × Arial's
 * mean advance 0.4458 em). JetBrains Mono measured 0.600 em by the same method, after
 * the 2026-07-29 font swap (`app/layout.tsx`) — its generated fallback lands on the same
 * `size-adjust: 134.59%`, so the arithmetic and the result are unchanged. 0.62 stays the
 * guard's margin: it is the top of the range any mono face this site has landed on, not
 * a number tied to one font, and `components/home/graph.test.ts` imports this constant
 * rather than keeping a second copy, so the two cannot drift.
 */
export const ADVANCE = 0.62;

/**
 * How close two baselines may be before their boxes are treated as one line.
 *
 * A multiplier on the larger of the two sizes. Below this the words are on the same line
 * as far as a reader is concerned, so the horizontal test decides; above it they are two
 * lines and may sit anywhere.
 */
const LINE = 1.1;

/**
 * How far a word's ink reaches from its baseline, as a fraction of the size.
 *
 * Deliberately *not* the full em the clip test reserves. The two questions are different
 * and want opposite errors. Clipping asks whether a word leaves the sheet, where reserving
 * more than the glyph needs costs a scene nothing; an edge crossing a word asks whether a
 * line is drawn through letters, and a full em above the baseline would report level 4's
 * harness box, whose lower edge clears the capitals of the labels under it by three units,
 * as a word with a line through it. Three quarters above and a fifth below is where a mono
 * face's ascenders and descenders actually land.
 */
const INK = { above: 0.75, below: 0.22 } as const;

export type Anchor = "start" | "middle" | "end";

/** One word in a scene, in absolute frame units. */
export interface PlacedLabel {
  /** The text as a reader sees it, entities resolved and whitespace flattened. */
  text: string;
  /** The anchor point the scene placed it at. */
  x: number;
  /** The baseline. */
  y: number;
  size: number;
  anchor: Anchor;
  /** Left edge of the box, which follows from the anchor. */
  left: number;
  /** Right edge. */
  right: number;
}

/** One stroked rectangle a scene drew, in absolute frame units. */
export interface PlacedBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One `<svg>` a scene rendered, and everything written inside it. */
export interface LabelFrame {
  width: number;
  height: number;
  labels: PlacedLabel[];
  /** Stroked `<rect>`s only. See the header for what is not collected. */
  boxes: PlacedBox[];
}

/* ==================== reading the markup ==================== */

/** The five characters React escapes on the way into markup, undone before measuring. */
function unescape(text: string): string {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/**
 * Every `translate()` in one `transform` attribute, composed.
 *
 * A scene that starts emitting `scale` or `rotate` on a group is a scene this stack of
 * offsets locates wrongly, and locating a label wrongly is worse than not looking at all:
 * the suite would go on passing while the drawing collided. So anything other than a
 * translation throws, and the message names the value so the next author knows what to
 * teach the resolver.
 *
 * `FlowLift` is the reason a scene has no business writing one anyway. It puts the
 * translate on an outer anchor and hands back an inner group with no transform at all,
 * which is what a timeline is allowed to touch (`FlowGlyphs.tsx`).
 */
function translationOf(attrs: string): [number, number] {
  const found = /\stransform="([^"]*)"/.exec(attrs);
  if (found === null) return [0, 0];
  const value = found[1];
  let dx = 0;
  let dy = 0;
  let rest = value;
  const step = /^\s*translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)/;
  for (let m = step.exec(rest); m !== null; m = step.exec(rest)) {
    dx += Number(m[1]);
    dy += m[2] === undefined ? 0 : Number(m[2]);
    rest = rest.slice(m[0].length);
  }
  if (rest.trim() !== "") {
    throw new Error(
      `a scene emits transform="${value}", which this walker cannot resolve; ` +
        "teach it the operation or stop emitting it",
    );
  }
  return [dx, dy];
}

/** A numeric presentation attribute, or `undefined` where the element does not carry it. */
function numberAttr(attrs: string, name: string): number | undefined {
  const found = new RegExp(`\\s${name}="(-?[\\d.]+)"`).exec(attrs);
  return found === null ? undefined : Number(found[1]);
}

/**
 * Extra width `letter-spacing` adds per character.
 *
 * Two scenes spend it and they spell it two ways: `IsolationWall` writes user units on its
 * lane names and `furniture.tsx` writes `em` on every caption in the `/spec` set. A guard
 * that ignored it would under-measure `GENERATION` by 16 units, which is the direction
 * that lets a collision through. Anything in a unit this cannot convert throws, for the
 * reason `translationOf` throws.
 */
function letterSpacingOf(attrs: string, size: number): number {
  const found = /\sletter-spacing="([^"]*)"/.exec(attrs);
  if (found === null) return 0;
  const raw = found[1].trim();
  if (/^-?[\d.]+em$/.test(raw)) return Number(raw.slice(0, -2)) * size;
  if (/^-?[\d.]+$/.test(raw)) return Number(raw);
  throw new Error(`letter-spacing="${raw}" is in a unit this walker does not measure`);
}

function anchorOf(attrs: string): Anchor {
  const found = /\stext-anchor="(start|middle|end)"/.exec(attrs);
  return found === null ? "start" : (found[1] as Anchor);
}

/**
 * How far below `y` the alphabetic baseline sits, which is the line every box is measured
 * from.
 *
 * `HumanFlowNode` centres the pause glyph in its ring with `dominant-baseline="central"`,
 * so `y` there is the middle of the em box rather than the baseline. Reading it as a
 * baseline puts the glyph half a line too high, and the first run of this guard reported
 * level 4's `shipped` sitting on that mark when the two clear each other by four units.
 * Half the em box less the descender is the usual approximation, and it is the difference
 * between a guard that measures a mark and one that invents a collision.
 */
function baselineDropOf(attrs: string, size: number): number {
  return /\sdominant-baseline="(central|middle)"/.test(attrs) ? size * 0.35 : 0;
}

/**
 * Whether an element carries a `transform` at all.
 *
 * The stack below resolves one on `<g>`, `<svg>` and `<text>`. On anything else a
 * translation would move a shape this walker then measures where it is not drawn, which is
 * the defect the whole module exists to make impossible, so it throws with the tag named.
 */
function hasTransform(attrs: string): boolean {
  return /\stransform="/.test(attrs);
}

/**
 * Every `<text>` and every stroked `<rect>` in one `<svg>`, in absolute frame units.
 *
 * A hand-rolled walk rather than a DOM: `vitest.config.ts` runs the suite under
 * `environment: "node"`, and what a scene emits is a stack of translations with words at
 * the leaves. `<tspan>` is walked through rather than around, because `SpecLayers` writes
 * a card line as two of them inside one `<text>` and the pair is one word to a reader.
 *
 * `<rect>` is collected because a box drawn around a group is furniture a word can end up
 * underneath, and nothing here compared the two: `SectionLevels`'s harness rectangle
 * shipped with its top-left corner stroked across the last characters of the word `task`
 * while every case in `scene-labels.test.ts` stayed green, because all of them compared
 * text against text. Only rects that paint an edge are taken — a fill with no stroke draws
 * no line through anything.
 */
function contentsIn(svg: string): { labels: PlacedLabel[]; boxes: PlacedBox[] } {
  const out: PlacedLabel[] = [];
  const boxes: PlacedBox[] = [];
  const stack: [number, number][] = [[0, 0]];
  /* Quote-aware, so a `>` inside an accessible name cannot end a tag early. */
  const token = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*)>|([^<]+)/g;
  let pending: { at: [number, number]; x: number; y: number; size: number; anchor: Anchor; spacing: number } | null =
    null;
  let buffer = "";

  for (let m = token.exec(svg); m !== null; m = token.exec(svg)) {
    const [, closing, tag, attrs = "", textRun] = m;

    if (textRun !== undefined) {
      if (pending !== null) buffer += textRun;
      continue;
    }

    const selfClosing = attrs.trimEnd().endsWith("/");

    if (tag === "text") {
      if (closing === "/") {
        if (pending !== null) {
          const text = unescape(buffer).replace(/\s+/g, " ").trim();
          if (text !== "") {
            const width = text.length * (pending.size * ADVANCE + pending.spacing);
            const x = pending.at[0] + pending.x;
            const left =
              pending.anchor === "start" ? x : pending.anchor === "middle" ? x - width / 2 : x - width;
            out.push({
              text,
              x,
              y: pending.at[1] + pending.y,
              size: pending.size,
              anchor: pending.anchor,
              left,
              right: left + width,
            });
          }
          pending = null;
          buffer = "";
        }
        continue;
      }
      if (selfClosing) continue;
      const size = numberAttr(attrs, "font-size");
      if (size === undefined) {
        throw new Error(
          "a scene writes a <text> with no font-size, so its box would be invented; " +
            "state the size on the element",
        );
      }
      /* A `<text>` may carry its own transform, and the first version of this walker read
         it only on the containers above. A `transform="translate(…)"` written on the
         element itself was silently dropped and the word measured where it is not drawn —
         the one outcome the header promises this module refuses. */
      const [tdx, tdy] = translationOf(attrs);
      const at = stack[stack.length - 1];
      pending = {
        at: [at[0] + tdx, at[1] + tdy],
        x: numberAttr(attrs, "x") ?? 0,
        y: (numberAttr(attrs, "y") ?? 0) + baselineDropOf(attrs, size),
        size,
        anchor: anchorOf(attrs),
        spacing: letterSpacingOf(attrs, size),
      };
      buffer = "";
      continue;
    }

    /* Only the two elements that can carry an offset move the stack. Every other close
       tag is ignored, which keeps the stack balanced without modelling the whole of SVG. */
    if (tag === "g" || tag === "svg") {
      if (closing === "/") stack.pop();
      else if (!selfClosing) {
        const [dx, dy] = translationOf(attrs);
        const top = stack[stack.length - 1];
        stack.push([top[0] + dx, top[1] + dy]);
      }
      continue;
    }

    if (closing === "/") continue;

    if (tag === "rect") {
      /* Resolved before the stroke is looked at, so a rect this walker could not place
         throws whether or not it happens to paint an edge. */
      const [dx, dy] = translationOf(attrs);
      const stroke = /\sstroke="([^"]*)"/.exec(attrs);
      const width = numberAttr(attrs, "width");
      const height = numberAttr(attrs, "height");
      if (stroke !== null && stroke[1] !== "none" && width !== undefined && height !== undefined) {
        const at = stack[stack.length - 1];
        const x = (numberAttr(attrs, "x") ?? 0) + at[0] + dx;
        const y = (numberAttr(attrs, "y") ?? 0) + at[1] + dy;
        boxes.push({ left: x, top: y, right: x + width, bottom: y + height });
      }
      continue;
    }

    /* Anything else carrying a transform is a shape this walk would go on measuring at its
       untransformed coordinates. Naming the tag is the whole point: the next author is
       told which element to teach the resolver about rather than reading a green suite. */
    if (hasTransform(attrs)) {
      throw new Error(
        `a scene writes a transform on <${tag}>, which this walker resolves only on ` +
          "<g>, <svg>, <text> and <rect>; teach it the element or stop emitting it",
      );
    }
  }
  return { labels: out, boxes };
}

/**
 * Every luminous scene in a markup string, in document order.
 *
 * Scoped to `data-viz-flow`, which `FlowScene` writes and nothing else does, so a page's
 * icons and its wordmark stay out of a figure's collision test. A string with no scene in
 * it throws: a walk that silently matched nothing passes every assertion a caller could
 * write underneath it, which is the failure mode this whole module is guarding against.
 */
export function framesIn(markup: string): LabelFrame[] {
  const svgs = (markup.match(/<svg[\s\S]*?<\/svg>/g) ?? []).filter((svg) =>
    /^<svg[^>]*\sdata-viz-flow=/.test(svg),
  );
  if (svgs.length === 0) throw new Error("no luminous scene was rendered");
  return svgs.map((svg) => {
    const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    if (box === null) throw new Error("a scene rendered without a viewBox");
    return { width: Number(box[1]), height: Number(box[2]), ...contentsIn(svg) };
  });
}

/** The same, from a component: `framesOf(createElement(SectionRoles))`. */
export function framesOf(element: React.ReactNode): LabelFrame[] {
  return framesIn(renderToStaticMarkup(element));
}

/* ==================== the two comparisons ==================== */

/**
 * Words the sheet cuts, as sentences naming the overshoot.
 *
 * Four edges, because a label leaves a frame four ways and three of them shipped at least
 * once: `SectionRoles` ran a caption 77 units past the right edge, and a label placed
 * under the bottom disc of a column is the same defect turned ninety degrees. The top rule
 * measures from the baseline up by one size, which is where the capitals of a mono face
 * reach.
 */
export function clippedLabels(frame: LabelFrame): string[] {
  const out: string[] = [];
  for (const label of frame.labels) {
    if (label.left < 0) {
      out.push(`"${label.text}" starts ${(-label.left).toFixed(0)} units off the left`);
    }
    if (label.right > frame.width) {
      out.push(
        `"${label.text}" runs ${(label.right - frame.width).toFixed(0)} units past the right`,
      );
    }
    if (label.y - label.size < 0) {
      out.push(`"${label.text}" reaches ${(label.size - label.y).toFixed(0)} units above the sheet`);
    }
    if (label.y > frame.height) {
      out.push(`"${label.text}" sits ${(label.y - frame.height).toFixed(0)} units below the sheet`);
    }
  }
  return out;
}

/**
 * Pairs of words written over each other.
 *
 * Two boxes collide when their baselines are within one line height and their horizontal
 * ranges meet. The ranges come from the anchor rather than from the anchor point, which is
 * what the first version of this comparison got wrong: it measured every box as `x ± half`
 * and would have read `SectionLevels`'s right-anchored harness caption and every
 * `/spec` lane label as sitting half a width to the right of where they are drawn.
 */
export function collidingLabels(frame: LabelFrame): string[] {
  const out: string[] = [];
  for (let i = 0; i < frame.labels.length; i += 1) {
    for (let j = i + 1; j < frame.labels.length; j += 1) {
      const a = frame.labels[i];
      const b = frame.labels[j];
      const line = Math.max(a.size, b.size) * LINE;
      const apart = Math.abs(a.y - b.y) >= line || a.right <= b.left || b.right <= a.left;
      if (!apart) out.push(`"${a.text}" over "${b.text}"`);
    }
  }
  return out;
}

/**
 * Words with the edge of a box drawn through them.
 *
 * The third comparison, and the one that was missing when `SectionLevels`'s harness
 * rectangle moved 46 units left onto the start of the path: its top-left corner was
 * stroked across the last characters of `task` and the suite stayed green, because
 * `collidingLabels` compares words with words and nothing compared a word with the
 * furniture around it.
 *
 * A word wholly inside a box is not a collision — that is a caption in a panel, which is
 * how `IsolationWall` and the `/spec` figures are drawn. A word wholly outside is not one
 * either. What is reported is a word the outline passes through: its ink overlaps the
 * rectangle and is not contained by it. Rounded corners are ignored, which reports a word
 * tucked into a corner arc that the arc misses; that is the direction to be wrong in.
 */
export function labelsOverBoxEdges(frame: LabelFrame): string[] {
  const out: string[] = [];
  for (const label of frame.labels) {
    const top = label.y - label.size * INK.above;
    const bottom = label.y + label.size * INK.below;
    for (const box of frame.boxes) {
      const meets =
        label.right > box.left &&
        label.left < box.right &&
        bottom > box.top &&
        top < box.bottom;
      const inside =
        label.left > box.left &&
        label.right < box.right &&
        top > box.top &&
        bottom < box.bottom;
      if (meets && !inside) out.push(`a box edge is drawn through "${label.text}"`);
    }
  }
  return out;
}
