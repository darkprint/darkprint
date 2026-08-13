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

   ── two tiers of binding, and why the lists shrank ──
   `backend.md` now carries a **Published signatures** block for
   T000, and the rule above it: "every task's Contract section states
   the exact exported signatures of its public surface". So a name
   the contract publishes is bound *exactly* and its absence is a
   red — `required` and `requiredFn` below, whose message quotes the
   clause that names it.

   The candidate lists survive only where the contract still names
   nothing: the session reader, the session writer, the two http
   helpers, and the client's teardown. Those are reported as open in
   the T000 log rather than treated as settled.

   The reason for the split is two rounds of evidence. A list that
   resolves to *nothing* throws a message naming what it looked for.
   A list that resolves to the *wrong thing* reports a defect that
   does not exist: round 1's list resolved `encodeSession` instead of
   the cookie writer and produced five false reports of a broken
   round trip, and round 2's resolved `migrate` — the one migration
   function with no database parameter — so both suites drove the
   shared database and each dropped the other's tables. Where the
   contract has a name, guessing is worse than binding.

   ── and why every remaining list is checked for kind ──
   A binding is only usable once the thing it bound to has been shown
   to be the right kind of thing: a session writer whose output is a
   cookie rather than the token inside one. That check is
   `BindingError`, and it is a broken test rather than a red.

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

/* --------------------- what the contract publishes --------------------- */

/** What a value is, for a failure message that does not make the reader go looking. */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Response) return `a Response (${value.status})`;
  return typeof value;
}

/**
 * The Published signatures block of `backend.md` §T000, quoted so a red says where the
 * name comes from and not merely that a test wanted it. These are the whole of the named
 * surface; anything not here is still unnamed and still goes through a candidate list.
 */
export const PUBLISHED = {
  withSession:
    "withSession(request, handler): Promise<Response> — the guard wraps, it does not " +
    "return a union",
  migrateUp: "migrateUp(target, dir?), where target is a pool or a connection string",
  migrateDown: "migrateDown(target, steps?, dir?)",
  createDbClient: "createDbClient(config?: string | PoolConfig)",
  getSharedDbClient: "getSharedDbClient(), for route handlers only",
  createObjectStorage: "createObjectStorage(config?)",
  keyForDigest: "keyForDigest(digest)",
  storageVerbs: "put, get and delete on ObjectStorage",
} as const;

/**
 * A name the contract publishes. Absent is a red, and the red says so in as many words:
 * the whole point of the Published signatures block is that this name is no longer a
 * thing either side may choose.
 */
export function required(mod: Namespace, name: string, source: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${source} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. backend.md's ` +
      `T000 Published signatures block names this export exactly, and the rule above it ` +
      `("the contract must name the interface, not only the behaviour") exists because ` +
      `two rounds of candidate lists each resolved to the wrong thing. Do not add a ` +
      `synonym to a list here; publish the name the contract states.`,
  );
}

export function requiredFn(
  mod: Namespace,
  name: string,
  source: string,
  clause: string,
): UnknownFn {
  const value = required(mod, name, source, clause);
  if (typeof value !== "function") {
    throw new Error(
      `${source} exports \`${name}\` as ${describe(value)}; the contract publishes it as ` +
        `a function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/* --------------------- capability resolution, where nothing is named --------------------- */

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
      `  The T000 contract pins the behaviour of this capability and not its name — it is ` +
      `one of the four the Published signatures block still leaves open, and the T000 log ` +
      `says so. If the implementation calls it something else, amend the contract and add ` +
      `the name to this list; do not delete the test.`,
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

/**
 * Still unnamed by the contract, and deliberately optional. An open pool keeps vitest
 * alive after the last assertion, which is a nuisance and not a failed criterion.
 */
const CLOSE_NAMES = ["end", "close", "destroy", "dispose", "disconnect", "shutdown"] as const;
const MODULE_CLOSE_NAMES = ["closeDb", "close", "end", "disconnect", "shutdown", "destroy"] as const;

/** `pg` returns `{ rows }`, several thinner wrappers return the array. Both are a result set. */
function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  if (result !== null && typeof result === "object") {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as Row[];
  }
  throw new Error(`A query returned ${describe(result)}; expected an array of rows or { rows }.`);
}

export interface DbClient {
  /** Exactly what `createDbClient` returned, so it can be handed back as a migration target. */
  raw: unknown;
  query: Query;
  /** Best effort. Teardown is not under test. */
  close(): Promise<void>;
}

/**
 * The one way these tests reach Postgres. There is no driver in this branch's
 * `package.json` and adding one would collide with whatever the implementation picks, so
 * every statement goes through the client the task publishes — which is also the rule the
 * protocol wants: the public interface, and nothing behind it.
 *
 * `config` is the connection string of the database this client is for. Passing it
 * explicitly is what makes the isolation rule implementable at all: `createDbClient` takes
 * one, so a suite that needs a clean database can create its own and point a client at it
 * instead of driving the shared `darkprint`.
 */
export async function dbClient(mod: Namespace, config?: string): Promise<DbClient> {
  const create = requiredFn(mod, "createDbClient", "@/lib/db", PUBLISHED.createDbClient);
  const raw = await create(...(config === undefined ? [] : [config]));
  if (raw === null || typeof raw !== "object") {
    throw new Error(`createDbClient produced ${describe(raw)}; expected a client.`);
  }
  const query = (raw as Namespace).query;
  if (typeof query !== "function") {
    throw new Error(
      `createDbClient produced a client with no \`query\` method (it has: ` +
        `${Object.keys(raw as Namespace).sort().join(", ") || "(nothing)"}). These tests have ` +
        `no Postgres driver of their own, so the published client is the only way in.`,
    );
  }
  return {
    raw,
    query: async (sql, params) => rowsOf(await (query as UnknownFn).call(raw, sql, params)),
    async close() {
      const end = pickOptional(raw as Namespace, CLOSE_NAMES);
      if (typeof end !== "function") return;
      try {
        await (end as UnknownFn).call(raw);
      } catch {
        /* A client that cannot close cleanly is T000's problem to fix, not this suite's to
           report as a failed acceptance criterion. */
      }
    },
  };
}

export function migrateUpFn(mod: Namespace): UnknownFn {
  return requiredFn(mod, "migrateUp", "@/lib/db", PUBLISHED.migrateUp);
}

export function migrateDownFn(mod: Namespace): UnknownFn {
  return requiredFn(mod, "migrateDown", "@/lib/db", PUBLISHED.migrateDown);
}

/** Best effort: a module-level pool kept open outlives the last assertion. Never asserted on. */
export async function closeDbIfPossible(mod: Namespace): Promise<void> {
  const close = pickOptional(mod, MODULE_CLOSE_NAMES);
  if (typeof close === "function") {
    try {
      await (close as UnknownFn)();
    } catch {
      /* Teardown is not under test. */
    }
  }
}

/* --------------------- object storage --------------------- */

/**
 * The store as these tests use it: addressed by the digest the engine computes over the
 * bytes, whatever physical key the published `keyForDigest` maps that digest to.
 */
export interface ObjectStore {
  /** Writes `content` and answers the address it is readable at. */
  put(content: string): Promise<string>;
  get(address: string): Promise<unknown>;
  delete(address: string): Promise<unknown>;
  /** Which of the three call shapes below the store turned out to take. */
  shape: string;
  /** Every address this store has written, so the suite can take back what it left. */
  written: Set<string>;
  cleanup(): Promise<void>;
}

/**
 * The contract publishes the three verbs and `keyForDigest(digest)`, and stops there: it
 * does not say whether the caller supplies the key, supplies the digest, or hands over
 * bytes and is told the address. All three are live readings of "keyed by digest", so the
 * shape is resolved once against a probe and reported, and the ambiguity is on the record
 * in the T000 log rather than settled here.
 *
 * Ordered deliberately. `keyForDigest` is published beside the verbs, so key-first is the
 * strongly signalled reading; the bytes-only call is tried last because handing a
 * two-megabyte string to a `put(key, content)` store would try to write it *as a key*.
 */
type PutShape = "key+content" | "digest+content" | "content";
const PUT_SHAPES: readonly PutShape[] = ["key+content", "digest+content", "content"];

const STORAGE_VERBS = ["put", "get", "delete"] as const;

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

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export async function objectStoreFor(
  mod: Namespace,
  digestOf: (content: string) => string,
): Promise<ObjectStore> {
  requireEnv("S3_ENDPOINT");
  requireEnv("S3_BUCKET");

  const create = requiredFn(mod, "createObjectStorage", "@/lib/db", PUBLISHED.createObjectStorage);
  const keyForDigest = requiredFn(mod, "keyForDigest", "@/lib/db", PUBLISHED.keyForDigest);

  const store = await create();
  if (store === null || typeof store !== "object") {
    throw new Error(`createObjectStorage produced ${describe(store)}; expected an ObjectStorage.`);
  }
  const ns = store as Namespace;
  const missing = STORAGE_VERBS.filter((verb) => typeof ns[verb] !== "function");
  if (missing.length > 0) {
    throw new Error(
      `The ObjectStorage \`createObjectStorage\` produced is missing ${missing.join(", ")}.\n` +
        `  the contract publishes: ${PUBLISHED.storageVerbs}\n` +
        `  found: ${Object.keys(ns).sort().join(", ") || "(nothing)"}\n` +
        `  The delete is not optional any more: the test-isolation amendment has every ` +
        `storage test take back what it wrote, and a store with no delete makes cleanup ` +
        `through the public interface impossible.`,
    );
  }
  const put = ns.put as UnknownFn;
  const get = ns.get as UnknownFn;
  const remove = ns.delete as UnknownFn;

  /** Physical key for a logical address, under whichever shape the store turned out to take. */
  const physical = (shape: PutShape, address: string): string =>
    shape === "key+content" ? String(keyForDigest(address)) : address;

  const written = new Set<string>();

  /* A probe with bytes nothing else can produce, so resolving the shape cannot collide
     with a fixture and cannot be answered by an object an earlier run left behind. */
  const probe = `t000 storage shape probe\n${process.pid}\n${globalThis.performance.now()}\n`;
  const probeDigest = digestOf(probe);
  const probeBytes = new TextEncoder().encode(probe);

  let shape: PutShape | undefined;
  const failures: string[] = [];
  for (const candidate of PUT_SHAPES) {
    try {
      let address: string;
      if (candidate === "content") {
        const answered = await put.call(store, probe);
        if (typeof answered !== "string" || answered.length === 0) {
          failures.push(`${candidate}: put(content) answered ${describe(answered)}, not an address`);
          continue;
        }
        address = answered;
      } else {
        address = probeDigest;
        await put.call(store, physical(candidate, address), probe);
      }
      const read = await get.call(store, physical(candidate, address));
      if (read === undefined || read === null || !sameBytes(asBytes(read), probeBytes)) {
        failures.push(`${candidate}: the probe did not read back`);
        continue;
      }
      written.add(address);
      shape = candidate;
      break;
    } catch (cause) {
      failures.push(`${candidate}: ${String(cause)}`);
    }
  }

  if (shape === undefined) {
    throw new Error(
      `No call to the published storage verbs round-tripped a probe.\n  ${failures.join("\n  ")}\n` +
        `  The contract publishes put, get and delete on ObjectStorage and publishes ` +
        `keyForDigest(digest) beside them, and does not state which of the two supplies ` +
        `the key. All three readings were tried.`,
    );
  }
  const resolved = shape;

  return {
    shape: resolved,
    written,
    async put(content) {
      const digest = digestOf(content);
      if (resolved === "content") {
        const answered = await put.call(store, content);
        const address = typeof answered === "string" && answered.length > 0 ? answered : digest;
        written.add(address);
        return address;
      }
      written.add(digest);
      await put.call(store, physical(resolved, digest), content);
      return digest;
    },
    /* `async` rather than an arrow returning `Promise.resolve(...)`, and the difference is
       load-bearing: mapping an address through `keyForDigest` can throw, the contract says
       so ("a digest is validated where it becomes a key"), and a synchronous throw out of
       `store.get(...)` escapes the caller's `.catch` because there is no promise yet to
       attach it to. Every caller here awaits, so a rejection is what they can handle. */
    async get(address) {
      return await get.call(store, physical(resolved, address));
    },
    async delete(address) {
      return await remove.call(store, physical(resolved, address));
    },
    async cleanup() {
      for (const address of written) {
        try {
          await remove.call(store, physical(resolved, address));
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
