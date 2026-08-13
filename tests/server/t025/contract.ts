/* ============================================================
   T025 — the blind contract surface

   Not a test file. `vitest.config.ts` reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── why every load is a dynamic import ──
   These tests were written in a worktree branched before the
   implementation existed. A static top-level import of a module that
   is not on disk fails the whole *file* at collection, which reports
   one red where the protocol asks for one per acceptance criterion
   and hides five criteria behind the first missing module. Loading
   inside the test that needs it turns "the module is not there yet"
   into exactly the per-criterion red the hand-off is supposed to
   produce. The specifier stays a literal so the `@` alias resolves.

   ── why the barrel, and the gap it papers over ──
   backend.md §T025's **Published signatures** block names three
   functions and one interface and does **not** name the module they
   are published from. That is the D-01 shape of defect and it is
   reported to the orchestrator rather than resolved here. What this
   file binds to is not a guess between candidates — there is exactly
   one specifier consistent with the rule this repository already
   states in `lib/core/index.ts` ("The one module the app imports …
   Deep paths are internal and may be rearranged, so nothing outside
   should reach for one") and with T025's `Owns: lib/server/versioning/**`:
   the barrel at `@/lib/server/versioning`, the same shape as
   `@/lib/server/http` and `@/lib/server/auth`, both of which T000
   merged. A capability that turns out to live at a deep path instead
   is a barrel that should re-export it, and that is worth a red.

   ── one tier of binding, and no candidate lists ──
   Every name this task publishes is bound *exactly*, and its absence
   is a red whose message quotes the clause that names it. There are
   no candidate lists anywhere in `tests/server/t025/**`. T000 paid
   two rounds for the technique: round 1's list resolved
   `encodeSession` instead of the cookie writer and produced five
   false reports of a broken round trip, and round 2's resolved
   `migrate`, the one migration function with no database parameter.
   Where the contract has a name, guessing is worse than binding, and
   where it has none the orchestrator hears about it.

   ── why nothing here reads `tests/support/**` ──
   The hand-off forbids it. T000 has since merged that directory onto
   `backend`, so the stated reason ("it does not exist on this
   branch") no longer holds after the rebase — reported, and the
   prohibition followed anyway, because T025 is a pure service that
   stores nothing and needs no database, no object store and no
   fixture harness. Nothing in this suite touches a database, so
   there is no database to create, isolate or drop.
   ============================================================ */

import type { BumpAnalysis, BumpLevel, Diagnostic, Severity } from "@/lib/core";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

/** The barrel. See the header for why this specifier and not a deep path. */
export const VERSIONING = "@/lib/server/versioning";

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for
 * the whole run, and every test that awaits it gets its own copy of the same red rather
 * than one test's failure cascading into an unhandled rejection in the next.
 */
let versioning: Promise<Namespace> | undefined;

export function loadVersioning(): Promise<Namespace> {
  versioning ??= import("@/lib/server/versioning").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${VERSIONING} does not load.\n` +
          `  backend.md §T025 owns \`lib/server/versioning/**\` and publishes ` +
          `\`inferBlueprintBump\`, \`inferOntologyBump\` and \`checkDeclaredBump\`.\n` +
          `  This is a failed acceptance criterion — the service is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves; if the ` +
          `barrel is published somewhere else, the contract has to say so.`,
        { cause },
      );
    },
  );
  return versioning;
}

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of backend.md §T025, quoted so a red says where the name
 * comes from and not merely that a test wanted it. These are the whole of the named
 * surface. `BumpLevel`, `BumpAnalysis`, `inferBump`, `checkVersionChain`, `parseSemver`
 * and `compareSemver` are **consumed from `@/lib/core`, never reimplemented**, so they are
 * imported statically above and are not looked for here.
 */
export const PUBLISHED = {
  inferBlueprintBump:
    "inferBlueprintBump(previous: BlueprintSnapshot, next: BlueprintSnapshot): BumpAnalysis, " +
    "where BlueprintSnapshot is { dot: string; cardRefs: readonly string[] }",
  inferOntologyBump:
    "inferOntologyBump(previous: readonly OntologyTerm[], next: readonly OntologyTerm[]): " +
    "BumpAnalysis",
  checkDeclaredBump:
    "checkDeclaredBump(previous: string, declared: string, inferred: BumpAnalysis): " +
    "Diagnostic[]",
} as const;

/** What a value is, for a failure message that does not make the reader go looking. */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

/**
 * A name the contract publishes. Absent is a red, and the red says so in as many words:
 * the whole point of the Published signatures block is that this name is no longer a
 * thing either side may choose.
 */
export function required(mod: Namespace, name: keyof typeof PUBLISHED): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${VERSIONING} exports no \`${name}\`.\n` +
      `  the contract publishes: ${PUBLISHED[name]}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. backend.md's ` +
      `T025 Published signatures block names this export exactly, and the rule above it ` +
      `("the contract must name the interface, not only the behaviour") exists because ` +
      `two rounds of candidate lists in T000 each resolved to the wrong thing. Do not add ` +
      `a synonym to a list here; publish the name the contract states.`,
  );
}

export function requiredFn(mod: Namespace, name: keyof typeof PUBLISHED): UnknownFn {
  const value = required(mod, name);
  if (typeof value !== "function") {
    throw new Error(
      `${VERSIONING} exports \`${name}\` as ${describe(value)}; the contract publishes it ` +
        `as a function: ${PUBLISHED[name]}`,
    );
  }
  return value as UnknownFn;
}

/** The three bindings, each fetched through the barrel and checked against its clause. */
export async function inferBlueprintBump(): Promise<UnknownFn> {
  return requiredFn(await loadVersioning(), "inferBlueprintBump");
}

export async function inferOntologyBump(): Promise<UnknownFn> {
  return requiredFn(await loadVersioning(), "inferOntologyBump");
}

export async function checkDeclaredBump(): Promise<UnknownFn> {
  return requiredFn(await loadVersioning(), "checkDeclaredBump");
}

/* --------------------- the shapes the contract publishes back --------------------- */

const LEVELS: readonly BumpLevel[] = ["major", "minor", "patch", "none"];
const SEVERITIES: readonly Severity[] = ["error", "warning", "info"];

/**
 * The return type is part of the published signature, so a wrong shape is a red rather
 * than a broken test. Checked structurally against `@/lib/core`'s `BumpAnalysis`, which
 * this task consumes rather than redeclares.
 */
export function asBumpAnalysis(value: unknown, where: string): BumpAnalysis {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} returned ${describe(value)}; the contract publishes BumpAnalysis.`);
  }
  const { level, reasons } = value as { level?: unknown; reasons?: unknown };
  if (typeof level !== "string" || !LEVELS.includes(level as BumpLevel)) {
    throw new Error(
      `${where} returned \`level\` = ${JSON.stringify(level)}; \`@/lib/core\`'s BumpLevel is ` +
        `one of ${LEVELS.join(" | ")}.`,
    );
  }
  if (!Array.isArray(reasons) || reasons.some((r) => typeof r !== "string")) {
    throw new Error(
      `${where} returned \`reasons\` = ${describe(reasons)}; \`@/lib/core\`'s BumpAnalysis ` +
        `declares \`reasons: string[]\`.`,
    );
  }
  return { level: level as BumpLevel, reasons: reasons as string[] };
}

/** Same, for the `Diagnostic[]` half of the contract. */
export function asDiagnostics(value: unknown, where: string): Diagnostic[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${where} returned ${describe(value)}; the contract publishes ` +
        `${PUBLISHED.checkDeclaredBump}.`,
    );
  }
  for (const [i, d] of value.entries()) {
    if (d === null || typeof d !== "object") {
      throw new Error(`${where} returned ${describe(d)} at index ${i}; every entry is a Diagnostic.`);
    }
    const { code, severity, message } = d as { code?: unknown; severity?: unknown; message?: unknown };
    if (typeof code !== "string" || code === "") {
      throw new Error(`${where}[${i}] has \`code\` = ${JSON.stringify(code)}; Diagnostic.code is a DiagnosticCode.`);
    }
    if (typeof severity !== "string" || !SEVERITIES.includes(severity as Severity)) {
      throw new Error(
        `${where}[${i}] has \`severity\` = ${JSON.stringify(severity)}; Diagnostic.severity is ` +
          `one of ${SEVERITIES.join(" | ")}.`,
      );
    }
    if (typeof message !== "string" || message === "") {
      throw new Error(`${where}[${i}] has \`message\` = ${JSON.stringify(message)}; Diagnostic.message is a sentence.`);
    }
  }
  return value as Diagnostic[];
}

/** Everything a diagnostic says, so a test can ask whether a reason reached the reader. */
export function diagnosticText(d: Diagnostic): string {
  return `${d.message} ${d.hint ?? ""}`;
}

/* --------------------- guards shared by more than one suite --------------------- */

/**
 * The one answer a versioning authority may never give about input it could not read.
 *
 * Throwing is a loud answer and passes. Reporting *some* level is a loud answer and
 * passes. Answering `"none"` — "nothing changed, publish whatever you like" — is the
 * silent failure that lets an unreadable release through the chain check, and it is the
 * failure mode this repository's diagnostics model exists to prevent.
 */
export function neverSilentlyNone(call: () => unknown, what: string): void {
  let result: unknown;
  try {
    result = call();
  } catch {
    return;
  }
  const level = (result as { level?: unknown } | null | undefined)?.level;
  if (level === "none") {
    throw new Error(
      `${what} returned \`{ level: "none" }\` — "nothing changed" — for input it cannot ` +
        `read. Throw, or report a change; a versioning authority that answers "none" here ` +
        `lets a release past the chain check with no bump at all.`,
    );
  }
}

/**
 * The `checkDeclaredBump` half of the same rule. `[]` means "the declared version is at
 * least the inferred level" — an acceptance. Returning it for an analysis the function
 * could not read publishes a release with no bump behind it.
 */
export function neverSilentlyAccepts(call: () => unknown, what: string): void {
  let result: unknown;
  try {
    result = call();
  } catch {
    return;
  }
  if (Array.isArray(result) && result.length === 0) {
    throw new Error(
      `${what} returned \`[]\` — "the declared version is enough" — for an inferred ` +
        `analysis it cannot read. Throw, or report a diagnostic; an empty array here is ` +
        `an acceptance, and this one rests on nothing.`,
    );
  }
}

/** Freeze an object and everything under it, so a mutation shows up as a throw. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner);
  }
  return value;
}
