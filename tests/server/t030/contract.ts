/* ============================================================
   T030 — the blind contract surface

   Not a test file. `vitest.config.ts` reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── why every load is a dynamic import ──
   These tests were written in a worktree branched before the
   implementation existed. A static top-level import of a module
   that is not on disk fails the whole *file* at collection, which
   reports one red where the protocol asks for one per acceptance
   criterion and hides five criteria behind the first missing
   module. Loading inside the test that needs it turns "the module
   is not there yet" into exactly the per-criterion red the hand-off
   is supposed to produce. The specifier stays a literal so the `@`
   alias resolves.

   ── two barrels, and why a red against each means something
      different ──
   `@/lib/server/ontology` is the module under test: a red there is
   T030 absent. `@/lib/server/versioning` is **T025's**, and AC6
   depends on it — backend.md §T030 says so in as many words ("AC6
   is the one criterion that waits on T025"). A red there is a
   dependency that has not merged, not a defect in this task, and
   the message says which so nobody has to guess from a stack trace.

   ── no candidate lists ──
   Every name is bound exactly and its absence quotes the clause
   that publishes it. T000 paid two rounds for the alternative: one
   list resolved `encodeSession` instead of the cookie writer and
   produced five false reports of a broken round trip, another
   resolved the one migration function with no database parameter.
   Where the contract has a name, guessing is worse than binding;
   where it has none, the orchestrator hears about it instead.
   ============================================================ */

import { getTableConfig } from "drizzle-orm/pg-core";

import type { Diagnostic, OntologyTerm, OntologyView, Severity } from "@/lib/core";
import { schema } from "@/lib/db";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const ONTOLOGY = "@/lib/server/ontology";
export const VERSIONING = "@/lib/server/versioning";

let ontology: Promise<Namespace> | undefined;
let versioning: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, and every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadOntology(): Promise<Namespace> {
  ontology ??= import("@/lib/server/ontology").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${ONTOLOGY} does not load.\n` +
          `  backend.md §T030 owns \`lib/server/ontology/**\` and publishes ` +
          `\`addOntologyVersion\`, \`getOntologyVersion\`, \`getLatestOntologyVersion\`, ` +
          `\`listOntologyVersions\`, \`openView\` and \`validateVocabulary\`.\n` +
          `  This is a failed acceptance criterion — the store is absent — and not a broken ` +
          `test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return ontology;
}

/**
 * T025's barrel, which AC6 needs and which T030 must not reimplement: "Do **not** reimplement
 * bump inference inside `lib/server/ontology/**` to make it green — two implementations of one
 * rule is the defect the partition exists to prevent."
 */
export function loadVersioning(): Promise<Namespace> {
  versioning ??= import("@/lib/server/versioning").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${VERSIONING} does not load — this is T025's module, not T030's.\n` +
          `  backend.md §T030: "AC6 is the one criterion that waits on T025 … if ` +
          `\`lib/server/versioning/**\` has not merged by the time the gates run, leave AC6's ` +
          `call site as a single named function that reports the absent dependency, say so in ` +
          `the Log, and let the criterion stand red."\n` +
          `  So a red here is the dependency being absent. It is NOT a defect in T030, and it ` +
          `is NOT a reason to grow a second bump inference inside \`lib/server/ontology/**\`.`,
        { cause },
      );
    },
  );
  return versioning;
}

/* --------------------- what the contract publishes --------------------- */

/** The Published signatures block of backend.md §T030, quoted so a red says where the name comes from. */
export const PUBLISHED = {
  addOntologyVersion:
    "addOntologyVersion(db: Db, input: { version: string; terms: readonly OntologyTerm[] }): " +
    "Promise<OntologyVersionRecord> — digest is COMPUTED here, never supplied",
  getOntologyVersion:
    "getOntologyVersion(db: Db, version: string): Promise<OntologyVersionRecord | undefined>",
  getLatestOntologyVersion:
    "getLatestOntologyVersion(db: Db): Promise<OntologyVersionRecord | undefined>",
  listOntologyVersions: "listOntologyVersions(db: Db): Promise<OntologyVersionRecord[]>",
  openView:
    "openView(db: Db, version: string, extensions?: readonly OntologyTerm[]): Promise<OntologyView>",
  validateVocabulary: "validateVocabulary(terms: readonly OntologyTerm[]): Diagnostic[]",
} as const;

/** T025's half, needed by AC6 alone. */
export const PUBLISHED_T025 = {
  inferOntologyBump:
    "inferOntologyBump(previous: readonly OntologyTerm[], next: readonly OntologyTerm[]): BumpAnalysis",
  checkDeclaredBump:
    'checkDeclaredBump(subject: "card" | "bundle" | "ontology", previous: string, ' +
    "declared: string, inferred: BumpAnalysis): Diagnostic[]",
} as const;

function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, source: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${source} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. The Published ` +
      `signatures block names this export exactly, and the rule above it ("the contract must ` +
      `name the interface, not only the behaviour") exists because two rounds of candidate ` +
      `lists in T000 each resolved to the wrong thing. Do not add a synonym here; publish the ` +
      `name the contract states.`,
  );
}

function asFn(value: unknown, name: string, source: string, clause: string): UnknownFn {
  if (typeof value !== "function") {
    throw new Error(
      `${source} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/** The six bindings T030 publishes. */
export async function bind(name: keyof typeof PUBLISHED): Promise<UnknownFn> {
  const mod = await loadOntology();
  return asFn(requireFrom(mod, name, ONTOLOGY, PUBLISHED[name]), name, ONTOLOGY, PUBLISHED[name]);
}

/** T025's two, for AC6. */
export async function bindT025(name: keyof typeof PUBLISHED_T025): Promise<UnknownFn> {
  const mod = await loadVersioning();
  return asFn(
    requireFrom(mod, name, VERSIONING, PUBLISHED_T025[name]),
    name,
    VERSIONING,
    PUBLISHED_T025[name],
  );
}

/* --------------------- the shapes the contract publishes back --------------------- */

const SEVERITIES: readonly Severity[] = ["error", "warning", "info"];

export interface Record_ {
  id: string;
  version: string;
  digest: string;
  terms: readonly OntologyTerm[];
  createdAt: Date;
}

/**
 * The return type is part of the published signature, so a wrong shape is a red rather than a
 * broken test. `createdAt` is a `Date` and not a string: the interface says `Date`, and a store
 * that hands back whatever `pg` gave it has published a different type from the one it declared.
 */
export function asRecord(value: unknown, where: string): Record_ {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} returned ${describe_(value)}; the contract publishes OntologyVersionRecord.`);
  }
  const r = value as Partial<Record_>;
  for (const key of ["id", "version", "digest"] as const) {
    if (typeof r[key] !== "string" || r[key] === "") {
      throw new Error(`${where} returned \`${key}\` = ${JSON.stringify(r[key])}; OntologyVersionRecord.${key} is a string.`);
    }
  }
  if (!Array.isArray(r.terms)) {
    throw new Error(`${where} returned \`terms\` = ${describe_(r.terms)}; OntologyVersionRecord.terms is OntologyTerm[].`);
  }
  if (!(r.createdAt instanceof Date) || Number.isNaN(r.createdAt.getTime())) {
    throw new Error(
      `${where} returned \`createdAt\` = ${describe_(r.createdAt)}; OntologyVersionRecord.createdAt ` +
        `is declared \`Date\`, so a string here is a different type from the published one.`,
    );
  }
  return r as Record_;
}

/** Structural check against `@/lib/core`'s `OntologyView`, which T030 consumes and never rebuilds. */
export function asView(value: unknown, where: string): OntologyView {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} returned ${describe_(value)}; the contract publishes Promise<OntologyView>.`);
  }
  const v = value as Partial<OntologyView>;
  for (const method of ["get", "resolve", "isA", "ancestors", "children", "byKind", "validate"] as const) {
    if (typeof v[method] !== "function") {
      throw new Error(
        `${where} returned a view with no \`${method}\`; \`@/lib/core\`'s OntologyView declares ` +
          `it, and backend.md §T030 says \`ontologyView\` "is the merge and is **consumed, ` +
          `never reimplemented**".`,
      );
    }
  }
  if (v.ontology === null || typeof v.ontology !== "object") {
    throw new Error(`${where} returned a view whose \`ontology\` is ${describe_(v.ontology)}.`);
  }
  return v as OntologyView;
}

export function asDiagnostics(value: unknown, where: string): Diagnostic[] {
  if (!Array.isArray(value)) {
    throw new Error(`${where} returned ${describe_(value)}; the contract publishes Diagnostic[].`);
  }
  for (const [i, d] of value.entries()) {
    if (d === null || typeof d !== "object") {
      throw new Error(`${where}[${i}] is ${describe_(d)}; every entry is a Diagnostic.`);
    }
    const { code, severity, message } = d as { code?: unknown; severity?: unknown; message?: unknown };
    if (typeof code !== "string" || code === "") {
      throw new Error(`${where}[${i}] has \`code\` = ${JSON.stringify(code)}; Diagnostic.code is a DiagnosticCode.`);
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

export function codes(ds: readonly Diagnostic[]): string[] {
  return ds.map((d) => d.code);
}

export function of(ds: readonly Diagnostic[], code: string): Diagnostic[] {
  return ds.filter((d) => d.code === code);
}

/* --------------------- the rejection contract --------------------- */

/**
 * "No rejection carries the statement or its parameters, whatever its SQLSTATE … a typed
 * `Error` whose own properties are exactly `["message", "cause"]`, with `cause` non-enumerable
 * so `JSON.stringify` cannot reach it."
 *
 * Checked over every rendering a log line or an error reporter would actually reach for, because
 * a `message` that is clean while `JSON.stringify(err)` carries the whole INSERT has leaked. The
 * `forbidden` list is what the caller planted: a sentinel it put in a field that is not an
 * identifier, so a message legitimately naming the caller's own version or term id still passes.
 */
export function expectSealedError(
  err: unknown,
  supplied: readonly string[],
  where: string,
): Error {
  // The clause admits identifiers the caller supplied and refuses its content. A `SENTINEL-`
  // string is content by convention in this suite; everything else the test hands over is an
  // identifier it legitimately expects to be named back.
  const content = supplied.filter((x) => x.startsWith("SENTINEL-"));
  const identifiers = supplied.filter((x) => !x.startsWith("SENTINEL-"));
  if (!(err instanceof Error)) {
    throw new Error(`${where} rejected with ${describe_(err)}; the contract requires a typed Error.`);
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

  // (4). `stack` is RETAINED. This replaced "own properties exactly [message, cause]", which was
  // unsatisfiable: `stack` is an own property of every `new Error()` in V8, so the old wording
  // could only be met by deleting it and costing every real failure its trace.
  if (!Object.prototype.hasOwnProperty.call(err, "stack") || typeof err.stack !== "string" || err.stack === "") {
    throw new Error(
      `${where} rejected with an Error carrying no \`stack\`. The clause requires it retained, ` +
        `not deleted: an error nobody can locate is a worse outcome than one that says too much.`,
    );
  }

  // (5). The whitelist, and it is asserted at **token granularity against a constructively
  // derived set** rather than by scanning for a list of forbidden fragments.
  //
  // The clause was restated as a whitelist because "forbid these five things" leaves the sixth
  // unenumerated. A blacklist *test* of a whitelist *clause* is still a blacklist, and it has the
  // over-match failure the whitelist exists to remove: this suite scanned for `ontology_version`,
  // which is a substring of `ontology_version_version_key` — the constraint name this contract
  // requires the module to tie to `getTableConfig`. So both halves are now derived:
  //
  //   the deny set    every word in the *actual driver error* this rejection carries on `cause`
  //   the allow set   the caller's own identifiers, plus every table, index and column name
  //                   `getTableConfig` reports for the two tables this task owns
  //
  // Comparison is word-by-word, not substring, so `ontology_version` and
  // `ontology_version_version_key` are different tokens and the over-match cannot recur even in
  // principle. Nothing is hand-listed on either side, so a sixth thing nobody thought of is
  // caught the moment the driver puts it in its own error.
  const renderings: Record<string, string> = {
    message: err.message,
    "String(err)": String(err),
    "JSON.stringify(err)": serialised,
    "JSON.stringify({ detail: err.message })": JSON.stringify({ detail: err.message }),
    "own-property enumeration": keys.join(" "),
  };

  // **The pass is unconditional; only its SOURCE varies.**
  //
  // This used to sit inside `if (cause !== undefined && cause !== null)`, which meant the whole
  // admissibility check existed only for errors that had reached the database. Every refusal
  // raised *before* the driver — which is most of the validation surface — went unexamined, and
  // silently, because a sealed error defines `cause` as a non-enumerable own property even when
  // nothing was passed. That is the M1 species in the helper rather than in a test: a check that
  // cannot examine the subject that does not supply the shape it keys on.
  //
  // So the deny set is a union of two derived halves, and an empty half is empty by
  // construction rather than skipped by a branch:
  //
  //   driver values   what the driver error identifies, when there is one (empty otherwise)
  //   caller content  what the caller handed over that is NOT an identifier — its `description`
  //                   here — which no message may echo whether or not a database was touched
  const cause: unknown = (err as { cause?: unknown }).cause;
  const admissible = new Set([...moduleIdentifiers(), ...wordsOf(identifiers.join(" "))]);
  const deny = new Map<string, string>();
  for (const word of driverValues(cause)) {
    if (!admissible.has(word)) deny.set(word, "the driver error on `cause`");
  }
  for (const word of wordsOf(content.join(" "))) {
    if (!admissible.has(word)) deny.set(word, "the caller's own content");
  }

  for (const [name, text] of Object.entries(renderings)) {
    const echoed = [...wordsOf(text)].filter((word) => deny.has(word));
    if (echoed.length > 0) {
      throw new Error(
        `${where}: \`${name}\` carries ${JSON.stringify(echoed.join(" "))}, which came from ` +
          `${deny.get(echoed[0])} and is neither an identifier the caller supplied nor a name ` +
          `\`getTableConfig\` reports for this task's tables. The clause admits only a fixed ` +
          `message naming the operation, the caller's own identifiers, and counts of the ` +
          `caller's own inputs.`,
      );
    }
  }

  // Content is also checked whole, not only word by word: a nonce is one token to `wordsOf` only
  // if it happens to tokenise that way, and a substring check on a nonce cannot over-match.
  for (const nonce of content) {
    for (const [name, text] of Object.entries(renderings)) {
      if (nonce !== "" && text.includes(nonce)) {
        throw new Error(
          `${where}: \`${name}\` echoes the caller's content back. Only identifiers the caller ` +
            `supplied are admissible, and this was planted in a description.`,
        );
      }
    }
  }
  return err;
}

/** Words long enough to mean something. Compared as words, never as substrings. */
const WORD = /[a-z_][a-z0-9_]{3,}/g;

function wordsOf(text: string): Set<string> {
  return new Set(text.toLowerCase().match(WORD) ?? []);
}

/**
 * Every identifier this module may legitimately name, read from the schema rather than listed,
 * **including the components of each name**.
 *
 * "A constraint name the module ties to `getTableConfig` is the module's own identifier and is
 * not a leak." `WORD` keeps underscores, so the schema contributes `ontology_term` and
 * `term_id` and never the bare token `term` — which made a word that is a *component* of a
 * schema name inadmissible while the schema name itself was admissible, and reddened a module
 * message for using the domain noun from its own published signature. Splitting closes it.
 */
function moduleIdentifiers(): Set<string> {
  const out = new Set<string>();
  const add = (name: string) => {
    for (const word of wordsOf(name)) out.add(word);
    for (const part of name.toLowerCase().split(/[^a-z0-9]+/)) if (part.length >= 3) out.add(part);
  };
  for (const table of [schema.ontologyVersion, schema.ontologyTerm]) {
    const config = getTableConfig(table);
    add(config.name);
    for (const index of config.indexes) add(index.config.name ?? "");
    for (const column of config.columns) add(column.name);
  }
  return out;
}

/**
 * What the driver error *identifies*, never what it says.
 *
 * The deny set used to be every word in the driver's rendering, prose included, which made a
 * module's fixed English depend on PostgreSQL's English. `"…is already published"` was flagged
 * because `detail` says `"Key (version)=(0.1.0) already exists"` — two ordinary sentences about
 * the same situation sharing an ordinary word, read as derivation because they co-occurred.
 * Neither the contract nor the module controls that wording, and it moves with a server upgrade
 * or an `lc_messages` change.
 *
 * So this reads only the structured fields and the statement: the things that identify *this*
 * error and could reach an output only by leaking. `severity` is deliberately absent — its value
 * is the word "ERROR", which identifies nothing and collides with every `Error`.
 */
const IDENTIFYING = ["code", "constraint", "table", "column", "schema", "routine", "file", "query", "sql"] as const;

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

/** The one path where a `cause` genuinely exists to carry: a refusal the database raised. */
/** Run `call`, require it to reject, and hold the rejection to the whole error-hygiene clause. */
export async function rejects(
  call: () => Promise<unknown>,
  supplied: readonly string[],
  where: string,
): Promise<Error> {
  let result: unknown;
  try {
    result = await call();
  } catch (err) {
    return expectSealedError(err, supplied, where);
  }
  throw new Error(`${where} resolved with ${describe_(result)} where the contract requires a refusal.`);
}

/** The one path where a `cause` genuinely exists to carry: a refusal the database raised. */
export function expectCausePresent(err: Error, where: string): void {
  // `hasOwnProperty` is not enough and this was measured, not reasoned: a sealed error defines
  // `cause` as a non-enumerable own property *even when nothing was passed*, so the property
  // exists on every refusal this module raises. A variant that checked existence before the bump
  // — making a republish refusal causeless, which is the exact defect this test guards — reddened
  // **nothing**. The guard could not fail. The value has to be defined, not merely the key.
  const descriptor = Object.getOwnPropertyDescriptor(err, "cause");
  if (descriptor === undefined || descriptor.value === undefined) {
    throw new Error(
      `${where} rejected with an Error carrying no \`cause\` value` +
        `${descriptor === undefined ? "" : " (the property is defined, but it is `undefined`)"}.\n` +
        `  A refusal the database raised carries the driver error underneath it; one this module ` +
        `raised for itself does not. So this distinguishes *which* refusal arrived, which is the ` +
        `only observable difference between the duplicate rule and the bump rule when both apply.`,
    );
  }
}

/**
 * Run a call whose rejection this test does not care about, and wait for it either way.
 *
 * A bound function returns `unknown`, so `add(...).catch(...)` does not typecheck; awaiting
 * through here keeps the "and then look at what is in the database" tests readable without
 * casting the return type of every published function at every call site.
 */
export async function swallow(call: () => unknown): Promise<void> {
  try {
    await call();
  } catch {
    /* the assertion that follows is about the store, not about this rejection */
  }
}

/**
 * A stack overflow is never an acceptable answer.
 *
 * "Write the walk iteratively from the start — an explicit stack with path-scoped cycle
 * detection, not recursion. T010 shipped a recursive walk that closed cycles and still died with
 * `RangeError` at 20 000 deep, and a 120 KB request body reaches that depth."
 */
export function notARangeError(err: unknown, where: string): void {
  if (err instanceof RangeError || (err instanceof Error && /call stack|stack size/i.test(err.message))) {
    throw new Error(
      `${where} died with a stack overflow: ${(err as Error).message}. The well-formedness walk ` +
        `has to be iterative from the start.`,
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
