/* ============================================================
   T150 — AC6 and AC7

   AC6, ruled in the block: "does a download of a private bundle by
   its owner count? … **Ruled: it counts.** The counter measures
   serving, not publicity, and an owner's own downloads are the
   honest denominator for a bundle that is later made public.
   `recordDownload` therefore takes **no `Actor`**, which is what
   makes the rule structural: this function cannot discriminate on
   the caller because it is not given one. T090 emits the event at
   the serving edge after its own visibility check."

   ── AC6's real assertion is in `surface.test.ts`, not here ──
   The ruling's own mechanism is the arity: a function that is not
   given a caller cannot discriminate on one. `Function.length === 2`
   is what tests that, and it lives with the surface cells because it
   needs no database. What is here is the behavioural half — that a
   download lands, and lands the same way, whatever the target is —
   and it is deliberately weaker, because under a two-parameter
   signature there is no "owner's download" for a cell to construct.
   **Stated rather than left to be inferred from a short file.**

   AC7: "two versions of one card share a download total. … `refId`
   for a card is the bare `cardId`, and two versions of one card
   share every counter. A test asserts that directly."

   ── AC7's discriminating half is T090's, and it is already pinned ──
   `tests/server/t090/downloads.test.ts:219-266` asserts that
   `serveCard` writes the BARE card id and that the versioned ref
   appears NOWHERE in what the call wrote; `serve-card.ts:59` passes
   `record.cardId`. So the caller strips the version before
   `recordDownload` ever sees it, and `refId` arrives here as opaque
   `text`.

   That leaves two readings inside T150 and only one of them is
   safe. If T150 normalised `id@version` to `id`, a cell asserting it
   would be discriminating — and would RED a correct implementation
   that treats `refId` opaquely, which is what T090's merged caller
   already assumes. If T150 is opaque, then "two downloads of one
   bare id share a counter" is satisfied by the upsert alone and adds
   nothing to AC5's mechanism: a cell no mutation can red, which is
   the thing this suite is hunting for in itself.

   So the cell below is the opaque-reading one, made non-vacuous
   through **read/write grain agreement**: what `recordDownload`
   accumulates under a bare id is what `getSignals` reports under
   that same bare id. That separates a module whose read keys
   differently from its write — a real defect and one nothing else
   here catches — without asserting a normalisation nobody ruled.

   **AC7's discriminating half lives in T090's suite and not in this
   one.** An absence stated is not a gap; an absence unstated is.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ANONYMOUS,
  accountActor,
  assertSignalState,
  bind,
  fireAll,
  PUBLISHED_KINDS,
} from "./contract";
import {
  type Scratch,
  cardRefPair,
  clean,
  closeDatabase,
  createAccount,
  db,
  freeTarget,
  openDatabase,
  plantTarget,
  targetRows,
} from "./fixtures";

const DOWNLOADS = 12;

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

describe("AC6: a download counts, whatever it is a download of", () => {
  it.each(PUBLISHED_KINDS)("counts a download of a `%s` with no caller at all", async (kind) => {
    /*
     * The behavioural half. `recordDownload` is called with the two arguments the block
     * publishes and nothing else — there is no actor to vary, which IS the ruling: "this
     * function cannot discriminate on the caller because it is not given one."
     *
     * Driven over all three kinds rather than one, because "counts a download" asserted against
     * a single kind is satisfied by a module that handles `blueprint` and silently drops the
     * other two — and `target_kind` has three members precisely so all three can be counted.
     */
    const recordDownload = await bind("recordDownload");
    const target = freeTarget(kind);

    await recordDownload(db(t), target);

    const rows = await targetRows(t, target);
    expect(rows.length, `a download of a \`${kind}\` created no \`target\` row`).toBe(1);
    expect(
      rows[0].downloadCount,
      `a download of a \`${kind}\` did not move \`download_count\`.`,
    ).toBe("1");
    expect(
      { star: rows[0].starCount, note: rows[0].noteCount },
      `a download moved a counter it does not own. D-WAVE-01: T150 writes \`star_count\`, ` +
        `\`download_count\` and \`target_actor\` rows with \`kind = "star"\`, nothing else — and ` +
        `a download records no actor, so no \`target_actor\` row either.`,
    ).toEqual({ star: "0", note: "0" });
  }, 120_000);

  it("adds to a target somebody has already starred, without disturbing the star", async () => {
    /*
     * The two counters are separate columns on one row and the upsert touches one of them. A
     * module whose download path re-writes the whole row from a value it read earlier resets the
     * star count, which no cell driving downloads alone can see.
     */
    const recordDownload = await bind("recordDownload");
    const target = freeTarget("blueprint");
    await plantTarget(t, target, { starCount: 4, downloadCount: 9, noteCount: 1 });

    await recordDownload(db(t), target);

    const rows = await targetRows(t, target);
    expect(
      { star: rows[0].starCount, download: rows[0].downloadCount, note: rows[0].noteCount },
      `a download rewrote a counter it does not own, or lost one it does.`,
    ).toEqual({ star: "4", download: "10", note: "1" });
  }, 120_000);

  it(`counts all ${DOWNLOADS} of ${DOWNLOADS} simultaneous downloads of one file`, async () => {
    /*
     * The increment, on the download path. AC5 names stars and the mechanism is shared: two
     * concurrent serves of one file cannot both read 4 and both write 5, which is the same
     * read-modify-write hazard `SET download_count = download_count + 1` closes.
     *
     * Asserted rather than assumed to be covered by AC5's star cell, because the two paths are
     * different statements and a module can get one right and the other wrong. No reading of
     * "count downloads" admits losing one.
     */
    const recordDownload = await bind("recordDownload");
    const target = freeTarget("card");

    const results = await fireAll(DOWNLOADS, () => recordDownload(db(t), target));

    const rejected = results.flatMap((r) =>
      r.status === "rejected" ? [String((r as PromiseRejectedResult).reason)] : [],
    );
    expect(
      rejected,
      `\`recordDownload\` rejected under contention, and D-WAVE-07 rules it never rejects at ` +
        `all:\n  ${rejected.slice(0, 3).join("\n  ")}`,
    ).toEqual([]);

    const rows = await targetRows(t, target);
    expect(rows.length, "twelve callers, one `(kind, ref_id)`, one row").toBe(1);
    expect(
      rows[0].downloadCount,
      `${DOWNLOADS} simultaneous downloads left \`download_count\` at ${rows[0].downloadCount}. ` +
        `Nothing was refused, so nothing was dropped on purpose: this is the increment being a ` +
        `read-modify-write in the process rather than \`SET download_count = download_count + 1\` ` +
        `inside the statement.`,
    ).toBe(String(DOWNLOADS));
  }, 180_000);
});

describe("AC7: the card grain, and where the discriminating half lives", () => {
  it("aggregates every download of one bare card id into one counter", async () => {
    /*
     * The opaque-reading cell. See this file's header: the version-stripping half is T090's and
     * is already pinned there, so asserting it here would red a correct module that treats
     * `refId` as opaque — which is what T090's merged caller assumes.
     *
     * `versioned` is built and deliberately NOT passed to anything. It is here so a reader sees,
     * beside a real value, which half of AC7 this file holds and which half it does not.
     */
    const recordDownload = await bind("recordDownload");
    const { bare, versioned } = cardRefPair();
    const target = { kind: "card" as const, refId: bare };
    void versioned;

    for (let i = 0; i < 3; i += 1) await recordDownload(db(t), target);

    const rows = await targetRows(t, target);
    expect(rows.length, "one card id, one counter row").toBe(1);
    expect(rows[0].downloadCount).toBe("3");
  }, 120_000);

  it("reports through `getSignals` exactly what `recordDownload` accumulated, under one id", async () => {
    /*
     * What makes the cell above non-vacuous, and the reason the pair is worth writing at all.
     *
     * "Two downloads of one id share a counter" alone is satisfied by the upsert and asserts
     * nothing beyond AC5's mechanism. This one separates a module whose READ keys differently
     * from its WRITE — a bare id written and a versioned or kind-blind id read, or the reverse —
     * which is a real defect and is the closest thing to AC7 that T150 can hold on its own.
     *
     * Also the only cell in the suite that measures the two published functions against each
     * other rather than each against storage.
     */
    const recordDownload = await bind("recordDownload");
    const getSignals = await bind("getSignals");
    const { bare } = cardRefPair();
    const target = { kind: "card" as const, refId: bare };
    const reader = await createAccount(t);

    for (let i = 0; i < 5; i += 1) await recordDownload(db(t), target);

    const asReader = assertSignalState(
      await getSignals(db(t), accountActor(reader), target),
      "getSignals over the bare card id",
    );
    const asAnonymous = assertSignalState(
      await getSignals(db(t), ANONYMOUS, target),
      "getSignals over the bare card id, anonymously",
    );

    expect(
      asReader.downloadCount,
      `\`recordDownload\` accumulated five downloads under the bare card id \`${bare}\` and ` +
        `\`getSignals\` reports ${asReader.downloadCount} for that same id. AC7's grain is a ` +
        `fact about \`ref_id\`, so the read and the write have to key on it identically — and ` +
        `the discriminating half of AC7, that the CALLER strips the version, is pinned in ` +
        `\`tests/server/t090/downloads.test.ts:219-266\` and not here.`,
    ).toBe(5);
    expect(
      asAnonymous.downloadCount,
      "a download total is public; only `starredByCaller` depends on who is asking",
    ).toBe(5);
  }, 120_000);
});
