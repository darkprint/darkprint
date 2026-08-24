/* ============================================================
   T180 — the scratch database and the planting instruments

   Not a test file.

   Every fixture writes through RAW SQL rather than through
   `submitReport`. Two reasons, and the second is the one that
   matters: a read cell planted through the write path tests the
   pair rather than the read, so a module that mis-stores and
   mis-reads symmetrically passes; and a fixture failure inside
   another task's module reds with that module's name on it.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { createTestDb, type TestDb } from "@/tests/support";

import type { Row } from "./contract";

/* ============================================================
   setup that reds per cell instead of skipping

   A throw in `beforeAll` produces SKIPS, not reds: the run
   stands down rather than failing, and a skipped criterion is
   invisible in the totals — measured at 127 merged cells going
   silent under one broken writer. Per-criterion reds belong in
   the cells.

   Its own copy rather than an import from another task's
   `contract.ts`: this suite's partition is `tests/server/t180/**`
   and a helper that another task can edit is a helper that can
   change what this suite means without anyone touching it.
   ============================================================ */

export class RecordedSetup<T> {
  private value: T | undefined;
  private failure: unknown;
  private ran = false;

  constructor(private readonly what: string) {}

  async run(make: () => Promise<T>): Promise<void> {
    this.ran = true;
    try {
      this.value = await make();
    } catch (cause) {
      this.failure = cause;
    }
  }

  /** The set-up value, or a red carrying the setup failure. Call this FIRST in every cell. */
  require(): T {
    if (this.failure !== undefined) {
      throw new Error(
        `${this.what} could not be set up, so this criterion was NEVER EXERCISED.\n` +
          `  Re-raised per cell on purpose: a throw in \`beforeAll\` skips, and a skipped ` +
          `criterion is invisible in the totals.\n` +
          `  Cause: ${this.failure instanceof Error ? this.failure.stack : String(this.failure)}`,
      );
    }
    if (!this.ran || this.value === undefined) {
      throw new Error(`${this.what} was never set up: the \`beforeAll\` did not run.`);
    }
    return this.value;
  }

  /** For teardown, which must not itself throw when setup never produced anything. */
  optional(): T | undefined {
    return this.failure === undefined ? this.value : undefined;
  }
}

/* ============================================================
   the scratch database
   ============================================================ */

export interface Scratch extends TestDb {
  /** The account every planted report is submitted by, unless a cell says otherwise. */
  submitterId: string;
  /** A second account, so "somebody else's blueprint" is expressible. */
  strangerId: string;
  /** `submitterId` owns this bundle — AC5's "one's own blueprint". */
  ownBundleId: string;
  /** `strangerId` owns this one. */
  strangerBundleId: string;
  /** A release of `strangerBundleId`, at `DIGEST`. */
  releaseId: string;
  /** A release of `ownBundleId`, at `OWN_DIGEST`. */
  ownReleaseId: string;
}

/**
 * A digest that exists, and one that does not.
 *
 * `bundleDigest({ dot, cardDigests })` reads neither owner nor slug nor version
 * (D-05-01), so two releases can legitimately share a digest and `release.digest` carries
 * a non-unique index. Nothing here depends on uniqueness.
 */
export const DIGEST = "sha256:0400893b1f2c4d5e6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e";
export const OWN_DIGEST = "sha256:11a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90112233445566778899aabbccd";
export const ABSENT_DIGEST = "sha256:deadbeef00000000000000000000000000000000000000000000000000000000";

export async function scratchDatabase(): Promise<Scratch> {
  const db = await createTestDb();
  const q = db.client.query.bind(db.client);

  const accounts = await q<{ id: string }>(
    `insert into "account" (github_id, github_login, handle)
     values ($1, $2, $3), ($4, $5, $6) returning id`,
    ["9180001", "t180-submitter", "t180-submitter", "9180002", "t180-stranger", "t180-stranger"],
  );
  if (accounts.rows.length !== 2) {
    throw new Error(`expected two accounts, got ${accounts.rows.length}`);
  }
  const [submitterId, strangerId] = accounts.rows.map((r) => r.id);

  const bundles = await q<{ id: string }>(
    `insert into "bundle" (owner_id, slug) values ($1, $2), ($3, $4) returning id`,
    [submitterId, "t180-own", strangerId, "t180-stranger"],
  );
  const [ownBundleId, strangerBundleId] = bundles.rows.map((r) => r.id);

  const releases = await q<{ id: string }>(
    `insert into "release" (bundle_id, version, digest, dot, manifest, card_refs, card_digests)
     values ($1, '1.0.0', $2, 'digraph {}', '{}'::jsonb, '{}', '{}'),
            ($3, '1.0.0', $4, 'digraph {}', '{}'::jsonb, '{}', '{}')
     returning id`,
    [strangerBundleId, DIGEST, ownBundleId, OWN_DIGEST],
  );
  const [releaseId, ownReleaseId] = releases.rows.map((r) => r.id);

  return { ...db, submitterId, strangerId, ownBundleId, strangerBundleId, releaseId, ownReleaseId };
}

/* ============================================================
   planting reports
   ============================================================ */

export interface PlantedReport {
  digest?: string;
  accountId?: string;
  model?: string;
  provider?: string;
  hardware?: string;
  inputSize?: number;
  harnessVersion?: string;
  costUnits: number;
  durationMs?: number;
  reportedAt?: Date;
}

/**
 * Rows straight into `run_report`, one statement per row so a rejection names its row.
 *
 * `cost_units` is passed as a STRING. The column is unqualified `numeric` (D-05-09) and
 * `pg` sends a JS number through `float8` formatting, which is the exact round-trip loss
 * that ruling exists to keep out of the column — a fixture that reintroduced it would be
 * measuring the driver rather than the module.
 */
export async function plantReports(
  scratch: Scratch,
  reports: readonly PlantedReport[],
): Promise<void> {
  for (const [i, r] of reports.entries()) {
    await scratch.client.query(
      `insert into "run_report"
         (release_digest, account_id, model, provider, hardware, input_size,
          harness_version, cost_units, duration_ms, reported_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        r.digest ?? DIGEST,
        r.accountId ?? scratch.submitterId,
        r.model ?? MODAL_MODEL,
        r.provider ?? "anthropic",
        r.hardware ?? "m3-max-64gb",
        r.inputSize ?? 4096,
        r.harnessVersion ?? "darkprint-cli/0.4.1",
        String(r.costUnits),
        r.durationMs ?? 1000 + i,
        r.reportedAt ?? new Date(Date.UTC(2026, 7, 1, 12, 0, i)),
      ],
    );
  }
}

/**
 * A release at a digest no other cell uses, returned for that cell to plant against.
 *
 * **Cells in one file share one scratch database**, so a digest shared between them
 * accumulates: a cell planting twelve reports after a cell that planted three aggregates
 * fifteen, and every pre-registered count is then wrong in a way that reads as an
 * implementation defect. Per-cell digests make each aggregation cell a closed population.
 *
 * The release is planted against `strangerBundleId` so the default case stays "somebody
 * else's blueprint", which is what B-16 is about.
 */
export async function freshDigest(scratch: Scratch, label: string): Promise<string> {
  const digest = `sha256:${label.padEnd(8, "0").slice(0, 8)}${randomUUID().replaceAll("-", "")}${"0".repeat(24)}`.slice(0, 71);
  await scratch.client.query(
    `insert into "release" (bundle_id, version, digest, dot, manifest, card_refs, card_digests)
     values ($1, $2, $3, 'digraph {}', '{}'::jsonb, '{}', '{}')`,
    [scratch.strangerBundleId, `1.0.0-${label}`, digest],
  );
  return digest;
}

/** Every `run_report` row at a digest, for cells that assert what a writer LEFT BEHIND. */
export async function reportsAt(scratch: Scratch, digest: string): Promise<Row[]> {
  const rows = await scratch.client.query(
    `select * from "run_report" where release_digest = $1 order by reported_at`,
    [digest],
  );
  return rows.rows as Row[];
}

/**
 * Every `audit` row, for the B-14 boundary cell.
 *
 * Ordered by `occurred_at`, which is the column `audit` actually has. It was written as
 * `created_at` first — the name every other table in this schema uses — and the two
 * boundary cells then reddened with `column "created_at" does not exist` while their
 * subject was the absent module. A red that reports a plausible wrong cause is worse than
 * no red: both cells looked like the blind position and neither was.
 */
export async function auditRows(scratch: Scratch): Promise<Row[]> {
  const rows = await scratch.client.query(`select * from "audit" order by occurred_at`);
  return rows.rows as Row[];
}

/* ============================================================
   the AC4 fixture, and why it is TWELVE rows and not five

   `max|z|` over n values is bounded by sqrt(n-1) for a
   population standard deviation, so NO fixture of ten or fewer
   can ever produce `excluded > 0` — whatever the values are.
   Measured: n=5 -> 2.0000, n=10 -> 3.0000, n=11 -> 3.1623.

   `minRuns` is 5, so the natural fixture size is exactly the one
   on which AC4 is unfalsifiable: it would pass with `excluded: 0`
   against a correct module, against one whose filter was deleted,
   and against one that never had a filter. A cell no mutation
   can red is what this suite is hunting, so the size is twelve.

   The consequence is a contract fact rather than a fixture
   detail: AC4 and AC2 NEVER co-fire, and every aggregate
   `isSample` marks as a sample carries `excluded: 0` of
   necessity.
   ============================================================ */

export const MODAL_MODEL = "claude-sonnet-4-5";

/**
 * Chosen to sort BEFORE `MODAL_MODEL`, and that is the whole point of the name.
 *
 * **It was `gpt-4o` and the adversary sweep found that inert.** `claude-sonnet-4-5` sorts
 * before `gpt-4o`, so the modal group was also the alphabetically first group, and a
 * mutation replacing "take the modal group" with "take the first sorted group" reddened
 * `names the modal model` not at all — the two readings agreed on the fixture. A cell
 * asserting a value its subject's other path already produces tests nothing.
 *
 * `azure-gpt-4o` sorts before `claude-sonnet-4-5`, so modal and alphabetically-first now
 * DISAGREE and the mutation reds.
 */
export const MINORITY_MODEL = "azure-gpt-4o";

/** Twelve costs on `MODAL_MODEL`; the last is the 3-sigma outlier. */
export const MODAL_COSTS = [10, 12, 14, 15, 17, 19, 21, 23, 26, 29, 33, 400] as const;

/** Three costs on `MINORITY_MODEL`, far from the modal group so a mixed read is visible. */
export const MINORITY_COSTS = [500, 510, 520] as const;

/* ============================================================
   D-180-02's two consequences, as fixtures

   `n` in the n>=11 bound is the MODAL GROUP's size, not the
   report count at the digest, and `runs`/`isSample` are the
   group's. So a digest can carry many reports and still return
   a sample — and a fixture built to clear the bound at the
   digest level does not clear it.
   ============================================================ */

/** Four models at three reports, one at four: sixteen at the digest, modal group of FOUR. */
export const GROUPED_MODELS = [
  { model: "model-a", costs: [11, 13, 15] },
  { model: "model-b", costs: [21, 23, 25] },
  { model: "model-c", costs: [31, 33, 35] },
  { model: "model-d", costs: [41, 43, 45] },
  { model: "model-e", costs: [51, 53, 55, 57] },
] as const;

/**
 * The modal group is `model-e` with four, so the aggregate is a SAMPLE over sixteen reports.
 *
 * `excluded: 0` here is arithmetic and not measurement — max|z| at n=4 is sqrt(3) = 1.73,
 * so nothing can be filtered. Recorded so this cell is never read as covering AC4.
 */
export const GROUPED_EXPECTED = {
  runs: 4,
  excluded: 0,
  model: "model-e",
  isSample: true,
} as const;

/**
 * `median` and `spread` are deliberately NOT pre-registered here.
 *
 * Over `[51, 53, 55, 57]` the median falls between two data points — 54 by linear
 * interpolation, 55 by nearest-rank — and p10/p90 land at 51.6/56.4 or 51/57 by the same
 * split. The contract publishes no percentile convention, so pinning either would charge a
 * defect over a choice nobody made. `runs`, `excluded`, `isSample` and `model` are what
 * D-180-02 is about and all four are convention-free. Same discipline as `ONE_PASS_EXPECTED`.
 */

/** What a module reading the DIGEST-level count returns instead: sixteen runs, not a sample. */
export const DIGEST_LEVEL_WRONG = { runs: 16, isSample: false } as const;

/**
 * Two models at equal counts, planted `zulu` FIRST so first-written and first-sorted differ.
 *
 * D-180-02 resolves a tie to the lexicographically smallest model name. Planting the
 * larger name first means a module taking the first row, the last row, or an arbitrary
 * map entry lands on `zulu-model` and reds; only the ruled rule returns `alpha-model`.
 * The two cost sets are disjoint so the median says which group answered.
 */
export const TIE_FIRST_PLANTED = { model: "zulu-model", costs: [90, 92, 94, 96, 98, 100] } as const;
export const TIE_EXPECTED_WINNER = { model: "alpha-model", costs: [10, 12, 14, 16, 18, 20] } as const;

/**
 * What `reportedCost` must return over `MODAL_COSTS` + `MINORITY_COSTS` at one digest.
 *
 * Derived from the ruled semantics — 3 sigma over `costUnits`, POPULATION sd, ONE pass,
 * grouped by `model` and returning the modal group — and pre-registered here rather than
 * computed in a cell, so a cell cannot quietly agree with an implementation's arithmetic.
 *
 * `runs` is what survived and `excluded` is what did not, so the two sum to the modal
 * group's size: 11 + 1 = 12.
 *
 * **The percentiles land exactly on data points and that is deliberate.** With eleven
 * survivors, index 10*0.1 = 1 and 10*0.9 = 9 are integers, so linear interpolation and
 * nearest-rank agree. The contract publishes no percentile convention; a fixture that
 * needed one would charge a defect over a choice nobody made.
 */
/**
 * A population that separates ONE PASS from ITERATED-TO-FIXPOINT.
 *
 * **Added because a mutation of mine reddened nothing and the zero was the fixture.**
 * Iterating on `MODAL_COSTS` reaches a fixpoint after the first removal pass — max|z|
 * falls 3.3100 -> 1.8843 — so one pass and convergence produce the identical answer there
 * and the ruled semantics was unguarded by a suite that asserted it in a comment.
 *
 * Eleven tight values plus two outliers at different distances: removing 400 shrinks the
 * sd enough that 60 crosses 3 sigma on a second pass. One pass keeps twelve; convergence
 * keeps eleven.
 *
 * Only `runs` and `excluded` are pre-registered. The survivors' median falls BETWEEN two
 * data points here, so asserting it would charge a defect over a percentile convention the
 * contract never published — and `runs`/`excluded` are what separate the two readings.
 */
export const TWO_PASS_COSTS = [20, 20.5, 21, 21.5, 22, 22.5, 23, 23.5, 24, 24.5, 25, 60, 400] as const;

/** One pass, which is what was ruled. */
export const ONE_PASS_EXPECTED = { runs: 12, excluded: 1 } as const;

/** Convergence, named so the assertion can EXCLUDE it rather than merely admit the truth. */
export const ITERATED_WRONG = { runs: 11, excluded: 2 } as const;

export const MODAL_EXPECTED = {
  runs: 11,
  excluded: 1,
  median: 19,
  spread: { p10: 12, p90: 29 },
  model: MODAL_MODEL,
  isSample: false,
} as const;

/**
 * The outputs a wrong module produces, named so assertions can EXCLUDE them.
 *
 * A comment that names a bad output while the assertion merely admits the good one reads
 * as coverage to everyone downstream. Each of these differs from `MODAL_EXPECTED` in
 * `runs`, in `excluded` AND in `median`, so no single-field assertion is load-bearing
 * alone and no bad output is one rounding away from the right one.
 */
export const WRONG_OUTPUTS = {
  /** Aggregated across both models instead of grouping: the z-score mixes distributions. */
  ungrouped: { runs: 15, excluded: 0, median: 23 },
  /** Modal group, but the outlier filter never ran. */
  unfiltered: { runs: 12, excluded: 0, median: 20 },
} as const;
