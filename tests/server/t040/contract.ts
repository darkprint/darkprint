/* ============================================================
   T040 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this module is imported by the suites beside it.

   ── what this suite may and may not read ──
   `lib/core/**` is base. It is the engine T040 *wraps*, it is
   Forbidden to T040 as a write and explicitly consumed by it, and
   this suite reads it freely — for the `Diagnostic` type, for
   `sortDiagnostics`, and for the archive fixtures. Nothing under
   `lib/server/engine/**` or `app/api/validate/**` is read here or
   anywhere in this directory.

   One base module is imported as an ORACLE rather than as
   convenience: `lib/content/ontology-file.ts`, the repository's
   single reader of a vocabulary document, whose own header says why
   there is only one ("a second reader would be a second opinion
   about what a term is"). It builds the `extensions` array AC1
   hands in.

   `components/upload/progress.ts` is deliberately NOT imported. An
   earlier draft used it as the oracle for the three verdicts;
   D-40-01(a) rules it Forbidden to T040 and carried by no return
   type, so binding assertions to it would make a red ambiguous
   between "T040 is wrong" and "that module changed".

   ── the load is LAZY and per test ──
   `@/lib/server/engine` does not exist in this worktree. A static
   import makes the file fail to COLLECT, which prints file-level
   FAIL lines carrying no test path, skips every test underneath a
   hook, and is invisible to a set-difference instrument that keys
   on `" > "`. Both failures are recorded on `backend`. So the
   barrel is imported inside each test through `loadEngine()`, and
   an absent module reads as N failed acceptance criteria rather
   than as one broken file.

   ── every expected string here is a LITERAL ──
   Nothing below is imported from `@/lib/server/engine`. An
   expectation built from the module under test asserts "does the
   module agree with itself", and passes unchanged the day the
   template starts interpolating something it should not. A later
   change that derives one of these from the module is a REMOVED
   ASSERTION and is to be treated as one.
   ============================================================ */

import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getRouteMatcher } from "next/dist/shared/lib/router/utils/route-matcher.js";
import { getRouteRegex } from "next/dist/shared/lib/router/utils/route-regex.js";

import { sortDiagnostics, type Diagnostic, type Severity } from "@/lib/core";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const ENGINE = "@/lib/server/engine";

let engine: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, and every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadEngine(): Promise<Namespace> {
  engine ??= import("@/lib/server/engine").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${ENGINE} does not load.\n` +
          `  backend.md §T040 owns \`lib/server/engine/**\` and publishes \`validateBundle\`, ` +
          `\`validateDot\`, \`validateCardSource\` and \`validateVocabularySource\` from the ` +
          `barrel \`@/lib/server/engine\`.\n` +
          `  This is a failed acceptance criterion — the engine service is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return engine;
}

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of backend.md §T040 at `42b7470`, quoted so a red says where
 * the name comes from.
 *
 * Three amendments landed in prose before they landed here — `extensions`/`ontology?`, AC5's
 * ordering, and the sibling return shapes — with the superseded sentences left standing in the
 * block beside them. They were reported and the block now carries all three; these strings are
 * the block's own text, not the prose's.
 */
export const PUBLISHED = {
  validateBundle:
    "validateBundle(input: { manifest: BundleManifest; dot: string; cardFiles: Record<string, string>; extensions?: readonly OntologyTerm[]; ontology?: OntologyView }, limits?: EngineLimits): LoadBundleResult",
  validateDot:
    "validateDot(dot: string, limits?: EngineLimits): { graph?: DotGraph; diagnostics: Diagnostic[] }",
  validateCardSource:
    "validateCardSource(yaml: string, limits?: EngineLimits): { card?: NodeCard; diagnostics: Diagnostic[] }",
  validateVocabularySource:
    "validateVocabularySource(yaml: string, limits?: EngineLimits): { terms?: readonly OntologyTerm[]; diagnostics: Diagnostic[] }",
} as const;

export type PublishedName = keyof typeof PUBLISHED;
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * The one class the contract says this module throws.
 *
 * D-40-06 moved it into the published surface, which is what makes IDENTITY testable rather
 * than only arrival: removal changes whether the caller gets an error, substitution changes
 * which one, and only the second says this class is distinguishable from a bare
 * `new Error(msg)` carrying the same words.
 *
 * D-40-15 published the constructor and made the two fields non-enumerable. Both halves came
 * out of reading `tests/error-hygiene.test.ts` rather than predicting it: that guard builds its
 * domain by construction over every directory under `lib/server`, so `lib/server/engine` joins
 * it the day the barrel merges; a plain `this.limit =` renders as `{"limit":…,"units":…}`
 * against a clause requiring `{}` (B-21 verbatim); and it CONSTRUCTS every class itself with
 * one and two arguments, treating an unconstructible one as a hard error rather than a skip —
 * so a four-parameter constructor with no defaults fails it with "hygiene is unmeasured".
 */
export const PUBLISHED_LIMIT_ERROR =
  "new LimitExceededError(operation: string, what: string, limit: number, units: string)   " +
  "// fields non-enumerable, every parameter optional at runtime (D-40-15)";

/**
 * D-40-22, the name D-40-20 left owed.
 *
 * `seen` is the right instrument for a cycle and the wrong one for the size, so the bounded walk
 * that measures a submission meets a cycle and must refuse it as a TYPE rather than let
 * `JSON.stringify` raise `TypeError: Converting circular structure to JSON`. A `TypeError` reaching
 * a caller is untyped, unbranchable, and — as the adversary recorded — invisible to
 * `tests/error-hygiene.test.ts`, whose domain is classes a barrel exports.
 */
export const PUBLISHED_CIRCULAR_ERROR =
  "class CircularReferenceError extends Error   " +
  '// "<operation>: the submission contains a circular reference."';

/** Written out as a LITERAL, never built from anything the module exports. */
export function circularMessage(operation: string): string {
  return `${operation}: the submission contains a circular reference.`;
}

/**
 * D-40-D's ceiling, published at last in both binding surfaces after standing in neither.
 *
 * A NEW REFUSAL CRITERION rather than an implementation detail: a submission the ruled formula
 * accepts is refused past 10 000 levels. Admissible because the recursive alternative refused it
 * either — it threw a bare `RangeError` at a host-dependent depth — so every input that produced
 * a number still produces one, and the inputs that produced nothing now produce a typed refusal.
 */
export const PUBLISHED_MAX_NESTING_DEPTH =
  "const MAX_NESTING_DEPTH = 10_000   // D-40-D, exported from @/lib/server/engine";

/**
 * The nesting refusal's message, written out as a LITERAL.
 *
 * This is also what pins the CONSTANT's value without importing it: the number is in the
 * sentence. A boundary test that read `MAX_NESTING_DEPTH` and bounded against it would move with
 * the constant and stop being a bound — D-70-17's note about `MAX_NAME_LENGTH` — so the two jobs
 * are split: the literal below pins the value, and `measure.test.ts` brackets the behaviour.
 */
export const NESTING_MESSAGE =
  "validateBundle: the nesting depth exceeds the limit of 10000 levels.";

export async function bindMaxNestingDepth(): Promise<unknown> {
  const mod = await loadEngine();
  return requireFrom(mod, "MAX_NESTING_DEPTH", PUBLISHED_MAX_NESTING_DEPTH);
}

/** D-40-07: absent `limits` means the DEFAULT applies, not unlimited, and the default is published. */
export const PUBLISHED_DEFAULT_LIMITS =
  "const DEFAULT_ENGINE_LIMITS: EngineLimits   // chosen so all nine archive bundles pass";

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${ENGINE} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. Do not add a synonym ` +
      `here; publish the name the contract states.`,
  );
}

function asFn(value: unknown, name: string, clause: string): UnknownFn {
  if (typeof value !== "function") {
    throw new Error(
      `${ENGINE} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/** The four published functions. `EngineLimits` is an interface and has no runtime binding. */
export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadEngine();
  return asFn(requireFrom(mod, name, PUBLISHED[name]), name, PUBLISHED[name]);
}

/** The error class, as a constructor. Used for `instanceof`, which is the identity question. */
export async function bindLimitError(): Promise<new (...args: never[]) => Error> {
  const mod = await loadEngine();
  const value = requireFrom(mod, "LimitExceededError", PUBLISHED_LIMIT_ERROR);
  if (typeof value !== "function") {
    throw new Error(
      `${ENGINE} exports \`LimitExceededError\` as ${describe_(value)}; the contract publishes ` +
        `it as a class: ${PUBLISHED_LIMIT_ERROR}`,
    );
  }
  const proto = (value as { prototype?: unknown }).prototype;
  if (!(proto instanceof Error)) {
    throw new Error(
      `${ENGINE}'s \`LimitExceededError.prototype\` is not an Error. The published form is a ` +
        `throw, and a caller that cannot \`instanceof\` it cannot tell this refusal from any ` +
        `other. Removal changes WHETHER the caller gets an error; only identity says WHICH.`,
    );
  }
  return value as new (...args: never[]) => Error;
}

export async function bindCircularError(): Promise<new (...args: never[]) => Error> {
  const mod = await loadEngine();
  const value = requireFrom(mod, "CircularReferenceError", PUBLISHED_CIRCULAR_ERROR);
  if (typeof value !== "function") {
    throw new Error(
      `${ENGINE} exports \`CircularReferenceError\` as ${describe_(value)}; D-40-22 publishes it ` +
        `as a class: ${PUBLISHED_CIRCULAR_ERROR}`,
    );
  }
  const proto = (value as { prototype?: unknown }).prototype;
  if (!(proto instanceof Error)) {
    throw new Error(
      `${ENGINE}'s \`CircularReferenceError.prototype\` is not an Error. D-40-20 ruled the cycle ` +
        `refusal TYPED; a caller that cannot \`instanceof\` it cannot tell a cycle from a limit.`,
    );
  }
  return value as new (...args: never[]) => Error;
}

/**
 * `DEFAULT_ENGINE_LIMITS`, read as a value.
 *
 * Bound to be COMPARED against the archive's measured maxima, never used as a bound in an
 * assertion. A test that takes its expected value from the constant it is checking moves
 * with the constant and stops being a bound — D-70-17's note about `MAX_NAME_LENGTH`, and
 * T230 is going to move one of these numbers.
 */
export async function bindDefaultLimits(): Promise<{
  maxBytes: number;
  maxCards: number;
  maxNodes: number;
}> {
  const mod = await loadEngine();
  const value = requireFrom(mod, "DEFAULT_ENGINE_LIMITS", PUBLISHED_DEFAULT_LIMITS);
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${ENGINE} exports \`DEFAULT_ENGINE_LIMITS\` as ${describe_(value)}; the contract ` +
        `publishes it as an \`EngineLimits\`.`,
    );
  }
  const limits = value as Record<string, unknown>;
  for (const key of ["maxBytes", "maxCards", "maxNodes"]) {
    if (typeof limits[key] !== "number" || !Number.isFinite(limits[key] as number)) {
      throw new Error(
        `${ENGINE}'s \`DEFAULT_ENGINE_LIMITS.${key}\` is ${JSON.stringify(limits[key])}; ` +
          `\`EngineLimits\` declares three finite numbers.`,
      );
    }
  }
  return limits as unknown as { maxBytes: number; maxCards: number; maxNodes: number };
}

/* --------------------- the shape the contract publishes back --------------------- */

export const SEVERITIES: readonly Severity[] = ["error", "warning", "info"];

/**
 * One `Diagnostic`, checked against `lib/core/diagnostics.ts`'s declaration rather than
 * against a hope.
 *
 * `severity` is pinned to the three-member union because a caller branches on it — a fourth
 * value, or a `severity` that arrives `undefined`, makes `hasErrors` answer "no errors" for a
 * bundle full of them, which is silent-success and the failure this codebase is built against.
 */
export function asDiagnostic(value: unknown, where: string): Diagnostic {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} produced ${describe_(value)} where a Diagnostic is declared.`);
  }
  const d = value as Partial<Diagnostic>;
  if (typeof d.code !== "string" || (d.code as string) === "") {
    throw new Error(`${where} produced a Diagnostic with \`code\` = ${JSON.stringify(d.code)}.`);
  }
  if (typeof d.severity !== "string" || !SEVERITIES.includes(d.severity)) {
    throw new Error(
      `${where} produced \`${d.code}\` with \`severity\` = ${JSON.stringify(d.severity)}; ` +
        `\`Severity\` is exactly ${SEVERITIES.map((s) => JSON.stringify(s)).join(" | ")}.`,
    );
  }
  if (typeof d.message !== "string" || d.message.trim() === "") {
    throw new Error(
      `${where} produced \`${d.code}\` with an empty \`message\`. A diagnostic nobody can read ` +
        `is silence with a code attached.`,
    );
  }
  if (d.location !== undefined && (d.location === null || typeof d.location !== "object")) {
    throw new Error(
      `${where} produced \`${d.code}\` with \`location\` = ${describe_(d.location)}; ` +
        `\`DiagnosticLocation\` is an object or absent.`,
    );
  }
  return d as Diagnostic;
}

export function asDiagnostics(value: unknown, where: string): Diagnostic[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${where} returned ${describe_(value)}; the contract publishes \`Diagnostic[]\`.`,
    );
  }
  return value.map((d, i) => asDiagnostic(d, `${where}[${i}]`));
}

/* --------------------- the three siblings --------------------- */

/**
 * **A fork, reported and not resolved.** The signature block reads
 * `validateDot(dot, limits?): Diagnostic[]`; the ruling under it says *"the siblings return a
 * value beside their diagnostics, mirroring `lib/core`'s own `CardValidation`"* and publishes
 * routes answering `{ graph?, diagnostics }`, `{ card?, diagnostics }`, `{ terms?, diagnostics }`.
 *
 * Reading taken, stated so a red is attributable: **the module functions return the pair.**
 * `CardValidation` is a function return type, and it is the only reading under which
 * `validateDot` being `parseDot + lintAttractor` has anywhere to put the graph — the other
 * leaves the route parsing the same bytes a second time with a second reader, which is what
 * `lib/content/ontology-file.ts`'s own header exists to prevent.
 *
 * If it is ruled the other way, this one function moves and the tests above it do not.
 */
export const SIBLING_SHAPE = "{ <value>?: T; diagnostics: Diagnostic[] }";

export function siblingDiagnostics(
  value: unknown,
  valueKey: "graph" | "card" | "terms",
  where: string,
): { diagnostics: Diagnostic[]; value: unknown; hasValue: boolean } {
  if (Array.isArray(value)) {
    throw new Error(
      `${where} returned a bare \`Diagnostic[]\`.\n` +
        `  The signature block still reads \`Diagnostic[]\` and the ruling under it publishes ` +
        `${SIBLING_SHAPE} — the two disagree, which is reported as an open fork.\n` +
        `  This suite binds the ruling: the sibling returns \`{ ${valueKey}?, diagnostics }\`. ` +
        `If the block is the authority, this line is the suite's defect and not the module's.`,
    );
  }
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} returned ${describe_(value)}; expected ${SIBLING_SHAPE}.`);
  }
  const r = value as Record<string, unknown>;
  const diagnostics = asDiagnostics(r.diagnostics, `${where}.diagnostics`);

  if (Object.prototype.hasOwnProperty.call(r, valueKey) && r[valueKey] === undefined) {
    throw new Error(
      `${where} carries \`${valueKey}\` as an own property whose value is \`undefined\`. The ` +
        `published shape is \`{ ${valueKey}?, diagnostics }\`, and an absent optional is an ` +
        `omitted key — the convention \`lib/core/diagnostics.ts\` states for exactly this reason. ` +
        `\`JSON.stringify\` drops it, so no route test could ever see this one.`,
    );
  }
  const extra = Object.keys(r).filter((k) => k !== "diagnostics" && k !== valueKey);
  if (extra.length > 0) {
    throw new Error(
      `${where} returned ${extra.map((k) => `\`${k}\``).join(", ")} beside \`${valueKey}\` and ` +
        `\`diagnostics\`. The published shape has two members.`,
    );
  }
  return { diagnostics, value: r[valueKey], hasValue: r[valueKey] !== undefined };
}

/**
 * `LoadBundleResult` — `{ blueprint?, analysis?, diagnostics: Diagnostic[] }`.
 *
 * Two properties are checked beyond the field types, and both are `lib/core`'s own
 * declarations rather than mine:
 *
 *   * **`analysis` is absent exactly when `blueprint` is.** `analysis/analyze.ts` says so in
 *     as many words. A result carrying one and not the other is a shape no caller branches
 *     correctly on, and `components/upload/progress.ts` reads both.
 *   * **there is no fourth member.** The published return type has three, and an extra field
 *     is a second declaration of one shape by another route, which is what D-70-10 was
 *     charged for.
 */
export interface LoadBundleResultShape {
  blueprint?: {
    digest: string;
    manifest: Record<string, unknown>;
    nodes: readonly { nodeId: string }[];
    graph: { ids: readonly string[]; predecessors(id: string): readonly string[] };
  };
  analysis?: {
    autonomy: { autonomyClass: string; contributions: readonly { resolved: boolean }[] };
    security: { level: number; rationale: string };
    ontologyVersion: string;
  };
  diagnostics: Diagnostic[];
}

const RESULT_KEYS = ["blueprint", "analysis", "diagnostics"];

export function asLoadBundleResult(value: unknown, where: string): LoadBundleResultShape {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${where} returned ${describe_(value)}; the contract publishes \`LoadBundleResult\`, ` +
        `i.e. { blueprint?, analysis?, diagnostics: Diagnostic[] }.`,
    );
  }
  const r = value as Record<string, unknown>;
  asDiagnostics(r.diagnostics, `${where}.diagnostics`);

  /* **An absent optional is an ABSENT KEY, not a key set to `undefined`.**
     `lib/core/diagnostics.ts` states the convention and the reason in its own words: "Optional
     keys are omitted rather than set to `undefined` so diagnostics compare and serialize
     identically whether or not the caller passed `opts`." The two are indistinguishable through
     `JSON.stringify`, which drops an `undefined` value — so a route payload cannot tell them
     apart and only an in-process caller can. That is precisely why a blind suite has to: AC5's
     "identical output" is read off `Object.keys` by anyone comparing two answers, and T100
     consumes this module in-process. */
  for (const key of ["blueprint", "analysis"]) {
    if (Object.prototype.hasOwnProperty.call(r, key) && r[key] === undefined) {
      throw new Error(
        `${where} carries \`${key}\` as an own property whose value is \`undefined\`. An absent ` +
          `optional is an omitted key — \`Object.keys\` and a spread both see the difference, and ` +
          `\`JSON.stringify\` does not, so nothing at the wire would ever report this.`,
      );
    }
  }
  const hasBlueprint = r.blueprint !== undefined;
  const hasAnalysis = r.analysis !== undefined;
  if (hasBlueprint !== hasAnalysis) {
    throw new Error(
      `${where} returned blueprint=${hasBlueprint} analysis=${hasAnalysis}. ` +
        `\`LoadBundleResult.analysis\` is declared "Absent exactly when \`blueprint\` is" ` +
        `(lib/core/analysis/analyze.ts). Every caller that reads one reads the other.`,
    );
  }
  const extra = Object.keys(r).filter((k) => !RESULT_KEYS.includes(k));
  if (extra.length > 0) {
    throw new Error(
      `${where} returned a LoadBundleResult carrying ${extra.map((k) => `\`${k}\``).join(", ")}. ` +
        `The published return type has three members; a fourth is a second declaration of one ` +
        `shape.`,
    );
  }
  return r as unknown as LoadBundleResultShape;
}

/* --------------------- ordering --------------------- */

/**
 * AC5's ordering half, and D-40-03 is the reason it is written as a comparison against
 * `lib/core` rather than as a comparator of my own.
 *
 * The published block says "ordered by (source, line, column, code)". `lib/core`'s
 * `sortDiagnostics` orders by **(severity, file, line, column, code)** — severity first — and
 * `loadBundle` already returns every array through it. There is no field called `source`.
 * The two orders differ whenever an error and a warning share a file, which the truncated
 * archive fixture in `fixtures.ts` exhibits: 7 errors and 3 warnings in one array.
 *
 * **Reading taken, reported before it was asserted:** defer to `sortDiagnostics`. The Goal
 * says this module returns "the same diagnostics and readings the browser already produces",
 * and a T040-local comparator reimplements ordering that `lib/core` owns in a module whose
 * only import is `@/lib/core`. If the orchestrator rules the other way, this function is my
 * defect and not the implementer's.
 *
 * What it catches either way: an implementation that returns its own merge order unsorted.
 * What it cannot catch: an insertion-order defect upstream of a re-sort, because a re-sort
 * erases it. `determinism.test.ts` carries that half and says so there too.
 */
export function expectSortedLikeCore(diagnostics: Diagnostic[], where: string): void {
  const sorted = sortDiagnostics(diagnostics);
  if (JSON.stringify(sorted) !== JSON.stringify(diagnostics)) {
    throw new Error(
      `${where} returned diagnostics out of \`sortDiagnostics\` order.\n` +
        `  AC5: "identical bytes return identical output including diagnostic order", and the ` +
        `published block requires an explicit sort before return.\n` +
        `  returned: ${diagnostics.map((d) => `${d.severity}/${d.code}@${d.location?.file ?? "-"}:${d.location?.line ?? "-"}`).join(", ")}\n` +
        `  sorted:   ${sorted.map((d) => `${d.severity}/${d.code}@${d.location?.file ?? "-"}:${d.location?.line ?? "-"}`).join(", ")}`,
    );
  }
}

/* --------------------- the refusal --------------------- */

/**
 * D-40-05 filled the template, so these are the exact pins the enforcement rule asks for:
 * written out here as LITERALS, never built from anything the module exports.
 *
 *     "validateBundle: the submission exceeds the limit of <n> bytes."
 *     "validateBundle: the card count exceeds the limit of <n> cards."
 *     "validateBundle: the node count exceeds the limit of <n> nodes."
 *
 * A test that reconstructed one of these from an exported template would assert "does the
 * module agree with itself" and pass unchanged the day the template starts interpolating the
 * submission. The exposure comes later, when somebody looking at a failing exact-match test
 * finds that importing the constant makes it agree — which reads as removing duplication and
 * is a removed assertion.
 *
 * Only `validateBundle`'s three are published. The siblings take `limits` too and their
 * wording is unstated; `limits.test.ts` says so where it falls back to the form.
 */
export const LIMIT_MESSAGES = {
  bytes: (n: number, operation: string) =>
    `${operation}: the submission exceeds the limit of ${n} bytes.`,
  cards: (n: number) => `validateBundle: the card count exceeds the limit of ${n} cards.`,
  nodes: (n: number) => `validateBundle: the node count exceeds the limit of ${n} nodes.`,
} as const;

export type LimitUnits = keyof typeof LIMIT_MESSAGES;

/**
 * A string planted in the submission that cannot appear in any admissible message.
 *
 * Fixed rather than minted per run. T-04's finding is that a tell which *can* appear inside
 * admissible content reds like a real leak, and the three forms above admit only the words
 * `validateBundle`, `the submission`/`the card count`/`the node count`, a numeral and a unit
 * — none of which this string can be a substring of. A fixed value also keeps this suite's
 * own output deterministic, which is the property AC5 is about.
 */
export const LEAK_SENTINEL = "T040LEAKSENTINELdf41a2b7c9e04f16";

/** The general form, used only where the contract has published no literal. */
export const LIMIT_MESSAGE_FORM = /^[^:]+: .+ exceeds the limit of (\d+) [^.]+\.$/;

/**
 * The whole refusal, checked as one object: the class, the message, the two published fields,
 * and the hygiene clause.
 *
 * Asserted by EXACT MATCH against the admissible form rather than by scanning for what should
 * not be there. A whitelist enforced with a blacklist test *is* a blacklist, and the message
 * is small enough to pin exactly.
 */
export function expectLimitRefusal(
  err: unknown,
  expected: { limit: number; units: LimitUnits; operation?: string },
  where: string,
  ctor?: new (...args: never[]) => Error,
): void {
  if (!(err instanceof Error)) {
    throw new Error(`${where} threw ${describe_(err)}, which is not an Error.`);
  }
  if (ctor !== undefined && !(err instanceof ctor)) {
    const actual = (err as Error).constructor.name;
    throw new Error(
      `${where} threw a \`${actual}\` rather than a \`LimitExceededError\`.\n` +
        `  Removal changes WHETHER the caller gets an error; substitution changes WHICH one. ` +
        `A caller that cannot branch on the class cannot tell an over-limit submission from ` +
        `any other failure, which is the whole reason D-40-06 published it.`,
    );
  }

  const wanted =
    expected.units === "bytes"
      ? LIMIT_MESSAGES.bytes(expected.limit, expected.operation ?? "validateBundle")
      : LIMIT_MESSAGES[expected.units](expected.limit);
  if (err.message !== wanted) {
    throw new Error(
      `${where} threw the wrong message.\n` +
        `  expected: ${JSON.stringify(wanted)}\n` +
        `  actual:   ${JSON.stringify(err.message)}\n` +
        `  The published admissible forms are literals, not a template with room in it.`,
    );
  }
  if (err.message.includes(LEAK_SENTINEL)) {
    throw new Error(
      `${where} threw a message carrying content from the submission itself: ` +
        `${JSON.stringify(err.message)}`,
    );
  }

  /* The two published fields, by VALUE rather than by presence. An assertion that `limit` is
     defined passes a class that answers the wrong number — wrong but present is the mutation
     a presence check cannot see, and this pair is what a route reads to build its 413. */
  const carried = err as unknown as { limit?: unknown; units?: unknown };
  if (carried.limit !== expected.limit) {
    throw new Error(
      `${where}: \`LimitExceededError.limit\` is ${JSON.stringify(carried.limit)}, ` +
        `where the caller set ${expected.limit}.`,
    );
  }
  if (carried.units !== expected.units) {
    throw new Error(
      `${where}: \`LimitExceededError.units\` is ${JSON.stringify(carried.units)}, ` +
        `expected ${JSON.stringify(expected.units)} — the unit the message names.`,
    );
  }

  expectSealedError(err, where);
}

/**
 * The four renderings a route or a log might take, checked on the one class this module
 * throws.
 *
 * The repo-wide `tests/error-hygiene.test.ts` covers enumerability for every barrel-exported
 * error class. It cannot cover the fourth clause — `stack` is retained — because that is not
 * a property of the class's shape, and a class that deletes `stack` renders as `{}` and
 * passes all three enumerability checks. On that axis a module-local suite is the stronger
 * instrument, which is the pair recorded on `backend` at "a repo-wide check and a
 * module-local suite are blind in opposite directions".
 */
export function expectSealedError(err: unknown, where: string): void {
  if (!(err instanceof Error)) {
    throw new Error(`${where} threw ${describe_(err)}, which is not an Error.`);
  }
  const keys = Object.keys(err);
  if (keys.length > 0) {
    throw new Error(
      `${where}: \`Object.keys\` is ${JSON.stringify(keys)}; the hygiene clause requires it empty.`,
    );
  }
  const json = JSON.stringify(err);
  if (json !== "{}") {
    throw new Error(`${where}: \`JSON.stringify(err)\` is ${json}; the clause requires "{}".`);
  }
  if (typeof err.stack !== "string" || err.stack === "") {
    throw new Error(
      `${where}: \`stack\` is ${describe_(err.stack)}. The clause requires it RETAINED. ` +
        `Deleting it satisfies every enumerability check and costs every real failure its trace.`,
    );
  }

  /* **B-21, arriving one task later with two new fields.**
     `ArchiveConflictError` assigned `this.name` and `this.kind` in its constructor, rendered as
     `{"name":…,"kind":…}` against a clause requiring `{}`, and the ruling was "the clause is
     right and the class is wrong". `LimitExceededError` publishes `{ limit, units }`, and a
     plain `this.limit =` is always enumerable.

     The two assertions are separate on purpose and they are the presence-versus-value pair:
     `Object.keys` being empty above says nothing about whether the fields EXIST, and a class
     that dropped them renders as `{}` and passes every clause. So presence is checked by
     descriptor — `getOwnPropertyDescriptor` is `undefined` when no property was defined and a
     descriptor when one was, which is the only question a rendering cannot answer. */
  for (const field of ["limit", "units"]) {
    const descriptor = Object.getOwnPropertyDescriptor(err, field);
    if (descriptor === undefined) continue;
    if (descriptor.enumerable) {
      throw new Error(
        `${where}: \`${field}\` is an ENUMERABLE own property, so every rendering of this ` +
          `error carries it — a log line, a JSON body, a spread into a response.\n` +
          `  B-21 ruled this exact shape against \`ArchiveConflictError\`: the clause is right ` +
          `and the class is wrong. \`Object.defineProperty(this, "${field}", { value, ` +
          `enumerable: false })\` keeps it readable and keeps \`instanceof\`; only its ` +
          `appearance in a rendering changes, which is the entire point of the clause.\n` +
          `  \`tests/error-hygiene.test.ts\` walks every directory under \`lib/server\` by ` +
          `construction, so this reds there too the day the barrel merges.`,
      );
    }
  }
}

/* --------------------- calling something that must not throw --------------------- */

/**
 * The module-wide property, quantified over calls rather than written per case:
 * **this module returns diagnostics rather than throwing**, and the one exception is the
 * limit refusal.
 *
 * Written as a helper every content-fault test routes through, so a fifth fault path added
 * later is covered by construction instead of needing its own assertion.
 */
export function returning<T>(call: () => T, where: string): T {
  try {
    return call();
  } catch (err) {
    throw new Error(
      `${where} THREW where the contract requires it to answer.\n` +
        `  ${err instanceof Error ? err.message : describe_(err)}\n` +
        `  The published block: "This module returns diagnostics rather than throwing", and ` +
        `B-03 makes a bundle that resolves with errors an ANSWER at 200 rather than a failure. ` +
        `The one admissible throw is \`LimitExceededError\`.`,
      { cause: err },
    );
  }
}

export function codesOf(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((d) => d.code);
}

export function errorsOf(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((d) => d.severity === "error");
}

/* ============================================================
   The four published routes

       POST /api/validate/bundle    { dot, cardFiles, manifest, vocabulary?: string }
                                    -> 200 LoadBundleResult              | 400 413
       POST /api/validate/dot       { dot }     -> 200 { graph?, diagnostics }   | 400 413
       POST /api/validate/card      { source }  -> 200 { card?, diagnostics }    | 400 413
       POST /api/validate/ontology  { source }  -> 200 { terms?, diagnostics }   | 400 413

   ── discovered, never guessed ──
   The route table is built by WALKING `app/api/validate/**` and
   dispatched through Next's own matcher, so a red says "this URL is
   unserved" rather than "a file is missing from where I looked".
   The URL is the contract's; the file layout is the
   implementation's, and a route shadowed by a sibling dispatches
   here exactly as it would in production.

   It also keeps the specifier out of `tsc`: nothing in this suite
   names `@/app/api/validate/...`, so the routes' absence is a
   failed criterion at runtime rather than a compile error that
   would stop every other file being checked.
   ============================================================ */

export const ROUTES = {
  bundle: { url: "POST /api/validate/bundle", path: "/api/validate/bundle" },
  dot: { url: "POST /api/validate/dot", path: "/api/validate/dot" },
  card: { url: "POST /api/validate/card", path: "/api/validate/card" },
  ontology: { url: "POST /api/validate/ontology", path: "/api/validate/ontology" },
} as const;

export type RouteName = keyof typeof ROUTES;
export const ROUTE_NAMES = Object.keys(ROUTES) as RouteName[];

/** The one problem type the contract publishes by URI. */
export const LIMIT_PROBLEM_TYPE = "https://darkprint.io/problems/limit-exceeded";
export const PROBLEM_CONTENT_TYPE = "application/problem+json";

interface DiscoveredRoute {
  pattern: string;
  file: string;
}

const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;
const VALIDATE_ROOT = fileURLToPath(new URL("../../../app/api/validate/", import.meta.url));

let table: DiscoveredRoute[] | undefined;

function walk(dir: string, segments: string[], out: DiscoveredRoute[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // a tree the implementation has not created yet
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walk(join(dir, entry.name), [...segments, entry.name], out);
    else if (ROUTE_FILE.test(entry.name)) {
      out.push({ pattern: `/api/validate/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

export function routeTable(): DiscoveredRoute[] {
  if (table !== undefined) return table;
  const found: DiscoveredRoute[] = [];
  walk(VALIDATE_ROOT, [], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under \`app/api/validate/\`.\n` +
        `  The published block names four: ${ROUTE_NAMES.map((n) => ROUTES[n].url).join(", ")}.\n` +
        `  \`app/api/validate/**\` is in T040's \`Owns\` set, so this is a failed acceptance ` +
        `criterion rather than a test looking in the wrong place — the tree is walked, not guessed.`,
    );
  }
  table = found;
  return table;
}

function matchRoute(path: string): { route: DiscoveredRoute; params: Record<string, unknown> } {
  const routes = routeTable();
  for (const route of routes) {
    const params = getRouteMatcher(getRouteRegex(route.pattern))(path);
    if (params !== false) return { route, params };
  }
  throw new Error(
    `No published route matches \`${path}\`.\n` +
      `  Discovered patterns: ${routes.map((r) => r.pattern).join(", ")}\n` +
      `  The contract publishes URLs and the file layout is the implementation's, so this says ` +
      `the URL is unserved rather than that a file is missing from a guessed path.`,
  );
}

/** Which published pattern serves a URL, asked without importing a module. */
export function routePatternFor(path: string): string {
  return matchRoute(path).route.pattern;
}

export interface RouteAnswer {
  status: number;
  contentType: string | null;
  /** The raw text, not the parsed object: key order and an extra member are differences too. */
  body: string;
}

/**
 * Drive a published URL the way a caller does.
 *
 * `body` is sent as raw text so a body that is not JSON at all is a case this can express —
 * which is the one the "swallows every throw" mutation is caught by.
 */
export async function callRoute(
  name: RouteName,
  body: string,
  init?: { contentType?: string | null },
): Promise<Response> {
  const spec = ROUTES[name];
  const { route, params } = matchRoute(spec.path);
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(
      `\`${route.pattern}\` — the route serving \`${spec.path}\` — does not load.\n` +
        `  Driving the published URL \`${spec.url}\`.`,
      { cause },
    );
  }
  const post = mod.POST;
  if (typeof post !== "function") {
    throw new Error(
      `\`${route.pattern}\` exports no \`POST\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}). The published block names the ` +
        `method: ${spec.url}`,
    );
  }
  const headers: Record<string, string> = {};
  const contentType = init?.contentType === undefined ? "application/json" : init.contentType;
  if (contentType !== null) headers["content-type"] = contentType;

  const request = new Request(`https://darkprint.test${spec.path}`, {
    method: "POST",
    headers,
    body,
  });
  const answered = await (post as UnknownFn)(request, { params: Promise.resolve(params) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${spec.url}\` answered ${describe_(answered)}; a route handler returns a Response.`,
    );
  }
  return answered;
}

export async function answerOf(
  name: RouteName,
  body: unknown,
  init?: { raw?: string; contentType?: string | null },
): Promise<RouteAnswer> {
  const text = init?.raw ?? JSON.stringify(body);
  const response = await callRoute(name, text, { contentType: init?.contentType });
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
}

/** The 200 payload, held to being JSON and to being what the module would have answered. */
export function okPayloadOf(answer: RouteAnswer, where: string): unknown {
  if (answer.status !== 200) {
    throw new Error(
      `${where} answered ${answer.status}.\n` +
        `  B-03: "Responses carry data plus diagnostics at 200 — a bundle resolving with errors ` +
        `is an answer, not a failure." A content diagnostic is never a transport status.\n` +
        `  body: ${answer.body.slice(0, 400)}`,
    );
  }
  if (answer.contentType === null || !answer.contentType.includes("application/json")) {
    throw new Error(
      `${where} answered 200 with content-type ${JSON.stringify(answer.contentType)}; a payload ` +
        `is \`application/json\`, and \`${PROBLEM_CONTENT_TYPE}\` is for transport refusals only.`,
    );
  }
  try {
    return JSON.parse(answer.body) as unknown;
  } catch (cause) {
    throw new Error(`${where} answered a body that is not JSON: ${answer.body.slice(0, 200)}`, {
      cause,
    });
  }
}

/**
 * An RFC 9457 problem, checked as a whole rather than by status alone.
 *
 * `instance` is the member that has already been got wrong once in this repository — T000's
 * D-02 was every caller being asked to remember an `instance` string and none doing so, which
 * `Response.json` then dropped silently. A hand-rolled problem body reproduces it exactly.
 */
export function problemOf(
  answer: RouteAnswer,
  expected: { status: number; type?: string; path: string },
  where: string,
): Record<string, unknown> {
  if (answer.status !== expected.status) {
    throw new Error(
      `${where} answered ${answer.status}, expected ${expected.status}.\n` +
        `  body: ${answer.body.slice(0, 400)}`,
    );
  }
  if (answer.contentType === null || !answer.contentType.includes(PROBLEM_CONTENT_TYPE)) {
    throw new Error(
      `${where} answered ${answer.status} with content-type ${JSON.stringify(answer.contentType)}; ` +
        `B-03 makes transport failures \`${PROBLEM_CONTENT_TYPE}\`. A problem body served as ` +
        `\`application/json\` is one a caller's error handling will not recognise.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(answer.body) as unknown;
  } catch (cause) {
    throw new Error(`${where} answered a body that is not JSON: ${answer.body.slice(0, 200)}`, {
      cause,
    });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${where} answered ${describe_(parsed)} where a problem object is required.`);
  }
  const p = parsed as Record<string, unknown>;

  for (const [member, kind] of [
    ["type", "string"],
    ["title", "string"],
    ["status", "number"],
    ["detail", "string"],
    ["instance", "string"],
  ] as const) {
    if (typeof p[member] !== kind || (kind === "string" && p[member] === "")) {
      throw new Error(
        `${where}: \`${member}\` is ${JSON.stringify(p[member])}. T000's contract publishes the ` +
          `five RFC 9457 members — \`type\`, \`title\`, \`status\`, \`detail\`, \`instance\` — and ` +
          `a member that is absent or empty is one a caller reads as nothing went wrong there.`,
      );
    }
  }
  if (p.status !== expected.status) {
    throw new Error(
      `${where}: the body says \`status\` ${JSON.stringify(p.status)} while the response is ` +
        `${answer.status}. RFC 9457 §3.1: the member and the status code are the same fact.`,
    );
  }
  if (p.instance !== expected.path) {
    throw new Error(
      `${where}: \`instance\` is ${JSON.stringify(p.instance)}, expected ${JSON.stringify(expected.path)}. ` +
        `RFC 9457 §3.1 makes it the identifier of THIS occurrence, and T000's \`problem()\` derives ` +
        `it from the request path for exactly the reason D-02 records — every caller asked to ` +
        `remember one, none doing so, and \`Response.json\` dropping \`undefined\` in silence.`,
    );
  }
  if (expected.type !== undefined && p.type !== expected.type) {
    throw new Error(
      `${where}: \`type\` is ${JSON.stringify(p.type)}, expected ${JSON.stringify(expected.type)}. ` +
        `The URI is what a caller branches on; a status code alone cannot separate two refusals ` +
        `that share one.`,
    );
  }
  return p;
}
