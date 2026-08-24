/* ============================================================
   T120 — the tombstone and the cascade, ruled per table

   D-120-01 (what the `account` row keeps and what it loses),
   D-120-04 (the orphaned run reports), D-120-05 (what is deleted
   and what is left dangling), D-120-10 (the API keys) and
   D-120-13 (the nine tables, one ruling per table).

   ── every cell gets its own database ──
   Same reason as `deletion.test.ts`: a deletion reaches every
   table, so two cells sharing a database means the second reads
   the first's end state and neither can tell its own deletion
   from its neighbour's.

   ── why the per-table cells are separate cells ──
   `save` DELETED, `ballot` DELETED, `note` TOMBSTONED,
   `note_vote` DELETED, `target_actor` KEPT, `run_report` KEPT
   except the orphans, `api_key` REVOKED, `audit` RETAINED. Eight
   different answers. One cell asserting a whole census object
   would red as a single failure naming the whole shape, and a
   reader could not tell which table the module got wrong — and
   an implementer fixing one would have no way to see the other
   seven still standing. Grouped by ANSWER, one cell each.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { upsertFromGitHub } from "@/lib/server/accounts";
import { listNotes } from "@/lib/server/notes";
import { reportedCost } from "@/lib/server/runs";
import { resolveKey } from "@/lib/server/limits";
import { getSignals } from "@/lib/server/counters";

import { RecordedSetup, loadLifecycle, requiredFn, signature } from "./contract";
import {
  ANONYMOUS,
  accountCensus,
  accountRow,
  apiKey,
  ballot,
  bundleRow,
  note,
  operatorActor,
  publishBundle,
  report,
  resolvingCorpus,
  save,
  scratchDatabase,
  seedAccount,
  star,
  type Scratch,
} from "./fixtures";

const databases: Scratch[] = [];
async function freshDatabase(tag: string): Promise<Scratch> {
  const scratch = await scratchDatabase(tag);
  databases.push(scratch);
  return scratch;
}

const ready = new RecordedSetup<true>("the T120 cascade fixture");
beforeAll(async () => {
  await ready.run(async () => true);
});
afterAll(async () => {
  for (const scratch of databases) await scratch.drop();
});

async function deleteAccountVerb() {
  const mod = await loadLifecycle();
  return requiredFn(mod, "deleteAccount", signature("deleteAccount").text);
}

/**
 * An account with a row in every table D-120-13 rules on, all through the product's writers.
 *
 * The community rows go on a BYSTANDER's public bundle rather than the doomed account's own,
 * so a cell that finds them gone cannot be reading a cascade from the bundle's destruction
 * instead of from the account's deletion. The two are different rulings and this is what
 * keeps them apart.
 */
async function populated(tag: string) {
  const scratch = await freshDatabase(tag);
  const doomed = await seedAccount(scratch, `t120-${tag}-doomed`);
  const bystander = await seedAccount(scratch, `t120-${tag}-other`);

  const theirs = await publishBundle(scratch, bystander, `${tag}-host`, "public");
  const target = { kind: "blueprint" as const, refId: theirs.bundleId };

  await star(scratch, doomed, target);
  await save(scratch, doomed, target);
  const bystanderNote = await note(scratch, bystander, target, "the bystander's note");
  const doomedNote = await note(scratch, doomed, target, "the doomed account's note");
  await ballot(scratch, doomed, theirs.bundleId);
  await report(scratch, doomed, theirs.digest);
  const secret = await apiKey(scratch, doomed);

  const before = await accountCensus(scratch, doomed.accountId);
  return { scratch, doomed, bystander, theirs, target, bystanderNote, doomedNote, secret, before };
}

describe("T120 D-120-01 — what the tombstone keeps and what it loses", () => {
  it("B1: `github_id` is scrubbed to `deleted:<…>`, and the row survives at all", async () => {
    ready.require();
    const scratch = await freshDatabase("tomb-b1");
    const doomed = await seedAccount(scratch, "t120-b1-doomed");
    const originalGithubId = doomed.githubId;

    /* Publish, so a `card_version.owner_id` really refers to this row. That is what makes
       the tombstone forced rather than chosen: measured on this schema, `delete from account`
       with a surviving card raises 23503 on `card_version_owner_id_account_id_fk`. */
    await publishBundle(scratch, doomed, "b1-public", "public");

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    const row = await accountRow(scratch, doomed.accountId);
    expect(
      row,
      "the `account` row is gone. Twelve foreign keys reach it and every one is NO ACTION, " +
        "and AC5 keeps the published cards — so a row delete cannot succeed here. D-120-01 " +
        "rules a tombstone.",
    ).toBeDefined();
    /* D-120-19 ratifies `deleted:<accountId>` rather than `deleted:<uuid>`: deterministic and
       therefore IDEMPOTENT, so a second deletion of the same tombstone cannot mint a second
       grave. Pinned to the exact string — `/^deleted:/` alone would admit a random suffix,
       which is the shape that breaks the re-deletion cell below without failing here. */
    expect(row?.github_id).toBe(`deleted:${doomed.accountId}`);
    expect(
      row?.github_id,
      "`github_id` still carries the original identity, so the sign-in door D-120-01 B1 " +
        "closes is open.",
    ).not.toBe(originalGithubId);
  });

  it("B1's consequence: the same GitHub identity signing in again gets a NEW account", async () => {
    ready.require();
    const scratch = await freshDatabase("tomb-signin");
    const doomed = await seedAccount(scratch, "t120-si-doomed");
    await publishBundle(scratch, doomed, "si-public", "public");

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    /* The whole point of B1, driven rather than argued. `upsertFromGitHub` is keyed on
       `github_id` with `onConflictDoUpdate` and NO predicate, and its `set` deliberately
       omits `handle` (T050's AC3) — so an un-scrubbed id hands the next sign-in the same
       `account.id` and the same stored handle, and the deletion is undone through the front
       door. AC4 would then be false however correct `releaseHandle` was. */
    const signedIn = await upsertFromGitHub(scratch.db, {
      githubId: doomed.githubId,
      githubLogin: "t120-si-doomed",
    });
    expect(
      signedIn.accountId,
      "signing in with the deleted identity returned the SAME account id. The deletion is " +
        "undone by the next OAuth callback, and D-120-02 rules AC4 true precisely because " +
        "this chain is severed at its first link.",
    ).not.toBe(doomed.accountId);
    expect(signedIn.handle).toBeNull();
  });

  it("B2: `handle` STAYS, because B-05 puts it inside published bytes", async () => {
    ready.require();
    const scratch = await freshDatabase("tomb-b2");
    const doomed = await seedAccount(scratch, "t120-b2-doomed");
    await publishBundle(scratch, doomed, "b2-public", "public");

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    const row = await accountRow(scratch, doomed.accountId);
    expect(
      row?.handle,
      "the tombstone's `handle` was cleared. D-120-01 B2 keeps it: a published card carries " +
        "the handle inside its own bytes, so an author line pointing at a nulled column is a " +
        "published record that no longer resolves to the name printed in it.",
    ).toBe(doomed.handle);
  });

  it("B3: every profile field is scrubbed — the silence that costs a real person", async () => {
    ready.require();
    const scratch = await freshDatabase("tomb-b3");
    const doomed = await seedAccount(scratch, "t120-b3-doomed");
    await publishBundle(scratch, doomed, "b3-public", "public");

    const before = await accountRow(scratch, doomed.accountId);
    /* The premise, so the assertions below measure a CHANGE rather than a default. */
    for (const column of ["email", "display_name", "bio", "avatar_hue"]) {
      expect(before?.[column]).not.toBeNull();
    }

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    const after = await accountRow(scratch, doomed.accountId);
    for (const column of ["email", "display_name", "bio", "avatar_hue"]) {
      expect(
        after?.[column],
        `account.${column} survived the deletion. D-120-01 B3: an account that keeps its ` +
          `email is not deleted.`,
      ).toBeNull();
    }
    /* `notification_preferences` is `NOT NULL DEFAULT '{}'`, so "scrubbed" is the empty
       object rather than null — asserted as the empty object rather than as falsy, because
       `{}` and a populated object are both truthy and only one of them is scrubbed. */
    expect(after?.notification_preferences).toEqual({});
  });
});

describe("T120 D-120-19 — the tombstone as a subject of later operations", () => {
  it("a transfer INTO a tombstone answers `no account holds`, not a refusal of its own", async () => {
    ready.require();
    const scratch = await freshDatabase("d19-grave");
    const doomed = await seedAccount(scratch, "t120-d19-doomed");
    const living = await seedAccount(scratch, "t120-d19-living");
    await publishBundle(scratch, doomed, "d19-doomed-public", "public");
    const mine = await publishBundle(scratch, living, "d19-mine", "public");

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    const mod = await loadLifecycle();
    const transfer = requiredFn(mod, "transferBundle", signature("transferBundle").text);
    let thrown: unknown;
    try {
      await transfer(scratch.db, living.actor, mine.bundleId, doomed.handle);
    } catch (error) {
      thrown = error;
    }
    const message = String((thrown as Error | undefined)?.message ?? "");

    /* D-120-19, and the reason is the interesting half: B2 keeps `handle` on the tombstone,
       so the name still resolves and a transfer into it has to be refused. The refusal must
       be the SAME sentence a handle nobody ever held gets — a distinct one would tell any
       caller which handles are graves, which is B-03 at a new surface. So the assertion is
       an EQUALITY against the ordinary sentence, and it fails both ways: on a transfer that
       succeeded, and on a refusal that was honest about why. */
    expect(message).toBe("transferBundle: no account holds `" + doomed.handle + "`.");

    /* The disagreeing control, in the same cell because it is the same claim: the sentence a
       never-held handle gets is byte-identical, so the two states are indistinguishable. */
    let unheld: unknown;
    try {
      await transfer(scratch.db, living.actor, mine.bundleId, "t120-never-held-at-all");
    } catch (error) {
      unheld = error;
    }
    expect(String((unheld as Error | undefined)?.message ?? "")).toBe(
      "transferBundle: no account holds `t120-never-held-at-all`.",
    );
    expect((thrown as Error | undefined)?.name).toBe((unheld as Error | undefined)?.name);
  });

  it("re-deleting a tombstone is idempotent and operator-only — D-120-19's handback C", async () => {
    ready.require();
    const scratch = await freshDatabase("d19-redelete");
    const doomed = await seedAccount(scratch, "t120-d19r-doomed");
    const operator = operatorActor(doomed.accountId);
    await publishBundle(scratch, doomed, "d19r-public", "public");

    const remove = await deleteAccountVerb();
    await remove(scratch.db, doomed.actor, doomed.accountId);
    const first = await accountRow(scratch, doomed.accountId);

    /* Operator-only, because the account's own actor is a ghost now and nothing can present
       as it — the second call has no other caller. Idempotent, because `deleted:<accountId>`
       is deterministic: a scrub value carrying fresh randomness would move `github_id` on
       every re-run and the row would never settle. */
    await remove(scratch.db, operator, doomed.accountId);
    const second = await accountRow(scratch, doomed.accountId);

    expect(
      second,
      "re-deleting a tombstone removed the row. D-120-19's handback C rules the second call " +
        "idempotent, and AC5 still needs this row to exist for the published cards.",
    ).toBeDefined();
    expect(second?.github_id).toBe(first?.github_id);
    expect(second?.handle).toBe(first?.handle);
    expect(second?.email).toBeNull();
  });
});

describe("T120 D-120-13 — the nine tables, one ruling at a time", () => {
  it("`save` and `ballot` are DELETED — the ghost's own private data, and its weight", async () => {
    ready.require();
    const { scratch, doomed, before } = await populated("t13-del");
    expect(before["save.account_id"]).toBeGreaterThan(0);
    expect(before["ballot.account_id"]).toBeGreaterThan(0);

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    const after = await accountCensus(scratch, doomed.accountId);
    expect(after["save.account_id"]).toBe(0);
    expect(
      after["ballot.account_id"],
      "the deleted account's ballots survive, so a ghost keeps weighting community signals " +
        "at its stored `validator_weight`.",
    ).toBe(0);
  });

  it("`note_vote` is DELETED and `note` is TOMBSTONED through T170's own mechanism", async () => {
    ready.require();
    const { scratch, doomed, target, doomedNote, bystanderNote } = await populated("t13-note");

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    const after = await accountCensus(scratch, doomed.accountId);
    expect(after["note_vote.account_id"]).toBe(0);

    /* A tombstone, NOT a delete: B-18 keeps the row so counts and cursors stay honest, and
       T170's own mechanism empties the body at delete rather than filtering at read. Both
       halves asserted — the row present AND the body unreadable — because a filter-at-read
       implementation satisfies "unreadable" and leaves the text in the database. */
    expect(
      after["note.account_id"],
      "the deleted account's notes were REMOVED rather than tombstoned. B-18 keeps the row " +
        "so T170's counts and cursors stay honest, and D-120-13 rules this table tombstoned " +
        "through T170's own mechanism rather than by a second author.",
    ).toBeGreaterThan(0);

    const rows = await scratch.pool.query<{ body: string; deleted_at: string | null }>(
      `select body, deleted_at from "note" where id = $1`,
      [doomedNote],
    );
    expect(rows.rows[0]?.deleted_at).not.toBeNull();
    expect(
      rows.rows[0]?.body,
      "the tombstoned note still carries its text in the column. T170 empties the body at " +
        "delete precisely so `unreadable` is true of the storage and not only of the reader.",
    ).toBe("");

    /* And the bystander's note is untouched — without this the cell passes against a module
       that tombstoned every note on the target. */
    const survivors = await scratch.pool.query<{ body: string }>(
      `select body from "note" where id = $1`,
      [bystanderNote],
    );
    expect(survivors.rows[0]?.body).toBe("the bystander's note");
    void listNotes;
    void target;
  });

  it("`target_actor` STAYS and the counters are untouched — D-120-05", async () => {
    ready.require();
    const { scratch, doomed, bystander, target, before } = await populated("t13-stars");
    expect(before["target_actor.account_id"]).toBeGreaterThan(0);
    const signalsBefore = await getSignals(scratch.db, bystander.actor, target);

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    const after = await accountCensus(scratch, doomed.accountId);
    expect(
      after["target_actor.account_id"],
      "the deleted account's stars were removed. D-120-05 leaves the text-keyed rows alone " +
        "and D-120-13 rules `target_actor` STAYS: `target.star_count` is a separate column " +
        "T150 maintains, so deleting the actor rows without it would leave a count nobody " +
        "holds, and rewriting it would be T120 writing another task's counter.",
    ).toBe(before["target_actor.account_id"]);

    const signalsAfter = await getSignals(scratch.db, bystander.actor, target);
    expect(signalsAfter.starCount).toBe(signalsBefore.starCount);
    expect(signalsAfter.downloadCount).toBe(signalsBefore.downloadCount);
  });

  it("`audit` is RETAINED — B-14 is permanent", async () => {
    ready.require();
    const { scratch, doomed } = await populated("t13-audit");

    const before = await scratch.pool.query<{ n: string }>(
      `select count(*)::text as n from "audit"`,
    );
    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);
    const after = await scratch.pool.query<{ n: string }>(
      `select count(*)::text as n from "audit"`,
    );

    /* Not-fewer rather than equal: the deletion may legitimately WRITE an audit row of its
       own, and an equality would red that. What B-14 forbids is losing one. */
    expect(
      Number(after.rows[0]?.n),
      "audit rows disappeared with the account. B-14 makes the log permanent, and a deletion " +
        "that erases its own history is the one state an audit log exists to prevent.",
    ).toBeGreaterThanOrEqual(Number(before.rows[0]?.n));
  });
});

describe("T120 D-120-10 — a deleted account's API keys stop authenticating", () => {
  it("an un-revoked key of the deleted account no longer resolves", async () => {
    ready.require();
    const { scratch, doomed, bystander, secret } = await populated("d10");
    const bystanderSecret = await apiKey(scratch, bystander, "bystander");

    /* The premise: both keys work right now. `resolveKey` answers `undefined` for a
       malformed secret, an unknown one and a revoked one alike, so a cell that never saw the
       key resolve cannot tell "revoked" from "the fixture never issued one". */
    expect(await resolveKey(scratch.db, secret)).toBeDefined();
    expect(await resolveKey(scratch.db, bystanderSecret)).toBeDefined();

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    expect(
      await resolveKey(scratch.db, secret),
      "a deleted account's API key still resolves. `resolveKey` filters on `token_hash` and " +
        "`revoked_at IS NULL` and NEVER JOINS `account`, so it cannot see a tombstone — the " +
        "record it returns carries the ghost's `accountId` at the key tier. D-120-10 rules " +
        "the keys revoked in the same transaction, through `revokeKeysFor`.",
    ).toBeUndefined();

    /* The disagreeing control. Without it this cell passes against a `deleteAccount` that
       revoked every key in the table, and against a `resolveKey` that answered `undefined`
       to everything. */
    expect(
      await resolveKey(scratch.db, bystanderSecret),
      "deleting one account revoked a DIFFERENT account's key.",
    ).toBeDefined();

    /* Revoked, not deleted: `revoked_at` moving from null to an instant is AC4's only
       HTTP-observable form in T230, and a row removed instead would take that observable
       with it. */
    const rows = await scratch.pool.query<{ n: string }>(
      `select count(*)::text as n from "api_key" where account_id = $1 and revoked_at is not null`,
      [doomed.accountId],
    );
    expect(rows.rows[0]?.n).toBe("1");
  });
});

describe("T120 D-120-04 — the orphaned run reports, quantified over the DIGEST", () => {
  it("reports at a digest the deletion orphans are forgotten", async () => {
    ready.require();
    const scratch = await freshDatabase("d04-orphan");
    const doomed = await seedAccount(scratch, "t120-d04-doomed");
    const reader = await seedAccount(scratch, "t120-d04-reader");

    /* A PRIVATE bundle, whose release the deletion destroys, at a digest no other bundle
       carries. `bundleDigest` reads neither owner nor slug nor version, so this needs a
       corpus of its own — two publishes of one corpus share a digest and the orphan case
       would be indistinguishable from the survivor case below. */
    const orphaning = await publishBundle(scratch, doomed, "d04-secret", "private", {
      corpus: resolvingCorpus(1),
    });
    await report(scratch, reader, orphaning.digest);

    expect(await reportedCost(scratch.db, reader.actor, orphaning.digest)).toBeDefined();

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    /* The trigger that enforces "the digest exists" fires on INSERT and UPDATE only —
       measured against the live catalogue — so deleting the last release at a digest leaves
       rows a real foreign key would have refused, in a table `reportedCost` reads BY DIGEST.
       That gap was recorded against T120 by name before this task started. */
    const rows = await scratch.pool.query<{ n: string }>(
      `select count(*)::text as n from "run_report" where release_digest = $1`,
      [orphaning.digest],
    );
    expect(
      rows.rows[0]?.n,
      "run reports survive at a digest whose last release the deletion destroyed. Nothing " +
        "can ever resolve that digest again, and `reportedCost` still aggregates them.",
    ).toBe("0");
  });

  it("reports at a digest a SURVIVING release still carries are KEPT", async () => {
    ready.require();
    const scratch = await freshDatabase("d04-shared");
    const doomed = await seedAccount(scratch, "t120-d04s-doomed");
    const bystander = await seedAccount(scratch, "t120-d04s-other");
    const reader = await seedAccount(scratch, "t120-d04s-reader");
    const corpus = resolvingCorpus(0);

    /* The disagreeing control, and it is the sharper half of D-120-04. An unmodified fork
       shares the upstream's digest by construction (D-05-01), so "delete the reports with the
       release" — the obvious reading — destroys a STRANGER's data. The rule quantifies over
       `release.digest` across ALL bundles, and this is the fixture that separates the two
       implementations. */
    /* PUBLIC FIRST, and that ordering is load-bearing rather than incidental — see the
       constraint documented on `publishBundle`. A private publish stores the cards private,
       and a second account then cannot reuse them: `getCard` hides a stranger's private card
       and `addCard` refuses the duplicate. Written the other way round first, and this cell
       reported T020's `CardStoreError` in place of its criterion. */
    const open = await publishBundle(scratch, doomed, "d04s-open", "public", { corpus });
    const secret = await publishBundle(scratch, doomed, "d04s-secret", "private", { corpus });
    const survivor = await publishBundle(scratch, bystander, "d04s-public", "public", { corpus });
    expect(open.digest).toBe(secret.digest);
    expect(
      secret.digest,
      "the two publishes did not share a digest, so this cell is not testing D-120-04's " +
        "cross-bundle quantifier at all.",
    ).toBe(survivor.digest);

    await report(scratch, reader, secret.digest);

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    /* The private bundle went and BOTH public ones stayed — the deleted account's own
       (AC5: everything you published stays) and the stranger's. Either alone would leave the
       digest anchored, and the cell names both so a reader can see which survivor it is
       relying on. */
    expect(await bundleRow(scratch, secret.bundleId)).toBeUndefined();
    expect(await bundleRow(scratch, open.bundleId)).toBeDefined();
    expect(await bundleRow(scratch, survivor.bundleId)).toBeDefined();
    const rows = await scratch.pool.query<{ n: string }>(
      `select count(*)::text as n from "run_report" where release_digest = $1`,
      [survivor.digest],
    );
    expect(
      rows.rows[0]?.n,
      "the reports were deleted along with the private bundle's release, but a surviving " +
        "PUBLIC release still carries that digest — so the rows were not orphans and the " +
        "deletion destroyed a stranger's data. D-120-04 quantifies over the digest across " +
        "ALL bundles for exactly this case.",
    ).toBe("1");
    expect(await reportedCost(scratch.db, reader.actor, survivor.digest)).toBeDefined();
  });

  it("`run_report` rows the deleted account SUBMITTED are otherwise kept", async () => {
    ready.require();
    const { scratch, doomed, theirs, before } = await populated("d04-kept");
    expect(before["run_report.account_id"]).toBeGreaterThan(0);

    await (await deleteAccountVerb())(scratch.db, doomed.actor, doomed.accountId);

    /* D-120-13: `run_report` KEPT except D-120-04's orphans. The bystander's public bundle
       still carries this digest, so none of these rows is an orphan — and removing them
       would move a stranger's `reportedCost` median. */
    const after = await accountCensus(scratch, doomed.accountId);
    expect(after["run_report.account_id"]).toBe(before["run_report.account_id"]);
    expect(await reportedCost(scratch.db, ANONYMOUS, theirs.digest)).toBeDefined();
  });
});
