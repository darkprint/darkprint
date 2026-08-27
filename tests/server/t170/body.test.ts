/* ============================================================
   T170 AC5 — "a body over the length limit or empty is refused
   with the limit stated"

   ── THE LIMIT IS QUANTIFIED OVER, NEVER WRITTEN TWICE ──
   D-WAVE-03 publishes `MAX_NOTE_BODY = 2000` from the barrel and
   marks the VALUE `PENDING-OWNER-REVIEW`, because a ceiling is a
   product decision. So no cell here asserts it equals 2000: every
   boundary is built FROM the constant, and the suite survives the
   owner picking another number. What is pinned is the behaviour —
   that a body of exactly the limit is accepted, one character more
   is refused, and the refusal STATES the number.

   ── UTF-16 CODE UNITS, AND THE COST IS ASSERTED RATHER THAN HIDDEN ──
   D-WAVE-03 spells the count in code units, and states the price:
   2000 emoji is refused where 2000 letters is not. Its implementer
   had written the more honest code-point version and REVERTED it
   to match the published spelling. So the boundary cells build
   their bodies out of BMP characters, whose `.length` is their
   count, and one cell pins the astral case at the published
   spelling — a suite deriving from the document has to assert what
   the document says or that revert was for nothing.

   ── AND THE STORE IS CHECKED AFTER EVERY REFUSAL ──
   "Assert what the writer LEFT BEHIND, not only that it threw." A
   mutation that inserts the row and then validates satisfies every
   `rejects.toThrow()` a reviewer would write, and AC5 is exactly
   the criterion where that ordering is easy to get wrong.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  NOTE_BODY_ERROR,
  accountActor,
  bind,
  bindErrorClass,
  bindMaxNoteBody,
  noteRows,
  rejection,
  targetRow,
} from "./contract";
import {
  type NoteTarget,
  blueprintTarget,
  closeDatabase,
  openDatabase,
  premise,
  seedAccount,
  seedBundle,
} from "./fixtures";

let s: Scratch;

beforeAll(async () => {
  s = await openDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

/** A fresh author, blueprint and actor — one per cell, so no cell inherits another's rows. */
async function stage(label: string): Promise<{ actor: ReturnType<typeof accountActor>; target: NoteTarget }> {
  const author = await seedAccount(s, label);
  const bundle = await seedBundle(s, { ownerId: author.id });
  return { actor: accountActor(author.id, author.handle), target: blueprintTarget(bundle) };
}

/**
 * `count` BMP characters, so `.length` in UTF-16 code units IS `count`.
 *
 * "a" repeated, deliberately: the boundary cells are about LENGTH and nothing else, and a
 * body carrying a marker or a random suffix would make an off-by-one in the fixture read as
 * an off-by-one in the module.
 */
function bmpBody(count: number): string {
  const body = "a".repeat(count);
  if (body.length !== count) {
    throw new Error(
      `BROKEN FIXTURE: a body meant to be ${count} code units measured ${body.length}.`,
    );
  }
  return body;
}

describe("T170 AC5 — the boundary, derived from the published constant", () => {
  it("a body of exactly `MAX_NOTE_BODY` code units is ACCEPTED", async () => {
    const { actor, target } = await stage("ac5-at");
    const limit = await bindMaxNoteBody();
    const postNote = await bind("postNote");

    const record = await postNote(s.db, actor, target, bmpBody(limit));

    expect(
      (record as Record<string, unknown>)?.id,
      `AC5's limit is a CEILING, not a threshold. A module refusing at exactly ` +
        `${limit} refuses a body the contract admits, and the off-by-one is invisible to ` +
        `every cell that only tries an obviously-too-long body.`,
    ).toEqual(expect.any(String));

    const rows = await noteRows(s, target);
    expect(rows.length, `the accepted body must actually be stored`).toBe(1);
    expect(rows[0].body.length).toBe(limit);
  });

  it("a body of `MAX_NOTE_BODY + 1` is REFUSED, and nothing is written", async () => {
    const { actor, target } = await stage("ac5-over");
    const limit = await bindMaxNoteBody();
    const postNote = await bind("postNote");

    const err = await rejection(
      () => postNote(s.db, actor, target, bmpBody(limit + 1)),
      `postNote with a body of ${limit + 1} code units`,
    );

    const cls = await bindErrorClass(NOTE_BODY_ERROR);
    expect(
      err,
      `D-WAVE-04 publishes \`${NOTE_BODY_ERROR}\` for AC5. The class matters because a ` +
        `caller has to tell a rejected body from a store fault, and only a class it can ` +
        `name lets it branch.`,
    ).toBeInstanceOf(cls);

    expect(
      await noteRows(s, target),
      `AC5: the row was written and THEN the body was refused.\n` +
        `  A writer that inserts before it validates satisfies every ` +
        `\`rejects.toThrow()\` a reviewer would write — the refusal arrives and the row is ` +
        `there. This is what "assert what the writer left behind" is for.`,
    ).toEqual([]);
    expect(
      (await targetRow(s, target))?.noteCount ?? 0,
      `a refused post must not move \`note_count\` either`,
    ).toBe(0);
  });

  it("the refusal STATES the limit", async () => {
    const { actor, target } = await stage("ac5-states");
    const limit = await bindMaxNoteBody();
    const postNote = await bind("postNote");

    const err = await rejection(
      () => postNote(s.db, actor, target, bmpBody(limit + 1)),
      "postNote over the limit",
    );
    const message = err instanceof Error ? err.message : String(err);

    expect(
      message,
      `AC5 is "refused WITH THE LIMIT STATED", and D-WAVE-03 makes the pin ` +
        `\`message.includes(String(MAX_NOTE_BODY))\`. A refusal that does not say the ` +
        `number leaves the caller guessing at the one fact it needs to fix its input — and ` +
        `"the body is too long" is a message that has never helped anyone.\n` +
        `  message: ${JSON.stringify(message)}`,
    ).toContain(String(limit));
  });
});

describe("T170 AC5 — empty, and whitespace-only is empty (D-WAVE-03)", () => {
  it.each([
    ["the empty string", ""],
    ["a single space", " "],
    ["spaces only", "     "],
    ["a tab and a newline", "\t\n"],
    ["a non-breaking space", " "],
  ])("%s is refused, and nothing is written", async (_label, body) => {
    const { actor, target } = await stage("ac5-empty");
    const postNote = await bind("postNote");

    await rejection(
      () => postNote(s.db, actor, target, body),
      `postNote with ${JSON.stringify(body)}`,
    );

    expect(
      await noteRows(s, target),
      `D-WAVE-03: whitespace-only counts as empty (\`.trim().length === 0\`). A module ` +
        `checking \`body.length === 0\` accepts every one of these but the first, and stores ` +
        `a note that renders as nothing at all.\n` +
        `  \`\\u00a0\` is included because \`String.prototype.trim\` strips it — it is ` +
        `whitespace by the spec's definition and not only by the ASCII one — so a module ` +
        `hand-rolling a \`/^[ \\t\\n]*$/\` check passes the first four and fails this one.`,
    ).toEqual([]);
  });

  it("the empty refusal is `NoteBodyError` too", async () => {
    const { actor, target } = await stage("ac5-empty-cls");
    const postNote = await bind("postNote");
    const err = await rejection(() => postNote(s.db, actor, target, ""), "postNote with ''");
    const cls = await bindErrorClass(NOTE_BODY_ERROR);
    expect(
      err,
      `AC5 names one criterion covering both halves — "over the length limit OR empty" — so ` +
        `both refuse through the class the block publishes for it. A module raising a bare ` +
        `\`Error\` here and \`${NOTE_BODY_ERROR}\` for the long case gives its caller two ` +
        `branches for one criterion.`,
    ).toBeInstanceOf(cls);
  });
});

describe("T170 AC5 — UTF-16 code units, as D-WAVE-03 spells it", () => {
  /**
   * The stated cost, asserted rather than left implicit.
   *
   * Every astral character is two UTF-16 code units, so `limit / 2` emoji is exactly at the
   * ceiling and one more crosses it, while a code-POINT reading would admit `limit` of them.
   * D-WAVE-03 states this cost in as many words and its implementer reverted a code-point
   * version to match — so a suite deriving from the document asserts the document's
   * spelling. If the owner overturns the ceiling's units at review, THIS is the cell that
   * has to change, and it says so.
   */
  it("an astral body is measured in code units, not code points", async () => {
    const { actor, target } = await stage("ac5-astral");
    const limit = await bindMaxNoteBody();
    premise(limit % 2 === 0, `this cell halves the limit; ${limit} is odd and it cannot`);

    const emoji = "\u{1F600}";
    premise(emoji.length === 2, `an astral character must be 2 UTF-16 code units`);

    const postNote = await bind("postNote");
    const atCeiling = emoji.repeat(limit / 2);
    premise(atCeiling.length === limit, `the at-ceiling body must measure exactly the limit`);

    const accepted = await postNote(s.db, actor, target, atCeiling);
    expect(
      (accepted as Record<string, unknown>)?.id,
      `${limit / 2} astral characters is ${limit} UTF-16 code units, which is exactly the ` +
        `ceiling and must be accepted.`,
    ).toEqual(expect.any(String));

    await rejection(
      () => postNote(s.db, actor, target, emoji.repeat(limit / 2 + 1)),
      `postNote with ${limit / 2 + 1} astral characters`,
    );

    expect(
      (await noteRows(s, target)).length,
      `D-WAVE-03 counts UTF-16 CODE UNITS and states the cost: ${limit} emoji is refused ` +
        `where ${limit} letters is not. A code-POINT implementation accepts ` +
        `${limit / 2 + 1} astral characters here and stores a second row.\n` +
        `  This is the cell to change if the owner overturns the units at review — the ` +
        `value is PENDING-OWNER-REVIEW, the UNITS are what this asserts.`,
    ).toBe(1);
  });
});
