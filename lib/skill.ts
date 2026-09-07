/* ============================================================
   The blueprint-writing skill, as the strings the site prints about it.

   The skill is the `skills/darkprint` tree in this repository. `prebuild`
   (`scripts/generate-bundles.ts`) copies it to `public/skill/darkprint/**` and packs it as
   `public/skill/darkprint.tgz`, so the site serves it and a reader installs it with one
   `curl | tar` line. The archive is rooted at `skills/darkprint/`, which is the suffix both
   Claude Code (`~/.claude/skills/<name>`) and Codex (`~/.agents/skills/<name>`) load user
   skills from, so one archive serves both and the install line only differs in the folder
   `tar -C` is pointed at.

   Every command is defined once here because four surfaces print it (the landing band, a
   draft bundle's quick-setup panel, `/capabilities`, and `/skill`), and a command a reader
   retypes fails silently when copies drift: the error lands in somebody else's shell, never
   in a test here.

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
 * The host the archive is fetched from, spelled with `www` because that is the host
 * production serves. Written here rather than imported: no site-wide origin constant
 * exists in this tree yet, and the command has to print the host that answers.
 */
export const SKILL_SITE_ORIGIN = "https://www.darkprint.io";

/**
 * The directory the skill lives in, relative to the repository root, and the root of every
 * entry in the archive. The two are the same string on purpose: `tar -C <parent>` then
 * lands the skill at `<parent>/skills/darkprint`, which is where both agents look.
 */
export const SKILL_ARCHIVE_ROOT = "skills/darkprint";

/** Where `prebuild` writes the served copy, under `public/`. */
export const SKILL_PUBLIC_DIR = "skill";

/** The raw tree, one URL per file: `/skill/darkprint/SKILL.md` and so on. */
export const SKILL_TREE_PATH = `/${SKILL_PUBLIC_DIR}/darkprint`;

/** The archive the install line fetches. */
export const SKILL_ARCHIVE_PATH = `/${SKILL_PUBLIC_DIR}/darkprint.tgz`;

/** Every file in the archive with its SHA-256, and the archive's own, for a reader who checks. */
export const SKILL_MANIFEST_PATH = `/${SKILL_PUBLIC_DIR}/manifest.json`;

export const SKILL_ARCHIVE_URL = `${SKILL_SITE_ORIGIN}${SKILL_ARCHIVE_PATH}`;
export const SKILL_TREE_URL = `${SKILL_SITE_ORIGIN}${SKILL_TREE_PATH}`;
export const SKILL_MANIFEST_URL = `${SKILL_SITE_ORIGIN}${SKILL_MANIFEST_PATH}`;

/** The folder whose `skills/` subdirectory each agent reads user skills from. */
export const CLAUDE_CODE_SKILLS_PARENT = "~/.claude";
export const CODEX_SKILLS_PARENT = "~/.agents";

/**
 * The command a Claude Code user types, exactly as it must be typed.
 *
 * `-f -` is spelled out because GNU tar and bsdtar disagree about where an archive comes
 * from when nothing says. `~/.claude` exists for anyone who has run Claude Code once, which
 * is the reader this line is for.
 */
export const SKILL_INSTALL_COMMAND = `curl -fsSL ${SKILL_ARCHIVE_URL} | tar -xzf - -C ${CLAUDE_CODE_SKILLS_PARENT}`;

/**
 * The same archive for Codex, which reads user skills from `~/.agents/skills` (its own
 * documentation names that directory and no other). `mkdir -p` first, because `tar -C`
 * does not create its target and nothing guarantees a Codex install has made the folder.
 */
export const SKILL_INSTALL_COMMAND_CODEX = `mkdir -p ${CODEX_SKILLS_PARENT}; curl -fsSL ${SKILL_ARCHIVE_URL} | tar -xzf - -C ${CODEX_SKILLS_PARENT}`;

/**
 * The form the `skills` CLI takes. It clones the repository over git, and the repository is
 * private, so this line works for a reader with access to it and answers 404 for everyone
 * else. Printed only under a label that says so.
 */
export const SKILL_INSTALL_FROM_REPOSITORY = "npx skills@latest add Brotherhood94/darkprint";

/**
 * Where the commands are explained. One page for the skill and one for MCP, on the owner's
 * instruction, so a landing chip that promises one half never opens a page that is half the
 * other.
 */
export const SKILL_ROUTE = "/skill";
