/* ============================================================
   T250 — the scratch database and the recorded setup

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── why the setup is RECORDED rather than left in a hook ──
   A throw in `beforeAll` produces SKIPS, not reds. The run stands
   down instead of failing, and the number a reader quotes says
   `0 failed`. Measured in this repository at 127 merged cells going
   silent under one broken writer, while thirteen cells in a suite
   that recorded the setup failure and re-raised it PER CELL went
   red on the same defect.

   So every expensive thing here runs once, its outcome is captured,
   and each cell re-raises it. One import, N reds, and the count a
   reader quotes is the count of criteria that failed.

   ── why `runImport` runs once per FILE and not once per cell ──
   It publishes nine bundles and a 57-card library. Vitest gives
   each file its own worker and its own module registry, so a
   memoised promise here is per-file state: the files that need an
   untouched database get their own, and the files that assert on
   the result of one import share one.
   ============================================================ */

import {
  REGISTRY_HANDLE,
  bind,
  dropScratchDatabases,
  scratchDatabase,
  type Namespace,
  type Scratch,
} from "./contract";

export type { Scratch };

/**
 * Runs `fn` once and hands every caller the same outcome, failure included.
 *
 * The rejection is re-raised with the stage named, because "the import failed" and "the plan
 * failed" are different claims and a cell that cannot tell them apart reports the wrong one.
 */
export function recorded<T>(stage: string, fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= fn().catch((cause: unknown) => {
      throw new Error(
        `${stage} did not complete, so this cell measured nothing.\n` +
          "  This is the recorded setup re-raised INSIDE the cell rather than thrown from a " +
          "hook: a hook that throws produces skips, and a skipped cell reports `0 failed`.",
        { cause },
      );
    });
    return pending;
  };
}

export async function openDatabase(): Promise<Scratch> {
  return scratchDatabase();
}

export async function closeDatabase(): Promise<void> {
  await dropScratchDatabases();
}

export interface Imported {
  scratch: Scratch;
  plan: Namespace;
  result: Namespace;
}

/**
 * One scratch database, one `planImport()`, one `runImport(db, plan)`.
 *
 * The module is bound LAST, after the database exists. An early bind reds every cell at the
 * absent module while being correct about its own subject, and hides whether the setup below it
 * ever ran: three cells found in this repository had never executed, and a red in 0ms where I/O
 * was expected is what gives that away.
 */
export function importedOnce(): () => Promise<Imported> {
  return recorded("the seed import", async () => {
    const scratch = await openDatabase();
    const planImport = await bind("planImport");
    const runImport = await bind("runImport");
    const plan = (await planImport()) as Namespace;
    const result = (await runImport(scratch.db, plan)) as Namespace;
    return { scratch, plan, result };
  });
}

/** The plan alone. No database, which is what makes AC1 checkable before anything is written. */
export function plannedOnce(): () => Promise<Namespace> {
  return recorded("planImport()", async () => {
    const planImport = await bind("planImport");
    return (await planImport()) as Namespace;
  });
}

/**
 * The registry account's id, resolved by the handle D-250-04 publishes.
 *
 * Read out of the database rather than returned by the module: AC4 is a claim about what is
 * STORED, and a value the module handed back is the module agreeing with itself.
 */
export async function registryAccountId(scratch: Scratch): Promise<string | undefined> {
  const rows = await scratch.query('select id from "account" where handle = $1', [REGISTRY_HANDLE]);
  const id = rows[0]?.id;
  return typeof id === "string" ? id : undefined;
}
