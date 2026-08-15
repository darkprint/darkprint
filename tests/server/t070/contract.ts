/* ============================================================
   T070 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this module is imported by the suites beside it.

   ── round 2, and why this file changed shape ──
   D-70-12 re-opened this suite. The measurement behind it: across
   twelve mutations against the whole tree, every newly-red line was
   under `lib/server/naming/**` or `app/api/names/**` and not one was
   under `tests/server/t070/**`. Twenty-seven behaviours were held by
   the implementer's colocated tests alone — `reason` at both refusal
   sites, the length bound, the fault doors, both routes, and the
   unknown-owner sentinel. All of them arrived as contract AFTER this
   suite was written, which is the mechanism recorded at "an
   amendment writes signatures against a tree that already exists".

   ── what the rulings removed from this file ──
   D-70-01 settled the question round 1 reported rather than resolved:
   **`checkSlug` is a query and returns; `SlugTakenError` and
   `ReservedSlugError` are struck.** So the dual-reading tolerance
   `refusalOf` carried is now an OVER-tolerance — a `checkSlug` that
   throws must red — and the two message literals are gone rather
   than left standing beside the ruling that removed them. `Availability`
   gained `reason` so a caller that can no longer catch a class has
   the discriminator in the value, and D-70-14a gave it its third
   member, `"illegal"`.

   ── the message pins are still LITERALS ──
   Every expected string below is written out here and never imported
   from `@/lib/server/naming`. An expectation built from the module
   under test asserts "does the module agree with itself" and passes
   unchanged if the template starts interpolating a driver value. A
   later change that derives one of these from the module is a
   REMOVED ASSERTION and is to be treated as one.
   ============================================================ */

import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getRouteMatcher } from "next/dist/shared/lib/router/utils/route-matcher.js";
import { getRouteRegex } from "next/dist/shared/lib/router/utils/route-regex.js";

import type { Diagnostic, Severity } from "@/lib/core";
import { createTestDb, type TestDb } from "@/tests/support";

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
      `  This is a failed acceptance criterion, not a naming difference. Do not add a synonym ` +
      `here; publish the name the contract states.`,
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

/** D-70-14a gave the union its third member. `"illegal"` is a name the grammar refuses. */
export const REASONS = ["taken", "reserved", "illegal"] as const;
export type Reason = (typeof REASONS)[number];

export interface Availability {
  available: boolean;
  reason?: Reason;
  suggestion?: string;
}

/**
 * `interface Availability { available: boolean; reason?: "taken" | "reserved" | "illegal"; suggestion?: string }`
 *
 * The return type is part of the published signature, so a wrong shape is a red rather than a
 * broken test. Three things are checked and each is a way the type has already been got wrong
 * somewhere in this run: `available` is a **boolean** and not a truthy value, since a store
 * answering `undefined` for "I found no row" makes every `if (!a.available)` treat a free name
 * as taken; `reason` is a member of the published union and not free prose, since a caller
 * switches on it; and no member outside the three exists, because the published shape is the
 * whole shape and an extra field is a second declaration by another route.
 */
export function asAvailability(value: unknown, where: string): Availability {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${where} returned ${describe_(value)}; the contract publishes Promise<Availability>, ` +
        `i.e. { available: boolean; reason?: "taken" | "reserved" | "illegal"; suggestion?: string }.`,
    );
  }
  const a = value as Partial<Availability>;
  if (typeof a.available !== "boolean") {
    throw new Error(
      `${where} returned \`available\` = ${JSON.stringify(a.available)} ` +
        `(${describe_(a.available)}); Availability.available is declared \`boolean\`.`,
    );
  }
  if (a.reason !== undefined && !REASONS.includes(a.reason)) {
    throw new Error(
      `${where} returned \`reason\` = ${JSON.stringify(a.reason)}; D-70-14a publishes the union ` +
        `as exactly ${REASONS.map((r) => JSON.stringify(r)).join(" | ")}. A caller switches on ` +
        `this value, so a fourth member is a value nobody handles.`,
    );
  }
  if (a.suggestion !== undefined && (typeof a.suggestion !== "string" || a.suggestion === "")) {
    throw new Error(
      `${where} returned \`suggestion\` = ${JSON.stringify(a.suggestion)}; Availability.suggestion ` +
        `is \`string | undefined\`, and an empty string is not a name anybody can claim.`,
    );
  }
  const extra = Object.keys(a).filter((k) => !["available", "reason", "suggestion"].includes(k));
  if (extra.length > 0) {
    throw new Error(
      `${where} returned an Availability carrying ${extra.map((k) => `\`${k}\``).join(", ")}. ` +
        `The published interface has three members and a fourth is a second declaration of one ` +
        `shape — which is what D-70-10 was charged for.`,
    );
  }
  return a as Availability;
}

/**
 * A name the module says is not available, in the one shape D-70-01 leaves for saying so.
 *
 * Round 1 tolerated either a returned `{ available: false }` or a throw, because the contract
 * published both and settled neither. **D-70-01 settled it**: "`checkSlug` is a query and
 * returns; both error classes are struck. A query asked 'is this available' answers, and one
 * that throws to say 'no' makes its own return type meaningless." So the tolerance is gone and a
 * throw here is a red — keeping it would be a suite carrying a withdrawn clause, which is the
 * exact failure recorded at "Resolving `backend.md`".
 */
export async function unavailable(
  call: () => unknown,
  where: string,
  expected?: Reason,
): Promise<Availability> {
  let result: unknown;
  try {
    result = await call();
  } catch (err) {
    throw new Error(
      `${where} THREW where the contract requires it to answer.\n` +
        `  ${err instanceof Error ? err.message : describe_(err)}\n` +
        `  D-70-01: "\`checkSlug\` is a query and returns; both error classes are struck." ` +
        `\`SlugTakenError\` and \`ReservedSlugError\` no longer exist, and a refusal is ` +
        `\`{ available: false, reason }\`.`,
      { cause: err },
    );
  }
  const availability = asAvailability(result, where);
  if (availability.available) {
    throw new Error(
      `${where} answered \`{ available: true }\` where the name is not available.`,
    );
  }
  if (expected !== undefined && availability.reason !== expected) {
    throw new Error(
      `${where} answered \`{ available: false, reason: ${JSON.stringify(availability.reason)} }\` ` +
        `where the contract requires \`${expected}\`.\n` +
        `  D-70-14a: the reason exists so "a caller could tell 'not legal' from 'I did not say'". ` +
        `An absent reason on a refusal is the defect that ruling was written for; a wrong one is ` +
        `the same defect with a value in it.`,
    );
  }
  return availability;
}

/** A name the module says is free. Asserted with the same shape checks, in the other direction. */
export async function availableNow(call: () => unknown, where: string): Promise<Availability> {
  const availability = asAvailability(await call(), where);
  if (!availability.available) {
    throw new Error(
      `${where} answered \`{ available: false, reason: ${JSON.stringify(availability.reason)} }\` ` +
        `where the name is free.`,
    );
  }
  return availability;
}

/* --------------------- the admissible message forms --------------------- */

/*
 * backend.md §T070, after D-70-01 struck two of the five and D-70-05 added one:
 *
 *     HandleTakenError      "allocateHandle: the handle `<handle>` is not available."
 *     NamingStoreError      "<operation>: the database call failed."
 *     InvalidNameError      "<operation>: `<value>` is not a valid <kind>."
 *
 * Literals. Never imported from the module.
 */

export function handleTakenMessage(handle: string): string {
  return `allocateHandle: the handle \`${handle}\` is not available.`;
}

/**
 * D-70-05's fifth form. Every slot is filled by the contract — the operation is the published
 * function name — so this is an EQUALITY pin, which is the strongest available and the one the
 * clause exists to enable: "a fault has to leave and must not carry `DrizzleQueryError.message`".
 */
export function storeFailureMessage(operation: string): string {
  return `${operation}: the database call failed.`;
}

/**
 * The one form with a slot the contract does not fill.
 *
 * `<kind>` is unenumerated — the contract never says whether an invalid handle is "a valid
 * handle", "a valid name" or "a valid identifier" — so this path gets a prefix-and-shape pin
 * rather than an equality one, and says so. Pinning an invented `<kind>` would be a candidate
 * list wearing an exact-match's clothes. Still open; reported again this round.
 */
export function invalidNamePrefix(operation: string, value: string): string {
  return `${operation}: \`${value}\` is not a valid `;
}

/* --------------------- the rejection contract --------------------- */

export interface SealedExpectation {
  /** The full published form, every slot filled. Exact equality. */
  expectedMessage?: string;
  /** The published form with an unenumerated slot. Prefix equality plus a trailing period. */
  expectedPrefix?: string;
}

/**
 * D-13's four parts, in the order `tests/error-hygiene.test.ts` enumerates them.
 *
 * That guard quantifies the same clause over every error class exported from any `lib/server/*`
 * barrel, by construction — so it covers T070's classes the day they exist, and this function
 * covers something it structurally cannot: the clause **as observed on an error a caller
 * actually received**, from the path production takes. A class that satisfies the clause when
 * constructed directly and violates it when raised through `allocateHandle` passes there and
 * reds here. The two are not redundant; they measure the same property at two distances.
 *
 * The fourth part — `stack` retained — is invisible to any enumerable-surface walk, which is
 * how it was missed before that guard existed.
 */
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

  const keys = Object.keys(err);
  if (keys.length !== 0) {
    throw new Error(
      `${where} rejected with an Error whose \`Object.keys\` is [${keys.join(", ")}]; D-13 ` +
        `requires it empty. A \`code\`, a \`detail\`, a \`query\`, a \`params\` — or a \`name\` ` +
        `and a \`kind\` assigned in the constructor, which is how \`ArchiveConflictError\` broke ` +
        `this clause in a task that had already merged — all show up here.`,
    );
  }
  const serialised = JSON.stringify(err);
  if (serialised !== "{}") {
    throw new Error(
      `${where} rejected with an Error serialising to ${serialised}; the clause requires exactly "{}".`,
    );
  }
  if (Object.prototype.propertyIsEnumerable.call(err, "cause")) {
    throw new Error(
      `${where} rejected with an Error whose \`cause\` is enumerable; the clause requires it ` +
        `non-enumerable, which is what keeps \`JSON.stringify\` from reaching the driver's error.`,
    );
  }
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
          `  where §T070 publishes InvalidNameError as ` +
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
 * error on `cause` identifies, and the allow set is the caller's own values. Unconditional by
 * construction — when the rejection carries no driver error the deny set is empty rather than
 * the check being skipped.
 */
export function assertNoDriverLeak(err: Error, supplied: readonly string[], where: string): void {
  const admissible = new Set<string>();
  for (const value of supplied) for (const word of wordsOf(value)) admissible.add(word);
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
          `"the operation, the caller's own value, and the fixed forms above".`,
      );
    }
  }
}

/**
 * Words long enough to mean something. Compared as words, never as substrings.
 *
 * The leading class admits a digit on purpose: an identifier-shaped `[a-z_][a-z0-9_]{3,}`
 * produces no token at all from `"23505"`, so a SQLSTATE could never appear on either side of
 * the comparison while the clause names one among the things no rendering may carry.
 */
const WORD = /[a-z0-9_][a-z0-9_]{3,}/g;

function wordsOf(text: string): Set<string> {
  return new Set(text.toLowerCase().match(WORD) ?? []);
}

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
  "detail",
  "where",
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
 */
export function expectCausePresent(err: Error, where: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(err, "cause");
  if (descriptor === undefined || descriptor.value === undefined) {
    throw new Error(
      `${where} rejected with an Error carrying no \`cause\` value` +
        `${descriptor === undefined ? "" : " (the property is defined, and it is `undefined`)"}.\n` +
        `  §T070: "\`allocateHandle\` is a **single insert** whose conflict is caught and ` +
        `translated; the primary key is the arbiter." A refusal the index raised carries the ` +
        `driver error underneath it; one a read-then-write pre-check raised does not.`,
    );
  }
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

/* ============================================================
   The two routes D-70-03 publishes

       GET /api/names/handles/[handle]       -> { available, reason?, suggestion? }
       GET /api/names/slugs/[owner]/[slug]   -> { available, reason?, suggestion? }

   "Both 200 with the `Availability` payload; there is no 404,
   because 'not found' **is** the available answer."

   Discovered by walking the tree rather than by importing a guessed
   path, and dispatched through Next's own matcher, so a red says
   "this URL is unserved" rather than "a file is missing from where I
   looked". The file layout is the implementation's; the URL is the
   contract's.
   ============================================================ */

export const ROUTES = {
  handle: {
    url: "GET /api/names/handles/[handle]",
    sample: (handle: string) => `/api/names/handles/${encodeURIComponent(handle)}`,
  },
  slug: {
    url: "GET /api/names/slugs/[owner]/[slug]",
    sample: (owner: string, slug: string) =>
      `/api/names/slugs/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
  },
} as const;

export type RouteName = keyof typeof ROUTES;

interface DiscoveredRoute {
  pattern: string;
  file: string;
}

const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;
const NAMES_ROOT = fileURLToPath(new URL("../../../app/api/names/", import.meta.url));

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
      out.push({ pattern: `/api/names/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

function routeTable(): DiscoveredRoute[] {
  if (table !== undefined) return table;
  const found: DiscoveredRoute[] = [];
  walk(NAMES_ROOT, [], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under \`app/api/names/\`.\n` +
        `  D-70-03 publishes two: \`${ROUTES.handle.url}\` and \`${ROUTES.slug.url}\`, both ` +
        `200 with the Availability payload.\n` +
        `  \`app/api/names/**\` is in T070's \`Owns\` set, so this is a failed acceptance ` +
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

/** Which published pattern serves a URL, asked without importing a module or opening a database. */
export function routePatternFor(path: string): string {
  return matchRoute(path).route.pattern;
}

/**
 * Drive a published URL the way a caller does: matched through Next's router, dispatched to
 * whichever file wins, and invoked with `params` as a promise
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`:
 * "**`params`**: a promise that resolves to an object containing the dynamic route parameters").
 *
 * `name` names the published route only so a red can quote the contract; it takes no part in
 * choosing the module, so a route shadowed by a sibling dispatches here exactly as it would in
 * production.
 */
export async function callRoute(name: RouteName, path: string): Promise<Response> {
  const spec = ROUTES[name];
  const { route, params } = matchRoute(path);
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(
      `\`${route.pattern}\` — the route serving \`${path}\` — does not load.\n` +
        `  Driving the published URL \`${spec.url}\`.`,
      { cause },
    );
  }
  const get = mod.GET;
  if (typeof get !== "function") {
    throw new Error(
      `\`${route.pattern}\` exports no \`GET\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}). D-70-03 publishes the method.`,
    );
  }
  const request = new Request(`https://darkprint.test${path}`);
  const answered = await (get as UnknownFn)(request, { params: Promise.resolve(params) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${spec.url}\` answered ${describe_(answered)}; a route handler returns a Response.`,
    );
  }
  return answered;
}

/**
 * The whole of a route's answer, as a caller sees it, kept together so two answers can be
 * compared for indistinguishability rather than only for their payload.
 *
 * `body` is the raw text and not the parsed object: D-70-14b's fall-out property is that an
 * unknown owner is not distinguishable from an existing one holding no bundles, and a
 * difference in key order or in an extension member distinguishes them just as well as a
 * different value would.
 */
export interface RouteAnswer {
  status: number;
  contentType: string | null;
  body: string;
}

export async function answerOf(name: RouteName, path: string): Promise<RouteAnswer> {
  const response = await callRoute(name, path);
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
}

/** The `Availability` a route answered with, held to the same shape as the module's. */
export function payloadOf(answer: RouteAnswer, where: string): Availability {
  if (answer.status !== 200) {
    throw new Error(
      `${where} answered ${answer.status}. D-70-03: "Both 200 with the \`Availability\` payload; ` +
        `there is no 404, because 'not found' **is** the available answer."\n` +
        `  body: ${answer.body.slice(0, 400)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(answer.body);
  } catch (cause) {
    throw new Error(`${where} answered a body that is not JSON: ${answer.body.slice(0, 200)}`, {
      cause,
    });
  }
  return asAvailability(parsed, where);
}

/* --------------------- the database a route reads --------------------- */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the first parameter of every T070 function that takes one. */
  db: unknown;
  /** This scratch database's connection string, for the routes' shared client. */
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

/**
 * A scratch database, plus the URL a route handler needs to reach it.
 *
 * `createTestDb` does not hand back the URL it built, and the route half of this suite needs
 * one: `getSharedDbClient()` reads `DATABASE_URL`, so a route can only be pointed at this
 * database by naming it. Asked of the connection itself rather than rebuilt from a convention.
 */
export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(`createTestDb's client carries no \`db\`.`);
  }
  const [current] = (await test.client.query("select current_database() as name")).rows as {
    name?: unknown;
  }[];
  const database = current?.name;
  if (typeof database !== "string" || database === "") {
    throw new Error(
      `\`select current_database()\` answered ${describe_(database)}, so the route handlers ` +
        `cannot be pointed at this scratch database.`,
    );
  }
  const base = new URL(process.env.DATABASE_URL ?? "");
  base.pathname = `/${database}`;

  return {
    db,
    url: base.toString(),
    query: async (sql, params) => {
      const result = await test.client.query(sql, params as unknown[]);
      return result.rows as Record<string, unknown>[];
    },
  };
}

export async function dropScratchDatabases(): Promise<number> {
  let dropped = 0;
  for (const test of open.splice(0)) {
    await test.drop();
    dropped += 1;
  }
  return dropped;
}
