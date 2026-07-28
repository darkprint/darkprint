/* ============================================================
   Phase coverage — doc 2 §8, doc 3 §2
   Which of the five lifecycle phases a blueprint has nodes in.

   ⚠️ It is a DESCRIPTION, never a score (doc 2 §1.1, last bullet:
   "coprire tre fasi su cinque è una descrizione, non un difetto").
   Nothing in this file counts, divides, ranks or completes:
   - no percentage, no ratio, no "3 of 5", no "all five"
   - no bar that fills left to right, no track with an empty tail
   - no word implying that a phase without a node is missing work

   What it draws instead is the lifecycle in order, saying where the
   factory acts. A gap in the middle of the strip is information about
   the shape of the pipeline — a merge bot has no planning node
   because it is not asked to plan — and reads as position, not as a
   shortfall.

   ⚠️ Second rule, from the author's ruling that supersedes doc 3 §1's
   cardinality row: **the five phases describe the factory, not every
   node in it.** A card may declare one phase, several, or none, and a
   node with none is a complete answer — an intake, a retrieval step,
   a router. So:
   - `byPhase` COVERS the graph, it does not PARTITION it. A two-phase
     node appears in two rows on purpose, and nothing here may sum the
     rows to count nodes.
   - `unphased` is stated as what it is, never as what is missing. It
     gets no cell in the strip, no row in the lifecycle, no glyph
     borrowed from a phase that has no node, and no count set against
     a total.
   ============================================================ */

import { cx } from "@/lib/format";

/**
 * The five phases of doc 3 §2, in that document's lifecycle order — which is the order
 * `CORE_PHASE_IDS` reports and the order this file must draw them in. Restated here
 * rather than imported from `@/lib/core` for the reason `lib/format.ts` restates the
 * node kinds: the gallery card is rendered inside a client component, and the engine
 * is not something to ship to a browser to look up five labels.
 *
 * `short` is the strip's cell. Three letters, because `debugging` and `deployment`
 * share an initial and a strip that showed `D D` would be lying about two of the five.
 */
const PHASES: readonly { id: string; label: string; short: string }[] = [
  { id: "planning", label: "Planning", short: "pln" },
  { id: "implementation", label: "Implementation", short: "imp" },
  { id: "testing", label: "Testing", short: "tst" },
  { id: "debugging", label: "Debugging", short: "dbg" },
  { id: "deployment", label: "Deployment", short: "dep" },
];

/**
 * The engine's `PhaseCoverage`, structurally. Restated as a local shape so this file
 * carries no import from `@/lib/core`; the engine's own type is assignable to it.
 */
export interface PhaseCoverageView {
  /** Phase ids with at least one node, in lifecycle order. */
  covered: readonly string[];
  /** The rest, same order. A statement of scope, not a to-do list. */
  missing: readonly string[];
  /**
   * Node ids grouped by the phase their card declares, in graph order.
   *
   * A cover, not a partition: a card declaring two phases is listed under both, so
   * the groups may name the same node twice and their lengths do not add up to the
   * number of nodes in the graph. Nothing here adds them up.
   */
  byPhase: Readonly<Record<string, readonly string[]>>;
  /**
   * Nodes whose card declares no phase at all. Descriptive: the five phases are a
   * statement about the factory, and a node outside them is doing work none of the
   * five names, not work somebody forgot to label.
   */
  unphased: readonly string[];
}

/**
 * The five ids in lifecycle order.
 *
 * Exported for the two browsers' phase filters, which have to offer the phases in the
 * order a factory runs them — sorting a phase list alphabetically would put deployment
 * before planning and say something false about the shape of the work.
 */
export const PHASE_ORDER: readonly string[] = PHASES.map((phase) => phase.id);

/** A phase id as a reader should see it. Falls back to the raw id for a term off the five. */
export function phaseLabel(id: string): string {
  return PHASES.find((phase) => phase.id === id)?.label ?? id;
}

/** "planning, implementation and testing" — Oxford-free, matching the site's copy. */
function joinLabels(ids: readonly string[]): string {
  const labels = ids.map(phaseLabel).map((l) => l.toLowerCase());
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * The whole of the coverage as one sentence, for assistive technology and as the
 * strip's tooltip.
 *
 * Two clauses, both factual: where the graph has nodes, and where it has none. The
 * second clause is doc 2 §8's own example sentence ("non ha debugging né deployment")
 * and is phrased as a fact about this graph, never as something outstanding.
 */
function describe(covered: readonly string[], missing: readonly string[]): string {
  const has =
    covered.length === 0
      ? "No node in this blueprint declares a lifecycle phase."
      : `This blueprint has nodes in ${joinLabels(covered)}.`;
  if (missing.length === 0) return `Phase coverage. ${has}`;
  return `Phase coverage. ${has} Nothing in it sits in ${joinLabels(missing)}.`;
}

/* --------------------- compact: the gallery card --------------------- */

const CELL =
  "rounded-sm border px-1 py-[2px] font-mono text-[9px] uppercase leading-none tracking-[0.06em]";

/**
 * The lifecycle strip, sized for a card footer.
 *
 * A cell is present or absent, and three things say which: a solid border against a
 * dashed one, a tint against none, and the ink. The border style alone is enough, so
 * nothing here rests on colour (design rule) — and the sentence underneath carries the
 * whole of it for a reader who sees no cells at all.
 *
 * No link inside: the gallery card is itself one big anchor, and an anchor inside an
 * anchor is not markup a browser can resolve.
 *
 * Takes `covered` and `missing` and nothing else — deliberately no `unphased`. The strip
 * is five cells because there are five phases; a node that declares none is not a sixth
 * cell, and appending one would put "outside the lifecycle" on the same axis as the
 * lifecycle. The nodes standing outside it are named on the blueprint page, in words,
 * by `PhaseCoverageList` below.
 */
export function PhaseCoverageBadge({
  covered,
  missing,
  className,
}: {
  covered: readonly string[];
  missing: readonly string[];
  className?: string;
}) {
  const present = new Set(covered);
  const sentence = describe(covered, missing);

  return (
    <div className={cx("flex items-center gap-2", className)} title={sentence}>
      <span
        aria-hidden
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim"
      >
        phases
      </span>
      <span aria-hidden className="flex items-center gap-1">
        {PHASES.map((phase) => (
          <span
            key={phase.id}
            className={cx(
              CELL,
              present.has(phase.id)
                ? "border-solid border-cyan/50 bg-cyan/10 text-cyan"
                : "border-dashed border-line text-dim",
            )}
          >
            {phase.short}
          </span>
        ))}
      </span>
      <span className="sr-only">{sentence}</span>
    </div>
  );
}

/* --------------------- full: the blueprint detail page --------------------- */

/**
 * The lifecycle in full, one row per phase, with the nodes standing in each.
 *
 * This is the rendering that earns the dimension: a reader does not want to know how
 * many phases are ticked, they want to know *which node* does the testing. Node ids
 * come out of `byPhase` in graph order; `nodeLabels` maps them to the names the
 * schematic prints, so the two surfaces name the same node the same way.
 *
 * A phase with no node says so in words. It is not styled as an error, is not sorted
 * to the bottom, and keeps its place in the lifecycle — where it sits is the point.
 *
 * A node in two phases appears in both rows, and that is the data being honest rather
 * than a duplicate: `evidence-synthesizer` reads failure evidence and writes the fix
 * brief, so it stands in implementation and in debugging. A node in no phase appears in
 * none of the rows and is named underneath them, outside the lifecycle strip entirely —
 * see `Unphased` at the bottom of this file for why it is not a sixth row.
 */
export function PhaseCoverageList({
  coverage,
  nodeLabels,
  className,
}: {
  coverage: PhaseCoverageView;
  /** Node id → the label the schematic draws. Ids are shown as-is for anything absent. */
  nodeLabels?: Readonly<Record<string, string>>;
  className?: string;
}) {
  const present = new Set(coverage.covered);

  /* The five, then anything else a card declared. The validator rejects a phase off
     doc 3 §2's closed list, so the tail is normally empty — but the engine reports such
     a group rather than dropping it, and a row silently omitted here would be a node
     the page never mentions. */
  const extra = Object.keys(coverage.byPhase)
    .filter((id) => !PHASES.some((phase) => phase.id === id))
    .filter((id) => (coverage.byPhase[id] ?? []).length > 0);

  const rows = [
    ...PHASES.map((phase) => ({ id: phase.id, label: phase.label })),
    ...extra.map((id) => ({ id, label: id })),
  ];

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <p className="text-sm leading-relaxed text-muted">
        Which of the lifecycle phases this graph has a node in, and which node. It
        describes what the factory covers — a phase with no node is a decision about
        scope, not a gap in the blueprint. A node may stand in more than one phase, and
        it may stand in none: the five describe the factory, not every node in it.
      </p>

      <dl className="flex flex-col divide-y divide-line">
        {rows.map((row) => {
          const nodes = coverage.byPhase[row.id] ?? [];
          const covered = present.has(row.id) || nodes.length > 0;
          return (
            <div
              key={row.id}
              className="grid grid-cols-1 gap-1.5 py-3 first:pt-0 last:pb-0 sm:grid-cols-[150px_1fr] sm:gap-4"
            >
              <dt className="flex items-center gap-2">
                {/* Filled vs hollow: the state is a shape before it is a colour. */}
                <span
                  aria-hidden
                  className={cx(
                    "font-mono text-[11px]",
                    covered ? "text-cyan" : "text-dim",
                  )}
                >
                  {covered ? "■" : "□"}
                </span>
                <span
                  className={cx(
                    "font-mono text-[12px] uppercase tracking-[0.12em]",
                    covered ? "text-fg" : "text-dim",
                  )}
                >
                  {row.label}
                </span>
              </dt>
              <dd className="min-w-0">
                {nodes.length > 0 ? (
                  <NodeChips ids={nodes} nodeLabels={nodeLabels} />
                ) : (
                  <span className="text-xs leading-relaxed text-dim">
                    No node in this graph.
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <Unphased ids={coverage.unphased} nodeLabels={nodeLabels} />
    </div>
  );
}

/** The node names a phase row or the unphased statement lists, drawn identically. */
function NodeChips({
  ids,
  nodeLabels,
}: {
  ids: readonly string[];
  nodeLabels?: Readonly<Record<string, string>>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((nodeId) => (
        <span
          key={nodeId}
          className="inline-flex items-center rounded border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-fg"
        >
          {nodeLabels?.[nodeId] ?? nodeId}
        </span>
      ))}
    </div>
  );
}

/**
 * The nodes standing outside the five, named.
 *
 * Three deliberate refusals, because this is the exact place the ruling could be
 * undone by a layout choice:
 *
 * 1. **Not a sixth row.** It sits below the `dl`, past a rule, with the same chips but
 *    none of the lifecycle furniture — no ■/□ state glyph, no position in the strip.
 *    A sixth row would put "outside the lifecycle" on the lifecycle's own axis and
 *    would read as the phase nobody filled in.
 * 2. **No denominator.** The count is stated on its own ("2 nodes"), never against the
 *    graph's total and never as a share of anything. Doc 2 §1.1 rules out the second
 *    number, and a fraction here would turn a design fact into a completion figure.
 * 3. **Absent when empty.** A graph where every node declares a phase says nothing
 *    here at all: "0 nodes outside the five" is a scoreboard reading zero, and a
 *    scoreboard is what this dimension must never become. The absence of the block is
 *    not a claim — the rows above already say where every node stands.
 *
 * The sentence names the kinds of node that legitimately land here, because the reader
 * most likely to be confused is an author looking at their own intake node and
 * wondering which of the five they were supposed to pick. None of them.
 */
function Unphased({
  ids,
  nodeLabels,
}: {
  ids: readonly string[];
  nodeLabels?: Readonly<Record<string, string>>;
}) {
  if (ids.length === 0) return null;

  return (
    <section
      aria-labelledby="phase-unphased-heading"
      className="flex flex-col gap-2 border-t border-line pt-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id="phase-unphased-heading"
          className="font-mono text-[12px] uppercase tracking-[0.12em] text-fg"
        >
          Outside the five
        </h3>
        <span className="font-mono text-[11px] text-dim">
          {ids.length} node{ids.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        These nodes name no phase, which is a complete answer rather than a blank one.
        Intake, retrieval, routing and hand-off are real work that none of the five
        phases describes, and the card says so by leaving the field out.
      </p>
      <NodeChips ids={ids} nodeLabels={nodeLabels} />
    </section>
  );
}
