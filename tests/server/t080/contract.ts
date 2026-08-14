/* ============================================================
   T080 — the blind contract surface

   Not a test file. `vitest.config.ts` reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── why every load is a dynamic import ──
   These tests were written in a worktree branched before the
   implementation existed. A static top-level import of a module
   that is not on disk fails the whole *file* at collection, which
   reports one red where the protocol asks for one per acceptance
   criterion and hides six criteria behind the first missing
   module. Loading inside the test that needs it turns "the module
   is not there yet" into exactly the per-criterion red the
   hand-off is supposed to produce. The specifier stays a literal
   so the `@` alias resolves — which also means `tsc` reports
   TS2307 for it on this branch, and that is the same fact the
   reds report, not a second one.

   ── no candidate lists ──
   Every name is bound exactly and its absence quotes the clause
   that publishes it. T000 paid two rounds for the alternative: one
   list resolved `encodeSession` instead of the cookie writer and
   produced five false reports of a broken round trip, another
   resolved the one migration function with no database parameter.
   Where the contract has a name, guessing is worse than binding.

   ── what this suite reads and what it writes ──
   T080 is a *reader*. Nothing it publishes puts a row anywhere, so
   the fixtures go in through `@/lib/db`'s published client with
   plain SQL — the same route T020's blind suite took for its
   `account` rows, and for the same reason: the writers for these
   tables belong to tasks that have not merged (T050 accounts,
   T100 publishing) or are Forbidden here (`lib/server/archive/**`).
   Seeding through another task's writer would also make every red
   ambiguous between the two modules.
   ============================================================ */

import {
  cardDigest,
  bundleDigest,
  type BundleManifest,
  type CardRef,
  type NodeCard,
} from "@/lib/core";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const REGISTRY = "@/lib/server/registry";

let registry: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, and every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadRegistry(): Promise<Namespace> {
  registry ??= import("@/lib/server/registry").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${REGISTRY} does not load.\n` +
          `  backend.md §T080 owns \`lib/server/registry/**\` and publishes thirteen readers: ` +
          `${READER_NAMES.join(", ")}.\n` +
          `  This is a failed acceptance criterion — the read model is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return registry;
}

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of backend.md §T080, quoted so a red says where the name
 * comes from and not merely that a test wanted it. `BlueprintSummary` and `CardSummary`
 * replace `lib/core`'s `BlueprintRecord`/`CardVersionRecord` throughout the block per
 * D-80-01, and `scoresOf` is the thirteenth reader added by D-80-02b.
 */
export const PUBLISHED = {
  blueprints: "blueprints(db: Db, actor: Actor): Promise<readonly BlueprintSummary[]>",
  blueprint:
    "blueprint(db: Db, actor: Actor, ownerHandle: string, slug: string): " +
    "Promise<BlueprintSummary | undefined>",
  cards: "cards(db: Db, actor: Actor): Promise<readonly CardSummary[]>",
  latestCards: "latestCards(db: Db, actor: Actor): Promise<readonly CardSummary[]>",
  versionsOf:
    "versionsOf(db: Db, actor: Actor, cardId: string): Promise<readonly CardSummary[]>",
  card: "card(db: Db, actor: Actor, ref: CardRef): Promise<CardSummary | undefined>",
  usersOf:
    "usersOf(db: Db, actor: Actor, cardId: string): Promise<readonly BlueprintSummary[]>",
  duplicates:
    "duplicates(db: Db, actor: Actor): Promise<readonly (readonly CardSummary[])[]>",
  phases: "phases(db: Db, actor: Actor): Promise<readonly string[]>",
  cardsByPhase:
    "cardsByPhase(db: Db, actor: Actor, phase: string): Promise<readonly CardSummary[]>",
  tags: "tags(db: Db, actor: Actor): Promise<readonly string[]>",
  categories: "categories(db: Db, actor: Actor): Promise<readonly string[]>",
  scoresOf:
    "scoresOf(db: Db, actor: Actor, ownerHandle: string, slug: string): " +
    "Promise<Scores | undefined> — D-80-02b, the thirteenth reader, because AC7 was " +
    "unreachable through any published surface without it",
} as const;

export type ReaderName = keyof typeof PUBLISHED;

/** Thirteen, in the order the block publishes them. AC6 is asserted across every one. */
export const READER_NAMES = Object.keys(PUBLISHED) as ReaderName[];

function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, source: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${source} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. The Published ` +
      `signatures block names this export exactly, and the rule above it ("the contract must ` +
      `name the interface, not only the behaviour") exists because two rounds of candidate ` +
      `lists in T000 each resolved to the wrong thing. Do not add a synonym here; publish ` +
      `the name the contract states.`,
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

/* --------------------- the eleven routes (D-80-02) --------------------- */

/**
 * D-80-02 publishes eleven route paths, their methods and their response shapes, because
 * two acceptance criteria live only there. The module specifier for each is derived from
 * the published URL by the App Router's own file convention — `app/api/…/route.ts` with a
 * `[segment]` folder per dynamic part — so nothing here is invented: the path is the
 * contract's and the mapping is Next's.
 *
 * `context.params` is a **promise** in this version
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`),
 * so a handler is invoked with one, never with a plain object.
 */
export interface RouteSpec {
  /** The published URL template, used in failure messages so a red quotes the contract. */
  url: string;
  /** The response body key the contract publishes at 200. */
  payloadKey: string;
}

export const ROUTES = {
  blueprints: { url: "GET /api/blueprints", payloadKey: "blueprints" },
  blueprint: { url: "GET /api/blueprints/[owner]/[slug]", payloadKey: "blueprint" },
  cards: { url: "GET /api/cards", payloadKey: "cards" },
  card: { url: "GET /api/cards/[...ref]", payloadKey: "card" },
  versions: { url: "GET /api/cards/[id]/versions", payloadKey: "versions" },
  users: { url: "GET /api/cards/[id]/users", payloadKey: "users" },
  duplicates: { url: "GET /api/cards/duplicates", payloadKey: "groups" },
  phases: { url: "GET /api/ontology/phases", payloadKey: "phases" },
  phaseCards: { url: "GET /api/ontology/phases/[phase]/cards", payloadKey: "cards" },
  tags: { url: "GET /api/ontology/tags", payloadKey: "tags" },
  categories: { url: "GET /api/ontology/categories", payloadKey: "categories" },
} as const satisfies Record<string, RouteSpec>;

export type RouteName = keyof typeof ROUTES;

/**
 * The literal specifiers, spelled out one per line rather than built from `ROUTES`: a
 * dynamic `import()` needs a literal for the `@` alias to resolve, and a template built
 * from a table would resolve to nothing at all.
 */
const ROUTE_LOADERS: Record<RouteName, () => Promise<unknown>> = {
  blueprints: () => import("@/app/api/blueprints/route"),
  blueprint: () => import("@/app/api/blueprints/[owner]/[slug]/route"),
  cards: () => import("@/app/api/cards/route"),
  card: () => import("@/app/api/cards/[...ref]/route"),
  versions: () => import("@/app/api/cards/[id]/versions/route"),
  users: () => import("@/app/api/cards/[id]/users/route"),
  duplicates: () => import("@/app/api/cards/duplicates/route"),
  phases: () => import("@/app/api/ontology/phases/route"),
  phaseCards: () => import("@/app/api/ontology/phases/[phase]/cards/route"),
  tags: () => import("@/app/api/ontology/tags/route"),
  categories: () => import("@/app/api/ontology/categories/route"),
};

/** The `GET` a route file publishes, bound exactly. */
export async function routeGet(name: RouteName): Promise<UnknownFn> {
  const spec = ROUTES[name];
  let mod: Namespace;
  try {
    mod = (await ROUTE_LOADERS[name]()) as Namespace;
  } catch (cause) {
    throw new Error(
      `The route module for \`${spec.url}\` does not load.\n` +
        `  backend.md §T080 D-80-02 publishes this route, its method and its 200 body ` +
        `\`{ ${spec.payloadKey}: … }\`, because "two acceptance criteria live only there".\n` +
        `  The App Router maps that URL onto a \`route.ts\` with one folder per segment, so ` +
        `this is a failed acceptance criterion and not a guessed path.`,
      { cause },
    );
  }
  const get = mod.GET;
  if (typeof get !== "function") {
    throw new Error(
      `The route module for \`${spec.url}\` exports no \`GET\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}). D-80-02 publishes the method.`,
    );
  }
  return get as UnknownFn;
}

/** Invoke a route handler the way the App Router does: a `Request`, and `params` as a promise. */
export async function callRoute(
  name: RouteName,
  path: string,
  params: Record<string, string | string[]> = {},
): Promise<Response> {
  const get = await routeGet(name);
  const request = new Request(`https://darkprint.test${path}`);
  const answered = await get(request, { params: Promise.resolve(params) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${ROUTES[name].url}\` answered ${describe_(answered)}; a route handler returns a ` +
        `Response (${"node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md"}).`,
    );
  }
  return answered;
}

/* --------------------- the database --------------------- */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the drizzle instance every T080 reader takes first. */
  db: unknown;
  /** The connection string of this scratch database, for the routes' shared client. */
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

/**
 * A database of this file's own. `createTestDb()` creates `darkprint_test_<uuid>`, migrates
 * it and drops it on `drop()`; it never opens the shared development database that
 * `DATABASE_URL` names, which is the whole reason T000 built it (D-08).
 */
export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(
      `createTestDb's client carries no \`db\`. \`Db\` is published from @/lib/db and is the ` +
        `first parameter of every T080 reader.`,
    );
  }
  /* `createTestDb` does not hand back the URL it built, and the route half of this suite
     needs one: `getSharedDbClient()` reads `DATABASE_URL`, so a route can only be pointed
     at this database by naming it. Asked of the connection itself rather than rebuilt from
     a convention or read off `pool.options` — which carries nothing when the pool was
     opened from a connection string — so it cannot drift from what the client is on. */
  const [current] = (await test.client.query("select current_database() as name")).rows as {
    name?: unknown;
  }[];
  const database = current?.name;
  if (typeof database !== "string" || database === "") {
    throw new Error(
      `\`select current_database()\` answered ${describe_(database)}, so the route handlers ` +
        `cannot be pointed at this scratch database.`,
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

/* --------------------- fixtures --------------------- */

/** Unique per run and per process, so two suite files never mint the same identifier. */
let counter = 0;
export function mark(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

export interface CardOptions {
  id: string;
  version?: string;
  phases?: readonly string[];
  name?: string;
  action?: string;
  spec?: string;
  notes?: string;
  type?: string;
  tags?: readonly string[];
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
    requiresHuman: false,
    riskMarkers: [],
    notes: o.notes,
    version: o.version ?? "1.0.0",
    ontologyVersion: "0.1.0",
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
    ontologyVersion: "0.1.0",
  };
}

/** The wire form of a card. Stored verbatim in `card_version.source`, which is NOT NULL. */
function cardSource(card: NodeCard): string {
  return [
    `id: ${card.id}`,
    `name: ${card.name}`,
    `type: ${card.type}`,
    `version: ${card.version}`,
    `ontology_version: ${card.ontologyVersion}`,
    `action: ${card.action}`,
    `spec: ${JSON.stringify(card.spec)}`,
    "",
  ].join("\n");
}

/** Plausible DOT for `release.dot`, which is NOT NULL. Nothing published reads it. */
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
  return { rowId, cardId: body.id, version: body.version, ref: `${body.id}@${body.version}`, digest, body };
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
  /**
   * Refs to pin that no `card_version` row answers. `release.card_refs` is a `text[]` with
   * no foreign key, so a dangling pin is a state the schema permits and T120's account
   * deletion can produce.
   */
  danglingRefs?: readonly CardRef[];
  /** Explicit row id, for the "tiebroken on row id" half of D-80-03. */
  id?: string;
  createdAt?: string;
  autonomy?: unknown;
  security?: unknown;
  phaseCoverage?: unknown;
  scoredOntologyVersionId?: string;
}

export interface ReleaseFixture {
  id: string;
  version: string;
  digest: string;
  cardRefs: readonly CardRef[];
}

export async function insertRelease(s: Scratch, o: ReleaseOptions): Promise<ReleaseFixture> {
  const cardRefs = [...o.cards.map((c) => c.ref), ...(o.danglingRefs ?? [])];
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
    "scored_ontology_version_id",
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
    o.scoredOntologyVersionId ?? null,
  ];
  if (o.id !== undefined) {
    columns.unshift("id");
    values.unshift(o.id);
  }
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
  return { id, version: o.version, digest, cardRefs };
}

export interface OntologyFixture {
  id: string;
  version: string;
  digest: string;
}

export async function insertOntologyVersion(
  s: Scratch,
  version: string,
  digest: string,
): Promise<OntologyFixture> {
  const [row] = await s.query(
    "insert into ontology_version (version, digest) values ($1, $2) returning id",
    [version, digest],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the ontology version fixture: got ${describe_(id)}.`);
  }
  return { id, version, digest };
}

/* --------------------- the shapes the contract publishes back --------------------- */

export interface BlueprintSummary {
  ownerHandle: string;
  slug: string;
  manifest: BundleManifest;
  digest: string;
  cardRefs: readonly CardRef[];
}

export interface CardSummary {
  ref: CardRef;
  id: string;
  version: string;
  digest: string;
  card: NodeCard;
  usedIn: readonly { ownerHandle: string; slug: string }[];
}

export function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${where} returned ${describe_(value)}; the contract publishes an array.`);
  }
  return value as unknown[];
}

/** D-80-01's record, checked field by field: the shape is part of the published signature. */
export function asBlueprintSummary(value: unknown, where: string): BlueprintSummary {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} returned ${describe_(value)}; the contract publishes BlueprintSummary.`);
  }
  const r = value as Partial<BlueprintSummary>;
  for (const key of ["ownerHandle", "slug", "digest"] as const) {
    if (typeof r[key] !== "string" || r[key] === "") {
      throw new Error(
        `${where} returned \`${key}\` = ${JSON.stringify(r[key])}; D-80-01 publishes ` +
          `\`interface BlueprintSummary { ownerHandle: string; slug: string; manifest: ` +
          `BundleManifest; digest: string; cardRefs: readonly CardRef[] }\`. \`ownerHandle\` ` +
          `is the half the record was missing: without it \`alice/foo\` and \`bob/foo\` are ` +
          `indistinguishable to a caller.`,
      );
    }
  }
  if (r.manifest === null || typeof r.manifest !== "object") {
    throw new Error(`${where} returned \`manifest\` = ${describe_(r.manifest)}; it is a BundleManifest.`);
  }
  if (!Array.isArray(r.cardRefs)) {
    throw new Error(`${where} returned \`cardRefs\` = ${describe_(r.cardRefs)}; it is CardRef[].`);
  }
  return r as BlueprintSummary;
}

export function asCardSummary(value: unknown, where: string): CardSummary {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} returned ${describe_(value)}; the contract publishes CardSummary.`);
  }
  const r = value as Partial<CardSummary>;
  for (const key of ["ref", "id", "version", "digest"] as const) {
    if (typeof r[key] !== "string" || r[key] === "") {
      throw new Error(
        `${where} returned \`${key}\` = ${JSON.stringify(r[key])}; D-80-01 publishes ` +
          `\`interface CardSummary { ref: CardRef; id: string; version: string; digest: ` +
          `string; card: NodeCard; usedIn: readonly { ownerHandle: string; slug: string }[] }\`.`,
      );
    }
  }
  if (r.card === null || typeof r.card !== "object") {
    throw new Error(`${where} returned \`card\` = ${describe_(r.card)}; it is a NodeCard.`);
  }
  if (!Array.isArray(r.usedIn)) {
    throw new Error(
      `${where} returned \`usedIn\` = ${describe_(r.usedIn)}; D-80-01 makes it ` +
        `\`{ ownerHandle, slug }[]\` and not the bare slug list \`lib/core\` documented — ` +
        `"it is documented as blueprint slugs" is exactly the hole the amendment closes.`,
    );
  }
  for (const [i, use] of (r.usedIn as unknown[]).entries()) {
    if (use === null || typeof use !== "object") {
      throw new Error(`${where}.usedIn[${i}] is ${describe_(use)}; it is { ownerHandle, slug }.`);
    }
    const u = use as { ownerHandle?: unknown; slug?: unknown };
    if (typeof u.ownerHandle !== "string" || typeof u.slug !== "string") {
      throw new Error(
        `${where}.usedIn[${i}] is ${JSON.stringify(use)}; D-80-01 makes every entry ` +
          `owner-qualified, because two owners may hold the same slug.`,
      );
    }
  }
  return r as CardSummary;
}

/** `{ ownerHandle, slug }` as one comparable, sortable string. Never sent anywhere. */
export function keyOf(x: { ownerHandle: string; slug: string }): string {
  return `${x.ownerHandle}/${x.slug}`;
}

/* --------------------- leak scanning --------------------- */

/**
 * Every string reachable inside a value, keys included. A leak can arrive as a property
 * name as easily as a property value — `byPhase` is a `Record<string, string[]>` and a
 * phase only a private card declares is a *key* there.
 *
 * Written as a walk with a `seen` set rather than `JSON.stringify`: the input is whatever
 * the module returned, and a value that cycles or carries a `toJSON` would make
 * stringification either throw or quietly answer a different question. T-02's `seen` set
 * for the same reason it exists there — shared substructure is walked once.
 */
export function collectStrings(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (node instanceof Date) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      out.push(key);
      walk(item);
    }
  };
  walk(value);
  return out;
}

/** Which of `tokens` appear anywhere inside `value`. Sorted, so a red reads the same twice. */
export function findTokens(value: unknown, tokens: readonly string[]): string[] {
  const strings = collectStrings(value);
  const hits = new Set<string>();
  for (const token of tokens) {
    for (const s of strings) {
      if (s.includes(token)) {
        hits.add(token);
        break;
      }
    }
  }
  return [...hits].sort();
}

/**
 * T-04's fix, applied before the tells are used rather than after one over-matches.
 *
 * A blacklist asserted with `includes` answers "do these characters appear", where the
 * claim is "did this leak". The two differ exactly when a tell is a substring of something
 * a response may legitimately carry — `card_version` inside `card_version_id_version_key`,
 * a pid of `23505`. So every tell is checked against every string the *admissible* fixtures
 * contain, at fixture time, and a collision is a broken test rather than a red. That turns
 * "these characters do not appear" into "these characters cannot appear except by leaking",
 * which is the claim actually being made.
 */
export function assertTellsCannotOverMatch(
  tells: readonly string[],
  admissible: readonly unknown[],
): void {
  const strings = admissible.flatMap((value) => collectStrings(value));
  const collisions: string[] = [];
  for (const tell of tells) {
    if (tell === "") {
      collisions.push("(empty string)");
      continue;
    }
    for (const s of strings) {
      if (s.includes(tell)) {
        collisions.push(`${JSON.stringify(tell)} is a substring of ${JSON.stringify(s)}`);
        break;
      }
    }
  }
  if (collisions.length > 0) {
    throw new Error(
      `A private-content tell is a substring of admissible fixture content, so the leak ` +
        `sweep would red an implementation that leaked nothing (T-04).\n  ` +
        collisions.join("\n  ") +
        `\n  This is a broken test. Re-mint the fixture identifier; do not delete the tell.`,
    );
  }
}
