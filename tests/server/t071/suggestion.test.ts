/* ============================================================
   T071 AC2 and D-071-01(3) — the two things a suggestion must do
   at this bound, which pull in opposite directions

     AC2: "the refusal carries **no** `suggestion`, per D-70-18, and
      a truncated-to-32 suggestion is specifically **not** offered —
      that would hand the caller a name it did not ask for"

     D-071-01(3): "THE SUGGESTION BAND IS RULED, D-70-20's OWN ARM
      (a): the stem SHORTENS. … a handle suggestion must itself be at
      most 32 and allocatable, and the no-suggestion refusal stays
      reserved for ILLEGAL inputs (D-70-18 intact)."

   One clause forbids a suggestion, the other requires one. They do
   not conflict — the discriminator is whether the name the caller
   asked for was itself legal — and this file is arranged so that
   each is asserted where the other cannot cover for it.

   ── the absence is asserted against a NEAR-MISS ──
   "No suggestion for a 33-character handle" is satisfied completely
   by a module that never suggests anything, and by one whose
   suggester happened to find no candidate. Neither is what AC2 is
   about. So the over-length inputs below are chosen so that a
   truncating suggester WOULD have something to offer: the first
   32 characters are a legal, free, allocatable handle at the moment
   of the call. The bad output is named in the comment AND excluded
   by the assertion, rather than merely not admitted.

   ── and the suggester is proved ALIVE in the same file ──
   `the suggester still fires` below is the control the two absence
   cells rest on. Without it, every assertion in the first describe
   is green against a module with no suggester at all, and the file
   reports coverage it does not have. It is deliberately in this file
   and not another: a control in a second file measures a second
   worker, a second scratch database and a second module load.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { asAvailability, bind, expectSealedError, handleTakenMessage, settled, unavailable } from "./contract";
import {
  MAX_HANDLE_LENGTH,
  clean,
  closeDatabase,
  createAccount,
  db,
  distinctNameOfLength,
  openDatabase,
} from "./fixtures";

const OVER = MAX_HANDLE_LENGTH + 1;

beforeAll(openDatabase, 60_000);
afterAll(closeDatabase, 60_000);
beforeEach(clean, 60_000);

/** Take `handle`, then ask what `checkHandle` says about it. Every band cell rests on this. */
async function takenThenChecked(handle: string) {
  const account = await createAccount();
  const allocate = await bind("allocateHandle");
  const check = await bind("checkHandle");
  await allocate(db(), account, handle);
  return unavailable(() => check(db(), handle), `checkHandle("${handle}", taken)`, "taken");
}

describe("AC2: an over-length handle is refused with no suggestion at all", () => {
  it(`checkHandle offers nothing for ${OVER} characters whose first ${MAX_HANDLE_LENGTH} are FREE`, async () => {
    /* The near-miss. `truncated` is legal, unclaimed and allocatable at the moment of the call,
       so a suggester that reached for `handle.slice(0, MAX_HANDLE_LENGTH)` would find it
       available and hand it over. Nothing about this input discourages the wrong answer. */
    const handle = distinctNameOfLength(OVER, "near");
    const truncated = handle.slice(0, MAX_HANDLE_LENGTH);

    const check = await bind("checkHandle");
    /* The premise, driven through the published door rather than assumed: the truncation this
       cell forbids being offered really is free. A near-miss whose candidate was unavailable
       anyway would make the absence below mean nothing. */
    const candidate = asAvailability(
      await check(db(), truncated),
      `checkHandle("${truncated}") — the premise: the truncation IS free`,
    );
    expect(candidate.available, "premise: the forbidden candidate is available to be offered").toBe(
      true,
    );

    const answer = await unavailable(
      () => check(db(), handle),
      `checkHandle(db, ${OVER} chars, truncation free)`,
      "illegal",
    );

    /* `unavailable` already enforces D-70-18's forbidden half over every `illegal` refusal, so
       this pair is the identity half: AC2 names one candidate specifically, and a cell whose
       comment names a concrete bad output must EXCLUDE that output rather than admit the good
       one. Both are asserted — the second could not fail while the first holds, and it is what
       a reader of a future red sees first. */
    expect(
      answer.suggestion,
      `D-70-18: a suggestion accompanies exactly those refusals where the name asked for is ` +
        `well-formed. A ${OVER}-character handle is not.`,
    ).toBeUndefined();
    expect(
      answer.suggestion,
      `AC2 names this candidate by name: "a truncated-to-${MAX_HANDLE_LENGTH} suggestion is ` +
        `specifically not offered — that would hand the caller a name it did not ask for". ` +
        `\`${truncated}\` is the caller's own string with its last character removed, and the ` +
        `caller never asked for it.`,
    ).not.toBe(truncated);
  });

  it(`offers nothing at ${OVER} characters when the truncation is TAKEN either`, async () => {
    /* The second near-miss, and it catches a different wrong module. A suggester that truncates
       and then checks availability skips the taken candidate and falls through to its next one
       — `<truncated>-2`, `<truncated>1`, whatever the generator does. That module passes the
       cell above, because the string it finally offers is not `truncated`. Here it still has to
       offer nothing at all. */
    const handle = distinctNameOfLength(OVER, "held");
    const truncated = handle.slice(0, MAX_HANDLE_LENGTH);
    const holder = await createAccount();
    const allocate = await bind("allocateHandle");
    await allocate(db(), holder, truncated);

    const check = await bind("checkHandle");
    const answer = await unavailable(
      () => check(db(), handle),
      `checkHandle(db, ${OVER} chars, truncation taken)`,
      "illegal",
    );
    expect(
      answer.suggestion,
      `the refusal carries \`${answer.suggestion}\`. D-70-18 forbids ANY suggestion beside an ` +
        `illegal name, not only the truncated one: you can only offer an alternative to a name ` +
        `that is itself legal, and a caller handed a name here is being answered a question it ` +
        `did not ask.`,
    ).toBeUndefined();
  });

  it("and the refusal is `illegal`, not `taken` — the reason a caller branches on", async () => {
    /* The failure this separates out: a bound implemented as a lookup against a pre-seeded
       deny-list answers `taken`, carries a suggestion because `taken` requires one, and
       satisfies "the handle was refused" completely. D-70-14a exists because "a caller could
       not tell 'not legal' from 'I did not say'"; at this bound the two produce opposite
       suggestion behaviour, so the reason is load-bearing rather than descriptive. */
    const handle = distinctNameOfLength(OVER, "reason");
    const check = await bind("checkHandle");
    const answer = await unavailable(
      () => check(db(), handle),
      `checkHandle(db, ${OVER} chars)`,
      "illegal",
    );
    expect(answer.reason).toBe("illegal");
    expect(answer.suggestion).toBeUndefined();
  });
});

describe("the control the absence cells rest on: the suggester still fires", () => {
  it("a taken handle well inside the bound is still offered an alternative", async () => {
    /* Every assertion in the describe above is satisfied by a module that never suggests
       anything. This is the cell that makes them mean something, and it is also AC3's shape at
       the suggester: the ordinary path is untouched by T071. If this reds and the absences pass,
       nothing above measured what it claims to. */
    const handle = distinctNameOfLength(12, "alive");
    const answer = await takenThenChecked(handle);
    expect(
      answer.suggestion,
      `\`checkHandle\` offered nothing for a TAKEN, well-formed, twelve-character handle. ` +
        `D-70-18 requires a suggestion whenever the name asked for is well-formed, and until ` +
        `this passes the "no suggestion at ${OVER} characters" cells above are green against a ` +
        `module with no suggester in it.`,
    ).toBeTypeOf("string");
    expect(answer.suggestion).not.toBe(handle);
  });
});

describe("D-071-01(3): the stem shortens, so the suggestion stays inside the bound", () => {
  /* D-70-20's arm (a), re-pointed at the new number. The failure it closes, in the ruling's own
     words: "A taken 31-or-32-character handle would otherwise be offered a 34-character
     suggestion `allocateHandle` refuses — availability and allocation disagreeing through the
     input the bound did not reach, D-70-13's species exactly."

     So both lengths the ruling names get a cell. 31 is the sharper of the two against a
     two-character suffix — 31 + 2 is 33, exactly one over — and 32 is the one AC1 makes
     reachable through a legal allocation. */
  for (const length of [MAX_HANDLE_LENGTH - 1, MAX_HANDLE_LENGTH]) {
    it(`a taken ${length}-character handle is offered a suggestion of at most ${MAX_HANDLE_LENGTH}`, async () => {
      const handle = distinctNameOfLength(length, "band");
      const answer = await takenThenChecked(handle);
      const suggestion = answer.suggestion as string;

      expect(
        suggestion.length,
        `\`checkHandle\` offered \`${suggestion}\` (${suggestion.length} characters) for the ` +
          `taken ${length}-character \`${handle}\`. A generator that appends to the whole stem ` +
          `produces exactly this: \`${handle}-2\` is ${handle.length + 2} characters, which ` +
          `this module's own \`checkHandle\` answers \`illegal\` for and its own ` +
          `\`allocateHandle\` refuses. D-071-01(3) rules the stem SHORTENS instead: ` +
          `\`room = bound - suffix.length\`, with the handle door passing ` +
          `${MAX_HANDLE_LENGTH} where slugs pass 255.`,
      ).toBeLessThanOrEqual(MAX_HANDLE_LENGTH);
    });

    it(`and the ${length}-character handle's suggestion is itself \`available\` — the disagreement D-70-13 names`, async () => {
      /* The behavioural half, and it is not redundant with the length assertion above: a
         suggestion could sit inside the bound and still be a name somebody holds, or one the
         grammar refuses for a reason that has nothing to do with length. This asks the module
         the same question the caller would ask next, against the same state the suggestion was
         computed against — the strongest sense in which "free at the moment it is returned" is
         testable at all, and the sense §T070 says is the strongest available. */
      const handle = distinctNameOfLength(length, "band");
      const answer = await takenThenChecked(handle);
      const suggestion = answer.suggestion as string;

      const check = await bind("checkHandle");
      const second = asAvailability(
        await check(db(), suggestion),
        `checkHandle("${suggestion}") — the offered alternative`,
      );
      expect(
        second.available,
        `\`checkHandle\` offered \`${suggestion}\` for the taken ${length}-character ` +
          `\`${handle}\`, and then answered \`{ available: false, reason: ` +
          `${JSON.stringify(second.reason)} }\` for its own suggestion. A \`reason\` of ` +
          `"illegal" here is precisely the over-length candidate D-071-01(3) rules out: the ` +
          `availability door and the allocation door disagreeing through an input the bound ` +
          `did not reach.`,
      ).toBe(true);
    });

    it(`and \`allocateHandle\` accepts the ${length}-character handle's suggestion — "at most ${MAX_HANDLE_LENGTH} and allocatable"`, async () => {
      /* The ruling requires both, and the second does not follow from the first: `checkHandle`
         answering `available` is a claim by the query door about a name the WRITE door has
         never seen, which is the whole reason AC1 insists on both.

         Two outcomes are admissible and one is not. §T070: "a suggestion is advisory and
         carries no reservation … allocating it is still allowed to fail." So a failure is
         permitted and PINNED to the published `HandleTakenError` form — a suggestion refused as
         INVALID reds here, which is the outcome an over-length candidate produces. */
      const handle = distinctNameOfLength(length, "band");
      const answer = await takenThenChecked(handle);
      const suggestion = answer.suggestion as string;

      const claimant = await createAccount();
      const allocate = await bind("allocateHandle");
      const failure = await settled(() => allocate(db(), claimant, suggestion));
      if (failure !== undefined) {
        expectSealedError(failure, `allocateHandle(db, id, "${suggestion}")`, {
          expectedMessage: handleTakenMessage(suggestion),
        });
      }

      const check = await bind("checkHandle");
      expect(
        asAvailability(await check(db(), suggestion), `checkHandle("${suggestion}")`).available,
        `the suggestion is still free after an allocation attempt. Whether the attempt ` +
          `succeeded or was refused as taken, something holds \`${suggestion}\` now — and if ` +
          `neither happened, the write door refused a name the query door had just offered.`,
      ).toBe(false);
    });
  }
});
