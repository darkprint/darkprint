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
  everyResourceOwnedBy,
  note,
  noteOnOwnPublicBundle,
  operator,
  save,
  strictly,
} from "./contract";

/* ============================================================
   T060 criterion (4) — the break-glass operator

   (4) the operator subject can reach any resource and every such
       decision is auditable

   ── the half this file tests ──
   "can reach any resource". Every published resource shape, owned
   by somebody who is not the operator, private included.

   The matrix test below is written as a *relation* rather than as a
   list of expected trues: for every (action, resource) pair where
   the owner is allowed, the operator is allowed too. That is what
   break-glass means and it is all the contract states. Written as a
   list it would have to assert something the contract does not say
   — whether an operator may `publish` a save, a pair no subject has
   any business being allowed — and a test that invents a decision
   is how a round gets spent reporting a defect that does not exist.

   ── the half this file does not test, and why ──
   "and every such decision is auditable" is not observable through
   the published surface. `can` returns a boolean; there is no
   handler, no sink, no returned reason, and B-14's audit row is
   `lib/server/observability/**`, which belongs to T240 and which
   this module may not import (it is pure). The Published signatures
   block names nothing for it.

   Per the rule above the block — "Where a signature is left open,
   the test author reports it rather than resolving it" — this is
   reported to the orchestrator rather than resolved here. No test
   in this directory binds an invented name for it, because a
   candidate list would resolve to whatever happened to exist and
   report a defect in the wrong place. See the T060 log.
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
