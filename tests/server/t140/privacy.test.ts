/* ============================================================
   T140 — AC1, and it is the whole task

   "A save is invisible to every caller but its owner and the
   operator, INCLUDING ITS COUNT."

   ── D-140-01 rules the value, so the value IS pinned — and the
      pairs are kept beside it rather than replaced by it ──
   `countSaves` stays `Promise<number>` and a denied caller gets
   `0`. The prose that said a visitor gets "`undefined`-equivalent
   behaviour, not zero" is WITHDRAWN: under `Promise<number>`, *not
   yours*, *no such account* and *yours and empty* all answer 0,
   which is B-03 satisfied rather than violated, and the leak AC1 is
   actually about is answering a non-owner the TRUE count.

   So both instruments are here and they fail differently. A PIN
   says what one answer is; a PAIR says two answers cannot be told
   apart. Deleting the pairs on the strength of the pin would be a
   stronger-looking assertion covering less — a pin is only pinned
   for the channel it names, and an implementation that answers 0
   and leaks through a differing rejection, a differing latency of
   refusal or a member nobody enumerated passes it perfectly. That
   is T081's F1 verbatim: its key-set whitelist was the strongest
   instrument in the task and it was a whitelist over the BODY, so a
   driver code on a response header reddened nothing.

   ── D-140-02: the readers answer, the writers REJECT ──
   `void` cannot express *denied*, so a silent no-op tells a caller
   its save succeeded when it did not. The three writers reject with
   `NotAccountOwnerError`, CONSUMED from `@/lib/server/accounts`.
   `outcomeOf` captures both shapes into one comparable digest,
   which is what lets one sweep quantify over the whole published
   surface instead of splitting into two that cover different
   halves.

   ── two pair families, and they are not the same question ──
   P1, the STATE pair: one non-owner, two accounts differing only in
   whether they hold saves. This is the count leak and the list
   leak.
   P2, the EXISTENCE pair: one non-owner, a real account and an
   account id naming nothing. This is B-03 verbatim — *no such
   thing* and *not yours* must be indistinguishable.

   What P2 reaches and P1 does not, named per half because the two
   are reachable by different mistakes. On the WRITERS:
   `save.account_id` is a foreign key to `account.id`, so an
   implementation that writes before it checks answers
   `NotAccountOwnerError` for the real account and a `SaveStoreError`
   for the absent one. On the READERS: an implementation that
   resolves the account first — the natural shape, and the one
   `getAccount` already publishes — answers "no such account" for
   one and an empty list for the other. Both are ordinary
   implementations rather than contrived ones, which is what makes
   these cells reachable rather than decorative.

   ── and the control, because every one of those cells passes on a
      module that refuses everybody ──
   A module whose every function throws satisfies all 70 pair cells
   perfectly. So the positive control lives in this file rather than
   another, it is measured rather than arranged — the difference
   between the two accounts is COMPUTED and required to be non-zero,
   not written down as a constant — and it is a property of the
   fixture, which is the side of the boundary a mutation can reach.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { NotAccountOwnerError } from "@/lib/server/accounts";

import {
  DENIED_READER_ANSWER,
  NON_OWNERS,
  PUBLISHED_READERS,
  PUBLISHED_WRITERS,
  accountActor,
  absentUuid,
  assertIndistinguishable,
  assertNoDriverProse,
  assertSealed,
  bind,
  notAccountOwnerMessage,
  operatorActor,
  outcomeOf,
  rejection,
  type PublishedName,
  type Target,
} from "./contract";
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

/* ============================================================
   The world, built LAZILY and never in a `beforeAll`

   Seeding needs `saveTarget`, which is the module under test. A
   hook that throws runs no test and adds nothing to the failed
   column — it moves the SKIPPED count instead, which is the third
   of the three ways a run prints green while measuring less than it
   claims, and it would hide every criterion in this file behind one
   red. Memoised as the promise, rejection included, so each test
   gets its own copy of the same red.

   The scratch database is opened here too, for the same reason: an
   unset `DATABASE_URL` should be a red per criterion, not a silent
   skip.
   ============================================================ */

interface World {
  s: Scratch;
  /** Holds three saves, every target visible to everyone. */
  alice: AccountFixture;
  /** Holds none. Identical to Alice in every other respect. */
  dana: AccountFixture;
  aliceTargets: readonly Target[];
  /** A resolvable target Alice has NOT saved, so a write that lands is visible. */
  unsavedTarget: Target;
}

let world: Promise<World> | undefined;

function theWorld(): Promise<World> {
  if (world === undefined) {
    world = build();
    /* Attach a sink so a rejection between creation and the first await is not "unhandled". */
    world.catch(() => {});
  }
  return world;
}

async function build(): Promise<World> {
  const s = await openDatabase();
  const saveTarget = await bind("saveTarget");

  const publisher = await seedAccount(s, "pub");
  const alice = await seedAccount(s, "alice");
  const dana = await seedAccount(s, "dana");

  /*
   * Every target is PUBLIC and owned by a third account. That is deliberate and it is what
   * makes the operator cells in THIS file assertable at all. D-140-05 rules that AC3's
   * `visibleTo` is given the READING actor, so an operator DOES see a save of a private target
   * that its owner cannot — which means "the operator sees what the owner sees" is true only
   * where every target is visible to both. Arranged here and stated, rather than left as an
   * accident of ownership; the case where the two genuinely DIVERGE is driven in
   * `visibility.test.ts`, which is where the ruling belongs.
   */
  const bundle = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
  const card = await seedCard(s, { ownerId: publisher.id, visibility: "public" });
  const term = await seedTerm(s);
  const spare = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });

  const aliceTargets: Target[] = [
    { kind: "blueprint", refId: bundle.id },
    { kind: "card", refId: card.cardId },
    { kind: "term", refId: term.termId },
  ];
  for (const target of aliceTargets) {
    await saveTarget(s.db, accountActor(alice.id, alice.handle), alice.id, target);
  }

  return {
    s,
    alice,
    dana,
    aliceTargets,
    unsavedTarget: { kind: "blueprint", refId: spare.id },
  };
}

afterAll(async () => {
  await closeDatabase();
});

/**
 * The arguments a writer takes after `(db, actor, accountId)`, from the published text.
 *
 * A `switch` rather than a map so it fails CLOSED: a sixth published writer reaches the
 * `default` and reds with a message naming itself, instead of being silently skipped by a
 * lookup that returns `undefined`. `surface.test.ts` asserts the writer set is exactly these
 * three, so the two guards close over each other rather than both trusting one list.
 */
function writeProbe(name: PublishedName, target: Target): readonly unknown[] {
  switch (name) {
    case "saveTarget":
    case "unsaveTarget":
      return [target];
    case "migrateLocalSaves":
      return [[target]];
    default:
      throw new Error(
        `No write probe exists for the published writer \`${name}\`.\n` +
          `  This is a BROKEN TEST, not a failed criterion: the block gained a function that ` +
          `answers \`Promise<void>\` and this sweep does not know what to hand it. Add its ` +
          `argument shape here — do not narrow the sweep.`,
      );
  }
}

/** A writer probe's target: one Alice holds for `unsaveTarget`, one she does not for the rest. */
function probeTargetFor(name: PublishedName, w: World): Target {
  return name === "unsaveTarget" ? w.aliceTargets[0] : w.unsavedTarget;
}

/* ============================================================
   The control

   Every pair cell below is satisfied by a module that refuses
   everyone, so this file states in one place what it is that a
   non-owner must not be able to see. The difference is COMPUTED
   from the two accounts rather than written down: a fixture where
   Alice's set is empty would make all 70 cells vacuous while the
   counts stayed exactly as plausible as they are now.
   ============================================================ */

describe("the control: the two accounts genuinely differ, as their OWN owners see them", () => {
  it("Alice holds saves and Dana holds none, observed through the published readers", async () => {
    const w = await theWorld();
    const countSaves = await bind("countSaves");

    const aliceSet = await visibleTargets(w.s, accountActor(w.alice.id, w.alice.handle), w.alice.id);
    const danaSet = await visibleTargets(w.s, accountActor(w.dana.id, w.dana.handle), w.dana.id);

    expect(
      aliceSet,
      "the fixture saved three targets through `saveTarget` and every one of them is public, so " +
        "AC3's filter keeps all three. If this is empty, every AC1 pair in this file is " +
        "comparing two empty answers and proves nothing.",
    ).toEqual([...w.aliceTargets].map(key).sort());
    expect(danaSet, "Dana has saved nothing").toEqual([]);

    const aliceCount = JSON.stringify(
      await countSaves(w.s.db, accountActor(w.alice.id, w.alice.handle), w.alice.id),
    );
    const danaCount = JSON.stringify(
      await countSaves(w.s.db, accountActor(w.dana.id, w.dana.handle), w.dana.id),
    );
    expect(
      aliceCount,
      "an OWNER's count over three saves and an owner's count over none must differ — this is " +
        "the quantity every cell below requires a non-owner to be unable to observe, and it is " +
        "asserted as a difference rather than arranged as a constant",
    ).not.toBe(danaCount);
  });
});

/* ============================================================
   P1 — the STATE pair, over every published READER
   ============================================================ */

describe("AC1: a non-owner cannot tell an account holding saves from one holding none", () => {
  const cells = PUBLISHED_READERS.flatMap((reader) =>
    NON_OWNERS.map((who) => ({ reader, who })),
  );

  it.each(cells)("$reader, driven by $who.label", async ({ reader, who }) => {
    const w = await theWorld();
    const fn = await bind(reader);
    const actor = who.actor(w.alice.id);

    const populated = await outcomeOf(() => fn(w.s.db, actor, w.alice.id));
    const empty = await outcomeOf(() => fn(w.s.db, actor, w.dana.id));

    assertIndistinguishable(populated, empty, {
      a: `${reader} over an account holding ${w.aliceTargets.length} saves, as ${who.label}`,
      b: `${reader} over an account holding none, as ${who.label}`,
      because: who.because,
    });
  });
});

/* ============================================================
   P2 — the EXISTENCE pair, over every published READER

   B-03 verbatim, and the case P1 cannot reach: a module that
   checks ownership only after touching the store answers a policy
   refusal for a real account and a store fault — or an empty
   result — for one that does not exist, and those two are
   distinguishable however carefully the count is hidden.
   ============================================================ */

describe("AC1/B-03: a non-owner cannot tell an account that is not theirs from one that does not exist", () => {
  const cells = PUBLISHED_READERS.flatMap((reader) =>
    NON_OWNERS.map((who) => ({ reader, who })),
  );

  it.each(cells)("$reader, driven by $who.label", async ({ reader, who }) => {
    const w = await theWorld();
    const fn = await bind(reader);
    const actor = who.actor(w.alice.id);

    const real = await outcomeOf(() => fn(w.s.db, actor, w.alice.id));
    const absent = await outcomeOf(() => fn(w.s.db, actor, absentUuid()));

    assertIndistinguishable(real, absent, {
      a: `${reader} over an account that EXISTS and is not theirs, as ${who.label}`,
      b: `${reader} over an account id naming NOTHING, as ${who.label}`,
      because:
        "B-03: a private resource the caller may not see returns 404, never 403, so existence " +
        "does not leak. An answer that differs between the two IS the 403.",
    });
  });
});

/* ============================================================
   The writers — the state does not move, and the two refusals
   are the same refusal
   ============================================================ */

describe("AC1: a non-owner's write does not land", () => {
  const cells = PUBLISHED_WRITERS.flatMap((writer) => NON_OWNERS.map((who) => ({ writer, who })));

  it.each(cells)("$writer, driven by $who.label", async ({ writer, who }) => {
    const w = await theWorld();
    const fn = await bind(writer);
    const owner = accountActor(w.alice.id, w.alice.handle);
    const target = probeTargetFor(writer, w);

    /*
     * The baseline is measured HERE rather than taken from the fixture, so a cell reds for its
     * own probe and not for a leak an earlier cell in this file already caught. A shared
     * baseline would make one defect cascade into twenty reds whose subjects are not the
     * subject.
     */
    const before = {
      visible: await visibleTargets(w.s, owner, w.alice.id),
      stored: await storedRowCount(w.s, w.alice.id),
    };

    await outcomeOf(() => fn(w.s.db, who.actor(w.alice.id), w.alice.id, ...writeProbe(writer, target)));

    const after = {
      visible: await visibleTargets(w.s, owner, w.alice.id),
      stored: await storedRowCount(w.s, w.alice.id),
    };

    expect(
      after.visible,
      `${who.label} called \`${writer}\` against Alice's account and the owner's own list moved. ` +
        `${who.because}`,
    ).toEqual(before.visible);
    /*
     * The stored count is the second instrument and it is not redundant: AC3 filters the
     * LISTING, so a row a stranger managed to insert against a target that does not resolve is
     * invisible to `listSaves` and present in the table. Only a read past the barrel sees it.
     */
    expect(
      after.stored,
      `${who.label} called \`${writer}\` against Alice's account and the number of rows in the ` +
        `\`save\` table moved. AC3 filters the listing, so a row written against an unresolvable ` +
        `target would be invisible to \`listSaves\` and still be there.`,
    ).toBe(before.stored);
  });
});

describe("AC1/B-03: a non-owner's write refuses an existing account exactly as it refuses one that does not exist", () => {
  const cells = PUBLISHED_WRITERS.flatMap((writer) => NON_OWNERS.map((who) => ({ writer, who })));

  it.each(cells)("$writer, driven by $who.label", async ({ writer, who }) => {
    const w = await theWorld();
    const fn = await bind(writer);
    const actor = who.actor(w.alice.id);
    const target = probeTargetFor(writer, w);
    const args = writeProbe(writer, target);

    const real = await outcomeOf(() => fn(w.s.db, actor, w.alice.id, ...args));
    const absent = await outcomeOf(() => fn(w.s.db, actor, absentUuid(), ...args));

    assertIndistinguishable(real, absent, {
      a: `${writer} against an account that EXISTS and is not theirs, as ${who.label}`,
      b: `${writer} against an account id naming NOTHING, as ${who.label}`,
      because:
        "`save.account_id` is a foreign key to `account.id`, so an implementation that writes " +
        "before it checks answers a policy refusal for one of these and a driver fault for the " +
        "other — which tells a caller whether an account exists.",
    });
  });
});

/* ============================================================
   The operator half of AC1

   "invisible to every caller but its owner AND THE OPERATOR". The
   permissive half of a two-half ruling discriminates nothing on
   its own, so it is stated as an EQUALITY with what the owner
   sees rather than as "the operator gets something".

   Scoped to a fixture where every target is public to both, and
   the scope is load-bearing rather than cautious. D-140-05 rules
   that AC3's `visibleTo` takes the READING actor, so over a PRIVATE
   target the operator and the owner correctly DISAGREE — an
   operator seeing a bookmark its owner cannot is operator authority
   working. An equality asserted over that fixture would red a
   correct implementation. The divergence itself is driven in
   `visibility.test.ts`.
   ============================================================ */

describe("AC1: the operator sees exactly what the owner sees", () => {
  it("the same set, over a fixture where every target is visible to both", async () => {
    const w = await theWorld();
    const owner = accountActor(w.alice.id, w.alice.handle);

    const asOwner = await visibleTargets(w.s, owner, w.alice.id);
    const asOperator = await visibleTargets(w.s, operatorActor(absentUuid()), w.alice.id);

    /*
     * Compared as SETS, not through `outcomeOf`: `listSaves`'s ordering is unpublished
     * and unpinned, and a byte comparison would pin an order the contract does not decide.
     */
    expect(
      asOperator,
      "AC4 of T060 makes `visibleTo` answer `all` for the operator over any handle, and AC1 " +
        "names the operator alongside the owner. An operator that sees less than the owner has " +
        "not got the break-glass subject B-13 publishes.",
    ).toEqual(asOwner);
  });

  it("the same count, whatever shape the count turns out to take", async () => {
    const w = await theWorld();
    const countSaves = await bind("countSaves");
    const owner = accountActor(w.alice.id, w.alice.handle);

    const asOwner = await outcomeOf(() => countSaves(w.s.db, owner, w.alice.id));
    const asOperator = await outcomeOf(() =>
      countSaves(w.s.db, operatorActor(absentUuid()), w.alice.id),
    );

    assertIndistinguishable(asOwner, asOperator, {
      a: "countSaves as the owner",
      b: "countSaves as the operator",
      because:
        "AC1 puts the operator on the same side of the line as the owner, for the count as well " +
        "as the list — `countSaves` takes an `Actor` precisely so it is not a cheap public " +
        "aggregate.",
    });
  });

  it("an operator carrying no id is NOT an operator, and that is in the sweep above", () => {
    /*
     * Stated here rather than left implicit, because the two live in different files and a
     * later reader deleting `NON_OWNERS`' operator shapes would take a T060 ruling with them.
     * `{ kind: "operator" }` and `Object.create({kind:"operator",...})` are both in the
     * cross product above: possession of a discriminant is not authority, and authority is
     * never inherited.
     */
    const labels = NON_OWNERS.map((n) => n.label);
    expect(labels).toContain("an operator with no id");
    expect(labels).toContain("an actor INHERITING operator authority");
    expect(labels).toContain("an actor INHERITING the owner's id");
    expect(
      NON_OWNERS.length,
      "an equality rather than a floor: a shape added or removed here changes what every sweep " +
        "in this file covers, and a floor would absorb the addition silently and then stop " +
        "detecting the removal",
    ).toBe(7);
  });
});

/* ============================================================
   D-140-01 — the VALUE a denied reader gets

   Ruled: `countSaves` stays `Promise<number>` and a denied caller
   gets `0`; `listSaves` answers an empty list. Quantified over the
   readers rather than written twice, and the expected answers come
   from `DENIED_READER_ANSWER`, which `surface.test.ts` requires to
   cover every published reader — so a sixth reader cannot be added
   without somebody deciding what it answers a caller who may not
   see it.

   This is a PIN and the pairs above are not redundant with it. The
   pin fails on a module answering the true count; it says nothing
   about a module that answers 0 and distinguishes the two states
   some other way.
   ============================================================ */

describe("D-140-01: a denied reader answers the ruled value", () => {
  const cells = PUBLISHED_READERS.flatMap((reader) => NON_OWNERS.map((who) => ({ reader, who })));

  it.each(cells)("$reader answers the denied value to $who.label", async ({ reader, who }) => {
    const w = await theWorld();
    const fn = await bind(reader);
    const expected = DENIED_READER_ANSWER[reader];

    const answered = await fn(w.s.db, who.actor(w.alice.id), w.alice.id);

    expect(
      JSON.parse(JSON.stringify(answered ?? null)),
      `${who.because}\n  D-140-01 withdrew the "\`undefined\`-equivalent, not zero" prose: under ` +
        `\`Promise<number>\`, *not yours*, *no such account* and *yours and empty* all answer 0, ` +
        `which is B-03 satisfied rather than violated. Alice holds ${w.aliceTargets.length} ` +
        `saves, so anything that is not the denied answer is the leak.`,
    ).toEqual(expected);
  });

  it("every published reader has a ruled denied answer", () => {
    /*
     * The construction's guard, and it fails CLOSED. If a reader is added to the block and not
     * to `DENIED_READER_ANSWER`, `expected` above is `undefined` and every cell for it would
     * quietly assert that a denied caller gets nothing — a sweep passing over a criterion
     * nobody decided.
     */
    expect(
      PUBLISHED_READERS.filter((r) => !(r in DENIED_READER_ANSWER)),
      "a published reader with no ruled denied answer makes its cells above vacuous",
    ).toEqual([]);
  });
});

/* ============================================================
   D-140-02 — the writers REJECT, and with a class T140 did not
   mint

   "`void` cannot express *denied*" — a silent no-op tells a caller
   its save succeeded when it did not, which is a write failing
   silently rather than a read declining to distinguish. The ruled
   class is `NotAccountOwnerError`, CONSUMED from
   `@/lib/server/accounts`, and it is imported here from THAT
   barrel: an `instanceof` against T050's own export is what makes
   "consumed rather than minted" an assertion instead of a wish. A
   second class of the same name minted inside `lib/server/saves`
   fails this cell while satisfying any check that compared names.

   The message form is asserted SEPARATELY, below. `<operation>` is
   read as the published function's own name, and keeping the
   reading in its own cell is what makes a red on the wording
   diagnosable as a naming question rather than one that takes the
   ruled class assertion down with it.
   ============================================================ */

describe("D-140-02: a non-owner's write is REFUSED, not silently dropped", () => {
  const cells = PUBLISHED_WRITERS.flatMap((writer) => NON_OWNERS.map((who) => ({ writer, who })));

  it.each(cells)("$writer rejects for $who.label", async ({ writer, who }) => {
    const w = await theWorld();
    const fn = await bind(writer);
    const target = probeTargetFor(writer, w);
    const where = `${writer} as ${who.label}`;

    const err = await rejection(
      fn(w.s.db, who.actor(w.alice.id), w.alice.id, ...writeProbe(writer, target)),
      where,
    );

    expect(
      err,
      `${who.because}\n  D-140-02: the writers answer \`Promise<void>\`, and \`void\` cannot ` +
        `express *denied* — so a refusal that does not arrive tells this caller its write ` +
        `succeeded. The class is \`NotAccountOwnerError\` CONSUMED from ` +
        `\`@/lib/server/accounts\`, and this assertion is an \`instanceof\` against T050's own ` +
        `export precisely so a same-named class minted inside \`lib/server/saves\` fails it.`,
    ).toBeInstanceOf(NotAccountOwnerError);

    /* D-13 holds for a decision exactly as it holds for a fault: a refusal is a rendering. */
    assertSealed(err, where);
    assertNoDriverProse(err, where);
  });

  it.each(PUBLISHED_WRITERS)(
    "%s's refusal names the operation and nothing else",
    async (writer) => {
      const w = await theWorld();
      const fn = await bind(writer);
      const target = probeTargetFor(writer, w);
      const where = `${writer} as a stranger`;
      const stranger = accountActor(absentUuid(), "stranger");

      const err = await rejection(
        fn(w.s.db, stranger, w.alice.id, ...writeProbe(writer, target)),
        where,
      );

      expect(
        (err as Error).message,
        "T050 publishes `NotAccountOwnerError \"<operation>: not this account's owner.\"` and " +
          "`<operation>` is READ here as the published function's own name — the convention " +
          "`archive`, `naming`, `accounts` and `registry` have all shipped. This cell carries " +
          "that reading alone, so a red here is a naming question and not a failure of the " +
          "class assertion above.",
      ).toBe(notAccountOwnerMessage(writer));
    },
  );
});
