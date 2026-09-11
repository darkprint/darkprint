/* ============================================================
   T120 — `DeletionPlan` and `TransferPlan` as VALUES

   The key sets are pinned here and not in `surface.test.ts`,
   and the difference is the whole point: `TransferPlan` and
   `DeletionPlan` are TYPES, and a type erases. A file of type
   assertions about them passes against a barrel that does not
   exist and against one that exports the wrong shape — the
   silently-vacuous failure mode `wave-blind.md` names. So the
   key set is read off the OBJECT the verb returns, where it is
   observable, and it is compared against the document's parse
   rather than against a list typed here.

   ── D-120-15's R is what these cells are for ──
   The four figures PARTITION THE ACCOUNT'S HOLDINGS BY OUTCOME,
   not by visibility. `privateBundles`/`privateCards` count what
   the deletion WILL DESTROY under D-120-11's quantifier;
   `publishedBundles`/`publishedCards` count what survives. So a
   private card that a surviving published release pins is in
   `publishedCards`. That distinction was two rulings
   disagreeing until it was closed, and a plan built on either
   of the other two readings passes any cell that only checks
   the key set.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RecordedSetup, keysOf, loadLifecycle, requiredFn, signature } from "./contract";
import {
  bareCardIds,
  cardRows,
  publishBundle,
  resolvingCorpus,
  scratchDatabase,
  seedAccount,
  seedHandlelessAccount,
  type Scratch,
} from "./fixtures";

const databases: Scratch[] = [];
async function freshDatabase(tag: string): Promise<Scratch> {
  const scratch = await scratchDatabase(tag);
  databases.push(scratch);
  return scratch;
}

const ready = new RecordedSetup<true>("the T120 plan fixture");
beforeAll(async () => {
  await ready.run(async () => true);
});
afterAll(async () => {
  for (const scratch of databases) await scratch.drop();
});

async function verb(name: string) {
  const mod = await loadLifecycle();
  return requiredFn(mod, name, signature(name).text);
}

describe("T120 `DeletionPlan` — the shape, observed on the value", () => {
  it("carries exactly the published key set, no more and no less", async () => {
    ready.require();
    const scratch = await freshDatabase("plan-keys");
    const owner = await seedAccount(scratch, "t120-pk-owner");
    await publishBundle(scratch, owner, "pk-public", "public");

    const plan = (await (await verb("planDeletion"))(
      scratch.db,
      owner.actor,
      owner.accountId,
    )) as Record<string, unknown>;

    /* Sorted both sides, so field ORDER is not asserted — the block writes an order and a
       key set is not an order, and reading one as the other would red a correct module on a
       reshuffle. What IS asserted is exact membership: an extra key is as much a contract
       change as a missing one, because `DeletionPlan` is what a settings page renders before
       the one irreversible operation in the registry. */
    expect(Object.keys(plan).sort()).toEqual([...keysOf("DeletionPlan")].sort());
    expect(plan.accountId).toBe(owner.accountId);
    expect(plan.handle).toBe(owner.handle);
    for (const figure of ["privateBundles", "privateCards", "publishedBundles", "publishedCards"]) {
      expect(typeof plan[figure], `${figure} is not a number`).toBe("number");
    }
  });

  it("D-120-08: `handle` is `null`, not `\"\"`, for an account that holds none", async () => {
    ready.require();
    const scratch = await freshDatabase("plan-nohandle");
    const nameless = await seedHandlelessAccount(scratch);

    const plan = (await (await verb("planDeletion"))(
      scratch.db,
      nameless.actor,
      nameless.accountId,
    )) as Record<string, unknown>;

    /* `toBeNull`, not `toBeFalsy`: `""` is falsy too, and `""` is precisely the value
       D-120-08 rules out — it is the one that makes AC4's own delegated `releaseHandle` throw
       T070's `InvalidNameError` out of T120's surface. An assertion that admitted it would
       admit the defect its own ruling exists to prevent. */
    expect(plan.handle).toBeNull();
  });

  it("the four figures partition BY OUTCOME — D-120-15's R, against the visibility reading", async () => {
    ready.require();
    const scratch = await freshDatabase("plan-partition");
    const owner = await seedAccount(scratch, "t120-pp-owner");
    const corpusA = resolvingCorpus(0);
    const corpusB = resolvingCorpus(1);

    /* Three bundles, chosen so the two readings DISAGREE.
       - `pp-open`   public, corpus A -> survives; its cards survive.
       - `pp-shared` private, corpus A -> destroyed; but its cards are corpus A's, which
                     `pp-open` still pins, so under D-120-11 those cards SURVIVE.
       - `pp-lost`   private, corpus B -> destroyed, and nothing published pins corpus B's
                     cards, so they are destroyed too.
       Under the visibility reading every corpus-A card would count in `privateCards`
       (`publish` stored them at the first bundle's visibility). Under the outcome reading
       they count in `publishedCards`. The two readings differ by a whole corpus. */
    const shared = await publishBundle(scratch, owner, "pp-shared", "private", { corpus: corpusA });
    const open = await publishBundle(scratch, owner, "pp-open", "public", { corpus: corpusA });
    await publishBundle(scratch, owner, "pp-lost", "private", { corpus: corpusB });

    expect(shared.digest).toBe(open.digest);
    const sharedCards = await cardRows(scratch, bareCardIds(corpusA));
    expect(
      sharedCards.every((c) => c.visibility === "private"),
      "corpus A's cards are not private, so this fixture cannot separate the outcome reading " +
        "from the visibility reading and the cell measures nothing. The PRIVATE publish must " +
        "come first for `publish` to store them private.",
    ).toBe(true);

    const plan = (await (await verb("planDeletion"))(
      scratch.db,
      owner.actor,
      owner.accountId,
    )) as Record<string, number>;

    const aCards = bareCardIds(corpusA).length;
    const bCards = bareCardIds(corpusB).length;

    /* Bundles: two destroyed, one survives. Bundles are where the two readings AGREE (a
       private bundle has no public release), so this pair is the premise rather than the
       finding. */
    expect(plan.privateBundles).toBe(2);
    expect(plan.publishedBundles).toBe(1);

    /* Cards: the finding. Corpus A's cards are private and pinned by a surviving public
       release, so they are `publishedCards`; corpus B's are private and pinned by nothing
       that survives, so they are `privateCards`. */
    expect(
      plan.privateCards,
      `privateCards is ${plan.privateCards} and the deletion destroys ${bCards} cards. If it ` +
        `reads ${aCards + bCards}, the plan is counting by VISIBILITY — every card here is ` +
        `private — and D-120-15's R rules the figures count by OUTCOME, so the plan would be ` +
        `overstating the irreversible operation it exists to let a reviewer check.`,
    ).toBe(bCards);
    expect(plan.publishedCards).toBe(aCards);

    /* And it really is a PARTITION: nothing counted twice, nothing left out. */
    const cards = await cardRows(scratch, [...bareCardIds(corpusA), ...bareCardIds(corpusB)]);
    expect(plan.privateCards + plan.publishedCards).toBe(cards.length);
  });

  it("`planDeletion` writes nothing — a preview is not the act", async () => {
    ready.require();
    const scratch = await freshDatabase("plan-readonly");
    const owner = await seedAccount(scratch, "t120-pr-owner");
    const published = await publishBundle(scratch, owner, "pr-public", "public");
    const secret = await publishBundle(scratch, owner, "pr-secret", "private", {
      corpus: resolvingCorpus(1),
    });

    const before = await accountRowsSnapshot(scratch);
    await (await verb("planDeletion"))(scratch.db, owner.actor, owner.accountId);
    const after = await accountRowsSnapshot(scratch);

    /* AC6 calls the deletion "the one irreversible operation in the registry", which is
       exactly why the preview must not perform any of it. A plan that destroyed one private
       bundle while counting the rest would satisfy every figure assertion above. */
    expect(after).toEqual(before);
    expect(before.bundle).toBeGreaterThanOrEqual(2);
    void published;
    void secret;
  });
});

describe("T120 `TransferPlan` — the shape, observed on the value", () => {
  it("carries exactly the published key set and names both ends", async () => {
    ready.require();
    const scratch = await freshDatabase("plan-transfer");
    const alice = await seedAccount(scratch, "t120-pt-alice");
    const bob = await seedAccount(scratch, "t120-pt-bob");
    const mine = await publishBundle(scratch, alice, "pt-bundle", "public");

    const plan = (await (await verb("planTransfer"))(
      scratch.db,
      alice.actor,
      mine.bundleId,
      bob.handle,
    )) as Record<string, unknown>;

    expect(Object.keys(plan).sort()).toEqual([...keysOf("TransferPlan")].sort());
    expect(plan.bundleId).toBe(mine.bundleId);
    expect(plan.fromAccountId).toBe(alice.accountId);
    expect(plan.toAccountId).toBe(bob.accountId);
    expect(plan.slug).toBe("pt-bundle");
    /* `toBe(false)`, not `toBeFalsy()`: `undefined` is falsy and a plan whose `collides` was
       never computed would pass the loose form. The block publishes `collides: boolean`. */
    expect(plan.collides).toBe(false);
  });
});

/** Row counts for every table, so "the preview wrote nothing" is a claim about the database. */
async function accountRowsSnapshot(scratch: Scratch): Promise<Record<string, number>> {
  const tables = await scratch.pool.query<{ name: string }>(
    `select table_name as name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  const out: Record<string, number> = {};
  for (const { name } of tables.rows) {
    const rows = await scratch.pool.query<{ n: string }>(`select count(*)::text as n from "${name}"`);
    out[name] = Number(rows.rows[0]?.n ?? "0");
  }
  return out;
}
