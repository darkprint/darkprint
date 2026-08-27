/* ============================================================
   T110 — fixtures: an upstream that really was published, a
   forker, and a database of this file's own

   Not a test file.

   ── why the seeding imports are static ──
   `@/lib/server/archive` (T010), `@/lib/server/cards` (T020),
   `@/lib/server/ontology` (T030), `@/lib/server/engine` (T040),
   `@/lib/server/policy` (T060), `@/lib/server/publish` (T100) and
   `@/lib/core` are all merged on `backend` and ship in this
   worktree, so importing them is a real import rather than a
   compile-time dependency on something unmerged. They are how the
   upstream gets into the database and how a premise is checked; the
   module under test is loaded dynamically in `contract.ts` and only
   there.

   ── why this file does not import `tests/server/t100/fixtures.ts` ──
   Half of what is below exists there in some form, and reusing it
   would couple T110's cells to another task's suite: its scratch
   databases are named `darkprint_t100_*`, its corpus choice is
   tuned to T100's counts, and a change made for a T100 criterion
   would silently move a T110 assertion. The duplication is
   deliberate and bounded.

   ── isolation ──
   Each test file creates, migrates, drives and drops
   `darkprint_t110_<file>_<pid>`, and checks the premise with
   `select current_database()` rather than trusting it: a client
   that ignored its connection string would leave the suite on the
   shared `darkprint` with every assertion still passing, which is
   D-08 reproduced with the fix in place. One name per file per
   process, so two files in parallel workers cannot see each other.

   **What a killed run leaves behind, stated accurately.** An earlier
   version of this comment claimed "a run that dies before teardown
   leaves a database the next run of the same file drops on sight".
   That is FALSE across processes and it was measured: two runs of
   this suite were killed mid-sweep and left
   `darkprint_t110_drift_74927` and `darkprint_t110_drift_75773`,
   which no later run reclaims — the next run has a different pid and
   drops a different name. The `drop database if exists` at the top of
   `scratchDatabase` only protects against a collision with the SAME
   pid, which is a re-run inside one process.

   Nothing here sweeps by prefix, and that is deliberate rather than
   an omission: a sweep of `darkprint_t110_%` would drop a database
   belonging to a concurrently running worker of this same suite.
   A killed run therefore leaks, visibly, under a name that says whose
   it is — which is the trade this file takes over a sweep that can
   delete live state.

   ── the upstream is PUBLISHED, not hand-assembled ──
   Every upstream below goes in through T100's `publish`, over a
   bundle taken from `content/` that the build already accepted. So
   "a public bundle somebody else owns" is a bundle the merged
   publishing path really produced — cards stored, release written,
   digest computed by the engine — rather than this author's guess
   at the rows a fork has to read. The one exception is
   `plantUnresolvableCopy`, which has to write a release `publish`
   would refuse, and says so at its own docstring.

   **What the premise checks establish and do not.** Each corpus
   variant asserts through `validateBundle`/`bundleProgress` that it
   is the shape its name claims. That is a check on the FIXTURE, not
   an oracle for the module under test: every version string a cell
   asserts is derived from the construction here (the bump this file
   applied), never read back out of the module or out of the row the
   module wrote.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { CORE_ONTOLOGY, parseCardRef } from "@/lib/core";
import type { BundleManifest, LoadBundleResult } from "@/lib/core";
import { createDbClient, migrateUp, type Db, type DbClient } from "@/lib/db";
import { addOntologyVersion } from "@/lib/server/ontology";
import { validateBundle } from "@/lib/server/engine";
import { createBundle, addRelease, listReleases } from "@/lib/server/archive";
import type { BundleRecord, ReleaseRecord } from "@/lib/server/archive";
import { publish } from "@/lib/server/publish";
import type { Actor } from "@/lib/server/policy";
import { readContent, type LoadedBundle } from "@/lib/content/read";
import { bundleProgress } from "@/components/upload/progress";

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
  /** The published `Db` — the first parameter of all three T110 verbs. */
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
  const name = `darkprint_t110_${tag}_${process.pid}`;

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

  /* The ontology version has to be a row before any publish can run (D-100-05 A2). `publish`
     opens an `OntologyView` for `manifest.ontologyVersion`, and an unpublished version raises
     T030's `UnknownOntologyVersionError` — a foreign rejection that reaches the caller unaltered
     and does not even look like a T110 failure. Every scratch database in this suite publishes
     an upstream, so this belongs here rather than per file. */
  await addOntologyVersion(client.db, {
    version: CORE_ONTOLOGY.version,
    terms: [...CORE_ONTOLOGY.terms],
  });

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

/* --------------------- accounts --------------------- */

export interface Account {
  accountId: string;
  handle: string;
  defaultVisibility: "public" | "private";
  actor: Actor;
}

/**
 * An account row with a chosen handle, and the `Actor` that account presents as.
 *
 * Written with SQL rather than through `upsertFromGitHub` because what is wanted is a row with a
 * chosen handle, not a GitHub sign-in flow — T080's and T100's own suites seed the same way.
 * `github_id` is unique, so it carries a UUID.
 *
 * The handle is kept to lowercase letters, digits and hyphens and under 32 characters:
 * `resolveOwner` runs `validateNamespace` before it will answer at all, and T071 is about to make
 * 32 the product bound. A handle this file invented that the grammar refuses would make every
 * `forkBundle` in the suite answer `no such bundle` for a reason that has nothing to do with AC6.
 */
export async function seedAccount(
  scratch: Scratch,
  handle: string,
  defaultVisibility: "public" | "private" = "public",
): Promise<Account> {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/u.test(handle)) {
    throw new Error(
      `seedAccount(${handle}): this suite's own handles must be lowercase alphanumeric with ` +
        `hyphens and at most 32 characters, or \`resolveOwner\` refuses them before any T110 ` +
        `code runs and every cell reports AC6's refusal for the wrong reason.`,
    );
  }
  const rows = await scratch.pool.query<{ id: string }>(
    "insert into account (github_id, github_login, handle, default_visibility) " +
      "values ($1, $2, $3, $4) returning id",
    [randomUUID(), handle, handle, defaultVisibility],
  );
  const accountId = rows.rows[0]?.id;
  if (accountId === undefined) throw new Error(`seedAccount(${handle}) inserted no row.`);
  return { accountId, handle, defaultVisibility, actor: { kind: "account", accountId, handle } };
}

/** A break-glass operator (B-13), for the agreement cells that need `can`'s other grant. */
export function operatorActor(accountId: string): Actor {
  return { kind: "operator", accountId };
}

export const ANONYMOUS: Actor = { kind: "anonymous" };

/* --------------------- the corpus --------------------- */

export interface Corpus {
  /** The archive slug this corpus came from. Never the slug it is published under. */
  sourceSlug: string;
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
  return {
    sourceSlug: loaded.slug,
    manifest: loaded.bundle.manifest,
    dot: loaded.bundle.dot,
    cardFiles,
    nodeIds: loaded.blueprint.graph.ids.map((id) => id),
    cardRefs: loaded.blueprint.nodes.map((node) => node.ref),
  };
}

/**
 * The smallest bundle in `content/` that resolves, chosen by node count so the fixtures stay
 * legible and a publish stays fast.
 *
 * Chosen by measurement rather than named as a literal: a bundle renamed or removed from the
 * archive would otherwise turn into a missing-fixture failure that reads like a T110 defect.
 */
export function resolvingCorpus(): Corpus {
  const bundles = readContent();
  if (bundles.length === 0) {
    throw new Error(
      "readContent() returned no bundles. The corpus for every T110 cell comes from `content/`, " +
        "so this is a broken checkout rather than a T110 defect.",
    );
  }
  const smallest = [...bundles].sort(
    (a, b) => a.blueprint.graph.ids.length - b.blueprint.graph.ids.length,
  )[0];
  const corpus = corpusFrom(smallest as LoadedBundle);

  /* The join between the corpus and the seed. `scratchDatabase` publishes
     `CORE_ONTOLOGY.version` and `publish` opens a view for whatever the MANIFEST names, so if the
     archive ever declares a different one every cell in this suite would fail at `openView` with
     an error that has nothing to do with its criterion. Checked here, once. */
  if (corpus.manifest.ontologyVersion !== CORE_ONTOLOGY.version) {
    throw new Error(
      `${corpus.sourceSlug}'s manifest declares ontologyVersion ` +
        `\`${corpus.manifest.ontologyVersion}\` and scratchDatabase seeds ` +
        `\`${CORE_ONTOLOGY.version}\`.\n` +
        `  Every publish would then raise T030's UnknownOntologyVersionError, which is a foreign ` +
        `rejection and reads as anything but a broken fixture.`,
    );
  }
  return corpus;
}

/** `validateBundle` over a corpus, with the archive's own vocabulary left at the shipped core. */
export function validate(corpus: Corpus): LoadBundleResult {
  return validateBundle({ manifest: corpus.manifest, dot: corpus.dot, cardFiles: corpus.cardFiles });
}

/** The fixture's own premise: this corpus resolves, so only the criterion can refuse it. */
function assertResolves(corpus: Corpus, made: string): void {
  const result = validate(corpus);
  const progress = bundleProgress(result);
  if (progress.state !== "resolves") {
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    throw new Error(
      `${made} must RESOLVE and the engine reads it as \`${progress.state}\` ` +
        `(${progress.placed} of ${progress.total} carded, ${errors.length} errors: ` +
        `${errors.map((d) => d.code).join(", ")}).\n` +
        `  This is a broken FIXTURE, not a T110 defect: \`publish\` would refuse it and the cell ` +
        `would report a T100 refusal in place of its own criterion.`,
    );
  }
}

/* --------------------- the upstream, really published --------------------- */

export interface Published {
  bundleId: string;
  releaseId: string;
  digest: string;
  /** The slug it was published under — this suite's own, never the archive's. */
  slug: string;
  version: string;
  owner: Account;
  corpus: Corpus;
}

/**
 * A bundle published through T100, which is what makes it a real upstream rather than a set of
 * rows this file guessed at.
 *
 * The three-argument call, so `publish` builds its own storage handle lazily from `S3_*` exactly
 * as a route would (`publish.ts:120-127`). That does write objects into the MinIO bucket and
 * leave them there; the same is true of every merged suite that publishes, and taking them back
 * would need T090's reader, which is not this task's.
 */
export async function publishBundle(
  scratch: Scratch,
  owner: Account,
  corpus: Corpus,
  slug: string,
  version: string,
  visibility: "public" | "private",
): Promise<Published> {
  assertResolves(corpus, `publishBundle(${slug}@${version})`);
  const result = await publish(scratch.db, owner.actor, {
    ownerHandle: owner.handle,
    slug,
    version,
    manifest: corpus.manifest,
    dot: corpus.dot,
    cardFiles: corpus.cardFiles,
    visibility,
  });
  return {
    bundleId: result.bundleId,
    releaseId: result.releaseId,
    digest: result.digest,
    slug,
    version,
    owner,
    corpus,
  };
}

/* --------------------- AC4: the upstream repins one card --------------------- */

export interface Repinned {
  /** The corpus the upstream's SECOND release carries. */
  corpus: Corpus;
  /** The bare card id that moved — `Repin.card` under the dispatch's Q3 ruling. */
  card: string;
  /** What the copy taken at the first release still pins — `Repin.from` under F4. */
  from: string;
  /** What the upstream pins after the second release — `Repin.to` under F4. */
  to: string;
  /** Every other card, unchanged, so a cell can assert exactly one repin and not "at least one". */
  unchanged: readonly string[];
}

/**
 * The same bundle with ONE card patch-bumped: a wording edit and a patch version.
 *
 * **Why a `name` edit and a patch bump specifically.** `inferBump` rates wording — "`name`,
 * `action`, `notes`, a port description" — as PATCH (`lib/core/version/bump.ts:299`), and
 * `checkVersionChain` refuses a declared bump smaller than the inferred one. A larger edit would
 * be refused by T020's chain check inside `publish`, and the cell would then report a
 * `CardStoreError` where AC4 expects a second release. `name` is also outside `NOT_CONTENT`
 * (`bump.ts:37` — `version`, `author`, `provenance`), so the edit is a real content change rather
 * than one `contentSignature` discards, which is what keeps the two card versions distinguishable
 * at all.
 *
 * **Exactly one card moves, and that is load-bearing.** AC4 says drift "names both versions", and
 * a cell asserting `repins.length === 1` can only be written over a fixture where one moved. The
 * unchanged refs are carried out so the cell can assert they are ABSENT from `repins` — a drift
 * that lists every pinned card, moved or not, satisfies "names both versions" for the one that
 * did and is still wrong.
 */
export function repinOneCard(base: Corpus): Repinned {
  const ref = base.cardRefs[0];
  if (ref === undefined) throw new Error(`repinOneCard: ${base.sourceSlug} pins no cards.`);
  const parsed = parseCardRef(ref);
  if (parsed === undefined) throw new Error(`repinOneCard: \`${ref}\` is not a card ref.`);
  const { id, version } = parsed;

  const file = `cards/${id}@${version}.yaml`;
  const source = base.cardFiles[file];
  if (source === undefined) {
    throw new Error(`repinOneCard: ${base.sourceSlug} has no ${file}.`);
  }

  const to = patchOf(version);
  const bumped = source
    .replace(/^name:[^\n]*$/mu, (line) => `${line} (repinned by the upstream)`)
    .replace(/^version:\s*\S+\s*$/mu, `version: ${to}`);
  if (bumped === source || !bumped.includes(`version: ${to}`)) {
    throw new Error(
      `repinOneCard: neither \`name\` nor \`version\` is a single-line top-level key in ${file}, ` +
        `so the mutation this fixture depends on did not apply.`,
    );
  }

  const cardFiles = { ...base.cardFiles };
  delete cardFiles[file];
  cardFiles[`cards/${id}@${to}.yaml`] = bumped;

  const newRef = `${id}@${to}`;
  const dot = base.dot.replaceAll(`card="${ref}"`, `card="${newRef}"`);
  if (dot === base.dot) {
    throw new Error(`repinOneCard: no \`card="${ref}"\` in ${base.sourceSlug}'s DOT.`);
  }

  const corpus: Corpus = {
    ...base,
    dot,
    cardFiles,
    cardRefs: base.cardRefs.map((r) => (r === ref ? newRef : r)),
  };
  assertResolves(corpus, `repinOneCard(${base.sourceSlug}, ${id})`);

  /* The premise the cell's `repins.length === 1` rests on, derived from the construction and
     checked against the corpus rather than assumed: every other pinned ref is byte-identical
     across the two releases. */
  const unchanged = base.cardRefs.filter((r) => r !== ref);
  const moved = corpus.cardRefs.filter((r, i) => r !== base.cardRefs[i]);
  if (moved.length !== 1 || moved[0] !== newRef) {
    throw new Error(
      `repinOneCard(${base.sourceSlug}) moved ${moved.length} pins (${moved.join(", ")}); the ` +
        `cells assert exactly one, so a fixture that moved several would let a drift naming ` +
        `all of them pass.`,
    );
  }

  return { corpus, card: id, from: version, to, unchanged };
}

function patchOf(version: string): string {
  const parts = version.split(".");
  const patch = Number(parts[2] ?? "0");
  return `${parts[0]}.${parts[1]}.${patch + 1}`;
}

/* --------------------- AC5: a copy with a node nothing can resolve --------------------- */

export interface UnresolvableCopy {
  bundle: BundleRecord;
  release: ReleaseRecord;
  /** The ref pinned by the node nothing can resolve. No `card_version` row carries it. */
  ghostRef: string;
}

/**
 * A bundle carrying lineage and a release that pins a card no row holds.
 *
 * **Written with `createBundle`/`addRelease` and not with `publish`, and that is the point.**
 * `publish` cannot produce this state — `validateBundle` refuses a bundle whose pinned card has
 * no source, so T100 would answer `unfinished` and there would be no release at all. AC5 is about
 * a copy that is ALREADY in that state, which in production arrives by other routes: a card
 * withdrawn, a release restored, a fork taken across a store that does not hold every card. The
 * fixture reaches it directly rather than pretending a publish could.
 *
 * The ghost node is added to the DOT as well as to `cardRefs`, so an implementation reading either
 * one finds it. Its digest is a well-formed sha256 that addresses nothing.
 */
export async function plantUnresolvableCopy(
  scratch: Scratch,
  forker: Account,
  slug: string,
  upstream: Published,
  visibility: "public" | "private" = "private",
): Promise<UnresolvableCopy> {
  const ghostId = "t110-ghost-node";
  const ghostRef = `${ghostId}@1.0.0`;
  const ghostDigest = `sha256:${"0".repeat(64)}`;

  const dot = upstream.corpus.dot.replace(
    /\n\}\s*$/u,
    `\n  ghost [card="${ghostRef}"];\n}\n`,
  );
  if (dot === upstream.corpus.dot) {
    throw new Error(
      `plantUnresolvableCopy: ${upstream.corpus.sourceSlug}'s DOT has no closing brace to ` +
        `append the ghost node before.`,
    );
  }

  const blueprint = validate(upstream.corpus).blueprint;
  if (blueprint === undefined) {
    throw new Error(`plantUnresolvableCopy: ${upstream.corpus.sourceSlug} does not resolve.`);
  }

  const bundle = await createBundle(scratch.db, {
    ownerId: forker.accountId,
    slug,
    visibility,
    lineage: {
      ownerId: upstream.owner.accountId,
      slug: upstream.slug,
      version: upstream.version,
    },
  });

  const release = await addRelease(scratch.db, {
    bundleId: bundle.id,
    version: "1.0.0",
    dot,
    manifest: upstream.corpus.manifest,
    cardRefs: [...blueprint.nodes.map((n) => n.ref), ghostRef],
    cardDigests: [...blueprint.nodes.map((n) => n.digest), ghostDigest],
  });

  /* The premise: nothing in the store answers for the ghost. Asked of the table rather than of a
     reader, because what AC5 needs is that the ROW is absent — a reader could answer `undefined`
     for a visibility reason and the fixture would then be testing a policy, not an unresolvable
     node. */
  const held = await scratch.pool.query(
    "select 1 from card_version where card_id = $1 and version = $2",
    [ghostId, "1.0.0"],
  );
  if (held.rowCount !== 0) {
    throw new Error(
      `plantUnresolvableCopy: \`${ghostRef}\` IS in the store, so this copy resolves and the ` +
        `cell would assert \`blocked\` over a bundle with nothing wrong with it.`,
    );
  }

  return { bundle, release, ghostRef };
}

/* --------------------- the AC2 transition --------------------- */

/**
 * Flips an existing bundle's visibility, by raw update.
 *
 * **This is a FIXTURE write and not a criterion, and the distinction is the whole reason it lives
 * here.** No merged published verb makes an existing private bundle public: T100's `publish`
 * computes `existing?.visibility ?? input.visibility ?? owner.defaultVisibility`
 * (`lib/server/publish/publish.ts:147`) and states the rule above it — "Ignored on an append — a
 * release being added is not an occasion to rewrite the bundle row's visibility, and changing it
 * is nobody's here." A cell that called `publish` with `visibility: "public"` and asserted the
 * count went up would red a correct implementation for a decision T100 already made.
 *
 * The raw update is the house pattern for exactly this transition, and both precedents are merged:
 * `lib/server/saves/saves.db.scratch.test.ts:225,240` and
 * `lib/server/export/export.scratch.test.ts:545,553`.
 *
 * What the cell using it exercises is `forksOf`'s FILTER — the read path AC2 is a criterion about
 * — and not a publish path.
 */
export async function setVisibility(
  scratch: Scratch,
  bundleId: string,
  visibility: "public" | "private",
): Promise<void> {
  const updated = await scratch.pool.query(
    "update bundle set visibility = $1 where id = $2",
    [visibility, bundleId],
  );
  if (updated.rowCount !== 1) {
    throw new Error(
      `setVisibility(${bundleId}, ${visibility}) updated ${String(updated.rowCount)} rows; the ` +
        `transition AC2 turns on did not happen and the cell after it would measure nothing.`,
    );
  }
}

/* --------------------- what the writer left behind --------------------- */

/**
 * Every row in every user table of this scratch database, as `table -> JSON of its rows`.
 *
 * The instrument AC3 is built on. A private fork that announces itself writes a row somewhere, and
 * nothing here names a table — so a schema this suite does not own cannot make the instrument
 * wrong, and a notification table T190 has not built yet is caught the day it appears.
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

/** `table: n, table: n` for a failure message that says WHERE a row landed, not just that one did. */
export function describeAdded(added: Map<string, string[]>): string {
  return [...added.entries()].map(([table, rows]) => `${table}: ${rows.length}`).join(", ");
}

/* --------------------- reading the archive back --------------------- */

/** The releases of a bundle, newest-published last, through T010's published reader. */
export async function releasesOf(scratch: Scratch, bundleId: string): Promise<ReleaseRecord[]> {
  return await listReleases(scratch.db, bundleId);
}

/* --------------------- a copy planted without the module under test --------------------- */

/**
 * A resolvable copy of an upstream release, with lineage, written directly.
 *
 * **Why AC4 is measured twice, once over this and once over a real `forkBundle`.** AC4 is a
 * criterion about `driftOf`. A cell that can only reach it through `forkBundle` reports a red for
 * `driftOf` when `forkBundle` is what is broken — and in the blind position, where the whole
 * module may be absent, it reports nothing about `driftOf` at all. This plants the same state by
 * the merged writers, so `driftOf` is measured on its own; the composed cell beside it then
 * measures that `forkBundle` really produces a copy `driftOf` can read.
 *
 * The bytes are the upstream release's, unchanged, which is what "a fork copies the upstream
 * release's bytes" means — so the two paths plant the same pins.
 */
export async function plantCopy(
  scratch: Scratch,
  forker: Account,
  slug: string,
  upstream: Published,
  visibility: "public" | "private" = "private",
): Promise<{ bundle: BundleRecord; release: ReleaseRecord }> {
  const blueprint = validate(upstream.corpus).blueprint;
  if (blueprint === undefined) {
    throw new Error(`plantCopy: ${upstream.corpus.sourceSlug} does not resolve.`);
  }
  const bundle = await createBundle(scratch.db, {
    ownerId: forker.accountId,
    slug,
    visibility,
    lineage: {
      ownerId: upstream.owner.accountId,
      slug: upstream.slug,
      version: upstream.version,
    },
  });
  const release = await addRelease(scratch.db, {
    bundleId: bundle.id,
    version: "1.0.0",
    dot: upstream.corpus.dot,
    manifest: upstream.corpus.manifest,
    cardRefs: blueprint.nodes.map((n) => n.ref),
    cardDigests: blueprint.nodes.map((n) => n.digest),
  });
  return { bundle, release };
}

/**
 * A bundle with NO lineage, for the dispatch's Q4 ruling.
 *
 * Published through T100 rather than planted, because "a bundle that is nobody's copy" is the
 * ordinary case and the ordinary case should arrive by the ordinary route.
 */
export async function bundleWithoutLineage(
  scratch: Scratch,
  owner: Account,
  corpus: Corpus,
  slug: string,
): Promise<Published> {
  const published = await publishBundle(scratch, owner, corpus, slug, "1.0.0", "public");
  const [row] = await scratch.pool.query<{ lineage_owner_id: string | null }>(
    "select lineage_owner_id from bundle where id = $1",
    [published.bundleId],
  ).then((r) => r.rows);
  if (row?.lineage_owner_id !== null) {
    throw new Error(
      `bundleWithoutLineage(${slug}) has lineage_owner_id ` +
        `${JSON.stringify(row?.lineage_owner_id)}; the Q4 cell asserts drift over a bundle with ` +
        `NO upstream and this one has acquired one.`,
    );
  }
  return published;
}

/**
 * The same bundle, revised: still resolving, same cards, different bytes and so a different digest.
 *
 * The mutation is a DOT comment, which is the smallest change that moves the digest without
 * touching anything the resolver reads. What it is FOR: a second upstream release that AC1's
 * discriminating cell can fork PAST. `publish` refuses a second release carrying bytes it already
 * holds (its `conflict` kind), so an unrevised republish could not reach this state at all.
 */
export function revisionOf(base: Corpus, note: string): Corpus {
  const dot = base.dot.replace(/\n\}\s*$/u, `\n  // ${note}\n}\n`);
  if (dot === base.dot) {
    throw new Error(`revisionOf: ${base.sourceSlug}'s DOT has no closing brace to append before.`);
  }
  const revised: Corpus = { ...base, dot };
  assertResolves(revised, `revisionOf(${base.sourceSlug}, ${note})`);
  return revised;
}
