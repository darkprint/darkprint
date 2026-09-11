/* ============================================================
   DarkPrint backend — exportRelease
   The folder, as files. No download event: the contract counts one
   event per *served* file, this verb returns `ExportedFile[]` where
   the serving verbs return `ServedFile`, and the folder is fetched
   file by file by `bundleDownloadCommand`'s curl glob — so counting
   here as well would count every folder download twice.
   ============================================================ */

import type { ExportedFile } from "@/lib/content/bundle-export";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { buildExport } from "./build";
import { noSuchRelease } from "./errors";
import { bundleById, readableBy, resolveRelease } from "./lookup";

/**
 * Every file of one release, keyed by digest.
 *
 * **Four different failures answer with one sentence**, because B-03 requires 404 over
 * 403 so existence does not leak: a `bundleId` that is not a uuid, one that names no
 * bundle, one the actor may not read, and a digest naming no release of it. A distinct
 * message for "it exists but is not yours" reinstates exactly the leak the status code
 * closed.
 *
 * By digest rather than by version, and not because a version would not work: this is the
 * verb T100 and T270 call to persist or ship one immutable set of bytes, and a version is
 * a moving reference (AC6). `serveFile` is where a version reference is resolved.
 */
export async function exportRelease(
  db: Db,
  actor: Actor,
  bundleId: string,
  digest: string,
): Promise<readonly ExportedFile[]> {
  const bundle = await bundleById(db, bundleId);
  if (bundle === undefined) throw noSuchRelease();
  if (!readableBy(actor, bundle)) throw noSuchRelease();

  // Resolved through T010's own `getRelease`, which validates the digest via
  // `keyForDigest` and answers `undefined` for a malformed one rather than letting it
  // reach the driver.
  const release = await resolveRelease(db, bundle.id, { digest });
  if (release === undefined) throw noSuchRelease();

  return buildExport(db, actor, release);
}
