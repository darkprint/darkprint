/* ============================================================
   T240 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   Written in a worktree branched from `backend` at `fe143a7`,
   before `lib/server/observability` exists — measured, not
   assumed: `ls lib/server` at that sha lists sixteen directories
   and `observability` is not among them, and a grep for
   `writeAudit|listAudit|observability` over `lib app tests
   components scripts` returns exactly one hit, a comment in
   `tests/server/t060/operator.test.ts:53`. Every load of the
   module under test is therefore a dynamic import, for T000's
   recorded reason: a static top-level import of a file that is
   not on disk fails the whole suite at collection and hides
   every criterion behind one red.

   ── this suite does not read the implementation, and that
      changed one instrument ──
   The dispatch narrows `wave-blind.md`: the partition is
   `tests/server/t240/**` and `lib/server/observability/**` is
   neither read nor written. `wave-blind.md` asks a type pin to
   be accompanied by "a source cell that reads the barrel from
   disk — the only thing that distinguishes *a member is absent*
   from *an assertion failed*". A brief may narrow a standing
   rule and never widen it, so the narrower one holds and the
   disk read does not happen.

   `barrelExports()` below is the substitute, and it separates
   the same three states through the public interface instead of
   through the filesystem:

     • the import REJECTS            → the module is absent
     • it resolves and a key is
       missing from `Object.keys`    → the member is absent
     • the key is there              → an assertion failed

   Ratified by the orchestrator as preferable to the disk read.
   It is strictly better in one way the disk read is not: it
   observes the barrel as a *caller* sees it, so a member
   declared in a file but never re-exported reads as absent,
   which is what it is.

   ── the domain is DERIVED from backend.md, with a floor ──
   `A construction over an author's transcription of a spec is a
   list one level up`, so the published block is parsed out of
   the contract document rather than retyped here. The
   transcribed constants that remain exist only as a FLOOR that
   reds the day the parse and the contract disagree
   (`surface.test.ts`).

   ── why the freeze pin is over the PARSED BLOCK and not over
      backend.md's blob sha ──
   The blob sha was the first instrument I reached for and it is
   the wrong granularity. `backend.md` is the orchestrator's
   file and is edited continuously — twice within the hour this
   suite was written, and the observed blob went
   `4729ff1dbbcb537273a1a84f3c2689f919b70757` →
   `859f466973567862d0ac18dddd4b39401d7529fb` between one
   message and the next. A pin that reds on every prose edit is
   a pin people learn to ignore, and an ignored red is worse
   than no red because it also conceals the ones that matter.

   What this suite's domain actually is: the signature lines,
   the interface's field list and the acceptance criteria. So
   the pin is a digest over exactly that, normalised — prose
   moves freely underneath it and a signature cannot.
   ============================================================ */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
   the published surface, DERIVED from backend.md
   ============================================================ */

const BACKEND_MD = fileURLToPath(new URL("../../../backend.md", import.meta.url));

export interface PublishedSignature {
  name: string;
  /** Top-level parameters, split at depth zero so an inline object type stays one. */
  params: readonly string[];
  returns: string;
  text: string;
}

export interface PublishedInterface {
  name: string;
  /** `field: type` in the order the block writes them, semicolons collapsed. */
  fields: readonly string[];
}

export interface PublishedBlock {
  signatures: readonly PublishedSignature[];
  interfaces: readonly PublishedInterface[];
  /** The numbered acceptance criteria, `(n) text` split apart. */
  criteria: readonly string[];
  /** Every `D-240-nn` the section rules, in document order. */
  rulings: readonly string[];
  /** The quoted admissible message forms, as the block writes them. */
  admissible: readonly string[];
  /**
   * A digest over EXACTLY the four fields above and nothing else. Prose moves freely
   * underneath it; a signature, a field, a criterion or a ruling cannot.
   */
  pin: string;
}

function sectionOf(document: string, heading: string): string {
  const start = document.indexOf(`\n### ${heading}`);
  if (start === -1) {
    throw new Error(
      `backend.md carries no \`### ${heading}\` section.\n` +
        `  This suite derives its whole domain from that section rather than from a list ` +
        `typed here, so a missing heading is a BROKEN TEST and not a failed criterion. ` +
        `Report it; do not retype the block.`,
    );
  }
  const rest = document.slice(start + 1);
  const end = rest.indexOf("\n### ");
  return end === -1 ? rest : rest.slice(0, end);
}

/** Split at brace/paren/angle depth zero, so `filter: { a?: X; b?: Y }` survives as one. */
function splitTopLevel(text: string, separator: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "{" || ch === "(" || ch === "<" || ch === "[") depth += 1;
    else if (ch === "}" || ch === ")" || ch === ">" || ch === "]") depth -= 1;
    if (ch === separator && depth === 0) {
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

let cached: PublishedBlock | undefined;

/**
 * The `- **Published signatures**` block and the acceptance criteria of `### T240,`, parsed.
 *
 * Everything indented at least eight spaces inside the section and above `- **Goal:**` is
 * the signatures block; the section's prose is never indented that way. The interface is
 * reassembled across its lines because the block wraps it, and its fields are split on `;`
 * at depth zero rather than on line breaks, which is what the block's own wrapping requires.
 */
export function publishedBlock(): PublishedBlock {
  if (cached !== undefined) return cached;

  const section = sectionOf(readFileSync(BACKEND_MD, "utf8"), "T240,");

  const goal = section.indexOf("\n- **Goal:**");
  const blockText = goal === -1 ? section : section.slice(0, goal);
  const indented = blockText
    .split("\n")
    .filter((line) => /^ {8,}\S/.test(line))
    .map((line) => line.trim());

  const signatures: PublishedSignature[] = [];
  const interfaces: PublishedInterface[] = [];

  let open: { name: string; body: string } | undefined;
  for (const line of indented) {
    if (open !== undefined) {
      if (line.startsWith("}")) {
        interfaces.push({
          name: open.name,
          fields: splitTopLevel(open.body, ";").filter((f) => f !== ""),
        });
        open = undefined;
        continue;
      }
      open.body += ` ${line}`;
      continue;
    }
    const opening = /^interface\s+(\w+)\s*\{(.*)$/.exec(line);
    if (opening !== null) {
      open = { name: opening[1], body: opening[2] };
      continue;
    }
    const signature = SIGNATURE.exec(line);
    if (signature !== null) {
      signatures.push({
        name: signature[1],
        params: splitTopLevel(signature[2], ","),
        returns: signature[3].trim(),
        text: line,
      });
    }
  }
  if (open !== undefined) {
    throw new Error(
      `backend.md §T240's \`interface ${open.name}\` is unterminated in the published block. ` +
        `The parse is the domain of every shape cell, so this is a broken test.`,
    );
  }

  const criteriaLine = /^- \*\*Acceptance criteria:\*\*\s*(.+)$/m.exec(section);
  if (criteriaLine === null) {
    throw new Error(
      "backend.md §T240 carries no `- **Acceptance criteria:**` line. This suite quantifies " +
        "over the criteria rather than over a list typed here, so this is a broken test.",
    );
  }
  const criteria = criteriaLine[1]
    .split(/\(\d+\)\s*/)
    .map((part) => part.replace(/;\s*$/, "").replace(/\.\s*$/, "").trim())
    .filter((part) => part !== "");

  const rulings = [...new Set(section.match(/D-240-\d\d/g) ?? [])];

  const admissibleLine = /\*\*Admissible message forms:\*\*(.*)$/m.exec(section);
  const admissible = admissibleLine === null ? [] : [...admissibleLine[1].matchAll(/`"([^"]*)"`/g)].map((m) => m[1]);

  const pin = createHash("sha256")
    .update(
      JSON.stringify({
        signatures: signatures.map((s) => s.text),
        interfaces: interfaces.map((i) => [i.name, [...i.fields]]),
        criteria,
        rulings,
        admissible,
      }),
    )
    .digest("hex");

  cached = { signatures, interfaces, criteria, rulings, admissible, pin };
  return cached;
}

/** The one signature by name, or a broken-test throw naming what the block does carry. */
export function signature(name: string): PublishedSignature {
  const found = publishedBlock().signatures.find((s) => s.name === name);
  if (found === undefined) {
    throw new Error(
      `backend.md §T240's published block declares no \`${name}(...)\`. It declares: ` +
        `${publishedBlock().signatures.map((s) => s.name).join(", ") || "(nothing)"}.`,
    );
  }
  return found;
}

/* ============================================================
   the admissible message form

   backend.md §T240: the whitelist applies to `listAudit`'s
   refusal only. Asserted by EXACT MATCH and never by scanning
   for forbidden substrings — `A whitelist asserted with a
   blacklist test IS a blacklist`, and an `includes` answers
   "do these characters appear" where the claim is "does this
   leak". Parsed out of the block rather than retyped, with the
   transcription below kept only as the floor.
   ============================================================ */

export const REFUSAL_FORM_FLOOR = "listAudit: not permitted.";

export function refusalForm(): string {
  const forms = publishedBlock().admissible;
  if (forms.length !== 1) {
    throw new Error(
      `backend.md §T240 publishes ${forms.length} admissible message forms; this suite is ` +
        `written against exactly one (\`${REFUSAL_FORM_FLOOR}\`). Parsed: ` +
        `${JSON.stringify(forms)}. A second form is a contract change and a broken test here.`,
    );
  }
  return forms[0];
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

/** `writeAudit(db, entry): Promise<void>` — backend.md §T240's published block. */
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
    .split(/[^a-z0-9_.]+/)
    .filter((w) => w !== "");
}

/**
 * Words the driver error put in `cause` that also appear in the wrapper's own message, minus
 * the ones the caller supplied and the module's own vocabulary.
 *
 * Word by word rather than by substring, deliberately: `audit` and `audit_actor_id_fkey` are
 * simply different tokens, so the over-match a substring scan produces is gone structurally
 * rather than by curation — and a correct implementation naming its own table does not go
 * red for it.
 */
export function leakedWords(message: string, cause: unknown, allowed: readonly string[]): string[] {
  const causeText = cause instanceof Error ? `${cause.message} ${String(cause.stack ?? "")}` : String(cause ?? "");
  const allow = new Set(allowed.flatMap((a) => words(a)));
  const deny = new Set(words(causeText).filter((w) => !allow.has(w)));
  return [...new Set(words(message).filter((w) => deny.has(w)))].sort();
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
