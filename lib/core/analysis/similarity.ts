/* ============================================================
   DarkPrint core — text similarity for the `criteria-leak` check
   Doc 3 §4.1's second detector, spelled out in the Fase 1 spec
   PART 4.4:

       normalize  → lowercase, strip punctuation, collapse whitespace
       shingles   → 3-gram word shingles
       similarity → Jaccard index |A∩B| / |A∪B|

   It lives in its own file because it is the one piece of the
   security metric that has nothing to do with graphs: a pure
   function of two strings, separately tested, and replaceable
   without touching the analyzer. Doc 3 §9 lists the *threshold*
   as open; the shape of the measure is not.

   Why shingles rather than a bag of words: two specs about the
   same feature share vocabulary ("test", "component", "render")
   and would score high on unigrams alone. Sharing whole runs of
   three consecutive words is much harder to do by accident, and
   that is exactly the difference between two people writing about
   the same task and one person pasting the other's text.

   Nothing here reads a clock, a random source or a locale:
   `toLowerCase` is the locale-independent one on purpose, so the
   same two strings score identically on every host.
   ============================================================ */

/**
 * The shingle width the `criteria-leak` content check uses — doc 3 §4.1 via spec PART 4.4.
 *
 * Exported so the diagnostic can name it ("3-gram similarity") without a second literal
 * drifting away from the one the measure actually used.
 */
export const SHINGLE_WIDTH = 3;

/**
 * Anything that is neither a letter nor a digit separates two words.
 *
 * Deliberately blunt: an apostrophe splits "don't" into "don" and "t". That is a loss of
 * meaning, but it is the *same* loss on both sides of the comparison, so it cannot bias
 * the score in either direction — and keeping the rule to one line is worth more here
 * than a tokenizer nobody will audit. `\p{L}`/`\p{N}` rather than `[a-z0-9]` because
 * specs are written by humans in whatever language they think in; stripping accented
 * letters would silently shred an Italian or French spec into fragments.
 */
const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u;

/**
 * Lowercase, strip punctuation, collapse whitespace — the normalization step, exposed
 * on its own so it can be tested and so a caller can see exactly what was compared.
 *
 * Returns the word list rather than a re-joined string: every consumer here wants the
 * words, and handing back a string would only invite a second split somewhere else.
 */
export function normalizeWords(text: string): string[] {
  // `toLowerCase`, never `toLocaleLowerCase`: under a Turkish locale the latter maps
  // "I" to "ı", and a score that depends on the host's locale is not reproducible.
  return text.toLowerCase().split(WORD_SEPARATOR).filter((word) => word.length > 0);
}

/**
 * The set of `width`-word shingles of `text`, after normalization.
 *
 * **Short-string behaviour**, which is a real case and not a footnote — a `spec` of
 * "Build it." has two words and no 3-gram at all:
 *
 * - **0 words** (empty, or nothing but punctuation) → the empty set. Two empty specs are
 *   then *not* similar (see `jaccardSimilarity`), which is what we want: a card nobody
 *   has filled in must never fire the most expensive marker in the vocabulary.
 * - **1 to `width` − 1 words** → one shingle holding the whole text. Without this a
 *   two-word spec would have an empty shingle set and score 0 against its own identical
 *   twin, which breaks the "identical → 1" property for exactly the inputs a reader is
 *   most likely to try by hand. With it, short texts compare all-or-nothing: identical
 *   short texts score 1, different ones score 0, and a short text never matches a long
 *   one (a 2-word shingle is never equal to a 3-word one). Refusing to claim partial
 *   evidence from two words is the honest answer, not a degradation.
 * - **`width` words or more** → the usual sliding window, `words.length − width + 1`
 *   shingles.
 *
 * `width` below 1 is a caller error rather than user data, and it is not worth throwing
 * over: it is pulled up to 1 and truncated to an integer.
 */
export function shingles(text: string, width: number = SHINGLE_WIDTH): ReadonlySet<string> {
  const size = Math.max(1, Math.trunc(width));
  const words = normalizeWords(text);
  const out = new Set<string>();
  if (words.length === 0) return out;
  if (words.length < size) {
    out.add(words.join(" "));
    return out;
  }
  for (let i = 0; i + size <= words.length; i += 1) {
    out.add(words.slice(i, i + size).join(" "));
  }
  return out;
}

/**
 * True when `text` has at least `width` words — the range in which a similarity score is
 * evidence of copied prose rather than an artefact of the whole-text fallback above.
 *
 * The fallback is right for `shingles` and wrong for a caller reading the score as proof.
 * Two specs of "TODO" normalize to one word each, produce one identical whole-text shingle
 * each, and score 1.00: arithmetically correct, and evidentially worthless. The measure's
 * whole argument (see the file banner) is that sharing a run of three consecutive words is
 * hard to do by accident — a text with fewer than three words shares no such run with
 * anything, so a 1.00 there says only that two authors wrote the same short placeholder.
 *
 * The card validator already expects to see those: `card/spec-too-thin` warns below 40
 * characters. So this is not a rare shape, it is the shape of every half-written bundle,
 * and the analyzer has to be able to ask before it acts on a number.
 *
 * Kept here rather than in the analyzer because it is a property of the measure — what its
 * output means, and over what range — and because the same `width` has to answer both.
 */
export function carriesShingleEvidence(text: string, width: number = SHINGLE_WIDTH): boolean {
  return normalizeWords(text).length >= Math.max(1, Math.trunc(width));
}

/**
 * Jaccard index over word shingles: |A ∩ B| / |A ∪ B|, in [0, 1].
 *
 * Properties, all of them asserted in the test file:
 * - identical non-empty texts → 1, whatever their length;
 * - texts sharing no run of `width` words → 0;
 * - symmetric in its two arguments — `f(a, b) === f(b, a)`;
 * - blind to case, punctuation and runs of whitespace;
 * - **not** blind to word order *inside* a text. Shuffling the words of one spec changes
 *   its shingles and lowers the score, and that is the point: the measure is looking for
 *   copied passages, not for a shared topic.
 *
 * An empty union — at least one side has no words at all — returns 0 rather than the
 * arithmetically tempting 1. Two blank specs are trivially "identical" and carry no
 * evidence whatsoever; scoring them 1 would fire a criteria-leak warning on every
 * half-written card in a draft bundle.
 */
export function jaccardSimilarity(a: string, b: string, width: number = SHINGLE_WIDTH): number {
  const left = shingles(a, width);
  const right = shingles(b, width);
  if (left.size === 0 || right.size === 0) return 0;

  // Iterate the smaller side: the cost is O(min(|A|, |B|)) lookups either way, and on a
  // long spec compared against a one-line one that is the difference worth having.
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let shared = 0;
  for (const shingle of small) {
    if (large.has(shingle)) shared += 1;
  }
  // |A ∪ B| = |A| + |B| − |A ∩ B|, so the union is never materialised.
  return shared / (left.size + right.size - shared);
}
