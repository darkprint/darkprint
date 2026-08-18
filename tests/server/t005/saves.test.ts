import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  CONTRACT,
  PUBLISHED,
  PUBLISHED_UNIQUES,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Scratch,
} from "./harness.ts";
import {
  columnsOf,
  foreignKeysOf,
  primaryKeyOf,
  readCatalogue,
  uniqueLabel,
  type Catalogue,
} from "./catalogue.ts";
import { fixtures, type Fixtures } from "./rows.ts";
import { falsifyUnique, soleUnique } from "./falsify.ts";

/* ============================================================
   T005 AC1 — the `save` table

   "T140 AC2 — saving one target twice is idempotent — is a unique
   constraint on (account, target_kind, target_id), enforced by the
   database: a second insert must fail at the driver, and a test that
   inserts twice through raw SQL must see it fail."

   This is the criterion with the clearest cost if it is missing.
   T140's own suite will call `saveTarget` twice and see one row,
   because `saveTarget` will be written with an `ON CONFLICT DO
   NOTHING` or a select-then-insert, and both look right. Under two
   concurrent callers the second is wrong, and nothing in T140's
   tests can tell — the discriminating fact lives here.
   ============================================================ */

let scratch: Scratch;
let cat: Catalogue;
let f: Fixtures;

beforeAll(async () => {
  scratch = await scratchDatabase("saves");
  cat = await readCatalogue(scratch.query);
  f = fixtures(scratch.query, cat);
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

suite("T005 AC1 — saving one target twice is refused by the database", () => {
  it("`save` exists and carries the published columns", () => {
    requireT005Shipped(scratch);
    expect(
      cat.tables.includes("save"),
      `${CONTRACT.tables}\n  tables present: ${cat.tables.join(", ")}`,
    ).toBe(true);

    const names = columnsOf(cat, "save").map((c) => c.name);
    expect(
      ["account_id", "target_kind", "target_id", "created_at"].filter((n) => !names.includes(n)),
      `${PUBLISHED.save}\n  columns on save: ${names.join(", ")}`,
    ).toEqual([]);
  });

  it("`save.target_kind` is the existing enum, so the three kinds are all storable rather than one being dead", () => {
    requireT005Shipped(scratch);
    const column = columnsOf(cat, "save").find((c) => c.name === "target_kind");
    expect(column === undefined ? "(absent)" : null, PUBLISHED.save).toBeNull();
    if (column === undefined) return;

    /* Reachability rather than presence. T140's AC4 is "the three kinds round-trip
       distinguishably", and a kind column whose domain has one member satisfies every
       uniqueness assertion below while making that criterion vacuous: a cross product is a
       domain by construction only if every cell can occur. */
    expect(
      [...(cat.enums.get(column.udtName) ?? [])].sort(),
      `${PUBLISHED.targetKind}\n  \`save.target_kind\` is \`${column.udtName}\`.`,
    ).toEqual(["blueprint", "card", "term"]);
  });

  it("AC1: a second row with the same (account_id, target_kind, target_id) is refused at the driver, and one differing in any single one of them is not", async () => {
    requireT005Shipped(scratch);
    const unique = soleUnique(cat, "save");
    expect(
      "error" in unique ? unique.error : null,
      `${CONTRACT.ac1}\n  ${PUBLISHED.save}\n  Without it, "saving one target twice is ` +
        `idempotent" is a convention every future caller has to remember rather than something ` +
        `the store enforces.`,
    ).toBeNull();
    if ("error" in unique) return;

    await falsifyUnique(
      scratch.query,
      cat,
      f,
      "save",
      unique,
      PUBLISHED_UNIQUES.save,
      `${CONTRACT.ac1}\n  ${PUBLISHED.save}`,
    );
  }, 120_000);

  it("`save` has a primary key, so the row has an identity to unsave by", () => {
    requireT005Shipped(scratch);
    const pk = primaryKeyOf(cat, "save");
    expect(
      pk === undefined ? "(none)" : null,
      `${PUBLISHED.preamble}\n  T140 publishes \`unsaveTarget\`, and every base table carries a ` +
        `primary key for the reason T000's own suite states: without one, one record per ` +
        `(account, target) is a convention rather than a constraint.`,
    ).toBeNull();
  });

  it("`save.account_id` is NOT NULL and points at `account`, so a save cannot exist without an owner", () => {
    requireT005Shipped(scratch);
    const column = columnsOf(cat, "save").find((c) => c.name === "account_id");
    expect(column?.nullable ?? true, PUBLISHED.preamble).toBe(false);

    const keys = foreignKeysOf(cat, "save").filter((k) => k.refTable === "account");
    expect(
      keys.map((k) => k.columns.join(", ")),
      `${PUBLISHED.preamble}\n  T140's AC1 is that a save is invisible to every caller but its ` +
        `owner. An ownerless row has no owner to be visible to, and the unique constraint ` +
        `treats its NULL as distinct from every other, so it is not even idempotent.\n` +
        `  unique on save: ${uniqueLabel(soleUniqueOrThrow(cat))}`,
    ).toEqual([["account_id"].join(", ")]);
  });
});

function soleUniqueOrThrow(cat: Catalogue): Parameters<typeof uniqueLabel>[0] {
  const found = soleUnique(cat, "save");
  if ("error" in found) {
    return { indexName: "(none)", table: "save", columns: [], primary: false, constraintName: null, predicate: null };
  }
  return found;
}
