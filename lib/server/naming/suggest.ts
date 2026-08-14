/* ============================================================
   DarkPrint backend — naming: candidate names for a taken one
   AC6: "a suggestion returned for a taken name is itself free at
   the moment it is returned". So the candidates are produced here
   and their freedom is decided by the *same query* that decided
   the answer — one round trip, never one query per candidate, and
   never a second trip whose result is older than the first.
   ============================================================ */

import { isNameSegment } from "./grammar";

/**
 * `base-2` … `base-9`. Eight is a cap rather than a fact about anything: a name
 * whose first eight variants are all taken gets no suggestion, which is a smaller
 * lie than an unbounded scan. The caller is told by absence, never by silence
 * dressed as a free name.
 */
const SUGGESTION_DEPTH = 8;

/**
 * Every candidate is filtered through the grammar rather than assumed to inherit
 * it. Appending `-2` to a legal segment does produce a legal segment today, and
 * that is precisely the kind of thing that stops being true when the grammar is
 * tightened somewhere else — "after widening a set, check that every member of the
 * new set is representable by whatever consumes it" (`backend.md`).
 *
 * `admissible` is the caller's extra condition: a slug also has to not be one of
 * the profile tabs' four. Passed in rather than referenced here so this file does
 * not have to know which of the two callers it is serving.
 */
export function suggestionCandidates(
  base: string,
  admissible: (candidate: string) => boolean = () => true,
): string[] {
  const candidates: string[] = [];
  for (let n = 2; n < 2 + SUGGESTION_DEPTH; n++) {
    const candidate = `${base}-${n}`;
    if (isNameSegment(candidate) && admissible(candidate)) candidates.push(candidate);
  }
  return candidates;
}
