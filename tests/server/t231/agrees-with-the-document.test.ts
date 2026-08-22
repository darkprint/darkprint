/* ============================================================
   F-231-A's follow-through — the pins rest on a MESSAGE, and
   this is the cell that notices when they stop having to

   §T231 in `backend.md` carries no **Published signatures**
   block. Every other section does, and T231 is the one task whose
   entire deliverable is a signature. Charged as F-231-A before
   anything was written, upheld, and D-231-01 was published to
   this session as a message rather than into the document.

   So `PUBLISHED` in `./contract.ts` is a TRANSCRIPTION, which is
   the weakest provenance any pin in this partition rests on:
   T230's blind suite could parse its domain out of the file and
   this one cannot, because the file does not have it yet.

   **This guard is vacuous today and says so.** It becomes
   load-bearing the moment the orchestrator writes the block, and
   at that moment the transcription and the document must agree or
   this reds. That is the same vacuous-until-present shape as the
   type pins next door, declared for the same reason: a pin nobody
   can read is worth writing if it is stated, and worth nothing if
   it is not.

   `backend.md` is the orchestrator's — this suite reports what it
   should say and never writes it.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { sectionOf, t231PublishedBlock, T231_HEADING } from "./contract";

describe("§T231 and this suite's transcription of D-231-01", () => {
  it("reports whether the section has a published block yet, and does not fail for its absence", () => {
    const block = t231PublishedBlock();
    /* Deliberately not an assertion on presence. The block's absence is F-231-A, it is the
       orchestrator's to fix at the merge, and a red here would be this suite failing a task
       for a document it is forbidden to write. The cell exists so the absence is VISIBLE in
       a run rather than known only to whoever read this header. */
    expect(
      typeof block,
      `§T231 gained a Published signatures block — good. The cells below stop being vacuous ` +
        `and this suite's transcription is now checkable against it.`,
    ).toBe(block === undefined ? "undefined" : "string");
  });

  it("agrees with the document about `checkLimit` once the document has an opinion", () => {
    const block = t231PublishedBlock();
    if (block === undefined) {
      /* Vacuous, and the assertion below is what makes the vacuity visible rather than a
         silent pass: a reader sees the cell ran and sees why it decided nothing. */
      expect(block).toBeUndefined();
      return;
    }

    const signature = /checkLimit\s*\(([^)]*)\)/.exec(block)?.[1] ?? "";
    expect(
      /\bdb\s*:/.test(signature),
      `§T231's published \`checkLimit\` still takes a \`db\`: (${signature}). AC2 removes it, ` +
        `and D-231-01 as ruled to this suite has the subject first.`,
    ).toBe(false);
    expect(
      signature,
      `§T231 publishes \`checkLimit(${signature})\` and this suite was told ` +
        `\`checkLimit(subject: LimitSubject, bucket: string, options?)\`. One of the two is ` +
        `stale and the document is the one that binds.`,
    ).toMatch(/subject\s*:\s*LimitSubject/);
  });

  it("agrees with the document about the brand once the document names it", () => {
    const block = t231PublishedBlock();
    if (block === undefined) {
      expect(block).toBeUndefined();
      return;
    }

    expect(
      /revokedAt\s*:\s*null/.test(block),
      `§T231's published brand narrows \`revokedAt\` to \`null\`. That narrowing was ` +
        `AMENDED OUT: the type system cannot verify non-revocation, so it could only come ` +
        `from a cast, and it would make F-230-J's mutation INERT — deleting ` +
        `\`isNull(revokedAt)\` from \`resolveKey\`'s WHERE still mints a branded record. ` +
        `The brand proves PROVENANCE, never non-revocation.`,
    ).toBe(false);
  });

  it("still finds the section it derives everything from", () => {
    /* The control. Every cell above answers "vacuous" when the block is absent, and a
       renamed or deleted SECTION would make them all answer that forever while looking
       exactly like today's honest vacuity. */
    const section = sectionOf(T231_HEADING);
    expect(section.length, "§T231 read as fewer than 500 bytes").toBeGreaterThan(500);
    expect(section).toContain("Acceptance criteria");
  });
});
