/* ============================================================
   T132 — the blind contract surface

   Not a test file. `vitest.config.ts` reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── the blind position, and what it looks like here ──
   T080 and T130 are MERGED. Their barrels exist, their readers
   exist, and the only things absent on this branch are the three
   exports this task adds. D-133-05 registered that shape in
   advance: "the shape every blind suite takes once its subject
   module is already merged and only the task's new exports are
   missing … T131's and T132's when they run." So the reds here are
   TS2305-class — absent MEMBERS of a present barrel — and every
   bind below quotes the ruling that publishes the name.

   ── every load is a dynamic import ──
   Same reason as T080's contract: a static top-level import of a
   member that is not there yet fails the whole FILE at collection
   and hides every criterion behind the first missing name.
   Binding inside the cell that needs it turns "not built yet" into
   the per-criterion red the hand-off asks for. The specifier stays
   a literal so the `@` alias resolves.

   ── what this file reads, and under what licence ──
   Everything MERGED at c84db8c, which the dispatch licenses
   explicitly. Nothing on `feat/t132-amend` has been read, fetched
   or diffed. The merged files consulted while writing this suite
   are named in the handback report rather than here, so this
   header does not go stale the day one of them moves.

   ── fixtures come from two places, deliberately ──
   The simple ones below are this file's own raw SQL, on T080's
   blind-suite precedent: the rows are trivial and a fixture that
   went through another task's writer would make every red
   ambiguous between two modules.

   The RESOLVABLE ones are `tests/server/t090/fixtures.ts`'s
   `seedRelease`, imported rather than rewritten. `graphsOf` has to
   reassemble a real bundle out of Postgres — real DOT, real card
   YAML in `card_version.source`, a real published ontology version
   — and T090's blind author already built exactly that, wrote down
   why each digest comes back from the writer instead of being
   recomputed here, and had it merged. Rewriting it would be a
   second copy of the seeding rule authored by the person writing
   the assertions, which is the oracle trap this project charges.
   Cross-suite import is the established idiom: `tests/server/t091`
   and `tests/server/t133` both import that module.
   ============================================================ */

import { Pool } from "pg";

import { createDbClient, migrateUp, type Db, type DbClient } from "@/lib/db";
import type { CardRef, NodeCard } from "@/lib/core";
import { bundleDigest, cardDigest } from "@/lib/core";
import type { BundleManifest } from "@/lib/server/types";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const REGISTRY = "@/lib/server/registry";

/* --------------------- what the contract publishes --------------------- */

/**
 * The three readers T132 adds to T080's published surface, quoted so a red says where the
 * name comes from and not merely that a test wanted it.
 *
 * `scoresFor` was the one name in this table that the contract did not pin. D-132-01 wrote it
 * as "(suggested `scoresFor(db, actor, keys): Promise<ReadonlyMap<string, Scores>>`)", and a
 * grep of the record at `c84db8c` found the string nowhere else — while D-132-03 exists
 * precisely because a name neither half invents has to be written down. Charged before this
 * file had a cell in it, which is the only time such a charge is free, and **D-132-04 C-A
 * publishes it verbatim**: the pinned reader was the one that already had a name in the
 * prose, and the one that did not was still a suggestion.
 */
export const PUBLISHED = {
  graphsOf:
    "graphsOf(db: Db, actor: Actor, keys: readonly BlueprintKey[]): " +
    "Promise<ReadonlyMap<string, { graph: BlueprintGraph; requiredAgents: readonly string[]; " +
    "requiredTools: readonly string[] }>> — D-132-01, keyed `${ownerHandle}/${slug}`, BATCH " +
    "so /blueprints makes one call, and an absent entry means not visible or not resolvable " +
    "(value, not refusal)",
  scoresFor:
    "scoresFor(db: Db, actor: Actor, keys: readonly BlueprintKey[]): " +
    "Promise<ReadonlyMap<string, Scores>> — D-132-04 C-A, publishing D-132-01's suggestion verbatim: the batch form of " +
    "`scoresOf`, keyed `owner/slug` like `graphsOf`, absent entry = no complete scorecard, " +
    "because " +
    "a client-side-filtering page needs a scorecard for EVERY tile on EVERY request and " +
    "per-tile `scoresOf` is three queries times N (D-260-21)",
  cardsOwnedBy:
    "cardsOwnedBy(db: Db, actor: Actor, ownerHandle: string): Promise<readonly CardSummary[]> " +
    "— D-132-03, the fourteenth reader, serving `counts.cards` as `.length`. Ownership " +
    "semantics (D-132-02 C-1a), NOT the pin-narrowed index",
} as const;

export type ReaderName = keyof typeof PUBLISHED;

/** The three, in the order the rulings publish them. */
export const READER_NAMES = Object.keys(PUBLISHED) as ReaderName[];

/**
 * What the reader table becomes when this task merges: 13 + 3.
 *
 * D-132-03: "Reader count 13 -> 16; `PUBLISHED` gains three entries and `toBe(13)` becomes
 * `toBe(16)` in the same commit". Held as a constant here so the surface cell's arithmetic
 * is derived from the ruling rather than typed twice.
 */
export const READER_COUNT_AFTER = 16;

/** What T080's table holds before this task, and what D-132-03 leaves it holding for AC6. */
export const T080_READER_COUNT = 13;

/**
 * Readers added to T080's table AFTER T132's merge, each named with the ruling that added it
 * and carrying its AC6 cells in THIS suite's `privacy.test.ts` (the instrument here expands
 * Maps; T080's `findTokens` is blind to one). The partition cell consumes this list, so a
 * later reader with no AC6 home still reds there rather than arriving unswept.
 *
 * `usersOfMany` — D-260-31, T260's merge: the batch form of `usersOf`, armed when the /nodes
 * cutover turned the disclosed 53-snapshots-per-load cost from build-time to per-request.
 *
 * `storedVersionsOf` — the single-card publish door, `POST /api/cards`: every stored version
 * of one id the actor may read, pinned or not, so a card nothing pins yet has a page. Its
 * AC6 cell is here because its reach is a private card row asked for by id, which is
 * exactly the probe this fixture's sealed side supplies.
 */
export const READERS_ADDED_AFTER = ["usersOfMany", "storedVersionsOf"] as const;

let registry: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a member that is absent stays absent for the
 * whole run, and every cell that awaits it gets its own copy of the same red rather than one
 * cell's failure cascading into an unhandled rejection in the next.
 */
export function loadRegistry(): Promise<Namespace> {
  registry ??= import("@/lib/server/registry").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${REGISTRY} does not load.\n` +
          `  T080's barrel is MERGED, so this is not the ordinary blind-position red — the ` +
          `module itself is gone or no longer compiles.\n` +
          `  T132 amends it with: ${READER_NAMES.join(", ")}.`,
        { cause },
      );
    },
  );
  return registry;
}

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Map) return `a Map of ${value.size}`;
  if (value instanceof Set) return `a Set of ${value.size}`;
  if (value instanceof Date) return "a Date";
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, source: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${source} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. Do not add a ` +
      `synonym; publish the name the ruling states. T080's own contract file carries the ` +
      `reason at length: two rounds of candidate lists in T000 each resolved to the wrong ` +
      `thing, so where the contract has a name, guessing is worse than binding.`,
  );
}

export async function bind(name: ReaderName): Promise<UnknownFn> {
  const mod = await loadRegistry();
  const value = requireFrom(mod, name, REGISTRY, PUBLISHED[name]);
  if (typeof value !== "function") {
    throw new Error(
      `${REGISTRY} exports \`${name}\` as ${describe_(value)}; the contract publishes it as ` +
        `a function: ${PUBLISHED[name]}`,
    );
  }
  return value as UnknownFn;
}

/**
 * The T260-merge reader (D-260-31), bound the way `bindScoresOf` binds a T080-side name:
 * it is not in this task's `PUBLISHED` three — READER_COUNT_AFTER stays D-132-03's 13 + 3 —
 * but its AC6 cells live in this suite because only this suite's instrument can scan a Map.
 */
export async function bindUsersOfMany(): Promise<UnknownFn> {
  const mod = await loadRegistry();
  const value = mod.usersOfMany;
  if (typeof value !== "function") {
    throw new Error(
      `${REGISTRY} exports \`usersOfMany\` as ${describe_(value)}. D-260-31 publishes it as ` +
        `usersOfMany(db, actor, cardIds): Promise<ReadonlyMap<string, readonly ` +
        `BlueprintSummary[]>> at T260's merge; without it the AC6 sweep over the seventeenth ` +
        `reader binds nothing and greens over its absence.`,
    );
  }
  return value as UnknownFn;
}

/**
 * The reader the single-card publish door added, bound the way `bindUsersOfMany` binds its
 * later addition: not in this task's `PUBLISHED` three, swept here because this list is
 * where a reader added after the merge has its AC6 home.
 */
export async function bindStoredVersionsOf(): Promise<UnknownFn> {
  const mod = await loadRegistry();
  const value = mod.storedVersionsOf;
  if (typeof value !== "function") {
    throw new Error(
      `${REGISTRY} exports \`storedVersionsOf\` as ${describe_(value)}. The single-card publish ` +
        `door publishes it as storedVersionsOf(db, actor, cardId): Promise<readonly ` +
        `CardSummary[]>; without it the AC6 sweep over the reader binds nothing and greens ` +
        `over its absence.`,
    );
  }
  return value as UnknownFn;
}

/** T080's merged `scoresOf`, bound the same way. The oracle `scoresFor` must agree with. */
export async function bindScoresOf(): Promise<UnknownFn> {
  const mod = await loadRegistry();
  const value = mod.scoresOf;
  if (typeof value !== "function") {
    throw new Error(
      `${REGISTRY} exports \`scoresOf\` as ${describe_(value)}. It is MERGED — the thirteenth ` +
        `reader, D-80-02b — and \`scoresFor\` is its batch form, so a suite that could not ` +
        `bind it has lost the one separately-authored oracle the batch reader has.`,
    );
  }
  return value as UnknownFn;
}

/* --------------------- the database --------------------- */

export interface Scratch {
  /** The published `Db` — the first parameter of every reader here. */
  db: Db;
  /** For the fixture rows no published writer owns, and for the D-260-24 stamp. */
  pool: Pool;
  client: DbClient;
  name: string;
  /**
   * The connection string of THIS database, for the route half.
   *
   * A handler takes no `Db`: it reaches for `getSharedDbClient()`, which reads `DATABASE_URL`
   * and caches on `globalThis`. Naming this database is the only way to point a route at it,
   * and the alternative — letting the handler open the shared development database — is what
   * the isolation rule (D-08) exists to stop.
   */
  url: string;
  drop(): Promise<void>;
}

const MAINTENANCE_DATABASE = "postgres";

function databaseUrlFor(name: string): string {
  const base = process.env.DATABASE_URL;
  if (base === undefined || base === "") {
    throw new Error(
      "DATABASE_URL is not set. Run `docker compose up -d` and export the variables in " +
        ".env.example first. `tests/support/env.ts` publishes the same eight-variable contract.",
    );
  }
  const url = new URL(base);
  url.pathname = `/${name}`;
  return url.toString();
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

const open: Scratch[] = [];

/**
 * A migrated database of this file's own, NAMED for the task that made it.
 *
 * `createTestDb()` mints `darkprint_test_<uuid>`, which carries no task and no pid — so a
 * database found on the host at the end of a run cannot be attributed to whoever leaked it,
 * and a peer minting the identical name shape in the same second is indistinguishable from
 * this suite. T090's fixtures already name theirs; this follows them.
 */
export async function scratchDatabase(tag: string): Promise<Scratch> {
  const name = `darkprint_t132_${tag}_${process.pid}`;
  await withAdmin(async (admin) => {
    await dropDatabase(admin, name);
    await admin.query(`create database "${name}"`);
  });

  let client: DbClient;
  try {
    client = createDbClient(databaseUrlFor(name));
    await migrateUp(client.pool);
  } catch (cause) {
    await withAdmin((admin) => dropDatabase(admin, name));
    throw cause;
  }

  /* The premise of everything below, checked rather than hoped for: a client that ignored the
     connection string it was handed would put this suite on the shared development database. */
  const where = await client.pool.query<{ name: string }>("select current_database() as name");
  if (where.rows[0]?.name !== name) {
    await client.close();
    await withAdmin((admin) => dropDatabase(admin, name));
    throw new Error(
      `This file created ${name} and the client connected to ` +
        `"${String(where.rows[0]?.name)}" instead.`,
    );
  }

  const scratch: Scratch = {
    db: client.db,
    pool: client.pool,
    client,
    name,
    url: databaseUrlFor(name),
    async drop() {
      await client.close();
      await withAdmin((admin) => dropDatabase(admin, name));
    },
  };
  open.push(scratch);
  return scratch;
}

export async function dropScratchDatabases(): Promise<number> {
  let dropped = 0;
  for (const scratch of open.splice(0)) {
    await scratch.drop();
    dropped += 1;
  }
  return dropped;
}

export async function query(
  s: Scratch,
  sql: string,
  params: readonly unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const result = await s.pool.query(sql, params as unknown[]);
  return result.rows as Record<string, unknown>[];
}

/* --------------------- actors --------------------- */

/** T060's published `Actor`, built here rather than imported so a fixture reads as a fixture. */
export const anonymous = { kind: "anonymous" } as const;
export const account = (accountId: string, handle: string | null = null) =>
  ({ kind: "account", accountId, handle }) as const;
export const operator = (accountId: string) => ({ kind: "operator", accountId }) as const;

/** Unique per run and per process, so two suite files never mint the same identifier. */
let counter = 0;
export function mark(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

/* --------------------- the simple fixtures --------------------- */

export interface AccountFixture {
  id: string;
  handle: string;
}

export async function insertAccount(s: Scratch, handle: string): Promise<AccountFixture> {
  const [row] = await query(
    s,
    "insert into account (github_id, github_login, handle) values ($1, $2, $3) returning id",
    [`gh-${handle}`, `login-${handle}`, handle],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the account fixture: got ${describe_(id)} for its id.`);
  }
  return { id, handle };
}

export interface CardOptions {
  id: string;
  version?: string;
  name?: string;
  action?: string;
  notes?: string;
  phases?: readonly string[];
}

/** A complete `NodeCard`. Every required field of `lib/core/card/schema.ts` is present. */
export function nodeCard(o: CardOptions): NodeCard {
  return {
    id: o.id,
    name: o.name ?? "Fixture Card",
    type: "agent",
    phases: [...(o.phases ?? [])],
    action: o.action ?? "do-the-fixture-thing",
    spec: "A self-sufficient instruction for the fixture node.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [],
    notes: o.notes,
    version: o.version ?? "1.0.0",
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

export interface CardFixture {
  rowId: string;
  cardId: string;
  version: string;
  ref: CardRef;
  digest: string;
  body: NodeCard;
  visibility: "public" | "private";
}

export async function insertCard(
  s: Scratch,
  o: CardOptions & { ownerId: string; visibility?: "public" | "private" },
): Promise<CardFixture> {
  const body = nodeCard(o);
  const digest = cardDigest(body);
  const visibility = o.visibility ?? "public";
  const [row] = await query(
    s,
    "insert into card_version (card_id, version, digest, owner_id, visibility, body, source) " +
      "values ($1, $2, $3, $4, $5, $6, $7) returning id",
    [body.id, body.version, digest, o.ownerId, visibility, JSON.stringify(body), cardSource(body)],
  );
  const rowId = row?.id;
  if (typeof rowId !== "string") {
    throw new Error(`Could not insert the card fixture: got ${describe_(rowId)} for its id.`);
  }
  return {
    rowId,
    cardId: body.id,
    version: body.version,
    ref: `${body.id}@${body.version}` as CardRef,
    digest,
    body,
    visibility,
  };
}

export function manifest(slug: string, o: { tags?: readonly string[]; summary?: string } = {}): BundleManifest {
  return {
    slug,
    title: `Fixture ${slug}`,
    summary: o.summary ?? `A fixture blueprint named ${slug}.`,
    description: undefined,
    category: undefined,
    tags: [...(o.tags ?? [])],
    author: undefined,
  };
}

/** Plausible DOT for `release.dot`, which is NOT NULL. Nothing that reads it resolves it. */
export function dotFor(refs: readonly CardRef[]): string {
  const nodes = refs.map((ref, i) => `  n${i} [card="${ref}"];`).join("\n");
  return `digraph fixture {\n${nodes}\n}\n`;
}

export interface BundleFixture {
  id: string;
  releaseId: string;
  ownerId: string;
  ownerHandle: string;
  slug: string;
  visibility: "public" | "private";
}

/**
 * A bundle AND one release, always together: B-06 makes a bundle a blueprint at its first
 * publish, and T080's readers project from the current release. A bundle with no release is a
 * state this file creates only where a cell names it.
 *
 * The DOT here is `dotFor`'s placeholder, so this fixture is for the readers that never
 * resolve one. Anything reaching `resolveBundle` uses `seedContentRelease` instead.
 */
export async function insertBundle(
  s: Scratch,
  o: {
    owner: AccountFixture;
    slug: string;
    visibility?: "public" | "private";
    cards?: readonly CardFixture[];
    manifest?: BundleManifest;
    version?: string;
    /** Skip the release, for the "a bundle with no current release" case. */
    withoutRelease?: boolean;
  },
): Promise<BundleFixture> {
  const visibility = o.visibility ?? "public";
  const [bundleRow] = await query(
    s,
    "insert into bundle (owner_id, slug, visibility) values ($1, $2, $3) returning id",
    [o.owner.id, o.slug, visibility],
  );
  const id = bundleRow?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the bundle fixture: got ${describe_(id)} for its id.`);
  }
  if (o.withoutRelease === true) {
    return { id, releaseId: "", ownerId: o.owner.id, ownerHandle: o.owner.handle, slug: o.slug, visibility };
  }

  const cards = o.cards ?? [];
  const cardRefs = cards.map((c) => c.ref);
  const cardDigests = cards.map((c) => c.digest);
  const dot = dotFor(cardRefs);
  const [releaseRow] = await query(
    s,
    "insert into release (bundle_id, version, digest, dot, manifest, card_refs, card_digests) " +
      "values ($1, $2, $3, $4, $5, $6, $7) returning id",
    [
      id,
      o.version ?? "1.0.0",
      bundleDigest({ dot, cardDigests }),
      dot,
      JSON.stringify(o.manifest ?? manifest(o.slug)),
      cardRefs,
      cardDigests,
    ],
  );
  const releaseId = releaseRow?.id;
  if (typeof releaseId !== "string") {
    throw new Error(`Could not insert the release fixture: got ${describe_(releaseId)}.`);
  }
  return { id, releaseId, ownerId: o.owner.id, ownerHandle: o.owner.handle, slug: o.slug, visibility };
}

/* --------------------- the scorecard stand-in (D-260-24) --------------------- */

/**
 * A COMPLETE scorecard, written straight onto the row.
 *
 * ── it is no longer more complete than the writer, and that is the change ──
 * This fixture used to be, and its docblock said so at length. D-260-24 measured that
 * nothing wrote `release.scored_ontology_version_id`: `publish.ts` wrote
 * `analysis: {autonomy, security, phaseCoverage}` and `registry/scores.ts` required a
 * fourth, so `scoresOf` answered `undefined` for every blueprint ever published and the
 * batch reader answered an EMPTY map over the whole seeded store. A positive control had to
 * stamp the column by hand and therefore measured a state the product could not reach —
 * the T200 shape this project has paid for once, "a suite passing against seeded data that
 * no writer creates".
 *
 * The fourth column is not merely out of the rule now, it is out of the database:
 * `0009_drop_ontology_versioning` dropped it and the `ontology_version` table it referenced,
 * and `AutonomyResult` lost its own version stamp with them. A three-payload scorecard IS
 * the complete one and this fixture writes exactly what a publish writes, column for column.
 *
 * The three payloads are the shapes `AddReleaseInput.analysis` declares and `scores.ts` casts
 * back to (D-260-28: the payloads agree on both sides).
 */
export async function stampScorecard(
  s: Scratch,
  releaseId: string,
  o: {
    autonomy?: unknown;
    security?: unknown;
    phaseCoverage?: unknown;
  } = {},
): Promise<void> {
  await query(
    s,
    "update release set autonomy = $1, security = $2, phase_coverage = $3 where id = $4",
    [
      JSON.stringify({
        autonomyClass: "supervised",
        level: 2,
        ...(o.autonomy as Record<string, unknown> | undefined),
      }),
      JSON.stringify(o.security ?? { level: 3, raw: 3, penalties: [], findings: [], rationale: "4 to 3" }),
      JSON.stringify(o.phaseCoverage ?? { covered: ["planning"], missing: [], byPhase: {}, unphased: [] }),
      releaseId,
    ],
  );
}

/* --------------------- the shapes the contract publishes back --------------------- */

export function keyOf(key: { ownerHandle: string; slug: string }): string {
  return `${key.ownerHandle}/${key.slug}`;
}

/**
 * A batch reader's return, checked as a real `ReadonlyMap` before anything reads it.
 *
 * `Promise<ReadonlyMap<string, T>>` is what D-132-01 publishes, and a plain object keyed the
 * same way answers `.get is not a function` two frames later in whichever cell happens to run
 * first. Asserted here so the red names the shape.
 */
export function asReadonlyMap(value: unknown, where: string): ReadonlyMap<string, unknown> {
  if (!(value instanceof Map)) {
    throw new Error(
      `${where} returned ${describe_(value)}; D-132-01 publishes ` +
        `\`Promise<ReadonlyMap<string, …>>\`. A plain object keyed the same way is not one: ` +
        `\`ReadonlyMap\` is `+ "`Map`" + ` minus its mutators, and every caller does \`.get\`.`,
    );
  }
  for (const key of value.keys()) {
    if (typeof key !== "string") {
      throw new Error(
        `${where} is keyed by ${describe_(key)}; D-132-01 keys it ` + "`${ownerHandle}/${slug}`" +
          `, a string, which is also what \`RegistrySnapshot.byKey\` already uses.`,
      );
    }
  }
  return value as ReadonlyMap<string, unknown>;
}

export interface GraphEntry {
  graph: { nodes: readonly Record<string, unknown>[]; edges: readonly Record<string, unknown>[]; dot: string };
  requiredAgents: readonly string[];
  requiredTools: readonly string[];
}

/** D-132-01's value, checked member by member: the shape is part of the published signature. */
export function asGraphEntry(value: unknown, where: string): GraphEntry {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${where} is ${describe_(value)}; D-132-01 publishes ` +
        `\`{ graph: BlueprintGraph; requiredAgents: readonly string[]; requiredTools: ` +
        `readonly string[] }\`.`,
    );
  }
  const r = value as Record<string, unknown>;
  const graph = r.graph;
  if (graph === null || typeof graph !== "object") {
    throw new Error(`${where}.graph is ${describe_(graph)}; it is a \`BlueprintGraph\`.`);
  }
  const g = graph as Record<string, unknown>;
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges) || typeof g.dot !== "string") {
    throw new Error(
      `${where}.graph is { nodes: ${describe_(g.nodes)}, edges: ${describe_(g.edges)}, dot: ` +
        `${describe_(g.dot)} }; \`BlueprintGraph\` (lib/types.ts:163) is \`{ nodes: ` +
        `FlowNodeSeed[]; edges: FlowEdgeSeed[]; dot: string }\`, and \`ContentRow\` reads the ` +
        `first two for the drawing and the third for the DOT source panel.`,
    );
  }
  for (const name of ["requiredAgents", "requiredTools"] as const) {
    const list = r[name];
    if (!Array.isArray(list) || list.some((item) => typeof item !== "string")) {
      throw new Error(
        `${where}.${name} is ${describe_(list)}; D-132-01 publishes \`readonly string[]\`.`,
      );
    }
  }
  return {
    graph: {
      nodes: g.nodes as Record<string, unknown>[],
      edges: g.edges as Record<string, unknown>[],
      dot: g.dot,
    },
    requiredAgents: r.requiredAgents as string[],
    requiredTools: r.requiredTools as string[],
  };
}

/* --------------------- leak scanning over a Map --------------------- */

/**
 * The value a leak sweep may actually be run over.
 *
 * **T080's `collectStrings` is BLIND to a `Map`, and both readers T132 adds return one.** It
 * walks `Object.entries(node)`, and a Map's entries are not own enumerable properties — so
 * `findTokens(map, tells)` answers `[]` against a map whose KEYS are the private slugs. The
 * sweep would be green, in the exact shape this project calls a tautology announcing itself.
 *
 * So every batch return is expanded before it is scanned, and `privacy.test.ts` carries a
 * cell that plants a tell in a key and a tell in a value and requires this function to find
 * both. An instrument this suite wrote is worth exactly what its own falsification is worth.
 */
export function leakSurface(value: unknown): unknown {
  const seen = new Set<object>();
  const expand = (node: unknown): unknown => {
    if (node === null || typeof node !== "object") return node;
    if (seen.has(node)) return "[cycle]";
    seen.add(node);
    if (node instanceof Map) return [...node.entries()].map(([k, v]) => [expand(k), expand(v)]);
    if (node instanceof Set) return [...node.values()].map(expand);
    if (Array.isArray(node)) return node.map(expand);
    if (node instanceof Date) return node;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      out[key] = expand(item);
    }
    return out;
  };
  return expand(value);
}

/* --------------------- counting the queries a call issues --------------------- */

/**
 * How many statements a call puts on the wire, counted on the pool THIS SUITE HANDED IN.
 *
 * D-260-21 is a cost ruling and nothing else in this suite can see it: a `graphsOf` that
 * loops `loadSnapshot` once per key is functionally perfect and passes every other cell here,
 * while being the exact thing the batch reader exists to prevent — "N snapshots + 3N score
 * queries … on every load, growing with a registry whose whole point under AC1 is that it
 * grows between deploys."
 *
 * The observer is legitimate here because the handle is the one the reader is given: `db` is
 * drizzle over this pool, so every statement the reader issues through it passes one of the
 * two functions patched below. `connect()` is patched as well as `query()` because a reader
 * that checked out a client — for a transaction, say — would otherwise issue its statements
 * past a counter watching the wrong door, and the cell would read zero and call it a batch.
 *
 * Zero is therefore a claim about the instrument, and the cell that uses this asserts a
 * NON-ZERO baseline before it compares anything.
 */
export async function countQueries<T>(s: Scratch, run: () => Promise<T>): Promise<{ result: T; queries: number }> {
  const pool = s.pool as unknown as {
    query: (...args: unknown[]) => unknown;
    connect: (...args: unknown[]) => unknown;
  };
  const realQuery = pool.query.bind(pool);
  const realConnect = pool.connect.bind(pool);
  let queries = 0;
  pool.query = (...args: unknown[]) => {
    queries += 1;
    return realQuery(...args);
  };
  pool.connect = (...args: unknown[]) => {
    /* `pool.query` checks a client out through `pool.connect(callback)` INTERNALLY, and in
       that form `connect` returns undefined and answers through the callback. Wrapping it as
       a promise made every internal checkout reject with "cannot read properties of
       undefined", 22 unhandled rejections deep, while the assertion above still read a
       plausible number — an instrument failing loudly in a channel nobody was asserting on.
       The callback form is passed straight through; `pool.query` is already counted. */
    if (args.some((arg) => typeof arg === "function")) return realConnect(...args);
    return (async () => {
      const client = (await realConnect(...args)) as { query: (...a: unknown[]) => unknown };
      const clientQuery = client.query.bind(client);
      client.query = (...a: unknown[]) => {
        queries += 1;
        return clientQuery(...a);
      };
      return client;
    })();
  };
  try {
    const result = await run();
    return { result, queries };
  } finally {
    pool.query = realQuery;
    pool.connect = realConnect;
  }
}

/* --------------------- the fixture gate --------------------- */

/**
 * A setup failure, recorded and re-raised PER CELL rather than left in the hook.
 *
 * A throw in `beforeAll` produces SKIPS, not reds: the run stands down rather than failing,
 * and this repository has measured 127 merged cells going silent under one broken writer
 * while a suite that recorded its setup failure and re-raised it per cell went red on the
 * same defect. The protocol asks for one red per criterion, so the hook records and the cells
 * raise.
 *
 * It also closes a masking order that costs nothing to avoid and is invisible when it bites:
 * a cell that binds the absent module FIRST reports "the member is missing" whether or not
 * its fixture ever built, so a suite whose seeding silently did nothing looks exactly like a
 * suite in the ordinary blind position. Every helper here calls `fixture()` before `bind()`.
 */
export class FixtureGate {
  private error: unknown;
  private ready = false;
  private scratch: Scratch | undefined;

  /** Run the seeding, recording whatever it throws and re-raising so the hook is honest too. */
  async build(run: () => Promise<Scratch>): Promise<Scratch> {
    try {
      this.scratch = await run();
      this.ready = true;
      return this.scratch;
    } catch (err) {
      this.error = err;
      throw err;
    }
  }

  /** The scratch database, or a red naming the setup failure as the setup failure. */
  get(): Scratch {
    if (this.error !== undefined) {
      throw new Error(
        `This suite's fixture did not build, so this cell measures nothing about the module ` +
          `under test. The cause is attached. A red here is a broken fixture and NOT a failed ` +
          `acceptance criterion.`,
        { cause: this.error },
      );
    }
    if (!this.ready || this.scratch === undefined) {
      throw new Error(
        `This suite's \`beforeAll\` did not finish, and this cell ran anyway. Nothing below it ` +
          `has been planted, so a red here says nothing about the module under test.`,
      );
    }
    return this.scratch;
  }
}
