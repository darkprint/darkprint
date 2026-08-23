/* ============================================================
   T170 — a malformed cursor is REFUSED, not answered

   Charged from this side as contract silence rather than as a
   defect — the block publishes `cursor?: string` and says nothing
   about a bad one, and the module's reading was defensible: a
   cursor is this module's own output, so one that did not come
   from here names a position in a list that does not exist.

   **Sound about the SET and wrong about the CALLER.** The choice
   is not between an empty page and a 500. It is between telling a
   reader *you have all the data* and telling it *something went
   wrong* — and the module is the only party that can tell those
   apart. An empty page with a null cursor is the first sentence,
   said to a reader for whom the second is true.

   Ruled: `listNotes` refuses, through a published
   `InvalidCursorError`. These cells assert the REFUSAL and the
   message's hygiene, and they say nothing about the token's
   encoding — the contract binds the cursor's PROPERTY (stable
   across a concurrent insert) and never its spelling, and a cell
   that parsed it would pin the one thing here that may change.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  INVALID_CURSOR_ERROR,
  accountActor,
  asPage,
  bind,
  NOTE_STORE_ERROR,
  assertDistinctFrom,
  bindErrorClass,
  READER_SILENT_TRUNCATION,
  plantedToken,
  rejection,
} from "./contract";
import {
  blueprintTarget,
  closeDatabase,
  openDatabase,
  premise,
  seedAccount,
  seedBundle,
  seedNotes,
} from "./fixtures";

let s: Scratch;

beforeAll(async () => {
  s = await openDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function stage(label: string, count = 15) {
  const author = await seedAccount(s, label);
  const bundle = await seedBundle(s, { ownerId: author.id });
  const target = blueprintTarget(bundle);
  const actor = accountActor(author.id, author.handle);
  const ids = await seedNotes(s.db, actor, target, count, label);
  return { actor, target, ids };
}

/**
 * Every shape a cursor arrives broken in, and each is a real accident rather than an
 * invented one. A truncated token is what a length-capped query parameter produces; a
 * re-encoded one is what a `+`-to-space round trip produces; a foreign token is what a
 * client holding two lists produces.
 */
const MALFORMED = [
  ["the empty string", () => ""],
  ["a bare word", () => "next"],
  ["a random token", () => plantedToken()],
  ["base64url of nonsense", () => Buffer.from("not-a-cursor", "utf8").toString("base64url")],
  ["a timestamp with no id", () => Buffer.from("2026-08-23 10:00:00", "utf8").toString("base64url")],
  ["an id with no timestamp", () => Buffer.from(".00000000-0000-4000-8000-000000000001", "utf8").toString("base64url")],
] as const;

describe("T170 — `listNotes` refuses a cursor it did not issue", () => {
  it.each(MALFORMED.map(([label, make]) => [label, make] as const))(
    "%s is refused rather than answered with an empty page",
    async (_label, make) => {
      const { actor, target } = await stage("cur");
      const listNotes = await bind("listNotes");

      const err = await rejection(
        () => listNotes(s.db, actor, target, make()),
        `listNotes with ${_label}`,
        READER_SILENT_TRUNCATION,
      );

      const cls = await bindErrorClass(INVALID_CURSOR_ERROR);
      expect(
        err,
        `A malformed cursor answered instead of refusing.\n` +
          `  An empty page with a null cursor is byte-identical to "this target has no ` +
          `notes" — so a reader mid-walk whose token got mangled is told THE LIST HAS ` +
          `ENDED, and stops. That is a silent truncation of a read wearing the shape of a ` +
          `legitimate answer, and the module is the only party that can tell the two apart.\n` +
          `  \`InvalidCursorError\` is the ruled class. \`error-hygiene\` moves to 37 at the ` +
          `merge, derived there and never carried.`,
      ).toBeInstanceOf(cls);

      await assertDistinctFrom(
        err,
        NOTE_STORE_ERROR,
        "Sealing this inside `NoteStoreError` turns *your token is not ours* — which tells " +
          "a client to RESTART the walk — into *the store failed*, which tells it to RETRY " +
          "THE SAME TOKEN forever. The class passes through `withStore` as a DECISION, not " +
          "a fault, and the two answers send a caller in opposite directions.",
      );
    },
  );

  it("the refusal carries nothing of the caller's value (D-13)", async () => {
    const { actor, target } = await stage("cur-hygiene");
    const secret = plantedToken();
    const listNotes = await bind("listNotes");

    const err = await rejection(
      () => listNotes(s.db, actor, target, secret),
      "listNotes with a planted token as its cursor",
      READER_SILENT_TRUNCATION,
    );

    for (const [channel, text] of [
      ["message", err instanceof Error ? err.message : String(err)],
      ["String(err)", String(err)],
      ["JSON.stringify(err)", JSON.stringify(err) ?? ""],
    ] as const) {
      expect(
        text,
        `D-13: the message names the operation and states the cursor was not one this ` +
          `module issued, carrying NOTHING of the caller's value. The token here is 24 ` +
          `random alphanumeric characters minted by this cell, so it can only reach a ` +
          `rendering by the module putting it there — and a refusal that echoes its input ` +
          `is how a value a caller sent ends up in a log nobody meant to write it to.\n` +
          `  channel: ${channel}`,
      ).not.toContain(secret);
    }
  });

  it("a VALID cursor still pages, so the refusal is not a module that refuses every cursor", async () => {
    const { actor, target, ids } = await stage("cur-positive");
    const listNotes = await bind("listNotes");
    const page1 = asPage(await listNotes(s.db, actor, target), "listNotes page 1");
    premise(page1.cursor !== null, `15 notes must leave a cursor`);

    const page2 = asPage(
      await listNotes(s.db, actor, target, page1.cursor),
      "listNotes page 2 with the cursor it just issued",
    );

    expect(
      [...page1.ids, ...page2.ids].sort(),
      `Every cell above this one is a refusal, and a module that refuses EVERY cursor ` +
        `satisfies all of them while breaking paging entirely. This is what makes them mean ` +
        `something.`,
    ).toEqual([...ids].sort());
  });

  it("`undefined` is not a malformed cursor — it is the first page", async () => {
    const { actor, target } = await stage("cur-absent", 3);
    const listNotes = await bind("listNotes");

    const page = asPage(await listNotes(s.db, actor, target, undefined), "listNotes(…, undefined)");
    expect(
      page.ids.length,
      `\`cursor?: string\` is optional, so an ABSENT cursor is the first page and must not ` +
        `be swept into the refusal. A module narrowing on falsiness refuses \`undefined\` ` +
        `and \`""\` alike, and one of those two is the ordinary first call.`,
    ).toBe(3);
  });
});
