/* ============================================================
   The scoring panel, held against `lib/core/config.ts`.

   PROJECT.md §3.4 asked for the weights to be published, and the
   one way that request can be answered badly is by typing them
   into JSX. Doc 1 §11 put every open threshold in a single file so
   it could be re-tuned after launch, and doc 3 §8 makes moving one
   a PATCH of the ontology version because it re-scores every
   published blueprint. A hand-transcribed table survives that
   re-tune silently and is wrong from the moment it happens, which
   is the exact defect this file exists to make impossible.

   So the interesting case is not that today's markup contains
   today's numbers. It is `renders under numbers that are not the
   shipped ones`: the panel is asked for a config with different
   weights, different cuts and different filters, and every one of
   them has to appear. A component with the values typed in passes
   the first case and fails that one.

   The second job here is doc 2 §1.1. This is the one page on the
   site that prints the autonomy arithmetic, so it is the place an
   ordinal is most likely to arrive: `AUTONOMY_LABELS` is keyed by
   the band number and printing the key beside the label would look
   like a helpful clarification. `openText` reads the panel the way
   a reader who opens nothing does.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DARKPRINT_CONFIG } from "@/lib/core";
import type { DarkprintConfig } from "@/lib/core";
import { getOntologyView } from "@/lib/content";
import { openText, plainText } from "@/components/ui/visible-text";
import { ScoringModel } from "./ScoringModel";

/**
 * Every risk marker in this archive's vocabulary that declares its own weight.
 *
 * Read here the way the panel reads it, off `lib/content` rather than off a copy: a list
 * typed into this file would go on asserting a term the archive had dropped.
 */
const LOCAL_WEIGHTED = getOntologyView()
  .byKind("risk-marker")
  .filter((term) => term.defaultWeight !== undefined && term.defaultWeight >= 0);

/**
 * Everything a config can charge for: its own weights plus every locally priced marker it
 * does not already name. That precedence is `weightOf`'s, and it is what the panel sums.
 */
function priceable(config: DarkprintConfig): number {
  const priced = new Set(Object.keys(config.security.weights));
  return (
    Object.values(config.security.weights).reduce((sum, value) => sum + value, 0) +
    LOCAL_WEIGHTED.filter((term) => !priced.has(term.id)).reduce(
      (sum, term) => sum + (term.defaultWeight ?? 0),
      0,
    )
  );
}

function render(config?: DarkprintConfig): string {
  return renderToStaticMarkup(createElement(ScoringModel, { config }));
}

const SHIPPED = render();
const OPEN = openText(SHIPPED);
const ALL = plainText(SHIPPED);

/**
 * A calibration that is not the shipped one, in every field the panel reads.
 *
 * Every number differs from `DARKPRINT_CONFIG` and none is a substring of the value it
 * replaces, so a stale literal cannot pass by coincidence. `criteria-leak` keeps a
 * distinct weight from the rest for the sentence in the leak panel, and
 * `similarityFiresMarker` is flipped, which is the one place the panel branches on a
 * value instead of printing it.
 */
const OTHER: DarkprintConfig = {
  ...DARKPRINT_CONFIG,
  autonomy: { level4: 0.88, level3: 0.66, level2: 0.44, minControlPoints: 4 },
  security: {
    weights: {
      "arbitrary-code-execution": 3.7,
      "criteria-leak": 2.6,
      "secret-access": 0.3,
    },
    unknownMarkerWeight: 0.2,
  },
  criteriaLeak: { similarityThreshold: 0.62, similarityFiresMarker: true },
  telemetry: { minRuns: 41, outlierZScore: 7 },
};

describe("the weights table", () => {
  it("names every marker the engine weighs, with its amount", () => {
    const entries = Object.entries(DARKPRINT_CONFIG.security.weights);
    // A table built from an empty map would pass every case under this one.
    expect(entries.length).toBe(7);
    for (const [id, value] of entries) {
      expect(OPEN, `${id} is not on the page`).toContain(id);
      expect(OPEN, `${id} does not print ${value.toFixed(1)}`).toMatch(
        new RegExp(`${id}[^0-9]*${value.toFixed(1).replace(".", "\\.")}`),
      );
    }
  });

  it("publishes the one this site was missing", () => {
    // The finding that opened PROJECT.md §3.4: the heaviest weight in the engine, and
    // the string appeared on no page describing the spec.
    expect(OPEN).toContain("arbitrary-code-execution");
    expect(OPEN).toMatch(/arbitrary-code-execution[^0-9]*2\.0/);
  });

  it("says an unrecognised marker is shown and weighs nothing", () => {
    expect(DARKPRINT_CONFIG.security.unknownMarkerWeight).toBe(0);
    expect(OPEN).toContain("any other marker");
    expect(OPEN.toLowerCase()).toContain("an unrecognised marker weighs 0.0");
    // Shown, and shown as weightless. Half of that claim is the point of the other half:
    // a marker the engine cannot price is still the author's declaration about the node.
    expect(OPEN).toContain("listed on the card and on the node page");
    expect(OPEN).toContain("never charged quietly");
  });

  /**
   * Doc 3 §7's middle rung, which the first version of this panel omitted.
   *
   * `weightOf` in `lib/core/analysis/security.ts` resolves config, then the term's own
   * `defaultWeight`, then `unknownMarkerWeight`. The panel published the first and the
   * third, so `/blueprints/frontline-triage` charged `0.50 (lupo/pii-handling)` under a
   * link to a page whose table could not account for it. Read off the archive rather than
   * naming the term, so this stays a rule about the vocabulary and not about one entry
   * in it.
   */
  it("publishes the markers this archive's vocabulary prices itself", () => {
    const priced = new Set(Object.keys(DARKPRINT_CONFIG.security.weights));
    const local = LOCAL_WEIGHTED.filter((term) => !priced.has(term.id));
    // A vocabulary with no locally priced marker would leave this case checking nothing.
    expect(local.length).toBeGreaterThan(0);
    for (const term of local) {
      expect(OPEN, `${term.id} is not on the page`).toContain(term.id);
      expect(OPEN, `${term.id} does not print its own weight`).toMatch(
        new RegExp(`${term.id}[^0-9]*${(term.defaultWeight ?? 0).toFixed(1).replace(".", "\\.")}`),
      );
    }
    // And that the amount comes from somewhere other than the configuration, which is
    // the whole of what was missing.
    expect(OPEN).toContain("from the vocabulary");
    expect(OPEN).toContain("the marker's own declared weight");
  });

  it("states the ceiling, the floor and the fact that the sum overshoots both", () => {
    // The inference a reader makes without this: four points of headroom means at most
    // four points of markers. Everything the table prices, from both sources, adds to
    // more than twice it.
    expect(OPEN).toContain(`add to ${priceable(DARKPRINT_CONFIG).toFixed(1)} against a ceiling of 4`);
    expect(priceable(DARKPRINT_CONFIG)).toBeGreaterThan(4);
    expect(OPEN).toContain("held between 1 and 4");
  });
});

describe("the autonomy cuts", () => {
  it("shows each cut with the class it is called", () => {
    const { level4, level3, level2 } = DARKPRINT_CONFIG.autonomy;
    expect(OPEN).toContain(`fraction > ${level4.toFixed(2)}`);
    expect(OPEN).toContain(`fraction ≥ ${level3.toFixed(2)}`);
    expect(OPEN).toContain(`fraction ≥ ${level2.toFixed(2)}`);
    expect(OPEN).toContain(`under ${level2.toFixed(2)}`);
    for (const label of ["Closed-loop", "Conditional", "Supervised", "Assisted"]) {
      expect(OPEN, `${label} is not on the page`).toContain(label);
    }
  });

  /**
   * Doc 2 §1.1. The page is allowed the arithmetic behind the class and is not allowed
   * the ordinal that sits between the two, because that ordinal collides with the 1-to-5
   * organisational ladder the site teaches elsewhere.
   */
  it("prints no band ordinal anywhere in the panel", () => {
    // `ALL` rather than `OPEN`: a disclosure is still the page saying it.
    const text = ALL.toLowerCase();
    for (const phrase of [
      "level 1",
      "level 2",
      "level 3",
      "level 4",
      "out of 4",
      "out of four",
      "autonomy level",
    ]) {
      expect(text, `the panel prints "${phrase}"`).not.toContain(phrase);
    }
    // The four names carry no ranking either.
    for (const phrase of ["fully autonomous", "more autonomous", "falls short"]) {
      expect(text, `the panel prints "${phrase}"`).not.toContain(phrase);
    }
  });
});

describe("the criteria-leak threshold", () => {
  it("gives the threshold and says similarity alone does not fire the marker", () => {
    expect(DARKPRINT_CONFIG.criteriaLeak.similarityFiresMarker).toBe(false);
    expect(OPEN).toContain("3-gram word shingles");
    expect(OPEN).toContain(
      DARKPRINT_CONFIG.criteriaLeak.similarityThreshold.toFixed(2),
    );
    expect(OPEN).toContain("reported and subtracts nothing");
    expect(OPEN).toContain("similarityFiresMarker: false");
  });
});

/**
 * The honesty half. `components/site/honesty.test.ts` holds the sentence itself in its
 * ledger; what is asserted here is the shape around it, so the two filters can never be
 * published without the fact that DarkPrint verifies nothing about what a report claims
 * (T280 wired `submitReport`/`reportedCost` behind these two numbers; the pinned sentence
 * survives because "describes a design rather than a behaviour it can confirm for itself"
 * is still true of an unverified self-report — see the panel's own comment).
 */
describe("the telemetry design, and what DarkPrint still cannot verify", () => {
  it("gives both filters", () => {
    expect(OPEN).toContain(`minRuns ${DARKPRINT_CONFIG.telemetry.minRuns}`);
    expect(OPEN).toContain(
      `outlierZScore ${DARKPRINT_CONFIG.telemetry.outlierZScore}`,
    );
  });

  it("says in the open that nothing measures a run", () => {
    expect(OPEN.toLowerCase()).toContain(
      "nothing on this site measures a run. these two filters describe a design",
    );
    expect(OPEN).toContain("never verified");
  });
});

describe("renders under numbers that are not the shipped ones", () => {
  const other = openText(render(OTHER));

  it("prints the weights it was handed", () => {
    for (const [id, value] of Object.entries(OTHER.security.weights)) {
      expect(other, `${id} did not follow the config`).toMatch(
        new RegExp(`${id}[^0-9]*${value.toFixed(1).replace(".", "\\.")}`),
      );
    }
    // 6.6 of configured weight plus whatever the archive's vocabulary prices that this
    // calibration is silent about, which is the middle rung following the config it was
    // handed rather than the shipped one.
    expect(other).toContain(`add to ${priceable(OTHER).toFixed(1)} against a ceiling of 4`);
    expect(priceable(OTHER)).toBeGreaterThan(6.6);
    expect(other).toContain("weighs 0.2");
    // The shipped values are gone, which is what a typed table could not manage.
    expect(other).not.toContain("unbounded-loop");
    expect(other).not.toMatch(/arbitrary-code-execution[^0-9]*2\.0/);
  });

  it("prints the cuts it was handed", () => {
    expect(other).toContain("fraction > 0.88");
    expect(other).toContain("fraction ≥ 0.66");
    expect(other).toContain("under 0.44");
    expect(other).not.toContain("0.90");
    expect(other).not.toContain("0.70");
  });

  it("follows the threshold and the flag it was handed", () => {
    expect(other).toContain("0.62");
    expect(other).toContain("similarityFiresMarker: true");
    // The flag is the one value the panel reasons about instead of printing, so the
    // sentence has to change with it or the page states the opposite of the config.
    expect(other).toContain("fires the marker on its own");
    expect(other).not.toContain("reported and subtracts nothing");
  });

  it("prints the filters it was handed", () => {
    expect(other).toContain("minRuns 41");
    expect(other).toContain("outlierZScore 7");
    // The limit statement is not conditional on any of them.
    expect(other.toLowerCase()).toContain("nothing on this site measures a run");
  });
});

describe("where the depth went", () => {
  /**
   * PROJECT.md §3.1 licences moving reference depth behind `components/ui/More.tsx`, and
   * the calibration story is exactly that: a reader who wants the weights is served by
   * the table, and a reader who wants to know why they are provisional opens one thing.
   */
  it("keeps the calibration note behind a disclosure and the limit in front of it", () => {
    expect(ALL).toContain("valori di partenza da tarare");
    expect(OPEN).not.toContain("valori di partenza da tarare");
    expect(OPEN.toLowerCase()).toContain("nothing on this site measures a run");
  });
});
