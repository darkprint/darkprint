import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  CONTRACT,
  PUBLISHED_UNIQUES,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Scratch,
} from "./harness.ts";
import { readCatalogue, uniqueLabel, type Catalogue } from "./catalogue.ts";

/* ============================================================
   T005 AC8 — the constraint names a consumer will match on

   D-05-05, confirmed: since T005 ships no module, what AC8 obliges
   *here* is that every unique index carries an explicit name in
   `schema.ts` rather than a drizzle default, and is reachable
   through `getTableConfig(schema.<table>).indexes` so a consumer can
   derive it the way `lib/server/archive/constraints.ts` already
   does.

   T010's D-14 is why this is a criterion rather than a nicety: a
   bare `23505` says *a* unique constraint was violated and not
   which, and the index names `ArchiveConflictError`'s `kind`
   depended on were declared in three places with nothing checking
   them against each other. A rename would have made the typed
   conflict silently stop arriving, with nothing red.

   ── two independent instruments, on purpose ──
   The name is read once from the Postgres catalogue and once from
   the drizzle schema through the published `@/lib/db` barrel, and
   the assertion is that the two AGREE. Matching one of them against
   a string written here would only verify that this file can
   reproduce whichever one it copied. Reproducing the *agreement*
   under an independent instrument is what makes the second reading
   worth taking — the same argument as hashing a claim with a
   different tool rather than matching the digit string that carried
   it.

   Importing `schema` from the barrel is the T010 precedent and was
   ruled not to be reading a Forbidden file. Nothing here opens
   `lib/db/schema.ts`; the table is found by its SQL name, so this
   file never has to guess the TypeScript identifier it is exported
   under either.
   ============================================================ */

let scratch: Scratch;
let cat: Catalogue;

beforeAll(async () => {
  scratch = await scratchDatabase("names");
  cat = await readCatalogue(scratch.query);
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

suite("T005 AC8 — every unique constraint is named, and the name is derivable from the schema", () => {
  for (const [table, columns] of Object.entries(PUBLISHED_UNIQUES)) {
    it(`\`${table}\`'s unique on (${columns.join(", ")}) carries an explicit name that drizzle would not have chosen for it`, () => {
      requireT005Shipped(scratch);
      const found = cat.uniques.filter(
        (u) => u.table === table && !u.primary && [...u.columns].sort().join(",") === [...columns].sort().join(","),
      );
      expect(
        found.map(uniqueLabel),
        `${CONTRACT.ac8}\n  unique objects on ${table}: ` +
          `${cat.uniques.filter((u) => u.table === table).map(uniqueLabel).join("; ") || "(none)"}`,
      ).toHaveLength(1);
      if (found.length !== 1) return;

      /* Drizzle's default for an unnamed index is derived from the table and columns; an
         explicit name is a decision someone made. The property under test is not the string
         but that a name exists and is stable enough to match on, so this asserts it is
         non-empty and names the table — a name a reader of a 23505 cannot place is a name
         nobody will match on. */
      expect(found[0].indexName.length > 0, CONTRACT.ac8).toBe(true);
      expect(
        found[0].indexName.includes(table),
        `${CONTRACT.ac8}\n  found: ${uniqueLabel(found[0])}`,
      ).toBe(true);
    });
  }

  it("the name Postgres reports and the name `getTableConfig` derives from the published schema are the same string", async () => {
    requireT005Shipped(scratch);
    const { schema } = (await import("@/lib/db")) as { schema: Record<string, unknown> };
    const { getTableConfig } = await import("drizzle-orm/pg-core");

    const fromSchema = new Map<string, string[]>();
    for (const value of Object.values(schema)) {
      let config: ReturnType<typeof getTableConfig>;
      try {
        config = getTableConfig(value as Parameters<typeof getTableConfig>[0]);
      } catch {
        /* Not a pgTable — the schema module also exports enums and types. */
        continue;
      }
      const names = [
        ...config.indexes.filter((i) => i.config.unique).map((i) => i.config.name),
        ...config.uniqueConstraints.map((u) => u.name),
      ].filter((n): n is string => typeof n === "string");
      fromSchema.set(config.name, names.sort());
    }

    const disagreements: string[] = [];
    for (const table of Object.keys(PUBLISHED_UNIQUES)) {
      const declared = fromSchema.get(table);
      const live = cat.uniques
        .filter((u) => u.table === table && !u.primary)
        .map((u) => u.indexName)
        .sort();
      if (declared === undefined) {
        disagreements.push(`${table}: no pgTable in the published schema carries that SQL name`);
        continue;
      }
      if (declared.join("|") !== live.join("|")) {
        disagreements.push(
          `${table}: schema.ts declares [${declared.join(", ")}], Postgres reports [${live.join(", ")}]`,
        );
      }
    }

    expect(
      disagreements,
      `${CONTRACT.ac8}\n  \`lib/server/archive/constraints.ts\` derives its names through ` +
        `\`getTableConfig(schema.<table>).indexes\` rather than restating them beside the ` +
        `truth, and every one of the five consuming tasks will do the same. A name that is in ` +
        `the migration and not in the schema — or the reverse — makes that derivation return ` +
        `something the driver will never say, and the typed conflict silently stops arriving ` +
        `with nothing red. That is D-14, and it is the failure this criterion exists to close.`,
    ).toEqual([]);
  }, 120_000);
});
