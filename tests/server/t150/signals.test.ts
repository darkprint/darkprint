/* ============================================================
   T150 — AC4 and AC2: what the response carries, and what an
   unstar puts back

   AC4, in the block's own words:

     "AC4 is why both functions return the same `SignalState` and
      neither returns `void`. The toggle response carries the
      aggregate **and** the caller's own state
      (`components/ui/FavoriteStar.tsx:152-183`), so a client never
      has to issue a second read to render the star it just clicked.
      `starredByCaller` is `false` for an anonymous actor rather than
      absent — an optional field invites a client to treat missing as
      unknown and re-fetch."

   ── the two-valued trap, and why one actor is not enough ──
   `starredByCaller` is `false` by default in every sense that
   matters: it is what an empty table produces, what an unset field
   produces, and what `undefined` coerces to at the call site. So a
   cell that drives ONE actor and asserts `false` is satisfied by a
   module that has never implemented the field at all, and a cell
   that drives one actor and asserts `true` is satisfied by a module
   that answers `true` to everybody.

   Every AC4 cell below therefore asserts each explicit value against
   an actor whose default DISAGREES with it, in the same call and on
   the same target: the account that starred is told `true` while a
   second account, reading the identical row, is told `false`. That
   pair excludes "does anybody star this", which is the wrong reading
   an aggregate-only implementation lands on and which a single-actor
   cell cannot see.

   ── and the aggregate must be the row's, not the caller's ──
   The same pair carries a second assertion for free. Both actors
   read one target, so `starCount` must be EQUAL for the two of them
   while `starredByCaller` differs. A module that conflates the
   caller's state with the aggregate answers 1 and 0.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ANONYMOUS, accountActor, assertSignalState, bind, countsOf } from "./contract";
import {
  type Scratch,
  clean,
  closeDatabase,
  createAccount,
  createAccounts,
  db,
  freeTarget,
  openDatabase,
  plantStar,
  plantTarget,
  starsFor,
  targetRows,
} from "./fixtures";

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 120_000);
afterAll(async () => {
  await closeDatabase();
}, 120_000);
beforeEach(async () => {
  await clean(t);
}, 120_000);

describe("AC4: the response carries the aggregate AND the caller's own state", () => {
  it("tells the starrer `true` and a second reader `false`, off one row, in one state", async () => {
    /*
     * The disagreeing-default pair. `starrer` is planted as having starred and `stranger` is
     * not, so `true` is asserted against an actor whose default is `false` and `false` against
     * an actor for whom the row nevertheless exists — which is the half a "does anybody star
     * this" implementation gets wrong and a single-actor cell never reaches.
     *
     * The premises are planted directly rather than through `toggleStar`, so the cell measures
     * `getSignals` against storage rather than against the module's agreement with itself.
     */
    const getSignals = await bind("getSignals");
    const target = freeTarget("blueprint");
    const [starrer, stranger] = await createAccounts(t, 2);
    const planted = await plantTarget(t, target, { starCount: 1, downloadCount: 4, noteCount: 2 });
    await plantStar(t, planted.targetId, starrer);

    const mine = assertSignalState(
      await getSignals(db(t), accountActor(starrer), target),
      "getSignals as the account that starred",
    );
    const theirs = assertSignalState(
      await getSignals(db(t), accountActor(stranger), target),
      "getSignals as an account that did not",
    );

    expect(
      mine.starredByCaller,
      `the account holding the only \`target_actor\` star row for this target was told ` +
        `\`starredByCaller\` = ${mine.starredByCaller}.`,
    ).toBe(true);
    expect(
      theirs.starredByCaller,
      `an account with NO star row on this target was told \`starredByCaller\` = ` +
        `${theirs.starredByCaller}, on a target somebody else starred. AC4 is the CALLER's own ` +
        `state; answering "does anybody star this" satisfies every single-actor assertion and ` +
        `renders a filled star for a reader who never clicked one.`,
    ).toBe(false);

    expect(
      countsOf(theirs),
      `the two actors read one \`target\` row and were told different aggregates. ` +
        `\`starredByCaller\` is per caller and the three counts are per TARGET; a module that ` +
        `derives the aggregate from the caller's own rows answers 1 and 0 here.`,
    ).toEqual(countsOf(mine));

    expect(
      countsOf(mine),
      `the aggregate does not match the planted row (star 1, download 4, note 2).`,
    ).toEqual({ starCount: 1, downloadCount: 4, noteCount: 2 });
  }, 120_000);

  it("gives an anonymous reader `false` and the full aggregate, never a missing field", async () => {
    /*
     * "`starredByCaller` is `false` for an anonymous actor rather than absent — an optional
     * field invites a client to treat missing as unknown and re-fetch."
     *
     * `assertSignalState` is what carries the discriminating half: it checks the KEY SET, so an
     * omitted `starredByCaller` reds there, and it checks `=== false` rather than falsiness, so
     * `undefined` reds too. A cell writing `expect(s.starredByCaller).toBeFalsy()` admits both
     * of the outputs this criterion exists to forbid.
     */
    const getSignals = await bind("getSignals");
    const target = freeTarget("card");
    const starrer = await createAccount(t);
    const planted = await plantTarget(t, target, { starCount: 1, downloadCount: 9, noteCount: 0 });
    await plantStar(t, planted.targetId, starrer);

    const state = assertSignalState(
      await getSignals(db(t), ANONYMOUS, target),
      "getSignals as an anonymous actor",
    );

    expect(state.starredByCaller).toBe(false);
    expect(
      countsOf(state),
      `an anonymous reader was given a different aggregate from the one in the row. A star is ` +
        `PUBLIC and counted (B-10); only the caller's own half depends on who is asking.`,
    ).toEqual({ starCount: 1, downloadCount: 9, noteCount: 0 });
  }, 120_000);

  it("answers a target nothing has ever touched with four zeros", async () => {
    /*
     * Values only, and the restraint is deliberate.
     *
     * Whether `getSignals` CREATES the `target` row on a read is a separate question — a read
     * that writes mints a row for any string a caller can type. Both readings agree on what is
     * RETURNED, so that is what this asserts; the row-creation half is checked in
     * `boundary.test.ts`, against the ruling, and is not smuggled in here.
     */
    const getSignals = await bind("getSignals");
    const target = freeTarget("term");
    const reader = await createAccount(t);

    const state = assertSignalState(
      await getSignals(db(t), accountActor(reader), target),
      "getSignals on a target with no row",
    );

    expect(
      { ...countsOf(state), starredByCaller: state.starredByCaller },
      `a target with no \`target\` row is a target nothing has happened to. Zero is the honest ` +
        `answer and \`undefined\` is not one — \`assertSignalState\` has already refused a ` +
        `missing member, so a red here is a wrong NUMBER.`,
    ).toEqual({ starCount: 0, downloadCount: 0, noteCount: 0, starredByCaller: false });
  }, 120_000);

  it("returns the same shape from `toggleStar` as from `getSignals`, in one exchange", async () => {
    /*
     * "so a client never has to issue a second read to render the star it just clicked."
     *
     * The criterion is about a SINGLE exchange, so the discriminating comparison is the toggle's
     * own answer against what a read would have said immediately afterwards. A module returning
     * the state BEFORE its write — the natural mistake when the aggregate is read first and
     * updated second — passes every cell that only reads afterwards and fails this one.
     */
    const toggleStar = await bind("toggleStar");
    const getSignals = await bind("getSignals");
    const target = freeTarget("blueprint");
    const accountId = await createAccount(t);
    const actor = accountActor(accountId);
    await plantTarget(t, target, { downloadCount: 3, noteCount: 5 });

    const answered = assertSignalState(await toggleStar(db(t), actor, target), "toggleStar");
    const read = assertSignalState(await getSignals(db(t), actor, target), "getSignals after it");

    expect(
      answered,
      `\`toggleStar\` answered a state that a read taken immediately afterwards disagrees with. ` +
        `A response describing the state BEFORE the write satisfies every cell that reads the ` +
        `table afterwards and makes AC4's whole point — one exchange — false at the client.`,
    ).toEqual(read);

    expect(answered.starredByCaller, "the caller just starred it").toBe(true);
    expect(answered.starCount, "and the aggregate moved with it").toBe(1);
    expect(
      { downloadCount: answered.downloadCount, noteCount: answered.noteCount },
      `starring moved a counter T150 does not write. D-WAVE-01: T150 writes \`star_count\`, ` +
        `\`download_count\` and \`target_actor\` rows with \`kind = "star"\`, nothing else.`,
    ).toEqual({ downloadCount: 3, noteCount: 5 });
  }, 120_000);
});

describe("AC2: unstarring restores the prior count", () => {
  it("puts a starred target back exactly where it was, row and counter together", async () => {
    /*
     * "Prior" is measured rather than assumed: the target is planted with a non-zero star count
     * standing for other people's stars, so "restores" cannot be satisfied by writing zero.
     * That is the discriminating premise — an implementation that resets rather than decrements
     * passes against a target whose prior count was 0 and is caught here.
     */
    const toggleStar = await bind("toggleStar");
    const target = freeTarget("card");
    const [mine, otherA, otherB] = await createAccounts(t, 3);
    const planted = await plantTarget(t, target, { starCount: 2 });
    await plantStar(t, planted.targetId, otherA);
    await plantStar(t, planted.targetId, otherB);

    const starred = assertSignalState(
      await toggleStar(db(t), accountActor(mine), target),
      "toggleStar, starring",
    );
    expect(starred.starCount, "two other accounts already hold a star here").toBe(3);
    expect(starred.starredByCaller).toBe(true);

    const unstarred = assertSignalState(
      await toggleStar(db(t), accountActor(mine), target),
      "toggleStar, unstarring",
    );

    expect(
      unstarred.starCount,
      `\`star_count\` did not return to the 2 it held before this account starred. An unstar ` +
        `that writes 0 rather than decrementing passes against a target nobody else had ` +
        `starred, which is why this one was planted with two.`,
    ).toBe(2);
    expect(unstarred.starredByCaller).toBe(false);

    const rows = await targetRows(t, target);
    expect(rows.length).toBe(1);
    expect(
      Number(rows[0].starCount),
      "and the stored counter agrees with what the caller was told",
    ).toBe(2);

    /*
     * The row is GONE, and that is settled by the schema rather than by prose. `target_actor`
     * is `(id, target_id, account_id, kind, created_at)` — there is no status column and no
     * tombstone — and AC1's unique index means a re-star must be able to insert again. A delete
     * is the only implementation that admits both.
     */
    const stars = await starsFor(t, planted.targetId);
    expect(
      stars.map((s) => s.accountId).sort(),
      `the unstarred account still holds a \`target_actor\` row. \`target_actor\` carries no ` +
        `status column, so an unstar has nowhere to record itself except by deleting — and a ` +
        `row left behind makes a later re-star collide with ` +
        `\`target_actor_target_account_kind_key\` forever.`,
    ).toEqual([otherA, otherB].sort());
  }, 120_000);

  it("lets the same account star again afterwards, back to where it started", async () => {
    /*
     * The round trip, and it is what makes the deletion above meaningful rather than tidy: a
     * module that "unstars" by any means that leaves the unique key occupied passes the cell
     * above only if it deleted, and fails here loudly if it did something cleverer.
     */
    const toggleStar = await bind("toggleStar");
    const target = freeTarget("term");
    const accountId = await createAccount(t);
    const actor = accountActor(accountId);

    await toggleStar(db(t), actor, target);
    await toggleStar(db(t), actor, target);
    const again = assertSignalState(await toggleStar(db(t), actor, target), "toggleStar, third");

    expect(again.starredByCaller).toBe(true);
    expect(again.starCount).toBe(1);

    const rows = await targetRows(t, target);
    expect(rows.length, "one `(kind, ref_id)`, one row, three toggles later").toBe(1);
    expect((await starsFor(t, rows[0].id)).map((s) => s.accountId)).toEqual([accountId]);
  }, 120_000);
});
