/* ============================================================
   T230 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   Written in a worktree branched from `backend` at `dae638e`,
   before `lib/server/limits` exists. Every load of the module
   under test is a dynamic import for T000's recorded reason: a
   static top-level import of a file that is not on disk fails the
   whole suite at collection and hides every criterion behind one
   red.

   ── the module under test is named ONCE, here ──
   `T230_REFERENCE` swaps it for `./reference.ts`. A reference is a
   measuring instrument and an instrument that cannot register the
   quantity reads zero for the same reason a broken one does, so
   the cells are written from the ruling FIRST and the reference is
   corrected until they pass. `reference-mode.test.ts` reds while
   the variable is set, which is what stops a reference-mode run
   being read as a result about the implementation.

   ── the four findings this suite was written around ──
   Each resolves two ways against the section as published. None is
   resolved here: a pin on a guess reds a correct implementation
   that guessed differently, and picking would remove the finding.

   **F-230-A — the block's schema premise is stale.** It says, at
   `912666e`, that no API-key table exists and calls that a
   dependency on T000's owner. T005 merged at `011a851` and
   `lib/db/schema.ts:537` carries `api_key` with exactly the five
   columns `ApiKeyRecord` needs plus `token_hash`. This suite is
   written against the merged table. Harmless direction, and it
   still reads as settled to the next person who opens the block.

   **F-230-B — AC1 is not reachable through anything published.**
   `checkLimit` RETURNS a verdict; it does not throw.
   `RateLimitedError` and its message form sit in the admissible-
   form block, but the class is in no signature, has no published
   constructor, and no published function returns or throws it.
   MEASURED rather than asserted, because a claim of silence is the
   cheapest measurement to get wrong: `grep -n RateLimitedError
   backend.md` returns exactly ONE line in 12 152, and it is the
   admissible-form line itself. The
   only surface that turns a verdict into a `problem+json` 429 is a
   route — and every other route file is Forbidden to T230, while
   T230's own `app/api/account/keys/**` has no published URL,
   method, body or response shape. Compare T081, whose eleven route
   probes were published and were the whole reason its key-set
   whitelist could run. So `refusal.test.ts` pins the message form
   as a SHAPE, derived from the contract's own line rather than
   retyped, and says in place that nothing drives it.

   **F-230-C — "consumed not restated" is unsatisfiable as
   written.** `MAX_KB = 512` is a module-private `const` in
   `components/upload/BundleDropzone.tsx` and `MAX_PARAM_DEPTH =
   100` is a module-private `const` in `lib/core/card/validate.ts`.
   Neither is exported from anything, so `lib/server/limits` cannot
   consume either and the only move available to an implementer is
   the restatement the clause forbids. `premises.test.ts` guards
   the two cited sites against drift and is labelled as a guard on
   the contract's premise rather than on T230.

   **F-230-E — T220's AC6 requires a fifth thing in the refusal
   and T230's form has no slot for it.** `backend.md:11893`: "T230's
   429 must reach the MCP client with the limit, the reset instant
   **and the fact that a key exists**." T230's admissible form
   carries the bucket, the number, the window and the instant, and
   an admissible form is exact-matched — that is its whole purpose.
   So an implementation satisfying T220's AC6 by naming the key
   affordance in the message violates T230's published form, and
   one satisfying the form leaves T220's AC6 unsatisfiable. The
   natural home is an RFC 9457 extension member or a `Link` header
   on the 429, and §T230 publishes NO key set for that problem
   document at all — which is exactly the hole T081 closed for its
   own eleven routes, arriving in a task that ships no route the
   429 can be observed on (F-230-B).

   **F-230-D — `bucket: string` has no published vocabulary.** So
   nothing blind can name a bucket, and an implementation that
   refuses an unknown one reds this suite for a reason that is this
   suite's. `READ_BUCKET`/`WRITE_BUCKET` below are the closest the
   contract comes to naming any — B-17 is "reads as well as
   writes" and AC5 is "an anonymous read" — and they are labelled
   as a reading rather than a resolution.

   Two smaller readings, taken and flagged where they are used:
   `checkLimit` is assumed to CONSUME budget rather than merely
   report it (`remaining` is otherwise inert), and AC4's "refused
   immediately" is pinned as the disjunction both readings share,
   since `ApiKeyRecord` carries `revokedAt` at all.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
   the published surface, DERIVED from backend.md

   `A construction over an author's transcription of a spec is a
   list one level up` — so the domain every loop below quantifies
   over is parsed out of the contract document itself, and the
   transcribed constants exist only as a FLOOR that reds the day
   the loop and the contract disagree (`surface.test.ts`).
   ============================================================ */

const BACKEND_MD = fileURLToPath(new URL("../../../backend.md", import.meta.url));

export interface PublishedFunction {
  name: string;
  /** Top-level parameters, split at depth zero so an inline object type stays one. */
  params: readonly string[];
  returns: string;
  text: string;
}

export interface PublishedInterface {
  name: string;
  fields: readonly string[];
  text: string;
}

export interface PublishedBlock {
  functions: readonly PublishedFunction[];
  interfaces: readonly PublishedInterface[];
  /** `RateLimitedError` and the quoted admissible message form, as the block writes them. */
  admissible: readonly { name: string; form: string }[];
}

function sectionOf(document: string, heading: string): string {
  const start = document.indexOf(`\n### ${heading}`);
  if (start === -1) {
    throw new Error(
      `backend.md carries no \`### ${heading}\` section.\n` +
        `  This suite derives its whole domain from that section rather than from a list ` +
        `typed here, so a missing heading is a broken test and not a failed criterion.`,
    );
  }
  const rest = document.slice(start + 1);
  const end = rest.indexOf("\n### ");
  return end === -1 ? rest : rest.slice(0, end);
}

/** Split at brace/paren depth zero, so `subject: { a: X; b: Y }` survives as one parameter. */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "{" || ch === "(" || ch === "<" || ch === "[") depth += 1;
    else if (ch === "}" || ch === ")" || ch === ">" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "") out.push(current.trim());
  return out;
}

const SIGNATURE = /^(\w+)\((.*)\):\s*(.+)$/;
const INTERFACE = /^interface\s+(\w+)\s*\{(.+)\}$/;
const ADMISSIBLE = /^(\w*Error)\s+"(.+)"$/;

let block: PublishedBlock | undefined;

/**
 * The `- **Published signatures**` block of `### T230`, parsed. Everything indented
 * eight spaces inside the section and above `- **Goal:**` is the block; the section's
 * prose is not indented that way and its own fenced examples are not either.
 */
export function publishedBlock(): PublishedBlock {
  if (block !== undefined) return block;
  const section = sectionOf(readFileSync(BACKEND_MD, "utf8"), "T230, Rate limiting and API keys");
  const goal = section.indexOf("\n- **Goal:**");
  const scope = goal === -1 ? section : section.slice(0, goal);

  const functions: PublishedFunction[] = [];
  const interfaces: PublishedInterface[] = [];
  const admissible: { name: string; form: string }[] = [];

  for (const raw of scope.split("\n")) {
    if (!/^ {8}\S/.test(raw)) continue;
    const line = raw.trim();

    const iface = INTERFACE.exec(line);
    if (iface !== null) {
      interfaces.push({
        name: iface[1],
        fields: iface[2]
          .split(";")
          .map((f) => f.trim())
          .filter((f) => f !== "")
          .map((f) => f.slice(0, f.indexOf(":")).trim()),
        text: line,
      });
      continue;
    }

    const form = ADMISSIBLE.exec(line);
    if (form !== null) {
      admissible.push({ name: form[1], form: form[2] });
      continue;
    }

    const fn = SIGNATURE.exec(line);
    if (fn !== null) {
      functions.push({
        name: fn[1],
        params: splitTopLevel(fn[2]),
        returns: fn[3].trim(),
        text: line,
      });
    }
  }

  if (functions.length === 0 || interfaces.length === 0) {
    throw new Error(
      `The T230 Published signatures block parsed to ${functions.length} function(s) and ` +
        `${interfaces.length} interface(s). The block is eight-space indented inside the ` +
        `section; if its indentation changed, this parser is what is broken, not T230.`,
    );
  }
  block = { functions, interfaces, admissible };
  return block;
}

export function publishedFunction(name: string): PublishedFunction {
  const found = publishedBlock().functions.find((f) => f.name === name);
  if (found === undefined) {
    throw new Error(
      `The T230 Published signatures block names no \`${name}\`. It names: ` +
        `${publishedBlock().functions.map((f) => f.name).join(", ")}.`,
    );
  }
  return found;
}

export function publishedInterface(name: string): PublishedInterface {
  const found = publishedBlock().interfaces.find((i) => i.name === name);
  if (found === undefined) {
    throw new Error(
      `The T230 Published signatures block declares no \`interface ${name}\`. It declares: ` +
        `${publishedBlock().interfaces.map((i) => i.name).join(", ")}.`,
    );
  }
  return found;
}

/**
 * The FLOOR, and the only list in this file typed by hand. Every loop quantifies over
 * `publishedBlock()`; this exists so that the day the contract gains a fifth function
 * or renames a field, `surface.test.ts` reds instead of the loops silently covering a
 * different surface than the one this suite was written against.
 *
 * `A floor absorbs additions silently and then stops detecting removals`, so it is an
 * equality on the whole set rather than a subset check or a count.
 */
export const TRANSCRIBED = {
  functions: ["checkLimit", "issueKey", "revokeKey", "resolveKey"],
  interfaces: {
    LimitVerdict: ["allowed", "limit", "remaining", "resetAt"],
    ApiKeyRecord: ["keyId", "accountId", "label", "createdAt", "revokedAt"],
  },
  admissible: ["RateLimitedError"],
} as const;

/** Declared arity, from the parsed parameter lists rather than from a table typed here. */
export function publishedArity(name: string): number {
  return publishedFunction(name).params.length;
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

   F-230-D. Named here once so a red can say which reading it
   rests on rather than leaving a bare string at nine call sites.
   ============================================================ */

export const READ_BUCKET = "read";
export const WRITE_BUCKET = "write";

export const BUCKET_READING =
  `\`bucket: string\` has no published vocabulary in §T230, so this suite probes ` +
  `${JSON.stringify(READ_BUCKET)} and ${JSON.stringify(WRITE_BUCKET)} — the closest the ` +
  `contract comes to naming any (B-17 is "reads as well as writes", AC5 is "an anonymous ` +
  `read"). If this red is an implementation that refuses an unknown bucket, the red is this ` +
  `suite's and the fix is to publish the vocabulary, not to change the module.`;

/* ============================================================
   subjects and actors
   ============================================================ */

export interface Subject {
  accountId: string | null;
  keyId: string | null;
  ip: string;
}

let probe = 0;

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
   the starting numbers the contract cites

   Derived from `backend.md` rather than transcribed here, so a
   third citation added to §T230 is covered without an edit and a
   changed line number reds. Each citation carries all three parts
   the contract writes — the value, the file and the line — so the
   check is against the site the block points at rather than
   against an identifier this suite went looking for.
   ============================================================ */

export interface CitedNumber {
  value: number;
  path: string;
  line: number;
}

const CITATION = /\b(\d+)\b[^()]{0,60}\(`([\w./-]+\.(?:ts|tsx))(?::(\d+))?`\)/g;

export function citedNumbers(): CitedNumber[] {
  const section = sectionOf(
    readFileSync(BACKEND_MD, "utf8"),
    "T230, Rate limiting and API keys",
  );
  const found = new Map<string, CitedNumber>();
  CITATION.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CITATION.exec(section)) !== null) {
    if (match[3] === undefined) continue;
    const cited = { value: Number(match[1]), path: match[2], line: Number(match[3]) };
    found.set(`${cited.path}:${cited.line}:${cited.value}`, cited);
  }
  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** The line the contract points at, read from the tree. */
export function sourceLine(path: string, line: number): string {
  const source = readFileSync(fileURLToPath(new URL(path, new URL("../../../", import.meta.url))), "utf8");
  const lines = source.split("\n");
  if (line < 1 || line > lines.length) {
    throw new Error(
      `\`${path}\` has ${lines.length} lines and backend.md §T230 cites line ${line}. The ` +
        `citation points past the end of the file, so the block is describing a tree that no ` +
        `longer exists.`,
    );
  }
  return lines[line - 1];
}
