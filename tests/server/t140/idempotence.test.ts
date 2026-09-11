/* ============================================================
   T140 — AC2 and AC5

   AC2: "saving one target twice is idempotent."
   AC5: "migration of a browser-local set is idempotent across
   repeated sign-ins", and the block names the discriminating test:
   "signs in twice with an overlapping local set, asserting the
   second sign-in adds only what the first did not."

   ── the DELTA is the measurement, not the total ──
   "Adds only what the first did not" is a statement about what the
   second call ADDS. A total is satisfied by a second call that
   deletes everything and re-inserts the union, and by one that
   silently ignores its argument once any row exists. The delta
   separates them and the total does not, so the delta is what is
   asserted and it is computed from the two observations rather
   than written down as a constant.

   ── what is NOT asserted, and why ──
   Whether `savedAt` SURVIVES a repeat. AC5 glosses idempotence as
   "adds only what the first did not" — a statement about the row
   SET. `ON CONFLICT DO UPDATE SET created_at = now()` satisfies
   that gloss exactly, so a timestamp pin would fill a silence and
   red a defensible implementation. Reported, and left alone.

   Whether `unsaveTarget` on a target the OWNER never saved throws
   or is a no-op. Undecided; only the non-owner half, which is
   AC1's, is asserted, and it lives in `privacy.test.ts`.

   ── one reading taken, stated so it can be struck rather than
      argued about ──
   The concurrency cell requires ZERO of eight concurrent
   `saveTarget` calls to reject. `f(f(x)) = f(x)` is what idempotent
   means, and a caller told "no" for saving something already saved
   is not that. `lib/db/schema.ts:332-333` puts the same reading in
   the schema's own words — "The unique index IS T140's AC2 ...
   a SELECT-then-INSERT passes every sequential test and loses under
   two callers" — which is the failure this cell exists to reach and
   which no sequential cell can.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { accountActor, bind, describe_, outcomeOf, type Target } from "./contract";
import {
  type AccountFixture,
  type Scratch,
  closeDatabase,
  key,
  openDatabase,
  seedAccount,
  seedBundle,
  seedCard,
  seedTerm,
  storedRowCount,
  visibleTargets,
} from "./fixtures";

let scratch: Promise<Scratch> | undefined;

function db(): Promise<Scratch> {
  if (scratch === undefined) {
    scratch = openDatabase();
    scratch.catch(() => {});
  }
  return scratch;
}

afterAll(async () => {
  await closeDatabase();
});

async function saver(s: Scratch): Promise<{ account: AccountFixture; actor: unknown }> {
  const account = await seedAccount(s, "saver");
  return { account, actor: accountActor(account.id, account.handle) };
}

/** Three resolvable, publicly visible targets — one of each published kind. */
async function threeTargets(s: Scratch): Promise<[Target, Target, Target]> {
  const publisher = await seedAccount(s, "pub");
  const bundle = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
  const card = await seedCard(s, { ownerId: publisher.id, visibility: "public" });
  const term = seedTerm(s);
  return [
    { kind: "blueprint", refId: bundle.id },
    { kind: "card", refId: card.cardId },
    { kind: "term", refId: term.termId },
  ];
}

async function ownerCount(s: Scratch, actor: unknown, accountId: string): Promise<number> {
  const countSaves = await bind("countSaves");
  const answer = await countSaves(s.db, actor, accountId);
  if (typeof answer !== "number" || !Number.isInteger(answer)) {
    throw new Error(`\`countSaves\` answered the OWNER ${describe_(answer)}, not an integer.`);
  }
  return answer;
}

describe("AC2: saving one target twice is idempotent", () => {
  it("the second save changes nothing a caller can observe", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const [target] = await threeTargets(s);

    await saveTarget(s.db, actor, account.id, target);
    const after1 = {
      listed: await visibleTargets(s, actor, account.id),
      counted: await ownerCount(s, actor, account.id),
      stored: await storedRowCount(s, account.id),
    };
    expect(after1.listed, "the fixture's own premise: the first save landed").toEqual([key(target)]);

    await saveTarget(s.db, actor, account.id, target);
    const after2 = {
      listed: await visibleTargets(s, actor, account.id),
      counted: await ownerCount(s, actor, account.id),
      stored: await storedRowCount(s, account.id),
    };

    expect(after2.listed).toEqual(after1.listed);
    expect(after2.counted).toBe(after1.counted);
    expect(
      after2.stored,
      "`save_account_target_key` is unique on `(account_id, target_kind, target_id)`, and the " +
        "schema's own comment names that index as AC2. A second row here is the criterion " +
        "failing in the table even if a `distinct` in the read hides it from the listing.",
    ).toBe(after1.stored);
  });

  it("eight concurrent saves of one target leave one row and refuse nobody", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const [target] = await threeTargets(s);

    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        outcomeOf(() => saveTarget(s.db, actor, account.id, target)),
      ),
    );

    const rejected = outcomes.filter((o) => o.settled === "rejected");
    expect(
      rejected.map((o) => o.digest.slice(0, 200)),
      "idempotent means `f(f(x)) = f(x)`, and a caller told `no` for saving something already " +
        "saved is not that. A SELECT-then-INSERT passes every sequential cell above and hands " +
        "23505 to whoever loses here — which is the failure `lib/db/schema.ts` names in the " +
        "comment above the unique index, and the only cell in this suite that can reach it.",
    ).toEqual([]);
    expect(await storedRowCount(s, account.id), "exactly one row, from eight callers").toBe(1);
    expect(await visibleTargets(s, actor, account.id)).toEqual([key(target)]);
    expect(await ownerCount(s, actor, account.id)).toBe(1);
  });

  it("unsaving and saving again returns the target to the listing", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const unsaveTarget = await bind("unsaveTarget");
    const { account, actor } = await saver(s);
    const [target] = await threeTargets(s);

    await saveTarget(s.db, actor, account.id, target);
    await unsaveTarget(s.db, actor, account.id, target);
    expect(await visibleTargets(s, actor, account.id)).toEqual([]);
    expect(
      await storedRowCount(s, account.id),
      "an unsave removes the row — AC3's retention rule is about a save whose TARGET changed, " +
        "not about one the owner asked to remove",
    ).toBe(0);

    await saveTarget(s.db, actor, account.id, target);
    expect(await visibleTargets(s, actor, account.id)).toEqual([key(target)]);
    expect(await ownerCount(s, actor, account.id)).toBe(1);
  });
});

describe("AC5: migrating a browser-local set is idempotent across repeated sign-ins", () => {
  it("the second sign-in adds ONLY what the first did not", async () => {
    const s = await db();
    const migrateLocalSaves = await bind("migrateLocalSaves");
    const { account, actor } = await saver(s);
    const [a, b, c] = await threeTargets(s);

    /* First sign-in: the browser carried A and B. */
    const before1 = await storedRowCount(s, account.id);
    await migrateLocalSaves(s.db, actor, account.id, [a, b]);
    const after1 = await storedRowCount(s, account.id);

    expect(
      after1 - before1,
      "the anti-vacuity half: if the first migration added nothing, the delta below is a " +
        "measurement of a migration that never happened, and every assertion in this cell holds " +
        "for a `migrateLocalSaves` that ignores its argument entirely.",
    ).toBe(2);

    /* Second sign-in: the browser carried B and C. B overlaps. */
    await migrateLocalSaves(s.db, actor, account.id, [b, c]);
    const after2 = await storedRowCount(s, account.id);

    expect(
      after2 - after1,
      "the block's own discriminating test: \"the second sign-in adds only what the first did " +
        "not\". The overlapping target contributes nothing and the new one contributes one. A " +
        "TOTAL of 3 is also produced by a migration that deletes everything and re-inserts the " +
        "union, and by one that silently ignores its argument once any row exists — the DELTA " +
        "separates those and the total does not.",
    ).toBe(1);

    expect(await visibleTargets(s, actor, account.id)).toEqual([a, b, c].map(key).sort());
    expect(await ownerCount(s, actor, account.id)).toBe(3);
  });

  it("a local set carrying the same target twice migrates to one row", async () => {
    const s = await db();
    const migrateLocalSaves = await bind("migrateLocalSaves");
    const { account, actor } = await saver(s);
    const [a] = await threeTargets(s);

    await migrateLocalSaves(s.db, actor, account.id, [a, a, a]);

    expect(
      await storedRowCount(s, account.id),
      "the block rules that \"AC5's idempotent migration is `saveTarget` applied N times\", and " +
        "`saveTarget` applied three times to one target is one row by AC2. A duplicate inside a " +
        "single `localStorage` set is not a shape the caller has to have removed first.",
    ).toBe(1);
    expect(await visibleTargets(s, actor, account.id)).toEqual([key(a)]);
  });

  it("an empty local set is a no-op and not a refusal", async () => {
    const s = await db();
    const migrateLocalSaves = await bind("migrateLocalSaves");
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const [a] = await threeTargets(s);
    await saveTarget(s.db, actor, account.id, a);

    const before = await storedRowCount(s, account.id);
    const outcome = await outcomeOf(() => migrateLocalSaves(s.db, actor, account.id, []));

    expect(
      outcome.settled,
      "an empty `localStorage` set is what a first-time signer-in with no favourites carries, so " +
        "it is the COMMON case and not an edge one. `saveTarget` applied zero times is a no-op, " +
        "which is the block's own gloss of what this function is.",
    ).toBe("value");
    expect(await storedRowCount(s, account.id)).toBe(before);
    expect(await visibleTargets(s, actor, account.id)).toEqual([key(a)]);
  });

  it("migrating a set the account already holds in full adds nothing", async () => {
    const s = await db();
    const migrateLocalSaves = await bind("migrateLocalSaves");
    const { account, actor } = await saver(s);
    const [a, b] = await threeTargets(s);

    await migrateLocalSaves(s.db, actor, account.id, [a, b]);
    const after1 = await storedRowCount(s, account.id);
    await migrateLocalSaves(s.db, actor, account.id, [a, b]);
    const after2 = await storedRowCount(s, account.id);

    expect(after1, "the anti-vacuity half again, computed rather than assumed").toBe(2);
    expect(
      after2 - after1,
      "signing in a third time with an unchanged browser set adds nothing at all — the N=0 case " +
        "of \"adds only what the first did not\"",
    ).toBe(0);
    expect(await ownerCount(s, actor, account.id)).toBe(2);
  });
});
