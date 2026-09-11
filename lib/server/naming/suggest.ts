/* ============================================================
   DarkPrint backend — naming: candidate names for a taken one
   AC6: "a suggestion returned for a taken name is itself free at
   the moment it is returned". So candidates are produced here and
   their freedom is decided by the *same query* that decided the
   answer — never one query per candidate, and never a second trip
   whose result is older than the first.

   D-70-18 turned AC6 from a conditional into an obligation: a
   suggestion accompanies exactly those refusals where the name
   asked for is well-formed — required for `taken` and `reserved`,
   forbidden for `illegal`. The first version of this file capped
   the search at eight variants and answered nothing when all eight
   were held, which is the case the ruling forbids and which was
   reachable with eight rows. Two things changed: the search widens
   until it finds one, and the stem is cut short enough that a
   suffix still fits inside the bound.

   **The bound is the CALLER's, not this file's** (D-071-01(3)).
   `MAX_NAME_LENGTH` is only the default. A handle door passes
   `MAX_HANDLE_LENGTH`, because after D-70-15 the two name kinds
   stopped sharing a ceiling and a stem cut against the wrong one
   yields a candidate the other door refuses.

   **The window is queried exactly, never sampled.** An earlier
   design fetched "the taken variants" with a `LIKE` and a `LIMIT`,
   which is wrong in a way that would not have shown up in a test:
   a limited result is an arbitrary subset, so a candidate absent
   from it may still be held, and the module would have offered a
   suggestion that was not free — breaking AC6 while appearing to
   satisfy D-70-18. Each window is an exact membership question
   about the exact strings in it.
   ============================================================ */

import { isNameSegment, MAX_NAME_LENGTH } from "./grammar";

/** Candidates asked about per round trip. One round trip covers the realistic case. */
const WINDOW = 64;

/**
 * How many rounds before the module gives up and answers without a suggestion.
 * 16 windows is 1024 consecutive variants, so reaching it needs 1024 held names
 * sharing one stem. Bounded rather than unbounded on purpose: the name is caller
 * input, and "loop until success" over caller input is a request that never ends.
 */
const WINDOWS = 16;

/**
 * The candidate `name` yields for suffix `-n`: **shortened, not only appended** (D-70-20).
 *
 * **`bound` is per call, and it has to be** (D-071-01(3)). Two doors generate candidates
 * with different ceilings — a slug may run to `MAX_NAME_LENGTH`, a handle stops at
 * `MAX_HANDLE_LENGTH` — so a stem cut against one constant produces an illegal name at the
 * other. Reading `MAX_NAME_LENGTH` here would offer a taken 32-character handle
 * `<32 chars>-2`, which is 34 and which `allocateHandle` refuses: availability and
 * allocation disagreeing through the input the bound did not reach, D-70-13's species
 * exactly. Defaulted so the slug side, which is not this task's to edit, keeps the
 * behaviour it had.
 *
 * Identical to appending for everything shorter than the bound, which is every real
 * handle and slug — the archive's longest are 11 and 26 characters. It matters at the
 * boundary, where D-70-18's "required" clause is otherwise unsatisfiable: a name of
 * exactly `MAX_NAME_LENGTH` is well-formed, D-70-15 allocates one through the published
 * surface, and every `<name>-2` is two characters too long. "No suffix fits" is a
 * property of an appending-only generator, not of the problem.
 *
 * The cut is measured **per suffix** rather than once for the longest one could be.
 * `-2` and `-10` need different room, and a single reserved width would return
 * `<245 chars>-2` where the ruling asks for `<253 chars>-2` — a suggestion shorter than
 * the caller's name by more than it has to be. Each window asks about exact strings, so
 * a stem that varies with the suffix costs nothing.
 *
 * Trailing hyphens are trimmed because the cut can land on one and `a-` is not a legal
 * segment.
 */
export function suggestionCandidate(name: string, n: number, bound: number = MAX_NAME_LENGTH): string {
  const suffix = `-${n}`;
  const room = bound - suffix.length;
  const stem = name.length <= room ? name : name.slice(0, room).replace(/-+$/, "");
  return `${stem}${suffix}`;
}

/**
 * `WINDOW` candidates starting at `from`, filtered through the grammar and the
 * caller's own condition.
 *
 * Both filters are applied rather than assumed: appending `-2` to a legal segment
 * does yield a legal segment today, and that is exactly the property that stops
 * holding when the grammar is tightened somewhere else. That is no longer hypothetical —
 * D-70-15 tightened it for handles — so `bound` is checked here beside `isNameSegment`,
 * which admits up to `MAX_NAME_LENGTH` whatever the caller asked for and therefore cannot
 * be what keeps a handle candidate legal.
 *
 * **`candidate.length <= bound` is redundant, and it is labelled rather than described as
 * a guard.** Measured, not assumed: deleting that conjunct alone reds nothing, because
 * `suggestionCandidate` already cuts the stem against the same `bound`. Deleting it
 * *together with* the shortening reds exactly as many cells as deleting the shortening
 * alone — so it does not catch a broken generator, it only changes how one fails: with it,
 * the window empties and the caller gets no suggestion (a D-70-18 violation); without it,
 * the window fills with over-length names (a D-70-13 one). Kept as a cheap assertion of
 * the postcondition at the point a reader looks for it, and kept honest about being
 * unfalsifiable by any cell here — the T010 precedent, that an unfalsifiable check called
 * a guard is how a later reader comes to rely on nothing.
 */
export function suggestionWindow(
  name: string,
  from: number,
  admissible: (candidate: string) => boolean,
  bound: number = MAX_NAME_LENGTH,
): string[] {
  const candidates: string[] = [];
  for (let n = from; n < from + WINDOW; n++) {
    const candidate = suggestionCandidate(name, n, bound);
    if (isNameSegment(candidate) && candidate.length <= bound && admissible(candidate)) {
      candidates.push(candidate);
    }
  }
  return candidates;
}

/** The first window, which the caller has already asked about to answer the question itself. */
export interface AskedWindow {
  candidates: readonly string[];
  taken: ReadonlySet<string>;
}

/**
 * The first free variant of `name`, or `undefined` when `WINDOW * WINDOWS`
 * consecutive variants are all held.
 *
 * `asked` is the window the caller already spent a query on, so the common case — a
 * taken name whose first variant is free — costs exactly one statement in total and
 * the suggestion's freedom is decided by the same read that decided `available`.
 */
export async function firstFreeSuggestion(
  name: string,
  admissible: (candidate: string) => boolean,
  lookup: (names: readonly string[]) => Promise<Set<string>>,
  asked: AskedWindow,
  bound: number = MAX_NAME_LENGTH,
): Promise<string | undefined> {
  for (let window = 0; window < WINDOWS; window++) {
    const candidates =
      window === 0
        ? asked.candidates
        : suggestionWindow(name, 2 + window * WINDOW, admissible, bound);
    const taken = window === 0 ? asked.taken : await lookup(candidates);
    const free = candidates.find((candidate) => !taken.has(candidate));
    if (free !== undefined) return free;
  }
  return undefined;
}

/** The candidates a caller asks about alongside the name itself, on the first trip. */
export function firstWindow(
  name: string,
  admissible: (candidate: string) => boolean = () => true,
  bound: number = MAX_NAME_LENGTH,
): string[] {
  return suggestionWindow(name, 2, admissible, bound);
}
