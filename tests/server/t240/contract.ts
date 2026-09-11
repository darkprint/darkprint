/* ============================================================
   T240 — the audit contract surface

   Not a test file: the vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   The module under test is loaded dynamically so that an absent
   barrel reds per criterion instead of failing the whole file at
   collection, and `barrelExports()` separates three states
   through the public interface, as a caller sees it, so a member
   declared in a file but never re-exported reads as absent:

     • the import REJECTS            → the module is absent
     • it resolves and a key is
       missing from `Object.keys`    → the member is absent
     • the key is there              → an assertion failed
   ============================================================ */

import { getTableConfig } from "drizzle-orm/pg-core";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;
export type Row = Record<string, unknown>;

/* ============================================================
   the module under test, named ONCE
   ============================================================ */

export const BARREL = "@/lib/server/observability";

let observability: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for
 * the whole file, and every cell that awaits it gets its own copy of the same red rather
 * than one cell's failure cascading into an unhandled rejection in the next.
 */
export function loadObservability(): Promise<Namespace> {
  observability ??= import("@/lib/server/observability").then((m) => m as unknown as Namespace);
  return observability;
}

/**
 * The three-state discriminator described in the header, as a value a cell can assert on.
 *
 * `state` is the thing a reader needs and the thing neither a type pin nor a bare
 * `rejects.toThrow()` can tell them apart: a pin over an absent member is silently `true`,
 * and an import rejection and a missing export both read as "the test failed".
 */
export interface BarrelState {
  state: "module-absent" | "present";
  /** Every name the barrel exports, sorted. Empty when the module is absent. */
  keys: readonly string[];
  /** The import rejection, when there was one. */
  cause?: unknown;
}

export async function barrelExports(): Promise<BarrelState> {
  try {
    const mod = await loadObservability();
    return { state: "present", keys: Object.keys(mod).sort() };
  } catch (cause) {
    return { state: "module-absent", keys: [], cause };
  }
}

/** What a value is, for a failure message that does not make the reader go looking. */
export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  return typeof value;
}

/**
 * A name the contract publishes. Absent is a red, and the red says so in as many words,
 * and says WHICH of the three states produced it — the whole job `barrelExports` exists
 * for, carried into the message rather than left for the reader to work out.
 */
export function required(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${BARREL} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  The module RESOLVED, so this is a MEMBER absent and not the module absent — a ` +
      `failed acceptance criterion, not a naming difference. Do not add a synonym to a ` +
      `candidate list here; publish the name the contract states, or amend the contract.`,
  );
}

export function requiredFn(mod: Namespace, name: string, clause: string): UnknownFn {
  const value = required(mod, name, clause);
  if (typeof value !== "function") {
    throw new Error(
      `${BARREL} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/* ============================================================
   the published surface
   ============================================================ */

export interface PublishedSignature {
  name: string;
  /** One entry per declared parameter. */
  params: readonly string[];
  returns: string;
  text: string;
}

export interface PublishedInterface {
  name: string;
  /** `field: type`, in declaration order. */
  fields: readonly string[];
}

export interface PublishedBlock {
  signatures: readonly PublishedSignature[];
  interfaces: readonly PublishedInterface[];
  /** The admissible refusal messages. */
  admissible: readonly string[];
}

/**
 * The one refusal `listAudit` may throw. Asserted by EXACT MATCH and never by scanning for
 * forbidden substrings: a whitelist asserted with a blacklist test is a blacklist, and an
 * `includes` answers "do these characters appear" where the claim is "does this leak".
 */
export const REFUSAL_FORM = "listAudit: not permitted.";

const PUBLISHED: PublishedBlock = {
  signatures: [
    {
      name: "writeAudit",
      params: ["db: Db", "entry: AuditEntry"],
      returns: "Promise<void>",
      text: "writeAudit(db: Db, entry: AuditEntry): Promise<void>",
    },
    {
      name: "listAudit",
      params: ["db: Db", "actor: Actor", "filter: { targetKind?: string; targetId?: string; since?: Date }"],
      returns: "Promise<(AuditEntry & { occurredAt: Date })[]>",
      text: "listAudit(db: Db, actor: Actor, filter: { targetKind?: string; targetId?: string; since?: Date }): Promise<(AuditEntry & { occurredAt: Date })[]>",
    },
  ],
  interfaces: [
    {
      name: "AuditEntry",
      fields: [
        "actorId: string | null",
        'actorKind: "owner" | "operator" | "system"',
        "action: AuditAction",
        "targetKind?: string",
        "targetId?: string",
        'decision: "allowed" | "denied" | "error"',
        "detail?: Record<string, string | number | boolean>",
      ],
    },
  ],
  admissible: [REFUSAL_FORM],
};

export function publishedBlock(): PublishedBlock {
  return PUBLISHED;
}

/** The one signature by name, or a throw naming what the surface does carry. */
export function signature(name: string): PublishedSignature {
  const found = PUBLISHED.signatures.find((s) => s.name === name);
  if (found === undefined) {
    throw new Error(
      `the published surface declares no \`${name}(...)\`. It declares: ` +
        `${PUBLISHED.signatures.map((s) => s.name).join(", ")}.`,
    );
  }
  return found;
}

export function refusalForm(): string {
  return REFUSAL_FORM;
}

/**
 * The closed audit vocabulary. A member no caller exists for is a guard that cannot fail, so
 * the set grows only with the caller that writes it, and the module's `AUDIT_ACTIONS` is
 * compared against it as a set.
 */
export const RATIFIED_ACTIONS = [
  "account.create",
  "account.update",
  "handle.allocate",
  "handle.release",
  "bundle.create",
  "release.add",
  "bundle.publish",
  "card.add",
  "ontology.release",
  "key.issue",
  "key.revoke",
  "counter.write_failed",
  "note.remove",
] as const;

export function ratifiedActions(): string[] {
  return [...RATIFIED_ACTIONS];
}

/* ============================================================
   setup that reds per cell instead of skipping

   A throw in `beforeAll` produces SKIPS, not reds: the run
   stands down rather than failing, and a skipped criterion is
   invisible in the totals. Measured in this run at 127 merged
   cells going silent under one broken writer, while thirteen
   cells in a suite that recorded the setup failure and re-raised
   it per cell went red on the same defect. Per-criterion reds
   belong in the cells.
   ============================================================ */

export class RecordedSetup<T> {
  private value: T | undefined;
  private failure: unknown;
  private ran = false;

  constructor(private readonly what: string) {}

  async run(make: () => Promise<T>): Promise<void> {
    this.ran = true;
    try {
      this.value = await make();
    } catch (cause) {
      this.failure = cause;
    }
  }

  /** The set-up value, or a red carrying the setup failure. Call this first in every cell. */
  require(): T {
    if (this.failure !== undefined) {
      throw new Error(
        `${this.what} could not be set up, so this criterion was NEVER EXERCISED.\n` +
          `  Re-raised per cell on purpose: a throw in \`beforeAll\` skips, and a skipped ` +
          `criterion is invisible in the totals.\n` +
          `  Cause: ${
            this.failure instanceof Error ? this.failure.stack : String(this.failure)
          }`,
      );
    }
    if (!this.ran || this.value === undefined) {
      throw new Error(`${this.what} was never set up: the \`beforeAll\` did not run.`);
    }
    return this.value;
  }

  /** For teardown, which must not itself throw when setup never produced anything. */
  optional(): T | undefined {
    return this.failure === undefined ? this.value : undefined;
  }
}

/* ============================================================
   the scratch database and the row instrument
   ============================================================ */

export interface Scratch extends TestDb {
  /** An account row whose id is a real FK target for `audit.actor_id`. */
  ownerId: string;
  operatorId: string;
}

/**
 * A migrated database of this suite's own, never the shared `DATABASE_URL` one, and two
 * accounts seeded through raw SQL rather than through `@/lib/server/accounts`.
 *
 * Raw SQL on purpose: `audit.actor_id` is a real foreign key to `account.id`, so the cells
 * need account rows to exist, and `upsertFromGitHub` would put another task's module on the
 * path between the planting and the thing under test. When a fixture write fails there, the
 * red names the wrong module.
 */
export async function scratchDatabase(): Promise<Scratch> {
  const db = await createTestDb();
  const rows = await db.client.query<{ id: string }>(
    `insert into "account" (github_id, github_login, handle)
     values ($1, $2, $3), ($4, $5, $6) returning id`,
    ["9000001", "t240-owner", "t240-owner", "9000002", "t240-operator", "t240-operator"],
  );
  if (rows.rows.length !== 2) {
    throw new Error(`scratchDatabase: seeded ${rows.rows.length} accounts, expected 2.`);
  }
  return { ...db, ownerId: rows.rows[0].id, operatorId: rows.rows[1].id };
}

/**
 * Every row of every table, as text, per table, sorted.
 *
 * **Whole-database and element-wise, and both halves are load-bearing.** A count is the
 * property two genuinely different states are most likely to share: this run measured a
 * Postgres stamp reading 14 before and 14 after over two entirely different name sets, and
 * the check passed. So rows are compared as a MULTISET of their own text and never as a
 * number, and every table is in the net rather than `audit` alone — an implementation that
 * writes its one audit row and also touches something else satisfies every assertion
 * scoped to `audit` and is caught here.
 */
export async function snapshotRows(scratch: Scratch): Promise<Map<string, string[]>> {
  const tables = await scratch.client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  const snapshot = new Map<string, string[]>();
  for (const { table_name: name } of tables.rows) {
    const rows = await scratch.client.query<{ row: unknown }>(
      `select to_jsonb(t) as row from "${name}" t`,
    );
    snapshot.set(name, rows.rows.map((r) => JSON.stringify(r.row)).sort());
  }
  if (snapshot.size === 0) {
    throw new Error(
      "snapshotRows found no tables in the scratch database — the instrument is broken, and " +
        "an empty snapshot makes every `nothing else was written` assertion vacuously true.",
    );
  }
  return snapshot;
}

/** Rows in `after` and not in `before`, per table, as a multiset difference. */
export function rowsAdded(
  before: Map<string, string[]>,
  after: Map<string, string[]>,
): Map<string, Row[]> {
  const added = new Map<string, Row[]>();
  for (const [table, rows] of after) {
    const seen = new Map<string, number>();
    for (const row of before.get(table) ?? []) seen.set(row, (seen.get(row) ?? 0) + 1);
    const fresh: Row[] = [];
    for (const row of rows) {
      const left = seen.get(row) ?? 0;
      if (left > 0) seen.set(row, left - 1);
      else fresh.push(JSON.parse(row) as Row);
    }
    if (fresh.length > 0) added.set(table, fresh);
  }
  return added;
}

export function totalAdded(added: Map<string, Row[]>): number {
  let total = 0;
  for (const rows of added.values()) total += rows.length;
  return total;
}

/** `table: n, table: n` — a message that says WHERE, not merely that something appeared. */
export function describeAdded(added: Map<string, Row[]>): string {
  if (added.size === 0) return "(nothing)";
  return [...added.entries()].map(([table, rows]) => `${table}: ${rows.length}`).join(", ");
}

/**
 * The audit columns AC1 names, lifted off a raw row so a cell compares a whole tuple in one
 * assertion rather than six that can each pass while the row names the wrong subject.
 *
 * `id` and `occurred_at` are deliberately NOT here: they are per-row and unpredictable, and
 * a tuple carrying them could never be written down by a cell. They are asserted separately,
 * where the assertion can be about what they must EXCLUDE.
 */
export interface AuditTuple {
  actor_id: string | null;
  actor_kind: string;
  action: string;
  target_kind: string | null;
  target_id: string | null;
  decision: string;
  detail: unknown;
}

export function auditTuple(row: Row): AuditTuple {
  return {
    actor_id: (row.actor_id ?? null) as string | null,
    actor_kind: row.actor_kind as string,
    action: row.action as string,
    target_kind: (row.target_kind ?? null) as string | null,
    target_id: (row.target_id ?? null) as string | null,
    decision: row.decision as string,
    detail: row.detail,
  };
}

/** Every `audit` row, oldest first, as raw JSON objects. */
export async function auditRows(scratch: Scratch): Promise<Row[]> {
  const rows = await scratch.client.query<{ row: Row }>(
    `select to_jsonb(a) as row from "audit" a order by a.occurred_at, a.id`,
  );
  return rows.rows.map((r) => r.row);
}

/* ============================================================
   binding the module under test

   **Every cell calls these LAST**, after its premises and its
   planting and after the `before` snapshot has been taken. An
   early bind reds the cell correctly about its own subject while
   masking every write below it, and this run found three cells
   in another task that had never executed for exactly that
   reason. The tell is a red in 0ms where I/O was expected, so
   the ordering is a rule here rather than a preference.
   ============================================================ */

/** `writeAudit(db, entry): Promise<void>`, as published. */
export async function boundWriteAudit(): Promise<
  (db: unknown, entry: unknown) => Promise<void>
> {
  const mod = await loadObservability();
  const fn = requiredFn(mod, "writeAudit", "writeAudit(db: Db, entry: AuditEntry): Promise<void>");
  return (db, entry) => fn(db, entry) as Promise<void>;
}

/**
 * `listAudit(db, actor, filter)` — D-240-02's return shape, which is the block's plus
 * `occurredAt`. Typed loosely here on purpose: the shape is pinned by `tsc` in
 * `published-shape.test.ts`, and a cast in a runtime helper would neuter it — `true as Pin`
 * compiles whatever `Pin` is.
 */
export async function boundListAudit(): Promise<
  (db: unknown, actor: unknown, filter: unknown) => Promise<Row[]>
> {
  const mod = await loadObservability();
  const fn = requiredFn(
    mod,
    "listAudit",
    "listAudit(db: Db, actor: Actor, filter: {...}): Promise<(AuditEntry & { occurredAt: Date })[]>",
  );
  return (db, actor, filter) => fn(db, actor, filter) as Promise<Row[]>;
}

/** D-240-03's closed set. Absent is a red naming the ruling, not a naming difference. */
export async function boundAuditActions(): Promise<readonly string[]> {
  const mod = await loadObservability();
  const value = required(
    mod,
    "AUDIT_ACTIONS",
    "D-240-03: `AUDIT_ACTIONS` is published as a closed set and `action` is typed as that union",
  );
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new Error(
      `${BARREL} exports \`AUDIT_ACTIONS\` as ${describe_(value)}; D-240-03 publishes it as a ` +
        `closed set of action names, and every cell that quantifies over the product's ` +
        `absolute constraint needs it to be enumerable.`,
    );
  }
  return value as readonly string[];
}

/** D-240-05's wrapper. */
export async function boundAuditStoreError(): Promise<new (...args: never[]) => Error> {
  const mod = await loadObservability();
  const value = required(
    mod,
    "AuditStoreError",
    "D-240-05: `writeAudit` propagates a driver fault wrapped in `AuditStoreError`",
  );
  if (typeof value !== "function") {
    throw new Error(
      `${BARREL} exports \`AuditStoreError\` as ${describe_(value)}; D-240-05 publishes it as ` +
        `an error class, and \`instanceof\` is how every refusal cell here identifies it.`,
    );
  }
  return value as new (...args: never[]) => Error;
}

/**
 * `now()` as Postgres sees it, so a time assertion brackets the call with the SAME clock
 * the DEFAULT writes with.
 *
 * Bracketing with `Date.now()` instead would compare two clocks and turn any skew between
 * the test host and the database into a flaky red — and, worse, a skew in the other
 * direction would make the bracket admit an instant it should exclude.
 */
export async function dbNow(scratch: Scratch): Promise<Date> {
  const rows = await scratch.client.query<{ now: Date }>("select now() as now");
  return rows.rows[0].now;
}

/* ============================================================
   refusals, and how a message is checked

   **A whitelist asserted with a blacklist test IS a blacklist.**
   Where the contract publishes an admissible form — and §T240
   publishes exactly one, `listAudit`'s — the assertion is EXACT
   EQUALITY against it and nothing else. `includes` answers "do
   these characters appear"; the claim is "is this the published
   sentence", and the second is narrower.

   Where no form is published — `AuditStoreError`, which D-240-05
   added beyond the block — an exact pin is unavailable to a
   blind author, and inventing one reds every implementation that
   phrased it differently. So both sides are DERIVED instead of
   either being curated: the deny set is every word appearing in
   the driver error the wrapper carries on `cause`, and the allow
   set is the caller's own identifiers plus the module's own
   vocabulary. Nothing is hand-listed, so a seventh thing nobody
   enumerated is caught the moment the driver puts it in its own
   error.
   ============================================================ */

/** The rejection, or a throw saying the call resolved where a refusal was the criterion. */
export async function refusalFrom(promise: Promise<unknown>, criterion: string): Promise<Error> {
  let resolved: unknown;
  try {
    resolved = await promise;
  } catch (cause) {
    if (cause instanceof Error) return cause;
    throw new Error(
      `${criterion}: the call rejected with ${describe_(cause)}, which is not an Error. Every ` +
        `message and hygiene assertion below reads \`message\`, \`name\` and the enumerable ` +
        `own properties, and none of them exists on a thrown non-Error.`,
    );
  }
  throw new Error(
    `${criterion}: the call RESOLVED with ${describe_(resolved)} where a refusal was the ` +
      `criterion. A resolved call is the criterion failing, not a differently-worded refusal.`,
  );
}

/** Lower-cased words, splitting on everything that is not a word character or a dot. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_.@/-]+/)
    .filter((w) => w !== "");
}

/**
 * The statement and its bound parameters, as SHAPE rather than as vocabulary.
 *
 * D-13 forbids a rejection carrying the failed statement or its parameters, and that is a
 * structural claim: a `$1` placeholder, a `params:` dump, a DML keyword followed by a
 * quoted identifier. Checked separately from the word comparison below because it is the
 * half that stays correct when every identifier in the query is a name the module is
 * entitled to say — a wrapper echoing `insert into "audit" ("id", "actor_id", …)` uses
 * nothing but its own table's names, and a purely lexical check would wave it through.
 */
export function statementShape(message: string): string[] {
  const found: string[] = [];
  if (/\$\d/.test(message)) found.push("a bound-parameter placeholder ($n)");
  if (/\bparams\s*:/i.test(message)) found.push("a `params:` dump");
  if (/\b(insert|select|update|delete)\s+(into|from|set)\b/i.test(message)) {
    found.push("a DML statement");
  }
  if (/\bfailed query\b/i.test(message)) found.push("the driver's `Failed query` prefix");
  return found;
}

/** Identifier-shaped: snake_case, or a name the driver put in double quotes. */
function identifierTokens(causeMessage: string): Set<string> {
  const quoted = [...causeMessage.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
  const snake = words(causeMessage).filter((w) => w.includes("_"));
  return new Set([...quoted, ...snake]);
}

/**
 * Identifier-shaped words the driver error carries that the wrapper also says, minus every
 * name this module and its own table legitimately own.
 *
 * **Both sides derived, neither curated** — the standing rule's own prescription: the deny
 * set is the driver's own error, the allow set is "the caller's own identifiers plus every
 * table, index and column name `getTableConfig` reports for the task's tables". Word by
 * word rather than by substring, so `audit` and `audit_actor_id_fkey` are different tokens
 * and a correct implementation naming its own table does not go red for it.
 *
 * ── two narrowings, both made as ADVERSARY after this instrument reported a false leak ──
 *
 * **1. The stack is not part of the driver's words.** The first version derived the deny
 * set from `cause.message` AND `cause.stack`, and a stack is the runtime's record of MY OWN
 * files — so `lib/server/observability/store.ts` put `store` in the deny set and the
 * measured message `"writeAudit: the audit store failed."` was reported as leaking. The
 * module could not name itself. A stack is what `statementShape` and the path/frame
 * exclusions are for, and this is not the instrument for it.
 *
 * **2. Only identifier-shaped tokens.** The second version, message-only, flagged `failed`
 * — a word drizzle happens to use in its `Failed query` prefix and a word any wrapper
 * legitimately uses. A deny set containing ordinary English reds a correct module for
 * being written in English. The leak B-03 names is identifiers and values, not prose.
 *
 * **Neither narrowing weakens the criterion**, and the falsification cell in
 * `store-error.test.ts` is what shows it: a message repeating a constraint name still reds.
 */
export function leakedWords(
  message: string,
  cause: unknown,
  allowed: readonly string[],
): string[] {
  const causeMessage = cause instanceof Error ? cause.message : String(cause ?? "");
  const allow = new Set(allowed.flatMap((a) => words(a)));
  const said = new Set(words(message));
  return [...identifierTokens(causeMessage)]
    .filter((token) => !allow.has(token) && said.has(token))
    .sort();
}

/**
 * Every name `audit` owns, from drizzle's own table config rather than from a list here.
 *
 * A word the module is entitled to say about its own storage is not a leak, and deriving
 * the entitlement means a column added to `schema.ts` does not silently start reading as
 * one.
 */
export function auditOwnNames(): string[] {
  const config = getTableConfig(schema.audit);
  return [
    config.name,
    ...config.columns.map((c) => c.name),
    ...config.indexes.map((i) => i.config.name ?? ""),
  ].filter((n) => n !== "");
}

/**
 * Every enumerable own property of an error, at any depth reachable by enumeration — which
 * is exactly what `JSON.stringify` ships and therefore exactly what can reach a client.
 *
 * **What this CANNOT see, said here rather than discovered later**: a non-enumerable member.
 * `cause` set through `new Error(msg, { cause })` is non-enumerable by construction, and
 * D-240-05 requires it to stay that way — so a walk of enumerable properties is blind to it
 * BY DESIGN, and the cells that care about `cause` read it directly instead of through here.
 * A scanner that reported "no leak" over a sealed error would be reporting on the shape it
 * cannot read.
 */
export function enumerableShape(error: Error): { keys: string[]; json: string } {
  return { keys: Object.keys(error).sort(), json: JSON.stringify(error) };
}
