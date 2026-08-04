/* ============================================================
   The arithmetic behind the two computed rows.

   PROJECT.md §3.4: "The security weights table and the telemetry
   design are documented nowhere a reader can reach." The panel
   this one sits under, `#scoring`, tells a reader that security
   "starts at four and loses the weight of every risk marker the
   graph carries" and then names no weight. Every blueprint page
   links to that anchor by name, so a reader arrives at the
   sentence and leaves without the numbers in it: before this
   section, the string `arbitrary-code-execution` appeared on no
   page under `/spec`.

   ── What it costs, measured ──
   This section is 763 prose words, 579 of them open, and it takes
   `/spec` from 883 to 1,638. That makes `/spec` the longest
   open-prose page on the site, on a route the redesign split into
   four because one long page made readers leave. PROJECT.md §3.4
   carries the numbers and the open question, which is placement:
   the content is what §3.4 asked for and a `/spec/scoring` route
   would take the overview back to 883. Anything added here should
   be weighed against that, and anything cut should come out of the
   duplication rather than out of the honesty statement below.

   ── Every number here is read, none is typed ──
   `DARKPRINT_CONFIG` is exported and deep-frozen for exactly this
   use. Doc 1 §11 put the thresholds in one file so they could be
   re-tuned after launch against real data, and doc 3 §8 makes
   moving one of them a PATCH of the ontology version because it
   re-scores every published blueprint. A table transcribed by hand
   survives that re-tuning and lies about it afterwards, which is
   the failure mode `SectionExample` already avoids for the one
   number it quotes. So this component takes a `DarkprintConfig`
   the way every analyzer in `lib/core` does, defaulted to the
   shipped one, and `scoring-model.test.ts` renders it a second
   time under different numbers and fails if the markup does not
   move with them.

   ── Doc 2 §1.1 ──
   The bands below are the arithmetic behind the autonomy *class*.
   The cut and the name are shown; the band ordinal that sits
   between them in `AutonomyResult.level` is not, here or anywhere
   else. `AUTONOMY_LABELS` is keyed by that ordinal and the key is
   used as a lookup index, never printed.

   ── Why the telemetry block is not behind a disclosure ──
   It is the one part of this section that states a limit, and
   PROJECT.md §3.1 records how limit statements leave this site:
   they are promoted into a `<details>` during a pass cutting for
   length, every word count still passes, and no reader sees them
   again. Its sentence is in `components/site/honesty.test.ts`
   tagged `open`, so a later pass that folds it fails the build.

   The ceiling and the floor are the one pair of numbers not read
   from `config.ts`, because they are not open. Doc 3 §5 fixes the
   scale at `clamp(raw, 1, 4)` and leaves only the weights to
   calibration; `toLevel` in `lib/core/analysis/security.ts` is
   where it is implemented.
   ============================================================ */

import Link from "next/link";

import { CORE_ONTOLOGY, DARKPRINT_CONFIG } from "@/lib/core";
import type { DarkprintConfig, OntologyTerm } from "@/lib/core";
import { getOntologyView } from "@/lib/content";
import { AUTONOMY_LABELS } from "@/lib/format";
import { termHref } from "@/lib/href";
import { More } from "@/components/ui/More";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** Doc 3 §5's `clamp(raw, 1, 4)`, the scale the weights are subtracted from. */
const CEILING = 4;
const FLOOR = 1;

/**
 * Marker id to the sentence the vocabulary already carries about it.
 *
 * Read off `CORE_ONTOLOGY` rather than written here, for the same reason as the weights:
 * `/ontology` and every node page gloss these ids from the term, and a second gloss typed
 * into a table is a second gloss that drifts from the first.
 */
const MARKER_TERMS = new Map(
  CORE_ONTOLOGY.terms
    .filter((term) => term.kind === "risk-marker")
    .map((term) => [term.id, term] as const),
);

/** One decimal, so a column of 2, 1.5 and 1 reads as one scale. */
function weight(value: number): string {
  return value.toFixed(1);
}

/** Two decimals, matching the fractions the engine prints in its own rationale. */
function fraction(value: number): string {
  return value.toFixed(2);
}

/**
 * Every risk marker in this archive's vocabulary that prices itself.
 *
 * Doc 3 §7's middle rung, and the reason it is here: the engine resolves a weight as
 * config, then the term's own `defaultWeight`, then `unknownMarkerWeight`, and the first
 * version of this panel published the first and third steps only. That is not a
 * hypothetical gap. `content/ontology/extensions.yaml` prices `lupo/pii-handling` at 0.50
 * and `/blueprints/frontline-triage` charges it, printing
 * `4 − 1.50 (irreversible-action) − 0.50 (lupo/pii-handling) → 2` under a link to this
 * page — so a reader followed the arithmetic here and found a table that could not account
 * for half of the subtraction they had just read.
 *
 * Read off the merged view rather than the core, because a core term carrying a
 * `defaultWeight` is a thing doc 3 §4 forbids and `core.test.ts` already holds.
 */
const LOCAL_WEIGHTED: OntologyTerm[] = getOntologyView()
  .byKind("risk-marker")
  .filter((term) => term.defaultWeight !== undefined && term.defaultWeight >= 0);

interface WeightRow {
  id: string;
  what: string;
  weight: number;
  /** True where the amount comes from the term rather than from the configuration. */
  local: boolean;
}

/**
 * The weights map as rows, heaviest first and then by id.
 *
 * Sorted rather than taken in insertion order: the object literal in `config.ts` is
 * grouped by the document it came from, and a reader looking for what costs most should
 * find it at the top instead of reading all seven.
 */
function weightRows(config: DarkprintConfig): WeightRow[] {
  return Object.entries(config.security.weights)
    .map(([id, value]) => ({
      id,
      what:
        MARKER_TERMS.get(id)?.description ??
        "Weighted here and not carried by the curated vocabulary.",
      weight: value,
      local: false,
    }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

/**
 * The same for the terms that price themselves, minus any the configuration already
 * names — that is the engine's precedence, so a deployment which prices a local marker
 * sees it move up into the block above rather than appearing twice at two amounts.
 */
function localRows(config: DarkprintConfig): WeightRow[] {
  const priced = new Set(Object.keys(config.security.weights));
  return LOCAL_WEIGHTED.filter((term) => !priced.has(term.id))
    .map((term) => ({
      id: term.id,
      what: term.description,
      weight: term.defaultWeight ?? 0,
      local: true,
    }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

/**
 * The four bands, as the comparison the engine performs and the name it produces.
 *
 * The order of the comparisons mirrors `bandFor` in `lib/core/analysis/autonomy.ts`: the
 * top band is a strict `>` and the two under it are `≥`, which is doc 3 §6 read literally
 * and is the difference between a graph at exactly 0.90 being one class or another.
 */
function bandRows(config: DarkprintConfig): { rule: string; label: string }[] {
  const { level4, level3, level2 } = config.autonomy;
  return [
    { rule: `fraction > ${fraction(level4)}`, label: AUTONOMY_LABELS[4] },
    { rule: `fraction ≥ ${fraction(level3)}`, label: AUTONOMY_LABELS[3] },
    { rule: `fraction ≥ ${fraction(level2)}`, label: AUTONOMY_LABELS[2] },
    { rule: `under ${fraction(level2)}`, label: AUTONOMY_LABELS[1] },
  ];
}

const TH = "pb-2 text-left font-normal uppercase tracking-[0.14em] text-[11px] text-dim";

export function ScoringModel({
  /* Defaulted the way `computeSecurity` and `computeAutonomy` are defaulted, and passed by
     the test with numbers that are not the shipped ones. A panel of figures that cannot be
     falsified is a panel nobody can tell has gone stale. */
  config = DARKPRINT_CONFIG,
}: {
  config?: DarkprintConfig;
}) {
  const rows = [...weightRows(config), ...localRows(config)];
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  const unknown = config.security.unknownMarkerWeight;
  const { similarityThreshold, similarityFiresMarker } = config.criteriaLeak;
  const { minRuns, outlierZScore } = config.telemetry;

  return (
    /* No `container-page` and no outer padding: the route's own wrapper supplies both,
       and carrying a second set here gave `/spec/scoring` two vertical rhythms. `id` and
       `scroll-mt-24` stay on this element, which is all `anchors.test.ts` requires of the
       `#weights` bookmark. The rule above stays, because it is what separates this half
       of the page from the one before it. */
    <section id="weights" className="scroll-mt-24 flex flex-col gap-8 border-t border-line pt-14">
        {/* No eyebrow. It carried "The arithmetic", and an eyebrow is how every page on
            this site opens: a mono kicker above a title, which is what `SectionHeading`
            draws at the top of `/spec/scoring` itself. Halfway down the route a second
            one made the page look like it started twice, which the audit of this route
            called its worst boundary defect. The heading stays, because the section
            genuinely is a new subject; the kicker goes, because the section is not a new
            page. */}
        <SectionHeading
          title="What each check is worth"
          lead={`Security opens at ${CEILING} and subtracts. These are the amounts, read at build time out of the engine's configuration and the vocabulary this archive ships.`}
        />

        {/* ---------- the weights ---------- */}
        <div className="panel flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-fg">
              Risk markers
            </h3>
            <span className="font-mono text-[11px] text-dim">
              held between {FLOOR} and {CEILING}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">
                Every risk marker the engine weighs, what it means, and how much it
                subtracts from a security reading.
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={TH}>
                    marker
                  </th>
                  <th scope="col" className={TH}>
                    what it says about the node
                  </th>
                  <th scope="col" className={`${TH} text-right`}>
                    subtracts
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60 align-top">
                    <th
                      scope="row"
                      className="w-[15rem] py-2.5 pr-4 text-left font-mono text-[12px] font-normal text-fg"
                    >
                      {/* Linked, because the amount is one of several things the term
                          page says about a marker and the reader who came here for the
                          number is one click from the rest. It is also the route that
                          was missing: a locally priced marker publishes its weight on
                          `/ontology/<id>` and this table pointed at nothing. */}
                      <Link
                        href={termHref(row.id)}
                        className="underline decoration-line underline-offset-4 hover:text-cyan"
                      >
                        {row.id}
                      </Link>
                      {row.local && (
                        <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-dim">
                          from the vocabulary
                        </span>
                      )}
                    </th>
                    <td className="py-2.5 pr-4 leading-relaxed text-muted">
                      {row.what}
                    </td>
                    <td className="w-[5rem] py-2.5 text-right font-mono text-[12px] text-fg">
                      {weight(row.weight)}
                    </td>
                  </tr>
                ))}
                {/* The zero row is in the table rather than in a footnote under it. A
                    reader who scans seven weighted ids and stops has read the whole
                    table, and doc 3 §7's answer for the eighth id is the row they would
                    otherwise infer. */}
                <tr className="align-top">
                  <th
                    scope="row"
                    className="w-[15rem] py-2.5 pr-4 text-left font-mono text-[12px] font-normal text-dim"
                  >
                    any other marker
                  </th>
                  {/* Short, because the paragraph under the table carries the rest of
                      the sentence. Two full statements of doc 3 §7 within a screen of
                      each other is the kind of duplication the length pass removes. */}
                  <td className="py-2.5 pr-4 leading-relaxed text-dim">
                    A marker neither block above names.
                  </td>
                  <td className="w-[5rem] py-2.5 text-right font-mono text-[12px] text-dim">
                    {weight(unknown)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* The three-step lookup, in the order `weightOf` performs it
              (`lib/core/analysis/security.ts`). The middle step is the one this panel
              shipped without, and the row above is now the only place on the site that
              states where a namespaced marker's amount comes from. */}
          <p className="text-sm leading-relaxed text-muted">
            The engine reads the configuration first, then the marker&apos;s own declared
            weight where the bundle&apos;s vocabulary carries one, then nothing. An
            unrecognised marker weighs {weight(unknown)}, listed on the card and on the
            node page and never quietly charged for.
          </p>
          {/* The reader's likely inference, stated against: a ceiling of four looks like
              four points of headroom, and the priced markers add to more than twice it. */}
          <p className="text-sm leading-relaxed text-muted">
            The markers priced above add to {weight(total)} against a ceiling of {CEILING},
            so a graph can carry more than the reading has room for. The subtraction runs
            to the end and the result is held between {FLOOR} and {CEILING}: past the
            floor the arithmetic continues and the number stops.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* ---------- the bands ---------- */}
          <div className="panel flex flex-col gap-4 p-6">
            <h3 className="font-display text-lg font-semibold text-fg">
              Autonomy cuts
            </h3>
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                The fraction of unattended nodes, and the class name each range of it is
                called.
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={TH}>
                    the fraction
                  </th>
                  <th scope="col" className={TH}>
                    the class
                  </th>
                </tr>
              </thead>
              <tbody>
                {bandRows(config).map((band) => (
                  <tr key={band.label} className="border-b border-line/60">
                    <td className="py-2.5 pr-4 font-mono text-[12px] text-muted">
                      {band.rule}
                    </td>
                    <td className="py-2.5 font-mono text-[12px] text-fg">
                      {band.label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm leading-relaxed text-muted">
              The fraction is the nodes that run with nobody waiting on them over every
              node in the graph, and the name is what every surface prints. A dark factory
              is counted from those nodes and never read off a cut.
            </p>
          </div>

          {/* ---------- the half of criteria-leak that is textual ---------- */}
          <div className="panel flex flex-col gap-4 p-6">
            <h3 className="font-display text-lg font-semibold text-fg">
              The criteria-leak threshold
            </h3>
            <p className="text-sm leading-relaxed text-muted">
              The marker fires on the topology: a path from the node writing the
              acceptance criteria to the node writing the code. The engine also compares
              the two <code className="font-mono text-[0.92em] text-fg">spec</code> fields
              as a Jaccard index over 3-gram word shingles, and{" "}
              <span className="font-mono text-fg">
                {fraction(similarityThreshold)}
              </span>{" "}
              is where one reads as a copy of the other.
            </p>
            {/* Written off the flag rather than around it. A page that stated the
                shipped behaviour in prose would say the opposite of the engine the day
                somebody turns the check on, which is the whole reason it is a flag. */}
            <p className="text-sm leading-relaxed text-muted">
              {similarityFiresMarker
                ? `Crossing that threshold fires the marker on its own, so the ${weight(config.security.weights["criteria-leak"] ?? unknown)} above can be charged for prose alone.`
                : `Crossing it is reported and subtracts nothing. The ${weight(config.security.weights["criteria-leak"] ?? unknown)} above is charged for a path in the graph and for nothing else.`}
            </p>
            <p className="font-mono text-[11px] leading-relaxed text-dim">
              similarityFiresMarker: {String(similarityFiresMarker)}
            </p>
          </div>
        </div>

        {/* ---------- the two filters, and the fact that neither has ever run ---------- */}
        <div className="panel flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-fg">
              Cost and time, if they are ever reported
            </h3>
          </div>
          <dl className="flex flex-col gap-2 font-mono text-[12px]">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <dt className="text-fg">minRuns {minRuns}</dt>
              <dd className="text-dim">
                under {minRuns} runs an aggregate carries its sample size rather than
                standing as a figure to compare
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <dt className="text-fg">outlierZScore {outlierZScore}</dt>
              <dd className="text-dim">
                a run further than {outlierZScore} standard deviations from the mean is
                dropped as an outlier
              </dd>
            </div>
          </dl>
          {/* The `○ not built` chip stood in the heading row, with `minRuns` and
              `outlierZScore` between it and the sentence that explains what it means. It
              introduces that sentence now, which is the shape this route already uses at
              `app/spec/scoring/page.tsx:124-133`: badge, then the claim, in one line.

              Guardrails §2 is the reason to move it toward the sentence rather than away.
              The paragraph carries this route's one honesty-ledger entry, held `open`
              over `ScoringModel` — "nothing on this site measures a run, so these two
              filters describe a design rather than a behaviour" — and its wording is
              untouched here. What changes is that the qualifier and the qualified thing
              are now one block instead of two separated by a definition list. */}
          <p className="flex flex-wrap items-center gap-2 text-sm leading-relaxed text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
              <span aria-hidden>○</span>
              not built
            </span>
            <span>
              Nothing on this site measures a run, so these two filters describe a design
              rather than a behaviour. There is no runner and no endpoint to report to, and
              the cost and time figures in the registry are seeded rows that say so on every
              card carrying one.
            </span>
          </p>
        </div>

        <More summary="Why these numbers are provisional, and what moving one costs">
          <p className="text-sm leading-relaxed text-muted">
            Doc 3 §4 introduces the weights as{" "}
            <span className="italic">valori di partenza da tarare</span>, starting values
            to be calibrated, and doc 3 §9 leaves the cuts and the similarity threshold
            open in the same way. Doc 1 §11 is why they sit in one file rather than at the
            several places that read them.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Moving any of them is a PATCH of the ontology version, because every score
            already published changes with it, which is why a score records the vocabulary
            version it was computed under (doc 3 §8). Four of the nine blueprints in this
            archive land on the floor today, which is either weights that are heavy or a
            scale that is short, and telling those apart needs a corpus this site has no
            way to collect.
          </p>
          {/* The two reasons cut out of the panels above to keep them short. Both are the
              answer to a "why that number" a reader may not have, and §3.1's licence
              covers exactly this: reference depth folded, the statement it qualifies left
              in the open. */}
          <p className="text-sm leading-relaxed text-muted">
            The similarity check warns rather than charging because a fuzzy match on prose
            is a proxy for criteria that only exist while the graph runs. The outlier
            filter exists because the hardware, the model and the size of the task vary
            between the people who would be reporting, so an unfiltered mean would average
            incomparable runs.
          </p>
        </More>
    </section>
  );
}
