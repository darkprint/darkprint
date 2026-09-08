/* ============================================================
   T400: the live tutorial channel's test surface

   Not a test file. `vitest.config.ts` collects `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── the routes are discovered, not imported by path ──
   The published contract is two URLs and their methods. The suites
   drive them the way a caller does: matched through Next's own
   router over whatever `app/api/tutorial/**` actually serves,
   dispatched to the file that wins, invoked with `params` as a
   promise. A red therefore says a URL is unserved or a method is
   absent, never that a guessed file path was wrong.

   ── one scratch database per suite ──
   `createTestDb()` makes `darkprint_test_<uuid>`, migrates it and
   drops it; the route handlers reach for `getSharedDbClient()`,
   which reads `DATABASE_URL` and caches on `globalThis`, so the
   suite repoints the variable and clears the cache before the
   first call and closes the pool before the drop.
   ============================================================ */

import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getRouteMatcher } from "next/dist/shared/lib/router/utils/route-matcher.js";
import { getRouteRegex } from "next/dist/shared/lib/router/utils/route-regex.js";
import { getSortedRoutes } from "next/dist/shared/lib/router/utils/sorted-routes.js";

import type { DbClient } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support";

type Namespace = Record<string, unknown>;
type Handler = (request: Request, context: { params: Promise<Record<string, unknown>> }) => unknown;

export const OPEN_ROUTE = "POST /api/tutorial/live";
export const PAGE_ROUTE = "GET, PUT /api/tutorial/live/[token]";

/* --------------------- the database --------------------- */

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const open: TestDb[] = [];

export interface Scratch {
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  /* Asked of the connection rather than rebuilt from a naming convention, so it cannot drift
     from what the client is actually on. */
  const [current] = (await test.client.query<{ name: string }>("select current_database() as name")).rows;
  const base = new URL(process.env.DATABASE_URL ?? "");
  base.pathname = `/${current!.name}`;
  return {
    url: base.toString(),
    query: async (sql, params) => (await test.client.query(sql, params as unknown[])).rows,
  };
}

export async function dropScratchDatabases(): Promise<void> {
  for (const test of open.splice(0)) await test.drop();
}

let savedDatabaseUrl: string | undefined;

/** Point every route handler in this worker at `url`, clearing the cached shared pool. */
export function pointRoutesAt(url: string): void {
  savedDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  delete (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
}

/** Close the pool the routes opened (a `DROP DATABASE` refuses while it lives) and restore the variable. */
export async function restoreRoutesDatabase(): Promise<void> {
  const withShared = globalThis as GlobalWithSharedClient;
  const client = withShared[SHARED_CLIENT_KEY];
  delete withShared[SHARED_CLIENT_KEY];
  if (client !== undefined) await client.close().catch(() => undefined);
  if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedDatabaseUrl;
}

/* --------------------- the routes --------------------- */

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
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walk(join(dir, entry.name), [...segments, entry.name], out);
    else if (ROUTE_FILE.test(entry.name)) {
      out.push({ pattern: `/api/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

/** Every route the tree serves under `app/api/tutorial/**`, in the App Router's precedence order. */
function routeTable(): DiscoveredRoute[] {
  if (table !== undefined) return table;
  const found: DiscoveredRoute[] = [];
  walk(join(API_ROOT, "tutorial"), ["tutorial"], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under app/api/tutorial/**. The contract publishes \`${OPEN_ROUTE}\` ` +
        `and \`${PAGE_ROUTE}\`; nothing here binds a file path, the routes are discovered.`,
    );
  }
  const byPattern = new Map(found.map((r) => [r.pattern, r]));
  const ordered = getSortedRoutes([...byPattern.keys()]);
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
    `No published route matches \`${path}\`. Discovered patterns: ` +
      `${routes.map((r) => r.pattern).join(", ")}`,
  );
}

/** Which discovered pattern serves a URL, without a database or a request. */
export function routePatternFor(path: string): string {
  return matchRoute(path).route.pattern;
}

export interface CallOptions {
  headers?: Record<string, string>;
  /** A string is sent as-is; anything else is JSON-encoded. */
  body?: unknown;
}

/**
 * Drive a published URL with a method. A handler that throws is returned as a rejection
 * rather than caught: a store fault has to answer problem+json and not escape into Next's
 * generic 500, and swallowing the throw would make that unobservable.
 */
export async function callRoute(method: string, path: string, options: CallOptions = {}): Promise<Response> {
  const { route, params } = matchRoute(path);
  const mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
  const handler = mod[method];
  if (typeof handler !== "function") {
    throw new Error(
      `\`${route.pattern}\` exports no \`${method}\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}).`,
    );
  }
  const headers = new Headers(options.headers ?? {});
  let body: string | undefined;
  if (options.body !== undefined) {
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }
  const request = new Request(`https://darkprint.test${path}`, { method, headers, body });
  const answered = await (handler as Handler)(request, { params: Promise.resolve(params) });
  if (!(answered instanceof Response)) {
    throw new Error(`\`${method} ${path}\` answered a ${typeof answered}; a route handler returns a Response.`);
  }
  return answered;
}

/* --------------------- fixtures --------------------- */

/** A draft the shared parser accepts, at a phase past the first, with every optional field. */
export function draftAt(phase: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    phase,
    task: "Watch the listed prices of a few trading cards every morning.",
    bundle: {
      manifest: { slug: "card-prices", title: "Card prices", summary: "Daily lowest price.", tags: ["prices"] },
      dot: 'digraph { a [card="fetch@1.0.0"]; b [card="compare@1.0.0"]; a -> b [label="listings"] }',
      cardFiles: { "cards/fetch@1.0.0.yaml": "id: fetch\nversion: 1.0.0\n" },
    },
    ledger: { settled: ["the need"], open: ["the guards"], blocked: [] },
    hits: [{ kind: "blueprint", ref: "autogen/pipeline-observability", title: "Pipeline observability", score: 0.71 }],
    ...overrides,
  };
}

/** A token of the published shape that no open ever minted. */
export const UNKNOWN_TOKEN = "A".repeat(32);

/** The problem document, or a red naming where it was expected. */
export async function asProblem(response: Response, where: string): Promise<Record<string, unknown>> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("application/problem+json")) {
    throw new Error(`${where}: expected application/problem+json, got ${type || "(no content-type)"}`);
  }
  return (await response.json()) as Record<string, unknown>;
}
