/* ============================================================
   T150 — AC3 and the fault doors, both ruled at D-WAVE-07

   AC3: "an anonymous star is refused and moves nothing."

   ── the criterion has two halves and they need different cells ──
   *Refused* was open until D-WAVE-07, and it was open for a reason
   worth keeping visible: `toggleStar` returns `Promise<SignalState>`,
   so unlike T140's `Promise<void>` a module can honestly answer the
   unchanged state with `starredByCaller: false` and call that a
   refusal. **That reading is now ruled out** — "a writer that answers
   a value for a denial tells its caller the write succeeded"
   (D-140-02) — and `NotSignedInError` is the class. `NotAccountOwnerError`
   is refused as a synonym because `toggleStar` takes no `accountId`
   to compare against, so *not this account's owner* is the wrong
   sentence.

   *Moves nothing* was never open and is the half that does the real
   work. wave-blind: "Assert what the writer LEFT BEHIND, not only
   that it threw. A mutation that inserts a row and *then* throws
   satisfies every `rejects.toThrow()` a reviewer would write." So
   every refusal cell below diffs the whole database across the call,
   over a domain derived from `lib/db/schema.ts` rather than from a
   list of the two tables the ruling names.

   ── `recordDownload` NEVER REJECTS, and that is also ruled ──
   D-WAVE-07 inherits T090's ruling: it catches, logs, returns, and
   the counter is unchanged. §T090's own clause is about `serveFile`
   not denying a serve — a different claim about a different function
   — and the merged `lib/server/export/downloads.ts` doing it is code
   rather than contract, which is why the ruling had to be written.

   The consequence for this file is exact: **no cell asserts that
   `recordDownload` throws, and no cell asserts that it does not.**
   What is asserted is what the call left behind. An implementation
   that swallows and an implementation that rethrows are separated
   by nothing here on purpose, because the contract separates them
   in one direction only and the suite must not invent the other.

   ── `NotSignedInError` has a CLASS and no published FORM ──
   So nothing here pins its message text. A literal invented in this
   file would become a contract the implementer never saw, which is
   the defect D-WAVE-07 is about. The class identity and D-13's
   repository-wide clause are what is asserted; the missing form is
   named in the failure message so a reader is not left wondering
   whether it was forgotten.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ANONYMOUS,
  accountActor,
  assertNoValue,
  assertSealed,
  bind,
  bindCounterStoreError,
  bindNotSignedInError,
  counterStoreFailedMessage,
  movedTableNames,
  movedTables,
  outcomeOf,
  rejection,
  renderDeltas,
  snapshotAll,
} from "./contract";
import {
  type Scratch,
  clean,
  closeDatabase,
  createAccount,
  db,
  deadDb,
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

describe("AC3: an anonymous star is refused", () => {
  it("throws `NotSignedInError` rather than answering an unchanged state", async () => {
    const toggleStar = await bind("toggleStar");
    const NotSignedInError = await bindNotSignedInError();
    const target = freeTarget("blueprint");
    await plantTarget(t, target, { starCount: 3 });

    const err = await rejection(toggleStar(db(t), ANONYMOUS, target), "toggleStar, anonymous");

    expect(
      err,
      `an anonymous \`toggleStar\` was refused with ${String(err)}. D-WAVE-07 publishes ` +
        `\`NotSignedInError\` for this decision and refuses \`NotAccountOwnerError\` as a ` +
        `synonym: \`toggleStar\` takes no \`accountId\` to compare against, so *not this ` +
        `account's owner* is the wrong sentence.`,
    ).toBeInstanceOf(NotSignedInError);
    assertSealed(err, "toggleStar's anonymous refusal");
  }, 120_000);

  it("moves nothing, over every table the schema declares", async () => {
    /*
     * The half that catches the mutation `rejects.toThrow()` cannot see: a write followed by a
     * throw satisfies the cell above and is caught here.
     *
     * ── the premise was WRONG, and a 24-mutation sweep is what showed it ──
     * It planted the target row and called anonymously on that same target. Redded by **0 of
     * 24 mutations**, including the two written to break exactly this — removing the anonymous
     * guard, and moving it AFTER the row creation. The reason is that with the row already
     * present `ensureRow` writes nothing, and the only remaining write carries a null
     * `account_id`, which `target_actor` refuses on its own. **The cell was guarded by the
     * database rather than by the module**, and it read as coverage for the write-then-throw
     * shape while covering none of it.
     *
     * So the anonymous call now goes at a target that does NOT yet exist, where a row creation
     * IS observable — and the populated target sits beside it, untouched, so the diff still
     * carries the second claim. One call, one snapshot, both hazards.
     */
    const toggleStar = await bind("toggleStar");
    const populated = freeTarget("card");
    const fresh = freeTarget("card");
    const other = await createAccount(t);
    const planted = await plantTarget(t, populated, {
      starCount: 1,
      downloadCount: 6,
      noteCount: 2,
    });
    await plantStar(t, planted.targetId, other);

    const before = await snapshotAll(t);
    await outcomeOf(() => toggleStar(db(t), ANONYMOUS, fresh));
    const after = await snapshotAll(t);

    expect(
      movedTableNames(before, after),
      `an anonymous \`toggleStar\` left something behind. AC3 is "refused AND moves nothing", ` +
        `and a write followed by a throw satisfies every \`rejects.toThrow()\` a reviewer would ` +
        `write. What moved:\n${renderDeltas(movedTables(before, after))}`,
    ).toEqual([]);

    expect(
      await targetRows(t, fresh),
      "a refused anonymous caller created the row it was refused on",
    ).toEqual([]);

    const rows = await targetRows(t, populated);
    expect(
      { star: rows[0]?.starCount, download: rows[0]?.downloadCount, note: rows[0]?.noteCount },
      "and the populated target beside it, three counters unmoved",
    ).toEqual({ star: "1", download: "6", note: "2" });
    expect(
      (await starsFor(t, planted.targetId)).map((s) => s.accountId),
      "and the other account's star, untouched",
    ).toEqual([other]);
  }, 120_000);

  it("creates no `target` row where none existed", async () => {
    /*
     * The other shape of "moves nothing", and it is the one an upsert-first implementation gets
     * wrong: creating the row on demand BEFORE checking the actor writes a row for every
     * anonymous click on any string a caller can type, and then throws, and the throw makes it
     * look refused.
     */
    const toggleStar = await bind("toggleStar");
    const target = freeTarget("term");

    await outcomeOf(() => toggleStar(db(t), ANONYMOUS, target));

    expect(
      await targetRows(t, target),
      `an anonymous \`toggleStar\` created the \`target\` row before refusing. "\`target\` is ` +
        `created on demand" is about a write that is going to happen; a refused caller is not ` +
        `one, and this is how an anonymous visitor mints rows for ids nobody has ever used.`,
    ).toEqual([]);
  }, 120_000);

  it("still lets `getSignals` answer an anonymous reader, which is a different question", async () => {
    /*
     * The control. Without it, "anonymous is refused" is also satisfied by a module that refuses
     * an anonymous caller everywhere — and that module breaks every public page, since a star
     * count is public (B-10) and `starredByCaller: false` is AC4's published answer for exactly
     * this actor.
     */
    const getSignals = await bind("getSignals");
    const target = freeTarget("blueprint");
    await plantTarget(t, target, { starCount: 2 });

    const outcome = await outcomeOf(() => getSignals(db(t), ANONYMOUS, target));
    expect(
      outcome.settled,
      `\`getSignals\` refused an anonymous reader. AC3 is about the STAR; the counts are public ` +
        `and AC4 publishes \`starredByCaller: false\` for exactly this actor. ` +
        `${outcome.digest.slice(0, 300)}`,
    ).toBe("value");
  }, 120_000);
});

describe("no visibility check, which is ruled and is a negative", () => {
  it("accepts a star on a target no bundle, card or term row backs", async () => {
    /*
     * D-WAVE-07: "`toggleStar` performs NO visibility check", on T140's precedent — *a save of a
     * target that does not exist is accepted and never listed*.
     *
     * A negative ruling, and D-WAVE-07 names why it needed writing down: a document grows by
     * addition, so a statement that something does not happen never lands on its own and the
     * criterion stays untestable. This is the cell it makes writable.
     *
     * `refId` here resolves to nothing at all — no `bundle`, no `card_version`, no
     * `ontology_term` — which is the strongest form of "the module does not look": there is
     * nothing for a check to have found. `target.ref_id` is free `text` and carries no foreign
     * key, so this is a real state and not a contrived one.
     */
    const toggleStar = await bind("toggleStar");
    const target = freeTarget("blueprint");
    const accountId = await createAccount(t);

    const outcome = await outcomeOf(() => toggleStar(db(t), accountActor(accountId), target));

    expect(
      outcome.settled,
      `\`toggleStar\` refused a target nothing backs. D-WAVE-07 rules there is NO visibility ` +
        `check, and \`Depends on: T080\` cannot be about one: T080 publishes no lookup by ` +
        `\`bundle.id\` — which is what \`target.ref_id\` holds — and neither ` +
        `\`BlueprintSummary\` nor \`CardSummary\` carries \`ownerId\` or \`visibility\`, so ` +
        `\`visibleTo\` cannot be called from anything it returns. ` +
        `${outcome.digest.slice(0, 300)}`,
    ).toBe("value");

    const rows = await targetRows(t, target);
    expect(rows.length, "and the star was counted").toBe(1);
    expect(rows[0].starCount).toBe("1");
  }, 120_000);
});

describe("D-13: the store fault is sealed", () => {
  /*
   * ── THREE cells, not one, and the split is a repair ──
   * These were one cell asserting the class, then the exact message, then the two scans, in
   * that order. **Paired clauses behind one assertion order mask each other**: the message
   * assertion runs first, so a module whose wording differs by one word hides whatever the
   * scans would have said about the same error — and that is exactly what happened at the
   * join, where the published form and the shipped form differ by a single letter.
   *
   * Split so each claim is measured on its own. They are genuinely independent: a module can
   * seal perfectly and word the message differently, or word it exactly and leak through a
   * channel the message never touches.
   *
   * `dead()` is per-cell rather than shared. A dead pool is cheap, and a fixture shared across
   * cells that each need a fault is one read that writes.
   */
  const KINDS = ["getSignals", "toggleStar"] as const;

  /** The one fault shape a SQLSTATE-keyed catch cannot classify: there is no SQLSTATE. */
  async function faultFrom(name: (typeof KINDS)[number]): Promise<{
    err: unknown;
    refId: string;
    accountId: string;
  }> {
    const fn = await bind(name);
    const dead = deadDb();
    const target = freeTarget("card");
    const accountId = await createAccount(t);
    try {
      const err = await rejection(
        fn(dead.db, accountActor(accountId), target),
        `${name} against a dead store`,
      );
      return { err, refId: target.refId, accountId };
    } finally {
      await dead.close();
    }
  }

  it.each(KINDS)("refuses a dead store with `CounterStoreError` from `%s`", async (name) => {
    const CounterStoreError = await bindCounterStoreError();
    const { err } = await faultFrom(name);
    expect(
      err,
      `${name} refused a dead store with ${String(err).slice(0, 200)}. D-WAVE-07 publishes ` +
        `\`CounterStoreError\`, and \`tests/store-modules-seal-their-faults.test.ts\` puts this ` +
        `module in its domain the day it imports \`@/lib/db\` — AN ABSENT CLASS LEAKS BY NOT ` +
        `EXISTING.`,
    ).toBeInstanceOf(CounterStoreError);
  }, 120_000);

  it.each(KINDS)("renders the PUBLISHED message form from `%s`", async (name) => {
    /*
     * An exact match against a literal built in `contract.ts` and never imported from the
     * module: an expectation built from the module under test asserts only that the module
     * agrees with itself, and survives the day the template starts interpolating a driver value.
     *
     * The literal is D-WAVE-07's, verbatim. If this reds on a wording difference it is a
     * DOCUMENT question and not an implementation defect — check whether the ruling was an
     * ancestor of the branch that built the module before charging anyone.
     */
    const { err } = await faultFrom(name);
    expect(
      (err as Error).message,
      `D-WAVE-07 publishes the form ${counterStoreFailedMessage("<operation>")}`,
    ).toBe(counterStoreFailedMessage(name));
  }, 120_000);

  it.each(KINDS)("carries no statement and no bound value out of `%s`", async (name) => {
    /*
     * D-13's own clause, measured independently of the wording above.
     *
     * `assertSealed` walks `getOwnPropertyNames` VALUES and follows `cause`, because the shape
     * this clause is most often satisfied by — a driver error stashed non-enumerably — is
     * invisible to `message`, to `String(err)`, to `JSON.stringify` and to a scan over property
     * NAMES. `assertNoValue` is the provenance half: `refId` and `accountId` are minted here and
     * handed to the module, so the only route either has into a rendering is the module putting
     * it there.
     */
    const { err, refId, accountId } = await faultFrom(name);
    assertSealed(err, `${name}'s store fault`);
    assertNoValue(err, [refId, accountId], `${name}'s store fault`);
  }, 120_000);
});

describe("`recordDownload` never rejects, and the counter is unchanged", () => {
  it("returns rather than throwing when the store is unreachable", async () => {
    /*
     * D-WAVE-07, inheriting T090's ruling: "it catches, logs, returns, and the counter is
     * unchanged". A counter outage taking downloads offline is a worse product than an
     * undercount, and B-14 makes the event explicit rather than load-bearing.
     */
    const recordDownload = await bind("recordDownload");
    const dead = deadDb();
    const target = freeTarget("blueprint");

    try {
      const outcome = await outcomeOf(() => recordDownload(dead.db, target));
      expect(
        outcome.settled,
        `\`recordDownload\` rejected against an unreachable store. D-WAVE-07: it catches, logs ` +
          `and returns — "a counter write that fails must not deny a legitimate download", and ` +
          `the caller is a serving edge that has already produced the bytes. ` +
          `${outcome.digest.slice(0, 300)}`,
      ).toBe("value");
      expect(outcome.value, "`Promise<void>`").toBeUndefined();
    } finally {
      await dead.close();
    }
  }, 120_000);

  it("leaves the counter exactly where it was when its write could not land", async () => {
    /*
     * The half that is assertable under BOTH readings of the fault question, and the one that
     * would have been the whole cell had D-WAVE-07 gone the other way. "Swallowed" must mean the
     * write did not happen, not that it half happened: a module that increments a cached total,
     * or that writes the row and fails on the counter, satisfies the cell above and is caught
     * here.
     *
     * The live database is snapshotted around a call made against the DEAD one, so what is
     * measured is that the fault path touched nothing real.
     */
    const recordDownload = await bind("recordDownload");
    const dead = deadDb();
    const target = freeTarget("card");
    await plantTarget(t, target, { downloadCount: 5 });

    try {
      const before = await snapshotAll(t);
      await outcomeOf(() => recordDownload(dead.db, target));
      const after = await snapshotAll(t);

      expect(
        movedTableNames(before, after),
        `a swallowed \`recordDownload\` moved something:\n` +
          renderDeltas(movedTables(before, after)),
      ).toEqual([]);

      const rows = await targetRows(t, target);
      expect(rows[0]?.downloadCount, "the count it could not write is the count it had").toBe("5");
    } finally {
      await dead.close();
    }
  }, 120_000);
});
