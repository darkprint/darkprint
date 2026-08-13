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

/** Walks strings, arrays and plain objects; anything else (numbers, booleans,
 *  null, undefined) trivially round-trips and is not inspected further. */
export function isWellFormedDeep(value: unknown): boolean {
  if (typeof value === "string") return value.isWellFormed();
  if (Array.isArray(value)) return value.every(isWellFormedDeep);
  if (value !== null && typeof value === "object") return Object.values(value).every(isWellFormedDeep);
  return true;
}
