/* ============================================================
   The archive the install line fetches unpacks to what the line
   promises, with the system tar the line names.
   ============================================================ */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { SKILL_ARCHIVE_ROOT } from "@/lib/skill";
import { packSkill, readSkillTree, sha256 } from "./skill-package.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SKILL_DIR = join(ROOT, SKILL_ARCHIVE_ROOT);

const files = readSkillTree(SKILL_DIR);
const packed = packSkill(files);

const scratch = mkdtempSync(join(tmpdir(), "darkprint-skill-package-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("the file list", () => {
  it("is every file under skills/darkprint, sorted, with SKILL.md and the references", () => {
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
    expect(paths).toContain("SKILL.md");
    for (const reference of readdirSync(join(SKILL_DIR, "references"))) {
      expect(paths).toContain(`references/${reference}`);
    }
    for (const template of readdirSync(join(SKILL_DIR, "templates"))) {
      expect(paths).toContain(`templates/${template}`);
    }
    // Nothing that is not a file of the skill. A stray editor swap file or a `.DS_Store`
    // would be served to every reader.
    for (const path of paths) expect(path).toMatch(/^(SKILL\.md|references\/[^/]+\.md|templates\/[^/]+\.(dot|yaml))$/);
  });
});

describe("the manifest", () => {
  it("hashes every file and the archive", () => {
    expect(packed.manifest.archiveRoot).toBe(SKILL_ARCHIVE_ROOT);
    expect(packed.manifest.name).toBe("darkprint");
    expect(packed.manifest.files.map((f) => f.path)).toEqual(files.map((f) => f.path));
    for (const [i, entry] of packed.manifest.files.entries()) {
      expect(entry.bytes).toBe(files[i].bytes.length);
      expect(entry.sha256).toBe(sha256(files[i].bytes));
    }
    expect(packed.manifest.archive.sha256).toBe(sha256(packed.tarball));
    expect(packed.manifest.archive.bytes).toBe(packed.tarball.length);
  });
});

describe("the archive", () => {
  it("is the same bytes when packed twice", () => {
    const again = packSkill(readSkillTree(SKILL_DIR));
    expect(again.tarball.equals(packed.tarball)).toBe(true);
    expect(again.manifest).toEqual(packed.manifest);
  });

  it("is a gzip stream with a zero mtime and a pinned OS byte", () => {
    expect(packed.tarball[0]).toBe(0x1f);
    expect(packed.tarball[1]).toBe(0x8b);
    expect(packed.tarball.readUInt32LE(4)).toBe(0);
    expect(packed.tarball[9]).toBe(0xff);
  });

  /**
   * Driven through the system tar with the flags the install line prints, because that is
   * what a reader's shell will do with it. Every entry has to sit under `skills/darkprint/`,
   * so `tar -C ~/.claude` lands the skill exactly where Claude Code reads it.
   */
  it("lists every file under the archive root and extracts with the printed flags", () => {
    const archive = join(scratch, "darkprint.tgz");
    writeFileSync(archive, packed.tarball);

    const listed = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
      .split("\n")
      .filter((line) => line !== "")
      .sort();
    expect(listed).toEqual(files.map((f) => `${SKILL_ARCHIVE_ROOT}/${f.path}`).sort());

    const parent = join(scratch, "home");
    execFileSync("mkdir", ["-p", parent]);
    execFileSync("sh", ["-c", `tar -xzf - -C "${parent}" < "${archive}"`]);
    for (const file of files) {
      const landed = readFileSync(join(parent, SKILL_ARCHIVE_ROOT, file.path));
      expect(landed.equals(file.bytes), file.path).toBe(true);
    }
  });
});
