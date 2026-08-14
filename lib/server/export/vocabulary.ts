/* ============================================================
   DarkPrint backend — a release's stored local vocabulary
   `release.local_vocabulary` is `jsonb` and typed `unknown` all
   the way out of `ReleaseRecord`, so this is where it becomes
   `ExportedVocabulary`.

   Since D-90-03 the column holds `{ text, terms }` — the file's
   own bytes beside the parsed terms — for the reason
   `lib/content/read.ts` keeps both: `exportBundle` writes `text`
   into the folder unaltered, and a copy reconstructed from the
   terms would define the reader's vocabulary slightly differently
   from the one the site scored. A release stored before that
   amendment carries terms only and is refused rather than
   re-emitted.

   `parseOntologyTerms` does the shape checking rather than a
   predicate written here: it is `lib/content/ontology-file.ts`'s
   own statement of what a term is, it is pure and client-safe,
   and a second opinion about it in this module is exactly the
   second reader that file exists to prevent.
   ============================================================ */

import { parseOntologyTerms } from "@/lib/content/ontology-file";
import type { ExportedVocabulary } from "@/lib/content/bundle-export";
import { BUNDLE_VOCABULARY } from "@/lib/content/bundle-export";
import { malformedStoredVocabulary } from "./errors";

/**
 * `undefined` when the release declares no local vocabulary, which is the ordinary case
 * — most bundles add nothing to the curated core, and AC3's first half is exactly that.
 *
 * Throws the fifth published form for anything that is neither absent nor the stored
 * shape. `null` is included in "absent" because that is what the column holds for a
 * release with no local terms and what `toReleaseRecord` filters out.
 */
export function storedVocabulary(value: unknown): ExportedVocabulary | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw malformedStoredVocabulary();

  const record = value as Record<string, unknown>;
  const text = record.text;
  if (typeof text !== "string") throw malformedStoredVocabulary();

  let terms;
  try {
    // `{ terms: [...] }` is the document shape this parser reads, and it is the shape the
    // column stores, so the value goes in as it stands rather than being rewrapped.
    terms = parseOntologyTerms(record, BUNDLE_VOCABULARY);
  } catch (err) {
    // The parser's own message quotes the offending entry's index and its `kind`, which is
    // stored content rather than the caller's input. It travels on `cause`.
    throw malformedStoredVocabulary(err);
  }

  return { text, terms };
}
