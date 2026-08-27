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

/**
 * A section, found by a STABLE PREFIX rather than by its full title.
 *
 * The title used to be matched byte for byte, apostrophe included. That made all four cells
 * in `agrees-with-the-document.test.ts` hostage to a heading tidy-up: swapping the ASCII
 * apostrophe for a typographic one, or rewording the title, would red them for a reason
 * that has nothing to do with any criterion. **The task number is the identifier; the prose
 * after it is not.** Charged by T231's adversary; the apostrophe was verified ASCII on both
 * sides at `25ef93d`, so this is prospective fragility fixed rather than a live red.
 */
export function sectionOf(prefix: string): string {
  const doc = document();
  const start = doc.indexOf(`\n### ${prefix}`);
  if (start === -1) {
    throw new Error(
      `backend.md carries no \`### ${prefix}\` section.\n` +
        `  This suite derives its domain from that section rather than from a list typed ` +
        `here, so a missing heading is a broken test and not a failed criterion.`,
    );
  }
  const rest = doc.slice(start + 1);
  const end = rest.indexOf("\n### ");
  return end === -1 ? rest : rest.slice(0, end);
}

export const T230_HEADING = "T230,";
export const T231_HEADING = "T231,";

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
    /* The member rows are CODE, indented four or more; the prose that follows the block is
       indented two. The old test was `^\s{2,}`, which cannot tell them apart and relied on
       the blank line between them to stop — so the set was positional on §T230's spacing.
       Charged by T231's adversary.

       The attempted repair was to skip blank lines, and it was WRONG: it ran straight into
       the prose and parsed 21 members. The `.length === 9` assertion below caught it, which
       is what that assertion is for. Tightening the indent is the fix that actually
       separates the two, and the blank line stays a terminator because the rows really are
       contiguous.

       If the document's block changes shape this reds, and redding is CORRECT — the cells
       say `report it, do not delete the cell`. A parser that silently kept working over a
       block it no longer understood is the failure worth avoiding, not a loud one. */
    if (!/^\s{4,}\S/.test(raw)) break;
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
export const PUBLISHED_SIGNATURES_MARKER = "**Published signatures**";

/**
 * The Published signatures block of a section, or `undefined` while it has none.
 *
 * Pure, so the five candidate blocks in `agrees-with-the-document.test.ts` can be run
 * through the REAL parser rather than through a copy of it. That is not a convenience: the
 * defects below were found by an adversary simulating this parser, and a simulation is the
 * thing a committed cell replaces.
 */
export function publishedBlockIn(section: string): string | undefined {
  const at = section.indexOf(PUBLISHED_SIGNATURES_MARKER);
  return at === -1 ? undefined : section.slice(at);
}

/**
 * Every spelling of "Published signatures" the section contains that this parser does NOT
 * match — the near-miss detector.
 *
 * **A guard that silently never arms is worse than one that reds.** `publishedBlockIn`
 * matches one literal spelling; all 36 existing blocks use it, so the convention is real,
 * but a block landing as `**Published signatures:**` would make every cell downstream
 * answer "vacuous" and PASS, forever, while reporting that F-231-A was still open after it
 * had been closed. Nothing would ever say otherwise.
 *
 * So: find the phrase however it is written, and report any occurrence the parser missed.
 */
export function unmatchedSignatureMarkers(section: string): string[] {
  const out: string[] = [];
  for (const match of section.matchAll(/.{0,4}Published\s+[Ss]ignatures.{0,4}/g)) {
    const text = match[0];
    if (!text.includes(PUBLISHED_SIGNATURES_MARKER)) out.push(text.trim());
  }
  return out;
}

/**
 * The INDENTED code lines of a block — the signatures themselves, not the prose about them.
 *
 * Code in this document is indented eight spaces and prose two, so four separates them.
 * Everything that reads a signature reads these lines and never the whole block, and the
 * reason is a defect this suite shipped: scanning the block made a WITHDRAWAL NOTE quoting
 * an old signature indistinguishable from the published one, and §T230's own block is
 * written exactly that way — it prints the withdrawn `LimitVerdict` at length and then the
 * replacement. A guard blinded by quoting what it looks for is the third instance of that
 * shape in this run.
 */
export function signatureLinesIn(block: string): string[] {
  return block.split("\n").filter((line) => /^\s{4,}\S/.test(line));
}

/**
 * The parameter list of the published `checkLimit`, taken from the LAST signature line that
 * declares one.
 *
 * Last rather than first, because this document records its own history: a block that
 * withdraws a signature prints the old one above the new one, and the new one is what binds.
 */
export function checkLimitSignatureIn(block: string): string | undefined {
  let found: string | undefined;
  for (const line of signatureLinesIn(block)) {
    const match = /checkLimit\s*\(([^)]*)\)/.exec(line);
    if (match !== null) found = match[1];
  }
  return found;
}

/** Whether any published SIGNATURE narrows `revokedAt` to `null` — never the prose. */
export function narrowsRevokedAtToNull(block: string): boolean {
  return signatureLinesIn(block).some((line) => /revokedAt\s*:\s*null/.test(line));
}

export function t231Section(): string {
  return sectionOf(T231_HEADING);
}

export function t231PublishedBlock(): string | undefined {
  return publishedBlockIn(t231Section());
}
