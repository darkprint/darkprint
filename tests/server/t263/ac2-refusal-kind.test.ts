/* ============================================================
   T263 AC2 — an unfinished bundle is refused with the unfinished
   wording, not an error count.

   The section: this is "T100's `PublishRefusedError.kind`
   surfacing — the reason that error carries a `kind` rather than a
   message". D-263-07 ratified recovering it from the problem `type`
   suffix, since `kind` does not travel as a body field.

   ── the discriminating fact, and it is about STATUS ──
   `app/api/bundles/route.ts`'s `STATUSES` map sends `unfinished`,
   `in-error` AND `version-not-higher` all as **422**. So a route
   that branches on the HTTP status alone CANNOT tell the unfinished
   folder from the one in error, and would render an error count
   over a bundle whose errors are, in `unfinished()`'s own words,
   "all the shadow of a card nobody has written yet". That is the
   reading doc 2 §1.1 and `progress.ts` exist to prevent, and it is
   the failure AC2 names.

   ── what this file does NOT assert, and why ──
   Not the spelling of the recovery. `type.split("/").pop()` then a
   switch on `"in-error"`, and a match on the whole
   `https://darkprint.io/problems/publish-in-error`, are both
   correct; a cell pinning either would red the other. So the
   assertion is on the KIND names any correct branch must contain,
   which is the criterion, rather than on how they were obtained.
   `in-error` measures 0 on the comment-stripped partition at
   `32274eb`, so this reds in the blind position.

   ── scoped to the PARTITION, not to `UploadFlow.tsx`, and that is a
   repair ──
   These cells first asked `UploadFlow.tsx` for the literal. The
   implementation types the closed union once in
   `components/upload/publish-client.ts` and has `refusalSentence`
   switch on the `kind` VALUE, which is one author for the union and
   is better than what the cell demanded. Asking the folder instead
   of the file keeps the criterion and drops the structural guess.
   The mutation table was re-run after this repair, not only after
   the cell was written: `in-error` still measures 0 across the
   whole partition at `32274eb`, so the widening cost no
   discrimination.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { occurrences, premise, publishBodyText, routeFiles } from "./source";

const files = routeFiles();

describe("AC2 — unfinished is distinguished from in-error", () => {
  it("the partition is real and still carries what survives", () => {
    premise(files);
  });

  it("names the in-error kind, which no status branch could recover", () => {
    premise(files);
    const code = files.map((f) => f.code).join("\n");
    expect(
      occurrences(code, /in-error/),
      "AC2: nothing in the route names the `in-error` kind. `unfinished`, `in-error` and " +
        "`version-not-higher` are all 422 in `app/api/bundles/route.ts`, so a branch on the " +
        "status cannot separate them and the unfinished folder gets an error count.",
    ).toBeGreaterThan(0);
  });

  /**
   * Both branches, asserted together. `unfinished` alone proves nothing here — it is
   * `progress.ts`'s own state name and measures 17 across the partition before any cutover
   * work — so it is the PREMISE for reading `in-error`'s presence as a second branch rather
   * than a criterion of its own.
   */
  it("keeps the unfinished branch it already had beside the new one", () => {
    premise(files);
    /* Scoped to the file that names `/api/bundles`, and that is a repair the post-merge
       mutation table forced. Partition-wide, `unfinished` occurs in `progress.ts` and
       `ValidationReport.tsx` no matter what the publish path does, so the clause was
       satisfied by copy that has nothing to do with a refusal and deleting the branch
       reddened 0 of 44. Both sides of the distinction have to be named where the refusal is
       actually decoded. */
    const code = publishBodyText(files);
    expect(
      occurrences(code, /unfinished/),
      "AC2: the refusal path never names `unfinished`; the distinction has one side left",
    ).toBeGreaterThan(0);
    expect(
      occurrences(code, /in-error/),
      "AC2: the refusal path names `unfinished` but nothing renders the in-error side",
    ).toBeGreaterThan(0);
  });
});
