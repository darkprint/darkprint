/* ============================================================
   T250 — the blind contract surface

   Not a test file. The vitest glob reaches `.test.ts` under `tests`
   and nothing else, so this module is imported by the suites beside
   it and is never collected as one itself.

   ── what this suite may and may not read ──
   §T250's `Owns` is `scripts/import-seed.ts`, `lib/server/seed/**`
   and `content/**`. Nothing in `tests/server/t250/**` opens the
   first two: they are the implementer's, and this suite is written
   blind against the document. `content/**` is read here, because it
   is the INPUT to the thing under test rather than the thing under
   test — a suite that could not read the archive could not state
   what an import of it should produce.

   `lib/content/**` and `lib/data/**` are the implementer's
   FORBIDDEN, and that is exactly what makes them usable here. An
   oracle written by the author of the assertions is a consistency
   check and never a second axis; a merged module the implementer is
   forbidden to call is a genuinely independent reader of the same
   bytes. See `printedDigests` below for the one that matters.
   ============================================================ */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const SEED = "@/lib/server/seed";

/** The repository root, derived from this file rather than from `process.cwd()`. */
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/* ============================================================
   The constants the rulings publish

   Every one of these was a silence this suite reported before
   writing a cell, and every one is now a literal in the document.
   They are literals here rather than imports from the module under
   test: a value imported from the thing it bounds moves with it and
   asserts nothing.
   ============================================================ */

/** The one handle everything imports under, and the one every `author:` line in the archive names. */
export const REGISTRY_HANDLE = "autogen";

/**
 * D-250-04's sentinel. GitHub ids start at 1, so no real signup can ever reach this row, and
 * `0` is legible as deliberate where an arbitrary large integer reads as an account somebody
 * might own.
 */
export const REGISTRY_GITHUB_ID = 0;

/**
 * D-250-03. `BundleManifest` has no `version` field and no `blueprint.yaml` carries one, so
 * the seeded release version is minted rather than read. It moved past `1.0.0` with the
 * manifests' descriptions and author lines.
 *
 * `v1.1.0` is the spelling `lib/data/bundles.ts` uses and `parseSemver` refuses the `v` prefix
 * by name, which is why the wrong answer is worth naming beside the right one.
 */
export const SEED_VERSION = "1.1.0";
export const RELEASES_PER_BUNDLE = 1;

/** D-250-08. `created` and `skipped` count BUNDLES. Cards do not fold in. */
export const SECOND_RUN_CREATED = 0;
export const SECOND_RUN_SKIPPED = 16;

/** D-250-06. The overlay terms, in the order the file declares them. A namespace segment names no author and no account; a rename would move card digests. */
export const OVERLAY_TERMS = [
  "lupo/pii-handling",
  "autogen/untrusted-text",
  "autogen/prompt-injection",
  "autogen/budget-overrun",
  "autogen/unverified-delegation",
];

/** The one whose namespace is not the registry handle, which is the property D-250-06 turns on. */
export const OVERLAY_TERM = "lupo/pii-handling";

/* ============================================================
   The barrel
   ============================================================ */

let seed: Promise<Namespace> | undefined;

/**
 * Memoised as the PROMISE, rejection included, so a module that is absent stays absent for the
 * whole file and every cell gets its own copy of the same red rather than one cell's failure
 * cascading into an unhandled rejection in the next.
 *
 * The rejection handler is not decoration. The first `import()` of a barrel pays the whole
 * dependency graph's transform, and under load that has crossed `testTimeout` in this repository
 * and reported as "the barrel does not export X" against a barrel where X was present, which is
 * a false charge against the implementer. So this red says what it actually observed: the module
 * did not LOAD, a different claim from a member being absent.
 */
export function loadSeed(): Promise<Namespace> {
  seed ??= import("@/lib/server/seed").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${SEED} does not load.\n` +
          "  T250 owns `lib/server/seed/**` and publishes `planImport` and " +
          "`runImport` from the barrel `@/lib/server/seed`.\n" +
          "  This is the MODULE failing to load, NOT a member being absent: the two produce " +
          "different reds on purpose. Before reading it as a missing export, check whether the " +
          "first import of this graph crossed testTimeout under load.\n" +
          "  Against an unmerged implementation this is the blind position and not a defect.",
        { cause },
      );
    },
  );
  return seed;
}

/* ============================================================
   What the contract publishes

   Quoted from §T250's Published signatures block so a red says
   where the name comes from, not merely that a test wanted it.
   ============================================================ */

export const PUBLISHED = {
  /* D-250-01 dropped `root`. The block still spells it `planImport(root: string)`; the ruling is
     later and governs, and the clause quoted in a red is the one the implementer is bound by. */
  planImport: "planImport(): Promise<ImportPlan>   // D-250-01 dropped the `root` parameter",
  runImport: "runImport(db: Db, plan: ImportPlan): Promise<ImportResult>",
} as const;

export type PublishedName = keyof typeof PUBLISHED;
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * `interface ImportPlan { bundles; cards; registryHandle: string }`
 *
 * Compared as a SET against `Object.keys`, never by membership alone. A fourth member is a
 * shape nobody ruled on; a missing third puts a criterion out of reach.
 *
 * D-250-01 ruled four. `ontologyVersion` was the fourth and
 * `0009_drop_ontology_versioning` took it: the registry keeps one vocabulary, the Attractor
 * spec language's, so the member reported a constant rather than a property of the plan, and
 * its source `CORE_ONTOLOGY.version` no longer exists.
 */
export const IMPORT_PLAN_KEYS = ["bundles", "cards", "registryHandle"] as const;

/** `interface ImportResult extends ImportPlan { created: number; skipped: number }` */
export const IMPORT_RESULT_KEYS: readonly string[] = [
  ...IMPORT_PLAN_KEYS,
  "created",
  "skipped",
].sort();

/** `{ slug: string; digest: string; releases: number }` */
export const PLAN_BUNDLE_KEYS = ["digest", "releases", "slug"] as const;

/** `{ cardId: string; version: string; digest: string; visibility: "public" | "private" }` */
export const PLAN_CARD_KEYS = ["cardId", "digest", "version", "visibility"] as const;

/** The two the signature's union admits. Nothing else is a visibility. */
export const VISIBILITIES = ["private", "public"] as const;

/* ============================================================
   Binding, and why the failures leave OUTSIDE any wrapper

   A `rejects.toThrow()` is satisfied by this suite's OWN
   absent-module throw, so a cell written that way is green against
   a module that does not exist. Every helper below therefore fails
   by throwing where the cell can see it, and `outcomeOf` captures a
   rejection as a VALUE rather than asserting on it in place.
   ============================================================ */

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${SEED} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      "  This is a failed acceptance criterion, not a naming difference. Do not add a synonym " +
      "here; publish the name the contract states.",
  );
}

export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadSeed();
  const value = requireFrom(mod, name, PUBLISHED[name]);
  if (typeof value !== "function") {
    throw new Error(
      `${SEED} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
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

/** Runs a call and reports what happened, so the ASSERTION sits in the cell rather than a wrapper. */
export async function outcomeOf(call: () => unknown): Promise<Outcome> {
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    return { ok: false, error };
  }
}

/* ============================================================
   Shapes, checked at RUNTIME

   A type pin is silently vacuous against an absent module and
   cannot observe a `numeric` column arriving as a string. Every
   assertion below EXCLUDES the bad output its comment names rather
   than merely admitting the good one.
   ============================================================ */

/** Excludes `""`, `"sha256:"`, a short digest, and an upper-case one. */
export const DIGEST = /^sha256:[0-9a-f]{64}$/;

/**
 * `typeof === "number"` and an integer, never `>= 0` alone.
 *
 * The live hazard is a STRING. Every count in this repository that comes off a `numeric` column
 * arrives as `"0"` from node-postgres, and `expect(n).toBeGreaterThanOrEqual(0)` is satisfied by
 * `"0"`, as is a truthiness check, `"0"` being a non-empty string. `releases`, `created` and
 * `skipped` are all plausibly derived from a `count(*)`, which is `bigint` and therefore a string
 * too. `Number.isInteger` excludes the string, `NaN`, `Infinity` and `1.5` in one predicate.
 */
export function assertCount(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `${where}: expected a non-negative integer, got ${describe_(value)} ` +
        `${JSON.stringify(value)}.\n` +
        "  A `numeric` or `bigint` column read straight through arrives as a STRING, and \"0\" " +
        "satisfies every matcher that is not `typeof`.",
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
        "  Compared as a SET. A missing member puts a criterion out of reach; an extra one is a " +
        "shape nobody ruled on.",
    );
  }
  return value as Namespace;
}

/* ============================================================
   The oracle for AC1, and why it is a second axis

   AC1: "after import each of the nine bundles hashes to the digest
   the site prints today." `public/bundles/<slug>/README.md` line 7
   PRINTS it:

       bundle digest  sha256:<64 hex>

   Those are committed generated bytes. They are not a
   recomputation, they are not written by this suite, and they are
   not reachable from `lib/server/seed`: `scripts/generate-bundles.ts`
   writes them out of `lib/content`, which is §T250's FORBIDDEN. So
   the standard and the thing measured against it have different
   authors, which is the whole of what a second axis means.

   Validated and falsified before any cell was written:
     * `lib/content`'s `allBlueprints()` digests equal all nine
       exactly;
     * `cardDigest` is invariant under a change of `author` across
       all 57 card versions;
     * flipping ONE hex character of ONE of the nine reds it, and
       perturbing `name` instead of `author` moves all 57.
   ============================================================ */

const BUNDLES_DIR = `${REPO_ROOT}content/blueprints`;
const CARDS_DIR = `${REPO_ROOT}content/cards`;
const PUBLIC_BUNDLES = `${REPO_ROOT}public/bundles`;

/**
 * B-20's own counts, as literals and deliberately so. A bound imported from the thing it bounds
 * moves with it and asserts nothing, and `public/bundles/` losing six directories must not
 * silently shrink AC1 to a third of its domain, which is the failure T090's suite recorded.
 */
export const EXPECTED_BUNDLES = 16;
export const EXPECTED_CARD_FILES = 111;
export const EXPECTED_CARD_IDS = 107;


export function bundleSlugs(): readonly string[] {
  return readdirSync(BUNDLES_DIR)
    .filter((name) => statSync(`${BUNDLES_DIR}/${name}`).isDirectory())
    .sort();
}

export function cardFiles(): readonly string[] {
  return readdirSync(CARDS_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .sort();
}

/** The distinct card ids, which is 57 where the file count is 61: four ids carry two versions. */
export function cardIds(): readonly string[] {
  return [...new Set(cardFiles().map((file) => file.split("@")[0]))].sort();
}

/**
 * Every handle an `author:` line in the archive names, read off `content/` rather than recalled.
 *
 * Derived so that a second author appearing in `content/**` is seen with nothing to remember.
 * The count is asserted in a cell rather than here: a throw in this function would land in
 * whichever hook called it first and produce SKIPS instead of a red.
 */
const AUTHOR_LINE = /^author:\s*(\S+)\s*$/m;

/**
 * The distinct `author:` handles across the ten blueprint manifests.
 *
 * Manifests and cards are read SEPARATELY, and the split is the point. A blueprint's
 * manifest author is the publisher, so the import moves it to the registry handle. A card's
 * author line is authorship inside a document somebody wrote, so the import leaves it alone
 * and `cardAuthors()` below answers the six archive handles. One union over both would be
 * satisfied by rewriting either set to match the other, which is the move D-250-18 forbids.
 */
export function manifestAuthors(): readonly string[] {
  const found = new Set<string>();
  for (const slug of bundleSlugs()) {
    const m = AUTHOR_LINE.exec(readFileSync(`${BUNDLES_DIR}/${slug}/blueprint.yaml`, "utf8"));
    if (m) found.add(m[1]);
  }
  return [...found].sort();
}

/** The distinct `author:` handles across the 61 card files. */
export function cardAuthors(): readonly string[] {
  const found = new Set<string>();
  for (const file of cardFiles()) {
    const m = AUTHOR_LINE.exec(readFileSync(`${CARDS_DIR}/${file}`, "utf8"));
    if (m) found.add(m[1]);
  }
  return [...found].sort();
}

export const EXPECTED_AUTHORS = 1;

/** The six people the archive's cards are written by, none of whom holds an account. */
/* One name since the archive's cards were unified under the account that publishes them.
   The six persona names this listed were the seed's, and a card's `author` is authorship
   while the account is ownership, so they were the one place the two disagreed. */
export const ARCHIVE_CARD_AUTHORS = ["autogen"] as const;

export interface PrintedBundle {
  slug: string;
  digest: string;
}

/**
 * The nine printed digests, scanned rather than listed.
 *
 * The scan DECIDES how many cells exist, so anything that shortens it removes assertions
 * silently: `it.each(printedDigests())` over a scan that found three is three green cells and
 * six that were never written. The completeness guard is a cell of its own beside them.
 */
export function printedDigests(): readonly PrintedBundle[] {
  const out: PrintedBundle[] = [];
  for (const slug of readdirSync(PUBLIC_BUNDLES).sort()) {
    const readme = `${PUBLIC_BUNDLES}/${slug}/README.md`;
    let text: string;
    try {
      text = readFileSync(readme, "utf8");
    } catch {
      continue;
    }
    const m = /^bundle digest\s+(sha256:[0-9a-f]{64})\s*$/m.exec(text);
    if (m) out.push({ slug, digest: m[1] });
  }
  return out;
}

/* ============================================================
   The database this suite owns
   ============================================================ */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db`, which is `runImport`'s first parameter. */
  db: unknown;
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error("createTestDb's client carries no `db`.");
  }
  const [current] = (await test.client.query("select current_database() as name")).rows as {
    name?: unknown;
  }[];
  const database = current?.name;
  if (typeof database !== "string" || database === "") {
    throw new Error(
      "`select current_database()` answered " +
        `${describe_(database)}, so this scratch database cannot be named.`,
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

/**
 * Every table `lib/db/schema.ts` declares, derived through drizzle rather than restated.
 *
 * Fails CLOSED. A derivation that found nothing would make every "moves nothing" cell pass by
 * comparing two empty maps, which is the silent shape this instrument exists to avoid.
 */
function allTables(): PgTable[] {
  const exported: unknown[] = Object.values(schema);
  const tables = exported.filter((value): value is PgTable => is(value, PgTable));
  if (tables.length === 0) {
    throw new Error(
      "allTables: no tables found in the `@/lib/db` schema export. The derivation is broken, and " +
        "an empty domain would make every boundary cell below vacuous.",
    );
  }
  return tables;
}

export function schemaTableNames(): readonly string[] {
  return allTables()
    .map((table) => getTableConfig(table).name)
    .sort();
}

export type Snapshot = Map<string, string[]>;

/**
 * Rows per table as sorted JSON, never as a count.
 *
 * 14 before and 14 after with different contents has passed a check in this repository. The
 * comparison is element-wise or it is not a comparison.
 */
export async function snapshotAll(s: Scratch): Promise<Snapshot> {
  return snapshotWith(s, (entries) => entries);
}

/**
 * The same snapshot with every `updated_at` column dropped.
 *
 * ── why this exists, and it is a correction against this suite ──
 * The first run of the blind suite against the implementation redded two AC2 cells because
 * `account` moved between two imports. Measured: the ONLY differing column was
 * `account.updated_at`, and `lib/server/accounts/github.ts:75` is where it comes from —
 * `upsertFromGitHub` does `onConflictDoUpdate({ set: { githubLogin, updatedAt: new Date() } })`
 * and bumps the column on every call. D-250-04 names `upsertFromGitHub` as the door that
 * creates the registry account, so the timestamp is T050's published behaviour arriving
 * through the only entrance this task is allowed to use.
 *
 * Charging that as a defect would charge T250 for a neighbour's semantics. `updated_at` is a
 * provenance column rather than content, so it is dropped UNIFORMLY across every table rather
 * than excepted on `account` — an exception for the one column that happened to red is how a
 * repair becomes a hole. What AC2 forbids is a re-run that changes what was IMPORTED, and that
 * is what the content comparison measures.
 *
 * The timestamp axis is not abandoned: `import.test.ts` keeps a cell over the FULL snapshot
 * asserting that `account` is the only table whose timestamp moves. A `bundle` or `release`
 * timestamp moving on a no-op re-run still reds.
 */
export async function snapshotContent(s: Scratch): Promise<Snapshot> {
  return snapshotWith(s, (entries) => entries.filter(([column]) => column !== "updated_at"));
}

async function snapshotWith(
  s: Scratch,
  pick: (entries: [string, unknown][]) => [string, unknown][],
): Promise<Snapshot> {
  const snap: Snapshot = new Map();
  for (const name of schemaTableNames()) {
    const rows = await s.query(`select * from "${name}"`);
    snap.set(
      name,
      rows
        .map((row) => JSON.stringify(Object.fromEntries(pick(Object.entries(row)).sort())))
        .sort(),
    );
  }
  return snap;
}

export function movedTableNames(before: Snapshot, after: Snapshot): string[] {
  const moved: string[] = [];
  for (const [name, rows] of after) {
    const was = before.get(name) ?? [];
    if (was.join(" ") !== rows.join(" ")) moved.push(name);
  }
  return moved.sort();
}
