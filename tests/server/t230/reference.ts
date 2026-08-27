/* ============================================================
   T230 — a reference, and what it is for

   Not a test file, and NOT a proposal for the implementation.

   A green against a reference is evidence only if the reference
   could have gone red, so this exists to answer one question about
   the suite beside it: do those cells discriminate, or do they
   pass against anything? `T230_REFERENCE=1 npx vitest run
   tests/server/t230` points every load at this module instead of
   `@/lib/server/limits`.

   ── the order is what makes it worth anything ──
   The cells were written from §T230 first and this was written
   afterwards, independently, from the same section. That
   independence is the instrument; the order is only what preserves
   it. A reference written first with cells built to match would
   have validated whatever the reference got wrong and reported
   `n passed`.

   ── the numbers here are the REFERENCE'S OWN ──
   "The ceiling values are `TBD:` and the task must not invent
   them." A reference is a measuring instrument rather than the
   task, and it cannot measure a bound without one — so it picks
   numbers small enough to exhaust in process and they are NOT a
   proposal. Nothing in `tests/server/t230/*.test.ts` reads them:
   every cell drives the ceiling the module under test publishes on
   its own first verdict.

   ── what this reference deliberately does NOT do ──
   It does not make `MAX_KB` or `MAX_PARAM_DEPTH` reachable, so
   `premises.test.ts`'s F-230-C cell reds against it. That red is
   the measurement: a reference inherits whatever the contract
   underspecifies, and this contract asks for two private constants
   to be consumed.
   ============================================================ */

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { type Db, schema } from "@/lib/db";
import { PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import { type Actor, can } from "@/lib/server/policy";

export interface LimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  /** D-230-10: the window's LENGTH. `resetAt - now` is what is LEFT of it, and the form's
   *  `<window>` slot is about the first. */
  windowMs: number;
}

export interface ApiKeyRecord {
  keyId: string;
  accountId: string;
  label: string;
  createdAt: Date;
  revokedAt: Date | null;
}

/**
 * The class §T230 names in its admissible-form block. Exported because T050's barrel
 * states the general reason — "a caller that cannot name a class cannot branch on it".
 * Nothing here throws it: no published function in §T230 returns or throws a rejection
 * (F-230-B), so this reference has nowhere to raise it from either, which is the
 * contract gap arriving in a second implementation.
 */
export class RateLimitedError extends Error {
  constructor(bucket: string, verdict: LimitVerdict, window: string) {
    super(
      `${bucket}: limit of ${verdict.limit} per ${window} reached; ` +
        `resets at ${verdict.resetAt.toISOString()}.`,
    );
    this.name = "RateLimitedError";
  }
}

/* --------------------- the config, the reference's own numbers --------------------- */

export type Tier = "anonymous" | "account" | "key";

export interface BucketLimit {
  limit: number;
  windowMs: number;
}

export type LimitConfig = Readonly<Record<string, Readonly<Record<Tier, BucketLimit>>>>;

const HOUR = 60 * 60 * 1000;

/**
 * D-230-03: the SHAPE is contract and the numbers are the owner's. These are small
 * enough to exhaust in process and are **not a proposal** — nothing in
 * `tests/server/t230/*.test.ts` reads them, and every cell drives the ceiling the module
 * under test publishes on its own first verdict.
 *
 * Exported so a blind caller can enumerate the bucket vocabulary, which F-230-D says the
 * section does not publish and D-230-04 makes load-bearing: with an unconfigured bucket
 * refusing, a caller that cannot discover a configured name cannot drive the module at
 * all.
 */
export const LIMITS: LimitConfig = {
  read: {
    anonymous: { limit: 60, windowMs: HOUR },
    account: { limit: 120, windowMs: HOUR },
    /* Equal to `account` on purpose in no bucket here — but the ORDERING is what
       D-230-03 rules, so `>=` is what the suite asserts and this reference must not be
       read as evidence that `>` holds. */
    key: { limit: 600, windowMs: HOUR },
  },
  write: {
    anonymous: { limit: 10, windowMs: HOUR },
    account: { limit: 40, windowMs: HOUR },
    key: { limit: 200, windowMs: HOUR },
  },
};

/**
 * D-230-06: a FIXED number of slots, `hash(subject) mod N`. `N` is a memory bound in
 * D-70-17's sense rather than a ceiling — memory is exactly `N`, and it fails CLOSED,
 * since a collision makes two subjects share one budget, stricter and never looser. An
 * LRU fails OPEN: an attacker evicts their own entry and the limit silently stops
 * existing.
 *
 * The cost is real and is stated rather than hidden: a colliding caller can be pushed
 * toward a ceiling it never approached.
 */
export const COUNTER_SLOTS = 4096;

/** `subject.ip` arrives from the edge, so it is bounded before it reaches a hash. */
const MAX_IP_CHARS = 64;

interface Slot {
  key: string;
  count: number;
  resetAt: number;
}

const slots = new Array<Slot | undefined>(COUNTER_SLOTS);

function slotIndex(key: string): number {
  /* FNV-1a, and it is a slot index rather than a security property. */
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % COUNTER_SLOTS;
}

function windowFor(key: string, windowMs: number, now: number): Slot {
  const index = slotIndex(key);
  const existing = slots[index];
  if (existing !== undefined && existing.key === key && existing.resetAt > now) return existing;
  const fresh = { key, count: 0, resetAt: now + windowMs };
  slots[index] = fresh;
  return fresh;
}

/** The subject's counter key. Never rendered anywhere a caller can see. */
function subjectKey(subject: {
  accountId: string | null;
  keyId: string | null;
  ip: string;
}): string {
  if (subject.keyId !== null) return `key:${subject.keyId}`;
  if (subject.accountId !== null) return `account:${subject.accountId}`;
  return `ip:${String(subject.ip).slice(0, MAX_IP_CHARS)}`;
}

/**
 * D-230-04: an unconfigured bucket REFUSES. A lookup returning `undefined` read as "no
 * limit" is a criterion satisfiable by never limiting anything — D-70-18's shape.
 *
 * The refusal is still a WELL-FORMED verdict, because `rateLimited` renders whatever it
 * is handed and a `NaN` limit reaches a caller as "limit of NaN".
 */
const UNCONFIGURED: BucketLimit = { limit: 0, windowMs: HOUR };

export async function checkLimit(
  db: Db,
  subject: { accountId: string | null; keyId: string | null; ip: string },
  bucket: string,
): Promise<LimitVerdict> {
  const configured = Object.prototype.hasOwnProperty.call(LIMITS, bucket)
    ? LIMITS[bucket]
    : undefined;

  if (configured === undefined) {
    return {
      allowed: false,
      limit: UNCONFIGURED.limit,
      remaining: 0,
      resetAt: new Date(Date.now() + UNCONFIGURED.windowMs),
      windowMs: UNCONFIGURED.windowMs,
    };
  }

  /* D-230-05: anonymous, ZERO access. The tier is decided from the subject before any
     reach for `db`, so an anonymous read never touches the connection at all. */
  let tier: Tier = "anonymous";
  if (subject.keyId !== null) {
    /* One indexed read, and it is the one AC4 already mandates: a revoked key's raised
       ceiling must not outlive the revocation. */
    const [row] = await db
      .select({ revokedAt: schema.apiKey.revokedAt })
      .from(schema.apiKey)
      .where(eq(schema.apiKey.id, subject.keyId))
      .limit(1);
    tier = row !== undefined && row.revokedAt === null ? "key" : subject.accountId !== null ? "account" : "anonymous";
  } else if (subject.accountId !== null) {
    tier = "account";
  }

  const { limit, windowMs } = configured[tier];
  const now = Date.now();
  const window = windowFor(`${bucket}|${tier}|${subjectKey(subject)}`, windowMs, now);

  if (window.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt: new Date(window.resetAt), windowMs };
  }
  window.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - window.count),
    resetAt: new Date(window.resetAt),
    windowMs,
  };
}

/* --------------------- D-230-01: the published renderer --------------------- */

/** The window, rendered for `<window>`. Wording is unpublished; this is the reference's. */
function windowLabel(windowMs: number): string {
  if (windowMs % HOUR === 0) return windowMs === HOUR ? "hour" : `${windowMs / HOUR} hours`;
  if (windowMs % 60_000 === 0) return windowMs === 60_000 ? "minute" : `${windowMs / 60_000} minutes`;
  return `${Math.round(windowMs / 1000)} seconds`;
}

/**
 * D-230-01, and D-230-09 for the member set. `detail` is the admissible form byte for
 * byte; `limit`/`remaining`/`resetAt` are the verdict machine-readable; `keysAvailable`
 * is T220 AC6's affordance, which could not live in `detail` without violating an
 * exact-matched message form.
 *
 * Built through `@/lib/server/http`'s `problem`, so `instance` and the content type come
 * from the one definition rather than from a second copy here.
 */
export function rateLimited(request: Request, verdict: LimitVerdict, bucket: string): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/rate-limited`,
    title: "Too many requests",
    status: 429,
    detail:
      /* D-230-10: from the verdict's own `windowMs`, so `rateLimited` cannot be called
         with a window that disagrees with the verdict it is rendering. */
      `${bucket}: limit of ${verdict.limit} per ${windowLabel(verdict.windowMs)} ` +
      `reached; resets at ${verdict.resetAt.toISOString()}.`,
    limit: verdict.limit,
    remaining: verdict.remaining,
    resetAt: verdict.resetAt.toISOString(),
    keysAvailable: true,
  });
}

/* --------------------- keys --------------------- */

const SECRET_BYTES = 32;

/**
 * D-230-07: the module MINTS the secret, so its length and alphabet are known by
 * construction and anything else is refused BEFORE hashing. The secret is
 * unauthenticated caller input of unbounded length, and hashing it first is work
 * proportional to attacker input performed to decide the input is worthless — D-40-B's
 * clause on a path nobody has to be authenticated to reach.
 */
const MINTED_SHAPE = /^dpk_[A-Za-z0-9_-]{43}$/;

/** D-230-07's corollary: caller data into an unbounded `text` column, refused not truncated. */
export const MAX_LABEL_LENGTH = 200;

function hashOf(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/**
 * Minted from `randomBytes` and never from anything the caller holds, so no listed
 * record narrows it.
 */
function mintSecret(): string {
  return `dpk_${randomBytes(SECRET_BYTES).toString("base64url")}`;
}

function recordOf(row: {
  id: string;
  accountId: string;
  label: string;
  createdAt: Date;
  revokedAt: Date | null;
}): ApiKeyRecord {
  return {
    keyId: row.id,
    accountId: row.accountId,
    label: row.label,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

class NotKeyOwnerError extends Error {
  constructor(operation: string) {
    super(`${operation}: not permitted.`);
    this.name = "NotKeyOwnerError";
  }
}

export async function issueKey(
  db: Db,
  actor: Actor,
  accountId: string,
  label: string,
): Promise<{ record: ApiKeyRecord; secret: string }> {
  if (!can(actor, "write", { kind: "account", accountId })) {
    throw new NotKeyOwnerError("issueKey");
  }
  if (label.length > MAX_LABEL_LENGTH) {
    /* D-05-09: refuses rather than truncates. A bound that truncates tells the caller it
       succeeded and hands back a record that does not describe the row. */
    throw new NotKeyOwnerError("issueKey");
  }
  const secret = mintSecret();
  const id = randomUUID();
  const [row] = await db
    .insert(schema.apiKey)
    .values({ id, accountId, tokenHash: hashOf(secret), label })
    .returning();
  return { record: recordOf(row), secret };
}

export async function revokeKey(db: Db, actor: Actor, keyId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(schema.apiKey)
    .where(eq(schema.apiKey.id, keyId))
    .limit(1);
  if (existing === undefined) return;
  if (!can(actor, "write", { kind: "account", accountId: existing.accountId })) {
    throw new NotKeyOwnerError("revokeKey");
  }
  await db
    .update(schema.apiKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.apiKey.id, keyId), isNull(schema.apiKey.revokedAt)));
}

/**
 * No cache, by AC4. A process-local map satisfies every other criterion while leaving
 * a revoked key live until the process restarts, so the lookup goes to the database on
 * every call and the reference carries no memo to be wrong.
 */
export async function resolveKey(db: Db, secret: string): Promise<ApiKeyRecord | undefined> {
  /* Before `db` is reached for at all, and `undefined` rather than a throw: a caller able
     to distinguish *malformed* from *no such key* has an identity oracle. */
  if (typeof secret !== "string" || !MINTED_SHAPE.test(secret)) return undefined;
  const [row] = await db
    .select()
    .from(schema.apiKey)
    .where(eq(schema.apiKey.tokenHash, hashOf(secret)))
    .limit(1);
  if (row === undefined || row.revokedAt !== null) return undefined;
  return recordOf(row);
}
