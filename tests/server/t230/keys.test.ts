/* ============================================================
   T230 — issuing, revoking and resolving

   AC3 "a valid API key raises the ceiling and is attributable in
   the audit log", AC4 "a revoked key is refused immediately", and
   the authorization `issueKey`/`revokeKey` take an `Actor` for.

   ── the reading AC4 forces, taken and flagged ──
   "Refused immediately" resolves two ways against a signature that
   returns `ApiKeyRecord | undefined` while `ApiKeyRecord` carries
   `revokedAt: Date | null`. Either `resolveKey` answers `undefined`
   for a revoked key — and then `revokedAt` is only ever null on
   anything `resolveKey` returns, reachable through a listing — or
   it answers the record and every caller is expected to check.
   Both are defensible against the block as written.

   This suite pins the DISJUNCTION both readings share: after a
   revoke, `resolveKey` must not answer a key that reads as usable.
   A pin on either single reading would red a correct
   implementation that read it the other way, and picking would
   remove the finding.

   ── refusal is measured as EFFECT, not as form ──
   No admissible message form is published for a refused `issueKey`
   or `revokeKey`, and `revokeKey` returns `Promise<void>`, so "it
   threw" and "it silently did nothing" are indistinguishable from
   the return. Every authorization cell below therefore asserts
   what the database holds afterwards, which is unambiguous under
   either.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ANONYMOUS,
  type Scratch,
  accountActor,
  describe_,
  dropScratchDatabases,
  freeAccount,
  requiredFn,
  scratchDatabase,
} from "./contract";

let scratch: Scratch;

beforeAll(async () => {
  scratch = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

interface Key {
  accountId: string;
  keyId: string;
  secret: string;
}

async function issueFor(accountId: string, label = "t230"): Promise<Key> {
  const issueKey = await requiredFn("issueKey");
  const answered = (await issueKey(scratch.db, accountActor(accountId), accountId, label)) as {
    record: { keyId: string };
    secret: string;
  };
  return { accountId, keyId: answered.record.keyId, secret: answered.secret };
}

async function apiKeyRows(): Promise<Record<string, unknown>[]> {
  return scratch.query(`select * from "api_key"`);
}

async function auditRows(): Promise<Record<string, unknown>[]> {
  return scratch.query(`select * from "audit" order by "occurred_at"`);
}

/** Both readings of AC4 agree that this is false for a revoked key. */
function readsAsUsable(resolved: unknown): boolean {
  if (resolved === undefined || resolved === null) return false;
  const revokedAt = (resolved as { revokedAt?: unknown }).revokedAt;
  return revokedAt === null || revokedAt === undefined;
}

describe("T230 AC4 — a revoked key is refused immediately", () => {
  /**
   * THE DISCRIMINATING CELL, and the priming call is the whole of it.
   *
   * The block: "The natural optimisation is a process-local map, and it satisfies
   * every other criterion while leaving a revoked key live until the process
   * restarts." A cache that is populated lazily is empty when a test that never
   * resolved before revoking asks, so the criterion passes against exactly the
   * implementation it was written to catch. Resolving FIRST is what makes the cache
   * exist to be wrong.
   */
  it("resolves, then revokes, then refuses — in one process, with the cache warm", async () => {
    const revokeKey = await requiredFn("revokeKey");
    const resolveKey = await requiredFn("resolveKey");
    const accountId = await freeAccount(scratch);
    const key = await issueFor(accountId);

    const before = await resolveKey(scratch.db, key.secret);
    expect(
      readsAsUsable(before),
      `The key did not read as usable before it was revoked, so the revoke below observes ` +
        `nothing and this cell would pass against an implementation that never resolves ` +
        `anything. resolveKey answered ${describe_(before)}.`,
    ).toBe(true);

    await revokeKey(scratch.db, accountActor(accountId), key.keyId);
    const after = await resolveKey(scratch.db, key.secret);

    expect(
      readsAsUsable(after),
      `A revoked key still reads as usable. resolveKey answered ${describe_(after)}.\n` +
        `  AC4 forbids caching resolveKey: a process-local map satisfies every other ` +
        `criterion while leaving a revoked key live until the process restarts. This call is ` +
        `the SECOND in the same process, and the first is what populates a lazy cache — ` +
        `which is why an AC4 test that revokes before it ever resolves passes against ` +
        `exactly the implementation the prohibition names.\n` +
        `  Both readings of "refused immediately" agree here: undefined, or a record whose ` +
        `\`revokedAt\` is set. This asserts only what they share.`,
    ).toBe(false);
  });

  /**
   * The same criterion without the priming call. It is expected to PASS in both
   * states, and that is why it is worth having: it is not a second way for AC4 to
   * fail, it is the discriminator that says WHICH wrong implementation is present.
   *
   * Cold-green with the primed cell red is a cache. Both red is a revoke that does not
   * revoke. Nothing else in this file separates those two, and they need different
   * fixes.
   */
  it("cold — a key revoked before it was ever resolved is refused too", async () => {
    const revokeKey = await requiredFn("revokeKey");
    const resolveKey = await requiredFn("resolveKey");
    const accountId = await freeAccount(scratch);
    const key = await issueFor(accountId);

    await revokeKey(scratch.db, accountActor(accountId), key.keyId);

    expect(
      readsAsUsable(await resolveKey(scratch.db, key.secret)),
      `A key revoked before anything resolved it still reads as usable. This cell is cold, ` +
        `so no cache is involved: revocation itself does not take.`,
    ).toBe(false);
  });

  it("revoking one key leaves the account's other keys usable", async () => {
    const revokeKey = await requiredFn("revokeKey");
    const resolveKey = await requiredFn("resolveKey");
    const accountId = await freeAccount(scratch);
    const doomed = await issueFor(accountId, "doomed");
    const spared = await issueFor(accountId, "spared");

    await revokeKey(scratch.db, accountActor(accountId), doomed.keyId);

    expect(
      readsAsUsable(await resolveKey(scratch.db, spared.secret)),
      `Revoking one key of an account revoked another. \`revokeKey(db, actor, keyId)\` ` +
        `addresses one row; a revoke that reaches the account instead is the difference ` +
        `between rotating a key and locking yourself out.`,
    ).toBe(true);
  });
});

describe("T230 the Actor issueKey and revokeKey take", () => {
  it("a stranger cannot issue a key against another account", async () => {
    const issueKey = await requiredFn("issueKey");
    const owner = await freeAccount(scratch);
    const stranger = await freeAccount(scratch);
    const before = (await apiKeyRows()).length;

    await issueKey(scratch.db, accountActor(stranger), owner, "stolen").catch(() => undefined);

    expect(
      (await apiKeyRows()).length,
      `A key was minted for an account the caller does not speak for. Measured as the row ` +
        `count rather than as a rejection, because the block publishes no message form for ` +
        `this refusal and an implementation that throws after writing has still issued the ` +
        `credential.`,
    ).toBe(before);
  });

  it("an anonymous caller cannot issue a key", async () => {
    const issueKey = await requiredFn("issueKey");
    const owner = await freeAccount(scratch);
    const before = (await apiKeyRows()).length;

    await issueKey(scratch.db, ANONYMOUS, owner, "anonymous").catch(() => undefined);

    expect((await apiKeyRows()).length).toBe(before);
  });

  it("a stranger cannot revoke another account's key", async () => {
    const revokeKey = await requiredFn("revokeKey");
    const resolveKey = await requiredFn("resolveKey");
    const owner = await freeAccount(scratch);
    const stranger = await freeAccount(scratch);
    const key = await issueFor(owner);

    await revokeKey(scratch.db, accountActor(stranger), key.keyId).catch(() => undefined);

    expect(
      readsAsUsable(await resolveKey(scratch.db, key.secret)),
      `A stranger revoked another account's key. Measured through resolveKey rather than ` +
        `through the return, because \`revokeKey\` returns \`Promise<void>\` and a refusal ` +
        `that throws is indistinguishable from one that silently does nothing — while a key ` +
        `that stopped working is unambiguous under either.`,
    ).toBe(true);
  });
});

describe("T230 AC3 — a key is attributable in the audit log", () => {
  /**
   * A READING, flagged. B-14 makes every state change write an audit row and AC3 says
   * a key is "attributable in the audit log", but §T230 publishes no audit action name
   * and does not say whether this module writes the row or a wrapper does. T240 owns
   * `lib/server/observability/**`, is `todo`, and has `lib/server/limits/**` Forbidden
   * in both directions — so nothing published joins the two.
   *
   * What is asserted is the weakest thing AC3 can mean and still mean anything: minting
   * a credential leaves a trace naming who did it. Not the action string, which is
   * unpublished. Not the count either — `fresh.length` is right there and an exactly-one
   * assertion would run, so this is a decision about SCOPE rather than a claim about
   * reach: "exactly one row per state-changing operation" is T240's AC1, it is quantified
   * over T240's operations, and pinning it here would make this suite a second contract
   * for a module whose own section is still `todo`.
   */
  it("issuing a key leaves an audit row naming the actor", async () => {
    const accountId = await freeAccount(scratch);
    const before = await auditRows();
    await issueFor(accountId, "audited");
    const after = await auditRows();

    const fresh = after.slice(before.length);
    expect(
      fresh.length,
      `Issuing a key wrote no audit row. B-14: "every state change writes an audit row ` +
        `(actor, action, target, time)", and AC3 requires a key be "attributable in the ` +
        `audit log" — a key nobody can attribute to an issuing account is the one credential ` +
        `in the system with no provenance.\n` +
        `  READING, flagged: §T230 publishes no audit action name and does not say whether ` +
        `this module writes the row or a wrapper does, and T240 is \`todo\` with ` +
        `\`lib/server/limits/**\` Forbidden. If this red is the test, it is the contract that ` +
        `owes the sentence.`,
    ).toBeGreaterThan(0);

    expect(
      fresh.map((row) => row.actor_id),
      `An audit row was written and none of them names the issuing account, so the trace ` +
        `exists and attributes nothing.`,
    ).toContain(accountId);
  });

  it("revoking a key leaves an audit row too", async () => {
    const revokeKey = await requiredFn("revokeKey");
    const accountId = await freeAccount(scratch);
    const key = await issueFor(accountId, "revoked-audited");
    const before = await auditRows();

    await revokeKey(scratch.db, accountActor(accountId), key.keyId);

    expect(
      (await auditRows()).length,
      `Revoking a key wrote no audit row. Revocation is the state change an incident ` +
        `response reads first, and B-14 quantifies over every state change rather than over ` +
        `the ones somebody listed.`,
    ).toBeGreaterThan(before.length);
  });
});
