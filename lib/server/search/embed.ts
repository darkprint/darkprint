/* ============================================================
   DarkPrint backend — the stored vector, derived locally
   D-200-01 and D-200-11: there is NO embedding provider, no key
   and no network call, and the absence is what makes AC5
   satisfiable rather than what degrades it. A cosine distance over
   a neural embedding is not explainable from the archive — there
   is no sentence of the form "this ranked above that BECAUSE …"
   the archive can supply for it — so it is the ranking that would
   force `ordered: false`. What this file produces is a LEXICAL
   vector, and the word `semantic` appears nowhere it can be
   shipped: in a string, in an `evidence` value, or as a claim
   about what the number means.

   ── The derivation, and why it is 3-grams rather than tokens ──
   D-200-11, correcting D-200-01. A hashed bag of WHOLE TOKENS
   gives two documents with disjoint token sets ORTHOGONAL vectors,
   so it cannot reach a candidate that shares no literal token and
   the only thing it adds is hash-collision noise dressed as
   recall. Character 3-grams retrieve morphological variants and
   typos that a literal match misses, which is a real recall
   channel and an honest description of one.

   ── What reads this today, and what does not ──
   Nothing in the three searchers reads these tables. Their recall
   channel is `text.ts`'s 3-gram near-match run in process, over a
   snapshot T080 has already loaded into memory in full — an ANN
   index over a set you are already holding buys nothing. The
   stored vectors are the SAME derivation persisted, maintained by
   AC6, and they are what the query path switches to on the day the
   corpus stops fitting in one read. That is stated rather than
   implied, because a table nothing reads is worth being honest
   about.
   ============================================================ */

import { normalise, textTrigrams } from "./text";

/**
 * The width, and it is not this module's to choose (D-200-02).
 *
 * `vector(384)` is declared in `0003_search.up.sql` and pgvector refuses a row of any other
 * length, so a mismatch here is a write that fails rather than a vector that is quietly
 * wrong. 384 is the width of the common small sentence encoders, which is what keeps
 * swapping this derivation for a real provider a drop-in rather than a migration.
 */
export const EMBEDDING_DIMENSIONS = 384;

/**
 * FNV-1a, 32-bit, over UTF-16 code units.
 *
 * Written out rather than reached for because the bucket a 3-gram lands in has to be the
 * same on every host and in every Node version for AC6's determinism claim to hold —
 * `String.prototype.hashCode` does not exist, and V8's internal string hash is SALTED PER
 * PROCESS, so anything built on object identity or `Map` iteration order would reproduce a
 * different vector on the next run and only fail once the suite re-embedded across a
 * restart.
 */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    // `Math.imul` keeps the multiply in 32 bits; `*` would go through a double and lose
    // the low bits above 2^53, which is where a hash spends most of its time.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The lexical vector of a document: its 3-grams counted into 384 buckets, L2-normalised.
 *
 * Counts are NON-NEGATIVE and unsigned. The signed hashing trick would cancel some
 * collisions, and it is declined because a bucket then holds a number with no reading —
 * this way a bucket is "how many 3-grams landed here", which is a sentence, and every
 * choice in this file has to survive being explained.
 *
 * L2-normalised because the index is `vector_cosine_ops` (D-200-02) and cosine is scale
 * free: without the normalisation `<=>` still answers correctly but every stored row
 * carries its own length, and `vector_l2_ops` over unnormalised counts would rank by
 * MAGNITUDE, which for 3-gram counts is document LENGTH — the ordering that looks plausible
 * and puts a long document above a relevant one.
 *
 * A document with no letters and no digits in it has no 3-grams and would divide by zero.
 * It embeds to the zero vector instead, which is a legal `vector(384)` and is at cosine
 * distance 1 from everything — the right answer for a document there is nothing to say
 * about, rather than a throw at a caller who published an empty summary.
 */
export function embed(text: string): number[] {
  const buckets = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  /* NORMALISED FIRST, and this line is load-bearing rather than tidy. `textTrigrams` takes
     an already-normalised string, and handing it raw text builds the vector over case and
     punctuation: `embed("Agent")` would then share no bucket with `embed("agent")`, and the
     stored vector would be derived under different rules from the query it is meant to be
     comparable with. Found by driving the empty-document cell, where raw text splits into
     empty words and the "no 3-grams" branch was never reached. */
  for (const gram of textTrigrams(normalise(text))) {
    buckets[fnv1a(gram) % EMBEDDING_DIMENSIONS] += 1;
  }
  let sumOfSquares = 0;
  for (const count of buckets) sumOfSquares += count * count;
  if (sumOfSquares === 0) return buckets;
  const length = Math.sqrt(sumOfSquares);
  return buckets.map((count) => count / length);
}
