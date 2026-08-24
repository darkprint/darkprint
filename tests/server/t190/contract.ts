/* ============================================================
   T190 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this module is imported by the suites beside it.

   ── what this author could and could not see ──
   GIVEN, and read: `backend.md` §T190 in full with D-190-01..05,
   §T110, §T050, §T060, §T120, §T005; `lib/data/account.ts`;
   `lib/db/schema.ts`; the barrels of
   `lib/server/{policy,http,auth,archive,publish,lineage,ontology}`;
   `lib/core`'s `canonicalJson` and `contentDigest`; `tests/support/**`;
   the merged blind suites under `tests/server/t1NN/`.

   T190's OWN, and never opened: `lib/server/notifications/**`,
   `app/api/account/notifications/**`,
   `lib/db/migrations/0005_notifications.*`, the branch
   `feat/t190-notify`. Its implementer was not contacted.

   ── the pins are LITERALS ──
   Every expected string, every published name and every digest in
   this file is written out and never imported from
   `@/lib/server/notifications`. An expectation built from the module
   under test asserts "does the module agree with itself" and passes
   unchanged the day the module starts interpolating a driver value.
   A later change that derives one of these from the module is a
   REMOVED ASSERTION and is to be treated as one.

   That rule has one deliberate extension here, because D-190-02(4)
   publishes the digest as `contentDigest(canonicalJson(subject))`
   from `@/lib/core`. Recomputing it with those same two functions
   would be a consistency check: the module and this file would call
   one implementation and agree with each other about whatever it
   does. So `PINNED_DIGESTS` below carries digests computed OUTSIDE
   this repository entirely (`printf | shasum -a 256`), and
   `instruments.test.ts` reds if `@/lib/core` ever stops agreeing
   with them. That is the second axis; the recomputation is the
   convenience.

   ── the six rulings this suite binds ──
   Reported from this side before a cell was written, ruled by the
   orchestrator, published in §T190 at `28828a8`. The sentences they
   overturn are GONE from this file rather than left standing beside
   them: an amendment is not applied until the text it replaces is
   removed, or a reader binds to whichever it reaches first and that
   is a function of line order rather than of authority.

   D-190-02(1) THE PREFERENCE CHECK LIVES AT `enqueue`. A kind that
               is OFF for the account writes NO ROW. So AC2's cells
               assert 0 rows (off) and 1 row + 1 delivery (on), and
               the reading where the queue always fills and the
               sender filters is WITHDRAWN.
   D-190-02(2) `enqueue` writes NOTHING for a tombstoned account.
   D-190-02(3) Rows are RETAINED after delivery; `delivered_at` is
               the drain cursor, not a retry state machine.
   D-190-02(4) `subject_digest` = `contentDigest(canonicalJson(s))`.
   D-190-03    `unsubscribe` SETS the preference to FALSE and is
               NEVER a toggle — the section's "flips" is corrected
               here. The token is its OWN table, minted by `enqueue`
               per `(account_id, kind)` and carried on the delivery
               message, which is how a cell obtains one.
   D-190-04    The fork emission is ONE granted call site inside
               `forkBundle`, public path only. Visibility must never
               travel in `subject`. Deprecation's recipient is
               UNDERIVABLE and AC3 is narrowed to subject CARRIAGE.
   D-190-05    Three admissible message forms, not two —
               `getPreferences` gained one. An operator passes all
               three preference verbs. `setPreferences({})` is a
               no-op; unknown keys are ignored and NEVER PERSISTED.
               `app/api/internal/events/**` is struck and NOT BUILT.
               A source cell may read the barrel through `node:fs`.

   ── every cell binds the module LAST ──
   After its premises and after its planting. An early red masks
   every write below it while being correct about its own subject,
   and a red in 0ms where I/O was expected is a cell that never
   started.

   ── nothing throws in a hook ──
   A throw in `beforeAll` runs no test: it moves the SKIPPED count
   and adds nothing to the failed column. Setup that can fail is
   recorded and re-raised per cell.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";

import { canonicalJson, contentDigest } from "@/lib/core";
import { createDbClient, migrateUp, type Db, type DbClient } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import type { Actor } from "@/lib/server/policy";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

/* ============================================================
   The barrel
   ============================================================ */

export const NOTIFICATIONS = "@/lib/server/notifications";

let notifications: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, so every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 *
 * Called from inside each test and never from a hook, for the reason in the header.
 */
export function loadNotifications(): Promise<Namespace> {
  notifications ??= import("@/lib/server/notifications").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${NOTIFICATIONS} does not load.\n` +
          `  backend.md §T190 owns \`lib/server/notifications/**\` and publishes ` +
          `${PUBLISHED_NAMES.join(", ")} from the barrel \`${NOTIFICATIONS}\`.\n` +
          `  This is a failed acceptance criterion — the notifications module is absent — and ` +
          `not a broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return notifications;
}

/** The barrel file on disk. The only thing that separates *a member is absent* from *an assertion failed*. */
export const BARREL_FILE = fileURLToPath(
  new URL("../../../lib/server/notifications/index.ts", import.meta.url),
);

/**
 * The barrel's source, or `undefined` when the module does not exist yet.
 *
 * D-190-05 ratifies this: a source cell may read the barrel through `node:fs` at run time, and
 * its author never opens it. A type-level instrument cannot observe its own blindness — types
 * erase, so a cell of pure type assertions is green against a module that is not there.
 */
export function barrelSource(): string | undefined {
  try {
    return readFileSync(BARREL_FILE, "utf8");
  } catch {
    return undefined;
  }
}

/* ============================================================
   What the contract publishes, quoted verbatim

   The Published signatures block of backend.md §T190, so a red says
   where a name comes from rather than merely that a test wanted it.
   ============================================================ */

export const PUBLISHED = {
  getPreferences: "getPreferences(db: Db, actor: Actor, accountId: string): Promise<Preferences>",
  setPreferences:
    "setPreferences(db: Db, actor: Actor, accountId: string, patch: Partial<Preferences>): " +
    "Promise<Preferences>",
  enqueue:
    "enqueue(db: Db, event: { kind: EventKind; accountId: string; subject: Record<string, " +
    "string> }): Promise<void>",
  unsubscribe: "unsubscribe(db: Db, token: string): Promise<{ kind: EventKind }>",
  deliverPending:
    "deliverPending(db: Db, delivery: NotificationDelivery, limit: number | undefined = " +
    "undefined): Promise<number>",
  enqueueRepinEvents:
    "enqueueRepinEvents(db: Db, cardId: string, version: string, publisherAccountId: string | " +
    "undefined = undefined): Promise<void>",
  DEFAULT_PREFERENCES: "DEFAULT_PREFERENCES: Preferences",
} as const;

export type PublishedName = keyof typeof PUBLISHED;
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/** The six the block publishes as functions. `DEFAULT_PREFERENCES` is a value and is not one. */
export const PUBLISHED_FUNCTIONS = PUBLISHED_NAMES.filter(
  (name) => name !== "DEFAULT_PREFERENCES",
);

/**
 * Declared arity, for the kind check on each binding.
 *
 * `Function.length` stops at the first parameter with a default, which is why `deliverPending`
 * is 2 and not 3: the block writes `limit: number | undefined = undefined`. An implementation
 * spelling it `limit?: number` would answer 2 as well — `?` erases at runtime — so this is a
 * lower bound on the surface and is asserted as one.
 */
export const MIN_ARITY: Record<string, number> = {
  getPreferences: 3,
  setPreferences: 4,
  enqueue: 2,
  unsubscribe: 2,
  deliverPending: 2,
  /* Still 3 after D-190-09(2) added `publisherAccountId`: the ruling spells it
     `string | undefined = undefined` ("the arity spelling, per T250's rule"), and
     `Function.length` stops at the first parameter carrying a default. A `publisherAccountId?:
     string` would answer 3 as well — `?` erases at runtime — so this bound cannot tell the two
     spellings apart and does not claim to. */
  enqueueRepinEvents: 3,
};

/* ============================================================
   The pins
   ============================================================ */

/** `type EventKind = "repin" | "fork" | "deprecation" | "digest"`, in the block's own order. */
export const EVENT_KINDS = ["repin", "fork", "deprecation", "digest"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** `interface Preferences { repin; fork; deprecation; digest }` — the same four ids. */
export const PREFERENCE_KEYS = ["repin", "fork", "deprecation", "digest"] as const;

export interface PreferencesShape {
  repin: boolean;
  fork: boolean;
  deprecation: boolean;
  digest: boolean;
}

/**
 * D-190-05's constant, written out.
 *
 * NOT imported from `@/lib/server/notifications` (that is the module under test) and NOT
 * imported from `@/lib/data/account` either — `preferences.test.ts` compares this literal
 * against `ACCOUNT.notifications` as a genuine second axis, and an expectation derived from
 * the thing it is compared to cannot disagree with it.
 */
export const DEFAULT_PREFERENCES_PIN: PreferencesShape = {
  repin: true,
  fork: true,
  deprecation: true,
  digest: false,
};

/**
 * The three admissible message forms. D-190-05: "the section's 'whole set' sentence now covers
 * THREE forms." Anything else in a rendering is a leak, and this list is what makes that
 * measurable rather than a matter of opinion.
 */
export const MESSAGE_FORMS = {
  getPreferences: "getPreferences: not this account's owner.",
  setPreferences: "setPreferences: not this account's owner.",
  unsubscribe: "unsubscribe: this link is no longer valid.",
} as const;

export const ADMISSIBLE_MESSAGES: readonly string[] = Object.values(MESSAGE_FORMS);

/**
 * Digests computed OUTSIDE this repository — `printf '%s' '<canonical>' | shasum -a 256`,
 * prefixed with `contentDigest`'s own `sha256:` tag.
 *
 * The canonical form is RFC-8785 in spirit: keys sorted by code unit, no whitespace. So
 * `{ upstream, fork }` and `{ fork, upstream }` are the same bytes, which is the collision
 * D-190-02(4) requires and which `idempotence.test.ts` drives.
 */
export const PINNED_DIGESTS: readonly { canonical: string; digest: string; subject: Record<string, string> }[] = [
  {
    canonical: '{"fork":"b1","slug":"t190-up"}',
    digest: "sha256:0c26ac710fe063fd12736f36dbf741c8e2698a92e018ace734223cd197f47056",
    subject: { slug: "t190-up", fork: "b1" },
  },
  {
    canonical: '{"cardId":"core.card","version":"2.0.0"}',
    digest: "sha256:d5f1ade9300a683f794f4b8a3296d59e8e2b85dc14d92d88377bb3408823f856",
    subject: { cardId: "core.card", version: "2.0.0" },
  },
  {
    canonical: '{"period":"2026-W35"}',
    digest: "sha256:6c2f09f16f69770a86eb0e411efc60b7e2cd4b4d96be16f40f82d630b80bf652",
    subject: { period: "2026-W35" },
  },
  {
    canonical: '{"replacedBy":"core.successor","termId":"core.legacy"}',
    digest: "sha256:2d64f1f2bc80f74cc44b09a081492a2f8a36b06dbc396859b0a7d7ce13818197",
    subject: { termId: "core.legacy", replacedBy: "core.successor" },
  },
];

/**
 * D-190-07 (amended) publishes all four subject shapes as CONTRACT, so they are written out
 * once here and consumed everywhere rather than re-spelled per file:
 *
 *     fork:        { slug: <upstream slug>, fork: <forking bundle's id> }
 *     repin:       { cardId: <BARE card id, never id@version>, version: <new version> }
 *     deprecation: { termId, replacedBy? }
 *     digest:      { period: <ISO week> }
 *
 * `fork` carries the FORKING bundle's id, and that key is load-bearing rather than
 * descriptive: the unique key is `(kind, account_id, subject_digest)`, so a subject naming
 * only the upstream would announce the first forker and silently swallow every one after.
 */
export const SUBJECT_SHAPE: Record<string, readonly string[]> = {
  fork: ["slug", "fork"],
  repin: ["cardId", "version"],
  deprecation: ["termId"],
  digest: ["period"],
};

/** What the queue row's `subject_digest` must hold for `subject`, per D-190-02(4). */
export function subjectDigest(subject: Record<string, string>): string {
  return contentDigest(canonicalJson(subject));
}

/* ============================================================
   Binding
   ============================================================ */

/** What a value is, for a failure message that does not make the reader go looking. */
export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Response) return `a Response (${value.status})`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  return typeof value;
}

/**
 * A name the block publishes. Absent is a red and the red says so: the whole point of a
 * Published signatures block is that the name is no longer either side's to choose.
 *
 * The barrel is read from disk for the message, so a red distinguishes *the module is not
 * there* from *the module is there and this member is missing*.
 */
export async function bindValue(name: PublishedName): Promise<unknown> {
  const mod = await loadNotifications();
  const value = mod[name];
  if (value !== undefined) return value;
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${NOTIFICATIONS} exports no \`${name}\`.\n` +
      `  the contract publishes: ${PUBLISHED[name]}\n` +
      `  found: ${exported}\n` +
      `  ${barrelSource() === undefined ? "The barrel file does not exist." : "The barrel file exists and does not name it."}\n` +
      `  This is a failed acceptance criterion, not a naming difference.`,
  );
}

export async function bind(name: PublishedName): Promise<UnknownFn> {
  const value = await bindValue(name);
  if (typeof value !== "function") {
    throw new Error(
      `${NOTIFICATIONS} exports \`${name}\` as ${describe_(value)}; the contract publishes it ` +
        `as a function: ${PUBLISHED[name]}`,
    );
  }
  return value as UnknownFn;
}

/* ============================================================
   The database each suite owns

   Named `darkprint_t190_<tag>_<pid>` rather than by an opaque uuid,
   because a scratch database nobody can attribute cannot be told
   from a neighbour's leak by anything but its creation time, and
   creation time does not separate two sessions running at once.
   The orchestrator brackets Postgres by name; this is what makes
   that bracket able to name me.
   ============================================================ */

const MAINTENANCE_DATABASE = "postgres";

function databaseUrlFor(name: string): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "DATABASE_URL is not set. `tests/server/contract.ts` publishes it as one of the eight " +
        "environment variables both branches read. Run `docker compose up -d` and " +
        "`set -a; . ./.env; set +a` first.",
    );
  }
  const url = new URL(base);
  url.pathname = `/${name}`;
  return url.toString();
}

export interface Scratch {
  /** The published `Db` — the first parameter of every T190 function. */
  db: Db;
  /** For the fixture rows and the direct schema reads D-190-02 rules admissible. */
  pool: Pool;
  client: DbClient;
  name: string;
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
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

const open: Scratch[] = [];

export async function scratchDatabase(tag: string): Promise<Scratch> {
  const name = `darkprint_t190_${tag}_${process.pid}`;

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

  /* The premise of everything below, checked rather than hoped for: T000 round 2 had two suites
     each drop the other's tables because a client ignored the connection string it was handed. */
  const where = await client.pool.query<{ name: string }>("select current_database() as name");
  if (where.rows[0]?.name !== name) {
    await client.close();
    await withAdmin((admin) => dropDatabase(admin, name));
    throw new Error(
      `This file created ${name} and asked createDbClient for it, and the client connected to ` +
        `"${String(where.rows[0]?.name)}" instead.`,
    );
  }

  const scratch: Scratch = {
    db: client.db,
    pool: client.pool,
    client,
    name,
    url,
    query: async (sql, params) =>
      (await client.pool.query(sql, params as unknown[])).rows as Record<string, unknown>[],
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
    try {
      await scratch.drop();
      dropped += 1;
    } catch {
      /* Teardown is not under test; a database left behind is reported by the bracket. */
    }
  }
  return dropped;
}

/**
 * Open `n` connections at once and hold them until all `n` are up.
 *
 * A COLD `pg` pool serialises concurrent callers: the first caller's `connect` wins and the
 * rest queue behind it, so `Promise.all` over an unwarmed pool measures a sequence and calls
 * it a race. AC5's idempotency cell is about two callers genuinely inside the same window, so
 * the pool is warmed first and the cell says so.
 */
export async function warmPool(scratch: Scratch, n: number): Promise<void> {
  const clients = await Promise.all(Array.from({ length: n }, () => scratch.pool.connect()));
  await Promise.all(clients.map((c) => c.query("select 1")));
  for (const c of clients) c.release();
}

/* ============================================================
   Actors — plain data, exactly as T060 publishes it
   ============================================================ */

export const ANONYMOUS: Actor = { kind: "anonymous" };

export function accountActor(accountId: string, handle: string | null = null): Actor {
  return { kind: "account", accountId, handle };
}

/**
 * B-13's break-glass subject. D-190-05: an operator passes all three preference verbs — the
 * refusal sentences' "owner" wording is the common case, not policy. The `Actor` union has
 * three members and a suite that silently drives two has decided.
 */
export function operatorActor(accountId: string): Actor {
  return { kind: "operator", accountId };
}

export interface NonOwner {
  label: string;
  /** Why this shape is here, so a red says which ruling it is about. */
  because: string;
  actor: (ownerId: string) => Actor;
}

/**
 * Every shape that is NOT the owner and NOT the operator, and which a wrong implementation
 * would plausibly grant.
 *
 * The last three discriminate a module that DELEGATES to `can` from one that re-implements
 * ownership as `actor.accountId === accountId`. Only an actor whose identity is real but not
 * its own can measure that.
 */
export const NON_OWNERS: readonly NonOwner[] = [
  {
    label: "an anonymous caller",
    because: "T060: an account's own settings are visible and changeable only to the account.",
    actor: () => ANONYMOUS,
  },
  {
    label: "a different signed-in account",
    because: "T060: a signed-in visitor is still not the owner.",
    actor: () => accountActor("00000000-0000-4000-8000-000000000001", "stranger"),
  },
  {
    label: "an account carrying no identity at all",
    because:
      'T060: `""` never matches `""` — it is what a half-built session row and an unset ' +
      "column both look like.",
    actor: () => accountActor("", null),
  },
  {
    label: "the missing-session shape `{}`",
    because: "T060: `can` fails closed; `{}` is precisely the missing session.",
    actor: () => ({}) as unknown as Actor,
  },
  {
    label: "an actor INHERITING the owner's id",
    because:
      "T060 N-2/N-4: authority is never inherited. A module re-implementing ownership as " +
      "`actor.accountId === accountId` grants here; one delegating to `can` denies, because " +
      "`isOwner` reads both fields through `Object.hasOwn`.",
    actor: (ownerId) =>
      Object.create({ kind: "account", accountId: ownerId, handle: null }) as Actor,
  },
  {
    label: "an actor INHERITING operator authority",
    because: 'T060 N-2: `Object.create({kind:"operator",accountId:"x"})` is not an operator.',
    actor: () => Object.create({ kind: "operator", accountId: "op" }) as Actor,
  },
  {
    label: "an operator with no id",
    because:
      "T060: possession of a discriminant is not authority — an actor whose `kind` is " +
      '`"operator"` must carry a non-empty `accountId` to be one.',
    actor: () => ({ kind: "operator" }) as unknown as Actor,
  },
];

/* ============================================================
   Planting

   SQL rather than `upsertFromGitHub`, because what is wanted is a
   row with a chosen handle and a chosen `notification_preferences`,
   not a GitHub sign-in flow. T080, T100 and T110 all seed this way.
   ============================================================ */

let counter = 0;

/** Unique per run and per process, so two suite files never mint the same identifier. */
export function mark(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

/** A uuid nothing in the database is keyed by. */
export function absentUuid(): string {
  return randomUUID();
}

/**
 * A token no admissible message can contain, alphanumeric on purpose.
 *
 * A tell that can occur naturally reds like a real leak — a fixture's `process.pid` could
 * contain a SQLSTATE. Twenty-two random characters cannot arrive in a rendering except by
 * something putting them there.
 */
export function plantedToken(): string {
  return `zq${randomUUID().replaceAll("-", "").slice(0, 22)}`;
}

export interface Planted {
  accountId: string;
  handle: string;
  email: string;
  actor: Actor;
}

/**
 * An account row.
 *
 * `preferences` is written into `account.notification_preferences` VERBATIM, `{}` included —
 * that column is `jsonb NOT NULL DEFAULT '{}'` and AC4's whole subject is what a `{}` reads
 * as. The handle is kept inside `validateNamespace`'s grammar so nothing downstream refuses
 * it for a reason that has nothing to do with this task.
 */
export async function plantAccount(
  scratch: Scratch,
  handle: string,
  preferences: Record<string, unknown> = {},
): Promise<Planted> {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/u.test(handle)) {
    throw new Error(
      `plantAccount(${handle}): this suite's own handles must be lowercase alphanumeric with ` +
        `hyphens and at most 32 characters, or the naming grammar refuses them before any ` +
        `T190 code runs.`,
    );
  }
  const email = `${handle}@darkprint.test`;
  const rows = await scratch.query(
    "insert into account (github_id, github_login, handle, email, notification_preferences) " +
      "values ($1, $2, $3, $4, $5::jsonb) returning id",
    [randomUUID(), handle, handle, email, JSON.stringify(preferences)],
  );
  const accountId = rows[0]?.id;
  if (typeof accountId !== "string") {
    throw new Error(`plantAccount(${handle}) inserted no row.`);
  }
  return { accountId, handle, email, actor: accountActor(accountId, handle) };
}

/** The raw `notification_preferences` cell, so a cell can prove what was and was not persisted. */
export async function preferencesColumn(
  scratch: Scratch,
  accountId: string,
): Promise<Record<string, unknown> | undefined> {
  const rows = await scratch.query(
    "select notification_preferences as prefs from account where id = $1",
    [accountId],
  );
  const prefs = rows[0]?.prefs;
  if (prefs === undefined) return undefined;
  return prefs as Record<string, unknown>;
}

export async function setPreferencesColumn(
  scratch: Scratch,
  accountId: string,
  value: Record<string, unknown>,
): Promise<void> {
  await scratch.query("update account set notification_preferences = $2::jsonb where id = $1", [
    accountId,
    JSON.stringify(value),
  ]);
}

/* ============================================================
   The queue and the tokens

   Read with SQL, which D-190-02 rules admissible: "direct schema
   reads from cells are admissible". The column names are the
   block's own, so a red on one of them is a schema disagreement
   and says so rather than looking like a criterion failure.
   ============================================================ */

export interface QueueRow {
  id: string;
  kind: string;
  accountId: string;
  subject: Record<string, string>;
  subjectDigest: string;
  deliveredAt: Date | null;
  createdAt: Date;
}

const QUEUE_COLUMNS =
  "id, kind::text as kind, account_id, subject, subject_digest, delivered_at, created_at";

function asQueueRow(row: Record<string, unknown>): QueueRow {
  return {
    id: String(row.id),
    kind: String(row.kind),
    accountId: String(row.account_id),
    subject: (row.subject ?? {}) as Record<string, string>,
    subjectDigest: String(row.subject_digest),
    deliveredAt: (row.delivered_at ?? null) as Date | null,
    createdAt: row.created_at as Date,
  };
}

/**
 * Every queue row, oldest first. `accountId` narrows it.
 *
 * Throws a message naming the table when the table is not there, rather than letting a bare
 * `42P01` reach a cell — an undefined-table error reads as a criterion failure to anyone who
 * did not write this file.
 */
export async function queueRows(scratch: Scratch, accountId?: string): Promise<QueueRow[]> {
  try {
    const rows =
      accountId === undefined
        ? await scratch.query(
            `select ${QUEUE_COLUMNS} from notification_queue order by created_at, id`,
          )
        : await scratch.query(
            `select ${QUEUE_COLUMNS} from notification_queue where account_id = $1 ` +
              `order by created_at, id`,
            [accountId],
          );
    return rows.map(asQueueRow);
  } catch (cause) {
    throw new Error(
      `\`notification_queue\` could not be read.\n` +
        `  backend.md §T190's block publishes it as ` +
        `\`notification_queue (id, kind notification_kind, account_id -> account, subject jsonb, ` +
        `subject_digest, delivered_at timestamptz NULL, created_at) UNIQUE (kind, account_id, ` +
        `subject_digest)\`, in migration \`0005_notifications\`.\n` +
        `  D-190-02 rules direct schema reads from cells admissible, so this is the published ` +
        `shape and not a guess.`,
      { cause },
    );
  }
}

export interface TokenRow {
  token: string;
  accountId: string;
  kind: string;
  createdAt: Date;
}

export async function tokenRows(scratch: Scratch, accountId?: string): Promise<TokenRow[]> {
  const columns = "token, account_id, kind::text as kind, created_at";
  try {
    const rows =
      accountId === undefined
        ? await scratch.query(`select ${columns} from unsubscribe_token order by created_at`)
        : await scratch.query(
            `select ${columns} from unsubscribe_token where account_id = $1 order by created_at`,
            [accountId],
          );
    return rows.map((row) => ({
      token: String(row.token),
      accountId: String(row.account_id),
      kind: String(row.kind),
      createdAt: row.created_at as Date,
    }));
  } catch (cause) {
    throw new Error(
      `\`unsubscribe_token\` could not be read.\n` +
        `  backend.md §T190's block publishes it as \`unsubscribe_token (token PK, account_id -> ` +
        `account, kind, created_at) UNIQUE (account_id, kind)\`, in \`0005_notifications\`.`,
      { cause },
    );
  }
}

/* ============================================================
   The delivery seam, driven with a recording fake

   D-190-03: `NotificationDelivery.send` takes `accountId` and never
   an address, so every email address stays out of this module BY
   CONSTRUCTION. The fake below records what it was handed and can
   be told to fail on a chosen call.

   ── a delivery is a RESOLUTION, never a call ──
   AC5 is "retries without delivering twice", and a `send` that
   throws did not deliver. Counting calls would score the failed
   attempt as a delivery and make the criterion unfalsifiable, so
   `delivered` is stamped after the send's own promise resolves.
   ============================================================ */

export interface DeliveredMessage {
  kind: string;
  accountId: string;
  subject: Record<string, string>;
  unsubscribeToken: string;
}

export interface RecordingDelivery {
  /** The seam the module is handed. */
  delivery: { send(message: DeliveredMessage): Promise<void> };
  /** Every call, in order, whether it resolved or threw. */
  attempts: DeliveredMessage[];
  /** Only the calls whose promise RESOLVED. This is what "delivered" means. */
  delivered: DeliveredMessage[];
  /** What each rejected call was handed, for a message that names the case. */
  failed: DeliveredMessage[];
}

/**
 * `failOn` is a predicate over the ONE-BASED call index, so `(n) => n === 2` is "fail on the
 * second send" — D-190-02's "fails on row 2 of 3" written as the ruling words it.
 */
export function recordingDelivery(
  failOn: (callIndex: number, message: DeliveredMessage) => boolean = () => false,
  /**
   * Milliseconds each send takes before it settles.
   *
   * Zero everywhere except D-190-09's concurrent-drain cell, and load-bearing there: with an
   * instant send the first drain can finish its whole pass before the second one reads, and
   * then an implementation with NO advisory lock passes the cell — the second drain finds
   * nothing pending and honestly answers 0. A send slow enough to hold the first pass open
   * while the second starts is what makes the two implementations answer differently.
   */
  sendMs = 0,
): RecordingDelivery {
  const attempts: DeliveredMessage[] = [];
  const delivered: DeliveredMessage[] = [];
  const failed: DeliveredMessage[] = [];
  return {
    attempts,
    delivered,
    failed,
    delivery: {
      async send(message: DeliveredMessage): Promise<void> {
        attempts.push(message);
        if (sendMs > 0) await new Promise((resolve) => setTimeout(resolve, sendMs));
        if (failOn(attempts.length, message)) {
          failed.push(message);
          throw new Error(`recordingDelivery: refusing send #${attempts.length} on purpose.`);
        }
        delivered.push(message);
      },
    },
  };
}

/** How many times `subject` was DELIVERED, by its digest — never by object identity. */
export function deliveredCountFor(
  recorder: RecordingDelivery,
  kind: string,
  subject: Record<string, string>,
): number {
  const wanted = subjectDigest(subject);
  return recorder.delivered.filter(
    (m) => m.kind === kind && subjectDigest(m.subject) === wanted,
  ).length;
}

/* ============================================================
   Renderings — D-13's hygiene clause, as an instrument
   ============================================================ */

export interface Renderings {
  message: string;
  string: string;
  json: string;
  keys: string[];
  stack: string;
}

/**
 * Every surface an error reaches a log or a reader through.
 *
 * `cause` is DESCENDED INTO deliberately: D-13 makes it the sanctioned carrier for an original
 * fault, so a scanner that refuses to look there charges nothing and a scanner that treats
 * anything found there as a leak charges every correctly-wrapped module. What is checked is
 * the RENDERING — `message`, `String(err)`, `JSON.stringify(err)` and `Object.keys` — which is
 * what actually escapes.
 */
export function renderingsOf(err: unknown): Renderings {
  if (!(err instanceof Error)) {
    const text = String(err);
    return { message: text, string: text, json: JSON.stringify(err) ?? "", keys: [], stack: "" };
  }
  return {
    message: err.message,
    string: String(err),
    json: JSON.stringify(err) ?? "",
    keys: Object.keys(err),
    stack: err.stack ?? "",
  };
}

/** Awaits a call that must reject, and says so when it resolves instead. */
export async function rejection(call: () => unknown, where: string): Promise<unknown> {
  let resolved: unknown;
  try {
    resolved = await call();
  } catch (err) {
    return err;
  }
  throw new Error(`${where} RESOLVED with ${describe_(resolved)}; the contract refuses it.`);
}

/* ============================================================
   The routes — D-190-05

   The URL is the contract's and the file layout is the
   implementation's, so the tree is WALKED rather than guessed and a
   red says "this URL is unserved" instead of "a file is missing
   from where I looked".
   ============================================================ */

export interface NotificationsRoute {
  method: string;
  path: string;
}

export const ROUTES = {
  get: { method: "GET", path: "/api/account/notifications" },
  patch: { method: "PATCH", path: "/api/account/notifications" },
  unsubscribe: { method: "GET", path: "/api/account/notifications/unsubscribe" },
} as const satisfies Record<string, NotificationsRoute>;

export type RouteName = keyof typeof ROUTES;
export const ROUTE_NAMES = Object.keys(ROUTES) as RouteName[];

const ROUTE_FILE = /^route\.tsx?$/u;
const NOTIFICATIONS_ROOT = fileURLToPath(
  new URL("../../../app/api/account/notifications/", import.meta.url),
);

interface DiscoveredRoute {
  pattern: string;
  file: string;
}

function walk(dir: string, segments: string[], out: DiscoveredRoute[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // a tree the implementation has not created yet
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walk(join(dir, entry.name), [...segments, entry.name], out);
    else if (ROUTE_FILE.test(entry.name)) {
      const suffix = segments.length > 0 ? `/${segments.join("/")}` : "";
      out.push({ pattern: `/api/account/notifications${suffix}`, file: join(dir, entry.name) });
    }
  }
}

/**
 * Deliberately NOT memoised as an empty result: an absent tree throws and a later call
 * re-walks, so the first test's timing does not decide every later test's answer.
 */
let table: DiscoveredRoute[] | undefined;

export function routeTable(): DiscoveredRoute[] {
  if (table !== undefined && table.length > 0) return table;
  const found: DiscoveredRoute[] = [];
  walk(NOTIFICATIONS_ROOT, [], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under \`app/api/account/notifications/\`.\n` +
        `  D-190-05 publishes three: ` +
        `${ROUTE_NAMES.map((n) => `${ROUTES[n].method} ${ROUTES[n].path}`).join(", ")}\n` +
        `  The tree is walked, not guessed, so this is a failed acceptance criterion rather ` +
        `than a test looking in the wrong place.`,
    );
  }
  table = found;
  return table;
}

export function servedPatterns(): string[] {
  return [...new Set(routeTable().map((r) => r.pattern))].sort();
}

/** The session cookie a signed-in caller carries, minted with T000's own published encoder. */
export function sessionCookie(accountId: string, handle: string | null = null): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
}

export interface RouteAnswer {
  status: number;
  contentType: string | null;
  body: string;
  json: unknown;
}

export async function callRoute(
  name: RouteName,
  init: { cookie?: string; body?: unknown; rawBody?: string; method?: string; query?: string } = {},
): Promise<RouteAnswer> {
  const spec = ROUTES[name];
  const entry = routeTable().find((r) => r.pattern === spec.path);
  if (entry === undefined) {
    throw new Error(
      `\`${spec.path}\` is unserved. Discovered: ${servedPatterns().join(", ")}\n` +
        `  D-190-05 publishes \`${spec.method} ${spec.path}\`.`,
    );
  }
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(entry.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(`\`${spec.path}\` does not load.`, { cause });
  }
  const method = init.method ?? spec.method;
  const handler = mod[method];
  if (typeof handler !== "function") {
    throw new Error(
      `\`${spec.path}\` exports no \`${method}\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}).\n` +
        `  D-190-05 publishes \`${spec.method} ${spec.path}\`.`,
    );
  }

  const headers: Record<string, string> = {};
  if (init.cookie !== undefined) headers.cookie = init.cookie;
  const payload =
    init.rawBody !== undefined
      ? init.rawBody
      : init.body === undefined
        ? undefined
        : JSON.stringify(init.body);
  if (payload !== undefined) headers["content-type"] = "application/json";

  const request = new Request(
    `https://darkprint.test${spec.path}${init.query === undefined ? "" : `?${init.query}`}`,
    { method, headers, ...(payload === undefined ? {} : { body: payload }) },
  );

  const answered = await (handler as UnknownFn)(request, { params: Promise.resolve({}) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${spec.method} ${spec.path}\` answered ${describe_(answered)}; a route handler returns ` +
        `a Response.`,
    );
  }
  const body = await answered.text();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = undefined;
  }
  return { status: answered.status, contentType: answered.headers.get("content-type"), body, json };
}

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithShared = typeof globalThis & { [key: symbol]: DbClient | undefined };

/**
 * Route handlers reach Postgres through `getSharedDbClient()`, which reads `DATABASE_URL` once
 * and memoises. Pointing it at a scratch database means moving the variable AND clearing the
 * memo, and putting both back afterwards — an observer on a pool handed in cannot see a module
 * that opens its own.
 */
export async function withRoutesPointedAt<T>(url: string, work: () => Promise<T>): Promise<T> {
  const g = globalThis as GlobalWithShared;
  const previousUrl = process.env.DATABASE_URL;
  const previousClient = g[SHARED_CLIENT_KEY];
  process.env.DATABASE_URL = url;
  delete g[SHARED_CLIENT_KEY];
  try {
    return await work();
  } finally {
    const opened = g[SHARED_CLIENT_KEY];
    if (opened !== undefined && opened !== previousClient) {
      try {
        await opened.close();
      } catch {
        /* Teardown is not under test. */
      }
    }
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousClient === undefined) delete g[SHARED_CLIENT_KEY];
    else g[SHARED_CLIENT_KEY] = previousClient;
  }
}

/* ============================================================
   Deferred setup, recorded rather than thrown in a hook
   ============================================================ */

export interface Deferred<T> {
  /** Runs `build` once. A failure is REMEMBERED and re-raised per cell, never left in a hook. */
  require(): Promise<T>;
  ready(): T | undefined;
}

export function deferred<T>(build: () => Promise<T>): Deferred<T> {
  let value: T | undefined;
  let failure: unknown;
  let started: Promise<void> | undefined;
  return {
    async require(): Promise<T> {
      started ??= build().then(
        (v) => {
          value = v;
        },
        (cause: unknown) => {
          failure = cause;
        },
      );
      await started;
      if (failure !== undefined) {
        throw new Error(
          `The fixture this cell needs could not be built, so the cell measured nothing. This ` +
            `is a setup failure re-raised in the cell rather than thrown in a hook — a throw ` +
            `in \`beforeAll\` runs no test and moves the SKIPPED count instead of the failed one.`,
          { cause: failure },
        );
      }
      return value as T;
    },
    ready: () => value,
  };
}
