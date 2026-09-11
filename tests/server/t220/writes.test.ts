/* ============================================================
   No operation writes, measured at the database

   `purity.test.ts` reads the module's imports. That is the check the
   block asks for by name, and it has one blind spot it cannot close:
   it sees what is IMPORTED, not what is CALLED, so a module that
   reaches a writer through a re-export, a dynamic import, or a
   barrel name this file's denylist has not heard of passes it.

   A zero is a claim about an instrument until something else
   measures the same thing differently. This file is that second
   axis: it takes the whole database before and after every published
   verb and asserts nothing moved.

   ── why row counts alone are not the measurement ──
   A count catches an INSERT and misses an UPDATE, and this
   repository has already had two acceptance-criterion reds turn out
   to be one column — `account.updated_at` — moving under a suite
   that was counting rows. So `target` and `audit` are compared by
   CONTENT, element-wise, and they are the two that matter:
   `recordDownload` bumps `target`, and when that write fails it
   writes an `audit` row instead. Both of its paths are covered, and
   the reason the pair is enough is that `serveCard` and `serveFile`
   are the only writers a read-shaped composition plausibly reaches.

   ── why the verbs are called with arguments that SUCCEED ──
   A verb that refused would write nothing whatever it composes, so
   a sweep over refusals is a green about nothing. Every call below
   names a public bundle, a real digest and a real card ref, and the
   cell asserts they answered before it compares the two snapshots.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { outcome, verb } from "./contract";
import { anonymous, dropScratchDatabases, refsOf, seededWorld } from "./fixtures";

const world = seededWorld();

interface Snapshot {
  counts: Record<string, number>;
  target: string;
  audit: string;
}

async function snapshot(
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>,
): Promise<Snapshot> {
  const tables = (await query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`,
  )).map((r) => String(r.table_name));
  /* Fails closed: a snapshot that discovered no tables would compare two empty maps and
     report that nothing moved, which is the vacuous green this whole file exists to avoid. */
  if (tables.length === 0) throw new Error("the snapshot found no tables to count");

  const counts: Record<string, number> = {};
  for (const table of tables) {
    const [row] = await query(`select count(*)::int as n from "${table}"`);
    counts[table] = Number(row?.n ?? -1);
  }
  /* Element-wise content, sorted, for the two tables a read could write. A count holds
     steady across an UPDATE and across a delete-plus-insert; this does not. */
  const dump = async (table: string): Promise<string> =>
    JSON.stringify(await query(`select * from "${table}" order by 1`));

  return { counts, target: await dump("target"), audit: await dump("audit") };
}

afterAll(async () => {
  await dropScratchDatabases();
});

describe("no operation writes, measured at the database", () => {
  it("leaves every table untouched across all six verbs", async () => {
    const w = await world();
    const ref = refsOf(w.twice)[0]!;

    const before = await snapshot(w.scratch.query);
    /* The premise, before the bind: the snapshot is of a populated database, so an
       unchanged comparison below is two real states agreeing. */
    expect(Object.keys(before.counts).length).toBeGreaterThan(5);
    expect(before.counts.bundle).toBeGreaterThan(0);
    expect(before.counts.card_version).toBeGreaterThan(0);

    const findBlueprints = await verb("mcpFindBlueprints");
    const findCards = await verb("mcpFindCards");
    const getBlueprint = await verb("mcpGetBlueprint");
    const readCard = await verb("mcpReadCard");
    const provenance = await verb("mcpProvenance");
    const fetchRelease = await verb("mcpFetchRelease");

    const calls = [
      ["mcpFindBlueprints", () => findBlueprints(w.scratch.db, anonymous, "review") as Promise<unknown>],
      ["mcpFindCards", () => findCards(w.scratch.db, anonymous, "review") as Promise<unknown>],
      [
        "mcpGetBlueprint",
        () => getBlueprint(w.scratch.db, anonymous, w.registry.handle, w.twice) as Promise<unknown>,
      ],
      ["mcpReadCard", () => readCard(w.scratch.db, anonymous, ref) as Promise<unknown>],
      [
        "mcpProvenance",
        () => provenance(w.scratch.db, anonymous, w.registry.handle, w.twice) as Promise<unknown>,
      ],
      [
        "mcpFetchRelease",
        () =>
          fetchRelease(
            w.scratch.db,
            anonymous,
            w.registry.handle,
            w.twice,
            w.first.digest,
          ) as Promise<unknown>,
      ],
    ] as const;

    const refused: string[] = [];
    for (const [name, call] of calls) {
      const got = await outcome(call);
      if (!got.ok) refused.push(name);
    }
    /* Asserted BEFORE the comparison. A verb that refused wrote nothing whatever it
       composes, so an unchanged database after four refusals is a green about nothing. */
    expect(
      refused,
      "these verbs refused, so the snapshot comparison below would measure refusals " +
        "rather than reads.",
    ).toEqual([]);

    const after = await snapshot(w.scratch.query);

    const moved = Object.keys(before.counts).filter(
      (t) => before.counts[t] !== after.counts[t],
    );
    expect(
      moved.map((t) => `${t}: ${before.counts[t]} -> ${after.counts[t]}`),
      "No operation writes. `recordDownload` bumps `target`, and `serveCard` and " +
        "`serveFile` both call it — they are the obvious composition for `read a card` and " +
        "`fetch a release`, and `exportRelease` is the read-only verb.",
    ).toEqual([]);
    expect(after.target, "the download counter moved").toBe(before.target);
    expect(after.audit, "an audit row was written").toBe(before.audit);
  });
});
