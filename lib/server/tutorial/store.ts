/* ============================================================
   DarkPrint backend: the tutorial module's store boundary
   One function, and every verb goes through it. What crosses this
   line is either a value or a `TutorialStoreError` naming the
   verb; nothing else leaves the module.

   It converts EVERY rejection rather than a classified set, for
   the reason the other store boundaries in this tree give: nothing
   here can enumerate which faults carry a statement, and a
   classifier that is wrong fails open on exactly the clause this
   file exists for. The cost is that a bug in the module's own
   projection over rows is converted too and reaches a caller as a
   store failure. The answer is a 500 either way.
   ============================================================ */

import { TutorialStoreError } from "./errors";

/**
 * Run a verb's body and seal whatever it rejects with.
 *
 * `operation` is the verb's exported name, written as a literal at each call site and never
 * assembled from a parameter. An already-sealed fault is rethrown unchanged: wrapping it
 * again would relabel it with whichever verb happened to be outermost.
 */
export async function withTutorialStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof TutorialStoreError) throw cause;
    throw new TutorialStoreError(operation, cause);
  }
}
