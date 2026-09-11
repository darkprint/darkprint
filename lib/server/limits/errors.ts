/* ============================================================
   DarkPrint backend — limits: typed rejections
   D-13: no rejection may carry the failed statement or its bound
   parameters. On this task the clause bites twice, and the second
   bite is one the published block calls out by name.

        RateLimitedError  "<bucket>: limit of <n> per <window> reached; resets at <ISO instant>."
        InvalidLabelError "<operation>: `label` is not valid."
        NotKeyOwnerError  "<operation>: not this account's keys."
        LimitsStoreError  "<operation>: the limits store failed."

   ── Why the rate-limit refusal names no subject ──
   The block: *the bucket name, the number, the window and the
   instant. Never the caller's identity, key id or IP — a
   rendering that names the subject makes the refusal itself an
   identity oracle.* That is stronger than ordinary hygiene, and
   it is why `rateLimitedError` takes no subject AT ALL rather
   than taking one and declining to render it. A parameter that
   exists is a parameter somebody interpolates later; the
   factory's signature is what makes the clause structural instead
   of a rule a future editor has to know.

   Each of the four parts is a value this module computed:
   `bucket` is a literal the caller of `checkLimit` supplies from
   a closed set, `n` and the window come from configuration, and
   the instant is derived from the window. None varies with WHO
   asked, so two callers refused on the same bucket in the same
   window get byte-identical renderings — which is precisely what
   stops the refusal separating an anonymous caller from a keyed
   one.

   The limit NUMBER does differ between tiers, and that is
   required by the same sentence rather than a gap in it. It tells
   a caller which ceiling applies to the request it just sent, and
   it says nothing about any other caller.

   ── Why there is no error for an unknown or foreign key ──
   `resolveKey` answers `undefined` for a malformed secret and for
   one naming no row, and `revokeKey` answers the same way for a
   key that is not the actor's. Those are deliberately one answer:
   a caller able to tell them apart learns whether a key exists.
   So there is no `UnknownKeyError` and there must not be one —
   adding a class here would put the oracle back.

   ── How the classes carry data, and the reasoning D-230-09
      overturned ──
   WITHDRAWN, and struck here rather than only corrected below,
   because it read as settled. This file argued that the classes
   carry no data at all: *the message already carries all four
   parts and the route's `detail` IS the message byte for byte, so
   AC1 is satisfied and a field would be an enumerability hazard
   for nothing.* The first half is still true and the conclusion
   is not. **D-230-09 publishes the 429's KEY SET**, and
   `limit`, `remaining` and `resetAt` are members a client parses
   — a sentence a machine has to regex is not a machine-readable
   member. So something has to carry the numbers.

   The enumerability hazard the withdrawn argument named is real
   and is what decides the SHAPE rather than the existence. A
   class FIELD is an own ENUMERABLE property under both class-field
   semantics — `useDefineForClassFields` is unset and `target` is
   ES2017, so a declared field becomes `this.x = ...` in the
   constructor — which puts the verdict into `Object.keys(err)`
   and `JSON.stringify(err)` and breaks D-13's hygiene clause
   directly.

   So the context hangs off a SYMBOL. `Object.keys`,
   `JSON.stringify` and a `{...err}` spread all skip symbol keys,
   which makes the clause hold by construction rather than by
   somebody remembering `enumerable: false` on every future field.

   And the absent case is real rather than defensive:
   `tests/error-hygiene.test.ts` constructs every published class
   directly at one and two arguments, so a `RateLimitedError` with
   no context exists. `rateLimitContext` answers `undefined` for
   it and `withLimitsErrors` re-throws rather than rendering a
   document with holes — an instance this module did not build is
   exactly what that wrapper's last arm is for.

   `name` goes on the prototype, never on the instance, for the
   reason `tests/error-hygiene.test.ts` was written.

   NOTE ON THAT GUARD, measured rather than assumed: its domain is
   `git ls-tree -d --name-only backend lib/server/` — the SHIPPED
   directories. `lib/server/limits` is not among them until T230
   merges, so these FOUR classes are invisible to it here and its
   equality stays at 18 in this worktree. It moves to 22 in the
   merge commit and not in this one.
   ============================================================ */

import type { LimitVerdict } from "./types";

function nameOnPrototype(ctor: { prototype: object }, name: string): void {
  Object.defineProperty(ctor.prototype, "name", {
    value: name,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

/**
 * The base every rejection in this module extends. Exported from this FILE and not from
 * the barrel: `store.ts` needs one `instanceof` to tell a decision this module made from a
 * fault it is wrapping, and three concrete checks would be three places to forget a class.
 *
 * Not published, and that is D-50-21's withdrawn construction avoided rather than
 * rediscovered: a base-class ARM in `withLimitsErrors` would stop the three concrete
 * classes being disjoint siblings, at which point arm order silently becomes load-bearing.
 * `armsNotDisjoint()` in `http.ts` is what measures that rather than asserting it.
 */
export class LimitsError extends Error {
  /**
   * The options bag is passed only when there is a cause. `new Error(m, { cause: undefined })`
   * still INSTALLS `cause`, because the spec installs on `HasProperty` rather than on the
   * value — so every instance would answer true to `hasOwnProperty("cause")` and a test
   * asserting a cause is present would be a guard that cannot fail (T030's `expectCausePresent`).
   */
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
  }
}
nameOnPrototype(LimitsError, "LimitsError");

/** The ceiling was reached. AC1's refusal, and the only one here a caller sees as other than a 500. */
export class RateLimitedError extends LimitsError {}
nameOnPrototype(RateLimitedError, "RateLimitedError");

/** A label failed this module's own predicate. Names the field, never the value. */
export class InvalidLabelError extends LimitsError {}
nameOnPrototype(InvalidLabelError, "InvalidLabelError");

/**
 * The actor is not the owner of the account whose keys it is acting on.
 *
 * Unreachable through this task's routes and published anyway, on T050's
 * `NotAccountOwnerError` precedent: both routes pass `session.accountId`, so `can` compares
 * an id against itself and no HTTP request can produce one. It exists for the barrel, which
 * twelve tasks call in process, and `withLimitsErrors` deliberately gives it no arm — a
 * status for a case no route can reach would publish a code the contract does not list, and
 * if it ever arises it is the session and the row disagreeing, which is a server fault
 * rather than something to tell a client.
 *
 * Its wording names the KEYS rather than the account, and that is deliberate rather than
 * incidental. T050 publishes `"<operation>: not this account's owner."` for a refusal about
 * the account row; one wording with two authors in two modules is the drift D-50-03 charges
 * at a constant, and this is the same hazard at a message. Different refusal, different
 * sentence, one author each.
 */
export class NotKeyOwnerError extends LimitsError {}
nameOnPrototype(NotKeyOwnerError, "NotKeyOwnerError");

/** A database call failed for a reason this module does not name. `cause` carries the original. */
export class LimitsStoreError extends LimitsError {}
nameOnPrototype(LimitsStoreError, "LimitsStoreError");

/**
 * AC1's admissible form, and the ONE author of it.
 *
 * D-230-09 makes `detail` this string byte for byte, and an admissible form is
 * exact-matched, which is its whole purpose. So both surfaces that can produce a 429 —
 * `rateLimited`'s document and `RateLimitedError`'s message — come through here rather
 * than each building the sentence. Two renderings of one refusal is two chances for one of
 * them to start naming the subject.
 *
 * `window` is rendered from the configured milliseconds by `describeWindow` rather than
 * printed raw, because the form says *per <window>* and a caller reading `per 60000` learns
 * a unit nobody stated. The rendering is total over any number and is not a lookup table —
 * a table would be a list, and a window nobody enumerated would render as `undefined`
 * inside a refusal a caller reads.
 *
 * NOT given the subject. See this file's header: the parameter list is the mechanism, not a
 * convention anybody has to remember.
 */
export function rateLimitDetail(
  bucket: string,
  limit: number,
  windowMs: number,
  resetAt: Date,
): string {
  return (
    `${bucket}: limit of ${limit} per ${describeWindow(windowMs)} reached; ` +
    `resets at ${resetAt.toISOString()}.`
  );
}

/**
 * What a `RateLimitedError` carries besides its message, so a wrapper can render D-230-09's
 * published key set from it rather than inventing a second document.
 *
 * Installed NON-ENUMERABLY, which is the whole reason this is a side table rather than two
 * class fields. `useDefineForClassFields` is unset and `target` is ES2017, so a declared
 * field becomes `this.x = ...` in the constructor and is an own enumerable property — which
 * puts the verdict into `Object.keys(err)` and `JSON.stringify(err)` and breaks D-13's
 * hygiene clause directly.
 */
export interface RateLimitContext {
  readonly bucket: string;
  /** The whole verdict, unsplit. D-230-10: one object, one source, no room to disagree. */
  readonly verdict: LimitVerdict;
}

const CONTEXT = Symbol("darkprint.rateLimitContext");

/**
 * AC1's rejection, carrying enough for a wrapper to build the published 429.
 *
 * The context hangs off a symbol rather than a named property, so nothing enumerating,
 * spreading or serialising the error can reach it even by name — `Object.keys`,
 * `JSON.stringify` and a `{...err}` spread all skip symbol keys, which makes the hygiene
 * clause hold by construction rather than by remembering `enumerable: false`.
 */
export function rateLimitedError(bucket: string, verdict: LimitVerdict): RateLimitedError {
  const err = new RateLimitedError(
    rateLimitDetail(bucket, verdict.limit, verdict.windowMs, verdict.resetAt),
  );
  Object.defineProperty(err, CONTEXT, {
    value: { bucket, verdict } satisfies RateLimitContext,
    enumerable: false,
  });
  return err;
}

/**
 * The context, or `undefined` for an instance this module did not build.
 *
 * Total rather than optimistic, and the absent case is reachable: `tests/error-hygiene.test.ts`
 * constructs every published class directly at one and two arguments, so a
 * `RateLimitedError` with no context exists and a reader assuming one would throw inside a
 * guard measuring hygiene. A wrapper handed one of those does not know what it is looking at
 * and must say so rather than render a document with holes in it.
 */
export function rateLimitContext(err: RateLimitedError): RateLimitContext | undefined {
  const value = (err as unknown as Record<symbol, unknown>)[CONTEXT];
  return value === undefined ? undefined : (value as RateLimitContext);
}

/**
 * Milliseconds as the largest whole unit that divides them, else as seconds.
 *
 * Derived rather than looked up: `3600000` is `hour`, `60000` is `minute`, `90000` is
 * `90 seconds`. A configured window this cannot describe does not exist, because every
 * branch ends in a seconds rendering — which is what stops a window nobody thought of
 * reaching a caller as `undefined`.
 */
export function describeWindow(windowMs: number): string {
  const seconds = windowMs / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0) return `${windowMs}ms`;
  for (const [size, unit] of [[86400, "day"], [3600, "hour"], [60, "minute"]] as const) {
    if (seconds % size === 0) {
      const n = seconds / size;
      return n === 1 ? unit : `${n} ${unit}s`;
    }
  }
  return seconds === 1 ? "second" : `${seconds} seconds`;
}

/**
 * `field` is this module's own literal and never a key off a caller-supplied object. There
 * is exactly one writable field on this surface, so the type is a single-member union
 * rather than a `string` — which is what makes "names the field, never the value"
 * structural. D-70-23's argument: a single member is publishable precisely when it is
 * structural rather than incidental, and a second literal has to be added deliberately.
 */
export type LimitsField = "label";

export function invalidLabelError(operation: string, field: LimitsField): InvalidLabelError {
  return new InvalidLabelError(`${operation}: \`${field}\` is not valid.`);
}

export function notKeyOwnerError(operation: string): NotKeyOwnerError {
  return new NotKeyOwnerError(`${operation}: not this account's keys.`);
}

export function limitsStoreError(operation: string, cause: unknown): LimitsStoreError {
  return new LimitsStoreError(`${operation}: the limits store failed.`, cause);
}
