/* ============================================================
   T100 — fixtures: a corpus, an owner, and a database of this
   file's own

   Not a test file.

   ── why the seeding imports are static ──
   `@/lib/server/archive` (T010), `@/lib/server/cards` (T020),
   `@/lib/server/versioning` (T025), `@/lib/server/engine` (T040)
   and `@/lib/core` are all merged on `backend` and ship in this
   worktree, so importing them is a real import rather than a
   compile-time dependency on something unmerged. They are how the
   corpus is built and how a premise is checked; the module under
   test is loaded dynamically in `contract.ts` and only there.

   ── isolation ──
   Each test file creates, migrates, drives and drops
   `darkprint_t100_<file>_<pid>`, and checks the premise with
   `select current_database()` rather than trusting it: a client
   that ignored its connection string would leave the suite on the
   shared `darkprint` with every assertion still passing, which is
   D-08 reproduced with the fix in place. One name per file per
   process, so two files in parallel workers cannot see each other,
   and a run that dies before teardown leaves a database the next
   run of the same file drops on sight. Nothing sweeps other names.

   ── the corpus is the shipped archive, mutated on purpose ──
   `readContent()` returns bundles whose diagnostics are guaranteed
   free of errors, so the "resolves" case is not this author's guess
   at what a valid bundle looks like — it is one the build already
   accepted. The refusal cases are derived from it by a single named
   mutation each, so what makes them refusable is one difference
   from a known-good bundle rather than a hand-written document that
   might be wrong for six reasons at once.

   **What the premise checks below do and do not establish.** Each
   variant asserts, through `validateBundle` and `bundleProgress`,
   that it really is the shape its name claims. That is a check on
   the FIXTURE, not an oracle for the module under test: the counts
   the cells assert are derived from the construction (how many
   cards were dropped from a bundle whose every node was carded),
   not read back out of `bundleProgress`. Were the counts taken from
   `bundleProgress`, and were the implementation to call it too,
   green would prove the two agree and nothing more — which is the
   failure this role was warned about.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { CORE_ONTOLOGY, bundleDigest, parseCardRef } from "@/lib/core";
import type { BundleManifest, LoadBundleResult } from "@/lib/core";
import { createDbClient, migrateUp, type Db, type DbClient } from "@/lib/db";
import { addCard, getCard } from "@/lib/server/cards";
import { validateBundle, validateCardSource } from "@/lib/server/engine";
import { readContent, type LoadedBundle } from "@/lib/content/read";
import { bundleProgress } from "@/components/upload/progress";
import type { Actor } from "@/lib/server/policy";

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
  /** The published `Db` — the first parameter of `publish`. */
  db: Db;
  /** For the fixture rows and snapshots no published function owns. */
  pool: Pool;
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
  const name = `darkprint_t100_${tag}_${process.pid}`;

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

  /* **The ontology version has to be a row before any publish can run** (D-100-05 A2).
     `publish` opens an `OntologyView` for `manifest.ontologyVersion`, and an unpublished
     version raises T030's `UnknownOntologyVersionError` — which is a foreign rejection that
     reaches the caller unaltered, so it does not even look like a T100 refusal.

     It was seeded here rather than per file because EVERY scratch database in this suite is
     used to publish, so a file that forgot the call would not have been exercising a different
     scenario, it would have been measuring an upstream failure and reporting it as a criterion.
     `openView` merges over `CORE_ONTOLOGY` and reaches no store, so there is no precondition
     left to forget. A2 ("`openView` REQUIRED, T030 joins the composition set") was ruled in a
     message and never reached `backend.md`; `openView` is still in the composition set and no
     longer takes a database. */

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

/** The version every scratch database publishes, exported so a cell can name it. */
export const SEEDED_ONTOLOGY_VERSION = CORE_ONTOLOGY.version;

/* --------------------- an owner --------------------- */

export interface Owner {
  accountId: string;
  handle: string;
  /** What D-100-01 says an omitted `PublishInput.visibility` falls back to — never `"public"`. */
  defaultVisibility: "public" | "private";
  actor: Actor;
}

/**
 * An account row with a handle, and the `Actor` that account presents as.
 *
 * Written with SQL rather than through `upsertFromGitHub` because what is wanted is a row with a
 * chosen handle, not a GitHub sign-in flow — T050's own suites seed the same way
 * (`tests/server/t080/contract.ts:569`). `github_id` is unique, so it carries a UUID.
 */
export async function seedOwner(
  scratch: Scratch,
  handle: string,
  defaultVisibility: "public" | "private" = "public",
): Promise<Owner> {
  const githubId = randomUUID();
  const rows = await scratch.pool.query<{ id: string }>(
    "insert into account (github_id, github_login, handle, default_visibility) " +
      "values ($1, $2, $3, $4) returning id",
    [githubId, handle, handle, defaultVisibility],
  );
  const accountId = rows.rows[0]?.id;
  if (accountId === undefined) {
    throw new Error(`seedOwner(${handle}) inserted no row.`);
  }
  return {
    accountId,
    handle,
    defaultVisibility,
    actor: { kind: "account", accountId, handle },
  };
}

/* --------------------- the corpus --------------------- */

export interface Corpus {
  slug: string;
  manifest: BundleManifest;
  dot: string;
  cardFiles: Record<string, string>;
  /** Every node the DOT declares, in the order it declares them. */
  nodeIds: readonly string[];
  /** `id@version` for every card the DOT pins, in the same order. */
  cardRefs: readonly string[];
}

function corpusFrom(loaded: LoadedBundle): Corpus {
  const cardFiles: Record<string, string> = {};
  for (const file of loaded.cardFiles) cardFiles[file.file] = file.text;

  const nodeIds = loaded.blueprint.graph.ids.map((id) => id);
  const cardRefs = loaded.blueprint.nodes.map((node) => node.ref);

  return {
    slug: loaded.slug,
    manifest: loaded.bundle.manifest,
    dot: loaded.bundle.dot,
    cardFiles,
    nodeIds,
    cardRefs,
  };
}

/**
 * The smallest bundle in `content/` that resolves, chosen by node count so the fixtures stay
 * legible and the counts in a refusal message are small enough to read.
 *
 * Chosen by measurement rather than named as a literal: a bundle renamed or removed from the
 * archive would otherwise turn into a missing-fixture failure that reads like a T100 defect.
 */
export function resolvingCorpus(): Corpus {
  const bundles = readContent();
  if (bundles.length === 0) {
    throw new Error(
      "readContent() returned no bundles. The corpus for every T100 cell comes from `content/`, " +
        "so this is a broken checkout rather than a T100 defect.",
    );
  }
  const smallest = [...bundles].sort(
    (a, b) => a.blueprint.graph.ids.length - b.blueprint.graph.ids.length,
  )[0];
  const corpus = corpusFrom(smallest as LoadedBundle);

  /* There is no join left to check between the corpus and the seed. `scratchDatabase` used to
     publish `CORE_ONTOLOGY.version` and `publish` opened a view for whatever the MANIFEST
     named, so an archive declaring a different one would have failed every cell in this suite
     at `openView` with an error that had nothing to do with its criterion. A manifest declares
     no version and `openView` merges over `CORE_ONTOLOGY`, so the two halves cannot disagree. */
  return corpus;
}

/** A second, different bundle — for the fork's upstream, so it cannot be confused with the fork. */
export function secondCorpus(exclude: string): Corpus {
  const bundles = readContent().filter((b) => b.slug !== exclude);
  const smallest = [...bundles].sort(
    (a, b) => a.blueprint.graph.ids.length - b.blueprint.graph.ids.length,
  )[0];
  if (smallest === undefined) {
    throw new Error(`content/ holds no bundle other than ${exclude}.`);
  }
  return corpusFrom(smallest);
}

/* --------------------- the two refusable variants --------------------- */

export interface Variant extends Corpus {
  /** How many of `nodeIds` still have their card in `cardFiles`. */
  placed: number;
  /** How many nodes the DOT declares. Always `nodeIds.length`. */
  total: number;
  /**
   * How many `error` diagnostics this variant's mutation was built to produce, derived from the
   * construction rather than read back off the engine.
   *
   * The distinction is the whole point of the field. `errorCount()` below asks `validateBundle`,
   * which is the function an implementation of `publish` will itself call — so a cell that took
   * its expected count from there would assert that the module agrees with the engine, which it
   * would do even if both were counting the wrong thing. This number comes from the mutation: an
   * edge carrying two ports that do not exist is two port mismatches. `assertProgress` then
   * checks the engine against it, so a divergence is a loud broken fixture rather than a cell
   * that quietly stopped discriminating.
   *
   * Absent on the unfinished variant, and deliberately so: AC1 is "refused with the unfinished
   * reason and its counts, **not** an error count", so no cell there has an error count to
   * assert and inventing one would invite a reader to assert the wrong criterion.
   */
  expectedErrors?: number;
}

/**
 * A bundle that is UNFINISHED: `dropped` of its nodes have no card file.
 *
 * The mutation is removal only. Nothing else about the bundle changes, so every error the
 * engine reports is the shadow of a card that is not written yet — which is what the
 * unfinished reading means, and what makes `placed` and `total` derivable from the
 * construction: the source bundle resolves, therefore every one of its nodes was carded,
 * therefore removing `dropped` card files leaves exactly `total - dropped` carded.
 */
export function unfinishedVariant(base: Corpus, dropped = 2): Variant {
  const files = Object.keys(base.cardFiles).sort();
  if (files.length <= dropped) {
    throw new Error(
      `unfinishedVariant needs more than ${dropped} card files; ${base.slug} has ${files.length}.`,
    );
  }
  const cardFiles = { ...base.cardFiles };
  for (const file of files.slice(0, dropped)) delete cardFiles[file];

  const variant: Variant = {
    ...base,
    cardFiles,
    placed: base.nodeIds.length - dropped,
    total: base.nodeIds.length,
  };

  assertProgress(variant, "unfinished", `unfinishedVariant(${base.slug}, ${dropped})`);
  return variant;
}

/**
 * A bundle that is IN ERROR: every card is present and one node pins a digest its card does
 * not hash to.
 *
 * **Every node keeps its card, and that is the load-bearing property rather than a detail.**
 * `bundleProgress` can only return `unfinished` when a node resolves to no card, so a variant
 * whose `placed` equals its `total` is structurally incapable of being read as unfinished —
 * which is what stops AC2 from degenerating into a second, weaker copy of AC1. A refusal here
 * can only be `in-error`.
 *
 * **Why not a port mismatch, which this fixture used until 2026-08-30.** It was the right
 * choice under the old gate and D-109 retired it. A port that does not exist is DarkPrint
 * comparing two things the author wrote, `lib/core/gate.ts` classifies it `approval`, and rule
 * 4 forbids an inference from refusing anybody's work — so that mutation now publishes
 * successfully, with the mismatch printed on the scorecard, and this fixture stopped producing
 * a refusal at all. The old docblock's own sentence is what dates it: "a port mismatch is the
 * one mutation that is purely a contradiction between two things the author wrote." That is
 * exactly the class the ruling stopped refusing.
 *
 * **Why a pinned digest.** `bundle/digest-mismatch` is `unaddressable`: a node pinning a hash
 * the card does not have leaves the reference undecidable, which is a fact about the bytes
 * rather than a reading of the work, so it refuses at both stages. It is also generic over any
 * corpus, needing only one node statement to attach to, where the other author-declared
 * refusal (`bundle/prohibition-violated`) needs a blueprint whose cards happen to declare a
 * `cannot:` the graph can be made to break.
 *
 * **Three other mutations were measured and rejected, and the reason is worth keeping.**
 * Contradicting a card's declared `id`, contradicting its `version`, and pointing an edge at an
 * undeclared node all report `bundle/missing-card` and read as UNFINISHED — the resolver treats
 * a pin it cannot satisfy as a card not written yet, whatever made it unsatisfiable. Unparseable
 * card YAML does reach `rejected`, but it does so carrying a `bundle/missing-card` alongside two
 * `card/parse-error`s, so its error count mixes the two readings.
 */
export function inErrorVariant(base: Corpus): Variant {
  const [first] = base.nodeIds;
  if (first === undefined) {
    throw new Error(`inErrorVariant: ${base.slug} declares no nodes.`);
  }
  /* A hash no card can have, attached to the first node's own statement so the rest of the
     bundle is untouched and the only difference from a bundle that resolves is this attribute.
     Anchored on the `[` that opens that node's attribute block: appending a second statement
     for the same id would raise `dot/duplicate-node` as well and mix two readings into the
     count, which is the defect the rejected mutations above all share. */
  const unreachableDigest = `sha256:${"0".repeat(64)}`;
  const nodeStatement = new RegExp(`(^|\\n)(\\s*)${first}(\\s*)\\[`, "u");
  if (!nodeStatement.test(base.dot)) {
    throw new Error(
      `inErrorVariant: ${base.slug}'s DOT has no attribute block on node \`${first}\` to pin a digest in.`,
    );
  }
  const dot = base.dot.replace(nodeStatement, `$1$2${first}$3[digest="${unreachableDigest}", `);

  const variant: Variant = {
    ...base,
    dot,
    placed: base.nodeIds.length,
    total: base.nodeIds.length,
    /* One node, one pin, one card it does not match: a single `bundle/digest-mismatch`. */
    expectedErrors: 1,
  };

  assertProgress(variant, "rejected", `inErrorVariant(${base.slug})`);
  return variant;
}

/**
 * The fixture's own premise: this variant really is the shape its name claims.
 *
 * A check on the corpus, not an oracle for `publish`. See this file's header.
 */
function assertProgress(variant: Variant, expected: string, made: string): void {
  const result = validate(variant);
  const progress = bundleProgress(result);
  if (progress.state !== expected) {
    throw new Error(
      `${made} was built to be \`${expected}\` and the engine reads it as \`${progress.state}\` ` +
        `(${progress.placed} of ${progress.total} carded).\n` +
        `  This is a broken FIXTURE, not a T100 defect: the cells that consume it would be ` +
        `asserting the wrong criterion's counts.`,
    );
  }
  if (progress.placed !== variant.placed || progress.total !== variant.total) {
    throw new Error(
      `${made} derived ${variant.placed} of ${variant.total} from the construction and the ` +
        `engine reports ${progress.placed} of ${progress.total}. One of the two is wrong and ` +
        `the cells must not be left to choose between them.`,
    );
  }
  if (variant.expectedErrors !== undefined) {
    const errors = result.diagnostics.filter((d) => d.severity === "error").length;
    if (errors !== variant.expectedErrors) {
      throw new Error(
        `${made} was built to produce ${variant.expectedErrors} error diagnostics and the engine ` +
          `reports ${errors}.\n` +
          `  The cells assert the construction's number, so this divergence would leave AC2 ` +
          `asserting a count nothing in the tree agrees with.`,
      );
    }
  }
}

/** `validateBundle` over a corpus, with the archive's own vocabulary left at the default core. */
export function validate(corpus: Corpus): LoadBundleResult {
  return validateBundle({
    manifest: corpus.manifest,
    dot: corpus.dot,
    cardFiles: corpus.cardFiles,
  });
}

/** How many diagnostics of `error` severity the engine reports over this corpus. */
export function errorCount(corpus: Corpus): number {
  return validate(corpus).diagnostics.filter((d) => d.severity === "error").length;
}

/* --------------------- the digest, computed a second way --------------------- */

/**
 * `bundleDigest` over a corpus, with `cardDigests` taken **one entry per DOT node**.
 *
 * **D-100-01 names this the one line of AC3 that is easy to get wrong.** `cardDigests` is
 * `blueprint.nodes.map(n => n.digest)` — per NODE, so a card two nodes pin appears twice, and a
 * card sitting in the folder that no node pins does not appear at all. `bundleDigest` sorts its
 * input but does NOT dedupe, so a deduplicated card set hashes to a different value while the
 * release it produces still looks perfectly well formed. `Corpus.cardRefs` is the same per-node
 * array, built the same way, for the same reason.
 *
 * **What a green against this establishes, precisely.** `bundleDigest` is
 * `lib/core/hash/digest.ts:61` and an implementation of `publish` will call the same function,
 * so agreement here is a CONSISTENCY CHECK: it shows the stored digest was taken over the
 * submitted bytes with the right multiset of card digests, and it does NOT independently
 * establish that the digest is right. The independent half of AC3 lives in `identity.test.ts`
 * as sensitivity and key-order independence — properties no amount of agreeing with
 * `bundleDigest` can satisfy.
 *
 * Cross-checked against `blueprint.digest`, which `lib/core` computes by its own route. A
 * divergence means this helper's reading of "one per node" has drifted from the resolver's, and
 * it throws rather than handing the cells a number only this file believes.
 */
export function digestOf(corpus: Corpus): string {
  const blueprint = validate(corpus).blueprint;
  if (blueprint === undefined) {
    throw new Error(`digestOf: ${corpus.slug} does not resolve, so it has no digest.`);
  }
  const cardDigests = blueprint.nodes.map((node) => node.digest);
  const digest = bundleDigest({ dot: corpus.dot, cardDigests });

  if (digest !== blueprint.digest) {
    throw new Error(
      `digestOf(${corpus.slug}) computed ${digest} and the resolver reports ${blueprint.digest}.\n` +
        `  The two disagree about what goes into a bundle digest, and the cells must not be ` +
        `left to choose between them.`,
    );
  }
  return digest;
}


/* --------------------- what the writer left behind --------------------- */

/**
 * Every row in every user table of this scratch database, as `table -> JSON of its rows`.
 *
 * The instrument the refusal cells are built on, and the reason they are worth writing. A
 * mutation that inserts a row and *then* throws satisfies every `rejects.toThrow()` a reviewer
 * would write, and leaves the row that breaks a reader forever. Snapshot, attempt, snapshot,
 * diff: a refusal that left anything behind is visible as a non-empty delta regardless of which
 * table it chose, and nothing here names a table, so a schema this suite does not own cannot
 * make the instrument wrong.
 *
 * Ordered by the text of the row so two snapshots compare stably.
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

/** Total rows added across every table — the number a refusal must leave at zero. */
export function totalRowsAdded(added: Map<string, string[]>): number {
  let total = 0;
  for (const rows of added.values()) total += rows.length;
  return total;
}

/** `table: n, table: n` for a failure message that says WHERE the leak is, not just that it leaked. */
export function describeAdded(added: Map<string, string[]>): string {
  return [...added.entries()].map(([table, rows]) => `${table}: ${rows.length}`).join(", ");
}

/* --------------------- C1: two nodes pinning one card --------------------- */

export interface DuplicatePin extends Corpus {
  /** The digest with the duplicate kept — one entry per NODE, which is the contract's rule. */
  withDuplicate: string;
  /** What a dedupe would produce instead. Measured, and different. */
  deduplicated: string;
}

/**
 * A bundle in which two DOT nodes pin the SAME card ref.
 *
 * **This is the shape that makes C1's identity falsifiable.** D-100-03 traced the digest across
 * three sites — `validateBundle` passes `dot` through unchanged, `resolve.ts:749` computes
 * `bundleDigest({ dot, cardDigests: nodes.map(n => n.digest) })`, and `addRelease` computes
 * `bundleDigest({ dot: input.dot, cardDigests: [...input.cardDigests] })` with no sort and no
 * dedupe of its own, while `bundleDigest` sorts its own copy on both paths. Same dot, same
 * multiset, therefore same digest: a textual identity holding across three files.
 *
 * A textual identity is exactly the kind that breaks silently. Add a `new Set(...)` at any one
 * of the three sites and every bundle whose nodes pin distinct cards keeps hashing identically
 * — which is every bundle in `content/`, so nothing in the archive would notice. Only a bundle
 * with a repeated pin separates the two, and the measured gap is
 * `sha256:1dfa2f23…` against `sha256:34e457a7…`.
 *
 * The added node is isolated: no edges, so no ports to mismatch, and the bundle still resolves
 * with every node carded and zero errors.
 */
export function duplicatePinCorpus(base: Corpus): DuplicatePin {
  const ref = base.cardRefs[0];
  if (ref === undefined) throw new Error(`duplicatePinCorpus: ${base.slug} pins no cards.`);

  const dot = base.dot.replace(/\n\}\s*$/u, `\n  twin [card="${ref}"];\n}\n`);
  if (dot === base.dot) {
    throw new Error(`duplicatePinCorpus: ${base.slug}'s DOT has no closing brace to append before.`);
  }

  const blueprint = validate({ ...base, dot }).blueprint;
  if (blueprint === undefined) {
    throw new Error(`duplicatePinCorpus(${base.slug}) does not resolve with the twin node.`);
  }

  const digests = blueprint.nodes.map((node) => node.digest);
  const unique = [...new Set(digests)];
  if (digests.length === unique.length) {
    throw new Error(
      `duplicatePinCorpus(${base.slug}) produced ${digests.length} distinct card digests, so ` +
        `no node pins a card another node also pins. The cell would then pass under a dedupe ` +
        `and prove nothing.`,
    );
  }

  const withDuplicate = bundleDigest({ dot, cardDigests: digests });
  const deduplicated = bundleDigest({ dot, cardDigests: unique });
  if (withDuplicate === deduplicated) {
    throw new Error(
      `duplicatePinCorpus(${base.slug}): keeping and dropping the duplicate hash to the same ` +
        `value, so this corpus cannot detect a dedupe.`,
    );
  }

  return {
    ...base,
    dot,
    cardRefs: blueprint.nodes.map((node) => node.ref),
    withDuplicate,
    deduplicated,
  };
}

/* --------------------- a second release of the same bundle --------------------- */

/**
 * The same bundle, revised: still resolving, same cards, different bytes and so a different
 * digest.
 *
 * The mutation is a DOT comment, which is the smallest change that moves the digest without
 * touching anything the resolver reads — measured at
 * `sha256:9454…e39af` → `sha256:fe3e…2f21` while both sides report five of five carded and zero
 * errors. What it is FOR is the half of `created` that a single publish cannot show: appending
 * a release to a bundle that already exists must come back `created: false`, and a revision
 * that still resolves is the only way to reach that path without tripping AC6's conflict.
 */
export function revisionOf(base: Corpus): Corpus {
  const dot = base.dot.replace(/\n\}\s*$/u, "\n  // revised\n}\n");
  if (dot === base.dot) {
    throw new Error(`revisionOf: ${base.slug}'s DOT has no closing brace to append before.`);
  }
  const revised: Corpus = { ...base, dot };

  const progress = bundleProgress(validate(revised));
  if (progress.state !== "resolves") {
    throw new Error(
      `revisionOf(${base.slug}) must still resolve and the engine reads it as ` +
        `\`${progress.state}\`. A revision that does not resolve cannot reach the append path.`,
    );
  }
  if (digestOf(revised) === digestOf(base)) {
    throw new Error(
      `revisionOf(${base.slug}) produced the same digest as the original, so it cannot ` +
        `distinguish an appended release from a republished one — AC6 would swallow it.`,
    );
  }
  return revised;
}

/* --------------------- AC5: a chain check that fails on the SECOND card --------------------- */

export interface ChainFailure {
  /** The submission: still resolves, so nothing but the chain check can refuse it. */
  corpus: Corpus;
  /** The card that must already be in the store for there to be a chain to fail. */
  previous: { ref: string; id: string; version: string; source: string };
  /** What the submission declares for that card — a patch bump where a major is required. */
  declared: { ref: string; id: string; version: string; source: string };
  /**
   * The FIRST card in DOT order, which is new to the store and which a step-by-step
   * implementation stores before it ever reaches the failing one. Its absence after the
   * refusal is the whole criterion.
   */
  firstCard: { ref: string; id: string; version: string };
}

/**
 * A submission whose SECOND card fails its chain check while the bundle itself resolves.
 *
 * **AC5 is "the criterion that makes this a transaction and not a sequence"**, and this fixture
 * is built so that nothing else can account for the refusal. The mutation re-types the second
 * card, which `inferBump` rates MAJOR ("node type changed") while the submission declares a
 * PATCH — and which touches no port, so `validateBundle` still reports the bundle as resolving
 * with every node carded and zero error diagnostics. An implementation that refuses this
 * submission can only have refused it at the chain check.
 *
 * The mutation used to be `requires_human: false → true`, priced major because it invalidated
 * every autonomy score computed against the card. That field was withdrawn from the schema and
 * a document still carrying it is ignored, so the mutation would have changed nothing at all
 * and this fixture's own premise check would have caught it. `type` is the successor for a
 * reason rather than for convenience: whether a person acts at the node is read off `type` now,
 * so re-typing a card is the change that moves both the wiring and the score, and it is the
 * strictest thing `inferBump` prices.
 *
 * The first card in DOT order is deliberately left out of the store. A step-by-step
 * implementation walks the cards in order, stores that one, then hits the second and throws —
 * passing "is refused" and leaving a card behind. Asserting its absence is what separates the
 * transaction from the sequence.
 */
export function chainFailureVariant(base: Corpus): ChainFailure {
  const previousRef = base.cardRefs[1];
  const firstRef = base.cardRefs[0];
  if (previousRef === undefined || firstRef === undefined) {
    throw new Error(`chainFailureVariant: ${base.slug} pins fewer than two cards.`);
  }
  const previous = splitRef(previousRef);
  const first = splitRef(firstRef);

  const previousFile = `cards/${previous.id}@${previous.version}.yaml`;
  const previousSource = base.cardFiles[previousFile];
  if (previousSource === undefined) {
    throw new Error(`chainFailureVariant: ${base.slug} has no ${previousFile}.`);
  }

  /* A patch bump on the published version, carrying a change that requires a major one.

     The replacement type is chosen against what the card already declares, so the mutation
     cannot silently become a no-op on a corpus whose second card happens to be typed the way
     this fixture would otherwise have re-typed it. Both candidates are real `node-type` terms
     the core vocabulary carries, so the mutated card still loads. */
  const declaredVersion = patchOf(previous.version);
  const declaredType = /^type:\s*human-gate\s*$/mu.test(previousSource)
    ? "human-input"
    : "human-gate";
  const declaredSource = previousSource
    .replace(/^version:\s*\S+\s*$/mu, `version: ${declaredVersion}`)
    .replace(/^type:\s*\S+\s*$/mu, `type: ${declaredType}`);
  if (declaredSource === previousSource) {
    throw new Error(
      `chainFailureVariant: neither \`version\` nor \`type\` is a top-level key in ` +
        `${previousFile}, so the mutation this fixture depends on did not apply.`,
    );
  }

  const declaredFile = `cards/${previous.id}@${declaredVersion}.yaml`;
  const cardFiles = { ...base.cardFiles };
  delete cardFiles[previousFile];
  cardFiles[declaredFile] = declaredSource;

  const declaredRef = `${previous.id}@${declaredVersion}`;
  const dot = base.dot.replace(`card="${previousRef}"`, `card="${declaredRef}"`);
  if (dot === base.dot) {
    throw new Error(`chainFailureVariant: no \`card="${previousRef}"\` in ${base.slug}'s DOT.`);
  }

  const corpus: Corpus = {
    ...base,
    dot,
    cardFiles,
    cardRefs: base.cardRefs.map((ref) => (ref === previousRef ? declaredRef : ref)),
  };

  /* The premise: this submission is refusable ONLY at the chain check. If the mutation ever
     starts breaking resolution too, the cell would pass for the wrong reason — a refusal that
     was really AC2's — and stop discriminating between a transaction and a sequence. */
  const result = validate(corpus);
  const progress = bundleProgress(result);
  if (progress.state !== "resolves") {
    throw new Error(
      `chainFailureVariant(${base.slug}) must still RESOLVE so that only the chain check can ` +
        `refuse it, and the engine reads it as \`${progress.state}\` ` +
        `(${progress.placed} of ${progress.total} carded, ` +
        `${result.diagnostics.filter((d) => d.severity === "error").length} errors).\n` +
        `  This is a broken FIXTURE: AC5 would be satisfied by an in-error refusal that proves ` +
        `nothing about the transaction.`,
    );
  }

  return {
    corpus,
    previous: { ref: previousRef, ...previous, source: previousSource },
    declared: {
      ref: declaredRef,
      id: previous.id,
      version: declaredVersion,
      source: declaredSource,
    },
    firstCard: { ref: firstRef, ...first },
  };
}

function splitRef(ref: string): { id: string; version: string } {
  const parsed = parseCardRef(ref);
  if (parsed === undefined) throw new Error(`\`${ref}\` is not a card ref.`);
  return { id: parsed.id, version: parsed.version };
}

function patchOf(version: string): string {
  const parts = version.split(".");
  const patch = Number(parts[2] ?? "0");
  return `${parts[0]}.${parts[1]}.${patch + 1}`;
}

/** Puts a card in the store, so a chain exists for the submission to fail against. */
export async function seedCard(
  scratch: Scratch,
  owner: Owner,
  card: { id: string; version: string; source: string },
): Promise<void> {
  const parsed = validateCardSource(card.source);
  if (parsed.card === undefined) {
    throw new Error(
      `seedCard(${card.id}@${card.version}): the source does not parse — ` +
        `${parsed.diagnostics.map((d) => d.code).join(", ")}.`,
    );
  }
  await addCard(scratch.db, {
    cardId: card.id,
    version: card.version,
    ownerId: owner.accountId,
    body: parsed.card,
    source: card.source,
  });
}

/**
 * Whether the store holds this card version, asked through T020's published reader.
 *
 * `getCard` rather than a `select` against `card_version`: `lib/db/schema.ts` is not this
 * task's to name, and a suite that hard-codes a table is one a later migration can silently
 * turn green. The owner's own actor is passed so a private card is still visible — the
 * question here is whether the row EXISTS, not whether a visitor may read it, and answering it
 * through a policy filter would let a visibility default masquerade as a missing row.
 */
export async function cardExists(
  scratch: Scratch,
  owner: Owner,
  ref: { id: string; version: string },
): Promise<boolean> {
  return (await getCard(scratch.db, owner.actor, ref.id, ref.version)) !== undefined;
}

/* --------------------- setup that reds rather than skips --------------------- */

/**
 * A `beforeAll` result that fails IN THE CELLS.
 *
 * **A throw in `beforeAll` produces SKIPS, not reds** — the run stands down instead of failing,
 * and this run measured the difference: under one broken writer, 127 merged cells went silent
 * while thirteen cells in a suite that recorded its setup failure and re-raised it per cell went
 * red. Same defect, same hook, opposite visibility. A skipped criterion reads as "not applicable"
 * to a reviewer and as a passing gate to anyone reading the totals.
 *
 * So the hook records rather than throws, and every cell calls `require()` first. A scratch
 * database that cannot be created then costs one red per acceptance criterion, which is what the
 * hand-off protocol asks for.
 */
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
        `${this.what} could not be set up, so this criterion was never exercised.\n` +
          `  Re-raised per cell on purpose: a throw in \`beforeAll\` skips, and a skipped ` +
          `criterion is invisible in the totals.\n` +
          `  Cause: ${this.failure instanceof Error ? this.failure.stack : String(this.failure)}`,
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
