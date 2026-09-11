/* ============================================================
   T170 — the published surface

   The one file here that needs no database. It asks what the
   barrel publishes and nothing about what it does, which is why it
   is separate: a red here says the module does not exist or does
   not name what the contract names, and a red anywhere else says a
   criterion failed. Reading those two off one file makes the
   handback ambiguous about which half is wrong.

   A TYPE PIN CANNOT HOLD ANY OF THIS. wave-blind.md's own list: a
   type pin is silently vacuous on an absent module, loudly useless
   on a present barrel missing a member, and falsely green on a
   negative whose probe matches neither shape — and a type-level
   instrument cannot observe its own blindness. So every cell below
   reads the barrel's namespace AS A VALUE at runtime. That is the
   only thing that distinguishes *a member is absent* from *an
   assertion failed*.
   ============================================================ */

import { describe, expect, it } from "vitest";

import * as accounts from "@/lib/server/accounts";

import {
  NOTES,
  NOTE_BODY_ERROR,
  NOTE_STORE_ERROR,
  NOT_ACCOUNT_OWNER_ERROR,
  PUBLISHED,
  PUBLISHED_NAMES,
  bind,
  bindErrorClass,
  bindMaxNoteBody,
  loadNotes,
  noteStoreFailedMessage,
} from "./contract";

describe("T170 published signatures — the five functions", () => {
  it.each(PUBLISHED_NAMES)("`%s` is exported from the barrel as a function", async (name) => {
    const fn = await bind(name);
    expect(typeof fn, `${NOTES}.${name} — ${PUBLISHED[name]}`).toBe("function");
  });

  /**
   * Arity, and it is checked at the published count rather than "at least one".
   *
   * `Function.length` stops at the first parameter with a default and does NOT count rest
   * parameters — and an OPTIONAL parameter still counts, because `?` erases at runtime.
   * So `listNotes(db, actor, target, cursor?)` is 4 and `listNotes(db, actor, target,
   * cursor = undefined)` is 3, and both are legal implementations of the same signature.
   * The lower bound is therefore what the block forces and the upper bound is the whole
   * parameter list; anything outside that pair is a different function.
   */
  it.each([
    ["listNotes", 3, 4],
    ["postNote", 4, 4],
    ["editNote", 4, 4],
    ["deleteNote", 3, 3],
    ["voteNote", 3, 3],
  ] as const)("`%s` takes between %i and %i parameters", async (name, low, high) => {
    const fn = await bind(name);
    expect(
      fn.length,
      `${PUBLISHED[name]}\n` +
        `  \`Function.length\` counts up to the first defaulted parameter and counts an ` +
        `optional one (\`?\` erases at runtime), so ${low}..${high} is the whole legal range ` +
        `for this signature. ${fn.length} is a different function.`,
    ).toBeGreaterThanOrEqual(low);
    expect(fn.length, PUBLISHED[name]).toBeLessThanOrEqual(high);
  });
});

describe("T170 published surface — the constant and the classes (D-WAVE-03, D-WAVE-04)", () => {
  /**
   * The value is NOT pinned at 2000. D-WAVE-03 marks it PENDING-OWNER-REVIEW, so an
   * equality here would red the day the owner picks another ceiling — and the criterion
   * AC5 states is about a limit being stated and honoured, not about which limit it is.
   * Every boundary cell in `body.test.ts` derives both its lengths from this number.
   */
  it("`MAX_NOTE_BODY` is published from the barrel as a positive integer", async () => {
    const limit = await bindMaxNoteBody();
    expect(Number.isSafeInteger(limit), `MAX_NOTE_BODY is ${String(limit)}`).toBe(true);
    expect(limit, "a character ceiling of zero or less refuses every body there is").toBeGreaterThan(
      0,
    );
  });

  it.each([NOTE_BODY_ERROR, NOTE_STORE_ERROR])(
    "`%s` is published from the barrel as a class",
    async (name) => {
      const cls = await bindErrorClass(name);
      const instance = new (cls as new (...a: never[]) => Error)();
      expect(
        instance,
        `${NOTES}.${name} must be constructible and an Error — a caller that cannot ` +
          `\`instanceof\` it cannot branch on it, which is the whole reason D-WAVE-04 names it.`,
      ).toBeInstanceOf(Error);
    },
  );

  /**
   * AC3 and AC7 CONSUME `NotAccountOwnerError`; they do not mint one.
   *
   * The assertion is IDENTITY, not name equality: a class of the same name minted inside
   * `lib/server/notes` passes a string comparison and fails this. That is exactly the
   * difference D-140-02 ruled on, and a name check would report the wrong thing as fine.
   */
  it("`NotAccountOwnerError` is NOT re-published by the notes barrel under its own name", async () => {
    const mod = await loadNotes();
    const republished = mod[NOT_ACCOUNT_OWNER_ERROR];
    if (republished === undefined) return;
    expect(
      republished,
      `${NOTES} exports its own \`${NOT_ACCOUNT_OWNER_ERROR}\`, and it is NOT ` +
        `\`@/lib/server/accounts\`'s.\n` +
        `  D-WAVE-04 says AC3 and AC7 CONSUME T050's class. A second class of the same ` +
        `name is a synonym: every caller that branches on the accounts one stops matching, ` +
        `and a suite comparing \`err.name\` never notices. If it is re-exported ` +
        `deliberately it must be the SAME OBJECT, which is what this compares.`,
    ).toBe(accounts.NotAccountOwnerError);
  });
});

describe("T170 D-13 — `NoteStoreError`'s message form is a literal, built here", () => {
  /**
   * The form is asserted on an instance this cell constructs, so the pin exists before any
   * store fault is reachable. `store-error.test.ts` drives the real fault; this cell is
   * about the TEMPLATE, and it is written as an exact match rather than a `toContain`
   * because a message that merely contains the words also contains whatever else the
   * module decided to interpolate — which is the one thing D-13 forbids.
   */
  it("`new NoteStoreError(operation)` renders `<operation>: the notes store failed.`", async () => {
    const cls = await bindErrorClass(NOTE_STORE_ERROR);
    const err = new (cls as new (op: string) => Error)("postNote");
    expect(
      err.message,
      `D-WAVE-04 publishes the form \`<operation>: the notes store failed.\` — quoted from ` +
        `the contract and never imported from the module, because an expectation built from ` +
        `the module under test asserts only that the module agrees with itself.`,
    ).toBe(noteStoreFailedMessage("postNote"));
  });
});
