/* ============================================================
   The MCP surface's contract, as the suites beside this file bind it

   Not a test file: the vitest glob reaches `.test.ts` under `tests`
   and nothing else. The module is loaded with a dynamic import
   inside each cell rather than statically, so an absent or broken
   module reds one cell per criterion instead of failing the whole
   file at collection, and it is bound LAST in every cell so a
   fixture write below the bind is never masked by it.

   Every name is bound exactly. A candidate list resolves the wrong
   export and reports a broken round trip that never happened.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const MCP = "@/lib/server/mcp";

/* --------------------- what the barrel publishes --------------------- */

/** The six verbs, as their signatures read, so a red says what was expected and not only what was missing. */
export const PUBLISHED = {
  mcpFindBlueprints:
    "mcpFindBlueprints(db: Db, actor: Actor, task: string, options?: { limit?: number; includeForks?: boolean }): " +
    "Promise<McpFindResult<McpBlueprintHit>>",
  mcpFindCards:
    "mcpFindCards(db: Db, actor: Actor, task: string, options?: { limit?: number }): " +
    "Promise<McpFindResult<McpCardHit>>",
  mcpGetBlueprint:
    "mcpGetBlueprint(db: Db, actor: Actor, ownerHandle: string, slug: string, options?: { digest?: string; harness?: McpHarness }): " +
    "Promise<McpBlueprint>",
  mcpReadCard: "mcpReadCard(db: Db, actor: Actor, ref: CardRef): Promise<string>",
  mcpProvenance:
    "mcpProvenance(db: Db, actor: Actor, ownerHandle: string, slug: string): Promise<Provenance>",
  mcpFetchRelease:
    "mcpFetchRelease(db: Db, actor: Actor, ownerHandle: string, slug: string, digest: string): " +
    "Promise<readonly ExportedFile[]>",
} as const;

export type PublishedName = keyof typeof PUBLISHED;

/**
 * The two classes the surface refuses with. `McpRefusedError` answers absent, unparseable
 * and not-visible with one sentence, so a caller cannot learn whether a private address
 * exists; `McpStoreError` is the store's own fault, sealed.
 */
export const PUBLISHED_CLASSES = ["McpRefusedError", "McpStoreError"] as const;

/** Six, in the order the barrel publishes them. */
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * The arity each verb publishes. An optional trailing `options` is spelled with a default
 * (`= {}`), which `Function.length` does not count, where a `?` would count: a verb whose
 * arity is one high has an optional parameter spelled the way that moves this number.
 */
export const PUBLISHED_ARITY: Record<PublishedName, number> = {
  mcpFindBlueprints: 3,
  mcpFindCards: 3,
  mcpGetBlueprint: 4,
  mcpReadCard: 3,
  mcpProvenance: 4,
  mcpFetchRelease: 5,
};

/**
 * The seven tools `/mcp` advertises, in the page's order. The page is the oracle for the
 * count and the names; the cells hold the barrel to one verb per tool that is not a
 * composition, and the names are read off the page rather than off this transcription.
 */
export const ADVERTISED = [
  "find_blueprints",
  "find_cards",
  "get_blueprint",
  "read_card",
  "inspect_provenance",
  "fetch_release",
  "export_pipeline",
] as const;

/**
 * The advertised tools that are NOT server verbs, and what each one composes.
 *
 * `export_pipeline` is `mcpFetchRelease` followed by a pure local compile, reaching no route
 * `fetch_release` does not already reach. Naming the exceptions keeps the surface cell an
 * equality: a tool with neither a verb nor an entry here still reds, and an entry naming a
 * constituent the barrel does not publish reds too.
 */
export const COMPOSED: Readonly<Record<string, readonly PublishedName[]>> = Object.freeze({
  export_pipeline: ["mcpFetchRelease"],
});

/**
 * The tool names read OFF `app/mcp/page.tsx`, not off the constant above.
 *
 * Comparing the transcription to `PUBLISHED_NAMES.length` is two numbers written in this
 * file, a cell that passes against an absent module. Comments are stripped first because
 * the page's own prose discusses the tools by name.
 */
export function advertisedOperations(pageSource: string): string[] {
  const code = strip(pageSource);
  const start = code.indexOf("const OPERATIONS");
  if (start === -1) {
    throw new Error(
      "`const OPERATIONS` is not in app/mcp/page.tsx. The tool table is the advertised " +
        "surface; if the array was renamed, this reader needs updating and the count below is " +
        "not a finding about the module.",
    );
  }
  const end = code.indexOf("] as const;", start);
  const block = code.slice(start, end === -1 ? undefined : end);
  /* The names come from the ORIGINAL text at the offsets the stripped block reports, because
     `strip` blanks string bodies. */
  const names: string[] = [];
  const re = /name:\s*"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const from = start + m.index + m[0].length;
    const to = pageSource.indexOf('"', from);
    if (to !== -1) names.push(pageSource.slice(from, to));
  }
  return names;
}

let mcpModule: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole file, and every cell that awaits it gets its own copy of the same red.
 */
export function loadMcp(): Promise<Namespace> {
  mcpModule ??= import("@/lib/server/mcp").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${MCP} does not load.\n` +
          `  The barrel publishes six functions: ${PUBLISHED_NAMES.join(", ")}.\n` +
          `  This is a failed criterion, the MCP surface is absent, and not a broken test.`,
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
      `  It is published as:\n    ${PUBLISHED[name]}\n` +
      `  ${MCP} exports: ${exported}.`,
  );
}

/** One published verb, checked for kind as well as presence. */
export async function verb(name: PublishedName): Promise<UnknownFn> {
  const bound = requireFrom(await loadMcp(), name);
  if (typeof bound !== "function") {
    throw new Error(
      `\`${name}\` is exported from ${MCP} but is ${describe_(bound)}, not a function.\n` +
        `  It is published as:\n    ${PUBLISHED[name]}`,
    );
  }
  return bound as UnknownFn;
}

/* --------------------- the purity denylist --------------------- */

/**
 * Every writing function reachable from a barrel `lib/server/mcp` could plausibly compose,
 * enumerated from those barrels' own export lists.
 *
 * `serveCard` and `serveFile` both call `recordDownload`, which writes a counter row. They
 * are the obvious composition for reading a card and fetching a release and they break the
 * read-only rule while looking exactly right; `exportRelease` is the read-only verb.
 * `enforceLimit` and `checkLimit` are deliberately NOT here: they mutate a process-local
 * counter and touch no database.
 */
export const WRITERS: readonly string[] = [
  /* @/lib/server/export */
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
  "reembedAll",
  /* @/lib/server/accounts */
  "upsertFromGitHub",
  "changeHandle",
  "setEmail",
  "setDefaultVisibility",
  "updateProfile",
  /* @/lib/server/limits */
  "issueKey",
  "revokeKey",
  "revokeKeysFor",
  /* @/lib/server/ontology */
  "addOntologyVersion",
];

/**
 * The barrels a read-only composition may name. Deep paths are absent by construction: a
 * deep path into another module is internal whatever it imports.
 */
export const COMPOSABLE = [
  "@/lib/core",
  "@/lib/db",
  "@/lib/content/bundle-export",
  "@/lib/server/types",
  "@/lib/server/policy",
  /* The transport boundary renders and never writes. */
  "@/lib/server/http",
  "@/lib/server/accounts",
  "@/lib/server/archive",
  "@/lib/server/cards",
  "@/lib/server/export",
  "@/lib/server/lineage",
  "@/lib/server/registry",
  "@/lib/server/search",
  "@/lib/server/limits",
] as const;

/* --------------------- outcomes, and why they are not `rejects` --------------------- */

/**
 * What a call did: answered, or refused.
 *
 * The privacy cells ask whether private bytes came BACK, which is true of a throw, an
 * `undefined` and an empty list alike and false of exactly one thing. A bare
 * `rejects.toThrow()` cannot see that difference: the suite's own absent-module rejection
 * satisfies it, so the cell passes against a module that does not exist.
 */
export type Outcome = { ok: true; value: unknown } | { ok: false; error: unknown };

export async function outcome(fn: () => Promise<unknown>): Promise<Outcome> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Every string reachable from a value, errors and their `cause` chains included.
 *
 * Written for a leak scan, so it reads own enumerable AND non-enumerable properties and
 * symbol-keyed ones: an error whose payload hangs off a symbol renders as `{}` to
 * `JSON.stringify` while the payload sits there. Cycles are closed on identity.
 */
export function stringsIn(value: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<unknown>();

  const walk = (v: unknown): void => {
    if (typeof v === "string") {
      found.push(v);
      return;
    }
    if (v === null || (typeof v !== "object" && typeof v !== "function")) return;
    if (seen.has(v)) return;
    seen.add(v);

    if (v instanceof Error) {
      found.push(v.name, v.message);
      if (typeof v.stack === "string") found.push(v.stack);
      /* Redundant with the general walk while `cause` is an own property, and kept as the
         guard for a runtime that installs it differently. */
      walk((v as { cause?: unknown }).cause);
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (v instanceof Uint8Array) {
      found.push(new TextDecoder().decode(v));
      return;
    }
    for (const key of Reflect.ownKeys(v as object)) {
      let held: unknown;
      try {
        held = (v as Record<PropertyKey, unknown>)[key];
      } catch {
        continue; // a throwing getter is not a leak this scan can read
      }
      if (typeof key === "string") found.push(key);
      walk(held);
    }
  };

  walk(value);
  return found;
}

/**
 * Whether `needle` appears anywhere in what a call produced. Substring rather than
 * equality: private bytes can arrive embedded in a larger document.
 */
export function reveals(result: Outcome, needle: string): boolean {
  const subject = result.ok ? result.value : result.error;
  return stringsIn(subject).some((s) => s.includes(needle));
}

/* --------------------- the source scan, and its instrument --------------------- */

/**
 * `text` with every comment blanked and every string body blanked, preserving offsets.
 *
 * String bodies go too: an import specifier is a string, so the scan reads specifiers from
 * the parsed statement, and a function name mentioned inside an error message must not red.
 */
export function strip(text: string): string {
  const out = text.split("");
  let i = 0;
  const n = text.length;
  const blank = (from: number, to: number, keepNewlines: boolean): void => {
    for (let k = from; k < to && k < n; k += 1) {
      if (keepNewlines && out[k] === "\n") continue;
      out[k] = " ";
    }
  };
  while (i < n) {
    const two = text.slice(i, i + 2);
    if (two === "//") {
      let j = i;
      while (j < n && text[j] !== "\n") j += 1;
      blank(i, j, false);
      i = j;
      continue;
    }
    if (two === "/*") {
      const end = text.indexOf("*/", i + 2);
      const j = end === -1 ? n : end + 2;
      blank(i, j, true);
      i = j;
      continue;
    }
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === ch) break;
        j += 1;
      }
      /* The quotes are kept and only the body is blanked, so the statement still parses as
         `from " "` and the specifier extraction below reads a recognisable shape. */
      blank(i + 1, j, true);
      i = Math.min(j + 1, n);
      continue;
    }
    i += 1;
  }
  return out.join("");
}

export interface Imported {
  file: string;
  specifier: string;
  names: string[];
}

/** Every static import, read off the stripped source and re-read for its specifier. */
export function importsOf(file: string, text: string): Imported[] {
  const stripped = strip(text);
  const found: Imported[] = [];
  const re = /import\s+([\s\S]*?)\s*from\s*(["'])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const quote = m[2];
    const start = m.index + m[0].length;
    const end = text.indexOf(quote, start);
    if (end === -1) continue;
    const specifier = text.slice(start, end);
    const clause = m[1];
    const braced = /\{([\s\S]*)\}/.exec(clause);
    const names = (braced?.[1] ?? clause)
      .split(",")
      .map((part) => part.replace(/\btype\b/g, "").trim())
      .map((part) => (part.includes(" as ") ? part.slice(0, part.indexOf(" as ")).trim() : part))
      .map((part) => part.replace(/^\*\s*/, "").trim())
      .filter((part) => part.length > 0 && /^[A-Za-z_$][\w$]*$/.test(part));
    found.push({ file, specifier, names });
  }
  return found;
}

/**
 * The hits of a find answer, checked for shape before anything reads `evidence`.
 *
 * Without this a module that dropped `evidence` reds with `Cannot read properties of
 * undefined`, a red naming a plausible wrong cause. Widening what the failure says costs
 * nothing and does not narrow what the module may return.
 */
export function hitsOf(result: unknown, where: string): { evidence: readonly string[] }[] {
  const hits = (result as { hits?: unknown })?.hits;
  if (!Array.isArray(hits)) {
    throw new Error(
      `${where}: the answer carries no \`hits\` array; it is ${describe_(hits)}.\n` +
        "  A find verb answers `{ task, encoder, ordered, hits }`.",
    );
  }
  const missing = hits.filter(
    (h) => !Array.isArray((h as { evidence?: unknown }).evidence),
  );
  if (missing.length > 0) {
    throw new Error(
      `${where}: ${missing.length} of ${hits.length} hits carry no \`evidence\` array.\n` +
        `  First: ${JSON.stringify(missing[0])}\n` +
        "  Every find hit carries `evidence: readonly string[]`: `ordered: true` with nothing " +
        "beside it is a relevance number with no published derivation.",
    );
  }
  return hits as { evidence: readonly string[] }[];
}
