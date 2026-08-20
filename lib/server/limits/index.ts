/* ============================================================
   DarkPrint backend — lib/server/limits public surface
   `lib/db/index.ts`'s rule: deep paths are internal and may be
   rearranged, so nothing outside this folder should reach for
   one. Re-exports are written out by name rather than `export *`
   so this file doubles as the inventory of what the module
   promises.

   The published block names four functions and two types. What
   is exported beyond them, and why each is here rather than
   inside:

   `enforceLimit` — the wrapping form of `checkLimit`. T000
   published `withSession` as a wrapper rather than a function
   returning `payload | Response` because a guard returning a
   union depends on every caller checking it. A verdict whose
   refusal is a boolean field has that shape, and AC2 is the
   criterion a forgotten check makes false.

   `withLimitsErrors`, `readJsonObject` — the transport boundary.
   Here rather than beside the routes because a mapping applied
   at each route is a mapping with a route that forgot it; T050
   and T081 put theirs in the same place for the same reason.

   `armsNotDisjoint` — exported so its own test can call it. It
   is an assertion this module makes about itself.

   The four error classes are exported although the block lists
   only functions and types: a caller that cannot name a class
   cannot branch on it. **`LimitsError`, the base, is NOT here.**
   A base on the barrel is a base a wrapper can grow an arm for,
   and that arm stops the four concrete classes being disjoint
   siblings — D-50-21's withdrawn construction. `store.ts` uses
   it internally, which is the only place it is needed.

   The message literals are NOT exported. A test that imports its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.

   `tests/error-hygiene.test.ts` builds its domain by
   construction over every `lib/server/<module>/index.ts`, so
   these four classes are measured against D-13's hygiene clause
   from the day this file ships. Measured, not assumed: that
   guard's domain is `git ls-tree -d backend lib/server/`, so
   `lib/server/limits` enters it at T230's MERGE and not before.
   Its equality moves from 18 to 22 in the merge commit.
   ============================================================ */

/* --------------------- the numbers --------------------- */
export type { BucketLimit, LimitConfig, Tier } from "./config";
export { DEFAULT_LIMITS, TIER_ORDER, limitFor, tierOf } from "./config";

/* D-230-02: the contract's two starting numbers, TRANSCRIBED rather than consumed, because
   both are module-private `const`s exported from nothing and the clause as written had no
   satisfiable act. The drift guard that pins them against the two cited sites is T230's
   blind author's, and is a guard on the contract's premise rather than on this module. */
export { MAX_PARAM_DEPTH, MAX_UPLOAD_KB } from "./config";

/* --------------------- the counter's own bound --------------------- */
export type { SlotCounter, SlotCounterOptions } from "./counter";
export {
  BYTES_PER_SLOT,
  DEFAULT_SLOTS,
  MAX_COUNTER_BYTES,
  MAX_SUBJECT_CHARS,
  createSlotCounter,
} from "./counter";

/* --------------------- the verdict --------------------- */
export type { LimitSubject, LimitVerdict } from "./types";
export type { CheckLimitOptions } from "./check";
export { checkLimit, enforceLimit } from "./check";

/* --------------------- keys --------------------- */
export type { ApiKeyRecord } from "./keys";
export { MAX_LABEL_LENGTH, issueKey, resolveKey, revokeKey } from "./keys";
export { SECRET_LENGTH, SECRET_PREFIX } from "./secret";

/* --------------------- D-13's boundary --------------------- */
export type { RateLimitContext } from "./errors";
export {
  InvalidLabelError,
  LimitsStoreError,
  NotKeyOwnerError,
  RateLimitedError,
  rateLimitContext,
} from "./errors";

/* --------------------- the transport boundary --------------------- */
export { armsNotDisjoint, rateLimited, readJsonObject, withLimitsErrors } from "./http";
