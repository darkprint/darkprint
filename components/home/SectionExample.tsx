/* ============================================================
   Rung 4 of doc 2 §2.1 — one concrete example.

   "Un esempio concreto, singolo, visibile. Una dark factory vera,
   il grafo mostrato, il blueprint aperto. **Uno, non tre.**"

   The section this replaces showed two cards side by side and drew
   neither graph large enough to read. Two examples is a gallery
   preview; one example with its drawing open is the rung.

   Why `starter-software-factory` and not one of the other eight:

   - its defining feature is *visible in the drawing*. Planner and
     builder both feed the tester and nothing runs between them, so
     the reader can see the isolation rule instead of being told
     about it. Every other blueprint's lesson lives in prose;
   - it is the smallest complete factory in the archive: five nodes,
     one per lifecycle phase, so it doubles as the legend for the
     five phases rung 2 just introduced;
   - the analyzer has a real, checkable consequence to show on it.
     Adding `planner -> builder` fires `criteria-leak` on the builder
     and the score moves, which is rung 5's argument demonstrated
     rather than asserted;
   - it is what `/build` (doc 2 §5) is built on, so the landing
     points at the same object the practical onboarding does.

   The alternatives, and why not: `adversarial-consensus-line` (8
   nodes) and `checkpoint-resume-runner` (9) are the two the note
   used to feature, and both have their point in a behaviour rather
   than in a shape — a debate that only happens on disagreement, a
   resume that only happens after a crash. Neither is legible in a
   still drawing. `guarded-merge-bot` puts a person in the graph,
   which is a good §1.1 illustration and the wrong first impression
   of what a dark factory is. `incident-commander` scores 0 on
   security by design and would open the site with an alarm.
   ============================================================ */

import Link from "next/link";
import { DARKPRINT_CONFIG, shortDigest } from "@/lib/core";
import { getBlueprintBySlug } from "@/lib/content";
import { GraphThumbnail } from "@/components/graph/GraphThumbnail";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MetricBars } from "@/components/ui/MetricBars";

const SLUG = "starter-software-factory";

/**
 * What the analyzer charges for a leak, read out of the engine's frozen config.
 *
 * The prose says the score falls from four to two, and both numbers have to be the
 * engine's rather than a pair typed into a marketing page — the weights are open and
 * meant to be re-tuned after launch (doc 1 §11), and a landing quoting a stale drop
 * would be caught by anyone who ran the check.
 */
const LEAK_WEIGHT = DARKPRINT_CONFIG.security.weights["criteria-leak"] ?? 0;
const LEAKED_SCORE = 4 - LEAK_WEIGHT;

/** Small mono heading, matching the blueprint page's panels. */
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
      {children}
    </span>
  );
}

export function SectionExample() {
  const bp = getBlueprintBySlug(SLUG);
  if (bp === undefined) return null;

  return (
    <section id="examples" className="bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="One factory, drawn"
          title="The starter software factory"
          lead="Five nodes, one per phase. A request goes in at the planner and a release comes out at the far end. The thing worth studying is an arrow that is missing from the drawing."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* ---------- the graph ---------- */}
          <div className="panel flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <PanelLabel>Pipeline schematic</PanelLabel>
              <span className="font-mono text-[11px] text-dim">
                {bp.graph.nodes.length} nodes · {bp.graph.edges.length} edges
              </span>
            </div>
            {/* `flex-1` with a floor rather than a fixed height: the two panels are
                grid siblings and stretch to the taller one, and without it the drawing
                left a band of empty panel under itself on wide viewports. */}
            <div className="bp-grid min-h-64 flex-1 bg-blueprint-deep/40 sm:min-h-80">
              {/* Labels on, which is the exception rather than the gallery default: this
                  is the one drawing on the site a reader is asked to study, and the panel
                  beside it names edges by what they carry. */}
              <GraphThumbnail
                graph={bp.graph}
                labels
                className="h-full w-full p-4"
                ariaLabel="The starter software factory: planner and builder both feed the tester, the tester loops through the debugger and hands an approved build to the release gate. No edge runs from the planner to the builder."
              />
            </div>
            <p className="border-t border-line px-4 py-3 font-mono text-[11px] leading-relaxed text-dim">
              {/* The autonomy class, never the band behind it: this line sits four
                  screens under `SectionLevels`, which is where the reader has just
                  learned to read a small integer as a rung on the organisational ladder.
                  Doc 2 §1.1's second head, on the one page where it would bite hardest. */}
              {bp.cardRefs.length} pinned cards · {shortDigest(bp.digest)} · autonomy{" "}
              {bp.analysis.autonomy.label} · security level{" "}
              {bp.analysis.security.level}
            </p>
          </div>

          {/* ---------- the absent edge ---------- */}
          <div className="panel flex flex-col gap-4 p-6">
            <h3 className="font-display text-xl font-semibold text-fg">
              The edge that is not there
            </h3>
            <p className="text-sm leading-relaxed text-muted">
              The planner writes two artefacts: an ordered build brief, and the
              acceptance criteria the finished work will be judged against. The criteria
              go to the tester. Nothing at all goes to the builder, which is why no arrow
              points into it in the drawing. Its brief arrives when the graph is
              instantiated, and it never learns how its output will be checked.
            </p>

            <ul className="flex flex-col gap-2 font-mono text-[12px]">
              <li className="flex items-center gap-3 rounded border border-line bg-surface-2 px-3 py-2">
                <span className="text-emerald" aria-hidden>
                  ✓
                </span>
                <span className="text-fg">planner → tester</span>
                <span className="ml-auto text-dim">acceptance criteria</span>
              </li>
              <li className="flex items-center gap-3 rounded border border-dashed border-line px-3 py-2">
                <span className="text-signal" aria-hidden>
                  ✕
                </span>
                <span className="text-muted">planner → builder</span>
                <span className="ml-auto text-dim">no such edge</span>
              </li>
            </ul>

            <p className="text-sm leading-relaxed text-muted">
              Add that missing edge to the DOT and the analyzer charges{" "}
              <span className="font-mono text-signal">criteria-leak</span> against the
              builder. Security falls from 4 to {LEAKED_SCORE}, and the finding says why.
            </p>
            {/* The engine's own hint for a `criteria-leak` finding, minus its internal
                document citation. Quoted rather than paraphrased: what the analyzer
                says is checkable, and prose written to sound like it is not. */}
            <div className="rounded border border-line bg-surface-2 px-3 py-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                what the analyzer says
              </span>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted">
                Remove the path from planner to builder. Whoever writes the code must
                never see the acceptance tests, because if they see them they game them.
              </p>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              No card states that rule. It lives in the wiring, and it is checkable
              because the wiring is a file.
            </p>
          </div>
        </div>

        {/* ---------- the scorecard, and where the rest of it lives ----------
            Lifecycle-scoring spec §4.1 moved the qualitative "How a factory is graded"
            panel that used to sit beside this one to `/spec/scoring`, and the IA pass
            merged that route into `/reading-the-radar`, along with
            `ScoringModel`'s quantitative detail: it walked all six axes without naming
            this bundle, so it detached cleanly. Losing that second column leaves one
            panel in what was a two-up grid, so this is full-width now rather than a lone
            half-width card. */}
        <div className="mt-5 panel p-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-fg">
              Its scorecard
            </h3>
            <span className="font-mono text-[11px] text-dim">six axes</span>
          </div>
          <MetricBars metrics={bp.metrics} autonomy={bp.autonomy} />
          <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-muted">
            {/* Kept true for `components/ui/MetricBars.tsx`'s own comment on this call
                site: no `audit` prop, so the two computed rows above still print the
                engine's rationale rather than a glance. */}
            The scorecard prints the subtraction under the Security row and the fraction
            under Autonomy.{" "}
            <Link
              href="/reading-the-radar"
              className="text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan"
            >
              How a blueprint is graded →
            </Link>
          </p>
        </div>

        {/* No controls close this section, on the author's instruction: the large cyan
            "Open the blueprint" button and the "or all of them" link beside it are both
            gone. Recorded rather than merely removed, because the consequence is real and
            is the kind of thing a later pass would otherwise "fix" by putting them back:
            the only page that mounts this section, `/what-a-blueprint-is`, now has no link
            of any kind to `/blueprints/starter-software-factory` — the one bundle its
            three figures, this worked run and this scorecard are all read off. The shelf
            itself stays reachable from that page twice over (step 01 and the closing
            button pair), so it is not a dead end; it is the loss of one destination, and
            it was asked for. */}
      </div>
    </section>
  );
}
