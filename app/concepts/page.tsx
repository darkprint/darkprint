import type { Metadata } from "next";
import Link from "next/link";

import { getNodeCard } from "@/lib/content";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /concepts — eval, harness, rubric, tool, MCP, skill, and the
   one the site does not model.

   The author asked for a page explaining these, built around a
   node card zooming out to a graph, and added: "Correct anything
   I'm wrong." Three corrections are in the copy below and each is
   marked, because a page whose subject is what the words mean is
   the wrong place to be quietly vague.

   ── The three ──
   1. Connected nodes are a **blueprint**, not a harness. The
      harness is what runs the graph and judges the result, which
      is why `/towards-a-dark-factory` calls level 4
      "harness-driven" and describes "orchestrators and
      evaluators", not a topology. DarkPrint publishes the
      blueprint; Attractor and whatever grades the output are the
      harness.
   2. **Observability is not modelled here at all.** No field on a
      card, no term in the vocabulary, nothing in `lib/core`. It
      is a real practice and the site has no opinion on it, which
      is worth saying rather than drawing a box for.
   3. **Nothing on this site evaluates a run.** The six-axis
      scorecard is static analysis of a graph plus four seeded
      rows. An eval needs an execution to judge and there is no
      runner here.

   ── Why the fields are read, not typed ──
   Every field named below is pulled off `code-builder@1.0.0`, the
   card the rest of the site opens with. A page explaining what
   `mcp` and `cannot` are, illustrated with invented values, would
   be teaching a schema nobody ships.

   Motion is `anim-strip-in` from `globals.css`: the resting style
   is the finished one and the animation is added on top, inside
   `prefers-reduced-motion: no-preference`. Nothing here needs
   script to be legible.

   Static: no `generateStaticParams`, no `dynamicParams`, server
   component, no props (Next 16, `docs/01-app/03-api-reference/
   03-file-conventions/page.md`).
   ============================================================ */

export const metadata: Metadata = {
  title: "Eval, harness, rubric and the rest",
  description:
    "What a tool, an MCP server, a skill and a guardrail are on a node card, what a harness actually is, and what an eval and a rubric would mean here. Including the two this site does not model.",
};

const LINK =
  "text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright";

/** One labelled part of the card figure. Staggered, in the order a card declares them. */
function Part({
  i,
  field,
  value,
  children,
}: {
  i: number;
  field: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <li
      className="anim-strip-in flex flex-col gap-1 rounded-lg border border-line bg-surface-2/60 px-4 py-3"
      style={{ animationDelay: `${i * 90}ms` }}
    >
      <div className="flex items-baseline gap-2">
        <code className="font-mono text-[12px] text-amber">{field}</code>
        <code className="min-w-0 truncate font-mono text-[11px] text-dim">{value}</code>
      </div>
      <p className="text-sm leading-relaxed text-muted">{children}</p>
    </li>
  );
}

function Correction({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg border border-amber/30 bg-amber/5 px-4 py-3 text-sm leading-relaxed text-muted">
      <span aria-hidden className="font-mono text-amber">
        ▲
      </span>
      <span>{children}</span>
    </p>
  );
}

export default function ConceptsPage() {
  const builder = getNodeCard("code-builder");
  const card = builder?.card;

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="The words"
            title="Eval, harness, rubric and the rest"
            lead="These words travel together and mean different things to different people. Here is what each one is on this site, starting inside one node card and zooming out until the whole graph is in view."
          />
        </div>
      </header>

      {/* ---------- one card ---------- */}
      <section className="border-t border-line bg-surface py-16">
        <div className="container-page flex flex-col gap-8">
          <SectionHeading
            eyebrow="Zoom in"
            title="Inside one node"
            lead="A card is the whole of what a node is. Four of its lines decide what that node can do, and one decides what it must never do."
          />

          {card !== undefined && (
            <ul className="grid gap-3 lg:grid-cols-2">
              <Part i={0} field="model" value={card.model ?? "inherits"}>
                <span className="text-fg">The model</span> is the ceiling. It is what the
                node reasons with, so it sets what the node can be trusted to attempt at
                all. Written the way the provider writes it, and overridable: a reader can
                point the graph at something else.
              </Part>
              <Part i={1} field="tools" value={card.tools.length > 0 ? card.tools.join(", ") : "none"}>
                <span className="text-fg">A tool</span> is a capability the node reaches
                for: a shell, a search index, a browser. The card names the capability, not
                a vendor, so a graph says what it touches rather than what you bought.
              </Part>
              <Part i={2} field="mcp" value={card.mcp.length > 0 ? card.mcp.join(", ") : "none"}>
                <span className="text-fg">MCP</span> is how the node talks to one. Model
                Context Protocol is the wire between an agent and a server that exposes a
                tool, so this line is the reach a run actually has. Two nodes naming the
                same server share the same door.
              </Part>
              <Part i={3} field="skill" value={card.skill ?? "none"}>
                <span className="text-fg">A skill</span> is a written procedure the node
                follows: not code, prose. It is how you hand an agent a method it did not
                infer.{" "}
                <span className="text-fg">
                  The field is a pointer and the engine reads nothing at the other end, so
                  no skill document travels in the download.
                </span>{" "}
                Each bundle&rsquo;s README lists the paths you supply yourself.
              </Part>
              <Part
                i={4}
                field="cannot"
                value={card.cannot.length > 0 ? card.cannot[0] ?? "" : "nothing declared"}
              >
                <span className="text-fg">The guardrail.</span> What must never reach this
                node. An entry naming a data type is enforced: the resolver fails the
                bundle if any incoming edge could carry it. An entry naming anything else
                is a sentence addressed to a reader and checked by nothing.
              </Part>
              <Part
                i={5}
                field="risk_markers"
                value={card.riskMarkers.length > 0 ? card.riskMarkers.join(", ") : "none"}
              >
                <span className="text-fg">The blast radius</span>, priced. Each marker
                names something the node can do that costs the blueprint security points.{" "}
                <Link href="/spec/scoring" className={LINK}>
                  How a blueprint is graded <span aria-hidden>→</span>
                </Link>
              </Part>
            </ul>
          )}
        </div>
      </section>

      {/* ---------- zoom out ---------- */}
      <section className="border-t border-line bg-void py-16">
        <div className="container-page flex flex-col gap-8">
          <SectionHeading
            eyebrow="Zoom out"
            title="Many nodes, and the thing that runs them"
            lead="Wire the nodes together and you have a blueprint: who hands what to whom, and which edges were deliberately left out."
          />

          <Correction>
            <span className="text-fg">One correction.</span> Connected nodes are a{" "}
            <span className="text-fg">blueprint</span>, not a harness. The harness is what
            runs the graph and judges what comes back: the orchestrator, the runner, the
            evaluators. DarkPrint publishes the blueprint and analyses it standing still.
            Attractor, or whatever you point at{" "}
            <code className="font-mono text-[12px] text-fg">factory.dot</code>, is the
            harness.
          </Correction>

          <div className="grid gap-3 lg:grid-cols-3">
            <div
              className="anim-strip-in flex flex-col gap-1 rounded-lg border border-line bg-surface-2/60 px-4 py-3"
              style={{ animationDelay: "0ms" }}
            >
              <h3 className="font-display text-base font-semibold text-fg">The blueprint</h3>
              <p className="text-sm leading-relaxed text-muted">
                The graph and the cards it pins. Text, versioned, checkable. This is what
                the registry holds.
              </p>
            </div>
            <div
              className="anim-strip-in flex flex-col gap-1 rounded-lg border border-line bg-surface-2/60 px-4 py-3"
              style={{ animationDelay: "90ms" }}
            >
              <h3 className="font-display text-base font-semibold text-fg">The harness</h3>
              <p className="text-sm leading-relaxed text-muted">
                What executes it on your machine and decides whether the result passes.
                Not published here, and not run here.
              </p>
            </div>
            <div
              className="anim-strip-in flex flex-col gap-1 rounded-lg border border-line bg-surface-2/60 px-4 py-3"
              style={{ animationDelay: "180ms" }}
            >
              <h3 className="font-display text-base font-semibold text-fg">The run</h3>
              <p className="text-sm leading-relaxed text-muted">
                One execution, on one input. Everything an eval measures happens here, and
                none of it happens on this site.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- eval and rubric ---------- */}
      <section className="border-t border-line bg-surface py-16">
        <div className="container-page flex flex-col gap-8">
          <SectionHeading
            eyebrow="Judging the work"
            title="Eval, and the rubric inside it"
            lead="An eval is the harness running a blueprint against known inputs and scoring what comes back. A rubric is what it scores against."
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2/60 px-4 py-3">
              <h3 className="font-display text-base font-semibold text-fg">The rubric</h3>
              <p className="text-sm leading-relaxed text-muted">
                On this site the rubric has a name and a type:{" "}
                <code className="font-mono text-[12px] text-amber">acceptance-criteria</code>
                , produced in planning and read by whatever judges the work. It is a real
                edge in the graph, which is why the analyzer can follow it.
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2/60 px-4 py-3">
              <h3 className="font-display text-base font-semibold text-fg">
                And why it is kept away
              </h3>
              <p className="text-sm leading-relaxed text-muted">
                A verdict is worth something because the node doing the work never saw
                what it would be judged against. That is a property of the topology, so it
                is checkable:{" "}
                <Link href="/spec/topology" className={LINK}>
                  the edge that is not there <span aria-hidden>→</span>
                </Link>
              </p>
            </div>
          </div>

          <Correction>
            <span className="text-fg">A second correction.</span> Nothing on this site
            evaluates a run. The six-axis scorecard is static analysis of a graph, plus
            four rows that are seeded and say so. An eval needs an execution to judge, and
            there is no runner here.
          </Correction>

          <Correction>
            <span className="text-fg">And a third.</span>{" "}
            <span className="text-fg">Observability</span> is not modelled here at all: no
            field on a card, no term in the vocabulary, nothing in the engine. Traces,
            token counts and latency all belong to a run, and runs happen on your machine.
            It is a real practice and this site has no opinion on it, which is worth saying
            rather than drawing a box for.
          </Correction>
        </div>
      </section>
    </>
  );
}
