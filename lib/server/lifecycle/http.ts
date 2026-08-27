/* ============================================================
   DarkPrint backend — the lifecycle routes' error boundary
   Which status each `kind` answers is settled HERE, in the module
   that raises them, rather than re-derived by each handler. A
   second copy of a status map is the defect this run charges
   most, and `lineage/http.ts` and `limits/http.ts` both put
   theirs in the module for the same reason.

   It lives in `lib/server/lifecycle` rather than beside the
   routes because `app/api/**` holds route handlers and nothing
   else (`registry/actor.ts`'s reason, D-01), which is where T050,
   T080, T110, T140 and T130 all put theirs.

   `problem` and `PROBLEM_TYPE_BASE` are CONSUMED from
   `@/lib/server/http` and that barrel is not edited here: it is
   T000's, and another task holds it. D-50-03 is why the base is
   consumed rather than retyped — a task that needed a type it did
   not construct retyped it once and published a host occurring
   nowhere else in the tree.

   ── why a store fault answers `problem+json` and does not
      rethrow ──
   D-50-18, ruled for T090's reading and applied again at T081.
   Throwing produces a 500 too, but Next's own generic one,
   outside the envelope every other failure on these routes uses
   (B-03) and unobservable to anything driving the handler
   directly — which is precisely how that defect survived a merge
   and a tag.
   ============================================================ */

import { PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import {
  DeletionRefusedError,
  LifecycleStoreError,
  TransferRefusedError,
  type DeletionRefusedKind,
  type TransferRefusedKind,
} from "./errors";

/**
 * **`not-owner` is 403 and `no-such-bundle` is 404, and the split is not an inconsistency
 * with B-03.** `not-owner` is raised only after the READ grant has already succeeded, so the
 * caller has been told the bundle exists by being allowed to read it — a 403 there concedes
 * nothing new. A bundle the caller may not read never reaches that arm: it is
 * `no-such-bundle`, one sentence and one status for absent and unreadable together, which is
 * what stops the refusal being an existence oracle over bundle ids.
 *
 * `no-such-handle` is 404 for the same reason it is one sentence: a handle nobody ever held
 * and a handle now on a tombstone must not be distinguishable, or the refusal publishes which
 * accounts are deleted.
 *
 * `not-signed-in` is 401 and is **unreachable through HTTP** — `withSession` answers 401
 * before either handler runs. The row exists because `transferBundle` is also called at the
 * module boundary, where an anonymous `Actor` does reach it, and because the union has to
 * stay exhaustive. D-110-10 records the identical arm on `forkBundle`.
 *
 * `slug-taken` is 409 because it is the one refusal naming a state the caller can reach by
 * asking differently.
 */
const TRANSFER_STATUSES: Readonly<Record<TransferRefusedKind, number>> = {
  "no-such-bundle": 404,
  "not-owner": 403,
  "no-such-handle": 404,
  "not-signed-in": 401,
  "slug-taken": 409,
};

const TRANSFER_TITLES: Readonly<Record<TransferRefusedKind, string>> = {
  "no-such-bundle": "Not found",
  "not-owner": "Forbidden",
  "no-such-handle": "Not found",
  "not-signed-in": "Unauthorized",
  "slug-taken": "Slug taken",
};

/**
 * `not-owner` is 403 rather than 404 here too, and it leaks nothing: `can` is asked BEFORE any
 * row is read, so a stranger gets the same 403 for an account id that exists and one that
 * does not. `no-such-account` is reachable only once authorization has already granted — by
 * the account itself asking about its own id, or by an operator.
 */
const DELETION_STATUSES: Readonly<Record<DeletionRefusedKind, number>> = {
  "no-such-account": 404,
  "not-owner": 403,
  /* Absent and unreadable share the 404 (B-03); `bundle-published` is 409 — the resource's
     own state forbids the act, and the state is one the caller can read. */
  "no-such-bundle": 404,
  "bundle-published": 409,
};

const DELETION_TITLES: Readonly<Record<DeletionRefusedKind, string>> = {
  "no-such-account": "Not found",
  "not-owner": "Forbidden",
  "no-such-bundle": "Not found",
  "bundle-published": "Published releases stay",
};

/**
 * Turn this module's typed rejections into B-03's envelope.
 *
 * **`detail` is the instance's own `message`, byte for byte** (D-81-02). Not a fixed sentence
 * written here: every message this module raises is one of the seven admissible forms and
 * interpolates only what the caller itself submitted, so passing it through keeps one
 * sentence with one author instead of giving the same refusal two wordings.
 *
 * Everything `work` does goes inside the `try` — `getSharedDbClient()` and `actorFrom`
 * included, since both can raise on a misconfigured host — rather than only the verb call. A
 * boundary drawn around the verb alone leaves a handler with a fault path for the one line
 * somebody was thinking about, which is the shape T081 exists to close.
 */
export async function withLifecycleErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof TransferRefusedError) {
      return problem(request, {
        type: `${PROBLEM_TYPE_BASE}/transfer-${err.kind}`,
        title: TRANSFER_TITLES[err.kind],
        status: TRANSFER_STATUSES[err.kind],
        detail: err.message,
      });
    }
    if (err instanceof DeletionRefusedError) {
      return problem(request, {
        type: `${PROBLEM_TYPE_BASE}/deletion-${err.kind}`,
        title: DELETION_TITLES[err.kind],
        status: DELETION_STATUSES[err.kind],
        detail: err.message,
      });
    }
    if (err instanceof LifecycleStoreError) {
      return problem(request, {
        type: `${PROBLEM_TYPE_BASE}/store-failed`,
        title: "Store failed",
        status: 500,
        detail: err.message,
      });
    }
    /* Not recognised, so this wrapper does not know what it is. The four modules
       `deleteAccount` composes raise their own sealed classes and they arrive here — already
       sanitized by their own store wrappers, and correctly NOT re-rendered under this
       module's name (D-50-08). They become Next's 500 rather than a lifecycle-shaped one,
       which is the honest answer: a note store that is down is not a lifecycle refusal.
       Recorded rather than closed, because giving them an arm here would mean this task
       deciding another task's status map. */
    throw err;
  }
}
