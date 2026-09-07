/* ============================================================
   DarkPrint backend — the lexical half of matching
   Normalisation, words, and the two passes that decide whether a
   query word is in a document: substring first, then a character
   3-gram near-match for misspellings and inflections. The vector
   channel lives in `embed.ts` and shares nothing with this file
   except the query text it is handed.

   Everything here is a fact about the archive a caller can check:
   which word in which field matched. Nothing reads a clock, the
   network or the environment, so the same query against the same
   rows answers the same evidence on every host.
   ============================================================ */

/**
 * Lowercase, and every run of non-letter non-digit collapsed to one space.
 *
 * Unicode-aware (`\p{L}`, `\p{N}`) rather than `[a-z0-9]`: `pré-résolution` has to survive
 * as two words rather than four fragments, and an author writing a card in Italian is not
 * an edge case in this registry. `toLowerCase` and not `toLocaleLowerCase` because the
 * host's locale must not decide whether a query matches.
 */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** The words of a normalised string. `[]` for a string with nothing in it. */
export function words(normalised: string): readonly string[] {
  return normalised === "" ? [] : normalised.split(" ");
}

/**
 * Phrases a reader appends to say WHERE the blueprint will run, which say nothing about
 * what it should do. Stripped before the query is embedded or matched, because "in claude
 * code" pulls every candidate toward the same few tokens and buries the task.
 */
export const HARNESS_PHRASES: readonly string[] = [
  "in claude code",
  "with claude code",
  "using claude code",
  "for claude code",
  "on claude code",
  "in codex",
  "with codex",
  "using codex",
  "for codex",
  "on codex",
  "in cursor",
  "with cursor",
  "using cursor",
  "for cursor",
  "for my cursor agent",
  "with my cursor agent",
  "in my cursor agent",
  "for my claude code agent",
  "for my codex agent",
  "with the claude code harness",
  "with the codex harness",
];

/**
 * Words too common to say which document a reader means. Excluded from coverage so a task
 * written as a sentence is scored on its content words and "a bot that triages tickets"
 * does not credit every blueprint whose summary contains "that".
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "so", "yet", "of", "to", "in", "on", "at",
  "by", "for", "from", "with", "without", "into", "onto", "over", "under", "about", "as",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did", "doing",
  "have", "has", "had", "having", "can", "could", "should", "would", "will", "shall", "may",
  "might", "must", "need", "needs", "want", "wants", "wanted", "like", "get", "gets", "got",
  "make", "makes", "made", "let", "lets", "please", "help", "me", "my", "mine", "i", "we",
  "us", "our", "you", "your", "it", "its", "they", "them", "their", "this", "that", "these",
  "those", "there", "here", "what", "which", "who", "whom", "whose", "when", "where", "why",
  "how", "some", "something", "any", "anything", "every", "each", "all", "both", "either",
  "neither", "one", "ones", "other", "another", "such", "same", "than", "then", "also",
  "too", "very", "just", "only", "not", "no", "yes", "if", "because", "while", "after",
  "before", "up", "down", "out", "off", "again", "once", "own", "more", "most", "less",
  "least", "much", "many", "few", "new", "use", "uses", "used", "using", "via", "per",
  "am", "he", "hi", "ok", "oh", "vs", "re", "go", "et", "al", "ie", "eg", "im", "ve", "ll",
  "thing", "things", "way", "ways", "kind", "sort", "set", "setup", "build", "builds",
  "built", "create", "creates", "created", "run", "runs", "running", "agent", "agents",
  "blueprint", "blueprints", "pipeline", "pipelines", "workflow", "workflows", "bot", "bots",
  "tool", "tools", "system", "systems", "process", "processes", "automate", "automated",
  "automatically", "automation", "task", "tasks", "job", "jobs", "work", "works", "working",
  "done", "able", "find", "looking", "look", "search",
]);

/**
 * Shortest word that counts toward coverage. Single letters are substrings of half the
 * archive; two-letter words stay because `PR`, `QA`, `KB` and `CI` are content words in this
 * domain, and the two-letter function words are on the stopword list instead.
 */
export const MIN_COVERAGE_WORD_LENGTH = 2;

/**
 * The query with every harness phrase removed, whitespace collapsed.
 *
 * Case-insensitive and bounded by word edges so "in codex" inside "in codex-style prose" is
 * left alone. Longer phrases are tried first so "for my cursor agent" is not left as "my
 * agent" by a shorter match inside it.
 */
export function stripHarness(query: string): string {
  let out = query;
  const phrases = [...HARNESS_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(phrase).replace(/ /g, "\\s+")}(?=$|[^\\p{L}\\p{N}])`, "giu");
    out = out.replace(pattern, "$1");
  }
  return out.replace(/\s+/g, " ").trim();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The distinct words of a task that count toward coverage: harness phrases stripped,
 * stopwords and single letters dropped.
 *
 * When the filter would leave nothing (a query made only of stopwords, or a single short
 * word), the distinct raw words are kept instead: `q=the` still finds the documents that
 * contain "the", and no query that has words in it can silently score every candidate
 * `0/0`. Empty only when the query has no words at all.
 */
export function coverageWords(query: string): readonly string[] {
  const raw = [...new Set(words(normalise(stripHarness(query))))];
  const content = raw.filter((w) => w.length >= MIN_COVERAGE_WORD_LENGTH && !STOPWORDS.has(w));
  return content.length > 0 ? content : raw;
}

/** Shortest token worth comparing by 3-grams: below this the overlap is noise, not spelling. */
const NEAR_MATCH_MIN_LENGTH = 5;

/**
 * How much of a query word's 3-gram set a document word must carry to count as the same
 * word misspelled or inflected.
 *
 * 0.75 rather than a looser figure because this channel may only ever ADD a match a literal
 * pass missed, and a near-match that fires on a coincidence puts an unexplained entry in
 * evidence whose whole contract is that it explains itself. At 0.75 `orchestration` reaches
 * `orchestrator` and `retrival` reaches `retrieval`, while `planning` does not reach `plan`.
 */
const NEAR_MATCH_RATIO = 0.75;

/**
 * The character 3-grams of one word, padded at both ends.
 *
 * The padding is what makes a prefix and a suffix carry weight: without it `agent` and
 * `regents` share `gen` and `ent` and look nearly identical. `_` rather than a space
 * because `normalise` has already removed every space from inside a word.
 */
function trigrams(word: string): readonly string[] {
  const padded = `_${word}_`;
  if (padded.length < 3) return [padded];
  const out: string[] = [];
  for (let i = 0; i + 3 <= padded.length; i += 1) out.push(padded.slice(i, i + 3));
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
 * Which word of `fieldText` the query word was found in, or `undefined`.
 *
 * Substring first, because that is what the shelves do and a reader typing `agent` expects
 * `agentic` back. The 3-gram pass runs only when the substring pass found nothing, so it can
 * add a match and never remove one.
 *
 * The answer is the word from the DOCUMENT rather than the query, so the evidence says which
 * word in the archive was matched: `agent` finding `agentic` reports `title:agentic`.
 */
export function findWord(fieldText: string, queryWord: string): string | undefined {
  const candidates = words(normalise(fieldText));
  for (const word of candidates) if (word.includes(queryWord)) return word;
  for (const word of candidates) if (nearMatches(queryWord, word)) return word;
  return undefined;
}
