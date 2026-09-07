/* ============================================================
   T231 — the key-type contract surface

   Not a test file: the vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   The loader is memoised as the PROMISE, rejection included, so
   a missing module gives every cell its own copy of the same red
   rather than one cell's failure cascading into an unhandled
   rejection in the next.

   The `ResolvedKey` brand proves PROVENANCE, never non-revocation:
   the type system cannot verify that a key is unrevoked, so a
   narrowing to `revokedAt: null` could only come from a cast, and
   it would make the `isNull(revokedAt)` clause in `resolveKey`
   unmeasurable. No cell here asserts that a `ResolvedKey` is
   unrevoked; they assert that only `resolveKey` can produce one.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const BARREL = "@/lib/server/limits";

type Namespace = Record<string, unknown>;

let limits: Promise<Namespace> | undefined;

export function loadLimits(): Promise<Namespace> {
  limits ??= import("@/lib/server/limits").then((m) => m as unknown as Namespace);
  return limits;
}

/**
 * A named export, or a red that says what was expected and what the barrel actually holds.
 *
 * The inventory is in the message because the two failures a blind cell hits look alike from
 * the outside — the member was renamed, or the barrel is a different module than the one this
 * suite thinks it is pointed at — and the export list separates them without a second run.
 */
export function required(module: Namespace, name: string, why: string): unknown {
  const value = module[name];
  if (value === undefined) {
    throw new Error(
      `\`${BARREL}\` exports no \`${name}\`.\n` +
        `  ${why}\n` +
        `  It exports: ${Object.keys(module).sort().join(", ")}`,
    );
  }
  return value;
}

/* ============================================================
   the published 429 shape
   ============================================================ */

/** The 429's key set, in the order the response writes it, and the one member pinned to a literal. */
const PROBLEM_429 = {
  members: [
    "type",
    "title",
    "status",
    "detail",
    "instance",
    "limit",
    "remaining",
    "resetAt",
    "keysAvailable",
  ],
  pinned: { keysAvailable: "true" },
} as const;

export function publishedProblemMembers(): { members: string[]; pinned: Record<string, string> } {
  return { members: [...PROBLEM_429.members], pinned: { ...PROBLEM_429.pinned } };
}

/* ============================================================
   the module's own source

   AC3 forbids a second database READ, and a signature with no
   `db` in it does not by itself establish that: a `checkLimit`
   reaching `getSharedDbClient()` internally satisfies AC2's
   parameter list and performs exactly the lookup AC3 forbids.
   That is observable in the source and needs no database, which
   is deliberate — this run stood 28 scratch databases (dropped 2026-08-22 on the owner's ruling; the baseline is now `darkprint` plus two pre-existing `t090_attractor_*`) the owner
   has yet to rule on, and a blind suite is not the place to add
   to them.
   ============================================================ */

export const MODULE_FILES = [
  "check.ts",
  "config.ts",
  "types.ts",
  "counter.ts",
  "keys.ts",
  "errors.ts",
  "http.ts",
  "secret.ts",
  "store.ts",
  "index.ts",
] as const;

export function moduleSource(file: string): string {
  const path = fileURLToPath(new URL(`../../../lib/server/limits/${file}`, import.meta.url));
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `\`lib/server/limits/${file}\` is not on disk. This suite reads the module's source ` +
        `for the criteria a signature cannot show, so a moved or renamed file is a broken ` +
        `test rather than a failed criterion — report it, do not delete the cell.`,
    );
  }
}

/** Comments stripped, so a name inside a prose paragraph never reads as code. */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * The parenthesised parameter list of a top-level `export async function <name>` or
 * `export function <name>`, comments already stripped, split at depth zero so an inline
 * object type survives as one parameter.
 */
export function parametersOf(source: string, name: string): string[] {
  const code = withoutComments(source);
  const at = code.search(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`));
  if (at === -1) {
    throw new Error(
      `\`${name}\` is not declared as a top-level \`export function\` in the source read. ` +
        `The cell that called this reads a PARAMETER LIST, so a different declaration form ` +
        `is a broken instrument and must be reported rather than worked around.`,
    );
  }

  const open = code.indexOf("(", at);
  let depth = 0;
  let end = -1;
  for (let i = open; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === "(" || ch === "{" || ch === "[" || ch === "<") depth += 1;
    else if (ch === ")" || ch === "}" || ch === "]" || ch === ">") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`\`${name}\`'s parameter list is unterminated in the source.`);

  const inner = code.slice(open + 1, end);
  const out: string[] = [];
  let current = "";
  depth = 0;
  for (const ch of inner) {
    if (ch === "(" || ch === "{" || ch === "[" || ch === "<") depth += 1;
    else if (ch === ")" || ch === "}" || ch === "]" || ch === ">") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "") out.push(current.trim());
  return out.filter((p) => p !== "");
}

/** The declared name of a parameter, before its `:` and without a default. */
export function parameterName(parameter: string): string {
  return parameter.split(":")[0].split("=")[0].trim();
}

/* ============================================================
   the published signatures

       declare const resolved: unique symbol;
       export type ResolvedKey = ApiKeyRecord & { readonly [resolved]: true };

       export type LimitSubject =
         | { tier: "anonymous"; ip: string }
         | { tier: "account"; accountId: string; ip: string }
         | { tier: "key"; key: ResolvedKey; ip: string };

       resolveKey(db: Db, secret: string): Promise<ResolvedKey | undefined>
       checkLimit(subject: LimitSubject, bucket: string, options?): Promise<LimitVerdict>
       enforceLimit(subject: LimitSubject, bucket: string, options?): Promise<LimitVerdict>

   `db` is not a parameter of either limit function. `options` is
   a defaulted third parameter, so both arities are 2.
   ============================================================ */

export const PUBLISHED = {
  checkLimit:
    "checkLimit(subject: LimitSubject, bucket: string, options?): Promise<LimitVerdict>. " +
    "No `db`; the key arrives as `ResolvedKey`.",
  enforceLimit:
    "enforceLimit(subject: LimitSubject, bucket: string, options?): Promise<LimitVerdict>. " +
    "Throws; it does not return a union a caller can drop.",
  resolveKey:
    "resolveKey(db: Db, secret: string): Promise<ResolvedKey | undefined>. " +
    "`| undefined`, never `| null`, matching what the function returns.",
  listKeys:
    "listKeys(db: Db, actor: Actor, accountId: string): Promise<ApiKeyRecord[]>. " +
    "Revoked rows are LISTED rather than filtered, so a caller can see what was revoked.",
  rateLimited:
    "rateLimited(request: Request, verdict: LimitVerdict, bucket: string): Response. " +
    "The author of the 429 key set, which must not move.",
  tierOf: "tierOf(subject): Tier.",
} as const;

/** The subject's three arms. The domain of the tier cells. */
export const SUBJECT_TIERS = ["anonymous", "account", "key"] as const;
