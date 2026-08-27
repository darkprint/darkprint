/* ============================================================
   T133 AC1, the converse — the published shape is written, and
   what was written is what comes back

   ── why this file exists at all ──
   A guard that refuses every vocabulary satisfies all twelve
   refusals in `write-refuses.test.ts` and is caught only here. The
   refusal corpus alone cannot tell a correct implementation from
   `throw new MalformedVocabularyError()` at the top of `addRelease`,
   and the second is a worse regression than the defect it replaces:
   it takes the archive offline for every publisher instead of for
   the ones with a bad overlay.

   ── the ruling these cells encode ──
   D-133-03, on `text: ""` and on extra keys: *where the readers
   already decide, the writer adds no rule. A writer stricter than
   its readers is a third reading of this column* -- which is the
   defect T133 exists to end, reintroduced at the write. Two of the
   seven members below are exactly that case.

   ── the oracle ──
   Nothing here decides what a vocabulary means. Each cell asks
   `parseOntologyTerms` -- the merged shared parser both readers
   consume and the one D-133-03 makes the write call -- what the
   stored value reads as, and requires that to equal what it reads
   off the value the caller handed over. A round trip that changed
   the terms would pass a `toEqual` against a fixture this file
   wrote; it cannot pass an equality between two readings by a parser
   this file did not write.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addRelease,
  freshBundle,
  marker,
  nonce,
  openScratch,
  outcomeOf,
  PUBLISHED,
  readsAs,
  releaseCount,
  releaseInput,
  storedColumn,
  type Scratch,
} from "./contract";
import { ACCEPTED } from "./corpus";

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
        `${String(setupFailure)}`,
    );
  }
  return opened;
}

describe("AC1's converse — every value the published shape admits is written", () => {
  for (const shape of ACCEPTED) {
    it(`accepts ${shape.name}, stores it unaltered, and reads back the same terms`, async () => {
      const s = scratch();
      const write = await addRelease();
      const bundleId = await freshBundle(s, "accept");
      const mark = marker("accept");
      const n = nonce();
      const value = shape.value(n);

      const outcome = await outcomeOf(() =>
        (write as (db: unknown, input: unknown) => unknown)(s.db, {
          ...releaseInput(bundleId, mark),
          vocabulary: value,
        }),
      );

      if (outcome.kind === "threw") {
        throw new Error(
          `\`addRelease\` refused ${shape.name}, which the published shape admits.\n  ` +
            `${shape.clause}\n  ${PUBLISHED.storedVocabulary}\n  ` +
            `it threw: ${String((outcome as { error: unknown }).error)}`,
        );
      }

      expect(
        await releaseCount(s, bundleId),
        `\`addRelease\` returned for ${shape.name} and wrote no row.`,
      ).toBe(1);

      /* Verbatim, not merely readable. T010's merged AC round-trips this column, and
         D-133-03's principle forbids the writer normalising what the readers accept --
         a writer that rewrote the value would be the third reading again, arriving as a
         repair instead of as a refusal. */
      expect(
        await storedColumn(s, bundleId),
        `The column does not hold what was handed to \`addRelease\` for ${shape.name}.\n  ` +
          `${PUBLISHED.writerNotStricter}`,
      ).toEqual(value);

      /* And the oracle: the merged shared parser reads the stored value as exactly what it
         reads off the caller's own. Neither side of this equality was written here. */
      const fromInput = readsAs(value);
      const fromStore = readsAs(await storedColumn(s, bundleId));
      expect(
        fromInput.kind,
        `This fixture is not readable by \`parseOntologyTerms\`, so it does not belong in the ` +
          `accepted corpus: ${String((fromInput as { error?: unknown }).error)}`,
      ).toBe("returned");
      expect(
        fromStore.kind,
        `The stored value is not readable by the parser both readers consume, so ${shape.name} ` +
          `was accepted at the write and would be refused at the read -- which is the ` +
          `disagreement this task exists to end.`,
      ).toBe("returned");
      expect(
        (fromStore as { value: unknown }).value,
        `The terms the parser reads off the store differ from the terms it reads off what the ` +
          `caller wrote for ${shape.name}.`,
      ).toEqual((fromInput as { value: unknown }).value);
    }, 60_000);
  }
});

describe("AC1's converse — a release that declares no vocabulary at all", () => {
  /*
   * The field omitted entirely, which is a different input from `null` and is the one every
   * bundle in `content/` without an `ontology/extensions.yaml` takes. T010 ships
   * `localVocabulary: input.vocabulary ?? null`, so a shape guard that runs before the
   * `??` and refuses `undefined` takes the whole archive offline while passing every other
   * cell in this suite.
   */
  it("accepts an absent `vocabulary` and stores `null`", async () => {
    const s = scratch();
    const write = await addRelease();
    const bundleId = await freshBundle(s, "absent");
    const mark = marker("absent");

    const outcome = await outcomeOf(() =>
      (write as (db: unknown, input: unknown) => unknown)(s.db, releaseInput(bundleId, mark)),
    );
    if (outcome.kind === "threw") {
      throw new Error(
        `\`addRelease\` refused a release that declares no vocabulary.\n  ` +
          `\`vocabulary?\` is optional in T010's published input and most releases have none.\n` +
          `  it threw: ${String((outcome as { error: unknown }).error)}`,
      );
    }
    expect(await releaseCount(s, bundleId)).toBe(1);
    expect(
      await storedColumn(s, bundleId),
      "An absent `vocabulary` must reach the column as SQL null.",
    ).toBeNull();
  }, 60_000);
});
