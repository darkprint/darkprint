/* ============================================================
   DarkPrint — the index half of §5
   The archive under `content/` is immutable and content-addressed;
   everything that moves — votes, downloads, comments, the three
   subjective metrics and the reported cost — belongs to a database
   instead. This module is that database, keyed by slug, until there
   is a real one. Autonomy and security are deliberately absent:
   §8 has the engine compute those from the graph.
   ============================================================ */

import type { Comment } from "@/lib/types";
import { AUTHORS } from "./users";

/**
 * What an opt-in telemetry aggregate has to carry before it means anything (§8).
 *
 * A mean on its own is not a datum. §8 lists what has to travel with it, and each field
 * here is one item off that list: the sample size, because "un dato basato su due
 * esecuzioni non vale come uno basato su duecento"; the spread, because hardware and task
 * size vary enormously between reporters; and the model, without which comparing two
 * blueprints' cost figures means nothing. Outlier filtering is the fourth item and is a
 * property of how `runs` was arrived at — `DARKPRINT_CONFIG.telemetry` holds both the
 * z-score used to drop a run and the sample size below which an aggregate is shown as a
 * sample rather than as a figure to compare.
 *
 * Nothing in this repository produces one of these. The type exists so the empty state
 * has a shape to be empty *of* — a renderer that reads these fields cannot quietly turn
 * into one that prints an unqualified average.
 */
export interface ReportedCost {
  /** Runs that survived the outlier filter. */
  runs: number;
  /** Median of those runs, on the 0–100 axis the rest of the scorecard uses. */
  median: number;
  /** Dispersion across the same runs: the 10th and 90th percentile. */
  spread: { p10: number; p90: number };
  /** The model the runs were executed on, e.g. "claude-sonnet-4-5". */
  model: string;
}

/** Everything a row in the mutable index carries for one blueprint. */
export interface CommunitySignals {
  downloads: number;
  votes: number;
  comments: Comment[];
  /** Community-voted metrics, 0–100. The three subjective ones from §8. */
  efficacy: number;
  reliability: number;
  transparency: number;
  /**
   * The seeded stand-in for the cost/time axis, 0–100, so the scorecard has six axes to
   * draw. It is a shape, not a measurement, and every surface that renders it says so.
   */
  cost: number;
  /**
   * The real thing, when anybody has ever reported a run. Absent on every row below and
   * absent from the fallback, because it is absent in fact: there is no runner, no
   * endpoint and no submission, so no blueprint here has a run count, a spread or a
   * model behind its cost figure. Seeding one would be inventing the appearance of
   * telemetry nobody collected, which is the specific dishonesty §8 is guarding against.
   */
  reported?: ReportedCost;
  featured?: boolean;
  /** Highlighted in the note as one of the two seed examples. */
  seed?: boolean;
}

/**
 * Keyed by the slug in `content/blueprints/<slug>/blueprint.yaml`. A slug with no
 * row here still renders — the loader falls back to a zeroed row — but it will read
 * as a blueprint nobody has run yet, which is exactly what it would be.
 *
 * A comment body may quote an autonomy level or a security score, and when it does it
 * has to quote the one the engine actually computes for that slug — the same page
 * prints both a few centimetres away. The current figures are:
 *
 *     adversarial-consensus-line  A4 8/8   security 4.00 → 100
 *     checkpoint-resume-runner    A4 9/9   security 4.00 → 100
 *     frontline-triage            A3 6/7   security 3.38 →  84
 *     grounded-research-desk      A4 8/8   security 2.75 →  69
 *     guarded-merge-bot           A3 5/6   security 2.75 →  69
 *     incident-commander          A3 6/7   security 0.75 →  19
 *     nightly-data-janitor        A4 7/7   security 3.25 →  81
 *     schema-forge-etl            A4 7/7   security 4.00 → 100
 *     starter-software-factory    A4 5/5   security 4.00 → 100
 *
 * Anything else in a body — downloads, vote counts, run anecdotes — is seeded and says
 * so on the pages that render it.
 */
export const COMMUNITY: Record<string, CommunitySignals> = {
  "adversarial-consensus-line": {
    downloads: 3120,
    votes: 214,
    efficacy: 84,
    reliability: 78,
    transparency: 88,
    cost: 46,
    featured: true,
    seed: true,
    comments: [
      {
        id: "c1",
        author: AUTHORS.sol,
        body: "Ran the static analyzer on this — genuinely zero human gates, autonomy 4 confirmed. The bounded re-vote (max 3) is what keeps it from looping forever.",
        createdAt: "2026-05-02",
        votes: 41,
      },
      {
        id: "c2",
        author: AUTHORS.hachi,
        body: "1,000 executions, 12 hard conflicts, all resolved without escalation. Cost is the weak metric — the debate loop roughly doubles tokens when it triggers.",
        createdAt: "2026-05-18",
        votes: 27,
      },
      {
        id: "c3",
        author: AUTHORS.orin,
        body: "Swapped Solver B for a cheaper model and efficacy barely moved. The value is in the disagreement, not the raw horsepower.",
        createdAt: "2026-06-11",
        votes: 15,
      },
    ],
  },

  "checkpoint-resume-runner": {
    downloads: 4780,
    votes: 301,
    efficacy: 80,
    reliability: 94,
    transparency: 82,
    cost: 58,
    featured: true,
    seed: true,
    comments: [
      {
        id: "c1",
        author: AUTHORS.mara,
        body: "This is the part everyone skips and then wonders why their factory can't run for more than 20 minutes. Reliability 94 is earned.",
        createdAt: "2026-04-14",
        votes: 52,
      },
      {
        id: "c2",
        author: AUTHORS.hachi,
        body: "Checkpoint granularity is a real knob — per-stage is the sweet spot. Went finer once and the storage writes dominated the cost metric.",
        createdAt: "2026-05-29",
        votes: 33,
      },
    ],
  },

  "grounded-research-desk": {
    downloads: 2210,
    votes: 158,
    efficacy: 82,
    reliability: 76,
    transparency: 90,
    cost: 52,
    featured: true,
    comments: [
      {
        id: "c1",
        author: AUTHORS.lupo,
        body: "Transparency 90 is fair — the citation trail per claim makes it trivial to audit. Wish more blueprints did this.",
        createdAt: "2026-06-03",
        votes: 22,
      },
    ],
  },

  "guarded-merge-bot": {
    downloads: 5410,
    votes: 276,
    efficacy: 88,
    reliability: 90,
    transparency: 84,
    cost: 62,
    comments: [
      {
        id: "c1",
        author: AUTHORS.kwame,
        body: "Good honest example of why the gate matters. Autonomy 3 isn't a failure — five of the six nodes run themselves, and the one that doesn't is the merge. For merges that's the point.",
        createdAt: "2026-03-30",
        votes: 30,
      },
    ],
  },

  "frontline-triage": {
    downloads: 1890,
    votes: 121,
    efficacy: 79,
    reliability: 83,
    transparency: 72,
    cost: 68,
    comments: [],
  },

  "schema-forge-etl": {
    downloads: 2640,
    votes: 167,
    efficacy: 81,
    reliability: 89,
    transparency: 78,
    cost: 55,
    comments: [
      {
        id: "c1",
        author: AUTHORS.orin,
        body: "The repair loop is the difference between 'demo' and 'prod'. Set the max-repair count or it'll chew tokens on genuinely broken input.",
        createdAt: "2026-05-10",
        votes: 19,
      },
    ],
  },

  "nightly-data-janitor": {
    downloads: 1320,
    votes: 88,
    efficacy: 77,
    reliability: 91,
    transparency: 74,
    cost: 61,
    comments: [],
  },

  "starter-software-factory": {
    downloads: 8940,
    votes: 386,
    efficacy: 71,
    reliability: 84,
    transparency: 96,
    cost: 24,
    seed: true,
    comments: [
      {
        id: "c1",
        author: AUTHORS.lupo,
        body: "Five nodes and the interesting part is the arrow that isn't drawn. I added planner -> builder locally just to see: security goes 4 → 2 and the analyzer names the builder as the reason. That's the argument for typed graphs in one edit.",
        createdAt: "2026-07-12",
        votes: 63,
      },
      {
        id: "c2",
        author: AUTHORS.sol,
        body: "The bit people miss is the second half. Deleting the edge isn't isolation on its own — paste the planner's wording into the builder's spec and the similarity check picks it up with the DOT untouched. This bundle is the one that keeps both halves honest.",
        createdAt: "2026-07-19",
        votes: 44,
      },
      {
        id: "c3",
        author: AUTHORS.orin,
        // §8 again, from the other direction: a note is free text and nothing validates
        // it, so a seeded one must not assert what the cost row a few hundred pixels
        // above it denies. This note used to read "Cost 24 is real" while the scorecard
        // said 0 runs and named the same figure a placeholder — the row was honest and
        // the note next to it undid the row. Nobody has run anything, so the note talks
        // about the shape of the graph, which is the part a reader can check.
        body: "Handed this to two non-engineers as a first factory. Both got the debug loop immediately once they saw it never goes back to the builder. Five nodes and one loop is about as small as a factory gets before it stops being one.",
        createdAt: "2026-07-24",
        votes: 18,
      },
    ],
  },

  "incident-commander": {
    downloads: 970,
    votes: 74,
    efficacy: 80,
    reliability: 85,
    transparency: 81,
    cost: 64,
    comments: [
      {
        id: "c1",
        author: AUTHORS.sol,
        body: "Security 19 is the lowest in the gallery for a reason — this thing can execute runbooks. Read the required scopes before you run it.",
        createdAt: "2026-06-25",
        votes: 24,
      },
    ],
  },
};

/** The row for a slug, or a zeroed one — a blueprint nobody has voted on yet. */
export function communityFor(slug: string): CommunitySignals {
  return (
    COMMUNITY[slug] ?? {
      downloads: 0,
      votes: 0,
      comments: [],
      efficacy: 0,
      reliability: 0,
      transparency: 0,
      cost: 0,
    }
  );
}
