/* ============================================================
   T190 AC5, first half — the queue row IS the idempotency

   D-190-01 is direct about why this file exists:

     "The queue table's unique key is the section's own:
      `(kind, account_id, subject_digest)` with the conflict caught
      — the row IS the idempotency, never a status-plus-counter."

   and about the digest:

     "`subject_digest` is derived from the subject by a stable
      digest over a canonical serialisation (key-sorted), because
      `Record<string, string>` has no canonical byte form of its own
      and two spellings of one subject must collide."

   ── the pool is WARMED before the concurrent cell ──
   A COLD `pg` pool serialises concurrent callers: the first
   `connect` wins and the rest queue behind it, so `Promise.all`
   over an unwarmed pool measures a SEQUENCE and reports it as a
   race. Measured elsewhere in this run at 1 of 8 raced cold against
   24 of 24 warmed. Every call below is issued before any of them is
   awaited, and the pool is warmed first, or the cell has not tested
   AC5 whatever it prints.

   ── the unique key is driven on all THREE of its columns ──
   A cell that only ever repeats one event proves the key exists; it
   does not prove the key is the one the ruling names. A key on
   `subject_digest` alone would collapse two accounts' events into
   one row and pass every repetition cell ever written. So each
   column is varied on its own, and each must produce a SECOND row.

   ── D-190-02(2), the tombstone ──
   Driven through T120's own `deleteAccount` rather than by writing
   the `deleted:` prefix by hand: a tombstone this file forged would
   prove that `enqueue` refuses whatever shape this file invented,
   which is not the claim.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { deleteAccount } from "@/lib/server/lifecycle";
import {
  PINNED_DIGESTS,
  type Scratch,
  bind,
  deferred,
  dropScratchDatabases,
  mark,
  plantAccount,
  queueRows,
  scratchDatabase,
  subjectDigest,
  tokenRows,
  warmPool,
} from "./contract";

const setup = deferred<Scratch>(() => scratchDatabase("idem"));

afterAll(async () => {
  await dropScratchDatabases();
});

/** Two spellings of one subject: the same pairs, written in the opposite order. */
const SUBJECT_A = { slug: "t190-up", fork: "b1" };
const SUBJECT_B = { fork: "b1", slug: "t190-up" };

/** Start every call before awaiting any of them, so they are genuinely in one window. */
function fireAll<T>(calls: readonly (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(calls.map((call) => call()));
}

describe("T190 AC5: two CONCURRENT callers of one event yield one row", () => {
  it("eight concurrent `enqueue` calls on a warmed pool leave exactly one row", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("con").toLowerCase(), { fork: true });

    /* The premise of the whole cell. Without it, `Promise.all` measures a queue. */
    await warmPool(scratch, 8);

    const enqueue = await bind("enqueue");
    const event = { kind: "fork", accountId: account.accountId, subject: SUBJECT_A };

    const settled = await fireAll(
      Array.from({ length: 8 }, () => () => Promise.resolve(enqueue(scratch.db, { ...event }))),
    );

    const rejected = settled.filter((r) => r.status === "rejected");
    expect(
      rejected.map((r) => String((r as PromiseRejectedResult).reason)),
      `AC5: ${rejected.length} of 8 concurrent \`enqueue\` calls REJECTED. D-190-01 requires ` +
        `"an insert whose conflict is CAUGHT" — a raw unique violation reaching the caller is ` +
        `the conflict not being caught, and a fan-out worker would treat it as a failure and ` +
        `retry forever.`,
    ).toEqual([]);

    const rows = await queueRows(scratch, account.accountId);
    expect(
      rows.length,
      `AC5: eight concurrent callers of one event left ${rows.length} rows.\n` +
        `  ${rows.map((r) => `${r.kind} ${r.subjectDigest}`).join("\n  ")}\n` +
        `  The unique key on (kind, account_id, subject_digest) IS the idempotency. A ` +
        `\`SELECT\`-then-\`INSERT\` passes every sequential test and writes several here.`,
    ).toBe(1);

    expect(rows[0]!.subjectDigest).toBe(subjectDigest(SUBJECT_A));
  });

  /**
   * The same claim without concurrency, so a red separates "the key is missing" from "the key
   * is there and the race lost". Both are defects and they have different fixes.
   */
  it("two sequential `enqueue` calls of one event leave exactly one row", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("seq").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    const event = { kind: "fork", accountId: account.accountId, subject: SUBJECT_A };
    await enqueue(scratch.db, { ...event });
    await enqueue(scratch.db, { ...event });

    expect(await queueRows(scratch, account.accountId)).toHaveLength(1);
  });

  /**
   * The collision D-190-02(4) requires, and it is the reason the digest exists at all.
   *
   * `Record<string, string>` has no canonical byte form, so two callers spelling one subject
   * in two key orders would occupy two rows under any digest taken over the raw object.
   */
  it("two SPELLINGS of one subject collide into one row", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("spell").toLowerCase(), { fork: true });

    /* The premise, stated against this suite's externally-pinned digest rather than against
       the module: if these two do not digest alike, the cell below is about something else. */
    expect(subjectDigest(SUBJECT_A)).toBe(subjectDigest(SUBJECT_B));
    expect(subjectDigest(SUBJECT_A)).toBe(PINNED_DIGESTS[0]!.digest);

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject: SUBJECT_A });
    await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject: SUBJECT_B });

    const rows = await queueRows(scratch, account.accountId);
    expect(
      rows.length,
      `AC5: \`${JSON.stringify(SUBJECT_A)}\` and \`${JSON.stringify(SUBJECT_B)}\` are one ` +
        `subject written two ways and left ${rows.length} rows.\n` +
        `  D-190-02(4): \`subject_digest = contentDigest(canonicalJson(subject))\`, and ` +
        `\`canonicalJson\` sorts keys by code unit — so the two spellings are the same bytes. ` +
        `A digest taken over \`JSON.stringify(subject)\` preserves insertion order and stores ` +
        `both.`,
    ).toBe(1);

    expect(
      rows[0]!.subjectDigest,
      `the stored digest is not \`contentDigest(canonicalJson(subject))\`. The expected value ` +
        `here was computed OUTSIDE this repository (\`printf | shasum -a 256\`) and is pinned ` +
        `in \`contract.ts\`, so this compares the module against an authority rather than ` +
        `against itself.`,
    ).toBe(PINNED_DIGESTS[0]!.digest);
  });
});

describe("T190 AC5: the unique key is on all three of its columns", () => {
  /** A different subject is a different event, or the key would collapse unrelated events. */
  it("a different SUBJECT for one kind and account is a second row", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("k-sub").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject: SUBJECT_A });
    await enqueue(scratch.db, {
      kind: "fork",
      accountId: account.accountId,
      subject: { slug: "t190-up", fork: "b2" },
    });

    expect(
      await queueRows(scratch, account.accountId),
      "two DIFFERENT fork events collapsed into one row, so the second author never hears " +
        "about their fork. `exactly one` per event is not `at most one` per kind.",
    ).toHaveLength(2);
  });

  /** A different kind is a different event: the key's first column. */
  it("a different KIND for one account and subject is a second row", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("k-kind").toLowerCase(), {
      fork: true,
      repin: true,
    });

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject: SUBJECT_A });
    await enqueue(scratch.db, { kind: "repin", accountId: account.accountId, subject: SUBJECT_A });

    expect(
      (await queueRows(scratch, account.accountId)).map((r) => r.kind).sort(),
      "the unique key is not keyed on `kind`, so one subject can only ever produce one " +
        "notification whatever happened to it.",
    ).toEqual(["fork", "repin"]);
  });

  /**
   * A different account is a different event: the key's second column, and the one whose
   * absence leaks. A key on `(kind, subject_digest)` alone would silently drop the second
   * recipient of any event that reaches two people.
   */
  it("a different ACCOUNT for one kind and subject is a second row", async () => {
    const scratch = await setup.require();
    const one = await plantAccount(scratch, mark("k-a1").toLowerCase(), { fork: true });
    const two = await plantAccount(scratch, mark("k-a2").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, { kind: "fork", accountId: one.accountId, subject: SUBJECT_A });
    await enqueue(scratch.db, { kind: "fork", accountId: two.accountId, subject: SUBJECT_A });

    expect(await queueRows(scratch, one.accountId), "the first account lost its row").toHaveLength(1);
    expect(
      await queueRows(scratch, two.accountId),
      "one subject reached two accounts and only one row exists, so the unique key is not " +
        "keyed on `account_id` and the second recipient is never told.",
    ).toHaveLength(1);
  });
});

describe("T190: the token is minted once per (account, kind) — D-190-03", () => {
  it("re-enqueuing one kind reuses the token rather than minting a second", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("tok").toLowerCase(), {
      fork: true,
      repin: true,
    });

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject: SUBJECT_A });
    await enqueue(scratch.db, {
      kind: "fork",
      accountId: account.accountId,
      subject: { slug: "t190-up", fork: "b2" },
    });

    const tokens = await tokenRows(scratch, account.accountId);
    expect(
      tokens.filter((t) => t.kind === "fork"),
      `two fork events for one account left ${tokens.length} token row(s).\n` +
        `  D-190-03: "\`enqueue\` ensures a token row per (account_id, kind) — the unique pair ` +
        `means re-enqueue reuses it". The published table carries \`UNIQUE (account_id, kind)\`.`,
    ).toHaveLength(1);

    /* And a second KIND does get its own, or one unsubscribe would silence all four. */
    await enqueue(scratch.db, { kind: "repin", accountId: account.accountId, subject: SUBJECT_A });
    const after = await tokenRows(scratch, account.accountId);
    expect(
      after.map((t) => t.kind).sort(),
      "a second kind did not mint its own token. AC6's unsubscribe `flips the matching " +
        "preference and nothing else`, which is only possible if the token names one kind.",
    ).toEqual(["fork", "repin"]);
  });
});

describe("T190: `enqueue` writes nothing for a tombstoned account — D-190-02(2)", () => {
  /**
   * The D1 silence both halves flagged, closed at the source.
   *
   * T120 scrubs `notification_preferences` to `{}` on deletion, and `{}` fills from
   * `DEFAULT_PREFERENCES` — so a tombstoned account reads as subscribed to three of the four
   * kinds and would collect queue rows for a person who deleted their account and whose email
   * column is `null`. The tombstone is made by T120's own `deleteAccount`, not forged here.
   */
  it("an account T120 has tombstoned collects no rows", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("tomb").toLowerCase(), {});

    await deleteAccount(scratch.db, account.actor, account.accountId);

    /* The premise: T120 really tombstoned it, and it really reads as subscribed. */
    const [row] = await scratch.query(
      "select github_id, email, notification_preferences as prefs from account where id = $1",
      [account.accountId],
    );
    expect(
      String(row?.github_id ?? ""),
      "T120 did not tombstone this account, so the cell below is about a live one.",
    ).toMatch(/^deleted:/u);
    expect(row?.email, "the tombstone kept an address; D-120-01 B3 scrubs it").toBeNull();
    expect(
      row?.prefs,
      "the tombstone did not blank the preferences, so the `{}`-reads-as-subscribed hazard " +
        "this cell is about does not arise and the cell proves less than it claims.",
    ).toEqual({});

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject: SUBJECT_A });

    expect(
      await queueRows(scratch, account.accountId),
      `D-190-02(2): "\`enqueue\` writes NOTHING for an account T120's deletion has ` +
        `tombstoned". A queue row for an account that can never be mailed is garbage by ` +
        `construction — the account's \`email\` is \`null\` and its \`{}\` preferences read as ` +
        `subscribed to three of the four kinds through \`DEFAULT_PREFERENCES\`.`,
    ).toEqual([]);

    expect(
      await tokenRows(scratch, account.accountId),
      "no row was queued and a token was minted anyway, which leaves a live unsubscribe link " +
        "pointing at a grave.",
    ).toEqual([]);
  });
});
