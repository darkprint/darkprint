import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  BASE_MIGRATION_ID,
  BASE_TABLES,
  CONTRACT,
  T005_TABLES,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Scratch,
} from "./harness.ts";
import baseline from "./baseline.json" with { type: "json" };
import { fullShape, shapeOf, type FullShape } from "./catalogue.ts";
import type { Row } from "./harness.ts";

/* ============================================================
   T005 AC6 — reversible against a scratch database

   "Every migration is paired up/down and reversible against a
   scratch database: apply, roll back, apply again, and the schema is
   identical at both applications — compared structurally, not by the
   migration file."

   The clause "not by the migration file" is the whole criterion.
   Diffing `0002_x.up.sql` against `0002_x.down.sql` proves that
   someone wrote two files; it says nothing about what Postgres did
   with them. A `down` that drops a table and an `up` that rebuilds
   it without one of its foreign keys passes every file-level check
   and every table-name check, and this is where it reds.

   ── the experiment, and why it runs the round trip twice ──
   A single apply → roll back → apply is satisfied by a `down` that
   does nothing at all: the second apply is then a no-op against a
   schema that never changed, and the two snapshots agree trivially.
   So the rollback is checked for having *removed* something first,
   and the round trip is then run a second time — a `down` correct
   once and destructive twice is a real shape, and one application
   cannot see it.

   ── and it is stepwise, because "every migration is paired" is
      a claim about each of them ──
   Rolling back N steps at once and re-applying tests the aggregate.
   A migration whose own down is missing or wrong can hide inside
   that if a later one happens to drop what it left behind. Each
   T005 migration is therefore rolled back on its own, one step at a
   time, and the intermediate schema is captured — then re-applied
   and compared level by level.
   ============================================================ */

let scratch: Scratch;

beforeAll(async () => {
  scratch = await scratchDatabase("reversible");
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

suite("T005 AC6 — apply, roll back, apply again, and the schema is structurally identical", () => {
  it("AC6: the round trip restores every column, index, constraint, enum and trigger", async () => {
    requireT005Shipped(scratch);
    const applied = await fullShape(scratch.query);

    const rolledIds = await scratch.migrateDown(scratch.t005Migrations.length);
    expect(
      [...rolledIds].sort(),
      `${CONTRACT.ac6}\n  \`migrateDown\` was asked for ${scratch.t005Migrations.length} steps ` +
        `and reported rolling back [${rolledIds.join(", ")}]. T005 applied ` +
        `[${scratch.t005Migrations.join(", ")}].`,
    ).toEqual([...scratch.t005Migrations].sort());

    const rolled = await fullShape(scratch.query);
    /* A rollback that changes nothing would let the restore assertion below pass while proving
       nothing at all — T000's own AC2 test carries the same guard for the same reason. */
    expect(
      difference(applied, rolled).length > 0,
      `${CONTRACT.ac6}\n  Rolling back every T005 migration changed nothing in the schema, so ` +
        `the restore below is comparing a schema against itself.`,
    ).toBe(true);

    await scratch.migrateUp();
    const reapplied = await fullShape(scratch.query);

    expect(
      difference(applied, reapplied),
      `${CONTRACT.ac6}\n  Compared structurally — every column with its type, nullability and ` +
        `default, every index definition, every constraint definition, every enum label in ` +
        `order, and every trigger. A down that drops a table and an up that rebuilds it without ` +
        `one of its foreign keys passes a table-name check and fails this one.`,
    ).toEqual([]);
  }, 300_000);

  it("AC6: a second round trip is identical to the first, so the pair is not correct only once", async () => {
    requireT005Shipped(scratch);
    const before = await fullShape(scratch.query);
    await scratch.migrateDown(scratch.t005Migrations.length);
    await scratch.migrateUp();
    const after = await fullShape(scratch.query);

    expect(
      difference(before, after),
      `${CONTRACT.ac6}\n  The first round trip agreed and the second did not, which is a down ` +
        `or an up that is not idempotent in its own right — a \`CREATE INDEX\` without ` +
        `\`IF NOT EXISTS\` beside a \`DROP\` that misses it, for instance. One application ` +
        `cannot see this.`,
    ).toEqual([]);
  }, 300_000);

  it("AC6: each T005 migration rolls back on its own, and re-applying restores the same schema at every level", async () => {
    requireT005Shipped(scratch);
    /* Stepwise. The aggregate test above is satisfied by a set of migrations that collectively
       undo each other; "every migration is paired up/down" is a claim about each one. */
    const levels: FullShape[] = [await fullShape(scratch.query)];
    for (let step = 0; step < scratch.t005Migrations.length; step += 1) {
      const rolled = await scratch.migrateDown(1);
      expect(
        rolled,
        `${CONTRACT.ac6}\n  A single-step rollback at level ${step} moved ` +
          `${rolled.length} migrations. Each step should move exactly one.`,
      ).toHaveLength(1);
      levels.push(await fullShape(scratch.query));
    }

    await scratch.migrateUp();

    const restored = await fullShape(scratch.query);
    expect(
      difference(levels[0], restored),
      `${CONTRACT.ac6}\n  Rolling T005's migrations back one at a time and re-applying them ` +
        `did not restore the schema the aggregate round trip did. A step whose own down is a ` +
        `no-op is invisible when a later step drops what it left behind.`,
    ).toEqual([]);
  }, 300_000);

  it("AC6: rolling T005 back leaves base standing — all ten T000 tables present, none of the six added", async () => {
    requireT005Shipped(scratch);
    await scratch.migrateDown(scratch.t005Migrations.length);
    const rows = await scratch.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
    );
    const present = rows.map((r) => String(r.table_name));

    try {
      /* The half a rollback gets wrong in the expensive direction. A down script written with
         a CASCADE, or one that drops a shared enum `save` and `note` both use, takes base with
         it — and the schema is then "reversed" in the sense that nothing T005 added remains,
         while eight merged tasks have lost their tables. */
      expect(
        BASE_TABLES.filter((t) => !present.includes(t)),
        `${CONTRACT.ac6}\n  ${CONTRACT.ac7}\n  Rolling T005 back removed a table T000 shipped. ` +
          `A \`DROP ... CASCADE\` in a down script reaches further than the migration that ` +
          `wrote it, and eight tasks have merged against these.`,
      ).toEqual([]);

      expect(
        T005_TABLES.filter((t) => present.includes(t)),
        `${CONTRACT.ac6}\n  A down that leaves its own tables behind is not a rollback, and the ` +
          `next \`migrateUp\` meets a table it is about to create.`,
      ).toEqual([]);

      expect(
        present.includes("_migrations"),
        `${CONTRACT.ac6}\n  The runner's own bookkeeping table is T000's and outlives any one ` +
          `migration's rollback.`,
      ).toBe(true);

      /* The half a table list cannot see, and the reason this assertion is here rather than
         in the AC7 file: AC7a is an ALTER on a base table, and a down script that drops
         T005's six tables and forgets to undo the ALTER leaves base *changed*. The round
         trip above still agrees with itself — `SET NOT NULL` is idempotent, so re-applying
         restores an identical schema — and every table-name check passes. Only a comparison
         against the frozen baseline, taken at the rolled-back state, catches it. */
      const rolledBase = await shapeOf(scratch.query, BASE_TABLES);
      expect(
        diffAgainstBaseline(rolledBase),
        `${CONTRACT.ac6}\n  ${CONTRACT.ac7a}\n  With every T005 migration rolled back, the ten ` +
          `base tables should be exactly what \`${BASE_MIGRATION_ID}\` left — including ` +
          `\`handle_reservation.account_id\` being nullable again. A down that drops the six ` +
          `tables and forgets the ALTER is invisible to an apply/roll-back/apply comparison, ` +
          `because SET NOT NULL is idempotent and the second apply restores the same schema.\n` +
          `  baseline captured from ${baseline.capturedFrom}`,
      ).toEqual([]);
    } finally {
      /* Left migrated for whatever runs next in this file's database, and because a scratch
         database this suite abandons half-rolled-back is a worse artefact than the assertion
         above is worth. */
      await scratch.migrateUp();
    }
  }, 300_000);

  it("AC6: base's own migration is untouched, so the reversal is of T005's work and not of a rewritten history", async () => {
    requireT005Shipped(scratch);
    /* `lib/db/migrations/**` is inside T005's `Owns`, so editing `0001_init` in place is
       available and would make every round trip above agree with itself while base moved. The
       id is checked here; AC7's frozen baseline is what checks the bytes. */
    expect(
      scratch.applied.includes(BASE_MIGRATION_ID),
      `${CONTRACT.ac6}\n  \`migrateUp\` applied [${scratch.applied.join(", ")}] and none of them ` +
        `is \`${BASE_MIGRATION_ID}\`. Base's migration has been renamed or absorbed, and every ` +
        `merged task's schema now arrives from a file with a different history.`,
    ).toBe(true);
    expect(
      scratch.t005Migrations.length > 0,
      `${CONTRACT.ac6}\n  applied: [${scratch.applied.join(", ")}]`,
    ).toBe(true);
  });
});

/**
 * The named cells two schemas differ in. A list rather than a boolean, for the reason this
 * run keeps arriving at from the other side: reading *which* thing moved is what separates a
 * real difference from a comparison that never had a chance to see one.
 */
function difference(before: FullShape, after: FullShape): string[] {
  const out: string[] = [];
  for (const key of Object.keys(before) as (keyof FullShape)[]) {
    const b = new Map(before[key].map((r) => [r.key, r.value]));
    const a = new Map(after[key].map((r) => [r.key, r.value]));
    for (const [k, v] of b) {
      if (!a.has(k)) out.push(`removed ${key} ${k}`);
      else if (a.get(k) !== v) out.push(`changed ${key} ${k}: ${v} -> ${a.get(k)}`);
    }
    for (const k of a.keys()) if (!b.has(k)) out.push(`added ${key} ${k}`);
  }
  return out.sort();
}

/**
 * The named cells the ten base tables differ from base in. Shares its shape with the AC7
 * file's diff deliberately: the same reading of "byte-identical in the schema" is what makes
 * a green there and a green here mean the same thing.
 */
function diffAgainstBaseline(live: Awaited<ReturnType<typeof shapeOf>>): string[] {
  const out: string[] = [];
  const compare = (label: string, before: Row[], after: Row[], key: (r: Row) => string): void => {
    const b = new Map(before.map((r) => [key(r), r]));
    const a = new Map(after.map((r) => [key(r), r]));
    for (const [k, row] of b) {
      const other = a.get(k);
      if (other === undefined) {
        out.push(`removed ${label} ${k}`);
        continue;
      }
      for (const field of Object.keys(row)) {
        const was = row[field] === null || row[field] === undefined ? "(null)" : String(row[field]);
        const now =
          other[field] === null || other[field] === undefined ? "(null)" : String(other[field]);
        if (was !== now) out.push(`changed ${k} ${field}: ${was} -> ${now}`);
      }
    }
    for (const k of a.keys()) if (!b.has(k)) out.push(`added ${label} ${k}`);
  };

  compare("columns", baseline.shape.columns as Row[], live.columns, (r) => `${String(r.table_name)}.${String(r.column_name)}`);
  compare("indexes", baseline.shape.indexes as Row[], live.indexes, (r) => `${String(r.tablename)}.${String(r.indexname)}`);
  compare("constraints", baseline.shape.constraints as Row[], live.constraints, (r) => `${String(r.table_name)}.${String(r.conname)}`);
  return out.sort();
}
