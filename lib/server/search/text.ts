/* ============================================================
   DarkPrint backend — normalisation, tokens and character 3-grams
   One derivation, used twice: `matchField` decides what a query
   found and what the evidence for it says, and `embed.ts` builds
   the stored vector out of the same 3-grams. Nothing here reads
   the clock, the network or the environment, so the vector a
   release embeds to depends on the release and on nothing else —
   which is what makes AC6's determinism claim true rather than
   probable.

   THE MATCH IS LEXICAL, AND D-200-01 FORBIDS THE OTHER WORD FOR
   IT. Nothing in this file knows what a word means. It knows which
   characters two strings share, which is a fact about the archive a
   caller can check, and the reason AC5's `ordered: true` is
   reachable at all: a cosine distance over a neural embedding is
   not explainable from the archive and would force
   `ordered: false`.

   The forbidden term is DESCRIBED here rather than spelled, and
   that is `lib/db/schema.ts`'s own argument about the withdrawn
   vocabulary shape: a grep for the token cannot tell a docblock
   denying it from a docblock asserting it, so the one instrument
   that could check this clause would read a correct file as a
   violation.
   ============================================================ */

/**
 * Lowercase, and every run of non-letter non-digit collapsed to one space.
 *
 * Unicode-aware (`\p{L}`, `\p{N}`) rather than `[a-z0-9]`: `pré-résolution` has to survive
 * as two words rather than four fragments, and an author writing a card in Italian is not
 * an edge case in this registry. `toLowerCase` and not `toLocaleLowerCase` — the host's
 * locale must not decide whether a query matches.
 */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** The words of a normalised string. `[]` for a string with nothing in it. */
export function words(normalised: string): readonly string[] {
  return normalised === "" ? [] : normalised.split(" ");
}

/** Shortest token worth comparing by 3-grams: below this the overlap is noise, not spelling. */
const NEAR_MATCH_MIN_LENGTH = 5;

/**
 * How much of a query word's 3-gram set a document word must carry to count as the same
 * word misspelled or inflected.
 *
 * 0.75 rather than a looser figure because this channel may only ever ADD a hit a literal
 * match missed, and a near-match that fires on a coincidence puts an unexplained row in a
 * response whose whole contract is that it explains itself. At 0.75 `orchestration` reaches
 * `orchestrator` and `retrival` reaches `retrieval`, while `planning` does not reach
 * `plan` — the shorter word simply has too few 3-grams for the ratio to be about spelling.
 */
const NEAR_MATCH_RATIO = 0.75;

/**
 * The character 3-grams of one word, padded at both ends.
 *
 * The padding is what makes a prefix and a suffix carry weight: without it `agent` and
 * `regents` share `gen` and `ent` and look nearly identical, and with it the boundary
 * 3-grams `_ag` and `nt_` separate them. `_` is used rather than a space because
 * `normalise` has already removed every space from inside a word, so it cannot collide
 * with content.
 */
export function trigrams(word: string): readonly string[] {
  const padded = `_${word}_`;
  if (padded.length < 3) return [padded];
  const out: string[] = [];
  for (let i = 0; i + 3 <= padded.length; i += 1) out.push(padded.slice(i, i + 3));
  return out;
}

/** Every 3-gram of a normalised text, word by word. Duplicates kept: a repeated word counts twice. */
export function textTrigrams(normalised: string): readonly string[] {
  const out: string[] = [];
  for (const word of words(normalised)) out.push(...trigrams(word));
  return out;
}

/**
 * Does `documentWord` carry enough of `queryWord`'s 3-grams to be the same word?
 *
 * Asymmetric on purpose: the ratio is over the QUERY's 3-grams, so a short query word
 * inside a long document word counts (the reader typed a stem) while a long query word is
 * not satisfied by a short document word that happens to sit inside it.
 */
function nearMatches(queryWord: string, documentWord: string): boolean {
  if (queryWord.length < NEAR_MATCH_MIN_LENGTH) return false;
  const wanted = trigrams(queryWord);
  const have = new Set(trigrams(documentWord));
  let found = 0;
  for (const gram of wanted) if (have.has(gram)) found += 1;
  return found / wanted.length >= NEAR_MATCH_RATIO;
}

/**
 * Which word of `field` the query word was found in, or `undefined`.
 *
 * Substring first, because that is what the merged shelves already do
 * (`GalleryBrowser`/`NodeBrowser` both run `haystack.includes(q)`) and a reader typing
 * `agent` expects `agentic` back. The 3-gram channel runs only when the substring pass
 * found nothing, so it can add a hit and can never remove or reorder one — a database on
 * which nothing has been re-embedded returns exactly what it returned before.
 *
 * The answer is the word from the DOCUMENT rather than the query, and that is the whole
 * point of returning it: the evidence then says which word in the archive was matched,
 * so `agent` finding `agentic` reports `title:agentic` and a reader can see what happened
 * instead of being told their own query back.
 */
export function findWord(fieldText: string, queryWord: string): string | undefined {
  const candidates = words(normalise(fieldText));
  for (const word of candidates) if (word.includes(queryWord)) return word;
  for (const word of candidates) if (nearMatches(queryWord, word)) return word;
  return undefined;
}
