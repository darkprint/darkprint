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

   ── and why every list is checked for kind ──
   A list that resolves to nothing throws a message naming what it
   looked for. A list that resolves to the *wrong* thing is worse: it
   reports a defect that does not exist and sends somebody looking
   for it. So a binding is only usable once the thing it bound to has
   been shown to be the right kind — a guard that returns a
   `Response`, a client that exposes `.query`, a store that exposes
   put and get, a session writer whose output is a cookie rather than
   the token inside one. That last check is `BindingError`, and it is
   the one that was missing.

   ── why nothing here reads `tests/support/**` ──
   The environment contract in `backend.md` puts that directory on
   the implementation branch, which this worktree cannot see. An
   import of it would fail on the path rather than on the thing under
   test, which is the one failure mode the protocol rejects.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

/**
 * A candidate list that bound to an export of the wrong *kind*. Not a red: a red says the
 * implementation is wrong, and this says these tests are. It is raised, never caught and
 * retried, because retrying a different argument shape against the wrong export can only
 * produce a second wrong answer with a longer message in front of it.
 *
 * The list that omitted `sessionCookieHeader` and fell through to `encodeSession` is why
 * this type exists. It resolved to a real function that returned a real string, so five
 * tests reported a broken session round trip that direct invocation showed working — a
 * candidate list resolving to *something* is more dangerous than one resolving to nothing,
 * because the failure it reports is indistinguishable from a defect until somebody goes
 * and checks by hand.
 */
export class BindingError extends Error {
  constructor(message: string) {
    super(
      `${message}\n` +
        `  This is a broken test, not a failed acceptance criterion. Fix the candidate ` +
        `list, not the implementation, and amend the T000 log in backend.md with the name.`,
    );
    this.name = "BindingError";
  }
}

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

/** What a candidate list bound to, carried with the name so a red can say which export it is. */
export interface Bound<T> {
  name: string;
  value: T;
}

export function resolve(
  mod: Namespace,
  capability: string,
  candidates: readonly string[],
  source: string,
): Bound<unknown> {
  for (const name of candidates) {
    if (mod[name] !== undefined) return { name, value: mod[name] };
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

export function resolveFn(
  mod: Namespace,
  capability: string,
  candidates: readonly string[],
  source: string,
): Bound<UnknownFn> {
  const bound = resolve(mod, capability, candidates, source);
  if (typeof bound.value !== "function") {
    throw new Error(
      `${source} exports ${capability} as \`${bound.name}\`, which is ${describe(bound.value)}; ` +
        `expected a function.`,
    );
  }
  return { name: bound.name, value: bound.value as UnknownFn };
}

export function pick(
  mod: Namespace,
  capability: string,
  candidates: readonly string[],
  source: string,
): unknown {
  return resolve(mod, capability, candidates, source).value;
}

export function pickFn(
  mod: Namespace,
  capability: string,
  candidates: readonly string[],
  source: string,
): UnknownFn {
  return resolveFn(mod, capability, candidates, source).value;
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
  /** Every key this store has written, so the suite can take back what it left. */
  written: Set<string>;
  cleanup(): Promise<void>;
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
const DELETE_NAMES = ["remove", "delete", "deleteObject", "del", "erase", "unlink"] as const;

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
  /* Optional here, and deliberately so. The test-isolation amendment has T000 publish a
     delete and has each test take back what it wrote; but a store that has not published
     one yet must fail on AC5, which is what these tests are for, and not on teardown.
     Whether its absence should itself be a red is an open question in the T000 log. */
  const remove = pickOptional(ns, DELETE_NAMES);

  const written = new Set<string>();

  return {
    written,
    async put(content) {
      let derived: unknown;
      try {
        derived = await put.call(store, content);
      } catch {
        derived = undefined;
      }
      if (typeof derived === "string" && derived.length > 0) {
        written.add(derived);
        return derived;
      }

      const digest = digestOf(content);
      written.add(digest);
      const supplied = await put.call(store, digest, content);
      if (typeof supplied === "string" && supplied.length > 0) {
        written.add(supplied);
        return supplied;
      }
      return digest;
    },
    get: (digest) => Promise.resolve(get.call(store, digest)),
    async cleanup() {
      if (typeof remove !== "function") return;
      for (const digest of written) {
        try {
          await (remove as UnknownFn).call(store, digest);
        } catch {
          /* Teardown is not under test. An object left behind is addressed by its own
             content and no other test can name it, which is the whole reason the
             amendment forbids prefixing keys instead of requiring cleanup to succeed. */
        }
      }
      written.clear();
    },
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

/** RFC 6265 §4.1.1: a cookie-name is a token, so no separators, no spaces, no controls. */
export const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/** Enough of the value to recognise it in a failure message, and no more. */
function preview(text: string): string {
  return text.length <= 48 ? text : `${text.slice(0, 48)}… (${text.length} chars)`;
}

/**
 * The kind check on the session-writer binding. A cookie is `name=value`, and a session
 * token is the value alone; the two are both non-empty strings, which is why nothing
 * caught the difference the first time. Everything downstream of this function puts what
 * it is handed into a `Cookie:` header, where a bare token is not a cookie at all — the
 * request carries no session, the guard correctly answers 401, and five tests report a
 * round trip broken in the implementation when it is broken in the list above them.
 */
function asCookiePair(header: string, bound: string): string {
  const pair = header.split(";")[0].trim();
  const eq = pair.indexOf("=");
  if (eq > 0 && COOKIE_NAME.test(pair.slice(0, eq)) && pair.length > eq + 1) return pair;
  throw new BindingError(
    `The session writer resolved to \`${bound}\`, which returned ${JSON.stringify(preview(pair))}.\n` +
      `  That is a bare token, not a \`name=value\` cookie, so \`${bound}\` is the session ` +
      `encoder and not the session writer. Put the cookie writer's name ahead of it in ` +
      `WRITE_NAMES (tests/server/session.test.ts).`,
  );
}

/**
 * The cookie the session writer produces, reduced to a `Cookie:` header value. Three
 * return shapes are accepted because the contract says "a GitHub OAuth cookie" and says
 * nothing about how the server hands one out: the `Set-Cookie` string, a
 * `{ name, value }` pair, or a `Response` carrying the header.
 *
 * A shape this cannot read is an ordinary error, because the caller has another argument
 * order left to try. A shape it can read that is not a cookie is a `BindingError`: the
 * call worked and answered, so no other argument order will improve on it.
 */
export async function cookieHeaderFrom(sealed: unknown, bound: string): Promise<string> {
  if (typeof sealed === "string") return asCookiePair(sealed, bound);
  if (sealed instanceof Response) {
    const header = sealed.headers.get("set-cookie");
    if (header === null) {
      throw new BindingError(
        `The session writer resolved to \`${bound}\`, which returned a Response with no Set-Cookie.`,
      );
    }
    return asCookiePair(header, bound);
  }
  if (sealed !== null && typeof sealed === "object") {
    const { name, value } = sealed as { name?: unknown; value?: unknown };
    if (typeof name === "string" && typeof value === "string") {
      return asCookiePair(`${name}=${value}`, bound);
    }
  }
  throw new Error(`The session writer \`${bound}\` returned ${describe(sealed)}; expected a cookie.`);
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
