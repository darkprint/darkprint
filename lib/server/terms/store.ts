/* ============================================================
   DarkPrint backend — the term index's store boundary
   Every published reader goes through it. What crosses this line
   is either a value or a `TermStoreError` naming the operation.

   It converts EVERY rejection rather than a classified set, for
   `lib/server/registry/store.ts`'s reason: a classifier that is
   wrong about which faults can carry a statement fails OPEN, on
   exactly the clause D-13 exists for. Converting unconditionally
   fails closed.

   The cost is the same one, stated rather than hidden: a reader's
   body is a registry read plus a pure projection over its rows, so
   a bug in the projection half is sealed too and reaches a caller
   labelled as a store failure. The original is on `cause` with its
   stack intact, and the caller's answer is a 500 either way.

   One thing is different here and it is worth naming. The thing
   this module calls is `lib/server/registry`, which seals its own
   faults into `RegistryStoreError` before they ever reach this
   wrapper. So the fault a caller sees is `TermStoreError` with a
   `RegistryStoreError` on `cause` and the driver error one level
   further down. That is a chain rather than a relabelling: each
   link names the operation that was actually running in its own
   module, which is the property re-wrapping would destroy.
   ============================================================ */

import { TermStoreError } from "./errors";

/**
 * Run a published reader's body and seal whatever it rejects with.
 *
 * `operation` is the reader's own exported name, written out as a literal at each call
 * site. It is never assembled from a parameter: a caller-supplied `termId` or `bundleId`
 * reaching the message would put caller data in the one rendering this module pins by
 * exact equality, and would make the pin depend on the request.
 *
 * An already-sealed fault is rethrown unchanged rather than re-wrapped. A sanitizer
 * applied twice does not sanitize twice, it RELABELS: re-wrapping would replace the
 * operation that actually failed with whichever happened to be outermost, so the rendering
 * would name a reader that was still working.
 */
export async function withTermStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof TermStoreError) throw cause;
    throw new TermStoreError(operation, cause);
  }
}
