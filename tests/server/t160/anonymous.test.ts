/* ============================================================
   T160 — AC6, an anonymous ballot is refused

   ── "IT THREW" IS NOT THE ASSERTION ──
   A mutation that inserts the row and throws afterwards satisfies
   every `rejects.toThrow()` a reviewer would write. It was
   measured in this run: "it threw" was satisfied by an
   implementation that froze an empty folder. So each cell here
   asserts TWO things and the second is the load-bearing one:

     1. the call rejects, and
     2. THE TABLE IS EMPTY AFTERWARDS.

   The read-back is over the whole `ballot` table and not over one
   (account, bundle) pair, because three of the four refused actors
   carry no account id at all — there is no pair to read back, and
   a scoped read would be a claim about a scope the write never had.

   ── THE FIRST FOUR MEMBERS HELD NOTHING, AND THE SWEEP SAID SO ──
   Every one of the original four carries no usable id, so `""` or
   `undefined` reaches the store, the store refuses it for a reason
   of its own, and a module that never checked the actor passes all
   four. That is not a hypothesis: deleting the refusal outright
   reddened ZERO of them once the stand-in sealed its store faults,
   because a sealed wrapper renders the database's objection as an
   ordinary refusal — the criterion was being enforced by Postgres
   and credited to the module.

   The fifth member is what makes the set an instrument. It carries
   a REAL, EXISTING account id under an `anonymous` kind, which the
   database has no objection to at all, so the refusal can only come
   from the module. The first four are kept: they hold the shapes
   jointly with the store, and their reds are still the right reds
   when they fire. They are simply not, on their own, evidence.

   §T160 says only "an anonymous ballot is refused" and publishes no
   error class, so every member is a caller no live reading of that
   clause could admit, and none can become a false charge against an
   implementer who built to the section.

   The inherited-authority shapes are NOT here. They carry a real
   account id and are refused only under T060's third ruling, which
   §T160 does not restate — they live in
   `inherited-authority.test.ts` under a header saying a red there
   is an open contract question rather than a failed AC6.

   ── what is NOT pinned, and why ──
   The CLASS and the MESSAGE FORM. §T160 publishes no error class
   at all — charge F-160-H — so a pin here would be this suite
   choosing a name the contract has not, and every other task in
   this run that did so found the contract wrong rather than the
   implementer. What IS assertable without a name is D-13's
   hygiene clause over whatever does arrive, and that is asserted:
   an `Error`, and no rendering carrying the driver's own prose,
   its SQLSTATEs, a constraint name or a connection string.

   `getAggregate` for an anonymous READER is also not asserted.
   AC6 is about the ballot, the radar is a public surface, and
   whether a private bundle's aggregate is visible to a stranger is
   charge F-160-I. Silence, so nothing here guesses.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  NO_IDENTITY,
  type Scratch,
  accountActor,
  assertNoDriverProse,
  bind,
  describe_,
  rejection,
} from "./contract";
import {
  allBallotRows,
  ballotRows,
  castBallotAsserted,
  closeDatabase,
  openDatabase,
  seedAccount,
  seedBundle,
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

describe("AC6 — a caller with no account identity cannot cast", () => {
  it.each(NO_IDENTITY)("refuses $label", async ({ label, because, actor }) => {
    const s = await db();
    const owner = await seedAccount(s, { label: "ac6-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const castBallot = await bind("castBallot");
    /* A real, existing account, so the last member of the set can carry an id the database
       has no objection to. `owner.id` is deliberate: a ballot written in the blueprint
       owner's name by a signed-out caller is the concrete harm AC6 is about. */
    const built = actor(owner.id);

    /* Bound and seeded FIRST, called LAST. An early red masks every write below it while
       being correct about its own subject, and a red in 0ms where I/O was expected is a cell
       that never started. */
    const err = await rejection(
      () => castBallot(s.db, built, bundle.id, { efficacy: 60 }),
      `castBallot as ${label}`,
    );

    expect(
      err,
      `castBallot as ${label} rejected with ${describe_(err)}. AC6's refusal has no published ` +
        `class — charge F-160-H — so nothing here pins one, but a rejection that is not an ` +
        `Error cannot be branched on by any caller.`,
    ).toBeInstanceOf(Error);

    assertNoDriverProse(err, `the refusal of ${label}`);

    /* THE ASSERTION THAT MATTERS: what the store was left holding. `because` names the
       ruling this row is about and travels into the red below. */
    const rows = await allBallotRows(s);
    expect(
      rows,
      `castBallot as ${label} rejected AND left ${rows.length} ballot row(s) behind.\n` +
        `  ${because}\n` +
        `  A writer that inserts and then throws satisfies every \`rejects.toThrow()\` a ` +
        `reviewer would write. The refusal is what the STORE was left holding, not what the ` +
        `caller was told.`,
    ).toEqual([]);
  });

  /**
   * The control, and it is the two-factor half of the sweep above.
   *
   * Every cell above requires an empty table after a refusal. A module whose `castBallot`
   * never writes anything at all satisfies all four of them, and nothing in this file would
   * notice. This cell drives the SAME fixture with a real signed-in account and requires the
   * row to be there — so a green sweep above is a claim about the refusals rather than about
   * the writer being inert.
   */
  it("and the same fixture with a real account DOES leave a ballot", async () => {
    const s = await db();
    const owner = await seedAccount(s, { label: "ac6c-owner", weight: 1, validator: false });
    const bundle = await seedBundle(s, { ownerId: owner.id });
    const voter = await seedAccount(s, { label: "ac6c-v", weight: 1, validator: false });

    await castBallotAsserted(
      s,
      accountActor(voter.id, voter.handle),
      voter.id,
      bundle.id,
      { efficacy: 60 },
    );

    const rows = await ballotRows(s, bundle.id);
    expect(
      rows.length,
      `the refusal cells above all assert an EMPTY table, and an implementation that never ` +
        `writes satisfies every one of them. This cell is what separates "refused" from ` +
        `"inert", and it fails if the writer works for nobody.`,
    ).toBe(1);
    expect(rows[0]?.accountId).toBe(voter.id);
  });
});
