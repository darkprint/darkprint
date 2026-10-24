import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

const STEPS = [
  { index: "01", label: "Describe a task" },
  { index: "02", label: "Review the graph" },
  { index: "03", label: "Reuse through MCP" },
  { index: "04", label: "Keep the files" },
] as const;

export function SectionFirstBlueprint() {
  return (
    <section id="first-blueprint" className="scroll-mt-24 border-t border-line bg-void py-14 sm:py-20">
      <div className="container-page flex flex-col items-start gap-6">
        <SectionHeading title="Write your first blueprint" lead="Follow a small task from an idea to a folder in Claude Code or Codex." />
        <ol aria-label="The four steps of the tutorial" className="grid w-full gap-4 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.index} className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs text-blueprint-line">
                {step.index}
              </span>
              {step.label}
            </li>
          ))}
        </ol>
        <ButtonLink href="/tutorial" size="lg">Write your first blueprint <span aria-hidden>→</span></ButtonLink>
        <p className="text-sm text-dim">No account needed to start. Sign in to publish, public or private.</p>
      </div>
    </section>
  );
}
