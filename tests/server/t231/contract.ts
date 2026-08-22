/* ============================================================
   T231 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   Written at `25ef93d` on `test/t231-keytype`, which IS `backend`
   — `git merge backend` reported `Already up to date`. So
   `lib/server/limits` exists while this is written, at T230's
   merged signatures, which is the opposite of T230's blind
   position and changes what the pins beside this file can see.
   `published-shape.test.ts` says exactly how, in both directions.

   ── where D-231-01 comes from, and why that matters here ──
   §T231 in `backend.md` carries NO **Published signatures** block.
   Charged as F-231-A before anything was written: T231 is the one
   task whose entire deliverable is a signature, and it owns
   `types.ts`, `check.ts` and `tierOf`'s signature while stating
   the shape of none of them. Upheld, and the signature was
   published to me AS A MESSAGE, not into the document.

   **So `PUBLISHED` below is a TRANSCRIPTION of a ruling that is
   not yet in `backend.md`, and it is the weakest provenance any
   pin in this tree rests on.** T230's blind suite could parse its
   domain out of the document; this one cannot, because the
   document does not have it yet. `agrees-with-the-document.test.ts`
   is the guard: it is vacuous while §T231 publishes no block and
   becomes load-bearing the moment the orchestrator writes one,
   which is the same vacuous-until-present shape as the type pins
   and is stated for the same reason.

   ── F-231-B, and what these cells may NOT claim ──
   The first ruling narrowed the brand to `revokedAt: null`. It was
   AMENDED, and the amendment is binding on every cell here:
   **the brand proves PROVENANCE, never non-revocation.** The type
   system cannot verify non-revocation, so the narrowing could only
   have come from a cast — and it would have made F-230-J's
   mutation inert, since deleting `isNull(revokedAt)` from
   `resolveKey`'s WHERE still mints a branded record. Trading the
   only instrument that has ever measured that line for a guarantee
   that cannot fail is the trade this suite must not make.
   **No cell here asserts that a `ResolvedKey` is unrevoked.** They
   assert that only `resolveKey` can produce one.

   ── per-criterion reds live in the CELLS ──
   A throw in `beforeAll` produces skips, not reds; this run
   measured 127 merged cells going silent under one broken hook.
   The loader is memoised as the PROMISE, rejection included, so a
   missing module gives every cell its own copy of the same red
   rather than one cell's failure cascading into an unhandled
   rejection in the next.
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
   the published surface, DERIVED from backend.md

   A construction over an author's transcription of a spec is a
   list one level up, so the 429's key set is parsed out of the
   contract document. AC4 says that set is UNCHANGED, and a set
   typed here would be this suite asserting that the document
   agrees with what this suite remembers of it.
   ============================================================ */

const BACKEND_MD = fileURLToPath(new URL("../../../backend.md", import.meta.url));

function document(): string {
  return readFileSync(BACKEND_MD, "utf8");
}

export function sectionOf(heading: string): string {
  const doc = document();
  const start = doc.indexOf(`\n### ${heading}`);
  if (start === -1) {
    throw new Error(
      `backend.md carries no \`### ${heading}\` section.\n` +
        `  This suite derives its domain from that section rather than from a list typed ` +
        `here, so a missing heading is a broken test and not a failed criterion.`,
    );
  }
  const rest = doc.slice(start + 1);
  const end = rest.indexOf("\n### ");
  return end === -1 ? rest : rest.slice(0, end);
}

export const T230_HEADING = "T230, Rate limiting and API keys";
export const T231_HEADING = "T231, `checkLimit`'s key precondition should be a type, not a comment";

/**
 * D-230-09's published 429, parsed from the indented block in §T230.
 *
 * The block is:
 *
 *     problem+json 429  members exactly:
 *       type, title, status, detail, instance          (RFC 9457's five)
 *       limit, remaining, resetAt                       (the verdict, machine-readable)
 *       keysAvailable: true                             (T220 AC6's affordance)
 *
 * Parenthesised prose is dropped, `k: v` records the pinned value, and the order is the
 * order the block writes them so a red can quote the document rather than a sorted set.
 */
export function publishedProblemMembers(): { members: string[]; pinned: Record<string, string> } {
  const section = sectionOf(T230_HEADING);
  const at = section.indexOf("problem+json 429");
  if (at === -1) {
    throw new Error(
      "§T230 no longer carries a `problem+json 429  members exactly:` block. D-230-09 " +
        "publishes the 429's KEY SET and T231's AC4 says that set is unchanged, so this " +
        "suite has lost the only statement of it that is not a transcription.",
    );
  }

  const members: string[] = [];
  const pinned: Record<string, string> = {};
  for (const raw of section.slice(at).split("\n").slice(1)) {
    /* The block ends at the first line that is not one of its indented member rows. */
    if (!/^\s{2,}\S/.test(raw)) break;
    const line = raw.replace(/\([^)]*\)/g, "").trim();
    if (line === "") continue;
    for (const entry of line.split(",")) {
      const text = entry.trim();
      if (text === "") continue;
      const [name, value] = text.split(":").map((part) => part.trim());
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) continue;
      members.push(name);
      if (value !== undefined && value !== "") pinned[name] = value;
    }
  }

  if (members.length === 0) {
    throw new Error(
      "the `problem+json 429` block in §T230 parsed to zero members, so the parser and the " +
        "document disagree and every cell quantifying over this set is quantifying over nothing.",
    );
  }
  return { members, pinned };
}

/* ============================================================
   the module's own source

   AC3 forbids a second database READ, and a signature with no
   `db` in it does not by itself establish that: a `checkLimit`
   reaching `getSharedDbClient()` internally satisfies AC2's
   parameter list and performs exactly the lookup AC3 forbids.
   That is observable in the source and needs no database, which
   is deliberate — this run stands 28 scratch databases the owner
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
   D-231-01, transcribed

   The ruling as delivered, after the two amendments it took:
   `ResolvedKey` unnarrowed (F-231-B's amendment) and
   `enforceLimit` throwing rather than returning a union
   (F-231-E, upheld and the published line withdrawn).

       declare const resolved: unique symbol;
       export type ResolvedKey = ApiKeyRecord & { readonly [resolved]: true };

       export type LimitSubject =
         | { tier: "anonymous"; ip: string }
         | { tier: "account"; accountId: string; ip: string }
         | { tier: "key"; key: ResolvedKey; ip: string };

       resolveKey(db: Db, secret: string): Promise<ResolvedKey | undefined>
       checkLimit(subject: LimitSubject, bucket: string, options?): Promise<LimitVerdict>
       enforceLimit(subject: LimitSubject, bucket: string, options?): Promise<LimitVerdict>

   `db` leaves BOTH functions. `options` survives as a defaulted
   third parameter, so both arities are 2 and match the published
   two-parameter lines rather than contradicting them.

   The literals below are what `agrees-with-the-document.test.ts`
   diffs against §T231 once §T231 has a block to diff against.
   ============================================================ */

export const PUBLISHED = {
  checkLimit:
    "checkLimit(subject: LimitSubject, bucket: string, options?): Promise<LimitVerdict> — " +
    "D-231-01, AC1 and AC2. `db` is gone and the key arrives as `ResolvedKey`.",
  enforceLimit:
    "enforceLimit(subject: LimitSubject, bucket: string, options?): Promise<LimitVerdict> — " +
    "D-231-01 as amended by F-231-E. Throws; it does not return a union a caller can drop.",
  resolveKey:
    "resolveKey(db: Db, secret: string): Promise<ResolvedKey | undefined> — D-231-01. " +
    "`| undefined`, never `| null`, matching what the function already returns.",
  listKeys:
    "listKeys(db: Db, actor: Actor, accountId: string): Promise<ApiKeyRecord[]> — D-230-11, " +
    "unchanged by T231, and revoked rows are LISTED rather than filtered because that is " +
    "AC4's observation.",
  rateLimited:
    "rateLimited(request: Request, verdict: LimitVerdict, bucket: string): Response — " +
    "D-230-01, unchanged by T231, and the author of the key set AC4 says must not move.",
  tierOf: "tierOf(subject): Tier — T231 owns its SIGNATURE only (§T231 `Owns`).",
} as const;

/** The subject's three arms, as D-231-01 writes them. The domain of the tier cells. */
export const SUBJECT_TIERS = ["anonymous", "account", "key"] as const;

/**
 * §T231's Published signatures block, or `undefined` while it has none.
 *
 * Returns `undefined` rather than throwing: the block's absence is F-231-A, it is the
 * orchestrator's to fix at the merge, and a red here would be this suite failing a task for
 * a document it is forbidden to write. The cell that calls this says so in place.
 */
export function t231PublishedBlock(): string | undefined {
  const section = sectionOf(T231_HEADING);
  const at = section.indexOf("**Published signatures**");
  return at === -1 ? undefined : section.slice(at);
}
