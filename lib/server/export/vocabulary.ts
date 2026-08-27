/* ============================================================
   DarkPrint backend — a release's stored local vocabulary
   `release.local_vocabulary` is `jsonb`. Since T133 it has one
   published shape, `StoredVocabulary`, which `ReleaseRecord` now
   carries rather than `unknown` — so this is where the stored
   shape becomes `ExportedVocabulary`, and no longer where anyone
   decides what the stored shape was.

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

   **T133 AC2: the checks this file used to make are gone, and it
   consumes `parseStoredVocabulary` instead.** The paragraph above
   was right about the parser and stopped one level short — the
   `Array.isArray` and `typeof text` checks were still a second
   opinion about the COLUMN, held here and independently in
   `addRelease` and in `lib/server/profiles/terms.ts`. The column
   now has one published shape (`StoredVocabulary`, D-133-01) and
   one reading of it, and this module consumes that reading rather
   than re-deriving it.

   **What did not change is the refusal.** The write refuses this
   shape first (AC1), but a row still reaches the column by direct
   `UPDATE` or from before the shape was published — so this reader
   keeps refusing, with its own class and its own published message.
   `export.scratch.test.ts:187` is the standing witness.
   ============================================================ */

import type { ExportedVocabulary } from "@/lib/content/bundle-export";
import { parseStoredVocabulary } from "@/lib/server/archive";
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
  try {
    /* `"export"`, not `"exportRelease"`: this is reached from `exportRelease` AND from
       `serveFile`, so a verb here would be a literal whose truth depends on which entry point
       happened to call. `readFailed` in `./errors` records that correction; the name travels
       on the `cause` chain, so it has to be true on both paths. */
    return parseStoredVocabulary(value, "export");
  } catch (err) {
    /* The refusal is re-thrown as this module's OWN class, and that is not ceremony: the route
       maps `ExportError` to 404, `MalformedVocabularyError` is not one, and a fact about a
       release that leaves here untyped reaches the caller as a 500. The published message is
       unchanged and still a bare literal — `MalformedVocabularyError` and the parser's
       diagnostic both quote stored content, so both travel on `cause` and neither in a
       message. */
    throw malformedStoredVocabulary(err);
  }
}
