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

/**
 * The two classes D-220-06 rules, after this suite charged the block for publishing none.
 *
 * `McpRefusedError` answers absent, unparseable AND private with ONE sentence (B-03's
 * 404-over-403 rule: a distinct refusal for "it exists but is not yours" reinstates the leak
 * the status code closed). `McpStoreError` is D-13's seal, and D-220-06 ratifies it as
 * T220's OWN boundary because `getBundle` and `listReleases` are unsealed bare selects.
 *
 * `ExportError` is WRAPPED here rather than passed through, so the four-verb surface refuses
 * with one voice instead of leaking its dependencies' taxonomy — which is the opposite of
 * D-50-08's pass-through rule and is ruled that way deliberately.
 *
 * Not counted against `tests/error-hygiene.test.ts` by anything here: that guard is an
 * EQUALITY whose domain is `git ls-tree -d <backend sha> lib/server/`, so a module in a
 * worktree cannot move it. It goes 40 -> 42 at the merge, derived there, and T160 and T180
 * move the same figure from the same base — whoever lands last faces a different number.
 */
export const PUBLISHED_CLASSES = ["McpRefusedError", "McpStoreError"] as const;

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

/**
 * The operation names read OFF `app/mcp/page.tsx`, not off the constant above.
 *
 * The constant is a transcription and comparing it to `PUBLISHED_NAMES.length` is 4 === 4
 * with both fours written in this file — a cell that passes against an absent module and
 * reads as coverage. Measured: it was the one cell in the whole suite that passed in the
 * blind position, which is exactly how a tautology announces itself.
 *
 * The page is the advertised contract (D-220-01 (3)) and it is Forbidden to both halves, so
 * reading it is the only way this claim gets a second author. Comments are stripped first
 * for the reason `purity.test.ts` states at length: the page's own docblock discusses the
 * operations in prose, and a raw scan would count the discussion.
 */
export function advertisedOperations(pageSource: string): string[] {
  const code = strip(pageSource);
  const start = code.indexOf("const OPERATIONS");
  if (start === -1) {
    throw new Error(
      "`const OPERATIONS` is not in app/mcp/page.tsx. D-220-01 (3) names lines 85-110 as the " +
        "advertised contract; if the array was renamed, this reader needs updating and the " +
        "count below is not a finding about the module.",
    );
  }
  const end = code.indexOf("] as const;", start);
  const block = code.slice(start, end === -1 ? undefined : end);
  /* The names come from the ORIGINAL text at the offsets the stripped block reports, because
     `strip` blanks string bodies — same split as the AC1 import scan. */
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

/* --------------------- outcomes, and why they are not `rejects` --------------------- */

/**
 * What a call did: answered, or refused.
 *
 * Every AC3 cell in this suite is written against this rather than against
 * `expect(...).rejects.toThrow()`, and the reason is charge 6 in the T220 log: **the
 * published block names no error class**, while `mcpReadCard: Promise<string>` and
 * `mcpProvenance: Promise<Provenance>` are total return types that must refuse somehow.
 * Three resolutions are live — a new `McpError`, the composed modules' classes passing
 * through, or `| undefined` on the return type — and a blind cell that picks one reports a
 * defect against an implementer who followed the contract.
 *
 * So the criterion is asserted in the form it is actually written in: *private content is
 * unreachable*. Unreachable is a claim about what came BACK, and it is true of a throw, of
 * an `undefined` and of an empty list alike. It is false of exactly one thing, which is the
 * private bytes arriving — and `rejects.toThrow()` cannot see that difference at all: a
 * suite's own absent-module rejection satisfies a bare `rejects.toThrow()`, so the cell
 * passes against a module that does not exist.
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
 * Written for a LEAK scan, which is why it does not stop where D-13's hygiene clause does.
 * That clause rewards an error whose payload is non-enumerable — `rateLimitedError` hangs
 * its context off a symbol precisely so `Object.keys`, `JSON.stringify` and a spread all
 * skip it — and an enumerable-only walk over that shape reads `{}` and reports no leak
 * while the payload sits there. So this reads `message`, `stack`, `cause` transitively, own
 * enumerable AND non-enumerable properties, and symbol-keyed ones.
 *
 * Cycles are closed on identity rather than on depth: a `cause` chain can be circular and a
 * depth cap would turn a leak scan into a scan of the first few frames.
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
      /* REDUNDANT TODAY, AND KEPT — measured rather than assumed. `new Error(m, {cause})`
         installs `cause` as a NON-ENUMERABLE OWN property (`Object.keys` answers `[]`,
         `Reflect.ownKeys` answers `stack,message,cause`), so the general walk below already
         reaches it: deleting this line alone reddened 0 of 15 instrument cells. It is a
         waiting guard rather than dead code, and the 2x2 is what separates the two — with
         the walk below narrowed to `Object.keys` as well, the `cause` cell RED. Both
         mutations together red 2; either alone reds 1 and 0. */
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
 * Whether `needle` appears anywhere in what a call produced.
 *
 * The needle is always a string only the private fixture carries, so a hit is a leak and
 * not a coincidence. Substring rather than equality: private bytes can arrive embedded in
 * a larger document, which is the shape a whole-value comparison misses.
 */
export function reveals(result: Outcome, needle: string): boolean {
  const subject = result.ok ? result.value : result.error;
  return stringsIn(subject).some((s) => s.includes(needle));
}

/* --------------------- AC1's source scan, and its instrument --------------------- */

/**
 * `text` with every comment blanked and every string body blanked, preserving offsets.
 *
 * Blanked rather than deleted so a reported index still points where a reader would look,
 * and so two adjacent tokens cannot be fused into a third by the removal.
 *
 * String bodies go too, and that is deliberate: an import specifier is a string, so the
 * scan below reads specifiers from the parsed statement rather than from free text, and a
 * function name mentioned inside an unrelated string literal — an error message naming
 * `serveCard`, which is exactly what a well-written refusal would do — must not red.
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
      /* The quotes are KEPT and only the body is blanked, so the statement still parses as
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

/**
 * Every static import, read off the stripped source and re-read for its specifier.
 *
 * The specifier is taken from the ORIGINAL text at the offsets the stripped text reports,
 * because `strip` blanked the string bodies. That split is the point: the shape is decided
 * on code with no prose in it, and the value is then read from the bytes.
 */
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
 * The hits of a `mcpSearch` answer, checked for SHAPE before anything reads `evidence`.
 *
 * Without this, a module that dropped `evidence` reds three cells with
 * `TypeError: Cannot read properties of undefined (reading 'length')` — measured, that is
 * the exact string. It is a red, and it names the wrong cause: a reader triaging it looks
 * for a null-safety bug in the suite rather than for the published field D-220-04 restored
 * after both halves charged its absence. Widening what the failure SAYS costs nothing and
 * does not narrow what the module may return.
 *
 * Returns the hits so a cell reads `hitsOf(result)` and then dereferences freely.
 */
export function hitsOf(result: unknown, where: string): { evidence: readonly string[] }[] {
  const hits = (result as { hits?: unknown })?.hits;
  if (!Array.isArray(hits)) {
    throw new Error(
      `${where}: the answer carries no \`hits\` array — it is ${describe_(hits)}.\n` +
        `  backend.md §T220 publishes ` +
        `\`Promise<{ hits: readonly McpSearchHit[]; ordered: boolean }>\`.`,
    );
  }
  const missing = hits.filter(
    (h) => !Array.isArray((h as { evidence?: unknown }).evidence),
  );
  if (missing.length > 0) {
    throw new Error(
      `${where}: ${missing.length} of ${hits.length} hits carry no \`evidence\` array.\n` +
        `  First: ${JSON.stringify(missing[0])}\n` +
        "  D-220-04 restored `evidence: readonly string[]` to `McpSearchHit` after both " +
        "halves charged the block for losing it: `ordered: true` with nothing beside it is " +
        "the relevance-number-with-no-published-derivation `/mcp`'s own OPEN row refuses.",
    );
  }
  return hits as { evidence: readonly string[] }[];
}
