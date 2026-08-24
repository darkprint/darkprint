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

   AC6: this file reaches nothing. Its imports are the engine, the
   directory reader and `node:fs` through it — no fetch, no
   credential, no environment.
   ============================================================ */

import { validateBundle } from "@/lib/server/engine";
import type { LoadBundleResult } from "@/lib/core";
import { readBundleDirectory, type BundleDirectory } from "./layout";

/** `validate`'s answer: the engine's own result, plus what was read to get it. */
export interface ValidateResult {
  /**
   * `validateBundle`'s return, unaltered and NOT restated (D-270-03b). Re-sorting,
   * re-shaping or filtering it here would put a second author on the document AC1
   * compares byte for byte.
   */
  result: LoadBundleResult;
  /** What the reader found, so a renderer can say the manifest was stubbed. */
  directory: BundleDirectory;
}

/**
 * Validate the bundle directory at `dir`.
 *
 * Local and offline (AC6). Throws `CliError` for a directory with no `blueprint.dot`; a
 * bundle that resolves WITH errors is an answer rather than a throw, which is the same
 * split `/api/validate/bundle` makes at 200 and for the same reason — a broken bundle is
 * a result the caller asked for.
 */
export function validate(dir: string): ValidateResult {
  const directory = readBundleDirectory(dir);
  return {
    directory,
    result: validateBundle({
      manifest: directory.manifest,
      dot: directory.dot,
      cardFiles: directory.cardFiles,
      ...(directory.extensions === undefined ? {} : { extensions: directory.extensions }),
    }),
  };
}
