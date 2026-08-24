/* ============================================================
   T220 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under `tests`
   and nothing else, so this module is imported by the suites beside
   it and is never collected as one itself.

   ── why every load is a dynamic import ──
   These tests were written in a worktree branched before
   `lib/server/mcp` existed — `ls lib/server/mcp` answered "No such
   file or directory" at the moment this file was created. A static
   top-level import of a module that is not on disk fails the whole
   FILE at collection, which reports one red where the protocol asks
   for one per acceptance criterion and hides six criteria behind
   the first missing module. Loading inside the cell that needs it
   turns "the module is not there yet" into exactly the per-criterion
   red the hand-off is supposed to produce. The specifier stays a
   literal so the `@` alias resolves.

   ── and why the module is bound LAST inside every cell ──
   An early bind masks every fixture write below it while being
   correct about its own subject. Three cells in an earlier round of
   this project were found never to have executed, and the tell is a
   red in 0ms where a database round trip was expected. So the order
   in every cell here is: build the world, plant the premise, ASSERT
   the premise, and only then `loadMcp()`.

   ── no candidate lists ──
   Every name is bound exactly and its absence quotes the clause that
   publishes it. T000 paid two rounds for the alternative: a candidate
   list resolved `encodeSession` instead of the cookie writer and
   produced five false reports of a broken round trip. Where the
   contract has a name, guessing is worse than binding.

   ── what this file deliberately does NOT bind ──
   No error class. The published block names none, and three of the
   four verbs return total types (`Promise<string>`,
   `Promise<Provenance>`) that must refuse somehow. That is charged
   to the orchestrator, not guessed here: a blind suite that invents
   `McpError` and reds on its absence is reporting a defect against
   an implementer who followed the contract.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const MCP = "@/lib/server/mcp";

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of `backend.md` §T220, quoted verbatim so a red says
 * where the name comes from and not merely that a test wanted it.
 *
 * Re-verified against the tree before binding, which D-220-01 (2) requires because the
 * block is stamped `d260c33` and T200's block at the same stamp named two wrong types.
 * What checks out: `Db` (`lib/db/client.ts:11`), `Actor` (`lib/server/policy/types.ts:10`),
 * `CardRef` (`= string`, `lib/core/card/schema.ts:161`), `ExportedFile` (`{path, text}`,
 * `lib/content/bundle-export.ts:157`). What does not is charged in the T220 log rather
 * than corrected here.
 */
export const PUBLISHED = {
  mcpSearch:
    "mcpSearch(db: Db, actor: Actor, task: string): " +
    "Promise<{ hits: readonly McpSearchHit[]; ordered: boolean }>",
  mcpReadCard: "mcpReadCard(db: Db, actor: Actor, ref: CardRef): Promise<string>",
  mcpProvenance:
    "mcpProvenance(db: Db, actor: Actor, ownerHandle: string, slug: string): Promise<Provenance>",
  mcpFetchRelease:
    "mcpFetchRelease(db: Db, actor: Actor, ownerHandle: string, slug: string, digest: string): " +
    "Promise<readonly ExportedFile[]>",
} as const;

export type PublishedName = keyof typeof PUBLISHED;

/** Four, in the order the block publishes them. */
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * The arity each verb publishes, so a cell can state it without counting parameters in prose.
 *
 * `Function.length` stops at the first parameter with a default, and TypeScript's `?` erases
 * to nothing — so an optional parameter spelled `?` still counts and one spelled
 * `= undefined` does not. Both spellings have shipped in this repository and the `?` was
 * charged, so the number below is what the block's parameter list says and the cell that
 * reads it says which spelling would move it.
 */
export const PUBLISHED_ARITY: Record<PublishedName, number> = {
  mcpSearch: 3,
  mcpReadCard: 3,
  mcpProvenance: 4,
  mcpFetchRelease: 5,
};

/**
 * The four operations `/mcp` advertises (`app/mcp/page.tsx:85-110`), which D-220-01 (3)
 * makes the advertised contract and rules MAY NOT BE RENAMED.
 *
 * Held as the page's own words rather than as a mapping this file invents, because the
 * mapping from a page's prose to a function name is exactly the guess a blind suite is not
 * entitled to make. What the cells hold the module to is that FOUR operations exist and
 * that they are the four the block names — the page is the oracle for the count and for
 * what each one takes and returns, not for the spelling of an identifier.
 */
export const ADVERTISED = [
  "search",
  "read a card",
  "inspect provenance",
  "fetch a release",
] as const;

let mcpModule: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole file, and every cell that awaits it gets its own copy of the same red rather than
 * one cell's failure cascading into an unhandled rejection in the next.
 */
export function loadMcp(): Promise<Namespace> {
  mcpModule ??= import("@/lib/server/mcp").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${MCP} does not load.\n` +
          `  backend.md §T220 owns \`lib/server/mcp/**\` and \`packages/mcp/**\` and publishes ` +
          `four functions: ${PUBLISHED_NAMES.join(", ")}.\n` +
          `  This is a failed acceptance criterion — the MCP surface is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return mcpModule;
}

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: PublishedName): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `\`${name}\` is not exported from ${MCP}.\n` +
      `  backend.md §T220 publishes it as:\n    ${PUBLISHED[name]}\n` +
      `  ${MCP} exports: ${exported}.`,
  );
}

/**
 * One published verb, checked for KIND as well as presence.
 *
 * A binding is only usable once the thing it bound to has been shown to be the right kind
 * of thing. A name that resolves to a non-function is a broken binding rather than a failed
 * criterion, and it is raised here rather than left to fail confusingly at the call site.
 */
export async function verb(name: PublishedName): Promise<UnknownFn> {
  const bound = requireFrom(await loadMcp(), name);
  if (typeof bound !== "function") {
    throw new Error(
      `\`${name}\` is exported from ${MCP} but is ${describe_(bound)}, not a function.\n` +
        `  backend.md §T220 publishes it as:\n    ${PUBLISHED[name]}`,
    );
  }
  return bound as UnknownFn;
}

/* --------------------- AC1's denylist --------------------- */

/**
 * Every writing function reachable from a barrel `lib/server/mcp` could plausibly compose,
 * enumerated by hand from those barrels' own export lists rather than recalled.
 *
 * AC1's discriminating test is not "a write was refused" but that the module's imports
 * contain no writing function — the block says so in as many words, in the shape T060's
 * purity check established. A denylist is the wrong instrument for a claim about ALL
 * writes, so `purity.test.ts` checks the import SPECIFIERS against an allowlist as well;
 * this list exists because the two most dangerous names on it are the two an implementer
 * would reach for first, and a red naming them is worth more than a red naming a module.
 *
 * ── the two that are the whole point ──
 * `serveCard` (`lib/server/export/serve-card.ts:58`) and `serveFile`
 * (`lib/server/export/serve-file.ts:109`) BOTH call `recordDownload`, which writes a
 * counter row. They are the obvious composition for "read a card" and "fetch a release"
 * and they break AC1 while looking exactly right. `exportRelease` is the AC1-safe verb and
 * its own header says why: *"No download event: the contract counts one event per *served*
 * file, this verb returns `ExportedFile[]` where the serving verbs return `ServedFile`"*.
 *
 * `enforceLimit` and `checkLimit` are deliberately NOT on this list. They mutate a
 * process-local `Int32Array` (`lib/server/limits/counter.ts:238-239`) and touch no
 * database, so whether AC1's "writes" reaches them is a question about the criterion rather
 * than about the module — charged to the orchestrator, not decided here.
 */
export const WRITERS: readonly string[] = [
  /* @/lib/server/export — the two that read as readers */
  "recordDownload",
  "serveCard",
  "serveFile",
  /* @/lib/server/publish, @/lib/server/seed */
  "publish",
  "persistArtefacts",
  "runImport",
  /* @/lib/server/archive */
  "createBundle",
  "addRelease",
  /* @/lib/server/cards */
  "addCard",
  /* @/lib/server/lineage */
  "forkBundle",
  /* @/lib/server/search */
  "reembedRelease",
  /* @/lib/server/accounts */
  "upsertFromGitHub",
  "changeHandle",
  "setEmail",
  "setDefaultVisibility",
  "updateProfile",
  /* @/lib/server/limits */
  "issueKey",
  "revokeKey",
  /* @/lib/server/ontology */
  "addOntologyVersion",
];

/**
 * The barrels a read-only composition may name, from D-220-03 plus the block's own
 * "composes T080, T090 and T200 through their barrels and owns no storage".
 *
 * Deep paths are absent by construction and that is the second half of the check: T000's
 * contract D-01 makes a deep path into another module internal, so `@/lib/server/export/serve-card`
 * is a violation whatever it imports.
 */
export const COMPOSABLE = [
  "@/lib/core",
  "@/lib/db",
  "@/lib/content/bundle-export",
  "@/lib/server/types",
  "@/lib/server/policy",
  "@/lib/server/accounts",
  "@/lib/server/archive",
  "@/lib/server/cards",
  "@/lib/server/export",
  "@/lib/server/lineage",
  "@/lib/server/registry",
  "@/lib/server/search",
  "@/lib/server/limits",
] as const;
