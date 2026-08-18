/* ============================================================
   DarkPrint backend — the engine service's size guards
   AC4: an oversized submission is refused *before parsing*, with
   the limit named. The criterion is the ordering, not the refusal
   — a submission refused after `loadBundle` has run still refuses,
   still names the limit, and has already done the exact work the
   limit exists to prevent.

   Two of the three limits can hold that ordering and one cannot.
   `maxBytes` and `maxCards` are properties of the arguments;
   `maxNodes` is a property of the *parsed* DOT, so it is a
   post-parse refusal by ruling rather than a weaker version of the
   same check (D-40-06). Stated here because the difference is
   invisible at the call site and a later reader would otherwise
   read the node guard's position as an oversight.

   `maxCards` and `maxNodes` belong to `validateBundle` alone
   (D-40-16). A sibling takes one document, so a card count is
   meaningless there, and `validateDot` does not enforce `maxNodes`
   even though it parses a graph — a limit enforced in two places
   is two limits.
   ============================================================ */

/**
 * The three bounds, each optional: an absent field takes its default rather than
 * meaning "unbounded", so a caller tightening one does not silently remove the other two.
 */
export interface EngineLimits {
  maxBytes?: number;
  maxCards?: number;
  maxNodes?: number;
}

/**
 * The bounds that apply when a caller passes none.
 *
 * Chosen against the archive rather than picked: absent limits must let all nine bundles
 * through, or AC1 (the nine reproduce the build) and AC4 (an oversized submission is
 * refused) contradict each other at the default. The archive's maxima, measured through
 * this module's own entry point rather than off the filesystem, are 17 963 bytes, 9 card
 * files and 9 nodes. Every bound below clears its maximum by at least fifty times, which
 * is headroom for a submission far larger than anything the archive holds while still
 * refusing the pathological one.
 *
 * The criterion these satisfy is a **property, not three numbers**: every archive bundle
 * passes with `limits` omitted, and each default exceeds the archive's maximum. A test
 * pinning the constants would move with them and stop being a bound, which is D-70-17's
 * note about `MAX_NAME_LENGTH` arriving here.
 *
 * T230 owns these numbers in the end (B-17). It changes this constant and nothing else.
 */
export const DEFAULT_ENGINE_LIMITS: Required<EngineLimits> = {
  maxBytes: 2 * 1024 * 1024,
  maxCards: 500,
  maxNodes: 500,
};

/**
 * The one rejection this module throws. Everything else it has to say about a submission
 * is a `Diagnostic`, because a bundle that resolves with errors is an answer (B-03) — a
 * submission too large to look at is not, since there is no answer to give.
 *
 * Two properties of the constructor are load-bearing and neither is style.
 *
 * `limit` and `units` are readable and **non-enumerable** (D-40-15). D-13's hygiene clause
 * requires `Object.keys` empty and `JSON.stringify` exactly `"{}"` for every class
 * published from `lib/server/**`, and `tests/error-hygiene.test.ts` builds its domain by
 * construction over every directory there — so this class is measured the day it merges,
 * with no list for anyone to forget to add to. A plain `this.limit =` renders as
 * `{"limit":…,"units":…}` and fails it, which is exactly how `ArchiveConflictError` broke
 * after merging and being tagged.
 *
 * Every parameter has a runtime default because that same guard **constructs each class
 * itself**, with one argument and with two, and treats a class it cannot construct as a
 * hard error rather than a skip. A required parameter would make this class report
 * *hygiene is unmeasured* instead of passing.
 */
export class LimitExceededError extends Error {
  constructor(
    operation: string = "validate",
    what: string = "the submission",
    limit: number = 0,
    units: string = "bytes",
  ) {
    super(`${operation}: ${what} exceeds the limit of ${limit} ${units}.`);
    /* `cause` is defined unconditionally, matching the merged modules, so the own-property
       set does not vary with the call site. Nothing here wraps a driver error — there is no
       database and no driver on this path — so its value is always `undefined`; what the
       clause is about is that it renders as nothing either way. */
    define(this, "cause", undefined);
    define(this, "limit", limit);
    define(this, "units", units);
  }
}
LimitExceededError.prototype.name = "LimitExceededError";

/** Present, readable, invisible to every rendering. */
function define(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

/** A caller's partial bounds over the defaults. */
export function resolveLimits(limits?: EngineLimits): Required<EngineLimits> {
  return {
    maxBytes: limits?.maxBytes ?? DEFAULT_ENGINE_LIMITS.maxBytes,
    maxCards: limits?.maxCards ?? DEFAULT_ENGINE_LIMITS.maxCards,
    maxNodes: limits?.maxNodes ?? DEFAULT_ENGINE_LIMITS.maxNodes,
  };
}

/**
 * The measured size of a whole submission (D-40-17).
 *
 * `Buffer.byteLength(JSON.stringify(...), "utf8")` is the ruled formula, and it is ruled
 * because three readers measuring "the input" got three answers hundreds of bytes apart.
 * `lib/server/**` is not isomorphic, so `Buffer` is available here; `lib/core` remains the
 * place that may not use it.
 *
 * The caller passes the submitted halves only. `ValidateBundleInput.ontology` is
 * deliberately not among them — see `submissionOf` in `validate.ts` for why measuring it
 * would charge a caller for the vocabulary it resolves against.
 */
export function byteLengthOf(submission: unknown): number {
  return Buffer.byteLength(JSON.stringify(submission), "utf8");
}

/** The measured size of one document, for the three siblings, which are handed bytes. */
export function documentBytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function refuse(operation: string, what: string, limit: number, units: string): never {
  throw new LimitExceededError(operation, what, limit, units);
}

/** The pre-parse byte guard. Applies at all four entry points (D-40-16). */
export function guardBytes(
  operation: string,
  measured: number,
  limits: Required<EngineLimits>,
): void {
  if (measured > limits.maxBytes) refuse(operation, "the submission", limits.maxBytes, "bytes");
}

/**
 * The pre-parse card-count guard. `validateBundle`'s alone.
 *
 * `Object.keys` on the record, before anything reads a value — so a refusal here is a
 * refusal that opened no card file.
 */
export function guardCards(count: number, limits: Required<EngineLimits>): void {
  if (count > limits.maxCards) {
    refuse("validateBundle", "the card count", limits.maxCards, "cards");
  }
}

/** The post-parse node guard (D-40-06). `validateBundle`'s alone, and the only late one. */
export function guardNodes(count: number, limits: Required<EngineLimits>): void {
  if (count > limits.maxNodes) {
    refuse("validateBundle", "the node count", limits.maxNodes, "nodes");
  }
}
