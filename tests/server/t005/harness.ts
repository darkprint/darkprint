/* ============================================================
   T005 — the blind suite's harness

   Not a test file: `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this is `.ts`, so nothing here runs on its own.

   ── this task inverts the usual shape of a blind suite ──
   T005 publishes no functions. There is no barrel, no module, and
   nothing to call. Every acceptance criterion here is a claim about
   what the *database* refuses, so every assertion below is raw SQL
   against a scratch database and the refusal has to arrive from the
   driver. A test that called a module and checked an error would be
   testing the module; there is no module.

   That matters more here than the phrasing suggests. Four of the
   five consuming tasks have an acceptance criterion only a
   constraint can deliver — T140's idempotent save, T160's
   replace-not-accumulate ballot, T170's one-vote-per-account, T180's
   refusal of a report against an unknown digest. If T005 ships
   columns without constraints, all four of those tasks pass their
   own tests against a store that permits exactly what they forbid.

   ── what this file read of the base schema, and when ──
   Stated because that boundary is where a blind suite silently stops
   being blind. At 2026-08-18 06:29 UTC, before `feat/t005-schema`
   carried a single commit beyond `d37fdc9`, this author read three
   base artefacts and no others, through `git show` rather than the
   working tree: `lib/db/schema.ts`, `lib/db/migrations/0001_init.up.sql`
   and `lib/db/migrations/0001_init.down.sql`. `git diff --stat
   d37fdc9 73e769f -- lib/db/` is empty, so those bytes are base at
   `73e769f` too. Nothing under `lib/db/**` has been opened since,
   and nothing here reads it: the AC7 baseline is a frozen snapshot
   captured from those base bytes (`baseline.json`), so a later edit
   to the migration directory cannot quietly move the thing this
   suite compares against.

   ── why nothing here hardcodes a column name where it can derive one ──
   T005 has no Published signatures block. Every other task in this
   run publishes exact names because a candidate list twice resolved
   to the wrong export and reported a defect that did not exist;
   T005's equivalent of an exported name is a *column* name, and only
   the six table names are fixed by the contract. So the roles the
   criteria name — "account", "target kind", "target id", "bundle",
   "metric", "note" — are resolved out of the Postgres catalogue by
   foreign key and by type, and the `INSERT` is built from the
   resolved names. Reported to the orchestrator as D-05-03, with this
   fallback stated in advance: a fraction of what this suite tests is
   its own inference about which column plays which role, and a
   schema whose roles it misreads reads as a pass.

   ── why a unique index, a unique constraint and a partial index are
      three different objects ──
   `pg_constraint` with `contype = 'u'` and `pg_index` with
   `indisunique` are not the same catalogue entry: drizzle's
   `uniqueIndex()` produces the second and no row in the first. A
   check written against either one alone answers "absent" for a
   perfectly good schema built the other way. And a *partial* unique
   index — `indpred` non-null — enforces nothing outside its
   predicate, so it satisfies a catalogue check while leaving a whole
   region of the table unguarded. Everything here therefore asserts
   the *behaviour* (the second insert raises), reads both catalogues
   when it needs the object, and reds on a partial index with the
   region it leaves open named.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;
export type Row = Record<string, unknown>;
export type Query = (sql: string, params?: readonly unknown[]) => Promise<Row[]>;

/**
 * The six tables the contract fixes by name. This is the whole of T005's named surface —
 * everything else about these tables is prose describing a role, which is why the
 * resolvers below exist.
 */
export const T005_TABLES = ["save", "ballot", "note", "note_vote", "run_report", "api_key"] as const;
export type T005Table = (typeof T005_TABLES)[number];

/**
 * The ten tables T000 shipped, quoted from `backend.md` §T000's own list and from the
 * `CONTRACT_TABLES` constant in `tests/server/migrations.test.ts`. AC7 is a claim about
 * exactly these.
 */
export const BASE_TABLES = [
  "account",
  "handle_reservation",
  "bundle",
  "release",
  "card_version",
  "ontology_version",
  "ontology_term",
  "target",
  "target_actor",
  "audit",
] as const;

/** The one migration base ships. Anything else `migrateUp` applies belongs to T005. */
export const BASE_MIGRATION_ID = "0001_init";

/** Clauses quoted so a red says where the requirement comes from, not merely that a test wanted it. */
export const CONTRACT = {
  tables:
    "backend.md §T005 Contract: six tables that five already-written contracts require — " +
    "save, ballot, note, note_vote, run_report, api_key",
  ac1:
    'AC1 — T140 AC2 "saving one target twice is idempotent" is a unique constraint on ' +
    "(account, target_kind, target_id), enforced by the database: a second insert must " +
    "fail at the driver, and a test that inserts twice through raw SQL must see it fail",
  ac2:
    'AC2 — T160 AC2 "one account voting twice on one metric replaces rather than ' +
    'accumulates" is a unique constraint on (account, bundle, metric). Same standard: raw ' +
    "SQL, not the module",
  ac3: 'AC3 — T170 AC4 "a vote from one account counts once" is a unique constraint on (account, note)',
  ac4:
    'AC4 — T180 AC1 "a report against an unknown digest is refused" is a foreign key to the ' +
    "release, not a lookup the module performs first. A run_report row naming a digest no " +
    "release holds must fail at the driver",
  ac5:
    'AC5 — T160 AC1 "a ballot cannot write autonomy or security" is expressible in the schema ' +
    "and must be: the writable metric set is constrained by the column shape or a check " +
    "constraint, so the refusal does not depend on every future caller remembering it",
  ac6:
    "AC6 — every migration is paired up/down and reversible against a scratch database: apply, " +
    "roll back, apply again, and the schema is identical at both applications — compared " +
    "structurally, not by the migration file",
  ac7:
    "AC7 — no existing table is altered, renamed or dropped, with exactly one named exception, " +
    "and the ten tables T000 shipped are otherwise byte-identical in the schema after this task",
  ac7a:
    "AC7a — handle_reservation.account_id becomes NOT NULL. After this task, a direct INSERT of " +
    "a NULL-owner reservation fails at the driver, not at a caller",
  ac8:
    "AC8 — every unique constraint above is named, and the name is derived from the schema at " +
    "runtime wherever a module will match on it. A consumer that has to hardcode a constraint " +
    "name is a defect in this task",
  noteTombstone:
    "Contract, note: `{ id, author, body, createdAt, votes }` keyed (target, id) over the same " +
    "B-10 target, with a tombstone column, since B-18 requires deletion to keep counts and " +
    "cursors honest",
  runReportShape:
    "Contract, run_report: keyed by release digest, carrying model, provider, hardware, input " +
    "size, harness version, cost units, duration, timestamp",
  apiKeyShape: "Contract, api_key: account + a revocation state that is immediate",
} as const;

/** SQLSTATEs, by the name Postgres gives them, so a red reads as a class and not a number. */
export const SQLSTATE = {
  unique_violation: "23505",
  foreign_key_violation: "23503",
  not_null_violation: "23502",
  check_violation: "23514",
  invalid_text_representation: "22P02",
} as const;

/** What a value is, so a red does not send the reader looking for it. */
export function describe(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Date) return `a Date (${value.toISOString()})`;
  return typeof value;
}

/* --------------------- the environment --------------------- */

/** The only variable this suite needs. T000's environment contract publishes eight. */
type EnvironmentVariable = "DATABASE_URL";

/**
 * Loud rather than skipped. A suite that stands down when the infrastructure is absent
 * reports the same green as one that checked something, and `compose.yaml` exists precisely
 * so that "the stack is not up" is an instruction and not an excuse.
 */
export function requireEnv(name: EnvironmentVariable): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set. T000's environment contract publishes it; bring the stack up with ` +
        `\`docker compose up -d\` and export it from .env.example.`,
    );
  }
  return value;
}

/* --------------------- the one module this suite loads --------------------- */

/**
 * T005 publishes nothing, so the only import here is T000's merged barrel — the migration
 * runner that applies T005's work and the client that reads the result. A dynamic import
 * for the reason `tests/server/contract.ts` states: a static one fails the whole file at
 * collection and hides every criterion behind the first missing module.
 */
let dbModule: Promise<Namespace> | undefined;

export function loadDb(): Promise<Namespace> {
  dbModule ??= import("@/lib/db").then((m) => m as unknown as Namespace);
  return dbModule;
}

function requiredFn(mod: Namespace, name: string, clause: string): UnknownFn {
  const value = mod[name];
  if (value === undefined) {
    throw new Error(
      `@/lib/db exports no \`${name}\`.\n  the contract publishes: ${clause}\n` +
        `  found: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
    );
  }
  if (typeof value !== "function") {
    throw new Error(`@/lib/db exports \`${name}\` as ${describe(value)}; expected a function.`);
  }
  return value as UnknownFn;
}

/* --------------------- Postgres, one scratch database per file --------------------- */

function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  if (result !== null && typeof result === "object") {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as Row[];
  }
  throw new Error(`A query returned ${describe(result)}; expected an array of rows or { rows }.`);
}

interface RawClient {
  query: Query;
  close(): Promise<void>;
}

async function rawClient(mod: Namespace, url: string): Promise<RawClient> {
  const create = requiredFn(mod, "createDbClient", "createDbClient(config?: string | PoolConfig)");
  const raw = await create(url);
  if (raw === null || typeof raw !== "object") {
    throw new Error(`createDbClient produced ${describe(raw)}; expected a client.`);
  }
  const client = raw as Namespace;
  const query = client.query;
  if (typeof query !== "function") {
    throw new Error(
      `createDbClient produced a client with no \`query\` method (it has: ` +
        `${Object.keys(client).sort().join(", ") || "(nothing)"}).`,
    );
  }
  return {
    query: async (sql, params) => rowsOf(await (query as UnknownFn).call(client, sql, params)),
    async close() {
      const end = client.close;
      if (typeof end !== "function") return;
      /* Teardown is not under test: a client that cannot close cleanly is T000's to fix. */
      await Promise.resolve((end as UnknownFn).call(client)).catch(() => undefined);
    },
  };
}

/** `CREATE DATABASE` has to be issued from another database, and every image ships this one. */
const MAINTENANCE_DATABASE = "postgres";

/**
 * The migration directory this suite drives, when it is not `lib/db/migrations`.
 *
 * `migrateUp(target, dir?)` takes one, and that affordance is what lets this suite be
 * validated against a throwaway *reference* implementation before the real one exists — a
 * directory outside the repository holding base's `0001_init` pair and a hand-written
 * `0002` that satisfies the contract. Without it there is no way to show that a green here
 * is a green a wrong schema could not have produced, and this run's rule is explicit: a
 * green against a reference is evidence only if the reference could have gone red.
 *
 * ── and why setting it cannot produce a green ──
 * A knob that changes what a suite measures is a silent-green vector: left set in a gate
 * run, every criterion below would report on the reference instead of on T005's work, and
 * the output would look exactly the same. `reference-mode.test.ts` reds whenever this is
 * set, so a run in reference mode is one red short of a clean suite by construction and the
 * red names the variable. It does not prevent the mistake; it refuses to let the mistake
 * pass as a result, which is the achievable target for a knob nothing in the tree encodes.
 */
export const REFERENCE_MIGRATIONS = process.env.T005_REFERENCE_MIGRATIONS;

function databaseUrlFor(name: string): string {
  const url = new URL(requireEnv("DATABASE_URL"));
  url.pathname = `/${name}`;
  return url.toString();
}

const created: { admin?: RawClient; clients: RawClient[]; names: string[] } = {
  clients: [],
  names: [],
};

async function admin(mod: Namespace): Promise<RawClient> {
  created.admin ??= await rawClient(mod, databaseUrlFor(MAINTENANCE_DATABASE));
  return created.admin;
}

async function dropDatabase(a: RawClient, name: string): Promise<void> {
  /* FORCE terminates whatever is still connected, which matters because `migrateUp` given a
     connection string opens a pool this file never gets a handle on. Postgres 13 and up. */
  try {
    await a.query(`drop database if exists "${name}" with (force)`);
  } catch {
    await a.query(`drop database if exists "${name}"`).catch(() => undefined);
  }
}

export interface Scratch {
  query: Query;
  name: string;
  url: string;
  /** Exactly what `migrateUp` reported applying, in the order it applied them. */
  applied: string[];
  /** The applied ids that are not base's — T005's own migrations, derived rather than assumed. */
  t005Migrations: string[];
  migrateUp(): Promise<string[]>;
  migrateDown(steps?: number): Promise<string[]>;
}

/**
 * A migrated database of this file's own. One name per file per process, so two files in
 * parallel workers cannot see each other and a run that dies before teardown leaves a
 * database the next run of the same file drops on sight. Nothing sweeps other names:
 * dropping a database another session might be driving is the exact failure the isolation
 * rule exists to prevent.
 */
export async function scratchDatabase(tag: string): Promise<Scratch> {
  const mod = await loadDb();
  const a = await admin(mod);
  const name = `darkprint_t005_${tag}_${process.pid}`;

  await dropDatabase(a, name);
  await a.query(`create database "${name}"`);
  created.names.push(name);

  const url = databaseUrlFor(name);
  const up = requiredFn(mod, "migrateUp", "migrateUp(target, dir?)");
  const down = requiredFn(mod, "migrateDown", "migrateDown(target, steps?, dir?)");

  const applied = idsOf(
    REFERENCE_MIGRATIONS === undefined ? await up(url) : await up(url, REFERENCE_MIGRATIONS),
  );

  const client = await rawClient(mod, url);
  created.clients.push(client);

  /* The premise of everything below, checked rather than hoped for. A `createDbClient` that
     ignored the string it was handed would put this suite on the shared database with every
     assertion still passing, which is D-08 reproduced with the fix in place. */
  const [where] = await client.query("select current_database() as name");
  if (String(where?.name) !== name) {
    throw new Error(
      `This suite created ${name} and asked createDbClient for it, and the client connected ` +
        `to "${String(where?.name)}" instead.`,
    );
  }

  return {
    query: client.query,
    name,
    url,
    applied,
    t005Migrations: applied.filter((id) => id !== BASE_MIGRATION_ID),
    migrateUp: async () =>
      idsOf(REFERENCE_MIGRATIONS === undefined ? await up(url) : await up(url, REFERENCE_MIGRATIONS)),
    migrateDown: async (steps = 1) =>
      idsOf(
        REFERENCE_MIGRATIONS === undefined
          ? await down(url, steps)
          : await down(url, steps, REFERENCE_MIGRATIONS),
      ),
  };
}

function idsOf(result: unknown): string[] {
  if (!Array.isArray(result)) {
    throw new Error(
      `migrateUp/migrateDown returned ${describe(result)}; T000 publishes both as ` +
        `Promise<string[]> of the migration ids they moved.`,
    );
  }
  return result.map(String);
}

/** Closes every client this file opened and drops every database it created. */
export async function dropScratchDatabases(): Promise<string[]> {
  const dropped: string[] = [];
  for (const client of created.clients.splice(0)) await client.close();
  if (created.names.length > 0) {
    const a = await admin(await loadDb());
    for (const name of created.names.splice(0)) {
      await dropDatabase(a, name);
      dropped.push(name);
    }
  }
  if (created.admin !== undefined) {
    await created.admin.close();
    created.admin = undefined;
  }
  return dropped;
}

/**
 * The residue check every session in this run is asked for. Counted rather than asserted
 * clean here — a database another session created is not this suite's to drop or to fail on.
 */
export async function scratchDatabasesNamed(prefix: string): Promise<string[]> {
  const a = await admin(await loadDb());
  const rows = await a.query(`select datname from pg_database where datname like $1 order by 1`, [
    `${prefix}%`,
  ]);
  return rows.map((r) => String(r.datname));
}

/**
 * The guard that keeps a missing implementation from reading as a green.
 *
 * Before T005 ships, `migrateUp` applies `0001_init` and nothing else, and every table this
 * suite reaches for is absent. Without this, a criterion whose table does not exist could
 * fail in whatever way `information_schema` happens to answer for a name nobody defined —
 * and a criterion that is *skipped* because a precondition was unmet reports the same
 * colour as one that checked something. Called at the top of every file, so each criterion
 * reds separately with the same sentence rather than five of them hiding behind the first.
 */
export function requireT005Shipped(scratch: Scratch): void {
  if (scratch.t005Migrations.length > 0) return;
  throw new Error(
    `migrateUp applied [${scratch.applied.join(", ")}] and nothing beyond \`${BASE_MIGRATION_ID}\`, ` +
      `so T005 has shipped no migration.\n` +
      `  ${CONTRACT.tables}\n` +
      `  Every criterion in tests/server/t005/** is about what the database refuses, and a ` +
      `database carrying only base refuses none of it.`,
  );
}

/* --------------------- what the contract publishes --------------------- */

/**
 * `backend.md` §T005's **Published signatures** block, granted as D-05-03 on the argument
 * that a task with no exported functions has *identifiers* as its acceptance surface and a
 * raw-SQL test has to type them. Quoted here so a red says where a name comes from rather
 * than merely that a test wanted it.
 *
 * These names are bound **exactly**, and there is no candidate list anywhere in this suite.
 * The reason is two rounds of T000's evidence: a list that resolves to the wrong export
 * reports a defect that does not exist, and one that resolved `migrate` — the migration
 * function with no database parameter — put two blind suites on one database. Where the
 * contract has a name, guessing is worse than binding.
 *
 * The earlier plan to derive these from the catalogue by role is gone with the block that
 * replaced it. It would have made a fraction of this suite an assertion about the author's
 * own inference, which is the thing the block exists to remove.
 */
export const PUBLISHED = {
  preamble:
    "Every table carries `id uuid primary key default gen_random_uuid()` unless stated. " +
    "account_id/bundle_id/release_id/note_id are `uuid NOT NULL` with a foreign key to the " +
    "named table's `id`. Timestamps are `timestamptz`.",
  save: "save  account_id, target_kind, target_id text, created_at; unique (account_id, target_kind, target_id)",
  ballot:
    "ballot  account_id, bundle_id, efficacy, reliability, transparency smallint NULL 0..100, " +
    "updated_at; unique (account_id, bundle_id)",
  note:
    "note  account_id (the author), target_kind, target_id text, body text NOT NULL, " +
    "created_at, edited_at NULL, deleted_at NULL",
  noteVote: "note_vote  note_id, account_id, created_at; unique (note_id, account_id)",
  runReport:
    "run_report  release_digest text NOT NULL (AC4, D-05-01), account_id (the submitter, " +
    "uuid NOT NULL, FK to account.id), model, provider, hardware text, input_size int, " +
    "harness_version text, cost_units numeric, duration_ms int, reported_at, created_at",
  apiKey: "api_key  account_id, token_hash text NOT NULL unique, label text, created_at, revoked_at " +
    "NULL — and under D-05-08 `label` is NOT NULL, since only NULL is ever written explicitly",
  targetKind:
    "`target_kind` reuses the existing target_kind enum (blueprint | card | term); any " +
    "narrowing is the consuming task's, not a check constraint here",
  noteVotesDerived:
    "`note.votes` in lib/types.ts:182 is a DERIVED count over note_vote and is not a column",
  runReportTrigger:
    "AC4, ruled: run_report.release_digest text NOT NULL, existence enforced by a trigger " +
    "raising SQLSTATE 23503 — the same code a foreign key raises, so a consumer branching on " +
    "it cannot tell the difference",
  d0509:
    "D-05-09, ruled: `run_report.cost_units` is UNQUALIFIED `numeric`, as the block writes it. " +
    "The shipped numeric(18,6) silently truncates — 0.0000001 stores as 0.000000, so a " +
    "submitted cost becomes no cost at all with no error, and it feeds T180's median and " +
    "p10/p90. A bound that TRUNCATES rather than REFUSES is worse than no bound, because it " +
    "converts a rejectable input into a wrong number. If T180 or T230 wants a bound later it " +
    "is published in the block AND refuses explicitly",
  d0508:
    "D-05-08, ruled: a column in the published block is `NOT NULL` unless written `NULL`. " +
    "Only NULL is ever written explicitly — deleted_at NULL, revoked_at NULL, edited_at NULL " +
    "and the three smallint NULL metrics. Required wins on the consumers rather than on " +
    "preference: T230 publishes issueKey(..., label: string) and ApiKeyRecord.label: string, " +
    "and T180's RunReport has all nine fields required",
  d0507:
    "D-05-07, RULED: the Published signatures block now reads `release_digest text NOT NULL`, " +
    "NOT `release_id`, and NO foreign key into `release` — the digest is the key because " +
    "reportedCost() takes one and two releases may legitimately share it. The same ruling " +
    "added `account_id uuid NOT NULL` (the submitter, FK to account.id), which T180's AC5 " +
    "needs and which the block had not carried",
} as const;

/**
 * The unique constraints the published block declares, as (table, columns).
 *
 * `api_key` is here even though no acceptance criterion names it, and that is the point.
 * It was the one published unique this table left out, and leaving it out cost two
 * instruments at once: `falsifyUnique`'s partial-index assertion never reached it, so a
 * `WHERE`-qualified unique on `token_hash` would have gone unseen; and `ac8-names` iterates
 * exactly this object, so a `schema.ts`-only rename of its index was a D-14 defect nothing
 * observed. The untested region was the one table with no criterion pointing at it, which
 * is where the rule says to look.
 */
export const PUBLISHED_UNIQUES = {
  save: ["account_id", "target_kind", "target_id"],
  ballot: ["account_id", "bundle_id"],
  note_vote: ["note_id", "account_id"],
  api_key: ["token_hash"],
} as const;

/**
 * D-05-08, ruled: **a column in the published block is `NOT NULL` unless written `NULL`.**
 *
 * This object is the whole block read under that clause, and it exists because the one cell
 * it was created to fix was never the interesting part. The block wrote `token_hash text NOT
 * NULL` and `label text` on one line and said nothing about what an absent marker meant;
 * T005's implementer read unmarked as required and this author read it as nullable, and both
 * are defensible against the text. **Nine columns were divergent and exactly one reddened** —
 * `api_key`'s, because it was the single place this suite hardcoded an `INSERT` instead of
 * deriving the required set from the catalogue. The other eight agreed by luck.
 *
 * A green that rests on luck at eight of nine cells is a green with one measurement in it.
 * So the convention itself is asserted here, at every published column of every table,
 * rather than the one cell being patched: if the block and the schema disagree again the
 * suite reds at the column that disagrees, not wherever a hardcoded literal happens to sit.
 */
export const PUBLISHED_COLUMNS: Readonly<Record<string, readonly [string, boolean][]>> = {
  /* [column, nullable] — nullable is true only where the block writes NULL. */
  save: [
    ["account_id", false],
    ["target_kind", false],
    ["target_id", false],
    ["created_at", false],
  ],
  ballot: [
    ["account_id", false],
    ["bundle_id", false],
    ["efficacy", true],
    ["reliability", true],
    ["transparency", true],
    ["updated_at", false],
  ],
  note: [
    ["account_id", false],
    ["target_kind", false],
    ["target_id", false],
    ["body", false],
    ["created_at", false],
    ["edited_at", true],
    ["deleted_at", true],
  ],
  note_vote: [
    ["note_id", false],
    ["account_id", false],
    ["created_at", false],
  ],
  run_report: [
    ["release_digest", false],
    ["account_id", false],
    ["model", false],
    ["provider", false],
    ["hardware", false],
    ["input_size", false],
    ["harness_version", false],
    ["cost_units", false],
    ["duration_ms", false],
    ["reported_at", false],
    ["created_at", false],
  ],
  api_key: [
    ["account_id", false],
    ["token_hash", false],
    ["label", false],
    ["created_at", false],
    ["revoked_at", true],
  ],
};

/**
 * The column types the published block writes out, as `information_schema` reports them.
 *
 * Deliberately only the columns the block **names a type for**. Asserting a type for every
 * column would be inventing a contract: the block gives `target_id text`, `input_size int`
 * and `cost_units numeric` and is silent elsewhere, and a blind suite that pinned the rest
 * would red on choices nobody published. Where the legend does state a convention —
 * timestamps are `timestamptz`, foreign keys are `uuid` — that is already asserted beside
 * the columns it governs.
 *
 * `precision` and `scale` are `null` where the block writes the type unqualified, and that
 * is the whole of D-05-09: `numeric` and `numeric(18,6)` are the same `data_type` and differ
 * only in two columns of the catalogue that nothing here read.
 */
export const PUBLISHED_TYPES: readonly {
  table: string;
  column: string;
  dataType: string;
  precision: number | null;
  scale: number | null;
  clause: string;
}[] = [
  { table: "save", column: "target_id", dataType: "text", precision: null, scale: null, clause: "save  … target_id text" },
  { table: "note", column: "target_id", dataType: "text", precision: null, scale: null, clause: "note  … target_id text" },
  { table: "note", column: "body", dataType: "text", precision: null, scale: null, clause: "note  … body text NOT NULL" },
  { table: "run_report", column: "release_digest", dataType: "text", precision: null, scale: null, clause: "run_report  release_digest text NOT NULL" },
  { table: "run_report", column: "input_size", dataType: "integer", precision: 32, scale: 0, clause: "run_report  … input_size int" },
  { table: "run_report", column: "duration_ms", dataType: "integer", precision: 32, scale: 0, clause: "run_report  … duration_ms int" },
  { table: "run_report", column: "cost_units", dataType: "numeric", precision: null, scale: null, clause: "run_report  … cost_units numeric (D-05-09: UNQUALIFIED)" },
  { table: "api_key", column: "token_hash", dataType: "text", precision: null, scale: null, clause: "api_key  … token_hash text NOT NULL unique" },
];

/** The three writable metrics, and the two a ballot may never carry. */
export const WRITABLE_METRICS = ["efficacy", "reliability", "transparency"] as const;
export const UNWRITABLE_METRICS = ["autonomy", "security"] as const;
