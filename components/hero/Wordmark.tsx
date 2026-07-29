"use client";

/* ============================================================
   Beat 1 of redesign spec §2: the wordmark, animated.

   This is the one thing the author asked for by name. The pass
   before this replaced a 280vh sticky scaffold that morphed the
   wordmark over a three.js factory with a two-column hero, and the
   verdict on it was that the site "should be fancy with the text
   DarkPrint like previous and now it is a flat landing page". So
   the whole of the landing's animation budget is spent here, on
   four beats and nothing else:

     1. each letter draws, then instantiates     splitText + svg.createDrawable
     2. a rule is drawn under it                 svg.createDrawable
     3. the name settles                         createSpring
     4. one pass of light crosses the letters    stagger

   Beat 1's own two steps, added when the letter arrival became a
   "wiring-draw" (Task 6 of the visual-polish plan): a `data-mark="trace"`
   overlay — nine letterform outlines traced from
   `components/hero/wordmark-paths.ts` — draws in stroke-only, center out,
   then cross-fades into the real, solid `dp-char` letters beneath it and
   fades back out. The overlay is `opacity-0` by default in the markup: it
   is a JS-only decorative layer, and its own resting state (after the
   entrance settles, and for a reader who never runs the timeline) is
   invisible, leaving only the real letters `data-mark="mark"` carries.

   ── What stays true with no script ──
   Spec §0: text is real DOM at SSR time and animation only moves
   opacity, transform and stroke of what is already there. The
   server renders the finished thing: the name at full opacity, the
   rule already drawn, the claim in place. `useReveal`'s `static`
   phase covers the server, a reader with JS off and a reader who
   asked for reduced motion, and in that phase not one line below
   runs. `text.splitText` therefore never produces the heading; it
   only takes a heading that is already there and cuts it up, and
   it puts a visually-hidden copy of the original back in the same
   element so the accessible name survives the cut.

   ── Why the claim is inside the `h1` ──
   Doc 2 §2.4 wants the landing's `h1` to be real indexable text,
   and doc 2 §1's validated claim is the sentence that belongs in
   it. The name alone would make the site's one level-one heading a
   brand word. So the heading carries both, in two block spans, and
   the claim stays a single text node because the build's own greps
   read it out of `.next/server/app/index.html` as one string.

   ── Why the rule is a `FlowEdge` ──
   Redesign spec §1 replaced the CAD register with luminous flow,
   and a drawn line with a light travelling it is that register's
   signature. Reaching for `components/viz`'s edge rather than
   drawing two paths here is what keeps the stroke weights, the
   dash rhythm and the travel speed the same as every figure
   further down the page.
   ============================================================ */

import Link from "next/link";
import {
  animate,
  createScope,
  spring,
  createTimeline,
  splitText,
  stagger,
  svg,
  utils,
} from "animejs";

import { FLOW, FLOW_SELECTOR, FlowEdge } from "@/components/viz";
import { useIsomorphicLayoutEffect, useReveal } from "@/components/viz/useReveal";

import { WORDMARK_LETTER_PATHS } from "./wordmark-paths";

/** The site's name, and the only word this beat is about. */
const MARK = "DarkPrint";

/**
 * The site's claim, verbatim and as one text node.
 *
 * Replaced 2026-07-29 at the author's request: doc 2 §1's original line
 * ("Specifications go in. Software comes out.") didn't evoke what the site is for — a
 * registry of graphs that define a pipeline's autonomy, published so others can read and
 * reuse them as-is. Splitting the claim with markup would put its words in separate text
 * nodes, and `app/layout.tsx` carries the same string in its own metadata.
 */
const CLAIM = "Autonomy you can read as a graph.";

/** The rule under the name, in scene units. Tall enough for the pulse's stroke. */
const RULE = { width: 900, height: 6 } as const;

/** Cumulative x-offset of each letter, and the overlay's total width, in the same
    100-unit em box `scripts/generate-wordmark-paths.ts` generated the paths in.

    Each letter's `advance` is reduced by 3.5 units before accumulating: the real
    `data-mark="mark"` text below renders with `tracking-[-0.035em]`, i.e. -3.5 units
    of letter-spacing per character in this 100-unit em box, so the real text's
    rendered width is narrower than the raw sum of `advance` (451.8 units for
    "DarkPrint" vs. 420.3 actually rendered). Without this adjustment the overlay's
    `viewBox` is wider than the box `preserveAspectRatio="xMidYMid meet"` fits it into
    (the real, narrower text's box), so it gets scaled down ~7% instead of matching at
    scale 1.0 — the trace would render visibly smaller than the letters it fades into. */
const WORDMARK_LAYOUT = (() => {
  let x = 0;
  const offsets = WORDMARK_LETTER_PATHS.map((letter) => {
    const at = x;
    x += letter.advance - 3.5;
    return at;
  });
  // Rounded to avoid float noise (e.g. `420.30000000000007`) in the shipped `viewBox`.
  return { offsets, totalWidth: Math.round(x * 100) / 100 };
})();

/**
 * The vertical box the trace overlay's `viewBox` uses, derived from where the letterforms
 * actually put ink rather than from the generator comment's nominal "100 units tall."
 *
 * `getPath` scales each glyph to a baseline at y=0 with ascenders in negative y (SVG is
 * y-down); "DarkPrint" has no descenders, so every coordinate in `WORDMARK_LETTER_PATHS`
 * falls in roughly [-71, 1.5]. A `viewBox` of `0 0 W 100` — spanning only positive y — would
 * put almost the whole glyph above the visible box and draw nothing. Scanning the actual
 * path data for its true bounds (rather than hand-picking a number that would go stale the
 * moment the wordmark or font changes) keeps this correct if `wordmark-paths.ts` is ever
 * regenerated.
 *
 * Only `M`/`L`/`Q` appear in the generated data (a TrueType, quadratic-curve font), and
 * every argument list for those three commands is a whole number of `(x, y)` pairs, so the
 * numbers alternate x, y, x, y, ... across the whole path regardless of command boundaries.
 */
const WORDMARK_INK = (() => {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const letter of WORDMARK_LETTER_PATHS) {
    const numbers = letter.d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    for (let i = 1; i < numbers.length; i += 2) {
      const y = numbers[i];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const pad = 6;
  // Rounded to avoid float noise (e.g. `-76.70000000000002`) in the shipped `viewBox`.
  return {
    top: Math.round((minY - pad) * 100) / 100,
    height: Math.round((maxY - minY + pad * 2) * 100) / 100,
  };
})();

/** Every element the timeline touches carries this, and the timeline finds them by it. */
function handle(id: string): string {
  return `[data-mark="${id}"]`;
}

/**
 * The timeline's clock, in milliseconds, in one place.
 *
 * Four beats that overlap deliberately: the rule starts drawing while the last letters are
 * still arriving, and the light crosses them while the rule finishes. Written out rather
 * than chained off each other because the overlaps are the composition.
 */
const AT = {
  eyebrow: 120,
  letters: 240,
  settle: 980,
  rule: 900,
  light: 1260,
  claim: 1400,
  cue: 1980,
} as const;

export function Wordmark() {
  const { ref, phase } = useReveal<HTMLDivElement>({ amount: 0.05 });

  useIsomorphicLayoutEffect(() => {
    /* `static` is the server, a reader without JS and a reader who asked for reduced
       motion. All three already have the finished heading, and playing here would take it
       apart in front of exactly the reader who said no. */
    if (phase !== "shown") return;
    const root = ref.current;
    if (root === null) return;

    const scope = createScope({ root }).add(() => {
      const mark = root.querySelector<HTMLElement>(handle("mark"));
      const traceOverlay = root.querySelector<SVGSVGElement>(handle("trace"));
      if (mark === null || traceOverlay === null) return;

      /* `accessible` defaults on, which inserts a visually-hidden copy of the original
         text and marks every generated span `aria-hidden`. That is what lets the heading
         be cut into nine boxes without the accessible name becoming nine letters. */
      const splitter = splitText(mark, { chars: { class: "dp-char" } });
      const letters = splitter.chars;

      const eyebrow = root.querySelectorAll<HTMLElement>(handle("eyebrow"));
      const claim = root.querySelectorAll<HTMLElement>(handle("claim"));
      const cue = root.querySelectorAll<HTMLElement>(handle("cue"));
      const aura = root.querySelectorAll<HTMLElement>(handle("aura"));
      const rule = svg.createDrawable(root.querySelectorAll(FLOW_SELECTOR.line));
      const travelling = root.querySelectorAll<SVGPathElement>(FLOW_SELECTOR.pulse);

      /* The wiring-draw overlay (Task 6): each letter's outline traces in, then the real
         letter beneath it cross-fades in and the trace fades out. `traceOverlay` is the
         whole `<svg>`, faded in and out as one unit for the beat's duration; `traceDrawable`
         wraps its nine letterform `<path>`s so each can be drawn with `svg.createDrawable`,
         the same mechanic the rule under the name already uses. */
      const traceLetters = root.querySelectorAll<SVGPathElement>(
        `${handle("trace")} [data-mark="trace-letter"]`,
      );
      const traceDrawable = svg.createDrawable(traceLetters);

      /* Set rather than declared as `from` values: a layout effect runs before paint, so
         the hidden state is what the reader's first frame shows and there is no finished
         heading flashing up before it collapses. */
      // Letters no longer slide or scale in — they stay in their final position and
      // simply wait, invisible, for the trace overlay to draw and then cross-fade
      // into them.
      utils.set(letters, { opacity: 0 });
      utils.set(aura, { opacity: 0, scale: 0.62 });
      utils.set(rule, { draw: "0 0" });
      utils.set(traceDrawable, { draw: "0 0" });
      utils.set(travelling, { opacity: 0 });
      utils.set([...eyebrow, ...claim, ...cue], { opacity: 0, translateY: 10 });

      createTimeline({ defaults: { ease: "outQuad" } })
        .add(aura, { opacity: 1, scale: 1, duration: 1400, ease: "outCubic" }, 0)
        .add(eyebrow, { opacity: 1, translateY: 0, duration: 520 }, AT.eyebrow)
        /* The wiring-draw entrance (Task 6): the trace overlay fades in, each letter's
           outline draws in from the centre out — like a circuit trace being sketched,
           the same `svg.createDrawable` mechanic the rule under the name already uses —
           and then each letter "instantiates": its stroke-only trace fades out while the
           real, solid DOM letter fades in underneath it, in place. The overlay fades out
           again once every letter has taken over, just before the settle. */
        .add(traceOverlay, { opacity: 1, duration: 200 }, AT.letters)
        .add(
          traceDrawable,
          { draw: "0 1", duration: 260, ease: "inOutQuad" },
          stagger(58, { from: "center", start: AT.letters }),
        )
        /* `AT.letters + 260` is the trace's own draw duration, so the cross-fade for the
           centre letters starts exactly as their outline finishes drawing. */
        .add(
          letters,
          { opacity: 1, duration: 220, ease: "outQuad" },
          stagger(58, { from: "center", start: AT.letters + 260 }),
        )
        .add(traceOverlay, { opacity: 0, duration: 200 }, AT.settle - 200)
        /* The settle. A spring rather than an ease because the overshoot is the point:
           the name arrives slightly large and comes to rest, which is what makes it read
           as having weight. A spring ignores `duration` and stops when it stops.

           `spring()` and not `createSpring()`: animejs 4.5.0 deprecated the second, and
           `easings/spring/index.js` fires a `console.warn` from its body. Both are
           exported from the same module and take the same parameters, so the deprecated
           name cost a warning in the console on every view of the landing and bought
           nothing. */
        .add(
          mark,
          { scale: [1.035, 1], ease: spring({ stiffness: 120, damping: 12 }) },
          AT.settle,
        )
        .add(rule, { draw: "0 1", duration: 780, ease: "inOutQuad" }, AT.rule)
        /* One pass of light across the letters, and then it is over. A loop here would
           be a heading that never stops moving; spec §2 asks for a settle. */
        .add(
          letters,
          { opacity: [1, 0.48, 1], duration: 560 },
          stagger(42, { start: AT.light }),
        )
        .add(claim, { opacity: 1, translateY: 0, duration: 700 }, AT.claim)
        .add(travelling, { opacity: 1, duration: 420 }, AT.claim)
        .add(cue, { opacity: 1, translateY: 0, duration: 600 }, AT.cue);

      /* The one thing that keeps moving after the entrance, and it is the register's
         signature rather than decoration: `pathLength="1"` on the pulse puts the dash
         pattern in a normalised space, so one whole unit of offset is one traversal of
         the rule and the loop closes on the value it started from. */
      if (travelling.length > 0) {
        animate(travelling, {
          strokeDashoffset: [FLOW.pulse.rest, FLOW.pulse.rest - 1],
          duration: FLOW.pulse.duration,
          ease: "linear",
          loop: true,
        });
      }

      /* `createScope` reverts the animations it built; the splitter is not one of them,
         and a scope constructor may return its own teardown for exactly this. Without it
         a route change would leave the heading as nine detached spans. */
      return () => {
        splitter.revert();
      };
    });

    return () => {
      scope.revert();
    };
  }, [phase, ref]);

  return (
    <div ref={ref} className="relative flex flex-col items-center text-center">
      {/* The light the name sits in. Decorative, and drawn from the palette rather than
          from a literal, so it follows the theme like everything else. */}
      <div
        aria-hidden
        data-mark="aura"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[36rem] w-[36rem] max-w-none -translate-x-1/2 -translate-y-1/2 sm:h-[46rem] sm:w-[46rem]"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-cyan) 16%, transparent), transparent)",
        }}
      />

      <p data-mark="eyebrow" className="eyebrow">
        Blueprint registry
      </p>

      <h1 className="mt-5 flex flex-col items-center gap-3 sm:gap-4">
        {/* `relative`, sized to nothing but the name itself (the overlay below is
            `absolute` and so does not add to it) — the wiring-draw trace has to land on
            top of exactly the letters, not the whole heading (which also carries the rule
            and the claim beneath it). */}
        <div className="relative">
          <span
            data-mark="mark"
            suppressHydrationWarning
            className="block font-display font-semibold leading-[0.92] tracking-[-0.035em] text-fg"
            style={{
              /* The lower bound is what a 390-pixel phone gets, and it is set from the word
                 rather than from a scale: nine characters of the display face at 15vw fill
                 a phone's text column and stop, so the name never wraps and never shrinks
                 to a caption. */
              fontSize: "clamp(3.4rem, 15vw, 9rem)",
              textShadow:
                "0 0 32px color-mix(in oklab, var(--color-cyan) 32%, transparent), 0 0 120px color-mix(in oklab, var(--color-blueprint-line) 22%, transparent)",
            }}
          >
            {MARK}
          </span>

          {/* The wiring-draw overlay. Invisible by default (`opacity-0`, no JS needed) —
              a reader with no JS or reduced motion never sees a half-drawn letter, only
              the finished `data-mark="mark"` text above. JS-only readers get this faded
              in for the draw beat and back out again once the real letters take over. */}
          <svg
            aria-hidden
            data-mark="trace"
            viewBox={`0 ${WORDMARK_INK.top} ${WORDMARK_LAYOUT.totalWidth} ${WORDMARK_INK.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            fill="none"
            stroke="var(--color-cyan-bright)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {WORDMARK_LETTER_PATHS.map((letter, i) => (
              <g key={`${letter.char}-${i}`} transform={`translate(${WORDMARK_LAYOUT.offsets[i]}, 0)`}>
                <path data-mark="trace-letter" d={letter.d} />
              </g>
            ))}
          </svg>
        </div>

        {/* The rule, drawn. `aria-hidden` because the heading says everything it says;
            a decorative line with an accessible name is a second announcement of the
            same word. Radii and gap at zero so it spans the full width it is given. */}
        <svg
          aria-hidden
          viewBox={`0 0 ${RULE.width} ${RULE.height}`}
          style={{ aspectRatio: `${RULE.width} / ${RULE.height}` }}
          className="block h-auto w-[min(100%,34rem)]"
          fill="none"
          strokeLinecap="round"
        >
          <FlowEdge
            from={[0, RULE.height / 2]}
            to={[RULE.width, RULE.height / 2]}
            tone="cyan"
            arrow={false}
            fromRadius={0}
            toRadius={0}
            gap={0}
          />
        </svg>

        <span
          data-mark="claim"
          className="block max-w-xl text-balance font-sans text-base leading-relaxed text-muted sm:text-xl"
        >
          {CLAIM}
        </span>
      </h1>

      {/* The way down. A real link rather than a chevron, so the first thing a keyboard
          reader reaches says where it goes. */}
      <Link
        data-mark="cue"
        href="#blueprint"
        className="mt-12 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-dim transition-colors hover:text-fg sm:mt-16"
      >
        what a blueprint is
        <span aria-hidden>&darr;</span>
      </Link>
    </div>
  );
}
