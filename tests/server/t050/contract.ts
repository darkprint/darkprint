/* ============================================================
   T050 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this module is imported by the suites beside it.

   ── what this author could and could not see ──
   GIVEN, and read: `lib/db/schema.ts`, the barrels of
   `lib/server/{naming,policy,http,auth,registry}`, `tests/support/**`,
   the merged blind suites under `tests/server/t0NN/`,
   `docs/architecture/routes.md`, `lib/data/account.ts`, `lib/types.ts`.

   T050's OWN, and never opened: `lib/server/accounts/**`,
   `app/api/account/**`, the branch `feat/t050-accounts`.

   **The four shipped auth routes were not opened either**, though
   they are base and reading them would have been permitted. They
   sit in T050's `Owns`, so T050 may rewrite them; a suite written
   against today's source of a file its own task is allowed to
   change is bound to a shape nobody promised to keep. Their
   contract is taken from `docs/architecture/routes.md:55-58` and
   T000's AC3 instead.

   ── the message pins are LITERALS ──
   Every expected string in this file is written out and never
   imported from `@/lib/server/accounts`. An expectation built from
   the module under test asserts "does the module agree with
   itself", and passes unchanged if the template starts
   interpolating a driver value. A later change that derives one of
   these from the module is a REMOVED ASSERTION and is to be
   treated as one.

   ── every blocker reported before this file was written is now RULED ──
   D-50-01 the problem base is `https://darkprint.io/problems`;
           `handle-required` is 403. The code won over the document,
           which is CLAUDE.md's own rule.
   D-50-03 the five routes are published, PATCH throughout, every one
           answering `AccountRecord`.
   D-50-06 `PublicAuthor.handle` is `string | null`.
   D-50-07 "non-owner" means NOT AUTHORIZED, so an operator obtains
           `email`. The cell this file left empty is now asserted in
           `visibility.test.ts` — a tolerance would have outlived the
           ambiguity, and there is no longer an ambiguity to outlive.

   `docs/architecture/seams.md` published a CONTRADICTING second
   reading of these routes and is marked superseded above its own
   rows. Nothing here binds to it. The contract wins.

   ── what remains unasserted, and why ──
   The **store-fault message form**. Reported as D-50-08 and ruled
   in the reply, but the Admissible message forms block still lists
   three and none is a fault door (that id was reused for the
   T070-pass-through ruling). So no class is pinned for a database
   failure; what IS asserted is the property that survives without
   one — no rejection from any published function carries the
   driver's statement, its bound parameters or a SQLSTATE. That is
   D-13 quantified over the output, which needs no class name.

   ── and one bound deliberately NOT asserted ──
   T071 (`MAX_HANDLE_LENGTH = 32`) is `todo`. Nothing here pins a
   handle length in either direction: not 255, not 32. T050 calls
   the bound, T070 and T071 own it, and an assertion written
   against today's bound would red the day T071 merges.
      ============================================================ */

import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const ACCOUNTS = "@/lib/server/accounts";

let accounts: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, and every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 *
 * Called from inside each test and never from a `beforeAll` hook. A hook that throws runs no
 * test and adds nothing to the failed column — it moves the SKIPPED count instead, which is
 * the third of the three ways a run prints green while measuring less than it claims.
 */
export function loadAccounts(): Promise<Namespace> {
  accounts ??= import("@/lib/server/accounts").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${ACCOUNTS} does not load.\n` +
          `  backend.md §T050 owns \`lib/server/accounts/**\` and publishes \`upsertFromGitHub\`, ` +
          `\`getAccount\`, \`getPublicAuthor\`, \`updateProfile\`, \`changeHandle\`, \`setEmail\` ` +
          `and \`setDefaultVisibility\` from the barrel \`${ACCOUNTS}\`.\n` +
          `  This is a failed acceptance criterion — the accounts module is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return accounts;
}

/* --------------------- what the contract publishes --------------------- */

/** The Published signatures block of backend.md §T050, quoted so a red says where a name comes from. */
export const PUBLISHED = {
  upsertFromGitHub:
    "upsertFromGitHub(db: Db, input: { githubId: string; githubLogin: string }): Promise<{ accountId: string; handle: string | null }>",
  getAccount:
    "getAccount(db: Db, actor: Actor, accountId: string): Promise<AccountRecord | undefined>",
  getPublicAuthor: "getPublicAuthor(db: Db, handle: string): Promise<PublicAuthor | undefined>",
  updateProfile:
    "updateProfile(db: Db, actor: Actor, accountId: string, patch: { displayName?: string | null; bio?: string | null; avatarHue?: number | null }): Promise<AccountRecord>",
  changeHandle:
    "changeHandle(db: Db, actor: Actor, accountId: string, handle: string): Promise<AccountRecord>",
  setEmail:
    "setEmail(db: Db, actor: Actor, accountId: string, email: string | null): Promise<AccountRecord>",
  setDefaultVisibility:
    'setDefaultVisibility(db: Db, actor: Actor, accountId: string, visibility: "public" | "private"): Promise<AccountRecord>',
} as const;

export type PublishedName = keyof typeof PUBLISHED;
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * The three admissible message forms, published BEFORE the implementation exists, quoted
 * verbatim. `<operation>` is read as the published function's own name — the convention
 * T070's merged, adversary-passed module already sets with
 * `"allocateHandle: the handle \`<handle>\` is not available."`. Stated as a reading rather
 * than assumed, so a red on the label is diagnosable as a naming question.
 */
export const MESSAGE_FORMS = {
  HandleRequiredError: "<operation>: this account has no handle yet.",
  NotAccountOwnerError: "<operation>: not this account's owner.",
  InvalidProfileError: "<operation>: `<field>` is not valid.",
} as const;

export type PublishedErrorName = keyof typeof MESSAGE_FORMS;

/** `"updateProfile: not this account's owner."` — built here, never imported from the module. */
export function notAccountOwnerMessage(operation: string): string {
  return `${operation}: not this account's owner.`;
}

/** `"setEmail: \`email\` is not valid."` */
export function invalidProfileMessage(operation: string, field: string): string {
  return `${operation}: \`${field}\` is not valid.`;
}

/** `"changeHandle: this account has no handle yet."` */
export function handleRequiredMessage(operation: string): string {
  return `${operation}: this account has no handle yet.`;
}

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${ACCOUNTS} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. Do not add a synonym ` +
      `here; publish the name the contract states.`,
  );
}

function asFn(value: unknown, name: string, clause: string): UnknownFn {
  if (typeof value !== "function") {
    throw new Error(
      `${ACCOUNTS} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/** The seven function bindings. `PublicAuthor` and `AccountRecord` are types with no runtime binding. */
export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadAccounts();
  return asFn(requireFrom(mod, name, PUBLISHED[name]), name, PUBLISHED[name]);
}

/* ============================================================
   The two record shapes, and why the KEY SET is the assertion

   AC2: "`PublicAuthor` **has no `email` field at all**, and it is
   the only shape any non-owner path returns ... So the criterion
   holds structurally, and the test that matters asserts the *key
   set* of what a visitor receives rather than the value of one
   field."

   Taken literally. Every checker below compares the key set of the
   JSON RENDERING, not of the object: `JSON.stringify` drops an
   `undefined`-valued key and keeps a `null`-valued one, and what a
   consumer of `/api/account` receives is the rendering. That
   distinction is load-bearing here, because the published types
   split the nullable fields into two groups and an implementation
   returning the database row unchanged collapses them:

       rendered as NULL      handle, displayName, avatarHue   (`| null`)
       rendered as ABSENT    bio, validatorSince              (`?`)

   `PublicAuthor.bio?: string` and `AccountRecord.validatorSince?:
   Date` admit no `null`, while `handle`, `displayName` and
   `avatarHue` require one. `handle` joined that group at D-50-06,
   so `getAccount` can describe the handle-less account AC1 rules
   legal. The frontend agrees:
   `lib/types.ts:179` is `bio?: string` and `lib/data/account.ts:66`
   is `validatorSince?: string`.
   ============================================================ */

/** Exactly the keys `PublicAuthor` publishes. `email` is not among them and that is AC2. */
export const PUBLIC_AUTHOR_REQUIRED = ["handle", "displayName", "avatarHue", "validator"] as const;
export const PUBLIC_AUTHOR_OPTIONAL = ["bio"] as const;
export const PUBLIC_AUTHOR_ALL: readonly string[] = [
  ...PUBLIC_AUTHOR_REQUIRED,
  ...PUBLIC_AUTHOR_OPTIONAL,
];

export const ACCOUNT_RECORD_REQUIRED = [
  "accountId",
  "author",
  "email",
  "joinedAt",
  "validatorWeight",
  "defaultVisibility",
] as const;
export const ACCOUNT_RECORD_OPTIONAL = ["validatorSince"] as const;
export const ACCOUNT_RECORD_ALL: readonly string[] = [
  ...ACCOUNT_RECORD_REQUIRED,
  ...ACCOUNT_RECORD_OPTIONAL,
];

/**
 * What a consumer actually receives, which is the object after a JSON round trip.
 *
 * A route returns these through `ok()`, which is `Response.json` and therefore
 * `JSON.stringify`. So the rendering is the contract's surface, and the two nullability
 * spellings above are only distinguishable here.
 */
export function rendered(value: unknown): Record<string, unknown> {
  const text = JSON.stringify(value);
  if (text === undefined) {
    throw new Error(`the value does not survive JSON.stringify: ${describe_(value)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

export function keysOf(value: unknown, where: string): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where} is ${describe_(value)}; the contract publishes an object.`);
  }
  return Object.keys(value).sort();
}

/**
 * The whole point of AC2 as one assertion: the rendered key set is a subset of what
 * `PublicAuthor` publishes and a superset of what it requires.
 *
 * Quantified over the published key list rather than written as `expect(author.email)
 * .toBeUndefined()`. Checking the one field asserts that today's leak is absent; checking the
 * key set asserts that no field outside the published shape is present at all, which is the
 * criterion the contract says is satisfied "by the type, not by a filter".
 */
export function assertPublicAuthorKeys(value: unknown, where: string): Record<string, unknown> {
  const shape = rendered(value);
  const keys = keysOf(shape, where);
  const unexpected = keys.filter((k) => !PUBLIC_AUTHOR_ALL.includes(k));
  const missing = PUBLIC_AUTHOR_REQUIRED.filter((k) => !keys.includes(k));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `${where} does not render as \`PublicAuthor\`.\n` +
        `  published: ${[...PUBLIC_AUTHOR_REQUIRED].join(", ")} (required), ` +
        `${[...PUBLIC_AUTHOR_OPTIONAL].join(", ")} (optional)\n` +
        `  rendered:  ${keys.join(", ")}\n` +
        (unexpected.length > 0 ? `  NOT published: ${unexpected.join(", ")}\n` : "") +
        (missing.length > 0 ? `  missing: ${missing.join(", ")}\n` : "") +
        `  AC2 holds "by the type, not by a filter" — a key outside this set is the leak the ` +
        `criterion exists to make structurally impossible.`,
    );
  }
  return shape;
}

export function assertAccountRecordKeys(value: unknown, where: string): Record<string, unknown> {
  const shape = rendered(value);
  const keys = keysOf(shape, where);
  const unexpected = keys.filter((k) => !ACCOUNT_RECORD_ALL.includes(k));
  const missing = ACCOUNT_RECORD_REQUIRED.filter((k) => !keys.includes(k));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `${where} does not render as \`AccountRecord\`.\n` +
        `  published: ${[...ACCOUNT_RECORD_REQUIRED].join(", ")} (required), ` +
        `${[...ACCOUNT_RECORD_OPTIONAL].join(", ")} (optional)\n` +
        `  rendered:  ${keys.join(", ")}\n` +
        (unexpected.length > 0 ? `  NOT published: ${unexpected.join(", ")}\n` : "") +
        (missing.length > 0 ? `  missing: ${missing.join(", ")}\n` : ""),
    );
  }
  assertPublicAuthorKeys(shape.author, `${where}.author`);
  return shape;
}

/* ============================================================
   Rejections: a property over the OUTPUT, not a list of sites

   T050's whitelist is stricter than T070's and the difference is
   the whole of AC2's second half:

     "The operation, the caller's own field name, nothing else. No
      `email` value appears in any rejection, including one *about*
      the email — that is the whole point of AC2 and a validation
      error is a rendering like any other."

   So the caller's own VALUE is admissible in T070 and is NOT
   admissible here. That is what makes this checkable without an
   input grammar: the contract publishes no rule for which emails
   or display names are invalid, but it publishes exactly what a
   rejection may say, and that is a property over the output
   quantified over every rejection rather than over the inputs that
   produce one.

   Asserted by EXACT MATCH against the admissible form where a form
   is published, never by scanning for forbidden substrings — "a
   whitelist asserted with a blacklist test IS a blacklist", and
   `includes` answers "do these characters appear" where the claim
   is "does this leak". Where no form is published (a store fault,
   whose door D-50-08 reports as missing) the fallback is the
   planted-secret check below, which is a property of the value and
   not of a curated list.
   ============================================================ */

export interface Renderings {
  message: string;
  string: string;
  json: string;
  detail: string;
  ownKeys: string[];
}

/** Every way an error reaches a log or a response body, collected in one place. */
export function renderingsOf(err: unknown): Renderings {
  const e = err as Error;
  return {
    message: typeof e?.message === "string" ? e.message : String(e),
    string: String(e),
    json: JSON.stringify(e) ?? "undefined",
    detail: JSON.stringify({ detail: e?.message }),
    ownKeys: typeof e === "object" && e !== null ? Object.keys(e) : [],
  };
}

/**
 * The four clauses of D-13's hygiene rule, asserted locally rather than left to
 * `tests/error-hygiene.test.ts`.
 *
 * Not duplication. That guard's domain is built by construction over every published class
 * and it enforces the three clauses that are statements about ENUMERABILITY; the fourth —
 * `stack` is retained — is not a property of the class's shape, so a class that deletes
 * `stack` renders as `{}` and passes all three. A repo-wide check and a module-local suite
 * are blind in opposite directions, and this is the axis where the local one is stronger.
 */
export function assertSealed(err: unknown, where: string): void {
  const e = err as Error;
  if (!(e instanceof Error)) {
    throw new Error(`${where} rejected with ${describe_(err)}, not an Error.`);
  }
  const keys = Object.keys(e);
  if (keys.length !== 0) {
    throw new Error(`${where}: \`Object.keys\` is ${JSON.stringify(keys)}, expected [].`);
  }
  if (JSON.stringify(e) !== "{}") {
    throw new Error(`${where}: \`JSON.stringify\` is ${JSON.stringify(e)}, expected \`{}\`.`);
  }
  if (typeof e.stack !== "string" || e.stack === "") {
    throw new Error(
      `${where}: \`stack\` is ${describe_(e.stack)}. The clause requires it RETAINED — this is ` +
        `the one part of D-13 that is not a statement about enumerability, so a class deleting ` +
        `\`stack\` still renders as \`{}\` and passes the repo-wide guard.`,
    );
  }
  if (Object.prototype.hasOwnProperty.call(e, "cause") && e.propertyIsEnumerable("cause")) {
    throw new Error(`${where}: \`cause\` is enumerable, so \`JSON.stringify\` can reach it.`);
  }
}

/**
 * A value the caller supplied appears in NO rendering.
 *
 * The secret is minted per call and is a token no admissible message can contain, so this is
 * a property of provenance rather than a blacklist of things someone thought of — and it
 * cannot over-match the way T-04's SQLSTATE tells matched a fixture's own pid, because the
 * only route from the secret into a rendering is the module putting it there.
 */
export function assertValueNotLeaked(err: unknown, secret: string, where: string): void {
  const r = renderingsOf(err);
  for (const [name, text] of [
    ["message", r.message],
    ["String(err)", r.string],
    ["JSON.stringify(err)", r.json],
    ["JSON.stringify({detail})", r.detail],
    ["own keys", r.ownKeys.join(",")],
  ] as const) {
    if (text.includes(secret)) {
      throw new Error(
        `${where}: the caller's own VALUE reached \`${name}\`.\n` +
          `  T050's whitelist is "the operation, the caller's own field name, nothing else", ` +
          `which is stricter than T070's — a value is not admissible here even in a rejection ` +
          `about that value.\n` +
          `  ${name}: ${text.slice(0, 300)}`,
      );
    }
  }
}

/** The driver's own prose and machinery, which no rendering may carry (D-13). */
const DRIVER_TELLS = [
  "select ",
  "insert into",
  "update ",
  "delete from",
  "returning",
  "duplicate key value",
  "violates unique constraint",
  "relation ",
  "$1",
  "DrizzleQueryError",
  "23505",
  "22021",
  "22P02",
  "42P01",
];

export function assertNoDriverProse(err: unknown, where: string): void {
  const r = renderingsOf(err);
  const haystack = `${r.message}\n${r.string}\n${r.json}\n${r.detail}`.toLowerCase();
  const hit = DRIVER_TELLS.find((t) => haystack.includes(t.toLowerCase()));
  if (hit !== undefined) {
    throw new Error(
      `${where}: a rendering carries the driver tell \`${hit}\`.\n` +
        `  D-13: the driver error travels on \`cause\`, which is non-enumerable, and reaches no ` +
        `rendering.\n  message: ${r.message.slice(0, 300)}`,
    );
  }
}

/** The class a rejection carried, by name, so a red says which one arrived. */
export function classNameOf(err: unknown): string {
  if (err instanceof Error) return err.constructor?.name ?? err.name ?? "Error";
  return describe_(err);
}

/** Captures a rejection. Fails loudly if the call RESOLVED — an absent refusal is the defect. */
export async function rejection(call: Promise<unknown>, where: string): Promise<unknown> {
  let resolved: unknown;
  try {
    resolved = await call;
  } catch (err) {
    return err;
  }
  throw new Error(
    `${where} RESOLVED with ${describe_(resolved)}; the contract refuses this call.\n` +
      `  A refusal that does not arrive is not a message-form question — it is the criterion.`,
  );
}

/* ============================================================
   The five routes, as D-50-03 published them

     GET   /api/account                    -> 200 AccountRecord | 401
     PATCH /api/account/profile            { displayName?, bio?, avatarHue? }
                                           -> 200 AccountRecord | 400 401 403
     PATCH /api/account/handle             { handle }
                                           -> 200 AccountRecord | 400 401 409
     PATCH /api/account/email              { email }
                                           -> 200 AccountRecord | 400 401 403
     PATCH /api/account/default-visibility { visibility }
                                           -> 200 AccountRecord | 400 401 403

   `docs/architecture/seams.md` carried a contradicting second
   reading — `{ ok, verificationSent }` payloads, a `DELETE
   /api/account` that is T120's, a `GET /api/auth/me` the tree
   never had — and is marked superseded above its own rows.
   Nothing here reads it.

   `PATCH /api/account/handle` is the ONE write route that accepts
   a `handle: null` session, because it is the route that allocates
   the first one and requiring a handle to reach it makes AC1
   unreachable. Every other write route 403s a handle-less session
   with `https://darkprint.io/problems/handle-required`.

   Routes are discovered by walking the tree rather than imported
   from a guessed path, so a red says "this URL is unserved" rather
   than "a file is missing from where I looked". The file layout is
   the implementation's; the URL is the contract's.
   ============================================================ */

/** `lib/server/http/problem.ts:8`, quoted rather than imported — the pin has to be a literal. */
export const PROBLEM_BASE = "https://darkprint.io/problems";
export const HANDLE_REQUIRED_TYPE = `${PROBLEM_BASE}/handle-required`;
export const UNAUTHORIZED_TYPE = `${PROBLEM_BASE}/unauthorized`;

export const ROUTES = {
  account: { method: "GET", path: "/api/account" },
  profile: { method: "PATCH", path: "/api/account/profile" },
  handle: { method: "PATCH", path: "/api/account/handle" },
  email: { method: "PATCH", path: "/api/account/email" },
  defaultVisibility: { method: "PATCH", path: "/api/account/default-visibility" },
} as const;

export type RouteName = keyof typeof ROUTES;
export const ROUTE_NAMES = Object.keys(ROUTES) as RouteName[];

/** The four writers, and whether a `handle: null` session may reach each (D-50-05). */
export const WRITE_ROUTES: readonly {
  name: RouteName;
  body: () => unknown;
  acceptsHandlelessSession: boolean;
}[] = [
  { name: "profile", body: () => ({ displayName: "Route Probe" }), acceptsHandlelessSession: false },
  { name: "email", body: () => ({ email: "probe@example.test" }), acceptsHandlelessSession: false },
  {
    name: "defaultVisibility",
    body: () => ({ visibility: "private" }),
    acceptsHandlelessSession: false,
  },
  { name: "handle", body: () => ({ handle: "t050-route-probe" }), acceptsHandlelessSession: true },
];

interface DiscoveredRoute {
  pattern: string;
  file: string;
}

const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;
const ACCOUNT_ROOT = fileURLToPath(new URL("../../../app/api/account/", import.meta.url));

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
      const suffix = segments.length > 0 ? `/${segments.join("/")}` : "";
      out.push({ pattern: `/api/account${suffix}`, file: join(dir, entry.name) });
    }
  }
}

/**
 * The route table. Deliberately not memoised as an EMPTY result: an absent tree throws and a
 * later call re-walks, so the first test's timing does not decide every later test's answer.
 */
export function routeTable(): DiscoveredRoute[] {
  if (table !== undefined && table.length > 0) return table;
  const found: DiscoveredRoute[] = [];
  walk(ACCOUNT_ROOT, [], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under \`app/api/account/\`.\n` +
        `  backend.md §T050 publishes five: ${ROUTE_NAMES.map(
          (n) => `${ROUTES[n].method} ${ROUTES[n].path}`,
        ).join(", ")}\n` +
        `  The tree is walked, not guessed, so this is a failed acceptance criterion rather ` +
        `than a test looking in the wrong place.`,
    );
  }
  table = found;
  return table;
}

export function servedPatterns(): string[] {
  return routeTable()
    .map((r) => r.pattern)
    .sort();
}

export function isServed(path: string): boolean {
  return routeTable().some((r) => r.pattern === path);
}

/** The session cookie a signed-in caller carries. Minted with T000's own published encoder. */
export function sessionCookie(accountId: string, handle: string | null): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
}

export interface RouteAnswer {
  status: number;
  contentType: string | null;
  body: string;
  setCookie: string | null;
  json: unknown;
}

/**
 * Drive a published route the way a caller does: the method the contract publishes, a JSON
 * body where one is published, and whichever discovered file serves that URL.
 *
 * All five paths are static, so no matcher is needed — but `params` is still supplied as a
 * promise, because that is what Next hands a handler
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`).
 */
export async function callRoute(
  name: RouteName,
  init: { cookie?: string; body?: unknown; method?: string } = {},
): Promise<RouteAnswer> {
  const spec = ROUTES[name];
  const entry = routeTable().find((r) => r.pattern === spec.path);
  if (entry === undefined) {
    throw new Error(
      `\`${spec.path}\` is unserved. Discovered: ${servedPatterns().join(", ")}\n` +
        `  The contract publishes \`${spec.method} ${spec.path}\`.`,
    );
  }
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(entry.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(`\`${spec.path}\` does not load.`, { cause });
  }
  const method = init.method ?? spec.method;
  const handler = mod[method];
  if (typeof handler !== "function") {
    throw new Error(
      `\`${spec.path}\` exports no \`${method}\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}).\n` +
        `  The contract publishes \`${spec.method} ${spec.path}\`.`,
    );
  }

  const headers: Record<string, string> = {};
  if (init.cookie !== undefined) headers.cookie = init.cookie;
  if (init.body !== undefined) headers["content-type"] = "application/json";

  const request = new Request(`https://darkprint.test${spec.path}`, {
    method,
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const answered = await (handler as UnknownFn)(request, { params: Promise.resolve({}) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${spec.method} ${spec.path}\` answered ${describe_(answered)}; a route handler returns ` +
        `a Response.`,
    );
  }
  const body = await answered.text();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = undefined;
  }
  return {
    status: answered.status,
    contentType: answered.headers.get("content-type"),
    body,
    setCookie: answered.headers.get("set-cookie"),
    json,
  };
}

/**
 * RFC 9457's five members, all of them, at the status the contract names.
 *
 * `instance` is included because T000 paid for it: D-02 was every caller being asked to
 * remember an `instance` string and none doing so, which `Response.json` then silently
 * dropped as `undefined`. A problem response missing a member is not a smaller problem
 * response — it is one a client cannot branch on.
 */
export function assertProblem(
  answer: RouteAnswer,
  expected: { status: number; type: string; instance: string },
  where: string,
): Record<string, unknown> {
  if (answer.status !== expected.status) {
    throw new Error(
      `${where} answered ${answer.status}, expected ${expected.status}.\n` +
        `  body: ${answer.body.slice(0, 400)}`,
    );
  }
  if (answer.contentType === null || !answer.contentType.includes("application/problem+json")) {
    throw new Error(
      `${where} answered content-type ${JSON.stringify(answer.contentType)}; B-03 makes a ` +
        `transport or auth failure \`application/problem+json\` (RFC 9457).`,
    );
  }
  const body = answer.json as Record<string, unknown> | undefined;
  if (typeof body !== "object" || body === null) {
    throw new Error(`${where} answered a body that is not a JSON object: ${answer.body.slice(0, 200)}`);
  }
  for (const member of ["type", "title", "status", "detail", "instance"]) {
    if (body[member] === undefined) {
      throw new Error(
        `${where}: RFC 9457 member \`${member}\` is absent. Present: ` +
          `${Object.keys(body).sort().join(", ")}`,
      );
    }
  }
  if (body.type !== expected.type) {
    throw new Error(`${where}: \`type\` is ${JSON.stringify(body.type)}, expected ${expected.type}`);
  }
  if (body.status !== expected.status) {
    throw new Error(
      `${where}: \`status\` is ${JSON.stringify(body.status)} while the response is ` +
        `${answer.status}; the two are one fact and a client may read either.`,
    );
  }
  if (body.instance !== expected.instance) {
    throw new Error(
      `${where}: \`instance\` is ${JSON.stringify(body.instance)}, expected ${expected.instance}`,
    );
  }
  return body;
}

/* --------------------- the database each suite owns --------------------- */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the first parameter of every T050 function. */
  db: unknown;
  /** This scratch database's connection string, for a route's shared client. */
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
      `\`select current_database()\` answered ${describe_(database)}, so a route handler cannot ` +
        `be pointed at this scratch database.`,
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

/* --------------------- actors --------------------- */

/** The actor an account speaks for. Plain data, exactly as T060 publishes it. */
export function accountActor(accountId: string, handle: string | null = null): Actor {
  return { kind: "account", accountId, handle };
}

export const ANONYMOUS: Actor = { kind: "anonymous" };

/**
 * B-13's break-glass subject. Reachable only in-process: `SessionPayload` carries no `kind`,
 * so `actorFrom` can never mint one and no route produces this actor today
 * (`lib/server/registry/actor.ts` says so in its own header). The module-level cell is still
 * live, which is why D-50-07 needed ruling rather than dismissing.
 */
export function operatorActor(accountId: string): Actor {
  return { kind: "operator", accountId };
}
