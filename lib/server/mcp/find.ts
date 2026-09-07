/* ============================================================
   DarkPrint backend: what the two find verbs share
   The limit rule and the reading of a hit's similarity, written
   once so blueprints and cards cannot drift apart on either.
   ============================================================ */

export const FIND_DEFAULT_LIMIT = 5;
export const FIND_MAX_LIMIT = 20;

/**
 * The number of hits a find verb answers. Anything that is not a finite integer, a route's
 * unparsed query string included, falls to the default rather than to a refusal: a caller
 * that mistyped a limit still wants results.
 */
export function clampLimit(value: unknown): number {
  const asked = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(asked)) return FIND_DEFAULT_LIMIT;
  return Math.min(FIND_MAX_LIMIT, Math.max(1, Math.trunc(asked)));
}

const SIMILARITY = /^similarity:(\d\.\d{2})$/;

/**
 * The cosine similarity a hit's evidence carries, or `undefined` when no vector was
 * available for it. Read off the evidence rather than recomputed, so the number an agent
 * sees is the number the order was made from.
 */
export function similarityOf(evidence: readonly string[]): number | undefined {
  for (const entry of evidence) {
    const match = SIMILARITY.exec(entry);
    if (match !== null) return Number(match[1]);
  }
  return undefined;
}
