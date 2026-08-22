/* ============================================================
   T133 AC1 and AC4 — the write refuses anything but the
   published shape, and says so without quoting the caller

   AC1: "the column has one published shape and `addRelease`
   refuses anything else AT THE WRITE, rather than the readers
   refusing it later."
   AC4: "the refusal at the write names the field and never the
   caller's value (D-13)."

   ── why every cell counts rows ──
   "At the write" is the whole of AC1's second clause and it is not
   observable from the rejection alone: an implementation that
   inserts the row and then throws satisfies `rejects.toThrow()`
   exactly as well as one that refuses first, and leaves behind the
   row whose existence makes every profile for that handle 500
   forever -- the cost T133's Log measures rather than estimates.
   So the assertion is `releaseCount === 0`, which EXCLUDES the bad
   outcome, rather than a rejection, which merely admits the good one.

   ── why the nonce, and not a search for the value ──
   AC4's teeth are in "never the caller's value", and a message that
   names the field satisfies the first half while appending the value
   after it. Each refused fixture therefore carries a nonce -- in a
   value, in a key, nested inside a term -- and the cell asserts the
   nonce is absent from everything reachable off the error: its
   message, its `String()`, its `JSON.stringify`, its stack, its
   `cause` chain and every key and string inside all of them.

   ── the hook holds nothing a criterion needs ──
   A throw in `beforeAll` produces SKIPS, not reds, and a skipped
   cell adds nothing to the failed column while looking like a cell
   that ran. The hook here records its failure and every cell
   re-raises it, so a database that will not open reds all of them
   individually instead of hiding twelve criteria behind one hook.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addRelease,
  freshBundle,
  malformedVocabularyError,
  marker,
  nonce,
  openScratch,
  outcomeOf,
  PUBLISHED,
  releaseCount,
  releaseInput,
  renderedFully,
  term,
  vocabularyText,
  type Scratch,
} from "./contract";
import { REFUSED } from "./corpus";

let opened: Scratch | undefined;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    opened = await openScratch();
  } catch (error) {
    setupFailure = error;
  }
}, 120_000);

afterAll(async () => {
  await opened?.drop();
});

function scratch(): Scratch {
  if (opened === undefined) {
    throw new Error(
      `This file's scratch database never opened, so this criterion was not measured: ` +
        `${String(setupFailure)}\n` +
        `  Reported here rather than in the hook: a hook failure SKIPS its file's cells, and ` +
        `a skipped cell adds nothing to the failed column while reading as one that ran.`,
    );
  }
  return opened;
}

describe("AC1 — a refused vocabulary is refused at the write, and no row is left behind", () => {
  for (const shape of REFUSED) {
    it(`refuses ${shape.name}, with \`MalformedVocabularyError\` and no release row`, async () => {
      const s = scratch();
      const write = await addRelease();
      const bundleId = await freshBundle(s, "refuse");
      const mark = marker("refuse");
      const n = nonce();

      const outcome = await outcomeOf(() =>
        (write as (db: unknown, input: unknown) => unknown)(s.db, {
          ...releaseInput(bundleId, mark),
          vocabulary: shape.value(n),
        }),
      );

      expect(
        outcome.kind,
        `\`addRelease\` accepted ${shape.name} as \`vocabulary\`.\n  ${shape.clause}\n  ` +
          `${PUBLISHED.atTheWrite}`,
      ).toBe("threw");

      /* The class is bound AFTER the outcome, deliberately. Bound first, an absent
         `MalformedVocabularyError` reds every cell in this block with a message about a
         missing export and hides the substantive fact -- which shape the write accepted.
         The order costs nothing and makes the red say the more useful of the two things. */
      const Malformed = await malformedVocabularyError();
      const error = (outcome as { error: unknown }).error;
      expect(
        error,
        `\`addRelease\` refused ${shape.name} with something other than the published class.\n` +
          `  ${PUBLISHED.malformedVocabularyError}\n  got: ${String(error)}`,
      ).toBeInstanceOf(Malformed);

      /* The half a rejection cannot show. An implementation that writes the row and then
         throws passes every assertion above and leaves the refused shape in the column,
         which is the state whose cost this task's Log measures. */
      expect(
        await releaseCount(s, bundleId),
        `\`addRelease\` rejected ${shape.name} and still left a release row behind.\n  ` +
          `${PUBLISHED.atTheWrite}`,
      ).toBe(0);
    }, 60_000);
  }
});

describe("AC4 — the refusal names the field and never the caller's value", () => {
  for (const shape of REFUSED) {
    it(`says \`vocabulary\` and leaks nothing from ${shape.name}`, async () => {
      const s = scratch();
      const write = await addRelease();
      const bundleId = await freshBundle(s, "leak");
      const mark = marker("leak");
      const n = nonce();

      const outcome = await outcomeOf(() =>
        (write as (db: unknown, input: unknown) => unknown)(s.db, {
          ...releaseInput(bundleId, mark),
          vocabulary: shape.value(n),
        }),
      );

      expect(
        outcome.kind,
        `\`addRelease\` accepted ${shape.name}, so AC4 has nothing to measure here.\n  ` +
          `${shape.clause}`,
      ).toBe("threw");
      const error = (outcome as { error: unknown }).error;
      const message = error instanceof Error ? error.message : String(error);

      /* The weaker half: a caller who cannot see this module has to learn which of
         `addRelease`'s eight fields it got wrong. */
      expect(
        message,
        `The refusal of ${shape.name} does not name the field.\n  ${PUBLISHED.noCallerValue}\n` +
          `  message: ${message}`,
      ).toMatch(/vocabular/i);

      /* The half with teeth. `renderedFully` is everything a caller or a log can read off
         the value: message, String(), JSON.stringify, stack, the `cause` chain, and every
         key and string inside all of them -- because a leak arrives as a property NAME as
         readily as a value. */
      if (shape.carriesNonce) {
        const rendered = renderedFully(error);
        expect(
          rendered.includes(n),
          `The refusal of ${shape.name} carries the caller's value.\n  ` +
            `${PUBLISHED.noCallerValue}\n  the marker ${n} is reachable off the error.`,
        ).toBe(false);
      }
    }, 60_000);
  }
});

describe("D-133-02 F2 — the shape refusal runs after `isWellFormedDeep`", () => {
  /*
   * Ordering, ruled as contract rather than left to whoever writes the guard.
   *
   * The fixture violates BOTH rules at once: `text` carries an unpaired surrogate, which
   * D-12's walk refuses, and `terms` is a string, which the shape refuses. Exactly one
   * class can come out, and the ruling says which.
   *
   * The assertion is `not.toBeInstanceOf`, which EXCLUDES the outcome the ruling forbids.
   * Asserting the D-12 message instead would pin a literal this task does not publish, and
   * asserting merely that something threw would pass under either ordering.
   */
  it("a vocabulary that is both malformed and not well-formed fails as D-12, not as the shape", async () => {
    const s = scratch();
    const write = await addRelease();
    const bundleId = await freshBundle(s, "d12");
    const mark = marker("d12");

    const outcome = await outcomeOf(() =>
      (write as (db: unknown, input: unknown) => unknown)(s.db, {
        ...releaseInput(bundleId, mark),
        /* A lone high surrogate: `String.prototype.isWellFormed()` answers false, and `pg`
           would silently replace it with U+FFFD, which is the corruption D-12 closed. */
        vocabulary: { text: "\ud800", terms: "not a list" },
      }),
    );

    expect(
      outcome.kind,
      `Neither guard fired on a value that violates both.\n  ${PUBLISHED.orderAgainstD12}`,
    ).toBe("threw");
    const Malformed = await malformedVocabularyError();
    expect(
      (outcome as { error: unknown }).error,
      `The shape refusal ran first.\n  ${PUBLISHED.orderAgainstD12}\n  ` +
        `A well-formedness failure relabelled as a shape failure tells the caller to fix ` +
        `the wrong thing, and it moves D-12's sibling cell's message.`,
    ).not.toBeInstanceOf(Malformed);
    expect(await releaseCount(s, bundleId)).toBe(0);
  }, 60_000);
});

describe("the refusal class satisfies D-13's four-part hygiene clause", () => {
  /*
   * The trap D-133-01 names by hand, because `errors.ts` has already lost to it once:
   * fields go on the PROTOTYPE, never assigned in the constructor. A constructor
   * assignment makes the property enumerable, which breaks both of the first two parts at
   * the same time -- and `ArchiveConflictError`'s own header in that file records the
   * failure.
   *
   * Driven through a real refusal rather than through `new MalformedVocabularyError(...)`:
   * the error a caller sees is the one the module constructed, and a class that is clean
   * when a test builds it can still be dirty when the module builds it.
   */
  async function refusalError(label: string): Promise<unknown> {
    const s = scratch();
    const write = await addRelease();
    const bundleId = await freshBundle(s, label);
    const mark = marker(label);
    const outcome = await outcomeOf(() =>
      (write as (db: unknown, input: unknown) => unknown)(s.db, {
        ...releaseInput(bundleId, mark),
        vocabulary: [term("someone/a-term")],
      }),
    );
    if (outcome.kind !== "threw") {
      throw new Error(
        `\`addRelease\` accepted a bare term array, so there is no refusal to inspect.\n  ` +
          `${PUBLISHED.storedVocabulary}`,
      );
    }
    return outcome.error;
  }

  it("renders as `{}` and keeps its stack", async () => {
    const error = await refusalError("hygiene1");
    expect(
      Object.keys(error as object),
      `\`Object.keys\` on the refusal is not empty, which is the constructor-assignment trap ` +
        `D-133-01 names: ${PUBLISHED.malformedVocabularyError}`,
    ).toEqual([]);
    expect(
      JSON.stringify(error),
      `\`JSON.stringify\` on the refusal is not exactly "{}" -- an enumerable own property ` +
        `puts the class's own fields into any response body that serialises it.`,
    ).toBe("{}");
    const stack = (error as Error).stack;
    expect(typeof stack, "The refusal has no stack, so nothing can be traced to it.").toBe(
      "string",
    );
    expect((stack ?? "").length, "The refusal's stack is empty.").toBeGreaterThan(0);
  }, 60_000);

  it("carries a `cause`, if it carries one, non-enumerably", async () => {
    const error = await refusalError("hygiene2");
    /* Conditional on purpose: a shape refusal is decided from the caller's own input and
       has no driver error under it, so an absent `cause` is correct here. What is never
       correct is an enumerable one, which is the part `Object.keys` above would already
       have caught and this states in its own right. */
    const own = Object.getOwnPropertyDescriptor(error as object, "cause");
    if (own !== undefined) {
      expect(
        own.enumerable,
        `The refusal's \`cause\` is enumerable, so it renders into anything that ` +
          `serialises the error.`,
      ).toBe(false);
    }
  }, 60_000);

  it("does not carry the vocabulary in a `detail`, a `kind` or any other field", async () => {
    /*
     * The sibling of the leak cells above, aimed at the one place a sanitised message and
     * a leaking error coexist: `ArchiveConflictError` builds a safe `detail` from the
     * caller's own input, so a `MalformedVocabularyError` copying that shape would carry
     * a `detail` naming the value while its `message` stayed clean.
     */
    const s = scratch();
    const write = await addRelease();
    const bundleId = await freshBundle(s, "hygiene3");
    const mark = marker("hygiene3");
    const n = nonce();
    const outcome = await outcomeOf(() =>
      (write as (db: unknown, input: unknown) => unknown)(s.db, {
        ...releaseInput(bundleId, mark),
        vocabulary: { text: vocabularyText(`${n}/a-term`), terms: `  - id: ${n}` },
      }),
    );
    expect(outcome.kind).toBe("threw");
    const error = (outcome as { error: unknown }).error;
    expect(
      renderedFully(error).includes(n),
      `The refusal carries the caller's vocabulary somewhere reachable.\n  ` +
        `${PUBLISHED.noCallerValue}`,
    ).toBe(false);
  }, 60_000);
});
