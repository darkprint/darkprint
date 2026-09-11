/* ============================================================
   DarkPrint backend — publish: freezing a release's artefacts
   *Persisting the artefacts is not
   tidiness, it is the only mechanism by which "the bytes of that
   release" stay the bytes of that release.* T100 writes them at
   publish; T090 serves what was written. B-01's split then reads
   coherently — Postgres holds the canonical record and the current
   projection, object storage holds the frozen artefact.

   ── what forces one object per digest ──
   `ObjectStorage` addresses exactly one object per digest and
   nothing finer: `put`, `get` and `delete` each route through
   `keyForDigest`, which refuses anything that is not `sha256:`
   plus 64 lowercase hex digits. There is no path component and
   `lib/db/**` is T000's, not this task's to widen. So a folder
   cannot be stored file-per-key, and `persistArtefacts(storage,
   digest, files)` writes the whole file set as ONE object under
   the digest — which is also the only reading under which
   `readPersisted(storage, digest, path)` needs a `path` argument
   at all: it addresses by digest and selects within.

   ── why the codec is PUBLISHED and not merely used ──
   `readPersisted` is T090's and is not built. A container format
   invented here and left unstated is one its author cannot guess,
   and a frozen artefact nobody can decode is worth less than no
   artefact at all — the fallback at least produces bytes. So the
   decoder ships beside the encoder and is exported from this
   module's barrel, for T133's reason exactly: a published shape
   does not only stop the next author guessing, it makes every
   prior guess findable. `readPersisted` is expected to call
   `storage.get(digest)` and hand the result to `decodeArtefacts`,
   never to re-derive the layout.

   ── why JSON, and why it is deterministic ──
   `ExportedFile` is `{ path, text }` and both halves are strings,
   so nothing here has to encode binary. `exportBundle` already
   sorts its output by path and is pure, so the same release
   encodes to the same bytes on every call — which is what lets a
   re-publish of identical content overwrite its own object with
   an identical one rather than with a different serialisation of
   the same folder.
   ============================================================ */

import type { ExportedFile } from "@/lib/content/bundle-export";
import type { ObjectStorage } from "@/lib/db";

/**
 * Freeze one release's export folder.
 *
 * The digest is the release's, so the object's address is its content identity: a second
 * publish of the same bytes writes the same key with the same value, and an object left
 * behind by a rolled-back transaction is inert rather than stale — nothing else can ever
 * claim that key with different content.
 *
 * No refusal of its own. `storage.put` validates the digest through `keyForDigest` and
 * raises for a malformed one, which is the same guard every other storage verb inherits;
 * adding a second check here would be a second opinion about what a digest is.
 */
export async function persistArtefacts(
  storage: ObjectStorage,
  digest: string,
  files: readonly ExportedFile[],
): Promise<void> {
  await storage.put(digest, encodeArtefacts(files));
}

/**
 * The file set as the bytes stored under `digest`.
 *
 * Exported so a test can assert the round trip without reaching object storage, and so the
 * format has one author rather than one at each end.
 */
export function encodeArtefacts(files: readonly ExportedFile[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(files));
}

/**
 * The file set back out of the bytes `persistArtefacts` wrote, or `undefined` when the
 * object does not hold that shape.
 *
 * **`undefined` rather than a throw, and it is the same value `readPersisted` already
 * publishes for a pre-persistence release.** An object written before this format existed,
 * or truncated, is indistinguishable to a reader from a release that was never frozen — and
 * both have the same correct answer, which is to fall back to generating from Postgres. A
 * throw here would turn a servable release into a 500.
 *
 * Every entry is checked rather than the array's shape alone: one non-string `text` among
 * them would otherwise reach a caller as a file whose contents are not a file.
 */
export function decodeArtefacts(bytes: Uint8Array): readonly ExportedFile[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;

  const files: ExportedFile[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const { path, text } = entry as Record<string, unknown>;
    if (typeof path !== "string" || typeof text !== "string") return undefined;
    files.push({ path, text });
  }
  return files;
}

/**
 * One file out of a frozen folder, by the path `exportBundle` gave it.
 *
 * The selection half of `readPersisted`, published here so that verb is a lookup plus this
 * call rather than a second implementation of the layout. Byte-exact on `path`: the names
 * are `exportBundle`'s own and never assembled from caller input, which is the property
 * `serveFile`'s AC7 already rests on.
 */
export function selectArtefact(
  files: readonly ExportedFile[],
  path: string,
): Uint8Array | undefined {
  const file = files.find((candidate) => candidate.path === path);
  return file === undefined ? undefined : new TextEncoder().encode(file.text);
}
