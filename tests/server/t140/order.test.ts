/* ============================================================
   T140 — D-140-08, the order of `listSaves`

       ORDER BY saved_at DESC, target_kind ASC, ref_id ASC

   Newest first, tie-broken on the two remaining PUBLISHED fields.
   Total within an account, because `save_account_target_key` is
   unique on `(account_id, target_kind, target_id)` — so no two
   records of one account can tie on all three.

   ── why this file exists at all, and it is the ruling's own
      consequence rather than a gap I found ──
   Order was unruled until an hour ago, and every cell in this
   suite compared SETS for that reason: `viewTargetSet` sorts before
   comparing, so it pins distinguishability and never position.
   That was right while nothing was published. **The moment an
   order IS published it is contract held by nothing** — the
   D-70-12 shape, arriving on a fresh ruling — and this file is the
   witness that was owed the same hour.

   ── the expected order is COMPUTED, never transcribed ──
   The assertion is that the returned sequence equals its own sort
   under the ruled comparator. It is not a literal list written out
   here. A literal would be me transcribing the ruling, and *a
   transcription read as the thing transcribed* is the mechanism
   behind five separate charges in this run — the fix is to make
   the standard itself the oracle, which here means applying the
   comparator to whatever came back rather than predicting what
   should.

   ── and the anti-vacuity half, because "sorted" is free ──
   A store that returns rows in INSERTION order satisfies "sorted"
   whenever the caller happened to insert them sorted. So the batch
   below is handed to `migrateLocalSaves` in an order that is
   DELIBERATELY NOT the ruled one, and the cell asserts that the two
   differ — computed from the two sequences, not assumed from the
   way the fixture was written.

   ── one thing this file MEASURES rather than assumes ──
   The `target_kind ASC, ref_id ASC` half only decides anything when
   two records TIE on `saved_at`. Whether they do is an
   implementation choice this task does not publish: a
   `migrateLocalSaves` that inserts one statement gives every row
   the same transaction `now()`, and one that loops gives each row
   its own. **Both conform.** So the sortedness assertion is
   unconditional and always valid, and the number of tied pairs the
   run actually contained is REPORTED in the failure message rather
   than asserted — a cell that only checked the tie-break when ties
   happened would be a guard that switches itself off, and one that
   required ties would red a conforming implementation that loops.

   That distinction is worth the paragraph because of what reading
   the code turned up when the ruling was made: the shipped
   tie-break was `asc(save.id)` over a `uuid().defaultRandom()`, so
   same-instant saves ordered by a random value — **arbitrary, and
   not stable between two runs.** A deep-equal against a literal
   would have been flaky and the flake would have read as a store
   defect.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  type Target,
  accountActor,
  asKeys,
  bind,
  ruledOrder,
  seenOf,
  tiedPairs,
} from "./contract";
import {
  type AccountFixture,
  type Scratch,
  closeDatabase,
  openDatabase,
  seedAccount,
  seedBundle,
  seedCard,
  seedTerm,
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
  const account = await seedAccount(s, "order");
  return { account, actor: accountActor(account.id, account.handle) };
}

/**
 * Four targets whose RULED order is `blueprint`, `card`, then the two terms by refId — and which
 * are handed to the caller in exactly the reverse of that, so insertion order cannot be mistaken
 * for the ruled one.
 */
async function batch(s: Scratch, mark: string): Promise<{ ruled: string[]; supplied: Target[] }> {
  const publisher = await seedAccount(s, "pub");
  const bundle = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
  const card = await seedCard(s, {
    ownerId: publisher.id,
    visibility: "public",
    cardId: `t140-ord-${mark}-card`,
  });
  const alpha = await seedTerm(s, `t140-ord-${mark}/aaa`);
  const beta = await seedTerm(s, `t140-ord-${mark}/bbb`);

  const blueprintT: Target = { kind: "blueprint", refId: bundle.id };
  const cardT: Target = { kind: "card", refId: card.cardId };
  const alphaT: Target = { kind: "term", refId: alpha.termId };
  const betaT: Target = { kind: "term", refId: beta.termId };

  return {
    /* kind ASC puts blueprint before card before term; refId ASC splits the two terms. */
    ruled: [blueprintT, cardT, alphaT, betaT].map((t) => `${t.kind}:${t.refId}`),
    supplied: [betaT, alphaT, cardT, blueprintT],
  };
}

describe("D-140-08: `listSaves` returns its records in the ruled order", () => {
  it("the sequence equals its own sort under `saved_at DESC, target_kind ASC, ref_id ASC`", async () => {
    const s = await db();
    const migrateLocalSaves = await bind("migrateLocalSaves");
    const listSaves = await bind("listSaves");
    const { account, actor } = await saver(s);

    /* Two batches so `saved_at DESC` is exercised BETWEEN groups, whatever happens within one. */
    const older = await batch(s, "old");
    await migrateLocalSaves(s.db, actor, account.id, older.supplied);
    const newer = await batch(s, "new");
    await migrateLocalSaves(s.db, actor, account.id, newer.supplied);

    const records = (await listSaves(s.db, actor, account.id)) as unknown[];
    const seen = records.map((r, i) => seenOf(r, `listSaves()[${i}]`));

    expect(seen.length, "the fixture's own premise: eight saves landed").toBe(8);

    expect(
      asKeys(seen),
      `D-140-08 orders by \`saved_at DESC, target_kind ASC, ref_id ASC\`, and the expected ` +
        `sequence here is COMPUTED by applying that comparator to what came back rather than ` +
        `written out as a literal — a literal would be a transcription of the ruling standing in ` +
        `for the ruling.\n` +
        `  tied \`savedAt\` pairs in this run: ${tiedPairs(seen)} of ${seen.length - 1} adjacent ` +
        `pairs. The \`target_kind\`/\`ref_id\` tie-break decides nothing when that is 0, which is ` +
        `a conforming outcome for an implementation that inserts a batch row by row — reported ` +
        `rather than asserted, because requiring ties would red such an implementation and ` +
        `checking the tie-break only when ties occur would be a guard that switches itself off.\n` +
        `  luck arithmetic, as a number rather than a word: a store ordering by a random value ` +
        `agrees with the ruled sequence by chance at 1/n! per batch — 1/24 for one batch of four, ` +
        `and two independent batches multiply to about 1 in 576. That is the residual probability ` +
        `this cell passes against a random tie-break, stated before it ran.`,
    ).toEqual(asKeys(ruledOrder(seen)));
  });

  it("the ruled order is NOT the order the caller supplied", async () => {
    /*
     * The anti-vacuity half. "The sequence equals its own sort" is free for a store that returns
     * rows in insertion order whenever the caller inserted them sorted — so the batch is supplied
     * in the reverse of the ruled order, and that this differs is COMPUTED here rather than
     * trusted to the way the fixture above was written.
     */
    const s = await db();
    const migrateLocalSaves = await bind("migrateLocalSaves");
    const listSaves = await bind("listSaves");
    const { account, actor } = await saver(s);

    const one = await batch(s, "vac");
    const suppliedKeys = one.supplied.map((t) => `${t.kind}:${t.refId}`);

    expect(
      suppliedKeys,
      "the fixture must hand the module an order the ruling would NOT produce, or the cell above " +
        "passes against a store that returns rows exactly as it received them",
    ).not.toEqual(one.ruled);

    await migrateLocalSaves(s.db, actor, account.id, one.supplied);
    const seen = ((await listSaves(s.db, actor, account.id)) as unknown[]).map((r, i) =>
      seenOf(r, `listSaves()[${i}]`),
    );

    expect(
      asKeys(seen),
      "a store returning insertion order answers the supplied sequence here, and the ruled one is " +
        "its reverse on the kind/refId axis",
    ).toEqual(asKeys(ruledOrder(seen)));
  });

  it("newest first: a later save precedes an earlier one", async () => {
    /*
     * The `saved_at DESC` half, named on its own so a red is diagnosable as a DIRECTION rather
     * than as a tie-break. `ASC` and `DESC` are the same green under the cell above whenever the
     * comparator is applied to the same data both times — this is what separates them.
     */
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const listSaves = await bind("listSaves");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    const first = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
    await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: first.id });
    const second = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
    await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: second.id });

    const seen = ((await listSaves(s.db, actor, account.id)) as unknown[]).map((r, i) =>
      seenOf(r, `listSaves()[${i}]`),
    );
    expect(seen.length).toBe(2);
    expect(
      seen[0].at >= seen[1].at,
      `D-140-08 is DESC: the newer save comes first. Got ${new Date(seen[0].at).toISOString()} ` +
        `then ${new Date(seen[1].at).toISOString()}.`,
    ).toBe(true);
    expect(
      seen[0].refId,
      "and it is the one saved second — asserted by IDENTITY rather than by timestamp, because " +
        "two saves a millisecond apart compare equal at a coarser clock and the identity does not",
    ).toBe(second.id);
  });
});
