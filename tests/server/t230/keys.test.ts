/* ============================================================
   T230 — issuing, revoking and resolving

   AC4 "a revoked key is refused immediately", AC3's attribution
   half as **D-230-08** rules it — (a) ATTRIBUTABLE, not (b)
   audited — the authorization `issueKey`/`revokeKey` take an
   `Actor` for, and **D-230-07**'s refusal-before-hashing on the
   one path nobody has to authenticate to reach.

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
import { readFile } from "node:fs/promises";

import {
  ANONYMOUS,
  type Scratch,
  accountActor,
  awaited,
  describe_,
  dropScratchDatabases,
  freeAccount,
  proxyDb,
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

/**
 * F-230-J: this predicate asserted the INTERSECTION of two readings and the intersection was
 * weaker than the criterion either reading states.
 *
 * It read: "both readings of AC4 agree this is false for a revoked key — `undefined`, or a record
 * whose `revokedAt` is set. This asserts only what they share." That is a careful, well-argued
 * choice and it emptied the only cell defending AC4. A record with `revokedAt` populated returned
 * `false` here, which is exactly what a `resolveKey` stripped of `isNull(revokedAt)` hands back —
 * so **deleting the one line implementing "a revoked key is refused immediately" reddened 0 of
 * 164 cells across both halves**, while end-to-end a revoked key held a 6000 ceiling against 600.
 *
 * The rule this produced, and it is general: **when a cell's comment names a concrete bad output,
 * the assertion must EXCLUDE that output, not merely admit the good one.** `resolveKey` must
 * return nothing at all for a revoked key; a record carrying `revokedAt` is the bad output and is
 * now refused here rather than tolerated.
 */
function readsAsUsable(resolved: unknown): boolean {
  return resolved !== undefined && resolved !== null;
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

    await awaited(issueKey(scratch.db, accountActor(stranger), owner, "stolen")).catch(
      () => undefined,
    );

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

    await awaited(issueKey(scratch.db, ANONYMOUS, owner, "anonymous")).catch(() => undefined);

    expect((await apiKeyRows()).length).toBe(before);
  });

  it("a stranger cannot revoke another account's key", async () => {
    const revokeKey = await requiredFn("revokeKey");
    const resolveKey = await requiredFn("resolveKey");
    const owner = await freeAccount(scratch);
    const stranger = await freeAccount(scratch);
    const key = await issueFor(owner);

    await awaited(revokeKey(scratch.db, accountActor(stranger), key.keyId)).catch(
      () => undefined,
    );

    expect(
      readsAsUsable(await resolveKey(scratch.db, key.secret)),
      `A stranger revoked another account's key. Measured through resolveKey rather than ` +
        `through the return, because \`revokeKey\` returns \`Promise<void>\` and a refusal ` +
        `that throws is indistinguishable from one that silently does nothing — while a key ` +
        `that stopped working is unambiguous under either.`,
    ).toBe(true);
  });
});

describe("T230 AC3(a) — the attribution this module publishes", () => {
  /**
   * D-230-08 ruled the reading I flagged, and ruled AGAINST it. I read AC3's audit half
   * as *this module writes an audit row* and asserted a row appeared; the ruling is that
   * AC3(a) is ATTRIBUTABLE and not (b) audited — "this module publishes the attribution
   * — `resolveKey` returns `keyId` and `accountId` — and whoever writes the audit row has
   * what it needs. T240 is not a dependency and T230 is correctly waved."
   *
   * The two audit cells are deleted. What replaces them is the half the ruling makes
   * T230's, and it is the half a key-set pin cannot reach: that the attribution is
   * CORRECT. `Object.keys` says `accountId` is present; nothing before this said it
   * names the account the key was issued for, and a resolver joining on the wrong column
   * satisfies every shape assertion in this suite while attributing every request to
   * whichever account happens to sort first.
   */
  it("resolveKey attributes a secret to the account it was issued for", async () => {
    const resolveKey = await requiredFn("resolveKey");
    const mine = await freeAccount(scratch);
    const theirs = await freeAccount(scratch);

    /* A second account with its own key, so "returns an accountId" and "returns the
       right one" are different results rather than the same one. */
    const ours = await issueFor(mine, "mine");
    await issueFor(theirs, "theirs");

    const resolved = (await resolveKey(scratch.db, ours.secret)) as {
      accountId?: unknown;
      keyId?: unknown;
    } | undefined;

    expect(resolved, `resolveKey answered nothing for a key just issued`).toBeDefined();
    expect(
      resolved?.accountId,
      `resolveKey attributed the secret to the wrong account. Two accounts each hold a key ` +
        `here, so this cell separates "an accountId came back" from "the right accountId ` +
        `came back" — and every key-set assertion in this suite passes under both.`,
    ).toBe(mine);
    expect(
      resolved?.keyId,
      `resolveKey answered a different key's id than the one issueKey returned for this ` +
        `secret. AC3(a) is the whole of what this module owes the audit writer, and a keyId ` +
        `that does not address the row makes revokeKey unreachable for that key.`,
    ).toBe(ours.keyId);
  });

  it("checkLimit's subject carries both halves of the attribution", async () => {
    /*
     * RE-POINTED AT T231'S MERGE. The criterion survives; the shape it read moved.
     *
     * This read `checkLimit`'s SECOND parameter and asserted it named `accountId` and `keyId`,
     * because the subject was published flat as `{ accountId, keyId, ip }`. Under D-231-01 the
     * second parameter is `bucket: string` and the subject is a three-armed union — so the cell
     * was reading the wrong slot and would have red against a correct module.
     *
     * **D-230-08's property is unchanged and still holds**: both halves of the attribution reach
     * whoever writes the audit row. They now arrive through the arms rather than through one flat
     * record — the account arm carries `accountId`, and the keyed arm carries a `ResolvedKey`,
     * which is an `ApiKeyRecord` and therefore supplies **both** `keyId` and `accountId`. That is
     * strictly more attribution than before, not less, since the keyed arm can no longer be built
     * with one half missing.
     *
     * Asserted against the shipped union rather than against the parsed block, because the block
     * that defines `LimitSubject` is §T231's and this suite's parser reads §T230's.
     */
    const source = await readFile(
      new URL("../../../lib/server/limits/types.ts", import.meta.url),
      "utf8",
    );
    /* Captured to the blank line that ends the declaration, NOT to the first `;` — the members
       inside each arm are semicolon-separated, so a non-greedy stop at `;` truncates after the
       first arm and the assertion below then reports "no longer carries `accountId`", which is a
       plausible wrong cause. Caught by the message naming a member the union plainly has. */
    const union = /export type LimitSubject =([\s\S]*?)\n\s*\n/.exec(source)?.[1] ?? "";

    expect(
      union.length,
      "`export type LimitSubject` was not found in lib/server/limits/types.ts, which would make " +
        "the assertions below pass over an empty string.",
    ).toBeGreaterThan(0);

    for (const member of ["accountId", "key"]) {
      expect(
        new RegExp(`\\b${member}\\s*:`).test(union),
        `\`LimitSubject\` no longer carries \`${member}\` on any arm.\n` +
          `  union: ${union.trim()}\n` +
          `  D-230-08 makes AC3(a) satisfiable precisely because this module hands both ` +
          `halves of the attribution to whoever writes the audit row. The account arm supplies ` +
          `\`accountId\`; the keyed arm supplies a \`ResolvedKey\`, which is an \`ApiKeyRecord\` ` +
          `and carries both \`keyId\` and \`accountId\`. Dropping either moves AC3 back to being ` +
          `unreachable, which is the state D-230-01 fixed one criterion over.`,
      ).toBe(true);
    }
  });
});

describe("T230 D-230-07 — resolveKey refuses malformed input before it hashes it", () => {
  /**
   * "The secret is unauthenticated caller input of unbounded length, so hashing it first
   * is work proportional to attacker input performed to decide the input is worthless —
   * D-40-B's clause on a path nobody has to be authenticated to reach."
   *
   * Measured as the database never being reached, which is the observable that
   * distinguishes *refused before hashing* from *refused after a lookup*. A cell that
   * only checked the return value passes against the version that hashes a megabyte and
   * then queries, which is the version the ruling exists to forbid.
   */
  it("a 1 MB secret is refused without the database being touched", async () => {
    const resolveKey = await requiredFn("resolveKey");
    const probe = proxyDb(scratch.db);
    const answered = await resolveKey(probe.db, "x".repeat(1024 * 1024));

    expect(
      answered,
      `resolveKey answered ${describe_(answered)} for a megabyte of caller input.`,
    ).toBeUndefined();
    expect(
      probe.touched(),
      `resolveKey reached the database for a secret that is not of the minted shape. ` +
        `First reached: ${probe.reached().slice(0, 6).join(", ")}.\n` +
        `  D-230-07: the module MINTS the secret, so its length and alphabet are known by ` +
        `construction and a refusal costs nothing. Work proportional to attacker input, ` +
        `performed to decide the input is worthless, on a path nobody has to authenticate ` +
        `to reach.`,
    ).toBe(false);
  });

  it("an empty secret is refused, and refused the same way", async () => {
    const resolveKey = await requiredFn("resolveKey");
    const probe = proxyDb(scratch.db);
    expect(await resolveKey(probe.db, "")).toBeUndefined();
    expect(probe.touched(), `an empty secret reached the database`).toBe(false);
  });

  /**
   * The identity-oracle half, and it is the reason the ruling says `undefined` rather
   * than a throw: "a caller able to distinguish *malformed* from *no such key* has an
   * identity oracle". Asserted as the DIFFERENCE between the two answers being nothing
   * at all, rather than by checking each against a shape — a throw for one and
   * `undefined` for the other satisfies every per-case assertion and is exactly the
   * oracle.
   */
  it("malformed and unknown-but-well-formed are indistinguishable", async () => {
    const resolveKey = await requiredFn("resolveKey");
    const accountId = await freeAccount(scratch);
    const live = await issueFor(accountId, "shape-donor");

    const malformed = await awaited(
      resolveKey(scratch.db, "\u0000 not a key at all"),
    ).catch((error: unknown) => ({ threw: String(error) }));
    /* Same length and alphabet as a real one, so only the value differs. */
    const unknown = await awaited(
      resolveKey(scratch.db, `${live.secret.slice(0, -1)}${live.secret.endsWith("A") ? "B" : "A"}`),
    ).catch((error: unknown) => ({ threw: String(error) }));

    expect(
      { malformed, unknown },
      `resolveKey answers malformed input differently from a well-formed secret nothing ` +
        `issued. D-230-07 forbids exactly this: the difference is an oracle, and a caller ` +
        `who can tell the two apart can learn which shapes are real keys without holding ` +
        `one.`,
    ).toEqual({ malformed: undefined, unknown: undefined });
  });

  /**
   * The corollary, and it is about the OTHER direction of caller input: "`label` is
   * caller data into an unbounded `text` column and gets a published number, and it
   * REFUSES rather than truncates (D-05-09)."
   *
   * The number is not in the block, so nothing here pins one. What is pinned is the
   * property D-05-09 names and that a number cannot express: whatever is accepted comes
   * back unchanged. A bound that truncates is worse than no bound, because the caller is
   * told it succeeded and holds a record that does not describe the row.
   */
  it("an accepted label is stored whole, never truncated", async () => {
    const issueKey = await requiredFn("issueKey");
    const accountId = await freeAccount(scratch);
    const label = `t230-${"L".repeat(180)}-end`;

    const answered = await awaited(
      issueKey(scratch.db, accountActor(accountId), accountId, label),
    ).catch(() => undefined);
    if (answered === undefined) return; /* refused: D-05-09's other arm, and correct */

    const record = (answered as { record: { label: string; keyId: string } }).record;
    expect(
      record.label,
      `issueKey accepted a label and stored a different one. D-05-09: a bound that ` +
        `truncates rather than refuses is worse than no bound — the caller is told it ` +
        `succeeded and holds a record that does not describe the row.`,
    ).toBe(label);

    const [row] = await scratch.query(`select "label" from "api_key" where "id" = $1`, [
      record.keyId,
    ]);
    expect(
      row?.label,
      `the record and the row disagree about the label, so the truncation is in the ` +
        `column rather than in the return`,
    ).toBe(label);
  });
});
