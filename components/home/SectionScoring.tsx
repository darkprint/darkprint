import type { MetricSource } from "@/lib/types";
import { DARKPRINT_CONFIG, INFERRED_MARKERS } from "@/lib/core";
import { getOntologyView } from "@/lib/content";
import { SEED_BLUEPRINTS } from "@/lib/data";
import { METRIC_SOURCE_META } from "@/lib/format";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScoreRadar } from "@/components/ui/ScoreRadar";
import { MetricBars } from "@/components/ui/MetricBars";

const SAMPLE = SEED_BLUEPRINTS[0];

const SOURCE_ORDER: MetricSource[] = ["auto", "reported", "community"];

/** Where an axis actually stands in this build. Glyph *and* word, never colour alone. */
type Status = { glyph: string; word: string; color: string };

const COMPUTED: Status = {
  glyph: "✓",
  word: "computed here",
  color: "var(--color-emerald)",
};
const SEEDED: Status = {
  glyph: "◐",
  word: "seeded row",
  color: "var(--color-amber)",
};

const STATUS: Record<MetricSource, Status> = {
  auto: COMPUTED,
  reported: SEEDED,
  community: SEEDED,
};

const HOW: Record<MetricSource, string> = {
  auto: "Two rules run over the resolved graph at build time. Autonomy is the share of nodes whose type is not a kind of human-in-the-loop; security starts at a clean four and subtracts the weight of every risk marker present. Nothing is executed, and both name the nodes behind the number on the blueprint page.",
  reported: "Meant to come back from a real run on somebody else's machine — median tokens and wall-clock, through opt-in telemetry, with the run count, the spread and the model attached. Reported, never measured here: the platform does not watch the execution and cannot verify it. There is no runner and no endpoint either, so the figure below is a seeded row standing in for a report nobody has sent.",
  community: "Meant to be the weighted verdict of the people who actually run the thing, validators counting for more. Voting is not built: nothing on this site records a ballot, so these three are seeded rows as well.",
};

const SOURCES = SOURCE_ORDER.map((src) => ({
  src,
  meta: METRIC_SOURCE_META[src],
  status: STATUS[src],
  how: HOW[src],
  metrics: SAMPLE ? SAMPLE.metrics.filter((m) => m.source === src).map((m) => m.label) : [],
}));

/* --------------------- the security ledger (doc 3 §4–§5) --------------------- */

const { security, ontologyVersion } = DARKPRINT_CONFIG;

/**
 * Every risk marker the analyzer can charge for, and what each one costs.
 *
 * Both halves are read rather than written. The ids and the weights come from the
 * engine's frozen configuration — which doc 3 §4 keys by *marker id*, so this is exactly
 * the set in force and not a list of pattern names invented for a marketing page — and
 * the name and the one-line meaning come from the vocabulary those ids belong to. Neither
 * can drift from what the engine charges. Heaviest first, id breaking a tie, so the order
 * is stable from one build to the next.
 */
const MARKERS = Object.entries(security.weights)
  .map(([id, weight]) => {
    const term = getOntologyView().get(id);
    return {
      id,
      label: term?.label ?? id,
      note: term?.description ?? "",
      weight,
      /** Doc 3 §4.1 — three of them the analyzer works out of the graph on its own. */
      inferred: INFERRED_MARKERS.includes(id),
    };
  })
  .sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1));

const INFERRED_COUNT = MARKERS.filter((m) => m.inferred).length;

const TH = "pb-2 font-normal uppercase tracking-[0.14em] text-[10px] text-dim";

export function SectionScoring() {
  return (
    <section id="scoring" className="bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="How a factory is graded"
          title="Six metrics, three ways of knowing"
          lead="Every blueprint carries the same scorecard, and each axis says where its number came from — computed, reported, or voted. Nothing is measured: execution happens on the reader's own machine, so cost and time can only ever be reported back. In this build only the computed pair is real, the other four are seeded rows waiting on a runner and a ballot that do not exist yet, and each card below says so."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {SOURCES.map(({ src, meta, status, how, metrics }) => (
            <article
              key={src}
              className="panel flex flex-col gap-3 p-5"
              style={{ borderTop: `2px solid ${meta.color}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-fg">
                  <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                  {meta.label}
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: meta.color }}
                >
                  {meta.short}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {metrics.map((label) => (
                  <span
                    key={label}
                    className="rounded border px-2 py-0.5 font-mono text-[11px]"
                    style={{
                      color: meta.color,
                      borderColor: `color-mix(in oklab, ${meta.color} 40%, transparent)`,
                      background: `color-mix(in oklab, ${meta.color} 10%, transparent)`,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: status.color }}
              >
                <span aria-hidden>{status.glyph}</span>
                {status.word}
              </span>
              <p className="text-xs leading-relaxed text-dim">{how}</p>
            </article>
          ))}
        </div>

        <div className="panel mt-6 p-6">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-fg">
              Security, as a ledger
            </h3>
            <span className="font-mono text-[11px] text-dim">starts at 4.00</span>
          </div>
          <p className="mb-4 max-w-3xl text-xs leading-relaxed text-dim">
            Security inverts autonomy&apos;s reasoning: a blueprint starts clean at four,
            loses the weight of every risk marker present, and the result is clamped back
            into one to four. Gravity, not frequency — one node running code chosen at run
            time costs more than two unchecked writes, and a marker is charged{" "}
            <strong className="font-medium text-fg">once for the whole blueprint</strong>{" "}
            however many nodes carry it. The explanation still names every one of them.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] font-mono text-[12px]">
              <caption className="sr-only">
                The {MARKERS.length} risk markers of the core vocabulary, what each one
                means, and the points it subtracts from a starting score of four.
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className={TH}>
                    Risk marker
                  </th>
                  <th scope="col" className={`${TH} pl-3 text-right`}>
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {MARKERS.map((m) => (
                  <tr key={m.id}>
                    <th scope="row" className="py-2.5 text-left font-normal">
                      <span className="block text-fg">
                        {m.label}
                        {m.inferred && (
                          <span className="ml-2 font-sans text-[10px] uppercase tracking-[0.12em] text-cyan">
                            <span aria-hidden>◎ </span>
                            also inferred
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block font-sans text-[11px] leading-snug text-dim">
                        {m.note}
                      </span>
                    </th>
                    <td className="py-2.5 pl-3 text-right align-top tabular-nums text-amber">
                      −{m.weight.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-dim">
            {INFERRED_COUNT} of the {MARKERS.length} are marked{" "}
            <span className="text-cyan">also inferred</span>: the analyzer derives them
            from the graph even when no card mentions them, because the author who most
            needs to hear about a loop with no cap is the one who did not notice it. A
            marker coined in somebody&apos;s own namespace has to declare its own weight —
            without one it counts {security.unknownMarkerWeight.toFixed(2)} and documents a
            risk without pricing it, and the author is told rather than charged a number
            nobody chose. Every figure here is the shipped calibration, open by design and
            kept in one config file; moving one re-scores the whole archive, which is why a
            score records the vocabulary it was computed against — v{ontologyVersion}.
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="panel flex flex-col items-center justify-center gap-4 p-6">
            {/* Both take the band as well as the metrics: doc 2 §1.1 keeps autonomy off
                the 0–100 axis — it is not a length — so each states it in words instead,
                and neither can do that without being handed it. */}
            {SAMPLE && <ScoreRadar metrics={SAMPLE.metrics} autonomy={SAMPLE.autonomy} />}
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
              {SAMPLE ? SAMPLE.title : "Sample"} · scorecard
            </p>
          </div>

          <div className="panel p-6">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="font-display text-lg font-semibold text-fg">The card, axis by axis</h3>
              <span className="font-mono text-[11px] text-dim">five scored 0–100</span>
            </div>
            <p className="mb-2 text-xs leading-relaxed text-dim">
              Security is the analyzer&apos;s own arithmetic on this exact graph, and so
              is autonomy — which carries no bar and no number out of a hundred, because
              a band is not a quantity and a half-filled track would read as a graph
              half-finished. It states its level and who is in the loop. The remaining
              four are seeded index rows, real-looking numbers with nothing behind them
              yet, kept visible so the shape of a finished card is legible.
            </p>
            {SAMPLE && <MetricBars metrics={SAMPLE.metrics} autonomy={SAMPLE.autonomy} />}
          </div>
        </div>
      </div>
    </section>
  );
}
