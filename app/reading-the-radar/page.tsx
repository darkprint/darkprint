import type { Metadata } from "next";
import Link from "next/link";

import { allBlueprints } from "@/lib/content";
import { METRIC_SOURCE_META } from "@/lib/format";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { OnwardRoutes } from "@/components/ui/OnwardRoutes";

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
  extra,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
  /**
   * A figure belonging to this callout: the source legend under 03, the axis list under
   * 04. Both used to be bare `<li>`s of their own, so the `<ol>` held seven items while
   * the page printed five numbers — a screen reader said "item 5 of 7" where the page
   * said **04**, and every callout after 03 was announced at the wrong position. They
   * belong to the callout above them, so they sit inside it.
   */
  extra?: React.ReactNode;
}) {
  return (
    /* A plate note: the number is set large in the left gutter, the rule above it runs
       only as far as the text does, and the whole thing sits on one grid so the numeral
       and its title share a top edge.

       Three things this fixes, all of them visible only once rendered. The numeral was
       cyan, which in this palette means *interactive* — it is an ordinal, not a link, so
       it is `text-dim` now and earns its presence from size instead of hue. It sat 96px
       from its title with nothing bridging the gap; the gutter is 3rem and the baselines
       line up. And the rule ran the full 1152px container under a 62ch text column, so
       every divider advertised the empty third of the page — it is capped with the
       content now. */
    <li className="grid gap-x-6 gap-y-3 border-t border-line pt-8 sm:grid-cols-[3rem_minmax(0,1fr)]">
      <span className="font-mono text-2xl leading-none tabular-nums text-dim sm:pt-1">
        {n}
      </span>
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-semibold leading-snug text-fg">
          {title}
        </h3>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">{children}</p>
        {extra !== undefined && <div className="mt-2 max-w-[62ch]">{extra}</div>}
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

      {/* Plate first: the drawing IS the section, and the numbered notes below it are
          its annotations.
          ------------------------------------------------------------
          The chart used to sit in a 22rem left column beside the five callouts, drawn at
          302px — about 6% of the page — while the page's whole subject is reading it. The
          author asked for it "central to the page and below the descriptions"; shown both
          arrangements he chose this one, because a numbered annotation placed *above* the
          figure whose numerals it references is unreadable: a reader meets "01" with
          nothing on screen to look at, and callout 01's own text ("each vertex at that
          axis's value") means nothing before the vertices exist.

          So the lead sets it up in one sentence, the plate is drawn as wide as the
          container allows, and every note after it points at something already on screen.
          `render` tells `ScoreRadar` the width it will occupy so its geometry solves
          against that: labels stay at 11px and the polygon takes 88% of the box rather
          than 58%. */}
      <section aria-labelledby="the-plate" className="border-t border-line bg-surface py-16 sm:py-24">
        <div className="container-page flex flex-col gap-6">
          <div className="flex max-w-[62ch] flex-col gap-3">
            {/* Display register, not the 13px mono panel-label one: the notes below are
                `h3`s at 20px, and a 13px `h2` above them inverts the scale. Mono labels
                name a panel; this names a section. */}
            <h2
              id="the-plate"
              className="font-display text-2xl font-semibold leading-snug text-fg"
            >
              One real scorecard
            </h2>
            <p className="text-[15px] leading-relaxed text-muted">
              This is {sample.title}, drawn from its own card by the same component every
              blueprint page uses. Everything below points at something on it.
            </p>
          </div>

          {/* Two placements, because one solve cannot serve both widths.
              `ScoreRadar`'s geometry is solved against the CSS width it will occupy: pad
              and label size fall out of that one number together. Shipping a single
              desktop solve put the labels at 3.13 CSS px on a 378px phone, which is the
              same class of defect this component was just fixed for, arrived at from the
              other side. `SectionRoles` already solves this by drawing a narrow frame and
              a wide one and letting a media query choose; this is that. */}
          <figure className="panel bp-grid flex flex-col items-center gap-4 px-4 py-10 sm:px-10 sm:py-14">
            <div className="w-full sm:hidden">
              <ScoreRadar metrics={sample.metrics} size={300} render={285} plate />
            </div>
            {/* 480px, not the full 1070 the container allows. Drawn edge to edge the
                chart was simply too big — a five-spoke polygon does not gain anything
                past a few hundred pixels, and at container width it stopped reading as a
                figure on a page and started reading as the page. The plate stays full
                width; the drawing sits centred inside it with air around it, which is
                what makes it read as the subject rather than as wallpaper. */}
            <div className="hidden w-full max-w-[480px] sm:block">
              <ScoreRadar metrics={sample.metrics} size={300} render={480} plate />
            </div>
            <figcaption className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 font-mono text-[11px] text-dim">
              <span>{sample.title}</span>
              <Link href={`/blueprints/${sample.slug}`} className={LINK}>
                Open the blueprint <span aria-hidden>&rarr;</span>
              </Link>
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="the-notes" className="bg-surface pb-20">
        <div className="container-page flex flex-col gap-10">
          <h2 id="the-notes" className="sr-only">
            What each part of it means
          </h2>
          <ol className="flex max-w-[52rem] flex-col gap-10">
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
                a shortfall. It is printed under the chart in words, not drawn on it.
              </Callout>
            )}

            <Callout
              n="03"
              title="The colour of a vertex says where its number came from"
              extra={
                /* Each source names the axes that carry it, in its own colour — the same
                   colour those axis names are drawn in on the chart above. The legend
                   used to say "cyan means static analysis" and stop, which left the
                   reader to match a hue against five small vertices and work out for
                   themselves which axis was which. Naming them here makes the legend
                   readable without looking away, and looking up finds the same words in
                   the same colour.

                   It sits on the same two-column grid and the same 8px swatch as 04's list
                   below, because the two are the same six metrics cut two ways — by source
                   here, by name there. Set differently they read as two unrelated blocks
                   and the reader has to work out that "Efficacy" in one is "Efficacy" in
                   the other. Same track, same dot, same hairline: one system, two views. */
                <dl className="flex flex-col">
                  {sources.map((source) => {
                    const meta = METRIC_SOURCE_META[source];
                    const carried = spokes.filter((m) => m.source === source);
                    return (
                      <div
                        key={source}
                        className="grid gap-x-4 gap-y-1.5 border-t border-line/70 py-3 first:border-t-0 first:pt-0 sm:grid-cols-[11rem_minmax(0,1fr)]"
                      >
                        <dt
                          className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.14em]"
                          style={{ color: meta.color }}
                        >
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
                            style={{ background: meta.color }}
                          />
                          {meta.label}
                        </dt>
                        <dd className="flex flex-col gap-1.5">
                          <span className="font-mono text-[11px]" style={{ color: meta.color }}>
                            {carried.length === 0
                              ? "no axis on this chart"
                              : carried.map((m) => m.label).join("  ·  ")}
                          </span>
                          <span className="text-sm leading-relaxed text-muted">{meta.blurb}</span>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              }
            >
              Not all six are the same kind of fact, so the drawing does not pretend they
              are.
            </Callout>

            <Callout
              n="04"
              title="What each row means"
              extra={
                /* Row-separated, and every row carries its source colour.
                   ------------------------------------------------------------
                   This was six `text-xs` pairs stacked on a 12px gap: a 12px name over a
                   12px detail in `text-dim`, under a 20px heading. The densest block on the
                   page was set at its smallest size, dt and dd were near enough the same
                   weight to merge, and nothing separated one metric from the next, so six
                   definitions read as one grey paragraph.

                   It is also the third list of the same six metrics on this page, after
                   the chart's axis labels and 03's legend. The other two are colour-coded
                   by source; this one was not, so a reader who had just learned that violet
                   means a vote found the word "Efficacy" here in plain grey. The swatch is
                   the same 8px dot 03 uses, so the three lists are one system. */
                <dl className="flex flex-col">
                  {sample.metrics.map((m) => (
                    <div
                      key={m.key}
                      className="grid gap-x-4 gap-y-1 border-t border-line/70 py-3 first:border-t-0 first:pt-0 sm:grid-cols-[11rem_minmax(0,1fr)]"
                    >
                      <dt className="flex items-baseline gap-2 text-[13px] font-medium text-fg">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
                          style={{ background: METRIC_SOURCE_META[m.source].color }}
                        />
                        {m.label}
                      </dt>
                      <dd className="text-sm leading-relaxed text-muted">{m.detail}</dd>
                    </div>
                  ))}
                </dl>
              }
            >
              {/* Moved here from a `<More>` inside `MetricBars`, which drew it folded on
                  every blueprint page. */}
              The list below says what each axis is measuring, in this blueprint&rsquo;s
              own terms.
            </Callout>

            <Callout n="05" title="Where the numbers come from">
              This page is about the picture. The scale behind it, every weight, and what
              fires a risk marker are on{" "}
              <Link href="/spec/scoring" className={LINK}>
                How a blueprint is graded <span aria-hidden>→</span>
              </Link>
            </Callout>
          </ol>

          {/* The return trip. This page's own header comment says a reader wanting the
              arithmetic "is sent across" to the grading page; that page is last in its
              sequence, so its only tail box is `← Previous` and the link back here did
              not exist. */}
          <OnwardRoutes
            className="mt-10"
            routes={[
              {
                href: "/spec/scoring",
                label: "How a blueprint is graded",
                blurb: "The weights behind the picture, and what fires a risk marker.",
              },
              {
                href: "/blueprints",
                label: "The blueprint gallery",
                blurb: "Nine scorecards to read the chart against.",
              },
            ]}
          />
        </div>
      </section>
    </>
  );
}
