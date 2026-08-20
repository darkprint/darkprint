/* ============================================================
   T130 AC2 — the same handle yields two different records

   "An owner's card count includes private rows and a visitor's
   does not, so the same handle yields two different records. A
   process-level cache keyed on handle alone serves the owner's
   counts to a visitor — which is the private-row leak B-13 exists
   to prevent, arriving through a cache rather than through a
   query."

   ── the two orders are two cells, and they have to be ──
   A cache keyed on handle alone is ORDER-DEPENDENT: whichever
   actor reads first fills it. A suite that only ever reads
   owner-then-visitor catches the leak; one that only ever reads
   visitor-then-owner catches the mirror, where the owner is served
   the visitor's short count and their own private work vanishes
   from their own page. Neither order alone is the criterion, and
   the two failures are different defects. Both are driven, in the
   SAME database and against the SAME handle, because a fresh
   fixture per order is a fresh cache and would observe nothing.

   ── what AC2 names, and what its own Contract line names ──
   AC2 says "an owner's CARD count". The task's Contract line says
   "owner and visitor COUNTS differ by exactly the private rows",
   and T060's contract — which this task consumes — cites
   `components/profile/load.ts:192-200` for "an owner's blueprint
   and card counts include the private half and a visitor's never
   do". So the blueprint half is asserted too, and it is asserted
   as READ FROM T060's published contract rather than filled into
   T130's silence. If that is wrong, it is one `describe` block.

   ── the card half is BLOCKED by D-130-04 and is left asserted ──
   `CardSummary` carries no owner and `card_version.owner_id` is
   unpublished, so `counts.cards` cannot be built through the
   declared dependency and the ruling forbids working around it.
   These cells red until that amendment lands. They are left as
   they are because a criterion known to be unbuildable is more
   informative failing than passing, and naming the cause here is
   what stops the red being diagnosed as a defect in the code.

   ── the operator cell is derived and labelled as derived ──
   Nothing in T130 mentions the operator. T060's ruling —
   "`visibleTo` returns `"all"` for the operator" — and T080's
   "an owner and an operator DO see their own private content"
   decide it at the surface T130 consumes. Flagged here so it can
   be struck by a ruling rather than argued about.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  account,
  anonymous,
  asProfileRecord,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  mark,
  operator,
  scratchDatabase,
  type AccountFixture,
  type Scratch,
} from "./contract";

let s: Scratch;

async function counts(handle: string, actor: unknown) {
  const getProfile = await bind("getProfile");
  const record = asProfileRecord(
    await getProfile(s.db, actor, handle),
    `getProfile(db, actor, "${handle}")`,
  );
  /* D-130-18: read through an index signature, as `routes.test.ts` already does. `counts.cards`
     is BLOCKED (D-130-04) and the cells below are left redding on purpose — see this file's
     header and `counts.test.ts:39`. Typing this `Counts` would make the compiler delete a
     block marker its author placed deliberately; the red has to survive the type, not the
     other way round. */
  return record.counts as unknown as Record<string, number>;
}

interface Split {
  owner: AccountFixture;
  visitor: AccountFixture;
  admin: AccountFixture;
  publicCards: number;
  privateCards: number;
  publicBundles: number;
  privateBundles: number;
  privateSlug: string;
  privateCardId: string;
}

/**
 * One handle with a public half and a private half, and the numbers written down here rather
 * than read back off the module. Every expectation below is arithmetic over these, so a cell
 * cannot agree with an implementation by asking it what the answer is.
 */
async function seedSplit(tag: string): Promise<Split> {
  const owner = await insertAccount(s, { handle: mark(`t130-vis-${tag}`).toLowerCase() });
  const visitor = await insertAccount(s, { handle: mark(`t130-vis-${tag}-v`).toLowerCase() });
  const admin = await insertAccount(s, { handle: mark(`t130-vis-${tag}-op`).toLowerCase() });

  const openCard = await insertCard(s, {
    id: `${owner.handle}/open-card`,
    ownerId: owner.id,
    authorHandle: owner.handle,
  });
  const privateCardId = `${owner.handle}/sealed-card`;
  await insertCard(s, {
    id: privateCardId,
    ownerId: owner.id,
    authorHandle: owner.handle,
    visibility: "private",
  });

  await insertBundle(s, { owner, slug: "open-bundle", cards: [openCard] });
  const privateSlug = "sealed-bundle";
  await insertBundle(s, { owner, slug: privateSlug, cards: [openCard], visibility: "private" });

  return {
    owner,
    visitor,
    admin,
    publicCards: 1,
    privateCards: 1,
    publicBundles: 1,
    privateBundles: 1,
    privateSlug,
    privateCardId,
  };
}

beforeAll(async () => {
  s = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC2: owner and visitor differ by exactly the private rows", () => {

  it("the blueprint count differs by exactly the private bundles", async () => {
    /* Read from T060's contract, not filled into T130's silence: "an owner's blueprint and
       card counts include the private half and a visitor's never do"
       (`components/profile/load.ts:192-200`), plus T130's own Contract line saying "counts"
       rather than "card count". Labelled so it can be struck by a ruling. */
    const f = await seedSplit("bundles");
    const asVisitor = await counts(f.owner.handle, account(f.visitor.id, f.visitor.handle));
    const asOwner = await counts(f.owner.handle, account(f.owner.id, f.owner.handle));

    expect(asVisitor.blueprints).toBe(f.publicBundles);
    expect(asOwner.blueprints).toBe(f.publicBundles + f.privateBundles);
    expect(asOwner.blueprints - asVisitor.blueprints).toBe(f.privateBundles);
  });


});

describe("AC2: neither reading order contaminates the other", () => {


  it("a re-read by the same actor answers the same record", async () => {
    /* The control the two order cells need. Without it, "the second read differed" is
       satisfied by a module that answers a different number every time, which is not caching
       correctly — it is not caching at all AND not counting correctly. */
    const f = await seedSplit("stable");
    const first = await counts(f.owner.handle, account(f.owner.id, f.owner.handle));
    const second = await counts(f.owner.handle, account(f.owner.id, f.owner.handle));
    expect(first).toEqual(second);
  });
});

/* The B-03 cell that belongs with this fixture — does a visitor see the private bundle's
   slug — is in `pins.test.ts` instead, and the reason is worth stating rather than leaving as
   an absence. `ProfileRecord` has no slug list, no card list and no bundle list: its only
   member that can carry an archive identifier is `pinned`. So a leak sweep over the record as
   seeded here would be a walk over a value that STRUCTURALLY cannot carry the tell — a guard
   that cannot fail, dressed as a privacy check. It needs a pin at the private target, and the
   pin spelling is discovered in `pins.test.ts`. */
