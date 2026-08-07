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
     4. one pass of light brightens the letters  stagger

   Beat 4 used to DIM each letter to 48% opacity on its way past. On a
   near-black ground that makes a letter recede into the ground — it
   momentarily disappears, which reads as a flicker, and it was the last
   thing the hero did before settling. Light crossing a lit object makes
   it brighter, so the pass is a `filter: brightness()` sweep now and
   opacity stays pinned at 1 throughout.

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
import { ButtonLink } from "@/components/ui/Button";
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

import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { FLOW, FLOW_SELECTOR, FlowEdge } from "@/components/viz";
import { EASE_OUT } from "@/components/viz/easing";
import { useIsomorphicLayoutEffect, useReveal } from "@/components/viz/useReveal";
import { cx } from "@/lib/format";
import { MCP_CONNECT_COMMAND, MCP_ROUTE } from "@/lib/mcp";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";

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

/**
 * The line under the claim, and the only sentence in the first viewport that names a
 * concrete thing a reader will find.
 *
 * The claim is an abstraction — deliberately, it is the site's one line — and an
 * abstraction alone left the eye ranking the hero brand name → glow → small grey
 * abstraction → the 11px eyebrow that actually said what the product is. This says what
 * the graph, the card and the score ARE, in the reader's own words, so the eyebrow no
 * longer has to carry that job at the bottom of the type scale.
 */
const SUPPORT =
  "DOT graphs of agent pipelines, the YAML card behind every node, and a score for how much autonomy each one takes.";

/* The first viewport used to print three counts ("9 blueprints · 53 node cards · 50
   ontology terms") under the two buttons, handed down from `Hero` as a `stats` prop
   because `PLATFORM_STATS` reaches `node:fs` and this file is `"use client"`. The author
   removed the line; the prop, its `WordmarkCounts` shape and the `Hero` import went with
   it rather than being left threaded through unused. `PLATFORM_STATS` itself stays —
   `components/home/SectionDoors.tsx` still prints the same three figures on beat 5, where
   the sentence that vouches for them ("nothing here is rounded up") lives. */

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

/*
 * `EASE_OUT` is imported from `components/viz/easing.ts` rather than derived here.
 * It was derived here first, and then the same derivation was needed by
 * `useLuminousFlow.ts`, which had the identical bug — the whole site's figures were
 * running linear. One definition, in the file whose docblock explains why the string
 * form in `MOTION` cannot be handed to anime.js at all.
 */

/**
 * The timeline's clock, in milliseconds, in one place.
 *
 * Four beats that overlap deliberately: the rule starts drawing while the last letters are
 * still arriving, and the light crosses them while the rule finishes. Written out rather
 * than chained off each other because the overlaps are the composition.
 *
 * ── Why the second half moved forward ──
 * The claim used to land at 1400 and the way-down cue at 1980, which put the last thing a
 * reader could act on at 2.58s. Everything a reader can act on is now on screen by ~1.6s:
 * the claim at 900, the two buttons at 1080, the CLI chip 180ms behind them.
 *
 * ── Why `settle` moved back ──
 * `settle` is also when the trace overlay is pulled away (`AT.settle - 200`). At 980 that
 * fade ran 780→980ms while the outermost pair of letters — D and t, the two that FRAME the
 * mark — were still cross-fading in: `stagger(58, { from: "center" })` over nine characters
 * offsets them 232ms, so they run 732→952ms and the outline was taken off them two-thirds
 * of the way through. 1180 puts the whole fade after the last letter has landed.
 */
const AT = {
  eyebrow: 120,
  letters: 240,
  settle: 1180,
  rule: 900,
  light: 1260,
  claim: 900,
  cta: 1080,
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
      const cta = root.querySelectorAll<HTMLElement>(handle("cta"));
      const cli = root.querySelectorAll<HTMLElement>(handle("cli"));
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
      utils.set([...eyebrow, ...claim, ...cta, ...cli], { opacity: 0, translateY: 10 });

      createTimeline({ defaults: { ease: EASE_OUT } })
        .add(aura, { opacity: 1, scale: 1, duration: 1400, ease: "outCubic" }, 0)
        .add(eyebrow, { opacity: 1, translateY: 0, duration: 520 }, AT.eyebrow)
        /* The wiring-draw entrance (Task 6): the trace overlay fades in, each letter's
           outline draws in from the centre out — like a circuit trace being sketched,
           the same `svg.createDrawable` mechanic the rule under the name already uses —
           and then each letter "instantiates": its stroke-only trace fades out while the
           real, solid DOM letter fades in underneath it, in place. The overlay fades out
           again once every letter has taken over, just before the settle. */
        .add(traceOverlay, { opacity: 1, duration: 200 }, AT.letters)
        /* `easeOut` and not `inOutQuad`: `inOutQuad` ease-INs, and a pen stroke drawn with
           it creeps at exactly the moment the reader's eye is on the origin of the line,
           waiting for it to begin. A draw takes `easeOut` — the pen is already moving when
           it lands. Same reason the rule below changed. */
        .add(
          traceDrawable,
          { draw: "0 1", duration: 260, ease: EASE_OUT },
          stagger(58, { from: "center", start: AT.letters }),
        )
        /* `AT.letters + 260` is the trace's own draw duration, so the cross-fade for the
           centre letters starts exactly as their outline finishes drawing. */
        .add(
          letters,
          { opacity: 1, duration: 220, ease: EASE_OUT },
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
        .add(rule, { draw: "0 1", duration: 780, ease: EASE_OUT }, AT.rule)
        /* One pass of light across the letters, and then it is over. A loop here would
           be a heading that never stops moving; spec §2 asks for a settle.

           `filter: brightness()` and not `opacity: [1, 0.48, 1]`. Dimming a letter on a
           near-black ground pushes it INTO the ground — it half-disappears and reads as a
           flicker, which is the wrong last impression for a name that has just finished
           arriving. Light passing over a lit object makes it brighter, and because the
           letters carry the cyan `textShadow` by inheritance, brightening the element
           brightens the glow with it: the pass reads as light travelling across the mark
           rather than as the mark blinking. Opacity is left pinned at 1 throughout.

           `filter` is one of the CSS values anime.js decomposes as a COMPLEX tween
           (numbers interpolated inside a matching string shape), so the three keyframes
           have to share the one function they differ in. */
        .add(
          letters,
          {
            filter: ["brightness(1)", "brightness(1.45)", "brightness(1)"],
            duration: 620,
            ease: EASE_OUT,
          },
          stagger(42, { start: AT.light }),
        )
        .add(claim, { opacity: 1, translateY: 0, duration: 700 }, AT.claim)
        .add(travelling, { opacity: 1, duration: 420 }, AT.claim)
        .add(cta, { opacity: 1, translateY: 0, duration: 700 }, AT.cta)
        .add(cli, { opacity: 1, translateY: 0, duration: 700 }, AT.cta + 180);

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
                 to a caption.

                 The upper bound came down from 9rem (144px). At 144px against a 20px muted
                 claim the first viewport ranked brand name → glow → small grey abstraction
                 → the 11px eyebrow that was the only thing saying what the product is, a
                 7.2:1 step that made the sentence the fourth read. 112px against a 30px
                 claim in `text-fg` is 3.7:1, and the sentence becomes the second. */
              fontSize: "clamp(3.4rem, 15vw, 7rem)",
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
          className="block max-w-2xl text-balance font-sans text-xl leading-snug text-fg sm:text-3xl"
        >
          {CLAIM}
        </span>
      </h1>

      {/* The concrete line, outside the `h1` on purpose: the heading's accessible name is
          the site's name and its claim, and a third sentence inside it would announce the
          whole paragraph as the page's one level-one heading. It carries `data-mark="claim"`
          so it arrives on the same beat as the sentence it supports — the timeline selects
          every element with that mark, not one. */}
      <p
        data-mark="claim"
        className="mt-4 max-w-2xl text-balance font-sans text-base leading-relaxed text-muted"
      >
        {SUPPORT}
      </p>

      {/* The first viewport's two real actions.

          Measured before this: the only interactive things above the fold were a CLI chip
          wearing a COMING SOON badge and a "what a blueprint is ↓" cue, while the two
          buttons that open the registry sat at 90% scroll depth. On a phone the header
          collapses into a hamburger, so viewport 1 carried no visible control at all.

          The labels are `SectionDoors`' two doors, verbatim: the landing opens and closes
          on the same two choices in the same words, which is the decision architecture the
          page already ends on rather than a second, differently-worded offer.

          `data-mark="cta"` sits on the button row itself. It used to sit on a column
          wrapper that grouped these buttons with a line of three counts underneath; the
          counts were removed at the author's request, and a wrapper around one child is a
          box that only exists to be a timeline target. The mark moved down onto the row so
          the beat still animates exactly what a reader can act on. */}
      <div
        data-mark="cta"
        className="mt-8 flex flex-wrap items-center justify-center gap-3"
      >
        <ButtonLink href="/blueprints" variant="primary" size="lg">
          Browse the blueprints
        </ButtonLink>
        <ButtonLink href="/build" variant="outline" size="lg">
          Build your own
        </ButtonLink>
      </div>

      {/* The command, moved here 2026-07-29 from the section's top-right corner —
          directly under the claim once it was actually on screen, and below the two real
          buttons since.

          ── It is a different command now, and it runs ──
          It read `$ npx darkprint setup` and wore a `ComingSoonBadge`, because no such
          binary exists and doc 2 §0.4 does not let an invented command stand unmarked.
          That put the landing's ONLY command, in the highest-attention position on the
          site, on a thing a reader could not do. It now prints `SKILL_INSTALL_COMMAND`
          (`lib/skill.ts`): the blueprint-writing skill installs today, out of this
          repository, over git, and the honesty direction is the good one for once — a
          claim getting truer rather than looser.

          The badge came off with the old string, and it came off because the sentence it
          qualified is gone, not because a chip looked tidier without it. Amber still has
          exactly two sanctioned jobs sitewide; the SKILL chip has simply stopped needing
          one of them.

          What that paragraph could not anticipate is that the badge would come back on
          2026-08-07 — on a second chip, beside a second command, for the MCP server this
          one's old string used to imply. That is not the old mistake returning. The old
          mistake was the landing's ONLY command being one nobody could run; there are two
          now, the badge is on the one that cannot, and the one that can carries no badge
          at all. See the two-chip block below for the placement rules.

          The link target moved once, on the same day: `/install` split into `/skill` and
          `/mcp`, and each chip opens the page for its own half.

          `transition-[…]` is spelled out because bare `transition-colors` in Tailwind v4
          includes `outline-color`, which fades the keyboard ring in over 150ms — a reader
          tabbing at 80ms sees a half-strength ring. `scale` is named beside `transform`
          because Tailwind v4 compiles `scale-[0.97]` to the standalone `scale` property,
          which a list naming only `transform` does not cover.

          ── Why the command is green ──
          The author asked for "a shade of green" on the chip. It is `--color-emerald`,
          the palette's only green, and no new token: a fourth accent invented for one
          chip would be a fourth meaning to keep straight. `app/globals.css` records
          emerald as "a figure read off the engine", which is a reading and not a command,
          so this **extends** that meaning rather than reusing it — the common thread is
          that emerald marks something the machine produces or accepts, an engine's own
          register, as against cyan's "you can click this" and violet's "a person acts
          here". The chip is still a link and still gets cyan's affordances by shape
          (border, hover, press), not by colour. The argument is unchanged by the new
          string, and stronger with it: the whole reason emerald was arguable here is that
          this is the engine's own register, and the command now genuinely reaches it.

          What used to sit beside the command, and what its removal did NOT license: the
          paragraph here read "What must NOT go green is `ComingSoonBadge`", because amber
          has exactly two sanctioned jobs sitewide and an emerald-tinted pill would have
          spent one of them wrongly. That is still true everywhere the badge is still
          printed. What changed is that this chip no longer prints one — see the head of
          this comment — so there is no amber on this element to keep apart from the green.
          The chip's fill stays the neutral `bg-surface-2/80` regardless: it was never
          chosen to sit under a pill, it was chosen so the green is a frame and a text
          colour rather than a filled button competing with the two real ones above it.

          Contrast, measured (sRGB, WCAG 2.x), against the chip's real composite ground —
          `bg-surface-2/80` (#0f121e at 80%) over the hero's void (#05060d) resolves to
          #0d101b:
            · `text-emerald` #34d399 on #0d101b … 9.89:1 — past AA 4.5:1 and AAA 7:1.
            · `border-emerald/50` over the void … 3.22:1, and 3.03:1 against the chip's
              own fill: both clear the 3:1 non-text floor, which the `border-line` this
              replaced never did (1.37:1). 40% would have been 2.43:1, so 50 is the rung,
              not a taste call.
            · hover `border-emerald/75` … 5.4:1, comfortably above.
          Hover still lands the text on `text-fg`, unchanged: brightening is the affordance
          this chip already had, and the green frame keeps the register while it happens.

          ── Spacing ──
          `mt-6` (24px) was both off the canonical ladder and too tight under the CTA row:
          the chip read as a third button. `mt-10` is 40px, the block tier, and it is the
          smallest rung that separates the chip from the two buttons above without opening
          a gap the eye reads as a section break. The timeline is unaffected — `cli` is a
          mark on this element itself, not on a wrapper, so the extra margin cannot strand
          a target; the beat still animates exactly the element a reader can click.

          ── The new string is twice as long, so the chip has to be able to wrap ──
          `npx skills@latest add Brotherhood94/darkprint` is 44 characters against the old
          command's 19, and at 390 the hero's column is 358px wide: 46 monospace
          characters at 12px do not fit on one line, and the lifecycle beat already shipped
          41px of unreachable horizontal overflow from exactly this class of string
          (`SectionLifecycle.tsx`, on `min-w-0`). `max-w-full` caps the chip at its
          column, `flex-wrap` lets the row break, and the command is ONE text node so the
          break falls at a space in the command rather than mid-token. `gap-x-2 gap-y-1`
          because a wrapped second line needs a gap the single-line `gap-2` does not
          describe, and `text-left` because a wrapped command reads as a command only when
          its lines start at the same column, inside a hero that is otherwise centred. */}
      {/* ── Two chips as of 2026-08-07, one per half of setup ──
          The author: "On the home page, I want something like 'Connect via MCP: ' and
          insert what to pass to claude code and on click browse to the MCP page. And
          'Design your blueprint: ' with the command to install the skill and on click,
          navigate to the page that provide what to expect from the skill."

          So each chip now carries a label saying what the command is FOR, and the two
          point at the two routes `/install` split into. The label is the reason the chips
          can sit together at all: two bare commands stacked would read as one procedure
          with a first and a second step, and these are alternatives — you would run either
          without running the other.

          ── Order: the one that runs is first, and this is a deliberate departure ──
          The author listed MCP first. The landing's own beat 4 states the rule that
          overrides it — what ships leads, what does not is grouped after it — and this is
          the highest-attention position on the site. It held `$ npx darkprint setup` under
          a `ComingSoonBadge` until the skill shipped, and the whole argument for replacing
          that string was that the landing's lead command should be one a reader can
          actually run. Putting an unrunnable command back above it would undo that on the
          same element. One `.map()` order flip if the author wants it their way; the code
          is written so the flip is exactly that and nothing else.

          ── Only one of the two is emerald ──
          `app/globals.css` gives emerald to "a figure read off the engine", extended by
          the chip that used to be alone here to mean a command that genuinely reaches the
          engine. That meaning is doing real work now that there are two chips: the green
          frame is the difference between the command that installs and the command that
          cannot, visible before either is read. The MCP chip takes `border-line` and
          `text-muted` — the neutral it would have had anyway — plus the badge, which is
          amber's first sanctioned job (`ComingSoonBadge`, "not built yet") and not a third
          meaning invented here.

          A badge and not a caveat sentence, because doc 2 §0.4 asks for the marker beside
          the thing it qualifies and a reader copying a command out of a hero does not read
          a paragraph first. `/mcp` carries the sentence, three times over.

          ── Both keep `data-mark="cli"` ──
          `Wordmark.tsx`'s timeline reads this mark with `querySelectorAll` (line 247), not
          `querySelector`, so a second element joins the beat rather than stealing it. The
          beat still animates exactly the elements a reader can click.

          ── Wrapping, unchanged in principle and worse in fact ──
          The skill command is 44 characters and the MCP command is 48, against the hero's
          358px column at 390. Each command stays ONE text node so a break falls at a space
          rather than mid-token, `max-w-full` caps each chip at the column, and the label
          sits on its own line above the command rather than sharing the first one: a
          two-part chip that wraps between label and command reads as two chips, and at
          390px it would wrap on every load. `items-start` because a wrapped command must
          start at the same column as its own first line. */}
      {/* `w-fit` on a flex column plus the default `align-items: stretch` is what makes the
          two chips the same width: the column takes the width of its widest child, and both
          children then fill it. Measured before it was written — the skill chip's natural
          width is 362px and the MCP chip's is 384px, so a centred pair sat 22px ragged, and
          two boxes that nearly line up read as a mistake in a way two obviously different
          ones do not. `max-w-full` keeps the 384 from forcing a scrollbar at 390, where the
          column is 358 and both commands wrap instead. */}
      <div className="mx-auto mt-10 flex w-fit max-w-full flex-col gap-3">
        {[
          {
            key: "skill",
            label: "Design your blueprint",
            command: SKILL_INSTALL_COMMAND,
            href: SKILL_ROUTE,
            built: true,
          },
          {
            key: "mcp",
            label: "Connect via MCP",
            command: MCP_CONNECT_COMMAND,
            href: MCP_ROUTE,
            built: false,
          },
        ].map((chip) => (
          <Link
            key={chip.key}
            data-mark="cli"
            href={chip.href}
            className={cx(
              "group flex max-w-full flex-col items-start gap-1 rounded-md border bg-surface-2/80 px-3 py-2 text-left transition-[transform,scale,color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97]",
              chip.built
                ? "border-emerald/50 hoverable:hover:border-emerald/75"
                : "border-line hoverable:hover:border-line-bright",
            )}
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="label">{chip.label}</span>
              {!chip.built && <ComingSoonBadge />}
            </span>
            <span
              className={cx(
                "max-w-full font-mono text-xs transition-colors",
                chip.built
                  ? "text-emerald hoverable:group-hover:text-fg"
                  : "text-muted",
              )}
            >
              {`$ ${chip.command}`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
