/* ============================================================
   DarkPrint backend — the profiles store boundary
   Every statement this module issues goes through here, and what
   crosses the line is either a value or a `ProfileStoreError`
   naming the operation.

   ── Why it converts EVERY rejection rather than a classified set ──
   T081's argument, and it holds here unchanged. A classifier would
   have to answer "which faults can carry the statement?", and
   nothing in this module can enumerate that: a rejection raised
   while a query is in flight may come from drizzle, from `pg`,
   from the socket, or from a driver version that has not shipped.
   A classifier that is wrong fails OPEN, on exactly the clause
   this file exists for. Converting unconditionally fails closed.

   ── Where this DIVERGES from T081, deliberately and said out loud ──
   `withRegistryStore` wraps a whole reader body. This wraps only
   the statements this module issues, and `getProfile`'s calls into
   `@/lib/server/accounts` and `@/lib/server/registry` are OUTSIDE
   it. The reason is D-50-21's, applied one layer along: those two
   barrels seal their own faults to this same standard, and pulling
   an `AccountStoreError` or a `RegistryStoreError` into this
   wrapper would re-wrap it — which does not sanitize twice, it
   RELABELS. `getPublicAuthor: the account store failed.` would
   become `getProfile: the profile store failed.`, and the
   rendering would name a store that was working.

   D-13 still holds by construction rather than by breadth: the
   driver is reachable from this module ONLY through the statements
   below and through those two barrels, and all three seal. What is
   left outside every wrapper is a bug in this module's own pure
   projection, which carries no statement to leak and whose honest
   answer is a generic 500 rather than one dressed up as a known
   condition (D-50-18).

   Recorded because a cross-task divergence on a merged precedent
   is invisible to every instrument this run has: both suites stay
   green, and only a session reading two modules side by side sees
   it. This one is a divergence in the boundary's WIDTH and not in
   what it guarantees.
   ============================================================ */

import { MalformedStoredVocabularyError, ProfileStoreError } from "./errors";

/**
 * Run one of this module's own statements and seal whatever it rejects with.
 *
 * `operation` is the published reader's own exported name, written as a literal at each
 * call site. It is never assembled from a parameter: a caller-supplied handle reaching the
 * message would put caller data in the one rendering this module pins by exact equality,
 * and would make that pin depend on the request.
 *
 * An already-sealed fault of this module's own is rethrown unchanged rather than
 * re-wrapped, for the relabelling reason above. No reader here calls another today, so the
 * arm is unreachable through the barrel — it is kept because the property is about the
 * wrapper rather than about today's call graph, and it is observable directly by nesting
 * two calls and pinning the inner name.
 */
export async function withProfileStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    /* D-130-10. This module's ONE decision, passed through unrelabelled. Sealing it here
       would render `the profile store failed.` for a store that answered — the relabelling
       this file's own header refuses to do to another module's faults, which is exactly how
       it got shipped: the argument was written about FOREIGN faults and the local one is a
       different sentence. `withProfileErrors` gives it its own `type`. */
    if (cause instanceof MalformedStoredVocabularyError) throw cause;
    if (cause instanceof ProfileStoreError) throw cause;
    throw new ProfileStoreError(operation, cause);
  }
}
