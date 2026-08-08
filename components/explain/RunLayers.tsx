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
      "The criteria a result is graded against, usually several at once, turning “good” " +
      "into something with a scale. Deterministic checks, a judge model, or both. Here it " +
      "has a name and a type the analyzer can follow through a graph.",
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
  /* The frame the reader is on, for the rail. -1 in the static state, where nothing is
     "current" because everything is. */
  const active = motion ? shown - 1 : -1;

  return (
    <div ref={ref} className={cx(motion && "lg:h-[220vh]")}>
      <div className={cx(motion && "lg:sticky lg:top-[max(4rem,calc(50vh_-_13rem))]")}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
          {/* ---------- the frames ---------- */}
          {/* Every frame is in the DOM from the first paint and only its opacity moves, so
              nothing reflows as the walk runs and the box a reader is about to meet has
              already reserved its padding. A frame that appeared by mounting would push the
              drawing inside it a step down the screen on every stage. */}
          <figure
            className="flex flex-col gap-3 rounded-xl p-4 transition-opacity duration-500 sm:p-5"
            style={{
              opacity: at(3),
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "color-mix(in oklab, var(--color-violet) 40%, transparent)",
            }}
          >
            {/* Violet, because an eval is where a person decides what good means. It is
                the site's one colour for where a human judgement enters, and grading is
                exactly that even when a model applies the criteria. */}
            <figcaption className="label text-violet">eval</figcaption>

            <div
              className="flex flex-col gap-3 rounded-lg border border-line-bright p-3 transition-opacity duration-500 sm:p-4"
              style={{ opacity: at(1) }}
            >
              {/* The harness is the one box with no accent, and that is the accurate
                  register rather than a fallback: of the four, three are things this site
                  hands you or reads off the engine, and the harness is the one you bring
                  yourself. It wore amber once, which `app/globals.css` reserves for "not
                  built yet" — saying DarkPrint intends to ship one. It does not. */}
              <p className="label text-muted">harness</p>

              <div
                className="bp-grid flex flex-col gap-3 rounded-lg border border-blueprint-line/55 bg-blueprint-deep/60 p-3 transition-opacity duration-500 sm:p-4"
                style={{ opacity: at(0) }}
              >
                <p className="label text-blueprint-line">blueprint</p>
                <BlueprintGraph />
              </div>
            </div>

            {/* Emerald: the rubric is the one frame here that names something the engine
                can follow, `acceptance-criteria` being a real data type in the ontology. */}
            <div
              className="rounded-lg border border-emerald/40 p-3 transition-opacity duration-500 sm:p-4"
              style={{ opacity: at(2) }}
            >
              <p className="label text-emerald">rubric</p>
            </div>
          </figure>

          {/* ---------- the sentences ---------- */}
          <ol className="flex min-w-0 flex-col">
            {LAYERS.map((layer, i) => {
              const reached = i < shown;
              const isActive = i === active;
              return (
                <li
                  key={layer.id}
                  className="border-t border-line/70 py-3 transition-opacity duration-500 first:border-t-0 first:pt-0"
                  style={{ opacity: reached ? 1 : DIM }}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3
                      className={cx(
                        "font-mono text-[13px] transition-colors",
                        isActive || !motion ? "text-fg" : "text-muted",
                      )}
                    >
                      {layer.id}
                    </h3>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                      {layer.role}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{layer.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
