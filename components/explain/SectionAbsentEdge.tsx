import Link from "next/link";
import { shortDigest } from "@/lib/core";
import { criteriaVerdict } from "@/lib/criteria-state";
import { contentHref } from "@/lib/href";
import type { FlowEdgeSeed, FlowNodeSeed } from "@/lib/types";
import {
  AbsentEdge,
  Edge,
  NodeBox,
  Scene,
  Sheet,
  VIZ,
  nodePort,
  type Point,
} from "@/components/viz";
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

   The absence is marked twice, in the two grammars this site has
   for one: as a row that is drawn and empty in the list of edges
   that are there, and as `AbsentEdge` in the drawing, which is the
   dashed place the edge would have gone.

   ── Why the two figures are drawn rather than rendered ──
   Spec §4.4 asks for the argument in a picture: two graphs side by
   side, one resolving, one refused, the difference being a single
   edge. React Flow drew them before, stacked, one screenful apart,
   and it cannot draw an edge that does not exist — so the lesson
   of the bundle was the one thing the schematic had no mark for.
   `components/viz` does, and two SVG scenes fit beside each other,
   which is what makes the single-edge difference readable in one
   look.

   Both drawings use the SAME placement, taken from the published
   graph. Adding `planner -> builder` moves the builder down a layer
   in `layeredLayout`, so laying each graph out on its own would
   have shifted four boxes and put a second difference in front of a
   reader who is being asked to find one. The node set is identical
   and placement is presentation; the edges are each graph's own.
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

/* --------------------- the two drawings --------------------- */

/**
 * Scene units for both figures, and one set for both.
 *
 * A reader is being asked to find a one-edge difference between two pictures, so every
 * other quantity has to be identical: same box, same node size, same spacing.
 */
const FIG = {
  width: 460,
  height: 300,
  padX: 34,
  padY: 26,
  node: { width: 120, height: 40 },
  /** Clearance between a box and the arrowhead that lands on it. */
  pad: 6,
  /** Lateral spacing when several edges share one face of a box. */
  spread: 20,
} as const;

const PORT = { width: FIG.node.width, height: FIG.node.height, pad: FIG.pad };

interface Placed {
  id: string;
  /** The card's name, which is what the wiring table prints under the node id. */
  label: string;
  x: number;
  y: number;
}

/**
 * The engine's own layout, turned on its side.
 *
 * `layeredLayout` runs left to right, which is what `rankdir=LR` in the DOT asks for and
 * what the full-width schematic on a blueprint page draws. These two figures sit beside
 * each other and have half a page's width each, so the layer axis becomes the vertical
 * one. Nothing is invented: the layer a node landed in and the row it took inside that
 * layer are both read off `position`, mapped proportionally into the box above. A node
 * that moves in the archive moves here.
 */
function place(nodes: readonly FlowNodeSeed[]): Placed[] {
  if (nodes.length === 0) return [];
  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const spanLayer = Math.max(...xs) - Math.min(...xs);
  const spanRow = Math.max(...ys) - Math.min(...ys);
  const usableY = FIG.height - 2 * FIG.padY - FIG.node.height;
  const usableX = FIG.width - 2 * FIG.padX - FIG.node.width;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return nodes.map((node) => ({
    id: node.id,
    label: node.label,
    // A single layer, or a single row inside every layer, divides by zero otherwise and
    // the honest answer for one lane is the middle of the box.
    x:
      FIG.padX +
      FIG.node.width / 2 +
      (spanRow === 0 ? usableX / 2 : ((node.position.y - minY) / spanRow) * usableX),
    y:
      FIG.padY +
      FIG.node.height / 2 +
      (spanLayer === 0 ? usableY / 2 : ((node.position.x - minX) / spanLayer) * usableY),
  }));
}

/**
 * Where an edge leaves and where it lands.
 *
 * Three cases, and the third is the one this page is about. A run down the layers leaves
 * the bottom face and lands on the top face. A run back up the layers swings out to the
 * left of the drawing, which is the convention the schematic already uses for the return
 * leg of the debug loop. A run across one layer goes face to face, and `planner` to
 * `builder` is exactly that: both sit in layer 0 of the published graph, so the edge the
 * bundle does not have and the edge the variant adds are the same horizontal line.
 */
function run(
  from: Placed,
  to: Placed,
  offsets: { from: number; to: number } = { from: 0, to: 0 },
): { a: Point; b: Point; bend: number } {
  if (to.y > from.y) {
    const [ax, ay] = nodePort(from.x, from.y, "bottom", PORT);
    const [bx, by] = nodePort(to.x, to.y, "top", PORT);
    return { a: [ax + offsets.from, ay], b: [bx + offsets.to, by], bend: 0 };
  }
  if (to.y < from.y) {
    // Wider clearance than a forward run and a bend away from the drawing, in that
    // order: a return leg that leaves from the same 6 units as everything else clips the
    // corner of the box it just left, which reads as a line through a node.
    const clear = { ...PORT, pad: 16 };
    return {
      a: nodePort(from.x, from.y, "left", clear),
      b: nodePort(to.x, to.y, "left", clear),
      bend: -44,
    };
  }
  const rightwards = to.x > from.x;
  return {
    a: nodePort(from.x, from.y, rightwards ? "right" : "left", PORT),
    b: nodePort(to.x, to.y, rightwards ? "left" : "right", PORT),
    bend: 0,
  };
}

/**
 * Lateral offsets so two edges sharing a face do not land their arrowheads on one point.
 *
 * The tester takes two incoming runs and emits two, which without this draws four heads
 * on two pixels. Only downward runs are spread; a back edge leaves from a face of its own.
 */
function spreadOf(
  edges: readonly FlowEdgeSeed[],
  at: Map<string, Placed>,
): Map<string, { from: number; to: number }> {
  const leaving = new Map<string, string[]>();
  const arriving = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, id: string) => {
    const list = map.get(key);
    if (list === undefined) map.set(key, [id]);
    else list.push(id);
  };
  for (const edge of edges) {
    const from = at.get(edge.source);
    const to = at.get(edge.target);
    if (from === undefined || to === undefined || to.y <= from.y) continue;
    push(leaving, edge.source, edge.id);
    push(arriving, edge.target, edge.id);
  }

  const centred = (list: string[], id: string) =>
    (list.indexOf(id) - (list.length - 1) / 2) * FIG.spread;

  const out = new Map<string, { from: number; to: number }>();
  for (const edge of edges) {
    out.set(edge.id, {
      from: centred(leaving.get(edge.source) ?? [], edge.id),
      to: centred(arriving.get(edge.target) ?? [], edge.id),
    });
  }
  return out;
}

/** `source→target`, which is how an edge is identified across the two graphs. */
function edgeKey(edge: { source: string; target: string }): string {
  return `${edge.source} ${edge.target}`;
}

/**
 * One drawing, with its sheet and its caption.
 *
 * `<figure>` takes its accessible name from the `<figcaption>` and the scene carries its
 * own `aria-label`, so the drawing is announced as a picture of something and the caption
 * carries the argument. Nothing here overrides either with a shorter label.
 */
function Figure({
  placed,
  edges,
  absent,
  addedKey,
  sceneLabel,
  title,
  verdict,
  verdictColor,
  caption,
}: {
  placed: readonly Placed[];
  edges: readonly FlowEdgeSeed[];
  /** Draw the edge that is not there. The published graph passes it; the variant does not. */
  absent?: boolean;
  /** `edgeKey` of the run this graph has and the other does not. Drawn as a defect. */
  addedKey?: string;
  sceneLabel: string;
  title: string;
  /**
   * What the engine concluded about this bundle, as the sheet's title block reads it.
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
  const at = new Map(placed.map((node) => [node.id, node]));
  const offsets = spreadOf(edges, at);
  const source = at.get(ABSENT_EDGE.source);
  const target = at.get(ABSENT_EDGE.target);

  return (
    <figure className="flex flex-col gap-3">
      <Sheet
        label={title}
        title={
          <span style={{ color: verdictColor }} className="uppercase tracking-[0.12em]">
            {verdict}
          </span>
        }
        note={`${placed.length} nodes · ${edges.length} edges`}
        bodyClassName="p-2 sm:p-3"
      >
        <Scene width={FIG.width} height={FIG.height} label={sceneLabel}>
          {edges.map((edge) => {
            const from = at.get(edge.source);
            const to = at.get(edge.target);
            if (from === undefined || to === undefined) return null;
            const added = addedKey !== undefined && edgeKey(edge) === addedKey;
            const { a, b, bend } = run(from, to, offsets.get(edge.id));
            return (
              <Edge
                key={edge.id}
                from={a}
                to={b}
                bend={bend}
                tone={added ? "signal" : "line"}
                weight={added ? VIZ.stroke.bold : VIZ.stroke.base}
                // Only the runs out of the criteria producer are labelled. Every edge and
                // what it carries is listed in the table below, and a drawing with five
                // labels on it stops being readable at the width of half a column.
                label={edge.source === ABSENT_EDGE.source ? edge.label : undefined}
                id={edge.id}
              />
            );
          })}

          {absent === true && source !== undefined && target !== undefined && (
            <AbsentEdge {...runOf(source, target)} label={ABSENT_EDGE.label} id="absent" />
          )}

          {placed.map((node) => (
            <NodeBox
              key={node.id}
              x={node.x}
              y={node.y}
              label={node.id}
              sub={node.label}
              // The same node is ringed in both drawings, because it is what the one edge
              // points into and the reader is being asked to compare what reaches it.
              tone={node.id === ABSENT_EDGE.target ? "cyan" : "line"}
              width={FIG.node.width}
              height={FIG.node.height}
              id={node.id}
            />
          ))}
        </Scene>
      </Sheet>
      <figcaption className="text-sm leading-relaxed text-muted">{caption}</figcaption>
    </figure>
  );
}

/** `run` shaped for `AbsentEdge`, which takes `from`/`to` rather than `a`/`b`. */
function runOf(from: Placed, to: Placed): { from: Point; to: Point; bend: number } {
  const { a, b, bend } = run(from, to);
  return { from: a, to: b, bend };
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

  // One placement, used by both drawings. See the file header for why the variant is not
  // laid out on its own.
  const placed = place(published.graph.nodes);

  // The run the variant has and the published bundle does not, found by comparing the two
  // edge lists rather than by naming it. `ADDED_DOT_LINE` says what was inserted; this
  // says what the parser made of it, and if the two ever disagree the drawing marks
  // nothing instead of marking the wrong edge.
  const declared = new Set(published.graph.edges.map(edgeKey));
  const addedKey = leaked.graph.edges.map(edgeKey).find((key) => !declared.has(key));

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

        {/* ---------- the pair, side by side ---------- */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Figure
            placed={placed}
            edges={published.graph.edges}
            absent
            sceneLabel="The starter blueprint drawn as five nodes. The planner's acceptance criteria run to the tester, and the place an edge from the planner to the builder would have gone is drawn as a dashed line with nothing on it."
            title="As published"
            verdict={`resolves · security level ${publishedSecurity.level}`}
            verdictColor="var(--color-emerald)"
            caption={
              <>
                The planner writes two artefacts: an ordered build plan, and the acceptance
                criteria the finished work will be judged against. The criteria go to the
                tester. Nothing at all goes to the builder, which is why nothing points
                into the ringed node. Its brief arrives when the graph is instantiated.
              </>
            }
          />
          <Figure
            placed={placed}
            edges={leaked.graph.edges}
            addedKey={addedKey}
            sceneLabel="The same five nodes with one edge added, from the planner to the builder, carrying the acceptance criteria."
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
                has no page of its own: it is assembled during the build so the analyzer
                can be run on it and quoted here. Everything except the marked run is drawn
                exactly as it is drawn beside it, so the difference between the two
                pictures is the whole of the difference between the two bundles.
              </>
            }
          />
        </div>

        <pre className="mt-5 overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-[12px] leading-relaxed text-fg">
          <code>{ADDED_DOT_LINE}</code>
        </pre>

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
            The last row is the design, and it is the row a schematic normally has nothing
            to show for, because an edge nobody wrote leaves nothing to look at. The first
            drawing marks it the way this table does, as the place the run would have gone.
            In the DOT above it is one more line among five, in the same syntax as the four
            that belong there, which is what a leak looks like when you meet one. The second
            drawing paints it because this page is pointing at it.
          </p>
        </div>

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
