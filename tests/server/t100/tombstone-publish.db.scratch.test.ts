/* ============================================================
   A tombstoned account cannot publish (found by the ultracode
   audit). `transfer` refuses a transfer INTO a grave; `publish`
   did not refuse a publish BY one, so an account deleted while its
   session cookie was still valid could keep writing new bundles
   permanently attributed to the "deleted" identity, defeating the
   delete boundary T120 built.

   The refusal is `not-owner`, the same B-03 answer as an unknown
   handle: a distinct one would tell a caller which accounts are
   deleted. The tombstone keeps its handle (B-05), so this is driven
   by scrubbing `github_id` to the `deleted:` marker while leaving
   the handle in place — exactly what `deleteAccount` does.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { boundPublish, refusalFrom } from "./contract";
import {
  resolvingCorpus,
  scratchDatabase,
  seedOwner,
  type Corpus,
  type Owner,
  type Scratch,
} from "./fixtures";

let scratch: Scratch;
let owner: Owner;
let corpus: Corpus;

beforeAll(async () => {
  scratch = await scratchDatabase("tombstone-publish");
  owner = await seedOwner(scratch, "ghost");
  corpus = resolvingCorpus();
}, 60_000);

afterAll(async () => {
  await scratch?.drop();
});

describe("publish refuses a tombstoned owner", () => {
  it("answers not-owner and writes nothing when the resolved owner is a grave", async () => {
    const publish = await boundPublish();

    /* Scrub github_id to the tombstone marker, keeping the handle — `deleteAccount`'s own
       move (B-05 keeps the handle so published cards' author lines survive). */
    await scratch.pool.query("update account set github_id = 'deleted:' || id where id = $1", [
      owner.accountId,
    ]);

    const refusal = await refusalFrom(
      publish(scratch.db, owner.actor, {
        ownerHandle: owner.handle,
        slug: "ghost-bundle",
        version: "1.0.0",
        manifest: corpus.manifest,
        dot: corpus.dot,
        cardFiles: corpus.cardFiles,
      }),
      "tombstone",
    );
    expect(refusal.kind).toBe("not-owner");

    /* The refusal is BEFORE any write (it sits beside `can`, before the transaction opens), so
       the grave published nothing — the property the fix exists for, not just a status code. */
    const rows = await scratch.pool.query<{ n: number }>(
      "select count(*)::int as n from bundle where slug = 'ghost-bundle'",
    );
    expect(rows.rows[0]!.n).toBe(0);
  }, 60_000);
});
