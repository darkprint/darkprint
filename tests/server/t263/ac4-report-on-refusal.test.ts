/* ============================================================
   T263 AC4 — `REPORT.md` for a bundle that cannot publish.

   ── AC4's "still" is false of the tree, and that was ruled ──
   D-263-10 and D-263-11 together: `REPORT.md` does **not** download
   today for a bundle that cannot publish. The control lives on the
   `submitted` screen and the Publish button is `disabled={blocked}`,
   so such a bundle never reaches the screen the download is on; and
   the upload flow withholds the report unless
   `blueprint && analysis && !hasErrors`, where `hasErrors` is
   `lib/core/diagnostics.ts:220-222`, `ds.some(d => d.severity ===
   "error")` — the plain count.

   A bundle that cannot publish is in exactly one of two states and
   **both carry error-severity diagnostics**: `progress.state ===
   "unfinished"` throws `unfinished(placed, total)`, and otherwise
   `inError(summarize(...).error)`, which is reached only on a
   non-zero count. `unfinished()`'s own docblock says it in terms —
   "an unfinished folder HAS ERRORS, they are all the shadow of a
   card nobody has written yet."

   **So AC4 mandates a behaviour change rather than a
   non-regression**, and the reason it is the right change is
   the report's own error-state rule: the report states outright when
   autonomy and risk were NOT computed rather than omitting the
   headings and letting the omission read as a pass. One consequence
   travels with it — the publish flow says the success screen "hands over
   `REPORT.md` instead", and once publishing is real there is no
   "instead" left.

   ── the new failure mode this criterion is really about ──
   D-263-10: after the cutover a bundle can be locally clean and
   SERVER-refused — `not-owner`, `conflict`, `version-not-higher`,
   or `in-error`/`unfinished` against the stored ontology per
   D-263-01 — and the reader must land somewhere that still hands
   over the report.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { FLOW, fileAt, occurrences, premise, routeFiles } from "./source";

const files = routeFiles();

describe("AC4 — REPORT.md survives a refusal", () => {
  it("the partition is real and still carries what survives", () => {
    premise(files);
  });

  /**
   * GREEN at `32274eb` and recorded as such. This is the non-regression half: the control
   * exists today and the cutover must not drop it while rebuilding the screen it sits on.
   * It is a pin, not a blind-position red, and it is not coverage for the change AC4 asks
   * for — the cell below is.
   */
  it("keeps the download control it has today", () => {
    premise(files);
    const flow = fileAt(files, FLOW);
    expect(
      occurrences(flow.code, /download="REPORT\.md"/),
      "AC4: the REPORT.md download control is gone. It is the one thing a reader whose " +
        "bundle was refused still leaves with.",
    ).toBeGreaterThan(0);
    expect(
      occurrences(flow.code, /reportHref/),
      "AC4: `reportHref` is gone, so nothing builds the report the control offers",
    ).toBeGreaterThan(0);
  });

  /**
   * The change half.
   *
   * **What this proves and what it does not**, stated plainly because a comment that named
   * the hazard while the assertion admitted it would read as coverage to everyone
   * downstream: it proves the refusal surfacing and the report control are in the same
   * file, so a screen built for one can reach the other. It does NOT prove the reader
   * actually lands there — that is a rendered-state property of step 4, and D-263-03
   * established there is no DOM in this repository to drive it with. The adversary pass is
   * where that gap gets closed, against a tree that exists.
   */
  it("puts the refusal surfacing in the same file as the report control", () => {
    premise(files);
    const flow = fileAt(files, FLOW);
    expect(
      occurrences(flow.code, /REPORT\.md/),
      "AC4: the report control is not in the file that handles refusals",
    ).toBeGreaterThan(0);
    /* `/refus/` rather than the literal `in-error`, and that is a repair. The kind union is
       typed once in `publish-client.ts`; the file that OFFERS the report is the one that has
       to know a refusal happened, and it names that state rather than re-spelling the union.
       Asking for the union here demanded a structure the criterion never called for. */
    expect(
      occurrences(flow.code, /refus/i),
      "AC4/D-263-10: nothing in the file holding the REPORT.md control handles a server " +
        "refusal. A bundle that is locally clean and refused by the registry is the new " +
        "failure mode this criterion exists for, and it has nowhere to land.",
    ).toBeGreaterThan(0);
  });
});
