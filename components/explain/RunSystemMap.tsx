import {
  BlueprintGraph,
  LAYERS,
  RubricGlyph,
  TONE,
} from "@/components/explain/RunLayers";

function Relation({ label, vertical = false }: { label: string; vertical?: boolean }) {
  return (
    <div
      aria-hidden
      className={
        vertical
          ? "flex items-center justify-center gap-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-dim"
          : "flex items-center justify-center gap-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-dim sm:flex-col sm:py-0"
      }
    >
      {vertical ? (
        <>
          <span className="text-cyan">↓</span>
          {label}
        </>
      ) : (
        <>
          <span className="sm:hidden">→</span>
          <span>{label}</span>
          <span className="hidden text-cyan sm:inline">→</span>
        </>
      )}
    </div>
  );
}

function EvalGlyph() {
  return (
    <div aria-hidden className="mt-4 grid grid-cols-3 gap-2">
      {["run 01", "run 02", "run 03"].map((run, index) => (
        <div key={run} className="rounded border border-violet/25 bg-void/45 p-2">
          <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-dim">
            {run}
          </span>
          <span className="mt-2 block h-1.5 rounded-full bg-violet/20">
            <span
              className="block h-full rounded-full bg-violet/75"
              style={{ width: `${[76, 61, 84][index]}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Explicitly shows what runs what, and what grades the resulting runs. */
export function RunSystemMap() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-start lg:gap-12">
      <figure className="rounded-xl border border-line bg-surface/45 p-4 sm:p-6">
        <div className="grid items-stretch sm:grid-cols-[minmax(0,1fr)_4.75rem_minmax(0,1fr)]">
          <section className="bp-grid rounded-lg border border-blueprint-line/55 bg-blueprint-deep/60 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="label text-blueprint-line">Blueprint</h3>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-blueprint-ink/65">
                specification
              </span>
            </div>
            <div className="mt-3 flex min-h-28 items-center justify-center">
              <BlueprintGraph />
            </div>
          </section>

          <Relation label="loaded by" />

          <section className="rounded-lg border border-fg/35 bg-fg/5 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="label-lead">Harness</h3>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                runtime
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Runs the loop and owns the live state.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["dispatch", "context", "state"].map((item) => (
                <span
                  key={item}
                  className="rounded border border-line bg-void/55 px-2 py-2 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-fg"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>

          <div className="hidden sm:block" />
          <div className="hidden sm:block" />
          <Relation label="run evidence" vertical />

          <section className="rounded-lg border border-emerald/35 bg-emerald/5 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="label text-emerald">Rubric</h3>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                criteria
              </span>
            </div>
            <div className="mt-4 text-emerald">
              <RubricGlyph />
            </div>
          </section>

          <Relation label="scores" />

          <section className="rounded-lg border border-violet/40 bg-violet/5 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="label text-violet">Eval</h3>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                aggregate
              </span>
            </div>
            <EvalGlyph />
          </section>
        </div>

        <figcaption className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-muted">
          The blueprint is loaded by a harness. The harness produces run evidence; an eval
          applies the rubric to that evidence. DarkPrint publishes only the blueprint.
        </figcaption>
      </figure>

      <ol className="flex min-w-0 flex-col divide-y divide-line">
        {LAYERS.map((layer) => {
          const tone = TONE[layer.id];
          return (
            <li key={layer.id} className="py-4 first:pt-0">
              <div className="border-l-2 pl-4" style={{ borderColor: tone.accent }}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-mono text-[13px]" style={{ color: tone.accent }}>
                    {layer.id}
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                    {layer.role}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: tone.ink }}>
                  {layer.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
