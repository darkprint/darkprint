/* ============================================================
   DarkPrint backend — releaseFiles
   D-261-04's pre-visit: the reader T261's detail cutover needs
   and D-262-04 recorded as a gap — nothing published mapped a
   `ReleaseRef` to the file LIST a download panel renders.
   `serveFile` answers one named file; `exportRelease` needs a
   `bundleId` no summary carries. This closes the gap by
   consuming both, never restating either.
   ============================================================ */

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
}

/**
 * The file list of the release a `ReleaseRef` names, or `undefined` for the same four
 * silences as `serveFile` (B-03): no such handle, no such slug, a bundle this actor may
 * not read, a `version`/`digest` naming no release. The resolution is `serveFile`'s own
 * three calls in `serveFile`'s own order, consumed rather than re-derived.
 *
 * **The paths come from generation, and that cost is disclosed rather than hidden**: the
 * frozen store is keyed by digest and cannot enumerate (`ObjectStorage` has no list), so
 * this runs `exportRelease` and discards the bytes — a full folder build per call. The
 * page that renders the list already pays a registry read per request; if this figure
 * ever hurts, the fix is a persisted manifest beside the frozen folder, not a cache here.
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
  });
}
