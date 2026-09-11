/* ============================================================
   T210 AC3 — "private content contributes to no count"

   D-210-03: the counts are GLOBAL and actor-independent, over
   public content only. `actor` is accepted and documented unused.

   ── the discriminator, and why the obvious cell is not it ──
   The obvious cell is "an anonymous caller sees no private
   contribution". A per-actor fold over `cards(db, actor)` PASSES
   that cell, because an anonymous caller is exactly the actor for
   whom the fold happens to be right. It reds nothing.

   The cell that discriminates is the one D-210-03 ratified: the
   PRIVATE BUNDLE'S OWN OWNER and an anonymous caller get IDENTICAL
   numbers. `visibleTo` answers "all" for the resource owner, so a
   fold that passes the actor through hands that account a third
   blueprint — the shared vocabulary steered with content nobody
   else can see, which is precisely D-82's concern.

   That the naive fold really does widen is not assumed. It is
   measured in `world-premises.test.ts`, where `cards(db, mallory)`
   returns three blueprint keys for the same card that `cards(db,
   anonymous)` returns two for. Without that premise this file
   would be asserting the absence of something that could not have
   happened, and its green would be worth nothing.

   The operator is included for the same reason the owner is:
   `visibleTo` answers "all" for a genuine operator too, so an
   operator is a second actor for whom the naive fold widens, and
   it is a shape the owner cell does not cover.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  AC3,
  ac3World,
  anonymous,
  dropScratchDatabases,
  operator,
} from "./fixtures";
import { assertCandidate, assertUsage, bind } from "./contract";

afterAll(async () => {
  await dropScratchDatabases();
});

const EXPECTED = {
  termId: AC3.term,
  cards: AC3.expectedCards,
  blueprints: AC3.expectedBlueprints,
  authors: AC3.expectedAuthors,
};

describe("AC3 — a private bundle moves no number, for anybody", () => {
  it("an anonymous caller counts only the two public blueprints", async () => {
    const { scratch } = await ac3World();
    const usageOf = await bind("usageOf");

    const usage = assertUsage(
      await usageOf(scratch.db, anonymous, AC3.term),
      "usageOf(anonymous)",
    );
    /* The weak half of the criterion, kept because it is the reading the contract states and
       because it is the control the strong cells below are compared against. On its own it
       discriminates nothing: a per-actor fold answers exactly this for an anonymous caller. */
    expect(usage).toEqual(EXPECTED);
  });

  it("THE PRIVATE BUNDLE'S OWN OWNER gets the identical record — this is the criterion", async () => {
    const { scratch, mallory } = await ac3World();
    const usageOf = await bind("usageOf");

    const asOwner = assertUsage(
      await usageOf(
        scratch.db,
        { kind: "account", accountId: mallory.accountId, handle: mallory.handle },
        AC3.term,
      ),
      "usageOf(the private bundle's owner)",
    );

    /* The concrete bad output is `blueprints: 3`. `visibleTo(mallory, mallory) === "all"`, so
       a fold over `cards(db, actor)` returns `mallory/ac3-secret` in `usedIn` and this account
       — and only this account — is handed a vocabulary steered by content nobody else can see.
       `toEqual` against the anonymous answer excludes the 3; a `toBeLessThanOrEqual` would
       admit it, and a bare "does not contain the private slug" would not apply, since a COUNT
       carries no slug to look for. */
    expect(asOwner).toEqual(EXPECTED);
  });

  it("an operator gets the identical record too", async () => {
    const { scratch, mallory } = await ac3World();
    const usageOf = await bind("usageOf");

    const asOperator = assertUsage(
      await usageOf(scratch.db, operator(mallory.accountId), AC3.term),
      "usageOf(operator)",
    );
    /* A second actor for whom `visibleTo` answers "all", and a shape the owner cell does not
       reach: an implementation that special-cased ownership — comparing ids rather than asking
       the policy — would pass the cell above and fail this one. */
    expect(asOperator).toEqual(EXPECTED);
  });

  it("a signed-in stranger gets the identical record", async () => {
    const { scratch, ada } = await ac3World();
    const usageOf = await bind("usageOf");

    const asStranger = assertUsage(
      await usageOf(
        scratch.db,
        { kind: "account", accountId: ada.accountId, handle: ada.handle },
        AC3.term,
      ),
      "usageOf(a signed-in stranger)",
    );
    /* `ada` owns the two PUBLIC bundles and not the private one, so this is the third distinct
       `visibleTo` outcome in the file. Together the four cells cover every branch of the policy
       — anonymous, owner-of-the-private-thing, operator, account-that-owns-something-else —
       which is the sweep that catches the one reader that forgot, rather than the one reader
       somebody thought to test. */
    expect(asStranger).toEqual(EXPECTED);
  });

  it("all four actors agree, compared element-wise rather than by count", async () => {
    const { scratch, ada, mallory } = await ac3World();
    const usageOf = await bind("usageOf");

    const actors = [
      ["anonymous", anonymous],
      ["owner of the private bundle", { kind: "account", accountId: mallory.accountId, handle: mallory.handle }],
      ["operator", operator(mallory.accountId)],
      ["signed-in stranger", { kind: "account", accountId: ada.accountId, handle: ada.handle }],
    ] as const;

    const seen: Record<string, unknown> = {};
    for (const [label, actor] of actors) {
      seen[label] = assertUsage(await usageOf(scratch.db, actor, AC3.term), `usageOf(${label})`);
    }
    /* Compared as one object so a disagreement shows WHICH actor disagreed and by how much.
       Four separate equalities against a constant would each be right about their own subject
       and none of them would show the shape of the divergence. */
    expect(seen).toEqual(Object.fromEntries(actors.map(([label]) => [label, EXPECTED])));
  });

  it("A TERM NAMED ONLY BY PRIVATE CONTENT COUNTS ZERO — the absolute half", async () => {
    const { scratch, mallory } = await ac3World();
    const usageOf = await bind("usageOf");

    /* D-210-03's amendment, and the reason this cell exists beside the identity cells above.
       The ratified discriminator — owner and anonymous get IDENTICAL records — separates a
       PER-ACTOR fold and NOTHING ELSE. An index built once for an operator, or once with no
       visibility filter at all, lets private content into every count for everybody: both sides
       of that equality move together and every identity cell in this file stays GREEN.

       This is the cell that reds against that. Zero is an ABSOLUTE claim, so it cannot be
       satisfied by two wrong answers agreeing with each other. Asserted for the private
       bundle's own owner as well, because that is the actor for whom a per-actor fold would
       report the largest number — so one cell covers both breaks. */
    for (const [label, actor] of [
      ["anonymous", anonymous],
      ["the private bundle's owner", { kind: "account", accountId: mallory.accountId, handle: mallory.handle }],
      ["operator", operator(mallory.accountId)],
    ] as const) {
      const usage = assertUsage(
        await usageOf(scratch.db, actor, AC3.privateOnlyTerm),
        `usageOf(${AC3.privateOnlyTerm}) as ${label}`,
      );
      expect(usage, `\`${AC3.privateOnlyTerm}\` counted for ${label}`).toEqual({
        termId: AC3.privateOnlyTerm,
        cards: 0,
        blueprints: 0,
        authors: 0,
      });
    }
  });

  it("a term named only by private content has NO ROW in `usage()` either", async () => {
    const { scratch, mallory } = await ac3World();
    const usage = await bind("usage");

    for (const [label, actor] of [
      ["anonymous", anonymous],
      ["the private bundle's owner", { kind: "account", accountId: mallory.accountId, handle: mallory.handle }],
    ] as const) {
      const rows = ((await usage(scratch.db, actor)) as unknown[]).map((row, i) =>
        assertUsage(row, `usage() as ${label} [${i}]`),
      );
      const ids = new Set(rows.map((r) => r.termId));
      /* `usage()` carries every COUNTED term, so a private-only term must be absent rather than
         present at zero — the mirror of AC4's rule, and a second surface on which the leak
         would show. A list reader that leaked would be invisible to the per-term cell above if
         the two were computed by different routes. */
      expect(ids.has(AC3.privateOnlyTerm), `usage() leaked the private-only term to ${label}`).toBe(false);
      expect(ids.has(AC3.privateOnlyLocal), `usage() leaked the private-only local term to ${label}`).toBe(false);
      /* And the list is not simply empty, so the absence above is a filter rather than nothing. */
      expect(ids.has(AC3.term)).toBe(true);
    }
  });

  it("A PRIVATE-ONLY LOCAL TERM IS NOT A PROMOTION CANDIDATE", async () => {
    const { scratch, mallory } = await ac3World();
    const candidates = await bind("candidates");

    for (const [label, actor] of [
      ["anonymous", anonymous],
      ["the private bundle's owner", { kind: "account", accountId: mallory.accountId, handle: mallory.handle }],
      ["operator", operator(mallory.accountId)],
    ] as const) {
      const list = await candidates(scratch.db, actor);
      expect(Array.isArray(list)).toBe(true);
      const ids = (list as unknown[]).map((row, i) =>
        assertCandidate(row, `candidates() as ${label} [${i}]`).termId,
      );
      /* This is D-82's own sentence as a test: the shared vocabulary must not be steerable with
         content nobody can see. A local term that exists ONLY inside a private bundle reaching
         the promotion list is that harm in its most literal form — an author proposing a term
         into the curated core on the strength of blueprints no one else can read.

         `world-premises.test.ts` asserts the term is namespaced, so a `false` here is about
         privacy rather than about D-210-05's local filter removing it for another reason. */
      expect(ids, `\`${AC3.privateOnlyLocal}\` reached the candidate list for ${label}`).not.toContain(
        AC3.privateOnlyLocal,
      );
    }
  });

  it("`usage()` is actor-independent too, over its whole list", async () => {
    const { scratch, mallory } = await ac3World();
    const usage = await bind("usage");

    const asAnon = await usage(scratch.db, anonymous);
    const asOwner = await usage(scratch.db, {
      kind: "account",
      accountId: mallory.accountId,
      handle: mallory.handle,
    });

    /* The list reader is a separate surface and D-210-03 binds it identically. Asserted over
       the WHOLE list rather than over the one term: a private card naming a term no public card
       names would add a ROW for that owner, which is a leak this file's per-term cells cannot
       see because they never ask about a term they did not plant. */
    expect(asOwner).toEqual(asAnon);
  });
});
