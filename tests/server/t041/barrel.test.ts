/* ============================================================
   T041 — the refusal reaches the published entry point

   `divergence.test.ts` and `coerced-nan.test.ts` drive
   `measureSubmission`, which is where §T041 measures. This file
   asks the one thing that cannot: does the amendment change what
   `validateBundle` does, or only what an internal helper does?

   **One cell per direction, and no more.** The barrel is not
   where this defect lives — it is barrel-only in the other
   sense, reachable through `@/lib/server/engine` and not through
   a route, because `JSON.parse` produces neither a `Proxy` nor a
   BigInt. T100, T263 and T270 consume this barrel in-process,
   which is the standing D-40-E, D-40-G, D-40-H and D-40-I were
   all charged under.

   The fixtures come from `tests/server/t040/fixtures.ts`, which
   is merged and belongs to no task this round. A submission this
   suite assembles by hand would be a second reading of what an
   `EngineInput` is, and a second reading is what D-40-E charged.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { validateBundle } from "@/lib/server/engine";
import { EIGHT_NODE_BUNDLE, caseFor, manifestCarrying } from "../t040/fixtures";
import { formula, outcomeOf, trappedArray } from "./fixtures";

/** Generous, because this file is about which outcome arrives and not about a bound. The archive's
    largest submission is 17 947 bytes, so 50 KiB clears every bundle by more than double. */
const GENEROUS = { maxBytes: 50 * 1024, maxCards: 500, maxNodes: 500 };

function through(planted: unknown): string {
  const submission = manifestCarrying(caseFor(EIGHT_NODE_BUNDLE).input, planted);
  return outcomeOf(() => {
    validateBundle(submission, GENEROUS);
    return 0;
  });
}

describe("T041 through the published entry point", () => {
  it("refuses a bundle whose manifest carries a BigInt-lengthed array-like", () => {
    /* The premise the fixture has to satisfy before the outcome means anything: this submission
       is one the ruled formula itself refuses, and it is under the bound in every other respect,
       so a refusal is the coercion's and not the size guard's. */
    expect(
      outcomeOf(() =>
        formula(manifestCarrying(caseFor(EIGHT_NODE_BUNDLE).input, trappedArray(BigInt(3)))),
      ),
      "the ruled formula must refuse this submission, or this cell measures the fixture",
    ).toBe("threw TypeError");

    expect(
      through(trappedArray(BigInt(3))),
      "`ToNumber` refuses a BigInt, so `validateBundle` must not return a result for a " +
        "submission the ruled number cannot measure at all",
    ).toBe("threw TypeError");
  });

  it("still answers for the same array-like with a Number length", () => {
    /* The control, and it is the one that says the entry point did not simply start refusing
       proxied arrays. Same fixture, same position, a length whose ToPrimitive is a Number. */
    expect(through(trappedArray(2))).toBe("answered 0");
  });
});
