import type { Metadata } from "next";
import Link from "next/link";

import { allBlueprints } from "@/lib/content";
import { communityMetric, costMetric, type LiveSignals } from "@/lib/content/view";
import type { Metric, MetricSource } from "@/lib/types";
import { METRIC_SOURCE_META, cx } from "@/lib/format";
import { getSharedDbClient } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { resolveOwner } from "@/lib/server/accounts";
import { getBundle } from "@/lib/server/archive";
import { blueprint as registryBlueprint } from "@/lib/server/registry";
import { getAggregate } from "@/lib/server/ballot";
import { reportedCost } from "@/lib/server/runs";
import { ScoringModel } from "@/components/spec/ScoringModel";
import { SourceBadge } from "@/components/ui/Badge";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Sheet } from "@/components/viz";
import { ARCHIVE_OWNER, blueprintHref } from "@/lib/href";

/* ============================================================
   /reading-the-radar — the scorecard, taken apart, and the
   arithmetic behind it. One page.

   ── Two pages, and why they are one now ──
   This route and `/spec/scoring` described the same six axes from
   two sides: this one the *picture* (five spokes, why autonomy has
   none, what a vertex's colour says), that one the *system* (three
   badges, every weight, what fires a marker). Both opened with the
   same `ScoreRadar`, at the same `starter-software-factory`, at
   the same two width solves — two identical charts, one per route,
   and each page's closing paragraph was a link to the other. The
   author asked for the pair merged.

   The survivor is this route, on three grounds. The author asked
   the grading door off the spec index in the same instruction, and
   a page that stays a numbered spec stop while its parent index is
   deleted refuses that twice. `components/spec/spec-routes.test.ts`
   walks `app/spec` and fails on a child outside `SPEC_SEQUENCE`, so
   keeping `/spec/scoring` would have forced it to stay in the
   sequence. And this route is top-level and already carries the
   highest-traffic inbound link of the pair, from `MetricBars` on
   every blueprint scorecard.

   The cost, stated: the URL says "reading the radar" and the title
   says "How a blueprint is graded". The title wins because it is
   the phrase every inline link on the site already uses for this
   content — `Explainability`'s, `SectionExample`'s, the header's
   and the footer's — and because it covers the merged page where
   "Reading the radar" covers only the picture half. A URL is a
   name somebody else wrote down; `next.config.ts` 308s
   `/spec/scoring` here, and `#weights` still lands because
   `ScoringModel` carries that id itself.

   ── What came across from `/spec/scoring`, and what was dropped ──
   Kept whole: DRW-104 with its `SourceBadge` legend and its
   `○ not built` line naming the seeded axes; all three `SourceBand`
   sections with both remaining `NotBuilt` paragraphs verbatim,
   including the clause a reader has to be able to find again on a
   card ("seeded rows, and every card that shows one says so"); and
   `<ScoringModel />`, which reads every weight, cut and threshold
   off `DARKPRINT_CONFIG` and the ontology at render time.

   Dropped, on purpose: this page's own `<figure>` plate, which was
   DRW-104 without the plate furniture; the source `<dl>` that used
   to hang off callout 03, because DRW-104's legend and the three
   band headers already say the same six metrics by source twice;
   and callout 05, whose whole body was a link to the page this one
   just absorbed. The spec crumb and pager went too: this is not a
   stop in the spec sequence.

   ── The chart is a real one ──
   A blueprint out of the archive, drawn by the same `ScoreRadar`
   the detail pages use, with its real metrics. An invented chart
   would be a picture of a scorecard that no blueprint has, on the
   one page whose subject is how to read the real thing.

   ── T280: the sample's ballot and run axes are read live, not seeded ──
   Ballots and run reports are backend now (`lib/server/ballot`,
   `lib/server/runs`), so a page whose whole subject is "what does
   this number mean" is the wrong place to keep printing four rows
   that quietly stayed frozen at their fixture values. `SAMPLE_SLUG`
   is resolved against the live registry under `ARCHIVE_OWNER`
   (`lib/href.ts`'s seeded account) and its aggregate and reported
   cost are read with `communityMetric`/`costMetric` — the same two
   functions `lib/content/view.ts`'s `metricsFor` builds its own four
   rows from, so this page and a blueprint's own scorecard cannot
   describe one figure two different ways. A lookup failure (the
   archive account or bundle missing from the live database) falls
   back to `sample.metrics` untouched: the fixture reading is a
   correct answer to "what would this look like", never a wrong one.

   `dynamic = "force-dynamic"` for the reason `app/blueprints/
   [owner]/[slug]/page.tsx` gives at length: a page that reads
   `getSharedDbClient()` cannot promise its own numbers are current
   under a build-time snapshot, and this route's whole subject is
   what a live ballot or run report changes on a card.

   ── Three sections, one per badge ──
   The three badges a reader actually meets are AUTO, VOTED and
   REPORTED: `SourceBadge` draws them from `METRIC_SOURCE_META` six
   times on every blueprint scorecard. Each band is headed by the
   live badge component rather than by a word for it, so the reader
   matches a shape and a colour against the scorecard in front of
   them, and the axis names under each badge are read off the
   sample's own metrics.
   ============================================================ */

export const metadata: Metadata = {
  title: "How a blueprint is graded",
  description:
    "A blueprint's scorecard, taken apart: five spokes, why autonomy is not one of them, and what the colour of each vertex says about where its number came from. Then the three badges behind the six axes and every weight the engine charges. Two are read off the graph; the other four wait on a ballot or a run report, and an axis with none yet says so honestly rather than pretending one exists.",
};

/* T280: this page reads the live registry for the sample's ballot and run figures, the
   same reason `app/blueprints/[owner]/[slug]/page.tsx` gives at length for its own
   `force-dynamic` — a page whose subject is what those numbers mean cannot promise a
   build-time snapshot of them is current. */
export const dynamic = "force-dynamic";

/** A reader with no session. This page names nothing private, so every request reads as
    this — there is no per-visitor branch to earn a real session lookup. */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

const HERE = "/reading-the-radar";

/** The blueprint whose card is drawn. Named, so the page says which one it is. */
const SAMPLE_SLUG = "starter-software-factory";

/** The badges, in the order the three bands below take them. */
const SOURCE_ORDER: readonly MetricSource[] = ["auto", "community", "reported"];

/**
 * The sample's live ballot and run signals, or `undefined` when the live registry has
 * nothing under `ARCHIVE_OWNER/SAMPLE_SLUG` — a lookup failure this page treats as "fall
 * back to the fixture reading" rather than a 404: the fixture is a correct answer to
 * "what would this look like", never a wrong one, so there is nothing here worth crashing
 * the page over. `getAggregate`/`reportedCost` themselves never throw for an absent or
 * unreadable bundle (B-03: `getAggregate` answers an empty aggregate, `reportedCost`
 * answers `undefined`), so the only failure this `try` actually guards is the database
 * being unreachable at all.
 */
async function sampleLiveSignals(): Promise<LiveSignals | undefined> {
  try {
    const db = getSharedDbClient().db;
    const summary = await registryBlueprint(db, ANONYMOUS, ARCHIVE_OWNER, SAMPLE_SLUG);
    if (summary === undefined) return undefined;
    const account = await resolveOwner(db, ARCHIVE_OWNER);
    const record = account === undefined ? undefined : await getBundle(db, account.accountId, SAMPLE_SLUG);
    if (record === undefined) return undefined;
    const [aggregate, cost] = await Promise.all([
      getAggregate(db, ANONYMOUS, record.id),
      reportedCost(db, ANONYMOUS, summary.digest),
    ]);
    return { aggregate, cost };
  } catch {
    return undefined;
  }
}

/**
 * `sample.metrics` (the fixture) with the four backend-fed rows swapped for their live
 * reading, when there is one — `communityMetric`/`costMetric` are the exact two functions
 * `lib/content/view.ts`'s `metricsFor` builds a blueprint's own scorecard from, so this
 * page and the detail page can never describe the sample's efficacy, reliability,
 * transparency or cost two different ways. Autonomy and security are untouched: neither
 * is a backend signal, and both are already the fixture's own live-computed reading.
 */
function liveMetricsFor(sample: { metrics: Metric[] }, live: LiveSignals | undefined): Metric[] {
  if (live === undefined) return sample.metrics;
  const [autonomy, efficacySeed, reliabilitySeed, transparencySeed, , security] = sample.metrics;
  if (autonomy === undefined || security === undefined) return sample.metrics;
  return [
    autonomy,
    communityMetric(
      "efficacy",
      "Efficacy",
      efficacySeed?.value ?? 0,
      efficacySeed?.detail ?? "",
      "Community-rated task success on real runs.",
      live.aggregate?.efficacy,
    ),
    communityMetric(
      "reliability",
      "Reliability",
      reliabilitySeed?.value ?? 0,
      reliabilitySeed?.detail ?? "",
      "Rated across repeated executions without error.",
      live.aggregate?.reliability,
    ),
    communityMetric(
      "transparency",
      "Transparency",
      transparencySeed?.value ?? 0,
      transparencySeed?.detail ?? "",
      "A vote on how well the internal decisions are documented.",
      live.aggregate?.transparency,
    ),
    costMetric({ cost: 0 }, live),
    security,
  ];
}

const LINK =
  "text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright";

/* ── Full span above "The arithmetic": a deliberate, scoped exception to `.prose-lane` ──
   The author's ruling, in their words: "in '/reading-the-radar' the texts up to the
   section 'The arithmetic' should cover the full horizontal space instead of being placed
   on the right." Everything from the header down to and including the REPORTED band now
   runs the `container-page` measure. `<ScoringModel />` and the tail box below it are
   untouched — that is where the boundary was drawn, because "The arithmetic" is the
   `.label-lead` `ScoringModel` prints at its own top.

   This is NOT an oversight for a later pass to "fix" back to `.prose-lane`. The site's
   body measure is 36rem (`--measure`, globals.css) and it exists because long lines hurt
   reading; it has been overruled here, for this page's opening only, by the person whose
   page it is. The same ruling already stands on every `SectionHeading` lead sitewide, and
   `SectionHeading`'s own docblock records it being made twice.

   What that ruling costs, and how it is paid. `.container-page` is 1200px capped less
   1.5rem of padding either side: a 1152px content box. At 15px these paragraphs measured
   ~154 characters across it — double the ~75 a measure is set for, and the hardest line
   on the page. The cure is the one `SectionHeading` already found for the deck: at full
   span the TYPE goes up, not the span down. 18px from `sm` up measures 128 characters at
   1440, against the deck's 115 at 20px in the same column, so body and deck end up on the
   same footing rather than the body being the harder of the two. Below `sm` the container
   is narrow enough that 15px is already a 46-character line, so the ramp starts at `sm`
   and the phone keeps exactly the size and the wrapping it had. Measured at 390, 430,
   640, 768, 1024 and 1440: no width overflows its container.

   One class, so the five paragraphs, the three `SampleNote` bodies, the three callouts
   and the plate's caption cannot drift apart. */
const BODY = "text-[15px] leading-[1.7] text-muted sm:text-lg sm:leading-[1.6]";

/**
 * The sample-honesty line, beside the claim it qualifies.
 *
 * `NotBuilt` until T280: ballots and run reports are backend now, so a fixed "○ not
 * built" pill would be flatly wrong for a route whose entire subject is what those two
 * axes mean. What survives is the SHAPE — a small pill naming a state, then the sentence
 * — with the label read off the caller's own count instead of hardcoded, so the same
 * component serves "no ballot on file" and "12 ballots on file" without becoming two
 * components. A pill and never `ComingSoonBadge`: amber is spent on two jobs on this site
 * and one of them, `.route-box`, appears on this very page in the tail box. Shape carries
 * the difference — globals.css writes that rule down — and this is the shape the deleted
 * `/spec/scoring` used before the disclosure was split in two.
 *
 * Full span, like everything else above "The arithmetic" (see `BODY`). The pill stays
 * `shrink-0` and the sentence takes the rest of the row. The `basis-[20rem]` is what keeps
 * the phone honest: below that the sentence wraps onto its own full-width line under the
 * pill, exactly as it did when it was a `.prose-lane` block, and above it it grows to
 * whatever the container leaves. `min-w-0` stops a long unbroken token widening the row.
 */
function SampleNote({ badge, children }: { badge: string; children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-start gap-2 text-[15px] leading-[1.7] text-dim sm:text-lg sm:leading-[1.6]">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
        <span aria-hidden>○</span>
        {badge}
      </span>
      <span className="min-w-0 flex-1 basis-[20rem]">{children}</span>
    </p>
  );
}
/**
 * One band, one badge.
 *
 * The heading row is the badge itself and the axes it carries, then the h2. That is
 * deliberate: the reader is being taught to read a mark, so the mark is what titles the
 * section rather than a transcription of it.
 */
function SourceBand({
  source,
  axes,
  title,
  id,
  ground,
  className,
  children,
}: {
  source: MetricSource;
  /** The axis names this badge is on, read off the sample rather than typed. */
  axes: string;
  title: string;
  id: string;
  /** The band's ground, alternating down the page. */
  ground: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cx("border-t border-line py-16 sm:py-20", ground, className)}
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
            className="scroll-mt-24 font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]"
          >
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  );
}

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
   * A figure belonging to this callout: the axis list under 03. It used to be a bare
   * `<li>` of its own, so the `<ol>` held more items than the page printed numbers — a
   * screen reader said "item 5 of 7" where the page said **04**, and every callout after
   * it was announced at the wrong position. It belongs to the callout above it, so it
   * sits inside it.
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
       every divider advertised the empty third of the page.

       That last one is now solved from the other side. The 62ch caps on the body and the
       figure are gone, and the `<ol>`'s own `max-w-[52rem]` with them, per the author's
       full-span ruling recorded on `BODY`. The rule and the text under it reach the same
       right edge again because the TEXT grew, not because the rule shrank. The numeral
       keeps its 3rem gutter, so the text column is the container less 3.5rem. */
    <li className="grid gap-x-6 gap-y-3 border-t border-line pt-8 sm:grid-cols-[3rem_minmax(0,1fr)]">
      <span className="font-mono text-2xl leading-none tabular-nums text-dim sm:pt-1">
        {n}
      </span>
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-semibold leading-snug text-fg">
          {title}
        </h3>
        <p className={BODY}>{children}</p>
        {extra !== undefined && <div className="mt-2">{extra}</div>}
      </div>
    </li>
  );
}

export default async function HowABlueprintIsGradedPage() {
  const all = allBlueprints();
  const sample = all.find((bp) => bp.slug === SAMPLE_SLUG) ?? all[0];
  if (sample === undefined) return null;

  const live = await sampleLiveSignals();
  const metrics = liveMetricsFor(sample, live);

  /* The four (fixture) or three-to-four (live, D-180-01) that get a spoke, and the one
     — autonomy — that never does. Both read off `metrics` rather than listed here: a
     metric added to `MetricKey` would otherwise be described on every blueprint page and
     missing from the page explaining the drawing. */
  const spokes = metrics.filter((m) => m.key !== "autonomy" && m.value !== undefined);
  const autonomyRow = metrics.find((m) => m.key === "autonomy");
  const costHasSpoke = metrics.some((m) => m.key === "cost" && m.value !== undefined);

  /* Every grouping on this page is read off `metrics` rather than `sample.metrics`
     directly, so the three bands, the plate's legend and the sample-honesty line below
     all follow whichever reading — fixture or live — the page actually drew. */
  const axesOf = (source: MetricSource): string =>
    metrics
      .filter((metric) => metric.source === source)
      .map((metric) => metric.label)
      .join(" · ");
  const nonAuto = metrics.filter((metric) => metric.source !== "auto");
  const communityAxes = metrics.filter((metric) => metric.source === "community");
  const costRow = metrics.find((metric) => metric.key === "cost");
  const noSpokeSentence = costHasSpoke
    ? "Autonomy has no spoke: it is a class, not a length."
    : "Autonomy has no spoke, and once real reports exist to read neither does cost (D-180-01): both are a class or a stated figure, never a length.";

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-5">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow="The six radar axes"
            title="How a blueprint is graded"
            lead="Every blueprint page draws one of these. Autonomy never gets a spoke, and neither does cost once a page reads real reports for it (D-180-01). A colour on each vertex says where the rest of a number came from. This page reads the picture first and then the arithmetic behind it."
          />
        </div>
      </header>

      {/* ---------- DRW-104: the drawing everything below annotates ----------
          No `border-t` on this one band: the header above it already draws the seam with
          its own `border-b`, and two hairlines meeting is a 2px rule at the one boundary
          on the page that should be quietest. Every band below carries its own.

          The plate is drawn once. Both routes that merged into this page opened with the
          same chart at the same two solves, and the redundancy the author named was
          exactly that. `render` tells `ScoreRadar` the width it will occupy so its
          geometry solves against that: a single desktop solve puts the axis names at
          three CSS pixels on a phone. Both placements below are the two
          `components/learn/figures.test.ts` measures against the legibility floor. */}
      <section id="scorecard" className="scroll-mt-24 bg-void py-16 sm:py-20" aria-label="The scorecard this page reads">
        <div className="container-page">
          <figure className="flex flex-col gap-5">
            <Sheet
              register="blueprint"
              label="DRW-104 · six axes, three sources"
              title={sample.title}
              note={`${metrics.length} axes · ${spokes.length} spokes`}
            >
              <div className="flex justify-center">
                <div className="w-full sm:hidden">
                  <ScoreRadar metrics={metrics} size={300} render={285} plate />
                </div>
                <div className="hidden w-full max-w-[480px] sm:block">
                  <ScoreRadar metrics={metrics} size={300} render={480} plate />
                </div>
              </div>
            </Sheet>

            <figcaption className="flex flex-col gap-4">
              {/* The caption takes `BODY` rather than a caption size of its own. At the
                  full container span there is no size below body that reads: 14px across
                  1152px is ~165 characters. It is the first paragraph of the page's
                  argument as much as it is a caption, so it is set as one. */}
              <p className={BODY}>
                {sample.title}, drawn by the same component every blueprint page
                mounts. Each axis is named in the colour of the badge its row carries
                on the scorecard, and the three sections below take those badges in
                turn. {noSpokeSentence} So the chart shows {spokes.length} of the{" "}
                {metrics.length}.{" "}
                {/* The one link the retired `/reading-the-radar` plate carried that
                    DRW-104 did not: the way to the blueprint this chart belongs to. It is
                    grafted onto this caption rather than lost with that figure. */}
                <Link href={blueprintHref(ARCHIVE_OWNER, sample.slug)} className={LINK}>
                  Open the blueprint <span aria-hidden>&rarr;</span>
                </Link>
              </p>
              <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8">
                {SOURCE_ORDER.map((source) => (
                  <li key={source} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <SourceBadge source={source} />
                    <span className="label">{axesOf(source)}</span>
                  </li>
                ))}
              </ul>
              {live === undefined ? (
                <SampleNote badge="fixture reading">
                  {sample.title}&rsquo;s live ballot and run figures could not be read for
                  this render, so the {nonAuto.length} rows above showing{" "}
                  {nonAuto.map((m) => m.label).join(", ")} are this bundle&rsquo;s fixture
                  numbers rather than a live sample.
                </SampleNote>
              ) : (
                <SampleNote badge="live sample">
                  {nonAuto
                    .map(
                      (m) =>
                        `${m.label} ${m.sampleSize ?? 0} ${m.key === "cost" ? "run" : "ballot"}${
                          (m.sampleSize ?? 0) === 1 ? "" : "s"
                        }`,
                    )
                    .join(" · ")}{" "}
                  and all of it read live off {sample.title} rather than fixed at build
                  time. A ballot or a run report changes one of these the next time this
                  page renders.
                </SampleNote>
              )}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---------- the picture, annotated ---------- */}
      <section
        aria-labelledby="the-notes"
        className="border-t border-line bg-surface py-16 sm:py-20"
      >
        <div className="container-page flex flex-col gap-10">
          <h2 id="the-notes" className="scroll-mt-24 sr-only">
            What each part of the drawing means
          </h2>
          <ol className="flex flex-col gap-10">
            <Callout n="01" title={`${spokes.length} spokes, one per scored axis`}>
              {spokes.map((m) => m.label).join(", ")}, each vertex at that axis&rsquo;s
              value on a 0 to 100 scale. A larger polygon is not a better blueprint, it is
              one that scores higher on these.
            </Callout>

            {autonomyRow !== undefined && (
              <Callout n="02" title="Autonomy has no spoke, on purpose">
                {metrics.length} readings, {spokes.length} spokes. Autonomy is a{" "}
                <span className="text-fg">name</span>, not a magnitude: this one is{" "}
                <span className="font-mono text-fg">{sample.autonomy.label}</span>. A spoke
                would invite a reader to grow it, and where a person acts is a decision, not
                a shortfall. It is printed under the chart in words, not drawn on it.
              </Callout>
            )}

            <Callout
              n="03"
              title="What each row means"
              extra={
                /* Row-separated, and every row carries its source colour.
                   ------------------------------------------------------------
                   This was six `text-xs` pairs stacked on a 12px gap: a 12px name over a
                   12px detail in `text-dim`, under a 20px heading. The densest block on the
                   page was set at its smallest size, dt and dd were near enough the same
                   weight to merge, and nothing separated one metric from the next, so six
                   definitions read as one grey paragraph.

                   The 8px dot is the same swatch DRW-104's legend uses above, so the chart,
                   the legend and this list are one system rather than three ways of
                   printing the same six names.

                   The 62ch cap came off with the rest of the page's opening. This is a
                   two-column listing, not body prose, and globals.css already says
                   listings keep the full container — but a `dd` running the whole of it
                   at 14px is the same defect in another shape, so the name column takes
                   the extra room (11rem → 15rem) and both columns are set at 15px. The
                   `dd` measures 824px at 1440, ~110 characters, which is what these
                   one-to-three line entries need. `dt` came up from 13px with it: a name
                   set two steps under its own definition is a hierarchy upside down. */
                <dl className="flex flex-col">
                  {metrics.map((m) => (
                    <div
                      key={m.key}
                      className="grid gap-x-4 gap-y-1 border-t border-line/70 py-3 first:border-t-0 first:pt-0 sm:grid-cols-[15rem_minmax(0,1fr)]"
                    >
                      <dt className="flex items-baseline gap-2 text-[15px] font-medium text-fg">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
                          style={{ background: METRIC_SOURCE_META[m.source].color }}
                        />
                        {m.label}
                      </dt>
                      <dd className="text-[15px] leading-relaxed text-muted">{m.detail}</dd>
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
          </ol>

          {/* Callout 03's own source `<dl>` stood here and is gone: DRW-104's legend above
              and the three band headers below name the same six metrics by source twice
              already. Its one sentence stays, as the lead into the bands, which is the
              job it was doing. */}
          <p className={BODY}>
            Not all six are the same kind of fact, so the drawing does not pretend they
            are. Two are the engine&rsquo;s own arithmetic. Three read a live ballot and
            one a live run report, and the three sections below take those badges in
            turn, each one honest about the sample it has today rather than about whether
            the pipeline behind it exists.
          </p>
        </div>
      </section>

      {/* ---------- AUTO ---------- */}
      <SourceBand
        source="auto"
        axes={axesOf("auto")}
        title="Read off the graph"
        id="auto-heading"
        ground="bg-surface/40"
        className="scroll-mt-24"
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
        title="Read from a live ballot"
        id="voted-heading"
        ground="bg-void"
      >
        <p className={BODY}>
          These three are judgement calls, and no graph states them. Whether a
          blueprint&apos;s output was any good, whether it holds up across repeated
          runs, and whether its internal decisions are documented well enough to audit
          are readings a weighted vote of the people who ran it produces.
        </p>
        {live === undefined ? (
          <SampleNote badge="fixture reading">
            {sample.title}&rsquo;s live ballot could not be read for this render, so
            these three numbers are this bundle&rsquo;s fixture reading instead.
          </SampleNote>
        ) : (
          <SampleNote badge="live sample">
            {communityAxes
              .map((m) => `${m.label} ${m.sampleSize ?? 0}`)
              .join(" · ")}{" "}
            ballots cast for {sample.title}. Casting one moves the count on the next
            render: this page has no fixed placeholder left to move away from.
          </SampleNote>
        )}
      </SourceBand>

      {/* ---------- REPORTED ---------- */}
      <SourceBand
        source="reported"
        axes={axesOf("reported")}
        title="Read from a live run report"
        id="reported-heading"
        ground="bg-surface/40"
      >
        <p className={BODY}>
          Cost and time need somebody to run the blueprint, and that happens on their
          machine. The platform never watches the run, so it can only ever be told the
          result. That is why the badge reads <span className="text-fg">reported</span>{" "}
          and never <span className="text-fg">measured</span>. Everything a reported
          figure travels with (how many runs it aggregates, how far apart they were,
          and which model produced them) is wired now: a caller posts it to the runs
          endpoint keyed to a release digest, and it folds into that digest&apos;s
          aggregate before this page reads it back. The darkprint CLI verb for this is
          not built yet; the endpoint answers today.
        </p>
        {live === undefined ? (
          <SampleNote badge="fixture reading">
            {sample.title}&rsquo;s live run report could not be read for this render, so
            the cost and time figure is this bundle&rsquo;s fixture reading instead.
          </SampleNote>
        ) : (
          <SampleNote badge="live sample">
            {costRow?.sampleSize ?? 0} run{(costRow?.sampleSize ?? 0) === 1 ? "" : "s"}{" "}
            reported for {sample.title}. Cost and time never land on the 0–100 axis
            above either way (D-180-01): a real median renders as a stated number in
            the reporter&rsquo;s own units, and nothing on file yet says so plainly.
          </SampleNote>
        )}
      </SourceBand>

      {/* ---------- the quantitative detail: what each check is worth ----------
          `ScoringModel` came here unchanged from the retired `/spec/scoring`. Every
          number it prints is read off `DARKPRINT_CONFIG` and `getOntologyView()` at
          render time, so the route it mounts on changes nothing about what it says — and
          it carries `id="weights"` with its own `scroll-mt-24`, which is why
          `/spec/scoring#weights` survives the merge as `/reading-the-radar#weights`.

          It carries neither a container nor a band of its own: this page owns both, the
          same way it owns the three above, so the arithmetic sits on the same rhythm as
          the sections that introduce it. */}
      <section className="border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <ScoringModel />
        </div>
      </section>

      {/* The shared Learn rail closes every page in the seven-part path. */}
      <section className="border-t border-line bg-surface pb-20 pt-16">
        <div className="container-page">
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
