import { DARKPRINT_CONFIG } from "@/lib/core";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * The two filters doc 1 §8 puts on a reported figure, read out of the engine's own
 * frozen config rather than typed into the copy — the same discipline the scoring
 * section uses for the security weights, so a re-calibration cannot leave this page
 * quoting a threshold nothing enforces.
 */
const { minRuns, outlierZScore } = DARKPRINT_CONFIG.telemetry;

type Panel = {
  id: string;
  label: string;
  glyph: string;
  color: string;
  title: string;
  /** Glyph + word, so "not built" never rides on a colour alone. */
  status: { glyph: string; word: string; color: string };
  /** What the mechanism is for. */
  body: string;
  /** What actually exists today. */
  reality: string;
  points: string[];
};

const NOT_BUILT = {
  glyph: "○",
  word: "not built",
  color: "var(--color-dim)",
};

const PANELS: Panel[] = [
  {
    id: "telemetry",
    label: "Telemetry · opt-in",
    glyph: "⇡",
    color: "var(--color-amber)",
    title: "Where the reported half is meant to come from",
    status: NOT_BUILT,
    body: "Cost and time are the two axes no analyzer can read off a drawing — somebody has to run the thing, and they run it on their own machine. DarkPrint never watches that happen, so these two are reported rather than measured, and the interface says reported. The design is explicit opt-in: run a blueprint locally, choose to send back run metrics — cost, latency, pass or fail, and which model — and nothing else.",
    reality:
      "None of it is wired up. There is no runner, no endpoint, and nothing on this site has ever phoned home. No blueprint here has a single reported run behind it, so the Cost / time bar on every scorecard is a seeded placeholder with 0 runs, no spread and no model — and it says so on the card rather than showing an average nobody produced.",
    points: [
      "Reported by the runner, not measured here",
      "Run count and spread, never a bare mean",
      `Under ${minRuns} runs reads as a sample, not a score`,
      `Outliers past ${outlierZScore}σ dropped before averaging`,
      "The model named beside the figure, or it compares nothing",
      "Opt-in and off by default; run metrics only, never payloads",
    ],
  },
  {
    id: "validators",
    label: "Validators · earned",
    glyph: "✓",
    color: "var(--color-violet)",
    title: "Where the voted half is meant to come from",
    status: NOT_BUILT,
    body: "Efficacy, reliability and transparency are judgement calls, so the design weights them by track record rather than by headcount: a validator badge is earned through real runs, not bought, and it makes a vote count for more on exactly those three axes. The people who actually operate factories move the scores.",
    reality:
      "Nothing votes yet. There is no ballot, no reputation that accrues and no badge to earn — the validator marks on the author chips are seeded, and so are the three community scores they would weight.",
    points: [
      "Earned, not purchased",
      "Higher vote weight, by design",
      "No ballot and no reputation yet",
    ],
  },
];

export function SectionTelemetry() {
  return (
    <section id="telemetry" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The half a graph can't tell you"
          title="Four of the six metrics need a real run"
          lead="Autonomy and security fall out of the drawing. The other four cannot: they need somebody to execute the factory and somebody to judge what came out. Since execution happens on that somebody's machine, the platform can only ever be told the result — so cost and time are reported figures, and they carry the run count, the spread and the model that make a report worth reading. Both mechanisms below are designed and neither is built, said plainly here rather than dressed up as a feature, because a registry that lies about its own data is worth nothing."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PANELS.map((p) => (
            <article
              key={p.id}
              className="panel flex flex-col gap-4 p-6"
              style={{ borderTop: `2px solid ${p.color}` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-xl"
                    style={{
                      color: p.color,
                      backgroundColor: `color-mix(in oklab, ${p.color} 14%, transparent)`,
                    }}
                  >
                    {p.glyph}
                  </span>
                  <span
                    className="font-mono text-[11px] uppercase tracking-[0.16em]"
                    style={{ color: p.color }}
                  >
                    {p.label}
                  </span>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: p.status.color }}
                >
                  <span aria-hidden>{p.status.glyph}</span>
                  {p.status.word}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold text-fg">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{p.body}</p>
              <p className="border-l-2 border-line-bright pl-4 text-sm leading-relaxed text-dim">
                {p.reality}
              </p>
              <ul className="mt-1 flex flex-col gap-2 border-t border-line pt-4">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-2 text-sm text-muted">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                    {pt}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
