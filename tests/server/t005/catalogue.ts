/* ============================================================
   T005 — reading the schema out of Postgres, not out of a file

   Every name this suite needs beyond the six table names is
   resolved here, from the catalogue, at runtime. Two reasons, and
   the second is the one that matters.

   The stated one: T005 has no Published signatures block, so its
   column names are not a thing either side has agreed. Hardcoding
   them would make this suite red on a naming difference, which is
   the failure T000 recorded twice.

   The one that matters: AC8 requires the constraint names to be
   *derivable*, because "a consumer that has to hardcode a constraint
   name is a defect in this task". A suite that hardcodes the name it
   then checks proves nothing about that. Deriving it is the test.
   ============================================================ */

import type { Query, Row } from "./harness.ts";

export interface ColumnInfo {
  table: string;
  name: string;
  dataType: string;
  /** `information_schema.columns.udt_name` — the enum's type name where `dataType` is USER-DEFINED. */
  udtName: string;
  nullable: boolean;
  hasDefault: boolean;
  default: string | null;
}

export interface UniqueObject {
  /** The index's own name. Present whether or not a `pg_constraint` row backs it. */
  indexName: string;
  table: string;
  columns: string[];
  primary: boolean;
  /** Non-null only where drizzle's `unique()` (a constraint) was used rather than `uniqueIndex()`. */
  constraintName: string | null;
  /** A partial index enforces nothing outside its predicate; the predicate is quoted in the red. */
  predicate: string | null;
}

export interface ForeignKey {
  name: string;
  table: string;
  columns: string[];
  refTable: string;
  refColumns: string[];
}

export interface CheckConstraint {
  name: string;
  table: string;
  definition: string;
}

export interface Catalogue {
  columns: ColumnInfo[];
  uniques: UniqueObject[];
  foreignKeys: ForeignKey[];
  checks: CheckConstraint[];
  enums: Map<string, string[]>;
  tables: string[];
}

export async function readCatalogue(query: Query): Promise<Catalogue> {
  const columns = (
    await query(`
      select table_name, column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `)
  ).map(
    (r): ColumnInfo => ({
      table: String(r.table_name),
      name: String(r.column_name),
      dataType: String(r.data_type),
      udtName: String(r.udt_name),
      nullable: String(r.is_nullable) === "YES",
      hasDefault: r.column_default !== null,
      default: r.column_default === null ? null : String(r.column_default),
    }),
  );

  /* Both catalogues in one read. `pg_index.indisunique` is what `uniqueIndex()` produces and
     `pg_constraint.contype = 'u'` is what `unique()` produces; a check written against either
     alone answers "absent" for a perfectly good schema built the other way. The left join is
     what keeps them one row rather than two. */
  const uniques = (
    await query(`
      select i.indexrelid::regclass::text as index_name,
             i.indrelid::regclass::text   as table_name,
             i.indisprimary               as primary,
             con.conname                  as constraint_name,
             pg_get_expr(i.indpred, i.indrelid) as predicate,
             (select array_agg(a.attname::text order by k.ord)
                from unnest(i.indkey) with ordinality as k(attnum, ord)
                join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
               where k.attnum > 0) as columns
        from pg_index i
        join pg_class c on c.oid = i.indrelid
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_constraint con on con.conindid = i.indexrelid and con.contype in ('u', 'p')
       where n.nspname = 'public' and i.indisunique
       order by 2, 1
    `)
  ).map(
    (r): UniqueObject => ({
      indexName: String(r.index_name),
      table: String(r.table_name),
      columns: asStringArray(r.columns),
      primary: r.primary === true,
      constraintName: r.constraint_name === null ? null : String(r.constraint_name),
      predicate: r.predicate === null ? null : String(r.predicate),
    }),
  );

  const foreignKeys = (
    await query(`
      select con.conname as name,
             con.conrelid::regclass::text  as table_name,
             con.confrelid::regclass::text as ref_table,
             (select array_agg(a.attname::text order by k.ord)
                from unnest(con.conkey) with ordinality as k(attnum, ord)
                join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columns,
             (select array_agg(a.attname::text order by k.ord)
                from unnest(con.confkey) with ordinality as k(attnum, ord)
                join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as ref_columns
        from pg_constraint con
       where con.contype = 'f' and con.connamespace = 'public'::regnamespace
       order by 2, 1
    `)
  ).map(
    (r): ForeignKey => ({
      name: String(r.name),
      table: String(r.table_name),
      columns: asStringArray(r.columns),
      refTable: String(r.ref_table).replace(/^public\./, ""),
      refColumns: asStringArray(r.ref_columns),
    }),
  );

  const checks = (
    await query(`
      select conname as name, conrelid::regclass::text as table_name,
             pg_get_constraintdef(oid) as definition
        from pg_constraint
       where contype = 'c' and connamespace = 'public'::regnamespace
       order by 2, 1
    `)
  ).map(
    (r): CheckConstraint => ({
      name: String(r.name),
      table: String(r.table_name),
      definition: String(r.definition),
    }),
  );

  const enums = new Map<string, string[]>();
  for (const r of await query(`
    select t.typname as name, e.enumlabel as label
      from pg_type t join pg_enum e on e.enumtypid = t.oid
     where t.typnamespace = 'public'::regnamespace
     order by t.typname, e.enumsortorder
  `)) {
    const name = String(r.name);
    enums.set(name, [...(enums.get(name) ?? []), String(r.label)]);
  }

  const tables = (
    await query(`
      select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by 1
    `)
  ).map((r) => String(r.table_name));

  return { columns, uniques, foreignKeys, checks, enums, tables };
}

/**
 * Every `array_agg` above casts to `text` before aggregating, and that cast is load-bearing
 * rather than tidy. `pg_attribute.attname` is `name`, so `array_agg(attname)` is `name[]`
 * (OID 1003) — a type node-pg ships no parser for, which hands the column back as the raw
 * literal `{account_id,target_kind}` instead of an array. Every column set in this file was
 * then a string, and the whole suite failed in `beforeAll` with its tests SKIPPED rather
 * than red.
 *
 * The throw below is what surfaced it, and it stays strict for that reason: parsing the
 * literal here would have made the same mistake invisible and left the roles resolving off
 * a string nobody meant to read.
 */
function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  /* `array_agg` over an empty set is null, which is a real answer and not a broken read. */
  if (value === null || value === undefined) return [];
  throw new Error(
    `Expected a text[] from the catalogue, got ${typeof value}: ${JSON.stringify(value)}. ` +
      `An array_agg over a \`name\` column produces name[], which node-pg returns unparsed — ` +
      `every array_agg in this file casts to text for that reason.`,
  );
}

/* --------------------- the projection AC7 compares --------------------- */

/**
 * AC7 says the ten base tables are "byte-identical in the schema" after this task. Bytes of
 * what is not stated, so this is the operational reading, reported as D-05-06: for each named
 * table, every column with its type, nullability and default, every index with its definition,
 * and every constraint with its definition. Sorted in SQL so the comparison never depends on
 * the planner, and row *data* deliberately absent — what is under test is shape.
 *
 * Scoped to a table list rather than to the whole schema on purpose: the migration runner's
 * own `_migrations` bookkeeping table exists in a migrated database and not in a baseline
 * built from raw SQL, and a difference there would be noise reported as a violation.
 */
export interface TableShape {
  columns: Row[];
  indexes: Row[];
  constraints: Row[];
}

export async function shapeOf(query: Query, tables: readonly string[]): Promise<TableShape> {
  const list = [...tables];
  const columns = await query(
    `select table_name, column_name, data_type, udt_name, is_nullable, column_default,
            character_maximum_length, numeric_precision, numeric_scale
       from information_schema.columns
      where table_schema = 'public' and table_name = any($1)
      order by table_name, column_name`,
    [list],
  );
  const indexes = await query(
    `select tablename, indexname, indexdef
       from pg_indexes
      where schemaname = 'public' and tablename = any($1)
      order by tablename, indexname`,
    [list],
  );
  const constraints = await query(
    `select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
       from pg_constraint
      where connamespace = 'public'::regnamespace
        and conrelid::regclass::text = any($1)
      order by 1, 2`,
    [list],
  );
  return { columns, indexes, constraints };
}

/* --------------------- resolving a role to a column --------------------- */

export function columnsOf(cat: Catalogue, table: string): ColumnInfo[] {
  return cat.columns.filter((c) => c.table === table);
}

export function foreignKeysOf(cat: Catalogue, table: string): ForeignKey[] {
  return cat.foreignKeys.filter((f) => f.table === table);
}

/** Every unique object on a table that is not its primary key. */
export function uniqueConstraintsOf(cat: Catalogue, table: string): UniqueObject[] {
  return cat.uniques.filter((u) => u.table === table && !u.primary);
}

export function primaryKeyOf(cat: Catalogue, table: string): UniqueObject | undefined {
  return cat.uniques.find((u) => u.table === table && u.primary);
}

/**
 * The single-column foreign key from `table` into `refTable`. A role like "the account column"
 * is only well defined if there is exactly one; two would make every later assertion a coin
 * flip, so ambiguity is a red with both candidates named rather than a silent first-match.
 */
export function singleColumnFkInto(
  cat: Catalogue,
  table: string,
  refTable: string,
): ForeignKey | { error: string } {
  const found = foreignKeysOf(cat, table).filter(
    (f) => f.refTable === refTable && f.columns.length === 1,
  );
  if (found.length === 1) return found[0];
  if (found.length === 0) {
    const all = foreignKeysOf(cat, table);
    return {
      error:
        `\`${table}\` has no single-column foreign key into \`${refTable}\`.\n` +
        `  foreign keys on ${table}: ${all.length === 0 ? "(none)" : all.map(fkLabel).join("; ")}`,
    };
  }
  return {
    error:
      `\`${table}\` has ${found.length} single-column foreign keys into \`${refTable}\`, so ` +
      `"the ${refTable} column" is ambiguous: ${found.map(fkLabel).join("; ")}`,
  };
}

export function fkLabel(f: ForeignKey): string {
  return `${f.name} (${f.columns.join(", ")}) -> ${f.refTable}(${f.refColumns.join(", ")})`;
}

export function uniqueLabel(u: UniqueObject): string {
  const kind = u.constraintName === null ? "unique index" : `unique constraint ${u.constraintName}`;
  const partial = u.predicate === null ? "" : ` WHERE ${u.predicate}`;
  return `${u.indexName} [${kind}] on (${u.columns.join(", ")})${partial}`;
}

/* --------------------- the whole schema, as comparable cells --------------------- */

/**
 * AC6 compares the schema before and after a round trip, and "identical" has to mean more
 * than a table list. Every object is reduced to a `(key, value)` pair so a difference reads
 * as a named cell — which column, which index, which enum label — rather than as two large
 * objects that are not `toEqual`.
 *
 * The migration runner's own `_migrations` table is excluded: its rows change on every
 * legitimate re-run, and its presence is T000's rather than T005's. Triggers are included
 * because AC4's existence check is one, and a round trip that restored every table and lost
 * the trigger would otherwise pass.
 */
export interface Cell {
  key: string;
  value: string;
}

export interface FullShape {
  columns: Cell[];
  indexes: Cell[];
  constraints: Cell[];
  enums: Cell[];
  triggers: Cell[];
  functions: Cell[];
}

const RUNNER_TABLE = "_migrations";

export async function fullShape(query: Query): Promise<FullShape> {
  const columns = (
    await query(`
      select table_name, column_name, data_type, udt_name, is_nullable, column_default,
             character_maximum_length, numeric_precision, numeric_scale
        from information_schema.columns c
       where table_schema = 'public' and table_name <> '${RUNNER_TABLE}'
       order by table_name, column_name
    `)
  ).map((r) => ({
    key: `${String(r.table_name)}.${String(r.column_name)}`,
    value: [
      r.data_type,
      r.udt_name,
      r.is_nullable,
      r.column_default,
      r.character_maximum_length,
      r.numeric_precision,
      r.numeric_scale,
    ]
      .map((v) => (v === null || v === undefined ? "(null)" : String(v)))
      .join(" | "),
  }));

  const indexes = (
    await query(`
      select tablename, indexname, indexdef
        from pg_indexes
       where schemaname = 'public' and tablename <> '${RUNNER_TABLE}'
       order by tablename, indexname
    `)
  ).map((r) => ({ key: `${String(r.tablename)}.${String(r.indexname)}`, value: String(r.indexdef) }));

  const constraints = (
    await query(`
      select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
        from pg_constraint
       where connamespace = 'public'::regnamespace
         and conrelid::regclass::text <> '${RUNNER_TABLE}'
       order by 1, 2
    `)
  ).map((r) => ({
    key: `${String(r.table_name)}.${String(r.conname)}`,
    value: String(r.definition),
  }));

  /* Labels carry their sort order, because that is what a `<` comparison on an enum reads and
     a round trip that restores the members in another order has changed the type. */
  const enums = (
    await query(`
      select t.typname as name, e.enumlabel as label, e.enumsortorder as ord
        from pg_type t join pg_enum e on e.enumtypid = t.oid
       where t.typnamespace = 'public'::regnamespace
       order by t.typname, e.enumsortorder
    `)
  ).map((r) => ({ key: `${String(r.name)}.${String(r.label)}`, value: String(r.ord) }));

  const triggers = (
    await query(`
      select c.relname as table_name, t.tgname as name, pg_get_triggerdef(t.oid) as definition
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and not t.tgisinternal
       order by 1, 2
    `)
  ).map((r) => ({
    key: `${String(r.table_name)}.${String(r.name)}`,
    value: String(r.definition),
  }));

  /* AC4's existence check is a trigger, and a trigger is two objects: the trigger and the
     function it calls. A down script that drops the first and leaves the second passes a
     table-and-index comparison, and the next `up` meets a function that already exists.
     Extension-owned functions are excluded through `pg_depend` — `CREATE EXTENSION vector`
     installs several hundred into `public` and none of them is anybody's migration. */
  const functions = (
    await query(`
      select p.proname as name,
             pg_get_function_identity_arguments(p.oid) as args,
             pg_get_functiondef(p.oid) as definition
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.prokind = 'f'
         and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       order by 1, 2
    `)
  ).map((r) => ({
    key: `${String(r.name)}(${String(r.args)})`,
    value: String(r.definition),
  }));

  return { columns, indexes, constraints, enums, triggers, functions };
}
