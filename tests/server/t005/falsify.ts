/* ============================================================
   T005 — falsifying a unique constraint in both directions

   "The second insert fails" is half a test. A unique constraint on
   `(account)` alone also makes the second insert fail, and it
   forbids a great deal the criterion permits — one save per account,
   for ever. A suite that only checks the duplicate holds "the
   constraint can refuse" while holding nothing about *what* it
   refuses.

   So every criterion here is checked as a pair, which is the
   collapse-and-saturation shape this run already requires of a
   ruling that splits a domain:

     collapse    the exact duplicate is refused, at the driver
     saturation  a row differing in exactly ONE of the named columns
                 is accepted — once per column

   A constraint that is too narrow fails the first. A constraint that
   is too broad fails the second. A constraint over the wrong column
   set fails one or the other for a reason the message names.

   And the refusal is read for *which* constraint it names, not only
   for its SQLSTATE. T010's D-14: a bare 23505 says a unique
   constraint was violated and not which one. AC8 is the requirement
   that a consumer can tell them apart, so the assertion is that the
   driver error's `constraint` field is the name derived from the
   catalogue — derived, never written down here.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { expect } from "vitest";

import type { Query } from "./harness.ts";
import { SQLSTATE } from "./harness.ts";
import {
  columnsOf,
  foreignKeysOf,
  uniqueLabel,
  type Catalogue,
  type UniqueObject,
} from "./catalogue.ts";
import {
  another,
  attemptToDriverError,
  HarnessError,
  insertRow,
  type DriverError,
  type Fixtures,
  type Overrides,
} from "./rows.ts";

export interface FalsifyResult {
  /** The values the accepted first row carried on the constrained columns. */
  base: Overrides;
  /** Which column each accepted variant differed in, in the order they were tried. */
  variedColumns: string[];
}

/**
 * A value of the right type that is not `current`. Foreign keys get a genuinely different
 * parent row rather than a random uuid: a random uuid would be refused by the foreign key
 * and the test would read that refusal as the unique constraint doing its job, which is a
 * pass for the wrong reason.
 */
async function differentValue(
  f: Fixtures,
  cat: Catalogue,
  table: string,
  columnName: string,
  current: unknown,
): Promise<unknown> {
  const column = columnsOf(cat, table).find((c) => c.name === columnName);
  if (column === undefined) {
    throw new HarnessError(`\`${table}.${columnName}\` is not in the catalogue.`);
  }

  const fk = foreignKeysOf(cat, table).find(
    (k) => k.columns.length === 1 && k.columns[0] === columnName,
  );
  if (fk !== undefined) {
    const parent = await another(f, fk.refTable);
    const value = parent[fk.refColumns[0]];
    if (value === undefined || value === current) {
      throw new HarnessError(
        `Could not make a second, distinct \`${fk.refTable}\` row to vary ` +
          `\`${table}.${columnName}\` with.`,
      );
    }
    return value;
  }

  if (column.dataType === "USER-DEFINED") {
    const labels = cat.enums.get(column.udtName) ?? [];
    const other = labels.find((l) => l !== current);
    if (other === undefined) {
      throw new HarnessError(
        `\`${table}.${columnName}\` is the enum \`${column.udtName}\` with labels ` +
          `[${labels.join(", ")}], so there is no second value to vary it with. A ` +
          `single-member enum makes this column unable to discriminate anything.`,
      );
    }
    return other;
  }

  switch (column.dataType) {
    case "uuid":
      return randomUUID();
    case "text":
    case "character varying":
    case "character":
      return `varied-${randomUUID()}`;
    case "integer":
    case "bigint":
    case "smallint":
    case "numeric":
    case "double precision":
    case "real":
      return typeof current === "number" ? current + 1 : 2;
    case "boolean":
      return current !== true;
    case "timestamp with time zone":
    case "timestamp without time zone":
    case "date":
      return new Date(2001, 0, 1);
    default:
      throw new HarnessError(
        `No varied value for \`${table}.${columnName}\` of type \`${column.dataType}\`.`,
      );
  }
}

/**
 * The whole of a unique criterion, run against one derived unique object.
 *
 * `constrained` is the column set the acceptance criterion names, resolved from the
 * catalogue by the caller. It is checked against `unique.columns` as a set before anything
 * is inserted, so a constraint over the wrong columns is reported as that rather than as a
 * mysterious accepted duplicate.
 */
export async function falsifyUnique(
  query: Query,
  cat: Catalogue,
  f: Fixtures,
  table: string,
  unique: UniqueObject,
  constrained: readonly string[],
  clause: string,
): Promise<FalsifyResult> {
  expect(
    [...unique.columns].sort(),
    `${clause}\n  The unique object on \`${table}\` covers (${unique.columns.join(", ")}), and ` +
      `the criterion names (${constrained.join(", ")}).\n  found: ${uniqueLabel(unique)}`,
  ).toEqual([...constrained].sort());

  /* A partial index is a third object, and it is the one that reads as present while leaving a
     region of the table unguarded: every row outside the predicate can be duplicated freely.
     Nothing in T005's criteria asks for a conditional uniqueness, so a predicate here is a
     narrowing nobody wrote down. */
  expect(
    unique.predicate,
    `${clause}\n  \`${uniqueLabel(unique)}\` is PARTIAL. Outside \`${unique.predicate}\` the ` +
      `column set is not unique at all, so the criterion holds for some rows and not others. ` +
      `Assert-by-behaviour cannot see that from one row, which is why it is read here.`,
  ).toBeNull();

  /* The first row. Values for the constrained columns are supplied explicitly so this test
     controls them; everything else the schema requires is filled in by type. */
  const seed = await insertRow(f, table, {});
  const base: Overrides = {};
  for (const name of constrained) {
    if (!(name in seed)) {
      throw new HarnessError(
        `The row inserted into \`${table}\` did not come back carrying \`${name}\`.`,
      );
    }
    base[name] = seed[name];
  }

  /* --- saturation: one variant per constrained column, each of which MUST be accepted --- */
  const variedColumns: string[] = [];
  for (const name of constrained) {
    const values: Overrides = { ...base, [name]: await differentValue(f, cat, table, name, base[name]) };
    const varied = await attemptToDriverError(() => insertRow(f, table, values));
    expect(
      varied.raised ? renderRefusal(varied) : null,
      `${clause}\n  A row differing from the first in \`${name}\` ALONE was refused. The ` +
        `criterion constrains (${constrained.join(", ")}) together; a constraint that also ` +
        `refuses this one is broader than the criterion and forbids what the product allows.\n` +
        `  constraint under test: ${uniqueLabel(unique)}`,
    ).toBeNull();
    variedColumns.push(name);
  }

  /* --- collapse: the exact duplicate, which MUST be refused, by the database --- */
  const duplicate = await attemptToDriverError(() =>
    insertRow(f, table, { ...base }),
  );

  expect(
    duplicate.raised,
    `${clause}\n  A second row with the same (${constrained.join(", ")}) was ACCEPTED. The ` +
      `criterion is a constraint the database enforces, not a convention a caller follows: ` +
      `every consuming task will pass its own tests against a store that permits exactly what ` +
      `it forbids.\n  unique objects on ${table}: ` +
      `${cat.uniques.filter((u) => u.table === table).map(uniqueLabel).join("; ") || "(none)"}`,
  ).toBe(true);

  const driver = duplicate.raised ? duplicate.driver : null;
  expect(
    driver === null ? String((duplicate as { cause: unknown }).cause) : driver.code,
    `${clause}\n  The duplicate was refused, but not by the driver — the rejection carries no ` +
      `SQLSTATE. A refusal from a pre-check satisfies a caller and leaves the storage open to ` +
      `every other writer, which is what "enforced by the database" rules out.`,
  ).toBe(SQLSTATE.unique_violation);

  /* AC8, and the reason it is a criterion rather than a nicety: a bare 23505 says *a* unique
     constraint was violated. The name is what lets T140 tell an idempotent save from a
     collision on something else, and it is derived here rather than written down. */
  expect(
    driver?.constraint ?? null,
    `${clause}\n  ${CONSTRAINT_NAME_CLAUSE}\n  The duplicate raised ${driver?.code} and named ` +
      `constraint ${JSON.stringify(driver?.constraint ?? null)}; the unique object the schema ` +
      `actually carries is ${uniqueLabel(unique)}.`,
  ).toBe(unique.indexName);

  return { base, variedColumns };
}

const CONSTRAINT_NAME_CLAUSE =
  "AC8 — every unique constraint above is named, and the name is derived from the schema at " +
  "runtime wherever a module will match on it. T010's D-14: a bare 23505 says *a* unique " +
  "constraint was violated and not which.";

function renderRefusal(outcome: { driver: DriverError | null; cause: unknown }): string {
  return outcome.driver === null
    ? String(outcome.cause)
    : `${outcome.driver.code} ${outcome.driver.constraint ?? "(unnamed)"}: ${outcome.driver.message}`;
}

/**
 * The single unique object on `table` that is not its primary key, or a message saying why
 * "the" one is not well defined. Two of them make every assertion below a coin flip, so the
 * ambiguity is a red naming both rather than a silent first-match.
 */
export function soleUnique(
  cat: Catalogue,
  table: string,
): UniqueObject | { error: string } {
  const found = cat.uniques.filter((u) => u.table === table && !u.primary);
  if (found.length === 1) return found[0];
  if (found.length === 0) {
    return {
      error:
        `\`${table}\` carries no unique object other than its primary key.\n` +
        `  Both catalogues were read: pg_index.indisunique (what drizzle's uniqueIndex() ` +
        `produces) and pg_constraint.contype = 'u' (what unique() produces). Neither has one.`,
    };
  }
  return {
    error:
      `\`${table}\` carries ${found.length} unique objects besides its primary key, so "the" ` +
      `one this criterion is about is ambiguous: ${found.map(uniqueLabel).join("; ")}`,
  };
}
