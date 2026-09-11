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
/* `tierOf` is GONE rather than trivial (T231). `LimitSubject` carries its tier, so the body
   would be `subject.tier` — and the name would still say *derived* to a reader looking for
   the rule. Off the barrel as well as out of the file: an exported `tierOf` hands a caller a
   `Tier` detached from the subject it came from, which is a second source for the quantity
   the union exists to carry once. */
export { DEFAULT_LIMITS, TIER_ORDER, limitFor } from "./config";

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
/* `ResolvedKey` is exported as a TYPE and has no value form anywhere, which is the point.
   Its brand is a `unique symbol` `types.ts` declares and does not export, so a caller can
   NAME the type — it has to, to hold what `resolveKey` answered — and cannot construct one.
   There is deliberately no `asResolvedKey` on this barrel or in this module: a published
   mint would be the compile error with an escape hatch beside it. */
export type {
  ApiKeyRecord,
  IssuedKey,
  KeyList,
  KeyScope,
  LimitSubject,
  LimitVerdict,
  ResolvedKey,
} from "./types";
/* The scope vocabulary as values, because a route reading `scope` out of a JSON body has an
   `unknown` and needs to narrow it. Published for D-50-03's reason at a constant: the
   alternative is `v === "read" || v === "write"` written at each caller, which is the
   vocabulary copied to a second place, and the copy that goes stale is the one furthest from
   the column. */
export { KEY_SCOPES, isKeyScope } from "./types";
export type { CheckLimitOptions } from "./check";
export { checkLimit, enforceLimit } from "./check";

/* --------------------- keys --------------------- */
export { MAX_LABEL_LENGTH, issueKey, listKeys, resolveKey, revokeKey, revokeKeysFor } from "./keys";
/* `writeActorFor` is the ONLY published path from a key to an `Actor`, and it is here rather
   than beside `actorFrom` in `@/lib/server/accounts` because the decision it makes is about
   this module's row: whether the key is live and whether its scope says write. There is
   deliberately no synchronous form and no `asWriteActor(key)` that trusts the brand — that
   would be exactly the affordance the second read exists to remove, the compile error with
   an escape hatch beside it, which is the reason `types.ts` gives for publishing no
   `asResolvedKey` either. */
export { writeActorFor } from "./keys";
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
