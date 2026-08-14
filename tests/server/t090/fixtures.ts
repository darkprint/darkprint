/* ============================================================
   T090 — fixtures: a release in a database of this file's own

   Not a test file.

   ── why the seeding imports are static ──
   `@/lib/server/archive` (T010), `@/lib/server/cards` (T020) and
   `@/lib/server/ontology` (T030) are all merged on `backend` and
   ship in this worktree, so importing them is a real import rather
   than a compile-time dependency on something unmerged. They are
   how a release gets *into* the database; the module under test is
   loaded dynamically in `contract.ts` and only there.

   ── isolation ──
   Each test file creates, migrates, drives and drops
   `darkprint_t090_<file>_<pid>`, and checks the premise with
   `select current_database()` rather than trusting it: a client that
   ignored its connection string would leave the suite on the shared
   `darkprint` with every assertion still passing, which is D-08
   reproduced with the fix in place. One name per file per process,
   so two files in parallel workers cannot see each other, and a run
   that dies before teardown leaves a database the next run of the
   same file drops on sight. Nothing sweeps other names.

   ── the archive is the fixture, and it is the AC1 oracle's twin ──
   `content/` and `public/bundles/` are two halves of one shipped
   artefact: `scripts/generate-bundles.ts` writes the second from the
   first through `exportBundle`. So seeding a release out of
   `readContent()` and then comparing the served file list against
   `public/bundles/<slug>/` is a comparison between what T090 does
   with the archive and what the build does with it — which is
   exactly what AC1 asks for, "name for name".
   ============================================================ */

import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

import { CORE_ONTOLOGY, parseCardRef } from "@/lib/core";
import type { BlueprintAnalysis, ResolvedBlueprint } from "@/lib/core";
import { createDbClient, migrateUp, type Db, type DbClient } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";
import { addCard } from "@/lib/server/cards";
import { addOntologyVersion } from "@/lib/server/ontology";
import { contentVocabulary, readContent, type LoadedBundle } from "@/lib/content/read";

/* --------------------- the scratch database --------------------- */

const MAINTENANCE_DATABASE = "postgres";

function databaseUrlFor(name: string): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "DATABASE_URL is not set. Run `docker compose up -d` and `set -a; . ./.env.example; set +a` " +
        "first — backend.md records that every DATABASE_URL failure in this run has been an unset " +
        "shell rather than a defect.",
    );
  }
  const url = new URL(base);
  url.pathname = `/${name}`;
  return url.toString();
}

export interface Scratch {
  /** The published `Db` — the first parameter of all three T090 functions. */
  db: Db;
  /** For the fixture rows no published function owns. */
  pool: Pool;
  /**
   * The whole client, for the route tests.
   *
   * A route handler takes no `Db`: it reaches for `getSharedDbClient()`, which caches on
   * `globalThis` behind `Symbol.for("darkprint.db.sharedClient")` — a slot `lib/db/client.ts`
   * documents as existing so the pool survives Next's hot reload. Installing a scratch client
   * there is what keeps a route test off the shared `darkprint` database, which the isolation
   * rule forbids.
   */
  client: DbClient;
  name: string;
  drop(): Promise<void>;
}

async function withAdmin<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const admin = new Pool({ connectionString: databaseUrlFor(MAINTENANCE_DATABASE) });
  try {
    return await run(admin);
  } finally {
    await admin.end();
  }
}

async function dropDatabase(admin: Pool, name: string): Promise<void> {
  /* FORCE terminates whatever is still connected, which matters because `migrateUp` opens a
     pool this file never gets a handle on. Postgres 13 and up; the plain form is the fallback. */
  try {
    await admin.query(`drop database if exists "${name}" with (force)`);
  } catch {
    await admin.query(`drop database if exists "${name}"`).catch(() => undefined);
  }
}

/** A migrated database of this file's own — never the shared `DATABASE_URL` one. */
export async function scratchDatabase(tag: string): Promise<Scratch> {
  const name = `darkprint_t090_${tag}_${process.pid}`;

  await withAdmin(async (admin) => {
    await dropDatabase(admin, name);
    await admin.query(`create database "${name}"`);
  });

  const url = databaseUrlFor(name);
  let client: DbClient;
  try {
    client = createDbClient(url);
    await migrateUp(client.pool);
  } catch (cause) {
    await withAdmin((admin) => dropDatabase(admin, name));
    throw cause;
  }

  /* The premise of everything below, checked rather than hoped for. */
  const where = await client.pool.query<{ name: string }>("select current_database() as name");
  if (where.rows[0]?.name !== name) {
    await client.close();
    await withAdmin((admin) => dropDatabase(admin, name));
    throw new Error(
      `This file created ${name} and asked createDbClient for it, and the client connected to ` +
        `"${String(where.rows[0]?.name)}" instead. A client that ignores the connection string it ` +
        `is handed puts this suite back on the shared database, which the isolation rule forbids ` +
        `and which dropped another suite's tables mid-run in T000 round 2.`,
    );
  }

  return {
    db: client.db,
    pool: client.pool,
    client,
    name,
    async drop() {
      await client.close();
      await withAdmin((admin) => dropDatabase(admin, name));
    },
  };
}

/* --------------------- observing a write whose medium is not published --------------------- */

/**
 * Every row in every user table of this scratch database, as `table -> JSON of its rows`.
 *
 * `recordDownload(db, target)` is published as a signature and **nothing published says which
 * table it writes to**. A test that guessed `target` would be asserting against a schema detail
 * the contract does not state, and would red an implementation that recorded somewhere else for
 * a reason it was entitled to.
 *
 * So the medium is *derived*: snapshot everything, call `recordDownload` once, diff. Whatever
 * moved is the medium, by construction — and the same diff then measures what `serveFile`,
 * `serveCard` and `exportRelease` each do. Neither side of that comparison is hand-written, which
 * is the shape backend.md reached for when a blind author had no published wording to pin.
 *
 * Rows rather than counts, because "exactly once per served file" needs the row and `refId` needs
 * its contents. Ordered by the text of the row so two snapshots compare stably.
 */
export async function snapshotRows(scratch: Scratch): Promise<Map<string, string[]>> {
  const tables = await scratch.pool.query<{ table_name: string }>(
    "select table_name from information_schema.tables " +
      "where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
  );
  const snapshot = new Map<string, string[]>();
  for (const { table_name: name } of tables.rows) {
    const rows = await scratch.pool.query(`select to_jsonb(t) as row from "${name}" t`);
    snapshot.set(
      name,
      rows.rows.map((r) => JSON.stringify((r as { row: unknown }).row)).sort(),
    );
  }
  return snapshot;
}

/** One table's rows that are in `after` and not in `before`, per table, dropping empty entries. */
export function rowsAdded(
  before: Map<string, string[]>,
  after: Map<string, string[]>,
): Map<string, string[]> {
  const added = new Map<string, string[]>();
  for (const [table, rows] of after) {
    const seen = new Map<string, number>();
    for (const row of before.get(table) ?? []) seen.set(row, (seen.get(row) ?? 0) + 1);
    const fresh: string[] = [];
    for (const row of rows) {
      const left = seen.get(row) ?? 0;
      if (left > 0) seen.set(row, left - 1);
      else fresh.push(row);
    }
    if (fresh.length > 0) added.set(table, fresh);
  }
  return added;
}

/** Total rows added across every table — the check that the write is observable at all. */
export function totalRowsAdded(added: Map<string, string[]>): number {
  let total = 0;
  for (const rows of added.values()) total += rows.length;
  return total;
}

/**
 * Where a download count lives, derived by counting rather than by naming a column.
 *
 * Counting *rows* is not enough and finding that out is the point: a download event is almost
 * certainly an upsert onto a per-target row, so recording twice changes the same row twice and
 * adds exactly one row either way. A row-delta instrument therefore cannot tell one event from
 * two — which is precisely the defect "each served file emits **one** download event" exists to
 * forbid, invisible to the instrument built to check it.
 *
 * So the counter is located by driving it: call `recordDownload` once on a refId nothing else
 * uses, then twice more, and look for the field that went from 1 to 3. Nothing here names
 * `target` or `download_count`; `lib/db/schema.ts` is Forbidden to this task and where the event
 * lands is not T090's to declare.
 */
export interface DownloadCounter {
  table: string;
  field: string;
}

export async function deriveDownloadCounter(
  scratch: Scratch,
  record: (target: { kind: "blueprint" | "card"; refId: string }) => Promise<unknown>,
  probeRefId: string,
): Promise<DownloadCounter> {
  await record({ kind: "blueprint", refId: probeRefId });
  const one = await rowContaining(scratch, probeRefId);
  await record({ kind: "blueprint", refId: probeRefId });
  await record({ kind: "blueprint", refId: probeRefId });
  const three = await rowContaining(scratch, probeRefId);

  if (one === undefined || three === undefined) {
    throw new Error(
      `No row in any table carries the probe refId \`${probeRefId}\` after recordDownload, so ` +
        `the download counter cannot be located and nothing about "exactly once" is measurable.`,
    );
  }
  if (one.table !== three.table) {
    throw new Error(`The probe row moved tables between calls: ${one.table} -> ${three.table}.`);
  }

  const candidates = Object.keys(three.row).filter((key) => {
    const a = Number(one.row[key]);
    const b = Number(three.row[key]);
    return Number.isFinite(a) && Number.isFinite(b) && a === 1 && b === 3;
  });
  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one field to go 1 -> 3 across three recordDownload calls on \`` +
        `${probeRefId}\`; found [${candidates.join(", ")}]. One row: ${JSON.stringify(one.row)}. ` +
        `Three: ${JSON.stringify(three.row)}. Without a single unambiguous counter, an ` +
        `"exactly once" assertion would be measuring something adjacent to the claim.`,
    );
  }
  return { table: one.table, field: candidates[0] as string };
}

async function rowContaining(
  scratch: Scratch,
  needle: string,
): Promise<{ table: string; row: Record<string, unknown> } | undefined> {
  const tables = await scratch.pool.query<{ table_name: string }>(
    "select table_name from information_schema.tables " +
      "where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
  );
  for (const { table_name: name } of tables.rows) {
    const rows = await scratch.pool.query<{ row: Record<string, unknown> }>(
      `select to_jsonb(t) as row from "${name}" t where to_jsonb(t)::text like $1`,
      [`%${needle}%`],
    );
    if (rows.rows.length === 1) return { table: name, row: rows.rows[0]!.row };
    if (rows.rows.length > 1) {
      throw new Error(`${rows.rows.length} rows in "${name}" carry \`${needle}\`; expected one.`);
    }
  }
  return undefined;
}

/** The derived counter's value for one refId, or 0 when nothing has recorded it. */
export async function downloadsFor(
  scratch: Scratch,
  counter: DownloadCounter,
  refId: string,
): Promise<number> {
  const rows = await scratch.pool.query<{ row: Record<string, unknown> }>(
    `select to_jsonb(t) as row from "${counter.table}" t where to_jsonb(t)::text like $1`,
    [`%${refId}%`],
  );
  if (rows.rows.length === 0) return 0;
  if (rows.rows.length > 1) {
    throw new Error(`${rows.rows.length} counter rows carry \`${refId}\`; expected at most one.`);
  }
  return Number(rows.rows[0]!.row[counter.field]);
}

/* --------------------- rows no published function owns --------------------- */

export interface SeededAccount {
  accountId: string;
  handle: string;
}

/**
 * `bundle.owner_id` is a foreign key to `account`, and accounts are T050's, which has not
 * merged. A fixture row goes in by hand rather than through a function nothing has published.
 *
 * The handle matters here in a way it did not for T010: `serveFile`'s published `ref` is
 * `{ ownerHandle, slug, … }`, so the handle is half the address under test.
 */
export async function seedAccount(scratch: Scratch, marker: string): Promise<SeededAccount> {
  const handle = `t090-${marker}`;
  const row = await scratch.pool.query<{ id: string }>(
    "insert into account (github_id, github_login, handle) values ($1, $2, $3) returning id",
    [`gh-${marker}-${randomUUID()}`, `login-${marker}-${randomUUID()}`, handle],
  );
  const id = row.rows[0]?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the account fixture: got ${String(id)} for its id.`);
  }
  return { accountId: id, handle };
}

/**
 * The core vocabulary, at the version every bundle in `content/` declares.
 *
 * `exportRelease` has to resolve a stored release back into a `ResolvedBlueprint`, which needs
 * an `OntologyView`, which T030 publishes as `openView(db, version, extensions)` — so the
 * version named by `manifest.ontologyVersion` has to be a row before any export can run.
 */
export async function seedOntology(db: Db): Promise<string> {
  const version = CORE_ONTOLOGY.version;
  await addOntologyVersion(db, { version, terms: [...CORE_ONTOLOGY.terms] });
  return version;
}

/* --------------------- the archive as a fixture --------------------- */

/** Every bundle under `content/`, memoised by `readContent` itself. */
export function archive(): readonly LoadedBundle[] {
  return readContent();
}

export function bundleBySlug(slug: string): LoadedBundle {
  const found = archive().find((entry) => entry.slug === slug);
  if (found === undefined) {
    throw new Error(
      `No bundle \`${slug}\` under content/. The archive holds: ` +
        `${archive().map((e) => e.slug).join(", ")}.`,
    );
  }
  return found;
}

/**
 * The one bundle whose cards declare a local term, and one that declares none.
 *
 * Derived from the shipped artefact rather than named by hand, so AC3's pair cannot drift from
 * the archive: `public/bundles/<slug>/ontology/extensions.yaml` exists for exactly the bundles
 * `exportBundle` writes it for.
 */
export function withLocalTerm(): LoadedBundle {
  const found = archive().filter((entry) => diskFilePaths(entry.slug).includes(VOCABULARY_PATH));
  if (found.length === 0) {
    throw new Error(
      `AC3 needs a bundle carrying \`${VOCABULARY_PATH}\` and no bundle under public/bundles/ ` +
        `has one. Without it the criterion's "with it" half cannot be exhibited.`,
    );
  }
  return found[0] as LoadedBundle;
}

export function withoutLocalTerm(): LoadedBundle {
  const found = archive().filter((entry) => !diskFilePaths(entry.slug).includes(VOCABULARY_PATH));
  if (found.length === 0) {
    throw new Error(
      `AC3 needs a bundle carrying no \`${VOCABULARY_PATH}\` and every bundle under ` +
        `public/bundles/ has one.`,
    );
  }
  return found[0] as LoadedBundle;
}

export const VOCABULARY_PATH = "ontology/extensions.yaml";

/* --------------------- the AC1 oracle, on disk --------------------- */

const BUNDLES_DIR = join(process.cwd(), "public", "bundles");

/**
 * What `public/bundles/<slug>/` holds today, as bundle-relative forward-slash paths, sorted.
 *
 * AC1's oracle, and deliberately a directory walk rather than a call into `bundleFilePaths`:
 * the criterion says "equals what `public/bundles/<slug>/` holds today, name for name", and
 * deriving the expectation from the same module the implementation consumes would ask whether
 * that module agrees with itself.
 */
export function diskFilePaths(slug: string): readonly string[] {
  const root = join(BUNDLES_DIR, slug);
  const walk = (dir: string, prefix: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
      else out.push(rel);
    }
    return out;
  };
  return walk(root, "").sort();
}

/** The nine slugs `public/bundles/` holds, sorted. */
export function shippedSlugs(): readonly string[] {
  return readdirSync(BUNDLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/* --------------------- seeding one release --------------------- */

export interface SeededRelease {
  bundleId: string;
  slug: string;
  ownerHandle: string;
  ownerId: string;
  version: string;
  /** Computed by `addRelease`, never supplied — T010's signature says so. */
  digest: string;
}

export interface SeedOptions {
  /** Overrides the stored DOT. Used to exhibit a release whose bytes no longer emit or parse. */
  dot?: string;
  /** Semver the release declares. Defaults to `1.0.0`. */
  version?: string;
  /** An existing bundle to append to, instead of creating one. */
  bundleId?: string;
  /** Overrides the vocabulary's bytes, to exhibit that they are served rather than re-emitted. */
  vocabularyText?: string;
  /** Stores something that is not `{ text, terms }`, for the fifth admissible refusal. */
  rawVocabulary?: unknown;
  /** Cards written at this visibility. `private` exhibits D-90-05's refusal. */
  cardVisibility?: "public" | "private";
  /** The bundle's own visibility. Defaults to `public`. */
  visibility?: "public" | "private";
  /** Owner of the card rows, when it must differ from the bundle's owner. */
  cardOwner?: SeededAccount;
  /**
   * Stores a release whose `cardRefs` omit one card its DOT pins.
   *
   * Both arrays lose the same entry, so T010's parity check is satisfied and the release stores —
   * which is the point: nothing between the publisher and here notices, and the bundle then
   * resolves with a `bundle/missing-card` error, dropping that node from `blueprint.nodes`.
   * `exportBundle` does not throw on it (its own throw fires on a node that survived resolution),
   * so the naive composition serves a folder missing a card and a `factory.dot` missing a node.
   * Added after a falsification found the suite blind to exactly this.
   */
  dropOneCardRef?: boolean;
  /** Overrides the slug, so two owners can hold the same one (B-09). */
  slug?: string;
}

/**
 * `release.local_vocabulary` as D-90-03 ruled it: `{ text, terms }`, not terms alone.
 *
 * The defect was that `exportBundle` needs `ExportedVocabulary { text, terms }`, whose `text` is
 * documented "the file, byte for byte, written into the bundle unaltered, like the cards" — and
 * the column held terms only, so the author's bytes were stored nowhere and `ontology/
 * extensions.yaml` could only be re-emitted from the parse, losing comments, key order and
 * formatting. The column is already `jsonb`, so the ruling needed no migration.
 */
export interface StoredVocabulary {
  text: string;
  terms: unknown;
}

export function storedVocabulary(text?: string): StoredVocabulary | undefined {
  const vocabulary = contentVocabulary();
  if (vocabulary === undefined) return undefined;
  return { text: text ?? vocabulary.text, terms: vocabulary.terms };
}

/**
 * The archive's vocabulary with its bytes perturbed in the two ways a re-emitter loses.
 *
 * A marker comment no serialiser would invent, and the two top-level keys in the other order.
 * Both parse to exactly the terms the shipped file parses to — a comment is not data and YAML
 * mappings are unordered — so this is the same vocabulary, byte-differently spelled, which is
 * the only construction under which "served verbatim" and "re-emitted from the parse" give
 * different answers.
 */
export const VOCABULARY_MARKER = "# t090-verbatim-marker: this comment survives or it does not";

export function perturbedVocabularyText(): string {
  const vocabulary = contentVocabulary();
  if (vocabulary === undefined) {
    throw new Error("content/ontology/extensions.yaml is absent; AC3's verbatim half needs it.");
  }
  const text = vocabulary.text;
  const versionLine = /^version:.*$/m.exec(text);
  if (versionLine === null) {
    throw new Error(
      "content/ontology/extensions.yaml no longer carries a top-level `version:` line, so the " +
        "key-order perturbation below would be a no-op and this fixture would stop discriminating.",
    );
  }
  /* `version` moved to the end and a marker comment at the top. Key order is not data to a YAML
     parser and a comment is not data at all, so `parseOntologyTerms` returns the same terms. */
  const withoutVersion = text.replace(/^version:.*$\n?/m, "");
  return `${VOCABULARY_MARKER}\n${withoutVersion}\n${versionLine[0]}\n`;
}

/**
 * One bundle from `content/` written into the database the way T010, T020 and T030 publish.
 *
 * Card digests come back from `addCard`, which computes them, rather than being recomputed
 * here: `bundleDigest` is taken over the DOT and those digests, so a fixture that computed its
 * own would be asserting the store agrees with the test's arithmetic instead of storing what
 * the store stored. Measured once while building this file — every card's stored digest equals
 * `lib/core`'s `node.digest` for the same body, and the resulting release digest equals
 * `blueprint.digest` for all nine bundles.
 */
export async function seedRelease(
  scratch: Scratch,
  owner: SeededAccount,
  entry: LoadedBundle,
  options: SeedOptions = {},
): Promise<SeededRelease> {
  const db = scratch.db;

  const textByRef = new Map<string, string>();
  for (const file of entry.cardFiles) {
    textByRef.set(file.file.replace(/^cards\//, "").replace(/\.yaml$/, ""), file.text);
  }

  const cardRefs: string[] = [];
  const cardDigests: string[] = [];
  const seen = new Set<string>();
  for (const node of entry.blueprint.nodes) {
    if (seen.has(node.ref)) continue;
    seen.add(node.ref);
    const parsed = parseCardRef(node.ref);
    if (parsed === undefined) throw new Error(`Unparseable card ref in the archive: ${node.ref}`);
    const source = textByRef.get(node.ref);
    if (source === undefined) throw new Error(`No card text in the archive for ${node.ref}`);

    /* A card shared by two blueprints is one row: `addCard` refuses a republish, and seeding
       two bundles that pin the same version is the normal case, not an error. */
    const existing = await scratch.pool.query<{ digest: string }>(
      "select digest from card_version where card_id = $1 and version = $2",
      [parsed.id, parsed.version],
    );
    const already = existing.rows[0]?.digest;
    if (typeof already === "string") {
      cardRefs.push(node.ref);
      cardDigests.push(already);
      continue;
    }

    const cardOwner = options.cardOwner ?? owner;
    const record = await addCard(db, {
      cardId: parsed.id,
      version: parsed.version,
      ownerId: cardOwner.accountId,
      visibility: options.cardVisibility ?? "public",
      body: node.card,
      source,
    });
    cardRefs.push(node.ref);
    cardDigests.push(record.digest);
  }

  if (options.dropOneCardRef === true) {
    if (cardRefs.length < 2) {
      throw new Error(
        `\`${entry.slug}\` pins ${cardRefs.length} card(s); dropping one would leave a release ` +
          `with no cards at all, which is a different fixture from the one this option means.`,
      );
    }
    cardRefs.pop();
    cardDigests.pop();
  }

  const slug = options.slug ?? entry.slug;
  const bundleId =
    options.bundleId ??
    (
      await createBundle(db, {
        ownerId: owner.accountId,
        slug,
        visibility: options.visibility ?? "public",
      })
    ).id;

  const vocabulary =
    "rawVocabulary" in options
      ? (options.rawVocabulary as StoredVocabulary | undefined)
      : storedVocabulary(options.vocabularyText);
  const release = await addRelease(db, {
    bundleId,
    version: options.version ?? "1.0.0",
    dot: options.dot ?? entry.bundle.dot,
    manifest: entry.bundle.manifest,
    cardRefs,
    cardDigests,
    /* D-90-03: `{ text, terms }`, so the author's bytes survive and `ontology/extensions.yaml`
       is served verbatim rather than re-emitted from the parse. T010 types the field `unknown`
       and T030 reads `.terms` for `openView`'s extensions. */
    ...(vocabulary === undefined ? {} : { vocabulary }),
    analysis: analysisFor(entry.blueprint, entry.analysis),
  });

  return {
    bundleId,
    slug,
    ownerHandle: owner.handle,
    ownerId: owner.accountId,
    version: release.version,
    digest: release.digest,
  };
}

function analysisFor(
  blueprint: ResolvedBlueprint,
  analysis: BlueprintAnalysis,
): { autonomy: BlueprintAnalysis["autonomy"]; security: BlueprintAnalysis["security"]; phaseCoverage: ResolvedBlueprint["phaseCoverage"] } {
  return {
    autonomy: analysis.autonomy,
    security: analysis.security,
    phaseCoverage: blueprint.phaseCoverage,
  };
}

/* --------------------- residue --------------------- */

/*
 * backend.md: "Residue includes the filesystem, not only the media you thought of." T090 is the
 * first task whose implementation may write distribution artefacts to object storage, so a run
 * of this suite can leave bytes in the shared bucket — and `ObjectStorage` publishes `put`,
 * `get` and `delete` and no `list`, so no in-suite assertion can count them. The bucket is
 * therefore measured out of band, before and after a full run, and the delta is reported in the
 * Log rather than asserted here. Recorded rather than left silent, because a residue check
 * scoped to the media its author thought of is the failure this file's preamble names.
 */
