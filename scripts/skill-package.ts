/* ============================================================
   Packing the authoring skill for the site to serve.

   `scripts/generate-bundles.ts` decides where the output lands; this module decides what
   the bytes are, and it is kept apart for the reason `scripts/skill-refs.ts` is: vitest can
   import it through the `@/` alias and check the archive without a subprocess.

   ── Why the archive is written here and not by the system tar ──
   A tarball made by `tar czf` carries the machine's clock, user and group in every header,
   so two builds of an unchanged skill produce two different files and the committed copy
   under `public/skill/` changes on every build. The ustar headers below carry a fixed
   mtime, uid 0, gid 0 and a fixed mode, the entries are sorted, and the gzip header's OS
   byte is pinned, so the same tree gives the same bytes on the same zlib. The deflate
   stream itself is zlib's, and a different zlib may compress differently; the manifest
   therefore hashes every file's uncompressed bytes as well as the archive, and the file
   hashes are the ones that hold across machines.

   ── Why the entries are rooted at `skills/darkprint/` ──
   That is the suffix both agents read user skills from (`~/.claude/skills/<name>`,
   `~/.agents/skills/<name>`), so one archive and `tar -C <parent>` serve both. The root
   string is `SKILL_ARCHIVE_ROOT` in `lib/skill.ts`, shared with the install lines the site
   prints, so the two cannot disagree about where the skill lands.
   ============================================================ */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync, constants as zlibConstants } from "node:zlib";

import { SKILL_ARCHIVE_ROOT } from "@/lib/skill";

/** One file of the skill: its path relative to the skill directory, POSIX-separated. */
export interface SkillFile {
  path: string;
  bytes: Buffer;
}

export interface SkillManifestEntry {
  path: string;
  bytes: number;
  sha256: string;
}

export interface SkillManifest {
  /** The skill's name, which is also the directory an agent loads it from. */
  name: string;
  /** Every archive entry's path begins with this, followed by a slash. */
  archiveRoot: string;
  archive: { path: string; bytes: number; sha256: string };
  files: SkillManifestEntry[];
}

/** The file name of the archive under `public/skill/`, and of the manifest beside it. */
export const SKILL_ARCHIVE_FILE = "darkprint.tgz";
export const SKILL_MANIFEST_FILE = "manifest.json";

/**
 * A fixed modification time for every header: 2000-01-01T00:00:00Z. A constant rather
 * than zero because some extractors treat a 1970 timestamp as "unknown" and warn about it.
 */
const FIXED_MTIME = 946684800;

const BLOCK = 512;
const USTAR_NAME_LIMIT = 100;

/**
 * Every regular file under `dir`, recursively, sorted by path.
 *
 * Sorted with a plain code-unit comparison rather than a locale one, so the archive order
 * does not depend on the machine's locale.
 */
export function readSkillTree(dir: string): SkillFile[] {
  const files: SkillFile[] = [];
  const walk = (relative: string): void => {
    const here = relative === "" ? dir : join(dir, relative);
    for (const entry of readdirSync(here, { withFileTypes: true })) {
      const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push({ path, bytes: readFileSync(join(dir, path)) });
    }
  };
  walk("");
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** The archive and the manifest that describes it, from an already-sorted file list. */
export function packSkill(files: readonly SkillFile[]): { tarball: Buffer; manifest: SkillManifest } {
  if (files.length === 0) throw new Error("skill-package: nothing to pack.");
  const tarball = gzipDeterministic(tar(files));
  return {
    tarball,
    manifest: {
      name: SKILL_ARCHIVE_ROOT.split("/").pop() ?? SKILL_ARCHIVE_ROOT,
      archiveRoot: SKILL_ARCHIVE_ROOT,
      archive: { path: SKILL_ARCHIVE_FILE, bytes: tarball.length, sha256: sha256(tarball) },
      files: files.map((file) => ({
        path: file.path,
        bytes: file.bytes.length,
        sha256: sha256(file.bytes),
      })),
    },
  };
}

/* --------------------- ustar --------------------- */

function tar(files: readonly SkillFile[]): Buffer {
  const parts: Buffer[] = [];
  for (const file of files) {
    const name = `${SKILL_ARCHIVE_ROOT}/${file.path}`;
    // The ustar `prefix` field would allow longer names, and nothing in the skill needs it.
    // Refusing keeps the writer to the one layout every extractor agrees on.
    if (Buffer.byteLength(name, "utf8") >= USTAR_NAME_LIMIT) {
      throw new Error(`skill-package: \`${name}\` is too long for a ustar header.`);
    }
    parts.push(header(name, file.bytes.length), file.bytes, padding(file.bytes.length));
  }
  // Two zero blocks close the archive.
  parts.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(parts);
}

function header(name: string, size: number): Buffer {
  const block = Buffer.alloc(BLOCK);
  block.write(name, 0, "utf8");
  octal(block, 100, 8, 0o644);
  octal(block, 108, 8, 0);
  octal(block, 116, 8, 0);
  octal(block, 124, 12, size);
  octal(block, 136, 12, FIXED_MTIME);
  // The checksum is computed with its own field read as eight spaces.
  block.fill(0x20, 148, 156);
  block.write("0", 156, "ascii");
  block.write("ustar\0", 257, "ascii");
  block.write("00", 263, "ascii");
  let sum = 0;
  for (const byte of block) sum += byte;
  // Six octal digits, a NUL, then a space: the form every historical tar writes.
  block.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
  return block;
}

/** A zero-padded octal field, NUL-terminated, as ustar spells numbers. */
function octal(block: Buffer, offset: number, width: number, value: number): void {
  block.write(`${value.toString(8).padStart(width - 1, "0")}\0`, offset, "ascii");
}

function padding(size: number): Buffer {
  const remainder = size % BLOCK;
  return Buffer.alloc(remainder === 0 ? 0 : BLOCK - remainder);
}

/* --------------------- gzip --------------------- */

/**
 * gzip with the header's OS byte pinned. Node writes the operating system it was built for
 * into byte 9, so the same input gzipped on macOS and on Linux differs in one byte that no
 * decompressor reads. Node already writes a zero mtime into bytes 4 to 7.
 */
function gzipDeterministic(bytes: Buffer): Buffer {
  const out = gzipSync(bytes, { level: zlibConstants.Z_BEST_COMPRESSION });
  out[9] = 0xff;
  return out;
}
