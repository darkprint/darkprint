/* ============================================================
   GET /api/account/notifications/unsubscribe?token=
   AC6's working unsubscribe.

   **NO SESSION, deliberately** (D-190-05, C6). The token IS the
   authority. This link is clicked out of an email client by
   somebody who may not be signed in, on a device that has never
   seen this site — requiring a session would make "a working
   unsubscribe" false for the ordinary case. What bounds the
   capability is that the token names exactly one `(account, kind)`
   pair and dies on use.

   **Its path sits under `app/api/account/` and that is recorded as
   deliberate rather than as an oversight.** Every other route under
   that tree carries `withSession`; this one must not, and it lives
   there because `app/api/account/notifications/**` is this task's
   route grant. A reader who assumes the tree implies a session
   would be wrong about this file, so the assumption is contradicted
   here in writing.

   GET rather than POST, because a mail client fetches a link. The
   cost is real and is stated rather than hidden: a scanner that
   pre-fetches links in mail will consume the token and unsubscribe
   the recipient. The alternative — a landing page with a confirm
   button — is a page, and pages are out of this task's scope; it is
   recorded as the fix if that ever bites.

   * **404** — the link is dead (already used, never real, or its
     account is gone). One answer for all three: a distinct one for
     "already used" would tell anybody holding a random string
     whether it was ever real.
   * **400** — no `token` at all, which is a malformed request
     rather than a dead link.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import {
  tokenFrom,
  unsubscribe,
  withNotificationErrors,
  type UnsubscribedView,
} from "@/lib/server/notifications";

export async function GET(request: Request): Promise<Response> {
  return withNotificationErrors(request, async () => {
    const token = tokenFrom(request, new URL(request.url));
    if (token instanceof Response) return token;

    const { db } = getSharedDbClient();
    const { kind } = await unsubscribe(db, token);
    /* The kind, and never the account id — the token "names the kind rather than carrying an
       account id in the clear" (AC6). The caller here is an anonymous click. */
    const view: UnsubscribedView = { kind };
    return ok(view);
  });
}
