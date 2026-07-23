import type { AutonomyLevel } from "@/lib/types";
import { AUTONOMY_LABELS, NODE_KIND_META } from "@/lib/format";
import { SectionHeading } from "@/components/ui/SectionHeading";

type Rung = { level: AutonomyLevel; color: string; blurb: string };

const RUNGS: Rung[] = [
  {
    level: 1,
    color: "var(--color-dim)",
    blurb: "A human drives; agents assist step by step.",
  },
  {
    level: 2,
    color: "var(--color-amber)",
    blurb: "Agents do the work, but a human approves the critical move.",
  },
  {
    level: 3,
    color: "var(--color-cyan)",
    blurb: "Self-directed within guardrails; escalates only the edge cases.",
  },
  {
    level: 4,
    color: "var(--color-emerald)",
    blurb: "Plans, executes, verifies and ships with no human in the loop.",
  },
];

const GATE = NODE_KIND_META.gate;

export function SectionAutonomy() {
  return (
    <section id="autonomy" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The autonomy ladder"
          title="From assisted to closed-loop"
          lead="Autonomy is a discrete level, not a vibe. It's the headline axis of the scorecard, and it climbs exactly as far as the graph lets it."
        />

        <ol className="mt-10 flex flex-col gap-3 md:flex-row md:items-stretch md:gap-0">
          {RUNGS.map((r, i) => (
            <li
              key={r.level}
              className="flex items-stretch md:flex-1"
              style={{ color: r.color }}
            >
              <div className="panel flex w-full flex-col gap-3 p-5">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold leading-none">
                    A{r.level}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.14em]">
                    {AUTONOMY_LABELS[r.level]}
                  </span>
                </div>
                <div className="flex gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((seg) => (
                    <span
                      key={seg}
                      className="h-1.5 flex-1 rounded-full"
                      style={{
                        background:
                          seg <= r.level ? r.color : "var(--color-line)",
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-muted">{r.blurb}</p>
              </div>
              {i < RUNGS.length - 1 && (
                <span
                  aria-hidden
                  className="hidden shrink-0 items-center px-1 text-dim md:flex"
                >
                  →
                </span>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-start gap-4 rounded-lg border border-signal/30 bg-signal/5 p-5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-lg"
            style={{
              color: GATE.color,
              backgroundColor: `color-mix(in oklab, ${GATE.color} 14%, transparent)`,
            }}
          >
            {GATE.glyph}
          </span>
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-fg">A single human-approval gate</span> anywhere on the
            critical path caps a blueprint at level 2. The static analyzer counts{" "}
            <span className="font-mono text-signal">{GATE.label.toLowerCase()}</span> nodes straight
            off the graph — so autonomy is measured, not claimed. You can&apos;t self-report your way
            to closed-loop.
          </p>
        </div>
      </div>
    </section>
  );
}
