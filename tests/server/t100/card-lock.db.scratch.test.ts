/* ============================================================
   The addCard chain-check race (D-20-03, found by the ultracode
   audit). Two publishes landing NEW versions of one shared card id
   each validate the bump against a snapshot that does not hold the
   other's uncommitted row, so an invalid adjacent pair can commit
   with neither writer ever seeing it. `publish` now takes a
   transaction-scoped advisory lock per card id BEFORE the read, in
   sorted order so overlapping publishes cannot deadlock, so the
   second writer waits for the first to commit and then reads its
   row.

   Driven deterministically rather than by racing two publishes: a
   held advisory lock BLOCKS, and the block is observable in
   `pg_locks` — no timing guess, no flake. An external connection
   holds the lock for the card `publish` will reach FIRST (the
   smallest id, since `publish` locks in sorted order), so `publish`
   blocks on its very first acquisition and shows up as one
   ungranted advisory request.

   The namespace is inlined into the holder's SQL, not bound as a
   parameter: bound, `pg_advisory_xact_lock`'s overload resolution
   picks a different key than the drizzle-inlined one `publish`
   uses, and the two silently never collide.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseCardRef } from "@/lib/core";
import { publish } from "@/lib/server/publish";
/* Deep import: the namespace is a test-only coupling, not part of the published barrel. */
import { CARD_CHAIN_LOCK_NAMESPACE } from "@/lib/server/publish/publish";
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
/** The card id `publish` locks first — the smallest, since it locks in sorted order. */
let firstLockedId: string;

beforeAll(async () => {
  scratch = await scratchDatabase("card-lock");
  owner = await seedOwner(scratch, "locker");
  corpus = resolvingCorpus();
  const ids = corpus.cardRefs.map((ref) => {
    const parsed = parseCardRef(ref);
    if (parsed === undefined) throw new Error(`corpus cardRef ${ref} did not parse`);
    return parsed.id;
  });
  firstLockedId = [...new Set(ids)].sort()[0]!;
}, 60_000);

afterAll(async () => {
  await scratch?.drop();
});

/** Poll until `check` is true or the budget runs out. In-test timer, so no Bash sleep block. */
async function waitFor(check: () => Promise<boolean>, budgetMs = 8_000): Promise<boolean> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
}

async function ungrantedAdvisory(): Promise<number> {
  const r = await scratch.pool.query<{ n: number }>(
    "select count(*)::int as n from pg_locks where locktype = 'advisory' and not granted",
  );
  return r.rows[0]!.n;
}

describe("publish serializes concurrent writers of one card id", () => {
  it("waits on the card's advisory lock while another transaction holds it", async () => {
    const holder = await scratch.pool.connect();
    let published: Promise<unknown> | undefined;
    try {
      /* The holder takes the EXACT lock `publish` reaches first. The namespace is inlined so the
         overload matches drizzle's; the id is bound. Held until this transaction ends. */
      await holder.query("begin");
      await holder.query(`select pg_advisory_xact_lock(${CARD_CHAIN_LOCK_NAMESPACE}, hashtext($1))`, [firstLockedId]);

      /* Nothing is waiting yet — the holder's lock is granted, and publish has not started. */
      expect(await ungrantedAdvisory()).toBe(0);

      published = publish(scratch.db, owner.actor, {
        ownerHandle: owner.handle,
        slug: "race-bundle",
        version: "1.0.0",
        manifest: corpus.manifest,
        dot: corpus.dot,
        cardFiles: corpus.cardFiles,
      });

      /* publish reaches its lock loop (validate/resolveOwner/createBundle are fast, and the lock
         precedes any embedding) and blocks on the held lock: one ungranted advisory request.
         This reds if publish never asks for the lock — which is the whole of the fix. */
      const blocked = await waitFor(async () => (await ungrantedAdvisory()) >= 1);
      expect(blocked, "publish did not wait on the card's advisory lock while it was held").toBe(true);

      /* And it is still pending — the lock is what holds it, not a slow query that already
         finished. Proven by releasing the holder and watching publish complete. */
      await holder.query("commit");
      await published;
      expect(await ungrantedAdvisory()).toBe(0);
    } finally {
      holder.release();
      if (published !== undefined) await published.catch(() => undefined);
    }
  }, 60_000);
});
