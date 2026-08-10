import { ButtonLink } from "@/components/ui/Button";

export function SectionDoors() {
  return (
    <section id="start" className="relative overflow-hidden bg-blueprint-deep py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 bp-grid opacity-90" />
      <div className="container-page relative">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-blueprint-line">
            Start with the job in front of you
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-blueprint-ink sm:text-5xl">
            Find a proven shape, or make the one you need
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="flex flex-col rounded-lg border border-blueprint-line/40 bg-blueprint/20 p-6 sm:p-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-blueprint-line">Find and reuse</span>
            <h3 className="mt-3 font-display text-2xl font-semibold text-blueprint-ink">Start from a task</h3>
            <p className="mt-3 text-sm leading-relaxed text-blueprint-ink/85">
              Search by what you need done, inspect the graph and static findings, then take
              an exact release to adapt on your machine.
            </p>
            <div className="mt-6">
              <ButtonLink href="/blueprints" variant="primary" size="lg">Find a blueprint</ButtonLink>
            </div>
          </article>

          <article className="flex flex-col rounded-lg border border-blueprint-line/40 bg-blueprint/20 p-6 sm:p-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-blueprint-line">Create and publish</span>
            <h3 className="mt-3 font-display text-2xl font-semibold text-blueprint-ink">Start from your goal</h3>
            <p className="mt-3 text-sm leading-relaxed text-blueprint-ink/85">
              Let your agent interview you into a bundle, validate it locally, and prepare a
              versioned release for the registry.
            </p>
            <div className="mt-6">
              {/* `/skill` since the `/build` split: the door promises an interview into a
                  bundle, and the interview is the authoring skill. */}
              <ButtonLink href="/skill" variant="primary" size="lg">Create a blueprint</ButtonLink>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
