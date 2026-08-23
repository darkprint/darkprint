/* ============================================================
   T150 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this module is imported by the suites beside it.

   ── every load is a dynamic import, and the binding happens LAST ──
   This worktree was branched before `lib/server/counters/**` existed.
   A static top-level import of an absent module fails the whole file
   at collection, which reports one red where the protocol asks for
   one per acceptance criterion. So the barrel is loaded inside the
   cell that needs it — and, in every cell, *after* the premises are
   planted. An early bind reds correctly about its own subject while
   masking every fixture write below it, and a cell that never
   executed its planting is a cell that reds in 0ms where I/O was
   expected.

   ── what this file does NOT contain, and why the gaps are named ──
   Nothing here pins a rejection message, a rejection class, or a
   route. §T150's Published signatures block names three functions
   and one interface and stops: no error class, no message form, no
   path, no method, no status. Those were charged to the orchestrator
   before a cell was written (F3, F4, F5) and are open. A message
   literal invented here would be this suite writing contract and
   then measuring the implementer against it, which is the one thing
   a blind author must not do.

   The consequence is stated rather than left to be inferred: **the
   absence of a message pin and of route cells in this suite is not
   evidence that the refusal surface and the routes are correct.**
   They are untested, by the contract's silence rather than by
   choice.

   ── two names in one signature block, and only one of them is new ──
   `recordDownload` is ALREADY SHIPPED, at
   `lib/server/export/downloads.ts:40`, published from
   `@/lib/server/export`, called by `serveFile` and `serveCard`, and
   its own header says "fold into T150's counter service once it
   exists" (TODO(SEAM-19)). §T150 publishes the same name from
   `@/lib/server/counters`. This suite binds §T150's barrel, because
   that is what the block says; if the implementer re-exports T090's
   function the cells below still pass, and that is a state worth
   knowing rather than a state worth hiding. Charged as F1.
   ============================================================ */

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

import { schema } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const COUNTERS = "@/lib/server/counters";

/* ============================================================
   The barrel
   ============================================================ */

let counters: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole file, and every cell that awaits it gets its own copy of the same red rather than one
 * cell's failure cascading into an unhandled rejection in the next.
 *
 * The rejection handler is not decoration. The first `import()` of a barrel pays the whole
 * dependency graph's transform, and under load that has crossed `testTimeout` and reported as
 * "the barrel does not export X" against a barrel where X was present — a false charge against
 * the implementer. So the failure this throws says what it actually observed: the module did
 * not LOAD, which is a different claim from a member being missing.
 */
export function loadCounters(): Promise<Namespace> {
  counters ??= import("@/lib/server/counters").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${COUNTERS} does not load.\n` +
          `  backend.md §T150 owns \`lib/server/counters/**\` and publishes \`getSignals\`, ` +
          `\`toggleStar\` and \`recordDownload\` from the barrel \`@/lib/server/counters\`.\n` +
          `  This is the module failing to load, NOT a member being absent — the two produce ` +
          `different reds on purpose. Before reading it as a missing export, check whether the ` +
          `first import of this graph crossed testTimeout under load.\n` +
          `  Against an unmerged implementation this is the blind position and not a defect.`,
        { cause },
      );
    },
  );
  return counters;
}

/* ============================================================
   What the contract publishes

   Quoted from the Published signatures block so a red says where
   the name comes from and not merely that a test wanted it.
   ============================================================ */

export const PUBLISHED = {
  getSignals:
    'getSignals(db: Db, actor: Actor, target: { kind: "blueprint" | "card" | "term"; refId: string }): Promise<SignalState>',
  toggleStar:
    'toggleStar(db: Db, actor: Actor, target: { kind: "blueprint" | "card" | "term"; refId: string }): Promise<SignalState>',
  recordDownload:
    'recordDownload(db: Db, target: { kind: "blueprint" | "card" | "term"; refId: string }): Promise<void>   // NO Actor — AC6 is structural',
} as const;

export type PublishedName = keyof typeof PUBLISHED;
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * `interface SignalState { starCount: number; downloadCount: number; noteCount: number; starredByCaller: boolean }`
 *
 * Sorted, because these are compared as a SET against `Object.keys`. Four members is the whole
 * of the published shape: AC4 exists so a client never issues a second read, and a fifth member
 * is a second declaration of one shape by a route nobody ruled on.
 */
export const SIGNAL_STATE_KEYS = [
  "downloadCount",
  "noteCount",
  "starCount",
  "starredByCaller",
] as const;

export const COUNT_KEYS = ["downloadCount", "noteCount", "starCount"] as const;

/** The three the block names. Checked against the schema's own enum by a cell, not restated at it. */
export const PUBLISHED_KINDS = ["blueprint", "card", "term"] as const;
export type TargetKind = (typeof PUBLISHED_KINDS)[number];

export interface Target {
  kind: TargetKind;
  refId: string;
}

export interface SignalState {
  starCount: number;
  downloadCount: number;
  noteCount: number;
  starredByCaller: boolean;
}

/* --------------------- binding --------------------- */

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${COUNTERS} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. Do not add a synonym ` +
      `here; publish the name the contract states.`,
  );
}

export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadCounters();
  const value = requireFrom(mod, name, PUBLISHED[name]);
  if (typeof value !== "function") {
    throw new Error(
      `${COUNTERS} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${PUBLISHED[name]}`,
    );
  }
  return value as UnknownFn;
}

/* ============================================================
   `SignalState`, checked at RUNTIME

   The type pin lives in `surface.test.ts` and is a compile-time
   instrument; this is the runtime half, and the two see different
   things. A type pin is silently vacuous against an absent module
   and cannot observe a `numeric` column arriving as a string,
   because the declaration says `number` and the value never gets
   read.

   ── the string is the live hazard and it is why `typeof` is here ──
   `target.star_count`, `download_count` and `note_count` are
   `numeric(12,0)`. node-postgres has no default parser for
   `numeric`, so a column read straight through arrives as a STRING
   — and `expect(s.starCount).toBeGreaterThan(0)` is satisfied by
   `"1"`, as is `toBe(1)` under `==`-shaped matchers. `typeof ===
   "number"` is the only assertion that excludes the bad output the
   comment names.

   `starredByCaller` is checked `=== true` / `=== false` rather than
   for truthiness for the mirror-image reason: AC4 says it is
   `false` for an anonymous actor "rather than absent", and
   `undefined` is falsy. A truthiness check admits exactly the value
   the criterion forbids.
   ============================================================ */

export function assertSignalState(value: unknown, where: string): SignalState {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${where} returned ${describe_(value)}; the contract publishes Promise<SignalState>, i.e. ` +
        `{ starCount: number; downloadCount: number; noteCount: number; starredByCaller: boolean }.`,
    );
  }
  const keys = Object.keys(value as Namespace).sort();
  const expected = [...SIGNAL_STATE_KEYS];
  const missing = expected.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !expected.includes(k as (typeof SIGNAL_STATE_KEYS)[number]));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${where} returned a SignalState with the wrong key set.\n` +
        `  missing: ${missing.join(", ") || "(none)"}\n` +
        `  extra:   ${extra.join(", ") || "(none)"}\n` +
        `  the contract publishes: ${SIGNAL_STATE_KEYS.join(", ")}\n` +
        `  A missing \`starredByCaller\` is AC4 failing: the block says it is \`false\` for an ` +
        `anonymous actor rather than absent, because an optional field invites a client to ` +
        `treat missing as unknown and re-fetch. An extra member is a second declaration of one ` +
        `shape.`,
    );
  }
  const s = value as Record<string, unknown>;
  for (const key of COUNT_KEYS) {
    const n = s[key];
    if (typeof n !== "number") {
      throw new Error(
        `${where} returned \`${key}\` = ${JSON.stringify(n)} (${describe_(n)}); SignalState ` +
          `declares it \`number\`.\n` +
          `  \`target.${key === "starCount" ? "star_count" : key === "downloadCount" ? "download_count" : "note_count"}\` ` +
          `is \`numeric(12,0)\` and node-postgres has no default parser for \`numeric\`, so a ` +
          `column read straight through arrives as a string. A string satisfies every ordering ` +
          `matcher a reviewer would reach for and fails the published type.`,
      );
    }
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(
        `${where} returned \`${key}\` = ${n}; a count of things that happened is a non-negative ` +
          `integer, and the column is \`numeric(12,0)\` — scale zero.`,
      );
    }
  }
  const starred = s.starredByCaller;
  if (starred !== true && starred !== false) {
    throw new Error(
      `${where} returned \`starredByCaller\` = ${JSON.stringify(starred)} (${describe_(starred)}); ` +
        `SignalState declares it \`boolean\`. AC4: it is \`false\` for an anonymous actor rather ` +
        `than absent — an optional field invites a client to treat missing as unknown and re-fetch.`,
    );
  }
  return value as unknown as SignalState;
}

/** The three counts alone, for a comparison that is deliberately blind to `starredByCaller`. */
export function countsOf(state: SignalState): Record<string, number> {
  return {
    starCount: state.starCount,
    downloadCount: state.downloadCount,
    noteCount: state.noteCount,
  };
}

/* ============================================================
   Outcomes

   A call's result reduced to one comparable string, resolution and
   rejection alike. Two cells need this and they need it for
   opposite reasons: F2 is open, so whether `recordDownload` rejects
   on a store fault is not a thing this suite may assert — but what
   it LEFT BEHIND is assertable under either ruling, and an
   `Outcome` lets a cell record the answer without asserting it.
   ============================================================ */

export interface Outcome {
  settled: "value" | "rejected";
  digest: string;
  value?: unknown;
  error?: unknown;
}

export async function outcomeOf(call: () => unknown): Promise<Outcome> {
  try {
    const value = await call();
    return { settled: "value", digest: `value ${JSON.stringify(value) ?? "undefined"}`, value };
  } catch (err) {
    const e = err as Error;
    const name = e instanceof Error ? (e.constructor?.name ?? e.name ?? "Error") : describe_(err);
    const message = typeof e?.message === "string" ? e.message : String(err);
    return { settled: "rejected", digest: `rejected ${name} ${JSON.stringify(message)}`, error: err };
  }
}

/**
 * Start every call, THEN wait. `.map` issues all N synchronously and `Promise.allSettled` waits
 * afterwards, so N callers are N genuine sessions on the pool rather than N turns on one.
 *
 * The `try` is not defensive padding. A published function that throws SYNCHRONOUSLY would abort
 * the loop half way and leave the remaining callers unstarted, which turns a race into a short
 * sequence and reports a green concurrency criterion for an implementation nobody raced.
 */
export function fireAll(
  n: number,
  start: (i: number) => unknown,
): Promise<PromiseSettledResult<unknown>[]> {
  const inflight: Promise<unknown>[] = [];
  for (let i = 0; i < n; i += 1) {
    try {
      inflight.push(Promise.resolve(start(i)));
    } catch (err) {
      inflight.push(Promise.reject(err));
    }
  }
  return Promise.allSettled(inflight);
}

/* ============================================================
   Actors — plain data, exactly as T060 publishes it
   ============================================================ */

export const ANONYMOUS: Actor = { kind: "anonymous" };

export function accountActor(accountId: string, handle: string | null = null): Actor {
  return { kind: "account", accountId, handle };
}

/**
 * B-13's break-glass subject. Whether an operator may star is NOT ruled (charged as F10), so
 * nothing in this suite asserts on one — the constructor is here because the `Actor` union has
 * three members and a suite that silently drives two is a suite that has decided.
 */
export function operatorActor(accountId: string): Actor {
  return { kind: "operator", accountId };
}

/* ============================================================
   The database each suite owns
   ============================================================ */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the first parameter of all three T150 functions. */
  db: unknown;
  /** This scratch database's connection string. */
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
      `\`select current_database()\` answered ${describe_(database)}, so this scratch database ` +
        `cannot be named.`,
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

/* ============================================================
   D-WAVE-01's boundary, as a derived instrument

   The ruling names what T150 may write — `target.star_count`,
   `target.download_count`, and `target_actor` rows with
   `kind = "star"` — and says "Nothing else." A cell asserting that
   by listing the two tables would be checking the sentence against
   itself. So the domain is DERIVED: every table `lib/db/schema.ts`
   declares, read through drizzle rather than restated, and the
   assertion is over the tables that MOVED.

   That is what makes the instrument survive the next table. The
   hand-written list is the thing that stops being edited, and
   `tests/support/db.ts` records this repository already paying for
   one: six tables arrived and the list named ten.

   Rows are compared as sorted JSON rather than by count, because 14
   before and 14 after with different contents has passed a check in
   this repository before.
   ============================================================ */

function allTables(): PgTable[] {
  const exported: unknown[] = Object.values(schema);
  const tables = exported.filter((value): value is PgTable => is(value, PgTable));
  /* Fails CLOSED. A derivation that finds nothing would make every "moves nothing" cell below
     pass by comparing two empty maps, which is the silent shape this whole instrument exists to
     avoid. */
  if (tables.length === 0) {
    throw new Error(
      "The table derivation over `@/lib/db`'s schema export found nothing. Every D-WAVE-01 " +
        "boundary cell in this suite compares snapshots built from it, so an empty domain makes " +
        "them all vacuously green.",
    );
  }
  return tables;
}

export function schemaTableNames(): readonly string[] {
  return allTables()
    .map((t) => getTableConfig(t).name)
    .sort();
}

/** The `target_kind` enum as the schema declares it, for the cell that checks the block against it. */
export function schemaTargetKinds(): readonly string[] {
  return [...schema.targetKind.enumValues];
}

/** The `target_actor_kind` enum as the schema declares it. */
export function schemaTargetActorKinds(): readonly string[] {
  return [...schema.targetActorKind.enumValues];
}

export type Snapshot = Map<string, string[]>;

/** Every row of every declared table, canonicalised so two snapshots compare element-wise. */
export async function snapshotAll(s: Scratch): Promise<Snapshot> {
  const snapshot: Snapshot = new Map();
  for (const name of schemaTableNames()) {
    const rows = await s.query(`select * from "${name}"`);
    snapshot.set(
      name,
      rows
        .map((row) =>
          JSON.stringify(
            Object.fromEntries(
              Object.entries(row)
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
            ),
          ),
        )
        .sort(),
    );
  }
  return snapshot;
}

export interface TableDelta {
  table: string;
  added: string[];
  removed: string[];
}

/** Which tables moved, and how. A table with an equal row SET is absent from the result. */
export function movedTables(before: Snapshot, after: Snapshot): TableDelta[] {
  const deltas: TableDelta[] = [];
  for (const [table, afterRows] of after) {
    const beforeRows = before.get(table) ?? [];
    const beforeCounts = new Map<string, number>();
    for (const row of beforeRows) beforeCounts.set(row, (beforeCounts.get(row) ?? 0) + 1);
    const added: string[] = [];
    for (const row of afterRows) {
      const n = beforeCounts.get(row) ?? 0;
      if (n > 0) beforeCounts.set(row, n - 1);
      else added.push(row);
    }
    const removed: string[] = [];
    for (const [row, n] of beforeCounts) for (let i = 0; i < n; i += 1) removed.push(row);
    if (added.length > 0 || removed.length > 0) deltas.push({ table, added, removed });
  }
  return deltas;
}

/** Table names only, for the common case where a cell asserts on the SET of tables touched. */
export function movedTableNames(before: Snapshot, after: Snapshot): string[] {
  return movedTables(before, after)
    .map((d) => d.table)
    .sort();
}

export function renderDeltas(deltas: readonly TableDelta[]): string {
  if (deltas.length === 0) return "(nothing moved)";
  return deltas
    .map(
      (d) =>
        `  ${d.table}: +${d.added.length} -${d.removed.length}\n` +
        d.added.map((r) => `    + ${r.slice(0, 240)}`).join("\n") +
        (d.added.length > 0 && d.removed.length > 0 ? "\n" : "") +
        d.removed.map((r) => `    - ${r.slice(0, 240)}`).join("\n"),
    )
    .join("\n");
}

/* ============================================================
   D-WAVE-07's two classes, and D-13 over what they carry

   Landed at `99a1e8d` after they reached this session only in a
   message. Both are quoted from the ruling rather than restated, so
   a red says where the name comes from:

     `CounterStoreError` — D-13's sealed store fault, form
     `<operation>: the counter store failed.`

     `NotSignedInError`, and AC3 THROWS. `toggleStar` returns
     `Promise<SignalState>`, so unlike T140's `Promise<void>` the
     silent-resolve reading is REPRESENTABLE — an implementer
     reading the block alone can honestly build a resolve with the
     unchanged state. A writer that answers a value for a denial
     tells its caller the write succeeded (D-140-02), so it throws.
     `NotAccountOwnerError` is refused as a synonym: `toggleStar`
     takes no `accountId` to compare against, so *not this account's
     owner* is the wrong sentence.

   ── the message forms are asymmetric and that is the contract's ──
   `CounterStoreError`'s form is published, so it is pinned by EXACT
   MATCH against a literal built here — never imported from the
   module, because an expectation built from the module under test
   asserts only that the module agrees with itself and survives the
   day the template starts interpolating a driver value.

   `NotSignedInError`'s form is NOT published. So nothing here pins
   its text, and that is a stated gap rather than an oversight: a
   literal invented in this file would become a contract the
   implementer never saw, which is the defect D-WAVE-07 exists
   about. What IS asserted about it is the class identity and D-13's
   own clause, which is ruled repository-wide and needs no per-task
   form.

   ── an exact pin does not retire the scans ──
   Equality on `message` says nothing about `String(err)`, about
   `JSON.stringify(err)`, or about a rejection that is not a
   `CounterStoreError` at all. A message equal to a fixed string is
   only pinned for the paths that produce that string.
   ============================================================ */

export const COUNTER_STORE_ERROR = "CounterStoreError";
export const NOT_SIGNED_IN_ERROR = "NotSignedInError";

export const MESSAGE_FORMS = {
  counterStoreFailed: "`<operation>: the counter store failed.` (D-WAVE-07)",
  notSignedIn: "(D-WAVE-07 publishes the CLASS and no form; nothing here pins its text)",
} as const;

/** `"toggleStar: the counter store failed."` — built here, never imported from the module. */
export function counterStoreFailedMessage(operation: string): string {
  return `${operation}: the counter store failed.`;
}

async function bindErrorClass(name: string, clause: string): Promise<new (...args: never[]) => Error> {
  const mod = await loadCounters();
  const value = mod[name];
  if (value === undefined) {
    const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
    throw new Error(
      `${COUNTERS} exports no \`${name}\`.\n` +
        `  D-WAVE-07 publishes it: ${clause}\n` +
        `  found: ${exported}\n` +
        `  \`tests/store-modules-seal-their-faults.test.ts\` builds its domain from any ` +
        `\`lib/server/<name>/\` importing \`@/lib/db\`, so this module is in that domain and ` +
        `AN ABSENT CLASS LEAKS BY NOT EXISTING.`,
    );
  }
  if (typeof value !== "function" || !(value.prototype instanceof Error)) {
    throw new Error(
      `${COUNTERS} exports \`${name}\` as ${describe_(value)}; D-WAVE-07 publishes it as an ` +
        `Error subclass. ${clause}`,
    );
  }
  return value as new (...args: never[]) => Error;
}

export function bindCounterStoreError(): Promise<new (...args: never[]) => Error> {
  return bindErrorClass(COUNTER_STORE_ERROR, MESSAGE_FORMS.counterStoreFailed);
}

export function bindNotSignedInError(): Promise<new (...args: never[]) => Error> {
  return bindErrorClass(NOT_SIGNED_IN_ERROR, MESSAGE_FORMS.notSignedIn);
}

export interface Renderings {
  message: string;
  string: string;
  json: string;
  keys: string;
  /** Every own property VALUE, enumerable or not, and every `cause` beneath them. */
  own: string;
}

/**
 * Every way an error reaches a log or a response body, collected in one place.
 *
 * ── the `own` channel exists because the first version of this function was BLIND ──
 * It carried `message`, `String(err)`, `JSON.stringify(err)` and a `keys` channel holding own
 * property NAMES. Falsified against nine hand-built errors, it discriminated on eight and
 * passed the ninth: a driver string on a **non-enumerable** own property.
 *
 * That shape defeats all four. `message` does not see it. `String(err)` is `name: message`.
 * `JSON.stringify` walks enumerable properties only, so it renders `{}`. And `keys` held the
 * name `query` while the leak was in its VALUE — the instrument looked in the right place and
 * compared the wrong half.
 *
 * It is not hypothetical, and it is not even unlikely: hiding a driver payload on a
 * non-enumerable property is what a module does when it is trying to satisfy D-13's hygiene
 * clause, because that is precisely the shape that renders as `{}` in a structured log. The
 * clause and the scan are in tension, and an enumerable-only scan rewards the shape it cannot
 * read. Found by falsifying this function rather than by reading it.
 *
 * ── and `cause` is EXCLUDED, which is the opposite correction and was measured too ──
 * The first fix followed `cause` to depth 4. Against the real module that reds, and the red is
 * a FALSE CHARGE: `err.cause.message` and `err.cause.query` carry the statement and the bound
 * `refId`, and **that is the tree's ratified convention rather than a leak.**
 * `lib/server/registry/errors.ts:12-15` states the clause as five merged modules apply it —
 * *"`Object.keys(err)` is empty and `JSON.stringify(err)` is exactly `"{}"`; **`cause` is
 * present but non-enumerable** (the ES2022 Error-cause option makes it so by spec); `stack` is
 * retained. Whitelist, not blacklist — the only thing any rendering carries is the operation."*
 * `tests/error-hygiene.test.ts` constructs every class at both arities and passes them.
 *
 * So D-13's clause is about what a RENDERING carries, and `cause` is the one sanctioned
 * carrier. Descending into it charges a module for following a convention a merged guard
 * already weighed — which is the decision that had already read the artefact.
 *
 * The morning's finding survives the correction intact, and the two are not the same hazard: a
 * driver payload stashed on the ERROR ITSELF (`err.query`, enumerable or not) is unsanctioned
 * and still reds. Only the `cause` chain is exempt, and only because something else ruled it.
 */
export function renderingsOf(err: unknown): Renderings {
  const e = err as { message?: unknown };
  return {
    message: typeof e?.message === "string" ? e.message : String(err),
    string: String(err),
    json: JSON.stringify(err) ?? "undefined",
    keys:
      typeof err === "object" && err !== null
        ? Object.getOwnPropertyNames(err).sort().join(",")
        : "",
    own: ownValues(err, 4).join(" | "),
  };
}

/**
 * Every own property value reachable from `value`, to `depth` levels.
 *
 * `getOwnPropertyNames` rather than `Object.keys`, and the VALUES rather than the names — that
 * pair is the whole point. A getter is read inside a `try`: a property that throws when read is
 * not a leak this suite can measure, and letting it escape would turn a hygiene check into a
 * red about the fixture.
 */
function ownValues(
  value: unknown,
  depth: number,
  path = "err",
  seen = new Set<unknown>(),
): string[] {
  if (depth <= 0 || value === null || value === undefined) return [];
  if (typeof value !== "object") return [`${path}=${String(value)}`];
  if (seen.has(value)) return [];
  seen.add(value);
  const out: string[] = [];
  for (const name of Object.getOwnPropertyNames(value)) {
    /* The one sanctioned carrier. See the header: five merged modules put the driver error
       here deliberately and `tests/error-hygiene.test.ts` passes them, so descending would
       charge a module for a convention that is already ruled. */
    if (name === "cause") continue;
    let held: unknown;
    try {
      held = (value as Record<string, unknown>)[name];
    } catch {
      continue;
    }
    if (typeof held === "function") continue;
    if (held !== null && typeof held === "object") {
      out.push(...ownValues(held, depth - 1, `${path}.${name}`, seen));
    } else if (held !== undefined) out.push(`${path}.${name}=${String(held)}`);
  }
  return out;
}

/**
 * D-13: "no rejection may carry the failed statement or its bound parameters."
 *
 * A deny list of the driver's own prose rather than a whitelist, because the whitelist form is
 * only as good as the channel it covers — T081's key-set whitelist was over the BODY, so a
 * driver code on a response header reddened nothing.
 *
 * `getOwnPropertyNames` rather than `Object.keys`: a non-enumerable property is invisible to an
 * enumerable-only walk, and the shape D-13's hygiene clause rewards is exactly the shape such a
 * walk cannot see.
 */
const DRIVER_PROSE = [
  "select ",
  "insert into",
  "update ",
  "delete from",
  "on conflict",
  "duplicate key value",
  "violates unique constraint",
  "drizzlequeryerror",
  "failed query",
  "sqlstate",
  "econnrefused",
  'target_actor"',
  'target"',
] as const;

export function assertSealed(err: unknown, where: string): void {
  const r = renderingsOf(err);
  for (const [channel, text] of Object.entries(r) as [keyof Renderings, string][]) {
    const lowered = text.toLowerCase();
    const hit = DRIVER_PROSE.find((needle) => lowered.includes(needle));
    if (hit !== undefined) {
      /* The carrier's PATH, not just the channel name. The first version of this message
         printed the channel and the first 400 characters of it, and against a real error that
         named `stack` while the match was 900 characters further along — a red reporting a
         plausible wrong cause, which is the thing that makes a reader go and check the wrong
         file. `own` is path-tagged for this. */
      const carrier =
        channel === "own"
          ? (text.split(" | ").find((part) => part.toLowerCase().includes(hit)) ?? channel)
          : channel;
      throw new Error(
        `${where} leaks the driver through \`${channel}\`: it carries ${JSON.stringify(hit)}.\n` +
          `  carrier: ${carrier.slice(0, 300)}\n` +
          `  ${channel}: ${text.slice(0, 400)}\n` +
          `  D-13: no rejection may carry the failed statement or its bound parameters. ` +
          `\`tests/store-modules-seal-their-faults.test.ts\` exists because an absent class ` +
          `leaks by not existing, and a present class that wraps nothing leaks the same way.`,
      );
    }
  }
}

/** Any value the caller minted, checked for having travelled into a rendering it should not. */
export function assertNoValue(err: unknown, values: readonly string[], where: string): void {
  const r = renderingsOf(err);
  for (const [channel, text] of Object.entries(r) as [keyof Renderings, string][]) {
    for (const value of values) {
      if (value.length >= 8 && text.includes(value)) {
        throw new Error(
          `${where} carries a value this test minted, through \`${channel}\`: ` +
            `${JSON.stringify(value)}.\n  ${channel}: ${text.slice(0, 400)}\n` +
            `  Minted here and handed to the module, so the only route it has into a rendering ` +
            `is the module putting it there — which is what makes this a provenance check and ` +
            `not a coincidence.`,
        );
      }
    }
  }
}

/** Captures a rejection. Fails loudly if the call RESOLVED — an absent refusal is the defect. */
export async function rejection(call: unknown, where: string): Promise<unknown> {
  let resolved: unknown;
  try {
    resolved = await call;
  } catch (err) {
    return err;
  }
  throw new Error(
    `${where} RESOLVED with ${describe_(resolved)}.\n` +
      `  D-WAVE-07: \`toggleStar\` returns \`Promise<SignalState>\`, so unlike T140's ` +
      `\`Promise<void>\` the silent-resolve reading is REPRESENTABLE — and it is ruled out. ` +
      `"A writer that answers a value for a denial tells its caller the write succeeded" ` +
      `(D-140-02), so it throws.`,
  );
}
