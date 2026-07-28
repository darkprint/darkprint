/* ============================================================
   Rung 6 of doc 2 §2.1 — the two doors.

   "Due porte. *Sfoglia i blueprint* oppure *costruisci il tuo*."

   The second door points at the guided path (§5), which now exists
   at `/build`. The status token stays, because the register is what
   the rest of the site uses for the difference between designed and
   built, and the door still has something to be honest about: the
   path is live and it stops at the download, since accounts and
   publishing (§6) are Fase 4. Saying so on the door beats letting a
   reader find out an hour in.

   The counters are the three things counted off the real archive at
   build time. The seeded pair that used to sit beside them (builders,
   pulls) needed a paragraph of disclaimer to be honest, which is a
   poor trade for a number nobody came here for.
   ============================================================ */

import Link from "next/link";
import { PLATFORM_STATS } from "@/lib/data";
import { ButtonLink } from "@/components/ui/Button";

const STARTER = "/blueprints/starter-software-factory";

const COUNTS: { value: number; label: string }[] = [
  { value: PLATFORM_STATS.blueprints, label: "blueprints" },
  { value: PLATFORM_STATS.nodes, label: "node cards" },
  { value: PLATFORM_STATS.terms, label: "ontology terms" },
];

/** Glyph and word both, never a colour on its own. */
function Status({ glyph, word }: { glyph: string; word: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blueprint-line/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-blueprint-line">
      <span aria-hidden>{glyph}</span>
      {word}
    </span>
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
          <p
            className="max-w-xl text-lg leading-relaxed"
            style={{ color: "var(--color-blueprint-line)" }}
          >
            Specifications go in. Software comes out. The part you have to design is
            everything in between.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {/* ---------- door one ---------- */}
          <article className="flex flex-col gap-4 rounded-lg border border-blueprint-line/40 bg-blueprint/20 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-semibold text-blueprint-ink">
                Browse the blueprints
              </h3>
              <Status glyph="✓" word="live" />
            </div>
            <p className="text-sm leading-relaxed text-blueprint-ink/85">
              Every graph in the gallery is published as its files: a DOT topology, one
              pinned card per node, and a digest over the lot. Both computed scores print
              the arithmetic and name the nodes behind it, so a reader can check either
              number against the source on the page. The files come down one at a time;
              there is no bundle archive to fetch yet.
            </p>
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
            <p className="text-xs leading-relaxed text-blueprint-ink/70">
              Counted off the archive on the last deploy, and nothing here is rounded up.
            </p>
            <div className="mt-auto pt-2">
              <ButtonLink href="/blueprints" variant="primary" size="lg">
                Open the gallery
              </ButtonLink>
            </div>
          </article>

          {/* ---------- door two ---------- */}
          <article className="flex flex-col gap-4 rounded-lg border border-blueprint-line/40 bg-blueprint/20 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-semibold text-blueprint-ink">
                Build your own
              </h3>
              <Status glyph="✓" word="live" />
            </div>
            <p className="text-sm leading-relaxed text-blueprint-ink/85">
              The guided path takes about an hour and ends with a dark factory of your own,
              downloaded and runnable on your machine. You start from the five-node starter,
              take it apart, and make three choices that stay in the artefact. Both computed
              scores move with the graph while you work, on the exact bytes you download.
            </p>
            <p className="border-l-2 border-blueprint-line/50 pl-4 text-sm leading-relaxed text-blueprint-ink/85">
              It ends at the download. There is nowhere to save a blueprint yet: accounts
              and publishing are designed and neither is built, so nothing you make there
              leaves your machine. The same validator runs on files you drop into it, if you
              would rather point it at a graph you already have.
            </p>
            <div className="mt-auto flex flex-wrap gap-3 pt-2">
              <ButtonLink href="/build" variant="primary" size="lg">
                Start the guided path
              </ButtonLink>
              <ButtonLink href={STARTER} variant="outline" size="lg">
                Open the starter blueprint
              </ButtonLink>
              <ButtonLink href="/upload" variant="outline" size="lg">
                Validate a bundle
              </ButtonLink>
            </div>
          </article>
        </div>

        <p className="mt-8 text-center text-sm leading-relaxed text-blueprint-ink/80">
          Before you point one at real work, it is worth knowing what these are bad at.{" "}
          <Link
            href="/which-tasks"
            className="text-blueprint-ink underline decoration-blueprint-line/60 underline-offset-4 transition-colors hover:decoration-blueprint-ink"
          >
            Which tasks fit a dark factory
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
