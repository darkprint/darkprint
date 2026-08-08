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
 * The harness takes `--color-fg`, and it is the one entry that changed twice.
 *
 * It was `--color-muted` on the argument that the harness is the one box a reader brings
 * themselves and deliberately the only frame with no accent. The argument still holds and
 * the colour did not: the author, 2026-08-08, "do not use the gray for the harness as it is
 * not that evident." Muted IS the unlit weight for every other row, so the harness went from
 * grey to the same grey — a state change with nothing to see.
 *
 * `--color-fg` keeps the claim and fixes the evidence. It is still not an accent, so nothing
 * here says DarkPrint ships a harness or knows what colour one is; it is simply the
 * brightest neutral this palette has, which puts it at the same LIGHTNESS as the three inks
 * beside it (16.0:1 on `bg-void`, against 16.3, 13.4 and 11.7) while carrying no hue at all.
 * Unlit it is `--color-muted` like the rest, so the step is muted → white rather than grey →
 * grey.
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
    accent: "var(--color-fg)",
    ink: "var(--color-fg)",
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
      "both. It is written down before the run, which is what makes two runs comparable, " +
      "and kept away from the harness: a system that can read its own criteria optimises " +
      "for them rather than for the work they stood in for.",
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
 * Restyled 2026-08-08 against `CardStackFigure`, the card this site draws everywhere else.
 * The author asked why that reference had not been used, and the answer is that it had not:
 * the first version was a frame, one rule and two lines, which says "a document" and not "a
 * card". What makes the reference recognisable is the SHAPE OF ITS CONTENT — an id with a
 * version at the far end of the header line, then rows of label-then-value, then `cannot` in
 * the alarm colour — and every one of those survives at 30 units where the words do not.
 *
 * Still no text, and that has not changed: at this size any word lands under the site's 10px
 * legibility floor, and four labelled cards would be a card figure rather than a graph of
 * them. `CardStackFigure` is the drawing that names fields, one section up the page.
 */
function CardNode({ x, y }: { x: number; y: number }) {
  const w = 30;
  const h = 22;
  return (
    <g transform={`translate(${x - w / 2} ${y - h / 2})`}>
      {/* The card's own ground, one step lighter than the sheet it sits on, so it reads as
          an object ON the paper rather than as a hole cut in it. `CardStackFigure` does the
          same thing with `bg-surface` inside `bg-void`. */}
      <rect
        width={w}
        height={h}
        rx={3}
        fill="var(--color-blueprint)"
        fillOpacity={0.55}
        stroke="var(--color-blueprint-ink)"
        strokeWidth={1}
      />
      {/* The header rule, at a third of the height, which is where `CardStackFigure` puts
          the line under a card's id and version. */}
      <path
        d={`M 0 7.5 L ${w} 7.5`}
        stroke="var(--color-blueprint-ink)"
        strokeOpacity={0.7}
        strokeWidth={0.9}
      />
      {/* The id, and the version at the right end of the same line: two marks rather than
          one, because a header with a single rule in it is a title and a header with a short
          run at each end is a title and a version. That pairing is what makes the reference
          card recognisable at a glance, and it survives at 30 units where the words do not. */}
      <path
        d="M 3.5 4 L 15 4"
        stroke="var(--color-blueprint-ink)"
        strokeOpacity={0.85}
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      <path
        d={`M ${w - 9} 4 L ${w - 3.5} 4`}
        stroke="var(--color-blueprint-line)"
        strokeOpacity={0.75}
        strokeWidth={1}
        strokeLinecap="round"
      />
      {/* Three field rows, not two, and each drawn as a LABEL and a VALUE with a gap
          between them — which is what a card's body is: `type  agent`, `phase
          implementation`, `cannot  acceptance-criteria`. Two plain rules said "there is
          text here"; a short mark, a gap and a longer mark says "there are fields here",
          which is the whole claim this figure is making about a node.

          The third row's value takes the alarm colour, because the third row of the
          reference card is `cannot` and it is red there. One coloured mark on a 30-unit
          glyph is the only detail small enough to carry and loud enough to be seen. */}
      {[
        { y: 11.5, label: 5, value: 11, tone: "var(--color-blueprint-line)" },
        { y: 15, label: 4, value: 13, tone: "var(--color-blueprint-line)" },
        { y: 18.5, label: 5, value: 9, tone: "var(--color-signal)" },
      ].map((row) => (
        <g key={row.y}>
          <path
            d={`M 3.5 ${row.y} L ${3.5 + row.label} ${row.y}`}
            stroke="var(--color-blueprint-line)"
            strokeOpacity={0.55}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
          <path
            d={`M 12 ${row.y} L ${12 + row.value} ${row.y}`}
            stroke={row.tone}
            strokeOpacity={row.tone === "var(--color-signal)" ? 0.85 : 0.8}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
        </g>
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
  /* 19 units clears the 30×22 card at every angle this figure uses, which is what keeps an
     arrowhead off the frame it points at. It was 15 for a 22×16 card; the glyph grew when it
     was restyled on the reference card, and this number grows with it or the heads land
     inside the boxes. */
  const t = 19 / len;
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
 *
 * Painted in `currentColor` rather than in the token directly, so it greys out with the box
 * around it. It was the loudest thing in the rubric frame and the only part of it already
 * green while the label and the border were still grey, which read as the box being half
 * lit — and half of a two-state figure is the one state it must never be in.
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
            stroke="currentColor"
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
              fill="currentColor"
              fillOpacity={step <= row ? 0.75 : 0.12}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

/* `DIM` stood here, an opacity of 0.16 for a frame or a row that had not been reached, and
   it is gone with the whole idea of staging PRESENCE.

   The author, 2026-08-08: make the panel "already visible when scrolling down (not appearing
   gradually) — what I want is still that on scrolling the part that are described gets the
   color and stops to be grayed out."

   That is a better figure and the reason is worth stating: the drawing is four boxes one
   inside the next, and the nesting IS the argument. Fading three of them to a sixth of an
   opacity meant a reader met the argument one box at a time and could not see the shape
   until the end — and the eye reads a faded box as further away rather than as not-yet-said.

   So everything is present at full opacity from the first paint, and what the scroll moves
   is COLOUR: a frame's label and border go from `--color-dim` and `--color-line` to their
   own register, and the paragraph beside it goes from `--color-muted` to that register's
   ink. Grey to coloured, which is a state a reader can read as "this one now" without
   having to notice that something arrived.

   It also deletes the last reason this component needed a no-motion special case. Nothing
   is hidden in any state, so the static markup and the finished walk are the same drawing
   in two palettes. */

export function RunLayers() {
  /* No scroll, no pin, no staging. The author, 2026-08-08: "remove the scrolling just place
     static all already highlighted."

     The walk is gone in three steps, and it is worth recording that the third one is what
     the instruction is really about. The first pass staged PRESENCE and the author asked for
     the figure visible; the second staged COLOUR and it still asked a reader to scroll 220vh
     to finish reading four sentences they could already see. A figure whose every frame and
     every paragraph is on screen at once has nothing left to reveal — the staging was
     animating a reader through a list.

     What survives is everything the staging was FOR: the four tones, the ties between a
     frame and its paragraph, the nesting, the rubric glyph. `lit()` returns true for all
     four, which keeps every colour expression below reading exactly as written rather than
     making each one collapse to its lit branch by hand — one line to restore staging if it
     is ever wanted again, and no dead branches in the meantime.

     `useScrollProgress` and `stagesShown` go with it, and so does the 220vh track: this is
     an ordinary two-column figure now, as tall as its content.

     `index >= 0` rather than a bare `true` so the parameter is read: an ignored argument is
     a lint warning and, worse, a signature nobody can tell is deliberate. Every index this
     is called with is 0 to 3. */
  const lit = (index: number): boolean => index >= 0;

  /** A frame's label, in its own register. */
  const label = (i: number, key: keyof typeof TONE) => ({
    color: lit(i) ? TONE[key].accent : "var(--color-dim)",
  });

  /* A frame's border AND its ground, in its own hue.
     ------------------------------------------------------------
     The author: the blueprint's box is the one that works, and the other three "should be
     more fancier … maybe each box can be filled with the color of the border."

     They were describing the blueprint frame's construction without naming it. That box is
     `bg-blueprint-deep/60` inside a `blueprint-line/55` border — a GROUND in the register
     rather than an outline on the page's ground — and it was the only one of the four built
     that way, which is why it was the only one reading as a place rather than as a rule.

     So the same construction per hue: the border is the register at 45%, the fill the same
     colour at 7%. Nesting sets that number — the eval's wash sits under the harness's, which
     sits under the blueprint's sheet, and at 12% the innermost box was three washes deep and
     its graticule went muddy.

     `color-mix` rather than a Tailwind alpha utility, because these are inline styles and
     the framework cannot emit a class for a value it never sees. */
  const frame = (i: number, key: keyof typeof TONE) =>
    ({
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: lit(i)
        ? `color-mix(in oklab, ${TONE[key].accent} 45%, transparent)`
        : "var(--color-line)",
      background: lit(i)
        ? `color-mix(in oklab, ${TONE[key].accent} 7%, transparent)`
        : "transparent",
    }) as const;

  return (
    <div>
      <div>
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
                /* The one opacity left, and it is light rather than presence: the bloom is
                   the eval frame's own colour arriving, so it comes up with that frame's
                   border and label. A violet wash under a grey box would colour the figure
                   before the sentence that explains it. */
                opacity: lit(3) ? 1 : 0,
                background:
                  "radial-gradient(58% 58% at 50% 45%, color-mix(in oklab, var(--color-violet) 14%, transparent), transparent 72%)",
              }}
            />

            <figure
              className="flex flex-col gap-4 rounded-2xl p-5 transition-all duration-500 sm:p-6"
              style={frame(3, "eval")}
            >
              <figcaption
                className="label transition-colors duration-500"
                style={label(3, "eval")}
              >
                eval
              </figcaption>

              <div
                className="flex flex-col gap-4 rounded-xl p-4 transition-all duration-500 sm:p-5"
                /* The harness's hue is `--color-fg`, so its 45% border is a bright hairline
                   and its 7% fill a barely-there white wash. That is the accurate register:
                   present, lit, and carrying no colour claim. */
                style={frame(1, "harness")}
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

                {/* No staging at all. The blueprint is the state this band opens in, it is
                    the only frame drawn on the cyanotype sheet, and a sheet cannot grey
                    out — its ground is the register. */}
                <div className="bp-grid flex flex-col gap-3 rounded-lg border border-blueprint-line/55 bg-blueprint-deep/60 p-4">
                  <p className="label text-blueprint-line">blueprint</p>
                  <BlueprintGraph />
                </div>
              </div>

              {/* Emerald: a rubric is what the engine can be held to. */}
              <div
                className="flex flex-col gap-3 rounded-xl p-4 transition-all duration-500 sm:p-5"
                style={frame(2, "rubric")}
              >
                <p className="label transition-colors duration-500" style={label(2, "rubric")}>
                  rubric
                </p>
                {/* The glyph inherits this colour: see `RubricGlyph`. */}
                <div
                  className="transition-colors duration-500"
                  style={{
                    color: lit(2) ? "var(--color-emerald)" : "var(--color-dim)",
                  }}
                >
                  <RubricGlyph />
                </div>
              </div>
            </figure>
          </div>

          {/* ---------- the sentences ---------- */}
          <ol className="flex min-w-0 flex-col">
            {LAYERS.map((layer, i) => {
              const reached = lit(i);
              const tone = TONE[layer.id];
              return (
                <li key={layer.id} className="py-3.5 first:pt-0">
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
