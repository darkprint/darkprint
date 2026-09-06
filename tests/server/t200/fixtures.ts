/* ============================================================
   T200 — the fixture layer

   Not a test file. the vitest glob reaches `.test.ts` under `tests`
   and nothing else, so this module is imported by the suites beside
   it and is never collected as one itself.

   ── why the rows go in through plain SQL ──
   T200 is a reader and a re-embedder. The writers for `bundle`,
   `release` and `card_version` belong to T100 (publishing) and to
   `lib/server/archive/**`, neither of which is this task's, and
   seeding through another task's writer makes every red ambiguous
   between two modules. So the fixtures go in through `@/lib/db`'s
   published client with statements this file owns — the same route
   `tests/server/t080/contract.ts` took, and for the same reason.

   ── why not import T080's fixture builders ──
   They exist and they are proven, and reusing them was the first
   plan. Two things argued against it. Its module imports three
   `next/dist` route helpers and a route table this task has no use
   for, and its `BlueprintSummary` would shadow the one under test.
   The second axis this suite actually needs is not a shared row
   writer: it is an independently authored READER to check answers
   against, and that is `@/lib/server/registry`, consulted at
   assertion time rather than here.
   ============================================================ */

import {
  bundleDigest,
  cardDigest,
  cardRef,
  type BundleManifest,
  type CardRef,
  type NodeCard,
} from "@/lib/core";
import { createTestDb, type TestDb } from "@/tests/support";

/* --------------------- the database --------------------- */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the drizzle instance every T200 signature takes first. */
  db: unknown;
  /**
   * The connection string of this scratch database, for the route half.
   *
   * `getSharedDbClient()` reads `DATABASE_URL`, so a route handler can only be pointed at
   * this database by naming it. Asked of the connection itself rather than rebuilt from a
   * convention, so it cannot drift from what the client is actually on.
   */
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

/**
 * A database of this file's own. `createTestDb()` creates `darkprint_test_<uuid>`, migrates
 * it and drops it on `drop()`; it never opens the shared development database `DATABASE_URL`
 * names, which is the whole reason T000 built it (D-08). The Postgres baseline at rest is
 * three databases, so a scratch left behind is visible by name.
 */
export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Record<string, unknown>;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(
      "createTestDb's client carries no `db`. `Db` is published from @/lib/db and is the " +
        "first parameter of all four T200 signatures.",
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

/* --------------------- actors --------------------- */

/** T060's published `Actor`, built here rather than imported so a fixture reads as a fixture. */
export const anonymous = { kind: "anonymous" } as const;
export const account = (accountId: string, handle: string | null = null) =>
  ({ kind: "account", accountId, handle }) as const;
export const operator = (accountId: string) => ({ kind: "operator", accountId }) as const;

/* --------------------- identifiers --------------------- */

/**
 * Unique per run and per process. The leak sweep asserts a tell cannot appear except by
 * leaking, so two suite files minting the same identifier would make one file's private
 * content another file's admissible content.
 */
let counter = 0;
export function mark(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

/**
 * A search token: ONE alphabetic word, unique per process and per call, with no digit and
 * no separator anywhere in it.
 *
 * `mark()` is wrong for this and the adversary round is what proved it. Its output
 * `qtok-87169-3` NORMALISES to three words — `qtok`, `87169`, `3` — because
 * `lib/server/search/text.ts` collapses every run of non-letter non-digit to a space. Every
 * identifier this file mints shares the pid, so `87169` matched EVERY blueprint in every
 * field, and the one-character word `3` matched any document word containing a `3`:
 * `card:13`, `slug:s3`, `title:3`. A cell asserting that a `tag` field is not cited as
 * evidence then reds against a correct module, because `q` really had matched a tag — the
 * fixture had planted the collision.
 *
 * A substring guard could not have caught it: `qtok-87169-3` is not a substring of
 * `taga-87169-8`. The collision is at the WORD level, below the identifier, which is why
 * `assertTokensAreDiscriminating` in `world.ts` now splits both sides the way the matcher
 * does instead of comparing whole strings.
 *
 * Letters only, so it survives normalisation as exactly one word and cannot share a word
 * with an identifier that carries digits.
 */
const LETTERS = "abcdefghijklmnopqrstuvwxyz";
function base26(n: number): string {
  let out = "";
  let value = n;
  do {
    out = LETTERS[value % 26] + out;
    value = Math.floor(value / 26);
  } while (value > 0);
  return out;
}

export function word(prefix: string): string {
  counter += 1;
  return `${prefix}${base26(process.pid)}q${base26(counter)}`;
}

/* --------------------- rows --------------------- */

export interface CardOptions {
  id: string;
  version?: string;
  phases?: readonly string[];
  name?: string;
  action?: string;
  spec?: string;
  notes?: string;
  type?: string;
  riskMarkers?: readonly string[];
}

/** A complete `NodeCard`. Every required field of `lib/core/card/schema.ts` is present. */
export function nodeCard(o: CardOptions): NodeCard {
  return {
    id: o.id,
    name: o.name ?? "Fixture Card",
    type: o.type ?? "agent",
    phases: [...(o.phases ?? [])],
    action: o.action ?? "do-the-fixture-thing",
    spec: o.spec ?? "A self-sufficient instruction for the fixture node.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [...(o.riskMarkers ?? [])],
    notes: o.notes,
    version: o.version ?? "1.0.0",
  };
}

export interface ManifestOptions {
  slug: string;
  title?: string;
  summary?: string;
  description?: string;
  category?: string;
  tags?: readonly string[];
  author?: string;
}

export function manifest(o: ManifestOptions): BundleManifest {
  return {
    slug: o.slug,
    title: o.title ?? `Fixture ${o.slug}`,
    summary: o.summary ?? `A fixture blueprint named ${o.slug}.`,
    description: o.description,
    category: o.category,
    tags: [...(o.tags ?? [])],
    author: o.author,
  };
}

/** The wire form of a card. Stored verbatim in `card_version.source`, which is NOT NULL. */
function cardSource(card: NodeCard): string {
  return [
    `id: ${card.id}`,
    `name: ${card.name}`,
    `type: ${card.type}`,
    `version: ${card.version}`,
    `action: ${card.action}`,
    `spec: ${JSON.stringify(card.spec)}`,
    "",
  ].join("\n");
}

/** Plausible DOT for `release.dot`, which is NOT NULL. */
export function dotFor(refs: readonly CardRef[]): string {
  const nodes = refs.map((ref, i) => `  n${i} [card="${ref}"];`).join("\n");
  return `digraph fixture {\n${nodes}\n}\n`;
}

export interface AccountFixture {
  id: string;
  handle: string;
}

export async function insertAccount(s: Scratch, handle: string): Promise<AccountFixture> {
  const [row] = await s.query(
    "insert into account (github_id, github_login, handle) values ($1, $2, $3) returning id",
    [`gh-${handle}`, `login-${handle}`, handle],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the account fixture: got ${describe_(id)} for its id.`);
  }
  return { id, handle };
}

export interface CardFixture {
  rowId: string;
  cardId: string;
  version: string;
  ref: CardRef;
  digest: string;
  body: NodeCard;
}

export async function insertCard(
  s: Scratch,
  o: CardOptions & { ownerId: string; visibility?: "public" | "private" },
): Promise<CardFixture> {
  const body = nodeCard(o);
  const digest = cardDigest(body);
  const [row] = await s.query(
    "insert into card_version (card_id, version, digest, owner_id, visibility, body, source) " +
      "values ($1, $2, $3, $4, $5, $6, $7) returning id",
    [
      body.id,
      body.version,
      digest,
      o.ownerId,
      o.visibility ?? "public",
      JSON.stringify(body),
      cardSource(body),
    ],
  );
  const rowId = row?.id;
  if (typeof rowId !== "string") {
    throw new Error(`Could not insert the card fixture: got ${describe_(rowId)} for its id.`);
  }
  return {
    rowId,
    cardId: body.id,
    version: body.version,
    ref: cardRef(body.id, body.version),
    digest,
    body,
  };
}

export interface BundleFixture {
  id: string;
  ownerId: string;
  ownerHandle: string;
  slug: string;
  visibility: "public" | "private";
}

export async function insertBundle(
  s: Scratch,
  o: { owner: AccountFixture; slug: string; visibility?: "public" | "private" },
): Promise<BundleFixture> {
  const visibility = o.visibility ?? "public";
  const [row] = await s.query(
    "insert into bundle (owner_id, slug, visibility) values ($1, $2, $3) returning id",
    [o.owner.id, o.slug, visibility],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the bundle fixture: got ${describe_(id)} for its id.`);
  }
  return { id, ownerId: o.owner.id, ownerHandle: o.owner.handle, slug: o.slug, visibility };
}

export interface ReleaseOptions {
  bundle: BundleFixture;
  version: string;
  cards: readonly CardFixture[];
  manifest?: BundleManifest;
  autonomy?: unknown;
  security?: unknown;
  phaseCoverage?: unknown;
  /** `StoredVocabulary` — `{ text, terms? }` (lib/server/archive/types.ts:28-33), or omitted. */
  localVocabulary?: { text: string; terms?: readonly unknown[] | null };
  createdAt?: string;
}

export interface ReleaseFixture {
  id: string;
  bundleId: string;
  version: string;
  digest: string;
  cardRefs: readonly CardRef[];
}

export async function insertRelease(s: Scratch, o: ReleaseOptions): Promise<ReleaseFixture> {
  const cardRefs = o.cards.map((c) => c.ref);
  const cardDigests = o.cards.map((c) => c.digest);
  const dot = dotFor(cardRefs);
  const digest = bundleDigest({ dot, cardDigests });
  const columns = [
    "bundle_id",
    "version",
    "digest",
    "dot",
    "manifest",
    "card_refs",
    "card_digests",
    "autonomy",
    "security",
    "phase_coverage",
    "local_vocabulary",
  ];
  const values: unknown[] = [
    o.bundle.id,
    o.version,
    digest,
    dot,
    JSON.stringify(o.manifest ?? manifest({ slug: o.bundle.slug })),
    cardRefs,
    cardDigests,
    o.autonomy === undefined ? null : JSON.stringify(o.autonomy),
    o.security === undefined ? null : JSON.stringify(o.security),
    o.phaseCoverage === undefined ? null : JSON.stringify(o.phaseCoverage),
    o.localVocabulary === undefined ? null : JSON.stringify(o.localVocabulary),
  ];
  if (o.createdAt !== undefined) {
    columns.push("created_at");
    values.push(o.createdAt);
  }
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const [row] = await s.query(
    `insert into release (${columns.join(", ")}) values (${placeholders}) returning id`,
    values,
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the release fixture: got ${describe_(id)} for its id.`);
  }
  return { id, bundleId: o.bundle.id, version: o.version, digest, cardRefs };
}

/* `insertOntologyVersion` and `insertOntologyTerm` stood here, and
   `ReleaseOptions.scoredOntologyVersionId` above them. All three wrote objects
   `0009_drop_ontology_versioning` dropped: the vocabulary names what an Attractor node IS,
   Attractor fixes those shapes in its own spec and carries no vocabulary version, so a
   DarkPrint-only version on top was a second thing to keep in step with nothing.
   `ontology_term` went with its parent rather than by choice — its
   `ontology_version_id` was NOT NULL and referenced it.

   A registry-wide term list is `release.local_vocabulary` merged over `CORE_ONTOLOGY` now,
   which is what `localVocabulary` above writes and what every terms cell reads. */

/* --------------------- reading the embedding tables back --------------------- */

/**
 * One `release_embedding` row, with `created_at` and `embedding` read as TEXT.
 *
 * Both casts are load-bearing and both were paid for elsewhere in this run. `created_at`
 * through a `Date` truncates Postgres microseconds, so two writes inside one millisecond
 * compare equal and an idempotency cell that means "the row was not rewritten" would pass
 * against a row that was. `embedding` through the `pg` vector path is whatever the driver
 * decides to make of an unregistered type OID; as text it is the stored value, and a
 * re-embed that produced a different vector cannot compare equal to one that did not.
 */
export interface EmbeddingRow {
  subjectId: string;
  createdAt: string;
  embedding: string;
}

export async function releaseEmbeddings(s: Scratch): Promise<EmbeddingRow[]> {
  const rows = await s.query(
    "select release_id::text as subject_id, created_at::text as created_at, " +
      "embedding::text as embedding from release_embedding order by release_id",
  );
  return rows.map((r) => ({
    subjectId: String(r.subject_id),
    createdAt: String(r.created_at),
    embedding: String(r.embedding),
  }));
}

export async function cardVersionEmbeddings(s: Scratch): Promise<EmbeddingRow[]> {
  const rows = await s.query(
    "select card_version_id::text as subject_id, created_at::text as created_at, " +
      "embedding::text as embedding from card_version_embedding order by card_version_id",
  );
  return rows.map((r) => ({
    subjectId: String(r.subject_id),
    createdAt: String(r.created_at),
    embedding: String(r.embedding),
  }));
}

/* --------------------- turning a hook failure into per-cell reds --------------------- */

/**
 * A throw in `beforeAll` produces SKIPS, not reds: the run stands down rather than failing,
 * and a run with `skipped > 0` is INVALID rather than a zero. Measured on an earlier task:
 * under one broken writer 127 merged cells went silent, while thirteen cells in a suite
 * that recorded its setup failure and re-raised it per cell went red. Same defect, same
 * hook, opposite visibility.
 *
 * So every suite here runs its setup through this and re-raises per cell. The message says
 * it is a setup failure, because it is: a red here is not a failed acceptance criterion,
 * and reading it as one would charge the implementer for a broken database.
 */
export interface Setup {
  run(work: () => Promise<void>): Promise<void>;
  check(): void;
}

export function recordedSetup(what: string): Setup {
  let failure: unknown;
  return {
    async run(work) {
      try {
        await work();
      } catch (cause) {
        failure = cause;
      }
    },
    check() {
      if (failure === undefined) return;
      throw new Error(
        `${what} did not build, so this cell measured nothing.\n` +
          `  Raised here rather than left in \`beforeAll\`: a hook that throws SKIPS every ` +
          `cell below it, and a run with skipped > 0 is invalid rather than a zero. This is ` +
          `a broken fixture, not a failed acceptance criterion.\n` +
          `  cause: ${failure instanceof Error ? failure.stack ?? failure.message : String(failure)}`,
      );
    },
  };
}
