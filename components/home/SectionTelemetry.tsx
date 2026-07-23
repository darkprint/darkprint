import { SectionHeading } from "@/components/ui/SectionHeading";

type Panel = {
  id: string;
  label: string;
  glyph: string;
  color: string;
  title: string;
  body: string;
  points: string[];
};

const PANELS: Panel[] = [
  {
    id: "telemetry",
    label: "Telemetry · opt-in",
    glyph: "⇡",
    color: "var(--color-amber)",
    title: "Your runs sharpen the scores",
    body: "Run a blueprint locally and choose to send back run metrics — cost, latency, pass/fail. It is explicit opt-in and off by default; nothing leaves your machine unless you say so. In return, your executions feed the measured Cost/time axis everyone sees.",
    points: ["Off by default", "Run metrics only, no payloads", "Earns reputation points"],
  },
  {
    id: "validators",
    label: "Validators · earned",
    glyph: "✓",
    color: "var(--color-violet)",
    title: "Votes that carry weight",
    body: "A validator badge is earned through a track record, not bought. It weights your votes more heavily on the community axes — efficacy, reliability, transparency — so the people who actually run factories move the scores. It can also unlock early access to premium features.",
    points: ["Earned, not purchased", "Higher vote weight", "Early access to premium"],
  },
];

export function SectionTelemetry() {
  return (
    <section id="telemetry" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="How the numbers stay honest"
          title="The people running factories set the scores"
          lead="A registry is only as trustworthy as its data. Two mechanisms keep DarkPrint's scores grounded in real usage rather than self-promotion — one for the measured half, one for the voted half."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PANELS.map((p) => (
            <article
              key={p.id}
              className="panel flex flex-col gap-4 p-6"
              style={{ borderTop: `2px solid ${p.color}` }}
            >
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
              <h3 className="font-display text-xl font-semibold text-fg">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{p.body}</p>
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
