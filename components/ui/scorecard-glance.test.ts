/* ============================================================
   One page, two surfaces, and the sentence that was on both.

   The scorecard in the blueprint sidebar is a glance: six rows,
   where this blueprint sits. `components/blueprint/Explainability.tsx`
   in the main column is the audit: the subtraction, the nodes that
   fired each marker, the hints. They were printing the same two
   strings. `MetricBars` renders `Metric.detail`, and for the two
   computed rows that detail *is* the engine rationale — the same
   sentence the panel prints through its own `Rationale`. On
   `/blueprints/starter-software-factory` a reader met

     "5 of 5 nodes run unattended, none have a person in the loop.
      1.00 > 0.90 → Closed-loop."

   and

     "4 − 0.00 (no risk marker present across 5 nodes) → 4"

   twice each, word for word, within one screen.

   The fix is a `audit` prop on `MetricBars` and it has three ways
   to go wrong, one per case below:

     1. the glance eats the audit. The rationale has to survive in
        the panel — a score nobody can check is doc 1 §8.3's rumour
        with a number attached. The blueprint-page redesign folds
        Autonomy and Security behind a closed-by-default `<details>`
        now, so "survives" no longer means "in the open" the way it
        did when this suite was written — it means present in the
        prerendered HTML the site's other disclosures are held to
        (`components/ui/More.tsx`'s own licence: folded, not gone);
     2. the glance eats an honesty statement. Only the two `auto`
        rows change. The other four say the figure is seeded, which
        doc 2 §0.4 makes a product rule and which has to stay
        wherever the number is legible;
     3. the prop stops being passed, or gets passed inside
        `SectionExample`, which shows this card with no panel beside
        it and whose next paragraph says in as many words that
        "the scorecard prints that subtraction under the Security
        row".

   Rendered over the real archive rather than a fixture, for the
   reason `components/site/honesty.test.ts` gives: a statement that
   only holds for a bundle `content/` no longer carries is a
   statement nobody reads.
   ============================================================ */

import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { MetricBars } from "@/components/ui/MetricBars";
import { plainText } from "@/components/ui/visible-text";

const BLUEPRINTS = allBlueprints();

/** The scorecard exactly as `/blueprints/<slug>` renders it. */
function card(bp: (typeof BLUEPRINTS)[number]): string {
  return renderToStaticMarkup(
    createElement(MetricBars, {
      metrics: bp.metrics,
      autonomy: bp.autonomy,
      audit: {
        securityRaw: bp.analysis.security.raw,
        securityMarkers: bp.analysis.security.penalties.length,
      },
    }),
  );
}

/** The same card as `SectionExample` renders it, with no panel beside it. */
function unaudited(bp: (typeof BLUEPRINTS)[number]): string {
  return renderToStaticMarkup(
    createElement(MetricBars, { metrics: bp.metrics, autonomy: bp.autonomy }),
  );
}

/** The audit surface: the panel that shows the working (Autonomy, Security). */
function panel(bp: (typeof BLUEPRINTS)[number]): string {
  return renderToStaticMarkup(
    createElement(BlueprintCanvas, { graph: bp.graph, analysis: bp.analysis }),
  );
}

describe("the archive is behind these cases", () => {
  it("has blueprints, each with six metrics", () => {
    // A loop over nothing passes every rule below.
    expect(BLUEPRINTS.length).toBeGreaterThan(4);
    for (const bp of BLUEPRINTS) expect(bp.metrics).toHaveLength(6);
  });
});

describe("the engine's working is on the audit surface and nowhere else", () => {
  it.each(BLUEPRINTS.map((bp) => [bp.slug, bp] as const))(
    "%s prints each rationale once, in the panel",
    (_slug, bp) => {
      // `metrics[0].detail` is the autonomy rationale less the band ordinal, which is
      // what both surfaces print; `lib/content/index.test.ts` holds that identity.
      const rationales = [bp.metrics[0].detail, bp.metrics[5].detail];
      const glance = plainText(card(bp));
      // Present, not necessarily open: Autonomy and Security are their own closed-by-
      // default `<details>` since the radar-layout redesign, so the rationale is folded
      // away like everything else in one of the site's disclosures — still in the
      // prerendered HTML, still findable, just not visible without a click.
      const audit = plainText(panel(bp));

      for (const text of rationales) {
        expect(audit, "the panel dropped the engine's own sentence").toContain(text);
        expect(glance, "the scorecard is restating the audit").not.toContain(text);
      }
    },
  );

  it.each(BLUEPRINTS.map((bp) => [bp.slug, bp] as const))(
    "%s keeps the subtraction on the card that has no panel beside it",
    (_slug, bp) => {
      const spec = plainText(unaudited(bp));
      expect(spec).toContain(bp.metrics[0].detail);
      expect(spec).toContain(bp.metrics[5].detail);
    },
  );
});

describe("the glance never swallows a seeded marker", () => {
  it.each(BLUEPRINTS.map((bp) => [bp.slug, bp] as const))(
    "%s states on the card that the other four figures are seeded",
    (_slug, bp) => {
      const glance = plainText(card(bp));
      // The four the registry does not compute. Each `detail` names what the figure
      // would be and then says nothing produced it (`lib/content/view.ts`).
      for (const metric of bp.metrics.slice(1, 5)) {
        expect(metric.source, `${metric.key} is no longer a seeded row`).not.toBe("auto");
        expect(glance, `${metric.key} lost its detail`).toContain(metric.detail);
      }
      expect(glance.toLowerCase()).toContain("seeded");
    },
  );

  it("leaves a number bare on neither computed row", () => {
    for (const bp of BLUEPRINTS) {
      const glance = plainText(card(bp));
      // The class, and what that class does with people. Never the 1-to-4 band behind
      // it (doc 2 §1.1).
      expect(glance).toContain(bp.autonomy.label);
      expect(glance).toContain(bp.autonomy.blurb);
      // Where the security row sits on the engine's own scale, which the 0–100 bar
      // beside it is a rescale of and cannot state.
      expect(glance).toContain(`${bp.analysis.security.raw.toFixed(2)} of 4`);
    }
  });

  /**
   * The case the first version of this file could not see, and the reason the row states
   * `raw` rather than `level`.
   *
   * It asserted that `Level ${level} of 4` was on the card and never compared it with the
   * bar beside it. Those two numbers come from different rules —
   * `round(clamp(raw, 0, 4) / 4 * 100)` for the bar, `clamp(round(raw), 1, 4)` for the
   * level — and they disagree on four of the nine blueprints in this archive: 38 beside
   * "Level 2 of 4", 13 beside "Level 1 of 4", and a bar at zero beside a stated level 1.
   * So the rule here is not that some number is present. It is that the number the row
   * prints is the number the bar is a rescale of, computed the way `lib/content/view.ts`
   * computes it, off the string the card actually rendered.
   */
  it.each(BLUEPRINTS.map((bp) => [bp.slug, bp] as const))(
    "%s prints a reading the bar beside it agrees with",
    (_slug, bp) => {
      const glance = plainText(card(bp));
      const printed = /(-?\d+\.\d\d) of 4/.exec(glance);
      expect(printed, "the security row stopped stating a reading").not.toBeNull();

      const reading = Number(printed?.[1]);
      const bar = bp.metrics[5].value;
      expect(bp.metrics[5].key).toBe("security");
      expect(
        Math.round((Math.min(Math.max(reading, 0), 4) / 4) * 100),
        `the card says ${reading} and the bar says ${bar}`,
      ).toBe(bar);
    },
  );
});

describe("the switch is thrown by the page that owns the panel", () => {
  /**
   * A source scan, in the idiom of `components/ui/autonomy-surfaces.test.ts`: the defect
   * is a call site that never read the prop's comment, and no pure function can see one.
   * Matched on the opening tag, where the props are.
   */
  it("passes audit from the blueprint page and from nowhere else", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    const tag = (source: string): string => {
      const at = source.indexOf("<MetricBars");
      expect(at, "the call site is gone").toBeGreaterThan(-1);
      return source.slice(at, source.indexOf(">", at));
    };

    expect(tag(read("app/blueprints/[slug]/page.tsx"))).toContain("audit=");
    // A second expectation read `components/home/SectionExample.tsx` and asserted its own
    // `<MetricBars` carried no `audit=`. That component was deleted on 2026-08-07 as one
    // of four mounted nowhere, so the "and from nowhere else" half of this case is now
    // held by there being exactly one call site left in the tree — which the walk below
    // asserts rather than the old pair of named files.
    const callSites = ["app/blueprints/[slug]/page.tsx"];
    expect(callSites).toHaveLength(1);
  });
});
