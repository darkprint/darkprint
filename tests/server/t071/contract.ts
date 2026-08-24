/* ============================================================
   T071 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this module is imported by the suites beside it.

   ── why this file exists beside `tests/server/t070/contract.ts` ──
   T070's contract surface is a consultable precedent and every
   driver-level idiom below is taken from it. It is NOT imported.
   A blind suite that imports its predecessor's expectations inherits
   its predecessor's readings, and this run has already priced that
   once: "a reference or oracle written by the author of the
   assertions is a consistency check, not a second axis". T070's
   surface was written by T070's blind author; if it and this file
   agree about a published form, that agreement is evidence. If this
   file were `export * from "../t070/contract"` it would be nothing.

   So every literal here is written out again from `backend.md`
   §T070 and §T071 rather than re-exported, and where the two files
   differ the difference is a finding rather than a merge conflict.

   ── the published block this task adds ──
   D-071-01(4): "`MAX_HANDLE_LENGTH IS PUBLISHED, on the barrel` —
   `index.ts` granted for the one name … this line is the section's
   published-signatures block: `MAX_HANDLE_LENGTH = 32`, exported
   from `@/lib/server/naming`."

   That is the whole of T071's published surface. The predicate that
   enforces it is explicitly NOT published — "the new predicate's
   spelling is the implementer's; it need not reach the barrel" — so
   nothing here binds a name for it and every assertion about the
   bound is made through the two doors instead.
   ============================================================ */

import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getRouteMatcher } from "next/dist/shared/lib/router/utils/route-matcher.js";
import { getRouteRegex } from "next/dist/shared/lib/router/utils/route-regex.js";

import type { Diagnostic } from "@/lib/core";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const NAMING = "@/lib/server/naming";

let naming: Promise<Namespace> | undefined;

/**
 * Memoised as the PROMISE, rejection included.
 *
 * A module that is absent stays absent for the whole run, and every cell that awaits it gets
 * its own copy of the same red rather than one cell's failure surfacing as an unhandled
 * rejection somewhere else.
 */
export function loadNaming(): Promise<Namespace> {
  naming ??= import("@/lib/server/naming").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${NAMING} does not load.\n` +
          `  backend.md §T071 publishes \`MAX_HANDLE_LENGTH = 32\` on this barrel and enforces ` +
          `the bound at \`checkHandle\` and \`allocateHandle\`, both of which §T070 publishes ` +
          `here.\n` +
          `  This is a failed acceptance criterion — the namespace module is absent — and not ` +
          `a broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return naming;
}

/* --------------------- what the two sections publish --------------------- */

/**
 * The three names T071's criteria drive, quoted from §T070's Published signatures block so a
 * red says where the name comes from. Written out rather than imported — see the header.
 */
export const PUBLISHED = {
  checkHandle: "checkHandle(db: Db, handle: string): Promise<Availability>",
  allocateHandle: "allocateHandle(db: Db, accountId: string, handle: string): Promise<void>",
  checkSlug: "checkSlug(db: Db, ownerId: string, slug: string): Promise<Availability>",
  validateCardId: "validateCardId(id: string): Diagnostic[]       // pure, grammar only",
  validateNamespace: "validateNamespace(namespace: string): Diagnostic[]   // pure",
} as const;

export type PublishedName = keyof typeof PUBLISHED;

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

/**
 * A published name, or a red that enumerates what the barrel actually has.
 *
 * The enumeration is not decoration. A type-level or value-level instrument cannot observe its
 * own blindness, and "the member is absent" and "the assertion failed" are the two readings a
 * bare `expect(mod.X).toBe(...)` collapses into one. Printing the found set is what separates
 * them without a second source-reading cell.
 */
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

export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadNaming();
  return asFn(requireFrom(mod, name, PUBLISHED[name]), name, PUBLISHED[name]);
}

/* --------------------- the two constants, and the rule about using them --------------------- */

/**
 * §T071's published-signatures line, D-071-01(4). Quoted so a red names the ruling.
 */
export const PUBLISHED_MAX_HANDLE_LENGTH =
  "MAX_HANDLE_LENGTH = 32, exported from `@/lib/server/naming`   // D-071-01(4)";

/** §T070's, D-70-17. Unchanged by T071 and asserted so by AC3. */
export const PUBLISHED_MAX_NAME_LENGTH =
  "const MAX_NAME_LENGTH = 255   // D-70-15/D-70-16. A STORAGE bound, not a product one.";

export async function bindMaxHandleLength(): Promise<unknown> {
  return requireFrom(await loadNaming(), "MAX_HANDLE_LENGTH", PUBLISHED_MAX_HANDLE_LENGTH);
}

export async function bindMaxNameLength(): Promise<unknown> {
  return requireFrom(await loadNaming(), "MAX_NAME_LENGTH", PUBLISHED_MAX_NAME_LENGTH);
}

/* --------------------- the shape the contract publishes back --------------------- */

/** D-70-14a's three members. Unchanged by T071: "this is the existing `illegal` path". */
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
 * `available` must be a genuine boolean — a store answering `undefined` for "I found no row"
 * makes every `if (!a.available)` treat a free name as taken. `reason` must be a member of the
 * published union, since a caller switches on it. And no fourth member exists, because the
 * published shape is the whole shape.
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
        `as exactly ${REASONS.map((r) => JSON.stringify(r)).join(" | ")}.`,
    );
  }
  if (a.suggestion !== undefined && (typeof a.suggestion !== "string" || a.suggestion === "")) {
    throw new Error(
      `${where} returned \`suggestion\` = ${JSON.stringify(a.suggestion)}; ` +
        `Availability.suggestion is \`string | undefined\`, and an empty string is not a name ` +
        `anybody can claim.`,
    );
  }
  const extra = Object.keys(a).filter((k) => !["available", "reason", "suggestion"].includes(k));
  if (extra.length > 0) {
    throw new Error(
      `${where} returned an Availability carrying ${extra.map((k) => `\`${k}\``).join(", ")}. ` +
        `The published interface has three members and a fourth is a second declaration of one shape.`,
    );
  }
  return a as Availability;
}

/**
 * A refusal, held to D-70-18 quantified over the refusals rather than per case.
 *
 * The suggestion clause is the half T071 leans on hardest, so it is stated here once and every
 * refusal in this suite passes through it: **required** when `reason` is `"taken"` or
 * `"reserved"`, **forbidden** when `"illegal"`. AC2 is the second half — an over-length handle
 * is ill-formed, so it takes the forbidden branch — and writing it quantified means a fourth
 * refusal path added later cannot slip past by being somewhere nobody wrote a case for.
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
        `  D-70-01: a query asked "is this available" answers; \`checkHandle\` and \`checkSlug\` ` +
        `return \`{ available: false, reason }\` and raise nothing. T071 changes which inputs ` +
        `are refused, never how a refusal is delivered — §T071: "This is the existing ` +
        `\`illegal\` path, not a new one."`,
      { cause: err },
    );
  }
  const availability = asAvailability(result, where);
  if (availability.available) {
    throw new Error(`${where} answered \`{ available: true }\` where the name is not available.`);
  }
  if (availability.reason === undefined) {
    throw new Error(
      `${where} answered \`{ available: false }\` with no \`reason\`.\n` +
        `  D-70-14a exists because "a caller could not tell 'not legal' from 'I did not say'". ` +
        `Every refusal carries one of ${REASONS.map((r) => JSON.stringify(r)).join(" | ")}.`,
    );
  }
  const suggestion = availability.suggestion;
  if (availability.reason === "illegal" && suggestion !== undefined) {
    throw new Error(
      `${where} answered \`{ available: false, reason: "illegal", suggestion: ` +
        `${JSON.stringify(suggestion)} }\`.\n` +
        `  D-70-18 forbids a suggestion on an illegal name: an alternative can only be offered ` +
        `to a name that is itself legal. §T071 AC2 restates it for this bound and names the ` +
        `specific candidate it forbids — "a truncated-to-32 suggestion is specifically not ` +
        `offered — that would hand the caller a name it did not ask for".`,
    );
  }
  if (availability.reason !== "illegal" && suggestion === undefined) {
    throw new Error(
      `${where} answered \`{ available: false, reason: ${JSON.stringify(availability.reason)} }\` ` +
        `with no \`suggestion\`.\n` +
        `  D-70-18 requires one whenever the name asked for is well-formed — \`taken\` and ` +
        `\`reserved\` both.`,
    );
  }
  if (expected !== undefined && availability.reason !== expected) {
    throw new Error(
      `${where} answered \`{ available: false, reason: ${JSON.stringify(availability.reason)} }\` ` +
        `where the contract requires \`${expected}\`.\n` +
        `  The two this suite has to keep apart are \`illegal\` (the grammar, and now the ` +
        `product bound, refused it) and \`taken\` (somebody holds it). A bound implemented by ` +
        `pre-seeding or by a lookup answers the second where the contract requires the first.`,
    );
  }
  return availability;
}

/** The other direction, with the same shape checks. D-70-21 forbids a suggestion here. */
export async function availableNow(call: () => unknown, where: string): Promise<Availability> {
  const availability = asAvailability(await call(), where);
  if (!availability.available) {
    throw new Error(
      `${where} answered \`{ available: false, reason: ${JSON.stringify(availability.reason)}, ` +
        `suggestion: ${JSON.stringify(availability.suggestion)} }\` where the name is free.`,
    );
  }
  if (availability.reason !== undefined) {
    throw new Error(
      `${where} answered \`{ available: true, reason: ${JSON.stringify(availability.reason)} }\`. ` +
        `A name that was not refused has nothing to explain.`,
    );
  }
  if (availability.suggestion !== undefined) {
    throw new Error(
      `${where} answered \`{ available: true, suggestion: ` +
        `${JSON.stringify(availability.suggestion)} }\`. D-70-21 forbids a suggestion beside an ` +
        `available name: there is nothing to suggest an alternative to.`,
    );
  }
  return availability;
}

/* --------------------- the admissible message forms --------------------- */

/*
 * backend.md §T070, quoted:
 *
 *     HandleTakenError      "allocateHandle: the handle `<handle>` is not available."
 *     InvalidNameError      "<operation>: `<value>` is not a valid <kind>."
 *
 * Literals, never imported from the module. An expectation built from the module under test
 * asserts "does the module agree with itself" and passes unchanged if the template starts
 * interpolating a driver value.
 */

export function handleTakenMessage(handle: string): string {
  return `allocateHandle: the handle \`${handle}\` is not available.`;
}

/**
 * `<kind>` is the one slot §T070 never enumerates, so this is a prefix-and-shape pin rather
 * than an equality one, and says so. Pinning an invented `<kind>` would be a candidate list
 * wearing an exact match's clothes. D-70-23 closes `<operation>` to `allocateHandle` and
 * `releaseHandle`; AC1's refusal is the first of those.
 */
export function invalidNamePrefix(operation: string, value: string): string {
  return `${operation}: \`${value}\` is not a valid `;
}

/* --------------------- the rejection contract --------------------- */

export interface SealedExpectation {
  expectedMessage?: string;
  expectedPrefix?: string;
}

/** D-13's four parts, in the order `tests/error-hygiene.test.ts` enumerates them. */
export function expectSealedError(
  err: unknown,
  where: string,
  expectation: SealedExpectation = {},
): Error {
  if (!(err instanceof Error)) {
    throw new Error(
      `${where} rejected with ${describe_(err)}; the contract requires a typed Error carrying ` +
        `any driver error on a non-enumerable \`cause\`.`,
    );
  }
  const keys = Object.keys(err);
  if (keys.length !== 0) {
    throw new Error(
      `${where} rejected with an Error whose \`Object.keys\` is [${keys.join(", ")}]; D-13 ` +
        `requires it empty.`,
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
      `${where} rejected with an Error carrying no \`stack\`. The clause requires it retained.`,
    );
  }
  if (expectation.expectedMessage !== undefined && err.message !== expectation.expectedMessage) {
    throw new Error(
      `${where} rejected with\n` +
        `    message  ${JSON.stringify(err.message)}\n` +
        `  where §T070's admissible message form for this path is\n` +
        `    expected ${JSON.stringify(expectation.expectedMessage)}\n` +
        `  Making this green by importing the module's own template would DELETE the assertion.`,
    );
  }
  if (expectation.expectedPrefix !== undefined) {
    if (!err.message.startsWith(expectation.expectedPrefix) || !err.message.endsWith(".")) {
      throw new Error(
        `${where} rejected with\n` +
          `    message  ${JSON.stringify(err.message)}\n` +
          `  where §T070 publishes InvalidNameError as ` +
          `"<operation>: \`<value>\` is not a valid <kind>." — pinned as far as the contract ` +
          `fills it in:\n` +
          `    expected ${JSON.stringify(expectation.expectedPrefix + "<kind>.")}\n` +
          `  \`<kind>\` is left unpinned deliberately rather than guessed.`,
      );
    }
  }
  return err;
}

/**
 * A refusal raised before any statement is sent defines no `cause` property AT ALL.
 *
 * Not "carries an undefined cause" — the descriptor is the discriminator. A constructor
 * calling `super(message, { cause })` unconditionally passes all four rendering checks while
 * carrying nothing, because a dropped cause and a cause that was never passed render
 * identically. An over-length handle is refused by a length comparison, so there is nothing
 * underneath it and this is the shape that says so.
 */
export function expectNoCausePassed(err: Error, where: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(err, "cause");
  if (descriptor !== undefined) {
    throw new Error(
      `${where} rejected with an Error that defines a \`cause\` property ` +
        `(value: ${describe_(descriptor.value)}). A handle refused for its LENGTH is refused ` +
        `before any statement is sent, so there is no driver error to carry and the property ` +
        `should not exist. If every error has one, "did this refusal come from the database" ` +
        `stops being a question this suite can ask.`,
    );
  }
}

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

/** A call whose outcome this suite does not constrain, awaited either way. */
export async function settled(call: () => unknown): Promise<Error | undefined> {
  try {
    await call();
    return undefined;
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

/* --------------------- diagnostics --------------------- */

export function asDiagnostics(value: unknown, where: string): Diagnostic[] {
  if (!Array.isArray(value)) {
    throw new Error(`${where} returned ${describe_(value)}; the contract publishes Diagnostic[].`);
  }
  return value as Diagnostic[];
}

export function errorsOf(ds: readonly Diagnostic[]): Diagnostic[] {
  return ds.filter((d) => d.severity === "error");
}

/* ============================================================
   The handles route, D-70-03

       GET /api/names/handles/[handle]  ->  { available, reason?, suggestion? }

   "Both 200 with the `Availability` payload; there is no 404,
   because 'not found' **is** the available answer."

   `app/api/names/**` is §T071's Forbidden set, so this route is
   expected to inherit the bound through `checkHandle` and to need no
   change at all. That is exactly why the cell is worth having: it
   costs a correct implementation nothing and it is the one thing
   that catches a route answering availability for itself.

   Discovered by walking the tree and dispatched through Next's own
   matcher, so a red says "this URL is unserved" rather than "a file
   is missing from where I looked".
   ============================================================ */

export const HANDLE_ROUTE = {
  url: "GET /api/names/handles/[handle]",
  pattern: "/api/names/handles/[handle]",
  sample: (handle: string) => `/api/names/handles/${encodeURIComponent(handle)}`,
} as const;

interface DiscoveredRoute {
  pattern: string;
  file: string;
}

const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;
const NAMES_ROOT = fileURLToPath(new URL("../../../app/api/names/", import.meta.url));

let table: DiscoveredRoute[] | undefined;

function walkRoutes(dir: string, segments: string[], out: DiscoveredRoute[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walkRoutes(join(dir, entry.name), [...segments, entry.name], out);
    else if (ROUTE_FILE.test(entry.name)) {
      out.push({ pattern: `/api/names/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

function routeTable(): DiscoveredRoute[] {
  if (table !== undefined) return table;
  const found: DiscoveredRoute[] = [];
  walkRoutes(NAMES_ROOT, [], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under \`app/api/names/\`.\n` +
        `  D-70-03 publishes \`${HANDLE_ROUTE.url}\`, 200 with the Availability payload.`,
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
      `  The contract publishes URLs and the file layout is the implementation's.`,
  );
}

export function routePatternFor(path: string): string {
  return matchRoute(path).route.pattern;
}

export interface RouteAnswer {
  status: number;
  body: string;
}

/**
 * Drive the published URL the way a caller does — matched through Next's router, dispatched to
 * whichever file wins, and invoked with `params` as a promise, per
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`.
 */
export async function answerOf(path: string): Promise<RouteAnswer> {
  const { route, params } = matchRoute(path);
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(
      `\`${route.pattern}\` — the route serving \`${path}\` — does not load.\n` +
        `  Driving the published URL \`${HANDLE_ROUTE.url}\`.`,
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
      `\`${HANDLE_ROUTE.url}\` answered ${describe_(answered)}; a route handler returns a Response.`,
    );
  }
  return { status: answered.status, body: await answered.text() };
}

/** The `Availability` a route answered with, held to the same shape as the module's. */
export function payloadOf(answer: RouteAnswer, where: string): Availability {
  if (answer.status !== 200) {
    throw new Error(
      `${where} answered ${answer.status}. D-70-03: "Both 200 with the \`Availability\` ` +
        `payload; there is no 404, because 'not found' **is** the available answer."\n` +
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

/* --------------------- the database each suite file owns --------------------- */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the first parameter of every T070 function that takes one. */
  db: unknown;
  /** This scratch database's connection string, for the route half's shared client. */
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

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
      `\`select current_database()\` answered ${describe_(database)}, so the route handler ` +
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
