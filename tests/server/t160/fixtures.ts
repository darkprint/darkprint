/* ============================================================
   T160 — fixtures, and the state the weighting cells stand on

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── BALLOTS are cast through the module; ACCOUNTS and BUNDLES
      are seeded by raw SQL ──
   Every `ballot` row in this suite is created by `castBallot`.
   That is D-70-22's lesson taken literally: T070's blind suite
   "covered" the `released_at` trap only because a fixture
   manufactured a row in a state the ruling says cannot occur, so a
   broken predicate read the right way and the mutation was caught
   by accident. A hand-written `ballot` row is exactly that hazard
   here, because whatever `castBallot` normalises about a vote is
   precisely what a hand-written row would skip.

   `account` and `bundle` are seeded by raw SQL and the difference
   is deliberate rather than convenient. Neither carries a
   cross-column invariant a raw insert could violate — an account
   is `(github_id, github_login, handle)` plus independent profile
   columns, a bundle is `(owner, slug, visibility)` — so there is
   no impossible row to manufacture, which is the property D-70-22
   is actually about. Going through `upsertFromGitHub`/
   `createBundle` would instead make this suite red for T050's and
   T100's reasons, and a blind suite whose fixture depends on two
   other tasks' modules cannot tell their failure from its own
   subject's.

   ── every premise is ASSERTED at seed time ──
   A weighting cell is arithmetic over stored state, so a fixture
   that silently failed to store what it says it stored inverts the
   result instead of failing. `castBallotAsserted` reads the row
   back and checks the metric it just wrote; `grantValidator`
   checks the update touched exactly one row and that the weight
   round-tripped as the number it was given. A broken fixture reds
   as a broken fixture.

   ── the weight round-trip is a hazard of its own ──
   `account.validator_weight` is `numeric(6,3)`, and node-postgres
   hands a `numeric` back as a STRING by default. `"1" + "0.5"` is
   `"10.5"`, so an implementation summing weights without coercing
   produces a denominator ten times too large and still answers a
   plausible number. `seedAccount` asserts the value it reads back
   equals the number it wrote, so a fixture can never be the thing
   that hid that; `weighting.test.ts` has a cell aimed at it
   directly.
   ============================================================ */

import {
  BALLOT_COLUMNS,
  METRICS,
  type Metric,
  type Scratch,
  bind,
  describe_,
  dropScratchDatabases,
  mark,
  scratchDatabase,
} from "./contract";

export type { Scratch, Metric };

/** One scratch database per suite file; vitest gives each file its own worker. */
export async function openDatabase(): Promise<Scratch> {
  return scratchDatabase();
}

export async function closeDatabase(): Promise<void> {
  await dropScratchDatabases();
}

/* --------------------- accounts --------------------- */

export interface AccountFixture {
  id: string;
  handle: string;
  /** The weight this account's votes carry, as the fixture set it. */
  weight: number;
  validator: boolean;
}

/**
 * An account with an explicit vote weight.
 *
 * `weight` defaults to `1`, which is the column's own `NOT NULL DEFAULT 1` — stated rather
 * than left implicit, because a cell asserting a weighted answer against accounts that all
 * happen to sit at the default is a cell no weighting implementation can fail.
 *
 * ── `validator` DEFAULTS TO FALSE AT EVERY WEIGHT, AND THAT IS AN ASSERTION ──
 * D-WAVE-08 F-160-F3: a vote's weight is `account.validator_weight` UNCONDITIONALLY, and the
 * `validator` boolean does not gate it — "the boolean is a display fact, never a second
 * source for one quantity."
 *
 * So every heavy voter this suite seeds carries `validator = false`. A module reading
 * `actor.validator ? weight : 1` then answers the UNWEIGHTED mean in every weighting cell in
 * the suite, and every one of them reds. Seeding the badge alongside the weight — which is
 * what this fixture did while F-160-F3 was open — would have made all of them pass against
 * that module, because the two fields would never have disagreed.
 *
 * `setBadge` drives the boolean on its own, for the one cell whose subject IS the boolean.
 */
export async function seedAccount(
  s: Scratch,
  o: { label?: string; weight?: number; validator?: boolean } = {},
): Promise<AccountFixture> {
  const handle = mark(o.label ?? "t160");
  const weight = o.weight ?? 1;
  const validator = o.validator ?? false;
  const [row] = await s.query(
    "insert into account (github_id, github_login, handle, validator, validator_weight) " +
      "values ($1, $2, $3, $4, $5) returning id, validator, validator_weight",
    [`gh-${handle}`, `login-${handle}`, handle, validator, String(weight)],
  );
  const id = row?.id;
  if (typeof id !== "string" || id === "") {
    throw new Error(`Could not seed an account: its id came back as ${describe_(id)}.`);
  }
  /* The round trip, asserted rather than assumed. `numeric` comes back as a string, and a
     fixture that wrote `1` where it meant `3` would make every weighting cell below vacuous
     while every one of them still passed. */
  const storedWeight = Number(row?.validator_weight);
  if (!Number.isFinite(storedWeight) || storedWeight !== weight) {
    throw new Error(
      `Seeding ${handle} at weight ${weight} stored ${JSON.stringify(row?.validator_weight)}, ` +
        `which reads back as ${storedWeight}. Every weighting cell is arithmetic over this ` +
        `number; a fixture that cannot set it makes all of them vacuous.`,
    );
  }
  if (row?.validator !== validator) {
    throw new Error(
      `Seeding ${handle} with validator=${validator} stored ${describe_(row?.validator)}.`,
    );
  }
  return { id, handle, weight, validator };
}

/**
 * AC5's act, applied to an account that already voted — and it moves ONE COLUMN.
 *
 * D-WAVE-08 restates the criterion: AC5's sentence changes from "granting a validator badge"
 * to "RAISING AN ACCOUNT'S `validator_weight`", because as written it named an act that
 * changes nothing. A cell that granted the badge and asserted the aggregate moved would red
 * a correct module. `backend.md`'s own acceptance-criteria LINE still reads "granting a
 * validator badge"; the ruling is later and governs, and the divergence is reported.
 *
 * `validator` is deliberately NOT touched here. Leaving it false across the raise is what
 * makes `retroactive.test.ts` a test of the ruled reading rather than of both fields at once.
 *
 * This function does the raising half of AC5; `assertBallotsUntouched` does the
 * without-recasting half, because a module recomputing by rewriting every ballot satisfies
 * the visible change and violates the clause that follows it.
 */
export async function raiseWeight(s: Scratch, accountId: string, weight: number): Promise<void> {
  const rows = await s.query(
    "update account set validator_weight = $2 where id = $1 returning validator, validator_weight",
    [accountId, String(weight)],
  );
  if (rows.length !== 1) {
    throw new Error(
      `Raising ${accountId} to weight ${weight} touched ${rows.length} rows, expected 1. The ` +
        `premise of every AC5 cell is that the raise really happened.`,
    );
  }
  const stored = Number(rows[0]?.validator_weight);
  if (stored !== weight) {
    throw new Error(
      `The raise stored ${JSON.stringify(rows[0]?.validator_weight)} where ${weight} was asked ` +
        `for; AC5's second read would then be measuring a weight nobody set.`,
    );
  }
  if (rows[0]?.validator !== false) {
    throw new Error(
      `Raising the weight also moved \`validator\` to ${String(rows[0]?.validator)}. The point ` +
        `of this fixture is that exactly one column moves, so a red downstream is about the ` +
        `column D-WAVE-08 ruled load-bearing and not about the pair.`,
    );
  }
}

/**
 * The `validator` boolean on its own, for the one cell whose subject IS the boolean.
 *
 * D-WAVE-08 rules it a display fact that never reaches the arithmetic. That is a claim a
 * cell can hold only by moving it while nothing else moves and requiring the aggregate to
 * stand still — the mirror of `raiseWeight`, and the half that catches an implementation
 * multiplying by the badge.
 */
export async function setBadge(s: Scratch, accountId: string, validator: boolean): Promise<void> {
  const rows = await s.query(
    "update account set validator = $2, validator_since = case when $2 then now() else null end " +
      "where id = $1 returning validator, validator_weight",
    [accountId, validator],
  );
  if (rows.length !== 1) {
    throw new Error(
      `Setting the badge on ${accountId} touched ${rows.length} rows, expected 1.`,
    );
  }
  if (rows[0]?.validator !== validator) {
    throw new Error(`The badge stored ${String(rows[0]?.validator)}, not ${validator}.`);
  }
}

/* --------------------- bundles --------------------- */

export interface BundleFixture {
  /** `ballot.bundle_id` — B-11 keys the ballot on the BUNDLE, never on a release. */
  id: string;
  ownerId: string;
  slug: string;
}

export async function seedBundle(
  s: Scratch,
  o: { ownerId: string; visibility?: "public" | "private"; slug?: string },
): Promise<BundleFixture> {
  const slug = o.slug ?? mark("bp");
  const [row] = await s.query(
    "insert into bundle (owner_id, slug, visibility) values ($1, $2, $3) returning id",
    [o.ownerId, slug, o.visibility ?? "public"],
  );
  const id = row?.id;
  if (typeof id !== "string" || id === "") {
    throw new Error(`Could not seed a bundle: its id came back as ${describe_(id)}.`);
  }
  return { id, ownerId: o.ownerId, slug };
}

/* --------------------- ballots, through the module --------------------- */

export interface StoredBallot {
  accountId: string;
  bundleId: string;
  efficacy: number | null;
  reliability: number | null;
  transparency: number | null;
  updatedAt: string;
}

function storedOf(row: Record<string, unknown>): StoredBallot {
  const asMetric = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  return {
    accountId: String(row.account_id),
    bundleId: String(row.bundle_id),
    efficacy: asMetric(row.efficacy),
    reliability: asMetric(row.reliability),
    transparency: asMetric(row.transparency),
    updatedAt: String(row.updated_at),
  };
}

/** Every `ballot` row for one bundle, ordered so two reads are comparable element-wise. */
export async function ballotRows(s: Scratch, bundleId: string): Promise<StoredBallot[]> {
  const rows = await s.query(
    `select ${BALLOT_COLUMNS.join(", ")} from ballot where bundle_id = $1 order by account_id`,
    [bundleId],
  );
  return rows.map(storedOf);
}

/** Every `ballot` row there is, for the refusal cells that ask what a write left behind. */
export async function allBallotRows(s: Scratch): Promise<StoredBallot[]> {
  const rows = await s.query(
    `select ${BALLOT_COLUMNS.join(", ")} from ballot order by account_id`,
  );
  return rows.map(storedOf);
}

/**
 * Casts one vote and ASSERTS THE ROW LANDED, returning what `castBallot` answered.
 *
 * The read-back is the premise of every arithmetic cell downstream. Without it, a `castBallot`
 * that stored nothing would leave `getAggregate` correctly answering the aggregate of an empty
 * set, and a weighting cell would report the wrong defect against the wrong function.
 *
 * Only the metrics this call actually passed are checked. Whether an omitted metric survives a
 * later cast is F-160-E and is UNRULED, so a fixture that asserted anything about one would be
 * choosing a reading the contract has not made.
 */
export async function castBallotAsserted(
  s: Scratch,
  actor: unknown,
  accountId: string,
  bundleId: string,
  vote: Partial<Record<Metric, number>>,
): Promise<unknown> {
  const castBallot = await bind("castBallot");
  const answer = await castBallot(s.db, actor, bundleId, vote);

  const rows = await s.query(
    `select ${BALLOT_COLUMNS.join(", ")} from ballot where bundle_id = $1 and account_id = $2`,
    [bundleId, accountId],
  );
  if (rows.length !== 1) {
    throw new Error(
      `castBallot(${JSON.stringify(vote)}) left ${rows.length} rows for this (account, bundle), ` +
        `expected exactly 1.\n` +
        `  \`ballot_account_bundle_key\` is AC2's guarantee: one account has one ballot per ` +
        `blueprint, carried across releases. Every arithmetic cell below stands on this row.`,
    );
  }
  const stored = storedOf(rows[0]);
  for (const metric of METRICS) {
    const asked = vote[metric];
    if (asked === undefined) continue;
    if (stored[metric] !== asked) {
      throw new Error(
        `castBallot asked for ${metric}=${asked} and the row holds ${describe_(stored[metric])} ` +
          `(${String(stored[metric])}).\n` +
          `  This is a broken PREMISE, not a weighting failure: an aggregate over votes that ` +
          `were never stored is arithmetic over the empty set, and the cell downstream would ` +
          `charge the wrong function.`,
      );
    }
  }
  return answer;
}

/**
 * AC5's second clause: "without any vote being recast."
 *
 * Compared ELEMENT-WISE by account and by value, never by count. Equal counts are not equal
 * state — a set of the same size with different contents has passed a comparison like this
 * before — and an implementation that recomputed the aggregate by rewriting every ballot
 * would keep the count exactly.
 *
 * `updated_at` is part of the comparison and it is the load-bearing half: a rewrite that
 * stored the same values still moves it.
 */
export function assertBallotsUntouched(
  before: readonly StoredBallot[],
  after: readonly StoredBallot[],
  where: string,
): void {
  const render = (rows: readonly StoredBallot[]): string =>
    rows.map((r) => JSON.stringify(r)).join("\n    ");
  if (before.length !== after.length) {
    throw new Error(
      `${where}: the ballot rows went from ${before.length} to ${after.length}.\n` +
        `  AC5: granting a badge changes the aggregate "without any vote being recast".\n` +
        `  before:\n    ${render(before)}\n  after:\n    ${render(after)}`,
    );
  }
  for (let i = 0; i < before.length; i += 1) {
    const b = before[i];
    const a = after[i];
    const differing = (Object.keys(b) as (keyof StoredBallot)[]).filter((k) => b[k] !== a[k]);
    if (differing.length > 0) {
      throw new Error(
        `${where}: ballot row ${i} changed in ${differing.join(", ")}.\n` +
          `  AC5 forbids exactly this: the aggregate is recomputed from stored votes and ` +
          `CURRENT weights at read time, so nothing about a vote may move when a badge is ` +
          `granted. A rewrite that stored identical values still moves \`updated_at\`.\n` +
          `  before: ${JSON.stringify(b)}\n  after:  ${JSON.stringify(a)}`,
      );
    }
  }
}
