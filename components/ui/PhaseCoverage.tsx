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
 * `short` is `PhaseCoverageBadge`'s cell. Three letters, because `debugging` and
 * `deployment` share an initial and a strip that showed `D D` would be lying about two of
 * the five.
 *
 * `word` is `CoverageStrip`'s label, and the two abbreviations are not redundant. A cell is
 * a bordered box in a row of five: it wants a fixed width and reads as a code, so three
 * clipped letters are right and `imp` is legible in context. A strip label sits UNDER a bar
 * that already carries lit-or-not, so the word has one job — name the phase — and a reader
 * scanning a column of nine rows should not have to decode it. `plan / build / test / debug
 * / ship` are the words the rest of the site uses for these five in prose.
 *
 * Neither is the full name, and neither has to be: both surfaces put `label` in a `title`.
 */
const PHASES: readonly { id: string; label: string; short: string; word: string }[] = [
  { id: "planning", label: "Planning", short: "pln", word: "plan" },
  { id: "implementation", label: "Implementation", short: "imp", word: "build" },
  { id: "testing", label: "Testing", short: "tst", word: "test" },
  { id: "debugging", label: "Debugging", short: "dbg", word: "debug" },
  { id: "deployment", label: "Deployment", short: "dep", word: "ship" },
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

/* --------------------- the strip: one row of the /blueprints shelf --------------------- */

/**
 * Five slots, a bar over a word, and the reason the shelf's row exists.
 *
 * `GalleryBrowser` offers phase coverage as a way in and nothing on the shelf showed it: a
 * reader filtered by phase and then had to open a blueprint to see what they had filtered
 * for. This is that answer, down a column.
 *
 * Everything in this file's header governs it. **No count and no completeness reading** — no
 * "3/5", no percentage, no bar that fills left to right with an empty tail, and nothing that
 * orders one blueprint above another. `GalleryBrowser`'s own `phases` memo states the rule it
 * is holding: "a factory covering three phases is three ways into this list, not two short of
 * anything."
 *
 * ── Every slot is labelled, covered or not ──
 * The bar carries lit-or-unlit; the word only has to be readable. And the word over a DARK
 * bar is precisely the one a reader needs — it is the phase this factory does not act in,
 * which is the fact the strip exists to make legible. So the uncovered label is
 * `--color-dim` (5.68:1) and never `--color-faint`, which `globals.css` declares decorative
 * and measures at 1.83:1. The hand-off records this being caught twice in review; it is not
 * a contrast oversight to be tidied back.
 *
 * ── 11px, where the mock draws 10 ──
 * The site's mono floor is 0.6875rem and `app/globals.css` says there are no exceptions to
 * it. This file already carries the scar: `PhaseCoverageBadge` below "had quietly gone
 * under" at 9px and was brought back up. Setting a new strip at 10 would repeat that exact
 * defect three months later. The mock's reason for short labels is width — the strip has to
 * survive a 236px column — and that is satisfied at 11: five slots and four 6px gaps leave
 * 42.4px each, where `debug` measures about 33.
 */
export function CoverageStrip({
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
    <div className={cx("flex flex-col gap-2", className)}>
      <span aria-hidden className="label">
        covers
      </span>
      {/* `grid-cols-5` and not a flex row: the five slots are one measure divided five ways,
          so a longer word cannot take room from its neighbours and the bars stay a rhythm
          rather than five different lengths. */}
      <div aria-hidden className="grid grid-cols-5 gap-1.5">
        {PHASES.map((phase) => (
          /* The full phase name is one hover away on every slot, covered or not — the strip
             abbreviates, and a reader who does not know which of `build` and `ship` the
             archive calls `implementation` should not have to guess. */
          <span key={phase.id} title={phase.label} className="flex flex-col gap-1.5">
            <span
              className={cx(
                "h-1 rounded-full",
                present.has(phase.id) ? "bg-cyan" : "bg-line-bright",
              )}
            />
            <span
              className={cx(
                "font-mono text-[11px] leading-none",
                present.has(phase.id) ? "text-blueprint-ink" : "text-dim",
              )}
            >
              {phase.word}
            </span>
          </span>
        ))}
      </div>
      {/* The whole reading as one sentence, for a reader who meets no bars at all. Shared
          with `PhaseCoverageBadge` rather than reworded, so the two surfaces cannot come to
          describe the same coverage differently. */}
      <span className="sr-only">{sentence}</span>
    </div>
  );
}

/* --------------------- compact: the upload preview --------------------- */

/**
 * 11px, not 9px. The site writes its own mono floor down two rules from here — every
 * `.eyebrow`, `.label` and `.route-label` in app/globals.css is 0.6875rem and nothing is
 * allowed below it — and this strip is the one place that had quietly gone under. A
 * three-letter phase name is already the most abbreviated text on the card; setting it two
 * steps below the floor made it the hardest thing on the card to read as well.
 *
 * `px-1` stays: the five cells plus their label measure well inside the narrowest card at
 * 390px, so the room is bought without taking it out of the type.
 */
const CELL =
  "rounded-sm border px-1 py-[2px] font-mono text-[11px] uppercase leading-none tracking-[0.06em]";

/**
 * The lifecycle strip, sized for a card footer.
 *
 * "the gallery card" in the heading above was true and is not: the card dropped this, and
 * since 2026-08-12 the shelf draws `CoverageStrip` instead. `components/upload/UploadFlow.tsx`
 * is the only mount left, which is why the cell shape is still the right one — a preview of a
 * bundle being validated is a dense panel, not a row with a column to itself.
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
 * lifecycle.
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
      <span aria-hidden className="label">
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
