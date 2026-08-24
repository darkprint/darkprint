/* ============================================================
   T120 — fixtures: real accounts, really published bundles, and
   the state a lifecycle operation has to handle

   Not a test file.

   ── why the seeding imports are static ──
   `@/lib/server/archive` (T010), `@/lib/server/cards` (T020),
   `@/lib/server/ontology` (T030), `@/lib/server/naming` (T070),
   `@/lib/server/policy` (T060), `@/lib/server/publish` (T100),
   `@/lib/server/saves` (T140), `@/lib/server/counters` (T150),
   `@/lib/server/ballot` (T160), `@/lib/server/notes` (T170),
   `@/lib/server/runs` (T180), `@/lib/server/limits` (T230) and
   `@/lib/core` are all merged on `backend` at `2992771` and ship
   in this worktree, so importing them is a real import rather
   than a compile-time dependency on something unmerged. They are
   how the state gets into the database. The module under test is
   loaded dynamically in `contract.ts` and only there.

   D-250-09 is what makes that list legitimate: every one of them
   is a separately-authored reader or writer of the state T120's
   criteria quantify over, and the blind rule is about not
   reading `lib/server/lifecycle/**`.

   ── the state goes in through the PRODUCT'S OWN WRITERS ──
   The dispatch is explicit and the reason is D-120-13. Deletion
   is ruled per table over nine tables, and what deletion has to
   handle is what the product actually writes — not this author's
   guess at the rows. A `target_actor` row hand-inserted here
   might carry a `target` row this suite invented; `toggleStar`
   creates the `target` row the way T150 creates it, on the
   conflict key, with the counter column T150 maintains. A
   deletion cell built on the hand-inserted version measures a
   state the product cannot reach.

   Raw SQL survives in exactly two places and both say why at
   their own docstring: the `account` row itself (there is no
   published writer that makes an account with a chosen handle
   without a GitHub sign-in flow), and the CENSUS readers, which
   have to see rows no published reader returns — that is the
   whole point of a census.

   ── isolation ──
   Each test file creates, migrates, drives and drops
   `darkprint_t120_<file>_<pid>`, and checks the premise with
   `select current_database()` rather than trusting it: a client
   that ignored its connection string would leave the suite on
   the shared `darkprint` with every assertion still passing,
   which is D-08 reproduced with the fix in place.

   Nothing here sweeps by prefix. A sweep of `darkprint_t120_%`
   would drop a database belonging to a concurrently running
   worker of this same suite. A killed run therefore leaks,
   visibly, under a name that says whose it is — T110's fixtures
   record the same trade and the same measurement.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { CORE_ONTOLOGY, parseCardRef } from "@/lib/core";
import type { BundleManifest, LoadBundleResult } from "@/lib/core";
import { createDbClient, migrateUp, type Db, type DbClient } from "@/lib/db";
import { readContent, type LoadedBundle } from "@/lib/content/read";
import { bundleProgress } from "@/components/upload/progress";

import { addOntologyVersion } from "@/lib/server/ontology";
import { validateBundle } from "@/lib/server/engine";
import { listReleases } from "@/lib/server/archive";
import { allocateHandle } from "@/lib/server/naming";
import type { Actor } from "@/lib/server/policy";
import { publish } from "@/lib/server/publish";
import { saveTarget } from "@/lib/server/saves";
import { toggleStar } from "@/lib/server/counters";
import { METRICS, castBallot } from "@/lib/server/ballot";
import { postNote } from "@/lib/server/notes";
import { submitReport } from "@/lib/server/runs";
import { issueKey } from "@/lib/server/limits";

/* ============================================================
   the scratch database
   ============================================================ */

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
  /** The published `Db` — the first parameter of all four T120 verbs. */
  db: Db;
  /** For the account rows and the census, which no published reader can answer. */
  pool: Pool;
  client: DbClient;
  name: string;
  /** The connection string, so a route cell can repoint the shared client at this database. */
  url: string;
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
  const name = `darkprint_t120_${tag}_${process.pid}`;

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
        `is handed puts this suite back on the shared database, which the isolation rule forbids.`,
    );
  }

  /* Every publish opens an `OntologyView` for whatever the manifest names, and an
     unpublished version raises T030's `UnknownOntologyVersionError` — a foreign rejection
     that does not even look like a T120 failure. Seeded once, here. */
  await addOntologyVersion(client.db, {
    version: CORE_ONTOLOGY.version,
    terms: [...CORE_ONTOLOGY.terms],
  });

  return {
    db: client.db,
    pool: client.pool,
    client,
    name,
    url,
    async drop() {
      await client.close();
      await withAdmin((admin) => dropDatabase(admin, name));
    },
  };
}

/* ============================================================
   accounts
   ============================================================ */

export interface Account {
  accountId: string;
  /** The GitHub identity behind the row — D-120-01 B1 scrubs it, so a cell needs the original. */
  githubId: string;
  handle: string;
  defaultVisibility: "public" | "private";
  actor: Actor;
}

/**
 * An account row with a chosen handle, AND the `handle_reservation` row that goes with it.
 *
 * The account row is raw SQL: what is wanted is a row with a chosen handle, not a GitHub
 * sign-in flow, and `upsertFromGitHub` produces an account whose `handle` is `null` by
 * design (T050 AC3). T080's, T100's and T110's own suites seed the same way.
 *
 * **The reservation goes in through `allocateHandle`, and that is not decoration.** AC4 is
 * a statement about `handle_reservation`, and D-120-02 rules that `deleteAccount` calls
 * `releaseHandle` — which updates a row `where status = 'active'` and silently does nothing
 * when there is no row. An account seeded without a reservation would make AC4 pass against
 * a module that never called anything, and the cell would be measuring its own fixture.
 *
 * The handle is kept to lowercase letters, digits and hyphens under 32 characters:
 * `resolveOwner` runs `validateNamespace` before it will answer, and T071 makes 32 the
 * product bound. A handle this file invented that the grammar refuses would make every
 * `publish` in the suite fail for a reason that has nothing to do with a criterion.
 */
export async function seedAccount(
  scratch: Scratch,
  handle: string,
  defaultVisibility: "public" | "private" = "public",
): Promise<Account> {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/u.test(handle)) {
    throw new Error(
      `seedAccount(${handle}): this suite's own handles must be lowercase alphanumeric with ` +
        `hyphens and at most 32 characters, or the grammar refuses them before any T120 code ` +
        `runs and every cell reports somebody else's refusal in place of its own criterion.`,
    );
  }
  const githubId = randomUUID();
  const rows = await scratch.pool.query<{ id: string }>(
    "insert into account (github_id, github_login, handle, default_visibility, email, display_name, bio, avatar_hue) " +
      "values ($1, $2, $3, $4, $5, $6, $7, $8) returning id",
    [
      githubId,
      handle,
      handle,
      defaultVisibility,
      `${handle}@example.test`,
      `${handle} display`,
      `${handle} bio`,
      120,
    ],
  );
  const accountId = rows.rows[0]?.id;
  if (accountId === undefined) throw new Error(`seedAccount(${handle}) inserted no row.`);

  await allocateHandle(scratch.db, accountId, handle);

  return {
    accountId,
    githubId,
    handle,
    defaultVisibility,
    actor: { kind: "account", accountId, handle },
  };
}

/**
 * An account with NO handle — T050 AC1's signed-in-and-incomplete state, and D-120-08's
 * whole subject. No reservation row, because there is no name to reserve.
 */
export async function seedHandlelessAccount(scratch: Scratch): Promise<Account> {
  const login = `t120-nohandle-${randomUUID().slice(0, 8)}`;
  const githubId = randomUUID();
  const rows = await scratch.pool.query<{ id: string }>(
    "insert into account (github_id, github_login) values ($1, $2) returning id",
    [githubId, login],
  );
  const accountId = rows.rows[0]?.id;
  if (accountId === undefined) throw new Error("seedHandlelessAccount inserted no row.");
  return {
    accountId,
    githubId,
    handle: "",
    defaultVisibility: "public",
    actor: { kind: "account", accountId, handle: null },
  };
}

/** A break-glass operator (B-13), for the cells that need `can`'s other grant. */
export function operatorActor(accountId: string): Actor {
  return { kind: "operator", accountId };
}

export const ANONYMOUS: Actor = { kind: "anonymous" };

/* ============================================================
   the corpus
   ============================================================ */

export interface Corpus {
  /** The archive slug this corpus came from. Never the slug it is published under. */
  sourceSlug: string;
  manifest: BundleManifest;
  dot: string;
  cardFiles: Record<string, string>;
  /** `id@version` for every card the DOT pins, in the order it pins them. */
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
    cardRefs: loaded.blueprint.nodes.map((node) => node.ref),
  };
}

let corpusCache: readonly Corpus[] | undefined;

/**
 * Every bundle in `content/` that RESOLVES, smallest first by node count.
 *
 * Filtered rather than merely sorted, and the filter is not defensive padding: measured at
 * `2c60bfb`, eight of the nine bundles resolve and `frontline-triage` is `rejected`. A
 * chooser that only sorted would hand a rejected bundle to `publish` the day the node counts
 * shift, and every cell in the suite would report a T100 refusal in place of its criterion.
 *
 * Chosen by MEASUREMENT rather than named as literals: a bundle renamed or removed from the
 * archive would otherwise turn into a missing-fixture failure that reads like a T120 defect.
 */
function resolvingCorpora(): readonly Corpus[] {
  if (corpusCache !== undefined) return corpusCache;
  const bundles = readContent();
  if (bundles.length === 0) {
    throw new Error(
      "readContent() returned no bundles. The corpus for every T120 cell comes from `content/`, " +
        "so this is a broken checkout rather than a T120 defect.",
    );
  }
  const resolving = [...bundles]
    .sort((a, b) => a.blueprint.graph.ids.length - b.blueprint.graph.ids.length)
    .map((loaded) => corpusFrom(loaded as LoadedBundle))
    .filter((corpus) => bundleProgress(validate(corpus)).state === "resolves");

  if (resolving.length < 2) {
    throw new Error(
      `only ${resolving.length} bundle(s) in content/ resolve, and this suite needs TWO: ` +
        `\`bundleDigest\` reads neither owner nor slug nor version, so two publishes of ONE ` +
        `corpus share a digest — and D-120-04's orphan rule is quantified over ` +
        `\`release.digest\` across all bundles, which cannot be driven at all without two ` +
        `distinct digests.`,
    );
  }
  for (const corpus of resolving) {
    if (corpus.manifest.ontologyVersion !== CORE_ONTOLOGY.version) {
      throw new Error(
        `${corpus.sourceSlug}'s manifest declares ontologyVersion ` +
          `\`${corpus.manifest.ontologyVersion}\` and scratchDatabase seeds ` +
          `\`${CORE_ONTOLOGY.version}\`.\n` +
          `  Every publish would raise T030's UnknownOntologyVersionError, which is a foreign ` +
          `rejection and reads as anything but a broken fixture.`,
      );
    }
  }
  corpusCache = resolving;
  return corpusCache;
}

/** The `index`-th smallest resolving bundle in `content/`. Default: the smallest. */
export function resolvingCorpus(index = 0): Corpus {
  const all = resolvingCorpora();
  const corpus = all[index];
  if (corpus === undefined) {
    throw new Error(`content/ holds ${all.length} resolving bundles; this suite asked for #${index}.`);
  }
  return corpus;
}

/** `validateBundle` over a corpus, with the archive's own vocabulary left at the shipped core. */
export function validate(corpus: Corpus): LoadBundleResult {
  return validateBundle({ manifest: corpus.manifest, dot: corpus.dot, cardFiles: corpus.cardFiles });
}

/** The fixture's own premise: this corpus resolves, so only a criterion can refuse it. */
function assertResolves(corpus: Corpus, made: string): void {
  const result = validate(corpus);
  const progress = bundleProgress(result);
  if (progress.state !== "resolves") {
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    throw new Error(
      `${made} must RESOLVE and the engine reads it as \`${progress.state}\` ` +
        `(${progress.placed} of ${progress.total} carded, ${errors.length} errors: ` +
        `${errors.map((d) => d.code).join(", ")}).\n` +
        `  This is a broken FIXTURE, not a T120 defect: \`publish\` would refuse it and the cell ` +
        `would report a T100 refusal in place of its own criterion.`,
    );
  }
}

/** The bare card ids the corpus pins, for the counter and note targets B-10 keys per id. */
export function bareCardIds(corpus: Corpus): readonly string[] {
  return corpus.cardRefs.map((ref) => {
    const parsed = parseCardRef(ref);
    if (parsed === undefined) throw new Error(`\`${ref}\` is not a card ref.`);
    return parsed.id;
  });
}

/* ============================================================
   really published bundles
   ============================================================ */

export interface Published {
  bundleId: string;
  releaseId: string;
  digest: string;
  /** The slug it was published under — this suite's own, never the archive's. */
  slug: string;
  version: string;
  visibility: "public" | "private";
  owner: Account;
  corpus: Corpus;
}

/**
 * A bundle published through T100, which is what makes it a real blueprint rather than a set
 * of rows this file guessed at.
 *
 * ── THE ORDERING CONSTRAINT, measured rather than reasoned about ──
 * Two accounts can only share a corpus if the FIRST publish of it is PUBLIC.
 *
 * `publish` stores each card at the BUNDLE's visibility, and `publishCard` reuses an
 * existing row byte-for-byte only when `getCard` can SEE it — and `getCard` hides a
 * stranger's private card. So a second account publishing a corpus whose cards a first
 * account already stored PRIVATELY falls through to `addCard`, which refuses the duplicate:
 * `CardStoreError: addCard: \`spec-planner@1.0.0\` already exists`. Measured here, in two
 * cells of this suite that were written before the constraint was known — one in
 * `cascade.test.ts` and one in `deletion.test.ts` — and it is the same mechanism this
 * author reported as F-120-F, which D-120-11 rests on.
 *
 * The consequences for a fixture, stated so the next reader does not rediscover them:
 *   • same account, private then public  — fine (the owner can see their own card)
 *   • same account, public then private  — fine
 *   • two accounts, public first         — fine (the second reuses the public row)
 *   • two accounts, PRIVATE first        — REFUSED, and the cell reports T020's class
 * A cross-account fixture that needs two accounts on one corpus therefore publishes the
 * public bundle first, or gives the second account a corpus of its own.
 *
 * The three-argument call, so `publish` builds its own storage handle lazily from `S3_*`
 * exactly as a route would. That writes objects into the MinIO bucket and leaves them there;
 * the same is true of every merged suite that publishes, and taking them back would need
 * T090's reader, which is not this task's.
 */
export async function publishBundle(
  scratch: Scratch,
  owner: Account,
  slug: string,
  visibility: "public" | "private",
  options: { corpus?: Corpus; version?: string } = {},
): Promise<Published> {
  const corpus = options.corpus ?? resolvingCorpus();
  const version = options.version ?? "1.0.0";
  assertResolves(corpus, `publishBundle(${owner.handle}/${slug}@${version})`);
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
    visibility,
    owner,
    corpus,
  };
}

/** Every release of a bundle, through T010's own reader. */
export async function releasesOf(scratch: Scratch, bundleId: string) {
  return await listReleases(scratch.db, bundleId);
}

/* ============================================================
   the state a deletion has to handle, through the product's writers
   ============================================================ */

/** A star, through T150 — which is what creates the `target` row on its own conflict key. */
export async function star(
  scratch: Scratch,
  who: Account,
  target: { kind: "blueprint" | "card" | "term"; refId: string },
): Promise<void> {
  await toggleStar(scratch.db, who.actor, target);
}

/** A private bookmark, through T140. */
export async function save(
  scratch: Scratch,
  who: Account,
  target: { kind: "blueprint" | "card" | "term"; refId: string },
): Promise<void> {
  await saveTarget(scratch.db, who.actor, who.accountId, target);
}

/** A note, through T170 — which also maintains `target.note_count`. */
export async function note(
  scratch: Scratch,
  who: Account,
  target: { kind: "blueprint" | "card"; refId: string },
  body: string,
): Promise<string> {
  const record = await postNote(scratch.db, who.actor, target, body);
  return record.id;
}

/**
 * A community ballot, through T160.
 *
 * One metric rather than all three: D-05-02 makes the three columns nullable so a caller may
 * vote on one and not the others, and what this fixture needs is a `ballot` ROW for the
 * account — which is what D-120-13 rules deleted. The metric name is read off T160's own
 * `METRICS` constant rather than typed, so a rename there reds here instead of silently
 * writing a metric nobody reads.
 */
export async function ballot(scratch: Scratch, who: Account, bundleId: string): Promise<void> {
  await castBallot(scratch.db, who.actor, bundleId, { [METRICS[0]]: 70 });
}

/**
 * A run report, through T180.
 *
 * `costUnits` is a plain number here because `RunReport.costUnits` is `number` on T180's
 * published interface; the string form T180's own fixtures use is a fact about a RAW insert
 * into an unqualified `numeric` column (D-05-09), which is not the door this takes.
 */
export async function report(
  scratch: Scratch,
  who: Account,
  releaseDigest: string,
  costUnits = 12.5,
): Promise<void> {
  await submitReport(scratch.db, who.actor, {
    releaseDigest,
    model: "claude-opus-5",
    provider: "anthropic",
    hardware: "m3-max-64gb",
    inputSize: 4096,
    harnessVersion: "darkprint-cli/0.4.1",
    costUnits,
    durationMs: 1200,
    occurredAt: new Date(Date.UTC(2026, 7, 1, 12, 0, 0)),
  });
}

/** An API key, through T230. Returns the secret so a cell can try to authenticate with it. */
export async function apiKey(scratch: Scratch, who: Account, label = "t120"): Promise<string> {
  const { secret } = await issueKey(scratch.db, who.actor, who.accountId, label);
  return secret;
}

/* ============================================================
   the census — raw SQL, because that is the point

   No published reader answers "how many rows does this account
   still own in `note_vote`". A census built out of published
   readers would see exactly what the published readers already
   filter, which is the state a deletion is most likely to leave
   behind wrongly.
   ============================================================ */

/** Every table with a foreign key to `account`, derived from the catalogue rather than listed. */
export async function tablesReferencingAccount(
  scratch: Scratch,
): Promise<readonly { table: string; column: string; deleteRule: string }[]> {
  const rows = await scratch.pool.query<{ table: string; column: string; rule: string }>(
    `select tc.table_name as table, kcu.column_name as column, rc.delete_rule as rule
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
       join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
       join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'account'
      order by tc.table_name, kcu.column_name`,
  );
  return rows.rows.map((r) => ({ table: r.table, column: r.column, deleteRule: r.rule }));
}

/**
 * How many rows each account-referencing table holds for one account, keyed `table.column`.
 *
 * Derived from the catalogue for the same reason `tests/support/db.ts` derives its truncation
 * set: a hand-written list of nine tables is a list that stops being edited, and D-120-13
 * rules nine tables precisely because six of them arrived after §T120 was written. A tenth
 * appears in this census on the day it appears in the schema.
 */
export async function accountCensus(
  scratch: Scratch,
  accountId: string,
): Promise<Record<string, number>> {
  const refs = await tablesReferencingAccount(scratch);
  const out: Record<string, number> = {};
  for (const ref of refs) {
    const rows = await scratch.pool.query<{ n: string }>(
      `select count(*)::text as n from "${ref.table}" where "${ref.column}" = $1`,
      [accountId],
    );
    out[`${ref.table}.${ref.column}`] = Number(rows.rows[0]?.n ?? "0");
  }
  return out;
}

/** The `account` row itself, every column, so a tombstone cell can read what survived. */
export async function accountRow(
  scratch: Scratch,
  accountId: string,
): Promise<Record<string, unknown> | undefined> {
  const rows = await scratch.pool.query(`select * from "account" where id = $1`, [accountId]);
  return rows.rows[0] as Record<string, unknown> | undefined;
}

/** The reservation row for a handle, whatever its status. */
export async function reservationRow(
  scratch: Scratch,
  handle: string,
): Promise<Record<string, unknown> | undefined> {
  const rows = await scratch.pool.query(`select * from "handle_reservation" where handle = $1`, [
    handle,
  ]);
  return rows.rows[0] as Record<string, unknown> | undefined;
}

/** The bundle row, straight from the table, so a "nothing moved" control reads storage. */
export async function bundleRow(
  scratch: Scratch,
  bundleId: string,
): Promise<Record<string, unknown> | undefined> {
  const rows = await scratch.pool.query(`select * from "bundle" where id = $1`, [bundleId]);
  return rows.rows[0] as Record<string, unknown> | undefined;
}

/** Every `card_version` row for a set of bare card ids, so AC5/AC6 can read what survived. */
export async function cardRows(
  scratch: Scratch,
  cardIds: readonly string[],
): Promise<readonly Record<string, unknown>[]> {
  if (cardIds.length === 0) return [];
  const rows = await scratch.pool.query(
    `select * from "card_version" where card_id = any($1::text[]) order by card_id, version`,
    [[...cardIds]],
  );
  return rows.rows as Record<string, unknown>[];
}

/**
 * A snapshot of every row in every table, keyed `table` -> count.
 *
 * The disagreeing control for AC3's "before anything moves": a refusal that inserted a row
 * and then threw satisfies every `rejects.toThrow()` a reviewer would write, and `wave-blind`
 * asks for what the writer LEFT BEHIND rather than only that it threw.
 */
export async function wholeDatabaseCensus(scratch: Scratch): Promise<Record<string, number>> {
  const tables = await scratch.pool.query<{ name: string }>(
    `select table_name as name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  const out: Record<string, number> = {};
  for (const { name } of tables.rows) {
    const rows = await scratch.pool.query<{ n: string }>(`select count(*)::text as n from "${name}"`);
    out[name] = Number(rows.rows[0]?.n ?? "0");
  }
  return out;
}
