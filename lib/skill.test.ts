/* ============================================================
   The install lines are commands a reader pastes, and the things
   that make one fail are all invisible in a rendered page: a package
   name npm does not know, a verb the CLI does not dispatch, a folder
   the agent does not read, and a character React escaped on the way
   into the markup.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CLI_VERBS, NPX_INVOCATION } from "@/packages/cli/src/index";

import {
  CLAUDE_CODE_SKILLS_PARENT,
  CODEX_SKILLS_PARENT,
  LIVE_OPEN_PATH,
  LIVE_OPEN_URL,
  LIVE_PAGE_PATH,
  SKILL_ARCHIVE_ROOT,
  SKILL_INSTALL_COMMAND,
  SKILL_INSTALL_COMMAND_CODEX,
  SKILL_MANIFEST_PATH,
  SKILL_PACKAGE,
  SKILL_PUBLIC_DIR,
  SKILL_SITE_ORIGIN,
  SKILL_TREE_PATH,
} from "./skill";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const COMMANDS = [
  ["Claude Code", SKILL_INSTALL_COMMAND],
  ["Codex", SKILL_INSTALL_COMMAND_CODEX],
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

  /**
   * The site spells the npm form of the CLI a second time because this module may not
   * import the CLI barrel, so the two spellings are held equal here. A package renamed in
   * `packages/mcp/package.json` has to move `NPX_INVOCATION`, and this cell then moves it
   * here too.
   */
  it("run the published package with the CLI's own npm invocation", () => {
    expect(NPX_INVOCATION).toBe(`npx -y ${SKILL_PACKAGE}`);
    expect(SKILL_INSTALL_COMMAND).toBe(`${NPX_INVOCATION} skill install`);
    expect(SKILL_INSTALL_COMMAND_CODEX).toBe(`${SKILL_INSTALL_COMMAND} --codex`);
  });

  /**
   * The verb the line names is one `runCli` dispatches, with `--codex` in its grammar. A
   * line that named a verb nothing implements would print `unknown command` in somebody
   * else's shell and nothing here would notice.
   */
  it("name a verb the CLI's own table carries, with the Codex switch in its grammar", () => {
    const verb = CLI_VERBS.find((entry) => entry.name === "skill");
    expect(verb, "CLI_VERBS has no `skill` row").toBeDefined();
    expect(verb?.dispatchedBy).toBe("packages/cli/src/run.ts");
    expect(verb?.args.startsWith("skill install")).toBe(true);
    expect(verb?.args).toContain("--codex");
  });

  /**
   * The copy lands at `<parent>/skills/darkprint`, and the parents are the two folders the
   * agents read user skills from. `packages/cli/src/skill.ts` builds its destinations from
   * these three strings, so a folder renamed here moves the verb with it.
   */
  it("name the parent of each agent's skills directory and the suffix under it", () => {
    expect(SKILL_ARCHIVE_ROOT).toBe("skills/darkprint");
    expect(CLAUDE_CODE_SKILLS_PARENT).toBe("~/.claude");
    expect(CODEX_SKILLS_PARENT).toBe("~/.agents");
  });
});

describe("the paths the site serves the skill from", () => {
  it("all hang off one public directory on the www host", () => {
    expect(SKILL_SITE_ORIGIN).toBe("https://www.darkprint.io");
    for (const path of [SKILL_TREE_PATH, SKILL_MANIFEST_PATH]) {
      expect(path.startsWith(`/${SKILL_PUBLIC_DIR}/`)).toBe(true);
    }
  });

  it("name a tree that exists in the repository, with a SKILL.md at its root", () => {
    expect(existsSync(join(ROOT, SKILL_ARCHIVE_ROOT, "SKILL.md"))).toBe(true);
  });
});

describe("the live page the DarkPrint skill posts a draft to", () => {
  it("hangs off the www origin and carries none of the characters React escapes", () => {
    expect(LIVE_OPEN_URL).toBe(`${SKILL_SITE_ORIGIN}/api/tutorial/live`);
    expect(LIVE_OPEN_URL).toBe(`${SKILL_SITE_ORIGIN}${LIVE_OPEN_PATH}`);
    expect(LIVE_OPEN_URL).not.toMatch(/[&<>"'\s]/);
    expect(LIVE_PAGE_PATH).toBe("/tutorial/live");
  });

  /**
   * The skill is a document an agent reads, so the URL it posts to is typed into prose
   * that no surface renders from the constant. Held to it here instead: a route renamed
   * changes one string, and both documents red until they follow it.
   */
  it.each(["SKILL.md", "references/live-preview.md"])("%s prints the same three URLs", (file) => {
    const doc = readFileSync(join(ROOT, SKILL_ARCHIVE_ROOT, file), "utf8");
    expect(doc).toContain(`POST ${LIVE_OPEN_URL}`);
    expect(doc).toContain(`PUT "${LIVE_OPEN_URL}/$DARKPRINT_LIVE_TOKEN"`);
    expect(doc).toContain(`${SKILL_SITE_ORIGIN}${LIVE_PAGE_PATH}/<token>`);
  });
});
