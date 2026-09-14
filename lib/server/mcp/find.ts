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

/**
 * Whether this answer's order is a rank an agent can act on.
 *
 * Stronger than `Results.ordered`, which asks only whether the archive produced the order at
 * all. Two conditions, both read off the hits the caller was handed rather than off the branch
 * that made them, so a caller can recompute this flag from the payload it has: every hit says
 * which field and token reached it, and every hit was placed by the vector channel.
 *
 * The second clause is why this is not a restatement of `encoder`. A release published while
 * no encoder was provisioned carries no vector until `db:reembed` sweeps it, and it then ranks
 * in a process whose encoder IS present: its score cannot exceed `LEXICAL_BOOST` while an
 * embedded neighbour clears that on similarity alone, so one such hit in the slice puts two
 * scoring scales in one list and the ranks are not comparable across them. `encoder` is a fact
 * about the process; this is a fact about the rows that came back.
 *
 * `every` over an empty slice is `true`, which is the convention `Results.ordered` keeps: an
 * answer with nothing in it has no order it failed to explain.
 */
export function orderedOf(
  hits: readonly { evidence: readonly string[]; similarity?: number }[],
): boolean {
  return hits.every((hit) => hit.evidence.length > 0 && hit.similarity !== undefined);
}
