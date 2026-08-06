import Link from "next/link";

import { ReachList, ReachRow } from "@/components/ui/ReachList";

/* ============================================================
   The two drawings on /concepts, second attempt.

   ── What was wrong with the first ──
   The author called them "very wrong", and they were. Both were
   `FlowScene` graphs, and in the luminous-flow register a lit
   circle joined by an edge means one thing on this site: a node,
   a step in a run. So drawing `model`, `skill` and `tool` as
   circles wired to a node said those are steps too. They are not.
   A node is a step; the card is the document *describing* that
   step, and its fields point at things that are not in the graph
   at all. The figure contradicted the model the page exists to
   explain.

   A second error travelled with it: `cannot` was drawn as a
   missing edge from a node labelled "judge". `cannot` names a
   data type, not a neighbour. Any edge able to carry that type is
   refused, whichever node draws it, so inventing a judge to draw
   the absence from asserted a topology the card never mentions.

   ── And why the register changed ──
   "adopt graphics and animations that are not necessarly drawn
   from a 'blueprint' style". So neither of these is a `FlowScene`
   and neither sits on the graticule. They are boxes and rules: a
   card drawn as the document it is, and two nested frames. Nothing
   here is in `components/viz/scene-labels.test.ts`'s roster,
   because nothing here draws a scene.

   The first figure's row/connector/gloss layout lives in
   `components/ui/ReachList.tsx`, because the author asked for it
   on the ontology and node pages too and one implementation is
   the only way those three stay the same drawing.

   Motion is `anim-strip-in` from `globals.css`, whose resting
   style is the finished one and which only plays under
   `prefers-reduced-motion: no-preference`. Server components: no
   hooks, no client bundle.
   ============================================================ */

/** Stagger between the two frames of the second figure, ms. Matches `ReachList`. */
const STEP = 90;

/**
 * A card drawn as what it is: a document. Its rows point outward, at things that are
 * not nodes and are not in the graph.
 *
 * Values are the caller's, read off a real published card, so the figure cannot end up
 * teaching a schema nobody ships.
 */
export function WhatACardReaches({
  model,
  tools,
  mcp,
  skill,
  cannot,
  riskMarkers,
}: {
  model: string;
  tools: string;
  mcp: string;
  skill: string;
  cannot: string;
  riskMarkers: string;
}) {
  /* Six rows, and each carries its own fine print.
     ------------------------------------------------------------
     Both changes come from the same defect. `/concepts` drew this figure with five rows
     and then set a six-box grid under it, one box per field, keyed by the same names. The
     same list twice, and the two disagreed: the figure said five rows, the grid explained
     six, and `risk_markers` appeared only in the grid. A reader counting fields on a page
     whose subject is what the fields are got two answers.

     So the sixth row is here, and the grid's sentences are the rows' `note`s. The gloss
     says what the field reaches; the note says the thing about it a reader would otherwise
     find out by trying it. Nothing was cut.

     `code-builder` declares no risk markers, and the row says so. That is the honest
     drawing: the field exists on every card and this card leaves it empty. */
  return (
    <ReachList label="One card, six rows">
      <ReachRow
        field="model"
        value={model}
        note="Written the way the provider writes it, and overridable. A reader can point the graph at something else."
      >
        The model it thinks with. The ceiling on what this step can be trusted to attempt.
      </ReachRow>
      <ReachRow
        field="tools"
        value={tools}
        note="The card names the capability, not a vendor, so a graph says what it touches rather than what you bought."
      >
        Capabilities it may reach for: a shell, a search index, a browser.
      </ReachRow>
      <ReachRow
        field="mcp"
        value={mcp}
        note="Two nodes naming the same server share the same door."
      >
        A server exposing one. MCP is the wire, so this row is the reach a run has.
      </ReachRow>
      <ReachRow
        field="skill"
        value={skill}
        note={
          <>
            <span className="text-muted">
              The engine reads nothing at the other end of this path, so no skill document
              travels in the download.
            </span>{" "}
            Each bundle&rsquo;s README lists the ones you supply yourself.
          </>
        }
      >
        A written procedure it follows. A pointer only: the document does not travel in
        the download.
      </ReachRow>
      <ReachRow
        field="cannot"
        value={cannot}
        barred
        note="An entry naming a data type is enforced; an entry naming anything else is a sentence addressed to a reader and checked by nothing."
      >
        What must never arrive. Naming a data type makes it a rule the resolver holds
        every incoming edge to, whichever node draws one.
      </ReachRow>
      <ReachRow
        field="risk_markers"
        value={riskMarkers}
        note={
          <>
            Each marker costs the blueprint security points.{" "}
            <Link
              href="/spec/scoring"
              className="text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright"
            >
              How a blueprint is graded <span aria-hidden>&rarr;</span>
            </Link>
          </>
        }
      >
        The blast radius, priced. What this step could break if it goes wrong, declared by
        the card rather than guessed at by a reader.
      </ReachRow>
    </ReachList>
  );
}

/**
 * Three frames, one inside the next, to the author's own sketch: "a third box containing
 * the harness that is defined as eval, and it contains the harness which contains the
 * blueprint, and the eval contains also a box named rubric."
 *
 * That is the whole page in one drawing. **Eval** is the outermost thing, because an eval
 * is the act of running something and grading it. It holds two things: the **harness**
 * that does the running, and the **rubric** it grades against. The harness in turn holds
 * the **blueprint**, which is the graph and its cards. Containment carries every relation,
 * so nothing has to be asserted in a sentence underneath.
 *
 * The rubric is a sibling of the harness rather than inside it on purpose: what the work
 * is judged against is decided before a run and does not belong to the runner. On this
 * site it has a name and a type, `acceptance-criteria`, which is why the analyzer can
 * follow it through a graph.
 */
export function EvalHarnessBlueprint() {
  /* The verbs are the ontology's phases, not a generic pipeline.
     `CORE_PHASE_IDS` in `lib/core/ontology/core.ts` is planning, implementation, testing,
     debugging, deployment — so the last box says "deploy" and not "ship". A figure on the
     page that teaches the vocabulary is the last place to spell a term a second way. */
  const nodes = ["plan", "build", "test", "deploy"];

  return (
    <figure className="flex flex-col gap-4 rounded-xl border border-line bg-surface/70 p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          Three things, one inside the next
        </span>
        <span className="text-[13px] text-muted">
          A blueprint is what you download from here. Give it a harness and it runs.
        </span>
      </figcaption>

      {/* eval */}
      <div className="anim-strip-in flex flex-col gap-3 rounded-lg border border-violet/40 p-4 sm:p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-violet">
          eval
        </p>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {/* harness */}
          <div
            className="anim-strip-in flex flex-1 flex-col gap-3 rounded-lg border border-amber/45 p-4"
            style={{ animationDelay: `${STEP}ms` }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber">
              harness
            </p>

            {/* blueprint */}
            <div
              className="anim-strip-in flex flex-col gap-3 rounded-lg border border-cyan/40 bg-void/50 p-4"
              style={{ animationDelay: `${STEP * 2}ms` }}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">
                blueprint
              </p>
              <ol className="flex flex-wrap items-center gap-1.5">
                {nodes.map((n, i) => (
                  <li key={n} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <span aria-hidden className="font-mono text-[12px] text-line-bright">
                        &rarr;
                      </span>
                    )}
                    <span
                      className="anim-strip-in rounded border border-line bg-surface-2 px-3 py-1.5 font-mono text-[12px] text-fg"
                      style={{ animationDelay: `${(i + 3) * STEP}ms` }}
                    >
                      {n}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-[13px] leading-snug text-muted">
                The graph and the cards it pins. Text, versioned, checkable.
              </p>
            </div>

            <p className="text-[13px] leading-snug text-muted">
              What executes the graph: a runner that takes each node in turn, and an
              evaluator that reads the result.
            </p>
          </div>

          {/* rubric, a sibling of the harness inside the eval */}
          <div
            className="anim-strip-in flex flex-col gap-3 rounded-lg border border-emerald/40 p-4 lg:w-[16rem]"
            style={{ animationDelay: `${STEP * 2}ms` }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald">
              rubric
            </p>
            <p className="text-[13px] leading-snug text-muted">
              What the result is graded against. Here it has a name and a type,{" "}
              <code className="font-mono text-[12px] text-emerald">
                acceptance-criteria
              </code>
              , so the analyzer can follow it through a graph.
            </p>
          </div>
        </div>

        <p className="text-[13px] leading-snug text-muted">
          One run of a blueprint through a harness, graded against a rubric. That is an
          eval.
        </p>
      </div>
    </figure>
  );
}
