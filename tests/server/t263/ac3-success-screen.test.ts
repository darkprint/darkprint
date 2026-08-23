/* ============================================================
   T263 AC3 — the success screen states what was stored.

   ── the criterion was rewritten, and this file is the reason ──
   AC3 as shipped read: "the success screen states what was stored,
   and `honesty.test.ts` pins the new sentence." **Its premise was
   false.** `components/site/honesty.test.ts` imports `UploadPage`
   alone, never `UploadFlow`, and builds one surface with
   `renderToStaticMarkup` at `step === 1, submitted === false`, so
   the success screen has never been in that HTML and the sentence
   it was said to pin verbatim was pinned nowhere.

   D-263-03 then ruled the mechanism rather than leaving it to be
   invented: `vitest.config.ts` sets `environment: "node"`, there is
   no jsdom and no testing-library, and the success screen is step 4
   of a stateful client component reached by `setSubmitted(true)` —
   **a static render cannot reach it**, and `honesty.test.ts:139-140`
   refuses lifting the sentence out "for a test's convenience".
   **AC3 is therefore a SOURCE-LEVEL assertion over
   `components/upload/UploadFlow.tsx`, in T262-AC6's own idiom, and
   the verbatim-pin wording is withdrawn.**

   ── what that costs, stated rather than papered over ──
   A source assertion cannot prove the sentence REACHES a reader; it
   proves the file no longer contains the old claim and does contain
   the new one. The surface-level half of this cutover is asserted
   where it CAN be — over the server-rendered page, in
   `ac5-retired-copy.test.ts`. Step 4 has no equivalent, and no cell
   here pretends otherwise.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { FLOW, fileAt, occurrences, premise, routeFiles } from "./source";

const files = routeFiles();

describe("AC3 — the success screen states what was stored", () => {
  it("the partition is real and still carries what survives", () => {
    premise(files);
  });

  it("no longer claims nothing was sent", () => {
    premise(files);
    const flow = fileAt(files, FLOW);
    /* 5 on the comment-stripped file at `32274eb`, so this reds in the blind position and
       can only go green by the copy changing. Asserted here under AC3's own name as well as
       under AC5's, because the two criteria fail for different reasons and a single red
       reported against one of them would send a reader to the wrong contract line. */
    expect(
      occurrences(flow.code, /nothing (was|is) (sent|saved|stored|uploaded)/i),
      "AC3: the success screen still says nothing was sent. Publishing is real now, so " +
        "the claim is a lie about the product rather than a limit statement (D-78).",
    ).toBe(0);
  });

  /**
   * The positive half. `ownerHandle` is the discriminating token: it measures 0 across the
   * comment-stripped partition at `32274eb`, and D-263-07 ruled AC1 satisfied by what the
   * page renders FROM WHAT IT SUBMITTED — the owner handle is one of the three the response
   * does not carry, so a screen naming it can only be naming its own submission.
   *
   * `digest` is deliberately NOT asserted here: it already measures 5 in `UploadFlow.tsx`,
   * because the wizard computes a bundle digest for `REPORT.md`. A cell asserting it would
   * be green on the shipped tree and green after, and would have read as coverage for the
   * one field that genuinely does come back.
   */
  it("names what was stored, from what it submitted", () => {
    premise(files);
    const flow = fileAt(files, FLOW);
    expect(
      occurrences(flow.code, /\bownerHandle\b/),
      "AC3/D-263-07: the success screen names nothing the caller submitted. `PublishResult` " +
        "carries `{ bundleId, releaseId, digest, created }` — no owner and no slug — so the " +
        "screen has to render the owner and slug it sent.",
    ).toBeGreaterThan(0);
  });
});
