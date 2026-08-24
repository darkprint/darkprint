/* ============================================================
   T120 — AC4, AC5, AC6

   The three deletion criteria, each with the control that keeps
   it from being satisfied by doing nothing (AC5, AC6) or by
   doing everything (AC4).

   ── AC5's fixture is the one the block names, and it is only
      buildable with a PUBLIC card ──
   "A second account's public bundle pinning the deleted
   account's card." Reachable exactly once: `publishCard` reuses
   an existing row byte-for-byte when `getCard` can SEE it, and
   `getCard` hides a stranger's private card — so a second
   account pinning the deleted account's PRIVATE card falls
   through to `addCard` and is refused as a duplicate. The card
   the stranger's bundle shares is therefore public, which is
   what AC5 is about. Recorded here because a later reader trying
   to build the private version of this fixture will find it
   cannot be built rather than that it was forgotten.

   ── AC6 is quantified by D-120-11, not by `visibility` ──
   "Unreadable by anyone" binds private content NO SURVIVING
   PUBLISHED RELEASE REACHES. A private card that a surviving
   public release pins survives, because its bytes are already
   public through that release and AC5 wins. Both directions are
   driven below; the second one is the whole reason D-120-11
   exists and a suite testing only the first would pass against
   the visibility reading it overturns.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getBundle, listReleases } from "@/lib/server/archive";
import { getCard } from "@/lib/server/cards";
import { checkHandle } from "@/lib/server/naming";
import { publish } from "@/lib/server/publish";

import { RecordedSetup, loadLifecycle, requiredFn, signature } from "./contract";
import {
  ANONYMOUS,
  bareCardIds,
  bundleRow,
  cardRows,
  operatorActor,
  publishBundle,
  reservationRow,
  resolvingCorpus,
  scratchDatabase,
  seedAccount,
  seedHandlelessAccount,
  type Scratch,
} from "./fixtures";

/**
 * One scratch database PER CELL here, unlike the transfer file.
 *
 * A deletion is the one irreversible operation in the registry and it reaches every table.
 * Two deletion cells sharing a database means the second measures the first's end state,
 * and a cell asserting "the account's rows are gone" cannot tell its own deletion from its
 * neighbour's. The cost is one create-and-migrate per cell; the alternative is a suite whose
 * cells are ordered.
 */
const databases: Scratch[] = [];
async function freshDatabase(tag: string): Promise<Scratch> {
  const scratch = await scratchDatabase(tag);
  databases.push(scratch);
  return scratch;
}

const ready = new RecordedSetup<true>("the T120 deletion fixture");
beforeAll(async () => {
  await ready.run(async () => true);
});

afterAll(async () => {
  for (const scratch of databases) await scratch.drop();
});

async function verb(name: string) {
  const mod = await loadLifecycle();
  return requiredFn(mod, name, signature(name).text);
}

describe("T120 AC4 — after a deletion the handle cannot be claimed", () => {
  it("the reservation is released, `checkHandle` says `reserved`, and the row is still there", async () => {
    ready.require();
    const scratch = await freshDatabase("ac4");
    const doomed = await seedAccount(scratch, "t120-ac4-doomed");

    /* The premise: the handle is genuinely held right now. Without it, "unavailable after"
       is green against a fixture where it was never available. */
    expect((await checkHandle(scratch.db, doomed.handle)).available).toBe(false);
    expect((await reservationRow(scratch, doomed.handle))?.status).toBe("active");

    await (await verb("deleteAccount"))(scratch.db, doomed.actor, doomed.accountId);

    const reservation = await reservationRow(scratch, doomed.handle);
    /* AC4 is T070's reservation and the block forbids reimplementing it: `releaseHandle`
       UPDATES, never deletes, because the ROW is what makes the name unclaimable — the
       handle is the primary key. A deletion that removed the row would free the name. */
    expect(
      reservation,
      "the handle_reservation row is gone. The row IS the reservation — `handle` is its " +
        "primary key — so deleting it makes the name claimable, which is the opposite of AC4.",
    ).toBeDefined();
    expect(reservation?.status).toBe("released");
    expect(reservation?.released_at).not.toBeNull();

    /* And the observable a caller actually has. `checkHandle` reports a released row as
       `reserved` rather than `taken` (D-70-18) — the two are both permanent refusals and the
       difference is what a caller can say, so `reserved` is asserted rather than just
       `available: false`, which a `taken` answer would also satisfy. */
    const availability = await checkHandle(scratch.db, doomed.handle);
    expect(availability.available).toBe(false);
    expect(availability.reason).toBe("reserved");
  });

  it("the disagreeing control: an untouched handle is still available and a free one still free", async () => {
    ready.require();
    const scratch = await freshDatabase("ac4-control");
    const doomed = await seedAccount(scratch, "t120-ac4c-doomed");
    const bystander = await seedAccount(scratch, "t120-ac4c-bystander");

    await (await verb("deleteAccount"))(scratch.db, doomed.actor, doomed.accountId);

    /* Without this cell, the one above passes against a `deleteAccount` that released every
       reservation in the table, or against a `checkHandle` that answers `reserved` to
       everything. */
    expect((await reservationRow(scratch, bystander.handle))?.status).toBe("active");
    expect((await checkHandle(scratch.db, bystander.handle)).reason).toBe("taken");
    expect((await checkHandle(scratch.db, "t120-never-claimed")).available).toBe(true);
  });

  it("D-120-08: an account holding no handle is deleted, and `releaseHandle` is skipped", async () => {
    ready.require();
    const scratch = await freshDatabase("ac4-handleless");
    const nameless = await seedHandlelessAccount(scratch);

    /* T050 AC1 rules this state signed-in and incomplete, so it is reachable and deletable.
       `releaseHandle` throws `InvalidNameError` for anything that is not a name segment, so
       a module calling it with `""` or `null` raises ANOTHER MODULE'S class out of T120's
       surface — which is the failure D-120-08 names. AC4 is vacuous here because there is no
       reservation to release, and the criterion that has to hold instead is that the call
       completes. */
    await (await verb("deleteAccount"))(scratch.db, nameless.actor, nameless.accountId);

    const reservations = await scratch.pool.query<{ n: string }>(
      `select count(*)::text as n from "handle_reservation"`,
    );
    expect(
      reservations.rows[0]?.n,
      "deleting a handle-less account created a reservation row. There is no name to reserve.",
    ).toBe("0");
  });
});

describe("T120 AC5 — every published bundle pinning the deleted account's cards still resolves", () => {
  it("a SECOND account's public bundle still resolves, cards and all", async () => {
    ready.require();
    const scratch = await freshDatabase("ac5");
    const doomed = await seedAccount(scratch, "t120-ac5-doomed");
    const stranger = await seedAccount(scratch, "t120-ac5-stranger");
    const corpus = resolvingCorpus();

    /* The doomed account publishes first, so the card rows are ITS. The stranger then
       publishes the identical bytes: `publishCard` finds them through `getCard`, they are
       public, they compare byte-identical, and no new row is written — so the stranger's
       release pins cards the doomed account owns. That is the block's own discriminating
       fixture, built rather than described. */
    const theirs = await publishBundle(scratch, doomed, "ac5-origin", "public");
    const strangers = await publishBundle(scratch, stranger, "ac5-dependent", "public", { corpus });

    const ids = bareCardIds(corpus);
    const beforeCards = await cardRows(scratch, ids);
    expect(beforeCards.length).toBeGreaterThan(0);
    expect(
      beforeCards.every((c) => c.owner_id === doomed.accountId),
      "the stranger's publish created its OWN card rows, so this fixture is two accounts with " +
        "separate cards rather than one pinning the other's — and AC5 would be vacuous.",
    ).toBe(true);
    expect(theirs.digest).toBe(strangers.digest);

    await (await verb("deleteAccount"))(scratch.db, doomed.actor, doomed.accountId);

    /* The stranger's bundle: still there, still public, still pinning the same refs — and
       every ref still RESOLVES to a stored card. A cell that only checked the bundle row
       would be green against a deletion that took every card with it. */
    const survivor = await getBundle(scratch.db, stranger.accountId, "ac5-dependent");
    expect(survivor).toBeDefined();
    const release = (await listReleases(scratch.db, survivor!.id))[0];
    expect(release.digest).toBe(strangers.digest);

    for (const ref of release.cardRefs) {
      const [cardId, version] = ref.split("@");
      const card = await getCard(scratch.db, ANONYMOUS, cardId, version);
      expect(
        card,
        `the stranger's published bundle pins \`${ref}\` and it no longer resolves for an ` +
          `anonymous reader after the owner's account was deleted. AC5 is the criterion that ` +
          `a pinned card cannot be withdrawn.`,
      ).toBeDefined();
    }
  });

  it("the deleted account's OWN published bundle stays too — `everything you published stays`", async () => {
    ready.require();
    const scratch = await freshDatabase("ac5-own");
    const doomed = await seedAccount(scratch, "t120-ac5o-doomed");

    const theirs = await publishBundle(scratch, doomed, "ac5-own", "public");

    await (await verb("deleteAccount"))(scratch.db, doomed.actor, doomed.accountId);

    const row = await bundleRow(scratch, theirs.bundleId);
    expect(
      row,
      "the deleted account's own PUBLISHED bundle is gone. The settings page states the " +
        "cascade as `everything you published stays`, and it is consumed as the spec.",
    ).toBeDefined();
    expect(row?.visibility).toBe("public");
    /* Still attributed to the tombstone: D-120-01's B2 keeps `handle` precisely because
       B-05 puts it inside published bytes and the author line survives. */
    expect(row?.owner_id).toBe(doomed.accountId);
    expect((await listReleases(scratch.db, theirs.bundleId)).length).toBe(1);
  });
});

describe("T120 AC6 — the private half is unreadable by anyone, under D-120-11's quantifier", () => {
  it("a private bundle nothing published pins is DESTROYED, not hidden", async () => {
    ready.require();
    const scratch = await freshDatabase("ac6");
    const doomed = await seedAccount(scratch, "t120-ac6-doomed");
    const operator = await seedAccount(scratch, "t120-ac6-op");

    const secret = await publishBundle(scratch, doomed, "ac6-secret", "private");
    const ids = bareCardIds(secret.corpus);
    expect((await cardRows(scratch, ids)).length).toBeGreaterThan(0);

    await (await verb("deleteAccount"))(scratch.db, doomed.actor, doomed.accountId);

    /* "Unreadable by ANYONE" is why this has to be destruction rather than a visibility flip
       or a filter at read: `can` grants the break-glass operator `read` on any private
       bundle, so a surviving row is readable by somebody by construction. The operator is
       the witness that separates the two implementations. */
    expect(
      await bundleRow(scratch, secret.bundleId),
      "the private bundle's row survived the deletion. AC6 says unreadable by ANYONE, and " +
        "T060 grants the break-glass operator a read on every private bundle — so a row that " +
        "is merely hidden is still readable by an operator.",
    ).toBeUndefined();
    expect(await getBundle(scratch.db, doomed.accountId, "ac6-secret")).toBeUndefined();

    const releases = await scratch.pool.query<{ n: string }>(
      `select count(*)::text as n from "release" where bundle_id = $1`,
      [secret.bundleId],
    );
    expect(releases.rows[0]?.n).toBe("0");

    /* And the cards, which no surviving published release pins. Read through the operator
       rather than anonymously: an anonymous reader is refused a private card whether it
       exists or not, so an anonymous `undefined` proves nothing at all. */
    for (const row of await cardRows(scratch, ids)) {
      expect(
        row,
        "a private card of the deleted account survived, and it is pinned by no surviving " +
          "published release (D-120-11's quantifier), so nothing makes its bytes public.",
      ).toBeUndefined();
    }
    void operator;
  });

  it("D-120-11: a private card a SURVIVING published release pins is KEPT, and AC5 wins", async () => {
    ready.require();
    const scratch = await freshDatabase("ac6-pinned");
    const doomed = await seedAccount(scratch, "t120-ac6p-doomed");
    const corpus = resolvingCorpus();

    /* The state the product's own writer produces, built through it. The PRIVATE publish
       goes first, so `publish` stores the cards at the bundle's visibility — private. The
       PUBLIC publish of the identical bytes then finds them through `getCard` (the same
       account, so visible), compares byte-identical, and writes no new row. The result is a
       public release pinning private cards owned by the account about to be deleted. */
    const secret = await publishBundle(scratch, doomed, "ac6p-secret", "private", { corpus });
    const open = await publishBundle(scratch, doomed, "ac6p-open", "public", { corpus });

    const ids = bareCardIds(corpus);
    const before = await cardRows(scratch, ids);
    expect(before.length).toBeGreaterThan(0);
    expect(
      before.every((c) => c.visibility === "private"),
      "the fixture's cards are not private, so this cell is not testing D-120-11's quantifier " +
        "at all — it is testing the `visibility` reading D-120-11 overturned. The private " +
        "publish must come FIRST for `publish` to store them private.",
    ).toBe(true);
    expect(secret.digest).toBe(open.digest);

    await (await verb("deleteAccount"))(scratch.db, doomed.actor, doomed.accountId);

    /* The private BUNDLE goes; the private CARDS stay, because the public release pins them.
       Both halves in one cell, because either alone is satisfied by a module that applied the
       other rule to everything. */
    expect(await bundleRow(scratch, secret.bundleId)).toBeUndefined();
    expect(await bundleRow(scratch, open.bundleId)).toBeDefined();

    const after = await cardRows(scratch, ids);
    expect(
      after.length,
      "the private cards were destroyed even though a surviving PUBLIC release pins them. " +
        "D-120-11 rules destruction over `pinned by no surviving published release`, not over " +
        "`visibility`, precisely because their bytes are already public through that release " +
        "— and AC5 says a pinned card cannot be withdrawn.",
    ).toBe(before.length);

    const release = (await listReleases(scratch.db, open.bundleId))[0];
    for (const ref of release.cardRefs) {
      const [cardId, version] = ref.split("@");
      expect(
        await getCard(scratch.db, operatorActor(doomed.accountId), cardId, version),
        `the surviving public release pins \`${ref}\` and it does not resolve.`,
      ).toBeDefined();
    }
  });

  it("the disagreeing control: a BYSTANDER's private bundle is untouched", async () => {
    ready.require();
    const scratch = await freshDatabase("ac6-control");
    const doomed = await seedAccount(scratch, "t120-ac6c-doomed");
    const bystander = await seedAccount(scratch, "t120-ac6c-bystander");

    /* A corpus each. Two accounts cannot share one when the first publish is PRIVATE — the
       constraint documented on `publishBundle` — and this control needs both bundles private,
       so the bystander gets a different corpus rather than a different ordering. */
    const theirs = await publishBundle(scratch, doomed, "ac6c-doomed", "private", {
      corpus: resolvingCorpus(0),
    });
    const others = await publishBundle(scratch, bystander, "ac6c-bystander", "private", {
      corpus: resolvingCorpus(1),
    });

    await (await verb("deleteAccount"))(scratch.db, doomed.actor, doomed.accountId);

    /* Without this, every AC6 cell passes against a `deleteAccount` that dropped every
       private bundle in the table. */
    expect(await bundleRow(scratch, theirs.bundleId)).toBeUndefined();
    expect(
      await bundleRow(scratch, others.bundleId),
      "deleting one account destroyed a DIFFERENT account's private bundle.",
    ).toBeDefined();
    expect(await getBundle(scratch.db, bystander.accountId, "ac6c-bystander")).toBeDefined();
  });
});

describe("T120 — the deletion refusals", () => {
  it("a stranger cannot delete an account, and the account survives the attempt", async () => {
    ready.require();
    const scratch = await freshDatabase("del-refusal");
    const doomed = await seedAccount(scratch, "t120-dr-doomed");
    const stranger = await seedAccount(scratch, "t120-dr-stranger");

    let thrown: unknown;
    try {
      await (await verb("deleteAccount"))(scratch.db, stranger.actor, doomed.accountId);
    } catch (error) {
      thrown = error;
    }
    const message = String((thrown as Error | undefined)?.message ?? "");
    if (/Cannot find (package|module)/.test(message)) {
      throw new Error(
        `deleteAccount did not refuse: the throw is this suite's own import of an absent ` +
          `@/lib/server/lifecycle. Reported rather than swallowed — a bare \`rejects.toThrow()\` ` +
          `is satisfied by exactly this rejection.\n  Cause: ${message}`,
      );
    }
    expect(message).toBe("deleteAccount: not this account's owner.");
    expect((thrown as Error | undefined)?.name).toBe("DeletionRefusedError");

    /* What the refusal LEFT BEHIND, which is the half a `rejects.toThrow()` never sees. */
    expect((await reservationRow(scratch, doomed.handle))?.status).toBe("active");
    const row = await scratch.pool.query(`select * from "account" where id = $1`, [
      doomed.accountId,
    ]);
    expect(row.rows[0]?.email).not.toBeNull();
  });

  it("publishing to a deleted account's handle is refused — D-120-01 B2's closing consequence", async () => {
    ready.require();
    const scratch = await freshDatabase("del-tombstone-publish");
    const doomed = await seedAccount(scratch, "t120-dtp-doomed");
    const living = await seedAccount(scratch, "t120-dtp-living");
    const corpus = resolvingCorpus();

    await (await verb("deleteAccount"))(scratch.db, doomed.actor, doomed.accountId);

    /* B2 keeps `handle` on the tombstone so the author line inside published bytes stays
       true, and that leaves the handle resolvable by `resolveOwner`. A living account must
       not be able to publish into it, and a transfer into it is refused for the same reason
       — the tombstone cell in `cascade.test.ts` drives the transfer half. */
    await expect(
      publish(scratch.db, living.actor, {
        ownerHandle: doomed.handle,
        slug: "into-the-grave",
        version: "1.0.0",
        manifest: corpus.manifest,
        dot: corpus.dot,
        cardFiles: corpus.cardFiles,
      }),
    ).rejects.toThrow();
  });
});
