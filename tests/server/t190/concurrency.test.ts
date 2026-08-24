/* ============================================================
   T190 — F2: the preferences write is read-modify-write

   Not a blind cell. This file was written in the ADVERSARY round,
   after reading the implementation, to drive a defect found by
   reading and acknowledged as chargeable.

   ── the shape ──
   `setPreferences` and `clearPreference` both READ the column, fill
   four booleans, and WRITE four booleans. `withStore` is a
   try/catch, not a transaction — the module's only transaction is
   the drain's advisory lock — so two callers touching DIFFERENT
   kinds both read the same before-state and the second write
   erases the first one's key.

   This is D-WAVE-01's own sentence, one task over: "an exact count
   under concurrency is the *increment*, which must be `SET x = x +
   1` in the database rather than read-modify-write in the process."
   The same is true of a per-key jsonb update: `jsonb_set` on one
   key is atomic where read-fill-write is not.

   ── why it is reachable rather than theoretical ──
   Two unsubscribe links, from two different emails, clicked in the
   same second — `fork` from one and `repin` from another. Each is
   an ordinary anonymous GET on a published route. Also the settings
   UI issuing two PATCHes while a reader flips two switches.

   ── why it is driven N times ──
   A lost update is a RACE, and one round that happens to serialise
   proves nothing. A correct (atomic) implementation holds the
   invariant on every round; a read-modify-write one loses a write
   on most. Asserting across rounds turns "probably" into a cell
   that a correct implementation passes deterministically and a
   racy one fails almost surely — without pinning a timing.

   The pool is WARMED first, for the reason every concurrency cell
   in this suite is: a cold `pg` pool serialises callers, and a
   serialised pair cannot lose an update at all.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  bind,
  deferred,
  dropScratchDatabases,
  mark,
  plantAccount,
  preferencesColumn,
  scratchDatabase,
  tokenRows,
  warmPool,
} from "./contract";

const setup = deferred<Scratch>(() => scratchDatabase("race"));

afterAll(async () => {
  await dropScratchDatabases();
});

const ROUNDS = 5;

describe("T190 F2: two concurrent preference writes must not lose one", () => {
  it("two `setPreferences` calls naming different kinds both survive", async () => {
    const scratch = await setup.require();
    await warmPool(scratch, 6);
    const setPreferences = await bind("setPreferences");

    const lost: string[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      const account = await plantAccount(scratch, mark(`f2-set${round}`).toLowerCase(), {
        repin: true,
        fork: true,
        deprecation: true,
        digest: true,
      });

      /* Both issued before either is awaited. */
      await Promise.allSettled([
        setPreferences(scratch.db, account.actor, account.accountId, { fork: false }),
        setPreferences(scratch.db, account.actor, account.accountId, { repin: false }),
      ]);

      const column = (await preferencesColumn(scratch, account.accountId)) ?? {};
      if (column.fork !== false || column.repin !== false) {
        lost.push(`round ${round}: ${JSON.stringify(column)}`);
      }
    }

    expect(
      lost,
      `F2: a concurrent write was LOST in ${lost.length} of ${ROUNDS} rounds.\n  ` +
        `${lost.join("\n  ")}\n` +
        `  Two callers each turned ONE preference off. Both calls resolved and one of the two ` +
        `settings is still on, so the second write erased the first.\n` +
        `  \`setPreferences\` reads the column, fills four booleans and writes four booleans, ` +
        `and \`withStore\` is a try/catch rather than a transaction — the module's only ` +
        `transaction is the drain's advisory lock. Both callers read the same before-state.\n` +
        `  This is D-WAVE-01's sentence one task over: the write must happen IN the database ` +
        `(a per-key \`jsonb_set\`, or the read and the write inside one transaction), not as a ` +
        `read-modify-write in the process.\n` +
        `  Reachable without any unusual client: a reader flipping two switches in the settings ` +
        `UI, which issues two PATCHes.`,
    ).toEqual([]);
  });

  /**
   * The same defect through the route a stranger can drive, and the likelier one in practice:
   * two unsubscribe links from two different emails, clicked together. `unsubscribe` reaches
   * `clearPreference`, which is the same read-fill-write.
   */
  it("two `unsubscribe` calls for different kinds both survive", async () => {
    const scratch = await setup.require();
    await warmPool(scratch, 6);
    const enqueue = await bind("enqueue");
    const unsubscribe = await bind("unsubscribe");

    const lost: string[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      const account = await plantAccount(scratch, mark(`f2-uns${round}`).toLowerCase(), {
        repin: true,
        fork: true,
        deprecation: true,
        digest: true,
      });

      /* Two real tokens, minted the way the product mints them. */
      await enqueue(scratch.db, {
        kind: "fork",
        accountId: account.accountId,
        subject: { slug: "t190-up", fork: "b1" },
      });
      await enqueue(scratch.db, {
        kind: "repin",
        accountId: account.accountId,
        subject: { cardId: "core.card", version: "2.0.0" },
      });
      const tokens = await tokenRows(scratch, account.accountId);
      const forkToken = tokens.find((t) => t.kind === "fork")?.token;
      const repinToken = tokens.find((t) => t.kind === "repin")?.token;
      expect(
        forkToken !== undefined && repinToken !== undefined,
        "the fixture did not mint one token per kind, so this cell has nothing to race",
      ).toBe(true);

      await Promise.allSettled([
        unsubscribe(scratch.db, forkToken),
        unsubscribe(scratch.db, repinToken),
      ]);

      const column = (await preferencesColumn(scratch, account.accountId)) ?? {};
      if (column.fork !== false || column.repin !== false) {
        lost.push(`round ${round}: ${JSON.stringify(column)}`);
      }
    }

    expect(
      lost,
      `F2/AC6: an unsubscribe was LOST in ${lost.length} of ${ROUNDS} rounds.\n  ` +
        `${lost.join("\n  ")}\n` +
        `  Two unsubscribe links for two different kinds were spent together and one of the two ` +
        `preferences is still ON — while BOTH tokens are now gone, because \`takeToken\` deletes ` +
        `unconditionally. So the reader has unsubscribed, been told it worked, has no link left, ` +
        `and still gets that mail.\n` +
        `  AC6 is "every email carries a WORKING unsubscribe". Two emails arriving together is ` +
        `the ordinary case for a registry that fans out, not an exotic one.`,
    ).toEqual([]);
  });
});
