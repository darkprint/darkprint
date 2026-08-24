/* ============================================================
   DarkPrint backend — lib/server/runs public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   ── The aggregate's type is NOT `lib/data/community.ts`'s ──
   D-180-01: that `ReportedCost` is a FIXTURE type whose `median`
   is on the 0-100 scorecard axis only because its author chose
   consistent fixture values. **A real aggregate cannot be**, and
   there is no reference model, exchange rate or hardware baseline
   in this repository to put one there. So this module publishes
   `ReportedCostUnits`, carrying its unit in its name, and imports
   nothing from `lib/data`.

   Its KEY SET is the Published signatures block's, unchanged —
   `runs`, `median`, `spread { p10, p90 }`, `model`, `excluded`,
   `isSample`. A blind author binds to that block, so renaming a
   field it publishes would red a correct module. Whether the unit
   belongs in the field names instead is asked of the orchestrator
   rather than answered here; it is one interface and one
   return-assembly site either way.

   ── Both error classes are exported ──
   The block lists two functions and two types. A caller that
   cannot name a class cannot branch on it, and
   `RunReportRefusedError` is the one thing a caller most needs to
   tell apart from a fault: a refusal means fix the request, a
   store error means try again. The accounts, saves, counters and
   observability barrels ship the same reasoning.

   ── What is NOT published here ──
   `withStore` stays internal. It is the boundary, not a service:
   an exported wrapper is one a caller outside this folder can wrap
   a foreign statement in and get this module's error class on
   somebody else's fault.

   The statements stay internal, and so do `wellFormed`,
   `submittingAccountId` and the aggregate's arithmetic.
   `submitReport` is the published verb and it carries AC1's three
   checks together; a caller reaching `insertRunReport` would get
   the row written and none of them.

   The message literals and their three renderers are not exported.
   A test importing its expected message from the module under test
   asserts that the module agrees with itself, and goes on passing
   the day the wording starts interpolating something it should
   not.

   ── What this module does NOT do, by ruling ──
   **It writes no audit row and charged no `AUDIT_ACTIONS` member**
   (D-240-03, D-240-11). The reasoning is in `write.ts`: the closed
   set exists so that no action naming a blueprint run can be
   passed, and a synonym that slips the guard would defeat the
   promise the set was closed to keep.

   **It never lands a figure on the 0-100 scorecard axis** and
   never imports `lib/content` or `lib/data`. `lib/content/view.ts`
   putting a real aggregate on a bar is a live defect the moment
   real reports exist, and it is outside this task's `Owns`
   (D-180-01).

   **It imports `lib/server/ballot/**` and `lib/server/counters/**`
   nowhere**, both Forbidden, and nothing there imports this.

   `tests/error-hygiene.test.ts` builds its domain by construction
   over every `lib/server/<module>/index.ts` **on `backend`**, so
   both classes below are measured against D-13's hygiene clause
   from the day this file exists and the published-class equality
   moves — by two — in the MERGE COMMIT and nowhere else. That
   number must be DERIVED from the tree at the merge rather than
   carried: T160 and T180 are computing from the same base this
   wave, blind to each other's modules by construction, and
   whichever merges second faces a different figure than it
   computed.
   ============================================================ */

export type { ReportedCostUnits, RunReport } from "./types";

/* D-13's boundary. Two classes: one sealed fault, and one refusal covering all three
   caller errors this module authors (D-180-03, D-180-04). */
export { RunReportRefusedError, RunReportStoreError } from "./errors";

export { reportedCost } from "./read";
export { submitReport } from "./write";

/* D-120-04: T120's deletion must not orphan run reports at a digest it is about to
   destroy, and it must not write this module's table -- one table, one author. The verb
   is deliberately digest-scoped and transaction-friendly: the caller quantifies over
   `release.digest` ACROSS ALL BUNDLES (an unmodified fork shares the upstream's digest,
   D-05-01, so a surviving fork keeps the reports anchored and this is never called). */
export { forgetReportsAt } from "./store";
