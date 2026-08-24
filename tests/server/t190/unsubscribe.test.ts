/* ============================================================
   T190 AC6 — every email carries a working unsubscribe

   The criterion closes end to end here, and D-190-03 is what makes
   that possible from a blind suite:

     "Token minting: `enqueue` ensures a token row per
      (account_id, kind) — the unique pair means re-enqueue reuses
      it — and the delivery message carries it, which is how a cell
      obtains one and how AC6 closes end to end
      (mail -> `unsubscribe(db, message.unsubscribeToken)` ->
      preference flipped)."

   So no cell below invents a token. Each one takes the token off a
   message the module actually delivered, which is the same path a
   reader's mail client would take.

   ── "flips" was CORRECTED, and the cell that proves it ──
   D-190-03: "`unsubscribe` SETS the matching preference to FALSE —
   never a toggle". A cell driving only an ON preference cannot tell
   the two apart: set-to-false and toggle both answer `false`. The
   discriminating case is a preference that is ALREADY off, where a
   toggle answers `true` and re-subscribes the person who just
   clicked unsubscribe.

   Getting there needs a step, because under D-190-02(1) an OFF kind
   queues no row and therefore mints no token: the token is minted
   while the preference is ON, the preference is then turned off,
   and the token — its own table, deleted only on use — is still
   there to be spent. That is the fixture, and it is the whole
   reason the token is not stored on the queue row.

   ── the refusal is driven from both ends ──
   A token never minted and a token already spent must be
   indistinguishable: "no longer valid" is a statement about
   validity and must not become an oracle for which tokens once
   existed.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES_PIN,
  EVENT_KINDS,
  MESSAGE_FORMS,
  PREFERENCE_KEYS,
  type Scratch,
  bind,
  deferred,
  describe_,
  dropScratchDatabases,
  mark,
  plantAccount,
  plantedToken,
  recordingDelivery,
  rejection,
  renderingsOf,
  scratchDatabase,
  tokenRows,
} from "./contract";

const setup = deferred<Scratch>(() => scratchDatabase("unsub"));

afterAll(async () => {
  await dropScratchDatabases();
});

/**
 * The RULED subject for each kind — D-190-07 (amended) publishes all four as contract.
 *
 * A single fork-shaped subject reused across the four would be a subject `enqueue` may
 * legitimately refuse or normalise for three of them, and this file's subject matters not at
 * all: what it drives is the TOKEN. Using the published shape keeps a red here about AC6
 * rather than about a subject this file invented.
 */
const SUBJECT_FOR: Record<string, Record<string, string>> = {
  fork: { slug: "t190-upstream", fork: "b1" },
  repin: { cardId: "core.card", version: "2.0.0" },
  deprecation: { termId: "core.legacy", replacedBy: "core.successor" },
  digest: { period: "2026-W35" },
};

/** Queue one event of `kind` and hand back the token the delivered message carried. */
async function tokenFromMail(scratch: Scratch, accountId: string, kind: string): Promise<string> {
  const enqueue = await bind("enqueue");
  await enqueue(scratch.db, { kind, accountId, subject: SUBJECT_FOR[kind] ?? { period: "2026-W35" } });

  const recorder = recordingDelivery();
  const deliverPending = await bind("deliverPending");
  await deliverPending(scratch.db, recorder.delivery);

  const message = recorder.delivered.find((m) => m.kind === kind && m.accountId === accountId);
  if (message === undefined) {
    throw new Error(
      `No \`${kind}\` message was delivered for ${accountId}, so this cell has no token to ` +
        `spend and is not about AC6 at all.\n` +
        `  delivered: ${JSON.stringify(recorder.delivered)}`,
    );
  }
  if (typeof message.unsubscribeToken !== "string" || message.unsubscribeToken === "") {
    throw new Error(
      `AC6: the delivered \`${kind}\` message carries ` +
        `${describe_(message.unsubscribeToken)} as its unsubscribe token. "Every email carries ` +
        `a working unsubscribe" — an absent token is the criterion failing at its first step.`,
    );
  }
  return message.unsubscribeToken;
}

describe("T190 AC6: the token off a delivered message turns its own preference off", () => {
  it.each(EVENT_KINDS)("a `%s` mail's token switches that kind off and nothing else", async (kind) => {
    const scratch = await setup.require();
    /* Every kind ON, so `enqueue` will queue whichever one this cell drives (D-190-02(1)) and
       so the three that must NOT move start somewhere a change would be visible. */
    const account = await plantAccount(scratch, mark(`ac6-${kind}`).toLowerCase(), {
      repin: true,
      fork: true,
      deprecation: true,
      digest: true,
    });

    const token = await tokenFromMail(scratch, account.accountId, kind);

    const unsubscribe = await bind("unsubscribe");
    const answered = await unsubscribe(scratch.db, token);

    expect(
      answered,
      `\`unsubscribe\` answered ${describe_(answered)}; the block publishes ` +
        `\`Promise<{ kind: EventKind }>\`, and AC6 says the token "names the kind rather than ` +
        `carrying an account id in the clear".`,
    ).toEqual({ kind });

    const getPreferences = await bind("getPreferences");
    const after = (await getPreferences(
      scratch.db,
      account.actor,
      account.accountId,
    )) as Record<string, boolean>;

    expect(
      after[kind],
      `AC6: spending a \`${kind}\` token left \`${kind}\` at ${String(after[kind])}.`,
    ).toBe(false);

    for (const other of PREFERENCE_KEYS) {
      if (other === kind) continue;
      expect(
        after[other],
        `AC6: "the unsubscribe token flips the matching preference AND NOTHING ELSE". ` +
          `Spending a \`${kind}\` token moved \`${other}\` to ${String(after[other])}.\n` +
          `  All four started ON, so a module unsubscribing from everything, or resetting the ` +
          `record to \`DEFAULT_PREFERENCES\` ` +
          `(${JSON.stringify(DEFAULT_PREFERENCES_PIN)}) while it was at it, reds here.`,
      ).toBe(true);
    }
  });

  /**
   * The cell that separates SET from TOGGLE, and the only one that can.
   *
   * The token is minted while `fork` is ON and spent after it has been turned OFF. A toggle
   * answers `true` — it re-subscribes the person who clicked unsubscribe — and set-to-false
   * answers `false`. Both are green against a preference that started ON, which is why that
   * case cannot carry this claim.
   */
  it("spending a token against an ALREADY-off preference leaves it off", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("ac6-off").toLowerCase(), { fork: true });

    const token = await tokenFromMail(scratch, account.accountId, "fork");

    const setPreferences = await bind("setPreferences");
    await setPreferences(scratch.db, account.actor, account.accountId, { fork: false });

    /* The premise: it really is off before the token is spent, and the token really survived
       the preference change — the token is its OWN table (D-190-03) and is deleted on use, not
       on a preference write. */
    const getPreferences = await bind("getPreferences");
    const before = (await getPreferences(scratch.db, account.actor, account.accountId)) as Record<
      string,
      boolean
    >;
    expect(before.fork, "the fixture did not turn `fork` off, so this cell tests nothing").toBe(
      false,
    );
    expect(
      (await tokenRows(scratch, account.accountId)).map((t) => t.token),
      "the token did not survive a preference write, so it cannot be spent and the toggle " +
        "question cannot be asked.",
    ).toContain(token);

    const unsubscribe = await bind("unsubscribe");
    await unsubscribe(scratch.db, token);

    const after = (await getPreferences(scratch.db, account.actor, account.accountId)) as Record<
      string,
      boolean
    >;
    expect(
      after.fork,
      `D-190-03: "\`unsubscribe\` SETS the matching preference to FALSE — never a toggle". ` +
        `\`fork\` was already \`false\` and spending the token answered ${String(after.fork)}, ` +
        `which is a toggle: it RE-SUBSCRIBES the reader who clicked unsubscribe.\n` +
        `  The section's word is "flips" and D-190-03 corrects it here, for exactly this case.`,
    ).toBe(false);
  });
});

describe("T190 AC6: a spent link is no longer valid", () => {
  it("the token row is DELETED on use", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("ac6-del").toLowerCase(), { fork: true });
    const token = await tokenFromMail(scratch, account.accountId, "fork");

    expect(
      (await tokenRows(scratch, account.accountId)).map((t) => t.token),
      "the fixture minted no token row",
    ).toContain(token);

    const unsubscribe = await bind("unsubscribe");
    await unsubscribe(scratch.db, token);

    expect(
      (await tokenRows(scratch, account.accountId)).map((t) => t.token),
      `D-190-01: "the unsubscribe token is STORED, not signed: AC6's 'no longer valid' needs ` +
        `revocation, a row deleted on use IS revocation". A token that survives its use is a ` +
        `link that works forever, which is what a signed token would have been and is what ` +
        `the ruling refused.`,
    ).not.toContain(token);
  });

  it("spending the same token twice refuses with the published sentence", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("ac6-twice").toLowerCase(), { fork: true });
    const token = await tokenFromMail(scratch, account.accountId, "fork");

    const unsubscribe = await bind("unsubscribe");
    await unsubscribe(scratch.db, token);

    const err = await rejection(() => unsubscribe(scratch.db, token), "the second unsubscribe");
    expect(
      renderingsOf(err).message,
      `AC6's second click. §T190 publishes this sentence and D-190-05 makes it one of three ` +
        `admissible forms for the whole module.`,
    ).toBe(MESSAGE_FORMS.unsubscribe);
  });

  /**
   * A token that never existed answers the same way, and that is the point.
   *
   * "No longer valid" must be a statement about validity and not an oracle for which tokens
   * once existed: a distinguishable answer here would let anyone enumerate real tokens.
   */
  it("a token that never existed is refused identically", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("ac6-never").toLowerCase(), { fork: true });
    const real = await tokenFromMail(scratch, account.accountId, "fork");

    const unsubscribe = await bind("unsubscribe");
    await unsubscribe(scratch.db, real);
    const spent = renderingsOf(await rejection(() => unsubscribe(scratch.db, real), "a spent token"));

    const invented = plantedToken();
    const unknown = renderingsOf(
      await rejection(() => unsubscribe(scratch.db, invented), "a token that never existed"),
    );

    expect(unknown.message, "a token that never existed got its own wording").toBe(
      MESSAGE_FORMS.unsubscribe,
    );
    expect(
      unknown.message,
      `a SPENT token and an INVENTED one are distinguishable by their message, which turns ` +
        `"no longer valid" into an oracle for which tokens once existed.\n` +
        `  spent:    ${JSON.stringify(spent.message)}\n` +
        `  invented: ${JSON.stringify(unknown.message)}`,
    ).toBe(spent.message);

    expect(
      unknown.message.includes(invented),
      `the refusal quotes the token it was handed back at the caller. The three admissible ` +
        `forms carry the operation and nothing else.`,
    ).toBe(false);
  });

  it.each(["", "   ", "not-a-token"])(
    "the malformed token %o is refused with the same sentence",
    async (token) => {
      const scratch = await setup.require();
      const unsubscribe = await bind("unsubscribe");
      const err = await rejection(
        () => unsubscribe(scratch.db, token),
        `unsubscribe(${JSON.stringify(token)})`,
      );
      expect(
        renderingsOf(err).message,
        `a malformed token produced its own wording. The published set is three forms and a ` +
          `fourth invented for a parse failure is outside it — and a distinguishable answer ` +
          `for "this is not even token-shaped" is a free grammar check for anyone guessing.`,
      ).toBe(MESSAGE_FORMS.unsubscribe);
    },
  );
});
