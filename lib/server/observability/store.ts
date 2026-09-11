/* ============================================================
   DarkPrint backend — observability: the one way this module
   talks to the database
   Every published reader and writer goes through `withStore`, so
   what crosses this line is either a value, this module's own
   refusal, or an `AuditStoreError` naming the operation. Nothing
   else leaves.

   T081's argument for converting unconditionally is inherited
   whole: a classifier that tries to name *which faults can carry
   the statement* fails OPEN on the clause the wrapper exists for,
   because a rejection raised while a query is in flight may come
   from drizzle, from `pg`, from the socket, or from a driver
   version that has not shipped.

   What differs here is that this module authors one decision —
   D-240-04's operator-only refusal — so one class passes through
   unwrapped, recognised by IDENTITY rather than by shape. The
   predicate names one class this file imports and nothing else,
   so it cannot fail open the way a driver-fault classifier would:
   anything it does not recognise is sealed, which is the safe
   direction.

   The already-sealed arm is not dead code. A sanitizer applied
   twice does not sanitize twice, it RELABELS — it would replace
   the operation that actually failed with whichever one happened
   to be outermost, so a rendering would name a reader that was
   still working. No published function calls another today; the
   arm protects a property of the wrapper rather than of today's
   call graph.
   ============================================================ */

import { AuditStoreError, NotPermittedError } from "./errors";

/**
 * A rejection that is this module's own decision rather than the database failing.
 *
 * One member. Sealing it would replace "not the operator" — an answer a caller can act
 * on — with a store fault, turning a refusal about authority into one about
 * availability, and AC5's whole point is that those two must not read alike.
 */
function isDecision(err: unknown): boolean {
  return err instanceof NotPermittedError;
}

/** Runs `work`, letting the one decision through and sealing everything else. */
export async function withStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isDecision(err)) throw err;
    if (err instanceof AuditStoreError) throw err;
    throw new AuditStoreError(operation, err);
  }
}
