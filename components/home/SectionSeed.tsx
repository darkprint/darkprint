import { shortDigest } from "@/lib/core";
import { SEED_BLUEPRINTS } from "@/lib/data";
import { ContentCard } from "@/components/ui/ContentCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** One-line framing for each seed blueprint — why the problem is genuinely hard. */
const HARD_PART: Record<string, string> = {
  "adversarial-consensus-line": "When two competent agents disagree",
  "checkpoint-resume-runner": "When a stage fails halfway through",
};

export function SectionSeed() {
  if (SEED_BLUEPRINTS.length === 0) return null;

  return (
    <section id="examples" className="bg-void py-20 sm:py-28">
      <div className="container-page">
        {/* Doc 2 §1.1 — the band is descriptive, so nothing on the site may frame it as
            something to deserve. The lead used to open "A factory earns its autonomy",
            which is the qualitative reading the principle rules out and which the
            autonomy section further up the same page explicitly denies ("Nothing on
            DarkPrint ranks, badges or rewards a blueprint for the band it lands in").
            What these two blueprints actually demonstrate is a design problem, so that
            is what the sentence says. */}
        <SectionHeading
          eyebrow="The two seed blueprints"
          title="Where naive pipelines break"
          lead="Anyone can chain a few agents when everything goes right. The two moments that wreck a happy-path pipeline are a disagreement and a mid-run failure, and both of these graphs are built around one of them. They ship as real bundles: a DOT topology, a pinned card per node, and a content digest over the lot."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {SEED_BLUEPRINTS.map((bp) => (
            <div key={bp.slug} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
              <p className="font-mono text-[11px] text-dim">
                {bp.cardRefs.length} pinned card{bp.cardRefs.length === 1 ? "" : "s"} ·{" "}
                {shortDigest(bp.digest)}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
          Every score on both cards was computed off those files at build time, and both
          detail pages show the working — which nodes were counted, which points were
          taken off, and the finding behind each one. What you cannot do from here is run
          them: execution is not built, so the archive is something to read, audit and
          copy rather than something to press play on.
        </p>
      </div>
    </section>
  );
}
