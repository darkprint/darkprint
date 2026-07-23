import { SEED_BLUEPRINTS } from "@/lib/data";
import { ContentCard } from "@/components/ui/ContentCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** One-line framing for each seed blueprint — why the problem is genuinely hard. */
const HARD_PART: Record<string, string> = {
  "adversarial-consensus-line": "When two competent agents disagree",
  "checkpoint-resume-runner": "When a stage fails halfway through",
};

export function SectionSeed() {
  return (
    <section id="examples" className="bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The two seed blueprints"
          title="Where naive pipelines break"
          lead="Anyone can chain a few agents when everything goes right. A factory earns its autonomy on the two moments that wreck a happy-path pipeline — a disagreement, and a mid-run failure. These are the reference blueprints we ship."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {SEED_BLUEPRINTS.map((bp) => (
            <div key={bp.slug} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.16em]"
                  style={{ color: "var(--color-amber)" }}
                >
                  The hard part
                </span>
                <span className="font-mono text-xs text-muted">
                  · {HARD_PART[bp.slug] ?? bp.category}
                </span>
              </div>
              <ContentCard item={bp} className="h-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
