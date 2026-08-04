import { CORE_PHASE_IDS, type PhaseCoverage } from "@/lib/core";
import { cx } from "@/lib/format";

/* ============================================================
   The five lifecycle phases, and which node covers each.

   Step 1 asserts a mapping its own panes do not draw: "five nodes,
   one for each phase of that work: planning, implementation,
   testing, debugging, deployment". The graph pane underneath draws
   `planner`, `builder`, `tester`, `debugger`, `deployer` — node
   names, not phase names. A reader had to hold the sentence in
   their head and match it against the drawing themselves, and that
   is the reading this strip supports.

   It is the legend the sentence promises, not a second copy of the
   graph. Redrawing the graph beside a pane already drawing it is
   the duplication every pass on this site keeps cutting.

   ── Read, never listed ──
   `CORE_PHASE_IDS` gives the order and `phaseCoverage.byPhase`
   gives the nodes. A hand-written strip would be a second copy of
   both, free to drift from the graph the reader is looking at the
   moment they change a choice. It follows the blueprint: pick a
   variant whose cards declare different phases and the strip
   follows without being told.

   ── Why this is not a client component ──
   The first version gated the cells on `useReveal`, which is the
   site's motion hook and the right one for a scene. It was the
   wrong shape for this: the cells were hidden by default and the
   reveal was what showed them, so when the observer did not fire
   the strip rendered as five invisible boxes and the step lost the
   legend entirely. Spec §2a's rule is that animation is *added* to
   a finished drawing and is never what reveals it, and gating
   opacity on script breaks that however carefully the hook is
   written.

   So the resting style here is the finished one and the stagger is
   `anim-strip-in` in `globals.css`, which exists only inside
   `prefers-reduced-motion: no-preference`. Nothing about whether
   the text is legible depends on JavaScript, an observer, or a
   transition completing. The animation is the only thing that can
   be lost.

   The stagger runs in lifecycle order because the order is the
   argument: work moves along it. A simultaneous fade would say
   "here are five things" where this says "here is a sequence".

   A phase no node covers is drawn quietly rather than as a hole.
   PROJECT.md's rule about the five holds here as it does on a
   score panel: a blueprint that covers four phases is a pattern
   about four phases.
   ============================================================ */

/** Milliseconds between one cell arriving and the next. */
const STEP = 90;

export function LifecycleStrip({
  coverage,
  nodeNames,
  className,
}: {
  coverage: PhaseCoverage;
  /** Node id → the name the schematic prints, so the strip and the drawing agree. */
  nodeNames: Readonly<Record<string, string>>;
  className?: string;
}) {
  return (
    <ol
      className={cx("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5", className)}
      aria-label="The five lifecycle phases, and the nodes that cover them"
    >
      {CORE_PHASE_IDS.map((phase, i) => {
        const nodes = coverage.byPhase[phase] ?? [];
        const covered = nodes.length > 0;
        return (
          <li
            key={phase}
            className={cx(
              "anim-strip-in flex flex-col gap-1 rounded-lg border px-3 py-2.5",
              covered ? "border-line bg-surface-2/60" : "border-line/50",
            )}
            /* Per-cell data rather than a style: five utility classes for five fixed
               delays would be five things to keep in step with the phase list, where this
               is one expression that follows it. */
            style={{ animationDelay: `${i * STEP}ms` }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
              {phase}
            </span>
            {covered ? (
              <span className="text-[13px] leading-snug text-fg">
                {nodes.map((id) => nodeNames[id] ?? id).join(", ")}
              </span>
            ) : (
              <span className="text-[13px] leading-snug text-dim">no node here</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
