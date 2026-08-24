/* ============================================================
   T160 — the blind contract surface

   Not a test file. `vitest.config.ts` collects
   `tests/**\/*.test.ts` and this module is imported by the suites
   beside it.

   ── what this author could and could not see ──
   GIVEN, and read: `backend.md`'s §T160, §T005, §T060, §T140 and
   §T240 with every `D-` ruling in them; `lib/db/schema.ts`;
   `lib/core/config.ts`; `lib/server/policy/types.ts`;
   `lib/server/observability/{types.ts,types.test.ts}`;
   `lib/data/community.ts`; `lib/content/view.ts`;
   `components/upload/UploadFlow.tsx`; `tests/support/**`; the
   merged blind suite under `tests/server/t140/`.

   T160's OWN, and never opened: `lib/server/ballot/**`,
   `app/api/votes/**`, the branch `feat/t160-ballot`. Its
   implementer was not contacted.

   ── the pins are LITERALS, and so is every expected number ──
   No expected value in this suite is computed by a helper. The
   weighted mean is written out as arithmetic in the cell's own
   comment and lands in the assertion as a literal, because "a
   reference or oracle written by the author of the assertions is a
   consistency check, never a second axis" — a `weightedMean()`
   helper here would carry whatever misreading the cells carry and
   no mutation could separate the two. A later change deriving one
   of these numbers from a helper, or from the module, is a REMOVED
   ASSERTION and is to be treated as one.

   ── THE WEIGHTING RULE, which is what this task is for ──
   A weighting criterion tested against ONE voter is satisfiable by
   an implementation that ignores weight entirely: with a single
   vote the weight cancels in numerator and denominator, so w=1 and
   w=1000 answer the same number. So does a pair of voters whose
   weights happen to coincide, and so does a pair whose VALUES
   coincide. Every weighting cell in `weighting.test.ts` therefore
   drives at least two voters with DIFFERENT weights and DIFFERENT
   values, chosen so that:

     * the weighted answer and the constant-weight answer are both
       EXACT INTEGERS and are DIFFERENT from each other, and
     * the assertion EXCLUDES the constant-weight answer BY NAME,
       alongside every other wrong reading the fixture separates.

   Excluding the bad output rather than admitting the good one is
   the whole difference between an instrument and a cell that
   resolves. Each cell says in its own comment which numbers it
   excludes and what implementation each of them is.

   The one cell that does NOT discriminate weight says so out loud
   (`aggregates each metric independently`), because a cell that
   cannot fail for the reason its neighbours can is exactly the
   thing a later reader will cite as coverage.

   ── the nine charges filed before a cell was written ──
   Reported at `3290981`. Six came back as D-WAVE-08 and the block
   was amended; three are still open and are named at the end.

   THE HELD CELLS, and holding them is why neither half built the
   wrong one. Three cells in this suite did not exist until the
   ruling, because each had two live readings and either choice
   would have been a false defect report against whoever built the
   other:

   F-160-B  RULED: T160 WRITES NO AUDIT ROW and there is no audit
            criterion. `ballot.cast` is WITHDRAWN from
            `AUDIT_ACTIONS` — it reds `types.test.ts`'s exclusion
            cell, whose regex names `ballot` literally, and
            D-240-09's rationale named a VALIDATOR-GRANT action
            while §T160 puts that workflow out of scope. "A caller
            with no criterion behind it is the same object as a
            member with no caller." **There is no audit cell
            anywhere in this suite and that is now correct rather
            than pending.**

   F-160-E  RULED: `Partial<Ballot>` PATCHES; an absent member
            PRESERVES. `patch.test.ts` is the cell that holds it,
            and it carries its own predicted zero: the obvious
            mutation reds nothing on `drizzle-orm@^0.45.2` because
            `undefined` is dropped from the `SET` clause, measured
            through `toSQL()` rather than inferred.

   F-160-F3 RULED: a vote's weight is `account.validator_weight`
            UNCONDITIONALLY; the `validator` boolean does not gate
            it. **CONSEQUENCE: AC5's sentence becomes "raising an
            account's `validator_weight`"** — as written it named an
            act that changes nothing, and a cell granting the badge
            and asserting the aggregate moved would have redded a
            correct module. `backend.md`'s acceptance-criteria LINE
            still reads "granting a validator badge"; the ruling is
            later and governs, and that divergence is reported.
            Every heavy voter this suite seeds now carries
            `validator = false`, which turns every weighting cell
            into a test of the ruled reading.

   Also ruled: `sampleSize` is an UNWEIGHTED count per metric;
   `value` is UNROUNDED; a metric nobody voted on answers
   `{ value: 0, sampleSize: 0, isSample: true }`; and F-160-F3b,
   from T160's implementer — AC5 is observable ONLY with two or
   more voters on one metric holding DIFFERENT values, which is a
   property of the criterion rather than of whether a blind author
   happened to pick two numbers.

   ── STILL OPEN, and each is a silence rather than a guess ──
   * The CLASS and MESSAGE FORM of any refusal. §T160 publishes no
     error class at all, so nothing here pins one; what is asserted
     without a name is D-13's hygiene over whatever arrives, and
     that a refused write LEFT NOTHING BEHIND.
   * READ VISIBILITY of a private bundle's aggregate, and whether a
     caller who cannot see a bundle may cast on it.
   * T060's inherited-authority ruling, which §T160 does not
     restate and `can` cannot decide. See
     `inherited-authority.test.ts`, whose header says in as many
     words that a red there is a contract question.

   ── RESOLVED WITHOUT A CELL ──
   The route surface. `app/api/**` is DROPPED from this task's
   `Owns` for this wave (D-WAVE-02, module only), so the absence of
   a route cell here is the ruling rather than a gap. It was
   charged as F-160-D when the block still owned `app/api/votes/**`
   and published no method, path or body for it.

   ── why nothing here binds `can` ──
   `Resource` (`lib/server/policy/types.ts:16-20`) has no `ballot`
   member, so `can` cannot decide whether a caller may cast. The
   refusal is the module's own, which is D-240-10's charged-copy
   shape arriving a third time. This suite asserts the OUTCOME of a
   refusal and never its mechanism.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DARKPRINT_CONFIG } from "@/lib/core";
import type { Actor } from "@/lib/server/policy";
import { createDbClient, type DbClient } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const BALLOT = "@/lib/server/ballot";

let ballot: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, so every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 *
 * Called from inside each test and NEVER from a `beforeAll`. A hook that throws runs no test
 * and adds nothing to the failed column — it moves the SKIPPED count instead, and a run with
 * `skipped > 0` is invalid rather than zero. Per-criterion reds live in the cells.
 */
export function loadBallot(): Promise<Namespace> {
  ballot ??= import("@/lib/server/ballot").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${BALLOT} does not load.\n` +
          `  backend.md §T160 owns \`lib/server/ballot/**\` and publishes \`castBallot\` and ` +
          `\`getAggregate\` from the barrel \`${BALLOT}\`.\n` +
          `  This is a failed acceptance criterion — the ballot module is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves.\n` +
          `  If the barrel IS on disk, read this red against \`the barrel exists on disk\` in ` +
          `\`surface.test.ts\`: that cell is the only thing that separates *the module is not ` +
          `there* from *the first import of the graph crossed testTimeout*.`,
        { cause },
      );
    },
  );
  return ballot;
}

/**
 * The barrel's path on disk, resolved from this file rather than from the alias.
 *
 * A type-level or import-level instrument cannot observe its own blindness: an absent module
 * and a present module missing a member produce reds that read the same. This is the source
 * cell the blind brief asks for, and it is the discriminator for the barrel-transform trap
 * too — a `does not load` red beside a file that exists on disk is a LOAD failure and is a
 * false charge against the implementer if it is reported as an absent module.
 */
export function barrelPath(): string {
  return fileURLToPath(new URL("../../../lib/server/ballot/index.ts", import.meta.url));
}

export function barrelExists(): boolean {
  return existsSync(barrelPath());
}

/* ============================================================
   What the contract publishes, quoted verbatim

   §T160's Published signatures block, so a red says where a name
   comes from rather than merely that a test wanted it.
   ============================================================ */

export const PUBLISHED = {
  castBallot:
    "castBallot(db: Db, actor: Actor, bundleId: string, ballot: Partial<Ballot>): Promise<Aggregate>",
  getAggregate: "getAggregate(db: Db, actor: Actor, bundleId: string): Promise<Aggregate>",
} as const;

export type PublishedName = keyof typeof PUBLISHED;
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * The three metrics `Ballot` publishes, in the block's own order, written out.
 *
 * AC1 — "a ballot cannot write `autonomy` or `security`" — is satisfied BY CONSTRUCTION under
 * D-05-02: `Ballot` has exactly these three members and the `ballot` table has exactly these
 * three columns, so there is nothing to validate and nothing to forget. The assertion this
 * suite can make about it is therefore a KEY-SET assertion on both sides, not a validation
 * cell, and `surface.test.ts` makes it in both directions.
 */
export const METRICS = ["efficacy", "reliability", "transparency"] as const;
export type Metric = (typeof METRICS)[number];

/**
 * The axes a ballot may NOT write, and each one's reason, because a name in a deny list with
 * no reason beside it is the first thing a later reader deletes as redundant.
 *
 * `autonomy` and `security` are `source: "auto"` and the engine's alone (`lib/types.ts:36`);
 * `cost` is `reported` and T180's. All three are real members of the six-axis scorecard
 * `components/ui/ScoreRadar.tsx` draws, which is what makes them the plausible additions
 * rather than arbitrary strings.
 */
export const FORBIDDEN_AXES = ["autonomy", "security", "cost"] as const;

/** Exactly the keys `MetricAggregate` publishes. None is optional; a fourth is not published. */
export const METRIC_AGGREGATE_KEYS = ["isSample", "sampleSize", "value"] as const;

/**
 * The `ballot` table as `lib/db/schema.ts:399-416` declares it — the premise every cell here
 * stands on, asserted at least once rather than assumed.
 *
 * Written out rather than derived through drizzle for the reason T140 gives about
 * `PUBLISHED_KINDS`: a derived list makes this suite robust to the schema changing and BLIND
 * to it disagreeing with the contract, and those are opposite properties of one choice.
 */
export const BALLOT_COLUMNS = [
  "account_id",
  "bundle_id",
  "efficacy",
  "id",
  "reliability",
  "transparency",
  "updated_at",
] as const;

/**
 * The five-vote threshold, CONSUMED and never restated.
 *
 * §T160's block says so in as many words — `lib/core/config.ts:171-174`'s threshold is
 * "consumed, never restated" — and B-11 puts it in one place deliberately: `isSample` is
 * derived here so a caller never recomputes it. Every threshold cell sizes its fixture from
 * this constant, so the day the configured number moves the cells move with it. A literal
 * `5` anywhere in this suite would be a second source for one quantity.
 */
export const MIN_VOTES = DARKPRINT_CONFIG.telemetry.minRuns;

/* --------------------- binding --------------------- */

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Date) return "a Date";
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${BALLOT} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. backend.md's §T160 ` +
      `Published signatures block names this export exactly. Do not add a synonym here; ` +
      `publish the name the contract states.`,
  );
}

function asFn(value: unknown, name: string, clause: string): UnknownFn {
  if (typeof value !== "function") {
    throw new Error(
      `${BALLOT} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/** The two function bindings. `Ballot`, `MetricAggregate` and `Aggregate` are types. */
export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadBallot();
  return asFn(requireFrom(mod, name, PUBLISHED[name]), name, PUBLISHED[name]);
}

/* ============================================================
   `Aggregate`, asserted as a KEY SET over the RENDERING

   Over the rendering because `JSON.stringify` drops an
   `undefined`-valued key and keeps a `null`-valued one, and the
   radar receives the rendering. A response whose `sampleSize` is
   `undefined` has a `sampleSize` property and no sample size, and
   AC3 exists precisely because "the UI refuses to close the radar
   with a placeholder".

   The key set rather than a member check: checking one field
   asserts that today's extra is absent, where checking the set
   asserts that nothing outside the published shape is present at
   all — which is the only form in which AC1 is observable from
   the response side.
   ============================================================ */

export function rendered(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (text === undefined) {
    throw new Error(`the value does not survive JSON.stringify: ${describe_(value)}`);
  }
  return JSON.parse(text) as unknown;
}

export interface SeenMetric {
  value: number;
  sampleSize: number;
  isSample: boolean;
}

export type SeenAggregate = Record<Metric, SeenMetric>;

function assertMetricAggregate(value: unknown, where: string): SeenMetric {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where} renders as ${describe_(value)}; \`MetricAggregate\` is an object.`);
  }
  const shape = value as Record<string, unknown>;
  const keys = Object.keys(shape).sort();
  const expected = [...METRIC_AGGREGATE_KEYS];
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) {
    throw new Error(
      `${where} does not render as \`MetricAggregate\`.\n` +
        `  published: ${expected.join(", ")} (all three required, none optional)\n` +
        `  rendered:  ${keys.join(", ") || "(nothing)"}\n` +
        `  AC3: "an aggregate never returns without its sample size, because the UI refuses ` +
        `to close the radar with a placeholder." A record is what makes the value and its ` +
        `sample size impossible to separate; a missing key is that separation.`,
    );
  }
  const { value: v, sampleSize, isSample } = shape;
  /* EXCLUDES the bad output rather than admitting the good one. `typeof NaN` is "number" and
     `NaN` renders as `null` through JSON, so a mean over an empty set reaches a caller as a
     placeholder in a field the contract says can never hold one. */
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(
      `${where}.value is ${describe_(v)} (${String(v)}); \`MetricAggregate.value\` is a ` +
        `number, and a 0/0 mean over no votes is exactly the placeholder AC3 forbids.`,
    );
  }
  /* RULED at D-WAVE-08, F-160-F1: `sampleSize` is an UNWEIGHTED count per metric, and the
     ruling gives the reason this side had only guessed at — "if it were Σw, two validators at
     weight 3 clear a five-vote bar with two votes and AC4 is simply wrong." So a whole,
     non-negative number, and a fractional one is the weight-sum implementation showing
     through. This was charged as open before the cells were written; the reading it took
     happened to be the ruled one, which is worth nothing as evidence and is recorded only so
     nobody later reads the agreement as confirmation. */
  if (typeof sampleSize !== "number" || !Number.isInteger(sampleSize) || sampleSize < 0) {
    throw new Error(
      `${where}.sampleSize is ${describe_(sampleSize)} (${String(sampleSize)}); a sample size ` +
        `is a non-negative whole count of votes (F-160-F1: this reading is reported as open).`,
    );
  }
  if (typeof isSample !== "boolean") {
    throw new Error(
      `${where}.isSample is ${describe_(isSample)} (${String(isSample)}); the block publishes ` +
        `it as a boolean, and a truthy string satisfies every \`if (isSample)\` a caller writes.`,
    );
  }
  return { value: v, sampleSize, isSample };
}

/**
 * The whole `Aggregate`, key set and all three members.
 *
 * The outer key set is where AC1 is observable from the response: an `Aggregate` carrying an
 * `autonomy` or a `security` member would be the engine's axes arriving through the community
 * ballot, which is the thing B-11 forbids and `lib/types.ts:36` records the reason for.
 */
export function assertAggregate(value: unknown, where: string): SeenAggregate {
  const shape = rendered(value);
  if (typeof shape !== "object" || shape === null || Array.isArray(shape)) {
    throw new Error(
      `${where} renders as ${describe_(shape)}; the block publishes \`Promise<Aggregate>\`, ` +
        `an object of three \`MetricAggregate\`s.`,
    );
  }
  const keys = Object.keys(shape as Record<string, unknown>).sort();
  const expected = [...METRICS].sort();
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) {
    const intruder = FORBIDDEN_AXES.filter((axis) => keys.includes(axis));
    throw new Error(
      `${where} does not render as \`Aggregate\`.\n` +
        `  published: ${expected.join(", ")}\n` +
        `  rendered:  ${keys.join(", ") || "(nothing)"}\n` +
        (intruder.length > 0
          ? `  It carries ${intruder.join(", ")}. AC1: a ballot cannot write \`autonomy\` or ` +
            `\`security\` — both are \`source: "auto"\` and the engine's alone ` +
            `(\`lib/types.ts:36\`), and \`cost\` is \`reported\` and T180's.\n`
          : ""),
    );
  }
  const record = shape as Record<string, unknown>;
  return {
    efficacy: assertMetricAggregate(record.efficacy, `${where}.efficacy`),
    reliability: assertMetricAggregate(record.reliability, `${where}.reliability`),
    transparency: assertMetricAggregate(record.transparency, `${where}.transparency`),
  };
}

/* ============================================================
   Rejections, and what they may carry

   §T160 publishes no error class, so nothing here pins a class or
   a message form — that is charge F-160-H and it is reported, not
   guessed. What IS assertable without a name is D-13's hygiene
   clause over whatever does arrive, and the fact that a refused
   write LEFT NOTHING BEHIND.

   The second is the one that matters. "It threw" is satisfied by
   an implementation that inserts the row and throws afterwards,
   and every `rejects.toThrow()` a reviewer would write passes
   against it. So every refusal cell in this suite reads the table
   back.
   ============================================================ */

export interface Renderings {
  message: string;
  string: string;
  json: string;
  ownKeys: string[];
}

export function renderingsOf(err: unknown): Renderings {
  const e = err as Error;
  return {
    message: typeof e?.message === "string" ? e.message : String(err),
    string: String(err),
    json: JSON.stringify(e) ?? "undefined",
    ownKeys: typeof e === "object" && e !== null ? Object.keys(e) : [],
  };
}

/**
 * The driver's own prose and machinery, which no rendering may carry (D-13).
 *
 * Every tell is anchored on something only the driver emits, and the SQL verbs carry the
 * QUOTED IDENTIFIER that follows them rather than standing alone — drizzle quotes every
 * identifier it emits, so `into "` is the driver and `into the` is prose. A bare `insert `
 * would red an admissible message such as "castBallot: could not insert the ballot."
 *
 * `23514` is here and the others are inherited: it is `check_violation`, which is what
 * `ballot_metric_range` raises, and it is the one SQLSTATE this task can actually produce.
 */
const DRIVER_TELLS = [
  "Failed query",
  "DrizzleQueryError",
  'from "',
  'into "',
  'update "',
  'relation "',
  'constraint "',
  "on conflict",
  "params:",
  "duplicate key value",
  "violates unique constraint",
  "violates check constraint",
  "ballot_metric_range",
  "ballot_account_bundle_key",
  "ECONNREFUSED",
  "password authentication failed",
  "23505",
  "23503",
  "23514",
  "22P02",
  "42P01",
  "postgresql://",
  "postgres://",
];

export function assertNoDriverProse(err: unknown, where: string): void {
  const r = renderingsOf(err);
  const haystack = `${r.message}\n${r.string}\n${r.json}\n${r.ownKeys.join(",")}`;
  const lowered = haystack.toLowerCase();
  const hit = DRIVER_TELLS.find((t) => lowered.includes(t.toLowerCase()));
  if (hit !== undefined) {
    throw new Error(
      `${where}: a rendering carries the driver tell \`${hit}\`.\n` +
        `  D-13: the driver error travels on \`cause\`, which is non-enumerable, and reaches ` +
        `no rendering. A DrizzleQueryError's own message opens with the full query and every ` +
        `bound parameter.\n` +
        `  message: ${r.message.slice(0, 300)}`,
    );
  }
}

/** Captures a rejection. Fails loudly if the call RESOLVED — an absent refusal is the defect. */
export async function rejection(call: () => unknown, where: string): Promise<unknown> {
  let resolved: unknown;
  try {
    resolved = await call();
  } catch (err) {
    return err;
  }
  throw new Error(
    `${where} RESOLVED with ${describe_(resolved)}.\n` +
      `  AC6: "an anonymous ballot is refused." A resolution is not a refusal however empty ` +
      `the aggregate it answers with, and this suite reads the table back separately — a ` +
      `refusal that leaves a row behind fails both cells, deliberately.`,
  );
}

/* ============================================================
   The database each suite owns
   ============================================================ */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the first parameter of both T160 functions. */
  db: unknown;
  /** This scratch database's connection string. */
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(`createTestDb's client carries no \`db\`.`);
  }
  const [current] = (await test.client.query("select current_database() as name")).rows as {
    name?: unknown;
  }[];
  const database = current?.name;
  if (typeof database !== "string" || database === "") {
    throw new Error(
      `\`select current_database()\` answered ${describe_(database)}, so this scratch database ` +
        `cannot be named.`,
    );
  }
  const base = new URL(process.env.DATABASE_URL ?? "");
  base.pathname = `/${database}`;

  return {
    db,
    url: base.toString(),
    query: async (sql, params) => {
      const result = await test.client.query(sql, params as unknown[]);
      return result.rows as Record<string, unknown>[];
    },
  };
}

/**
 * A SECOND, INDEPENDENT connection to the same scratch database.
 *
 * ── why one `db` cannot drive a concurrency cell, MEASURED ──
 * `Promise.all([castBallot(s.db, …), castBallot(s.db, …)])` looks like two concurrent
 * callers and is not. Both calls start together, but a single `pg` pool completes their
 * statements in order, so a read-then-write implementation sees:
 *
 *     select start {20} / select start {90} / select done {20} found 0 /
 *     write done {20}  / select done {90} found 1 / write done {90}
 *
 * — the second caller's SELECT returns after the first caller's INSERT, so it finds the row
 * and updates it, and the lost-update race never happens. That trace is from this suite's own
 * `SELECT`-then-`INSERT` mutation, which reddened ZERO of 50 cells until this helper existed.
 *
 * Two callers on two pools are two sockets, so their statements really do overlap — which is
 * also what two concurrent callers ARE in production: two requests, two pooled connections.
 * `lib/db/schema.ts:384-387` says the unique index IS AC2 and that "a `SELECT`-then-`INSERT`
 * passes every sequential test and loses under two callers"; this is what makes that
 * sentence testable rather than quoted.
 */
export async function extraClient(url: string): Promise<unknown> {
  const client = createDbClient(url);
  extras.push(client);
  return (client as unknown as Namespace).db;
}

const extras: DbClient[] = [];

export async function dropScratchDatabases(): Promise<number> {
  for (const client of extras.splice(0)) {
    try {
      await client.close();
    } catch {
      /* Teardown is not under test. */
    }
  }
  let dropped = 0;
  for (const test of open.splice(0)) {
    await test.drop();
    dropped += 1;
  }
  return dropped;
}

/* ============================================================
   Actors

   Plain data, exactly as T060 publishes it.
   ============================================================ */

export function accountActor(accountId: string, handle: string | null = null): Actor {
  return { kind: "account", accountId, handle };
}

export const ANONYMOUS: Actor = { kind: "anonymous" };

export function operatorActor(accountId: string): Actor {
  return { kind: "operator", accountId };
}

export interface Refused {
  label: string;
  /** Why this shape is here, so a red says which criterion it is about. */
  because: string;
  /** Given a real, existing account id, so a member can carry one without being that account. */
  actor: (realAccountId: string) => Actor;
}

/**
 * Every shape AC6 is about: a caller carrying NO usable account identity.
 *
 * Deliberately narrow, and the narrowness is the point. §T160 says only that "an anonymous
 * ballot is refused" and publishes no error class; every member below is a caller from whom
 * no `account_id` could be read at all, so a refusal is forced under EVERY live reading of
 * that clause and none of these can become a false charge against an implementer who built
 * to the section.
 *
 * The inherited-authority shapes are NOT here. They carry a real account id and are refused
 * only under T060's third ruling, which §T160 does not restate — so they live in
 * `inherited-authority.test.ts` under a header that says a red there is an open contract
 * question rather than a failed AC6.
 */
export const NO_IDENTITY: readonly Refused[] = [
  {
    label: "an anonymous caller",
    because: "AC6, literally: `{ kind: \"anonymous\" }` is what a signed-out reader is.",
    actor: () => ANONYMOUS,
  },
  {
    label: "an account carrying no identity at all",
    because:
      "T060: `\"\"` is what a half-built session row and an unset column both look like, and " +
      "an empty-string id never matches an empty-string id.",
    actor: () => accountActor("", null),
  },
  {
    label: "the missing-session shape `{}`",
    because: "T060: `can` and `visibleTo` fail closed; `{}` is precisely the missing session.",
    actor: () => ({}) as unknown as Actor,
  },
  {
    label: "an operator with no id",
    because:
      "T060: possession of a discriminant is not authority — an actor whose `kind` is " +
      "`\"operator\"` must carry a non-empty `accountId` to be one. There is no account to " +
      "attribute this ballot to under any reading.",
    actor: () => ({ kind: "operator" }) as unknown as Actor,
  },
  {
    /* THE MEMBER THAT MAKES THIS SET AN INSTRUMENT, added after a mutation sweep showed the
       four above holding nothing.

       Every one of them carries NO usable id, so `""` or `undefined` reaches the store, the
       store refuses it for a reason of its own — an invalid uuid, a foreign key — and a module
       that never checked the actor at all passes all four. Measured: with the refusal deleted
       outright, the four reddened ZERO cells once the stand-in sealed its store faults, because
       a sealed wrapper renders the database's objection as an ordinary refusal.

       This one carries a REAL, EXISTING account id under an `anonymous` kind, which is exactly
       what a half-built session and a hand-made payload both look like. The database has no
       objection to it whatever: a module reading `actor.accountId` without checking `kind`
       writes a ballot attributed to a real account, and the "no row left behind" assertion is
       then the only thing between an anonymous caller and a vote in somebody else's name. */
    label: "an ANONYMOUS caller carrying a real account's id",
    because:
      "AC6 with the database's own refusal taken away. T060's rule read the other way round: " +
      "possession of an id is not identity, and `kind` is the discriminant. Nothing in the " +
      "store objects to this row, so a module that does not check is caught here or nowhere.",
    actor: (realAccountId) => ({ kind: "anonymous", accountId: realAccountId }) as unknown as Actor,
  },
];

/* --------------------- names --------------------- */

let counter = 0;

/** Unique per run and per process, so two suite files never mint the same identifier. */
export function mark(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

/**
 * A token no admissible message can contain, alphanumeric on purpose.
 *
 * A SQLSTATE tell over-matches — a fixture's own `process.pid` can contain `23505` — and a
 * tell that can occur naturally reds like a real leak. A 22-character random token cannot
 * arrive in a rendering except by something putting it there.
 */
export function plantedToken(): string {
  return `zq${randomUUID().replaceAll("-", "").slice(0, 22)}`;
}

/** A uuid nothing in the database is keyed by. */
export function absentUuid(): string {
  return randomUUID();
}
