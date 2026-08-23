/* ============================================================
   DarkPrint backend — lib/server/observability public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   ── What is published beyond the block, and why ──

   `AUDIT_ACTIONS` and `AuditAction` are D-240-03's, and the
   constant ships as a VALUE rather than only as a type: the
   promised test is *no action in the live set refers to a run*,
   and a set nothing can enumerate cannot be quantified over. A
   type alone would leave that assertion with nothing to stand on,
   which is the defect the ruling exists to close.

   `AuditRecord` names the intersection the block writes inline at
   `listAudit`. Published on `SaveTarget`'s precedent — without a
   name every consumer retypes the same shape, and a third
   spelling of one shape is what invites drift. It widens nothing.

   The two error classes are exported although the block lists
   functions and types only: a caller that cannot name a class
   cannot branch on it, and `listAudit`'s refusal is the one thing
   a caller most needs to tell apart from a fault — which is AC5
   restated at the module boundary.

   `tests/error-hygiene.test.ts` builds its domain by construction
   over every `lib/server/<module>/index.ts` on `backend`, so both
   classes are measured against D-13's hygiene clause from the day
   this file ships. Its equality moves in the MERGE COMMIT and
   nowhere else — and the number must be DERIVED from the tree at
   that merge rather than carried: T110 publishes two classes this
   wave from the same base, each worktree is blind to the other's
   module by construction, and whichever merges second faces a
   different figure than it computed.

   ── What is NOT published here ──

   `withStore` stays internal. It is the boundary, not a service:
   an exported wrapper is one a caller outside this folder can
   wrap a foreign statement in and get this module's error class
   on somebody else's fault.

   The message literals are not exported either. A test that
   imports its expected message from the module under test asserts
   that the module agrees with itself, and goes on passing the day
   the wording starts interpolating something it should not.
   ============================================================ */

export type { AuditAction, AuditEntry, AuditRecord } from "./types";
export { AUDIT_ACTIONS } from "./types";

/* D-13's boundary. Two classes: one fault, and one decision this module authors. */
export { AuditStoreError, NotPermittedError } from "./errors";

export { writeAudit } from "./write";
export { listAudit } from "./read";
