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

/* The boxed-primitive question `SerializeJSONProperty` asks, asked of the runtime rather
   than of a forgeable rendering or of a thrown exception. See `unbox`, and D-40-F. */
import { types } from "node:util";

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
 * refused) contradict each other at the default. The archive's maxima, measured through this
 * module's own entry point, which is what `measure.test.ts` computes: largest submission
 * 17 947 bytes with each bundle's own extensions, 18 195 with the shared vocabulary applied
 * to all nine; most cards 9, most nodes 9. The 17 963 that stood here reproduces under no
 * reading and is WITHDRAWN. Every bound below clears its maximum by at least fifty times,
 * which is headroom for a submission far larger than anything the archive holds while still
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
 * A submission carrying a value `JSON.stringify` will not serialise (D-40-23).
 *
 * The branch below used to let the serialiser throw naturally, with a comment calling that
 * *the serialiser's own behaviour rather than a decision taken here*. It is a decision: a
 * bare `TypeError` escaped a module whose every other rejection is typed and sealed, and
 * `tests/error-hygiene.test.ts` cannot see it, because a `TypeError`'s own hygiene is
 * perfect. That is `CircularReferenceError`'s situation exactly, one ruling later.
 *
 * **The value is never named**, which is the clause the size refusal already carries and for
 * the same reason: a refusal about an input is the last place that input's own content
 * belongs. Nor is the key it sat under, nor the submission it came from.
 *
 * **Scope, because the widest reading of the ruling would be wrong.** This is raised where
 * the serialiser refuses a value it cannot represent. It is **not** raised when the caller's
 * own code throws — a `toString` that throws propagates untouched, because `JSON.stringify`
 * propagates it too and relabelling it would name a refusal the caller never got and lose
 * the only true thing it had.
 *
 * Barrel-only, and that is not a reason to leave it untyped: `JSON.parse` produces no
 * bigints, and T100, T263 and T270 consume this barrel in-process.
 */
export class UnserializableValueError extends Error {
  constructor(operation: string = "validate") {
    super(`${operation}: the submission contains a value JSON cannot serialise.`);
    define(this, "cause", undefined);
  }
}
UnserializableValueError.prototype.name = "UnserializableValueError";

/**
 * The deepest nesting this walk will hold frames for, before refusing as a typed error.
 *
 * D-40-D requires a ceiling as well as a shape, because an iterative walk over a deeply
 * nested body still runs — it stops exhausting the call stack and starts consuming heap.
 *
 * **10 000 is chosen so that no input which previously produced a number stops producing
 * one.** The recursive walk it replaces died at a *host-dependent* boundary — 7 000 reached
 * directly, 3 000 through a route, varying with stack size and frame layout — and that is
 * the half D-40-D calls untestable as a threshold: the same bytes answered or crashed
 * depending on where they arrived. This ceiling is above every observed crash point, so the
 * change is strictly an improvement in both directions. Everything that used to be measured
 * still is, everything that used to crash now refuses, and the boundary is a property of the
 * input rather than of the host.
 *
 * It is not `EngineLimits`' fourth field. That interface is published with three, T230 owns
 * the numbers in it, and a depth bound is a property of what this procedure can hold rather
 * than a product decision about what a submission may contain.
 *
 * Note where it does and does not bind: every container costs at least two bytes, so a
 * submission nested deeper than `maxBytes / 2` is refused on size before depth is ever
 * reached — at the 2 MiB default that is about a million levels. So this ceiling binds only
 * between 10 000 and that, and for a caller that raised `maxBytes`.
 */
export const MAX_NESTING_DEPTH = 10_000;

/**
 * The measured size of a whole submission, and its refusal, fused into one walk (D-40-20).
 *
 * `Buffer.byteLength(JSON.stringify(input), "utf8")` is normative as a **number** and not as
 * a **procedure**: the criterion says which submissions are refused, not how the size is
 * computed. Running the literal formula was the original defect — it materialises the whole
 * submission to decide it is too large, so a depth-25 diamond over 26 objects threw a bare
 * `RangeError`, and below that it allocated up to 386 MB of transient heap to conclude that
 * a submission exceeds 2 MB. The limit performed the exhaustion the limit exists to prevent.
 *
 * This walk accumulates and stops the instant the running total passes `maxBytes`. Every
 * step adds at least one byte — a brace, a bracket, a comma, a quote — so the number of
 * steps is bounded by the limit rather than by the shape of the input graph, and the cost
 * becomes O(`maxBytes`) whatever the caller sends.
 *
 * **It is ITERATIVE, and that is D-40-D rather than a preference.** The first version was
 * recursive, which closed D-40-B in breadth and left it open in depth: a 6 134-byte body —
 * 0.3% of the default — whose manifest nested threw a bare `RangeError` through the route,
 * where the formula it replaced answers the same input and keeps answering to depth 10^6.
 * D-40-20 bought the substitution with *the number is preserved exactly for every submission
 * that is accepted*, and a stack overflow produces no number at all: the clause was silent
 * there rather than violated, which is the harder kind of gap to see. The precedent was in
 * this repository the whole time — T010 and T020 made `isWellFormedDeep` iterative with one
 * mutable `open` set and explicit enter/leave frames — and reaching for recursion is the
 * default that a written-down countermeasure does not interrupt.
 *
 * **The number is preserved exactly for every submission that is accepted.** Past the bound
 * only the comparison is ever needed, which is why bounding it costs the contract nothing;
 * below the bound this returns the same integer the formula does, and `measure.test.ts`
 * holds that against a corpus **generated over the serialiser's equivalence classes** rather
 * than listed, which is D-40-E.
 *
 * **No `seen` set for the size**, deliberately: memoising a shared subtree would count it
 * once where `JSON.stringify` counts it per path, and that changes the number for exactly
 * the inputs this was written for. The `open` set is path-scoped and detects a **cycle**,
 * which is a different question and the one that has no answer at all.
 */
export function measureSubmission(
  operation: string,
  submission: unknown,
  limits: Required<EngineLimits>,
): number {
  let total = 0;
  const spend = (bytes: number): void => {
    total += bytes;
    if (total > limits.maxBytes) {
      refuse(operation, "the submission", limits.maxBytes, "bytes");
    }
  };
  walk(submission, spend, operation);
  return total;
}

/** One open container, with the cursor into it that an explicit stack has to carry itself. */
type Frame =
  | { readonly kind: "array"; readonly container: readonly unknown[]; index: number }
  | {
      readonly kind: "object";
      readonly container: Record<string, unknown>;
      readonly keys: readonly string[];
      index: number;
      written: number;
    };

/**
 * `JSON.stringify`'s byte accounting, one value at a time, over an explicit stack.
 *
 * The shape follows `SerializeJSONProperty` rather than being invented, because the three
 * classes D-40-E charged were all **ordering** defects rather than arithmetic ones: the
 * serialiser resolves `toJSON` and unboxes *before* it decides whether a value is droppable,
 * and the first version decided droppability on the raw value and unwrapped afterwards. So a
 * key whose `toJSON` returns `undefined` was charged for its own name when the serialiser
 * drops it entirely, and an array element that should serialise as `null` was charged
 * nothing. Doing it in the serialiser's order makes that class unreachable instead of fixed.
 */
function walk(root: unknown, spend: (bytes: number) => void, operation: string): void {
  const open = new Set<object>();
  const stack: Frame[] = [];

  /** A value that is already normalised and already known not to be droppable. */
  const enter = (value: unknown): void => {
    if (value === null) return spend(4);
    const kind = typeof value;
    if (kind === "string") return spend(Buffer.byteLength(JSON.stringify(value), "utf8"));
    /* A non-finite number serialises as `null`, not as `NaN`. Numbers are ASCII, so their
       code-unit length is their byte length. */
    if (kind === "number") return spend(Number.isFinite(value) ? String(value).length : 4);
    if (kind === "boolean") return spend(value === true ? 4 : 5);
    if (kind !== "object") {
      /* A `bigint` is the value the serialiser will not represent, and D-40-23 rules that a
         typed refusal rather than the bare `TypeError` this used to let through. The catch is
         narrow on purpose: it wraps the serialiser refusing, and nothing else reaches here,
         because a droppable is handled by both containers below in the two different ways the
         serialiser does and the top-level case is documented at the call site. A caller's own
         error is raised in `normalise`, well before this line. */
      let serialised: string | undefined;
      try {
        serialised = JSON.stringify(value);
      } catch {
        throw new UnserializableValueError(operation);
      }
      return spend(Buffer.byteLength(serialised ?? "", "utf8"));
    }

    const container = value as object;
    if (open.has(container)) throw new CircularReferenceError(operation);
    if (stack.length >= MAX_NESTING_DEPTH) {
      refuse(operation, "the nesting depth", MAX_NESTING_DEPTH, "levels");
    }
    open.add(container);
    spend(2);
    stack.push(
      Array.isArray(container)
        ? { kind: "array", container, index: 0 }
        : {
            kind: "object",
            container: container as Record<string, unknown>,
            keys: Object.keys(container),
            index: 0,
            written: 0,
          },
    );
  };

  enter(normalise(root, ""));

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.kind === "array") {
      if (frame.index >= frame.container.length) {
        /* Path-scoped: leaving a container makes it legal again on a different path, which
           is what keeps legitimate shared substructure from reading as a cycle. */
        open.delete(frame.container);
        stack.pop();
        continue;
      }
      const at = frame.index;
      frame.index += 1;
      if (at > 0) spend(1);
      const resolved = normalise(frame.container[at], String(at));
      /* In an array these three serialise as `null`; in an object they are dropped. That
         difference is decided on the RESOLVED value, which is the D-40-E fix. */
      if (isDroppable(resolved)) {
        spend(4);
        continue;
      }
      enter(resolved);
      continue;
    }

    if (frame.index >= frame.keys.length) {
      open.delete(frame.container);
      stack.pop();
      continue;
    }
    const key = frame.keys[frame.index];
    frame.index += 1;
    const resolved = normalise(frame.container[key], key);
    /* Dropped before the key costs anything, which is what the serialiser does and what the
       recursive version got wrong: it spent the key and then measured nothing for a value
       the serialiser never emits. */
    if (isDroppable(resolved)) continue;
    if (frame.written > 0) spend(1);
    frame.written += 1;
    spend(Buffer.byteLength(JSON.stringify(key), "utf8") + 1);
    enter(resolved);
  }
}

/** `undefined`, a function and a symbol are the three values the serialiser will not emit. */
function isDroppable(value: unknown): boolean {
  return value === undefined || typeof value === "function" || typeof value === "symbol";
}

/**
 * `SerializeJSONProperty` steps 2 and 4: resolve `toJSON`, then unwrap a boxed primitive.
 *
 * **`key` is passed**, because the serialiser passes it and a `toJSON` is entitled to read
 * it — `Date.prototype.toJSON` ignores it, which is why omitting it looked harmless against
 * a corpus whose only `toJSON` was a `Date`.
 */
function normalise(value: unknown, key: string): unknown {
  let resolved = value;

  if (resolved !== null && (typeof resolved === "object" || typeof resolved === "bigint")) {
    const toJSON = (resolved as { toJSON?: unknown }).toJSON;
    if (typeof toJSON === "function") {
      resolved = (toJSON as (k: string) => unknown).call(resolved, key);
    }
  }

  if (resolved !== null && typeof resolved === "object") {
    const unboxed = unbox(resolved);
    if (unboxed !== NOT_BOXED) return unboxed;
  }

  return resolved;
}

/** A sentinel, because `undefined` is itself a legal unboxed value to return. */
const NOT_BOXED = Symbol("not-boxed");

/**
 * The boxed-primitive step, tested by internal slot, and asked without throwing (D-40-F).
 *
 * The slot is the right question and the previous version asked it the expensive way.
 * `instanceof` answers a realm-scoped approximation, `Object.prototype.toString` answers a
 * forgeable one — `Symbol.toStringTag` replaces the builtin tag, so a boxed `String` can
 * report `[object Foo]` and a plain object can report `[object String]` — and calling each
 * prototype's own `valueOf` and catching is exact because `valueOf` throws unless the slot
 * is genuinely there. That reasoning was correct. Its cost was three thrown and caught
 * `TypeError`s **for every object that is not boxed**, which is every object in every real
 * submission.
 *
 * Measured on this host, in-process: 25 993 ns to decide a plain object is not boxed
 * against 30 ns here. Through the published surface, on a **conforming** submission of
 * 400 005 containers at 1 200 141 bytes — 57% of the 2 MiB default, so accepted and owed an
 * answer — `measureSubmission` took **8 281 ms** where the ruled formula answers the same
 * input in 6 ms, and 976 ms against 0.73 ms on the 60 000-container payload the cost
 * property below uses. D-40-20 bought the substitution with a claim about the **exponent**,
 * O(`maxBytes`) rather than O(paths), and the defect was in the **constant**: it made an
 * O(`maxBytes`) bound a nine-second bound at `maxBytes`. The depth ceiling does not reach
 * it, because `MAX_NESTING_DEPTH` bounds nesting and that payload is three deep.
 *
 * `node:util`'s `types` puts the slot question to V8 directly. It is cross-realm correct
 * where `instanceof` is not, unforgeable where the tag is not, and it runs **no user code
 * at all** — no `Symbol.toStringTag` getter, no proxy trap — so nothing this walk used to
 * measure can start throwing here, which is the clause D-40-D was charged for losing.
 * Verified against the cells that separate the three instruments: a boxed `String` carrying
 * `Symbol.toStringTag = "Foo"`, a plain object carrying `Symbol.toStringTag = "String"`, a
 * `Proxy` over a boxed `String`, and a boxed `String` from another realm.
 *
 * **`[[BigIntData]]` is the fourth slot and it was absent (D-40-G).** The serialiser's steps
 * name four and this asked three, so `Object(BigInt(1))` fell through to the object branch,
 * found no enumerable keys, and cost 2 as `{}` — `{ k: Object(BigInt(1)) }` measured **8**
 * for a submission `JSON.stringify` refuses to serialise at all. Unboxed it reaches the
 * scalar branch and throws exactly where the formula throws.
 *
 * A boxed `Symbol` is deliberately not here. It carries `[[SymbolData]]`, the serialiser has
 * no step for it, and `JSON.stringify(Object(Symbol()))` is `{}` — so falling through to the
 * object branch is agreement rather than an omission.
 */
function unbox(value: object): unknown {
  /* 4a: `ToNumber(value)`, and `+` is the only spelling of it. `Number(value)` is a DIFFERENT
     function — it accepts a BigInt where `ToNumber` refuses one — so a `valueOf` returning
     `7n` measures 7 under `Number()` and throws under both `+` and the serialiser. */
  if (types.isNumberObject(value)) return +(value as unknown as number);
  /* 4b: `ToString(value)`. `String(x)` is `ToString(x)` for every argument that is not itself
     a symbol, and the argument here is always an object. */
  if (types.isStringObject(value)) return String(value);
  /* 4c and 4d read the slot, so they stay reads. Coercing them would answer `true` for every
     boxed boolean and would consult channels the serialiser never looks at. */
  if (types.isBooleanObject(value)) return Boolean.prototype.valueOf.call(value);
  if (types.isBigIntObject(value)) return BigInt.prototype.valueOf.call(value);
  return NOT_BOXED;
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
