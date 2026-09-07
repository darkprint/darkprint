/* ============================================================
   DarkPrint backend — archive: content integrity
   `pg` encodes a string parameter as UTF-8, and
   an unpaired UTF-16 surrogate has no UTF-8 encoding — it is
   replaced with U+FFFD silently rather than raising. For a
   content-addressed store that is not a cosmetic loss: the digest
   is computed over what the caller sent, so a release whose bytes
   get rewritten on the way in stores a digest that names bytes it
   does not hold. Refused here rather than repaired, per the
   Contract's amendment — "T010 ... validates ... that the content
   it is asked to store survives storage unchanged."

   Round 4: the Contract named two hazards for this walk — cyclic
   *and* 200k-deep — and a recursive walk with a seen-set only closed
   the first; acyclic depth still exhausted the call stack, reachable
   from a `vocabulary` an upstream route parsed out of a request body
   (`vocabulary` is `unknown`, the one input with no assumed shape).
   The walk is iterative for exactly that reason: depth costs heap
   here, not call-stack frames, mirroring `lib/core/hash/canonical.ts`'s
   own open/close bookkeeping for the same class of problem —
   independently arrived at, since `lib/core/**` is Forbidden here.
   ============================================================ */

/** One step of the walk: visit a value, or close a container it opened. */
type WalkStep =
  | { readonly kind: "enter"; readonly value: unknown }
  | { readonly kind: "leave"; readonly container: object };

/**
 * Walks strings, arrays and plain objects; anything else (numbers, booleans,
 * null, undefined) trivially round-trips and is not inspected further.
 * Refuses — rather than recursing until the call stack overflows and the
 * whole request dies as an uncaught `RangeError` — on either hazard: a value
 * that contains itself, or one merely deep enough that a recursive walk
 * would have exhausted the stack before finishing. A module whose job is to
 * decide cannot answer by crashing, whichever hazard it met.
 */
export function isWellFormedDeep(root: unknown): boolean {
  const stack: WalkStep[] = [{ kind: "enter", value: root }];
  /**
   * Containers open on the *current* path from the root, for O(1) cycle
   * detection — added before their children are pushed, removed on `leave`
   * once every one of those children has finished. That is what keeps a
   * value legitimately reached twice through two different paths from
   * reading as a false cycle: it is only ever "open" while still an
   * ancestor of the value being visited, never merely because it was
   * visited once already.
   */
  const open = new Set<object>();

  while (stack.length > 0) {
    const step = stack.pop();
    if (step === undefined) break; // unreachable: stack.length > 0 guarantees a value

    if (step.kind === "leave") {
      open.delete(step.container);
      continue;
    }

    const value = step.value;
    if (typeof value === "string") {
      // Short-circuits the whole walk on the first offender, same as the
      // `every()` this replaced — a large manifest with an early bad string
      // is not a reason to keep visiting the rest of it.
      if (!value.isWellFormed()) return false;
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    if (open.has(value)) return false;

    open.add(value);
    stack.push({ kind: "leave", container: value });
    const children = Array.isArray(value) ? value : Object.values(value);
    for (const child of children) stack.push({ kind: "enter", value: child });
  }

  return true;
}
