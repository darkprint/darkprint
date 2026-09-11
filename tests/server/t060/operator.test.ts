import { describe, expect, it } from "vitest";

import {
  ACTIONS,
  ALICE,
  BERTRAND,
  OPERATOR_ACCOUNT,
  type Actor,
  account,
  alice,
  bertrand,
  bundle,
  canFn,
  card,
  countVisibleTo,
  everyResourceOwnedBy,
  listVisibleTo,
  note,
  noteOnOwnPublicBundle,
  operator,
  save,
  strictly,
  visibleToFn,
} from "./contract";

/* ============================================================
   T060 criterion (4) — the break-glass operator

   (4) the operator subject can reach any resource [and every such
       decision is auditable — withdrawn, see below]

   ── what this file tests ──
   "can reach any resource". Every published resource shape, owned
   by somebody who is not the operator, private included; and, since
   the 2026-08-14 ruling, the operator's view of a query:
   `visibleTo` answers `"all"` for it, "matching AC4's 'the operator
   can reach any resource'".

   The matrix test below is written as a *relation* rather than as a
   list of expected trues: for every (action, resource) pair where
   the owner is allowed, the operator is allowed too. That is what
   break-glass means and it is all the contract states. Written as a
   list it would have to assert something the contract does not say
   — whether an operator may `publish` a save, a pair no subject has
   any business being allowed — and a test that invents a decision
   is how a round gets spent reporting a defect that does not exist.
   The orchestrator declined to rule on those pairs, deliberately,
   and this relation holds either way.

   ── the half that is gone, and why there is no test for it ──
   "and every such decision is auditable" was **withdrawn from this
   task** on 2026-08-14. It was unfalsifiable here: `can` returns a
   boolean, this module may not import `lib/server/observability`,
   and an implementation could satisfy every test in this directory
   and keep no trail at all. Auditing an operator decision belongs
   to the call site, where B-14's audit row is actually written, and
   to T240, which owns the sink.

   So there is deliberately no test for it and deliberately no
   invented hook. If a later reader misses one here, the criterion
   is in another task's section, not missing from this one.
   ============================================================ */

describe("T060 (4) the operator reaches any resource", () => {
  it("reads every resource shape, owned by somebody else, private included", async () => {
    const can = await canFn();
    for (const owner of [ALICE, BERTRAND]) {
      for (const { label: what, resource } of everyResourceOwnedBy(owner)) {
        expect(
          strictly(can, operator, "read", resource),
          `the break-glass operator cannot read a ${what} owned by ${owner}`,
        ).toBe(true);
      }
    }
  });

  it("is allowed everything the owner is allowed", async () => {
    const can = await canFn();
    let checked = 0;
    for (const { label: what, resource } of everyResourceOwnedBy(ALICE)) {
      for (const action of ACTIONS) {
        if (!strictly(can, alice, action, resource)) continue;
        expect(
          strictly(can, operator, action, resource),
          `the owner may ${action} her own ${what} and the break-glass operator may not`,
        ).toBe(true);
        checked += 1;
      }
    }
    /* If the owner were allowed nothing at all this test would pass vacuously, so the
       number of pairs it actually compared is asserted. The owner reads all seven. */
    expect(checked, "the operator relation was checked against no owner permission at all").
      toBeGreaterThanOrEqual(everyResourceOwnedBy(ALICE).length);
  });

  it("removes any note, which is the one operator power B-18 states outright", async () => {
    const can = await canFn();
    /* B-18: "An author may edit and delete their own notes; the operator may remove any."
       Either kind of parent: the 2026-08-14 amendment made a note's parent part of its
       shape, and "any" is not narrowed by it. */
    expect(strictly(can, operator, "delete", noteOnOwnPublicBundle(ALICE))).toBe(true);
    expect(strictly(can, operator, "delete", noteOnOwnPublicBundle(BERTRAND))).toBe(true);
    expect(
      strictly(can, operator, "delete", note(ALICE, { ownerId: BERTRAND, visibility: "private" })),
    ).toBe(true);
  });

  it("is the operator by its `kind`, never by the id it carries", async () => {
    const can = await canFn();
    /* The same account id, presented as an account. If it is answered any differently from
       an ordinary signed-in stranger, the operator branch is keyed on an id somewhere — a
       list, an environment variable — and the discriminant the contract publishes is
       decoration.

       Compared against a stranger rather than asserted to be denied outright, because some
       of these answers are yes for everybody: Alice's public bundle is readable by the
       whole internet, and an impostor being told so is not an escalation. */
    const impostor: Actor = {
      kind: "account",
      accountId: OPERATOR_ACCOUNT,
      handle: "operator",
    };
    for (const { label: what, resource } of everyResourceOwnedBy(ALICE)) {
      for (const action of ACTIONS) {
        expect(
          strictly(can, impostor, action, resource),
          `an account carrying the operator's id is answered differently from an ordinary ` +
            `signed-in stranger for ${action} on Alice's ${what}`,
        ).toBe(strictly(can, bertrand, action, resource));
      }
    }
  });

  it("does not need to own anything to reach it", async () => {
    const can = await canFn();
    /* The operator's own id appears in no fixture here, so nothing below can be explained
       by ownership. This is the difference between a second subject and a special owner. */
    expect(strictly(can, operator, "read", bundle(ALICE, "private"))).toBe(true);
    expect(strictly(can, operator, "read", card(BERTRAND, "private"))).toBe(true);
    expect(strictly(can, operator, "read", save(ALICE))).toBe(true);
    expect(strictly(can, operator, "read", account(BERTRAND))).toBe(true);
  });

  it("is given the whole of a query, whoever the query is about", async () => {
    const visibleTo = await visibleToFn();
    /* Ruled 2026-08-14: "`visibleTo` returns `"all"` for the operator, matching AC4's 'the
       operator can reach any resource'." The prose above the block says only "an owner
       sees all, everyone else public", and an operator reading as "everyone else" would
       hand back a count with the private half filtered out of it — a break-glass subject
       that can open any one row and cannot see that the rest exist. */
    for (const ownerId of [ALICE, BERTRAND, OPERATOR_ACCOUNT, "acct_nobody_has_this"]) {
      expect(
        visibleTo(operator, ownerId),
        `the operator was given the visitor's view of ${ownerId}'s rows`,
      ).toBe("all");
    }
  });

  it("counts the private half of a handle it does not own", async () => {
    const visibleTo = await visibleToFn();
    const can = await canFn();
    /* The same ruling, read as a count rather than as a mode: over a fixture that is half
       private, the operator's count is the owner's and not the visitor's. */
    const rows = [
      { id: "bp-public", resource: bundle(ALICE, "public" as const), visibility: "public" as const },
      {
        id: "bp-private",
        resource: bundle(ALICE, "private" as const),
        visibility: "private" as const,
      },
    ];
    expect(countVisibleTo(visibleTo, operator, ALICE, rows)).toBe(rows.length);
    expect(countVisibleTo(visibleTo, operator, ALICE, rows)).toBe(
      countVisibleTo(visibleTo, alice, ALICE, rows),
    );
    expect(listVisibleTo(can, operator, rows), "the operator's list disagrees with its count").toEqual(
      rows.map((row) => row.id),
    );
  });

  it("answers a boolean for every action over every resource, like every other subject", async () => {
    const can = await canFn();
    for (const { resource } of everyResourceOwnedBy(BERTRAND)) {
      for (const action of ACTIONS) {
        /* `strictly` rejects anything that is not a boolean. An operator branch written as
           an early `return true` before the case list is still required to be a case list
           for the actions it does not blanket-allow. */
        strictly(can, operator, action, resource);
      }
    }
  });
});
