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

     1. the name arrives a letter at a time      text.splitText
     2. a rule is drawn under it                 svg.createDrawable
     3. the name settles                         createSpring
     4. one pass of light crosses the letters    stagger

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

/** The site's name, and the only word this beat is about. */
const MARK = "DarkPrint";

/**
 * Doc 2 §1's validated claim, verbatim and as one text node.
 *
 * Splitting it with markup would put the two sentences in separate text nodes, and
 * `app/layout.tsx` carries the same string as the document's default description.
 */
const CLAIM = "Specifications go in. Software comes out.";

/** The rule under the name, in scene units. Tall enough for the pulse's stroke. */
const RULE = { width: 900, height: 6 } as const;

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
  settle: 900,
  rule: 820,
  light: 1180,
  claim: 1320,
  cue: 1900,
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
      if (mark === null) return;

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

      /* Set rather than declared as `from` values: a layout effect runs before paint, so
         the hidden state is what the reader's first frame shows and there is no finished
         heading flashing up before it collapses. */
      utils.set(letters, { opacity: 0, translateY: "0.42em", scale: 0.92 });
      utils.set(aura, { opacity: 0, scale: 0.62 });
      utils.set(rule, { draw: "0 0" });
      utils.set(travelling, { opacity: 0 });
      utils.set([...eyebrow, ...claim, ...cue], { opacity: 0, translateY: 10 });

      createTimeline({ defaults: { ease: "outQuad" } })
        .add(aura, { opacity: 1, scale: 1, duration: 1400, ease: "outCubic" }, 0)
        .add(eyebrow, { opacity: 1, translateY: 0, duration: 520 }, AT.eyebrow)
        /* From the centre out, so the two halves of the name arrive together and the
           word reads as one object landing rather than as a line of type being set. */
        .add(
          letters,
          { opacity: 1, translateY: 0, scale: 1, duration: 880, ease: "outExpo" },
          stagger(58, { from: "center", start: AT.letters }),
        )
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
