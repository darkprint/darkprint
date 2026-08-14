/* ============================================================
   DarkPrint backend — lib/server/export row shapes
   T090's published `ServedFile`, plus the reference a caller
   names a release by.

   `ExportedFile`, `bundleFilePaths`, `cardFilePath` and
   `bundleHref` are `lib/content/bundle-export.ts`'s decision and
   are consumed, never restated: the file set is that module's and
   a second opinion about it here is how the folder on disk and
   the folder served come to disagree.
   ============================================================ */

/** One file as it leaves the server: the name inside the release, its bytes, its type. */
export interface ServedFile {
  /**
   * The export's own name for the file — `README.md`, `cards/planner@1.0.0.yaml`. Always
   * the string `exportBundle` produced, never a path assembled from the caller's input;
   * that identity is what AC7 rests on (see `serve-file.ts`).
   */
  path: string;
  bytes: Uint8Array;
  contentType: string;
}

/**
 * Which release a file is being asked for.
 *
 * `digest` and `version` are both optional and `digest` wins when both are present
 * (AC6). The two are not interchangeable and the difference is the point: a version
 * reference moves when a newer release is cut, a digest reference never does, and
 * `/mcp` calls that distinction load-bearing. Neither given means the current release,
 * which is the most a caller who named no release can mean.
 */
export interface ReleaseRef {
  ownerHandle: string;
  slug: string;
  version?: string;
  digest?: string;
}
