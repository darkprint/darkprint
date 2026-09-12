/* ============================================================
   T250 — AC2, idempotency

   §T250: "AC2's idempotency is `created`/`skipped`, and the second
   run must report `created: 0`. A re-run reporting success without
   distinguishing the two satisfies 'is idempotent' while having
   silently done nothing, or everything."

   D-250-08 fixed the unit: `created` and `skipped` count BUNDLES.
   Cards do not fold in, because composing `publish()` per bundle
   imports the whole library as a consequence and counting it would
   report the same 57 as new work on every run.

   ── two runs against ONE database, and why not two databases ──
   Idempotency is a claim about running twice over the same state.
   Two scratch databases would give two first runs, which is the
   shape that passes while measuring nothing.

   ── the numbers are not the criterion on their own ──
   A `runImport` that returned `{created: 0, skipped: 9}` without
   touching Postgres satisfies the second-run cell exactly. So the
   numbers are asserted beside a STATE comparison: what the second
   run left behind, element-wise, against what the first did.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  EXPECTED_BUNDLES,
  IMPORT_RESULT_KEYS,
  SECOND_RUN_CREATED,
  SECOND_RUN_SKIPPED,
  assertCount,
  assertKeys,
  bind,
  movedTableNames,
  snapshotAll,
  snapshotContent,
  type Namespace,
  type Scratch,
} from "./contract";
import { closeDatabase, openDatabase, recorded } from "./fixtures";

/** Both runs, against one database, recorded once. */
const twice = recorded("the two seed imports", async () => {
  const scratch: Scratch = await openDatabase();
  const planImport = await bind("planImport");
  const runImport = await bind("runImport");

  /* Before anything is written. Without this the "started empty" cell below asserts a premise it
     never checked, which is the shape where a comment names a condition and the assertion admits
     its opposite. */
  const before = await snapshotAll(scratch);
  const beforeContent = await snapshotContent(scratch);

  const plan = (await planImport()) as Namespace;
  const first = (await runImport(scratch.db, plan)) as Namespace;
  const afterFirst = await snapshotAll(scratch);
  const afterFirstContent = await snapshotContent(scratch);

  /* The plan is re-derived rather than reused. A second run in production plans again, and
     handing the first plan back would test a path a re-run never takes. */
  const secondPlan = (await planImport()) as Namespace;
  const second = (await runImport(scratch.db, secondPlan)) as Namespace;
  const afterSecond = await snapshotAll(scratch);
  const afterSecondContent = await snapshotContent(scratch);

  return {
    scratch, plan, first, second,
    before, afterFirst, afterSecond,
    beforeContent, afterFirstContent, afterSecondContent,
  };
});

afterAll(async () => {
  await closeDatabase();
});

/* `runImport` publishes nine bundles and a 57-card library. The default 20s is a liveness guard
   for a cell that does no I/O; this one does a great deal, and a timeout here would report as a
   failed criterion against an implementation that was merely slow under a loaded host. */
const SLOW = 180_000;

describe("AC2: re-running is idempotent", () => {
  it(
    "reports ten bundles created on the first run",
    async () => {
      const { first } = await twice();
      assertKeys(first, IMPORT_RESULT_KEYS, "ImportResult (first run)");
      expect(assertCount(first.created, "first.created")).toBe(EXPECTED_BUNDLES);
      expect(assertCount(first.skipped, "first.skipped")).toBe(0);
    },
    SLOW,
  );

  it(
    "reports nothing created and every bundle skipped on the second (D-250-08)",
    async () => {
      const { second } = await twice();
      assertKeys(second, IMPORT_RESULT_KEYS, "ImportResult (second run)");
      /* Both numbers, and this is the whole of §T250's warning: `created: 0` alone is satisfied
         by a run that did nothing AND by a run that refused everything, and only `skipped` tells
         the two apart. A run that silently did nothing reports `{created: 0, skipped: 0}`. */
      expect(assertCount(second.created, "second.created")).toBe(SECOND_RUN_CREATED);
      expect(assertCount(second.skipped, "second.skipped")).toBe(SECOND_RUN_SKIPPED);
    },
    SLOW,
  );

  it(
    "counts bundles and not cards, so the library size never appears in either number",
    async () => {
      const { first, second } = await twice();
      /* The discriminating value. A `created` that folded the library in would be 119 on the
         first run and would report the same 103 as new work on every run after it. */
      expect([first.created, first.skipped, second.created, second.skipped]).toEqual([16, 0, 0, 16]);
    },
    SLOW,
  );

  /**
   * The state comparison, and it is what stops the two cells above from being satisfied by a
   * `runImport` that returns the right numbers without touching Postgres.
   *
   * Element-wise as sorted JSON per table, never by row count: 14 before and 14 after with
   * different contents has passed a leak check in this repository.
   */
  it(
    "leaves the imported content byte-identical between the two runs",
    async () => {
      const { afterFirstContent, afterSecondContent } = await twice();
      const moved = movedTableNames(afterFirstContent, afterSecondContent);
      expect(
        moved,
        `the second run changed ${moved.join(", ") || "nothing"}.\n` +
          "  Compared with `updated_at` dropped from every table: a provenance timestamp is not " +
          "imported content, and `upsertFromGitHub` bumps the registry account's on every call " +
          "(lib/server/accounts/github.ts:75). Everything else is what AC2 forbids a re-run " +
          "from touching.",
      ).toEqual([]);
    },
    SLOW,
  );

  /**
   * The timestamp axis, kept as a real assertion rather than abandoned when the cell above
   * stopped looking at it.
   *
   * `account` is expected to move and the reason is another module's: `upsertFromGitHub` sets
   * `updatedAt` unconditionally on conflict, and D-250-04 names it as the door that creates the
   * registry account. Nothing else may move. A `bundle` or `release` whose timestamp shifted on
   * a no-op re-run reds here, and so does a second `account` ROW -- a change to the row list
   * rather than to a column, which the content snapshot catches as well.
   *
   * The COLUMN is named, not just the table. "Something about account changed" and "account's
   * `updated_at` changed" are different claims, and only the second is what was measured.
   */
  it(
    "moves no timestamp but the registry account's, which is T050's write and not this task's",
    async () => {
      const { scratch, afterFirst, afterSecond } = await twice();
      const moved = movedTableNames(afterFirst, afterSecond);
      /* `audit` is admitted alongside: a trail of a refused re-import is defensible and nothing
         in §T250 forbids it. A second `release` or `bundle` is not. */
      expect(moved.filter((name) => name !== "account" && name !== "audit")).toEqual([]);

      const rows = await scratch.query('select * from "account"');
      expect(rows, "a re-run added or removed an account row").toHaveLength(1);

      /* And the account row differs in `updated_at` ALONE. Without this the cell admits a
         re-run that rewrote the handle, the login or the github id and called it a timestamp. */
      const first = afterFirst.get("account") ?? [];
      const second = afterSecond.get("account") ?? [];
      expect([first.length, second.length]).toEqual([1, 1]);
      const a = JSON.parse(first[0] ?? "{}") as Record<string, unknown>;
      const b = JSON.parse(second[0] ?? "{}") as Record<string, unknown>;
      const changed = Object.keys(a)
        .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
        .sort();
      expect(changed).toEqual(["updated_at"]);
    },
    SLOW,
  );

  /**
   * "The import is idempotent and PRESERVES EVERY DIGEST EXACTLY, or every pinned reference and
   * every printed version string changes." The plan is re-derived for the second run, so this
   * compares two independent derivations rather than one value with itself.
   */
  it(
    "plans the identical digests on the re-run",
    async () => {
      const { first, second } = await twice();
      expect(JSON.stringify(second.bundles)).toBe(JSON.stringify(first.bundles));
      expect(JSON.stringify(second.cards)).toBe(JSON.stringify(first.cards));
    },
    SLOW,
  );
});

describe("where created and skipped come from", () => {
  /**
   * The shared object bucket is a CROSS-COMMIT CACHE. Artefact keys are content digests, so by
   * the time this suite runs, another worktree's import may already have written every object
   * these nine bundles produce.
   *
   * That makes the first run a genuine discriminator rather than a formality: a `created` derived
   * from what is already in the bucket would report the nine as skipped on a database where they
   * demonstrably do not exist. The cell above asserts `created: 9`; this one asserts the premise
   * that makes it mean something, namely that the database really was empty first.
   */
  it(
    "counts against the database, on a scratch database that started empty",
    async () => {
      const { scratch, before, afterFirst } = await twice();

      /* The premise, checked rather than assumed: EVERY table empty before the first run, over
         the schema's whole derived domain rather than over the one table this cell reads. */
      const nonEmpty = [...before].filter(([, rows]) => rows.length > 0).map(([name]) => name);
      expect(nonEmpty, "the scratch database was not empty before the first run").toEqual([]);

      const bundles = await scratch.query('select slug from "bundle"');
      expect(bundles).toHaveLength(EXPECTED_BUNDLES);
      expect(afterFirst.get("bundle") ?? []).toHaveLength(EXPECTED_BUNDLES);
    },
    SLOW,
  );
});
