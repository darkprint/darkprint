/* ============================================================
   T120 — AC1, AC2, and the transfer rulings D-120-12 / D-120-16

   Every cell here PLANTS FIRST and BINDS THE MODULE LAST. An
   import of an absent barrel at the top of a cell is a red in
   0ms that is correct about its own subject and hides every
   write below it — `wave-blind.md` records three cells found
   that way which had never executed, and cell duration is how a
   reader checks. Each cell below does its I/O before it ever
   names `@/lib/server/lifecycle`, so a blind red arrives AFTER
   the fixture ran and the timing says so.

   ── one scratch database, one bundle per cell ──
   Cells in one file share a database, so a bundle two cells both
   transfer is a bundle whose second cell measures the first
   cell's end state. Every cell publishes under its OWN slug.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getBundle, listReleases } from "@/lib/server/archive";
import { getSignals } from "@/lib/server/counters";
import { driftOf, forkBundle, forksOf } from "@/lib/server/lineage";
import { publish } from "@/lib/server/publish";
import { can } from "@/lib/server/policy";

import { RecordedSetup, describe_, loadLifecycle, requiredFn, signature } from "./contract";
import {
  bareCardIds,
  bundleRow,
  cardRows,
  note,
  publishBundle,
  report,
  resolvingCorpus,
  scratchDatabase,
  seedAccount,
  star,
  type Account,
  type Scratch,
} from "./fixtures";

interface World {
  scratch: Scratch;
  alice: Account;
  bob: Account;
  carol: Account;
}

const world = new RecordedSetup<World>("the T120 transfer fixture");

beforeAll(async () => {
  await world.run(async () => {
    const scratch = await scratchDatabase("transfer");
    return {
      scratch,
      alice: await seedAccount(scratch, "t120-alice"),
      bob: await seedAccount(scratch, "t120-bob"),
      carol: await seedAccount(scratch, "t120-carol"),
    };
  });
}, 120_000);

afterAll(async () => {
  await world.optional()?.scratch.drop();
});

/** The one door to the module, opened as late as a cell can open it. */
async function transferBundle() {
  const mod = await loadLifecycle();
  return requiredFn(mod, "transferBundle", signature("transferBundle").text);
}

describe("T120 AC1 — after a transfer the digest is unchanged and the bundle resolves identically", () => {
  it("moves the owner AND leaves every digest input byte-identical", async () => {
    const { scratch, alice, bob } = world.require();

    const published = await publishBundle(scratch, alice, "ac1-digest", "public");
    const before = (await listReleases(scratch.db, published.bundleId))[0];
    const beforeRow = await bundleRow(scratch, published.bundleId);
    expect(beforeRow?.owner_id).toBe(alice.accountId);

    const transfer = await transferBundle();
    await transfer(scratch.db, alice.actor, published.bundleId, bob.handle);

    const after = (await listReleases(scratch.db, published.bundleId))[0];
    const afterRow = await bundleRow(scratch, published.bundleId);

    /* **The disagreeing control, and AC1 needs one more than any other cell in this task.**
       "The digest is unchanged" is a NON-EFFECT: it is satisfied perfectly by a
       `transferBundle` that returned without doing anything at all, and the block says so in
       as many words. So the cell asserts the transfer HAPPENED first, and only then that the
       bytes did not move. Without this line the whole criterion is unfalsifiable. */
    expect(
      afterRow?.owner_id,
      "the bundle's owner did not move, so every digest assertion below is a statement about " +
        "a transfer that never happened. AC1 is a non-effect and this line is what makes it " +
        "falsifiable.",
    ).toBe(bob.accountId);

    /* Every input `bundleDigest` takes, not only the digest it produced: the criterion's own
       justification is that `author` is outside `cardDigest` and the manifest outside
       `bundleDigest`, and it is exactly that construction the cell exists to keep true if
       either input ever widens. Comparing the stored digest alone would stay green against a
       module that rewrote `dot` and recomputed nothing. */
    expect(after.digest).toBe(before.digest);
    expect(after.dot).toBe(before.dot);
    expect([...after.cardRefs]).toEqual([...before.cardRefs]);
    expect([...after.cardDigests]).toEqual([...before.cardDigests]);
    expect(after.manifest).toEqual(before.manifest);
    expect(after.id).toBe(before.id);
    expect(after.version).toBe(before.version);

    /* And the digest is a real one rather than two absent values compared to each other. */
    expect(after.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("resolves at the NEW address and no longer at the old one — D-120-06's reading of `identically`", async () => {
    const { scratch, alice, bob } = world.require();

    const published = await publishBundle(scratch, alice, "ac1-address", "public");
    const before = await getBundle(scratch.db, alice.accountId, "ac1-address");
    expect(before?.id).toBe(published.bundleId);

    const transfer = await transferBundle();
    await transfer(scratch.db, alice.actor, published.bundleId, bob.handle);

    /* D-120-06: "identically" means same bytes, same digest; the ADDRESS necessarily changes
       with the namespace under B-09, and no redirect is owed. Both halves are asserted, and
       the second is the one a reader would otherwise assume the opposite of. */
    const atNew = await getBundle(scratch.db, bob.accountId, "ac1-address");
    expect(atNew?.id).toBe(published.bundleId);
    expect(atNew?.slug).toBe("ac1-address");

    const atOld = await getBundle(scratch.db, alice.accountId, "ac1-address");
    expect(
      atOld,
      "the bundle still resolves at the OLD owner's address after a transfer, so either it " +
        "was copied rather than moved or `bundle.owner_id` did not change. D-120-06 rules the " +
        "address moves with the namespace.",
    ).toBeUndefined();
  });
});

describe("T120 AC2 — the old owner has no write access and the new owner does", () => {
  it("the NEW owner appends a release to the SAME bundle row", async () => {
    const { scratch, alice, bob } = world.require();
    const corpus = resolvingCorpus();

    const published = await publishBundle(scratch, alice, "ac2-write", "public");

    const transfer = await transferBundle();
    await transfer(scratch.db, alice.actor, published.bundleId, bob.handle);

    /* Write access asserted through a SEPARATE AUTHOR'S writer rather than through `can`.
       A `can(bob, "write", …)` assertion is a tautology the moment `owner_id` moved — it
       would restate the previous cell in T060's vocabulary and observe nothing new. What AC2
       is about is whether a write LANDS. */
    const appended = await publish(scratch.db, bob.actor, {
      ownerHandle: bob.handle,
      slug: "ac2-write",
      version: "1.1.0",
      manifest: corpus.manifest,
      dot: corpus.dot,
      cardFiles: corpus.cardFiles,
    });
    expect(appended.bundleId).toBe(published.bundleId);
    expect(
      appended.created,
      "the new owner's publish CREATED a bundle instead of appending to the transferred one, " +
        "so the transfer did not put the row in their namespace.",
    ).toBe(false);
    expect((await listReleases(scratch.db, published.bundleId)).length).toBe(2);
  });

  it("the OLD owner's write no longer reaches the row — and lands somewhere else instead", async () => {
    const { scratch, alice, bob } = world.require();
    const corpus = resolvingCorpus();

    const published = await publishBundle(scratch, alice, "ac2-lost", "public");

    const transfer = await transferBundle();
    await transfer(scratch.db, alice.actor, published.bundleId, bob.handle);

    /* Two observations, and the second is the disagreeing control. A cell that only checked
       the refusal would be green against a module that refused EVERY publish. */
    await expect(
      publish(scratch.db, alice.actor, {
        ownerHandle: bob.handle,
        slug: "ac2-lost",
        version: "1.1.0",
        manifest: corpus.manifest,
        dot: corpus.dot,
        cardFiles: corpus.cardFiles,
      }),
      "the old owner published into the RECIPIENT's namespace after the transfer, which is " +
        "the write access AC2 says they lose.",
    ).rejects.toThrow();

    /* Alice can still publish — under her OWN handle, where it creates a NEW bundle. That is
       what makes the refusal above a statement about this bundle rather than about Alice. */
    const elsewhere = await publish(scratch.db, alice.actor, {
      ownerHandle: alice.handle,
      slug: "ac2-lost",
      version: "1.0.0",
      manifest: corpus.manifest,
      dot: corpus.dot,
      cardFiles: corpus.cardFiles,
    });
    expect(elsewhere.created).toBe(true);
    expect(elsewhere.bundleId).not.toBe(published.bundleId);

    /* And T060 agrees with the storage, read off the row rather than off the transfer's
       return: the return is the module's own claim and the row is what a later reader sees. */
    const row = await bundleRow(scratch, published.bundleId);
    const resource = {
      kind: "bundle" as const,
      ownerId: String(row?.owner_id),
      visibility: row?.visibility as "public" | "private",
    };
    expect(can(alice.actor, "write", resource)).toBe(false);
    expect(can(bob.actor, "write", resource)).toBe(true);
  });
});

describe("T120 D-120-12 — what the transfer moves and what it does not", () => {
  it("I: `card_version.owner_id` never moves, for the bundle's cards or anyone else's", async () => {
    const { scratch, alice, bob } = world.require();

    const published = await publishBundle(scratch, alice, "d12-cards", "public");
    const ids = bareCardIds(published.corpus);
    const before = await cardRows(scratch, ids);
    expect(before.length).toBeGreaterThan(0);

    const transfer = await transferBundle();
    await transfer(scratch.db, alice.actor, published.bundleId, bob.handle);

    const after = await cardRows(scratch, ids);
    expect(after.length).toBe(before.length);
    for (const row of after) {
      expect(
        row.owner_id,
        `card_version ${String(row.card_id)}@${String(row.version)} changed hands with the ` +
          `bundle. D-120-12's I is explicit: a card the old owner's OTHER bundles pin cannot ` +
          `silently change hands, and \`card_version\` is unique on (card_id, version) across ` +
          `the whole table rather than per bundle.`,
      ).toBe(alice.accountId);
    }

    /* The row set itself is unchanged — a module that deleted and re-inserted the cards under
       the same owner would pass the loop above and still have rewritten immutable rows. */
    expect(after.map((r) => r.id).sort()).toEqual(before.map((r) => r.id).sort());
  });

  it("H: a fork's lineage pointer follows the upstream to its new owner", async () => {
    const { scratch, alice, bob, carol } = world.require();

    const published = await publishBundle(scratch, alice, "d12-upstream", "public");
    const fork = await forkBundle(
      scratch.db,
      carol.actor,
      { ownerHandle: alice.handle, slug: "d12-upstream", version: published.version },
      { slug: "d12-fork", visibility: "public" },
    );
    expect(fork.lineage?.ownerId).toBe(alice.accountId);

    /* The premise: BEFORE the transfer both directions already work. Without it, "drift
       resolves after the transfer" is green against a fixture where drift never resolved. */
    expect((await forksOf(scratch.db, carol.actor, published.bundleId)).length).toBeGreaterThan(0);

    const transfer = await transferBundle();
    await transfer(scratch.db, alice.actor, published.bundleId, bob.handle);

    const moved = await bundleRow(scratch, fork.id);
    expect(
      moved?.lineage_owner_id,
      "the fork still points at the OLD owner. `driftOf` resolves its upstream as " +
        "`getBundle(lineage.ownerId, lineage.slug)` and `forkRowsOf` queries " +
        "`lineage_owner_id = $1`, so a stale pointer silently answers `ok` for a fork whose " +
        "upstream has moved on — D-120-12's H rules the pointer moves in the same transaction.",
    ).toBe(bob.accountId);
    expect(moved?.lineage_slug).toBe("d12-upstream");

    /* Both readers, because the pointer is what BOTH of them key on and a repair that fixed
       one column could leave the other side of the relationship broken. */
    expect((await forksOf(scratch.db, carol.actor, published.bundleId)).map((f) => f.id)).toContain(
      fork.id,
    );
    await expect(driftOf(scratch.db, carol.actor, fork.id)).resolves.toBeDefined();
  });

  it("J: a self-transfer is a no-op success and leaves the record untouched", async () => {
    const { scratch, alice } = world.require();

    const published = await publishBundle(scratch, alice, "d12-self", "public");
    const before = await bundleRow(scratch, published.bundleId);

    const transfer = await transferBundle();
    const returned = await transfer(scratch.db, alice.actor, published.bundleId, alice.handle);

    /* D-120-12's J: idempotent for retries, so it must not refuse — `bundle_owner_slug_key` is
       (owner_id, slug) and the bundle already occupies that pair, which is the collision a
       naive predicate would report against the bundle itself. */
    const after = await bundleRow(scratch, published.bundleId);
    expect(after?.owner_id).toBe(alice.accountId);
    expect(after?.slug).toBe(before?.slug);
    expect(after?.visibility).toBe(before?.visibility);
    expect(after?.created_at).toEqual(before?.created_at);

    /* It returns the record rather than `undefined` — the published return is
       `Promise<BundleRecord>` and a no-op that answered nothing would break every caller. */
    expect(
      (returned as { id?: unknown } | undefined)?.id,
      `a self-transfer returned ${describe_(returned)}; the block publishes ` +
        `\`Promise<BundleRecord>\` and D-120-12's J rules the call a SUCCESS, not a refusal.`,
    ).toBe(published.bundleId);
  });
});

describe("T120 D-120-16 — the signals follow the content, and nothing is owed", () => {
  it("stars, notes and reported costs are still there, still on the same target row", async () => {
    const { scratch, alice, bob, carol } = world.require();

    const published = await publishBundle(scratch, alice, "d16-signals", "public");
    const target = { kind: "blueprint" as const, refId: published.bundleId };

    await star(scratch, carol, target);
    await note(scratch, carol, target, "a note that outlives the transfer");
    await report(scratch, carol, published.digest);

    const before = await getSignals(scratch.db, carol.actor, target);
    expect(before.starCount).toBe(1);
    expect(before.noteCount).toBe(1);

    const transfer = await transferBundle();
    await transfer(scratch.db, alice.actor, published.bundleId, bob.handle);

    /* D-120-16 withdrew the `Open:` line with "nothing moves and nothing is owed": the
       signals key on `target.ref_id`, which holds `bundle.id`, and a transfer does not change
       it. The cell pins the ruling rather than restating the mechanism — a module that reset
       the counters on transfer, or re-keyed the target row to a new id, fails here. */
    const after = await getSignals(scratch.db, carol.actor, target);
    expect(after.starCount).toBe(before.starCount);
    expect(after.noteCount).toBe(before.noteCount);
    expect(after.downloadCount).toBe(before.downloadCount);

    const reports = await scratch.pool.query<{ n: string }>(
      `select count(*)::text as n from "run_report" where release_digest = $1`,
      [published.digest],
    );
    expect(reports.rows[0]?.n).toBe("1");
  });
});
