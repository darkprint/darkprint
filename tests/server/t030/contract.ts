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

import type { Diagnostic, OntologyTerm, OntologyView, Severity } from "@/lib/core";

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
export function expectSealedError(err: unknown, forbidden: readonly string[], where: string): Error {
  if (!(err instanceof Error)) {
    throw new Error(`${where} rejected with ${describe_(err)}; the contract requires a typed Error.`);
  }
  const own = Object.getOwnPropertyNames(err).sort();
  const expected = ["cause", "message"];
  if (own.join(",") !== expected.join(",")) {
    throw new Error(
      `${where} rejected with an Error whose own properties are [${own.join(", ")}]; the ` +
        `contract requires exactly ["message", "cause"]. A \`stack\`, a \`code\`, a \`detail\` ` +
        `or a \`query\` here is the driver's error escaping under a new name.`,
    );
  }
  const causeDescriptor = Object.getOwnPropertyDescriptor(err, "cause");
  if (causeDescriptor?.enumerable !== false) {
    throw new Error(
      `${where} rejected with an Error whose \`cause\` is enumerable; the contract requires it ` +
        `non-enumerable so \`JSON.stringify\` cannot reach the driver's error through it.`,
    );
  }

  const renderings: Record<string, string> = {
    message: err.message,
    "String(err)": String(err),
    "JSON.stringify(err)": JSON.stringify(err) ?? "",
    "own-property enumeration": Object.keys(err).join(" "),
    "JSON.stringify(Object.entries(err))": JSON.stringify(Object.entries(err)),
  };
  for (const [name, text] of Object.entries(renderings)) {
    for (const secret of forbidden) {
      if (text.includes(secret)) {
        throw new Error(
          `${where}: \`${name}\` leaks ${JSON.stringify(secret)}. Nothing the caller handed over ` +
            `may reach a rendering of the error — not the statement, not a bound parameter, not ` +
            `a SQLSTATE.`,
        );
      }
    }
    // SQLSTATE is five alphanumerics; the codes this module can raise are 23505, 22021, 23503
    // and 22P02, and none of them is a thing a caller should have to read.
    for (const sqlstate of ["23505", "22021", "23503", "22P02", "22001", "42601"]) {
      if (text.includes(sqlstate)) {
        throw new Error(`${where}: \`${name}\` carries SQLSTATE ${sqlstate}.`);
      }
    }
  }
  return err;
}

/** Run `call`, require it to reject, and hold the rejection to the sealed-error contract. */
export async function rejects(
  call: () => Promise<unknown>,
  forbidden: readonly string[],
  where: string,
): Promise<Error> {
  let result: unknown;
  try {
    result = await call();
  } catch (err) {
    return expectSealedError(err, forbidden, where);
  }
  throw new Error(`${where} resolved with ${describe_(result)} where the contract requires a refusal.`);
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
 * "**Write the walk iteratively from the start** — an explicit stack with path-scoped cycle
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
