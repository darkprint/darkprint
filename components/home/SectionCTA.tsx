import { ButtonLink } from "@/components/ui/Button";

export function SectionCTA() {
  return (
    <section id="start" className="relative overflow-hidden bg-blueprint-deep py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 bp-grid opacity-90" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 40%, color-mix(in oklab, var(--color-void) 55%, transparent) 100%)",
        }}
      />
      <div className="container-page relative flex flex-col items-center gap-7 text-center">
        <span
          className="font-mono text-[11px] uppercase tracking-[0.28em]"
          style={{ color: "var(--color-blueprint-line)" }}
        >
          darkprint.io
        </span>
        <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-blueprint-ink sm:text-5xl">
          Share the blueprint of your dark factory
        </h2>
        <p className="max-w-xl text-lg leading-relaxed" style={{ color: "var(--color-blueprint-line)" }}>
          The blueprint registry for autonomous AI factories. Autonomy you can read as a graph —
          publish your pipeline, get it scored, and pull proven parts from the registry.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/gallery" variant="primary" size="lg">
            Explore the gallery
          </ButtonLink>
          <ButtonLink href="/upload" variant="outline" size="lg">
            Share a blueprint
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
