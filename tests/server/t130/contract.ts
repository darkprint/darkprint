/* ============================================================
   T130 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── why every load is a dynamic import ──
   Written in a worktree branched from `backend` before
   `lib/server/profiles/**` existed. A static top-level import of
   an absent module fails the whole FILE at collection, which
   reports one red where the protocol asks for one per acceptance
   criterion. Loading inside the test that needs it turns "the
   module is not there yet" into the per-criterion red the handback
   is supposed to produce. The specifier stays a literal so the `@`
   alias resolves, and `tsc` reporting TS2307 for it on this branch
   is the same fact the reds report rather than a second one.

   ── no candidate lists ──
   Every name is bound exactly and its absence quotes the clause
   that publishes it. T000 paid two rounds for the alternative.

   ── one route, and only one ──
   The first version of this file had NO route tests and said so:
   `app/api/authors/**` was owned with nothing published for it, so
   AC5's 404 lived at a surface that did not exist and inventing
   URLs would have been the candidate list this run charges.
   **D-130-05 published it** — `GET /api/authors/[handle]` ->
   `200 ProfileRecord | 404` — and `seams.md`'s SEAM-52/53
   `ProfileView` is superseded with it. So `routes.test.ts` exists.

   **The two WRITE routes are still not written, and that is the
   ruling rather than an omission.** D-130-05 publishes them as
   BLOCKED: `PUT .../pinned` needs pin storage and
   `POST/DELETE .../watch` needs follow storage, and neither has a
   column. A marked absence is not silence, and a cell against a
   URL published as blocked would be a cell against something
   nobody has decided.

   ── the route is bound by URL, never by module path ──
   Copied from T080's suite, where binding by folder syntax was
   charged as a defect three ways: a published path is a URL and
   not a folder name, a dynamic `import()` specifier resolves at
   COMPILE time so a wrong guess takes `tsc` and `npm run build`
   with it, and a precedence test that imports its subject directly
   cannot observe shadowing in either direction. The table is
   discovered by walking `app/api/**`, ordered by Next's own
   `getSortedRoutes` and matched by its own `getRouteRegex`, so
   this file cannot disagree with the router about which file
   serves a URL. What the contract publishes is the URL; the layout
   is the implementation's to choose.

   ── the fixtures go in as plain SQL ──
   T130 is a reader of other tasks' rows plus a writer of two things
   (`setPins`, `toggleFollow`) with no table behind them. Bundles,
   releases, cards, accounts and ontology terms are seeded through
   `@/lib/db`'s published client with plain SQL, the same route
   T020's and T080's blind suites took: the writers for these tables
   belong to tasks that have not merged, and seeding through another
   task's writer makes every red ambiguous between two modules.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getRouteMatcher } from "next/dist/shared/lib/router/utils/route-matcher.js";
import { getRouteRegex } from "next/dist/shared/lib/router/utils/route-regex.js";
import { getSortedRoutes } from "next/dist/shared/lib/router/utils/sorted-routes.js";

import {
  bundleDigest,
  cardDigest,
  type BundleManifest,
  type CardRef,
  type NodeCard,
} from "@/lib/core";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const PROFILES = "@/lib/server/profiles";
export const ACCOUNTS = "@/lib/server/accounts";

let profiles: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, so every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadProfiles(): Promise<Namespace> {
  profiles ??= import("@/lib/server/profiles").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${PROFILES} does not load.\n` +
          `  backend.md §T130 owns \`lib/server/profiles/**\` and publishes three functions: ` +
          `${FUNCTION_NAMES.join(", ")}.\n` +
          `  This is a failed acceptance criterion — the profile surface is absent — and not ` +
          `a broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return profiles;
}

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of backend.md §T130, quoted so a red says where the name
 * comes from rather than merely that a test wanted it.
 */
export const PUBLISHED = {
  getProfile:
    "getProfile(db: Db, actor: Actor, handle: string): Promise<ProfileRecord | undefined>",
  setPins:
    "setPins(db: Db, actor: Actor, accountId: string, pins: readonly string[]): " +
    "Promise<ProfileRecord>",
  toggleFollow:
    "toggleFollow(db: Db, actor: Actor, handle: string): " +
    "Promise<{ watchers: number; followedByCaller: boolean }>",
} as const;

export type FunctionName = keyof typeof PUBLISHED;

/** Three, in the order the block publishes them. The D-13 sweep is quantified over this. */
export const FUNCTION_NAMES = Object.keys(PUBLISHED) as FunctionName[];

/**
 * The seven members of `ProfileRecord`, exactly as the block declares them.
 *
 * Asserted as a KEY SET rather than field by field, which is T050's AC2 precedent: "the test
 * that matters asserts the key set of what a visitor receives rather than the value of one
 * field". An extra member is how a column arrives on a public surface, and no per-field
 * assertion can see one.
 */
export const RECORD_KEYS = [
  "author",
  "counts",
  "joinedAt",
  "pinned",
  "support",
  "validated",
  "watchers",
] as const;

/** The three members of `ProfileRecord.counts`, exactly as the block declares them. */
export const COUNT_KEYS = ["blueprints", "cards", "terms"] as const;

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Date) return "a Date";
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
      `lists in T000 each resolved to the wrong thing. Do not add a synonym; publish the name ` +
      `the contract states.`,
  );
}

export async function bind(name: FunctionName): Promise<UnknownFn> {
  const mod = await loadProfiles();
  const value = requireFrom(mod, name, PROFILES, PUBLISHED[name]);
  if (typeof value !== "function") {
    throw new Error(
      `${PROFILES} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${PUBLISHED[name]}`,
    );
  }
  return value as UnknownFn;
}

/**
 * T050's `getPublicAuthor`, bound the same way.
 *
 * Used as the ORACLE for `ProfileRecord.author` rather than as a second opinion about it:
 * the block types that member `PublicAuthor`, `PublicAuthor` is keyed by handle, and
 * `getPublicAuthor(db, handle)` is the published reader that yields one. Comparing the two
 * asks "does T130 delegate the author projection", which is the question — a hand-rolled
 * comparison against fields this file typed would be checking my transcription of T050.
 */
export async function bindPublicAuthor(): Promise<UnknownFn> {
  const mod = (await import("@/lib/server/accounts")) as unknown as Namespace;
  const value = mod.getPublicAuthor;
  if (typeof value !== "function") {
    throw new Error(`${ACCOUNTS} exports no callable \`getPublicAuthor\`; it is merged and must.`);
  }
  return value as UnknownFn;
}

/* --------------------- the record shape --------------------- */

export interface Counts {
  blueprints: number;
  cards: number;
  terms: number;
}

export interface ProfileRecord {
  author: Record<string, unknown>;
  joinedAt: Date;
  watchers: number;
  support: number;
  validated: number;
  pinned: readonly string[];
  counts: Counts;
}

function integer(value: unknown, where: string, clause: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${where} is ${describe_(value)}; the contract publishes ${clause}.`);
  }
  return value;
}

/**
 * `ProfileRecord`, checked member by member because the shape IS part of the published
 * signature. Every message quotes the block, so a red says which clause is unmet.
 *
 * `validated` is a NUMBER. The first version of this file pinned it as a boolean, which is
 * what the block said, while reporting that `lib/data/profiles.ts:57` and SEAM-56 both make
 * it a count and that `PublicAuthor` already carries the boolean — so the published field
 * was either a duplicate or a wrong transcription. **D-130-01 ruled it the count**, by
 * displacement, and this pin follows the ruling rather than the sentence it replaced.
 */
export function asProfileRecord(value: unknown, where: string): ProfileRecord {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${where} returned ${describe_(value)}; the contract publishes \`ProfileRecord\`.`,
    );
  }
  const r = value as Record<string, unknown>;

  if (r.author === null || typeof r.author !== "object") {
    throw new Error(
      `${where}.author is ${describe_(r.author)}; the block declares \`author: PublicAuthor\`.`,
    );
  }
  if (!(r.joinedAt instanceof Date)) {
    throw new Error(
      `${where}.joinedAt is ${describe_(r.joinedAt)}; the block declares \`joinedAt: Date\`. ` +
        `An ISO string is what \`lib/data/profiles.ts\` carries and is not what the block ` +
        `publishes.`,
    );
  }
  integer(r.watchers, `${where}.watchers`, "`watchers: number`");
  integer(r.support, `${where}.support`, "`support: number`");
  integer(r.validated, `${where}.validated`, "`validated: number` (D-130-01)");
  if (!Array.isArray(r.pinned)) {
    throw new Error(
      `${where}.pinned is ${describe_(r.pinned)}; the block declares ` +
        `\`pinned: readonly string[]\`.`,
    );
  }
  for (const [i, pin] of (r.pinned as unknown[]).entries()) {
    if (typeof pin !== "string") {
      throw new Error(
        `${where}.pinned[${i}] is ${describe_(pin)}; AC3 makes the array ` +
          `\`readonly string[]\` and NEVER \`(string | null)[]\` — "a pin whose target no ` +
          `longer resolves is absent from the array, never present as a null".`,
      );
    }
  }

  const counts = r.counts;
  if (counts === null || typeof counts !== "object") {
    throw new Error(
      `${where}.counts is ${describe_(counts)}; the block declares ` +
        `\`counts: { blueprints: number; cards: number; terms: number }\`.`,
    );
  }
  const c = counts as Record<string, unknown>;
  for (const key of COUNT_KEYS) {
    integer(c[key], `${where}.counts.${key}`, `\`counts.${key}: number\``);
  }

  return r as unknown as ProfileRecord;
}

/**
 * The same seven members, checked on the WIRE, where `joinedAt` is an ISO string.
 *
 * A separate validator rather than a loosened one: `Date` is what the block declares of the
 * module's return and JSON has no date type, so a route answering a string is correct and a
 * module answering one is not. One validator serving both would have to accept whichever the
 * caller happened to hand it, which is how a shape assertion stops being one.
 */
export function asWireProfileRecord(body: unknown, where: string): Record<string, unknown> {
  if (body === null || typeof body !== "object") {
    throw new Error(`${where} answered ${describe_(body)}; D-130-05 publishes ProfileRecord.`);
  }
  const r = body as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  if (keys.join(",") !== [...RECORD_KEYS].join(",")) {
    throw new Error(
      `${where} answered members [${keys.join(", ")}]; \`ProfileRecord\` is ` +
        `[${[...RECORD_KEYS].join(", ")}]. An EXTRA member is how a column reaches a public ` +
        `surface, and \`ok(record)\` puts whatever the reader returned straight onto the wire.`,
    );
  }
  if (typeof r.joinedAt !== "string" || Number.isNaN(Date.parse(r.joinedAt))) {
    throw new Error(
      `${where} answered \`joinedAt\` = ${describe_(r.joinedAt)}. The block declares a ` +
        `\`Date\` and \`Response.json\` renders one as an ISO string, so the wire form is a ` +
        `parseable string — not a number, and not an object.`,
    );
  }
  const counts = r.counts;
  if (counts === null || typeof counts !== "object") {
    throw new Error(`${where} answered \`counts\` = ${describe_(counts)}.`);
  }
  const countKeys = Object.keys(counts as object).sort();
  if (countKeys.join(",") !== [...COUNT_KEYS].join(",")) {
    throw new Error(
      `${where} answered counts [${countKeys.join(", ")}]; the block declares ` +
        `[${[...COUNT_KEYS].join(", ")}].`,
    );
  }
  return r;
}

/**
 * RFC 9457's five members, checked on a `problem+json` body.
 *
 * `detail`'s WORDING is not asserted anywhere in this suite. D-130-02 withdrew the published
 * message and put the string in "the route's `problem` detail rather than on a class", and no
 * string was published in its place — so a pin here would be wording I invented, and it would
 * red a correct implementation that phrased it differently. What is asserted is the envelope,
 * which B-03 and every merged 404 in this repository already decide.
 */
export function asProblem(body: unknown, where: string): Record<string, unknown> {
  if (body === null || typeof body !== "object") {
    throw new Error(`${where} answered ${describe_(body)}; B-03 makes this problem+json.`);
  }
  const p = body as Record<string, unknown>;
  for (const member of ["type", "title", "detail", "instance"] as const) {
    if (typeof p[member] !== "string" || p[member] === "") {
      throw new Error(
        `${where}'s problem document has \`${member}\` = ${describe_(p[member])}; RFC 9457 ` +
          `§3.1 names five members and \`lib/server/http/problem.ts\` constructs all five.`,
      );
    }
  }
  if (typeof p.status !== "number") {
    throw new Error(`${where}'s problem document has \`status\` = ${describe_(p.status)}.`);
  }
  return p;
}

/* --------------------- the database --------------------- */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the drizzle instance every T130 function takes first. */
  db: unknown;
  /** The connection string of this scratch database, for the route's shared client. */
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

/**
 * A database of this file's own. `createTestDb()` creates `darkprint_test_<uuid>`, migrates it
 * and drops it on `drop()`; it never opens the shared development database `DATABASE_URL`
 * names, which is why T000 built it (D-08).
 */
export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(
      `createTestDb's client carries no \`db\`. \`Db\` is published from @/lib/db and is the ` +
        `first parameter of all three T130 functions.`,
    );
  }
  /* `createTestDb` does not hand back the URL it built, and the route half of this suite
     needs one: `getSharedDbClient()` reads `DATABASE_URL`, so a route can only be pointed at
     this database by naming it. Asked of the CONNECTION rather than rebuilt from a
     convention, so it cannot drift from what the client is actually on. */
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

/* --------------------- the one published route (D-130-05) --------------------- */

export const AUTHOR_ROUTE = "GET /api/authors/[handle]";

/** The three trees this file will walk. `authors` is T130's; the rest are other tasks'. */
const API_ROOT = fileURLToPath(new URL("../../../app/api/", import.meta.url));
const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;

interface DiscoveredRoute {
  pattern: string;
  file: string;
}

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
      out.push({ pattern: `/api/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

/**
 * Every route the tree actually publishes under `app/api/authors/**`, in the App Router's own
 * precedence order.
 *
 * Scoped to that one subtree deliberately: the other trees belong to merged tasks, and a
 * conflict between two of THEIR patterns is not this task's red to carry. What it costs is
 * that a `/api/authors/...` URL shadowed by a pattern outside the subtree would be invisible
 * here — no such pattern exists today, and it is stated rather than left as a silent bound.
 */
function routeTable(): DiscoveredRoute[] {
  if (table !== undefined) return table;
  const found: DiscoveredRoute[] = [];
  walk(join(API_ROOT, "authors"), ["authors"], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under app/api/authors/**.\n` +
        `  D-130-05 publishes \`${AUTHOR_ROUTE}\` -> \`200 ProfileRecord | 404\`, and AC5's ` +
        `404 lives there because \`getProfile\` answers \`undefined\` (D-130-02) and ` +
        `\`undefined\` is not a status.\n` +
        `  This is a failed acceptance criterion — the author route is absent — and not a ` +
        `broken test. Nothing here binds a file path: the route is discovered.`,
    );
  }
  const byPattern = new Map(found.map((r) => [r.pattern, r]));
  let ordered: string[];
  try {
    ordered = getSortedRoutes([...byPattern.keys()]);
  } catch (cause) {
    throw new Error(
      `The published route tree does not sort: ${String(cause)}\n` +
        `  Patterns found: ${[...byPattern.keys()].sort().join(", ")}\n` +
        `  This is Next's own conflict check, not this suite's opinion about layout.`,
      { cause },
    );
  }
  table = ordered.map((pattern) => byPattern.get(pattern)!);
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
      `  Discovered patterns, in the App Router's precedence order: ` +
      `${routes.map((r) => r.pattern).join(", ")}\n` +
      `  The contract publishes a URL and the file layout is the implementation's, so this ` +
      `says the URL is unserved rather than that a file is missing from a guessed path.`,
  );
}

/** Which discovered pattern serves a URL. Answers the surface question without a database. */
export function routePatternFor(path: string): string {
  return matchRoute(path).route.pattern;
}

/**
 * Drive the published URL the way a caller does: matched through Next's router, dispatched to
 * whichever file wins, and invoked with `params` as a PROMISE — which is what this version of
 * Next hands a handler
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`).
 */
export async function callRoute(
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  const { route, params } = matchRoute(path);
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(
      `\`${route.pattern}\` — the route serving \`${path}\` — does not load.\n` +
        `  Driving the published URL \`${AUTHOR_ROUTE}\`, 200 body \`ProfileRecord\`.`,
      { cause },
    );
  }
  const get = mod.GET;
  if (typeof get !== "function") {
    throw new Error(
      `\`${route.pattern}\` exports no \`GET\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}). D-130-05 publishes the method.`,
    );
  }
  const request = new Request(`https://darkprint.test${path}`, { headers });
  const answered = await (get as UnknownFn)(request, { params: Promise.resolve(params) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${AUTHOR_ROUTE}\` answered ${describe_(answered)}; a route handler returns a Response.`,
    );
  }
  return answered;
}

/**
 * A `Cookie` header carrying a real session, minted through T000's own published surface
 * rather than hand-assembled — a hand-built token would test this suite's idea of the format.
 *
 * This is what makes the route's ACTOR observable at all. A suite that only ever sends
 * anonymous requests covers the reader half and the transport half separately and never the
 * join between them, so whatever turns a session into an `Actor` can regress to "nobody" with
 * every assertion still passing. T080's adversary found exactly that regression at
 * `actorFrom`, unobserved, in a merged task.
 */
export function sessionCookie(accountId: string, handle: string | null): Record<string, string> {
  return { cookie: `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}` };
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

/** T060's published `Actor`, built here rather than imported so a fixture reads as a fixture. */
export const anonymous = { kind: "anonymous" } as const;
export const account = (accountId: string, handle: string | null = null) =>
  ({ kind: "account", accountId, handle }) as const;
export const operator = (accountId: string) => ({ kind: "operator", accountId }) as const;

/* --------------------- fixtures --------------------- */

/** Unique per run and per process, so two suite files never mint the same identifier. */
let counter = 0;
export function mark(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

export interface AccountFixture {
  id: string;
  handle: string;
  /** What was written to `account.created_at`, which is what `joinedAt` must report. */
  createdAt: Date;
  email: string;
}

export interface AccountOptions {
  handle: string;
  createdAt?: Date;
  validator?: boolean;
  email?: string;
  displayName?: string;
  bio?: string;
  avatarHue?: number;
}

export async function insertAccount(s: Scratch, o: AccountOptions): Promise<AccountFixture> {
  const createdAt = o.createdAt ?? new Date("2026-02-11T09:15:00.000Z");
  const email = o.email ?? `${o.handle}@example.test`;
  const [row] = await s.query(
    "insert into account " +
      "(github_id, github_login, handle, display_name, email, bio, avatar_hue, validator, created_at) " +
      "values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id",
    [
      `gh-${o.handle}`,
      `login-${o.handle}`,
      o.handle,
      o.displayName ?? null,
      email,
      o.bio ?? null,
      o.avatarHue ?? null,
      o.validator ?? false,
      createdAt.toISOString(),
    ],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the account fixture: got ${describe_(id)} for its id.`);
  }
  return { id, handle: o.handle, createdAt, email };
}

/** An account row with NO handle. `account.handle` is nullable (T050 AC1). */
export async function insertHandlelessAccount(s: Scratch, tag: string): Promise<string> {
  const [row] = await s.query(
    "insert into account (github_id, github_login, handle) values ($1, $2, null) returning id",
    [`gh-${tag}`, `login-${tag}`],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the handle-less account fixture: got ${describe_(id)}.`);
  }
  return id;
}

export interface CardOptions {
  id: string;
  version?: string;
  phases?: readonly string[];
  name?: string;
  notes?: string;
  /**
   * `NodeCard.author` (`lib/core/card/schema.ts:154`). Set to the owning handle by
   * `insertCard`, so "authored by this handle" agrees whether it is read off
   * `card_version.owner_id` (the schema's authority) or off the card body's own `author`
   * (what `components/profile/load.ts:161` filters on). Nothing published says which, so no
   * cell here depends on the answer.
   */
  author?: string;
}

/** A complete `NodeCard`. Every required field of `lib/core/card/schema.ts` is present. */
export function nodeCard(o: CardOptions): NodeCard {
  return {
    id: o.id,
    name: o.name ?? "Fixture Card",
    type: "agent",
    phases: [...(o.phases ?? [])],
    action: "do-the-fixture-thing",
    spec: "A self-sufficient instruction for the fixture node.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    requiresHuman: false,
    riskMarkers: [],
    author: o.author,
    notes: o.notes,
    version: o.version ?? "1.0.0",
    ontologyVersion: "0.1.0",
  };
}

/**
 * `manifest.author` carries the owning handle for the same reason `nodeCard`'s does: a
 * blueprint's owner is `bundle.owner_id` in the schema and `blueprint.author.username` in the
 * frontend's own loader, and the contract does not say which T130 reads. Both agree on every
 * fixture here, so no cell binds the undecided half.
 */
export function manifest(slug: string, author?: string): BundleManifest {
  return {
    slug,
    title: `Fixture ${slug}`,
    summary: `A fixture blueprint named ${slug}.`,
    description: undefined,
    category: undefined,
    tags: [],
    author,
    ontologyVersion: "0.1.0",
  };
}

/** The wire form of a card. Stored verbatim in `card_version.source`, which is NOT NULL. */
function cardSource(card: NodeCard): string {
  return [
    `id: ${card.id}`,
    `name: ${card.name}`,
    `type: ${card.type}`,
    `version: ${card.version}`,
    `ontology_version: ${card.ontologyVersion}`,
    `action: ${card.action}`,
    `spec: ${JSON.stringify(card.spec)}`,
    "",
  ].join("\n");
}

/** Plausible DOT for `release.dot`, which is NOT NULL. Nothing published reads it. */
export function dotFor(refs: readonly CardRef[]): string {
  const nodes = refs.map((ref, i) => `  n${i} [card="${ref}"];`).join("\n");
  return `digraph fixture {\n${nodes}\n}\n`;
}

export interface CardFixture {
  rowId: string;
  cardId: string;
  version: string;
  ref: CardRef;
  digest: string;
  body: NodeCard;
  visibility: "public" | "private";
}

export async function insertCard(
  s: Scratch,
  o: CardOptions & {
    ownerId: string;
    visibility?: "public" | "private";
    /** The owner's handle, written into `NodeCard.author`. See `CardOptions.author`. */
    authorHandle?: string;
  },
): Promise<CardFixture> {
  const body = nodeCard({ ...o, author: o.author ?? o.authorHandle });
  const digest = cardDigest(body);
  const visibility = o.visibility ?? "public";
  const [row] = await s.query(
    "insert into card_version (card_id, version, digest, owner_id, visibility, body, source) " +
      "values ($1, $2, $3, $4, $5, $6, $7) returning id",
    [body.id, body.version, digest, o.ownerId, visibility, JSON.stringify(body), cardSource(body)],
  );
  const rowId = row?.id;
  if (typeof rowId !== "string") {
    throw new Error(`Could not insert the card fixture: got ${describe_(rowId)} for its id.`);
  }
  return {
    rowId,
    cardId: body.id,
    version: body.version,
    ref: `${body.id}@${body.version}`,
    digest,
    body,
    visibility,
  };
}

export interface BundleFixture {
  id: string;
  ownerId: string;
  ownerHandle: string;
  slug: string;
  visibility: "public" | "private";
  releaseId: string;
}

/**
 * A bundle AND one release for it, always together.
 *
 * Deliberate: nothing published says whether `counts.blueprints` counts `bundle` rows or
 * bundles with a current release, and T080's readers project from the current release while
 * B-06 says a bundle first exists at its first publish. Seeding both halves makes the two
 * readings agree on every fixture here, so no cell binds a decision the contract has not
 * taken. A bundle with no release is a state this suite deliberately does not create; if the
 * distinction is ruled, it is one fixture away.
 */
export async function insertBundle(
  s: Scratch,
  o: {
    owner: AccountFixture;
    slug: string;
    visibility?: "public" | "private";
    cards?: readonly CardFixture[];
    /** Namespaced `OntologyTerm[]` this release declares, for `release.local_vocabulary`. */
    localVocabulary?: readonly Record<string, unknown>[];
    version?: string;
  },
): Promise<BundleFixture> {
  const visibility = o.visibility ?? "public";
  const [bundleRow] = await s.query(
    "insert into bundle (owner_id, slug, visibility) values ($1, $2, $3) returning id",
    [o.owner.id, o.slug, visibility],
  );
  const bundleId = bundleRow?.id;
  if (typeof bundleId !== "string") {
    throw new Error(`Could not insert the bundle fixture: got ${describe_(bundleId)} for its id.`);
  }

  const cards = o.cards ?? [];
  const cardRefs = cards.map((c) => c.ref);
  const cardDigests = cards.map((c) => c.digest);
  const dot = dotFor(cardRefs);
  const digest = bundleDigest({ dot, cardDigests });
  const [releaseRow] = await s.query(
    "insert into release " +
      "(bundle_id, version, digest, dot, manifest, card_refs, card_digests, local_vocabulary) " +
      "values ($1, $2, $3, $4, $5, $6, $7, $8) returning id",
    [
      bundleId,
      o.version ?? "1.0.0",
      digest,
      dot,
      JSON.stringify(manifest(o.slug, o.owner.handle)),
      cardRefs,
      cardDigests,
      o.localVocabulary === undefined ? null : JSON.stringify(o.localVocabulary),
    ],
  );
  const releaseId = releaseRow?.id;
  if (typeof releaseId !== "string") {
    throw new Error(`Could not insert the release fixture: got ${describe_(releaseId)}.`);
  }

  return {
    id: bundleId,
    ownerId: o.owner.id,
    ownerHandle: o.owner.handle,
    slug: o.slug,
    visibility,
    releaseId,
  };
}

export interface OntologyFixture {
  id: string;
  version: string;
}

export async function insertOntologyVersion(s: Scratch, version: string): Promise<OntologyFixture> {
  const [row] = await s.query(
    "insert into ontology_version (version, digest) values ($1, $2) returning id",
    [version, `sha256:${randomUUID().replaceAll("-", "")}`],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the ontology version fixture: got ${describe_(id)}.`);
  }
  return { id, version };
}

/** The `OntologyTerm` body a namespaced term carries, in both of the stores below. */
export function namespacedTerm(termId: string): Record<string, unknown> {
  return {
    id: termId,
    kind: "phase",
    label: `Fixture term ${termId}`,
    definition: "A namespaced term minted by the T130 fixtures.",
  };
}

/**
 * A term namespaced `<handle>/<name>`, written to BOTH stores that could hold one.
 *
 * This is the shape of a contract ambiguity handled rather than picked. AC1 counts
 * "namespaced terms" and two stores could answer:
 *
 *   (a) `ontology_term` rows whose `term_id` starts with `<handle>/` — except that table's
 *       own docblock says "Core terms only", and core terms belong to nobody, so under this
 *       reading `counts.terms` is zero for every handle and the criterion is vacuous;
 *   (b) the distinct namespaced ids in `release.local_vocabulary` across the handle's
 *       releases — which is where the schema says a namespaced overlay actually lives, and
 *       what `components/profile/load.ts` counts through the merged view.
 *
 * Writing both means every cells' claim — a handle with terms counts more than zero, a
 * handle with none counts zero, adding terms moves the number, a term namespaced to somebody
 * else does not count here — holds under EITHER reading. No cell picks one, and none of them
 * can go green by reading the store I happened to guess.
 */
export async function insertNamespacedTerm(
  s: Scratch,
  o: { ontology: OntologyFixture; bundle: BundleFixture; termId: string },
): Promise<string> {
  await s.query(
    "insert into ontology_term (ontology_version_id, term_id, kind, body) values ($1, $2, $3, $4)",
    [o.ontology.id, o.termId, "phase", JSON.stringify(namespacedTerm(o.termId))],
  );
  const [row] = await s.query("select local_vocabulary from release where id = $1", [
    o.bundle.releaseId,
  ]);
  const existing = Array.isArray(row?.local_vocabulary)
    ? (row.local_vocabulary as Record<string, unknown>[])
    : [];
  await s.query("update release set local_vocabulary = $1 where id = $2", [
    JSON.stringify([...existing, namespacedTerm(o.termId)]),
    o.bundle.releaseId,
  ]);
  return o.termId;
}

/* --------------------- pins: discovered, never guessed --------------------- */

/**
 * The spellings a pin string could take, and why this is a discovery rather than a choice.
 *
 * `setPins(..., pins: readonly string[])` and `pinned: readonly string[]` are published; the
 * SPELLING of one of those strings is not. The Contract line says a pin is "a blueprint or a
 * card ref"; `docs/architecture/seams.md` SEAM-55 publishes a tagged object
 * (`{kind:"blueprint",slug}` / `{kind:"node",ref}`) instead of a string at all; and nothing
 * anywhere says whether a blueprint pin carries its owner.
 *
 * Guessing is worse here than in the usual case, because AC3 makes an unresolvable pin
 * ABSENT: a wrong guess yields `pinned: []`, which is a plausible-looking green followed by
 * cells that quietly assert nothing. So the cells do not name a spelling. They ask the module
 * which one it echoed back, and `pinSpellingFor` reds — naming this finding — when the answer
 * is none.
 *
 * The floor that keeps this honest is in `pins.test.ts`: at least one spelling of each kind
 * must survive, asserted as its own cell, so "every AC3 cell passed" can never mean "every
 * pin resolved to nothing".
 */
export function blueprintPinSpellings(b: BundleFixture): readonly string[] {
  return [`${b.ownerHandle}/${b.slug}`, b.slug];
}

export function cardPinSpellings(c: CardFixture): readonly string[] {
  return [c.ref, c.cardId];
}

export interface PinSpelling {
  /** Which candidate won, so the same spelling can be built for a different target. */
  index: number;
  /** The string `setPins` was given. */
  sent: string;
  /** The string `getProfile` gave back for it. Not assumed equal to `sent`. */
  echoed: string;
}

/**
 * Drive `setPins` with each candidate and keep whichever the module resolves.
 *
 * One candidate per call, never both at once: two candidates in one call cannot tell
 * "it resolved the first" from "it resolved both and I read the wrong element", and AC3's
 * cap of two would make a three-candidate probe a refusal rather than a measurement.
 */
export async function pinSpellingFor(
  s: Scratch,
  actor: unknown,
  accountId: string,
  handle: string,
  candidates: readonly string[],
  what: string,
): Promise<PinSpelling> {
  const setPins = await bind("setPins");
  const getProfile = await bind("getProfile");
  const tried: string[] = [];

  for (const candidate of candidates) {
    await setPins(s.db, actor, accountId, [candidate]);
    const record = asProfileRecord(
      await getProfile(s.db, actor, handle),
      `getProfile(db, owner, "${handle}") while discovering the ${what} pin spelling`,
    );
    if (record.pinned.length === 1) {
      return { index: candidates.indexOf(candidate), sent: candidate, echoed: record.pinned[0]! };
    }
    tried.push(`${JSON.stringify(candidate)} -> ${JSON.stringify(record.pinned)}`);
  }

  throw new Error(
    `No candidate spelling of a ${what} pin survives a \`setPins\` round trip.\n  ` +
      tried.join("\n  ") +
      `\n\n  The target exists in this database, so under AC3 ("a pin whose target no longer ` +
      `resolves is omitted") an empty answer for every spelling means the module resolves ` +
      `none of them.\n` +
      `  This is the reported contract gap, not a guess of mine that missed: \`setPins\` takes ` +
      `\`readonly string[]\` and NOTHING publishes what one of those strings looks like. The ` +
      `Contract line says "a blueprint or a card ref"; seams.md SEAM-55 publishes ` +
      `\`{ pinned: PinnedRef[] }\` — objects, not strings — for the same surface.\n` +
      `  If the module's spelling is none of the above, publish it in the block and this ` +
      `discovers it on the next run without an edit here.`,
  );
}

/* --------------------- leak scanning --------------------- */

/**
 * Every string reachable inside a value, keys included. A leak arrives as a property NAME as
 * readily as a value.
 *
 * Written as a walk with a `seen` set rather than `JSON.stringify`: the input is whatever the
 * module returned, and a value that cycles or carries a `toJSON` would make stringification
 * either throw or quietly answer a different question. T-02's `seen` set for the same reason
 * it exists there — shared substructure is walked once.
 */
export function collectStrings(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (node instanceof Date) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      out.push(key);
      walk(item);
    }
  };
  walk(value);
  return out;
}

/** Which of `tokens` appear anywhere inside `value`. Sorted, so a red reads the same twice. */
export function findTokens(value: unknown, tokens: readonly string[]): string[] {
  const strings = collectStrings(value);
  const hits = new Set<string>();
  for (const token of tokens) {
    for (const s of strings) {
      if (s.includes(token)) {
        hits.add(token);
        break;
      }
    }
  }
  return [...hits].sort();
}

/**
 * T-04's fix, applied before the tells are used rather than after one over-matches.
 *
 * A blacklist asserted with `includes` answers "do these characters appear", where the claim
 * is "did this leak". The two differ exactly when a tell is a substring of something a
 * response may legitimately carry. So every tell is checked against every string the
 * ADMISSIBLE fixtures contain, at fixture time, and a collision is a broken test rather than
 * a red.
 */
export function assertTellsCannotOverMatch(
  tells: readonly string[],
  admissible: readonly unknown[],
): void {
  const strings = admissible.flatMap((value) => collectStrings(value));
  const collisions: string[] = [];
  for (const tell of tells) {
    if (tell === "") {
      collisions.push("(empty string)");
      continue;
    }
    for (const s of strings) {
      if (s.includes(tell)) {
        collisions.push(`${JSON.stringify(tell)} is a substring of ${JSON.stringify(s)}`);
        break;
      }
    }
  }
  if (collisions.length > 0) {
    throw new Error(
      `A tell is a substring of admissible fixture content, so the sweep would red an ` +
        `implementation that leaked nothing (T-04).\n  ` +
        collisions.join("\n  ") +
        `\n  This is a broken test. Re-mint the fixture identifier; do not delete the tell.`,
    );
  }
}
