import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  PUBLISHED,
  PUBLISHED_COLUMNS,
  PUBLISHED_TYPES,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Scratch,
} from "./harness.ts";
import { columnsOf, readCatalogue, type Catalogue } from "./catalogue.ts";

/* ============================================================
   T005 D-05-08 — the published block's own notation, asserted at
   every column it names

   "A column is `NOT NULL` unless written `NULL`."

   ── why this file exists, and why it is not a patch ──
   The ruling was reached because `api_key.label` was written `label
   text` with no marker: T005's implementer read unmarked as
   required, this author read it as nullable, and both readings were
   defensible against the text. **Nine columns were divergent and
   exactly one reddened** — `api_key`'s, and only because it was the
   single place this suite hardcoded an INSERT instead of deriving
   the required set from the catalogue. The other eight agreed by
   luck.

   That is a green with one measurement in it. Fixing the one cell
   would have restored the luck rather than removed the dependence on
   it, so what is asserted here is the *convention*, at every
   published column of every table. If the block and the schema
   disagree again, the suite reds at the column that disagrees rather
   than wherever a hardcoded literal happens to sit.

   ── and it is a claim about the CONTRACT, not only the schema ──
   `rows.ts` derives required columns from the catalogue, which is
   what made this suite robust to two contract amendments landing
   mid-round. That robustness has a cost this file pays back:
   deriving means the suite cannot notice that the schema and the
   block disagree, because it only ever reads one of them. A derived
   fill answers "what must I supply?"; it never answers "is that what
   was published?"
   ============================================================ */

let scratch: Scratch;
let cat: Catalogue;

beforeAll(async () => {
  scratch = await scratchDatabase("columns");
  cat = await readCatalogue(scratch.query);
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

suite("T005 D-05-08 — every published column has the nullability the block gives it", () => {
  for (const [table, columns] of Object.entries(PUBLISHED_COLUMNS)) {
    it(`\`${table}\` matches the block at all ${columns.length} of its published columns`, () => {
      requireT005Shipped(scratch);

      const live = new Map(columnsOf(cat, table).map((c) => [c.name, c]));
      const wrong: string[] = [];
      for (const [name, nullable] of columns) {
        const column = live.get(name);
        if (column === undefined) {
          wrong.push(`${name}: absent`);
          continue;
        }
        if (column.nullable !== nullable) {
          wrong.push(
            `${name}: block says ${nullable ? "NULL" : "NOT NULL"}, schema says ` +
              `${column.nullable ? "NULL" : "NOT NULL"}`,
          );
        }
      }

      expect(
        wrong,
        `${PUBLISHED.d0508}\n  ${publishedFor(table)}\n` +
          `  columns on ${table}: ${columnsOf(cat, table)
            .map((c) => `${c.name}${c.nullable ? "" : " NOT NULL"}`)
            .join(", ")}\n` +
          `  A column the block calls required and the schema leaves nullable is storage a ` +
          `consumer's own published type says cannot happen — T230's \`ApiKeyRecord.label: ` +
          `string\` is the worked example, and it is a lie the moment a row exists without one.`,
      ).toEqual([]);
    });
  }

  it("D-05-09: `run_report.cost_units` is UNQUALIFIED numeric, so a submitted cost cannot be silently truncated", () => {
    requireT005Shipped(scratch);

    const column = columnsOf(cat, "run_report").find((c) => c.name === "cost_units");
    expect(column === undefined ? "(absent)" : null, PUBLISHED.runReport).toBeNull();
    if (column === undefined) return;

    /* Read from the CATALOGUE, which is the half that decides it. The type lives in two
       places — `lib/db/schema.ts` and the migration — and `ac8-names` compares those two on
       unique index names only. A schema.ts-only fix leaves the database still truncating and
       reds here, because `information_schema` is built from what the migration actually
       applied. A migration-only fix greens here and leaves drizzle's idea of the column
       wrong for whatever generates the next migration; that half is not observable through
       any surface this suite may read, and is reported rather than claimed. */
    expect(
      { precision: column.numericPrecision, scale: column.numericScale },
      `${PUBLISHED.d0509}\n  \`numeric\` and \`numeric(18,6)\` are the same \`data_type\` and ` +
        `differ only here, which is why nothing in this suite could see it before. A qualified ` +
        `numeric does not refuse an over-precise cost — it ROUNDS one, and the rounded value ` +
        `goes into T180's median and p10/p90 as though it had been submitted.`,
    ).toEqual({ precision: null, scale: null });
  });

  it("every column whose type the block writes out has that type in the catalogue", () => {
    requireT005Shipped(scratch);

    /* The general form of D-05-09, scoped honestly. Only columns the block names a type for
       are here: pinning the rest would be inventing a contract, since the block is silent on
       most types and a blind suite that filled the silence would red on choices nobody
       published. What this does buy is that the next qualifier added to any published type —
       a `varchar(n)` on `token_hash`, a `numeric(p,s)` anywhere — is a red rather than a
       silent narrowing, which is the class D-05-09 belongs to rather than the instance. */
    const wrong: string[] = [];
    for (const t of PUBLISHED_TYPES) {
      const column = columnsOf(cat, t.table).find((c) => c.name === t.column);
      if (column === undefined) {
        wrong.push(`${t.table}.${t.column}: absent`);
        continue;
      }
      const actual = {
        dataType: column.dataType,
        precision: column.numericPrecision,
        scale: column.numericScale,
      };
      const expected = { dataType: t.dataType, precision: t.precision, scale: t.scale };
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        wrong.push(`${t.table}.${t.column}: block says ${render(expected)}, schema says ${render(actual)}   [${t.clause}]`);
      }
    }

    expect(
      wrong,
      `${PUBLISHED.d0509}\n  A qualifier the block does not write is a bound nobody published, ` +
        `and a bound that TRUNCATES rather than REFUSES converts a rejectable input into a ` +
        `wrong number.`,
    ).toEqual([]);
  });

  it("`schema.ts` declares the same type the catalogue reports, for every column the block writes out", async () => {
    requireT005Shipped(scratch);

    /* The mirror of the assertion above, and the falsifier T005's adversary named as the one
       nobody takes: the type lives in `lib/db/schema.ts` AND in the migration, and until this
       existed the two were compared on unique index NAMES only. A schema.ts-only fix leaves
       the database truncating; a migration-only fix leaves drizzle's column wrong for whatever
       generates the next migration. Both used to pass the whole suite.

       Each side is compared against the BLOCK rather than against the other, on purpose: a
       direct diff says only that they disagree, while this says which of the two has drifted
       from the contract — and that is the sentence whoever fixes it needs.

       I had reported this half as unobservable-by-construction. That was a guess presented as
       a fact; measured, `getTableConfig(...).columns[i].getSQLType()` answers `numeric(6, 3)`
       for base's `account.validator_weight`, so the drizzle side publishes exactly what is
       needed. Reaching `schema` through the `@/lib/db` barrel is the T010 precedent, ruled
       acceptable under D-05-05. */
    const { schema } = (await import("@/lib/db")) as { schema: Record<string, unknown> };
    const { getTableConfig } = await import("drizzle-orm/pg-core");

    const byTable = new Map<string, Map<string, string>>();
    for (const value of Object.values(schema)) {
      let config: ReturnType<typeof getTableConfig>;
      try {
        config = getTableConfig(value as Parameters<typeof getTableConfig>[0]);
      } catch {
        /* Not a pgTable — the schema module also exports enums and types. */
        continue;
      }
      byTable.set(config.name, new Map(config.columns.map((c) => [c.name, c.getSQLType()])));
    }

    const wrong: string[] = [];
    for (const t of PUBLISHED_TYPES) {
      const declared = byTable.get(t.table)?.get(t.column);
      if (declared === undefined) {
        wrong.push(
          `${t.table}.${t.column}: no such column on any pgTable in the published schema` +
            (byTable.has(t.table) ? "" : ` (no pgTable carries the SQL name \`${t.table}\`)`),
        );
        continue;
      }
      if (declared !== t.sqlType) {
        wrong.push(`${t.table}.${t.column}: block says \`${t.sqlType}\`, schema.ts declares \`${declared}\`   [${t.clause}]`);
      }
    }

    expect(
      wrong,
      `${PUBLISHED.d0509}\n  This is the schema.ts side. The assertion above it reads the same ` +
        `columns from the catalogue, which is built from the migration — so a fix applied to ` +
        `only one of the two reds exactly one of the two tests, and the message names which.`,
    ).toEqual([]);
  }, 120_000);

  it("no published table carries a NOT NULL column the block does not name and cannot default", () => {
    requireT005Shipped(scratch);

    /* The other direction, and the one a suite that only checks its own list is blind to.
       A required column nobody published is a column every consumer's INSERT omits — and
       unlike a missing column, it fails at *write* time in the consuming task rather than
       here, where the contract could still be amended. Columns with a default are excluded:
       `id`, `created_at` and the like are required of the storage and never of the caller,
       which is the same distinction `rows.ts` makes when it builds a row. */
    const surprises: string[] = [];
    for (const [table, columns] of Object.entries(PUBLISHED_COLUMNS)) {
      const published = new Set<string>(columns.map(([name]) => name));
      for (const column of columnsOf(cat, table)) {
        if (published.has(column.name) || column.nullable || column.hasDefault) continue;
        surprises.push(`${table}.${column.name} ${column.dataType}`);
      }
    }

    expect(
      surprises,
      `${PUBLISHED.d0508}\n  Every one of these is NOT NULL, has no default, and is named ` +
        `nowhere in the published block, so a consumer writing the published columns and ` +
        `nothing else gets 23502 at its first insert.\n  If the column is right, it belongs ` +
        `in the block; if the block is right, it belongs nullable or defaulted.`,
    ).toEqual([]);
  });
});

function publishedFor(table: string): string {
  const key = table.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  const clause = (PUBLISHED as Record<string, string>)[key];
  return clause ?? PUBLISHED.preamble;
}

function render(t: { dataType: string; precision: number | null; scale: number | null }): string {
  return t.precision === null && t.scale === null
    ? t.dataType
    : `${t.dataType}(${t.precision ?? "?"},${t.scale ?? "?"})`;
}
