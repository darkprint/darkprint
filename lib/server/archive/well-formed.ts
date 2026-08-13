/* ============================================================
   DarkPrint backend — archive: content integrity
   D-12 (backend.md): `pg` encodes a string parameter as UTF-8, and
   an unpaired UTF-16 surrogate has no UTF-8 encoding — it is
   replaced with U+FFFD silently rather than raising. For a
   content-addressed store that is not a cosmetic loss: the digest
   is computed over what the caller sent, so a release whose bytes
   get rewritten on the way in stores a digest that names bytes it
   does not hold. Refused here rather than repaired, per the
   Contract's amendment — "T010 ... validates ... that the content
   it is asked to store survives storage unchanged."
   ============================================================ */

/**
 * Walks strings, arrays and plain objects; anything else (numbers, booleans,
 * null, undefined) trivially round-trips and is not inspected further.
 *
 * `vocabulary` is typed `unknown`, so it is the one input this walk cannot
 * assume a shape for — including a self-referential one. `onStack` tracks only
 * the objects on the *current* recursive path (added before descending,
 * removed in `finally` on the way back out), so a value legitimately reached
 * twice through two different paths is not a false cycle; a value that
 * contains itself is refused rather than recursing until the call stack
 * overflows and the whole request dies as an uncaught `RangeError` (a module
 * whose job is to decide cannot answer by crashing).
 */
export function isWellFormedDeep(value: unknown, onStack: WeakSet<object> = new WeakSet()): boolean {
  if (typeof value === "string") return value.isWellFormed();
  if (typeof value !== "object" || value === null) return true;
  if (onStack.has(value)) return false;

  onStack.add(value);
  try {
    if (Array.isArray(value)) return value.every((item) => isWellFormedDeep(item, onStack));
    return Object.values(value).every((item) => isWellFormedDeep(item, onStack));
  } finally {
    onStack.delete(value);
  }
}
