/* ============================================================
   DarkPrint backend — serveFile
   One file of one release, at the owner-qualified address B-09
   gives it.

   ── AC7 is satisfied by construction or not at all ──
   `path` is compared, by exact string equality, against the names
   `exportBundle` produced. No filesystem path is built from caller
   input, so there is nothing to normalise and nothing to get
   wrong: `../../etc/passwd` is refused because it is not in the
   set, and so is `./README.md`, and so is `cards/../README.md` —
   each of which normalises to a legal file and is still not the
   string the export produced. That last class is the one that
   discriminates. A `path.join`-and-check-the-prefix guard passes
   the first and fails the other two.
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { buildExport } from "./build";
import { contentTypeFor } from "./content-type";
import { recordDownload } from "./downloads";
import { noSuchFile } from "./errors";
import { bundleByHandle, readableBy, resolveRelease } from "./lookup";
import type { ReleaseRef, ServedFile } from "./types";

/**
 * `undefined` when there is no release to serve from — no such handle, no such slug, a
 * bundle this actor may not read, or a `version`/`digest` naming no release of it. All
 * four are one answer on purpose (B-03): the route maps it to the same `problem+json`
 * 404 as a refused path, so nothing about which of them happened is externally visible.
 *
 * **Throws** `"serveFile: no such file in this release."` when the release did resolve
 * and the path is not one of its files. That is AC7's refusal, and it is a different
 * event from the four above: the caller has already been granted this release, so the
 * refusal tells them nothing new — and it names no file the release *does* contain, since
 * that is a listing they have not been given.
 */
export async function serveFile(
  db: Db,
  actor: Actor,
  ref: ReleaseRef,
  path: string,
): Promise<ServedFile | undefined> {
  const bundle = await bundleByHandle(db, ref.ownerHandle, ref.slug);
  if (bundle === undefined) return undefined;
  if (!readableBy(actor, bundle)) return undefined;

  const release = await resolveRelease(db, bundle.id, ref);
  if (release === undefined) return undefined;

  const files = await buildExport(db, actor, release);
  const file = files.find((candidate) => candidate.path === path);
  if (file === undefined) throw noSuchFile();

  const served: ServedFile = {
    path: file.path,
    bytes: new TextEncoder().encode(file.text),
    contentType: contentTypeFor(file.path),
  };

  // After the file is in hand, so a refused path is not counted as a download, and the
  // count is of files that actually left. Never rejects (B-14, `downloads.ts`).
  await recordDownload(db, { kind: "blueprint", refId: bundle.id });
  return served;
}
