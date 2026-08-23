/* ============================================================
   T180 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   Written in a worktree branched from `backend` at `3290981`,
   before `lib/server/runs` exists — measured, not assumed:
   `ls lib/server` at that sha does not list `runs`, and a grep
   for `submitReport|reportedCost` over `lib app tests components
   scripts` returns hits only in `backend.md`. Every load of the
   module under test is therefore a dynamic import, for T000's
   recorded reason: a static top-level import of a file that is
   not on disk fails the whole suite at collection and hides
   every criterion behind one red.

   ── this suite does not read the implementation ──
   The dispatch narrows `wave-blind.md`: the partition is
   `tests/server/t180/**`, and `lib/server/runs/**` and
   `app/api/runs/**` are neither read nor written. `wave-blind.md`
   asks a type pin to be accompanied by "a source cell that reads
   the barrel from disk". A brief may narrow a standing rule and
   never widen it, so the narrower one holds and the disk read
   does not happen. `barrelExports()` is the substitute ratified
   for T240, separating the same three states through the public
   interface instead of through the filesystem:

     • the import REJECTS            -> the module is absent
     • it resolves and a key is
       missing from `Object.keys`    -> the member is absent
     • the key is there              -> an assertion failed

   ── the domain is DERIVED from backend.md, with a floor ──
   A construction over an author's transcription of a spec is a
   list one level up, so the published block is parsed out of the
   contract document rather than retyped here. The transcribed
   constants that remain exist only as a FLOOR that reds the day
   the parse and the contract disagree (`surface.test.ts`).

   ── one parser difference from T240's, and it is load-bearing ──
   T240's block writes every interface across several lines and
   closes it on a line of its own. §T180 writes `ReportedCost` on
   ONE line, closing brace included. T240's parser would leave
   that interface open and throw "unterminated" over a block that
   is well formed. The parser below closes an interface when the
   brace depth returns to zero, wherever that happens, which
   reads both forms. Copying the parser without that change would
   have made this suite's whole domain unavailable and reported
   it as the orchestrator's defect.
   ============================================================ */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;
export type Row = Record<string, unknown>;

/* ============================================================
   the module under test, named ONCE
   ============================================================ */

export const BARREL = "@/lib/server/runs";

let runs: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for
 * the whole file, and every cell that awaits it gets its own copy of the same red rather
 * than one cell's failure cascading into an unhandled rejection in the next.
 */
export function loadRuns(): Promise<Namespace> {
  runs ??= import("@/lib/server/runs").then((m) => m as unknown as Namespace);
  return runs;
}

export interface BarrelState {
  state: "module-absent" | "present";
  /** Every name the barrel exports, sorted. Empty when the module is absent. */
  keys: readonly string[];
  /** The import rejection, when there was one. */
  cause?: unknown;
}

export async function barrelExports(): Promise<BarrelState> {
  try {
    const mod = await loadRuns();
    return { state: "present", keys: Object.keys(mod).sort() };
  } catch (cause) {
    return { state: "module-absent", keys: [], cause };
  }
}

/** What a value is, for a failure message that does not make the reader go looking. */
export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  return typeof value;
}

export function required(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${BARREL} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  The module RESOLVED, so this is a MEMBER absent and not the module absent — a ` +
      `failed acceptance criterion, not a naming difference. Do not add a synonym to a ` +
      `candidate list here; publish the name the contract states, or amend the contract.`,
  );
}

export function requiredFn(mod: Namespace, name: string, clause: string): UnknownFn {
  const value = required(mod, name, clause);
  if (typeof value !== "function") {
    throw new Error(
      `${BARREL} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/* ============================================================
   the published surface, DERIVED from backend.md
   ============================================================ */

const BACKEND_MD = fileURLToPath(new URL("../../../backend.md", import.meta.url));

export interface PublishedSignature {
  name: string;
  /** Top-level parameters, split at depth zero so an inline object type stays one. */
  params: readonly string[];
  returns: string;
  text: string;
}

export interface PublishedInterface {
  name: string;
  /** `field: type` in the order the block writes them, semicolons collapsed. */
  fields: readonly string[];
}

export interface PublishedBlock {
  signatures: readonly PublishedSignature[];
  interfaces: readonly PublishedInterface[];
  declarations: readonly { kind: "const" | "type" | "class"; name: string; text: string }[];
  /** The numbered acceptance criteria, `(n) text` split apart. */
  criteria: readonly string[];
  /** Every `D-nnn-nn` the section cites, in document order. */
  rulings: readonly string[];
  /** The quoted admissible message forms, as the block writes them. */
  admissible: readonly string[];
  /**
   * A digest over EXACTLY the fields above and nothing else. Prose moves freely
   * underneath it; a signature, a field, a criterion or a ruling cannot.
   */
  pin: string;
}

function sectionOf(document: string, heading: string): string {
  const start = document.indexOf(`\n### ${heading}`);
  if (start === -1) {
    throw new Error(
      `backend.md carries no \`### ${heading}\` section.\n` +
        `  This suite derives its whole domain from that section rather than from a list ` +
        `typed here, so a missing heading is a BROKEN TEST and not a failed criterion. ` +
        `Report it; do not retype the block.`,
    );
  }
  const rest = document.slice(start + 1);
  const end = rest.indexOf("\n### ");
  return end === -1 ? rest : rest.slice(0, end);
}

/** Split at brace/paren/angle depth zero, so `spread: { p10: number; p90: number }` survives as one. */
function splitTopLevel(text: string, separator: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "{" || ch === "(" || ch === "<" || ch === "[") depth += 1;
    else if (ch === "}" || ch === ")" || ch === ">" || ch === "]") depth -= 1;
    if (ch === separator && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "") out.push(current.trim());
  return out;
}

/** Net brace depth of a line, so an interface can close on the line that opened it. */
function braceDelta(text: string): number {
  let delta = 0;
  for (const ch of text) {
    if (ch === "{") delta += 1;
    else if (ch === "}") delta -= 1;
  }
  return delta;
}

const SIGNATURE = /^(\w+)\((.*)\):\s*(.+)$/;

let cached: PublishedBlock | undefined;

/**
 * The `- **Published signatures**` block and the acceptance criteria of `### T180,`, parsed.
 *
 * Everything indented at least eight spaces inside the section and above `- **Goal:**` is
 * the signatures block; the section's prose is never indented that way.
 *
 * An interface closes when brace depth returns to zero rather than on a line that starts
 * with `}` — §T180 writes `ReportedCost` inline, and the start-of-line reading would leave
 * it open forever. Its fields are split on `;` at depth zero, which is what keeps
 * `spread: { p10: number; p90: number }` one field rather than two.
 */
export function publishedBlock(): PublishedBlock {
  if (cached !== undefined) return cached;

  const section = sectionOf(readFileSync(BACKEND_MD, "utf8"), "T180,");

  const goal = section.indexOf("\n- **Goal:**");
  const blockText = goal === -1 ? section : section.slice(0, goal);
  const indented = blockText
    .split("\n")
    .filter((line) => /^ {8,}\S/.test(line))
    .map((line) => line.trim());

  const signatures: PublishedSignature[] = [];
  const interfaces: PublishedInterface[] = [];
  const declarations: PublishedBlock["declarations"][number][] = [];

  let open: { name: string; body: string; depth: number } | undefined;
  for (const line of indented) {
    if (open !== undefined) {
      const depth = open.depth + braceDelta(line);
      if (depth <= 0) {
        const tail = line.slice(0, line.lastIndexOf("}"));
        interfaces.push({
          name: open.name,
          fields: splitTopLevel(`${open.body} ${tail}`, ";").filter((f) => f !== ""),
        });
        open = undefined;
        continue;
      }
      open.body += ` ${line}`;
      open.depth = depth;
      continue;
    }
    const opening = /^interface\s+(\w+)\s*\{(.*)$/.exec(line);
    if (opening !== null) {
      const depth = 1 + braceDelta(opening[2]);
      if (depth <= 0) {
        /* Closed on its own line, which is how §T180 writes `ReportedCost`. */
        const tail = opening[2].slice(0, opening[2].lastIndexOf("}"));
        interfaces.push({
          name: opening[1],
          fields: splitTopLevel(tail, ";").filter((f) => f !== ""),
        });
        continue;
      }
      open = { name: opening[1], body: opening[2], depth };
      continue;
    }
    const declaration = /^(const|type|class)\s+(\w+)\b(.*)$/.exec(line);
    if (declaration !== null) {
      declarations.push({
        kind: declaration[1] as "const" | "type" | "class",
        name: declaration[2],
        text: line,
      });
      continue;
    }
    const signature = SIGNATURE.exec(line);
    if (signature !== null) {
      signatures.push({
        name: signature[1],
        params: splitTopLevel(signature[2], ","),
        returns: signature[3].trim(),
        text: line,
      });
    }
  }
  if (open !== undefined) {
    throw new Error(
      `backend.md §T180's \`interface ${open.name}\` is unterminated in the published block. ` +
        `The parse is the domain of every shape cell, so this is a broken test.`,
    );
  }

  const criteriaLine = /^- \*\*Acceptance criteria:\*\*\s*(.+)$/m.exec(section);
  if (criteriaLine === null) {
    throw new Error(
      "backend.md §T180 carries no `- **Acceptance criteria:**` line. This suite quantifies " +
        "over the criteria rather than over a list typed here, so this is a broken test.",
    );
  }
  const criteria = criteriaLine[1]
    .split(/\(\d+\)\s*/)
    .map((part) => part.replace(/;\s*$/, "").replace(/\.\s*$/, "").trim())
    .filter((part) => part !== "");

  /* `D-05-07`, `D-05-09` and `D-WAVE-01` all reach this task, so the shape is not `D-180-nn`. */
  const rulings = [...new Set(section.match(/D-[A-Z0-9]+-\d+/g) ?? [])];

  /* §T180 writes "Admissible message form:", SINGULAR, where §T240 writes "forms". */
  const admissibleLine = /\*\*Admissible message forms?:\*\*(.*)$/m.exec(section);
  const admissible =
    admissibleLine === null ? [] : [...admissibleLine[1].matchAll(/`"([^"]*)"`/g)].map((m) => m[1]);

  const pin = createHash("sha256")
    .update(
      JSON.stringify({
        signatures: signatures.map((s) => s.text),
        interfaces: interfaces.map((i) => [i.name, [...i.fields]]),
        declarations: declarations.map((d) => `${d.kind} ${d.name}`),
        criteria,
        rulings,
        admissible,
      }),
    )
    .digest("hex");

  cached = { signatures, interfaces, declarations, criteria, rulings, admissible, pin };
  return cached;
}

/** The one signature by name, or a broken-test throw naming what the block does carry. */
export function signature(name: string): PublishedSignature {
  const found = publishedBlock().signatures.find((s) => s.name === name);
  if (found === undefined) {
    throw new Error(
      `backend.md §T180's published block declares no \`${name}(...)\`. It declares: ` +
        `${publishedBlock().signatures.map((s) => s.name).join(", ") || "(nothing)"}.`,
    );
  }
  return found;
}

/** The one interface by name, same contract as `signature`. */
export function published(name: string): PublishedInterface {
  const found = publishedBlock().interfaces.find((i) => i.name === name);
  if (found === undefined) {
    throw new Error(
      `backend.md §T180's published block declares no \`interface ${name}\`. It declares: ` +
        `${publishedBlock().interfaces.map((i) => i.name).join(", ") || "(nothing)"}.`,
    );
  }
  return found;
}

/**
 * The response interface, by ROLE rather than by a hardcoded name.
 *
 * **D-180-01 ratifies the published type as `ReportedCostUnits`, and the signatures block
 * still writes `interface ReportedCost`.** Measured at `0484452`, not assumed. So a suite
 * that hardcoded either name reds on a document that is mid-rename — the old name today,
 * the new name the moment the block catches up — and in both cases it would red a correct
 * module over a name the contract had already settled.
 *
 * The key set is what D-180-01 says is unchanged ("the KEY SET above is unchanged; the
 * TYPE NAME carries the unit"), so the key set is what this suite pins and the name is
 * what it tolerates. A THIRD name, or both present at once, is a real contract change and
 * throws rather than picking one.
 */
export const RESPONSE_TYPE_NAMES = ["ReportedCostUnits", "ReportedCost"] as const;

export function responseInterface(): PublishedInterface {
  const declared = publishedBlock().interfaces;
  const hits = declared.filter((i) => (RESPONSE_TYPE_NAMES as readonly string[]).includes(i.name));
  if (hits.length !== 1) {
    throw new Error(
      `backend.md §T180's block declares ${hits.length} of ${JSON.stringify(RESPONSE_TYPE_NAMES)} ` +
        `(found: ${declared.map((i) => i.name).join(", ") || "nothing"}). This suite pins the ` +
        `response KEY SET and tolerates the rename D-180-01 ratified; it cannot tolerate two ` +
        `response types or none. Broken test, not a failed criterion.`,
    );
  }
  return hits[0];
}

/** Which of the two names the block currently carries, for a cell that records the rename. */
export function responseTypeName(): string {
  return responseInterface().name;
}

/** `field` off a `field: type` entry, so a cell can quantify over names alone. *//** `field` off a `field: type` entry, so a cell can quantify over names alone. */
export function fieldNames(iface: PublishedInterface): string[] {
  return iface.fields.map((f) => f.split(":")[0].trim().replace(/\?$/, ""));
}

/* ============================================================
   the refusal vocabulary, DERIVED from the whole section

   **Not from the Published signatures block, and that is a
   measured decision.** D-180-03 publishes `RunReportRefusedError`
   and the message `submitReport: a run report needs an account.`;
   D-180-04 adds `submitReport: the run report is malformed.` and
   rules that both refusals share ONE class. None of the three
   reached the signatures block — it still declares two
   interfaces and two functions, and its admissible list still
   carries only the digest form.

   So a parse over the block alone reports ONE message where the
   contract now rules THREE, and would make every new refusal
   cell compare against `undefined`. Scanning the whole section
   for `submitReport: ...` forms reads them wherever the
   orchestrator writes them, and keeps reading them when the
   block is updated. Same lesson as the inline-interface repair:
   a derivation is only a derivation over the forms it can read.
   ============================================================ */

export const REFUSAL_FORMS_FLOOR = [
  "submitReport: a run report needs an account.",
  "submitReport: no release at digest `<digest>`.",
  "submitReport: the run report is malformed.",
] as const;

/** Every `submitReport: ...` message form §T180 rules, in the block or in prose, sorted. */
export function ruledMessages(): string[] {
  const section = sectionOf(readFileSync(BACKEND_MD, "utf8"), "T180,");
  const found = new Set<string>();
  /**
   * Two spellings, and the first version of this walker read only one.
   *
   * The Admissible block writes `` `"submitReport: ..."` `` — backticks around a quoted
   * string — while D-180-03 and D-180-04 write `` `submitReport: ...` `` bare. And the
   * digest form CONTAINS backticks of its own around `<digest>`, so a `[^`]*` body stops
   * inside it and drops the one message that was already ruled. Measured: that regex
   * returned the two new forms and lost the digest one entirely.
   *
   * So the match runs to the first `.` that closes the form — the character before the
   * delimiter — rather than trying to find the delimiter itself.
   */
  for (const m of section.matchAll(/submitReport: .*?\.(?=[`"])/g)) found.add(m[0]);
  const out = [...found].sort();
  if (out.length === 0) {
    throw new Error(
      "§T180 rules no `submitReport: ...` message form. Every refusal cell compares against " +
        "one of these, and an empty set makes them vacuous. Broken test, not a failed criterion.",
    );
  }
  return out;
}

/** The one ruled form containing `needle`, or a broken-test throw naming what was found. */
export function refusalForm(needle: string): string {
  const hits = ruledMessages().filter((m) => m.includes(needle));
  if (hits.length !== 1) {
    throw new Error(
      `§T180 rules ${hits.length} \`submitReport\` message forms containing "${needle}"; ` +
        `this suite is written against exactly one. Parsed: ${JSON.stringify(ruledMessages())}.`,
    );
  }
  return hits[0];
}

/* ============================================================
   AC6's naming rule, DERIVED from the section

   §T180: "a test asserts no key in the response shape contains
   `measured`, `observed`, `actual` or `verified`." The words are
   parsed off that sentence rather than retyped, so the day the
   orchestrator widens the list this instrument widens with it
   and nobody edits this file. The floor below reds if the parse
   and the transcription disagree.

   The list is CLOSED at the four the section names. The sibling
   guard in `lib/server/observability/types.test.ts:52` uses a
   wider `/run|execut|invoc|trace|telemetry/i`, and adopting that
   here would be this suite inventing contract — reported to the
   orchestrator instead, and pinned at four until it rules.
   ============================================================ */

export const MEASUREMENT_WORDS_FLOOR = ["measured", "observed", "actual", "verified"] as const;

export function measurementWords(): string[] {
  const section = sectionOf(readFileSync(BACKEND_MD, "utf8"), "T180,");
  const sentence = /no key in the response shape contains([^.]*)\./.exec(section);
  if (sentence === null) {
    throw new Error(
      "backend.md §T180 no longer carries the sentence AC6's word list is parsed from " +
        '("no key in the response shape contains ...").\n' +
        "  This suite derives the list rather than retyping it, so a missing sentence is a " +
        "BROKEN TEST and not a failed criterion. Report it; do not retype the words.",
    );
  }
  const words = [...sentence[1].matchAll(/`(\w+)`/g)].map((m) => m[1]);
  if (words.length === 0) {
    throw new Error(
      "AC6's word list parsed to nothing. An empty forbidden set makes every naming cell " +
        "vacuously green, which is the one failure this derivation exists to avoid. Broken test.",
    );
  }
  return words;
}

/**
 * Every key in a value, including nested ones, as dotted paths.
 *
 * **Recursive, and that is the whole point.** `ReportedCost` carries
 * `spread: { p10, p90 }`, so a flat `Object.keys(response)` never sees `spread`'s own
 * keys and AC6's instrument is vacuous over exactly the part of the shape a later
 * contributor is most likely to extend. A `measuredP50` added inside `spread` would
 * pass a flat check forever.
 *
 * Arrays are walked by element so an index never masks a key. Cycles are tracked
 * because a response is not guaranteed acyclic and a walker that hangs reports nothing.
 */
export function nestedKeys(value: unknown, seen = new WeakSet<object>(), prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const out: string[] = [];
  if (Array.isArray(value)) {
    for (const [i, element] of value.entries()) {
      out.push(...nestedKeys(element, seen, `${prefix}[${i}]`));
    }
    return out;
  }
  for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    out.push(path);
    out.push(...nestedKeys(member, seen, path));
  }
  return out;
}

/**
 * The keys of `value` that AC6 forbids, as dotted paths, with the word that condemned each.
 *
 * Matched on the LAST path segment rather than on the whole path: a nested key under a
 * legitimately-named parent must be judged on its own name, and matching the dotted path
 * would let a parent's name condemn or excuse a child's.
 */
export function measurementNamed(value: unknown, words: readonly string[]): string[] {
  return nestedKeys(value).filter((path) => {
    const leaf = path.split(".").at(-1) ?? path;
    return words.some((word) => leaf.toLowerCase().includes(word.toLowerCase()));
  });
}
