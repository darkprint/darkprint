import Link from "next/link";
import { shortDigest } from "@/lib/core";
import { criteriaVerdict } from "@/lib/criteria-state";
import { contentHref } from "@/lib/href";
import type { BlueprintGraph as BlueprintGraphData } from "@/lib/types";
import { BlueprintGraph } from "@/components/graph/BlueprintGraph";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  ABSENT_EDGE,
  ADDED_DOT_LINE,
  errorsOf,
  type IsolationDemo,
} from "./starter-isolation";

/* ============================================================
   Doc 2 §5.2's lesson, shown instead of asserted: "La lezione
   centrale non sta in un nodo, sta in un arco che non c'è."

   Both figures are engine output. The first is the archive's own
   view model for `starter-software-factory`; the second comes out
   of `loadBundle` over the same manifest and the same five cards
   with one line added to the DOT (see ./starter-isolation.ts).
   Every number and every sentence attributed to the analyzer
   below is read off those two results, so this page cannot drift
   from what the engine actually does. If the weights are ever
   re-tuned, the figures here move with them.

   The absent edge is marked in the one way an absence can be:
   as a row that is drawn and empty, in a list of the edges that
   are there. The same grammar the phase strip uses for a lifecycle
   phase with no node standing in it.
   ============================================================ */

const LABEL = "font-mono text-[11px] uppercase tracking-[0.18em] text-dim";
const TH = "pb-2 font-normal uppercase tracking-[0.14em] text-[10px] text-dim";

/** The engine's own sentence, in the mono block the blueprint pages use for one. */
function Verbatim({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-line bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-dim">
      {children}
    </p>
  );
}

/**
 * One schematic with its caption. `<figure>` takes its accessible name from the
 * `<figcaption>`, so the caption is the only label there is and nothing here overrides it
 * with a shorter one.
 */
function Figure({
  graph,
  id,
  title,
  verdict,
  verdictColor,
  caption,
}: {
  graph: BlueprintGraphData;
  /** Distinct React Flow instance name — this is the one page that mounts two. */
  id: string;
  title: string;
  /**
   * What the engine concluded about this bundle, as the header reads it.
   *
   * A security level for the bundle that resolves, and the refusal for the one that does
   * not. It used to be a score on both, which put "security level 2" in the header of a
   * bundle carrying an error diagnostic — a number no other surface on the site is
   * willing to print, and the wrong headline besides: the reason nobody can ship that
   * graph is that a card said it could not receive what the edge carries, and the reason
   * shows up before any score does.
   */
  verdict: string;
  verdictColor: string;
  caption: React.ReactNode;
}) {
  return (
    <figure className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className={LABEL}>{title}</span>
        <span
          className="font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: verdictColor }}
        >
          {verdict}
        </span>
      </div>
      <div className="p-3">
        {/* `builder` is ringed in both figures on purpose: it is the same node in both,
            and the difference between the two drawings is what points into it. */}
        <BlueprintGraph
          graph={graph}
          id={id}
          highlighted={ABSENT_EDGE.target}
          height={360}
          className="rounded-md"
        />
      </div>
      <figcaption className="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}

export function SectionAbsentEdge({ demo }: { demo: IsolationDemo }) {
  const { published, leaked } = demo;
  const publishedSecurity = published.analysis.security;

  const names: Record<string, string> = {};
  for (const node of published.graph.nodes) names[node.id] = node.label;

  // The engine reports the same limit on both graphs, and it is worth reading: the walk
  // stops at the tester by design (doc 2 §5.5), so the loop back through the debugger is
  // a channel the topology cannot answer for. Taken from the published result, which is
  // where a reader would go looking for it.
  const relayed = criteriaVerdict(publishedSecurity).relayed[0];

  // One finding, one penalty, both named by the engine. Guarded rather than indexed
  // blindly: if a re-calibration ever made this graph score differently, the page drops
  // the quote instead of rendering an empty block that reads like a clean result.
  const finding = leaked.security.findings[0];
  const penalty = leaked.security.penalties[0];

  // What the engine refused, rather than what it scored. `code-builder@1.0.0` declares
  // `cannot: [acceptance-criteria]` and the added edge carries exactly that, so the run
  // that produced the figures below also produced an error and the bundle does not
  // resolve. This page computes that and used to throw it away; the header of figure 2
  // now reads the refusal and the block below quotes it. Guarded like every other quote
  // here: if the card ever drops the prohibition, the page loses this block and keeps the
  // security reading rather than asserting a refusal nothing produced.
  const errors = errorsOf(leaked);
  const refused = errors.length > 0;

  return (
    <section id="demonstration" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="Shown on a real bundle"
          title="One edge, and what it costs"
          lead="A claim about topology can be checked on a topology. The starter blueprint is in the archive: five nodes, one for each phase of the lifecycle, and the thing worth studying about it is an edge it does not have."
        />

        <p className="mt-4 font-mono text-xs text-dim">
          {published.graph.nodes.length} nodes · {published.graph.edges.length} edges ·{" "}
          {published.cardRefs.length} pinned cards · {shortDigest(published.digest)}
        </p>

        {/* ---------- figure 1: as published ---------- */}
        <div className="mt-8">
          <Figure
            graph={published.graph}
            id="starter-as-published"
            title="As published"
            verdict={`resolves · security level ${publishedSecurity.level}`}
            verdictColor="var(--color-emerald)"
            caption={
              <>
                The planner writes two artefacts: an ordered build plan, and the acceptance
                criteria the finished work will be judged against. The criteria go to the
                tester. Nothing at all goes to the builder, which is why nothing points
                into the ringed node above. Its brief arrives when the graph is
                instantiated.
              </>
            }
          />
        </div>

        {/* ---------- the wiring, including the row that is not there ---------- */}
        <div className="panel mt-5 p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className={LABEL}>The wiring</h3>
            <span className="font-mono text-[11px] text-dim">
              {published.graph.edges.length} declared · 1 absent
            </span>
          </div>

          <div
            tabIndex={0}
            role="group"
            aria-label="Scrollable table of the starter blueprint's edges"
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[26rem] font-mono text-[12px]">
              <caption className="sr-only">
                Every edge the starter blueprint&apos;s DOT declares, and below them the
                one edge it deliberately does not declare: from the planner to the builder.
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className={TH}>
                    Edge
                  </th>
                  <th scope="col" className={`${TH} pl-4`}>
                    Carries
                  </th>
                  <th scope="col" className={`${TH} pl-4 text-right`}>
                    In the DOT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {published.graph.edges.map((edge) => (
                  <tr key={edge.id}>
                    <th scope="row" className="py-2.5 text-left font-normal text-fg">
                      {edge.source} <span className="text-dim">→</span> {edge.target}
                      <span className="mt-0.5 block font-sans text-[11px] leading-snug text-dim">
                        {names[edge.source] ?? edge.source} to{" "}
                        {names[edge.target] ?? edge.target}
                      </span>
                    </th>
                    <td className="py-2.5 pl-4 align-top text-muted">{edge.label ?? "—"}</td>
                    <td className="py-2.5 pl-4 text-right align-top text-emerald">
                      <span aria-hidden>✓ </span>declared
                    </td>
                  </tr>
                ))}
                {/* The same list, one more row, drawn and empty. It stays in the body
                    rather than moving to a `tfoot`, because it is a row of the same data
                    and not a total over it; the dashed rule is what separates it. */}
                <tr className="!border-t !border-dashed !border-line-bright">
                  <th scope="row" className="py-3 text-left font-normal text-dim">
                    {ABSENT_EDGE.source} <span className="text-faint">⇢</span>{" "}
                    {ABSENT_EDGE.target}
                    <span className="mt-0.5 block font-sans text-[11px] leading-snug text-dim">
                      {names[ABSENT_EDGE.source] ?? ABSENT_EDGE.source} to{" "}
                      {names[ABSENT_EDGE.target] ?? ABSENT_EDGE.target}
                    </span>
                  </th>
                  <td className="py-3 pl-4 align-top text-dim">{ABSENT_EDGE.label}</td>
                  <td className="py-3 pl-4 text-right align-top text-signal">
                    <span aria-hidden>◌ </span>absent
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
            The last row is the design. It is the only one you cannot find in the drawing,
            because an edge nobody wrote has nothing to look at. So here is the same bundle
            with it added.
          </p>
        </div>

        {/* ---------- figure 2: the variant ---------- */}
        <div className="mt-8">
          <Figure
            graph={leaked.graph}
            id="starter-with-leak"
            title="With one line added to the DOT"
            verdict={
              refused
                ? "does not resolve"
                : `resolves · security level ${leaked.security.level}`
            }
            verdictColor="var(--color-signal)"
            caption={
              <>
                Same manifest, same cards, one edge. This bundle is not in the archive and
                has no page of its own: it is assembled during the build so the
                analyzer can be run on it and quoted here. The new edge is drawn like every
                other edge, because that is what it is. A leak looks like ordinary wiring.
              </>
            }
          />
        </div>

        <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-[12px] leading-relaxed text-fg">
          <code>{ADDED_DOT_LINE}</code>
        </pre>

        {/* ---------- what the engine said ---------- */}
        <div className="panel mt-5 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className={LABEL}>What the analyzer said</h3>
            <span className="font-mono text-[11px] text-dim">
              scored under ontology v{leaked.security.ontologyVersion}
            </span>
          </div>

          {/* The refusal comes first because it comes first: an error ends the matter,
              and the reading below it is what the analyzer computed on the way there. */}
          {refused && (
            <div className="mb-5 flex flex-col gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal">
                <span aria-hidden>✕ </span>the bundle does not resolve
              </span>
              {errors.map((diagnostic) => (
                <div
                  key={`${diagnostic.code} ${diagnostic.message}`}
                  className="flex flex-col gap-2 border-l-2 border-signal/50 pl-4"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <code className="font-mono text-[11px] text-signal">
                      {diagnostic.code}
                    </code>
                    {diagnostic.location?.edge !== undefined && (
                      <span className="font-mono text-[11px] text-dim">
                        edge {diagnostic.location.edge.source} →{" "}
                        {diagnostic.location.edge.target}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-fg">{diagnostic.message}</p>
                  {diagnostic.hint !== undefined && (
                    <p className="text-xs leading-relaxed text-muted">
                      <span className="font-mono text-dim">hint </span>
                      {diagnostic.hint}
                    </p>
                  )}
                </div>
              ))}
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                The builder&apos;s card states which types it will not accept, and the
                acceptance criteria are on that list. An edge carrying them into it
                contradicts the card, so the engine refuses the bundle instead of scoring
                it. That answer needs no weights and no thresholds: one author wrote a rule
                about their own node and the graph broke it. Publishing this variant is not
                a matter of a low reading, because DarkPrint will not resolve it at all.
              </p>
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                The security metric runs anyway and the two sentences below are what it
                produced, because resolution goes as far as it can and a partial reading
                with its working shown is what somebody fixing an upload needs. It is a
                second, independent answer to the same question: the check reads the
                topology and charges what it finds there, whether or not any card thought
                to declare anything.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald">
                as published
              </span>
              <Verbatim>{publishedSecurity.rationale}</Verbatim>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal">
                with the edge
              </span>
              <Verbatim>{leaked.security.rationale}</Verbatim>
            </div>
          </div>

          {penalty !== undefined && (
            <p className="mt-4 text-sm leading-relaxed text-fg">{penalty.explanation}</p>
          )}

          {finding !== undefined && (
            <div className="mt-4 flex flex-col gap-2 border-l-2 border-signal/50 pl-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <code className="font-mono text-[11px] text-signal">{finding.marker}</code>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">
                  <span aria-hidden>◇ </span>
                  {finding.establishedBy}
                </span>
                <span className="font-mono text-[11px] text-dim">
                  node {finding.nodeId}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-fg">{finding.explanation}</p>
              {finding.hint !== undefined && (
                <p className="text-xs leading-relaxed text-muted">
                  <span className="font-mono text-dim">hint </span>
                  {finding.hint}
                </p>
              )}
            </div>
          )}

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
            Autonomy does not move. Both graphs run with nobody standing in them and both
            come out {published.autonomy.label}. What the edge changed is what one node
            gets to see, and the security check is the one that answers for that.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            Nothing was executed to produce either number. Both are read off the DOT and the
            cards it pins, during the build, and both print the arithmetic above, so the
            answer can be checked against the source the site publishes. Running a blueprint
            happens on your own machine, and it is not built here.
          </p>

          {relayed !== undefined && (
            <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                <span aria-hidden>◌ </span>where the check stopped, on both graphs
              </h4>
              {/* Prose, not the mono block: the mono block is for the engine's arithmetic,
                  and a diagnostic message is a sentence. The blueprint pages draw the same
                  distinction, and eleven-point mono is the wrong place to read one. */}
              <p className="text-sm leading-relaxed text-fg">{relayed.message}</p>
              <p className="text-xs leading-relaxed text-dim">
                Nothing is charged for that. The criteria reach the tester, the tester&apos;s
                output goes on to the debugger, and what the tester forwards is decided by
                the prose on its card, where the topology cannot follow it. An analyzer that
                cannot tell silence from a clean result is worth less than one that says
                which of the two it found.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">
          The two figures above are one graph read twice. The{" "}
          <Link
            href="/build"
            className="font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan"
          >
            guided path
          </Link>{" "}
          puts the same pair behind a switch on a factory you configure yourself: the
          statement goes into the DOT, the analyzer reads the graph again in your tab and
          prints what it found, and the switch goes back off when you leave the step. No
          file the path hands over carries the edge.{" "}
          <Link
            href={contentHref(published)}
            className="font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan"
          >
            {published.title}
          </Link>{" "}
          carries the full bundle: the DOT, the five cards it pins, and the working behind
          both of its computed scores.
        </p>
      </div>
    </section>
  );
}
