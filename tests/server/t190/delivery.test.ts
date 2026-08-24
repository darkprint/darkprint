/* ============================================================
   T190 AC5 second half, and AC3 — the drain

   D-190-02 names the fixture exactly:

     "the delivery half — a recording fake that fails on row 2 of 3,
      then a second `deliverPending`, delivers rows 1 and 3 exactly
      once and row 2 exactly once overall (stamp on the delivery's
      own resolution)."

   ── the fake fails on a SUBJECT, not on a call index ──
   The ruling says "row 2 of 3", and this file drives it as "the row
   carrying a chosen subject". The substance is identical and the
   determinism is not: three rows queued back to back share a
   `created_at` to the microsecond often enough to matter, and the
   tiebreaker is a random uuid, so "the second row" is not a
   well-defined object and "the second CALL" is a claim about an
   iteration order the contract never published. Failing on a
   subject this file chose makes the cell say the same thing without
   resting on either.

   ── a delivery is a RESOLUTION ──
   D-190-02's own parenthesis. `instruments.test.ts` drives the fake
   against both shapes and requires it to tell a throwing send from
   a resolving one, because a fake that counted CALLS would score
   the failed attempt as a delivery and make AC5 unfalsifiable.

   ── AC3 is narrowed to CARRIAGE, and that is a ruling ──
   D-190-04: "the recipient is UNDERIVABLE and that is ruled, not
   deferred — no term-to-account mapping exists anywhere, so
   `enqueue` takes the caller's `accountId` and AC3 is narrowed to
   subject carriage." So these cells assert that `replacedBy`
   arrives at the seam intact, and assert nothing about who was
   chosen to receive it. The recipient derivation is recorded as
   impossible; a cell asserting one would be inventing a criterion.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  bind,
  deferred,
  deliveredCountFor,
  describe_,
  dropScratchDatabases,
  mark,
  plantAccount,
  queueRows,
  recordingDelivery,
  scratchDatabase,
  subjectDigest,
  tokenRows,
} from "./contract";

const setup = deferred<Scratch>(() => scratchDatabase("deliver"));

afterAll(async () => {
  await dropScratchDatabases();
});

/** D-190-07's ruled fork subject: the upstream's slug, and the FORKING bundle's id. */
const THREE = [
  { slug: "t190-up", fork: "b1" },
  { slug: "t190-up", fork: "b2" },
  { slug: "t190-up", fork: "b3" },
];

/** The one of the three the fake refuses. */
const DOOMED = THREE[1]!;

describe("T190 AC5: a fan-out failure retries without delivering twice", () => {
  it("one of three fails, a second drain finishes it, and every row is delivered exactly once", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("drain").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    for (const subject of THREE) {
      await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject });
    }

    /* The premise: three rows, none delivered. Without it a green below could be three rows
       that were already drained, or one row the enqueue collapsed. */
    const queued = await queueRows(scratch, account.accountId);
    expect(
      queued,
      "the fixture did not queue three distinct rows, so the retry cell is about something else",
    ).toHaveLength(3);
    expect(
      queued.map((r) => r.deliveredAt),
      "a freshly queued row already carries a `delivered_at`",
    ).toEqual([null, null, null]);

    const doomedDigest = subjectDigest(DOOMED);
    const first = recordingDelivery((_n, message) => subjectDigest(message.subject) === doomedDigest);

    const deliverPending = await bind("deliverPending");
    /* D-190-08(5) settles what this line may assume: "`deliverPending` swallows a per-row seam
       failure and CONTINUES: the pending row IS the durable record, the returned count says how
       many went, and a permanently-refusing recipient shows up as a row that never drains."
       So the drain RESOLVES, and it resolves to the number that actually went. This was hedged
       with a `.catch` before the ruling; hedging is now a weakened assertion. */
    const reported = await deliverPending(scratch.db, first.delivery);

    expect(
      reported,
      `D-190-08(5): a seam failure on one row is swallowed and the drain continues, and "the ` +
        `returned count says how many went". It answered ${describe_(reported)} with one of ` +
        `three rows refusing.\n` +
        `  The count must EXCLUDE the failed row: the observability of a permanently-refusing ` +
        `recipient "is the count plus the cursor, not a message", so a count that included it ` +
        `would make that state unobservable by the only instrument published for it.`,
    ).toBe(2);

    expect(
      first.delivered.length,
      `the first drain delivered ${first.delivered.length} of the two deliverable rows.\n` +
        `  attempted: ${JSON.stringify(first.attempts.map((m) => m.subject))}\n` +
        `  A drain that stops at the first failure leaves the other rows unsent forever if the ` +
        `same row keeps failing; a drain that carries on delivers both.`,
    ).toBe(2);

    /* What the writer LEFT BEHIND, which is the half a `rejects.toThrow()` cannot see. */
    const afterFirst = await queueRows(scratch, account.accountId);
    const doomedRow = afterFirst.find((r) => r.subjectDigest === doomedDigest);
    expect(
      doomedRow?.deliveredAt,
      `the row whose send THREW was stamped \`delivered_at\` anyway. D-190-02(3) makes ` +
        `\`delivered_at\` the drain cursor, so stamping a failed send retires the row and the ` +
        `notification is lost silently — which is the opposite of AC5's "retries".`,
    ).toBeNull();
    for (const row of afterFirst.filter((r) => r.subjectDigest !== doomedDigest)) {
      expect(
        row.deliveredAt,
        `a row that was delivered was not stamped, so the second drain will send it again — ` +
          `which is AC5's "delivering twice".`,
      ).not.toBeNull();
    }

    /* The retry. A fresh recorder, so what it sees is what the SECOND drain did. */
    const second = recordingDelivery();
    await deliverPending(scratch.db, second.delivery);

    expect(
      second.delivered.map((m) => subjectDigest(m.subject)),
      `AC5: the second drain delivered ${second.delivered.length} row(s); exactly one was ` +
        `still pending.\n` +
        `  delivered: ${JSON.stringify(second.delivered.map((m) => m.subject))}\n` +
        `  Anything above one is a row delivered twice; anything below one is the failed row ` +
        `never retried. D-190-02(3): rows are RETAINED and \`delivered_at\` is the cursor, so ` +
        `a drain that re-reads everything and re-sends it is the failure this cell exists for.`,
    ).toEqual([doomedDigest]);

    /* And the whole-run claim, which is the criterion in its own words. */
    for (const subject of THREE) {
      const total =
        deliveredCountFor(first, "fork", subject) + deliveredCountFor(second, "fork", subject);
      expect(
        total,
        `AC5: \`${JSON.stringify(subject)}\` was delivered ${total} time(s) across both ` +
          `drains; the criterion is exactly once overall.`,
      ).toBe(1);
    }

    const finished = await queueRows(scratch, account.accountId);
    expect(
      finished,
      "D-190-02(3): rows are RETAINED after delivery. A drain that DELETES them turns the " +
        "unique key into a per-window guarantee and the same event becomes enqueueable again.",
    ).toHaveLength(3);
    expect(finished.every((r) => r.deliveredAt !== null)).toBe(true);
  });

  it("a third drain with nothing pending delivers nothing", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("drain2").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, {
      kind: "fork",
      accountId: account.accountId,
      subject: THREE[0]!,
    });

    const deliverPending = await bind("deliverPending");
    const first = recordingDelivery();
    await deliverPending(scratch.db, first.delivery);
    expect(first.delivered, "nothing was delivered on the first drain").toHaveLength(1);

    const again = recordingDelivery();
    await deliverPending(scratch.db, again.delivery);

    expect(
      again.attempts,
      `AC5: a second drain over an already-delivered queue ATTEMPTED ` +
        `${again.attempts.length} send(s). The row is retained by D-190-02(3) and its ` +
        `\`delivered_at\` is what keeps it out of the next drain; a drain that reads every row ` +
        `re-sends every notification the registry has ever produced, every time it runs.`,
    ).toEqual([]);
  });

  it("`deliverPending` answers how many it delivered", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("count").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    for (const subject of THREE) {
      await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject });
    }

    const recorder = recordingDelivery();
    const deliverPending = await bind("deliverPending");
    const answered = await deliverPending(scratch.db, recorder.delivery);

    expect(
      answered,
      `\`deliverPending\` answered ${describe_(answered)}; the block publishes ` +
        `\`Promise<number>\`.`,
    ).toBe(recorder.delivered.length);
    expect(answered).toBe(3);
  });

  it("`limit` bounds one drain and leaves the rest pending", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("limit").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    for (const subject of THREE) {
      await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject });
    }

    const recorder = recordingDelivery();
    const deliverPending = await bind("deliverPending");
    const answered = await deliverPending(scratch.db, recorder.delivery, 2);

    expect(
      answered,
      `\`deliverPending(db, delivery, 2)\` answered ${describe_(answered)} over three pending ` +
        `rows. The block publishes \`limit: number | undefined = undefined\`, which is a bound ` +
        `on one drain and not a suggestion — an unbounded fan-out is the shape a scheduled job ` +
        `cannot pace.`,
    ).toBe(2);
    expect(recorder.delivered).toHaveLength(2);

    const rest = await queueRows(scratch, account.accountId);
    expect(
      rest.filter((r) => r.deliveredAt === null),
      "a limited drain stamped rows it did not deliver, which loses them.",
    ).toHaveLength(1);
  });
});

describe("T190 AC3: a deprecation carries the successor id when one exists", () => {
  /** `replacedBy` is `lib/server/ontology/input.ts`'s own spelling, consumed rather than coined. */
  it("`replacedBy` reaches the delivery seam intact", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("dep-yes").toLowerCase(), {
      deprecation: true,
    });
    const subject = { termId: "core.legacy", replacedBy: "core.successor" };

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, { kind: "deprecation", accountId: account.accountId, subject });

    const recorder = recordingDelivery();
    const deliverPending = await bind("deliverPending");
    await deliverPending(scratch.db, recorder.delivery);

    const message = recorder.delivered.find((m) => m.kind === "deprecation");
    expect(
      message,
      `AC3: nothing of kind \`deprecation\` reached the seam.\n` +
        `  delivered: ${JSON.stringify(recorder.delivered)}`,
    ).toBeDefined();

    expect(
      message?.subject,
      `AC3: the deprecation message's subject is ${JSON.stringify(message?.subject)}; the ` +
        `successor must survive the round trip through the queue.\n` +
        `  D-190-03: "AC3's carriage is \`message.subject\` (a deprecation subject carries ` +
        `\`replacedBy\` when a successor exists, from \`ontology/input.ts\`'s own deprecation ` +
        `shape)". D-190-04 narrows AC3 to carriage, because no term-to-account mapping exists ` +
        `anywhere and the recipient is underivable.`,
    ).toEqual(subject);
  });

  /**
   * The half that names a concrete bad output, so the assertion EXCLUDES it rather than
   * admitting the good one.
   *
   * A module that always writes the key would carry `replacedBy: undefined` through
   * `JSON.stringify` into jsonb as an absent key (fine), or as `null`, or — the one that has
   * actually shipped in this repository — as the four-character STRING `"undefined"`, which a
   * renderer would print as a successor id. `toBeUndefined()` on the value admits the string.
   */
  it("a deprecation with no successor carries no `replacedBy` at all", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("dep-no").toLowerCase(), {
      deprecation: true,
    });
    const subject = { termId: "core.orphan" };

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, { kind: "deprecation", accountId: account.accountId, subject });

    const recorder = recordingDelivery();
    const deliverPending = await bind("deliverPending");
    await deliverPending(scratch.db, recorder.delivery);

    const message = recorder.delivered.find((m) => m.kind === "deprecation");
    expect(message, "nothing of kind `deprecation` reached the seam").toBeDefined();

    expect(
      Object.keys(message?.subject ?? {}),
      `AC3 says "when one exists". A deprecation with no successor arrived carrying ` +
        `${JSON.stringify(message?.subject)}.\n` +
        `  The key must be ABSENT, not present and empty: \`null\`, \`""\` and the string ` +
        `\`"undefined"\` all render as a successor pointer to anything downstream that checks ` +
        `\`"replacedBy" in subject\`, and the last of those has shipped in this repository ` +
        `before. This assertion excludes those outputs rather than admitting the good one.`,
    ).toEqual(["termId"]);
  });

  /**
   * And the two are DIFFERENT events, which is the property the digest has to hold.
   *
   * If a subject with a successor digested the same as one without, the unique key would let
   * the first of the two through and silently drop whichever arrived second — losing either
   * the successor pointer or the deprecation itself, depending on the order.
   */
  it("a deprecation with a successor and one without are two rows", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("dep-both").toLowerCase(), {
      deprecation: true,
    });

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, {
      kind: "deprecation",
      accountId: account.accountId,
      subject: { termId: "core.t" },
    });
    await enqueue(scratch.db, {
      kind: "deprecation",
      accountId: account.accountId,
      subject: { termId: "core.t", replacedBy: "core.u" },
    });

    expect(
      await queueRows(scratch, account.accountId),
      "a deprecation gaining a successor pointer did not produce a distinguishable row, so " +
        "one of the two announcements is lost to the unique key.",
    ).toHaveLength(2);
  });
});

describe("T190 D-190-06: delivery is gated on the token, and the window closes", () => {
  /**
   * The gap the implementer found and the orchestrator ruled before either half wrote to it.
   *
   * The preference check lives at `enqueue` (D-190-02(1)) and `unsubscribe` touches no queued
   * row (AC6: "flips the matching preference AND NOTHING ELSE"). So a row enqueued while the
   * kind was ON and not yet drained is still pending after the unsubscribe, and a naive drain
   * mails it — to somebody who has just asked not to be mailed. D-190-06 closes it at the one
   * moment that matters: `deliverPending` sends only rows whose `(account_id, kind)` still
   * holds a token, because AC6 says every email carries a WORKING unsubscribe and a message
   * that cannot carry one must not be sent.
   *
   * The token is read from `unsubscribe_token` rather than off a delivered message here,
   * because the whole point of this fixture is that the row is NOT delivered first. D-190-02
   * rules direct schema reads from cells admissible.
   */
  it("unsubscribing before the drain delivers NOTHING for that pair", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("d6-strand").toLowerCase(), { fork: true });
    /* The control. Without a second account that DOES deliver in the same drain, a zero below
       is satisfied by a drain that is simply broken. */
    const control = await plantAccount(scratch, mark("d6-ctrl").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, {
      kind: "fork",
      accountId: account.accountId,
      subject: THREE[0]!,
    });
    await enqueue(scratch.db, {
      kind: "fork",
      accountId: control.accountId,
      subject: THREE[0]!,
    });

    const token = (await tokenRows(scratch, account.accountId)).find((t) => t.kind === "fork");
    expect(
      token,
      "`enqueue` minted no `(account_id, fork)` token, so there is nothing to revoke and this " +
        "cell cannot ask its question.",
    ).toBeDefined();

    const unsubscribe = await bind("unsubscribe");
    await unsubscribe(scratch.db, token!.token);

    const recorder = recordingDelivery();
    const deliverPending = await bind("deliverPending");
    await deliverPending(scratch.db, recorder.delivery);

    expect(
      recorder.delivered.filter((m) => m.accountId === account.accountId),
      `D-190-06: the row was enqueued while \`fork\` was ON, the reader then unsubscribed, and ` +
        `the drain mailed it anyway.\n` +
        `  delivered: ${JSON.stringify(recorder.delivered)}\n` +
        `  "\`deliverPending\` DELIVERS ONLY ROWS WHOSE (account_id, kind) STILL HOLDS AN ` +
        `unsubscribe_token" — the token's existence IS the delivery capability, because AC6 ` +
        `says every email carries a WORKING unsubscribe and this one could not.`,
    ).toEqual([]);

    expect(
      recorder.delivered.filter((m) => m.accountId === control.accountId),
      "the control account did not receive its mail either, so the zero above is a broken " +
        "drain rather than the token gate.",
    ).toHaveLength(1);

    /* And the row is STRANDED, not retired: D-190-06 accepts a disclosed cost and describes it
       as a row that resurrects behind a chain, which is only possible if it is still pending. */
    const stranded = (await queueRows(scratch, account.accountId)).filter(
      (r) => r.deliveredAt === null,
    );
    expect(
      stranded,
      "the gated row was stamped `delivered_at` without being delivered, which retires it " +
        "silently. D-190-06 refused pruning at unsubscribe time precisely because it "  +
        "\"does something beyond the flip and destroys idempotency keys for events that " +
        "genuinely happened\" — stamping it is the same loss by another route.",
    ).toHaveLength(1);
  });

  /**
   * The other end of the disclosed cost, in the ruling's own words: "a stranded pending row
   * resurrects only behind a chain — the account turns the preference back ON (enqueue is
   * preference-gated, so no re-mint before that), a NEW event of that kind arrives and re-mints
   * the token — at which point the mail reaches a re-subscribed account, which is admissible
   * even though the event predates the re-subscription."
   *
   * Driven as three links, each asserted, because a cell that only checked the end state could
   * not tell "the chain works" from "the gate never closed".
   */
  it("the re-mint chain delivers the stranded row exactly once", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("d6-remint").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    const deliverPending = await bind("deliverPending");
    const unsubscribe = await bind("unsubscribe");
    const setPreferences = await bind("setPreferences");

    await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject: THREE[0]! });
    const token = (await tokenRows(scratch, account.accountId)).find((t) => t.kind === "fork");
    expect(token, "no token was minted").toBeDefined();
    await unsubscribe(scratch.db, token!.token);

    /* Link 1: no re-mint before the preference goes back on. `enqueue` is preference-gated, so
       a new event while `fork` is OFF writes no row AND mints no token. */
    await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject: THREE[1]! });
    expect(
      await tokenRows(scratch, account.accountId),
      "a token was re-minted while `fork` was OFF. `enqueue` is preference-gated (D-190-02(1)), " +
        "so nothing of that kind may reach the token table either — otherwise the gate D-190-06 " +
        "closed reopens on the next event the reader never asked for.",
    ).toEqual([]);
    expect(
      (await queueRows(scratch, account.accountId)).length,
      "a second row was queued while `fork` was OFF.",
    ).toBe(1);

    /* Link 2: the account re-subscribes, and a NEW event re-mints. */
    await setPreferences(scratch.db, account.actor, account.accountId, { fork: true });
    await enqueue(scratch.db, { kind: "fork", accountId: account.accountId, subject: THREE[2]! });
    expect(
      (await tokenRows(scratch, account.accountId)).filter((t) => t.kind === "fork"),
      "the new event did not re-mint the token, so the stranded row can never resurrect and " +
        "D-190-06's disclosed cost is a permanent loss rather than a deferral.",
    ).toHaveLength(1);

    /* Link 3: the drain delivers BOTH the stranded row and the new one, each exactly once. */
    const recorder = recordingDelivery();
    await deliverPending(scratch.db, recorder.delivery);

    expect(
      deliveredCountFor(recorder, "fork", THREE[0]!),
      `D-190-06: the STRANDED row — enqueued before the unsubscribe — was delivered ` +
        `${deliveredCountFor(recorder, "fork", THREE[0]!)} time(s) after the re-mint chain; ` +
        `the ruling says exactly once. It "reaches a re-subscribed account, which is ` +
        `admissible even though the event predates the re-subscription".`,
    ).toBe(1);
    expect(deliveredCountFor(recorder, "fork", THREE[2]!), "the new event was not delivered").toBe(
      1,
    );
    expect(
      deliveredCountFor(recorder, "fork", THREE[1]!),
      "the event enqueued while `fork` was OFF was delivered, so a row was written for a kind " +
        "the account had switched off.",
    ).toBe(0);

    /* And a second drain adds nothing: the gate does not re-open a delivered row. */
    const again = recordingDelivery();
    await deliverPending(scratch.db, again.delivery);
    expect(again.attempts, "a second drain re-sent already-delivered rows").toEqual([]);
  });
});
