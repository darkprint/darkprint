/* ============================================================
   F-231-A's follow-through — the pins rest on a MESSAGE, and
   this is the cell that notices when they stop having to

   §T231 in `backend.md` carries no **Published signatures**
   block. Every other section does, and T231 is the one task whose
   entire deliverable is a signature. Charged as F-231-A before
   anything was written, upheld, and D-231-01 was published to
   this session as a message rather than into the document.

   So `PUBLISHED` in `./contract.ts` is a TRANSCRIPTION, which is
   the weakest provenance anything in this partition rests on.

   **This guard is vacuous today and says so.** It becomes
   load-bearing the moment the orchestrator writes the block —
   and those are the SAME EVENT, with no run in between where
   anyone would notice a defect in it. Which is why the shapes it
   will meet were simulated before it armed, and why those
   simulations are committed cells rather than a report.

   `backend.md` is the orchestrator's — this suite reports what it
   should say and never writes it.

   ── the defect this file shipped with, and the repair ──
   Both assertions used to scan the WHOLE block. That made a
   withdrawal note quoting an old signature indistinguishable from
   the published one, and made the true sentence recording an
   amendment — *"the `revokedAt: null` narrowing was amended
   out"* — red the cell whose message says that narrowing must not
   be published. **Red-to-red: the correction documenting the
   amendment quotes the forbidden token, and the checker could not
   tell the amendment from the thing it amends.** Third instance
   of that shape in this run.

   **§T230's block is written exactly the way that broke it** — it
   prints the withdrawn `LimitVerdict` at length, then the
   replacement — so the shape was not hypothetical.

   Repaired by scoping both reads to the INDENTED SIGNATURE LINES
   and taking the LAST `checkLimit(`, rather than by constraining
   how the document records its own history. A regex must not
   dictate that.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  checkLimitSignatureIn,
  narrowsRevokedAtToNull,
  publishedBlockIn,
  t231PublishedBlock,
  t231Section,
  unmatchedSignatureMarkers,
} from "./contract";

/* ============================================================
   the candidates, run through the REAL parser

   An adversary simulated this parser against five shapes and
   found three defects. A simulation is the thing a committed cell
   replaces, so the five are here — plus two that must STILL red,
   because a repair that made every candidate pass would be a
   guard that never fires, which is the failure it was repaired to
   avoid.
   ============================================================ */

const SIGNATURE = "        checkLimit(subject: LimitSubject, bucket: string): Promise<LimitVerdict>";

const C1_MINIMAL = `- **Published signatures** (checked against \`backend\`.)

${SIGNATURE}
`;

const C2_QUOTES_WITHDRAWN = `- **Published signatures** (WITHDRAWN, and it was wrong in two ways. The block published

        checkLimit(db: Db, subject: { accountId: string | null; keyId: string | null }, bucket: string)

  and that signature is struck. What replaces it:)

${SIGNATURE}
`;

const C3_RECORDS_THE_AMENDMENT = `- **Published signatures** (the brand is unnarrowed. An earlier ruling wrote
  \`ResolvedKey extends ApiKeyRecord { revokedAt: null }\` and the \`revokedAt: null\`
  narrowing was AMENDED OUT: the type system cannot verify non-revocation.)

${SIGNATURE}
        export type ResolvedKey = ApiKeyRecord & { readonly [resolved]: true };
`;

/** Both at once, which is how §T230's own block is written. */
const C4_BOTH = `- **Published signatures** (WITHDRAWN in two ways. It published

        checkLimit(db: Db, subject: { accountId: string | null }, bucket: string)

  and it narrowed the brand with \`revokedAt: null\`, which was amended out.)

${SIGNATURE}
        export type ResolvedKey = ApiKeyRecord & { readonly [resolved]: true };
`;

const C5_COLON_SPELLING = `- **Published signatures:** (a spelling no other section uses.)

${SIGNATURE}
`;

/** A block that genuinely publishes the withdrawn signature. MUST red. */
const C6_ACTUALLY_PUBLISHES_DB = `- **Published signatures** (as ruled.)

        checkLimit(db: Db, subject: LimitSubject, bucket: string): Promise<LimitVerdict>
`;

/** A block whose SIGNATURE narrows the brand. MUST red. */
const C7_ACTUALLY_NARROWS = `- **Published signatures** (as ruled.)

${SIGNATURE}
        export interface ResolvedKey extends ApiKeyRecord { revokedAt: null }
`;

describe("the parser, falsified against the shapes it will actually meet", () => {
  it("reads the published signature past a withdrawal note that quotes the old one", () => {
    for (const [name, section] of [
      ["C1 minimal", C1_MINIMAL],
      ["C2 quotes the withdrawn signature", C2_QUOTES_WITHDRAWN],
      ["C4 quotes both, as §T230 does", C4_BOTH],
    ] as const) {
      const block = publishedBlockIn(section);
      const signature = checkLimitSignatureIn(block ?? "");
      expect(signature, `${name}: no \`checkLimit(\` found in the signature lines`).toBeDefined();
      expect(
        /\bdb\s*:/.test(signature ?? ""),
        `${name}: the parser read \`${signature}\` — a WITHDRAWAL NOTE rather than the ` +
          `published line. Scanning the whole block cannot tell a struck signature from a ` +
          `live one, and this document records its own history.`,
      ).toBe(false);
      expect(signature).toMatch(/subject\s*:\s*LimitSubject/);
    }
  });

  it("lets the document record the amendment without redding for quoting it", () => {
    for (const [name, section] of [
      ["C3 records the amendment in prose", C3_RECORDS_THE_AMENDMENT],
      ["C4 records both", C4_BOTH],
    ] as const) {
      const block = publishedBlockIn(section);
      expect(
        narrowsRevokedAtToNull(block ?? ""),
        `${name}: the guard fired on prose SAYING the narrowing was amended out. That is the ` +
          `true sentence F-231-B requires be recorded, and a checker that cannot tell an ` +
          `amendment from the thing it amends is blinded by quoting what it looks for.`,
      ).toBe(false);
    }
  });

  it("STILL reds when the block genuinely publishes the withdrawn shape", () => {
    /*
     * The discrimination. Without these two, the repair above is satisfied by a guard that
     * never fires — which is precisely the C5 hazard in a different costume.
     */
    const withDb = checkLimitSignatureIn(publishedBlockIn(C6_ACTUALLY_PUBLISHES_DB) ?? "");
    expect(
      /\bdb\s*:/.test(withDb ?? ""),
      `C6 publishes \`checkLimit(${withDb})\` as its live signature and the guard did not ` +
        `see it. The repair has turned the cell off rather than scoping it.`,
    ).toBe(true);

    expect(
      narrowsRevokedAtToNull(publishedBlockIn(C7_ACTUALLY_NARROWS) ?? ""),
      `C7's published SIGNATURE narrows \`revokedAt\` to \`null\` and the guard did not see it.`,
    ).toBe(true);
  });

  it("detects a marker spelling the parser does not match, instead of arming never", () => {
    /*
     * C5 is the quiet hazard and the worse one. `publishedBlockIn` matches one literal
     * spelling; all 36 existing blocks use it. A block landing as `**Published signatures:**`
     * would make every cell here answer "vacuous" and PASS, forever, reporting F-231-A as
     * still open after it had been closed — and nothing would ever say otherwise.
     *
     * **A guard that silently never arms is worse than one that reds.**
     */
    expect(publishedBlockIn(C5_COLON_SPELLING), `C5 is matched by the parser`).toBeUndefined();
    expect(
      unmatchedSignatureMarkers(C5_COLON_SPELLING).length,
      `C5 spells the marker differently and the near-miss detector did not notice, so the ` +
        `guard would answer "vacuous" forever while the block sat there published.`,
    ).toBeGreaterThan(0);
    /* And it must not fire on the spelling it DOES match, or every armed section reds. */
    expect(unmatchedSignatureMarkers(C1_MINIMAL)).toEqual([]);
  });
});

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

  it("fails if §T231 spells the marker in a way this parser cannot see", () => {
    /* The one cell here that fails rather than reports, and the reasoning that made the
       others report has EXPIRED for this case: reporting-not-failing was right because the
       block's absence is the orchestrator's to fix. A marker the parser cannot read is not
       an absence — it is this suite's own blindness, and it is mine to fix. */
    expect(
      unmatchedSignatureMarkers(t231Section()),
      `§T231 contains a "Published signatures" marker this parser does not match, so every ` +
        `cell below would answer "vacuous" and pass while the block sat there published. ` +
        `The convention is \`**Published signatures**\` — all 36 existing blocks use it.`,
    ).toEqual([]);
  });

  it("agrees with the document about `checkLimit` once the document has an opinion", () => {
    const block = t231PublishedBlock();
    if (block === undefined) {
      expect(block).toBeUndefined();
      return;
    }

    const signature = checkLimitSignatureIn(block);
    expect(
      signature,
      `§T231 publishes a block with no \`checkLimit(\` on any indented signature line.`,
    ).toBeDefined();
    expect(
      /\bdb\s*:/.test(signature ?? ""),
      `§T231's published \`checkLimit\` still takes a \`db\`: (${signature}). AC2 removes it.`,
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
      narrowsRevokedAtToNull(block),
      `§T231's published SIGNATURE narrows \`revokedAt\` to \`null\`. That narrowing was ` +
        `AMENDED OUT: the type system cannot verify non-revocation, so it could only come ` +
        `from a cast, and it would make F-230-J's mutation INERT — deleting ` +
        `\`isNull(revokedAt)\` from \`resolveKey\`'s WHERE still mints a branded record. ` +
        `The brand proves PROVENANCE, never non-revocation.\n` +
        `  Prose RECORDING the amendment is fine and is not what this reads.`,
    ).toBe(false);
  });

  it("still finds the section it derives everything from", () => {
    /* The control. Every cell above answers "vacuous" when the block is absent, and a
       renamed or deleted SECTION would make them all answer that forever while looking
       exactly like today's honest vacuity. Matched on `T231,` — the task number is the
       identifier and the prose after it is not. */
    const section = t231Section();
    expect(section.length, "§T231 read as fewer than 500 bytes").toBeGreaterThan(500);
    expect(section).toContain("Acceptance criteria");
  });
});
