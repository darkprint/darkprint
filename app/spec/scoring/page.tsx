import type { Metadata } from "next";

import { ScoringModel } from "@/components/spec/ScoringModel";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /spec/scoring — how the radar's six axes are read.

   Lifecycle-scoring spec §4: the author's own words for what was
   missing, "a distinct page that concretely indicate how the radar
   metrics are evaluated". "Radar metrics" is `ScoreRadar`'s six axes
   (autonomy, efficacy, reliability, transparency, cost, security),
   and the passage this page replaces on the blueprint detail page
   only ever named security's weights. This page covers all six.

   ── Not a fourth layer ──
   `/spec` says "three layers" in the heading over its doors, and
   `SPEC_LAYERS` is the length-three list that heading counts. This
   route is a `SpecPage`, appended to `SPEC_SEQUENCE` after the three
   layers rather than folded among them (`sequence.ts` has the
   reasoning). It grades what the three layers describe; it is not a
   fourth language a blueprint is written in.

   ── Two pieces of existing content, moved rather than rewritten ──
   1. The qualitative walk below, all six axes, three ways of
      knowing them. It shipped first as `components/home/
      SectionExample.tsx`'s `id="scoring"` panel, beside a scorecard
      for one example bundle. It never named that bundle, so it
      detaches here cleanly — except for one sentence that assumed a
      scorecard sat next to it on the same screen, which this page
      does not have (`SectionExample` keeps its own scorecard, with
      a link back to here). That sentence is reworded below to state
      the same fact about a blueprint's scorecard in general rather
      than about one page's neighbour.
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

   ── No route config ──
   A static leaf segment, so there is no `generateStaticParams` and
   no `dynamicParams` to close (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`). The
   page is a server component and takes no props.
   ============================================================ */

export const metadata: Metadata = {
  title: "How a blueprint is graded",
  description:
    "The six axes on a DarkPrint blueprint's radar: autonomy and security, read off the graph and the cards at build time; cost, time, efficacy, reliability and transparency, seeded rows with no runner or ballot behind them yet.",
};

const HERE = "/spec/scoring";

export default function SpecScoringPage() {
  const { page } = specNeighbours(HERE);

  return (
    <>
      <header className="border-b border-line bg-void py-12 sm:py-16">
        <div className="container-page flex flex-col gap-6">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            lead="A blueprint's radar has six axes. Two are computed at build
              time by reading the graph and the cards it pins. The other four
              are recorded rather than measured, and every row that carries
              one says so."
          />
        </div>
      </header>

      <div className="container-page flex flex-col gap-14 py-14">
        {/* ---------- the qualitative walk: three ways of knowing ---------- */}
        <section
          className="panel flex flex-col gap-4 p-6"
          aria-labelledby="three-ways-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2
              id="three-ways-heading"
              className="font-display text-2xl font-semibold tracking-tight text-fg"
            >
              Three ways of knowing
            </h2>
            <span className="font-mono text-[11px] text-dim">six axes</span>
          </div>

          <p className="text-[15px] leading-relaxed text-muted">
            Two of the six are read straight off the graph, at build time.
            Autonomy is the share of nodes that run unattended. Security opens
            at four and loses the weight of every risk marker the graph
            carries. A blueprint&apos;s own scorecard states the reading, and
            its detail page keeps the subtraction in the panel that shows the
            working. Either way the result is rescaled onto the 0–100 axis the
            other five rows share, so four of four reads there as 100.
          </p>
          <p className="text-[15px] leading-relaxed text-muted">
            Both are computed from the graph and the cards its blueprint
            pins, and both name the nodes behind the number. The DOT and the
            cards are published as source on every blueprint page, so the
            arithmetic can be checked against them.
          </p>
          <p className="border-t border-line pt-4 text-[15px] leading-relaxed text-muted">
            The other four cannot be read off a graph. Cost and time need
            somebody to run the blueprint, and that happens on their machine,
            so the platform can only ever be told the result. Efficacy,
            reliability and transparency are judgement calls that need a
            ballot.
          </p>
          <p className="flex flex-wrap items-center gap-2 text-[15px] leading-relaxed text-dim">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
              <span aria-hidden>○</span>
              not built
            </span>
            <span>
              There is no runner, no endpoint and no ballot. Those four
              numbers are seeded rows, and every card that shows one says so.
            </span>
          </p>
        </section>
      </div>

      {/* ---------- the quantitative detail: what each check is worth ----------
          `ScoringModel` moved here unchanged from `app/spec/page.tsx`. Every number it
          prints is read off `DARKPRINT_CONFIG` and `getOntologyView()` at render time, so
          the route it mounts on changes nothing about what it says. It carries its own
          `container-page`, which is why it sits outside the wrapper above rather than
          inside it — nesting the two would double the horizontal padding. */}
      <ScoringModel />

      <div className="container-page py-14">
        <SpecPager href={HERE} />
      </div>
    </>
  );
}
