/* ============================================================
   T005 — building a row the schema will accept, without being told
   what the schema is

   Every criterion here is "insert the violating row twice and
   require the second to fail at the driver". That needs a *first*
   insert that succeeds, and a first insert only succeeds if every
   NOT NULL column without a default is supplied. Blind, this suite
   does not know what those columns are — so it reads them, and
   fills each one by its type.

   The distinction that keeps a red honest: a failed *first* insert
   is a broken harness, never a failed acceptance criterion, and it
   says so in as many words. A suite that reported "the constraint
   is missing" because it could not build a row would be reporting a
   defect that does not exist, which is the exact shape T000
   recorded twice with its candidate lists.
   ============================================================ */

import { randomUUID } from "node:crypto";

import type { Query, Row } from "./harness.ts";
import { columnsOf, foreignKeysOf, type Catalogue, type ColumnInfo } from "./catalogue.ts";

/** A `pg` DatabaseError, reduced to the fields a criterion is about. */
export interface DriverError {
  code: string;
  constraint: string | null;
  table: string | null;
  detail: string | null;
  message: string;
}

export function asDriverError(cause: unknown): DriverError | null {
  if (cause === null || typeof cause !== "object") return null;
  const e = cause as { code?: unknown; constraint?: unknown; table?: unknown; detail?: unknown; message?: unknown };
  if (typeof e.code !== "string") return null;
  return {
    code: e.code,
    constraint: typeof e.constraint === "string" ? e.constraint : null,
    table: typeof e.table === "string" ? e.table : null,
    detail: typeof e.detail === "string" ? e.detail : null,
    message: typeof e.message === "string" ? e.message : String(cause),
  };
}

/**
 * Runs `attempt` and answers what the driver raised, or `null` if it did not raise.
 *
 * Deliberately not a `.rejects` matcher. What a criterion here is about is *which* refusal
 * arrived — a unique violation and a not-null violation are different facts about the
 * schema, and a matcher that only knows the promise rejected reports them as the same
 * result. It also has to survive a refusal that is not a driver error at all: a module
 * pre-check would reject with an ordinary `Error` carrying no SQLSTATE, and that is the
 * thing several of these criteria exist to forbid.
 */
export async function attemptToDriverError(attempt: () => Promise<unknown>): Promise<
  { raised: false } | { raised: true; driver: DriverError | null; cause: unknown }
> {
  try {
    await attempt();
    return { raised: false };
  } catch (cause) {
    return { raised: true, driver: asDriverError(cause), cause };
  }
}

/* --------------------- values, by column type --------------------- */

let counter = 0;

/** Unique per call within a process, so no fixture ever collides with another's unique index. */
export function marker(prefix = "t005"): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}-${randomUUID().slice(0, 8)}`;
}

/**
 * A value a column of this type will accept. Nothing here is meaningful data — the point is
 * a row that lands, so the columns the criterion *is* about can be controlled by the caller.
 */
function valueFor(cat: Catalogue, column: ColumnInfo): unknown {
  switch (column.dataType) {
    case "uuid":
      return randomUUID();
    case "text":
    case "character varying":
    case "character":
      return marker(column.name);
    case "integer":
    case "bigint":
    case "smallint":
      return 1;
    case "numeric":
    case "double precision":
    case "real":
      return 1;
    case "boolean":
      return false;
    case "timestamp with time zone":
    case "timestamp without time zone":
    case "date":
      return new Date();
    case "json":
    case "jsonb":
      return "{}";
    case "ARRAY":
      return [];
    case "USER-DEFINED": {
      const labels = cat.enums.get(column.udtName);
      if (labels === undefined || labels.length === 0) {
        throw new HarnessError(
          `\`${column.table}.${column.name}\` is the user-defined type \`${column.udtName}\`, and ` +
            `the catalogue holds no enum labels for it. This suite fills a required column by ` +
            `its type and has no value it can offer for that one.`,
        );
      }
      return labels[0];
    }
    default:
      throw new HarnessError(
        `\`${column.table}.${column.name}\` is \`${column.dataType}\`, which this suite has no ` +
          `filler value for. Add one to valueFor() in tests/server/t005/rows.ts — this is a ` +
          `broken harness, not a failed acceptance criterion.`,
      );
  }
}

/**
 * Raised when the suite cannot build a row, as distinct from the database refusing one. Never
 * caught and retried: retrying a different shape against a schema this file has misread can
 * only produce a second wrong answer with a longer message in front of it.
 */
export class HarnessError extends Error {
  constructor(message: string) {
    super(
      `${message}\n` +
        `  This is a broken test, not a failed acceptance criterion. It means the row builder ` +
        `could not construct a row the schema accepts, so nothing was measured.`,
    );
    this.name = "HarnessError";
  }
}

/* --------------------- inserting --------------------- */

export type Overrides = Record<string, unknown>;

export interface Fixtures {
  query: Query;
  cat: Catalogue;
  /** One parent row per table, reused, so a chain like note_vote -> note -> account is built once. */
  cache: Map<string, Row>;
}

export function fixtures(query: Query, cat: Catalogue): Fixtures {
  return { query, cat, cache: new Map() };
}

/**
 * The columns a row must carry: NOT NULL, no default, and not supplied by the caller. A column
 * with a default is left to the database on purpose — `id uuid DEFAULT gen_random_uuid()` and
 * `created_at DEFAULT now()` are exactly the columns a hand-built row gets wrong.
 */
function requiredColumns(cat: Catalogue, table: string, overrides: Overrides): ColumnInfo[] {
  return columnsOf(cat, table).filter(
    (c) => !c.nullable && !c.hasDefault && !(c.name in overrides),
  );
}

/**
 * A row in `table`, with `overrides` verbatim and everything else required filled in. Foreign
 * keys are followed: a required column that is the whole of a single-column foreign key gets
 * the id of a parent row this builder makes first, recursively.
 *
 * `depth` is a cycle guard rather than a performance one. `bundle.lineage_owner_id` points back
 * at `account`, and a schema with a genuine cycle among required columns is unsatisfiable — a
 * fact worth a clear red rather than a stack overflow.
 */
export async function insertRow(
  f: Fixtures,
  table: string,
  overrides: Overrides = {},
  depth = 0,
): Promise<Row> {
  if (depth > 8) {
    throw new HarnessError(
      `Following required foreign keys from \`${table}\` went eight levels deep. Either the ` +
        `schema has a cycle among NOT NULL foreign keys, in which case no row can be inserted ` +
        `at all, or this builder is looping.`,
    );
  }
  if (columnsOf(f.cat, table).length === 0) {
    throw new HarnessError(`\`${table}\` has no columns in the catalogue; it does not exist.`);
  }

  const values: Overrides = { ...overrides };
  const fks = foreignKeysOf(f.cat, table);

  for (const column of requiredColumns(f.cat, table, overrides)) {
    const fk = fks.find((k) => k.columns.length === 1 && k.columns[0] === column.name);
    if (fk === undefined) {
      values[column.name] = valueFor(f.cat, column);
      continue;
    }
    const parent = await parentRow(f, fk.refTable, depth + 1);
    const referenced = parent[fk.refColumns[0]];
    if (referenced === undefined) {
      throw new HarnessError(
        `Building \`${table}\` needed \`${fk.refTable}.${fk.refColumns[0]}\` and the parent row ` +
          `this builder inserted does not carry it.`,
      );
    }
    values[column.name] = referenced;
  }

  return insertLiteral(f.query, table, values);
}

/** A parent row, made once and reused, so every child in one test points at the same account. */
async function parentRow(f: Fixtures, table: string, depth: number): Promise<Row> {
  const cached = f.cache.get(table);
  if (cached !== undefined) return cached;
  const row = await insertRow(f, table, {}, depth);
  f.cache.set(table, row);
  return row;
}

/** A parent row of a named table, for a test that needs to hold onto it. */
export function existing(f: Fixtures, table: string): Promise<Row> {
  return parentRow(f, table, 1);
}

/** A second, distinct parent row — the "differs in exactly one column" half of every falsification. */
export function another(f: Fixtures, table: string): Promise<Row> {
  return insertRow(f, table, {}, 1);
}

export async function insertLiteral(query: Query, table: string, values: Overrides): Promise<Row> {
  const names = Object.keys(values);
  if (names.length === 0) {
    const [row] = await query(`insert into "${table}" default values returning *`);
    return row ?? {};
  }
  const placeholders = names.map((_, i) => `$${i + 1}`).join(", ");
  const columns = names.map((n) => `"${n}"`).join(", ");
  const [row] = await query(
    `insert into "${table}" (${columns}) values (${placeholders}) returning *`,
    names.map((n) => values[n]),
  );
  if (row === undefined) {
    throw new HarnessError(`An insert into \`${table}\` returned no row.`);
  }
  return row;
}

/**
 * The first half of every criterion here: the row the second insert will duplicate has to land.
 * A failure is reported as a harness failure with the driver's own sentence, because a
 * criterion about a *second* insert has measured nothing if the first never happened.
 */
export async function mustInsert(query: Query, table: string, values: Overrides): Promise<Row> {
  try {
    return await insertLiteral(query, table, values);
  } catch (cause) {
    const driver = asDriverError(cause);
    throw new HarnessError(
      `The first insert into \`${table}\` was refused` +
        (driver === null ? `: ${String(cause)}` : ` with ${driver.code}: ${driver.message}`) +
        `\n  values: ${JSON.stringify(values, replacer)}`,
    );
  }
}

function replacer(_key: string, value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}
