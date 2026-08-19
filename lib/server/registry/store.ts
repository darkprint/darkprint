/* ============================================================
   DarkPrint backend — the registry's store boundary
   One function, and every published reader goes through it. What
   crosses this line is either a value or a `RegistryStoreError`
   naming the operation; nothing else leaves the module.

   ── Why it converts EVERY rejection rather than a classified set ──
   The alternative is to convert only what looks like a driver
   fault — `instanceof DrizzleQueryError`, say — and let the rest
   through. That is the wrong trade here and the direction of the
   failure is why.

   The question a classifier has to answer is "which faults can
   carry the statement?", and nothing in this module can enumerate
   that set: a rejection raised while a query is in flight may come
   from drizzle, from `pg`, from the socket, or from a driver
   version that has not shipped yet. A classifier that is wrong
   fails OPEN, on exactly the clause this file exists for — a leak,
   silently, in the shape D-13 names. Converting unconditionally
   fails closed. So the wrapper does not classify.

   The cost is stated rather than hidden: a reader's body is a
   store call plus a pure projection over its rows, and a bug in
   the projection half is converted too, so it reaches a caller
   labelled as a store failure. That is a real loss of diagnostic
   honesty and it is bounded — the original error is on `cause`
   with its `stack` intact, which is where an operator reads it,
   and the caller's answer is a 500 either way, so nothing
   downstream can branch differently on the difference.

   The distinction this run rules on elsewhere — a recognised fault
   answers `problem+json` and an unrecognised one is a bug that must
   not be dressed up as a known condition (D-50-18, T090's
   `respondWithFile`) — still holds, one layer out: `withRegistryErrors`
   recognises `RegistryStoreError` and rethrows everything else, and
   the faults that reach that arm are the ones raised OUTSIDE a
   reader (`getSharedDbClient`, `actorFrom`). That arm is live and
   reachable, not decorative: `actorFrom` calls `getSession`, which
   resolves `SESSION_SECRET` through a required-env read and throws
   when it is unset for a request that carries a session cookie.
   ============================================================ */

import { RegistryStoreError } from "./errors";

/**
 * Run a published reader's body and seal whatever it rejects with.
 *
 * `operation` is the reader's own exported name, written out as a literal at each call
 * site. It is never assembled from a parameter: a caller-supplied `phase`, `cardId`,
 * `ownerHandle` or `ref` reaching the message would put caller data in the one rendering
 * this module pins by exact equality, and would make the pin depend on the request.
 *
 * An already-sealed fault is rethrown unchanged rather than re-wrapped. A sanitizer
 * applied twice does not sanitize twice, it RELABELS: re-wrapping would replace the
 * operation that actually failed with the one that happened to be outermost, so the
 * rendering would name a reader that was still working. No published reader calls another
 * today, so this arm is unreachable through the barrel — it is kept because the property
 * it protects is about the wrapper rather than about today's call graph, and it is
 * observable directly (`fault-path.test.ts` nests two calls and pins the inner name).
 */
export async function withRegistryStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof RegistryStoreError) throw cause;
    throw new RegistryStoreError(operation, cause);
  }
}
