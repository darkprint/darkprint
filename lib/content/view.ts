/* ============================================================
   DarkPrint content — the view-model bridge
   Takes what the engine resolved (§2 topology + §3 cards + §8 scores)
   and what the mutable index holds (§5.2 votes, downloads, comments)
   and produces the `Blueprint` shape the polished UI already consumes.

   Nothing here decides anything: autonomy and security come from the
   analyzers verbatim, the graph comes from the DOT, the community
   numbers come from the index. This module only translates.
   PURE — no filesystem, no clock.
   ============================================================ */

import type { Author, Blueprint, Metric } from "@/lib/types";
import type { BlueprintAnalysis, Diagnostic, ResolvedBlueprint } from "@/lib/core";
import { DARKPRINT_CONFIG } from "@/lib/core";
import { AUTONOMY_BLURB, autonomyStatement } from "@/lib/format";
import { getAuthor } from "@/lib/data/users";
import type { CommunitySignals } from "@/lib/data/community";
import { graphForBlueprint, requiredAgents, requiredTools } from "@/lib/graph-seed";
/* Type-only, so this stays the pure translation layer the module banner promises: neither
   barrel is ever called from here, only named for the shape its functions return.
   `isolatedModules` erases a type-only import at compile time, so no route file's
   `@/lib/server/**` boundary check has anything to see and no `node:*` dependency either
   barrel carries reaches a page that renders this module for a fixture. */
import type { ReportedCostUnits } from "@/lib/server/runs";
import type { SignalState } from "@/lib/server/counters";

/* --------------------- the ballot aggregate --------------------- */

/*
 * These two shapes came here from a `lib/server` folder that is gone.
 *
 * T160 published five shapes and two functions over them; Q14 deleted the functions and the
 * route above them, and what was left was a `lib/server` module with no store, no refusal and
 * no behaviour — two type declarations whose only reader is this file. A folder under
 * `lib/server` that publishes nothing a server does is a module in name only, and it cost
 * this pure translation layer an import across the client/server line it otherwise never
 * crosses. So the declarations moved to their reader.
 *
 * They are still here rather than inlined into `LiveSignals` because `communityMetric` is
 * exported and takes a `MetricAggregate` by name: a caller outside this file needs something
 * to spell. Nothing produces one today — `live.aggregate` has had no producer since Q14 --
 * and whether the field survives at all is the owner call D-120 recorded as never put to him.
 * Deleting the shapes now would decide that question by attrition.
 */

/**
 * One metric's standing.
 *
 * **A record rather than a bare number, and that was AC3 held by construction.** "An
 * aggregate never returns without its sample size" — a `number` makes the sample size an
 * optional second field a caller may omit, where a record makes having the value without it
 * impossible.
 */
export interface MetricAggregate {
  /**
   * The weighted mean of the stored votes, on the same 0-100 axis the votes were.
   *
   * **Not rounded.** `lib/types.ts`'s `Metric.value` is the display shape and rounding is its
   * decision; rounding here would make a caller unable to recover what was stored.
   *
   * `0` when `sampleSize` is `0`, because the field is required and has no absent form. A
   * caller branches on `isSample`, never on this being zero: a metric everybody scored `0`
   * and a metric nobody scored are different states and only `sampleSize` separates them.
   */
  value: number;
  /**
   * How many accounts voted **on this metric** — a count of ballots, never a sum of weights.
   *
   * The threshold was stated in votes, so raising a validator's weight moved `value` and left
   * this alone. Counting weight here would have let two validators at weight 3 clear a
   * five-vote bar with two votes.
   */
  sampleSize: number;
  /** `sampleSize < DARKPRINT_CONFIG.telemetry.minRuns`, computed once so no caller recomputes it. */
  isSample: boolean;
}

/** All three at once: there is no shape here that carries a value without its sample size. */
export interface Aggregate {
  efficacy: MetricAggregate;
  reliability: MetricAggregate;
  transparency: MetricAggregate;
}

/* --------------------- the bridge --------------------- */

/**
 * What a page has fetched off the live backend for one blueprint's scorecard, T280's wire
 * layer over the three modules `metricsFor` used to have no signal from at all.
 *
 * Every member is optional and independent of the others: a page hands in whatever it
 * fetched, `metricsFor` reads only `aggregate` and `cost`, and `signals` travels with the
 * bag for a caller building the rest of `Blueprint` (stars, downloads) from the same
 * round trip rather than because this module reads it.
 *
 * **The presence of `live` itself, not of any one member, is what turns a metric live.**
 * `cost` is legitimately `undefined` inside a live bag — D-180-01 and D-180-07's own text:
 * "cost?: ReportedCostUnits; undefined when no reports" — so a caller cannot signal "no
 * live wiring, use the fixture" by leaving `cost` off; it signals that by leaving the
 * whole bag off. See `costMetric` below for the branch this produces.
 */
export interface LiveSignals {
  /** The three ballot axes. No producer since Q14 deleted `getAggregate`; see `Aggregate` above. */
  aggregate?: Aggregate;
  /** `lib/server/runs`'s `reportedCost` — `undefined` when the digest has no reports. */
  cost?: ReportedCostUnits;
  /** `lib/server/counters`'s `getSignals`/`getSignalsMany` — starCount/downloadCount. */
  signals?: SignalState;
}

export interface BlueprintViewInput {
  blueprint: ResolvedBlueprint;
  analysis: BlueprintAnalysis;
  community: CommunitySignals;
  /**
   * Every diagnostic the bundle produced, resolution included — not just the two
   * analyzers'. A reader looking at `analysis.diagnostics` wants the whole list, and
   * an ambiguous port or an undeclared dependency is exactly the kind of thing that
   * belongs next to the score it helped produce. Defaults to the analyzers' own.
   */
  diagnostics?: readonly Diagnostic[];
  /** T280: threaded straight to `blueprintViewOver`. Absent for every archive caller. */
  live?: LiveSignals;
}

/**
 * One resolved bundle plus its index row, as the UI's `Blueprint`.
 *
 * Every derived field is named in the content spec: the two static metrics are the
 * engine's own numbers with the engine's own rationale as their explanation, the three
 * subjective ones and the cost come from the index, and the React Flow seeds are the
 * DOT with coordinates bolted on.
 */
export function toBlueprintView(input: BlueprintViewInput): Blueprint {
  const { blueprint, analysis, community } = input;
  /* Delegation, not computation: every derived value below is produced by the same three
     functions with the same options the sibling's registry callers use, so there is ONE
     implementation of doc 2 SS8's formulas and the two paths cannot drift (D-261-10; the
     `termUsageOver`/`termUsageIndex` pattern, ratified at D-260-07, applied here). */
  return blueprintViewOver({
    manifest: blueprint.manifest,
    digest: blueprint.digest,
    cardRefs: blueprint.nodes.map((n) => n.ref),
    graph: graphForBlueprint(blueprint, { cardsInRegistry: true }),
    requiredAgents: requiredAgents(blueprint),
    requiredTools: requiredTools(blueprint),
    analysis,
    community,
    diagnostics: input.diagnostics,
    live: input.live,
  });
}

/**
 * The projection's assembled-values entry point (D-261-10): what `toBlueprintView` reads
 * off a `ResolvedBlueprint`, taken as the five already-computed values instead — because
 * the registry holds the OUTPUTS (`BlueprintSummary` + `BlueprintSchematic` + `Scores`)
 * and no published reader returns the resolver's input type. The six metric formulas,
 * the band-ordinal strip and the seeded-community sentences live HERE alone; a registry
 * page and the archive path render one implementation.
 */
export interface AssembledViewInput {
  manifest: import("@/lib/core").BundleManifest;
  digest: string;
  cardRefs: readonly string[];
  graph: Blueprint["graph"];
  requiredAgents: readonly string[];
  requiredTools: readonly string[];
  analysis: BlueprintAnalysis;
  community: CommunitySignals;
  diagnostics?: readonly Diagnostic[];
  /** T280: forwarded to `metricsFor` untouched. Absent for every archive caller. */
  live?: LiveSignals;
}

export function blueprintViewOver(input: AssembledViewInput): Blueprint {
  const { manifest, analysis, community } = input;

  const { autonomyClass, isDarkFactory, level, label } = analysis.autonomy;

  return {
    kind: "blueprint",
    slug: manifest.slug,
    title: manifest.title,
    summary: manifest.summary,
    description: manifest.description ?? manifest.summary,
    tags: [...manifest.tags],
    category: manifest.category ?? "Uncategorised",
    author: authorFor(manifest.author),
    /* Four fields, one source. The label is the engine's own rather than a second table
       keyed on the band: `lib/format`'s `AUTONOMY_LABELS` still exists for the surfaces
       that have nothing but a number, and a view model holding the whole result has no
       reason to go through it and every reason to drift from it. */
    autonomy: {
      autonomyClass,
      label,
      isDarkFactory,
      level,
      blurb: AUTONOMY_BLURB[autonomyClass],
    },
    metrics: metricsFor(analysis, community, input.live),
    /* For the archive caller these three arrive from `graphForBlueprint(blueprint,
       { cardsInRegistry: true })` and its two siblings via the delegate above — the one
       caller that can promise a page behind every card ref (spec part 3, `GraphSeedOptions`).
       Registry callers hand in `BlueprintSchematic`'s members, computed by the identical
       calls (`registry/graphs.ts`). Copied, not aliased, so a frozen input cannot make one
       caller's `Blueprint` mutable and the other's not. */
    graph: input.graph,
    requiredAgents: [...input.requiredAgents],
    requiredTools: [...input.requiredTools],
    createdAt: manifest.createdAt ?? "",
    updatedAt: manifest.updatedAt ?? manifest.createdAt ?? "",
    downloads: community.downloads,
    votes: community.votes,
    comments: community.comments,
    featured: community.featured,
    seed: community.seed,
    analysis: {
      /* The engine's reading, with exactly one substitution: `rationale` arrives as the
         sentence a surface may print, which is the engine's own less the band ordinal it
         ends on (doc 2 §1.1). Everything else — the class, the counts, the fraction, the
         per-node contributions — is passed through untouched. The ontology version was in
         this list until 2026-09-05, when the owner had vocabulary versioning removed in full.

         Done here rather than at each call site because `Blueprint` crosses the
         server/client boundary: `GalleryBrowser` and `BlueprintCanvas` are client
         components, so this object is serialised into the RSC payload of every gallery
         and blueprint page, and a raw rationale would put "→ level 4" in the shipped HTML
         even on the pages that never print it. The band itself stays: `level` is what
         `GalleryBrowser` orders its filter list by, and no surface renders it.

         `autonomyStatement` is idempotent, so the components that also serve the upload
         and build-workspace routes — which hold a raw `BlueprintAnalysis` and must do
         their own stripping — stay correct when handed one of these instead. */
      autonomy: {
        ...analysis.autonomy,
        rationale: autonomyStatement(analysis.autonomy.rationale),
      },
      security: analysis.security,
      // Passed through untouched, like the two metrics: doc 2 §8's coverage is the
      // engine's own grouping, and the view model has nothing to add to it.
      phaseCoverage: analysis.phaseCoverage,
      diagnostics: [...(input.diagnostics ?? analysis.diagnostics)],
    },
    digest: input.digest,
    cardRefs: [...input.cardRefs],
  };
}

/* --------------------- derived pieces --------------------- */

/**
 * The scorecard. Order is fixed — the radar and the bar list both read it positionally.
 *
 * Two of the six are the engine's own arithmetic and carry the engine's own sentence.
 * The other four are rows built from `community` (the fixture) or, once `live` is handed
 * in, from the real backend it stands in for — `communityMetric` and `costMetric` below
 * are what decide which, per row, and each one states honestly what stands behind its
 * number: the fixture wording says "seeded, no ballot exists", the live wording says how
 * many ballots or reports actually landed.
 *
 * `live` absent is the whole of the "existing no-live callers get today's exact output"
 * contract (T280): every branch below that reads `live` is behind `=== undefined` guards,
 * so the archive path — the only caller with no `live` to hand in — takes none of them.
 */
function metricsFor(
  analysis: BlueprintAnalysis,
  community: CommunitySignals,
  live?: LiveSignals,
): Metric[] {
  const agg = live?.aggregate;
  return [
    {
      key: "autonomy",
      label: "Autonomy",
      // §8.1 scores the *share* of the graph that runs unattended, read over the work and
      // over the deciding and taken at the weaker of the two (`analysis/autonomy.ts`). The
      // class is that share bucketed and named, and the class is what a surface prints;
      // this value exists so the six metrics sit on one axis, and the two autonomy
      // renderers on the blueprint page both refuse to draw it as a length (doc 2 §1.1).
      //
      // `autonomy.fraction` and not `staffingFraction`: the `detail` below quotes the
      // comparison the band actually made, and a percentage taken from the other reading
      // would contradict the sentence printed under it.
      value: Math.round(analysis.autonomy.fraction * 100),
      source: "auto",
      // The engine's sentence, less the band ordinal it ends on: this `detail` is printed
      // verbatim inside the radar's caption, and doc 2 §1.1 keeps that ordinal off every
      // surface. `autonomyStatement` drops the number and keeps the arithmetic, so the row
      // still shows its working.
      detail: autonomyStatement(analysis.autonomy.rationale),
    },
    communityMetric(
      "efficacy",
      "Efficacy",
      community.efficacy,
      "Would be community-rated task success on real runs. Seeded, no ballot exists.",
      "Community-rated task success on real runs.",
      agg?.efficacy,
    ),
    communityMetric(
      "reliability",
      "Reliability",
      community.reliability,
      "Would be rated across repeated executions without error. Seeded, no ballot exists.",
      "Rated across repeated executions without error.",
      agg?.reliability,
    ),
    communityMetric(
      "transparency",
      "Transparency",
      community.transparency,
      "Would be a vote on how well the internal decisions are documented. Seeded, no ballot exists.",
      "A vote on how well the internal decisions are documented.",
      agg?.transparency,
    ),
    costMetric(community, live),
    {
      key: "security",
      label: "Static risk exposure",
      // §8.2 subtracts penalties from a clean 4. The raw figure can overshoot in either
      // direction — a graph can accumulate more than four points of penalty — so it is
      // clamped before being put on the same 0–100 axis as the rest.
      value: Math.round((clamp(analysis.security.raw, 0, 4) / 4) * 100),
      source: "auto",
      detail: analysis.security.rationale,
    },
  ];
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/**
 * One of the three ballot axes, fixture or live.
 *
 * `agg === undefined` is "no live wiring for this axis" and reproduces the fixture row
 * byte-for-byte — `seededValue`/`seededSentence` are exactly what `metricsFor` used to
 * write inline. `agg` present is a real ballot standing, rounded for display the
 * way `autonomy` and `security` already are (`MetricAggregate.value` itself stays
 * unrounded, on purpose — see its own doc comment — this is the presentation layer's
 * decision, not a second source of truth).
 *
 * Exported alongside `costMetric` so a caller holding an existing fixture `Metric` and a
 * fresh `Aggregate`/`ReportedCostUnits` — `/reading-the-radar`'s sample chart, the one
 * place outside this module that needs a live row without re-deriving a whole
 * `BlueprintAnalysis` — can build the same four rows `metricsFor` builds, rather than a
 * second, drifting implementation of what a live row looks like.
 */
export function communityMetric(
  key: "efficacy" | "reliability" | "transparency",
  label: string,
  seededValue: number,
  seededSentence: string,
  subject: string,
  agg: MetricAggregate | undefined,
): Metric {
  if (agg === undefined) {
    return { key, label, value: seededValue, source: "community", detail: seededSentence };
  }
  return {
    key,
    label,
    value: Math.round(agg.value),
    source: "community",
    detail: ballotDetail(subject, agg),
    live: true,
    sampleSize: agg.sampleSize,
  };
}

/**
 * The sentence under a live ballot axis: what it measures, then how many accounts stood
 * behind the number — the same three-way split `reportedDetail` uses for cost, over a
 * `MetricAggregate` rather than a run report. `telemetry.minRuns` is read from the engine's
 * config rather than restated as a second constant here.
 */
function ballotDetail(subject: string, agg: MetricAggregate): string {
  if (agg.sampleSize === 0) return `${subject} No ballots cast yet.`;
  const { minRuns } = DARKPRINT_CONFIG.telemetry;
  const sample =
    agg.sampleSize < minRuns
      ? `${agg.sampleSize} ballot${agg.sampleSize === 1 ? "" : "s"} — below the ${minRuns} this build treats as comparable`
      : `${agg.sampleSize} ballot${agg.sampleSize === 1 ? "" : "s"}`;
  return `${subject} Rated by ${sample}.`;
}

/**
 * The cost/time row, fixture or live.
 *
 * **`live` itself, not `live.cost`, is the branch.** D-180-01/D-180-07: once a page is
 * wired for live reports, a real `reportedCost` median must never land on the 0–100 axis a
 * bar or a radar spoke reads from — `value` is `undefined` in both live states below, with
 * or without an actual report, and `reportedDetail`'s `community.reported ?? community.cost`
 * precedence (the defect D-180-07 names) survives only in the `live === undefined` branch,
 * where the fixture's own `community.reported` is always absent in this archive and the
 * line is inert.
 *
 * ── this function is where the rule is enforced now, and the mechanics live here ──
 * The convention was `value === undefined` means "render this figure as text, never as a
 * length". It had three readers. `components/ui/MetricBars.tsx` was deleted on 2026-09-04
 * and `components/ui/ScoreRadar.tsx` on 2026-09-06, both on the owner's instruction and
 * both once nothing mounted them, and the radar was the last. **So no renderer reads the
 * convention today, and the guarantee this function makes is the whole of the rule as it
 * stands in code**: the live branch sets `value: undefined` unconditionally, so there is
 * no number on the live cost row for any future chart to give a length to, whatever that
 * chart decides `undefined` means.
 *
 * Why the number cannot have a length, restated here rather than pointed at, because the
 * comment that carried it is gone: cost and time are reported by whoever ran the
 * blueprint, on their machine, in their own units, against their own model. There is no
 * reference model that would put such a figure on a 0–100 interval, so a bar or a spoke
 * drawn from it would be a comparison the platform is not entitled to make. The figure
 * itself is not dropped. It goes out in `detail` and, when a report exists, in `reported`
 * as `{ runs, median, p10, p90 }`, which is a caller's cue to print it in words with its
 * own unit attached. A caller that wants the number visible has to print it itself, and
 * that is the intended cost of the rule.
 *
 * `community` takes only the two fields the fixture branch reads, `Pick`ed off
 * `CommunitySignals` rather than the whole shape: the live branch never touches it, so a
 * caller assembling a live row by hand has no reason to construct a full fixture-shaped
 * row it will not use. The caller this was written for was `/reading-the-radar`'s sample
 * chart, and that route was deleted on 2026-09-04; the narrow parameter is kept because
 * the argument for it does not depend on that caller existing.
 */
export function costMetric(
  community: Pick<CommunitySignals, "reported" | "cost">,
  live: LiveSignals | undefined,
): Metric {
  if (live === undefined) {
    return {
      key: "cost",
      label: "Cost / time",
      value: community.reported?.median ?? community.cost,
      source: "reported",
      detail: reportedDetail(community),
    };
  }
  const cost = live.cost;
  return {
    key: "cost",
    label: "Cost / time",
    value: undefined,
    source: "reported",
    detail: costDetailLive(cost),
    live: true,
    sampleSize: cost?.runs ?? 0,
    ...(cost === undefined
      ? {}
      : { reported: { runs: cost.runs, median: cost.median, p10: cost.spread.p10, p90: cost.spread.p90 } }),
  };
}

/**
 * The sentence under the cost/time row, fixture path. Doc 1 §8 corrects its own earlier
 * drafts here: because the blueprint runs on the reporter's machine (§0.1.3), cost and
 * time are *reported*, never measured by the platform, and an average with nothing
 * attached to it is not comparable between two blueprints. So the line always states the
 * three things §8 requires alongside the number — how many runs it aggregates, how far
 * apart they were, and which model produced them — and when there are none it says that
 * instead of quietly printing a mean.
 *
 * Below `telemetry.minRuns` the aggregate is named as a small sample rather than offered
 * as a figure to compare, which is the same threshold the engine's config carries.
 */
function reportedDetail(community: Pick<CommunitySignals, "reported">): string {
  const r = community.reported;
  if (r === undefined) {
    return (
      "Reported by whoever runs the blueprint, never measured here, execution happens " +
      "on their machine. 0 runs reported: no median, no spread, no model. The figure is " +
      "a seeded placeholder, not a measurement."
    );
  }
  const { minRuns } = DARKPRINT_CONFIG.telemetry;
  const sample =
    r.runs < minRuns
      ? `${r.runs} run${r.runs === 1 ? "" : "s"} — below the ${minRuns} this build treats as comparable`
      : `${r.runs} runs`;
  return (
    `Reported, not measured: median ${r.median} across ${sample}, ` +
    `p10–p90 ${r.spread.p10}–${r.spread.p90}, on ${r.model}. ` +
    `Outliers beyond ${DARKPRINT_CONFIG.telemetry.outlierZScore}σ are dropped before aggregating.`
  );
}

/**
 * The sentence under the cost/time row, live path — with or without a report on file.
 * Mirrors `reportedDetail`'s shape over `lib/server/runs`' own `ReportedCostUnits` rather
 * than the fixture's `ReportedCost`, and adds `excluded` (AC4 makes it a published field)
 * since this is the one surface honest enough to have it to print.
 */
function costDetailLive(cost: ReportedCostUnits | undefined): string {
  if (cost === undefined) {
    return (
      "Reported by whoever runs the blueprint, never measured here, execution happens " +
      "on their machine. No run has been reported for this release yet: no median, no " +
      "spread, no model."
    );
  }
  const { minRuns, outlierZScore } = DARKPRINT_CONFIG.telemetry;
  const sample =
    cost.runs < minRuns
      ? `${cost.runs} run${cost.runs === 1 ? "" : "s"} — below the ${minRuns} this build treats as comparable`
      : `${cost.runs} runs`;
  const excluded =
    cost.excluded > 0
      ? ` ${cost.excluded} report${cost.excluded === 1 ? "" : "s"} excluded as outliers beyond ${outlierZScore}σ.`
      : ` Outliers beyond ${outlierZScore}σ are dropped before aggregating.`;
  return (
    `Reported, not measured: median ${cost.median} across ${sample} on ${cost.model}, ` +
    `p10–p90 ${cost.spread.p10}–${cost.spread.p90}.` +
    excluded
  );
}




/**
 * The author row for a manifest's username. An unknown username still renders — the
 * archive and the user table are separate stores and one can outlive the other — but
 * it renders as plainly unknown rather than silently attributed to somebody else.
 */
function authorFor(username: string | undefined): Author {
  const known = username === undefined ? undefined : getAuthor(username);
  if (known !== undefined) return known;
  const name = username ?? "unknown";
  return {
    username: name,
    displayName: name,
    avatarHue: hue(name),
    validator: false,
  };
}

/** Deterministic hue from a string, so an unknown author keeps one colour across builds. */
function hue(seed: string): number {
  let acc = 0;
  for (let i = 0; i < seed.length; i += 1) acc = (acc * 31 + seed.charCodeAt(i)) % 360;
  return acc;
}
