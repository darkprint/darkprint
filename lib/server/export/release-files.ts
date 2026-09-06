/* ============================================================
   DarkPrint backend — releaseFiles
   D-261-04's pre-visit: the reader T261's detail cutover needs
   and D-262-04 recorded as a gap — nothing published mapped a
   `ReleaseRef` to the file LIST a download panel renders.
   `serveFile` answers one named file; `exportRelease` needs a
   `bundleId` no summary carries. This closes the gap by
   consuming both, never restating either.
   ============================================================ */

import { BUNDLE_README } from "@/lib/content/bundle-export";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { exportRelease } from "./export-release";
import { bundleByHandle, readableBy, resolveRelease } from "./lookup";
import type { ReleaseRef } from "./types";

/** What a panel needs to draw a release's folder: its identity, and its paths. */
export interface ReleaseFiles {
  /** The resolved release's digest — the immutable address `blueprintFileHref` binds. */
  digest: string;
  version: string;
  /** Bundle-relative, forward slashes, in `buildExport`'s own sorted order. */
  files: readonly string[];
  /**
   * The text of the release's `README.md`, or `undefined` when it carries none.
   *
   * Carried because the page renders this document rather than linking to it (owner
   * instruction, 2026-09-03: the blueprint page adopts GitHub's README-below-the-files
   * layout). It is the generated `bundleReadme` of the very release `digest` names, taken
   * from the export pass the file list already costs.
   *
   * **`undefined` is a real answer, not an error.** A folder uploaded by hand is under no
   * obligation to contain a `README.md`, and inventing a placeholder here would put a
   * sentence DarkPrint wrote into a document the reader would read as the author's. What
   * an absent README looks like on screen is the caller's decision.
   */
  readme: string | undefined;
}

/**
 * The file list of the release a `ReleaseRef` names, or `undefined` for the same four
 * silences as `serveFile` (B-03): no such handle, no such slug, a bundle this actor may
 * not read, a `version`/`digest` naming no release. The resolution is `serveFile`'s own
 * three calls in `serveFile`'s own order, consumed rather than re-derived.
 *
 * **The paths come from generation, and that cost is disclosed rather than hidden**: the
 * frozen store is keyed by digest and cannot enumerate (`ObjectStorage` has no list), so
 * this runs `exportRelease` and keeps only the paths and the README text — a full folder
 * build per call. The page that renders the list already pays a registry read per request;
 * if this figure ever hurts, the fix is a persisted manifest beside the frozen folder, not
 * a cache here.
 *
 * `readme` is read out of that same already-built array. A second `exportRelease` pass, or
 * a `serveFile` for the one path, would double the cost this docblock exists to disclose
 * and would let the two answers disagree about which release they came from.
 *
 * **No `recordDownload`.** A listing is not a download: nothing left, and counting the
 * panel's render would count every page view as a file transfer (B-14's counters count
 * what actually happened).
 */
export async function releaseFiles(
  db: Db,
  actor: Actor,
  ref: ReleaseRef,
): Promise<ReleaseFiles | undefined> {
  const bundle = await bundleByHandle(db, ref.ownerHandle, ref.slug);
  if (bundle === undefined) return undefined;
  if (!readableBy(actor, bundle)) return undefined;

  const release = await resolveRelease(db, bundle.id, ref);
  if (release === undefined) return undefined;

  const files = await exportRelease(db, actor, bundle.id, release.digest);
  return Object.freeze({
    digest: release.digest,
    version: release.version,
    files: Object.freeze(files.map((file) => file.path)),
    /* Matched on `BUNDLE_README` rather than a literal so this and the writer in
       `bundle-export.ts` cannot drift into naming two different files. */
    readme: files.find((file) => file.path === BUNDLE_README)?.text,
  });
}
