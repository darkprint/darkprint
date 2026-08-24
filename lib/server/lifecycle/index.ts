/* ============================================================
   DarkPrint backend — lib/server/lifecycle public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one. Re-exports are written out by
   name rather than `export *` so this file doubles as the
   inventory of what the module promises.

   The block names this barrel — `Barrel: @/lib/server/lifecycle`
   — and lists four functions and two types. Three more names are
   published and each has a reason the block itself supplies:

   · the **three error classes**, because a caller that cannot
     name a class cannot branch on it, and the two routes map a
     refusal, a store fault and five kinds to four statuses.
     `LifecycleStoreError` is sanctioned by D-120-03.
   · the **two `kind` unions**, sanctioned by the same ruling
     after T110's `ForkRefusedKind`: a caller switching on `kind`
     needs the union to be exhaustive.
   · `withLifecycleErrors`, the status map, published from the
     module that RAISES the kinds rather than re-derived by each
     handler — `lineage/http.ts` and `limits/http.ts` both.

   The five message CONSTRUCTORS are not exported and neither are
   the literals. A test that imports its expected message from the
   module under test asserts that the module agrees with itself,
   and passes unchanged the day the wording starts interpolating
   something it should not.

   `tests/error-hygiene.test.ts` builds its domain by construction
   over every `lib/server/<module>/index.ts`, so the three classes
   are measured against D-13's hygiene clause from the day this
   file exists — for HYGIENE now, and for the COUNT only once this
   module is on `backend`, since that guard resolves its domain
   from `git ls-tree -d backend lib/server/`. Its published-class
   count is an EQUALITY, currently **44**; it goes to **47** at the
   merge commit. Measured rather than predicted: the guard's own
   failure message reports `Checked 47 class(es) across 20
   barrel(s)` with these three named as covered-for-hygiene-only.
   The number is derived at the merge and is not carried here.
   ============================================================ */

export type { DeletionPlan, TransferPlan } from "./types";

export type { DeletionRefusedKind, TransferRefusedKind } from "./errors";
export { DeletionRefusedError, LifecycleStoreError, TransferRefusedError } from "./errors";

export { planTransfer, transferBundle } from "./transfer";
export { deleteAccount, planDeletion } from "./deletion";

export { withLifecycleErrors } from "./http";
