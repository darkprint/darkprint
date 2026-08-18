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
 * A submission carrying a reference cycle, which cannot be measured at all.
 *
 * D-40-C: `JSON.stringify` answers this with a bare `TypeError`, from a module that
 * publishes exactly one throw. A cycle is a fact about the caller's input and deserves a
 * refusal that says so, so D-40-20 requires a typed one.
 *
 * **The class name and message form are the implementer's proposal, not published contract.**
 * D-40-20 ruled that the refusal is typed and did not say what type. Reported as owed; if
 * the blind suite pins another name this is the line that changes.
 *
 * Unreachable through every route — `request.json()` is `JSON.parse`, which cannot produce
 * a cycle — and reachable through the barrel, which is what T100, T263 and T270 use.
 */
export class CircularReferenceError extends Error {
  constructor(operation: string = "validate") {
    super(`${operation}: the submission contains a circular reference.`);
    define(this, "cause", undefined);
  }
}
CircularReferenceError.prototype.name = "CircularReferenceError";

/**
 * The measured size of a whole submission, and its refusal, fused into one walk (D-40-20).
 *
 * `Buffer.byteLength(JSON.stringify(input), "utf8")` is normative as a **number** and not as
 * a **procedure**: the criterion says which submissions are refused, not how the size is
 * computed. Running the literal formula was the defect — it materialises the whole
 * submission to decide it is too large, so a depth-25 diamond over 26 objects threw a bare
 * `RangeError`, and below that it allocated up to 386 MB of transient heap to conclude that
 * a submission exceeds 2 MB. The limit performed the exhaustion the limit exists to prevent.
 *
 * This walk accumulates and stops the instant the running total passes `maxBytes`. Every
 * step adds at least one byte — a brace, a bracket, a comma, a quote — so the number of
 * steps is bounded by the limit rather than by the shape of the input graph, and the cost
 * becomes O(`maxBytes`) whatever the caller sends.
 *
 * **The number is preserved exactly for every submission that is accepted.** Past the bound
 * only the comparison is ever needed, which is why bounding it costs the contract nothing;
 * below the bound this returns the same integer the formula does, and
 * `measure.test.ts` holds that as a differential property rather than as an assurance.
 *
 * **No `seen` set for the size**, deliberately: memoising a shared subtree would count it
 * once where `JSON.stringify` counts it per path, and that changes the number for exactly
 * the inputs this was written for. The `open` set below is path-scoped and detects a
 * **cycle**, which is a different question and the one that has no answer at all.
 */
export function measureSubmission(
  operation: string,
  submission: unknown,
  limits: Required<EngineLimits>,
): number {
  const budget = { total: 0 };
  const spend = (bytes: number): void => {
    budget.total += bytes;
    if (budget.total > limits.maxBytes) {
      refuse(operation, "the submission", limits.maxBytes, "bytes");
    }
  };
  measure(submission, spend, new Set<object>(), operation);
  return budget.total;
}

/** `JSON.stringify`'s own byte accounting, one value at a time. */
function measure(
  value: unknown,
  spend: (bytes: number) => void,
  open: Set<object>,
  operation: string,
): void {
  /* `toJSON` first, exactly as `JSON.stringify` does, or a `Date` on a manifest would be
     measured as an object with no keys where the formula measures a quoted string. */
  const resolved = unwrap(value);

  if (resolved === null) return spend(4);
  const kind = typeof resolved;
  if (kind === "string") return spend(Buffer.byteLength(JSON.stringify(resolved), "utf8"));
  if (kind === "number") {
    /* A non-finite number serialises as `null`, not as `NaN`. */
    return spend(Number.isFinite(resolved) ? String(resolved).length : 4);
  }
  if (kind === "boolean") return spend(resolved === true ? 4 : 5);
  if (kind !== "object") {
    /* `bigint` throws out of `JSON.stringify` and still does; `undefined`, functions and
       symbols never reach here, because both containers below handle them in the two
       different ways the serialiser does. */
    return spend(Buffer.byteLength(JSON.stringify(resolved) ?? "", "utf8"));
  }

  const container = resolved as object;
  if (open.has(container)) throw new CircularReferenceError(operation);
  open.add(container);
  try {
    if (Array.isArray(container)) {
      spend(2);
      for (let i = 0; i < container.length; i += 1) {
        if (i > 0) spend(1);
        const entry = container[i] as unknown;
        /* In an array these three serialise as `null`; in an object they are dropped. */
        if (entry === undefined || typeof entry === "function" || typeof entry === "symbol") {
          spend(4);
        } else {
          measure(entry, spend, open, operation);
        }
      }
      return;
    }

    spend(2);
    let written = 0;
    for (const key of Object.keys(container)) {
      const entry = (container as Record<string, unknown>)[key];
      if (entry === undefined || typeof entry === "function" || typeof entry === "symbol") {
        continue;
      }
      if (written > 0) spend(1);
      written += 1;
      spend(Buffer.byteLength(JSON.stringify(key), "utf8") + 1);
      measure(entry, spend, open, operation);
    }
  } finally {
    /* Path-scoped: leaving the container makes it legal again on a different path, which is
       what keeps legitimate shared substructure from reading as a cycle. */
    open.delete(container);
  }
}

/** `JSON.stringify` calls `toJSON` before looking at anything else. So does this. */
function unwrap(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const candidate = (value as { toJSON?: unknown }).toJSON;
  return typeof candidate === "function"
    ? (candidate as () => unknown).call(value)
    : value;
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
