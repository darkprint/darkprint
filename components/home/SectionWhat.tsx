import { PLATFORM_STATS } from "@/lib/data";
import { compact } from "@/lib/format";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stat } from "@/components/ui/Stat";

type Trait = {
  id: string;
  glyph: string;
  color: string;
  tag: string;
  title: string;
  body: string;
};

const TRAITS: Trait[] = [
  {
    id: "decision-autonomy",
    glyph: "◆",
    color: "var(--color-cyan)",
    tag: "no checkpoints",
    title: "Decision autonomy",
    body: "No human-approval checkpoints sit on the critical path. When a run hits an error, the factory decides how to recover and keeps moving — it makes the judgement call instead of stopping to ask.",
  },
  {
    id: "closed-loop",
    glyph: "↻",
    color: "var(--color-emerald)",
    tag: "plan · execute · verify · ship",
    title: "A closed loop",
    body: "Agents plan, execute, verify and ship on their own. There is no fixed script to march through — the loop closes only when the work clears its own acceptance criteria, and re-opens when it doesn't.",
  },
  {
    id: "spec-over-code",
    glyph: "❯",
    color: "var(--color-violet)",
    tag: "specs, not lines",
    title: "Specs over code",
    body: "The engineer stops writing code line by line and starts writing specs and acceptance criteria. The leverage moves up a level — and so does the debt: technical debt becomes specification debt.",
  },
];

type StatItem = { key: string; value: React.ReactNode; label: string; accent: string };

const STATS: StatItem[] = [
  { key: "blueprints", value: PLATFORM_STATS.blueprints, label: "Blueprints", accent: "var(--color-cyan)" },
  { key: "parts", value: PLATFORM_STATS.parts, label: "Parts", accent: "var(--color-amber)" },
  { key: "ontologies", value: PLATFORM_STATS.ontologies, label: "Ontologies", accent: "var(--color-violet)" },
  { key: "builders", value: PLATFORM_STATS.builders, label: "Builders", accent: "var(--color-emerald)" },
  { key: "downloads", value: compact(PLATFORM_STATS.downloads), label: "Pulls", accent: "var(--color-cyan-bright)" },
];

export function SectionWhat() {
  return (
    <section id="what" className="relative overflow-hidden bg-void py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 tech-grid opacity-70"
        style={{ maskImage: "linear-gradient(to bottom, black, transparent 78%)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent 78%)" }}
      />
      <div className="container-page relative">
        <SectionHeading
          eyebrow="The premise"
          title="A dark factory runs with the lights off"
          lead="A plant so automated it needs no lights — no workers on the floor, only machines running themselves. Ported to AI, it's a pipeline where autonomous agents own the whole arc, from plan to ship, without a human standing over each step."
        />

        <div className="mt-6 max-w-3xl border-l-2 border-cyan/50 pl-5">
          <p className="text-sm leading-relaxed text-muted">
            Ordinary automation follows a script and stops at every branch it wasn&apos;t told about.
            A dark factory is different on three counts — and each one is what makes it worth reading
            as a graph rather than trusting as a black box.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TRAITS.map((t) => (
            <article
              key={t.id}
              className="panel tick-frame relative flex flex-col gap-4 p-6"
              style={{ color: t.color }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-lg"
                  style={{ backgroundColor: `color-mix(in oklab, ${t.color} 14%, transparent)` }}
                >
                  {t.glyph}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-80">
                  {t.tag}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold text-fg">{t.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{t.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-8 border-t border-line pt-8">
          {STATS.map((s) => (
            <Stat key={s.key} value={s.value} label={s.label} accent={s.accent} />
          ))}
        </div>
      </div>
    </section>
  );
}
