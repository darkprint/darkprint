/* ============================================================
   T210 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under `tests`
   and nothing else, so this module is imported by the suites beside
   it and is never collected as one itself.

   ── what this suite may and may not read ──
   §T210's `Owns` is `lib/server/terms/**` and
   `app/api/ontology-usage/**`. Nothing in `tests/server/t210/**`
   opens either: they are the implementer's, and this suite is
   written blind against the document. Everything merged is fair
   game, and the two things this file leans on hardest are merged:
   T080's `lib/server/registry` (the reader the index must agree
   with about what is visible) and the writer chain T100/T250 go
   through.

   ── why `components/ontology/TermTable.tsx` is only HALF an axis ──
   `termUsageIndex(registry)` answers the same question over the
   same corpus and was written by neither half of this task, which
   is what an independent instrument means. But D-210-07 records
   two conversions between it and the published surface, and a
   conversion written HERE is written by the author of the
   assertions:

     * its `TermUsage` is three LISTS where the server's three
       fields of the same names are NUMBERS — a name collision
       across layers, so a reader importing the wrong one gets a
       silently different shape;
     * its blueprint identity is a SLUG where B-09 and D-210-08
       make the server's a two-part `ownerHandle/slug` key.

   So `oracle.test.ts` offers it as ONE instrument from two
   vantages with the conversions stated, never as two instruments.
   The cell that actually discriminates the two readings is the
   two-account one in `ac1-counts.test.ts`, where `alice/foo` and
   `bob/foo` both exist and the component's reading is provably
   wrong.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const TERMS = "@/lib/server/terms";

/** The repository root, derived from this file rather than from `process.cwd()`. */
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/* ============================================================
   The constants the rulings publish

   Literals here rather than imports from the module under test: a
   bound imported from the thing it bounds moves with it and
   asserts nothing. `DARKPRINT_CONFIG` is `lib/core`'s and is NOT
   the module under test, so the thresholds are read from it — the
   contract says "consumed not restated" and a suite that retypes
   `3` and `5` is a second place they have to be changed.
   ============================================================ */

/**
 * `lib/core/config.ts:165-168`, consumed rather than restated.
 *
 * Imported at USE rather than at module scope: a throw here would land in whichever hook
 * touched this file first and produce SKIPS instead of reds. `promotionThresholds()` is a
 * function for that reason and for no other.
 */
export async function promotionThresholds(): Promise<{
  distinctAuthors: number;
  distinctBlueprints: number;
}> {
  const core = (await import("@/lib/core")) as unknown as Namespace;
  const config = core.DARKPRINT_CONFIG as { promotion?: unknown } | undefined;
  const promotion = config?.promotion as
    | { distinctAuthors?: unknown; distinctBlueprints?: unknown }
    | undefined;
  const authors = promotion?.distinctAuthors;
  const blueprints = promotion?.distinctBlueprints;
  if (typeof authors !== "number" || typeof blueprints !== "number") {
    throw new Error(
      "`DARKPRINT_CONFIG.promotion` does not carry two numbers. The T210 contract consumes " +
        "`lib/core/config.ts:165-168` rather than restating it, so a suite that cannot read " +
        "them has no thresholds to test against — this is a broken test, not a failed " +
        `criterion. Got: ${JSON.stringify(promotion)}`,
    );
  }
  return { distinctAuthors: authors, distinctBlueprints: blueprints };
}

/** The ontology version every fixture publishes under; the one the seeded archive names. */
export const ONTOLOGY_VERSION = "0.1.0";

/* ============================================================
   The barrel
   ============================================================ */

let terms: Promise<Namespace> | undefined;

/**
 * Memoised as the PROMISE, rejection included, so a module that is absent stays absent for
 * the whole file and every cell gets its own copy of the same red rather than one cell's
 * failure cascading into an unhandled rejection in the next.
 *
 * The rejection handler is not decoration. The first `import()` of a barrel pays the whole
 * dependency graph's transform, and under load that has crossed `testTimeout` in this
 * repository and reported as "the barrel does not export X" against a barrel where X was
 * present — a false charge against the implementer. So this red says what it observed: the
 * module did not LOAD, which is a different claim from a member being absent.
 */
export function loadTerms(): Promise<Namespace> {
  terms ??= import("@/lib/server/terms").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${TERMS} does not load.\n` +
          "  backend.md §T210 owns `lib/server/terms/**` and publishes `usageOf` and " +
          "`candidates` from the barrel `@/lib/server/terms`.\n" +
          "  This is the MODULE failing to load, NOT a member being absent: the two produce " +
          "different reds on purpose. Before reading it as a missing export, check whether " +
          "the first import of this graph crossed testTimeout under load.\n" +
          "  Against an unmerged implementation this is the blind position and not a defect.",
        { cause },
      );
    },
  );
  return terms;
}

/* ============================================================
   What the contract publishes

   Quoted from §T210's Published signatures block AS AMENDED by
   D-210-01 (`refreshUsage` withdrawn) and D-210-02, so a red says
   where the name comes from and which ruling put it there.
   ============================================================ */

export const PUBLISHED = {
  usageOf:
    "usageOf(db: Db, actor: Actor, termId: string): Promise<TermUsage> — never `undefined` " +
    "(AC4: a term nothing names returns zero, not 404)",
  usage:
    "usage(db: Db, actor: Actor): Promise<readonly TermUsage[]> — every counted term, " +
    "`termId` ascending by code unit, empty list a real answer (D-210-10)",
  candidates:
    "candidates(db: Db, actor: Actor): Promise<readonly PromotionCandidate[]> — every " +
    "counted LOCAL term with its counts and both booleans (D-210-02, D-210-05)",
} as const;

export type PublishedName = keyof typeof PUBLISHED;
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * Withdrawn by D-210-01 when the index was ruled read-time.
 *
 * Asserted ABSENT rather than merely not-asserted-present, on the orchestrator's explicit
 * ruling: "a verb nobody ruled back in is a shape nobody ruled on". A module that still ships
 * it is either storing a projection the ruling removed or publishing a no-op, and both are
 * worth a red.
 */
export const WITHDRAWN = ["refreshUsage"] as const;

/** `interface TermUsage { termId: string; cards: number; blueprints: number; authors: number }` */
export const TERM_USAGE_KEYS = ["authors", "blueprints", "cards", "termId"] as const;

/**
 * `interface PromotionCandidate extends TermUsage { meetsAuthors: boolean; meetsBlueprints: boolean }`
 *
 * Derived from `TERM_USAGE_KEYS` rather than retyped, so a fifth member added to the base
 * cannot be silently absent from the derived set — the mistake would be invisible in two
 * hand-written lists that agree with each other.
 */
export const PROMOTION_CANDIDATE_KEYS: readonly string[] = [
  ...TERM_USAGE_KEYS,
  "meetsAuthors",
  "meetsBlueprints",
].sort();

/** D-210-09's two paths and their payload keys. */
export const USAGE_PATH = "/api/ontology-usage";
export const CANDIDATES_PATH = "/api/ontology-usage/candidates";
export const USAGE_PAYLOAD_KEY = "usage";
export const CANDIDATES_PAYLOAD_KEY = "candidates";

/* ============================================================
   Binding, and why the failures leave OUTSIDE any wrapper

   A bare `rejects.toThrow()` is satisfied by this suite's OWN
   absent-module throw, so a cell written that way is green against
   a module that does not exist. Every helper below therefore fails
   by throwing where the cell can see it, and `outcomeOf` captures a
   rejection as a VALUE rather than asserting on it in place.
   ============================================================ */

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Response) return `a Response (${value.status})`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${TERMS} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      "  This is a failed acceptance criterion, not a naming difference. Do not add a " +
      "synonym here; publish the name the contract states.",
  );
}

export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadTerms();
  const value = requireFrom(mod, name, PUBLISHED[name]);
  if (typeof value !== "function") {
    throw new Error(
      `${TERMS} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${PUBLISHED[name]}`,
    );
  }
  return value as UnknownFn;
}

export interface Outcome {
  ok: boolean;
  value?: unknown;
  error?: unknown;
}

/** Runs a call and reports what happened, so the ASSERTION sits in the cell, not a wrapper. */
export async function outcomeOf(call: () => unknown): Promise<Outcome> {
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    return { ok: false, error };
  }
}

/* ============================================================
   Shapes, checked at RUNTIME

   A type pin is silently vacuous against an absent module — types
   erase, so a cell of pure type assertions passes against a module
   that is not there — and cannot observe a `bigint` column arriving
   as a string. Every assertion below EXCLUDES the bad output its
   comment names rather than merely admitting the good one.
   ============================================================ */

/**
 * `typeof === "number"` and an integer, never `>= 0` alone.
 *
 * The live hazard here is a STRING, and it is not hypothetical for this task: every one of
 * `cards`, `blueprints` and `authors` is the size of a distinct set, which is what
 * `count(distinct …)` returns — `bigint`, which node-postgres hands back as `"3"`. And
 * `expect(n).toBeGreaterThanOrEqual(0)` is satisfied by `"0"`, as is any truthiness check,
 * `"0"` being a non-empty string. `Number.isInteger` excludes the string, `NaN`, `Infinity`
 * and `1.5` in one predicate.
 *
 * `NaN` is named separately in the message because it is the value that disarms a premise:
 * it is not nullish, so `??` misses it, and it is a `number` to `typeof`.
 */
export function assertCount(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `${where}: expected a non-negative integer, got ${describe_(value)} ` +
        `${JSON.stringify(value)}.\n` +
        "  A `bigint` from `count(distinct …)` read straight through arrives as a STRING, " +
        'and "0" satisfies every matcher that is not `typeof`. `NaN` is a `number` to ' +
        "`typeof` and is excluded here by `Number.isInteger`.",
    );
  }
  return value;
}

/** `true` or `false` and nothing else — never truthiness, which `"false"` and `1` both pass. */
export function assertBoolean(value: unknown, where: string): boolean {
  if (value !== true && value !== false) {
    throw new Error(
      `${where}: expected exactly \`true\` or \`false\`, got ${describe_(value)} ` +
        `${JSON.stringify(value)}.\n` +
        '  Truthiness is not the assertion: `"false"`, `1` and `0` all read as a boolean to ' +
        "a `!!` and none of them is one.",
    );
  }
  return value;
}

function keySetOf(value: unknown, where: string): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${where}: expected an object, got ${describe_(value)}.`);
  }
  /* `Object.keys` and not `in`: an inherited member is not a published one, and a check that
     walks the prototype reports a shape the contract never promised. */
  return Object.keys(value as Namespace).sort();
}

export function assertKeys(value: unknown, expected: readonly string[], where: string): Namespace {
  const found = keySetOf(value, where);
  const want = [...expected].sort();
  if (found.join(",") !== want.join(",")) {
    throw new Error(
      `${where}: key set is [${found.join(", ")}]; the contract publishes [${want.join(", ")}].\n` +
        "  Compared as a SET. A missing member puts a criterion out of reach; an extra one " +
        "is a shape nobody ruled on.",
    );
  }
  return value as Namespace;
}

/**
 * A `TermUsage` with every field checked for KIND, returned as plain numbers.
 *
 * The key set is checked first and the counts second, deliberately: a record missing
 * `authors` and a record whose `authors` is `"3"` are different defects and a cell that
 * cannot tell them apart reports the wrong one.
 */
export interface Usage {
  termId: string;
  cards: number;
  blueprints: number;
  authors: number;
}

export function assertUsage(value: unknown, where: string): Usage {
  const record = assertKeys(value, TERM_USAGE_KEYS, where);
  const termId = record.termId;
  if (typeof termId !== "string" || termId === "") {
    throw new Error(`${where}: \`termId\` is ${describe_(termId)}, expected a non-empty string.`);
  }
  return {
    termId,
    cards: assertCount(record.cards, `${where}.cards`),
    blueprints: assertCount(record.blueprints, `${where}.blueprints`),
    authors: assertCount(record.authors, `${where}.authors`),
  };
}

export interface Candidate extends Usage {
  meetsAuthors: boolean;
  meetsBlueprints: boolean;
}

export function assertCandidate(value: unknown, where: string): Candidate {
  const record = assertKeys(value, PROMOTION_CANDIDATE_KEYS, where);
  /* The base half is re-checked through `assertUsage` rather than duplicated: `PromotionCandidate
     extends TermUsage`, so a `cards` arriving as a string is the same defect in both and must
     produce the same message. The key set is re-asserted there against the narrower list and
     would red, so it is asserted here against the wider one first and the record is handed on
     field by field. */
  const base = assertUsage(
    {
      termId: record.termId,
      cards: record.cards,
      blueprints: record.blueprints,
      authors: record.authors,
    },
    where,
  );
  return {
    ...base,
    meetsAuthors: assertBoolean(record.meetsAuthors, `${where}.meetsAuthors`),
    meetsBlueprints: assertBoolean(record.meetsBlueprints, `${where}.meetsBlueprints`),
  };
}

/* ============================================================
   Reading the barrel from disk

   A type-level instrument cannot observe its own blindness: types
   erase, so a cell made of type assertions is green against a
   module that does not exist. A source cell is the only thing that
   distinguishes "a member is absent" from "an assertion failed".

   `Owns` forbids this suite from reading `lib/server/terms/**` as
   an implementation. This reads the BARREL as a published surface
   — the same thing `error-hygiene.test.ts` does to every module in
   the tree — and it reads it only to answer "is this name on it",
   never to learn how anything works. That distinction is the one
   `tests/error-hygiene.test.ts` already relies on; if the
   orchestrator reads it the other way, this file is the one to
   delete and the surface cell falls back to the runtime binding
   alone, which cannot tell absent from broken.
   ============================================================ */

export function barrelSource(): string | undefined {
  try {
    return readFileSync(`${REPO_ROOT}lib/server/terms/index.ts`, "utf8");
  } catch {
    return undefined;
  }
}

/* ============================================================
   The database this suite owns
   ============================================================ */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the first parameter of both T210 signatures. */
  db: unknown;
  /**
   * The connection string of this scratch database, for the route half.
   *
   * `getSharedDbClient()` reads `DATABASE_URL`, so a route handler can only be pointed at
   * this database by naming it. Asked of the connection itself rather than rebuilt from a
   * convention, so it cannot drift from what the client is actually on.
   */
  url: string;
  name: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

/**
 * A database of this file's own. `createTestDb()` creates `darkprint_test_<uuid>`, migrates
 * it and drops it on `drop()`; it never opens the shared development database `DATABASE_URL`
 * names (D-08). The darkprint-prefixed baseline at rest is three, so a scratch left behind is
 * visible BY NAME — and by name is the only way it is visible, since two databases can match
 * in count and differ in every element.
 */
export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(
      "createTestDb's client carries no `db`. `Db` is published from @/lib/db and is the " +
        "first parameter of both T210 signatures.",
    );
  }
  const [current] = (await test.client.query("select current_database() as name")).rows as {
    name?: unknown;
  }[];
  const database = current?.name;
  if (typeof database !== "string" || database === "") {
    throw new Error(
      `\`select current_database()\` answered ${describe_(database)}, so the route handlers ` +
        "cannot be pointed at this scratch database.",
    );
  }
  const base = new URL(process.env.DATABASE_URL ?? "");
  base.pathname = `/${database}`;

  return {
    db,
    url: base.toString(),
    name: database,
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
   Turning a hook failure into per-cell reds
   ============================================================ */

/**
 * Runs `fn` once and hands every caller the same outcome, failure included.
 *
 * A throw in `beforeAll` produces SKIPS, not reds: the run stands down rather than failing,
 * and a run with `skipped > 0` is INVALID rather than a zero. Measured in this repository at
 * 127 merged cells going silent under one broken writer, while thirteen cells in a suite that
 * recorded its setup failure and re-raised it PER CELL went red on the same defect.
 *
 * The stage is named in the re-raise because "the world did not build" and "the module is
 * absent" are different claims, and a cell that cannot tell them apart charges the wrong half.
 */
export function recorded<T>(stage: string, fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= fn().catch((cause: unknown) => {
      throw new Error(
        `${stage} did not build, so this cell measured nothing.\n` +
          "  Raised INSIDE the cell rather than thrown from a hook: a hook that throws SKIPS " +
          "every cell below it, and a run with skipped > 0 is invalid rather than a zero. " +
          "This is a broken fixture, NOT a failed acceptance criterion.",
        { cause },
      );
    });
    return pending;
  };
}
