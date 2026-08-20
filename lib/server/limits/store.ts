/* ============================================================
   DarkPrint backend — limits: the one way this module talks to
   the database
   Every driver fault leaves as `LimitsStoreError`. A
   `DrizzleQueryError`'s `message` opens with the statement and
   every bound parameter (D-13) — and on `resolveKey` the bound
   parameter is the HASH OF A LIVE SECRET, and on `issueKey` it is
   the hash being stored. So an unwrapped fault escaping this
   module puts a credential's hash on whatever surface renders the
   error, which is the sharpest instance of D-13 this run has had:
   T050's was an email, and this one is the thing the email is
   protected by.

   That is also why `token_hash` and not the secret is what the
   statement can ever carry — the secret never reaches a query, so
   the worst a leak can expose is a value that cannot be presented
   as a key without inverting SHA-256.

   **A decision is never wrapped as a fault.** `isDecision` lets
   this module's own refusals through unchanged, so a bad `label`
   stays a 400 rather than becoming a 500. It is written over the
   module's own base class rather than over a list of concrete
   ones, which is three fewer places to forget a class — and the
   base is deliberately NOT on the barrel, so no wrapper can grow
   an arm for it and stop the concrete classes being disjoint
   siblings (D-50-21's withdrawn construction).

   **Why it converts every OTHER rejection rather than a
   classified set**, following T081's reasoning rather than
   restating it: nothing here can enumerate which faults can carry
   a statement — drizzle, `pg`, the socket, a driver version that
   has not shipped. A classifier that is wrong fails OPEN on
   exactly the clause this file exists for. Converting
   unconditionally fails closed, and the cost is stated: a bug in
   a pure projection over rows is converted too and reaches a
   caller labelled as a store failure, with the original on
   `cause` and its `stack` intact.
   ============================================================ */

import { LimitsError, limitsStoreError } from "./errors";

/** A rejection that is this module's decision rather than the database failing. */
function isDecision(err: unknown): boolean {
  return err instanceof LimitsError;
}

/** Runs `work`, letting decisions through and sanitizing everything else. */
export async function withStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isDecision(err)) throw err;
    throw limitsStoreError(operation, err);
  }
}
