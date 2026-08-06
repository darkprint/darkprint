import type { Metadata } from "next";

import { allBlueprints } from "@/lib/content";
import type { MetricSource } from "@/lib/types";
import { cx } from "@/lib/format";
import { ScoringModel } from "@/components/spec/ScoringModel";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SourceBadge } from "@/components/ui/Badge";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Sheet } from "@/components/viz";

/* ============================================================
   /spec/scoring — how the radar's six axes are read.

   Lifecycle-scoring spec §4: the author's own words for what was
   missing, "a distinct page that concretely indicate how the radar
   metrics are evaluated". "Radar metrics" is `ScoreRadar`'s six axes
   (autonomy, efficacy, reliability, transparency, cost, security),
   and the passage this page replaces on the blueprint detail page
   only ever named security's weights. This page covers all six.

   ── The plate, which this page went without for a release ──
   Every other page in the sequence opens with the drawing of its
   subject: DRW-101 on `/spec`, DRW-003 on `/spec/topology`, the
   annotated card on `/spec/card`, DRW-103 on `/spec/ontology`, and
   `app/spec/card/page.tsx` records it as the sequence's own rule.
   This page broke it on the one route whose subject is the most
   visual thing in the product — four viewports of tables and bar
   rows under an eyebrow reading THE SIX RADAR AXES and a lead
   beginning "A blueprint's radar has six axes", and no radar.

   DRW-104 is that radar, at a real blueprint's real numbers, drawn
   by the same `ScoreRadar` every blueprint page mounts. Two solves,
   one per width, because the component's geometry is solved against
   the CSS width it will occupy and a single desktop solve puts the
   axis names at three pixels on a phone; both placements below are
   the two `components/learn/figures.test.ts` already measures.

   The figure's own honesty problem is that four of the six axes are
   seeded, so a polygon drawn from them looks like a measurement of
   something. The `○ not built` line in the figcaption is what stops
   it claiming that, and it names the four rather than gesturing at
   them.

   ── Three sections, one per badge ──
   The three badges a reader actually meets are AUTO, VOTED and
   REPORTED: `SourceBadge` draws them from `METRIC_SOURCE_META` six
   times on every blueprint scorecard. This page — the one page whose
   job is to explain them — printed none of their names. It opened on
   an `<h2>Three ways of knowing</h2>` that promised a three-way split
   and then delivered a two-way one ("Two of the six are read straight
   off the graph", "Both are computed from the graph"), with the other
   two folded into a section headed "The other four are recorded".

   So there are three sections now and they map 1:1 onto the badges,
   each headed by the live badge component rather than by a word for
   it: the reader matches a shape and a colour against the scorecard
   in front of them. The axis names under each badge are read off the
   sample's own metrics, so a sixth axis or a re-sourced one arrives
   in the heading rows without anybody editing them.

   The `○ not built` disclosure follows its metrics rather than
   staying put. It was one sentence about four numbers; it is two
   sentences about three numbers and about two, sitting inside the
   sections that make the claims they qualify. The clause both keep
   verbatim — "seeded rows, and every card that shows one says so" —
   is the part a reader has to be able to find again on a card.

   ── Two pieces of existing content, moved rather than rewritten ──
   1. The qualitative walk, all six axes. It shipped first as
      `components/home/SectionExample.tsx`'s `id="scoring"` panel,
      beside a scorecard for one example bundle. It never named that
      bundle, so it detached cleanly — except for one sentence that
      assumed a scorecard sat next to it on the same screen, which is
      no longer a problem: DRW-104 is that scorecard.
   2. `<ScoringModel />`, moved unchanged from `app/spec/page.tsx`.
      It is already fully config-driven — every weight, cut and
      threshold is read live off `DARKPRINT_CONFIG` and the ontology
      at render time — so moving the route it mounts on changes
      nothing it prints.

   ── The h1 is a link target, not just a title ──
   "How a blueprint is graded" is the phrase every inline link to this
   content uses — `Explainability`'s (redesign spec §A3) and
   `SectionExample`'s (this lane's own step 4), both renamed from
   "How a factory is graded" alongside this page. Keeping it as this
   page's `h1` means the text a reader clicks and the heading they
   land on read as the same sentence.

   ── Bands, not one long column ──
   The four sibling `/spec` pages carry their sections as full-bleed
   bands alternating ground, which is the separation system the two
   learn sequences already use. This page held everything inside one
   `container-page` stack, so a section boundary was 56px of nothing.
   Same bands here, same tiers, so the five read as one system.

   ── No route config ──
   A static leaf segment, so there is no `generateStaticParams` and
   no `dynamicParams` to close (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`). The
   page is a server component and takes no props.
   ============================================================ */

export const metadata: Metadata = {
  title: "How a blueprint is graded",
  description:
    "The six axes on a DarkPrint blueprint's radar and the three badges behind them: auto, read off the graph and the cards at build time; voted, waiting on a ballot; reported, waiting on a runner. Nothing votes and nothing runs, so four of the six are seeded rows that say so.",
};

const HERE = "/spec/scoring";

/**
 * The blueprint DRW-104 is drawn from. Named on the plate, so the page says which one.
 *
 * The same bundle `/reading-the-radar` draws, for the same reason it gives: an invented
 * chart would be a picture of a scorecard no blueprint has, on a page about reading the
 * real thing.
 */
const SAMPLE_SLUG = "starter-software-factory";

/** The badges, in the order the three sections below take them. */
const SOURCE_ORDER: readonly MetricSource[] = ["auto", "community", "reported"];

/**
 * The `○ not built` line, beside the claim it qualifies.
 *
 * A pill and never `ComingSoonBadge`: amber is spent on two jobs on this site and one of
 * them, `.route-box`, appears on this very page in the pager. Shape carries the
 * difference — globals.css writes that rule down — and this is the shape the page already
 * used before the disclosure was split in two.
 */
function NotBuilt({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-start gap-2 text-[15px] leading-[1.7] text-dim">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
        <span aria-hidden>○</span>
        not built
      </span>
      <span className="prose-lane">{children}</span>
    </p>
  );
}

/**
 * One band, one badge.
 *
 * The heading row is the badge itself and the axes it carries, then the h2 — the same
 * two-line header shape the sibling `/spec` pages use, with the live component standing
 * in for the mono label line. That is deliberate: the reader is being taught to read a
 * mark, so the mark is what titles the section rather than a transcription of it.
 */
function SourceBand({
  source,
  axes,
  title,
  id,
  ground,
  children,
}: {
  source: MetricSource;
  /** The axis names this badge is on, read off the sample rather than typed. */
  axes: string;
  title: string;
  id: string;
  /** The band's ground, alternating down the page. */
  ground: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cx("border-t border-line py-16 sm:py-20", ground)}
      aria-labelledby={id}
    >
      <div className="container-page flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <SourceBadge source={source} />
            <span className="label">{axes}</span>
          </div>
          <h2
            id={id}
            className="font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]"
          >
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  );
}

const BODY = "prose-lane text-[15px] leading-[1.7] text-muted";

export default function SpecScoringPage() {
  const { page } = specNeighbours(HERE);

  const all = allBlueprints();
  const sample = all.find((bp) => bp.slug === SAMPLE_SLUG) ?? all[0];
  if (sample === undefined) return null;

  /* Every grouping on this page is read off the sample's own scorecard. The three
     sections, the plate's legend and the sentence naming the seeded four all follow the
     data, so a metric that changes source moves through the page rather than leaving one
     of its four statements stale. */
  const axesOf = (source: MetricSource): string =>
    sample.metrics
      .filter((metric) => metric.source === source)
      .map((metric) => metric.label)
      .join(" · ");
  const seeded = sample.metrics
    .filter((metric) => metric.source !== "auto")
    .map((metric) => metric.label);
  // Doc 2 §1.1: autonomy is a class, not a length, so the chart draws five of the six.
  const spokes = sample.metrics.filter((metric) => metric.key !== "autonomy").length;

  return (
    <>
      {/* `gap-5`, the card tier, and not the `gap-6` this header shipped with: 24px is
          not a step on the eight-point scale, and `/spec/card` and `/spec/ontology`
          already set the crumb 20px off their title. Four spec headers, one number. */}
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-5">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            lead="A blueprint's radar has six axes and three kinds of number behind
              them. Two are computed at build time by reading the graph and the cards
              it pins. Three are waiting on a ballot and one on a runner, and every row
              that carries one says so."
          />
        </div>
      </header>

      {/* ---------- DRW-104: the drawing the three sections annotate ----------
          No `border-t` on this one band: the header above it already draws the seam with
          its own `border-b`, and two hairlines meeting is a 2px rule at the one boundary
          on the page that should be quietest. Every band below carries its own. */}
      <section className="bg-void py-16 sm:py-20" aria-label="The scorecard this page reads">
        <div className="container-page">
          <figure className="flex flex-col gap-5">
            <Sheet
              register="blueprint"
              label="DRW-104 · six axes, three sources"
              title={sample.title}
              note={`${sample.metrics.length} axes · ${spokes} spokes`}
            >
              {/* Two solves, one per width. `ScoreRadar` derives its pad and its label
                  size together from the CSS width it is told it will occupy, so a single
                  number cannot serve a 342px phone and a 1104px band. Both of these are
                  the placements `components/learn/figures.test.ts` measures against the
                  10px legibility floor. */}
              <div className="flex justify-center">
                <div className="w-full sm:hidden">
                  <ScoreRadar metrics={sample.metrics} size={300} render={285} plate />
                </div>
                <div className="hidden w-full max-w-[480px] sm:block">
                  <ScoreRadar metrics={sample.metrics} size={300} render={480} plate />
                </div>
              </div>
            </Sheet>

            <figcaption className="flex flex-col gap-4">
              <p className="prose-lane text-sm leading-relaxed text-muted">
                {sample.title}, drawn by the same component every blueprint page
                mounts. Each axis is named in the colour of the badge its row carries
                on the scorecard, and the three sections below take those badges in
                turn. Autonomy has no spoke: it is a class, not a length, so the chart
                shows {spokes} of the {sample.metrics.length}.
              </p>
              <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8">
                {SOURCE_ORDER.map((source) => (
                  <li key={source} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <SourceBadge source={source} />
                    <span className="label">{axesOf(source)}</span>
                  </li>
                ))}
              </ul>
              <NotBuilt>
                {seeded.length} of the {sample.metrics.length} axes above are seeded
                rows with no ballot and no runner behind them: {seeded.join(", ")}. The
                polygon is the shape of the numbers on file, not a measurement of
                anything.
              </NotBuilt>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---------- AUTO ---------- */}
      <SourceBand
        source="auto"
        axes={axesOf("auto")}
        title="Read off the graph"
        id="auto-heading"
        ground="bg-surface/40"
      >
        <p className={BODY}>
          These two are the engine&apos;s own arithmetic, run at build time. Autonomy
          is the share of nodes that run unattended. Security opens at four and loses
          the weight of every risk marker the graph carries. A blueprint&apos;s own
          scorecard states the reading, and its detail page keeps the subtraction in
          the panel that shows the working. Either way the result is rescaled onto the
          0–100 axis the other rows share, so four of four reads there as 100.
        </p>
        <p className={BODY}>
          Both are computed from the graph and the cards its blueprint pins, and both
          name the nodes behind the number. The DOT and the cards are published as
          source on every blueprint page, so the arithmetic can be checked against
          them. What each check is worth is the rest of this page.
        </p>
      </SourceBand>

      {/* ---------- VOTED ---------- */}
      <SourceBand
        source="community"
        axes={axesOf("community")}
        title="Waiting on a ballot"
        id="voted-heading"
        ground="bg-void"
      >
        <p className={BODY}>
          These three are judgement calls, and no graph states them. Whether a
          blueprint&apos;s output was any good, whether it holds up across repeated
          runs, and whether its internal decisions are documented well enough to audit
          are readings that a weighted vote of the people who ran it would produce.
        </p>
        <NotBuilt>
          There is no ballot. Those three numbers are seeded rows, and every card that
          shows one says so.
        </NotBuilt>
      </SourceBand>

      {/* ---------- REPORTED ---------- */}
      <SourceBand
        source="reported"
        axes={axesOf("reported")}
        title="Waiting on a runner"
        id="reported-heading"
        ground="bg-surface/40"
      >
        <p className={BODY}>
          Cost and time need somebody to run the blueprint, and that happens on their
          machine. The platform never watches the run, so it can only ever be told the
          result. That is why the badge reads <span className="text-fg">reported</span>{" "}
          and never <span className="text-fg">measured</span>. Everything a reported
          figure would have to travel with, how many runs it aggregates and how far
          apart they were, is designed and none of it is wired.
        </p>
        <NotBuilt>
          There is no runner and no endpoint. The cost and time figures are seeded rows,
          and every card that shows one says so.
        </NotBuilt>
      </SourceBand>

      {/* ---------- the quantitative detail: what each check is worth ----------
          `ScoringModel` moved here unchanged from `app/spec/page.tsx`. Every number it
          prints is read off `DARKPRINT_CONFIG` and `getOntologyView()` at render time, so
          the route it mounts on changes nothing about what it says.

          It carries neither a container nor a band of its own: this page owns both, the
          same way it owns the four above, so the arithmetic sits on the same rhythm as
          the sections that introduce it. */}
      <section className="border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <ScoringModel />
        </div>
      </section>

      {/* The last band's own bottom padding is the space above the pager; a `pt` here as
          well put 144px and two rules between the disclosure and the way out. */}
      <div className="container-page pb-16 sm:pb-20">
        <SpecPager href={HERE} />
      </div>
    </>
  );
}
