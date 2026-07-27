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
  /** Node ids grouped by the phase their card declares, in graph order. */
  byPhase: Readonly<Record<string, readonly string[]>>;
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
        scope, not a gap in the blueprint.
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
                  <div className="flex flex-wrap gap-1.5">
                    {nodes.map((nodeId) => (
                      <span
                        key={nodeId}
                        className="inline-flex items-center rounded border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-fg"
                      >
                        {nodeLabels?.[nodeId] ?? nodeId}
                      </span>
                    ))}
                  </div>
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
    </div>
  );
}
