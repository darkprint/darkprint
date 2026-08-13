/* ============================================================
   T000 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under `tests`
   and nothing else, so this module is imported by the suites beside
   it and never collected as one itself.

   ── why every load is a dynamic import ──
   These tests were written in a worktree branched before the
   implementation existed. A static top-level import of a module that
   is not on disk fails the whole file at collection, which reports
   one red where the protocol asks for one per acceptance criterion,
   and hides five criteria behind the first missing module. Loading
   inside the test that needs it turns "the module is not there yet"
   into exactly the per-criterion red the hand-off is supposed to
   produce. The specifier stays a literal so the `@` alias resolves.

   ── why the barrel and not a deep path ──
   `lib/core/index.ts` states the rule this repository already
   follows: "The one module the app imports ... Deep paths are
   internal and may be rearranged, so nothing outside should reach
   for one." T000 owns four surfaces, so there are four barrels:
   `@/lib/db`, `@/lib/server/http`, `@/lib/server/auth` and
   `@/lib/server/types`. A capability that turns out to live outside
   them is either a deep path that the barrel should re-export or a
   write outside the task's `Owns` set, and both are worth a red.

   ── why identifiers are resolved from a candidate list ──
   The contract pins behaviour: migrations idempotent on re-run, a
   digest that reads back byte-identical, the five RFC 9457 members,
   401 for no session, 404 rather than 403. It pins no function name
   anywhere. A test that goes red because the implementer wrote
   `runMigrations` where this file guessed `migrate` is a broken
   test, not a red one, and the protocol says to fix those. So each
   capability is looked up by a short list of names taken from the
   contract's own vocabulary, and the failure message names the
   capability, the module and every name tried. The first entry in
   each list is the name these tests declare canonical; the T000 log
   in `backend.md` carries the lists so the ambiguity sits on the
   record instead of buried in a helper.

   ── why nothing here reads `tests/support/**` ──
   The environment contract in `backend.md` puts that directory on
   the implementation branch, which this worktree cannot see. An
   import of it would fail on the path rather than on the thing under
   test, which is the one failure mode the protocol rejects.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

/* --------------------- the four barrels --------------------- */

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for
 * the whole file, and every test that awaits it gets its own copy of the same red rather
 * than one test's failure cascading into an unhandled rejection in the next.
 */
let dbModule: Promise<Namespace> | undefined;
let httpModule: Promise<Namespace> | undefined;
let authModule: Promise<Namespace> | undefined;
let typesModule: Promise<Namespace> | undefined;

export function loadDb(): Promise<Namespace> {
  dbModule ??= import("@/lib/db").then((m) => m as unknown as Namespace);
  return dbModule;
}

export function loadHttp(): Promise<Namespace> {
  httpModule ??= import("@/lib/server/http").then((m) => m as unknown as Namespace);
  return httpModule;
}

export function loadAuth(): Promise<Namespace> {
  authModule ??= import("@/lib/server/auth").then((m) => m as unknown as Namespace);
  return authModule;
}

export function loadServerTypes(): Promise<Namespace> {
  typesModule ??= import("@/lib/server/types").then((m) => m as unknown as Namespace);
  return typesModule;
}

/* --------------------- capability resolution --------------------- */

/** What a value is, for a failure message that does not make the reader go looking. */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Response) return `a Response (${value.status})`;
  return typeof value;
}

export function pick(
  mod: Namespace,
  capability: string,
  candidates: readonly string[],
  source: string,
): unknown {
  for (const name of candidates) {
    if (mod[name] !== undefined) return mod[name];
  }
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${source} exports no ${capability}.\n` +
      `  tried: ${candidates.join(", ")}\n` +
      `  found: ${exported}\n` +
      `  The T000 contract pins the behaviour of this capability and not its name. ` +
      `If the implementation calls it something else, amend the T000 contract in ` +
      `backend.md and add the name to this list; do not delete the test.`,
  );
}

export function pickFn(
  mod: Namespace,
  capability: string,
  candidates: readonly string[],
  source: string,
): UnknownFn {
  const value = pick(mod, capability, candidates, source);
  if (typeof value !== "function") {
    throw new Error(`${source} exports ${capability} as ${describe(value)}; expected a function.`);
  }
  return value as UnknownFn;
}

/** Absent is an answer here: teardown helpers are a convenience, never a contract term. */
export function pickOptional(mod: Namespace, candidates: readonly string[]): unknown {
  for (const name of candidates) {
    if (mod[name] !== undefined) return mod[name];
  }
  return undefined;
}

/**
 * A capability published either as the thing itself or as a factory for it. The contract
 * says "the client factory" and "the object-storage client" without saying which of the
 * two is exported, so both are accepted and the caller sees one object either way.
 */
async function instantiate(value: unknown): Promise<unknown> {
  return typeof value === "function" ? await (value as UnknownFn)() : value;
}

/* --------------------- the environment contract --------------------- */

/**
 * The eight variables `backend.md` publishes so the implementer and this file agree
 * without seeing each other. Read directly, never through a helper on the other branch.
 */
export const ENVIRONMENT_VARIABLES = [
  "DATABASE_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "SESSION_SECRET",
] as const;

/**
 * Loud rather than skipped. A suite that quietly passes because the infrastructure is
 * down reports the same green as one that checked something, and T000's own goal covers
 * "the local infrastructure both branches run against" — so an unset variable is a
 * failure of the thing under test, not an excuse to stand down.
 */
export function requireEnv(name: (typeof ENVIRONMENT_VARIABLES)[number]): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set.\n` +
        `  The T000 environment contract has both branches read ${ENVIRONMENT_VARIABLES.join(", ")} ` +
        `from the environment, with compose.yaml bringing up Postgres (pgvector available) ` +
        `and a MinIO bucket. Start it and export the variables from .env.example.`,
    );
  }
  return value;
}

/* --------------------- Postgres --------------------- */

export type Row = Record<string, unknown>;
export type Query = (sql: string, params?: readonly unknown[]) => Promise<Row[]>;

const QUERY_NAMES = ["query", "sql", "dbQuery"] as const;
const CLIENT_NAMES = [
  "createDbClient",
  "createClient",
  "createPool",
  "getDb",
  "db",
  "pool",
  "client",
] as const;
const CLOSE_NAMES = ["closeDb", "close", "end", "disconnect", "shutdown", "destroy"] as const;

/** `pg` returns `{ rows }`, several thinner wrappers return the array. Both are a result set. */
function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  if (result !== null && typeof result === "object") {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as Row[];
  }
  throw new Error(`A query returned ${describe(result)}; expected an array of rows or { rows }.`);
}

/**
 * The one way these tests reach Postgres. There is no driver in this branch's
 * `package.json` and adding one would collide with whatever the implementation picks, so
 * every statement goes through the client the task publishes. That is also the rule the
 * protocol wants: the public interface, and nothing behind it.
 */
export async function queryFor(mod: Namespace): Promise<Query> {
  requireEnv("DATABASE_URL");

  const direct = pickOptional(mod, QUERY_NAMES);
  if (typeof direct === "function") {
    return async (sql, params) => rowsOf(await (direct as UnknownFn)(sql, params));
  }

  const client = await instantiate(pick(mod, "client factory", CLIENT_NAMES, "@/lib/db"));
  if (client === null || typeof client !== "object") {
    throw new Error(`@/lib/db published a client factory that produced ${describe(client)}.`);
  }
  const query = (client as Record<string, unknown>).query;
  if (typeof query !== "function") {
    throw new Error(`@/lib/db published a client with no query method.`);
  }
  return async (sql, params) => rowsOf(await (query as UnknownFn).call(client, sql, params));
}

/** Best effort: an open pool keeps vitest alive after the last assertion. Never asserted on. */
export async function closeDbIfPossible(mod: Namespace): Promise<void> {
  const close = pickOptional(mod, CLOSE_NAMES);
  if (typeof close === "function") {
    try {
      await (close as UnknownFn)();
    } catch {
      /* Teardown is not under test. A client that cannot close cleanly is T000's problem
         to fix, not this suite's to report as a failed acceptance criterion. */
    }
  }
}

/* --------------------- object storage --------------------- */

export interface ObjectStore {
  put(content: string): Promise<string>;
  get(digest: string): Promise<unknown>;
}

const STORE_NAMES = [
  "createObjectStore",
  "objectStore",
  "createBlobStore",
  "blobStore",
  "createContentStore",
  "contentStore",
  "createStorage",
  "storage",
  "objects",
  "bytes",
] as const;
const PUT_NAMES = ["put", "putObject", "write", "upload", "store"] as const;
const GET_NAMES = ["get", "getObject", "read", "download", "fetch"] as const;

/**
 * Two call shapes are accepted for `put`. `lib/core/archive/store.ts` publishes
 * `put(content): digest` — the store derives the address, which is the whole point of
 * content addressing — and a client written against S3 first may take
 * `put(digest, content)` instead. The contract says "keyed by digest" without saying who
 * computes it, so both are tried and the failure message names both.
 */
export async function objectStoreFor(mod: Namespace, digestOf: (c: string) => string): Promise<ObjectStore> {
  requireEnv("S3_ENDPOINT");
  requireEnv("S3_BUCKET");

  const store = await instantiate(pick(mod, "object-storage client", STORE_NAMES, "@/lib/db"));
  if (store === null || typeof store !== "object") {
    throw new Error(`@/lib/db published an object-storage client that produced ${describe(store)}.`);
  }
  const ns = store as Namespace;
  const put = pickFn(ns, "a put method", PUT_NAMES, "the object-storage client");
  const get = pickFn(ns, "a get method", GET_NAMES, "the object-storage client");

  return {
    async put(content) {
      let derived: unknown;
      try {
        derived = await put.call(store, content);
      } catch {
        derived = undefined;
      }
      if (typeof derived === "string" && derived.length > 0) return derived;

      const digest = digestOf(content);
      const supplied = await put.call(store, digest, content);
      if (typeof supplied === "string" && supplied.length > 0) return supplied;
      return digest;
    },
    get: (digest) => Promise.resolve(get.call(store, digest)),
  };
}

/**
 * "Byte-identical" is a claim about bytes, so both sides are reduced to bytes before they
 * are compared. A store that hands back text and one that hands back a buffer are both
 * answering the question; a store that hands back text with the encoding mangled is not,
 * and only the byte comparison catches it.
 */
export function asBytes(value: unknown): Uint8Array {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error(`Storage returned ${describe(value)}; expected text or bytes.`);
}

/* --------------------- sessions --------------------- */

/**
 * The cookie the session writer produces, reduced to a `Cookie:` header value. Three
 * return shapes are accepted because the contract says "a GitHub OAuth cookie" and says
 * nothing about how the server hands one out: the `Set-Cookie` string, a
 * `{ name, value }` pair, or a `Response` carrying the header.
 */
export async function cookieHeaderFrom(sealed: unknown): Promise<string> {
  if (typeof sealed === "string") return sealed.split(";")[0].trim();
  if (sealed instanceof Response) {
    const header = sealed.headers.get("set-cookie");
    if (header === null) throw new Error("The session writer returned a Response with no Set-Cookie.");
    return header.split(";")[0].trim();
  }
  if (sealed !== null && typeof sealed === "object") {
    const { name, value } = sealed as { name?: unknown; value?: unknown };
    if (typeof name === "string" && typeof value === "string") return `${name}=${value}`;
  }
  throw new Error(`The session writer returned ${describe(sealed)}; expected a cookie.`);
}

/** Flip one character of the cookie's value, leaving its name and its shape intact. */
export function tamper(cookieHeader: string): string {
  const eq = cookieHeader.indexOf("=");
  const name = cookieHeader.slice(0, eq + 1);
  const value = cookieHeader.slice(eq + 1);
  const at = Math.floor(value.length / 2);
  const flipped = value[at] === "a" ? "b" : "a";
  return name + value.slice(0, at) + flipped + value.slice(at + 1);
}

export const REQUEST_URL = "https://darkprint.test/api/guarded?x=1";

export function requestWithCookie(cookie?: string): Request {
  return new Request(REQUEST_URL, cookie === undefined ? {} : { headers: { cookie } });
}

/* --------------------- RFC 9457 --------------------- */

export interface Problem {
  type: unknown;
  title: unknown;
  status: unknown;
  detail: unknown;
  instance: unknown;
  [member: string]: unknown;
}

export const RFC9457_MEMBERS = ["type", "title", "status", "detail", "instance"] as const;

/** `application/problem+json` may legitimately carry a charset, so the check is a prefix. */
export function isProblemContentType(header: string | null): boolean {
  return header !== null && header.split(";")[0].trim() === "application/problem+json";
}

export async function readProblem(response: Response): Promise<Problem> {
  return (await response.json()) as Problem;
}
