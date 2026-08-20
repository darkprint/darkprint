/* ============================================================
   T140 — AC4, "the three kinds round-trip distinguishably"

   ── the cell that discriminates varies ONE parameter ──
   Three saves of three different targets round-trip fine against a
   module that ignores `kind` entirely, because the three refIds
   already differ. What separates a store keyed on `(account, kind,
   refId)` from one keyed on `(account, refId)` is TWO SAVES THAT
   DIFFER ONLY IN THEIR KIND — and `save_account_target_key` is
   unique on all three columns precisely so that pair is legal.

   One string has to name a target of each kind at once for that to
   be reachable. A blueprint's refId is forced to be the bundle's
   uuid (B-10, `schema.ts:320-330`), a lowercase uuid satisfies
   `CARD_ID`, and a bare uuid is a legal term id — so the shared
   string is the bundle's own id, and `fixtures.ts` asserts the
   card-id half through T070's published `validateCardId` rather
   than reading it off the regex.

   ── quantified over the published kinds, not over three lines ──
   Every per-kind cell loops over `PUBLISHED_KINDS`, and the seeder
   below fails CLOSED on a kind it does not know. `surface.test.ts`
   asserts that set equals `schema.targetKind.enumValues` in both
   directions, so the day a fourth kind lands, either it is covered
   here or something reds — rather than the loop quietly running
   three times over a four-member domain.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { PUBLISHED_KINDS, accountActor, bind, type Target, type TargetKind } from "./contract";
import {
  type AccountFixture,
  type Scratch,
  closeDatabase,
  key,
  openDatabase,
  seedAccount,
  seedBundle,
  seedCard,
  seedTerm,
  storedRowCount,
  visibleTargets,
} from "./fixtures";

let scratch: Promise<Scratch> | undefined;

function db(): Promise<Scratch> {
  if (scratch === undefined) {
    scratch = openDatabase();
    scratch.catch(() => {});
  }
  return scratch;
}

afterAll(async () => {
  await closeDatabase();
});

async function saver(s: Scratch): Promise<{ account: AccountFixture; actor: unknown }> {
  const account = await seedAccount(s, "saver");
  return { account, actor: accountActor(account.id, account.handle) };
}

/**
 * A resolvable, publicly visible target of one kind, optionally under a chosen `refId`.
 *
 * A `switch` with a throwing `default` rather than a lookup table, so a published kind this
 * file does not know how to seed reds with a message naming itself instead of being silently
 * skipped by a `undefined` return.
 */
async function seedTargetOfKind(
  s: Scratch,
  kind: TargetKind,
  ownerId: string,
  refId?: string,
): Promise<Target> {
  switch (kind) {
    case "blueprint": {
      const bundle = await seedBundle(s, { ownerId, visibility: "public" });
      return { kind, refId: bundle.id };
    }
    case "card": {
      const card = await seedCard(s, { ownerId, visibility: "public", cardId: refId });
      return { kind, refId: card.cardId };
    }
    case "term": {
      const term = await seedTerm(s, refId);
      return { kind, refId: term.termId };
    }
    default:
      throw new Error(
        `No fixture exists for the published target kind \`${String(kind)}\`.\n` +
          `  This is a BROKEN TEST, not a failed criterion. \`surface.test.ts\` asserts the ` +
          `published kinds equal \`schema.targetKind.enumValues\`, so a kind reaching here is ` +
          `one both surfaces agree on and this file does not cover. Seed it — do not narrow ` +
          `the loop.`,
      );
  }
}

describe("AC4: each published kind round-trips as itself", () => {
  it.each([...PUBLISHED_KINDS])("a saved `%s` comes back with its own kind and refId", async (kind) => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");
    const target = await seedTargetOfKind(s, kind, publisher.id);

    await saveTarget(s.db, actor, account.id, target);

    expect(
      await visibleTargets(s, actor, account.id),
      `a save of kind \`${kind}\` must come back as \`${kind}\` carrying the refId it was given, ` +
        `byte for byte. \`SaveRecord\` publishes \`targetKind\` and \`refId\` and this is the ` +
        `whole of what "round-trips" means for them.`,
    ).toEqual([key(target)]);
  });
});

describe("AC4: two saves differing ONLY in kind are two saves", () => {
  it("one refId naming a blueprint, a card and a term at once", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    /*
     * The bundle first, because its uuid is the string every other kind then borrows. A
     * blueprint's refId is not this suite's to choose (B-10), so the shared id has to come
     * from there and the other two are made to match it.
     */
    const blueprint = await seedTargetOfKind(s, "blueprint", publisher.id);
    const shared = blueprint.refId;
    const card = await seedTargetOfKind(s, "card", publisher.id, shared);
    const term = await seedTargetOfKind(s, "term", publisher.id, shared);

    expect(
      [card.refId, term.refId],
      "the fixture's own premise: all three targets really do carry one refId, or this cell is " +
        "the ordinary three-different-targets case wearing AC4's name",
    ).toEqual([shared, shared]);

    for (const target of [blueprint, card, term]) {
      await saveTarget(s.db, actor, account.id, target);
    }

    expect(
      await storedRowCount(s, account.id),
      "`save_account_target_key` is unique on `(account_id, target_kind, target_id)` — all three " +
        "columns. Three rows here; a store keyed on `(account, refId)` collapses them to one and " +
        "passes every other AC4 cell in this file.",
    ).toBe(3);
    expect(await visibleTargets(s, actor, account.id)).toEqual(
      [blueprint, card, term].map(key).sort(),
    );
  });

  it("unsaving one kind leaves the other two", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const unsaveTarget = await bind("unsaveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    const blueprint = await seedTargetOfKind(s, "blueprint", publisher.id);
    const shared = blueprint.refId;
    const card = await seedTargetOfKind(s, "card", publisher.id, shared);
    const term = await seedTargetOfKind(s, "term", publisher.id, shared);
    for (const target of [blueprint, card, term]) {
      await saveTarget(s.db, actor, account.id, target);
    }

    await unsaveTarget(s.db, actor, account.id, card);

    expect(
      await visibleTargets(s, actor, account.id),
      "an unsave that matches on `refId` alone takes all three. This is the same axis as the " +
        "cell above, driven through the delete path rather than the insert path — a store can " +
        "key its writes on three columns and its deletes on two, and only a per-verb cell " +
        "separates those.",
    ).toEqual([blueprint, term].map(key).sort());
    expect(await storedRowCount(s, account.id)).toBe(2);
  });
});

describe("AC4: the refId is carried, not normalised", () => {
  it.each([...PUBLISHED_KINDS])("a `%s` refId comes back byte-identical", async (kind) => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");
    const target = await seedTargetOfKind(s, kind, publisher.id);

    await saveTarget(s.db, actor, account.id, target);
    const listSaves = await bind("listSaves");
    const records = (await listSaves(s.db, actor, account.id)) as { refId?: unknown }[];

    expect(records.length, "one save, one record").toBe(1);
    expect(
      records[0]?.refId,
      "`refId` is an identity, and an identity that comes back trimmed, lowercased or " +
        "re-encoded is a different bookmark. T262 renders the list and follows these ids.",
    ).toBe(target.refId);
  });
});
