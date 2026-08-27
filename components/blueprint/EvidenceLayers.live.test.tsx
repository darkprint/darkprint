/* ============================================================
   T280 — EvidenceLayers' additive `live` prop.

   `EvidenceLayers.test.tsx` is frozen (D-260-04/D-261-07(8), pinned by
   `tests/server/t261/frozen-tests.test.ts`) and holds the no-prop legacy rendering byte
   for byte, so its cells stay exactly as they were and every new cell for the live
   sufficiency panels lands here instead, beside it rather than inside it.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { plainText } from "@/components/ui/visible-text";
import { EvidenceLayers, type EvidenceLive } from "./EvidenceLayers";

const blueprint = allBlueprints()[0];
if (blueprint === undefined) throw new Error("the fixture archive is empty");

function render(live?: EvidenceLive): string {
  return plainText(renderToStaticMarkup(createElement(EvidenceLayers, { blueprint, live })));
}

const MIN_SAMPLE = 5;

describe("EvidenceLayers — live sufficiency (T280, additive)", () => {
  it("without `live`, renders the exact legacy absence panels", () => {
    // The frozen test already pins this component's no-prop bytes; this cell is the one
    // that ties THAT guarantee to the new prop existing at all — a `live?` that quietly
    // changed the no-prop default would red here without touching the frozen file.
    const text = render(undefined);
    // Both exact phrases exist ONLY on the legacy path (`sampleBadge` never returns
    // either), so their presence is sufficient evidence the no-prop branch rendered —
    // no companion `not.toContain` needed, and `"sufficient sample"` would be a trap for
    // one anyway: it is a literal substring of `"insufficient sample"` above.
    expect(text).toContain("insufficient sample");
    expect(text).toContain("no verified runs");
    expect(text).not.toContain("zero sample");
  });

  it("zero sample: both panels state the honest absence, not the old vaporware claim", () => {
    const text = render({ sampleSize: 0, minSample: MIN_SAMPLE, runs: 0 });
    expect(text).toContain("No ballots yet.");
    expect(text).toContain("No runs yet.");
    // The old panels claimed no backend exists at all ("no eligible, production-defined
    // ballot", "does not run this blueprint"); T280 wires the backend, so neither
    // absence-of-feature sentence may survive once `live` is passed.
    expect(text).not.toContain("No eligible, production-defined ballot");
    expect(text).not.toContain("DarkPrint does not run this blueprint and has no");
    // D-180-01 still binds regardless of sample state.
    expect(text).toContain("D-180-01");
  });

  it("small sample: below minSample reads as a sample, not a comparable figure", () => {
    const text = render({ sampleSize: 2, minSample: MIN_SAMPLE, runs: 3 });
    expect(text).toContain("2 ballots — a small sample so far");
    expect(text).toContain("3 runs — a small sample so far");
    expect(text).toContain(`against the ${MIN_SAMPLE} this build treats as comparable`);
  });

  it("comparable sample: at or above minSample carries no small-sample hedge", () => {
    const text = render({ sampleSize: MIN_SAMPLE, minSample: MIN_SAMPLE, runs: 11 });
    expect(text).toContain(`${MIN_SAMPLE} ballots, against the ${MIN_SAMPLE} this build`);
    expect(text).toContain(`11 runs, against the ${MIN_SAMPLE} this build`);
    expect(text).not.toContain("small sample so far");
  });

  it("singular counts do not pluralize", () => {
    const text = render({ sampleSize: 1, minSample: MIN_SAMPLE, runs: 1 });
    expect(text).toContain("1 ballot —");
    expect(text).toContain("1 run —");
    expect(text).not.toContain("1 ballots");
    expect(text).not.toContain("1 runs");
  });

  it("keeps the structural panel and the closing link untouched by the prop", () => {
    const withLive = render({ sampleSize: 7, minSample: MIN_SAMPLE, runs: 0 });
    const without = render(undefined);
    expect(withLive).toContain("Structural evidence");
    expect(withLive).toContain("not a security audit");
    for (const text of [withLive, without]) {
      expect(text).toContain("How DarkPrint analyzes a blueprint");
    }
  });
});
