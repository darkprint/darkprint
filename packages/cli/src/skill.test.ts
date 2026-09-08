/* ============================================================
   `darkprint skill install`, driven in-process.

   The verb is a copy from the package to a folder an agent reads,
   and the things that go wrong with a copy are all on disk: it
   lands one level off and nothing loads it, an old file survives
   beside the new ones, or the destination is the source and the
   copy begins by deleting it. Each is a cell here, over real
   directories under a scratch home, and the folder names come from
   `lib/skill.ts` so the verb and the site agree about where a
   skill goes.
   ============================================================ */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { SKILL_ARCHIVE_ROOT } from "../../../lib/skill";
import { CliError } from "./errors";
import { collectingIo } from "./io";
import { runCli } from "./run";
import { frontmatterVersion, installSkill, locatePackagedSkill } from "./skill";

const scratch = mkdtempSync(join(tmpdir(), "darkprint-cli-skill-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** The repository's own tree, which is what the package copies at build time. */
const SOURCE = resolve(...SKILL_ARCHIVE_ROOT.split("/"));

let homes = 0;
/** A fresh, empty home directory per cell, so no cell reads another's install. */
function freshHome(): string {
  const home = join(scratch, `home-${homes++}`);
  mkdirSync(home, { recursive: true });
  return home;
}

/** Every regular file under `dir`, relative with forward slashes, sorted. */
function walk(dir: string): string[] {
  const out: string[] = [];
  const visit = (here: string): void => {
    for (const entry of readdirSync(here, { withFileTypes: true })) {
      const full = join(here, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(relative(dir, full).split(sep).join("/"));
    }
  };
  visit(dir);
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

describe("where the copy lands", () => {
  it("is ~/.claude/skills/darkprint by default, created from nothing", () => {
    const home = freshHome();
    const result = installSkill({ home });
    expect(result.destination).toBe(join(home, ".claude", "skills", "darkprint"));
    expect(existsSync(join(result.destination, "SKILL.md"))).toBe(true);
  });

  it("is ~/.agents/skills/darkprint with --codex", () => {
    const home = freshHome();
    const result = installSkill({ home, codex: true });
    expect(result.destination).toBe(join(home, ".agents", "skills", "darkprint"));
    expect(existsSync(join(result.destination, "SKILL.md"))).toBe(true);
    expect(existsSync(join(home, ".claude"))).toBe(false);
  });

  it("is <dir>/skills/darkprint with --dir, whatever the home is", () => {
    const home = freshHome();
    const dir = join(scratch, "elsewhere", "deeper");
    const result = installSkill({ home, dir });
    expect(result.destination).toBe(join(dir, "skills", "darkprint"));
    expect(existsSync(join(result.destination, "SKILL.md"))).toBe(true);
    expect(existsSync(join(home, ".claude"))).toBe(false);
  });
});

describe("what the copy holds", () => {
  it("is the packaged tree, every file byte for byte and nothing else", () => {
    const result = installSkill({ home: freshHome() });
    const expected = walk(SOURCE);
    expect(expected.length).toBeGreaterThan(5);
    expect(walk(result.destination)).toEqual(expected);
    expect([...result.files]).toEqual(expected);
    for (const file of expected) {
      expect(readFileSync(join(result.destination, file))).toEqual(readFileSync(join(SOURCE, file)));
    }
  });

  it("replaces an earlier copy whole, so a file the skill dropped does not survive", () => {
    const home = freshHome();
    const destination = join(home, ".claude", "skills", "darkprint");
    mkdirSync(join(destination, "references"), { recursive: true });
    writeFileSync(join(destination, "references", "stale.md"), "gone in the next version\n");
    writeFileSync(join(destination, "SKILL.md"), "an older SKILL.md\n");

    installSkill({ home });

    expect(existsSync(join(destination, "references", "stale.md"))).toBe(false);
    expect(readFileSync(join(destination, "SKILL.md"), "utf8")).toBe(readFileSync(join(SOURCE, "SKILL.md"), "utf8"));
  });

  it("reports the version SKILL.md's frontmatter carries", () => {
    const result = installSkill({ home: freshHome() });
    /* Read independently, so the cell is not the verb agreeing with itself. */
    const front = readFileSync(join(SOURCE, "SKILL.md"), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const declared = front.match(/^\s+version:\s*"?([^"\n]+)"?\s*$/m)?.[1];
    expect(declared, "skills/darkprint/SKILL.md carries no metadata.version").toBeDefined();
    expect(result.version).toBe(declared);
  });
});

describe("where the packaged tree is looked for", () => {
  /** A directory laid out like the distributable: `dist/` beside `skill/darkprint/`. */
  function packaged(version: string | undefined): string {
    const pkg = mkdtempSync(join(scratch, "pkg-"));
    mkdirSync(join(pkg, "dist"));
    mkdirSync(join(pkg, "skill", "darkprint", "references"), { recursive: true });
    const front = version === undefined ? "name: darkprint\n" : `name: darkprint\nmetadata:\n  version: "${version}"\n`;
    writeFileSync(join(pkg, "skill", "darkprint", "SKILL.md"), `---\n${front}---\n\n# A test skill\n`);
    writeFileSync(join(pkg, "skill", "darkprint", "references", "one.md"), "one\n");
    return pkg;
  }

  it("is beside the running module's directory, as npm lays the package out", () => {
    const pkg = packaged("9.9.9");
    const result = installSkill({ home: freshHome(), from: join(pkg, "dist") });
    expect(result.source).toBe(join(pkg, "skill", "darkprint"));
    expect(result.version).toBe("9.9.9");
    expect(walk(result.destination)).toEqual(["SKILL.md", "references/one.md"]);
  });

  it("falls back to the repository's own tree when run from packages/cli/src", () => {
    expect(locatePackagedSkill(resolve("packages", "cli", "src"))).toBe(SOURCE);
  });

  it("says so when the module runs beside no copy at all", () => {
    const bare = mkdtempSync(join(scratch, "bare-"));
    expect(() => installSkill({ home: freshHome(), from: join(bare, "dist") })).toThrow(CliError);
    expect(() => installSkill({ home: freshHome(), from: join(bare, "dist") })).toThrow(
      "skill: this build carries no copy of the DarkPrint skill.",
    );
  });

  it("reports no version when the frontmatter names none, rather than inventing one", () => {
    const pkg = packaged(undefined);
    expect(installSkill({ home: freshHome(), from: join(pkg, "dist") }).version).toBeUndefined();
  });

  /**
   * From a checkout, `--dir .` at the repository root names `skills/darkprint` itself, and a
   * copy that began by removing its destination would delete the source. Refused before
   * anything is removed, and the source is checked afterwards rather than assumed.
   */
  it("refuses a destination that is the source, before removing anything", () => {
    const from = resolve("packages", "cli", "src");
    expect(() => installSkill({ from, dir: process.cwd() })).toThrow(
      "skill: the destination is the packaged copy itself.",
    );
    expect(existsSync(join(SOURCE, "SKILL.md")), "the refusal came after the source was removed").toBe(true);
  });

  it("refuses a destination that contains the source, for the same reason", () => {
    const root = mkdtempSync(join(scratch, "nested-"));
    const pkg = join(root, "skills", "darkprint", "node_modules", "darkprint");
    mkdirSync(join(pkg, "dist"), { recursive: true });
    mkdirSync(join(pkg, "skill", "darkprint"), { recursive: true });
    writeFileSync(join(pkg, "skill", "darkprint", "SKILL.md"), "---\nname: darkprint\n---\n");
    expect(() => installSkill({ from: join(pkg, "dist"), dir: root })).toThrow(CliError);
    expect(existsSync(join(pkg, "skill", "darkprint", "SKILL.md"))).toBe(true);
  });
});

describe("the frontmatter reader", () => {
  it("reads metadata.version, then a top-level version, and otherwise nothing", () => {
    expect(frontmatterVersion('---\nname: x\nmetadata:\n  version: "1.2.3"\n---\nbody')).toBe("1.2.3");
    expect(frontmatterVersion("---\nname: x\nversion: 2\n---\nbody")).toBe("2");
    expect(frontmatterVersion("---\nname: x\n---\nbody")).toBeUndefined();
    expect(frontmatterVersion("# no frontmatter at all\n")).toBeUndefined();
    expect(frontmatterVersion("---\n: [not yaml\n---\n")).toBeUndefined();
  });
});

describe("through runCli", () => {
  it("prints the destination and the version, and exits 0", async () => {
    const io = collectingIo();
    const dir = join(scratch, "via-cli");
    const code = await runCli(["skill", "install", "--dir", dir], io);
    expect(code).toBe(0);
    const printed = io.stdout.join("");
    expect(printed).toContain(join(dir, "skills", "darkprint"));
    const declared = readFileSync(join(SOURCE, "SKILL.md"), "utf8").match(/^\s+version:\s*"?([^"\n]+)"?\s*$/m)?.[1];
    expect(printed).toContain(`the DarkPrint skill ${declared}`);
    expect(io.stderr.join("")).toBe("");
  });

  /**
   * A flag typed before the action. Without `--codex` in the switch set the parser reads
   * `install` as its value, the action goes missing and the verb refuses a command that was
   * spelled correctly. A flag followed by another flag never swallows it, so that order
   * would prove nothing.
   */
  it("takes --codex as a switch, so it does not swallow the action typed after it", async () => {
    const io = collectingIo();
    const dir = join(scratch, "codex-switch");
    expect(await runCli(["skill", "--codex", "install", "--dir", dir], io)).toBe(0);
    expect(io.stdout.join("")).toContain(join(dir, "skills", "darkprint"));
    expect(io.stderr.join("")).toBe("");
  });

  it("refuses a bare `skill` and an action it does not have, without touching the disk", async () => {
    const io = collectingIo();
    expect(await runCli(["skill"], io)).toBe(1);
    expect(io.stderr.join("")).toContain("skill: say what to do.");
    expect(io.stderr.join("")).not.toContain("unknown command");

    const other = collectingIo();
    expect(await runCli(["skill", "remove"], other)).toBe(1);
    expect(other.stderr.join("")).toContain("`remove` is not an action");
  });
});
