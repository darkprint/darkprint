import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  PUBLISHED,
  PUBLISHED_COLUMNS,
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
