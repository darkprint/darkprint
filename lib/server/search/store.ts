/* ============================================================
   DarkPrint backend — the search module's store boundary
   One function, and every published entry point goes through it.
   What crosses this line is either a value or a `SearchStoreError`
   naming the operation; nothing else leaves the module.

   It converts EVERY rejection rather than a classified set, for
   `registry/store.ts`'s reason and it applies here with one extra
   edge: this module calls FOUR other modules' readers (T080's
   registry, T030's ontology, T010's archive) as well as its own
   queries, and each of those already seals its own faults with its
   own class. Those arrive here as ordinary rejections and are
   resealed under this module's operation name — which is the
   honest label, because what failed from a caller's point of view
   is `searchBlueprints`, and the original class and its statement
   travel intact on `cause` where an operator reads them.

   The cost is the same one T080 states rather than hides: a bug in
   the pure projection half of a reader is converted too, so it
   reaches a caller labelled as a store failure. The answer is a
   500 either way, so nothing downstream can branch on the
   difference.
   ============================================================ */

import { SearchStoreError } from "./errors";

/**
 * Run a published entry point's body and seal whatever it rejects with.
 *
 * `operation` is the entry point's own exported name, written as a literal at each call
 * site. It is never assembled from a parameter: a caller-supplied `q`, `tag` or `slug`
 * reaching the message would put caller data in the one rendering this module pins by
 * exact equality, and would make the pin depend on the request.
 *
 * An already-sealed fault is rethrown unchanged rather than re-wrapped. A sanitizer applied
 * twice does not sanitize twice, it RELABELS: re-wrapping would replace the entry point
 * that actually failed with whichever one happened to be outermost.
 */
export async function withSearchStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof SearchStoreError) throw cause;
    throw new SearchStoreError(operation, cause);
  }
}
