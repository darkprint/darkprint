import type { Metadata } from "next";
import Link from "next/link";

import { allBlueprints } from "@/lib/content";
import { METRIC_SOURCE_META } from "@/lib/format";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /reading-the-radar — the scorecard, taken apart.

   The author, on the "What each row means" disclosure inside
   `MetricBars`: it "should be placed in a new page where the is
   the description how to read the radar chart. In such page I
   expect a random radar chart that get described in its
   components."

   ── Why a page and not a longer disclosure ──
   Every blueprint page draws this chart, and every one of them
   folded the same explanation of it behind the same summary. Nine
   copies of one lesson, none of them read, because a reader who
   has arrived at a blueprint is there for the blueprint. The
   lesson belongs once, where somebody who wants it can be sent.

   ── What this page is not ──
   It is not `/spec/scoring`. That page describes the *system*:
   every weight, both cuts, what fires a marker. This one describes
   the *picture*: five spokes, why autonomy is not one of them, and
   what the colour of a vertex tells you about where its number came
   from. A reader wanting the arithmetic is sent across.

   ── The chart is a real one ──
   A blueprint out of the archive, drawn by the same `ScoreRadar`
   the detail pages use, with its real metrics. An invented chart
   would be a picture of a scorecard that no blueprint has, on the
   one page whose subject is how to read the real thing.

   Static: no `generateStaticParams`, no `dynamicParams`, server
   component, no props (Next 16, `docs/01-app/03-api-reference/
   03-file-conventions/page.md`).
   ============================================================ */

export const metadata: Metadata = {
  title: "Reading the radar",
  description:
    "A blueprint's scorecard, taken apart: five spokes, why autonomy is not one of them, and what the colour of each vertex says about where its number came from.",
};

/** The blueprint whose card is drawn. Named, so the page says which one it is. */
const SAMPLE_SLUG = "starter-software-factory";

const LINK =
  "text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright";

function Callout({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 shrink-0 font-mono text-[11px] text-dim">{n}</span>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-base font-semibold text-fg">{title}</h3>
        <p className="text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}

export default function ReadingTheRadarPage() {
  const all = allBlueprints();
  const sample = all.find((bp) => bp.slug === SAMPLE_SLUG) ?? all[0];
  if (sample === undefined) return null;

  /* The five that get a spoke, and the one that does not. Both read off the card rather
     than listed here: a metric added to `MetricKey` would otherwise be described on every
     blueprint page and missing from the page explaining the drawing. */
  const spokes = sample.metrics.filter((m) => m.key !== "autonomy");
  const autonomyRow = sample.metrics.find((m) => m.key === "autonomy");
  const sources = [...new Set(spokes.map((m) => m.source))];

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="Reading the radar"
            title="What the scorecard is showing you"
            lead="Every blueprint page draws one of these. It has five spokes, a sixth reading that deliberately has none, and a colour on each vertex saying where that number came from."
          />
        </div>
      </header>

      <section className="border-t border-line bg-surface py-16">
        <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-14">
          <div className="flex flex-col gap-3">
            <div className="panel flex justify-center p-6">
              <ScoreRadar metrics={sample.metrics} size={300} />
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-dim">
              {sample.title}, drawn from its real card.{" "}
              <Link href={`/blueprints/${sample.slug}`} className={LINK}>
                Open the blueprint <span aria-hidden>→</span>
              </Link>
            </p>
          </div>

          <ol className="flex flex-col gap-7">
            <Callout n="01" title={`${spokes.length} spokes, one per scored axis`}>
              {spokes.map((m) => m.label).join(", ")}, each vertex at that axis&rsquo;s
              value on a 0 to 100 scale. A larger polygon is not a better blueprint, it is
              one that scores higher on these five.
            </Callout>

            {autonomyRow !== undefined && (
              <Callout n="02" title="Autonomy has no spoke, on purpose">
                Six readings, five spokes. Autonomy is a{" "}
                <span className="text-fg">name</span>, not a magnitude: this one is{" "}
                <span className="font-mono text-fg">{sample.autonomy.label}</span>. A spoke
                would invite a reader to grow it, and where a person acts is a decision, not
                a shortfall. It is printed beside the chart in words.
              </Callout>
            )}

            <Callout n="03" title="The colour of a vertex says where its number came from">
              Not all six are the same kind of fact, so the drawing does not pretend they
              are.
            </Callout>

            <li className="flex flex-col gap-2 pl-8">
              {sources.map((source) => {
                const meta = METRIC_SOURCE_META[source];
                return (
                  <div key={source} className="flex items-baseline gap-3 text-sm">
                    <span
                      aria-hidden
                      className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg">
                      {meta.label}
                    </span>
                    <span className="leading-relaxed text-muted">{meta.blurb}</span>
                  </div>
                );
              })}
            </li>

            <Callout n="04" title="What each row means">
              {/* Moved here from a `<More>` inside `MetricBars`, which drew it folded on
                  every blueprint page. */}
              The list below says what each axis is measuring, in this blueprint&rsquo;s
              own terms.
            </Callout>

            <li className="pl-8">
              <dl className="flex flex-col gap-3">
                {sample.metrics.map((m) => (
                  <div key={m.key}>
                    <dt className="text-xs font-medium text-fg">{m.label}</dt>
                    <dd className="mt-0.5 text-xs leading-snug text-dim">{m.detail}</dd>
                  </div>
                ))}
              </dl>
            </li>

            <Callout n="05" title="Where the numbers come from">
              This page is about the picture. The scale behind it, every weight, and what
              fires a risk marker are on{" "}
              <Link href="/spec/scoring" className={LINK}>
                How a blueprint is graded <span aria-hidden>→</span>
              </Link>
            </Callout>
          </ol>
        </div>
      </section>
    </>
  );
}
