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

   ── AC6 needs a frozen artefact, and freezing at publish was not
      enough (T091) ──
   T100 writes the folder to object storage at publish, and until
   this file read it the frozen bytes were written and never read.
   Persisting is necessary and NOT sufficient: `release.autonomy`
   and `release.security` are columns on the row a digest names,
   B-08 re-scores them on an ontology release, and
   `bundle-export.ts` quotes both into `README.md` — so a
   regenerate-every-time serve returns different bytes over time at
   the one address `/mcp` calls load-bearing precisely because it
   does not move.

   ── why the fallback also FREEZES ──
   Every release in the database predates `persistArtefacts`, so
   the fallback is not a transitional courtesy: without a write
   here those releases would regenerate forever and AC6 would never
   hold for a single one of them. So a miss generates from
   Postgres, freezes what it generated, and serves it — the next
   read is answered from the object and the bytes stop moving.

   The freeze is after `buildExport` RETURNS, which is what makes
   `checkFactoryDot` a guard rather than a formality: a release
   whose emitted `factory.dot` fails AC4 throws out of
   `buildExport` and is therefore never frozen, so no later read
   can serve it out of storage past the check that refused it.
   The converse is a known gap and is the orchestrator's to record:
   a release frozen under one lint rule is served unchecked if the
   rule later changes, which is the case `build.ts`'s own header
   put the check at the serving edge to prevent. AC6 and re-linting
   at serve time are in genuine conflict — one requires the bytes
   not to change, the other requires that they may — and AC6 wins
   by ruling.
   ============================================================ */

import { createObjectStorage, type Db, type ObjectStorage } from "@/lib/db";
import type { ReleaseRecord } from "@/lib/server/archive";
import type { Actor } from "@/lib/server/policy";
import { persistArtefacts, selectArtefact } from "@/lib/server/publish";
import { assertPinnedCardsReadable, buildExport } from "./build";
import { contentTypeFor } from "./content-type";
import { recordDownload } from "./downloads";
import { noSuchFile, readFailed } from "./errors";
import { bundleByHandle, readableBy, resolveRelease } from "./lookup";
import { frozenFolder } from "./persisted";
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
  /**
   * Where the frozen artefacts live, so the four-argument call T090 published is unchanged
   * and a caller with no reason to name a bucket does not have to.
   *
   * **`= undefined` and NOT `?`, and the difference is observable rather than stylistic.**
   * TypeScript's `?` erases to nothing, so `storage?: ObjectStorage` still reports
   * `Function.length === 5` and `t090/surface.test.ts`'s pinned arity of 4 reds against a
   * correct implementation. Only a default-value expression or a rest element stops a
   * parameter counting. `publish` shipped the `?` spelling once and it was charged as F5.
   *
   * The default is `undefined` rather than `createObjectStorage()` for that charge's other
   * half: `objectStorageConfigFromEnv()` throws for an unset `S3_*`, so a default evaluated
   * on entry would make the four refusals above — an unknown handle, an invisible bundle —
   * depend on storage being configured. The handle is built below instead, after the last
   * of them, so nothing that answers `undefined` ever touches a bucket.
   */
  storage: ObjectStorage | undefined = undefined,
): Promise<ServedFile | undefined> {
  const bundle = await bundleByHandle(db, ref.ownerHandle, ref.slug);
  if (bundle === undefined) return undefined;
  if (!readableBy(actor, bundle)) return undefined;

  const release = await resolveRelease(db, bundle.id, ref);
  if (release === undefined) return undefined;

  const served = await servedBytes(db, actor, release, path, storage);

  // After the file is in hand, so a refused path is not counted as a download, and the
  // count is of files that actually left. Never rejects (B-14, `downloads.ts`).
  await recordDownload(db, { kind: "blueprint", refId: bundle.id });
  return served;
}

/**
 * The frozen folder's answer, or Postgres's — and on Postgres's, the freeze that stops the
 * next read having to ask it again.
 *
 * Split out so the two storage calls sit in one place with one sealing rule, and so the
 * `noSuchFile` throws stay OUTSIDE it: that refusal is a fact about the release and a 404,
 * and catching it here would re-render it as the driver-failure sibling and turn every
 * AC7 refusal into a 500.
 */
async function servedBytes(
  db: Db,
  actor: Actor,
  release: ReleaseRecord,
  path: string,
  storage: ObjectStorage | undefined,
): Promise<ServedFile> {
  /* One handle for the read and the freeze, built here rather than at the parameter list —
     see the `storage` parameter above for why the four `undefined` answers must not depend
     on `S3_*` being set. A configuration failure is infrastructure and is sealed with the
     driver failures below rather than escaping as a bare `Error`. */
  const frozen = await sealed(async () => {
    const bucket = storage ?? createObjectStorage();
    return { bucket, files: await frozenFolder(bucket, release.digest) };
  });

  if (frozen.files !== undefined) {
    /* B-07 before a single byte of the frozen folder leaves, because the check that would
       have refused this caller lives inside `buildExport` and the frozen path skips it.
       `readableBy` above is the BUNDLE's visibility; a release's pinned cards carry their
       own, and a private one may not travel inside a public bundle's folder just because
       the bundle is public. The frozen object is keyed by `bundleDigest`, which covers the
       DOT and the card digests and NOTHING about who may read them — so without this line a
       folder frozen by the cards' owner serves those cards to anonymous, which is what the
       probe that produced this line measured. */
    await assertPinnedCardsReadable(db, actor, release.cardRefs);

    /* The frozen folder is authoritative for its own digest. A path it does not carry is
       `noSuchFile` and NOT a reason to regenerate: falling back here would let a re-scored
       file set answer a path the frozen folder does not have, at an address whose whole
       purpose is that its answer does not move. */
    const bytes = selectArtefact(frozen.files, path);
    if (bytes === undefined) throw noSuchFile();
    return { path, bytes, contentType: contentTypeFor(path) };
  }

  const files = await buildExport(db, actor, release);

  /* After `buildExport` returned, so `checkFactoryDot` has already passed and a release
     that fails AC4 is never frozen — and before the path is looked up, so whether a release
     is frozen does not depend on which of its files somebody happened to ask for first.
     Through T100's verb rather than by encoding here: the container format has one author. */
  await sealed(() => persistArtefacts(frozen.bucket, release.digest, files));

  const file = files.find((candidate) => candidate.path === path);
  if (file === undefined) throw noSuchFile();
  return {
    path: file.path,
    bytes: new TextEncoder().encode(file.text),
    contentType: contentTypeFor(file.path),
  };
}

/**
 * Object storage's failures as this module's one driver-failure class.
 *
 * D-90-A, applied to the second medium: an unwrapped driver error escaping raw made one
 * Postgres outage answer 404 from one statement and 500 from another, and an S3 error
 * carrying an endpoint and a key would escape the same way. `ExportReadError` is the
 * sibling a route reads as 500, and its message is `export: reading this release failed.`
 * — already the module's literal for exactly this, and already named `export:` rather than
 * `exportRelease:` because it is reached from the serving path too. Adding a ninth form for
 * the bucket would be a second author on one sentence, and the contract records that every
 * form arriving after the ruling has cost coverage.
 *
 * **A failed freeze is loud rather than swallowed, and that is not an availability cliff.**
 * The read above runs first and seals the same way, so a bucket that is down or misconfigured
 * has already thrown before anything reaches the write — which leaves the write's own failure
 * as the narrow case where the object is readable and not writable. Swallowing it there is
 * what would be dangerous: a freeze that fails silently leaves AC6 false forever while every
 * cell that tests only the fallback stays green.
 */
async function sealed<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    throw readFailed(err);
  }
}
