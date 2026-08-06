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
   The line about where `/build` stops. Spec §0.4: nothing
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

   ── Why the second door now carries figures too ──
   `md:grid-cols-2` stretches both cells to the taller one and
   `Door`'s `mt-auto` pins the button to the floor, so a door with no
   children is not a shorter card: it is the same card with ~112px of
   void in the middle of it. Measured inside the 305px cell it used
   to be, the gallery door ran h3, line, counts, caption, CTA and the
   build door ran h3, line, nothing, nothing, CTA. The reader is at the one
   decision point on the landing, and the option with no evidence
   under it reads as the lesser one or as the unfinished one — which
   is backwards, because `/build` is the path that works end to end
   today and the gallery is the one that only reads.

   So the build door states its own shape in the same register: three
   figures and a line saying what they buy. They are not counted off
   disk the way `PLATFORM_STATS` is, and the constant below records
   where each one is read from so a change to the path is a failing
   grep rather than a stale number.

   ── And the limit statement moved into it ──
   "The workspace ends at the download. There is nowhere to publish
   yet." hung under the two-column grid, centred, attached to
   neither door. It is about the build door specifically. A sentence
   that qualifies one of two options and is printed under both of
   them qualifies the wrong one half the time, so it sits inside the
   door it is about, in the same caption register as the gallery
   door's own qualifier. Verbatim; spec §0.4 is why it exists.
   ============================================================ */

import { PLATFORM_STATS } from "@/lib/data";
import { ButtonLink } from "@/components/ui/Button";

const COUNTS: { value: number; label: string }[] = [
  { value: PLATFORM_STATS.blueprints, label: "blueprints" },
  { value: PLATFORM_STATS.nodes, label: "node cards" },
  { value: PLATFORM_STATS.terms, label: "ontology terms" },
];

/**
 * What `/build` is, in three figures — the build door's answer to `COUNTS`.
 *
 * Written here rather than imported, and each one says where it is read from. The choice
 * groups and the enumeration live in `components/build/`, which is `"use client"` and pulls
 * `lib/core` and `lib/starter` behind it; importing them for three integers would put the
 * whole authoring surface in the landing's bundle and in `beats.test.ts`'s render. The
 * comments are the check: all three are one grep away.
 *
 * The first figure used to be "8 steps", read off a `STEPS` table that no longer exists:
 * `/build` is one workspace now and the eight-step path was deleted with it. What replaced
 * it is the figure that survived the restructure unchanged, because it is a property of the
 * generator rather than of the page drawn over it.
 */
const PATH: { value: number; label: string }[] = [
  /* components/build/choices.ts, the three controls under the stage: the output kind, the
     approval mode, the iteration cap. */
  { value: 3, label: "choices" },
  /* `ALL_COMBINATIONS` in components/build/choices.ts: 4 output kinds × 2 approval modes ×
     10 caps, every one of which app/build/page.tsx resolves through the engine at build
     time. */
  { value: 80, label: "combinations" },
  /* `exportBundle` writes one folder, whatever the eighty combinations resolve to. */
  { value: 1, label: "bundle" },
];

/**
 * The figures row, as one component rather than as two copies of it.
 *
 * The whole point of this pass is that the two doors present evidence in the same
 * register; two hand-typed rows drift the first time one of them is touched, and the
 * drift is invisible until somebody puts the cards side by side, which is the state this
 * replaced. One component means "same register" is a property of the code.
 */
function Figures({ items }: { items: readonly { value: number; label: string }[] }) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-blueprint-line/25 pt-4">
      {items.map((item) => (
        <div key={item.label}>
          {/* The visible label is `aria-hidden` and the `dt` carries it instead,
              so the pair is announced once as "blueprints, 9" rather than twice. */}
          <dt className="sr-only">{item.label}</dt>
          <dd className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg tabular-nums text-blueprint-ink">
              {item.value}
            </span>
            <span
              aria-hidden
              className="font-mono text-[11px] uppercase tracking-[0.14em]"
              style={{ color: "var(--color-blueprint-line)" }}
            >
              {item.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** What the figures above it are worth. One line, under the row it qualifies. */
function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-blueprint-ink/70">{children}</p>;
}

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
      className="relative overflow-hidden bg-blueprint-deep py-20 sm:py-28"
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
        {/* A `darkprint.io` mono strip stood above this heading and is gone. A domain name
            is not a section label: it names the site a reader is already on, on the one
            band that needs no naming — the cyanotype ground is a register nothing else on
            the landing uses, and that is what says "this is the end of the argument". It
            was also the site's only instance of 0.28em tracking, and the mono eyebrow is
            rationed to one per page or per full-bleed band. */}
        <div className="flex flex-col items-center text-center">
          <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-blueprint-ink sm:text-5xl">
            Read one, or build one
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Door
            title="Browse the blueprints"
            line="Every graph is published as the files it runs from."
            href="/blueprints"
            cta="Open the gallery"
          >
            <Figures items={COUNTS} />
            {/* What the three figures are worth, in one line. `PLATFORM_STATS` counts
                `content/` at build time, so this is checkable rather than decorative. */}
            <Caption>
              Counted off the archive on the last deploy, and nothing here is rounded up.
            </Caption>
          </Door>

          <Door
            title="Build your own"
            line="Three choices, and a blueprint that downloads to your machine."
            href="/build"
            cta="Open the workspace"
          >
            <Figures items={PATH} />
            {/* What the three choices hand over. The gallery door's caption says its figures
                are exact; this one says what its figures produce, which is the equivalent
                question for a workspace rather than an archive. */}
            <Caption>A .dot topology, the cards it pins, and a README you can run.</Caption>
            {/* Spec §0.4, moved here from under the grid. It qualifies this door and only
                this one, and a sentence centred under two columns attaches to neither. */}
            <Caption>
              The workspace ends at the download. There is nowhere to publish yet.
            </Caption>
          </Door>
        </div>
      </div>
    </section>
  );
}
