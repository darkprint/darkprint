/* ============================================================
   T120 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   Written in a worktree branched from `backend` at `325d93c`,
   before `lib/server/lifecycle` exists — measured, not assumed:
   `ls lib/server` at that sha lists twenty-four folders and
   `lifecycle` is not among them, and a grep for
   `planTransfer|transferBundle|planDeletion|deleteAccount` over
   `lib app tests components scripts packages` returns hits only
   in `backend.md`. Every load of the module under test is
   therefore a DYNAMIC import, for T000's recorded reason: a
   static top-level import of a file that is not on disk fails
   the whole suite at collection, which reports one red where the
   protocol asks for one per acceptance criterion and hides five
   criteria behind the first missing module.

   ── this suite does not read the implementation ──
   The dispatch narrows `wave-blind.md`: the partition is
   `tests/server/t120/**`, and `lib/server/lifecycle/**`,
   `app/api/transfer/**` and `app/api/account/delete/**` are
   neither read nor written. `wave-blind.md` asks a type pin to
   be accompanied by "a source cell that reads the barrel from
   disk"; a disk read of the barrel IS opening the file the
   dispatch forbids, and a brief may narrow a standing rule and
   never widen it, so the narrower one holds. `barrelExports()`
   is the substitute ratified for T240 and reused by T180. It
   separates the same three states through the public interface:

     • the import REJECTS            -> the module is absent
     • it resolves and a key is
       missing from `Object.keys`    -> the member is absent
     • the key is there              -> an assertion failed

   That distinction is the whole reason it exists. A type pin is
   silently vacuous against an absent module — types erase — so a
   file of pure type assertions passes against a barrel that is
   not there, and only a cell that observes the IMPORT can tell
   the two apart.

   ── the domain is DERIVED from backend.md ──
   A construction over an author's transcription of a spec is a
   list one level up, so the published block is parsed out of the
   contract document rather than retyped here.

   ── the refusal vocabulary is read from the WHOLE SECTION ──
   D-180-06, and it is the ruling this suite most needs. Two
   refusal forms live in §T120's `Admissible message forms` block
   today, and the contract-defect report this author filed before
   writing a line argues that transfer needs at least three more
   (an actor who is not the bundle's owner, a `toHandle` naming
   no account, a `bundleId` naming no bundle). If those are ruled
   in, they may land in ruling prose rather than in the block —
   which is exactly what D-180-06 measured: a suite parsing the
   block alone compared every new refusal against `undefined`,
   and `rejects.toThrow(undefined)` is satisfied by ANY throw at
   all. The blind-position launderer in a new costume.

   So `ruledForms()` scans the entire section, keyed on the verb
   names the SIGNATURE PARSE produced rather than on a list typed
   here, and it is delimiter-agnostic: the forms carry backticks
   of their own (`` `<handle>` ``, `` `<slug>` ``), so a body
   pattern of `` [^`]* `` stops inside the first one and silently
   drops the message it was reading. T180's first walker did
   exactly that and dropped a form that was ALREADY RULED while
   acquiring two new ones. The match therefore runs from the verb
   to a closing period followed by a delimiter, and never tries
   to know which delimiter.
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

export const BARREL = "@/lib/server/lifecycle";

let lifecycle: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for
 * the whole file, and every cell that awaits it gets its own copy of the same red rather
 * than one cell's failure cascading into an unhandled rejection in the next.
 *
 * The specifier stays a literal so the `@` alias resolves.
 */
export function loadLifecycle(): Promise<Namespace> {
  lifecycle ??= import("@/lib/server/lifecycle").then((m) => m as unknown as Namespace);
  return lifecycle;
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
    const mod = await loadLifecycle();
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
  if (value instanceof Date) return `Date(${value.toISOString()})`;
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

export const SECTION_HEADING = "T120,";

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

/** One admissible refusal form: the verb that raises it, the sentence, and the class beside it. */
export interface RuledForm {
  verb: string;
  /** The sentence after `<verb>: `, placeholders intact. */
  body: string;
  /** `<verb>: <body>`, exactly as the document writes it. */
  message: string;
  /** The error class written on the same line, when the document writes one. */
  className?: string;
}

/** The placeholder D-120-03 writes where a verb name belongs. F-120-Q. */
export const OPERATION_SLOT = "<operation>";

export interface PublishedBlock {
  signatures: readonly PublishedSignature[];
  interfaces: readonly PublishedInterface[];
  declarations: readonly { kind: "const" | "type" | "class"; name: string; text: string }[];
  /** The numbered acceptance criteria, `(n) text` split apart. */
  criteria: readonly string[];
  /** Every `D-nnn-nn` the section cites, in document order. */
  rulings: readonly string[];
  /** Every (verb, body) refusal pair the SECTION enumerates, wherever it writes them. */
  forms: readonly RuledForm[];
  /**
   * Every (verb, body) pair the section quotes in order to FORBID it. D-120-20 names one.
   * Kept rather than dropped so `isAdmissible` can be asserted false for each.
   */
  forbidden: readonly RuledForm[];
  /**
   * Every refusal BODY the section publishes, placeholder-verb forms included. This is what
   * `isAdmissible` quantifies over — see `ruledFormsIn` for why it is bodies and not pairs.
   */
  bodies: readonly string[];
  /** Every `*Error` class name the section mentions, sorted. */
  errorClasses: readonly string[];
  /**
   * A digest over EXACTLY the fields above and nothing else. Prose moves freely
   * underneath it; a signature, a field, a criterion, a ruling or a form cannot.
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

/** The whole `### T120,` section, for the readers below and for a cell that needs its prose. */
export function sectionText(): string {
  return sectionOf(readFileSync(BACKEND_MD, "utf8"), SECTION_HEADING);
}

/** Split at brace/paren/angle depth zero, so an inline object type survives as one field. */
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
 * The `- **Published signatures**` block and the acceptance criteria of `### T120,`, parsed.
 *
 * Everything indented at least eight spaces inside the section and above `- **Goal:**` is
 * the signatures block; the section's prose is indented two or zero and never eight.
 *
 * An interface closes when brace depth returns to zero rather than on a line that starts
 * with `}` — §T120 writes BOTH of its interfaces inline, closing brace included, and the
 * start-of-line reading would leave the first one open and swallow the second. T180's
 * contract.ts records the same difference against T240's parser; it is copied here for the
 * same reason and not by habit.
 */
export function publishedBlock(): PublishedBlock {
  if (cached !== undefined) return cached;

  const section = sectionText();

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
        /* Closed on its own line, which is how §T120 writes both of them. */
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
      `backend.md §${SECTION_HEADING}'s \`interface ${open.name}\` is unterminated in the ` +
        `published block. The parse is the domain of every shape cell, so this is a broken test.`,
    );
  }

  const criteriaLine = /^- \*\*Acceptance criteria:\*\*\s*(.+)$/m.exec(section);
  if (criteriaLine === null) {
    throw new Error(
      `backend.md §${SECTION_HEADING} carries no \`- **Acceptance criteria:**\` line. This suite ` +
        `quantifies over the criteria rather than over a list typed here, so this is a broken test.`,
    );
  }
  const criteria = criteriaLine[1]
    .split(/\(\d+\)\s*/)
    .map((part) => part.replace(/;\s*$/, "").replace(/\.\s*$/, "").trim())
    .filter((part) => part !== "");

  /* `D-05-01`, `D-180-01` and `D-WAVE-02` all reach this task, so the shape is not `D-120-nn`. */
  const rulings = [...new Set(section.match(/D-[A-Z0-9]+-\d+[a-z]?/g) ?? [])];

  const { forms, forbidden, bodies } = ruledFormsIn(section, signatures.map((s) => s.name));
  const errorClasses = [...new Set(section.match(/\b[A-Z]\w*Error\b/g) ?? [])].sort();

  const pin = createHash("sha256")
    .update(
      JSON.stringify({
        signatures: signatures.map((s) => s.text),
        interfaces: interfaces.map((i) => [i.name, [...i.fields]]),
        declarations: declarations.map((d) => `${d.kind} ${d.name}`),
        criteria,
        rulings,
        forms: forms.map((f) => `${f.className ?? "?"} ${f.message}`),
        forbidden: forbidden.map((f) => f.message),
        bodies,
        errorClasses,
      }),
    )
    .digest("hex");

  cached = {
    signatures, interfaces, declarations, criteria, rulings, forms, forbidden, bodies, errorClasses, pin,
  };
  return cached;
}

/**
 * Every refusal sentence the section carries, wherever it writes them, split into the
 * (verb, body) pairs the document ENUMERATES and the set of bodies it publishes.
 *
 * **The verbs come from the SIGNATURE PARSE, not from a list here.** A verb list typed in
 * this file is a second transcription of the block and would go stale in the one direction
 * that matters: a fifth published function raising a sixth refusal would be invisible to a
 * reader that only knows four names.
 *
 * **`<operation>` is a verb slot, and it is NOT expanded across the verbs. F-120-Q.**
 * D-120-03 wrote three sentences with the verb as the placeholder `` `<operation>` `` and
 * D-120-15 then resolved them per verb — but the D-120-03 prose stays in the section, so
 * both spellings are readable at once. The first version of this reader expanded every
 * placeholder to all four verbs and produced **17 forms where the contract publishes 11**,
 * manufacturing `deleteAccount: only the owner may transfer a bundle.` and nine more
 * sentences no implementation will ever raise. A cell quantifying over that set would have
 * reddened a correct module ten times — the survivor-pattern failure, where keeping one
 * word of the document's own phrasing turns a premise into a false charge.
 *
 * So a placeholder contributes its BODY and never a verb. The bodies are what the refusal
 * cells assert against: a message is admissible when it reads `<callingVerb>: <a published
 * body>`. That pins the two things the contract actually decides — the sentence, and that
 * the verb naming itself is the verb that raised it — without asserting a (verb, body)
 * pairing the document may simply not have enumerated. D-120-12's K rules that
 * `planDeletion` authorizes, and the seven forms give `planDeletion` no
 * *not this account's owner* sentence of its own; under body matching that refusal is
 * admissible, and under pair matching it would have been a defect report against a module
 * following the ruling.
 *
 * **Delimiter-agnostic on purpose.** §T120's transfer form carries backticks of its own —
 * `` "transferBundle: `<handle>` already has a bundle at `<slug>`." `` — so a body pattern
 * of `` [^`]* `` stops inside `<handle>` and returns a truncated sentence that no
 * implementation will ever produce. T180's first walker did exactly that and dropped a form
 * that was ALREADY RULED while acquiring two new ones. The match runs from the verb to the
 * first `.` followed by a closing delimiter or end of line, and never names a delimiter.
 */
function ruledFormsIn(
  section: string,
  verbs: readonly string[],
): { forms: RuledForm[]; forbidden: RuledForm[]; bodies: string[] } {
  if (verbs.length === 0) return { forms: [], forbidden: [], bodies: [] };
  const escaped = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alternation = [...verbs.map(escaped), escaped(OPERATION_SLOT)].join("|");
  const pattern = new RegExp(String.raw`(${alternation}): (.*?\.)(?=["\`']|\s*$)`, "gm");

  const forms = new Map<string, RuledForm>();
  const forbidden = new Map<string, RuledForm>();
  const bodies = new Set<string>();
  for (const line of section.split("\n")) {
    for (const match of line.matchAll(pattern)) {
      const [whole, verb, body] = match;
      bodies.add(body);
      if (verb === OPERATION_SLOT) continue;
      /* The window is the CLAUSE, not the line, and that grain was bought the hard way: the
         correction adding the twelfth pair was appended to D-120-20's OWN line, so a
         line-level classifier read *the adversary measured that `planDeletion` raises …* as
         FORBIDDEN, because *never the cross-product* and *MODULE defect* sit on that same
         line. A sentence forbidding an example and a sentence publishing a form now coexist
         in one paragraph, and only proximity separates them. */
      const clause = line.slice(Math.max(0, (match.index ?? 0) - NEGATIVE_WINDOW), match.index ?? 0);
      if (NEGATIVE_CONTEXT.test(clause)) {
        if (!forbidden.has(whole)) forbidden.set(whole, { verb, body, message: whole });
        continue;
      }
      if (forms.has(whole)) continue;
      /* The class, when the document writes one on the same line — §T120's block puts
         `TransferRefusedError` two spaces to the left of the sentence. A form with no class
         named anywhere is carried WITHOUT one rather than dropped: a sentence nobody
         attributed is still a sentence the module must produce. */
      const before = line.slice(0, match.index ?? 0);
      const className = [...before.matchAll(/\b([A-Z]\w*Error)\b/g)].at(-1)?.[1];
      forms.set(whole, { verb, body, message: whole, ...(className === undefined ? {} : { className }) });
    }
  }
  return {
    forms: [...forms.values()].sort((a, b) => a.message.localeCompare(b.message)),
    forbidden: [...forbidden.values()].sort((a, b) => a.message.localeCompare(b.message)),
    bodies: [...bodies].sort(),
  };
}

/**
 * A line that QUOTES a refusal in order to forbid it, rather than to publish it.
 *
 * **D-120-20 closed this suite's declared E1 gap and poisoned its reader in the same
 * sentence, which is worth stating plainly because the mechanism generalises.** The ruling
 * writes *"A body paired with the wrong verb (`deleteAccount: only the owner may transfer a
 * bundle.`) is a MODULE defect, not an admissible variant"* — so the exact string the
 * ruling forbids sits in the section this reader scans, in the same shape as every
 * published form. The count went from 11 to 12 and `isAdmissible` began ACCEPTING the one
 * pairing the contract had just outlawed.
 *
 * A reader keyed to the delimiter cannot see the difference; only the surrounding prose
 * carries it. So the sentence's CONTEXT decides, and a match on a forbidding line is kept
 * as `forbidden` rather than dropped — which turns the hazard into coverage, because
 * `isAdmissible` can then be asserted FALSE for exactly the pairings the document names.
 * D-180-06's lesson is why the scan is not narrowed back to the block instead: a reader
 * that only sees one region cannot see a ruling written anywhere else.
 */
const NEGATIVE_CONTEXT = /wrong verb|not an admissible|never the cross-product|is a MODULE defect/i;

/**
 * How far back a prohibition reaches.
 *
 * The forbidden example sits inside the parenthesis that names it — *"A body paired with the
 * wrong verb (`deleteAccount: …`)"* — about twenty-five characters. Sixty is comfortably past
 * that and comfortably short of the next clause. A window the width of a LINE reads a
 * CORRECTION as a prohibition, which is exactly what happened and what this constant exists
 * to stop.
 */
const NEGATIVE_WINDOW = 60;

/**
 * Whether `message` is a refusal the contract admits from `verb`.
 *
 * **PAIR matching, ruled by D-120-20**: the admissible set is the eleven (verb, body) pairs
 * the section enumerates — each ruled body prefixed by exactly the verbs whose arms the
 * rulings send down it, never the cross-product. A body paired with the wrong verb is a
 * MODULE defect.
 *
 * This started as BODY matching, deliberately and for a stated reason: D-120-12's K rules
 * that `planDeletion` authorizes, and no `planDeletion: not this account's owner.` was
 * enumerated, so pair matching would have false-charged a module following the ruling. That
 * risk was declared as E1 in the pre-registration and D-120-20 answered it by ruling the
 * pairing question rather than by leaving it to a reader's discretion. The looser form is
 * GONE rather than kept beside this one: once the merged run MEASURED that `planDeletion`
 * really does raise that sentence, D-120-20 was corrected to TWELVE pairs and the cell that
 * needed the looseness now pins the exact form. A spare, weaker matcher left in a helper is
 * a thing the next author reaches for.
 *
 * The placeholders inside a body — `` `<handle>` ``, `` `<bundleId>` ``, `` `<slug>` ``,
 * `` `<accountId>` `` — are the caller's own submissions, so each is widened to a
 * backtick-bounded run and everything else is matched literally.
 */
export function isAdmissible(verb: string, message: unknown): boolean {
  if (typeof message !== "string") return false;
  if (publishedBlock().forbidden.some((f) => bodyPattern(f.verb, f.body).test(message))) {
    return false;
  }
  return publishedBlock()
    .forms.filter((form) => form.verb === verb)
    .some((form) => bodyPattern(verb, form.body).test(message));
}

/**
 * The regex one published body becomes, placeholders widened and nothing else.
 *
 * **A placeholder is widened to `` `[^`]*` ``, backticks included, and NOT to `.+?`.** The
 * document writes every substitution backtick-quoted — `` `<handle>` ``, `` `<bundleId>` ``,
 * `` `<slug>` ``, `` `<accountId>` `` — so the backticks are a content boundary the sentence
 * itself supplies. The first version widened to `.+?` between the backticks, which admitted
 * `` transferBundle: no bundle at `abc`. Retry. `` : the lazy wildcard simply swallowed
 * `` `abc`. Retry `` and let the trailing period close the pattern. **This suite's own floor
 * cell is what caught that**, and it is the shape the run charges as an assertion that
 * admits the output its comment names — an admissible-message reader that accepts a message
 * with a sentence appended is a reader that cannot see a reworded refusal at all.
 */
export function bodyPattern(verb: string, body: string): RegExp {
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const widened = body
    .split(/`<\w+>`/)
    .map(literal)
    .join("`[^`]*`");
  return new RegExp(`^${literal(`${verb}: `)}${widened}$`);
}

/** Every refusal form the section rules for one verb. Empty is an answer, and a loud one. */
export function formsFor(verb: string): readonly RuledForm[] {
  return publishedBlock().forms.filter((f) => f.verb === verb);
}

/** The one signature by name, or a broken-test throw naming what the block does carry. */
export function signature(name: string): PublishedSignature {
  const found = publishedBlock().signatures.find((s) => s.name === name);
  if (found === undefined) {
    throw new Error(
      `backend.md §${SECTION_HEADING}'s published block declares no \`${name}(...)\`. It ` +
        `declares: ${publishedBlock().signatures.map((s) => s.name).join(", ") || "(nothing)"}.`,
    );
  }
  return found;
}

/** The one interface by name, same contract as `signature`. */
export function published(name: string): PublishedInterface {
  const found = publishedBlock().interfaces.find((i) => i.name === name);
  if (found === undefined) {
    throw new Error(
      `backend.md §${SECTION_HEADING}'s published block declares no \`interface ${name}\`. It ` +
        `declares: ${publishedBlock().interfaces.map((i) => i.name).join(", ") || "(nothing)"}.`,
    );
  }
  return found;
}

/** `field` -> `type`, for a key-set or a field-type assertion over a published interface. */
export function fieldMap(name: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const field of published(name).fields) {
    const at = field.indexOf(":");
    if (at === -1) continue;
    out.set(field.slice(0, at).trim().replace(/\?$/, ""), field.slice(at + 1).trim());
  }
  return out;
}

/** The published key set of an interface, in document order, `?` stripped. */
export function keysOf(name: string): readonly string[] {
  return [...fieldMap(name).keys()];
}

/* ============================================================
   setup that reds per cell instead of skipping
   ============================================================ */

/**
 * A throw in `beforeAll` produces SKIPS, not reds: the run stands down rather than failing,
 * and a skipped criterion is invisible in the totals — measured at 127 merged cells going
 * silent under one broken writer. Per-criterion reds belong in the cells.
 *
 * This suite's own copy rather than an import from another task's `contract.ts`: the
 * partition is `tests/server/t120/**` and a helper another task can edit is a helper that
 * can change what this suite means without anyone touching it.
 */
export class RecordedSetup<T> {
  private value: T | undefined;
  private failure: unknown;
  private ran = false;

  constructor(private readonly what: string) {}

  async run(make: () => Promise<T>): Promise<void> {
    this.ran = true;
    try {
      this.value = await make();
    } catch (cause) {
      this.failure = cause;
    }
  }

  /** The set-up value, or a red carrying the setup failure. Call this FIRST in every cell. */
  require(): T {
    if (this.failure !== undefined) {
      throw new Error(
        `${this.what} could not be set up, so this criterion was NEVER EXERCISED.\n` +
          `  Re-raised per cell on purpose: a throw in \`beforeAll\` skips, and a skipped ` +
          `criterion is invisible in the totals.\n` +
          `  Cause: ${this.failure instanceof Error ? this.failure.stack : String(this.failure)}`,
      );
    }
    if (!this.ran || this.value === undefined) {
      throw new Error(`${this.what} was never set up: the \`beforeAll\` did not run.`);
    }
    return this.value;
  }

  /** For teardown, which must not itself throw when setup never produced anything. */
  optional(): T | undefined {
    return this.failure === undefined ? this.value : undefined;
  }
}

/* ============================================================
   the amendments the RULINGS made and the BLOCK has not

   F-120-P. D-120-08 ends "The block is amended" and it is not:
   §T120's `interface DeletionPlan` still reads `handle: string`
   and still carries `publishedRetained`, against two rulings in
   the same section that say `string | null` and that the field
   is SPLIT into `publishedBundles` and `publishedCards`. This is
   D-180-06's shape one wave later — a ruling that never reached
   the published block is a ruling the blind half cannot bind to.

   Binding to the block would red a correct module on three
   fields. Binding to a key set typed here would be a
   transcription one level up, which is the thing the parse
   exists to avoid. So the block is parsed and then AMENDED
   MECHANICALLY, each amendment carrying the ruling id that
   authorises it — and two things keep that honest:

     • `assertAmendmentsCited()` reds if an amendment cites a
       ruling the section no longer contains, so an amendment
       cannot outlive its warrant;
     • `pendingAmendments()` is asserted EMPTY by a surface cell,
       so the day the block catches up the workaround reds and
       gets deleted rather than quietly staying forever.

   The second one is the part that is easy to leave out. A
   workaround with no expiry is a second contract.
   ============================================================ */

export interface Amendment {
  /** The interface the ruling amends. */
  interfaceName: string;
  /** The ruling that authorises it, checked against the section's own citations. */
  ruling: string;
  /** Human-readable, for a failure message that does not make the reader go looking. */
  what: string;
  /** The block's key set, in, the ruled key set, out. */
  apply(keys: readonly string[]): readonly string[];
  /** Whether the block still needs this amendment. False once the document catches up. */
  pending(keys: readonly string[]): boolean;
}

export const AMENDMENTS: readonly Amendment[] = [
  {
    interfaceName: "DeletionPlan",
    ruling: "D-120-09",
    what: "`publishedRetained` IS SPLIT INTO `publishedBundles` AND `publishedCards`",
    apply: (keys) =>
      keys.flatMap((k) => (k === "publishedRetained" ? ["publishedBundles", "publishedCards"] : [k])),
    pending: (keys) => keys.includes("publishedRetained"),
  },
];

/** Every amendment still needed, i.e. every place the block has not caught up. */
export function pendingAmendments(): readonly Amendment[] {
  return AMENDMENTS.filter((a) => a.pending(keysOf(a.interfaceName)));
}

/**
 * A ruled amendment whose ruling the section no longer cites is an amendment with no
 * warrant, and it would go on rewriting the block after the decision behind it was
 * withdrawn. Called by every cell that consumes `ruledKeysOf`.
 */
export function assertAmendmentsCited(): void {
  const cited = new Set(publishedBlock().rulings);
  const orphaned = AMENDMENTS.filter((a) => !cited.has(a.ruling));
  if (orphaned.length > 0) {
    throw new Error(
      `tests/server/t120/contract.ts amends the published block on the authority of ` +
        `${orphaned.map((a) => a.ruling).join(", ")}, and backend.md §${SECTION_HEADING} no ` +
        `longer cites ${orphaned.length === 1 ? "it" : "them"}.\n` +
        `  This is a BROKEN TEST, not a failed criterion: an amendment outlived its ruling. ` +
        `Either the ruling moved and the citation here must follow it, or it was withdrawn ` +
        `and the amendment must be deleted.`,
    );
  }
}

/**
 * The key set of a published interface as the RULINGS leave it — the block's parse with
 * every still-pending amendment applied.
 *
 * `handle: string | null` (D-120-08) is deliberately NOT an amendment here: it changes a
 * field's TYPE and not the key set, so it belongs in the cell that reads the value rather
 * than in a key-set rewrite, and a cell asserting `null` is admissible carries its own
 * citation.
 */
export function ruledKeysOf(interfaceName: string): readonly string[] {
  assertAmendmentsCited();
  let keys = keysOf(interfaceName);
  for (const amendment of AMENDMENTS) {
    if (amendment.interfaceName !== interfaceName) continue;
    if (!amendment.pending(keys)) continue;
    keys = amendment.apply(keys);
  }
  return keys;
}
