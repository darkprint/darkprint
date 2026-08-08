"use client";

/* ============================================================
   Four words, one inside the next, arriving one at a time.

   The author, 2026-08-08: move the nested figure to "a new section that starts with such
   drawing … the node should be clear they are cards in the blueprint, maybe you can
   substitute the node with a minimal drawing of a card. On the right the description of
   what it is. When scrolling it appears the box harness with its description and when
   scrolling further appear the rubric box and its description and eventually the eval box."

   So the figure is a walk rather than a plate. It opens on the one object this site
   actually hands over — a blueprint — and the three words that surround it arrive in the
   order a reader would meet them: give the blueprint a runtime, decide what good looks
   like, then measure. Each frame's sentence lands with its frame.

   ── The definitions are the author's document, not the site's guesses ──
   The figure this replaces carried `agent = model + harness` in its caption and the author
   struck it: "remove … as it is not totally correct. The correct namings and definitions
   you find here". That document's own table is unambiguous, and two of its rows are what
   the equation got wrong:

     Agente        Applicazione       LLM con strumenti, memoria e stato che decide e
                                      agisce in loop
     Harness       Runtime dell'agente Orchestrazione del loop: dispatch tool, gestione
                                      contesto, persistenza, safety tecnica
     Eval          Misura offline     Valutazioni statistiche su dataset di goldens
     Rubric        Schema di scoring  Criteri multi-dimensionali usati da metriche e
                                      LLM-judge per assegnare punteggi

   An agent is the APPLICATION, not a sum: a model with tools, memory and state, deciding
   and acting in a loop. The harness is that agent's RUNTIME. "Model + harness" left out
   the tools, the memory and the state, and it put the agent on the same footing as an
   arithmetic identity — which is why none of the four sentences below is written as one.

   The same document draws the eval/rubric line the old figure blurred. An eval is an
   offline measure over a distribution of inputs, not a test of one exact output; a rubric
   is the scoring schema it applies. It also names the offline/online split, which is why
   the word "guardrail" is not in this figure at all: a guardrail acts on the live path, and
   nothing here is live.

   ── The static state is all four ──
   `useScrollProgress` reports 1 and attaches nothing when motion is off, so the server, a
   reader without JS and a reader who asked for stillness get every frame and every sentence
   at once. The pin and the staging are the enhancement. Nothing is `hidden`, and the
   unreached rows are dimmed rather than removed, so find-in-page reaches all four.
   ============================================================ */

import { cx } from "@/lib/format";
import { stagesShown, useScrollProgress } from "@/components/viz/useScrollProgress";

/**
 * The four frames, innermost first, which is also the order they arrive in.
 *
 * `id` is the word; `role` is the one-line answer to "what level of the stack is this",
 * lifted from the document's own middle column; `body` is what it does here.
 */
/**
 * Each frame's colour, in one place, because two elements now read it.
 *
 * The author, 2026-08-08: "the scrolling and appearing is not synched with the text and the
 * text paragraph should be of the same color of the part appearing."
 *
 * The staging WAS synchronised — one `shown` drives the frames and the rows, and both
 * transition over the same 500ms — and it did not read as synchronised, which is the same
 * defect from the reader's side. Nothing tied a paragraph to the box that arrived with it:
 * four grey paragraphs beside four frames means the eye has to notice which of the four
 * nested rectangles changed opacity, and the rubric's is a thin empty strip.
 *
 * Colour is the tie. `accent` is the frame's own register at full strength, on the label and
 * on the term; `ink` is the reading weight for a whole paragraph in it.
 *
 * The two poles have an ink of their own and it is used: `blueprint-ink` exists precisely
 * to set body text on the cyanotype register. Emerald and violet do not, so theirs is mixed
 * toward `--color-fg`, which lands them near the same lightness rather than putting a
 * saturated accent under fifty words of prose.
 *
 * The harness keeps `--color-muted`, which is not a compromise: it is the one box a reader
 * brings themselves, it is deliberately the only frame with no accent, and a paragraph in
 * the page's ordinary body colour says exactly that.
 *
 * Measured on `bg-void` (#050609), the ground this band runs on:
 *
 *   blueprint-ink  #cfe2ff                             16.3 : 1
 *   muted          #9aa1ba                              8.6 : 1
 *   emerald ink    55% #34d399 over #e6e9f2            13.4 : 1
 *   violet ink     55% #a78bfa over #e6e9f2            11.7 : 1
 *   blueprint-line #74b4ff  (term, 13px)                9.4 : 1
 *   emerald        #34d399  (term, 13px)               11.6 : 1
 *   violet         #a78bfa  (term, 13px)                7.6 : 1
 */
const TONE = {
  blueprint: {
    accent: "var(--color-blueprint-line)",
    ink: "var(--color-blueprint-ink)",
  },
  harness: {
    accent: "var(--color-muted)",
    ink: "var(--color-muted)",
  },
  rubric: {
    accent: "var(--color-emerald)",
    ink: "color-mix(in oklab, var(--color-emerald) 55%, var(--color-fg))",
  },
  eval: {
    accent: "var(--color-violet)",
    ink: "color-mix(in oklab, var(--color-violet) 55%, var(--color-fg))",
  },
} as const;

const LAYERS = [
  {
    id: "blueprint",
    role: "the specification",
    body:
      "The graph and the cards it pins: which agents exist, what each is handed, what each " +
      "is kept away from. Text, versioned, checkable, and the only one of the four you " +
      "download from here.",
  },
  {
    id: "harness",
    role: "the agent's runtime",
    body:
      "What runs the loop: it dispatches the tools, manages the context, keeps the session " +
      "state and enforces the safety invariants. An agent is a model with tools, memory and " +
      "state acting in that loop; the harness is what the loop runs on. You bring your own.",
  },
  {
    id: "rubric",
    role: "the scoring schema",
    body:
      "The criteria a result is graded against, several at once, each with a scale: what " +
      "turns “good” into something with an answer. Deterministic checks, a judge model, or " +
      "both. It is written down before the run, which is what makes two runs comparable.",
  },
  {
    id: "eval",
    role: "the measurement",
    body:
      "Running the blueprint through the harness and grading what comes back. Not a test of " +
      "one exact output: an eval asks whether behaviour is acceptable across a distribution " +
      "of inputs, and reports it in aggregate. It happens offline, before anything ships.",
  },
] as const;

/**
 * A node, drawn as the card it is.
 *
 * The author: "I want that the node should be clear they are cards in the blueprint, maybe
 * you can substitute the node with a minimal drawing of a card."
 *
 * The lit disc is right on every other surface, where a node is a step in a run and its
 * colour carries a kind. It is wrong HERE, in the one drawing whose whole subject is what a
 * blueprint is made of: the sentence beside it says "the graph and the cards it pins", and
 * a disc draws the graph and hides the cards.
 *
 * Deliberately minimal: a frame, a rule under a header, two body lines. No text, because at
 * 18 units wide any word would land under the site's 10px legibility floor, and because
 * four labelled cards would be a card figure rather than a graph of them. `CardStackFigure`
 * is the drawing that names fields, one section up the page.
 */
function CardNode({ x, y }: { x: number; y: number }) {
  const w = 22;
  const h = 16;
  return (
    <g transform={`translate(${x - w / 2} ${y - h / 2})`}>
      <rect
        width={w}
        height={h}
        rx={2.5}
        fill="var(--color-blueprint-deep)"
        fillOpacity={0.9}
        stroke="var(--color-blueprint-ink)"
        strokeWidth={1}
      />
      {/* The header rule: the line a card's id and version sit on. */}
      <path
        d={`M 0 5.5 L ${w} 5.5`}
        stroke="var(--color-blueprint-ink)"
        strokeOpacity={0.75}
        strokeWidth={0.8}
      />
      {[9.5, 12.5].map((ly, i) => (
        <path
          key={ly}
          d={`M 3.5 ${ly} L ${i === 0 ? w - 4 : w - 9} ${ly}`}
          stroke="var(--color-blueprint-line)"
          strokeOpacity={0.8}
          strokeWidth={0.8}
        />
      ))}
    </g>
  );
}

/** One run between two cards, trimmed to both rectangles rather than to a radius. */
function Run({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  /* 15 units clears the 22×16 card at every angle this figure uses, which is what keeps an
     arrowhead off the frame it points at. */
  const t = 15 / len;
  const ax = x1 + dx * t;
  const ay = y1 + dy * t;
  const bx = x2 - dx * t;
  const by = y2 - dy * t;
  const ux = dx / len;
  const uy = dy / len;
  return (
    <g>
      <path
        d={`M ${ax} ${ay} L ${bx} ${by}`}
        stroke="var(--color-blueprint-line)"
        strokeWidth={1.2}
      />
      <path
        d={`M ${bx} ${by} L ${bx - ux * 5 - uy * 2.6} ${by - uy * 5 + ux * 2.6} L ${bx - ux * 5 + uy * 2.6} ${by - uy * 5 - ux * 2.6} Z`}
        fill="var(--color-blueprint-line)"
      />
    </g>
  );
}

/** The graph, as four cards that branch and come back together. */
function BlueprintGraph() {
  return (
    <svg
      viewBox="0 0 260 96"
      style={{ aspectRatio: "260 / 96" }}
      className="block h-auto w-full max-w-[22rem]"
      role="img"
      aria-label="Four node cards: one branches to two, and both come back together at a fourth"
      fill="none"
    >
      <Run from={[36, 48]} to={[118, 22]} />
      <Run from={[36, 48]} to={[118, 74]} />
      <Run from={[118, 22]} to={[206, 48]} />
      <Run from={[118, 74]} to={[206, 48]} />
      <CardNode x={36} y={48} />
      <CardNode x={118} y={22} />
      <CardNode x={118} y={74} />
      <CardNode x={206} y={48} />
    </svg>
  );
}

/**
 * The rubric, drawn as what the author's document calls it: "criteri multi-dimensionali".
 *
 * The frame was an empty strip with a label in it, which is the one box in the figure that
 * said nothing — and it is the box whose arrival a reader was supposed to notice. Three
 * criteria, each on a four-step scale with one step filled, is the smallest drawing that
 * says "several dimensions, each with a grade" and it invents no term: naming a real
 * ontology type here would claim this figure's rubric IS that type, which is a claim about
 * a file rather than a picture of a shape.
 */
function RubricGlyph() {
  return (
    <svg
      viewBox="0 0 200 34"
      style={{ aspectRatio: "200 / 34" }}
      className="block h-auto w-full max-w-[13rem]"
      role="img"
      aria-label="Three criteria, each graded on a four-step scale"
      fill="none"
    >
      {[3, 15, 27].map((y, row) => (
        <g key={y}>
          {/* The criterion's name, as a rule rather than a word: at this height a word
              lands under the site's 10px floor, and the drawing is about the SHAPE of a
              rubric rather than about anyone's criteria. */}
          <path
            d={`M 0 ${y} L ${[46, 34, 40][row]} ${y}`}
            stroke="var(--color-emerald)"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {[0, 1, 2, 3].map((step) => (
            <rect
              key={step}
              x={64 + step * 18}
              y={y - 4}
              width={13}
              height={8}
              rx={1.5}
              fill="var(--color-emerald)"
              fillOpacity={step <= row ? 0.75 : 0.12}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Opacity for a frame that has not been reached yet. Never 0: see the header. */
const DIM = 0.16;

export function RunLayers() {
  const { ref, progress, motion } = useScrollProgress<HTMLDivElement>({ steps: 80 });

  /* THREE stages, not four, and the blueprint is not one of them.
     ------------------------------------------------------------
     The author placed this band as "a new section that start with such drawing": the
     blueprint is the state the section opens in, not a stage a reader has to scroll to
     reach. Staging all four put the figure's own subject behind a scroll gesture and left
     the first screen showing four dimmed rows and a dimmed drawing, which says the section
     has not started.

     So the walk stages what ARRIVES — harness, rubric, eval — and `shown` is one plus that.
     `head` is a beat before the first wrapper, `tail` leaves the eval frame standing rather
     than releasing the pin on the frame that is still fading in. */
  const arrived = motion
    ? stagesShown(progress, LAYERS.length - 1, { head: 0.10, tail: 0.18 })
    : LAYERS.length - 1;
  const shown = arrived + 1;
  const at = (i: number) => (i < shown ? 1 : DIM);

  /* The label of a frame that has not arrived is dim; the label of one that has is its own
     colour. That flip is the EVENT — an opacity change on a nested rectangle is easy to
     miss, and the rubric's frame is a strip, so what a reader actually sees arrive is the
     word going from grey to green at the same instant the paragraph beside it does. */
  const label = (i: number, key: keyof typeof TONE) => ({
    color: i < shown ? TONE[key].accent : "var(--color-dim)",
  });

  return (
    <div ref={ref} className={cx(motion && "lg:h-[220vh]")}>
      <div className={cx(motion && "lg:sticky lg:top-[max(4rem,calc(50vh_-_15rem))]")}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          {/* ---------- the frames ---------- */}
          {/* Every frame is in the DOM from the first paint and only colour and opacity
              move, so nothing reflows as the walk runs and the box a reader is about to
              meet has already reserved its padding. A frame that appeared by mounting
              would push the drawing inside it a step down the screen at every stage. */}
          <div className="relative">
            {/* The bloom. Violet, because the outermost frame is the eval and this is that
                frame's light rather than a decoration of its own: it comes up with the eval
                and it is what makes the last stage land as an arrival rather than as one
                more hairline. Behind everything, overhanging on every side, because a glow
                clipped to the box it lights reads as a fill. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 rounded-[2.5rem] transition-opacity duration-700"
              style={{
                opacity: at(3),
                background:
                  "radial-gradient(58% 58% at 50% 45%, color-mix(in oklab, var(--color-violet) 14%, transparent), transparent 72%)",
              }}
            />

            <figure
              className="flex flex-col gap-4 rounded-2xl p-5 transition-all duration-500 sm:p-6"
              style={{
                opacity: at(3),
                borderWidth: 1,
                borderStyle: "solid",
                borderColor:
                  shown > 3
                    ? "color-mix(in oklab, var(--color-violet) 45%, transparent)"
                    : "var(--color-line)",
              }}
            >
              <figcaption
                className="label transition-colors duration-500"
                style={label(3, "eval")}
              >
                eval
              </figcaption>

              <div
                className="flex flex-col gap-4 rounded-xl p-4 transition-all duration-500 sm:p-5"
                style={{
                  opacity: at(1),
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: shown > 1 ? "var(--color-line-bright)" : "var(--color-line)",
                }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="label transition-colors duration-500" style={label(1, "harness")}>
                    harness
                  </p>
                  {/* What a runtime does, in the document's own three nouns, so the frame
                      says something rather than being a labelled gap around the blueprint.
                      Dim and 11px: it is a gloss on the label, not a second heading. */}
                  <p className="font-mono text-[11px] text-dim">dispatch · context · state</p>
                </div>

                <div
                  className="bp-grid flex flex-col gap-3 rounded-lg border border-blueprint-line/55 bg-blueprint-deep/60 p-4 transition-opacity duration-500"
                  style={{ opacity: at(0) }}
                >
                  <p className="label text-blueprint-line">blueprint</p>
                  <BlueprintGraph />
                </div>
              </div>

              {/* Emerald: a rubric is what the engine can be held to. */}
              <div
                className="flex flex-col gap-3 rounded-xl p-4 transition-all duration-500 sm:p-5"
                style={{
                  opacity: at(2),
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor:
                    shown > 2
                      ? "color-mix(in oklab, var(--color-emerald) 45%, transparent)"
                      : "var(--color-line)",
                }}
              >
                <p className="label transition-colors duration-500" style={label(2, "rubric")}>
                  rubric
                </p>
                <RubricGlyph />
              </div>
            </figure>
          </div>

          {/* ---------- the sentences ---------- */}
          <ol className="flex min-w-0 flex-col">
            {LAYERS.map((layer, i) => {
              const reached = i < shown;
              const tone = TONE[layer.id];
              return (
                <li
                  key={layer.id}
                  className="py-3.5 transition-opacity duration-500 first:pt-0"
                  style={{ opacity: reached ? 1 : DIM }}
                >
                  {/* A rule down the left in the frame's own colour, rather than a hairline
                      between rows. It is the second half of the tie: the row is the same
                      colour as the box, edge to edge, so a reader who is looking at either
                      one can find the other without being told. `border-l` and not a
                      background, because a tinted panel behind fifty words would put the
                      paragraph on a coloured ground and cost the contrast measured above. */}
                  <div
                    className="flex flex-col gap-1.5 border-l-2 pl-4 transition-colors duration-500"
                    style={{ borderColor: reached ? tone.accent : "var(--color-line)" }}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3
                        className="font-mono text-[13px] transition-colors duration-500"
                        style={{ color: reached ? tone.accent : "var(--color-dim)" }}
                      >
                        {layer.id}
                      </h3>
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                        {layer.role}
                      </span>
                    </div>
                    <p
                      className="text-[15px] leading-relaxed transition-colors duration-500"
                      style={{ color: reached ? tone.ink : "var(--color-muted)" }}
                    >
                      {layer.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
