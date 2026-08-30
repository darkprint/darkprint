/* ============================================================
   DarkPrint backend — T190 against Postgres
   The implementer's own verification, in the shipped
   `.scratch.test.ts` convention (T050's, T100's, T110's). It is
   NOT the blind suite and does not stand in for it: every cell
   here was written by the author of the code it drives, so it is a
   consistency check on my own reading and never a second axis.
   What it can catch is a wrong statement, a wrong index, a wrong
   order — the things `tsc` cannot see and a DDL comparison cannot
   either.

   ── every verb here writes or reads real rows ──
   The unique key, the partial index, the conflict-catching insert,
   `DELETE ... RETURNING` and the token join are the subject. A spy
   `Db` could measure none of them honestly.

   ── the shared slot is NOT redirected ──
   Every published verb takes its `Db`, so each call below is handed
   the scratch client explicitly and `getSharedDbClient()` is never
   reached. Only the routes read the shared slot and they are not
   exercised here. T110's suite makes the same choice for the same
   reason: redirecting a slot a suite never uses claims a protection
   it does not need, and hides the day one of these verbs starts
   reaching for it.

   ── what a skip means here ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap: an unsourced shell turns every assertion below
   into silence at exit 0. **The skipped count is part of this
   file's result.** The first cell is deliberately OUTSIDE the
   guarded block and announces which world ran, so a green can never
   be ambiguous about whether anything was measured.
   ============================================================ */

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { BundleManifest } from "@/lib/core";
import { migrateDown, migrateUp, schema, type Db } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";
import { forkBundle } from "@/lib/server/lineage";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";
import { DEFAULT_PREFERENCES } from "./defaults";
import { deliverPending } from "./deliver";
import { enqueue, enqueueRepinEvents } from "./enqueue";
import { UnsubscribeInvalidError } from "./errors";
import { getPreferences, setPreferences } from "./preferences";
import { unsubscribe } from "./unsubscribe";
import type { EventKind, NotificationDelivery } from "./types";

const hasDb = Boolean(process.env.DATABASE_URL);

/**
 * The world announcement, and it is OUTSIDE `skipIf` on purpose.
 *
 * A suite whose every cell is optional reports the same green in both worlds, so a reader
 * cannot tell "62 assertions held" from "62 assertions never ran". This one cell always runs
 * and always says which happened.
 */
describe("T190 scratch suite — which world ran", () => {
  it(`announces its world: DATABASE_URL is ${hasDb ? "SET, so the cells below RAN" : "UNSET, so every cell below was SKIPPED and measured NOTHING"}`, () => {
    expect(
      typeof hasDb,
      "the world flag must be a real boolean, or this announcement is itself vacuous",
    ).toBe("boolean");
  });
});

interface Recorded {
  kind: EventKind;
  accountId: string;
  subject: Record<string, string>;
  unsubscribeToken: string;
}

/**
 * The mailer, as a recording fake. Nothing in this repository sends email (D-190-01).
 *
 * `refuse` decides per message, so AC5's delivery half can fail exactly row 2 of 3. The thrown
 * message deliberately names nothing about the recipient — a fake that leaked an address would
 * make this suite unable to notice the module leaking one.
 */
class RecordingDelivery implements NotificationDelivery {
  readonly sent: Recorded[] = [];
  constructor(private readonly refuse: (message: Recorded) => boolean = () => false) {}
  async send(message: Recorded): Promise<void> {
    if (this.refuse(message)) throw new Error("the seam refused this message");
    this.sent.push(message);
  }
}

function manifestFor(slug: string): BundleManifest {
  return { slug, title: slug, summary: "fixture", tags: [] };
}

describe.skipIf(!hasDb)("lib/server/notifications against Postgres", () => {
  let testDb: TestDb;
  let db: Db;

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;
  });

  beforeEach(async () => {
    await resetTestDb(testDb.client);
  });

  afterAll(async () => {
    /* Optional-call: when `beforeAll` fails, `testDb` was never assigned and an unguarded deref
       throws out of the teardown, burying the real cause behind a TypeError. */
    await testDb?.drop();
  });

  /** An ordinary account. `notification_preferences` is left at its `{}` default. */
  async function seedAccount(login: string): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId: `gh-${login}`, githubLogin: login, handle: login })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  /** The account's raw column, read directly — D-190-02 makes that admissible. */
  async function storedColumn(accountId: string): Promise<unknown> {
    const [row] = await db
      .select({ preferences: schema.account.notificationPreferences })
      .from(schema.account)
      .where(eq(schema.account.id, accountId));
    return row?.preferences;
  }

  /**
   * Force `account.updated_at` to a fixed sentinel far in the past, and answer it.
   *
   * **A before/after comparison of two `now()` stamps cannot discriminate here.** T010 measured
   * 32 inserts landing on 12 distinct timestamps, and `Date.getTime()` truncates Postgres
   * microseconds — so a write that happened in the same millisecond as the previous one reads as
   * "unchanged", and a no-write cell would pass over exactly the write it forbids. Against a
   * sentinel there is no ambiguity in either direction: still 2020 means nothing wrote, anything
   * else means something did.
   */
  const UPDATED_AT_SENTINEL = new Date("2020-01-01T00:00:00.000Z");
  async function pinUpdatedAt(accountId: string): Promise<Date> {
    await db
      .update(schema.account)
      .set({ updatedAt: UPDATED_AT_SENTINEL })
      .where(eq(schema.account.id, accountId));
    return UPDATED_AT_SENTINEL;
  }

  /** The two things D-190-11 is about: the column's bytes and the stamp T050 owns. */
  async function accountRowStamp(accountId: string): Promise<{ preferences: unknown; updatedAt: Date | null }> {
    const [row] = await db
      .select({
        preferences: schema.account.notificationPreferences,
        updatedAt: schema.account.updatedAt,
      })
      .from(schema.account)
      .where(eq(schema.account.id, accountId));
    return { preferences: row?.preferences, updatedAt: row?.updatedAt ?? null };
  }

  /**
   * Establish real connections before a race cell.
   *
   * A cold `pg` pool opens them lazily, so two "concurrent" callers serialise on connection setup
   * and the window never opens — measured elsewhere in this run as 1 of 8 racing cold against 24
   * of 24 warmed. Without this, a race cell is green against the broken code too.
   */
  async function warmPool(): Promise<void> {
    await Promise.all(Array.from({ length: 6 }, async () => await db.execute(sql`select 1`)));
  }

  async function queueRows(accountId?: string): Promise<{ kind: string; subject: unknown; deliveredAt: Date | null }[]> {
    const rows = await db
      .select({
        kind: schema.notificationQueue.kind,
        accountId: schema.notificationQueue.accountId,
        subject: schema.notificationQueue.subject,
        deliveredAt: schema.notificationQueue.deliveredAt,
      })
      .from(schema.notificationQueue);
    return rows.filter((r) => accountId === undefined || r.accountId === accountId);
  }

  function actorFor(accountId: string): Actor {
    return { kind: "account", accountId, handle: null };
  }

  /* ─────────────── AC4: the default four ─────────────── */

  describe("AC4 — off by default is a fact about the DEFAULT", () => {
    it("a new account's column is `{}` and still reads four booleans, with digest FALSE", async () => {
      const account = await seedAccount("ac4-new");

      /* The premise. Without it the assertion below could pass over a column somebody had
         already written four booleans into, which measures the writer and not the default. */
      expect(await storedColumn(account), "a new account's column is the empty object").toEqual({});

      const preferences = await getPreferences(db, actorFor(account), account);
      expect(preferences).toEqual({ repin: true, fork: true, deprecation: true, digest: false });
      expect(
        preferences.digest,
        "AC4: the weekly digest is off for a new account. Reading `stored[kind] ?? true` would " +
          "make this true and pass every cell that sets a value first.",
      ).toBe(false);
    });

    it("a PARTIAL column fills the missing keys from the default, never from `true`", async () => {
      const account = await seedAccount("ac4-partial");
      /* Only `digest` stored, and stored ON — so a reader that ignored the column would answer
         false here, and one that defaulted missing keys to `true` would be caught by `fork`
         below only if `fork`'s default were false. The discriminating key is `digest`: it is
         the one whose stored value DISAGREES with its default. */
      await db
        .update(schema.account)
        .set({ notificationPreferences: { digest: true } })
        .where(eq(schema.account.id, account));

      const preferences = await getPreferences(db, actorFor(account), account);
      expect(preferences.digest, "a stored value wins over the default").toBe(true);
      expect(preferences.repin, "a missing key reads its DEFAULT").toBe(true);
      expect(preferences.deprecation).toBe(true);
    });

    it("a non-boolean under a known key falls back to the default rather than being coerced", async () => {
      const account = await seedAccount("ac4-junk");
      /* `"false"` is TRUTHY. A reader coercing the column would turn `digest` ON here, which is
         the one preference AC4 names as off. */
      await db
        .update(schema.account)
        .set({ notificationPreferences: { digest: "false", repin: 0 } })
        .where(eq(schema.account.id, account));

      const preferences = await getPreferences(db, actorFor(account), account);
      expect(preferences.digest, "`\"false\"` is truthy; coercing it turns digest on").toBe(false);
      expect(preferences.repin, "`0` is falsy; coercing it would turn repin off").toBe(true);
    });

    it("DEFAULT_PREFERENCES is the published constant the fills come from", () => {
      expect(DEFAULT_PREFERENCES).toEqual({ repin: true, fork: true, deprecation: true, digest: false });
    });
  });

  /* ─────────────── setPreferences ─────────────── */

  describe("setPreferences", () => {
    it("writes exactly the four known keys and NEVER persists an unknown one", async () => {
      const account = await seedAccount("set-unknown");
      await setPreferences(db, actorFor(account), account, {
        digest: true,
        /* Not a member of `Preferences`. D-190-05: ignored, and never persisted. */
        ...({ sms: true, "../../etc": "x" } as object),
      });

      const column = await storedColumn(account);
      expect(
        Object.keys(column as object).sort(),
        "D-190-05: the column may hold only the four known keys, whatever the caller sent",
      ).toEqual(["deprecation", "digest", "fork", "repin"]);
      expect((column as Record<string, unknown>)["sms"]).toBeUndefined();
    });

    it("D-190-11: `setPreferences({})` answers the current four and WRITES NOTHING", async () => {
      const account = await seedAccount("set-empty");
      /* A real write first, so the column is total and the no-op below is measured against a
         populated column rather than against `{}` — where "unchanged" and "overwritten with the
         filled four" are the same bytes and the cell could not discriminate. */
      await setPreferences(db, actorFor(account), account, { fork: false });

      const before = await accountRowStamp(account);
      const sentinel = await pinUpdatedAt(account);
      const answered = await setPreferences(db, actorFor(account), account, {});
      const after = await accountRowStamp(account);

      expect(answered).toEqual({ repin: true, fork: false, deprecation: true, digest: false });
      expect(after.preferences, "the column is byte-unchanged").toEqual(before.preferences);
      expect(
        after.updatedAt?.getTime(),
        "D-190-11's own tell: `updated_at` is T050's column, and an empty PATCH from any client " +
          "must not mutate another module's column as the consequence of nothing.",
      ).toBe(sentinel.getTime());
    });

    it("D-190-11: a patch naming only UNKNOWN keys is empty after filtering, so it writes nothing", async () => {
      const account = await seedAccount("set-unknown-only");
      await setPreferences(db, actorFor(account), account, { fork: false });
      const before = await accountRowStamp(account);
      const sentinel = await pinUpdatedAt(account);
      await setPreferences(db, actorFor(account), account, { ...({ sms: true } as object) });
      const after = await accountRowStamp(account);
      expect(after.preferences).toEqual(before.preferences);
      expect(after.updatedAt?.getTime()).toBe(sentinel.getTime());
    });

    it("D-190-11 clarified: a known key carrying a NON-BOOLEAN contributes nothing, so it writes nothing", async () => {
      const account = await seedAccount("set-illformed");
      await setPreferences(db, actorFor(account), account, { fork: false });
      const before = await accountRowStamp(account);
      const sentinel = await pinUpdatedAt(account);

      /* `digest` is a KNOWN key, so this survives the unknown-key filter and fails only the
         boolean one. It is the exact input the two readings of D-190-11 disagreed on, ruled for
         the narrower: "empty after filtering" means after BOTH filters, so this contributes no
         well-formed entry and must not bump T050's column as the consequence of nothing.
         Unreachable from HTTP — the PATCH route answers it 400 — so the cast is how it is
         reached at all, and this cell is the only thing holding the module-level behaviour. */
      await setPreferences(db, actorFor(account), account, { ...({ digest: 3 } as object) });

      const after = await accountRowStamp(account);
      expect(after.preferences, "the column is byte-unchanged").toEqual(before.preferences);
      expect(
        after.updatedAt?.getTime(),
        "D-190-11 clarified: contribution, not presence. A known key holding an unusable value " +
          "names no preference, and writing for it bumps `updated_at` for nothing.",
      ).toBe(sentinel.getTime());
    });

    it("D-190-11: normalisation-to-total survives — one known key still writes all four", async () => {
      const account = await seedAccount("set-total");
      /* The other direction, and without it "writes nothing" would be equally true of an
         implementation that stopped writing altogether. The column starts `{}`; one known key
         must leave it holding all four. */
      expect(await storedColumn(account)).toEqual({});
      await setPreferences(db, actorFor(account), account, { digest: true });
      expect(
        Object.keys((await storedColumn(account)) as object).sort(),
        "a REAL write still normalises the column to total (D-190-11)",
      ).toEqual(["deprecation", "digest", "fork", "repin"]);
    });

    it("D-190-11: a known key whose value equals the current one is still a REAL write", async () => {
      const account = await seedAccount("set-same");
      await setPreferences(db, actorFor(account), account, { fork: false });
      const before = await accountRowStamp(account);
      const sentinel = await pinUpdatedAt(account);
      /* The ruled line is key PRESENCE, not value CHANGE. This patch names a real preference and
         must write, even though the resulting four are identical — so the stamp must LEAVE the
         sentinel. Asserted against the sentinel rather than as `after >= before`, which is true
         whatever the code does and would admit the no-write this cell exists to forbid. */
      await setPreferences(db, actorFor(account), account, { fork: false });
      const after = await accountRowStamp(account);
      expect(after.preferences).toEqual(before.preferences);
      expect(
        after.updatedAt?.getTime(),
        "the ruled test is key PRESENCE, not value change: a patch naming a real preference is a " +
          "real write, so it must move the stamp off the sentinel.",
      ).not.toBe(sentinel.getTime());
    });

    it("D-190-12 / F2: two concurrent callers on DIFFERENT kinds both land, 5 of 5", async () => {
      /* The adversary's measured shape, driven five times because its charge was measured five
         times: the read-modify-write lost one write 5 of 5 before the lock. One run proves
         nothing here — a race that happens to serialise is green against the broken code too. */
      for (let round = 0; round < 5; round += 1) {
        const account = await seedAccount(`f2-set-${round}`);
        await warmPool();

        await Promise.all([
          setPreferences(db, actorFor(account), account, { fork: false }),
          setPreferences(db, actorFor(account), account, { digest: true }),
        ]);

        expect(
          await getPreferences(db, actorFor(account), account),
          `round ${round}: both callers patched a DIFFERENT kind, so both changes must survive. ` +
            `Without a locked read the second caller computes all four from the value it read ` +
            `before the first wrote, and erases it — the lost update D-190-12 charges. A plain ` +
            `transaction does NOT fix this: under READ COMMITTED both reads succeed and only the ` +
            `WRITE waits.`,
        ).toEqual({ repin: true, fork: false, deprecation: true, digest: true });
      }
    }, 120_000);

    it("D-190-12 / F2: two concurrent callers on the SAME kind agree, and neither sees a raw 23505", async () => {
      /* The companion the same-caller shape needs: two writers of one key have two legitimate
         interleavings, so the deterministic claims are that the column stays well-formed and that
         no caller is handed a driver code. */
      for (let round = 0; round < 5; round += 1) {
        const account = await seedAccount(`f2-same-${round}`);
        await warmPool();
        const results = await Promise.all([
          setPreferences(db, actorFor(account), account, { digest: true }),
          setPreferences(db, actorFor(account), account, { digest: true }),
        ]);
        for (const answered of results) expect(answered.digest).toBe(true);
        expect(
          Object.keys((await storedColumn(account)) as object).sort(),
          `round ${round}: the column stays total and well-formed under contention`,
        ).toEqual(["deprecation", "digest", "fork", "repin"]);
      }
    }, 120_000);

    it("a non-owner is refused with the published sentence, and it names no account", async () => {
      const mine = await seedAccount("set-mine");
      const yours = await seedAccount("set-yours");
      await expect(setPreferences(db, actorFor(yours), mine, { digest: true })).rejects.toThrow(
        "setPreferences: not this account's owner.",
      );
      await expect(getPreferences(db, actorFor(yours), mine)).rejects.toThrow(
        "getPreferences: not this account's owner.",
      );
    });

    it("an OPERATOR passes both preference verbs (D-190-05)", async () => {
      const subject = await seedAccount("op-subject");
      const operator: Actor = { kind: "operator", accountId: await seedAccount("op-actor") };
      await expect(getPreferences(db, operator, subject)).resolves.toEqual(DEFAULT_PREFERENCES);
      const written = await setPreferences(db, operator, subject, { digest: true });
      expect(written.digest, "an id comparison instead of `can` would have refused this").toBe(true);
    });
  });

  /* ─────────────── enqueue's four gates ─────────────── */

  describe("enqueue declines silently at each gate (D-190-02, D-190-08(3))", () => {
    it("writes nothing for an account that does not exist", async () => {
      await enqueue(db, {
        kind: "fork",
        accountId: "00000000-0000-0000-0000-000000000000",
        subject: { slug: "x", fork: "y" },
      });
      expect(await queueRows()).toHaveLength(0);
    });

    it("writes nothing when the kind is OFF, and one row when it is ON", async () => {
      const account = await seedAccount("gate-pref");
      await setPreferences(db, actorFor(account), account, { fork: false });
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "a", fork: "b" } });
      expect(await queueRows(account), "the queue must not fill for somebody who opted out").toHaveLength(0);

      /* The control, and it is what stops the zero above being a claim about a broken writer
         rather than about the gate. */
      await setPreferences(db, actorFor(account), account, { fork: true });
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "a", fork: "b" } });
      expect(await queueRows(account)).toHaveLength(1);
    });

    it("writes nothing for a TOMBSTONED account (D-190-02(2))", async () => {
      const account = await seedAccount("gate-grave");
      /* D-120-01's marker exactly as `lifecycle/deletion.ts:207` writes it. This cell is the
         only thing reconciling my copied predicate against T120's real write — which is G2,
         and why the orchestrator owns publishing `isTombstone` at merge. */
      await db
        .update(schema.account)
        .set({ githubId: `deleted:${account}` })
        .where(eq(schema.account.id, account));

      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "a", fork: "b" } });
      expect(
        await queueRows(account),
        "a queue row for an account that can never be mailed is garbage by construction",
      ).toHaveLength(0);
    });
  });

  /* ─────────────── AC5: the row IS the idempotency ─────────────── */

  describe("AC5 — the queue row is the idempotency key", () => {
    it("two SPELLINGS of one subject collide on one row", async () => {
      const account = await seedAccount("ac5-spelling");
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s", fork: "f" } });
      /* Same members, different insertion order. `JSON.stringify` gives these two different
         bytes; `canonicalJson` sorts by code unit, which is what makes them one row. */
      await enqueue(db, { kind: "fork", accountId: account, subject: { fork: "f", slug: "s" } });
      expect(await queueRows(account)).toHaveLength(1);
    });

    it("two CONCURRENT callers on a WARMED pool leave exactly one row", async () => {
      const account = await seedAccount("ac5-race");
      const subject = { slug: "race", fork: "one" };

      await warmPool();

      await Promise.all([
        enqueue(db, { kind: "fork", accountId: account, subject }),
        enqueue(db, { kind: "fork", accountId: account, subject }),
      ]);

      expect(
        await queueRows(account),
        "AC5: a status column and a counter would let both callers read `not sent` and both send. " +
          "The unique key with the conflict caught is what makes this one row.",
      ).toHaveLength(1);
    });
  });

  /* ─────────────── AC1 / AC2: the fork filter at the source ─────────────── */

  describe("AC1 and AC2 — the filter is inside forkBundle", () => {
    /** An upstream bundle with one release, owned by `author`. */
    async function seedUpstream(author: string, slug: string): Promise<void> {
      const bundle = await createBundle(db, { ownerId: author, slug, visibility: "public" });
      await addRelease(db, {
        bundleId: bundle.id,
        version: "1.0.0",
        dot: "digraph{}",
        manifest: manifestFor(slug),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests: ["sha256:aa"],
      });
    }

    it("AC1: a PRIVATE fork writes no queue row, under the preference being ON", async () => {
      const author = await seedAccount("ac1-author");
      const forker = await seedAccount("ac1-forker");
      await seedUpstream(author, "ac1-up");

      /* The premise: the upstream author WANTS fork mail. So a zero below is the visibility
         filter and not a preference that happened to be off. */
      expect((await getPreferences(db, actorFor(author), author)).fork).toBe(true);

      await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "ac1-author", slug: "ac1-up", version: "1.0.0" },
        { slug: "ac1-fork", visibility: "private" },
      );

      expect(
        await queueRows(),
        "AC1: a private fork produces no email under any preference. A delivery-side filter " +
          "would pass this and leak the moment a second sender existed.",
      ).toHaveLength(0);
    });

    it("AC2: a PUBLIC fork writes exactly one row, addressed to the upstream author", async () => {
      const author = await seedAccount("ac2-author");
      const forker = await seedAccount("ac2-forker");
      await seedUpstream(author, "ac2-up");

      const fork = await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "ac2-author", slug: "ac2-up", version: "1.0.0" },
        { slug: "ac2-fork", visibility: "public" },
      );

      const rows = await queueRows(author);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.kind).toBe("fork");
      expect(
        rows[0]!.subject,
        "D-190-07: `{ slug, fork }`, the forking bundle's id — a subject naming only the " +
          "upstream would announce the first forker and swallow every one after",
      ).toEqual({ slug: "ac2-up", fork: fork.id });
    });

    it("AC2: and nothing at all when the upstream author has fork mail OFF", async () => {
      const author = await seedAccount("ac2-off-author");
      const forker = await seedAccount("ac2-off-forker");
      await seedUpstream(author, "ac2-off-up");
      await setPreferences(db, actorFor(author), author, { fork: false });

      await forkBundle(
        db,
        actorFor(forker),
        { ownerHandle: "ac2-off-author", slug: "ac2-off-up", version: "1.0.0" },
        { slug: "ac2-off-fork", visibility: "public" },
      );
      expect(await queueRows()).toHaveLength(0);
    });

    it("TWO forkers of one upstream produce TWO rows, which is what `subject.fork` buys", async () => {
      const author = await seedAccount("two-author");
      const one = await seedAccount("two-one");
      const other = await seedAccount("two-other");
      await seedUpstream(author, "two-up");

      for (const [forker, slug] of [[one, "two-a"], [other, "two-b"]] as const) {
        await forkBundle(
          db,
          actorFor(forker),
          { ownerHandle: "two-author", slug: "two-up", version: "1.0.0" },
          { slug, visibility: "public" },
        );
      }

      expect(
        await queueRows(author),
        "the unique key is `(kind, account_id, subject_digest)`. Without the fork's own id in " +
          "the subject these two collide and the second forker is silently swallowed.",
      ).toHaveLength(2);
    });
  });

  /* ─────────────── AC6 and D-190-06 ─────────────── */

  describe("AC6 — a working unsubscribe, and D-190-06's token gate", () => {
    /** Enqueue one fork event and drain it, answering what the seam recorded. */
    async function enqueueAndDrain(accountId: string): Promise<RecordingDelivery> {
      await enqueue(db, { kind: "fork", accountId, subject: { slug: "s", fork: "f" } });
      const delivery = new RecordingDelivery();
      await deliverPending(db, delivery);
      return delivery;
    }

    it("the mail carries a token that turns the matching preference off, and only it", async () => {
      const account = await seedAccount("ac6-round");
      const delivery = await enqueueAndDrain(account);
      expect(delivery.sent).toHaveLength(1);

      const { kind } = await unsubscribe(db, delivery.sent[0]!.unsubscribeToken);
      expect(kind, "AC6: it names the KIND, never the account id").toBe("fork");

      const after = await getPreferences(db, actorFor(account), account);
      expect(after.fork, "the matching preference is off").toBe(false);
      expect(
        { repin: after.repin, deprecation: after.deprecation, digest: after.digest },
        "AC6: and nothing else moved",
      ).toEqual({ repin: true, deprecation: true, digest: false });
    });

    it("SETS false rather than toggling — spending a link while the preference is ALREADY off leaves it off", async () => {
      const account = await seedAccount("ac6-toggle");
      const delivery = await enqueueAndDrain(account);
      const token = delivery.sent[0]!.unsubscribeToken;

      /*
       * **The preference goes off WITHOUT spending the token, and that is the whole cell.**
       *
       * An earlier version of this drove unsubscribe, re-subscribed, then unsubscribed again —
       * and was VACUOUS: toggling from `true` and setting `false` give the same answer, so it
       * reddened 0 of 42 under a mutation that made `clearPreference` a toggle. The subject's
       * state agreed with the expected value, which is the shape that cannot discriminate.
       *
       * Reaching `unsubscribe` with the matching preference ALREADY false is the only state
       * that separates them, and `setPreferences` is the only way to get there: `enqueue` is
       * preference-gated, so no later event can mint a second token while the kind is off.
       */
      await setPreferences(db, actorFor(account), account, { fork: false });

      await unsubscribe(db, token);
      expect(
        (await getPreferences(db, actorFor(account), account)).fork,
        "D-190-03: `unsubscribe` SETS false and never toggles. A toggle would read `false` here " +
          "and flip it back to `true` — RE-SUBSCRIBING somebody who just clicked an unsubscribe " +
          "link, which is the one outcome the link must never produce.",
      ).toBe(false);
    });

    it("a spent token is refused with the published sentence, which quotes no token", async () => {
      const account = await seedAccount("ac6-spent");
      const delivery = await enqueueAndDrain(account);
      const token = delivery.sent[0]!.unsubscribeToken;
      await unsubscribe(db, token);

      let thrown: unknown;
      try {
        await unsubscribe(db, token);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(UnsubscribeInvalidError);
      expect((thrown as Error).message).toBe("unsubscribe: this link is no longer valid.");
      expect(
        (thrown as Error).message.includes(token),
        "the presented token is caller data and must never be echoed into a rendering",
      ).toBe(false);
    });

    it("an unknown token is refused the SAME way — no oracle over which strings were ever real", async () => {
      await expect(unsubscribe(db, "not-a-token-anybody-minted")).rejects.toThrow(
        "unsubscribe: this link is no longer valid.",
      );
    });

    it("D-190-06: unsubscribe then drain delivers NOTHING for that pair", async () => {
      const account = await seedAccount("d06-strand");
      /* Two events, so the queue is non-empty when the token dies. The first is drained to get
         a token in hand; the second is left PENDING. */
      const first = await enqueueAndDrain(account);
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s2", fork: "f2" } });
      expect((await queueRows(account)).filter((r) => r.deliveredAt === null)).toHaveLength(1);

      await unsubscribe(db, first.sent[0]!.unsubscribeToken);

      const after = new RecordingDelivery();
      const count = await deliverPending(db, after);
      expect(
        count,
        "D-190-06: the token's existence IS the delivery capability. The pending row survives " +
          "the unsubscribe, and mailing it would be mailing somebody who said no.",
      ).toBe(0);
      expect(after.sent).toHaveLength(0);
      expect(
        (await queueRows(account)).filter((r) => r.deliveredAt === null),
        "and it is STRANDED, not deleted — pruning would destroy an idempotency key for an " +
          "event that genuinely happened",
      ).toHaveLength(1);
    });

    it("D-190-06: the re-mint chain delivers the stranded row exactly once", async () => {
      const account = await seedAccount("d06-remint");
      const first = await enqueueAndDrain(account);
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s2", fork: "f2" } });
      await unsubscribe(db, first.sent[0]!.unsubscribeToken);

      /* The full chain the ruling records: re-subscribe (enqueue is preference-gated, so
         nothing re-mints before this), then a NEW event, which re-mints the token. */
      await setPreferences(db, actorFor(account), account, { fork: true });
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s3", fork: "f3" } });

      const after = new RecordingDelivery();
      await deliverPending(db, after);
      const forks = after.sent.map((m) => m.subject["fork"]).sort();
      expect(
        forks,
        "the stranded row and the new one, each exactly once — the mail reaches a re-subscribed " +
          "account, which D-190-06 accepts even though the event predates the re-subscription",
      ).toEqual(["f2", "f3"]);
    });

    it("D-190-12 / F2: two concurrent unsubscribes on DIFFERENT kinds both land, 5 of 5", async () => {
      /*
       * The adversary's second measured shape, and the worst state in the module: both tokens
       * were consumed while only one flip survived, so a reader was left with **no link and the
       * mail still coming** — 4 of 5 runs before the fix. Driven five times for the same reason.
       *
       * `fork` and `repin` are different kinds, so the two tokens are different rows and the
       * DELETEs never contend. Everything that contends is the account row, which is exactly
       * where the lock had to go.
       */
      for (let round = 0; round < 5; round += 1) {
        const account = await seedAccount(`f2-unsub-${round}`);
        await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s", fork: "f" } });
        await enqueue(db, { kind: "repin", accountId: account, subject: { cardId: "c", version: "1" } });
        const mail = new RecordingDelivery();
        await deliverPending(db, mail);
        const tokenOf = (kind: string): string =>
          mail.sent.find((m) => m.kind === kind)!.unsubscribeToken;
        await warmPool();

        await Promise.all([unsubscribe(db, tokenOf("fork")), unsubscribe(db, tokenOf("repin"))]);

        const after = await getPreferences(db, actorFor(account), account);
        expect(
          { fork: after.fork, repin: after.repin },
          `round ${round}: BOTH tokens were spent, so both preferences must be off. Losing one ` +
            `flip here is the worst state in the module — a reader with no unsubscribe link left ` +
            `and the mail still arriving, which is AC6's "working" failing at its own moment.`,
        ).toEqual({ fork: false, repin: false });
        expect(after.deprecation, "and nothing else moved").toBe(true);
      }
    }, 120_000);

    it("D-190-07(2): a preference write NEVER deletes a token — mint ON, set OFF, spend it", async () => {
      const account = await seedAccount("d07-2");
      const delivery = await enqueueAndDrain(account);
      const token = delivery.sent[0]!.unsubscribeToken;

      /* The sanctioned discriminating fixture. An implementation that pruned tokens on a
         preference write would kill every outstanding link whenever the reader changed any
         setting, and this spend would answer "no longer valid". */
      await setPreferences(db, actorFor(account), account, { fork: false, digest: true });

      await expect(unsubscribe(db, token)).resolves.toEqual({ kind: "fork" });
    });
  });

  /* ─────────────── AC5's delivery half ─────────────── */

  describe("AC5 — a fan-out failure retries without delivering twice", () => {
    it("a fake failing on row 2 of 3 delivers 1 and 3, then 2, each exactly once overall", async () => {
      const account = await seedAccount("ac5-drain");
      for (const fork of ["f1", "f2", "f3"]) {
        await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s", fork } });
        /* Sequential and distinct, so `created_at` orders them and the "row 2" below is the
           one this cell means. */
      }

      const flaky = new RecordingDelivery((m) => m.subject["fork"] === "f2");
      const firstCount = await deliverPending(db, flaky);
      expect(firstCount, "one refusal must not stop the pass").toBe(2);
      expect(flaky.sent.map((m) => m.subject["fork"]).sort()).toEqual(["f1", "f3"]);

      const second = new RecordingDelivery();
      const secondCount = await deliverPending(db, second);
      expect(secondCount).toBe(1);
      expect(
        second.sent.map((m) => m.subject["fork"]),
        "AC5: the retry delivers only what failed. An early return on the first refusal would " +
          "re-send f1 and f3 here, which is the double delivery the criterion names.",
      ).toEqual(["f2"]);

      const stamped = (await queueRows(account)).filter((r) => r.deliveredAt !== null);
      expect(stamped, "all three end delivered, each stamped once").toHaveLength(3);
    });

    it("D-190-09: two CONCURRENT drains send the pending set exactly once, and one answers 0", async () => {
      const account = await seedAccount("ac5-concurrent");
      for (const fork of ["c1", "c2", "c3"]) {
        await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s", fork } });
      }

      await warmPool();

      const first = new RecordingDelivery();
      const second = new RecordingDelivery();
      const [a, b] = await Promise.all([deliverPending(db, first), deliverPending(db, second)]);

      expect(
        [a, b].sort((x, y) => x - y),
        "D-190-09: one drain does the pass, the other finds the try-lock taken and answers 0. " +
          "Without the lock both read the same pending set and both send all three.",
      ).toEqual([0, 3]);
      expect(
        [...first.sent, ...second.sent].map((m) => m.subject["fork"]).sort(),
        "total sends across BOTH calls equal the pending set exactly once",
      ).toEqual(["c1", "c2", "c3"]);
    });

    it("the lock is released, so a drain AFTER a concurrent pair still works", async () => {
      const account = await seedAccount("ac5-lockfree");
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s", fork: "l1" } });
      await Promise.all([deliverPending(db, new RecordingDelivery()), deliverPending(db, new RecordingDelivery())]);

      /* The falsification that matters for a lock: a transaction-scoped lock cannot leak, but a
         SESSION-scoped one taken and released on different pooled connections would wedge here
         forever. This cell is what tells those two implementations apart. */
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s", fork: "l2" } });
      const after = new RecordingDelivery();
      expect(await deliverPending(db, after)).toBe(1);
      expect(after.sent[0]!.subject["fork"]).toBe("l2");
    });

    it("a delivered row is never handed to the seam again", async () => {
      const account = await seedAccount("ac5-once");
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s", fork: "f" } });
      await deliverPending(db, new RecordingDelivery());

      const again = new RecordingDelivery();
      expect(await deliverPending(db, again)).toBe(0);
      expect(again.sent).toHaveLength(0);
    });
  });

  /* ─────────────── the repin fan-out ─────────────── */

  describe("enqueueRepinEvents (D-190-04)", () => {
    async function seedPinning(owner: string, slug: string, visibility: "public" | "private", refs: string[]): Promise<void> {
      const bundle = await createBundle(db, { ownerId: owner, slug, visibility });
      await addRelease(db, {
        bundleId: bundle.id,
        version: "1.0.0",
        dot: "digraph{}",
        manifest: manifestFor(slug),
        cardRefs: refs,
        cardDigests: refs.map(() => "sha256:aa"),
      });
    }

    it("reaches every account pinning ANY version, private bundles included", async () => {
      const pinnerPublic = await seedAccount("rp-public");
      const pinnerPrivate = await seedAccount("rp-private");
      const unrelated = await seedAccount("rp-unrelated");
      await seedPinning(pinnerPublic, "rp-a", "public", ["solver-a@1.0.0"]);
      /* A DIFFERENT version of the same card — the grain is any version (D-190-04), which is
         deliberately not `lifecycle`'s exact-ref grain one file over. */
      await seedPinning(pinnerPrivate, "rp-b", "private", ["solver-a@0.9.0"]);
      await seedPinning(unrelated, "rp-c", "public", ["other-card@1.0.0"]);

      await enqueueRepinEvents(db, "solver-a", "2.0.0");

      expect(await queueRows(pinnerPublic)).toHaveLength(1);
      expect(
        await queueRows(pinnerPrivate),
        "the recipient is the pinner themselves, so AC1's invisibility rule is not in play",
      ).toHaveLength(1);
      expect(
        await queueRows(unrelated),
        "`split_part(ref,'@',1)` is an EXACT comparison — a prefix LIKE would have matched " +
          "nothing here either, but would over-match a card id that was a prefix of another",
      ).toHaveLength(0);
    });

    it("carries D-190-07's `{ cardId, version }`, the BARE id and never a ref", async () => {
      const pinner = await seedAccount("rp-shape");
      await seedPinning(pinner, "rp-shape-b", "public", ["solver-a@1.0.0"]);
      await enqueueRepinEvents(db, "solver-a", "2.0.0");

      const rows = await queueRows(pinner);
      expect(rows[0]!.subject).toEqual({ cardId: "solver-a", version: "2.0.0" });
    });

    it("an account pinning the card in TWO bundles gets ONE row", async () => {
      const pinner = await seedAccount("rp-dup");
      await seedPinning(pinner, "rp-dup-a", "public", ["solver-a@1.0.0"]);
      await seedPinning(pinner, "rp-dup-b", "public", ["solver-a@1.1.0"]);
      await enqueueRepinEvents(db, "solver-a", "2.0.0");
      expect(
        await queueRows(pinner),
        "one recipient, one row. `selectDistinct` in `accountsPinningCard` is what collapses the " +
          "two bundles to one owner, so only ONE insert is attempted — the unique key is a " +
          "second line of defence here and is never reached.",
      ).toHaveLength(1);
      /* The attribution above is measured, not assumed: removing `onConflictDoNothing` reds the
         two-spellings and concurrent-callers cells and leaves THIS one green, which is what says
         the collapse happens one level earlier than the constraint. The comment used to credit
         the unique key and was wrong about its own mechanism. */
    });

    it("D-190-09(2): the PUBLISHER is excluded from its own repin fan-out", async () => {
      const publisher = await seedAccount("rp-publisher");
      const other = await seedAccount("rp-other");
      await seedPinning(publisher, "rp-pub", "public", ["solver-a@1.0.0"]);
      await seedPinning(other, "rp-oth", "public", ["solver-a@1.0.0"]);

      await enqueueRepinEvents(db, "solver-a", "2.0.0", publisher);

      expect(
        await queueRows(publisher),
        "an account that pins a card and then publishes its new version already knows",
      ).toHaveLength(0);
      expect(
        await queueRows(other),
        "and the exclusion is targeted — everybody else still hears about it",
      ).toHaveLength(1);
    });

    it("omitting the publisher notifies every pinner, so the filter is inert until wired", async () => {
      const pinner = await seedAccount("rp-nopub");
      await seedPinning(pinner, "rp-nopub-b", "public", ["solver-a@1.0.0"]);
      /* The third control D-190-09(2) needs: without it, "the publisher got nothing" is equally
         true of an implementation that notifies nobody. */
      await enqueueRepinEvents(db, "solver-a", "2.0.0");
      expect(await queueRows(pinner)).toHaveLength(1);
    });

    it("the published arity is 3 — `= undefined`, not `?`", () => {
      expect(
        enqueueRepinEvents.length,
        "the ruled spelling is `publisherAccountId: string | undefined = undefined`. A `?` " +
          "erases at compile time with no default emitted, which leaves this at 4.",
      ).toBe(3);
    });

    it("two versions of one card are two rows", async () => {
      const pinner = await seedAccount("rp-versions");
      await seedPinning(pinner, "rp-v", "public", ["solver-a@1.0.0"]);
      await enqueueRepinEvents(db, "solver-a", "2.0.0");
      await enqueueRepinEvents(db, "solver-a", "2.1.0");
      expect(await queueRows(pinner)).toHaveLength(2);
    });
  });

  /* ─────────────── the migration ─────────────── */

  describe("0005_notifications rolls back on its own and re-applies", () => {
    /**
     * A database of this suite's OWN, because this cell rolls a migration back and the shared
     * `testDb` above is what every other cell here is standing on.
     *
     * The property is T005's, not mine: `t005Migrations` is every applied id except
     * `0001_init` (`tests/server/t005/harness.ts:359`), so `reversibility.test.ts` will roll
     * `0005` back STEPWISE at the merge. Measuring it here means finding out now rather than
     * inside somebody else's suite.
     */
    it("down drops exactly its own three objects and leaves the base tables standing", async () => {
      const own = await createTestDb();
      try {
        const objects = async (): Promise<{ tables: string[]; types: string[] }> => {
          const t = await own.client.query(
            `select table_name from information_schema.tables where table_schema = 'public'`,
          );
          const y = await own.client.query(
            `select typname from pg_type where typnamespace = 'public'::regnamespace and typtype = 'e'`,
          );
          return {
            tables: t.rows.map((r) => String(r["table_name"])).sort(),
            types: y.rows.map((r) => String(r["typname"])).sort(),
          };
        };

        const before = await objects();
        /* The premise. Without it the disappearance below could be of something that was never
           there, and the cell would pass against a migration that created nothing. */
        expect(before.tables).toContain("notification_queue");
        expect(before.tables).toContain("unsubscribe_token");
        expect(before.types).toContain("notification_kind");

        /* Stepwise until THIS migration comes off, rather than `migrateDown(pool, 1)`.
           The single step was correct while `0005` was the newest migration and became
           wrong the moment `0006_identities` landed on top of it — the assertion was
           encoding "mine is last", which is a fact about the calendar rather than about
           this migration. Rolling until the id appears keeps the criterion (0005 comes off
           cleanly, stepwise, and takes only its own objects) and survives every migration
           added after it. */
        const rolled: string[] = [];
        while (!rolled.includes("0005_notifications")) {
          const step = await migrateDown(own.client.pool, 1);
          expect(step, "each step rolls back exactly one migration").toHaveLength(1);
          rolled.push(...step);
        }
        expect(rolled.at(-1), "and the last one off is mine").toBe("0005_notifications");

        const after = await objects();
        expect(after.tables).not.toContain("notification_queue");
        expect(after.tables).not.toContain("unsubscribe_token");
        expect(after.types).not.toContain("notification_kind");

        /* The half that a `DROP ... CASCADE` would fail. `reversibility.test.ts` reds a down
           script that reaches past the migration owning it, and the ten base tables are what it
           would reach into. */
        for (const base of ["account", "bundle", "release", "card_version", "audit"]) {
          expect(after.tables, `${base} is base's and this rollback must not touch it`).toContain(base);
        }
        expect(
          after.tables.filter((t) => !before.tables.includes(t)),
          "and it added nothing either",
        ).toEqual([]);

        /* Everything that came off goes back on, newest last — the mirror of the loop
           above, and named the same way rather than by count, for the same reason. */
        const reapplied = await migrateUp(own.client.pool);
        expect(reapplied.sort(), "exactly what was rolled back, and nothing else").toEqual(
          [...rolled].sort(),
        );
        expect(await objects(), "re-applying restores exactly the same schema").toEqual(before);
      } finally {
        await own.drop();
      }
    }, 120_000);
  });

  /* ─────────────── the schema itself ─────────────── */

  describe("the extension is what the migration claims", () => {
    it("the unique key REFUSES a duplicate at the driver, not merely in the writer", async () => {
      const account = await seedAccount("uniq");
      const values = {
        kind: "fork" as const,
        accountId: account,
        subject: { a: "b" },
        subjectDigest: "sha256:deadbeef",
      };
      await db.insert(schema.notificationQueue).values(values);

      /* Direct inserts, bypassing `enqueue` entirely: the criterion is that the CONSTRAINT
         holds, not that my writer remembers to check. A caller-side guard leaves every other
         writer's path open. */
      let code: string | undefined;
      try {
        await db.insert(schema.notificationQueue).values(values);
      } catch (err) {
        code = (err as { cause?: { code?: string }; code?: string }).cause?.code
          ?? (err as { code?: string }).code;
      }
      expect(code, "23505 is unique_violation — the refusal comes from storage").toBe("23505");
    });

    it("one token per (account, kind), and different kinds coexist", async () => {
      const account = await seedAccount("tok");
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s", fork: "f" } });
      await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s2", fork: "f2" } });
      await enqueue(db, { kind: "repin", accountId: account, subject: { cardId: "c", version: "1" } });

      const tokens = await db
        .select({ kind: schema.unsubscribeToken.kind })
        .from(schema.unsubscribeToken)
        .where(eq(schema.unsubscribeToken.accountId, account));
      expect(
        tokens.map((t) => t.kind).sort(),
        "two fork events share one link; a different kind gets its own",
      ).toEqual(["fork", "repin"]);
    });

    it("the pending partial index exists and covers the drain's own predicate", async () => {
      const rows = await db.execute(
        sql`select indexdef from pg_indexes where indexname = 'notification_queue_pending_idx'`,
      );
      const found = (rows as unknown as { rows?: { indexdef: string }[] }).rows
        ?? (rows as unknown as { indexdef: string }[]);
      expect(found, "the index the drain relies on must exist").toHaveLength(1);
      expect(String(found[0]!.indexdef)).toContain("delivered_at IS NULL");
    });

    it("a queue row for an account requires that account to exist", async () => {
      let code: string | undefined;
      try {
        await db.insert(schema.notificationQueue).values({
          kind: "fork",
          accountId: "00000000-0000-0000-0000-000000000000",
          subject: {},
          subjectDigest: "sha256:x",
        });
      } catch (err) {
        code = (err as { cause?: { code?: string }; code?: string }).cause?.code
          ?? (err as { code?: string }).code;
      }
      expect(code, "23503 is foreign_key_violation").toBe("23503");
    });
  });

  /* ─────────────── D-13 ─────────────── */

  describe("D-13 — no rejection carries a statement, a parameter, or an address", () => {
    it("a store fault names the operation and nothing else, and renders as {}", async () => {
      const account = await seedAccount("hygiene");
      await db
        .update(schema.account)
        .set({ email: "someone@example.test" })
        .where(eq(schema.account.id, account));

      /* Force a driver fault inside the module by pointing it at a dropped table. Nothing else
         reaches a real `DrizzleQueryError` through these verbs. */
      await db.execute(sql`alter table "notification_queue" rename to "notification_queue_hidden"`);
      let thrown: unknown;
      try {
        await enqueue(db, { kind: "fork", accountId: account, subject: { slug: "s", fork: "f" } });
      } catch (err) {
        thrown = err;
      } finally {
        await db.execute(sql`alter table "notification_queue_hidden" rename to "notification_queue"`);
      }

      const message = String((thrown as Error | undefined)?.message ?? "");
      expect(message).toBe("enqueue: the notification store failed.");
      expect(message.includes("select"), "no statement").toBe(false);
      expect(message.includes("insert"), "no statement").toBe(false);
      expect(message.includes("@example.test"), "no address, ever").toBe(false);
      expect(Object.keys(thrown as object), "D-13's hygiene clause").toEqual([]);
      expect(JSON.stringify(thrown)).toBe("{}");
      expect((thrown as Error).stack, "the stack is retained").toBeTruthy();
    });
  });
});
