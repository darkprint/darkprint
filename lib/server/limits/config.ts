/* ============================================================
   DarkPrint backend — limits: the numbers, and who owns them
   B-17 reverses D-83 and the block states the cost explicitly:
   *an unkeyed MCP or crawler client hits a ceiling, so the
   product's discoverability by agents depends on that ceiling
   being generous.* That makes the ceilings a PRODUCT decision,
   and the block is equally explicit that they are not this
   task's: **the ceiling values are `TBD:` and the task must not
   invent them.**

   So this file publishes the SHAPE and leaves the values open. A
   `TBD:` that names a type is bindable — a blind suite can hold
   every property that is not a number — and a `TBD:` that names
   only the question is not.

   What is bindable today, and none of it needs a value:

     - a keyed subject's `limit` is >= an account's, and an
       account's is >= an anonymous one's, for the same bucket.
       AC3's "raises the ceiling" is an ORDERING, and an ordering
       is falsifiable against numbers nobody has chosen.
     - `remaining` is `limit` minus the count, floored at 0 and
       never negative.
     - `resetAt` is the window's start plus its length.
     - an unknown bucket REFUSES.

   ── The unknown bucket refuses, and that is the point of it ──
   A config lookup returning `undefined`, read as *no limit*, is a
   criterion satisfiable by never limiting anything — D-70-18's
   shape, at a `Record` index. AC2 says limits are enforced
   server-side regardless of any client cap, and a bucket that
   silently has no ceiling is the one place that criterion would
   be false with nothing to show it. `limitFor` therefore answers
   `undefined` and `checkLimit` treats that as a refusal, so
   adding a bucket without a number is loud rather than free.

   ── Why this is a value and not an import from somewhere ──
   The owner has not chosen the numbers, so there is nothing to
   read out of an environment or a table yet. `checkLimit` takes
   the config as an argument with this module's own as the
   default, which is what makes the numbers replaceable without
   editing a call site — the property the ruling asked for.
   ============================================================ */

/**
 * The three ceilings a subject can be under, in increasing order of generosity.
 *
 * Ordered deliberately: `TIER_ORDER` below derives AC3's ordering assertion from this
 * declaration rather than from a second list, so a fourth tier cannot be added without the
 * ordering check covering it.
 */
export type Tier = "anonymous" | "account" | "key";

/** The tiers, weakest ceiling first. The ordering AC3 asserts is over this sequence. */
export const TIER_ORDER = ["anonymous", "account", "key"] as const satisfies readonly Tier[];

/** One ceiling: how many requests, over how long a fixed window. */
export interface BucketLimit {
  readonly limit: number;
  readonly windowMs: number;
}

/** bucket -> tier -> numbers. Every bucket names all three tiers or the missing one refuses. */
export type LimitConfig = Readonly<Record<string, Readonly<Record<Tier, BucketLimit>>>>;

/**
 * The 512 KB cap on one uploaded file, TRANSCRIBED from `components/upload/BundleDropzone.tsx`.
 *
 * D-230-02: *consumed not restated* was unsatisfiable as written, because `MAX_KB = 512` is a
 * module-private `const` in a client component and is exported from nothing — so the only
 * available act was the one the clause forbade. Amended to transcription plus a drift guard,
 * and **the guard is T230's blind author's**, written against the contract's premise rather
 * than against this module.
 *
 * Spelled in KILOBYTES rather than bytes so the pin is against the cited site's own number
 * rather than through an arithmetic conversion. A guard comparing `512` to `512` reds on a
 * drift; one comparing `524288` to `512 * 1024` is asserting that multiplication works.
 */
export const MAX_UPLOAD_KB = 512;

/**
 * The card `params` nesting depth of 100, TRANSCRIBED from `lib/core/card/validate.ts`.
 *
 * Same amendment and the same reason: `MAX_PARAM_DEPTH` is module-private there and
 * `lib/core/**` is Forbidden here in any case. Transcribed at the same spelling so the drift
 * guard compares one number against one number.
 */
export const MAX_PARAM_DEPTH = 100;

/**
 * TBD: the owner's, and the block says the task must not invent them.
 *
 * **The two transcribed numbers above are deliberately NOT in this table**, and the reason
 * is that they are different quantities rather than that nobody got round to it. One is a
 * byte size and one is a nesting depth; this table is requests per window. Putting either
 * here would be the adjacent-quantity substitution this run charges — a proxy quoted for the
 * claim it resembles — and it would let a reader conclude the owner had chosen a rate.
 *
 * Empty rather than populated with placeholders, and the emptiness is load-bearing: a
 * placeholder ceiling is a number somebody reads as decided, and `limitFor` refusing an
 * unconfigured bucket (D-230-04) means an empty table cannot be mistaken for a permissive
 * one. A caller wiring a route before the owner rules gets a refusal it has to notice, which
 * is the direction D-05-09 demands — loud rather than silent.
 */
export const DEFAULT_LIMITS: LimitConfig = {};

/**
 * The ceiling for one bucket at one tier, or `undefined` when nobody configured it.
 *
 * `Object.hasOwn` on both levels rather than a bare index read. `LimitConfig` is a
 * `Record` over caller-reachable strings, so `limitFor(config, "constructor", "key")`
 * would otherwise read `Object.prototype.constructor` and answer a FUNCTION where the
 * type says `BucketLimit` — a prototype read reaching a decision, which is T060's
 * never-inherit ruling at a config lookup rather than at an `Actor`. The failure is not
 * theoretical: a bucket name is a string and the whole point of this function is that an
 * unrecognised one refuses.
 */
export function limitFor(config: LimitConfig, bucket: string, tier: Tier): BucketLimit | undefined {
  if (!Object.hasOwn(config, bucket)) return undefined;
  const forBucket = config[bucket];
  if (forBucket === undefined || !Object.hasOwn(forBucket, tier)) return undefined;
  return forBucket[tier];
}

/**
 * Which ceiling a subject is under. A key outranks an account, an account outranks nobody.
 *
 * Note what decides `"key"`: a `keyId`, which only `resolveKey` produces and only for a
 * key that exists and is not revoked. So AC4's "a revoked key is refused immediately"
 * reaches this function as an absent `keyId` rather than as a flag anybody checks here.
 */
export function tierOf(subject: { accountId: string | null; keyId: string | null }): Tier {
  if (subject.keyId !== null) return "key";
  if (subject.accountId !== null) return "account";
  return "anonymous";
}
