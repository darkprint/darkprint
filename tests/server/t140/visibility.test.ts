/* ============================================================
   T140 — AC3, which the contract RULES rather than leaves open

   "The save row survives and the listing omits it, with the count
   matching the listing. ... the row is retained, the read filters
   through `visibleTo`, and `listSaves` and `countSaves` agree BY
   CONSTRUCTION because the count is derived from the same filtered
   query — not a separate `COUNT(*)` that forgets the filter, which
   is the defect this criterion exists to catch."

   ── falsified by COLLAPSE and by SATURATION, and the second is
      the one nobody writes ──
   A filter that drops every private target satisfies "a target that
   went private is omitted" completely, and destroys the criterion
   just as thoroughly as no filter at all — because a saver's own
   private blueprint is visible to them and must stay listed
   (`visibleTo(owner, ownerId)` is `"all"`). So this file drives
   both directions: a target that goes private and must VANISH, and
   a private target the saver owns and must REMAIN. A suite holding
   only the first reads as coverage and holds nothing about when.

   ── the row surviving is observed past the barrel, once ──
   "The save row survives" is a claim about a row no published
   return can describe: a filtered-out save is by construction
   absent from `listSaves` and from the count. R2's precedent —
   `released_at` is on no published return, so T070's blind suite
   could not observe it and said so. Here the ruling makes exactly
   that unobservable half load-bearing, so it is observed by the one
   instrument that reaches it, `storedRowCount`, and the reach is
   confined to that helper.

   ── one input class this file could not create, and now can ──
   A save whose `refId` NEVER named anything. While the write side
   was undecided, driving `saveTarget` at a target that does not
   exist would have pinned an undecided refusal, so this file used
   the DELETED case instead — same read path, same observable,
   created through the published surface. **D-140-07 rules it**:
   `saveTarget` does not check that the target exists, because a
   write-time existence check on a polymorphic target is the oracle
   AC1 closes. So the cell is written now, at the bottom of this
   file, and the deleted case stays because the two reach the read
   filter with different histories.

   ── D-140-05: `visibleTo` takes the READING actor, so the operator
      and the owner correctly DISAGREE ──
   Ruled. The reading actor is what `visibleTo(actor, ownerId)`
   means everywhere else in the tree, and an operator seeing a
   bookmark its owner cannot is operator authority working rather
   than a leak. So this file drives the one case the two readings
   separate on: a save of a target that is private to its owner,
   read by the operator. The alternative reading makes that cell
   green and this one red, which is exactly why it was worth a
   ruling rather than a guess.

   ── D-140-03: three kinds, and the third asks a different question ──
   Blueprint filters on `visibleTo`. Card is visible when ANY
   VERSION is visible to the actor, matching the per-version filter
   the registry already ships — T140 must not mint a second
   visibility semantics for the same rows. Term has no owner column
   and B-07 keeps terms public, so the question is EXISTENCE IN THE
   CURRENT ONTOLOGY VERSION: a term published in one version and
   absent from the next has been deleted in AC3's sense, and nothing
   about its own row changed. Cards ask *visible* and terms ask
   *exists*, and a suite that drove only the blueprint half would
   report AC3 as held while two thirds of it went unobserved.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { accountActor, bind, describe_, operatorActor, absentUuid } from "./contract";
import {
  type AccountFixture,
  type Scratch,
  closeDatabase,
  deleteBundle,
  key,
  openDatabase,
  seedAccount,
  seedBundle,
  seedCard,
  publishNewerOntologyVersion,
  seedTerm,
  setBundleVisibility,
  setCardVisibility,
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

/** A saver and the actor that speaks for them. Each test gets its own, so no test orders another. */
async function saver(s: Scratch): Promise<{ account: AccountFixture; actor: unknown }> {
  const account = await seedAccount(s, "saver");
  return { account, actor: accountActor(account.id, account.handle) };
}

/**
 * The owner's count, required to be a number.
 *
 * D-140-01 rules that even a DENIED caller gets a number — `0` — so the owner certainly does,
 * and `Promise<number>` is what the block publishes. A non-integer here is the signature not
 * being honoured rather than a visibility question.
 */
async function ownerCount(s: Scratch, actor: unknown, accountId: string): Promise<number> {
  const countSaves = await bind("countSaves");
  const answer = await countSaves(s.db, actor, accountId);
  if (typeof answer !== "number" || !Number.isInteger(answer)) {
    throw new Error(
      `\`countSaves\` answered the OWNER ${describe_(answer)}; the block publishes ` +
        `\`Promise<number>\` and AC1's exception is about a visitor, not about the owner.`,
    );
  }
  return answer;
}

describe("AC3: a target that goes private leaves the listing and the row stays", () => {
  it("a saved blueprint that its owner makes private", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    const kept = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
    const goesPrivate = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
    await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: kept.id });
    await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: goesPrivate.id });

    expect(
      await visibleTargets(s, actor, account.id),
      "the fixture's own premise: both public blueprints are listed before anything changes",
    ).toEqual([key({ kind: "blueprint", refId: kept.id }), key({ kind: "blueprint", refId: goesPrivate.id })].sort());
    const storedBefore = await storedRowCount(s, account.id);
    expect(storedBefore).toBe(2);

    await setBundleVisibility(s, goesPrivate.id, "private");

    expect(
      await visibleTargets(s, actor, account.id),
      "AC3: the listing omits a save whose target went private. Nothing else changed.",
    ).toEqual([key({ kind: "blueprint", refId: kept.id })]);
    expect(
      await ownerCount(s, actor, account.id),
      "AC3: the count matches the listing, because it is derived from the same filtered query. " +
        "A separate `COUNT(*)` that forgets the filter answers 2 here and is the exact defect " +
        "this criterion exists to catch.",
    ).toBe(1);
    expect(
      await storedRowCount(s, account.id),
      "AC3 rules the row RETAINED: deleting it would make a target that goes briefly private and " +
        "public again lose a bookmark permanently. Both rows must still be in `save`.",
    ).toBe(storedBefore);
  });

  it("a saved card that its owner makes private", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    const card = await seedCard(s, { ownerId: publisher.id, visibility: "public" });
    await saveTarget(s.db, actor, account.id, { kind: "card", refId: card.cardId });
    expect(await visibleTargets(s, actor, account.id)).toEqual([
      key({ kind: "card", refId: card.cardId }),
    ]);

    await setCardVisibility(s, card.cardId, "private");

    expect(
      await visibleTargets(s, actor, account.id),
      "B-07 makes a card privatable exactly as a blueprint is, so AC3's rule reaches both. A " +
        "filter written for `bundle.visibility` alone leaves this one listed.",
    ).toEqual([]);
    expect(await ownerCount(s, actor, account.id)).toBe(0);
    expect(await storedRowCount(s, account.id), "the row is retained").toBe(1);
  });
});

describe("AC3: a target that is DELETED leaves the listing and the row stays", () => {
  it("a saved blueprint whose bundle row is gone", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    const doomed = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
    await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: doomed.id });
    expect(await visibleTargets(s, actor, account.id)).toEqual([
      key({ kind: "blueprint", refId: doomed.id }),
    ]);

    await deleteBundle(s, doomed.id);

    expect(
      await visibleTargets(s, actor, account.id),
      "`save.target_id` is deliberately NOT a foreign key (`schema.ts:320-330`), so deleting the " +
        "target leaves the save behind and the read has to notice. A join written as an INNER " +
        "join drops it; a read that trusts the stored kind and id alone lists a bookmark to " +
        "nothing.",
    ).toEqual([]);
    expect(await ownerCount(s, actor, account.id)).toBe(0);
    expect(
      await storedRowCount(s, account.id),
      "the row survives its target — which is the whole reason `target_id` is not a foreign key",
    ).toBe(1);
  });
});

describe("AC3, the SATURATION direction: a private target the saver can see stays listed", () => {
  it("the saver's own private blueprint", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);

    const own = await seedBundle(s, { ownerId: account.id, visibility: "private" });
    await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: own.id });

    expect(
      await visibleTargets(s, actor, account.id),
      "`visibleTo(owner, ownerId)` is `\"all\"`, so a saver's own private blueprint IS visible to " +
        "them and AC3's filter must keep it. A filter that drops everything marked private " +
        "satisfies every cell above and destroys the criterion just as completely as no filter " +
        "at all — this is the direction that separates the two.",
    ).toEqual([key({ kind: "blueprint", refId: own.id })]);
    expect(await ownerCount(s, actor, account.id)).toBe(1);
  });

  it("the saver's own private card", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);

    const own = await seedCard(s, { ownerId: account.id, visibility: "private" });
    await saveTarget(s.db, actor, account.id, { kind: "card", refId: own.cardId });

    expect(await visibleTargets(s, actor, account.id)).toEqual([
      key({ kind: "card", refId: own.cardId }),
    ]);
    expect(await ownerCount(s, actor, account.id)).toBe(1);
  });
});

/* ============================================================
   The criterion as a PROPERTY over the output

   "`listSaves` and `countSaves` agree BY CONSTRUCTION" is one
   sentence that binds every state at once, including states nobody
   has thought of yet, and it is falsifiable in a single place — so
   it is asserted as one invariant walked across a sequence of
   states rather than as a clause repeated per cell above.

   The walk mutates one world deliberately. Each step names what it
   changed and what the visible set should become, and the
   disagreements are collected into ONE assertion so a red lists
   every state that broke rather than stopping at the first.
   ============================================================ */

describe("AC3: the count and the listing agree in every state", () => {
  it("across nine states of one account, reached through published writes and real target edits", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const unsaveTarget = await bind("unsaveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    const pubBundle = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
    const pubCard = await seedCard(s, { ownerId: publisher.id, visibility: "public" });
    const term = await seedTerm(s);
    const ownPrivate = await seedBundle(s, { ownerId: account.id, visibility: "private" });

    const steps: { what: string; run: () => Promise<void> }[] = [
      { what: "nothing saved", run: async () => {} },
      {
        what: "a public blueprint saved",
        run: async () => {
          await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: pubBundle.id });
        },
      },
      {
        what: "a public card saved",
        run: async () => {
          await saveTarget(s.db, actor, account.id, { kind: "card", refId: pubCard.cardId });
        },
      },
      {
        what: "a term saved",
        run: async () => {
          await saveTarget(s.db, actor, account.id, { kind: "term", refId: term.termId });
        },
      },
      {
        what: "the saver's own private blueprint saved",
        run: async () => {
          await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: ownPrivate.id });
        },
      },
      {
        what: "the public blueprint went private",
        run: async () => {
          await setBundleVisibility(s, pubBundle.id, "private");
        },
      },
      {
        what: "the public card went private",
        run: async () => {
          await setCardVisibility(s, pubCard.cardId, "private");
        },
      },
      {
        what: "the blueprint that went private came back",
        run: async () => {
          await setBundleVisibility(s, pubBundle.id, "public");
        },
      },
      {
        what: "the saver unsaved their own private blueprint",
        run: async () => {
          await unsaveTarget(s.db, actor, account.id, { kind: "blueprint", refId: ownPrivate.id });
        },
      },
    ];

    const disagreements: string[] = [];
    const observed: string[] = [];
    for (const step of steps) {
      await step.run();
      const listed = await visibleTargets(s, actor, account.id);
      const counted = await ownerCount(s, actor, account.id);
      observed.push(`${step.what}: ${listed.length}`);
      if (counted !== listed.length) {
        disagreements.push(`after "${step.what}": count ${counted}, listing ${listed.length}`);
      }
    }

    expect(
      disagreements,
      "AC3: the count is derived from the same filtered query as the listing, so the two agree in " +
        "every state. A separate `COUNT(*)` disagrees the moment a target stops being visible, " +
        "and it agrees perfectly everywhere else — which is why this is quantified over states " +
        "rather than checked once.\n" +
        `  observed sizes: ${observed.join(" | ")}`,
    ).toEqual([]);

    /*
     * The anti-vacuity half, and it is not decoration: if every step left the visible set the
     * same size, `count === length` would hold everywhere for a reason that has nothing to do
     * with the filter. The walk has to MOVE the quantity the invariant is about, and that is
     * asserted rather than assumed — computed from the observations rather than written down.
     */
    const sizes = new Set(observed.map((o) => o.slice(o.lastIndexOf(": ") + 2)));
    expect(
      sizes.size,
      "the walk must reach more than one visible-set size, or the invariant above holds over a " +
        `quantity that never moved. Observed: ${observed.join(" | ")}`,
    ).toBeGreaterThan(2);
  });
});

/* ============================================================
   D-140-05 — the operator and the owner correctly DISAGREE

   The one case the two readings of "the read filters through
   `visibleTo`" separate on, and the reason it was worth a ruling.
   Under the reading that won, `visibleTo(operator, targetOwner)` is
   `"all"`, so the operator sees a bookmark whose target its owner
   may not — operator authority working. Under the other, the
   operator sees exactly the owner's list and this cell reds.

   Written as a STRICT SUPERSET plus the named difference rather
   than as an equality on a fixed list: what the ruling says is that
   the operator loses nothing and gains the filtered target, and a
   list equality would also be satisfied by an operator view built
   some other way that happened to have the same members today.
   ============================================================ */

describe("D-140-05: `visibleTo` is given the READING actor", () => {
  it("the operator sees a save whose target is private to somebody else; its owner does not", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    const open = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
    const shut = await seedBundle(s, { ownerId: publisher.id, visibility: "private" });
    await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: open.id });
    await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: shut.id });

    const asOwner = await visibleTargets(s, actor, account.id);
    const asOperator = await visibleTargets(s, operatorActor(absentUuid()), account.id);

    expect(
      asOwner,
      "the saver is not the target's owner, so `visibleTo(saver, publisher)` is `\"public\"` and " +
        "the private one is filtered out of their own list",
    ).toEqual([key({ kind: "blueprint", refId: open.id })]);

    expect(
      asOperator,
      "D-140-05: `visibleTo(operator, anyone)` is `\"all\"`, so the operator's read of the same " +
        "account resolves BOTH targets. An operator seeing a bookmark its owner cannot is " +
        "operator authority working, not a leak — and an implementation that filtered through " +
        "the SAVE'S OWNER instead of the reading actor answers the owner's one-item list here.",
    ).toEqual([open.id, shut.id].map((id) => key({ kind: "blueprint", refId: id })).sort());

    expect(
      await ownerCount(s, operatorActor(absentUuid()), account.id),
      "and the count follows the listing for the operator exactly as it does for the owner — " +
        "AC3's agreement clause is about the filtered query, whoever is reading",
    ).toBe(2);

    /* Assert the DIFFERENCE, computed, rather than trusting two lists that happen to differ. */
    expect(
      asOperator.filter((k) => !asOwner.includes(k)),
      "the operator's view must be the owner's plus exactly the filtered target",
    ).toEqual([key({ kind: "blueprint", refId: shut.id })]);
    expect(asOwner.filter((k) => !asOperator.includes(k)), "and it must lose nothing").toEqual([]);
  });
});

/* ============================================================
   D-140-03 — the card half and the term half

   Two thirds of AC3, and neither is reachable by a cell that drives
   a blueprint. Written because the ruling names them as DIFFERENT
   predicates rather than as three applications of one.
   ============================================================ */

describe("D-140-03: a card is visible when ANY version is", () => {
  it("a card with one private version and one public version stays listed", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    const card = await seedCard(s, {
      ownerId: publisher.id,
      visibility: "private",
      version: "1.0.0",
    });
    await seedCard(s, {
      ownerId: publisher.id,
      cardId: card.cardId,
      visibility: "public",
      version: "2.0.0",
    });

    await saveTarget(s.db, actor, account.id, { kind: "card", refId: card.cardId });

    expect(
      await visibleTargets(s, actor, account.id),
      "D-140-03: ANY version visible to the actor makes the card visible, which is the filter " +
        "the registry already ships for the same rows — T140 must not mint a second visibility " +
        "semantics. A read that takes the card's FIRST version, or its LOWEST, drops this one.",
    ).toEqual([key({ kind: "card", refId: card.cardId })]);
    expect(await ownerCount(s, actor, account.id)).toBe(1);
  });

  it("a card whose every version is private is omitted", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");

    const card = await seedCard(s, {
      ownerId: publisher.id,
      visibility: "private",
      version: "1.0.0",
    });
    await seedCard(s, {
      ownerId: publisher.id,
      cardId: card.cardId,
      visibility: "private",
      version: "2.0.0",
    });

    await saveTarget(s.db, actor, account.id, { kind: "card", refId: card.cardId });

    expect(
      await visibleTargets(s, actor, account.id),
      "the other direction of ANY: a rule reading `any version is visible` as `a version exists` " +
        "lists this one, and the two are the same green over the cell above",
    ).toEqual([]);
    expect(await ownerCount(s, actor, account.id)).toBe(0);
    expect(await storedRowCount(s, account.id), "the row is retained").toBe(1);
  });
});

describe("D-140-03: a term asks EXISTENCE IN THE CURRENT ONTOLOGY VERSION", () => {
  it("a term the current version no longer carries leaves the listing, and its row stays", async () => {
    /*
     * Its OWN scratch database, and this is a correction to the rest of this file rather than a
     * flourish. "The current ontology version" is a property of the whole DATABASE, so publishing
     * a newer one here would make every 0.1.0 term seeded by every other test in this file
     * invisible — and it would do it in file order, so the suite would pass or fail depending on
     * which cell ran first. Every other cell gets its own ACCOUNT and shares the database, which
     * is enough when the state a cell moves is scoped to an account; this one moves state that is
     * not.
     */
    const s = await openDatabase();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);

    const term = await seedTerm(s);
    await saveTarget(s.db, actor, account.id, { kind: "term", refId: term.termId });
    expect(
      await visibleTargets(s, actor, account.id),
      "the fixture's own premise: while its version is the current one, the term is listed",
    ).toEqual([key({ kind: "term", refId: term.termId })]);

    /* A newer published version that does not carry it. The term's OWN row is untouched. */
    await publishNewerOntologyVersion(s, [term.termId]);

    expect(
      await visibleTargets(s, actor, account.id),
      "D-140-03: `ontology_term` has no owner column and B-07 keeps terms public, so the " +
        "question is EXISTENCE IN THE CURRENT VERSION rather than visibility — a term published " +
        "in one version and absent from the next has been deleted in AC3's sense. A read that " +
        "asks `does any ontology_term row carry this id` lists it forever, and the term's own " +
        "row is still there, which is what makes the two readings the same green until now.",
    ).toEqual([]);
    expect(await ownerCount(s, actor, account.id)).toBe(0);
    expect(
      await storedRowCount(s, account.id),
      "the save row is retained: AC3 retains the row for every kind, and nothing about the " +
        "term's own row changed either",
    ).toBe(1);
  });

  it("a term the current version does carry stays listed", async () => {
    /* Its own database too, for the reason above. */
    const s = await openDatabase();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);

    const older = await seedTerm(s);
    const { version } = await publishNewerOntologyVersion(s, [older.termId]);
    const current = await seedTerm(s, undefined, version);

    await saveTarget(s.db, actor, account.id, { kind: "term", refId: current.termId });

    expect(
      await visibleTargets(s, actor, account.id),
      "the saturation direction: a rule that drops every term once a newer version exists " +
        "satisfies the cell above completely and destroys the criterion",
    ).toEqual([key({ kind: "term", refId: current.termId })]);
    expect(await ownerCount(s, actor, account.id)).toBe(1);
  });
});

/* ============================================================
   D-140-07 — a target that never existed, from the module side

   "A save of a target that does not exist is accepted and never
   listed; the cost is that a client typo is silently accepted."
   The ruling's own words, and this cell asserts both halves —
   including the cost, because a criterion whose price is stated in
   prose and observed nowhere is a price nobody is paying attention
   to.

   Distinct from the DELETED cell above rather than a second name
   for it: that one reaches the read filter through a row that WAS
   resolvable, this one through a row that never was. A read that
   caches resolution, or one that only re-checks a target it has
   seen before, separates them.
   ============================================================ */

describe("D-140-07: `saveTarget` accepts a target that does not exist", () => {
  it("it resolves, the row is stored, and the listing omits it", async () => {
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);

    const ghost = { kind: "blueprint" as const, refId: `t140-ghost-${randomUUID()}` };

    await expect(
      saveTarget(s.db, actor, account.id, ghost),
      "D-140-07: no write-time existence check. A refusal here would separate `no such target` " +
        "from `a target you may not see`, which is the oracle AC1 exists to close — and it would " +
        "do it on the write path, where AC3's read filter cannot help.",
    ).resolves.toBeUndefined();

    expect(
      await storedRowCount(s, account.id),
      "the row IS stored — `save.target_id` is deliberately not a foreign key, and that is what " +
        "makes the silent acceptance possible in the first place",
    ).toBe(1);
    expect(
      await visibleTargets(s, actor, account.id),
      "and AC3 answers it at READ time: a target that cannot be resolved is omitted, exactly as " +
        "a deleted one is",
    ).toEqual([]);
    expect(await ownerCount(s, actor, account.id)).toBe(0);
  });

  it("a stored ghost is invisible to the count as well as the listing", async () => {
    /*
     * The half a `listSaves`-only cell would miss. AC3's agreement clause is what ties them, and
     * a count built from the stored rows answers 2 here while the listing answers 1 — which is
     * the same defect M11 reddened, reached through an input class no other cell creates.
     */
    const s = await db();
    const saveTarget = await bind("saveTarget");
    const { account, actor } = await saver(s);
    const publisher = await seedAccount(s, "pub");
    const real = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });

    await saveTarget(s.db, actor, account.id, { kind: "blueprint", refId: real.id });
    await saveTarget(s.db, actor, account.id, {
      kind: "blueprint",
      refId: `t140-ghost-${randomUUID()}`,
    });

    expect(await storedRowCount(s, account.id), "two rows stored").toBe(2);
    expect(await visibleTargets(s, actor, account.id)).toEqual([
      key({ kind: "blueprint", refId: real.id }),
    ]);
    expect(await ownerCount(s, actor, account.id), "one visible, and the count says one").toBe(1);
  });
});
