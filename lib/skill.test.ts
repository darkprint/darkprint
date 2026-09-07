/* ============================================================
   The install lines are commands a reader pastes, and the three
   things that make one fail are all invisible in a rendered page:
   a host that does not answer, a folder the agent does not read,
   and a character React escaped on the way into the markup.
   ============================================================ */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_SKILLS_PARENT,
  CODEX_SKILLS_PARENT,
  SKILL_ARCHIVE_PATH,
  SKILL_ARCHIVE_ROOT,
  SKILL_ARCHIVE_URL,
  SKILL_INSTALL_COMMAND,
  SKILL_INSTALL_COMMAND_CODEX,
  SKILL_INSTALL_FROM_REPOSITORY,
  SKILL_MANIFEST_PATH,
  SKILL_PUBLIC_DIR,
  SKILL_SITE_ORIGIN,
  SKILL_TREE_PATH,
} from "./skill";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const COMMANDS = [
  ["Claude Code", SKILL_INSTALL_COMMAND],
  ["Codex", SKILL_INSTALL_COMMAND_CODEX],
  ["the repository form", SKILL_INSTALL_FROM_REPOSITORY],
] as const;

describe("the install commands", () => {
  it.each(COMMANDS)("%s carries no prompt and none of the characters React escapes", (_name, command) => {
    expect(command).not.toMatch(/^\$/);
    // `&`, `<`, `>`, `"` and `'` become entities in markup. A page test comparing raw HTML
    // against the constant would then fail on a page that prints it correctly, and a reader
    // copying from a surface that forgot to unescape would paste `&amp;&amp;`.
    expect(command).not.toMatch(/[&<>"']/);
    expect(command).toBe(command.trim());
    expect(command).not.toContain("\n");
  });

  it("fetch the archive from the www host over https", () => {
    expect(SKILL_SITE_ORIGIN).toBe("https://www.darkprint.io");
    expect(SKILL_ARCHIVE_URL).toBe(`${SKILL_SITE_ORIGIN}${SKILL_ARCHIVE_PATH}`);
    expect(SKILL_INSTALL_COMMAND).toContain(SKILL_ARCHIVE_URL);
    expect(SKILL_INSTALL_COMMAND_CODEX).toContain(SKILL_ARCHIVE_URL);
  });

  /**
   * The archive is rooted at `skills/darkprint`, so the folder `tar -C` names is the PARENT
   * of the agent's skills directory, never the skills directory itself. Pointing the Claude
   * Code line at `~/.claude/skills` would land the skill at `~/.claude/skills/skills/darkprint`,
   * where nothing reads it, and nothing would error.
   */
  it("point tar at the parent of each agent's skills directory", () => {
    expect(SKILL_ARCHIVE_ROOT).toBe("skills/darkprint");
    expect(CLAUDE_CODE_SKILLS_PARENT).toBe("~/.claude");
    expect(CODEX_SKILLS_PARENT).toBe("~/.agents");
    expect(SKILL_INSTALL_COMMAND.endsWith(`tar -xzf - -C ${CLAUDE_CODE_SKILLS_PARENT}`)).toBe(true);
    expect(SKILL_INSTALL_COMMAND_CODEX.endsWith(`tar -xzf - -C ${CODEX_SKILLS_PARENT}`)).toBe(true);
    // Codex's documentation names `~/.agents/skills` and nothing guarantees the folder exists.
    expect(SKILL_INSTALL_COMMAND_CODEX.startsWith(`mkdir -p ${CODEX_SKILLS_PARENT};`)).toBe(true);
  });

  it("read the archive with a stated source, so GNU tar and bsdtar agree", () => {
    expect(SKILL_INSTALL_COMMAND).toContain("tar -xzf -");
    expect(SKILL_INSTALL_COMMAND_CODEX).toContain("tar -xzf -");
  });
});

describe("the paths the site serves the skill from", () => {
  it("all hang off one public directory", () => {
    for (const path of [SKILL_TREE_PATH, SKILL_ARCHIVE_PATH, SKILL_MANIFEST_PATH]) {
      expect(path.startsWith(`/${SKILL_PUBLIC_DIR}/`)).toBe(true);
    }
  });

  it("name a tree that exists in the repository, with a SKILL.md at its root", () => {
    expect(existsSync(join(ROOT, SKILL_ARCHIVE_ROOT, "SKILL.md"))).toBe(true);
  });
});
