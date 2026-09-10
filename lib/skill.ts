/* ============================================================
   The blueprint-writing skill, as the strings the site prints about it.

   The skill is the `skills/darkprint` tree in this repository. It reaches a reader two
   ways. The `darkprint` package on npm carries a copy of the tree, and `npx -y darkprint
   skill install` (`packages/cli/src/skill.ts`) copies it into the folder the reader's agent
   loads user skills from: `~/.claude/skills/darkprint` for Claude Code, `~/.agents/skills/
   darkprint` for Codex. That is the install line the site prints. `prebuild`
   (`scripts/generate-bundles.ts`) also copies the tree to `public/skill/darkprint/**` and
   packs it as `public/skill/darkprint.tgz` with a manifest of per-file hashes, so a reader
   can read every file before running anything and check what the package installed.

   Every command is defined once here because four surfaces print it (the landing band, a
   draft bundle's quick-setup panel, `/capabilities`, and `/skill`), and a command a reader
   retypes fails silently when copies drift: the error lands in somebody else's shell, never
   in a test here. The npm form of the CLI is `NPX_INVOCATION` in `packages/cli/src/run.ts`;
   it is spelled again here rather than imported because that barrel reaches `node:fs` and
   the engine, and this module is read by pages. `lib/skill.test.ts` holds the two equal.

   ── Constraints on the command strings ──
   No `$` prompt: the prompt belongs to the surface, and a `$` that reaches the clipboard
   is a command that fails. No `&`, `<`, `>` or quotes either: React escapes those five
   characters into markup, and a guard that compares a rendered page against the raw
   constant would then read a correct page as wrong. `lib/skill.test.ts` holds both.

   ── The word `skill` is already taken on this site ──
   `lib/core/card/schema.ts` defines `skill?: string` as a per-node behaviour document, one
   level below the graph. This one writes the graph. Never print "the skill" unqualified on
   any surface: "the DarkPrint skill" or "the blueprint-writing skill".
   ============================================================ */

/**
 * The host the tree is served from, spelled with `www` because that is the host
 * production serves. Written here rather than imported: no site-wide origin constant
 * exists in this tree yet, and the links have to print the host that answers.
 */
export const SKILL_SITE_ORIGIN = "https://www.darkprint.io";

/**
 * The directory the skill lives in, relative to the repository root, and the root of every
 * entry in the served archive. It is also the suffix under which the CLI lands the copy:
 * `<parent>/skills/darkprint`, which is where both agents look.
 */
export const SKILL_ARCHIVE_ROOT = "skills/darkprint";

/** Where `prebuild` writes the served copy, under `public/`. */
export const SKILL_PUBLIC_DIR = "skill";

/** The raw tree, one URL per file: `/skill/darkprint/SKILL.md` and so on. */
export const SKILL_TREE_PATH = `/${SKILL_PUBLIC_DIR}/darkprint`;

/** Every file in the tree with its SHA-256, and the archive's own, for a reader who checks. */
export const SKILL_MANIFEST_PATH = `/${SKILL_PUBLIC_DIR}/manifest.json`;

export const SKILL_TREE_URL = `${SKILL_SITE_ORIGIN}${SKILL_TREE_PATH}`;
export const SKILL_MANIFEST_URL = `${SKILL_SITE_ORIGIN}${SKILL_MANIFEST_PATH}`;

/** The folder whose `skills/` subdirectory each agent reads user skills from. */
export const CLAUDE_CODE_SKILLS_PARENT = "~/.claude";
export const CODEX_SKILLS_PARENT = "~/.agents";

/** The npm package that carries the CLI, the stdio MCP server and the DarkPrint skill. */
export const SKILL_PACKAGE = "darkprint";

/**
 * The command a Claude Code user types, exactly as it must be typed.
 *
 * `npx -y` fetches the package from npm on the first run and answers no prompt; the verb
 * copies the packaged skill into `~/.claude/skills/darkprint`. `~/.claude` exists for anyone
 * who has run Claude Code once and the verb creates the rest. Nothing else is installed and
 * no account is created.
 */
export const SKILL_INSTALL_COMMAND = `npx -y ${SKILL_PACKAGE} skill install`;

/**
 * The same verb for Codex, which reads user skills from `~/.agents/skills` (its own
 * documentation names that directory and no other). The verb creates the folder.
 */
export const SKILL_INSTALL_COMMAND_CODEX = `${SKILL_INSTALL_COMMAND} --codex`;

/**
 * Where the commands are explained. One page for the skill and one for MCP, on the owner's
 * instruction, so a landing chip that promises one half never opens a page that is half the
 * other.
 */
export const SKILL_ROUTE = "/skill";

/**
 * Where the blueprint-writing skill opens a live page for the tutorial: a `POST` with an
 * empty object answers a token and the page's URL, and the draft is then `PUT` to the same
 * path with the token appended. The skill is a document and prints this URL as prose, so
 * `lib/skill.test.ts` holds `SKILL.md` and `references/live-preview.md` to this spelling.
 */
export const LIVE_OPEN_PATH = "/api/tutorial/live";
export const LIVE_OPEN_URL = `${SKILL_SITE_ORIGIN}${LIVE_OPEN_PATH}`;

/** The page a token opens, as `/tutorial/live/<token>`. */
export const LIVE_PAGE_PATH = "/tutorial/live";
