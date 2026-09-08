/* ============================================================
   DarkPrint backend — releaseArchive
   One release as a single `.tgz`, built in memory from the same
   file set `exportRelease` answers, so the folder a browser saves
   and the folder the CLI clones are one file set with two
   transports. A ustar writer plus `node:zlib` is the whole of it:
   the format is 512-byte headers over the bytes, and a dependency
   for that would be a dependency for arithmetic.
   ============================================================ */

import { gzipSync } from "node:zlib";

import type { ExportedFile } from "@/lib/content/bundle-export";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { exportRelease } from "./export-release";
import { bundleByHandle, readableBy, resolveRelease } from "./lookup";
import type { ReleaseRef } from "./types";

/** What a route needs to answer the archive: its identity, its listing, and the bytes. */
export interface ReleaseArchive {
  /** The bundle's own row id, which is the grain the download counter keeps. */
  bundleId: string;
  digest: string;
  version: string;
  /** Bundle-relative, forward slashes, in `exportRelease`'s own order. */
  files: readonly string[];
  /** The gzipped tar. Every entry sits under a `<slug>/` folder, the way the CLI lands one. */
  bytes: Uint8Array;
}

/**
 * The archive of the release a `ReleaseRef` names, or `undefined` for the same four
 * silences as `serveFile`: no such handle, no such slug, a bundle this actor may not read,
 * a `version` or `digest` naming no release. Absent and unreadable are one value so that
 * existence never leaks through the difference. `exportRelease`'s own refusals for a
 * release that does not resolve are thrown through unchanged, so a route maps them exactly
 * as the file routes do.
 *
 * Every entry is prefixed with the slug so the archive unpacks into one folder rather than
 * spilling a README into whatever directory the reader happened to be in; `darkprint clone`
 * writes to `<slug>/` for the same reason, and the two should land the same shape.
 */
export async function releaseArchive(
  db: Db,
  actor: Actor,
  ref: ReleaseRef,
): Promise<ReleaseArchive | undefined> {
  const bundle = await bundleByHandle(db, ref.ownerHandle, ref.slug);
  if (bundle === undefined) return undefined;
  if (!readableBy(actor, bundle)) return undefined;

  const release = await resolveRelease(db, bundle.id, ref);
  if (release === undefined) return undefined;

  const files = await exportRelease(db, actor, bundle.id, release.digest);
  const tar = ustar(
    files.map((file) => ({ path: `${bundle.slug}/${file.path}`, text: file.text })),
    release.createdAt,
  );
  return Object.freeze({
    bundleId: bundle.id,
    digest: release.digest,
    version: release.version,
    files: Object.freeze(files.map((file) => file.path)),
    bytes: new Uint8Array(gzipSync(tar)),
  });
}

/* --------------------- the writer --------------------- */

const BLOCK = 512;
const NAME_FIELD = 100;
const PREFIX_FIELD = 155;

/**
 * A ustar stream over UTF-8 text files: one header block and the padded bytes per file,
 * then the two zero blocks that end an archive. Every entry is a regular file at 0644 with
 * the release's own timestamp, so two downloads of one release are byte-identical.
 */
function ustar(files: readonly ExportedFile[], mtime: Date): Buffer {
  const seconds = Math.max(0, Math.floor(mtime.getTime() / 1000));
  const parts: Buffer[] = [];
  for (const file of files) {
    const bytes = Buffer.from(file.text, "utf8");
    parts.push(header(file.path, bytes.byteLength, seconds), bytes);
    const rest = bytes.byteLength % BLOCK;
    if (rest !== 0) parts.push(Buffer.alloc(BLOCK - rest));
  }
  parts.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(parts);
}

function header(path: string, size: number, mtime: number): Buffer {
  const { name, prefix } = splitName(path);
  const block = Buffer.alloc(BLOCK);
  block.write(name, 0, NAME_FIELD, "utf8");
  octal(block, 100, 8, 0o644);
  octal(block, 108, 8, 0);
  octal(block, 116, 8, 0);
  octal(block, 124, 12, size);
  octal(block, 136, 12, mtime);
  block.fill(0x20, 148, 156);
  block.write("0", 156, 1, "ascii");
  block.write("ustar\0", 257, 6, "ascii");
  block.write("00", 263, 2, "ascii");
  octal(block, 329, 8, 0);
  octal(block, 337, 8, 0);
  block.write(prefix, 345, PREFIX_FIELD, "utf8");

  /* The checksum is the byte sum of the header with its own field read as spaces, written
     as six octal digits, a NUL and a space, which is the form every reader accepts. */
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return block;
}

/** A zero-padded octal field, NUL-terminated, the width the ustar layout gives it. */
function octal(block: Buffer, at: number, width: number, value: number): void {
  block.write(`${value.toString(8).padStart(width - 1, "0")}\0`, at, width, "ascii");
}

/**
 * A path longer than the 100-byte name field is split at a `/` into ustar's prefix and
 * name, which a reader rejoins with a slash. A path neither field can hold is refused
 * rather than truncated: a silently shortened name is a file the reader cannot find.
 */
function splitName(path: string): { name: string; prefix: string } {
  if (Buffer.byteLength(path, "utf8") <= NAME_FIELD) return { name: path, prefix: "" };
  for (let cut = path.lastIndexOf("/"); cut > 0; cut = path.lastIndexOf("/", cut - 1)) {
    const prefix = path.slice(0, cut);
    const name = path.slice(cut + 1);
    if (
      Buffer.byteLength(prefix, "utf8") <= PREFIX_FIELD &&
      Buffer.byteLength(name, "utf8") <= NAME_FIELD
    ) {
      return { name, prefix };
    }
  }
  throw new Error(`releaseArchive: \`${path}\` is too long for a ustar entry.`);
}
