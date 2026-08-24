/* ============================================================
   T131 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── THE BLIND POSITION HERE IS NOT T130's, AND THE DIFFERENCE
      DECIDES WHAT A RED MEANS ──
   T130's suite was written where `lib/server/profiles/**` did not
   exist: every red was "the module does not load", and its
   contract file says so in those words. **That is false of this
   task.** The barrel is MERGED on `bd89f6b` (T130 plus T132's
   amendment) and it loads today, exporting `ProfileRecord`,
   `MalformedStoredVocabularyError`, `ProfileStoreError`,
   `withProfileErrors` and `getProfile`.

   So the blind position is *barrel present, member absent*, and
   the failure has to be spelled for that: a message reading "the
   module does not load" would never fire, and a reader would learn
   nothing from the one that did. `bind` therefore lists what the
   barrel DOES export beside what the contract says it owes, which
   is the difference between "an assertion failed" and "a member is
   absent" — the distinction a type-level instrument cannot make
   about itself.

   ── every load stays a dynamic import all the same ──
   Not for the barrel, which resolves, but for the ROUTE files:
   `app/api/authors/[handle]/pinned/route.ts` does not exist yet
   and a static import of an absent path fails the whole FILE at
   collection, reporting one red where the protocol asks for one
   per acceptance criterion.

   ── no candidate lists ──
   Every name is bound exactly and its absence quotes the clause
   that publishes it. Where the contract does not publish one, this
   file says so in the clause string instead of inventing a name;
   see `PUBLISHED` below, which carries two CONTESTED entries.

   ── the fixtures go in as plain SQL ──
   Same route T020's, T080's and T130's blind suites took. The
   writers for `account`, `bundle`, `release`, `card_version` and
   `run_report` belong to other tasks, and seeding through another
   task's writer makes every red ambiguous between two modules.
   `run_report` is seeded here because `validated` is a COUNT over
   it (D-130-01) and T180 publishes no reader keyed by account, so
   the only way to plant one is the column.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getRouteMatcher } from "next/dist/shared/lib/router/utils/route-matcher.js";
import { getRouteRegex } from "next/dist/shared/lib/router/utils/route-regex.js";
import { getSortedRoutes } from "next/dist/shared/lib/router/utils/sorted-routes.js";

import {
  bundleDigest,
  cardDigest,
  type BundleManifest,
  type CardRef,
  type NodeCard,
} from "@/lib/core";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { createTestDb, type TestDb } from "@/tests/support";

/**
 * **D-131-01: the pin spelling is `lib/data/profiles.ts:29`'s own union, imported and never
 * restated.** The ruling's stated purpose is that a drift becomes a compile error instead of
 * the empty array AC3 would otherwise return.
 *
 * **That purpose is only half served by this line, and the half it misses is mine.** A type
 * import ERASES: a cell built out of type assertions alone is green against a module that
 * does not exist, so this import cannot witness anything at runtime. `pinnedRefUnionSource()`
 * below is the other half — it reads the union's own bytes off disk, which is the only thing
 * that tells *the member is absent* apart from *an assertion failed*.
 */
import type { PinnedRef } from "@/lib/data/profiles";

export type { PinnedRef };

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const PROFILES = "@/lib/server/profiles";
export const ACCOUNTS = "@/lib/server/accounts";

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of `backend.md` §T131, D-131-04, quoted so a red says where
 * the name comes from rather than merely that a test wanted it.
 *
 * **This section had no block at all until D-131-04.** Both halves reported binding to T130's
 * withdrawn one or to nothing, and the ruling is what replaced the guess with a contract. The
 * strings below are that block verbatim; a red printing one of them is printing the document.
 */
export const PUBLISHED = {
  getProfile:
    "getProfile(db: Db, actor: Actor, handle: string): Promise<ProfileRecord | undefined>",
  setPins:
    "setPins(db: Db, actor: Actor, accountId: string, pins: readonly PinnedRef[]): " +
    "Promise<ProfileRecord>",
  toggleFollow:
    "toggleFollow(db: Db, actor: Actor, handle: string): " +
    "Promise<{ watchers: number; followedByCaller: boolean }>",
  toggleSupport:
    "toggleSupport(db: Db, actor: Actor, handle: string): " +
    "Promise<{ support: number; supportedByCaller: boolean }>",
  setFollow:
    "setFollow(db: Db, actor: Actor, handle: string, following: boolean): " +
    "Promise<{ watchers: number; followedByCaller: boolean }>",
  setSupport:
    "setSupport(db: Db, actor: Actor, handle: string, supporting: boolean): " +
    "Promise<{ support: number; supportedByCaller: boolean }>",
} as const;

export type FunctionName = keyof typeof PUBLISHED;

/** In the order the Contract line names them. Any sweep is quantified over this. */
export const FUNCTION_NAMES = Object.keys(PUBLISHED) as FunctionName[];

/**
 * What the merged barrel exports at the base this suite was cut from, `bd89f6b`.
 *
 * Read off `lib/server/profiles/index.ts` at that commit and frozen here as a LIST rather than
 * a count. It is the control that makes `bind`'s red mean something: a barrel that lost
 * `getProfile` and a barrel that never gained `setPins` are different failures, and a message
 * that only says "not found" cannot tell a reader which one it met.
 */
export const MERGED_EXPORTS = [
  "MalformedStoredVocabularyError",
  "ProfileStoreError",
  "getProfile",
  "withProfileErrors",
] as const;

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (Array.isArray(value)) return `[${value.map(describe_).join(", ")}]`;
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

/* --------------------- the record shape (D-131-04) --------------------- */

/**
 * The seven members of `ProfileRecord`, exactly as D-131-04 declares them.
 *
 * **Three at the base this suite was cut from, seven here, and the move is GRANTED rather than
 * taken** (D-131-08, D-132-02 C-2's shape): `tests/server/t130/contract.ts`'s own `RECORD_KEYS`
 * goes 3 -> 7 in the same commit as the record change, which is the sanctioned path and the
 * reason that merged suite does not simply red. This table is T131's own copy and pins the
 * same seven.
 *
 * Asserted as a KEY SET rather than field by field, which is T050's AC2 precedent: an EXTRA
 * member is how a column arrives on a public surface, and no per-field assertion can see one.
 * That matters more here than it did at T130, because this task adds four members and three of
 * them are backed by new tables whose columns nobody outside it has read.
 */
export const RECORD_KEYS = [
  "author",
  "counts",
  "joinedAt",
  "pinned",
  "support",
  "validated",
  "watchers",
] as const;

/** The members of `ProfileRecord.counts`. Unchanged by T131; three since T132. */
export const COUNT_KEYS = ["blueprints", "cards", "terms"] as const;

export interface Counts {
  blueprints: number;
  cards: number;
  terms: number;
}

export interface ProfileRecord {
  author: Record<string, unknown>;
  joinedAt: Date;
  watchers: number;
  support: number;
  validated: number;
  pinned: readonly PinnedRef[];
  counts: Counts;
}

function integer(value: unknown, where: string, clause: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${where} is ${describe_(value)}; the contract publishes ${clause}.`);
  }
  return value;
}

/**
 * One element of `pinned`, checked against D-131-01's union arm by arm.
 *
 * **The null check is not defensive; it is AC3's own sentence.** "A pin whose target no longer
 * resolves is ABSENT from the array, never present as a null", and the shape that violates it
 * is `(PinnedRef | null)[]` — which keeps the array LENGTH while satisfying every length
 * assertion written about omission. So the exclusion lives here, in the shared gateway every
 * pins cell runs its answer through, rather than in whichever cell happened to think of it.
 *
 * The payload key is checked per arm for the same reason the compiler negatives in
 * `spelling.test.ts` exist: a module collapsing the two arms into one
 * optional-everything object compiles and would answer `{ kind: "blueprint", ref: ... }`.
 */
function asPinnedRef(value: unknown, where: string): PinnedRef {
  if (value === null) {
    throw new Error(
      `${where} is null.\n` +
        `  AC3: "a pin whose target no longer resolves is ABSENT from the array, never present ` +
        `as a null". A \`(PinnedRef | null)[]\` satisfies every assertion about the array's ` +
        `LENGTH and violates the criterion, which is why this is refused at the gateway.`,
    );
  }
  if (typeof value !== "object") {
    throw new Error(`${where} is ${describe_(value)}; D-131-01 publishes a tagged object.`);
  }
  const p = value as Record<string, unknown>;
  if (p.kind === "blueprint") {
    if (typeof p.slug !== "string" || p.slug === "") {
      throw new Error(
        `${where} is ${describe_(value)}; a blueprint pin is ` +
          `\`{ kind: "blueprint"; slug: string }\` (D-131-01).`,
      );
    }
    return { kind: "blueprint", slug: p.slug };
  }
  if (p.kind === "node") {
    if (typeof p.ref !== "string" || p.ref === "") {
      throw new Error(
        `${where} is ${describe_(value)}; a node pin is \`{ kind: "node"; ref: string }\` ` +
          `(D-131-01).`,
      );
    }
    return { kind: "node", ref: p.ref };
  }
  throw new Error(
    `${where} has kind ${describe_(p.kind)}; D-131-01's union admits "blueprint" and "node" ` +
      `only, and it is CONSUMED rather than restated precisely so a third spelling cannot ` +
      `arrive quietly.`,
  );
}

/**
 * `ProfileRecord`, checked member by member because the shape IS part of the published
 * signature. Every message quotes D-131-04, so a red says which clause is unmet.
 *
 * **Deliberately NOT a key-set check.** The exact key set is its own cell in `surface.test.ts`;
 * folding it in here would make every cell in the suite red on an extra member with the same
 * message, which reports one defect as thirty.
 *
 * `joinedAt` is checked for being a `Date` and nothing more. `toBeInstanceOf(Date)` admits
 * `new Date(0)` and that is exactly the trap this run records, so the VALUE assertion lives in
 * the one cell that has a fixture timestamp to compare against.
 */
export function asProfileRecord(value: unknown, where: string): ProfileRecord {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${where} returned ${describe_(value)}; the contract publishes \`ProfileRecord\`.\n` +
        `  ${PUBLISHED.getProfile}`,
    );
  }
  const r = value as Record<string, unknown>;

  if (r.author === null || typeof r.author !== "object") {
    throw new Error(
      `${where}.author is ${describe_(r.author)}; D-131-04 declares \`author: PublicAuthor\`.`,
    );
  }
  if (!(r.joinedAt instanceof Date)) {
    throw new Error(
      `${where}.joinedAt is ${describe_(r.joinedAt)}; D-131-04 declares \`joinedAt: Date\`. ` +
        `An ISO string is what \`lib/data/profiles.ts\` carries and is not what the block ` +
        `publishes.`,
    );
  }
  for (const key of ["watchers", "support", "validated"] as const) {
    integer(r[key], `${where}.${key}`, `\`${key}: number\``);
  }
  if (!Array.isArray(r.pinned)) {
    throw new Error(
      `${where}.pinned is ${describe_(r.pinned)}; D-131-04 declares ` +
        `\`pinned: readonly PinnedRef[]\` — REFS the actor can resolve, never resolved items ` +
        `(SEAM-55's \`PinnedItem[]\` is a frontend view shape and is superseded).`,
    );
  }
  r.pinned.forEach((pin, i) => asPinnedRef(pin, `${where}.pinned[${i}]`));

  const counts = r.counts;
  if (counts === null || typeof counts !== "object") {
    throw new Error(
      `${where}.counts is ${describe_(counts)}; D-131-04 declares ` +
        `\`counts: { blueprints: number; cards: number; terms: number }\`.`,
    );
  }
  const c = counts as Record<string, unknown>;
  for (const key of COUNT_KEYS) {
    integer(c[key], `${where}.counts.${key}`, `\`counts.${key}: number\``);
  }

  return r as unknown as ProfileRecord;
}

/**
 * The same seven members on the WIRE, where `joinedAt` is an ISO string.
 *
 * A separate validator rather than a loosened one: `Date` is what D-131-04 declares of the
 * module's return and JSON has no date type, so a route answering a string is correct and a
 * module answering one is not. One validator serving both would have to accept whichever the
 * caller happened to hand it, which is how a shape assertion stops being one.
 */
export function asWireProfileRecord(body: unknown, where: string): Record<string, unknown> {
  if (body === null || typeof body !== "object") {
    throw new Error(`${where} answered ${describe_(body)}; D-131-04 publishes ProfileRecord.`);
  }
  const r = body as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  if (keys.join(",") !== [...RECORD_KEYS].join(",")) {
    throw new Error(
      `${where} carries [${keys.join(", ")}]; D-131-04 publishes ` +
        `[${[...RECORD_KEYS].join(", ")}]. An EXTRA member is how a column reaches a public ` +
        `surface, and it is invisible to any assertion that checks the published fields one at ` +
        `a time.`,
    );
  }
  if (typeof r.joinedAt !== "string") {
    throw new Error(`${where}.joinedAt is ${describe_(r.joinedAt)}; on the wire it is an ISO string.`);
  }
  return r;
}

/** A `problem+json` document, checked for the two members every arm of B-03's envelope carries. */
export function asProblem(body: unknown, where: string): Record<string, unknown> {
  if (body === null || typeof body !== "object") {
    throw new Error(`${where} answered ${describe_(body)}; B-03 publishes a problem document.`);
  }
  const p = body as Record<string, unknown>;
  if (typeof p.type !== "string") {
    throw new Error(`${where}'s problem document has \`type\` = ${describe_(p.type)}.`);
  }
  if (typeof p.status !== "number") {
    throw new Error(`${where}'s problem document has \`status\` = ${describe_(p.status)}.`);
  }
  return p;
}

/* --------------------- the two toggle answers (D-131-04) --------------------- */

export interface FollowAnswer {
  watchers: number;
  followedByCaller: boolean;
}

export interface SupportAnswer {
  support: number;
  supportedByCaller: boolean;
}

/**
 * `toggleFollow`'s published return.
 *
 * **The member is `followedByCaller` at the MODULE and `watching` on the WIRE, and D-131-04(c)
 * publishes both on purpose** — the module keeps the inherited suite's spelling, SEAM-57 keeps
 * the mock's, and the route maps between them. So a module answering `watching` is wrong here
 * and a route answering `followedByCaller` is wrong there, and neither validator may be reused
 * for the other surface.
 */
export function asFollowAnswer(value: unknown, where: string): FollowAnswer {
  const a = requireObject(value, where, PUBLISHED.toggleFollow);
  if (typeof a.watchers !== "number" || !Number.isFinite(a.watchers)) {
    throw new Error(`${where}.watchers is ${describe_(a.watchers)}; ${PUBLISHED.toggleFollow}`);
  }
  if (typeof a.followedByCaller !== "boolean") {
    throw new Error(
      `${where}.followedByCaller is ${describe_(a.followedByCaller)}; ` +
        `${PUBLISHED.toggleFollow}\n` +
        `  \`watching\` is the WIRE's spelling (SEAM-57, D-131-04(c)); the module says ` +
        `\`followedByCaller\` and the route maps.`,
    );
  }
  return { watchers: a.watchers, followedByCaller: a.followedByCaller };
}

/** `toggleSupport`'s published return (D-131-04, D-131-05). */
export function asSupportAnswer(value: unknown, where: string): SupportAnswer {
  const a = requireObject(value, where, PUBLISHED.toggleSupport);
  if (typeof a.support !== "number" || !Number.isFinite(a.support)) {
    throw new Error(`${where}.support is ${describe_(a.support)}; ${PUBLISHED.toggleSupport}`);
  }
  if (typeof a.supportedByCaller !== "boolean") {
    throw new Error(
      `${where}.supportedByCaller is ${describe_(a.supportedByCaller)}; ` +
        `${PUBLISHED.toggleSupport}`,
    );
  }
  return { support: a.support, supportedByCaller: a.supportedByCaller };
}

function requireObject(value: unknown, where: string, clause: string): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} answered ${describe_(value)}; the contract publishes ${clause}`);
  }
  return value as Record<string, unknown>;
}

let profiles: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a barrel that fails to load fails for the whole
 * run, so every cell awaiting it gets its own copy of the same red rather than one cell's
 * failure cascading into an unhandled rejection in the next.
 */
export function loadProfiles(): Promise<Namespace> {
  profiles ??= import("@/lib/server/profiles").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${PROFILES} does not load AT ALL.\n` +
          `  That is a stronger failure than this task's blind position predicts: the barrel is ` +
          `MERGED at bd89f6b and exports ${MERGED_EXPORTS.join(", ")}. T131 extends it; it does ` +
          `not create it.\n` +
          `  So this is either a broken extension or a broken environment, and it is NOT the ` +
          `absent-module red a blind round expects.`,
        { cause },
      );
    },
  );
  return profiles;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const found = Object.keys(mod).sort();
  const lost = MERGED_EXPORTS.filter((e) => !found.includes(e));
  throw new Error(
    `${PROFILES} exports no \`${name}\`.\n` +
      `  the contract owes: ${clause}\n` +
      `  found: ${found.join(", ") || "(nothing)"}\n` +
      (lost.length > 0
        ? `  AND IT HAS LOST ${lost.join(", ")}, which were merged at bd89f6b. Read that first: ` +
          `this red is about the extension breaking the barrel, not about \`${name}\`.\n`
        : `  The four merged exports are all still there, so this is the blind position and not ` +
          `a regression: the extension has not landed.\n`) +
      `  Do not add a synonym; publish the name the contract states.`,
  );
}

export async function bind(name: FunctionName): Promise<UnknownFn> {
  const mod = await loadProfiles();
  const value = requireFrom(mod, name, PUBLISHED[name]);
  if (typeof value !== "function") {
    throw new Error(
      `${PROFILES} exports \`${name}\` as ${describe_(value)}; the contract owes a function.\n` +
        `  ${PUBLISHED[name]}`,
    );
  }
  return value as UnknownFn;
}

/**
 * T050's `getPublicAuthor`, bound the same way and used as the ORACLE for the record's
 * `author` rather than as a second opinion about it.
 *
 * Merged, so its absence is a broken environment rather than a criterion.
 */
export async function bindPublicAuthor(): Promise<UnknownFn> {
  const mod = (await import("@/lib/server/accounts")) as unknown as Namespace;
  const value = mod.getPublicAuthor;
  if (typeof value !== "function") {
    throw new Error(`${ACCOUNTS} exports no callable \`getPublicAuthor\`; it is merged and must.`);
  }
  return value as UnknownFn;
}

/* --------------------- D-131-01's union, read off disk --------------------- */

const PROFILES_DATA = fileURLToPath(new URL("../../../lib/data/profiles.ts", import.meta.url));

/**
 * The bytes of `lib/data/profiles.ts`'s `PinnedRef` declaration.
 *
 * **This exists because the type import at the top of this file cannot fail loudly.** Types
 * erase, so a cell built out of `PinnedRef` assertions is green against a module that does not
 * exist and green against one whose union has drifted underneath it — the vacuous-type-pin
 * shape, which is a claim about the instrument and not about the subject.
 *
 * Reading the declaration's own source is the second axis. It is a different instrument from
 * the compiler and it answers a different question: not *do these two types agree* but *is the
 * union D-131-01 names still the union at that address*. A cell that asserts on this and a
 * cell that assigns to `PinnedRef` fail for different reasons, which is the whole point.
 *
 * Fails CLOSED. A file that cannot be read, or that no longer declares the union, throws here
 * rather than answering an empty string that every downstream `includes` would pass over.
 */
export function pinnedRefUnionSource(): string {
  let source: string;
  try {
    source = readFileSync(PROFILES_DATA, "utf8");
  } catch (cause) {
    throw new Error(
      `lib/data/profiles.ts could not be read, so D-131-01's spelling has no second axis.\n` +
        `  The ruling is: "the pin spelling is \`lib/data/profiles.ts:29\`'s OWN UNION, ` +
        `VERBATIM AND CONSUMED, NEVER RESTATED".`,
      { cause },
    );
  }
  const at = source.indexOf("export type PinnedRef");
  if (at === -1) {
    throw new Error(
      `lib/data/profiles.ts declares no \`export type PinnedRef\`.\n` +
        `  D-131-01 makes that declaration THE spelling for both halves of this task, so its ` +
        `absence is a moved contract rather than a failed assertion. Nothing below this line ` +
        `is measuring what it claims to measure until it is back.`,
    );
  }
  /* **Terminated at brace depth ZERO, and the naive version was wrong in the direction that
     matters.** `indexOf(";", at)` finds the semicolon INSIDE `{ kind: "blueprint"; slug: string }`
     — the union's own member separator — so it returns `export type PinnedRef =\n  | { kind:
     "blueprint";` and every `includes` below passes over a declaration cut in half. The tell is
     that it still LOOKS like a reading: a truncated string is a string, and a substring check on
     one is green. So the depth is tracked and the terminator is the first `;` outside any brace. */
  let depth = 0;
  let end = -1;
  for (let i = at; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ";" && depth === 0) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error(
      `\`export type PinnedRef\` at lib/data/profiles.ts is unterminated at brace depth 0; ` +
        `refusing to read a truncated declaration as the spelling.`,
    );
  }
  return source.slice(at, end + 1);
}

/**
 * A blueprint pin at D-131-01's spelling.
 *
 * **The bare `slug` with no owner is the union's, not this file's, and it is the open
 * question in the AC3 family.** `blueprint(db, actor, ownerHandle, slug)` is keyed
 * `owner/slug` and D-130-14 measured why: `bundle_owner_slug_key` is unique on
 * `(ownerId, slug)` and NOT on `slug`, so a slug alone reaches another owner's identically
 * slugged bundle. Whether a pin may name a bundle this handle does not own is UNRULED, and
 * because AC3 makes an unresolvable pin ABSENT, a wrong reading yields `pinned: []` and goes
 * quietly green. No cell in this suite depends on the answer until it is ruled.
 */
export function blueprintPin(slug: string): PinnedRef {
  return { kind: "blueprint", slug };
}

/** A node pin at D-131-01's spelling. `ref` is the canonical `id@version`. */
export function nodePin(ref: CardRef): PinnedRef {
  return { kind: "node", ref };
}

/* --------------------- the database --------------------- */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the drizzle instance every profiles function takes first. */
  db: unknown;
  /** The connection string of this scratch database, for the route's shared client. */
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

/**
 * A database of this file's own. `createTestDb()` creates `darkprint_test_<uuid>`, migrates it
 * and drops it on `drop()`; it never opens the shared development database `DATABASE_URL`
 * names, which is why T000 built it (D-08).
 *
 * `migrateUp` runs `lib/db/migrations/**`, so the day `0004_social` lands (D-131-03) the
 * follow and pin tables appear in every scratch database this file makes, with no change here.
 * That is what makes AC4's derived-versus-stored discriminators one line of SQL rather than a
 * new instrument: they are unwritable today for want of a table name, not for want of a way in.
 */
export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(
      `createTestDb's client carries no \`db\`. \`Db\` is published from @/lib/db and is the ` +
        `first parameter of every function in this task's surface.`,
    );
  }
  /* Asked of the CONNECTION rather than rebuilt from a naming convention, so the URL handed to
     the route half cannot drift from the database the module half is actually on. */
  const [current] = (await test.client.query("select current_database() as name")).rows as {
    name?: unknown;
  }[];
  const database = current?.name;
  if (typeof database !== "string" || database === "") {
    throw new Error(
      `\`select current_database()\` answered ${describe_(database)}, so a route handler ` +
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

export interface AccountFixture {
  id: string;
  handle: string;
  createdAt: Date;
  email: string;
}

export interface AccountOptions {
  handle: string;
  createdAt?: Date;
  validator?: boolean;
  email?: string;
  displayName?: string;
  bio?: string;
  avatarHue?: number;
}

export async function insertAccount(s: Scratch, o: AccountOptions): Promise<AccountFixture> {
  const createdAt = o.createdAt ?? new Date("2026-02-11T09:15:00.000Z");
  const email = o.email ?? `${o.handle}@example.test`;
  const [row] = await s.query(
    "insert into account " +
      "(github_id, github_login, handle, display_name, email, bio, avatar_hue, validator, created_at) " +
      "values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id",
    [
      `gh-${o.handle}`,
      `login-${o.handle}`,
      o.handle,
      o.displayName ?? null,
      email,
      o.bio ?? null,
      o.avatarHue ?? null,
      o.validator ?? false,
      createdAt.toISOString(),
    ],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the account fixture: got ${describe_(id)} for its id.`);
  }
  return { id, handle: o.handle, createdAt, email };
}

export interface CardOptions {
  id: string;
  version?: string;
  phases?: readonly string[];
  name?: string;
  notes?: string;
  /** `NodeCard.author`, the body's own content rather than the row's ownership (D-130-04). */
  author?: string;
}

/** A complete `NodeCard`. Every required field of `lib/core/card/schema.ts` is present. */
export function nodeCard(o: CardOptions): NodeCard {
  return {
    id: o.id,
    name: o.name ?? "Fixture Card",
    type: "agent",
    phases: [...(o.phases ?? [])],
    action: "do-the-fixture-thing",
    spec: "A self-sufficient instruction for the fixture node.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    requiresHuman: false,
    riskMarkers: [],
    author: o.author,
    notes: o.notes,
    version: o.version ?? "1.0.0",
    ontologyVersion: "0.1.0",
  };
}

export function manifest(slug: string, author?: string): BundleManifest {
  return {
    slug,
    title: `Fixture ${slug}`,
    summary: `A fixture blueprint named ${slug}.`,
    description: undefined,
    category: undefined,
    tags: [],
    author,
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

/**
 * Plausible DOT for `release.dot`, which is NOT NULL. Nothing published reads it.
 *
 * **`name` is not decoration — it is a FIXTURE CORRECTION charged against this suite at first
 * contact, and the defect it fixes made nine `validated` cells red against a correct module.**
 *
 * `bundleDigest({ dot, cardDigests })` reads neither owner nor slug — D-05-01 already records
 * that, as the reason `release.digest` cannot be made unique — so this function returned the
 * SAME bytes for every bundle seeded with no cards, and therefore the same digest. Since
 * `run_report.release_digest` is matched by value, one report then reached EVERY empty bundle in
 * the scratch database, and `validated` correctly counted them all: the observed answers ran
 * 2, 4, 5, 7, 10, 12, 13 against expected 1s and 2s, monotonically increasing in declaration
 * order, which is the signature of accumulation and not of a wrong count.
 *
 * A real blueprint's graph differs from another's; a fixture where they are byte-identical is the
 * degenerate case, not the normal one. Naming the graph restores that. **The two cells that
 * deliberately need a shared digest are unaffected: both construct the second release by passing
 * the first's `digest` explicitly**, which is what a T110 fork does and what those cells are about.
 */
export function dotFor(refs: readonly CardRef[], name = "fixture"): string {
  const nodes = refs.map((ref, i) => `  n${i} [card="${ref}"];`).join("\n");
  return `digraph "${name}" {\n${nodes}\n}\n`;
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
  o: CardOptions & {
    ownerId: string;
    visibility?: "public" | "private";
    authorHandle?: string;
  },
): Promise<CardFixture> {
  const body = nodeCard({ ...o, author: o.author ?? o.authorHandle });
  const digest = cardDigest(body);
  const visibility = o.visibility ?? "public";
  const [row] = await s.query(
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
    ref: `${body.id}@${body.version}`,
    digest,
    body,
    visibility,
  };
}

export interface BundleFixture {
  id: string;
  ownerId: string;
  ownerHandle: string;
  slug: string;
  visibility: "public" | "private";
  releaseId: string;
  /** `release.digest`, which is what `run_report.release_digest` names (B-16). */
  digest: string;
}

/**
 * A bundle AND one release for it, always together.
 *
 * Deliberate, and inherited from T130's fixture for its reason: nothing published says whether
 * a blueprint count reads `bundle` rows or bundles with a current release, so seeding both
 * halves makes the two readings agree on every fixture here and no cell binds an undecided
 * question. The digest comes back on the fixture because `validated` is a count over
 * `run_report`, which is keyed by `release_digest` and by nothing else (D-05-01: it is
 * deliberately not a foreign key).
 */
export async function insertBundle(
  s: Scratch,
  o: {
    owner: AccountFixture;
    slug: string;
    visibility?: "public" | "private";
    cards?: readonly CardFixture[];
    version?: string;
  },
): Promise<BundleFixture> {
  const visibility = o.visibility ?? "public";
  const [bundleRow] = await s.query(
    "insert into bundle (owner_id, slug, visibility) values ($1, $2, $3) returning id",
    [o.owner.id, o.slug, visibility],
  );
  const bundleId = bundleRow?.id;
  if (typeof bundleId !== "string") {
    throw new Error(`Could not insert the bundle fixture: got ${describe_(bundleId)} for its id.`);
  }

  const cards = o.cards ?? [];
  const cardRefs = cards.map((c) => c.ref);
  const cardDigests = cards.map((c) => c.digest);
  /* Named per bundle, so two bundles are two digests unless a caller deliberately reuses one. */
  const dot = dotFor(cardRefs, `${o.owner.handle}/${o.slug}`);
  const digest = bundleDigest({ dot, cardDigests });
  const [releaseRow] = await s.query(
    "insert into release " +
      "(bundle_id, version, digest, dot, manifest, card_refs, card_digests) " +
      "values ($1, $2, $3, $4, $5, $6, $7) returning id",
    [
      bundleId,
      o.version ?? "1.0.0",
      digest,
      dot,
      JSON.stringify(manifest(o.slug, o.owner.handle)),
      cardRefs,
      cardDigests,
    ],
  );
  const releaseId = releaseRow?.id;
  if (typeof releaseId !== "string") {
    throw new Error(`Could not insert the release fixture: got ${describe_(releaseId)}.`);
  }

  return {
    id: bundleId,
    ownerId: o.owner.id,
    ownerHandle: o.owner.handle,
    slug: o.slug,
    visibility,
    releaseId,
    digest,
  };
}

/**
 * One accepted run report, planted behind every module's back.
 *
 * **This is the whole reason `validated` is drivable in the blind position while `watchers` is
 * not.** `run_report` is MERGED (T005, `lib/db/schema.ts:531-548`) and carries `account_id`,
 * which D-05-07 added for exactly this figure — its comment reads *"a report on one's own
 * blueprint is accepted and aggregated but must not count toward T130's `validated`, which
 * needs an account to filter on"*. So a count derived from these rows and a stored counter can
 * be told apart here: seed a row, do not enter the module, and read the figure again.
 *
 * `release_digest` is a plain `text` column and NOT a foreign key (D-05-01, ruled, because
 * `release.digest` cannot be made unique without making an unchanged T110 fork unpublishable).
 * Migration 0002's `run_report_release_exists` trigger still requires SOME release at the
 * digest, so a caller passes a `BundleFixture.digest` rather than a string of its own.
 */
export async function insertRunReport(
  s: Scratch,
  o: {
    /** WHO reported. The account whose `validated` this is meant to move. */
    reporterId: string;
    /** WHAT was run, by `release.digest`. Take it off a `BundleFixture`. */
    releaseDigest: string;
    model?: string;
    costUnits?: string;
    durationMs?: number;
    reportedAt?: Date;
  },
): Promise<string> {
  const [row] = await s.query(
    "insert into run_report " +
      "(release_digest, account_id, model, provider, hardware, input_size, harness_version, " +
      " cost_units, duration_ms, reported_at) " +
      "values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id",
    [
      o.releaseDigest,
      o.reporterId,
      o.model ?? "fixture-model",
      "fixture-provider",
      "fixture-hardware",
      1024,
      "0.1.0",
      o.costUnits ?? "1.5",
      o.durationMs ?? 1000,
      (o.reportedAt ?? new Date("2026-06-01T12:00:00.000Z")).toISOString(),
    ],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the run report fixture: got ${describe_(id)} for its id.`);
  }
  return id;
}

export interface OntologyFixture {
  id: string;
  version: string;
}

export async function insertOntologyVersion(s: Scratch, version: string): Promise<OntologyFixture> {
  const [row] = await s.query(
    "insert into ontology_version (version, digest) values ($1, $2) returning id",
    [version, `sha256:${randomUUID().replaceAll("-", "")}`],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the ontology version fixture: got ${describe_(id)}.`);
  }
  return { id, version };
}

/* --------------------- the routes --------------------- */

const API_ROOT = fileURLToPath(new URL("../../../app/api/", import.meta.url));
const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;

/**
 * The GET this task inherits, merged and published by D-130-05. Named so a cell about the
 * READ surface cannot be mistaken for one about a write route T131 owes.
 */
export const AUTHOR_ROUTE = "GET /api/authors/[handle]";

/**
 * The write route D-131-01 publishes, and the ONE it publishes.
 *
 * `POST/DELETE /api/authors/{handle}/watch` is SEAM-57's and appears nowhere in T131's
 * section. That absence is reported rather than filled: T130's D-130-05 named both write
 * routes as blocked precisely so a blind author could see a decision instead of an oversight,
 * and inventing the follow route's method, body and status here would be the candidate list
 * this run charges. No cell drives it until it is published.
 */
export const PINNED_ROUTE = "PUT /api/authors/[handle]/pinned";

interface DiscoveredRoute {
  pattern: string;
  file: string;
}

let table: DiscoveredRoute[] | undefined;

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
      out.push({ pattern: `/api/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

/**
 * Every route the tree actually publishes under `app/api/authors/**`, in the App Router's own
 * precedence order.
 *
 * Discovered, never bound by file path. T080 charged the alternative three ways: a published
 * path is a URL and not a folder name, a dynamic `import()` specifier resolves at COMPILE time
 * so a wrong guess takes `tsc` and the build with it, and a precedence test that imports its
 * subject directly cannot observe shadowing in either direction.
 *
 * Scoped to the one subtree, which is this task's grant. A `/api/authors/...` URL shadowed by
 * a pattern outside it would be invisible here; no such pattern exists today and the bound is
 * stated rather than left silent.
 */
function routeTable(): DiscoveredRoute[] {
  if (table !== undefined) return table;
  const found: DiscoveredRoute[] = [];
  walk(join(API_ROOT, "authors"), ["authors"], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under app/api/authors/**.\n` +
        `  That is a stronger failure than this task's blind position predicts: ` +
        `\`${AUTHOR_ROUTE}\` is MERGED (D-130-05) and its file is on backend at bd89f6b.\n` +
        `  So this is a broken tree, not the absent write route T131 owes.`,
    );
  }
  const byPattern = new Map(found.map((r) => [r.pattern, r]));
  let ordered: string[];
  try {
    ordered = getSortedRoutes([...byPattern.keys()]);
  } catch (cause) {
    throw new Error(
      `The published route tree does not sort: ${String(cause)}\n` +
        `  Patterns found: ${[...byPattern.keys()].sort().join(", ")}\n` +
        `  This is Next's own conflict check, not this suite's opinion about layout.`,
      { cause },
    );
  }
  table = ordered.map((pattern) => byPattern.get(pattern)!);
  return table;
}

function matchRoute(path: string): { route: DiscoveredRoute; params: Record<string, unknown> } {
  const routes = routeTable();
  for (const route of routes) {
    const params = getRouteMatcher(getRouteRegex(route.pattern))(path);
    if (params !== false) return { route, params };
  }
  throw new Error(
    `No published route matches \`${path}\`.\n` +
      `  Discovered patterns, in the App Router's precedence order: ` +
      `${routes.map((r) => r.pattern).join(", ")}\n` +
      `  The contract publishes a URL and the file layout is the implementation's, so this ` +
      `says the URL is unserved rather than that a file is missing from a guessed path.`,
  );
}

/** Which discovered pattern serves a URL. Answers the surface question without a database. */
export function routePatternFor(path: string): string {
  return matchRoute(path).route.pattern;
}

/**
 * Drive a published URL the way a caller does: matched through Next's router, dispatched to
 * whichever file wins, and invoked with `params` as a PROMISE, which is what this version of
 * Next hands a handler
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`).
 *
 * **Generalised over the METHOD, where T130's could only GET.** A write route's handler is a
 * different export on the same module, so binding the method by name is what lets a cell say
 * *the URL is served and `PUT` is not* rather than *the route is missing* — two different
 * failures that a GET-only driver reports identically.
 */
export async function callRoute(
  method: string,
  path: string,
  o: { headers?: Record<string, string>; body?: unknown } = {},
): Promise<Response> {
  const { route, params } = matchRoute(path);
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(
      `\`${route.pattern}\` — the route serving \`${path}\` — does not load.`,
      { cause },
    );
  }
  const handler = mod[method];
  if (typeof handler !== "function") {
    throw new Error(
      `\`${route.pattern}\` exports no \`${method}\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}).\n` +
        `  The URL is served and the method is not, which is a different failure from an ` +
        `absent route and is reported as one.`,
    );
  }
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  let init: RequestInit = { method };
  if (o.body !== undefined) {
    headers["content-type"] = "application/json";
    init = { method, body: JSON.stringify(o.body) };
  }
  const request = new Request(`https://darkprint.test${path}`, { ...init, headers });
  const answered = await (handler as UnknownFn)(request, { params: Promise.resolve(params) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${method} ${route.pattern}\` answered ${describe_(answered)}; a route handler returns ` +
        `a Response.`,
    );
  }
  return answered;
}

/**
 * A `Cookie` header carrying a real session, minted through T000's own published surface
 * rather than hand-assembled: a hand-built token would test this suite's idea of the format.
 *
 * This is what makes a route's ACTOR observable at all. A suite that only ever sends anonymous
 * requests covers the reader half and the transport half separately and never the join between
 * them, so whatever turns a session into an `Actor` can regress to "nobody" with every
 * assertion still passing. T080's adversary found exactly that regression at `actorFrom`,
 * unobserved, in a merged task.
 */
export function sessionCookie(accountId: string, handle: string | null): Record<string, string> {
  return { cookie: `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}` };
}

/* --------------------- leak sweeping --------------------- */

/**
 * Every string reachable from a value, Maps and Sets expanded.
 *
 * **The expansion is not defensive tidying; it is D-132-04's recorded finding.** A plain
 * `Object.entries` walk cannot see a Map's contents — its entries are not own enumerable
 * properties — so a sweep over a batch reader's answer is vacuous while looking thorough. Any
 * cell using this owes a planted tell in a KEY and in a VALUE before it may read a clean sweep
 * as evidence.
 */
export function collectStrings(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const out: string[] = [];
  if (value instanceof Map) {
    for (const [k, v] of value) out.push(...collectStrings(k, seen), ...collectStrings(v, seen));
    return out;
  }
  if (value instanceof Set) {
    for (const v of value) out.push(...collectStrings(v, seen));
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) out.push(...collectStrings(v, seen));
    return out;
  }
  for (const [k, v] of Object.entries(value)) {
    out.push(k, ...collectStrings(v, seen));
  }
  return out;
}

/* --------------------- `0004_social`'s three tables (D-131-08) --------------------- */

/**
 * The tables D-131-08 ratifies, named here so a cell can say WHICH one is missing.
 *
 * **These do not exist at the base this suite was cut from and that is the point.** T130's
 * blind author could not write AC4's real criterion for exactly this reason and said so in its
 * own header: with `toggleFollow` the only publisher of follow state, an incremented counter
 * and a derived count agree across every sequential sequence a suite can drive. The
 * discriminator needs a way to move the rows WITHOUT entering the module, and that needs a
 * table.
 *
 * `createTestDb` runs `migrateUp` over `lib/db/migrations/**`, so the day `0004_social` lands
 * every scratch database here has them with no change to this file.
 */
export const SOCIAL_TABLES = ["follow", "profile_pin", "account_support"] as const;

/** SQLSTATE 42P01. The one code that means "the migration has not landed" rather than a bug. */
const UNDEFINED_TABLE = "42P01";

function socialTableAbsent(table: string, cause: unknown): Error {
  return new Error(
    `\`${table}\` does not exist in this scratch database.\n` +
      `  D-131-08 ratifies \`0004_social\` as ` +
      `follow(follower_id, followed_id) / profile_pin(account_id, position, kind, ref) / ` +
      `account_support(supporter_id, supported_id), all five keys into \`account\` ` +
      `\`NO ACTION\` (D-131-11 revoked D-131-08's CASCADE).\n` +
      `  This is the blind position and not a broken fixture: the migration has not landed. ` +
      `Every cell that plants a row BEHIND the module reds here, and those are exactly the ` +
      `cells that tell a DERIVED count apart from a stored counter — the criterion T130 could ` +
      `not reach.`,
    { cause },
  );
}

function isUndefinedTable(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    (err as { code?: unknown }).code === UNDEFINED_TABLE
  );
}

/**
 * Run one statement against a `0004_social` table, turning "the migration has not landed" into
 * a sentence and leaving every other driver error alone.
 *
 * The distinction is load-bearing. A blind round expects 42P01 and nothing else; a 23503 or a
 * 23505 out of one of these statements is a real defect in the shipped schema and must not be
 * relabelled as an absent migration, which is the sanitizer-applied-twice shape D-50-21 records.
 */
async function onSocialTable<T>(
  table: (typeof SOCIAL_TABLES)[number],
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isUndefinedTable(err)) throw socialTableAbsent(table, err);
    throw err;
  }
}

/** A follow row planted directly, with no module entered. The AC4 discriminator's whole point. */
export async function insertFollow(
  s: Scratch,
  o: { followerId: string; followedId: string },
): Promise<void> {
  await onSocialTable("follow", () =>
    s.query("insert into follow (follower_id, followed_id) values ($1, $2)", [
      o.followerId,
      o.followedId,
    ]),
  );
}

/** How many follow ROWS name this account as followed. The oracle a derived count must equal. */
export async function followRowCount(s: Scratch, followedId: string): Promise<number> {
  const rows = await onSocialTable("follow", () =>
    s.query("select count(*)::int as n from follow where followed_id = $1", [followedId]),
  );
  const n = rows[0]?.n;
  if (typeof n !== "number") {
    throw new Error(`\`select count(*)\` over follow answered ${describe_(n)}.`);
  }
  return n;
}

/** A support row planted directly. Same shape as `insertFollow` and for the same reason. */
export async function insertSupport(
  s: Scratch,
  o: { supporterId: string; supportedId: string },
): Promise<void> {
  await onSocialTable("account_support", () =>
    s.query("insert into account_support (supporter_id, supported_id) values ($1, $2)", [
      o.supporterId,
      o.supportedId,
    ]),
  );
}

/** How many support ROWS name this account as supported. */
export async function supportRowCount(s: Scratch, supportedId: string): Promise<number> {
  const rows = await onSocialTable("account_support", () =>
    s.query("select count(*)::int as n from account_support where supported_id = $1", [
      supportedId,
    ]),
  );
  const n = rows[0]?.n;
  if (typeof n !== "number") {
    throw new Error(`\`select count(*)\` over account_support answered ${describe_(n)}.`);
  }
  return n;
}

/**
 * The pin rows an account holds, in `position` order, as the STORE holds them.
 *
 * Read rather than resolved. `getProfile` answers only the pins the actor can resolve (AC3,
 * D-131-04), so the store and the answer differ by exactly the unresolvable ones — and a cell
 * that cannot see both halves cannot tell "the pin was dropped from the answer" apart from
 * "the pin was never written", which are opposite verdicts about `setPins`.
 */
export async function pinRows(
  s: Scratch,
  accountId: string,
): Promise<{ position: number; kind: string; ref: string }[]> {
  const rows = await onSocialTable("profile_pin", () =>
    s.query(
      "select position, kind, ref from profile_pin where account_id = $1 order by position",
      [accountId],
    ),
  );
  return rows.map((r) => ({
    position: Number(r.position),
    kind: String(r.kind),
    ref: String(r.ref),
  }));
}

/** Whether a table exists at all, for the one cell that must SAY which world a run happened in. */
export async function socialSchemaPresent(s: Scratch): Promise<string[]> {
  const rows = await s.query(
    "select table_name from information_schema.tables where table_schema = 'public' " +
      "and table_name = any($1::text[]) order by table_name",
    [[...SOCIAL_TABLES]],
  );
  return rows.map((r) => String(r.table_name));
}

/* --------------------- concurrency (D-131-09(2)) --------------------- */

/**
 * Open `n` real connections on the scratch pool before a race cell runs.
 *
 * **A concurrency cell against a COLD pool is vacuous and green.** `pg` opens connections lazily,
 * so two "concurrent" callers on a pool with one live client are handed that client one after the
 * other: they serialise, the window a race needs never opens, and the cell passes against a
 * select-then-insert exactly as it passes against a correct module. Measured elsewhere in this
 * run at 1 of 8 racing cold against 24 of 24 warmed — the difference is the whole cell.
 *
 * Each warmer holds its connection for the duration of a short server-side sleep, so the pool
 * cannot satisfy the next one with the same client and is forced to open another.
 */
export async function warmPool(s: Scratch, n = 4): Promise<void> {
  await Promise.all(
    Array.from({ length: n }, () => s.query("select pg_sleep(0.05) as warmed")),
  );
}

export interface Interleaving {
  pids: number[];
  /** Each statement's own server-measured duration. Near zero means the CLOCK reading is broken. */
  spans: number[];
  overlapped: boolean;
}

/**
 * Prove this pool can actually run two statements at once, and say so in numbers.
 *
 * **The second axis for every race cell below.** A race cell that passes proves nothing until
 * something independent shows the harness CAN interleave in this configuration — otherwise a
 * green is a claim about the pool rather than about the module. Two concurrent statements each
 * report the backend pid serving them and their own start and end instants; distinct pids with
 * OVERLAPPING windows is interleaving, and equal pids or disjoint windows is serialisation.
 *
 * Overlap rather than distinct-pids alone: a pool can hand two clients out in sequence and still
 * report two pids, which looks like concurrency and is not.
 */
export async function proveInterleaving(s: Scratch): Promise<Interleaving> {
  /**
   * Milliseconds off a `timestamptz`, WITHOUT a `String()` round trip.
   *
   * **`new Date(String(d))` truncates to the whole second and it cost this cell a false red.**
   * `pg` parses `timestamptz` into a `Date`; `String(aDate)` renders the locale form
   * `"Mon Aug 24 2026 12:51:03 GMT+0200"`, which carries no milliseconds, so re-parsing it
   * collapses `started` and `ended` into the SAME instant. Every window became zero-width, the
   * overlap test `a.started < b.ended` compared an instant to itself, and the cell reported
   * SERIALISATION on a pool that was interleaving perfectly — measured at 164ms wall for two
   * 150ms statements, which only overlap explains. Same family as this project's recorded
   * truncation of Postgres microseconds through `getTime()`: the lossy step is the string.
   */
  const millis = (value: unknown): number =>
    value instanceof Date ? value.getTime() : new Date(String(value)).getTime();

  const one = async () => {
    const [row] = await s.query(
      "select pg_backend_pid() as pid, clock_timestamp() as started, " +
        "pg_sleep(0.15), clock_timestamp() as ended",
    );
    return {
      pid: Number(row?.pid),
      started: millis(row?.started),
      ended: millis(row?.ended),
    };
  };
  const [a, b] = await Promise.all([one(), one()]);
  return {
    pids: [a.pid, b.pid],
    /* Reported so a caller can tell a SERIALISING pool from a BROKEN CLOCK READING. Both
       answer `overlapped: false`, and they are opposite findings: the first invalidates the
       race cells, the second invalidates this measurement. A near-zero span is the tell. */
    spans: [a.ended - a.started, b.ended - b.started],
    overlapped: a.started < b.ended && b.started < a.ended,
  };
}

/** What a concurrent pair did, without deciding in advance that either had to succeed. */
export interface RaceOutcome {
  resolved: number;
  rejected: number;
  /** Every rejection's `code`, so a leaked SQLSTATE is visible rather than swallowed. */
  codes: (string | undefined)[];
  answers: unknown[];
}

/**
 * Run two calls concurrently and report what each did, refusing to assume either outcome.
 *
 * A `Promise.all` would reject on the first failure and lose the other caller's result entirely,
 * which is the half a race cell most needs to see. `allSettled` keeps both, and the SQLSTATE is
 * pulled off each rejection because **a raw `23505` reaching a caller is the defect** — it is
 * what a select-then-insert produces under exactly this load, and it is invisible to any
 * assertion that only counts rows.
 */
export async function race(a: () => unknown, b: () => unknown): Promise<RaceOutcome> {
  const settled = await Promise.allSettled([
    (async () => a())(),
    (async () => b())(),
  ]);
  const out: RaceOutcome = { resolved: 0, rejected: 0, codes: [], answers: [] };
  for (const r of settled) {
    if (r.status === "fulfilled") {
      out.resolved += 1;
      out.answers.push(r.value);
    } else {
      out.rejected += 1;
      const reason = r.reason as { code?: unknown; cause?: { code?: unknown } };
      const code = reason?.code ?? reason?.cause?.code;
      out.codes.push(typeof code === "string" ? code : undefined);
    }
  }
  return out;
}

/* --------------------- the set-verbs' no-op evidence (D-131-10) --------------------- */

/**
 * A row's physical identity and its birth instant, both at full precision.
 *
 * **This is how "a second identical call is a NO-OP" becomes checkable at all.** A count cannot
 * see it: an insert-on-conflict-do-nothing, an upsert that rewrites the row, and a
 * delete-then-insert all leave exactly one row and answer the same number. What separates them is
 * whether the row was TOUCHED —
 *
 *   * `ctid` is the tuple's physical location and changes on any UPDATE or delete/insert, because
 *     Postgres writes a new tuple version rather than editing in place;
 *   * `created_at` is read as `::text` rather than as a `timestamptz`, deliberately. The driver
 *     parses `timestamptz` into a `Date`, which holds milliseconds and drops the column's
 *     microseconds — and two writes inside one millisecond are exactly what a no-op cell drives.
 *     Comparing the rendered text keeps the precision the comparison depends on. Same truncation
 *     family that made `proveInterleaving` report a serialising pool on a pool that was not.
 */
export interface RowIdentity {
  ctid: string;
  createdAt: string;
}

export async function followRowIdentity(
  s: Scratch,
  o: { followerId: string; followedId: string },
): Promise<RowIdentity | undefined> {
  const rows = await onSocialTable("follow", () =>
    s.query(
      "select ctid::text as ctid, created_at::text as created_at from follow " +
        "where follower_id = $1 and followed_id = $2",
      [o.followerId, o.followedId],
    ),
  );
  const row = rows[0];
  return row === undefined
    ? undefined
    : { ctid: String(row.ctid), createdAt: String(row.created_at) };
}

export async function supportRowIdentity(
  s: Scratch,
  o: { supporterId: string; supportedId: string },
): Promise<RowIdentity | undefined> {
  const rows = await onSocialTable("account_support", () =>
    s.query(
      "select ctid::text as ctid, created_at::text as created_at from account_support " +
        "where supporter_id = $1 and supported_id = $2",
      [o.supporterId, o.supportedId],
    ),
  );
  const row = rows[0];
  return row === undefined
    ? undefined
    : { ctid: String(row.ctid), createdAt: String(row.created_at) };
}

/**
 * Sample a reading repeatedly WHILE a write runs, and return everything that was observed.
 *
 * **The instrument for D-131-10's no-window property, and it is a DETECTOR WITH A MISS RATE
 * rather than an oracle.** The defect it hunts is transient by definition: the interim mechanism
 * the ruling replaced flipped the state, read it, and flipped back on disagreement, so a
 * `setFollow(true)` against an existing follow passed through a ROWLESS state that a concurrent
 * reader could see. A single before/after pair cannot see it — both ends read 1 — and only a read
 * landing inside the window catches it.
 *
 * So a clean result here means *no sample landed in a window*, never *there is no window*, and any
 * cell using it has to say so. What makes it worth running anyway is that it costs one call and
 * the alternative is no coverage at all of a property the ruling exists to guarantee.
 *
 * The poll runs until the work settles, then takes one final sample, so a window that opens late
 * is not missed by a loop that had already stopped.
 */
export async function sampleDuring<T>(
  read: () => Promise<T>,
  work: () => Promise<unknown>,
): Promise<{ observed: T[]; failed: unknown }> {
  const observed: T[] = [];
  let running = true;
  let failed: unknown;

  const poller = (async () => {
    while (running) {
      try {
        observed.push(await read());
      } catch {
        /* A read that throws mid-flight is not this instrument's subject; the cells assert on
           what WAS observed, and an empty observation list is itself a red in every caller. */
      }
    }
  })();

  try {
    await work();
  } catch (err) {
    failed = err;
  }
  running = false;
  await poller;
  observed.push(await read());
  return { observed, failed };
}

/* --------------------- driver refusals (D-131-11) --------------------- */

/**
 * Run a statement and report the SQLSTATE it was refused with, or `undefined` if it succeeded.
 *
 * **Written for D-131-11, where a REFUSAL became the assertion rather than the obstacle.** The
 * cascade was revoked because `D-120-01 rules the tombstone BECAUSE the structure refuses the
 * delete` — so a foreign key into `account` that refuses is the merged ruling's own premise
 * reaching these tables, and the honest cell asserts the refusal instead of driving around it.
 *
 * The code is read off the driver rather than off the message: a `foreign_key_violation` is
 * `23503` whatever the wording, and matching prose would pin a string nobody published.
 */
export async function sqlstateOf(work: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await work();
    return undefined;
  } catch (err) {
    const e = err as { code?: unknown; cause?: { code?: unknown } };
    const code = e?.code ?? e?.cause?.code;
    return typeof code === "string" ? code : "(a rejection carrying no SQLSTATE)";
  }
}
