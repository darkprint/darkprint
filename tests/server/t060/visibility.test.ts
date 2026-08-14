import { describe, expect, it } from "vitest";

import {
  ALICE,
  ALICE_BUNDLES,
  ALICE_CARDS,
  ALICE_PRIVATE_BUNDLES,
  ALICE_PRIVATE_CARDS,
  ALICE_PUBLIC_BUNDLES,
  ALICE_PUBLIC_CARDS,
  ALICE_SAVES,
  BERTRAND,
  FORKS_OF_UPSTREAM,
  MIXED_FORKS,
  PRIVATE_FORK,
  UPSTREAM,
  type Actor,
  alice,
  aliceWithoutHandle,
  anonymous,
  bertrand,
  canFn,
  countVisibleTo,
  listVisibleTo,
  strictly,
  visibleToFn,
} from "./contract";

/* ============================================================
   T060 criteria (1) and (2) — the list and the count agree

   (1) a visitor's fork list over a fixture holding a private fork
       is empty and the count agrees
   (2) owner and visitor counts over one handle differ by exactly
       the private rows

   ── why these are testable at all against a pure module ──
   Neither criterion is about SQL. The module publishes the two
   halves a route builds a list and a count *from*: `can(actor,
   "read", row)` decides one row, and `visibleTo(actor, ownerId)`
   decides the whole query's mode. So the fixture here is the rows,
   and the two published functions are applied to it exactly as a
   route would apply them — one per row for the list, once for the
   count.

   That is also where the teeth are. "the count agrees" is a claim
   about two code paths, and the failure it exists to catch is a
   count query written with a different rule from the row filter:
   `bundles.length` beside a list built with `can`. Every assertion
   below that says `count === list.length` is comparing an answer
   from `visibleTo` against an answer from `can`, which is the only
   way that disagreement can surface in a module with no database
   under it.

   ── the three read contexts ──
   The contract states them: "Three read contexts are
   distinguishable: anonymous, signed-in visitor, owner." All three
   run over every fixture here, because an implementation that
   collapses the first two is still wrong even when both answers
   happen to be the denial.
   ============================================================ */

/** A signed-in reader who owns nothing in any fixture: the middle of the three read contexts. */
const bertrandsNeighbour: Actor = {
  kind: "account",
  accountId: "acct_01J9Z3K7Q8V2M4Y0",
  handle: "cressida",
};

describe("T060 (1) a private fork is not announced on its upstream", () => {
  it("gives an anonymous reader an empty fork list, and a count that agrees", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();

    const list = listVisibleTo(can, anonymous, FORKS_OF_UPSTREAM);
    const count = countVisibleTo(visibleTo, anonymous, BERTRAND, FORKS_OF_UPSTREAM);

    expect(list, "an anonymous reader was handed a private fork").toEqual([]);
    expect(count, "the anonymous fork count disagrees with the list").toBe(list.length);
    expect(count).toBe(0);
  });

  it("gives a signed-in visitor an empty fork list, and a count that agrees", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();

    const list = listVisibleTo(can, bertrandsNeighbour, FORKS_OF_UPSTREAM);
    const count = countVisibleTo(visibleTo, bertrandsNeighbour, BERTRAND, FORKS_OF_UPSTREAM);

    expect(list, "a signed-in visitor was handed a private fork").toEqual([]);
    expect(count, "the visitor's fork count disagrees with the list").toBe(list.length);
    expect(count).toBe(0);
  });

  it("does not announce the fork to the owner of the upstream it was forked from", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();

    /* Alice owns the upstream and nothing else here. The promise is stated on her surface:
       "a private fork is never announced on its upstream, in fork counts, fork lists or
       the upstream author's notifications". Owning the parent is not owning the fork. */
    expect(strictly(can, alice, "read", UPSTREAM.resource), "Alice cannot read her own upstream").toBe(
      true,
    );
    expect(
      strictly(can, alice, "read", PRIVATE_FORK.resource),
      "the upstream's author was handed somebody else's private fork",
    ).toBe(false);
    expect(listVisibleTo(can, alice, FORKS_OF_UPSTREAM)).toEqual([]);
    expect(countVisibleTo(visibleTo, alice, BERTRAND, FORKS_OF_UPSTREAM)).toBe(0);
  });

  it("gives the fork's own owner the fork, and a count that agrees", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();

    const list = listVisibleTo(can, bertrand, FORKS_OF_UPSTREAM);
    const count = countVisibleTo(visibleTo, bertrand, BERTRAND, FORKS_OF_UPSTREAM);

    expect(list, "the fork's owner cannot see their own private fork").toEqual([PRIVATE_FORK.id]);
    expect(count, "the owner's fork count disagrees with the list").toBe(list.length);
    expect(count).toBe(1);
  });

  it("hides only the private fork when public ones are beside it", async () => {
    const can = await canFn();

    /* "Empty" is the easy shape to pass by accident — a policy that denies every read
       passes the four tests above. This one fails it. */
    const publicIds = MIXED_FORKS.filter((row) => row.visibility === "public").map((row) => row.id);

    expect(listVisibleTo(can, anonymous, MIXED_FORKS)).toEqual(publicIds);
    expect(listVisibleTo(can, bertrandsNeighbour, MIXED_FORKS)).toEqual(publicIds);
    expect(listVisibleTo(can, bertrand, MIXED_FORKS)).toEqual(MIXED_FORKS.map((row) => row.id));
  });
});

describe("T060 (2) owner and visitor counts over one handle", () => {
  it("differ by exactly the private blueprints", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();

    const ownerCount = countVisibleTo(visibleTo, alice, ALICE, ALICE_BUNDLES);
    const visitorCount = countVisibleTo(visibleTo, bertrand, ALICE, ALICE_BUNDLES);
    const anonymousCount = countVisibleTo(visibleTo, anonymous, ALICE, ALICE_BUNDLES);

    expect(ownerCount, "the owner's blueprint count leaves out her private half").toBe(
      ALICE_BUNDLES.length,
    );
    expect(visitorCount, "a visitor's blueprint count includes a private row").toBe(
      ALICE_PUBLIC_BUNDLES.length,
    );
    expect(anonymousCount).toBe(ALICE_PUBLIC_BUNDLES.length);
    expect(
      ownerCount - visitorCount,
      "the difference between the two counts is not the private rows",
    ).toBe(ALICE_PRIVATE_BUNDLES.length);

    /* A count-only assertion passes on the right total with the wrong rows in it, so the
       membership is checked too, per row, through the other published function. */
    expect(listVisibleTo(can, bertrand, ALICE_BUNDLES)).toEqual(
      ALICE_PUBLIC_BUNDLES.map((row) => row.id),
    );
    expect(listVisibleTo(can, alice, ALICE_BUNDLES)).toEqual(ALICE_BUNDLES.map((row) => row.id));
    expect(visitorCount).toBe(listVisibleTo(can, bertrand, ALICE_BUNDLES).length);
    expect(ownerCount).toBe(listVisibleTo(can, alice, ALICE_BUNDLES).length);
  });

  it("differ by exactly the private cards", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();

    const ownerCount = countVisibleTo(visibleTo, alice, ALICE, ALICE_CARDS);
    const visitorCount = countVisibleTo(visibleTo, bertrand, ALICE, ALICE_CARDS);

    expect(ownerCount).toBe(ALICE_CARDS.length);
    expect(visitorCount).toBe(ALICE_PUBLIC_CARDS.length);
    expect(ownerCount - visitorCount).toBe(ALICE_PRIVATE_CARDS.length);
    expect(listVisibleTo(can, bertrand, ALICE_CARDS)).toEqual(
      ALICE_PUBLIC_CARDS.map((row) => row.id),
    );
    expect(listVisibleTo(can, anonymous, ALICE_CARDS)).toEqual(
      ALICE_PUBLIC_CARDS.map((row) => row.id),
    );
  });

  it("hide a save and its count from everyone but the owner", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();

    /* "a save is private and so is its count" — a save has no public half at all, so the
       visitor's count over Alice's handle is zero and not merely smaller. */
    expect(countVisibleTo(visibleTo, alice, ALICE, ALICE_SAVES)).toBe(ALICE_SAVES.length);
    expect(countVisibleTo(visibleTo, bertrand, ALICE, ALICE_SAVES)).toBe(0);
    expect(countVisibleTo(visibleTo, anonymous, ALICE, ALICE_SAVES)).toBe(0);

    expect(listVisibleTo(can, alice, ALICE_SAVES)).toEqual(ALICE_SAVES.map((row) => row.id));
    expect(listVisibleTo(can, bertrand, ALICE_SAVES)).toEqual([]);
    expect(listVisibleTo(can, anonymous, ALICE_SAVES)).toEqual([]);
  });

  it("keeps the three read contexts distinguishable", async () => {
    const can = await canFn();

    /* Anonymous and a signed-in visitor agree about somebody else's rows and part company
       about their own: only one of the two has any. An implementation that treats "not the
       owner" as one context passes the first half of this and fails the second. */
    const strangersRows = ALICE_BUNDLES;
    expect(listVisibleTo(can, anonymous, strangersRows)).toEqual(
      listVisibleTo(can, bertrand, strangersRows),
    );

    const bertrandsOwn = [PRIVATE_FORK];
    expect(listVisibleTo(can, anonymous, bertrandsOwn)).toEqual([]);
    expect(listVisibleTo(can, bertrand, bertrandsOwn)).toEqual([PRIVATE_FORK.id]);

    /* And the owner is a third answer again, not the visitor's with one row added. */
    expect(strictly(can, anonymous, "write", ALICE_PUBLIC_BUNDLES[0].resource)).toBe(false);
    expect(strictly(can, bertrand, "write", ALICE_PUBLIC_BUNDLES[0].resource)).toBe(false);
    expect(strictly(can, alice, "write", ALICE_PUBLIC_BUNDLES[0].resource)).toBe(true);
  });

  it("counts the same for an owner who has not chosen a handle yet", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();

    /* `handle: string | null` is in the published shape, and B-05 has the handle chosen at
       sign-up rather than supplied by GitHub — so there is a moment when an account owns
       rows and has no handle. Ownership is the account id, and nothing else. */
    expect(countVisibleTo(visibleTo, aliceWithoutHandle, ALICE, ALICE_BUNDLES)).toBe(
      ALICE_BUNDLES.length,
    );
    expect(listVisibleTo(can, aliceWithoutHandle, ALICE_BUNDLES)).toEqual(
      listVisibleTo(can, alice, ALICE_BUNDLES),
    );
  });
});
