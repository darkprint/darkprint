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

import type { AutonomyClass, Author, Blueprint, Metric } from "@/lib/types";
import type { BlueprintAnalysis, Diagnostic, ResolvedBlueprint } from "@/lib/core";
import { DARKPRINT_CONFIG } from "@/lib/core";
import { AUTONOMY_BLURB, autonomyStatement } from "@/lib/format";
import { getAuthor } from "@/lib/data/users";
import type { CommunitySignals } from "@/lib/data/community";
import { graphForBlueprint, requiredAgents, requiredTools } from "@/lib/graph-seed";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-74) (cited at line 167): POST /api/blueprints/{slug}/votes

/* --------------------- the bridge --------------------- */

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
  const { manifest } = blueprint;

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
    metrics: metricsFor(analysis, community),
    /* The one caller looking at the archive, so the one caller that can promise a page
       exists behind every card ref. That promise is what lets the schematic link a node
       to its card (spec part 3); see `GraphSeedOptions`. */
    graph: graphForBlueprint(blueprint, { cardsInRegistry: true }),
    requiredAgents: requiredAgents(blueprint),
    requiredTools: requiredTools(blueprint),
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
         per-node contributions, the ontology version — is passed through untouched.

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
    digest: blueprint.digest,
    cardRefs: blueprint.nodes.map((n) => n.ref),
  };
}

/* --------------------- derived pieces --------------------- */

/**
 * The scorecard. Order is fixed — the radar and the bar list both read it positionally.
 *
 * Two of the six are the engine's own arithmetic and carry the engine's own sentence.
 * The other four are rows out of the index, and their `detail` has to say so: no code
 * in this repository records a vote or a run, so a line reading "rated across repeated
 * executions" under a number nobody measured is the registry lying about its own data.
 * Each one states the intent and then states that it is seeded.
 */
function metricsFor(analysis: BlueprintAnalysis, community: CommunitySignals): Metric[] {
  return [
    {
      key: "autonomy",
      label: "Autonomy",
      // §8.1 scores the *share* of the graph that runs unattended. The class is that
      // share bucketed and named, and the class is what a surface prints; this value
      // exists so the six metrics sit on one axis, and the two autonomy renderers on
      // the blueprint page both refuse to draw it as a length (doc 2 §1.1).
      value: Math.round(analysis.autonomy.fraction * 100),
      source: "auto",
      // The engine's sentence, less the band ordinal it ends on: this `detail` is printed
      // verbatim under the row by `MetricBars` and inside the radar's caption, and doc 2
      // §1.1 keeps that ordinal off every surface. `autonomyStatement` drops the number
      // and keeps the arithmetic, so the row still shows its working.
      detail: autonomyStatement(analysis.autonomy.rationale),
    },
    {
      key: "efficacy",
      label: "Efficacy",
      value: community.efficacy,
      source: "community",
      detail: "Would be community-rated task success on real runs. Seeded, no ballot exists.",
    },
    {
      key: "reliability",
      label: "Reliability",
      value: community.reliability,
      source: "community",
      detail:
        "Would be rated across repeated executions without error. Seeded, no ballot exists.",
    },
    {
      key: "transparency",
      label: "Transparency",
      value: community.transparency,
      source: "community",
      detail:
        "Would be a vote on how well the internal decisions are documented. Seeded, no ballot exists.",
    },
    {
      key: "cost",
      label: "Cost / time",
      // The reported median when there is one, and the seeded stand-in when there is
      // not — which, in this build, is always. Precedence rather than a second field:
      // a real aggregate must never sit behind a placeholder.
      value: community.reported?.median ?? community.cost,
      source: "reported",
      detail: reportedDetail(community),
    },
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
 * The sentence under the cost/time bar. Doc 1 §8 corrects its own earlier drafts here:
 * because the blueprint runs on the reporter's machine (§0.1.3), cost and time are
 * *reported*, never measured by the platform, and an average with nothing attached to it
 * is not comparable between two blueprints. So the line always states the three things
 * §8 requires alongside the number — how many runs it aggregates, how far apart they
 * were, and which model produced them — and when there are none it says that instead of
 * quietly printing a mean.
 *
 * Below `telemetry.minRuns` the aggregate is named as a small sample rather than offered
 * as a figure to compare, which is the same threshold the engine's config carries.
 */
function reportedDetail(community: CommunitySignals): string {
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
