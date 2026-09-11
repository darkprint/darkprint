/* ============================================================
   darkprint CLI — `validate`
   AC1 is the whole design: the CLI calls the SAME `validateBundle`
   the server's `POST /api/validate/bundle` calls (D-270-01 C7), so
   a local pass and a server pass cannot disagree by construction
   rather than by care. Nothing here composes the engine a second
   way — no bare `loadBundle`, no `sortedByKey` of my own, no
   `ontologyView` default of my own; those are decisions
   `@/lib/server/engine` owns and a second copy is what AC1 exists
   to catch.

   AC6: this file reaches nothing. Its imports are the engine and
   the directory reader — no fetch, no credential, no environment.
   ============================================================ */

import { sortDiagnostics, type LoadBundleResult } from "../../../lib/core";
import { validateBundle } from "../../../lib/server/engine";
import { readBundleDirectory } from "./layout";

/**
 * Validate the bundle directory at `dir`.
 *
 * Returns the engine's OWN result type (D-270-03(2)), not a wrapper around it: AC1 is an
 * equality between two `LoadBundleResult`s, the CLI's over a directory and the server's
 * over the same bytes, and a wrapper would make that equality false for a correct CLI. A
 * caller wanting to know whether the manifest was stubbed calls `readBundleDirectory`,
 * which is on the barrel for exactly that.
 *
 * Local and offline (AC6). Throws `CliError` for a directory with no `topology.dot`; a
 * bundle that resolves WITH errors is an answer rather than a throw, which is the same
 * split `/api/validate/bundle` makes at 200 and for the same reason — a broken bundle is
 * a result the caller asked for.
 */
export function validate(dir: string): LoadBundleResult {
  const directory = readBundleDirectory(dir);
  const result = validateBundle({
    manifest: directory.manifest,
    dot: directory.dot,
    cardFiles: directory.cardFiles,
    ...(directory.extensions === undefined ? {} : { extensions: directory.extensions }),
  });

  /* Returned untouched on the ordinary path, so AC1's byte-identity is a property of the
     code rather than an argument about whether re-sorting an already-sorted array is the
     identity. Only the two-vocabularies case (D-270-04(3)) rebuilds the list, and it
     re-sorts because a diagnostic appended after `validateBundle` returned would otherwise
     sit outside the severity-first order every other reader of this array relies on. */
  if (directory.vocabularyConflict === undefined) return result;
  return {
    ...result,
    diagnostics: sortDiagnostics([directory.vocabularyConflict, ...result.diagnostics]),
  };
}
