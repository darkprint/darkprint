/* ============================================================
   darkprint CLI — `skill install`
   The package carries a copy of `skills/darkprint` beside `dist/`,
   and this verb copies it into the folder the reader's agent loads
   user skills from. It reads nothing over the network: `npx` has
   already fetched the package by the time this runs, so the install
   is a copy from one folder on the machine to another, and the
   destination is the one fact a reader has to be told.

   The packaged tree is found relative to the running module and
   never relative to the cwd: `npx` runs the bin from its own cache,
   and a reader's cwd is wherever they happened to be.
   ============================================================ */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parse as parseYaml } from "yaml";

import {
  CLAUDE_CODE_SKILLS_PARENT,
  CODEX_SKILLS_PARENT,
  SKILL_ARCHIVE_ROOT,
} from "../../../lib/skill";
import { CliError } from "./errors";

export interface InstallSkillOptions {
  /** Codex reads user skills from `~/.agents/skills`; the default is Claude Code's `~/.claude/skills`. */
  codex?: boolean;
  /** A parent of the caller's choosing instead of either agent's; the copy lands at `<dir>/skills/darkprint`. */
  dir?: string;
  /** Where the packaged tree is looked for, in place of this module's own directory. A seam for a suite. */
  from?: string;
  /** What `~` means, in place of the process's home directory. A seam for a suite. */
  home?: string;
}

export interface InstallSkillResult {
  /** Absolute, where the copy landed. */
  destination: string;
  /** Absolute, where it was copied from. */
  source: string;
  /** `metadata.version` from `SKILL.md`'s frontmatter, or `undefined` when it carries none. */
  version: string | undefined;
  /** Every file copied, destination-relative with forward slashes, in a stable order. */
  files: readonly string[];
}

/** The folder name under `skills/`, which is also the skill's `name`. */
const SKILL_NAME = SKILL_ARCHIVE_ROOT.split("/").pop() ?? SKILL_ARCHIVE_ROOT;

/**
 * Copy the packaged skill into an agent's skills folder, replacing any earlier copy.
 *
 * The whole destination directory is removed first rather than overwritten file by file:
 * a reference deleted from the skill would otherwise survive on every machine that had
 * installed the version before it, and an agent would keep reading it.
 */
export function installSkill(options: InstallSkillOptions | undefined = undefined): InstallSkillResult {
  const source = locatePackagedSkill(options?.from ?? __dirname);
  const destination = destinationFor(options);

  /* Refused before anything is removed: `--dir` pointed at this repository's root names the
     source tree itself as the destination, and the copy would begin by deleting it. */
  if (destination === source || source.startsWith(destination + sep)) {
    throw new CliError("skill: the destination is the packaged copy itself. Give another --dir.");
  }

  const files = listFiles(source);
  const version = frontmatterVersion(readFileSync(join(source, "SKILL.md"), "utf8"));

  rmSync(destination, { recursive: true, force: true });
  for (const file of files) {
    const target = join(destination, ...file.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(source, ...file.split("/")), target);
  }

  return { destination, source, version, files };
}

/**
 * Where the copy goes.
 *
 * The two agent parents are `~/.claude` and `~/.agents`, as `lib/skill.ts` spells them for
 * the site, with `~` read as the home directory: Node expands no tilde, so a path built
 * from the string as written would create a folder literally called `~`.
 */
function destinationFor(options: InstallSkillOptions | undefined): string {
  const suffix = SKILL_ARCHIVE_ROOT.split("/");
  if (options?.dir !== undefined) return resolve(options.dir, ...suffix);
  const parent = options?.codex === true ? CODEX_SKILLS_PARENT : CLAUDE_CODE_SKILLS_PARENT;
  const home = options?.home ?? homedir();
  return resolve(home, parent.replace(/^~\//, ""), ...suffix);
}

/**
 * The packaged tree, relative to the running module.
 *
 * Two layouts are looked at, in this order. The distributable has `dist/cli.js` with
 * `skill/darkprint` beside `dist/`, whether it runs from an npm cache or from a checkout's
 * `packages/mcp`. A suite runs this module from `packages/cli/src`, three levels above the
 * repository's own `skills/darkprint`, which is the same tree before it is packaged.
 */
export function locatePackagedSkill(from: string): string {
  const candidates = [
    resolve(from, "..", "skill", SKILL_NAME),
    resolve(from, "..", "..", "..", ...SKILL_ARCHIVE_ROOT.split("/")),
  ];
  const found = candidates.find((dir) => existsSync(join(dir, "SKILL.md")));
  if (found === undefined) {
    throw new CliError(
      "skill: this build carries no copy of the DarkPrint skill. Reinstall the darkprint package.",
    );
  }
  return found;
}

/**
 * Every regular file under `dir`, relative and sorted, walked before anything is removed
 * so a tree this verb cannot copy is refused with nothing changed.
 */
function listFiles(dir: string): string[] {
  const files: string[] = [];
  const walk = (here: string): void => {
    for (const entry of readdirSync(here, { withFileTypes: true })) {
      const full = join(here, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(relative(dir, full).split(sep).join("/"));
      else throw new CliError(`skill: \`${relative(dir, full)}\` in the packaged copy is not a regular file.`);
    }
  };
  walk(dir);
  return files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * `metadata.version` from the YAML between the two `---` lines, the field the skills
 * specification names for it; a top-level `version` is read as a fallback.
 */
export function frontmatterVersion(skillMd: string): string | undefined {
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (match === null) return undefined;
  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const front = parsed as { metadata?: unknown; version?: unknown };
  const metadata = front.metadata;
  const nested =
    typeof metadata === "object" && metadata !== null ? (metadata as { version?: unknown }).version : undefined;
  const value = nested ?? front.version;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}
