import { describe, expect, it } from "vitest";

import { AUTONOMY_LABELS, HUMAN_PRESENCE_MARK, NODE_KIND_META, autonomyStatement } from "./format";
import { readContent } from "./content/read";

/* ============================================================
   Doc 2 §1.1, enforced on the engine's own sentence.
   ------------------------------------------------------------
   `AutonomyResult.rationale` ends in the threshold rule that
   produced the band — "… — 1.00 > 0.90 → level 4 (Closed-loop)." —
   because doc 1 §8.3 asks the metric to print arithmetic a reader
   can check. `lib/core` is right to keep that ordinal: the bands
   are arithmetic and an ordinal is what sorts.

   No user-facing surface may print it. It collides with the 1-to-5
   organisational maturity ladder `SectionLevels` teaches, which is
   a different scale about a different subject, and a reader meeting
   a small integer twice has no way to tell them apart.

   `autonomyStatement` is the seam between those two facts, so the
   tests below hold it to both halves: the ordinal is gone, and
   nothing else is.
   ============================================================ */

/** The archive, so the transform is exercised on real engine output and not on fixtures. */
const loaded = readContent();

describe("autonomyStatement", () => {
  it("drops the band ordinal and keeps the class", () => {
    expect(
      autonomyStatement(
        "5 of 5 nodes run unattended, none have a person in the loop — 1.00 > 0.90 → level 4 (Closed-loop).",
      ),
    ).toBe(
      "5 of 5 nodes run unattended, none have a person in the loop — 1.00 > 0.90 → Closed-loop.",
    );
  });

  it("keeps the counts, the fraction and the threshold it is compared against", () => {
    const out = autonomyStatement(
      "6 of 7 nodes run unattended, 1 has a person in the loop — 0.8571 ≥ 0.70 → level 3 (Conditional).",
    );
    expect(out).toContain("6 of 7 nodes run unattended");
    expect(out).toContain("1 has a person in the loop");
    expect(out).toContain("0.8571 ≥ 0.70");
    expect(out).toContain("Conditional");
  });

  it("leaves a sentence that carries no ordinal untouched", () => {
    const plain = "Nothing to score — the fraction defaults to 0.00 < 0.40.";
    expect(autonomyStatement(plain)).toBe(plain);
  });

  /**
   * The drift guard, and the reason this test reads the archive.
   *
   * `lib/core` owns the wording and may reword it. What it may not do is leave a band
   * ordinal standing in a string the app prints verbatim — so if the sentence changes
   * shape and the transform stops matching, this fails here rather than three commits
   * later in a prerendered page.
   */
  it("removes the ordinal from every published blueprint's rationale", () => {
    expect(loaded.length).toBeGreaterThan(0);
    for (const entry of loaded) {
      const slug = entry.blueprint.manifest.slug;
      const raw = entry.analysis.autonomy.rationale;

      // The engine still shows its working, which is what makes the transform necessary.
      expect([slug, /level\s*\d/.test(raw)]).toEqual([slug, true]);

      const shown = autonomyStatement(raw);
      expect([slug, /level\s*\d/.test(shown)]).toEqual([slug, false]);
      // The class survives in the ordinal's place, so nothing was lost but the number.
      expect([slug, shown.includes(entry.analysis.autonomy.label)]).toEqual([slug, true]);
    }
  });
});

describe("HUMAN_PRESENCE_MARK", () => {
  /**
   * Doc 2 §1.1, on the other half of the autonomy interface.
   *
   * The rule was written down twice in the repo and broken on four surfaces anyway: the
   * gallery tile, the blueprint header, the node library tile, an author's shelf and an
   * ontology term page all painted "a person acts here" in `--color-signal`, the colour
   * the site spends on the criteria-leak marker, the error count and the top penalty
   * tier. A graph with nobody in it got a neutral token and a graph with somebody in it
   * got an alarm: the pass/fail pair the principle rules out. One constant now carries
   * the answer and this is the assertion behind it.
   */
  it("is never the alarm colour the site spends on defects", () => {
    expect(HUMAN_PRESENCE_MARK.className).not.toBe("text-signal");
    expect(HUMAN_PRESENCE_MARK.color).not.toBe("var(--color-signal)");
    expect(HUMAN_PRESENCE_MARK.color).toContain("violet");
    expect(HUMAN_PRESENCE_MARK.className).toContain("violet");
  });

  /**
   * The schematic is the deliberate exception and is not drifting with the indicator.
   *
   * `NODE_KIND_META` colours a *drawing* by what each node is, and a human gate there is
   * signal pink. The explainability panel names the distinction where it matters. This
   * pins the two apart so that "make them consistent" cannot be resolved in the wrong
   * direction by accident.
   */
  it("is not the schematic's gate colour, and the glyph is shared", () => {
    expect(NODE_KIND_META.gate.color).not.toBe(HUMAN_PRESENCE_MARK.color);
    expect(NODE_KIND_META.gate.glyph).toBe(HUMAN_PRESENCE_MARK.glyph);
  });
});

describe("AUTONOMY_LABELS", () => {
  /**
   * The table is deliberately duplicated from `lib/core/analysis/autonomy.ts`, which
   * stays free of app-side imports. `autonomy.test.ts` guards the pair from the engine's
   * side; this guards it from the one surface that still looks a label up by band.
   */
  it("names every band the engine can return", () => {
    for (const entry of loaded) {
      const { level, label } = entry.analysis.autonomy;
      expect([entry.blueprint.manifest.slug, AUTONOMY_LABELS[level]]).toEqual([
        entry.blueprint.manifest.slug,
        label,
      ]);
    }
  });
});
