/* ============================================================
   T070 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and nothing else, so this module is imported by the suites beside
   it and is never collected as one itself.

   ── why every load is a dynamic import ──
   These tests were written in a worktree branched before
   `lib/server/naming/**` existed. A static top-level import of a
   module that is not on disk fails the whole *file* at collection,
   which reports one red where the protocol asks for one per
   acceptance criterion and hides five criteria behind the first
   missing module. Loading inside the test that needs it turns "the
   module is not there yet" into exactly the per-criterion red the
   hand-off is supposed to produce. The specifier stays a literal so
   the `@` alias resolves.

   ── one barrel ──
   `@/lib/server/naming` is the only module under test. T070's
   contract says it "consumes nothing else" — no second barrel, so
   unlike T030 there is no red here that means "a dependency has not
   merged". Every red is T070 absent or T070 wrong.

   ── no candidate lists ──
   Every name is bound exactly and its absence quotes the clause that
   publishes it. T000 paid two rounds for the alternative: one list
   resolved `encodeSession` instead of the cookie writer, another
   resolved the one migration function with no database parameter.

   ── the message pins are LITERALS, and that is deliberate ──
   T070 is the first task in this run to publish an admissible
   message form per rejection path *before* the implementation
   exists, so the strongest pin in the error-hygiene rule is
   available here: `message` equals the constructed form, with the
   expected string written out in this file rather than imported from
   the module under test. A later change that derives one of these
   from `@/lib/server/naming` — reusing a template, a format helper
   or an exported constant — is a REMOVED ASSERTION, not a removal of
   duplication, and is to be treated as one. See backend.md,
   "the expected message must be a LITERAL in the test".
   ============================================================ */

import type { Diagnostic, Severity } from "@/lib/core";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const NAMING = "@/lib/server/naming";

let naming: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, and every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadNaming(): Promise<Namespace> {
  naming ??= import("@/lib/server/naming").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${NAMING} does not load.\n` +
          `  backend.md §T070 owns \`lib/server/naming/**\` and publishes \`checkHandle\`, ` +
          `\`allocateHandle\`, \`releaseHandle\`, \`checkSlug\`, \`isReservedSlug\`, ` +
          `\`validateCardId\` and \`validateNamespace\`, from the barrel \`@/lib/server/naming\`.\n` +
          `  This is a failed acceptance criterion — the namespace module is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return naming;
}

/* --------------------- what the contract publishes --------------------- */

/** The Published signatures block of backend.md §T070, quoted so a red says where the name comes from. */
export const PUBLISHED = {
  checkHandle: "checkHandle(db: Db, handle: string): Promise<Availability>",
  allocateHandle: "allocateHandle(db: Db, accountId: string, handle: string): Promise<void>",
  releaseHandle: "releaseHandle(db: Db, accountId: string, handle: string): Promise<void>",
  checkSlug: "checkSlug(db: Db, ownerId: string, slug: string): Promise<Availability>",
  isReservedSlug: "isReservedSlug(slug: string): boolean          // pure, no Db — the four profile tabs",
  validateCardId: "validateCardId(id: string): Diagnostic[]       // pure, grammar only",
  validateNamespace: "validateNamespace(namespace: string): Diagnostic[]   // pure",
} as const;

export type PublishedName = keyof typeof PUBLISHED;

export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${NAMING} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. The Published ` +
      `signatures block names this export exactly, and the rule above it ("the contract must ` +
      `name the interface, not only the behaviour") exists because two rounds of candidate ` +
      `lists in T000 each resolved to the wrong thing. Do not add a synonym here; publish the ` +
      `name the contract states.`,
  );
}

function asFn(value: unknown, name: string, clause: string): UnknownFn {
  if (typeof value !== "function") {
    throw new Error(
      `${NAMING} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/** The seven bindings T070 publishes. `Availability` is a type and has no runtime binding. */
export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadNaming();
  return asFn(requireFrom(mod, name, PUBLISHED[name]), name, PUBLISHED[name]);
}

/* --------------------- the shape the contract publishes back --------------------- */

export interface Availability {
  available: boolean;
  suggestion?: string;
}

/**
 * `interface Availability { available: boolean; suggestion?: string }`.
 *
 * The return type is part of the published signature, so a wrong shape is a red rather than a
 * broken test. `available` is a boolean and not a truthy value: a store answering `undefined`
 * for "I found no row" has published a different type from the one it declared, and every
 * caller written against `if (!a.available)` would then treat a free name as taken.
 */
export function asAvailability(value: unknown, where: string): Availability {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${where} returned ${describe_(value)}; the contract publishes ` +
        `Promise<Availability>, i.e. { available: boolean; suggestion?: string }.`,
    );
  }
  const a = value as Partial<Availability>;
  if (typeof a.available !== "boolean") {
    throw new Error(
      `${where} returned \`available\` = ${JSON.stringify(a.available)} (${describe_(a.available)}); ` +
        `Availability.available is declared \`boolean\`.`,
    );
  }
  if (a.suggestion !== undefined && (typeof a.suggestion !== "string" || a.suggestion === "")) {
    throw new Error(
      `${where} returned \`suggestion\` = ${JSON.stringify(a.suggestion)}; Availability.suggestion ` +
        `is \`string | undefined\`, and an empty string is not a name anybody can claim.`,
    );
  }
  return a as Availability;
}

/* --------------------- the four admissible message forms --------------------- */

/*
 * backend.md §T070, "Admissible message forms, published before the implementation exists":
 *
 *     HandleTakenError      "allocateHandle: the handle `<handle>` is not available."
 *     SlugTakenError        "checkSlug: `<owner>` already has a bundle at `<slug>`."
 *     ReservedSlugError     "checkSlug: `<slug>` is reserved by the profile tabs."
 *     InvalidNameError      "<operation>: `<value>` is not a valid <kind>."
 *
 * Written out here as literals. Do not replace any of these with an import from
 * `@/lib/server/naming`: an expectation built from the module under test asserts "does the
 * module agree with itself", and passes unchanged if the template starts interpolating a
 * driver value.
 */

export function handleTakenMessage(handle: string): string {
  return `allocateHandle: the handle \`${handle}\` is not available.`;
}

export function slugTakenMessage(owner: string, slug: string): string {
  return `checkSlug: \`${owner}\` already has a bundle at \`${slug}\`.`;
}

export function reservedSlugMessage(slug: string): string {
  return `checkSlug: \`${slug}\` is reserved by the profile tabs.`;
}

/**
 * The one form with a slot the contract does not fill.
 *
 * `<kind>` is unenumerated — the contract never says whether an invalid handle is "a valid
 * handle", "a valid name" or "a valid identifier" — so this path gets a prefix-and-shape pin
 * rather than an equality one, and says so. Pinning an invented `<kind>` would be a candidate
 * list wearing an exact-match's clothes.
 */
export function invalidNamePrefix(operation: string, value: string): string {
  return `${operation}: \`${value}\` is not a valid `;
}

/* --------------------- the rejection contract --------------------- */

/**
 * "Nothing else may appear in any rendering: the operation, the caller's own value, and the four
 * fixed forms above. `cause` carries the driver error and is non-enumerable; `stack` is retained."
 *
 * Checked over every rendering a log line or an error reporter would actually reach for, because
 * a `message` that is clean while `JSON.stringify(err)` carries the whole INSERT has leaked.
 *
 * `expectedMessage` is an exact pin where the contract fills every slot. Where it does not,
 * `expectedPrefix` pins what is published and `driverValues` covers the rest — see
 * `assertNoDriverLeak` below, which derives the deny set from the actual driver error rather
 * than from a list somebody wrote down.
 */
export interface SealedExpectation {
  /** The full published form, every slot filled. Exact equality. */
  expectedMessage?: string;
  /** The published form with an unenumerated slot. Prefix equality plus a trailing period. */
  expectedPrefix?: string;
}

export function expectSealedError(
  err: unknown,
  where: string,
  expectation: SealedExpectation = {},
): Error {
  if (!(err instanceof Error)) {
    throw new Error(
      `${where} rejected with ${describe_(err)}; the contract requires a typed Error carrying ` +
        `the driver error on a non-enumerable \`cause\`.`,
    );
  }

  // (1) and (2). `Object.keys` is the enumerable own set, which is what every serialiser walks.
  const keys = Object.keys(err);
  if (keys.length !== 0) {
    throw new Error(
      `${where} rejected with an Error whose \`Object.keys\` is [${keys.join(", ")}]; the ` +
        `error-hygiene clause requires it empty. A \`code\`, a \`detail\`, a \`query\` or a ` +
        `\`params\` here is the driver's error escaping under a new name.`,
    );
  }
  const serialised = JSON.stringify(err);
  if (serialised !== "{}") {
    throw new Error(
      `${where} rejected with an Error serialising to ${serialised}; the clause requires exactly "{}".`,
    );
  }

  // (3). `propertyIsEnumerable`, never by inference — the clause says so in as many words.
  if (Object.prototype.propertyIsEnumerable.call(err, "cause")) {
    throw new Error(
      `${where} rejected with an Error whose \`cause\` is enumerable; the clause requires it ` +
        `non-enumerable, which is what keeps \`JSON.stringify\` from reaching the driver's error.`,
    );
  }

  // (4). `stack` is RETAINED. "own properties exactly [message, cause]" was unsatisfiable —
  // `stack` is an own property of every `new Error()` in V8 — so the clause was amended to say
  // what it was always reaching for: nothing leaks, and the trace survives.
  if (
    !Object.prototype.hasOwnProperty.call(err, "stack") ||
    typeof err.stack !== "string" ||
    err.stack === ""
  ) {
    throw new Error(
      `${where} rejected with an Error carrying no \`stack\`. The clause requires it retained, ` +
        `not deleted: an error nobody can locate is a worse outcome than one that says too much.`,
    );
  }

  // (5). The whitelist, asserted by EXACT MATCH against the admissible form rather than by
  // scanning for forbidden substrings. T070 publishes all four forms, so there is nothing to
  // derive and nothing to curate: the enumerable surface of a sealed error is `{}` and the
  // message is the one string the contract names for this path.
  if (expectation.expectedMessage !== undefined && err.message !== expectation.expectedMessage) {
    throw new Error(
      `${where} rejected with\n` +
        `    message  ${JSON.stringify(err.message)}\n` +
        `  where backend.md §T070's admissible message form for this path is\n` +
        `    expected ${JSON.stringify(expectation.expectedMessage)}\n` +
        `  The forms were published before the implementation existed, so this is a contract ` +
        `mismatch rather than a wording preference. Note for whoever reads this red: making it ` +
        `green by importing the module's own template into this test would DELETE the assertion.`,
    );
  }
  if (expectation.expectedPrefix !== undefined) {
    if (!err.message.startsWith(expectation.expectedPrefix) || !err.message.endsWith(".")) {
      throw new Error(
        `${where} rejected with\n` +
          `    message  ${JSON.stringify(err.message)}\n` +
          `  where backend.md §T070 publishes InvalidNameError as ` +
          `"<operation>: \`<value>\` is not a valid <kind>." — so this path is pinned as far as ` +
          `the contract fills it in:\n` +
          `    expected ${JSON.stringify(expectation.expectedPrefix + "<kind>.")}\n` +
          `  \`<kind>\` is the one slot the contract never enumerates. It is left unpinned ` +
          `deliberately rather than guessed.`,
      );
    }
  }

  return err;
}

/**
 * The other half of the whitelist, for the paths whose form carries an unpinned slot.
 *
 * Both halves are derived rather than listed: the deny set is every word the *actual* driver
 * error on `cause` identifies, and the allow set is the caller's own values. So a value nobody
 * enumerated is caught the moment the driver puts it in its own error, and the over-match that
 * cost two earlier suites a round — scanning for a substring of the module's own constraint
 * name — cannot recur, because the comparison is word by word.
 *
 * Unconditional by construction. When the rejection carries no driver error the deny set is
 * empty rather than the check being skipped: a block that runs only when the subject supplies
 * the shape it keys on cannot test the subject that does not.
 */
export function assertNoDriverLeak(err: Error, supplied: readonly string[], where: string): void {
  const admissible = new Set<string>();
  for (const value of supplied) for (const word of wordsOf(value)) admissible.add(word);
  // `Error.prototype.name` puts "error" in `String(err)` structurally, and the operation names
  // in the published forms are the module's own. Subtracted by deriving from a baseline `Error`
  // rather than by listing them.
  for (const word of wordsOf(String(new Error("")))) admissible.add(word);

  const renderings: Record<string, string> = {
    message: err.message,
    "String(err)": String(err),
    "JSON.stringify(err)": JSON.stringify(err),
    "JSON.stringify({ detail: err.message })": JSON.stringify({ detail: err.message }),
    "own-property enumeration": Object.keys(err).join(" "),
  };

  const deny = [...driverValues((err as { cause?: unknown }).cause)].filter(
    (word) => !admissible.has(word),
  );
  for (const [name, text] of Object.entries(renderings)) {
    const echoed = [...wordsOf(text)].filter((word) => deny.includes(word));
    if (echoed.length > 0) {
      throw new Error(
        `${where}: \`${name}\` carries ${JSON.stringify(echoed.join(" "))}, which came from the ` +
          `driver error on \`cause\` and is not a value the caller supplied. §T070 admits only ` +
          `"the operation, the caller's own value, and the four fixed forms".`,
      );
    }
  }
}

/**
 * Words long enough to mean something. Compared as words, never as substrings.
 *
 * The leading class admits a digit on purpose: an identifier-shaped `[a-z_][a-z0-9_]{3,}`
 * produces no token at all from `"23505"`, so a SQLSTATE could never appear on either side of
 * the comparison while the clause names one among the things no rendering may carry. Widening
 * a deny set does nothing if the thing doing the looking cannot represent its members.
 */
const WORD = /[a-z0-9_][a-z0-9_]{3,}/g;

function wordsOf(text: string): Set<string> {
  return new Set(text.toLowerCase().match(WORD) ?? []);
}

/**
 * What the driver error *identifies*, never what it says.
 *
 * Reading the prose would make the module's fixed English depend on PostgreSQL's English, which
 * moves with a server upgrade or an `lc_messages` change. `severity` is deliberately absent —
 * its value is the word "ERROR", which identifies nothing and collides with every `Error`.
 */
const IDENTIFYING = [
  "code",
  "constraint",
  "table",
  "column",
  "schema",
  "routine",
  "file",
  "query",
  "sql",
] as const;

function driverValues(cause: unknown): Set<string> {
  const out = new Set<string>();
  const seen = new Set<unknown>();
  const stack: unknown[] = [cause];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const record = current as Record<string, unknown>;
    for (const key of IDENTIFYING) {
      const value = record[key];
      if (typeof value === "string" || typeof value === "number") {
        for (const word of wordsOf(String(value))) out.add(word);
      }
    }
    for (const key of ["params", "parameters"]) {
      const value = record[key];
      if (Array.isArray(value)) for (const p of value) for (const word of wordsOf(String(p))) out.add(word);
    }
    if (record.cause !== undefined) stack.push(record.cause);
  }
  return out;
}

/**
 * The refusal a database raised, as opposed to one the module raised for itself.
 *
 * `hasOwnProperty` is not enough and this was measured in T030 rather than reasoned: a sealed
 * error defines `cause` as a non-enumerable own property *even when nothing was passed*, so the
 * key exists on every refusal. The VALUE has to be defined.
 *
 * This is what makes AC5 discriminating beyond the count. §T070 requires `allocateHandle` to be
 * "a single insert whose conflict is caught and translated", so under a genuine race every
 * loser's refusal comes back from the index and carries the driver error. A refusal produced by
 * a `SELECT` that ran before the winner committed carries nothing.
 */
export function expectCausePresent(err: Error, where: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(err, "cause");
  if (descriptor === undefined || descriptor.value === undefined) {
    throw new Error(
      `${where} rejected with an Error carrying no \`cause\` value` +
        `${descriptor === undefined ? "" : " (the property is defined, and it is `undefined`)"}.\n` +
        `  §T070: "\`allocateHandle\` is a **single insert** whose conflict is caught and ` +
        `translated; the primary key is the arbiter." A refusal the index raised carries the ` +
        `driver error underneath it; one a read-then-write pre-check raised does not. Under a ` +
        `race every loser got past any pre-check, so a causeless refusal here is the ` +
        `read-then-write shape the criterion exists to catch.`,
    );
  }
}

/* --------------------- refusals that may take either shape --------------------- */

/**
 * `checkSlug` is published as `Promise<Availability>` AND as the operation named in two of the
 * four admissible message forms. Both readings are live and the contract does not settle it:
 *
 *   (a) it answers `{ available: false }` and the two `checkSlug:` forms belong to a writer
 *       T070 does not publish;
 *   (b) it throws, in which case its `Availability` return can only ever be `{available: true}`
 *       and the declared shape is dead.
 *
 * Reported to the orchestrator rather than resolved here. What both readings agree on is that
 * the name is REFUSED, so that is asserted unconditionally, and the form is then pinned on
 * whichever shape arrived. Neither branch is a no-op: this is not the conditional-assertion
 * hazard, where a check exists only when the subject supplies a shape and vanishes otherwise.
 */
export type Refusal =
  | { kind: "unavailable"; availability: Availability }
  | { kind: "threw"; error: Error };

export async function refusalOf(call: () => unknown, where: string): Promise<Refusal> {
  let result: unknown;
  try {
    result = await call();
  } catch (err) {
    if (!(err instanceof Error)) {
      throw new Error(`${where} rejected with ${describe_(err)}; a refusal is a typed Error.`);
    }
    return { kind: "threw", error: err };
  }
  const availability = asAvailability(result, where);
  if (availability.available) {
    throw new Error(
      `${where} answered \`{ available: true }\` where the contract requires the name to be ` +
        `refused. Neither reading of the contract permits this: a taken or reserved name is ` +
        `either unavailable or a rejection, never free.`,
    );
  }
  return { kind: "unavailable", availability };
}

/** Run a call, require it to reject, and hold the rejection to the whole hygiene clause. */
export async function rejects(
  call: () => unknown,
  where: string,
  expectation: SealedExpectation = {},
): Promise<Error> {
  let result: unknown;
  try {
    result = await call();
  } catch (err) {
    return expectSealedError(err, where, expectation);
  }
  throw new Error(
    `${where} resolved with ${describe_(result)} where the contract requires a refusal.`,
  );
}

/** Run a call whose outcome this test does not constrain, and wait for it either way. */
export async function settled(call: () => unknown): Promise<Error | undefined> {
  try {
    await call();
    return undefined;
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

/* --------------------- diagnostics --------------------- */

const SEVERITIES: readonly Severity[] = ["error", "warning", "info"];

export function asDiagnostics(value: unknown, where: string): Diagnostic[] {
  if (!Array.isArray(value)) {
    throw new Error(`${where} returned ${describe_(value)}; the contract publishes Diagnostic[].`);
  }
  for (const [i, d] of value.entries()) {
    if (d === null || typeof d !== "object") {
      throw new Error(`${where}[${i}] is ${describe_(d)}; every entry is a Diagnostic.`);
    }
    const { code, severity, message } = d as {
      code?: unknown;
      severity?: unknown;
      message?: unknown;
    };
    // The contract publishes no diagnostic CODE for either grammar, so nothing here binds one.
    // What is checked is that the value is a `DiagnosticCode` in shape — `lib/core`'s union is
    // `<stage>/<rule>` throughout — rather than a bare English sentence in the code slot.
    if (typeof code !== "string" || !/^[a-z]+\/[a-z-]+$/.test(code)) {
      throw new Error(
        `${where}[${i}] has \`code\` = ${JSON.stringify(code)}; Diagnostic.code is a ` +
          `DiagnosticCode, and every member of that union in \`lib/core/diagnostics.ts\` is ` +
          `\`<stage>/<rule>\`.`,
      );
    }
    if (typeof severity !== "string" || !SEVERITIES.includes(severity as Severity)) {
      throw new Error(`${where}[${i}] has \`severity\` = ${JSON.stringify(severity)}.`);
    }
    if (typeof message !== "string" || message === "") {
      throw new Error(`${where}[${i}] has \`message\` = ${JSON.stringify(message)}.`);
    }
  }
  return value as Diagnostic[];
}

export function errorsOf(ds: readonly Diagnostic[]): Diagnostic[] {
  return ds.filter((d) => d.severity === "error");
}
