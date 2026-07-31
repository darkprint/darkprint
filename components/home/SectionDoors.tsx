/* ============================================================
   Beat 5 of redesign spec §2, and rung 6 of doc 2 §2.1: two doors.

   "Due porte. *Sfoglia i blueprint* oppure *costruisci il tuo*."

   ── What came off, and why that is allowed ──
   Redesign spec §5 lets a page drop "prose that says the same thing
   a second time", and this section carried four paragraphs of it.
   The gallery door explained what a published bundle contains,
   which every blueprint page prints in full; the build door
   explained the three choices, which `/build` puts on the screen a
   reader is about to open; and the closing line pointed at
   `/which-tasks`, a route that has folded into
   `/towards-a-dark-factory` and is reachable from the nav.

   ── What stayed, and why it had to ──
   The line about where the guided path stops. Spec §0.4: nothing
   may be described as working that is not built, "say so wherever
   the question arises", and a door that says "build your own" is
   exactly where it arises. One sentence is enough to be honest;
   four were enough to lose the reader.

   The three counts stay because they are read off the archive at
   build time rather than written here, so they are the one thing on
   this beat a reader could check.

   And the line saying so stays with them. It went out with the four
   paragraphs and it was not one of them: "Counted off the archive on
   the last deploy, and nothing here is rounded up" is the claim that
   makes the three figures worth printing, and it was the only
   sentence on the site that made it. A number beside a door with
   nothing behind it is marketing.
   ============================================================ */

import { PLATFORM_STATS } from "@/lib/data";
import { ButtonLink } from "@/components/ui/Button";

const COUNTS: { value: number; label: string }[] = [
  { value: PLATFORM_STATS.blueprints, label: "blueprints" },
  { value: PLATFORM_STATS.nodes, label: "node cards" },
  { value: PLATFORM_STATS.terms, label: "ontology terms" },
];

function Door({
  title,
  line,
  href,
  cta,
  children,
}: {
  title: string;
  line: string;
  href: string;
  cta: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-blueprint-line/40 bg-blueprint/20 p-6 sm:p-8">
      <h3 className="font-display text-2xl font-semibold text-blueprint-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-blueprint-ink/85">{line}</p>
      {children}
      <div className="mt-auto pt-2">
        <ButtonLink href={href} variant="primary" size="lg">
          {cta}
        </ButtonLink>
      </div>
    </article>
  );
}

export function SectionDoors() {
  return (
    <section
      id="start"
      className="relative overflow-hidden bg-blueprint-deep py-24 sm:py-28"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bp-grid opacity-90" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 40%, color-mix(in oklab, var(--color-void) 55%, transparent) 100%)",
        }}
      />

      <div className="container-page relative">
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            className="font-mono text-[11px] uppercase tracking-[0.28em]"
            style={{ color: "var(--color-blueprint-line)" }}
          >
            darkprint.io
          </span>
          <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-blueprint-ink sm:text-5xl">
            Read one, or build one
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Door
            title="Browse the blueprints"
            line="Every graph is published as the files it runs from."
            href="/blueprints"
            cta="Open the gallery"
          >
            <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-blueprint-line/25 pt-4">
              {COUNTS.map((c) => (
                <div key={c.label}>
                  {/* The visible label is `aria-hidden` and the `dt` carries it instead,
                      so the pair is announced once as "blueprints, 9" rather than twice. */}
                  <dt className="sr-only">{c.label}</dt>
                  <dd className="flex items-baseline gap-1.5">
                    <span className="font-mono text-lg tabular-nums text-blueprint-ink">
                      {c.value}
                    </span>
                    <span
                      aria-hidden
                      className="font-mono text-[11px] uppercase tracking-[0.14em]"
                      style={{ color: "var(--color-blueprint-line)" }}
                    >
                      {c.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            {/* What the three figures are worth, in one line. `PLATFORM_STATS` counts
                `content/` at build time, so this is checkable rather than decorative. */}
            <p className="text-xs leading-relaxed text-blueprint-ink/70">
              Counted off the archive on the last deploy, and nothing here is rounded up.
            </p>
          </Door>

          <Door
            title="Build your own"
            line="An hour of choices, and a blueprint that downloads to your machine."
            href="/build"
            cta="Start the guided path"
          />
        </div>

        <p className="mt-8 text-center text-sm leading-relaxed text-blueprint-ink/80">
          The guided path ends at the download. There is nowhere to publish yet.
        </p>
      </div>
    </section>
  );
}
