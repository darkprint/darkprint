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
import { type Actor, can } from "@/lib/server/policy";

export interface LimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
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

/* --------------------- ceilings, the reference's own --------------------- */

const WINDOW_MS = 60 * 60 * 1000;

const CEILING: Record<string, { anonymous: number; account: number; keyed: number }> = {
  read: { anonymous: 60, account: 120, keyed: 600 },
  write: { anonymous: 10, account: 40, keyed: 200 },
};

const DEFAULT_CEILING = { anonymous: 30, account: 60, keyed: 300 };

/**
 * The counters, in memory. AC5 forbids a write on an under-ceiling read, so they
 * cannot live in a table that is written per request. That is the consequence THIS
 * reference drew from the criterion rather than the only one available — a shared store
 * outside Postgres would satisfy it too — and it is why `db` appears in `checkLimit`'s
 * signature here only for the key lookup a keyed subject needs.
 */
interface Window {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Window>();

function windowFor(key: string, now: number): Window {
  const existing = counters.get(key);
  if (existing !== undefined && existing.resetAt > now) return existing;
  const fresh = { count: 0, resetAt: now + WINDOW_MS };
  counters.set(key, fresh);
  return fresh;
}

/** The subject's counter key. Never rendered anywhere a caller can see. */
function subjectKey(subject: { accountId: string | null; keyId: string | null; ip: string }): string {
  if (subject.keyId !== null) return `key:${subject.keyId}`;
  if (subject.accountId !== null) return `account:${subject.accountId}`;
  return `ip:${subject.ip}`;
}

export async function checkLimit(
  db: Db,
  subject: { accountId: string | null; keyId: string | null; ip: string },
  bucket: string,
): Promise<LimitVerdict> {
  const ceilings = CEILING[bucket] ?? DEFAULT_CEILING;

  /* A revoked key is refused immediately here too, or its raised ceiling outlives the
     revocation and every AC4 test that only drives `resolveKey` passes against it. */
  let tier: keyof typeof DEFAULT_CEILING = "anonymous";
  if (subject.keyId !== null) {
    const [row] = await db
      .select({ revokedAt: schema.apiKey.revokedAt })
      .from(schema.apiKey)
      .where(eq(schema.apiKey.id, subject.keyId))
      .limit(1);
    if (row !== undefined && row.revokedAt === null) tier = "keyed";
    else if (subject.accountId !== null) tier = "account";
  } else if (subject.accountId !== null) {
    tier = "account";
  }

  const limit = ceilings[tier];
  const now = Date.now();
  const window = windowFor(`${bucket}|${tier}|${subjectKey(subject)}`, now);

  if (window.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt: new Date(window.resetAt) };
  }
  window.count += 1;
  return {
    allowed: true,
    limit,
    remaining: limit - window.count,
    resetAt: new Date(window.resetAt),
  };
}

/* --------------------- keys --------------------- */

const SECRET_BYTES = 32;

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

async function audit(
  db: Db,
  actor: Actor,
  action: string,
  targetId: string,
  decision: "allowed" | "denied",
): Promise<void> {
  await db.insert(schema.audit).values({
    actorId: actor.kind === "anonymous" ? null : actor.accountId,
    actorKind: actor.kind === "operator" ? "operator" : "owner",
    action,
    targetKind: "api_key",
    targetId,
    decision,
  });
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
  const secret = mintSecret();
  const id = randomUUID();
  const [row] = await db
    .insert(schema.apiKey)
    .values({ id, accountId, tokenHash: hashOf(secret), label })
    .returning();
  await audit(db, actor, "api_key.issue", id, "allowed");
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
  await audit(db, actor, "api_key.revoke", keyId, "allowed");
}

/**
 * No cache, by AC4. A process-local map satisfies every other criterion while leaving
 * a revoked key live until the process restarts, so the lookup goes to the database on
 * every call and the reference carries no memo to be wrong.
 */
export async function resolveKey(db: Db, secret: string): Promise<ApiKeyRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.apiKey)
    .where(eq(schema.apiKey.tokenHash, hashOf(secret)))
    .limit(1);
  if (row === undefined || row.revokedAt !== null) return undefined;
  return recordOf(row);
}
