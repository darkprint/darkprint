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

/** One hour, the window every ruled ceiling is measured over. */
const HOUR = 60 * 60 * 1000;

/**
 * A cell that is refused rather than sized, written out rather than left absent.
 *
 * The alternative was `Partial<Record<Tier, BucketLimit>>` with an ABSENT tier refusing,
 * and it was declined for the reason this module already applies one level up: **an absent
 * cell and a deliberately-refused cell would read identically at the type.** `limitFor`
 * refusing an unconfigured BUCKET is what stops emptiness reading as permissive; the same
 * argument says a tier nobody sized and a tier ruled unreachable must not look alike to a
 * reader either. So the map stays TOTAL over `Tier` and this is what a closed cell says.
 *
 * `limit: 0` and not a flag: `checkLimit` answers `allowed: count <= limit`, and the first
 * request already counts 1, so zero refuses every request through the ordinary path rather
 * than through a branch that exists only for this. One arithmetic, no special case.
 */
const REFUSED: BucketLimit = { limit: 0, windowMs: HOUR };

/**
 * How long a caller is told to stay away from a bucket nobody configured (F-230-M).
 *
 * **Not a ceiling and not a window, and that is why this task may choose it.** `limit` is 0
 * for this case, so nothing is rationed and no rate is being invented — the number answers
 * *when is it worth coming back*, and for a bucket absent from the table the honest answer
 * is "not without a deploy". A year is the nearest thing to that a `Date` can carry.
 *
 * **It is deliberately unlike every configured window.** Those are all an hour, so
 * `describeWindow` renders this one as `365 days` and the refusal identifies itself:
 * `limit of 0 per 365 days` is not a ceiling anybody would set, where `limit of 0 per hour`
 * is exactly what `REFUSED` above renders and would have read to the developer who mistyped
 * a bucket name as a closure somebody decided on. D-230-04's intent is that adding a bucket
 * without a number is LOUD rather than free, and an ordinary-looking refusal is the opposite.
 *
 * **Not on the barrel.** Publishing it would invite
 * `verdict.windowMs === UNCONFIGURED_BACKOFF_MS` as a way to detect the case, which is a
 * second spelling of a condition the verdict already answers with `allowed: false` — and a
 * second spelling is what drifts.
 */
export const UNCONFIGURED_BACKOFF_MS = 365 * 24 * HOUR;

/**
 * The ceilings, CONFIRMED by the owner on 2026-08-20 and generous by design.
 *
 *                   anonymous     account         key
 *     read            600 / h     600 / h     6 000 / h
 *     write           refused     120 / h       120 / h
 *     upload          refused      30 / h        30 / h
 *
 * **Nothing here was invented.** The owner ruled four quantities — anonymous read, keyed
 * read, keyed write, and upload — and this task reported that four quantities fill three of
 * nine cells rather than placing the other six itself. The full matrix came back from the
 * party entitled to decide it.
 *
 * **`account` reads at the ANONYMOUS rate, and that makes AC3 literal.** *A valid API key
 * raises the ceiling* becomes the key's entire effect — ten times on reads and nothing else.
 * A middle ceiling for signed-in callers was put to the owner and declined: it would have
 * been a number nobody ruled, and it weakens the only reason to register a key.
 *
 * **`anonymous` write and upload are refused BY CONSTRUCTION rather than set low.** Both
 * need a session, so those cells cannot be reached at all; the value records a closed door
 * and not a stingy allowance.
 *
 * **`upload` is `account` and above**, which is a decision rather than an inference. B-17's
 * stated cost is precisely about not surprising an unkeyed client, so refusing every unkeyed
 * upload was not something this task could read off the four ruled numbers — it flagged the
 * 30/hour as a figure it knew and could not place, and the placing came from the owner.
 *
 * **`limitFor` still refuses every bucket outside this table** (D-230-04), so populating it
 * does not make an unnamed bucket permissive. That property was the reason emptiness was
 * safe and it survives the emptiness ending.
 */
export const DEFAULT_LIMITS: LimitConfig = {
  read: {
    anonymous: { limit: 600, windowMs: HOUR },
    account: { limit: 600, windowMs: HOUR },
    key: { limit: 6_000, windowMs: HOUR },
  },
  write: {
    anonymous: REFUSED,
    account: { limit: 120, windowMs: HOUR },
    key: { limit: 120, windowMs: HOUR },
  },
  upload: {
    anonymous: REFUSED,
    account: { limit: 30, windowMs: HOUR },
    key: { limit: 30, windowMs: HOUR },
  },
};

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
