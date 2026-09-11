/* ============================================================
   DarkPrint backend — the READ half of the frozen artefact
   T100 writes the folder at publish (`persistArtefacts`); until
   this file existed the bytes were written and never read, and
   `serveFile` regenerated from Postgres unconditionally.

   ── the container format is consumed, never re-derived ──
   `ObjectStorage` addresses exactly one object per digest and
   nothing finer — `put`, `get` and `delete` all route through
   `keyForDigest`, which refuses anything that is not `sha256:`
   plus 64 lowercase hex digits — so a folder cannot be stored
   file-per-key and the whole file set is ONE object. That is also
   the only reading under which `readPersisted`'s `path` argument
   is needed at all: the lookup addresses by digest and selects
   within.

   `decodeArtefacts` and `selectArtefact` are T100's, published
   from `@/lib/server/publish` for this call specifically. A
   second opinion about the layout here is how the encoder and the
   decoder come to disagree about bytes neither can then read, so
   nothing in this file owns a format — it is a lookup plus two of
   T100's calls.
   ============================================================ */

import type { ExportedFile } from "@/lib/content/bundle-export";
import type { ObjectStorage } from "@/lib/db";
import { decodeArtefacts, selectArtefact } from "@/lib/server/publish";

/**
 * One file of one frozen release, or `undefined` when there is no frozen answer to give.
 *
 * **Three different absences deliberately share one value here**, because a caller holding
 * only this verb has the same response to each — generate from Postgres instead:
 *   - nothing was ever frozen under this digest, which is every release written before T100
 *     shipped `persistArtefacts`;
 *   - an object exists but does not carry this format, which `decodeArtefacts` answers
 *     `undefined` for by its own published decision (a throw there would turn a servable
 *     release into a 500);
 *   - the folder was frozen and does not contain this path.
 *
 * **`serveFile` does NOT use this verb, and the third case is why** — for it those three are
 * not one answer. A frozen folder is authoritative for its own digest, so a path missing
 * from one is `noSuchFile`, not a licence to regenerate: falling back there would let a
 * re-scored file set answer a path the frozen folder does not have, which is the defect AC6
 * exists to close. It reads `frozenFolder` below and selects for itself, which is also what
 * keeps the two of them one composition rather than two.
 *
 * **A storage FAILURE is not one of the three and is not swallowed.** `ObjectStorage.get`
 * already draws that line — its own contract reads *"`undefined` on a missing key, mirroring
 * B-03: absence is a value, not a thrown error"* — so a driver error arriving here is an
 * outage and propagates. It is sealed by the caller, because `ExportReadError` is this
 * module's one driver-failure class and a second sealing point would be a second opinion
 * about which failures are 500s.
 */
export async function readPersisted(
  storage: ObjectStorage,
  digest: string,
  path: string,
): Promise<Uint8Array | undefined> {
  const files = await frozenFolder(storage, digest);
  return files === undefined ? undefined : selectArtefact(files, path);
}

/**
 * The whole frozen folder for one digest, or `undefined` when none was ever written.
 *
 * Internal: `lib/server/export/index.ts` does not re-export it, so it is not a second
 * published way into the same object. It exists because `serveFile` needs to tell "no
 * frozen folder" from "frozen folder without that path" and `readPersisted`'s published
 * return type collapses the two — and the fix for that is one more reading of the object,
 * not a caller that repeats `storage.get` and `decodeArtefacts` for itself.
 */
export async function frozenFolder(
  storage: ObjectStorage,
  digest: string,
): Promise<readonly ExportedFile[] | undefined> {
  const bytes = await storage.get(digest);
  if (bytes === undefined) return undefined;
  return decodeArtefacts(bytes);
}
