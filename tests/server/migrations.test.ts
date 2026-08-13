import { afterAll, describe, expect, it } from "vitest";

import {
  closeDbIfPossible,
  loadDb,
  pickFn,
  queryFor,
  requireEnv,
  type Namespace,
  type Query,
  type Row,
} from "./contract";

/* ============================================================
   T000 acceptance criteria 1 and 2 — the schema

   (1) migrations apply to an empty database and are idempotent on
       re-run
   (2) rollback returns the schema to the prior state

   Everything here goes through the client `@/lib/db` publishes.
   This branch has no Postgres driver in `package.json` and adding
   one would collide with whatever the implementation picks, so the
   only way in is the public interface — which is also the only way
   the protocol allows.

   "The prior state" is compared as a schema snapshot rather than by
   counting migrations: columns with their types, nullability and
   defaults, plus every index and every constraint. A rollback that
   drops a table and rebuilds it without its foreign key passes a
   table-name check and fails this one, and the tables here are the
   ones every later task extends, so the constraint is the part that
   has to survive.
   ============================================================ */

/** `backend.md`: "the tables every later task extends". Nine, named by the contract. */
const CONTRACT_TABLES = [
  "account",
  "handle_reservation",
  "bundle",
  "release",
  "card_version",
  "ontology_version",
  "ontology_term",
  "target",
  "audit",
] as const;

const MIGRATE_NAMES = ["migrate", "applyMigrations", "runMigrations", "migrateUp", "up"] as const;
const ROLLBACK_NAMES = [
  "rollback",
  "rollbackMigration",
  "migrateDown",
  "revert",
  "down",
] as const;

interface Db {
  mod: Namespace;
  query: Query;
  migrate: () => Promise<unknown>;
  rollback: () => Promise<unknown>;
}

let cached: Promise<Db> | undefined;

function db(): Promise<Db> {
  cached ??= (async () => {
    const mod = await loadDb();
    requireEnv("DATABASE_URL");
    return {
      mod,
      query: await queryFor(mod),
      migrate: () => Promise.resolve(pickFn(mod, "a migrate function", MIGRATE_NAMES, "@/lib/db")()),
      rollback: () =>
        Promise.resolve(pickFn(mod, "a rollback function", ROLLBACK_NAMES, "@/lib/db")()),
    };
  })();
  return cached;
}

afterAll(async () => {
  const mod = await loadDb().catch(() => undefined);
  if (mod !== undefined) await closeDbIfPossible(mod);
});

/* --------------------- the snapshot --------------------- */

/**
 * Three catalogue reads, ordered in SQL so the comparison never depends on the planner.
 * Row *data* is deliberately absent: what is under test is the shape of the schema, and
 * a bookkeeping table's `applied_at` changes on every legitimate re-run.
 */
async function schemaSnapshot(query: Query): Promise<{
  columns: Row[];
  indexes: Row[];
  constraints: Row[];
}> {
  const columns = await query(`
    select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, column_name
  `);
  const indexes = await query(`
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `);
  const constraints = await query(`
    select conrelid::regclass::text as table_name,
           conname,
           pg_get_constraintdef(oid) as definition
    from pg_constraint
    where connamespace = 'public'::regnamespace
    order by 1, 2
  `);
  return { columns, indexes, constraints };
}

async function tablesPresent(query: Query): Promise<string[]> {
  const rows = await query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  return rows.map((r) => String(r.table_name));
}

/**
 * Down to nothing, one step at a time. There is no "rollback everything" in the contract
 * and inventing one would be a test of a function nobody promised, so this drives the
 * single-step rollback until the contract's tables are gone. Bounded, because a rollback
 * that silently does nothing must end the loop as a failed assertion rather than as a
 * hang.
 */
async function rollbackToEmpty(d: Db): Promise<void> {
  for (let step = 0; step < 100; step += 1) {
    const present = await tablesPresent(d.query);
    if (!CONTRACT_TABLES.some((t) => present.includes(t))) return;
    try {
      await d.rollback();
    } catch (cause) {
      throw new Error(
        `rollback threw after ${step} step(s) with ${CONTRACT_TABLES.filter((t) =>
          present.includes(t),
        ).join(", ")} still present.`,
        { cause },
      );
    }
  }
  throw new Error("100 rollback steps left the contract tables in place; rollback is not undoing.");
}

/* --------------------- AC1 --------------------- */

describe("T000 AC1 — migrations apply to an empty database and are idempotent on re-run", () => {
  it("AC1: applying to a database with none of the contract tables creates all nine", async () => {
    const d = await db();
    await d.migrate();
    await rollbackToEmpty(d);

    const before = await tablesPresent(d.query);
    expect(before.filter((t) => CONTRACT_TABLES.includes(t as (typeof CONTRACT_TABLES)[number]))).toEqual(
      [],
    );

    await d.migrate();

    const after = await tablesPresent(d.query);
    expect([...CONTRACT_TABLES].filter((t) => !after.includes(t))).toEqual([]);
  }, 120_000);

  it("AC1: a second migrate leaves the schema byte-for-byte as the first left it", async () => {
    const d = await db();
    await d.migrate();
    const first = await schemaSnapshot(d.query);

    /* Awaited bare rather than wrapped in a `.rejects` matcher: a migration that is not
       idempotent fails here as `relation "account" already exists`, and that sentence is
       worth more to whoever reads the red than any assertion message. */
    await d.migrate();

    const second = await schemaSnapshot(d.query);
    expect(second).toEqual(first);
  }, 120_000);

  it("AC1: a third and fourth re-run still change nothing", async () => {
    const d = await db();
    await d.migrate();
    const before = await schemaSnapshot(d.query);
    await d.migrate();
    await d.migrate();
    expect(await schemaSnapshot(d.query)).toEqual(before);
  }, 120_000);

  it("AC1 (concurrency): migrations racing from empty apply the schema once, not twice", async () => {
    const d = await db();
    await d.migrate();
    await rollbackToEmpty(d);

    /* Three processes booting at once against a database nobody has migrated yet. This
       is the ordinary case for the scale-to-zero Postgres B-01 chose, not an exotic one,
       and it is where a runner without an advisory lock reports
       `relation "account" already exists` or a duplicate key on its own bookkeeping
       table. Racing from empty rather than from a migrated schema on purpose: once every
       migration is applied, a runner that skips applied ids never reaches the race. */
    const results = await Promise.allSettled([d.migrate(), d.migrate(), d.migrate()]);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.map((r) => String((r as PromiseRejectedResult).reason))).toEqual([]);

    const after = await tablesPresent(d.query);
    expect([...CONTRACT_TABLES].filter((t) => !after.includes(t))).toEqual([]);

    const settled = await schemaSnapshot(d.query);
    await d.migrate();
    expect(await schemaSnapshot(d.query)).toEqual(settled);
  }, 180_000);
});

/* --------------------- AC2 --------------------- */

describe("T000 AC2 — rollback returns the schema to the prior state", () => {
  it("AC2: rollback then migrate restores columns, indexes and constraints exactly", async () => {
    const d = await db();
    await d.migrate();
    const prior = await schemaSnapshot(d.query);

    await d.rollback();
    const rolled = await schemaSnapshot(d.query);
    /* A rollback that changes nothing would let the restore assertion below pass while
       proving nothing at all. */
    expect(rolled).not.toEqual(prior);

    await d.migrate();
    expect(await schemaSnapshot(d.query)).toEqual(prior);
  }, 120_000);

  it("AC2: rolling every migration back leaves none of the contract tables behind", async () => {
    const d = await db();
    await d.migrate();
    await rollbackToEmpty(d);

    const present = await tablesPresent(d.query);
    expect(CONTRACT_TABLES.filter((t) => present.includes(t))).toEqual([]);

    await d.migrate();
  }, 120_000);

  it("AC2: a full down and a full up is a round trip, not an approximation", async () => {
    const d = await db();
    await d.migrate();
    const prior = await schemaSnapshot(d.query);

    await rollbackToEmpty(d);
    await d.migrate();

    expect(await schemaSnapshot(d.query)).toEqual(prior);
  }, 180_000);
});

/* --------------------- the schema the contract names --------------------- */

describe("T000 schema — the tables every later task extends", () => {
  it("each of the nine contract tables exists in the public schema", async () => {
    const d = await db();
    await d.migrate();

    const present = new Set(await tablesPresent(d.query));
    const missing = CONTRACT_TABLES.filter((t) => !present.has(t));
    expect(missing).toEqual([]);
  }, 120_000);

  it("each contract table has a primary key", async () => {
    const d = await db();
    await d.migrate();

    const rows = await d.query(
      `select conrelid::regclass::text as table_name
       from pg_constraint
       where contype = 'p' and connamespace = 'public'::regnamespace`,
    );
    const keyed = new Set(rows.map((r) => String(r.table_name)));
    /* A table nine other tasks extend, join against and audit needs an identity to
       extend from. Without one, "one record per (owner, slug)" and "releases are
       append-only" are conventions rather than constraints. */
    expect(CONTRACT_TABLES.filter((t) => !keyed.has(t))).toEqual([]);
  }, 120_000);

  it("pgvector is available to be enabled", async () => {
    const d = await db();
    /* The environment contract calls for Postgres "with pgvector available (wave 5 needs
       it and a later image swap would be a migration)". Availability, not installation:
       T200 owns the extension itself. */
    const rows = await d.query(`select name from pg_available_extensions where name = 'vector'`);
    expect(rows.map((r) => String(r.name))).toEqual(["vector"]);
  }, 60_000);
});
