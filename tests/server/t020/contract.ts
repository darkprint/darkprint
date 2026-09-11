/* ============================================================
   T020 — the blind suite's harness

   Not a test file: `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this is `.ts`, so nothing here runs on its own.

   ── the Published signatures block is binding ──
   T020 names one record and seven functions. This file binds those
   exact names and fails loudly when one is absent, quoting the
   clause that published it. There is no candidate list anywhere in
   this suite: a list is a guess, and across T000 a guess resolved
   twice to the wrong export — once reporting a defect that did not
   exist, once selecting the one function that could not be
   isolated. Where the contract genuinely leaves something unnamed
   it is reported to the orchestrator, not resolved here.

   ── one database per file, created and dropped ──
   Through `createTestDb` from `@/tests/support`, which creates
   `darkprint_test_<uuid>`, migrates it and drops it. The hand-off
   for this task directs the suite here, and the helper implements
   the isolation rule the shared database cannot: nothing in this
   suite ever opens `DATABASE_URL` itself.

   `tests/support/env.ts`'s header once said the opposite ("Not for
   `tests/server/**`"), written when the directory did not exist on
   a test branch. It is on `backend` now and this worktree is rebased
   on `backend`, so the broken-import hazard it was written against
   is gone.
   ============================================================ */

import { getTableConfig } from "drizzle-orm/pg-core";

import { CORE_ONTOLOGY, cardDigest, loadCard, ontologyView, type NodeCard } from "@/lib/core";
import { schema } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;
export type Row = Record<string, unknown>;

/**
 * T020's Published signatures block, quoted so a red says where a name comes
 * from and not merely that a test wanted it. Nothing outside this object is a name this
 * suite is entitled to expect.
 */
export const PUBLISHED = {
  module:
    "T020 owns `lib/server/cards/**`, and T000's public-import-surface rule — every owned " +
    "directory publishes a barrel and downstream code imports only through it — makes that " +
    "barrel `@/lib/server/cards`",
  cardRecord:
    "interface CardRecord { id: string; cardId: string; version: string; digest: string; " +
    'ownerId: string; visibility: "public" | "private"; body: NodeCard; source: string; ' +
    "createdAt: Date }",
  addCard:
    "addCard(db: Db, input: { cardId: string; version: string; ownerId: string; " +
    'visibility?: "public" | "private"; body: NodeCard; source: string }): Promise<CardRecord> ' +
    "— digest is COMPUTED here, never supplied",
  getCard:
    "getCard(db: Db, actor: Actor, cardId: string, version: string): Promise<CardRecord | undefined>",
  getLatestCard:
    "getLatestCard(db: Db, actor: Actor, cardId: string): Promise<CardRecord | undefined>",
  listCardVersions:
    "listCardVersions(db: Db, actor: Actor, cardId: string): Promise<CardRecord[]>",
  resolveCardRef:
    "resolveCardRef(db: Db, actor: Actor, ref: CardRef): Promise<CardRecord | undefined>",
  findCardsByDigest:
    "findCardsByDigest(db: Db, actor: Actor, digest: string): Promise<CardRecord[]>",
  sourceVsBody:
    "`source` is `text` and is BYTE-identical on read-back; `body` is `jsonb` and can only " +
    "be VALUE-identical, because jsonb preserves neither key order nor number spelling",
  actorFilter:
    "Every read takes an `Actor` and filters through T060. A denied read returns `undefined` " +
    "or omits the row; it never throws and never returns a 403",
  refuseNotRepair:
    "Content that cannot survive storage is refused, not repaired: every string in `source`, " +
    "`body` and reachable inside `body` that fails `String.prototype.isWellFormed()`. Not a " +
    "blanket unicode ban — ZWJ emoji, Arabic, CJK and combining marks must still round-trip",
  errorsCarryNothing:
    "Every error leaving this module is a typed `Error` whose own properties are exactly " +
    '["message", "cause"], with `cause` non-enumerable so `JSON.stringify` cannot reach it, ' +
    "and a `message` built only from the caller's own identifiers",
  latestIsSemver:
    "“Latest” is the highest semver, not the most recent row. Order with `compareSemver`, and " +
    "give every list a total order (a `, id` tiebreak behind the semver comparison)",
} as const;

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Date) return `a Date (${value.toISOString()})`;
  return typeof value;
}

/* --------------------- the module --------------------- */

/**
 * Cached as a promise rather than an awaited value: a rejected import is cached once for the
 * whole file, so every test gets its own copy of the same red instead of one test's failure
 * surfacing as an unhandled rejection in the next.
 */
let cardsModule: Promise<Namespace> | undefined;

export function loadCards(): Promise<Namespace> {
  cardsModule ??= import("@/lib/server/cards").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `@/lib/server/cards could not be imported: ${String(cause)}\n` +
          `  the contract publishes: ${PUBLISHED.module}\n` +
          `  This is the module the seven card functions live behind. A capability reachable ` +
          `only by a deep path is not part of the public interface.`,
      );
    },
  );
  return cardsModule;
}

function requiredFn(mod: Namespace, name: string, clause: string): UnknownFn {
  const value = mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  if (value === undefined) {
    throw new Error(
      `@/lib/server/cards exports no \`${name}\`.\n` +
        `  the contract publishes: ${clause}\n` +
        `  found: ${exported}\n` +
        `  This is a failed acceptance criterion, not a naming difference. T020's ` +
        `Published signatures block names this export exactly. Do not add a synonym to a list ` +
        `here; publish the name the contract states.`,
    );
  }
  if (typeof value !== "function") {
    throw new Error(
      `@/lib/server/cards exports \`${name}\` as ${describe_(value)}; the contract publishes ` +
        `it as a function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/** The seven functions, bound by their published names and nothing else. */
export interface Cards {
  addCard: UnknownFn;
  getCard: UnknownFn;
  getLatestCard: UnknownFn;
  listCardVersions: UnknownFn;
  resolveCardRef: UnknownFn;
  findCardsByDigest: UnknownFn;
}

export async function cards(): Promise<Cards> {
  const mod = await loadCards();
  return {
    addCard: requiredFn(mod, "addCard", PUBLISHED.addCard),
    getCard: requiredFn(mod, "getCard", PUBLISHED.getCard),
    getLatestCard: requiredFn(mod, "getLatestCard", PUBLISHED.getLatestCard),
    listCardVersions: requiredFn(mod, "listCardVersions", PUBLISHED.listCardVersions),
    resolveCardRef: requiredFn(mod, "resolveCardRef", PUBLISHED.resolveCardRef),
    findCardsByDigest: requiredFn(mod, "findCardsByDigest", PUBLISHED.findCardsByDigest),
  };
}

/* --------------------- the database --------------------- */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the drizzle instance every T020 function takes first. */
  db: unknown;
  /** The client that produced it, for the assertions no published reader can answer. */
  query: (sql: string, params?: readonly unknown[]) => Promise<Row[]>;
}

export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(
      `createTestDb's client carries no \`db\`. \`Db\` is published from @/lib/db and is the ` +
        `first parameter of every T020 function.`,
    );
  }
  return {
    db,
    query: async (sql, params) => {
      const result = await test.client.query(sql, params as unknown[]);
      return result.rows as Row[];
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
 * `card_version.owner_id` is a foreign key to `account`, and accounts are T050's. A fixture
 * row goes in by hand rather than through a function nothing has published yet.
 */
export async function insertAccount(scratch: Scratch, mark: string): Promise<string> {
  const [row] = await scratch.query(
    "insert into account (github_id, github_login, handle) values ($1, $2, $3) returning id",
    [`gh-${mark}`, `login-${mark}`, `handle-${mark}`],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the account fixture: got ${describe_(id)} for its id.`);
  }
  return id;
}

/* --------------------- actors --------------------- */

/** T060's published `Actor`, built here rather than imported so a fixture reads as a fixture. */
export const anonymous = { kind: "anonymous" } as const;
export const account = (accountId: string, handle: string | null = null) =>
  ({ kind: "account", accountId, handle }) as const;
export const operator = (accountId: string) => ({ kind: "operator", accountId }) as const;

/* --------------------- card fixtures --------------------- */

const ontology = ontologyView(CORE_ONTOLOGY);

export interface CardFixture {
  cardId: string;
  version: string;
  source: string;
  body: NodeCard;
  digest: string;
}

export interface CardOptions {
  id: string;
  version?: string;
  name?: string;
  type?: string;
  author?: string;
  provenance?: string;
  notes?: string;
  outputType?: string;
  extraCannot?: readonly string[];
}

/** The wire form. snake_case, because that is what a card looks like on disk. */
export function cardSource(o: CardOptions): string {
  const lines = [
    `id: ${o.id}`,
    `name: ${o.name ?? "Fixture Card"}`,
    `type: ${o.type ?? "agent"}`,
    "phase: planning",
    "action: >-",
    "  Do exactly the one thing this fixture describes and stop.",
    "spec: >-",
    "  You are handed one fixture input. Produce the one output named below and stop; do not",
    "  begin any work beyond it.",
    "inputs: []",
    "outputs:",
    "  - name: result",
    `    type: ${o.outputType ?? "json"}`,
    "    description: The fixture result.",
    "dependencies: []",
    /* The prose entry is under `will_not` and the term ids under `cannot`, because the two
       fields take different things: `cannot` holds `data-type` term ids the resolver checks
       every incoming edge against, and a sentence there is `card/unknown-term`, an error
       this fixture's own guard below would refuse to build past. `requires_human` used to
       follow; it was withdrawn from the schema, and a document still carrying it earns a
       `card/retired-field` warning that would appear in every diagnostics assertion this
       suite makes. */
    "cannot:",
    ...(o.extraCannot ?? []).map((c) => `  - ${c}`),
    "will_not:",
    "  - begin any work beyond the one output",
    "risk_markers: []",
  ];
  if (o.notes !== undefined) lines.push(`notes: ${JSON.stringify(o.notes)}`);
  lines.push(`version: ${o.version ?? "1.0.0"}`);
  lines.push(`author: ${o.author ?? "fixture-author"}`);
  if (o.provenance !== undefined) lines.push(`provenance: ${JSON.stringify(o.provenance)}`);
  lines.push("ontology_version: 0.1.0", "");
  return lines.join("\n");
}

/**
 * A fixture the engine accepts, with its `source`, its parsed `body` and the digest
 * `lib/core` computes over it. A fixture that stops validating fails here, as a fixture
 * error naming its diagnostics, rather than as a contract red somewhere downstream.
 */
export function card(o: CardOptions): CardFixture {
  const source = cardSource(o);
  const loaded = loadCard(source, { ontology });
  const errors = loaded.diagnostics.filter((d) => d.severity === "error");
  if (loaded.card === undefined || errors.length > 0) {
    throw new Error(
      `The fixture for ${o.id}@${o.version ?? "1.0.0"} does not validate, so it cannot be ` +
        `used to test storage:\n  ` +
        errors.map((d) => `${d.code}: ${d.message}`).join("\n  "),
    );
  }
  return {
    cardId: loaded.card.id,
    version: loaded.card.version,
    source,
    body: loaded.card,
    digest: cardDigest(loaded.card),
  };
}

/** A marker no other run can mint, so no two runs contend for one `(card_id, version)`. */
let counter = 0;
export function marker(label: string): string {
  counter += 1;
  return `t020-${label}-${process.pid}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A card id has to match `CARD_ID`: lowercase alphanumerics and single hyphens. */
export function cardIdFor(label: string): string {
  return marker(label).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* --------------------- what the schema says its constraint is called --------------------- */

/**
 * Read from `lib/db/schema.ts` at runtime rather than restated here. The contract requires
 * the module's literal be tied to the schema's; a test that hard-coded the string a fourth
 * time would drift with them instead of catching the drift. Reading `schema.ts` is not
 * editing it, so no Forbidden file is touched.
 */
export function uniqueIndexName(): string {
  const unique = getTableConfig(schema.cardVersion).indexes.filter((i) => i.config.unique);
  if (unique.length !== 1 || typeof unique[0]?.config.name !== "string") {
    throw new Error(
      `Expected exactly one unique index on card_version; found ` +
        `${JSON.stringify(getTableConfig(schema.cardVersion).indexes.map((i) => i.config.name))}.`,
    );
  }
  return unique[0].config.name;
}

/* --------------------- error hygiene --------------------- */

/**
 * The Error built-ins every engine attaches whatever the author does. `stack` is an own
 * property of any `new Error()` in V8 — `Object.getOwnPropertyNames(new Error("x"))` is
 * `["stack", "message"]` — so the contract's "own properties are exactly ['message',
 * 'cause']" is read as "and nothing of its own beyond these", with `stack` set aside. Taken
 * literally it could only be satisfied by deleting `stack`, which would cost every real
 * failure its trace. Reported to the orchestrator rather than asserted as written.
 */
const ERROR_BUILTINS = new Set(["stack", "message"]);

export function ownPropertiesBeyondBuiltins(err: object): string[] {
  return Object.getOwnPropertyNames(err)
    .filter((k) => !ERROR_BUILTINS.has(k))
    .sort();
}

/** Every rendering of an error a route or a log could reach. */
export function renderings(err: unknown): { label: string; text: string }[] {
  const out = [
    { label: "String(err)", text: String(err) },
    { label: "JSON.stringify(err)", text: JSON.stringify(err) ?? "undefined" },
  ];
  if (err !== null && typeof err === "object") {
    out.push({ label: "err.message", text: String((err as { message?: unknown }).message ?? "") });
    for (const key of Object.keys(err)) {
      out.push({
        label: `own enumerable property ${key}`,
        text: safeText((err as Record<string, unknown>)[key]),
      });
    }
  }
  return out;
}

function safeText(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
