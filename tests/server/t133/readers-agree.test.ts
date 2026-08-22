/* ============================================================
   T133 AC2 — both existing readers consume the published shape,
   and neither of them stops refusing what arrives another way

   AC2: "both existing readers consume that shape rather than each
   re-deriving it." The Goal states the point of it: "so two readers
   cannot disagree about it."

   ── the two readers, and how each is reached ──
   T090's is `lib/server/export/vocabulary.ts`'s `storedVocabulary`,
   which is not on a barrel (D-130-07 says so, and publishing it is
   T132's), so it is driven through the one published function that
   reaches it: `exportRelease`.
   T130's is `lib/server/profiles/terms.ts`, which calls
   `parseOntologyTerms` from `@/lib/content/ontology-file` directly
   (D-130-07, upheld) -- so that parser is reached directly too. It
   is the same object both readers consume and the one D-133-03 makes
   the write call, which is what makes "cannot disagree" checkable
   rather than merely intended.

   ── why this file borrows T090's fixtures ──
   Seeding a release that actually exports needs an ontology version,
   card rows at the right digests, a manifest and an analysis block.
   `tests/server/t090/fixtures.ts` already does it and is merged.
   Writing a second one here would be this suite's own opinion about
   how an exportable release is assembled -- a reference written by
   the author of the assertions -- which is the thing this task's
   brief forbids in as many words. The coupling is deliberate and is
   reported in the handback.

   ── the last cell is the one that matters most ──
   D-133-02 F6: the write refuses new rows and *the readers keep
   refusing whatever arrives another way*. That is not decoration.
   AC1 can be satisfied by deleting the readers' checks and putting
   one at the write, which passes every other cell in this suite and
   silently readmits the exact failure T133 exists to end -- because
   `export.scratch.test.ts:187` proves a row can reach a refused
   shape without passing `addRelease` at all. `CLAUDE.md` forbids
   loosening such an assertion regardless of what a criterion moves.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ADMISSIBLE, loadExport, requiredFn as exportFn } from "../t090/contract";
import {
  scratchDatabase,
  seedAccount,
  seedOntology,
  seedRelease,
  storedVocabulary,
  withoutLocalTerm,
  type Scratch as T090Scratch,
  type SeededAccount,
} from "../t090/fixtures";
import { outcomeOf, readsAs, term } from "./contract";

const ANONYMOUS = { kind: "anonymous" } as const;

let scratch: T090Scratch | undefined;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    const own = await scratchDatabase("t133_readers");
    scratch = own;
    await seedOntology(own.db);
  } catch (error) {
    setupFailure = error;
  }
}, 300_000);

afterAll(async () => {
  await scratch?.drop();
});

/**
 * The hook records its failure and every cell re-raises it. A throw in `beforeAll` SKIPS
 * this file's cells, and a skipped criterion adds nothing to the failed column while
 * reading like one that ran.
 */
function fixture(): T090Scratch {
  if (scratch === undefined) {
    throw new Error(
      `This file's fixture never came up, so this criterion was not measured: ` +
        `${String(setupFailure)}`,
    );
  }
  return scratch;
}

/**
 * One account per cell, and the reason is B-09 rather than tidiness.
 *
 * `seedRelease` takes the bundle's slug from the archive entry, and `bundle` is unique on
 * `(owner_id, slug)` -- so four cells seeding the same entry under one owner collide on the
 * second, and the collision arrives as an `ArchiveConflictError` out of `createBundle`,
 * which looks like a T010 defect and is this file's own fixture. Measured, not foreseen:
 * the first run of this file reddened three cells that way.
 */
let owners = 0;

async function freshOwner(s: T090Scratch): Promise<SeededAccount> {
  owners += 1;
  return seedAccount(s, `t133r${owners}`);
}

/** The archive's own vocabulary bytes, so no cell invents a document. */
function archiveText(): string {
  const stored = storedVocabulary();
  if (stored === undefined) {
    throw new Error(
      "content/ontology/extensions.yaml is absent, so there are no real vocabulary bytes to " +
        "store and AC2 has nothing to read.",
    );
  }
  return stored.text;
}

async function exportOf(db: unknown, bundleId: string, digest: string): Promise<unknown> {
  const mod = await loadExport();
  return exportFn(mod, "exportRelease")(db, ANONYMOUS, bundleId, digest);
}

/** `release.local_vocabulary` for one release, straight out of Postgres. */
async function columnOf(s: T090Scratch, bundleId: string): Promise<unknown> {
  const rows = await s.pool.query<{ local_vocabulary: unknown }>(
    "select local_vocabulary from release where bundle_id = $1",
    [bundleId],
  );
  return rows.rows[0]?.local_vocabulary;
}

/**
 * The three column values the published shape admits that a release can actually carry.
 *
 * `withoutLocalTerm()` on purpose: a bundle whose cards need no local term still resolves
 * when `terms` is null or absent, so a red here is the reader refusing the SHAPE rather
 * than the blueprint losing a definition it depended on.
 */
const SHAPES: readonly { name: string; clause: string; value: () => unknown }[] = [
  {
    name: "`{ text, terms }`",
    clause: "D-90-03 and D-133-01: the shape itself.",
    value: () => storedVocabulary(),
  },
  {
    name: "`{ text, terms: null }`",
    clause: "D-133-01: `terms?: readonly unknown[] | null`; `null` means `[]`.",
    value: () => ({ text: archiveText(), terms: null }),
  },
  {
    name: "`{ text }`",
    clause: "D-133-01: `terms` is optional, and absent means `[]` (`ontology-file.ts:52`).",
    value: () => ({ text: archiveText() }),
  },
];

describe("AC2 — every value the column admits is consumed by both readers", () => {
  for (const shape of SHAPES) {
    it(`exports and parses a release whose vocabulary is ${shape.name}`, async () => {
      const s = fixture();
      const release = await seedRelease(s, await freshOwner(s), withoutLocalTerm(), {
        rawVocabulary: shape.value(),
      });

      /* Reader one, through the only published function that reaches it. */
      const exported = await outcomeOf(() => exportOf(s.db, release.bundleId, release.digest));
      if (exported.kind === "threw") {
        const error = (exported as { error: unknown }).error;
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `\`exportRelease\` refused a release whose vocabulary is ${shape.name}, which the ` +
            `published shape admits.\n  ${shape.clause}\n` +
            (message === ADMISSIBLE.vocabularyNotTerms
              ? `  It refused it AS A VOCABULARY: "${message}" -- so the writer and this ` +
                `reader disagree about the column, which is the disagreement AC2 closes.\n`
              : `  It failed for another reason, so this cell measured nothing about AC2: ` +
                `"${message}"\n`),
        );
      }
      expect(
        Array.isArray((exported as { value: unknown }).value),
        "`exportRelease` returned no file list.",
      ).toBe(true);

      /* Reader two, the parser T130's `counts.terms` calls directly. Same stored bytes,
         and the assertion is that it reads them rather than that it agrees with a list
         this file wrote. */
      const read = readsAs(await columnOf(s, release.bundleId));
      expect(
        read.kind,
        `The shared parser refuses a stored ${shape.name} that \`exportRelease\` accepted.\n  ` +
          `Two readers disagreeing about one column is the defect T133 exists to end.\n  ` +
          `it threw: ${String((read as { error?: unknown }).error)}`,
      ).toBe("returned");
    }, 300_000);
  }
});

describe("D-133-02 F6 — the readers keep refusing a row that arrived another way", () => {
  /*
   * The witness AC1 is about to take away from somewhere else.
   *
   * `tests/server/t090/fixtures.ts` seeds its wrong-shape cells THROUGH `addRelease`, so
   * once the write refuses that shape, D-90-02's fifth admissible message form loses both
   * of its witnesses at once -- a fix that closes a path closes every probe that used it.
   * This cell reaches the same refusal by the route that survives: a direct `update`,
   * which is how `export.scratch.test.ts:187` already does it and is the standing proof
   * that a row can reach a refused shape without passing the writer.
   *
   * It is also the cell that separates a correct AC1 from the cheapest wrong one. Moving
   * the guard to the write and deleting the readers' own passes every other cell here.
   */
  it("`exportRelease` still refuses a bare term array put in the column directly", async () => {
    const s = fixture();
    const release = await seedRelease(s, await freshOwner(s), withoutLocalTerm(), {});

    await s.pool.query("update release set local_vocabulary = $1 where bundle_id = $2", [
      JSON.stringify([term("someone/a-term")]),
      release.bundleId,
    ]);

    const outcome = await outcomeOf(() => exportOf(s.db, release.bundleId, release.digest));
    expect(
      outcome.kind,
      "`exportRelease` served a release whose stored vocabulary is a bare term array. The " +
        "reader-side refusal is not AC1's to remove: D-133-02 F6 keeps it, and a row can " +
        "reach this shape without passing `addRelease` at all.",
    ).toBe("threw");
    const error = (outcome as { error: unknown }).error;
    const message = error instanceof Error ? error.message : String(error);
    expect(
      message,
      `\`exportRelease\` refused it with a different message. D-90-02 publishes the form as a ` +
        `fixed literal so a blind author can pin it by exact match.`,
    ).toBe(ADMISSIBLE.vocabularyNotTerms);
  }, 300_000);

  it("the shared parser still refuses a bare term array put in the column directly", async () => {
    const s = fixture();
    const release = await seedRelease(s, await freshOwner(s), withoutLocalTerm(), {});

    await s.pool.query("update release set local_vocabulary = $1 where bundle_id = $2", [
      JSON.stringify([term("someone/a-term")]),
      release.bundleId,
    ]);

    const read = readsAs(await columnOf(s, release.bundleId));
    expect(
      read.kind,
      "`parseOntologyTerms` read a bare array as a vocabulary. It throws `is not a YAML " +
        "mapping` on an array, and T130's `counts.terms` refusal is built on that -- a " +
        "reader that stopped refusing would count a shape the column forbids.",
    ).toBe("threw");
  }, 300_000);
});
