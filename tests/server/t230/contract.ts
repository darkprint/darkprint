/* ============================================================
   T230 — the rate-limit and API-key contract surface

   Not a test file: the vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   The module under test is loaded dynamically so that an absent
   barrel reds per criterion instead of failing the whole file at
   collection. `T230_REFERENCE` swaps it for `./reference.ts`: a
   reference is a measuring instrument, so the cells are written
   from the contract first and the reference is corrected until
   they pass, and `reference-mode.test.ts` reds while the variable
   is set so a reference run is never read as a result about the
   implementation.

   Readings the suite takes where the contract leaves room:
   `checkLimit` CONSUMES budget rather than reporting it, since
   `remaining` is inert under the other reading; a keyed ceiling
   is ordered at or above an anonymous one, never strictly above;
   an unconfigured bucket refuses rather than passing, so bucket
   names are discovered from a published `LimitConfig` where one
   is reachable (`buckets()`) and every message says which
   happened.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { type Db } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support";
import { upsertFromGitHub } from "@/lib/server/accounts";
import type { Actor } from "@/lib/server/policy";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;
export type Row = Record<string, unknown>;

/* ============================================================
   the module under test
   ============================================================ */

/**
 * Set to any non-empty value to measure every criterion against `./reference.ts`
 * instead of `@/lib/server/limits`. A run in that mode is one red short of clean by
 * construction — see `reference-mode.test.ts` — so it cannot be mistaken for a
 * result about the implementation however green the rest of it looks.
 */
export const REFERENCE_MODE = process.env.T230_REFERENCE;

export const BARREL = "@/lib/server/limits";

let limits: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent
 * for the whole file, and every test that awaits it gets its own copy of the same red
 * rather than one test's failure cascading into an unhandled rejection in the next.
 */
export function loadLimits(): Promise<Namespace> {
  limits ??= (
    REFERENCE_MODE === undefined || REFERENCE_MODE === ""
      ? import("@/lib/server/limits")
      : import("./reference.ts")
  ).then((m) => m as unknown as Namespace);
  return limits;
}

/* ============================================================
   the published surface
   ============================================================ */

export interface PublishedFunction {
  name: string;
  /** One entry per declared parameter. */
  params: readonly string[];
  returns: string;
  text: string;
}

export interface PublishedInterface {
  name: string;
  fields: readonly string[];
  text: string;
}

export interface PublishedType {
  name: string;
  definition: string;
  /** String-literal members of a union type, in declaration order. */
  literals: readonly string[];
}

/** The 429's response shape: a status and the members it admits, exactly. */
export interface PublishedProblem {
  status: number;
  members: readonly string[];
  /** Members pinned to a literal value, e.g. `keysAvailable: true`. */
  pinned: Readonly<Record<string, string>>;
}

export interface PublishedBlock {
  functions: readonly PublishedFunction[];
  interfaces: readonly PublishedInterface[];
  types: readonly PublishedType[];
  /** `RateLimitedError` and its admissible message form. */
  admissible: readonly { name: string; form: string }[];
  problems: readonly PublishedProblem[];
}

const PUBLISHED: PublishedBlock = {
  functions: [
    {
      name: "checkLimit",
      params: ["subject: LimitSubject", "bucket: string", "options?: CheckLimitOptions"],
      returns: "Promise<LimitVerdict>",
      text: "checkLimit(subject: LimitSubject, bucket: string, options?: CheckLimitOptions): Promise<LimitVerdict>",
    },
    {
      name: "issueKey",
      params: ["db: Db", "actor: Actor", "accountId: string", "label: string"],
      returns: "Promise<{ record: ApiKeyRecord; secret: string }>",
      text: "issueKey(db: Db, actor: Actor, accountId: string, label: string): Promise<{ record: ApiKeyRecord; secret: string }>",
    },
    {
      name: "revokeKey",
      params: ["db: Db", "actor: Actor", "keyId: string"],
      returns: "Promise<void>",
      text: "revokeKey(db: Db, actor: Actor, keyId: string): Promise<void>",
    },
    {
      name: "resolveKey",
      params: ["db: Db", "secret: string"],
      returns: "Promise<ApiKeyRecord | undefined>",
      text: "resolveKey(db: Db, secret: string): Promise<ApiKeyRecord | undefined>",
    },
    {
      name: "rateLimited",
      params: ["request: Request", "verdict: LimitVerdict", "bucket: string"],
      returns: "Response",
      text: "rateLimited(request: Request, verdict: LimitVerdict, bucket: string): Response",
    },
  ],
  interfaces: [
    {
      name: "LimitVerdict",
      fields: ["allowed", "limit", "remaining", "resetAt", "windowMs"],
      text: "interface LimitVerdict { allowed: boolean; limit: number; remaining: number; resetAt: Date; windowMs: number }",
    },
    {
      name: "ApiKeyRecord",
      fields: ["keyId", "accountId", "label", "scope", "createdAt", "revokedAt"],
      text: "interface ApiKeyRecord { keyId: string; accountId: string; label: string; scope: KeyScope; createdAt: Date; revokedAt: Date | null }",
    },
    {
      name: "BucketLimit",
      fields: ["limit", "windowMs"],
      text: "interface BucketLimit { limit: number; windowMs: number }",
    },
  ],
  types: [
    {
      name: "Tier",
      definition: '"anonymous" | "account" | "key"',
      literals: ["anonymous", "account", "key"],
    },
    {
      name: "LimitConfig",
      definition: "Readonly<Record<string, Readonly<Record<Tier, BucketLimit>>>>",
      literals: [],
    },
  ],
  admissible: [
    {
      name: "RateLimitedError",
      form: "<bucket>: limit of <n> per <window> reached; resets at <ISO instant>.",
    },
  ],
  problems: [
    {
      status: 429,
      members: [
        "type",
        "title",
        "status",
        "detail",
        "instance",
        "limit",
        "remaining",
        "resetAt",
        "keysAvailable",
      ],
      pinned: { keysAvailable: "true" },
    },
  ],
};

export function publishedBlock(): PublishedBlock {
  return PUBLISHED;
}

export function publishedType(name: string): PublishedType {
  const found = PUBLISHED.types.find((t) => t.name === name);
  if (found === undefined) {
    throw new Error(
      `the published surface declares no \`type ${name}\`. It declares: ` +
        `${PUBLISHED.types.map((t) => t.name).join(", ")}.`,
    );
  }
  return found;
}

/** The 429 shape. */
export function publishedProblem(status: number): PublishedProblem {
  const found = PUBLISHED.problems.find((p) => p.status === status);
  if (found === undefined) {
    throw new Error(
      `the published surface has no \`problem+json ${status}\` member list. It has: ` +
        `${PUBLISHED.problems.map((p) => p.status).join(", ")}.`,
    );
  }
  return found;
}

export function publishedFunction(name: string): PublishedFunction {
  const found = PUBLISHED.functions.find((f) => f.name === name);
  if (found === undefined) {
    throw new Error(
      `the published surface names no \`${name}\`. It names: ` +
        `${PUBLISHED.functions.map((f) => f.name).join(", ")}.`,
    );
  }
  return found;
}

export function publishedInterface(name: string): PublishedInterface {
  const found = PUBLISHED.interfaces.find((i) => i.name === name);
  if (found === undefined) {
    throw new Error(
      `the published surface declares no \`interface ${name}\`. It declares: ` +
        `${PUBLISHED.interfaces.map((i) => i.name).join(", ")}.`,
    );
  }
  return found;
}

/**
 * The count `Function.length` reports: REQUIRED parameters only. The count stops at the first
 * default or rest element, and a signature writes `?` where the code writes `= undefined`, so
 * both spellings are excluded.
 */
export function publishedArity(name: string): number {
  return publishedFunction(name).params.filter((p) => !/[?=]/.test(p.split(":")[0] ?? p)).length;
}

export async function requiredFn(name: string): Promise<UnknownFn> {
  const mod = await loadLimits();
  const value = mod[name];
  if (typeof value !== "function") {
    throw new Error(
      `\`${BARREL}\` exports no \`${name}\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}).\n` +
        `  backend.md §T230 Published signatures: ${publishedFunction(name).text}\n` +
        `  The block names the barrel, so a capability living outside it is either a deep ` +
        `path the barrel should re-export or a write outside this task's Owns set.`,
    );
  }
  return value as UnknownFn;
}

/* ============================================================
   the admissible message form, as a shape

   F-230-B: nothing published drives this. What can still be
   measured is the FORM, and it is built from the contract's own
   line rather than retyped — a pin retyped here would agree with
   an implementation that copied the same typo and disagree with
   one that read the sentence.
   ============================================================ */

export interface MessageForm {
  /** The contract's line, verbatim. */
  form: string;
  /** The `<...>` placeholder names, in order. */
  slots: readonly string[];
  pattern: RegExp;
}

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `<bucket>: limit of <n> per <window> reached; resets at <ISO instant>.` becomes an
 * anchored regex with one capture per placeholder. `<n>` is `(\d+)` because the
 * contract calls it a number and the whole point of the pin is that the number in the
 * message is the number in the verdict; every other slot is left open, because the
 * window vocabulary is not published and inventing one would red a correct
 * implementation that spelled it `1 hour` rather than `hour`.
 */
export function messageForm(): MessageForm {
  const admissible = publishedBlock().admissible;
  if (admissible.length !== 1) {
    throw new Error(
      `The T230 block carries ${admissible.length} admissible message forms; this suite is ` +
        `written against exactly one. Found: ${JSON.stringify(admissible)}`,
    );
  }
  const form = admissible[0].form;
  const slots: string[] = [];
  let pattern = "^";
  let index = 0;
  const placeholder = /<([^>]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = placeholder.exec(form)) !== null) {
    pattern += escapeLiteral(form.slice(index, match.index));
    slots.push(match[1]);
    pattern += match[1] === "n" ? "(\\d+)" : "([\\s\\S]+?)";
    index = match.index + match[0].length;
  }
  pattern += escapeLiteral(form.slice(index));
  pattern += "$";
  return { form, slots, pattern: new RegExp(pattern) };
}

/* ============================================================
   buckets

   D-230-04 turned F-230-D from awkward into LOAD-BEARING: "an
   unconfigured bucket REFUSES, it does not pass." So a bucket name
   this suite guessed wrong no longer produces a confusing verdict,
   it produces a refusal — and every consumption cell would red for
   a reason that is the suite's rather than the module's.

   The names are therefore DISCOVERED from a published
   `LimitConfig` when one is reachable, and the tier keys used to
   recognise it come from `type Tier` in the block rather than from
   a list typed here. `bucketSource()` reports which of the two
   happened, and every message that drives a bucket quotes it, so a
   red can never be read without knowing whether the bucket was the
   module's own name or this suite's guess.
   ============================================================ */

let probe = 0;

/** The contract's closest thing to a bucket name: B-17's "reads as well as writes". */
const FALLBACK_BUCKETS = ["read", "write"] as const;

export type BucketSource = "config" | "fallback";

interface BucketProbe {
  read: string;
  write: string;
  all: readonly string[];
  source: BucketSource;
}

function looksLikeLimitConfig(value: unknown, tiers: readonly string[]): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const buckets = Object.values(value as Record<string, unknown>);
  if (buckets.length === 0) return false;
  return buckets.every((bucket) => {
    if (bucket === null || typeof bucket !== "object") return false;
    const byTier = bucket as Record<string, unknown>;
    return tiers.every((tier) => {
      const entry = byTier[tier];
      if (entry === null || typeof entry !== "object") return false;
      const { limit, windowMs } = entry as { limit?: unknown; windowMs?: unknown };
      return typeof limit === "number" && typeof windowMs === "number";
    });
  });
}

let probe_: BucketProbe | undefined;

export async function buckets(): Promise<BucketProbe> {
  if (probe_ !== undefined) return probe_;
  const tiers = publishedType("Tier").literals;
  let found: string[] | undefined;
  try {
    const mod = await loadLimits();
    for (const value of Object.values(mod)) {
      if (looksLikeLimitConfig(value, tiers)) {
        found = Object.keys(value as Record<string, unknown>).sort();
        break;
      }
    }
  } catch {
    /* The module is absent; the fallback is what a red will quote. */
  }
  probe_ =
    found === undefined || found.length < 2
      ? { read: FALLBACK_BUCKETS[0], write: FALLBACK_BUCKETS[1], all: FALLBACK_BUCKETS, source: "fallback" }
      : { read: found[0], write: found[1], all: found, source: "config" };
  return probe_;
}

/** A bucket no `LimitConfig` can contain, for D-230-04. */
export function unconfiguredBucket(): string {
  probe += 1;
  return `t230-unconfigured-${probe}-${process.pid}`;
}

export function bucketNote(source: BucketSource): string {
  return source === "config"
    ? `Bucket names were DISCOVERED from a \`LimitConfig\` published on the barrel, so this ` +
        `red is about the module and not about a name this suite chose.`
    : `Bucket names are this suite's FALLBACK — ${JSON.stringify([...FALLBACK_BUCKETS])} — ` +
        `because no export of \`${BARREL}\` matches D-230-03's \`LimitConfig\` shape ` +
        `(a record of buckets, each a record over \`type Tier\`, each \`{ limit, windowMs }\`). ` +
        `D-230-04 makes an unconfigured bucket REFUSE, so if these names are not the module's ` +
        `own then this red is the suite's and the fix is to publish the vocabulary.`;
}

/* ============================================================
   subjects and actors
   ============================================================ */

export interface Subject {
  accountId: string | null;
  keyId: string | null;
  ip: string;
}

/** A caller nothing has seen, so its counters start where the implementation starts them. */
export function freeIp(): string {
  probe += 1;
  return `203.0.113.${probe % 254}:${process.pid}-${probe}`;
}

export function anonymousSubject(ip = freeIp()): Subject {
  return { accountId: null, keyId: null, ip };
}

export function accountSubject(accountId: string, ip = freeIp()): Subject {
  return { accountId, keyId: null, ip };
}

export function keyedSubject(accountId: string, keyId: string, ip = freeIp()): Subject {
  return { accountId, keyId, ip };
}

export function accountActor(accountId: string, handle: string | null = null): Actor {
  return { kind: "account", accountId, handle };
}

export const ANONYMOUS: Actor = { kind: "anonymous" };

export function operatorActor(accountId: string): Actor {
  return { kind: "operator", accountId };
}

/* ============================================================
   the database each suite file owns
   ============================================================ */

const open: TestDb[] = [];

/** The minimal shape of the `pg` pool drizzle was handed. Typed structurally so this
 *  file needs no driver import of its own. */
interface QueryablePool {
  query: (...args: unknown[]) => Promise<unknown>;
}

export interface Scratch {
  /** The published `Db` — the first parameter of every T230 function. */
  db: Db;
  /** The pool underneath it, which is where a statement recorder attaches. */
  pool: QueryablePool;
  url: string;
  query(sql: string, params?: readonly unknown[]): Promise<Row[]>;
}

export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db as Db | undefined;
  if (db === null || db === undefined || typeof db !== "object") {
    throw new Error(`createTestDb's client carries no \`db\`.`);
  }
  const pool = client.pool as QueryablePool | undefined;
  if (pool === undefined || typeof pool.query !== "function") {
    throw new Error(
      `createTestDb's client carries no \`pool\` with a \`query\`. The AC5 instrument ` +
        `records statements by shadowing that method, so its absence is a broken test.`,
    );
  }
  const [current] = await queryOn(test, "select current_database() as name");
  const database = current?.name;
  if (typeof database !== "string" || database === "") {
    throw new Error(`\`select current_database()\` answered ${JSON.stringify(database)}.`);
  }
  const base = new URL(process.env.DATABASE_URL ?? "");
  base.pathname = `/${database}`;

  return {
    db,
    pool,
    url: base.toString(),
    query: (sql, params) => queryOn(test, sql, params),
  };
}

async function queryOn(test: TestDb, sql: string, params?: readonly unknown[]): Promise<Row[]> {
  const result = await test.client.query(sql, params as unknown[]);
  return result.rows as Row[];
}

export async function dropScratchDatabases(): Promise<number> {
  let dropped = 0;
  for (const test of open.splice(0)) {
    await test.drop();
    dropped += 1;
  }
  return dropped;
}

/* ============================================================
   accounts, built through a published surface

   D-70-22's lesson: a fixture that manufactures a row production
   cannot reach makes a trap "covered" while nothing observes it.
   So an account here comes from T050's `upsertFromGitHub` — a
   merged dependency this task's `Depends on` line names — and
   never from an INSERT typed in this file.
   ============================================================ */

export async function freeAccount(scratch: Scratch): Promise<string> {
  probe += 1;
  const { accountId } = await upsertFromGitHub(scratch.db, {
    githubId: `t230-gh-${randomUUID()}`,
    githubLogin: `t230-octo-${probe}-${process.pid % 10000}`,
  });
  if (typeof accountId !== "string" || accountId === "") {
    throw new Error(`upsertFromGitHub produced no accountId; the fixture is broken.`);
  }
  return accountId;
}

/* ============================================================
   the work instrument

   AC5 is asserted by measuring that `checkLimit` on an
   under-ceiling read performs NO WRITE, not by observing that a
   response came back. Two measurements, and they are different
   quantities:

   **`changed`** is the EFFECT — every table in `public`,
   snapshotted whole before and after, compared order-independently.
   Verb-matching on the statement text would be a blacklist of the
   spellings somebody thought of; a row that moved is a row that
   moved however it was written, including through a function, a
   trigger or a driver-level copy.

   **`statements`** is the COST — what the module actually asked
   the database to do. A limit that scans every prior request to
   decide whether you are over it performs the resource exhaustion
   the limit exists to prevent, and it does that with zero writes.
   ============================================================ */

export interface WorkReport<T> {
  result: T;
  /** Every statement the module issued, in order. */
  statements: readonly string[];
  /** Tables whose full contents differ across the call. */
  changed: readonly string[];
}

async function snapshot(scratch: Scratch): Promise<Map<string, string>> {
  const tables = await scratch.query(
    `select table_name from information_schema.tables ` +
      `where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  const out = new Map<string, string>();
  for (const table of tables) {
    const name = table.table_name;
    if (typeof name !== "string") continue;
    const rows = await scratch.query(`select * from "${name}"`);
    /* Sorted per row and then across rows, so a differing physical order is not a change. */
    const canonical = rows
      .map((row) =>
        JSON.stringify(
          Object.keys(row)
            .sort()
            .map((k) => [k, row[k] instanceof Date ? (row[k] as Date).toISOString() : row[k]]),
        ),
      )
      .sort();
    out.set(name, JSON.stringify(canonical));
  }
  return out;
}

function changedBetween(before: Map<string, string>, after: Map<string, string>): string[] {
  const names = new Set([...before.keys(), ...after.keys()]);
  return [...names].filter((n) => before.get(n) !== after.get(n)).sort();
}

/**
 * Runs `work` with the pool shadowed, between two whole-database snapshots.
 *
 * The snapshots are taken OUTSIDE the recording window on purpose: they are this
 * suite's own statements and counting them would make the cost figure a measurement
 * of the instrument.
 */
export async function measureWork<T>(
  scratch: Scratch,
  work: () => Promise<T>,
): Promise<WorkReport<T>> {
  const before = await snapshot(scratch);
  const statements: string[] = [];
  const pool = scratch.pool;
  const original = pool.query;
  pool.query = function recorded(this: unknown, ...args: unknown[]) {
    const first = args[0];
    statements.push(
      typeof first === "string"
        ? first
        : typeof (first as { text?: unknown })?.text === "string"
          ? ((first as { text: string }).text)
          : JSON.stringify(first),
    );
    return original.apply(this, args);
  } as QueryablePool["query"];

  let result: T;
  try {
    result = await work();
  } finally {
    pool.query = original;
  }
  const after = await snapshot(scratch);
  return { result, statements, changed: changedBetween(before, after) };
}

/* ============================================================
   leak instruments

   T081's F1: every leak instrument there was scoped to the problem
   document and nothing read the response, so a driver code on a
   header reddened nothing blind or colocated. These two are
   written over whatever they are handed — an object, a Response,
   headers included — because the surface that leaks is the one
   nobody scoped an instrument to.
   ============================================================ */

/** Every string reachable in a value, keys included, at any depth. */
export function stringsIn(value: unknown, path = "$", seen = new Set<unknown>()): string[] {
  if (typeof value === "string") return [`${path}=${value}`];
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return [`${path}=${String(value)}`];
  }
  if (value === null || value === undefined) return [];
  if (value instanceof Date) return [`${path}=${value.toISOString()}`];
  if (typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => stringsIn(item, `${path}[${i}]`, seen));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [
    `${path}.${k}#key=${k}`,
    ...stringsIn(v, `${path}.${k}`, seen),
  ]);
}

/**
 * Where a sentinel occurs in a value, by PROVENANCE rather than by a curated list of
 * things a secret is thought to look like. `not.toContain("sk_")` only excludes the
 * leaks somebody thought of; a value the caller holds is a leak wherever it renders,
 * whatever it is spelled.
 */
export function occurrencesOf(sentinel: string, value: unknown): string[] {
  return stringsIn(value).filter((s) => s.includes(sentinel));
}

/** A `Response`, flattened so headers and body are one surface. */
export async function responseSurface(response: Response): Promise<{
  status: number;
  headers: Record<string, string>;
  text: string;
  json: unknown;
}> {
  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => {
    headers[k] = v;
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, headers, text, json };
}

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (typeof value === "object") {
    const name = (value as { constructor?: { name?: string } }).constructor?.name ?? "object";
    return `${name} ${JSON.stringify(value)}`;
  }
  return `${typeof value} ${JSON.stringify(value)}`;
}

/**
 * What a `UnknownFn` returned, as a promise.
 *
 * `requiredFn` binds through a dynamic import and can only be typed as
 * `(...args: unknown[]) => unknown`, so the published functions' returns arrive as
 * `unknown` and `.catch` is not callable on them. Rather than casting at each call site
 * — where a cast reads as an assertion about the value — the widening happens here, in
 * one place, and says what it is.
 */
export function awaited(value: unknown): Promise<unknown> {
  return Promise.resolve(value as Promise<unknown>);
}

/** A promise expected to reject. Returns the rejection so a caller can inspect it. */
export async function rejection(call: Promise<unknown>, where: string): Promise<unknown> {
  try {
    const value = await call;
    throw new Error(
      `${where} resolved with ${describe_(value)} where the contract admits no such answer.`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(where)) throw error;
    return error;
  }
}

/**
 * Every row of every table in `public`, for the leak scan one surface further out than
 * the record.
 *
 * T081's F1 was that every leak instrument there was scoped to the problem document
 * while nothing read the response, so a driver value on a header reddened nothing. The
 * same question asked here — *what passes every pin?* — answers: a secret written to a
 * column nobody named, an audit `detail`, a session row. The tables and their columns
 * come from `information_schema`, so a column added after this file was written is
 * covered by construction rather than by somebody remembering to add it.
 */
export async function dumpDatabase(scratch: Scratch): Promise<Record<string, Row[]>> {
  const tables = await scratch.query(
    `select table_name from information_schema.tables ` +
      `where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  const out: Record<string, Row[]> = {};
  for (const table of tables) {
    const name = table.table_name;
    if (typeof name !== "string") continue;
    out[name] = await scratch.query(`select * from "${name}"`);
  }
  return out;
}

/* ============================================================
   the D-230-05 instrument

   The ruling names it: AC5's instrument is `checkLimit` never
   touching `db` on an under-ceiling anonymous read, "measured with
   a `Proxy`-backed `Db` asserting `touched() === false` — a proof
   the resource was never reached rather than a latency claim."

   Strictly stronger than the whole-database effect snapshot for
   the anonymous case, and not the same instrument: the snapshot
   answers *did a row move*, this answers *was the database reached
   at all*. Both are kept, on the two cases where each is the one
   that can fail — anonymous must never reach it, keyed must reach
   it exactly once and write nothing.

   `Reflect.get` binds to the TARGET rather than to the proxy, so
   drizzle's own internal property access does not count as the
   module reaching for the database. What is recorded is the
   module's own first touch.
   ============================================================ */

export interface ProxiedDb {
  /** Hand this to the function under test in place of the real `Db`. */
  db: Db;
  touched(): boolean;
  /** Which properties were reached for, in order, so a red can name the first one. */
  reached(): readonly string[];
}

export function proxyDb(real: Db): ProxiedDb {
  const reached: string[] = [];
  const db = new Proxy(real as object, {
    get(target, property, receiver) {
      if (typeof property === "string") reached.push(property);
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? (value as UnknownFn).bind(target) : value;
    },
    has(target, property) {
      if (typeof property === "string") reached.push(`in:${property}`);
      return Reflect.has(target, property);
    },
  }) as Db;
  return {
    db,
    touched: () => reached.length > 0,
    reached: () => reached,
  };
}
