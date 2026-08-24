/* ============================================================
   DarkPrint backend — usage() and candidates()

   Both are one pass over the same read-time index (D-210-01:
   there is no stored projection, and the ontology-release and
   publish triggers left with it — 9 bundles and 57 cards fit in
   one read, and a stored copy would be a second content tree with
   its own staleness).

   ── Why the whole list has a reader at all ──
   D-210-09 published `GET /api/ontology-usage` as every counted
   term while neither published reader could produce it: `usageOf`
   answers one id and `candidates` is local-only by D-210-05, so it
   structurally cannot report `agent` or `json`. The route was
   ruled and the surface it needs was not; charged rather than
   invented, and ruled back as **D-210-10** with this signature and
   this sort order.
   ============================================================ */

import { DARKPRINT_CONFIG, splitTermId } from "@/lib/core";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";

import { buildIndex } from "./index-of";
import { withTermStore } from "./store";
import type { PromotionCandidate, TermUsage } from "./types";

/**
 * Code-unit order, not `localeCompare`.
 *
 * The engine's own indexes sort this way and say why: a list that reorders between hosts
 * is a list two readers disagree about. `lib/core/ontology/resolve.ts:65` holds the same
 * comparison for the same reason.
 */
function byTermId(a: TermUsage, b: TermUsage): number {
  return a.termId < b.termId ? -1 : a.termId > b.termId ? 1 : 0;
}

/**
 * Every term the public archive names, with its counts. `termId` ascending.
 *
 * Only terms with a non-zero count appear. A term the vocabulary declares and nothing names
 * is absent here and is not thereby missing — `usageOf` answers zeros for it (AC4), which is
 * the module's property and the reason the route serves a list rather than a map: a map
 * keyed by term id silently omits exactly the terms whose absence is the criterion.
 *
 * `actor` is accepted and does not select the content (D-210-03). The counts are global: a
 * private bundle's own owner and an anonymous caller get identical numbers, because a count
 * that folded in the caller's private content is the owner steering the shared vocabulary
 * with content nobody else can see, which is what AC3 exists to prevent.
 */
export async function usage(db: Db, actor: Actor): Promise<readonly TermUsage[]> {
  void actor;
  return withTermStore("usage", async () => [...(await buildIndex(db)).values()].sort(byTermId));
}

/**
 * Every counted LOCAL term measured against the configured thresholds. `termId` ascending.
 *
 * **Local only (D-210-05).** A core term is already in the curated vocabulary, so proposing
 * it for promotion is a proposal to promote the core into the core — measured on the seeded
 * archive, without this filter the list is ten terms and all ten are core rows. There is no
 * global list of local terms to enumerate, so the id SHAPE is the filter: `splitTermId` is
 * consumed from the engine rather than restated, and a namespaced id is one it gives a
 * `namespace` for. An id malformed enough that `splitTermId` hands it back whole is not
 * local by that test and does not appear, which is the same direction the engine already
 * takes with a bad id — it fails as itself rather than being repaired into another term.
 *
 * **The list is not the conjunction (D-210-02).** Every counted local term is here with both
 * booleans, and AC5 is the ELIGIBLE SUBSET: the terms where `meetsAuthors && meetsBlueprints`
 * are exactly the terms meeting both thresholds. Filtering here instead would make the
 * thresholds unobservable from outside the module and would leave the booleans with nothing
 * to say, since every element of a conjunction-filtered list carries `true` twice.
 *
 * The thresholds are read from `DARKPRINT_CONFIG.promotion` at the comparison and never
 * copied into this module. Both are open figures ("da tarare"), so a literal here would be a
 * second place to retune and the one nobody would find.
 */
export async function candidates(db: Db, actor: Actor): Promise<readonly PromotionCandidate[]> {
  void actor;
  return withTermStore("candidates", async () => {
    const { distinctAuthors, distinctBlueprints } = DARKPRINT_CONFIG.promotion;
    return [...(await buildIndex(db)).values()]
      .filter((term) => splitTermId(term.termId).namespace !== undefined)
      .sort(byTermId)
      .map((term) => ({
        ...term,
        meetsAuthors: term.authors >= distinctAuthors,
        meetsBlueprints: term.blueprints >= distinctBlueprints,
      }));
  });
}
