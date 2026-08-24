/* ============================================================
   DarkPrint backend — unsubscribe
   AC6: every email carries a working unsubscribe that turns the
   matching preference off.

   ── no Actor, and that is the design ──
   The token IS the authority (D-190-05). An unsubscribe link is
   clicked out of an email client by somebody who may not be signed
   in, on a device that has never seen this site, and requiring a
   session would make the criterion "a working unsubscribe" false
   for the ordinary case. What bounds the capability is that the
   token names exactly one `(account, kind)` pair and dies on use.
   ============================================================ */

import type { Db } from "@/lib/db";
import { unsubscribeInvalidError } from "./errors";
import { clearPreference } from "./preferences";
import { takeToken, withStore } from "./store";
import type { EventKind } from "./types";

/**
 * Consume `token`, turn its kind off for its account, and answer which kind that was.
 *
 * **The token is consumed FIRST, and the order is the whole of its single-use property.**
 * `takeToken` is one `DELETE ... RETURNING`, so two simultaneous clicks on one link cannot both
 * find the row: exactly one deletes it and the other gets nothing back and is refused. Turning
 * the preference off first and deleting after would leave a window where both clicks succeed —
 * harmless for an idempotent write, but it would also leave a live token behind if the write
 * then failed, which is a working link after a "no longer valid" answer.
 *
 * **Sets FALSE, never toggles** (D-190-03, correcting the section's "flips"). An unsubscribe
 * link must be idempotent in intent; a toggle would re-subscribe somebody who clicked twice.
 * The second click cannot reach a toggle anyway, because the row is gone — but the behaviour is
 * ruled on what the write DOES, not on what happens to be reachable.
 *
 * **And nothing else** (AC6). No queue row is pruned, no other preference moves. D-190-06
 * records why pruning was refused: it does something beyond the flip and destroys idempotency
 * keys for events that genuinely happened.
 *
 * The refusal covers a token that never existed, one already used, and one whose account has
 * since gone — one sentence for all three, because a distinct answer for "already used" would
 * tell anybody holding a random string whether it was ever real.
 */
export async function unsubscribe(db: Db, token: string): Promise<{ kind: EventKind }> {
  return await withStore("unsubscribe", async () => {
    const taken = await takeToken(db, token);
    if (taken === undefined) throw unsubscribeInvalidError();
    await clearPreference(db, taken.accountId, taken.kind);
    /* The kind, and never the account id (AC6: the token "names the kind rather than carrying
       an account id in the clear"). The caller is an anonymous click; telling it whose account
       it just changed would make the token an account-identity oracle. */
    return { kind: taken.kind };
  });
}
