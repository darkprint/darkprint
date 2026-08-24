/* ============================================================
   DarkPrint backend — enqueue, and the one derived fan-out
   The only door into the queue. Everything AC1 through AC5 is a
   property of what this file writes and declines to write.

   ── the four gates, in order, and each one is a criterion ──
   No account row      -> nothing. Nobody to mail.
   A tombstone         -> nothing (D-190-02(2)). A queue row for an
                          account that can never be mailed is
                          garbage by construction.
   The kind is OFF     -> nothing (D-190-02(1)). The queue must not
                          fill with rows for people who opted out,
                          and "every AC is a property of the queue"
                          is only true if the queue is filtered.
   Otherwise           -> a token, then a row, conflict caught.

   ── what is NOT gated here, and must never be ──
   **Visibility.** AC1's private-fork filter lives at the SOURCE,
   inside `forkBundle`, and `enqueue` is never called for a private
   fork. It is not re-checked here and it must not be: `subject` is
   `Record<string, string>` and a visibility travelling in it would
   be readable by every later reader of the row, which is exactly
   the leak the criterion closes. `enqueue` cannot know whether a
   fork was public and is not asked to.
   ============================================================ */

import { canonicalJson, contentDigest } from "@/lib/core";
import type { Db } from "@/lib/db";
import { fillPreferences } from "./preferences";
import { accountStateFor, accountsPinningCard, ensureToken, insertQueueRow, withStore } from "./store";
import type { NotificationEvent } from "./types";

/**
 * Record that `event` is owed to an account, or decline to, silently.
 *
 * **Silence is the published behaviour, not an omission.** Every gate above is an ordinary
 * outcome — an opted-out account, a grave — and none of them is the caller's mistake. A
 * rejection would need a fourth admissible message form for a case the contract does not name,
 * and would make every event source responsible for knowing another account's settings.
 *
 * **`Promise<void>`, so the answer is deliberately unobservable through the return.** AC2's
 * "exactly one" and AC1's "none" are read off the QUEUE, which is the point of D-190-01 making
 * the row the idempotency: a caller cannot be trusted to report what it wrote, and a cell that
 * asked it to would be asking the implementation to grade itself.
 */
export async function enqueue(db: Db, event: NotificationEvent): Promise<void> {
  await withStore("enqueue", async () => {
    const state = await accountStateFor(db, event.accountId);
    if (state === undefined) return;
    if (state.tombstoned) return;
    if (!fillPreferences(state.stored)[event.kind]) return;

    /* D-190-01's digest, over `@/lib/core`'s canonical form. **No digest is authored here.**
       `Record<string, string>` has no canonical byte form of its own — `{a,b}` and `{b,a}`
       serialise differently through `JSON.stringify` — and `canonicalJson` sorts keys by code
       unit, which is what makes two spellings of one subject land on one row. */
    const subjectDigest = contentDigest(canonicalJson(event.subject));

    /* **The token FIRST, and the order is load-bearing under D-190-06.** Delivery inner-joins
       the queue row to its token, so a row written before its token would be invisible to a
       drain running in the gap — recoverable, but only on the next pass. The reverse failure is
       harmless: a token with no row is reused by the next `enqueue` for that pair and costs
       nothing. Ordered so the harmless failure is the one that can happen. */
    await ensureToken(db, event.accountId, event.kind);

    /* The row IS the idempotency (D-190-01, AC5). The conflict is CAUGHT, so a fan-out retried
       after a partial failure writes nothing twice and two concurrent callers on one event
       leave exactly one row. `insertQueueRow` answers whether it wrote; nothing here reads that
       answer, because the return above is `void` by contract and the queue is the record. */
    await insertQueueRow(db, {
      kind: event.kind,
      accountId: event.accountId,
      /* Stored as given, beside its digest rather than derived back out of it — a digest is
         one-way and `deliverPending` has to hand the subject to the mailer. Not two sources for
         one fact: the digest is the key and only it is ever compared. Which SPELLING is stored
         is whichever insert won; the two are equal by `canonicalJson`'s definition. */
      subject: event.subject,
      subjectDigest,
    });
  });
}

/**
 * The `repin` fan-out: everyone pinning `cardId` learns that `version` was published.
 *
 * D-190-04 publishes this verb and rules its grain: **owners of bundles any of whose releases
 * pin ANY version of that card, private bundles included.** Private is right and is not an AC1
 * exception — AC1 is about not announcing somebody else's private act to an upstream author,
 * and this announces your own pin to you. `accountsPinningCard` carries the SQL and the reason
 * its grain differs from `lifecycle`'s neighbouring exact-ref query.
 *
 * **This has no production caller in this tree, deliberately.** Its wiring to the publish path
 * is the orchestrator's visit at merge (D-190-04, the F4.2 pattern), so that the one file two
 * tasks would otherwise both edit is visited once. That is a recorded gap, not an oversight,
 * and this sentence is here so nobody reads the absence of callers as the absence of a rule.
 *
 * Recipients are enqueued one at a time rather than in one multi-row insert: each has its own
 * preference gate, its own tombstone gate and its own token, so a batch would have to
 * re-implement all three. A slow fan-out over an unindexed set is a real cost and it is not
 * this one — the set is the distinct owners of bundles pinning one card.
 *
 * `selectDistinct` already collapses duplicate owners, and the unique key would collapse them
 * again if it did not: an account owning two bundles that both pin the card gets ONE row,
 * because `(kind, account_id, subject_digest)` is equal for both.
 */
export async function enqueueRepinEvents(db: Db, cardId: string, version: string): Promise<void> {
  const recipients = await withStore("enqueueRepinEvents", async () => await accountsPinningCard(db, cardId));
  for (const accountId of recipients) {
    /* D-190-07: `{ cardId, version }`, EXACTLY those two keys, and the spelling is the ruling's
       rather than T110's. `Repin.card` names the same quantity and is the older spelling; this
       ruling is later and matches this verb's own parameter name, so a reader moving between
       the two is told which is which here rather than guessing.

       The value is the BARE id and never `id@version` — T110's reasoning on the same quantity,
       now stated in the ruling. The two keys are separate members rather than one ref so a
       reader needs no parser to render either, and the digest over them gives one row per
       recipient per new version: two versions of one card are two rows by construction. */
    await enqueue(db, { kind: "repin", accountId, subject: { cardId, version } });
  }
}
