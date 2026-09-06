/* ============================================================
   One page, two surfaces, and the sentence that was on both.

   The scorecard in the blueprint sidebar was a glance: six rows,
   where this blueprint sits. `components/blueprint/Explainability.tsx`
   in the main column is the audit: the subtraction, the nodes that
   fired each marker, the hints. They were printing the same two
   strings. `MetricBars` rendered `Metric.detail`, and for the two
   computed rows that detail *is* the engine rationale — the same
   sentence the panel prints through its own `Rationale`. On
   `/blueprints/starter-software-factory` a reader met

     "5 of 5 nodes run unattended, none have a person in the loop.
      1.00 > 0.90 → Closed-loop."

   and

     "4 − 0.00 (no risk marker present across 5 nodes) → 4"

   twice each, word for word, within one screen.

   ── why only the audit half is left ──
   `MetricBars` was deleted on 2026-09-04. It had two product
   mounts and both had already gone: `components/home/SectionExample`
   was cut at d900af2 with the band it drew, and the owner's removal
   of the scoring reading took the one on
   `/blueprints/<owner>/<slug>`. Nothing rendered the card, so every
   case here that rendered it was asserting over markup no reader
   can reach. Each of those cases is recorded at the foot of this
   file with what it held and where the claim went.

   The audit half never depended on that page and still ships:
   `BlueprintCanvas` is mounted by `components/upload/ValidationReport.tsx`
   on `/upload`, over a graph somebody is about to publish, and it
   renders `Explainability` whole. So "the engine's own sentence
   reaches the reader who is being shown the score" is still a rule
   about a page a reader can open, and it is still checked below.

   Rendered over the real archive rather than a fixture, for the
   reason `components/site/honesty.test.ts` gives: a statement that
   only holds for a bundle `content/` no longer carries is a
   statement nobody reads.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { plainText } from "@/components/ui/visible-text";

const BLUEPRINTS = allBlueprints();

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

describe("the engine's working reaches the audit surface", () => {
  it.each(BLUEPRINTS.map((bp) => [bp.slug, bp] as const))(
    "%s prints each rationale in the panel",
    (_slug, bp) => {
      // `metrics[0].detail` is the autonomy rationale less the band ordinal, which is
      // what the panel prints; `lib/content/index.test.ts` holds that identity.
      const rationales = [bp.metrics[0].detail, bp.metrics[5].detail];
      // Present, not necessarily open: Autonomy and Security are their own closed-by-
      // default `<details>` since the radar-layout redesign, so the rationale is folded
      // away like everything else in one of the site's disclosures — still in the
      // prerendered HTML, still findable, just not visible without a click.
      const audit = plainText(panel(bp));

      for (const text of rationales) {
        expect(audit, "the panel dropped the engine's own sentence").toContain(text);
      }
    },
  );
});

/* ============================================================
   Removed with `components/ui/MetricBars.tsx`, 2026-09-04.

   Recorded rather than dropped silently, because each one was an
   honesty rule and the licence to remove one is narrow: it is the
   owner's instruction to take the scoring reading off the blueprint
   page, and it reaches these cases only because the component they
   render has no mount left anywhere. None of them was weakened, and
   none of them was re-pointed at a surface that makes a different
   claim. Where the rule they held still applies to a page that
   ships, the guard that carries it now is named.

   1. `the scorecard is restating the audit` — the second half of
      the rationale case above, `expect(glance).not.toContain(text)`.
      It forbade the glance repeating the panel's sentence. There is
      no glance: the negative had no subject left. The positive half
      is the one that protects the reader, and it is still above.

   2. `%s keeps the subtraction on the card that has no panel beside
      it` — nine cells over `MetricBars` with no `audit=` prop. Its
      stated subject was `components/home/SectionExample`, which was
      itself deleted at d900af2, so this case had already outlived
      the arrangement it described before the component went.

   3. `%s states on the card that the other four figures are seeded`
      — nine cells: the four rows the registry does not compute must
      each print their `detail`, and the card must say "seeded"
      somewhere. The PRODUCT RULE behind it (doc 2 §0.4: a figure
      nothing produced must say so) is not lost with the card. It is
      held for every surface that ships by
      `components/ui/autonomy-surfaces.test.ts`, "says seeded in
      every file that reads one", which scans every `.tsx` under
      `app/` and `components/` and would catch a new component that
      printed one of these figures bare. `/upload` states the same
      thing in its own words beside the axes, under "Filled in
      later" (`components/upload/UploadFlow.tsx`).

   4. `leaves a number bare on neither computed row` — the card had
      to print `autonomy.label`, `autonomy.blurb` and the security
      reading as `N.NN of 4` rather than the 1-to-4 band. Nothing
      prints that row now, and this note used to name the scorecard
      radar as the nearest surviving surface while adding that it
      was no re-point, since it drew axes coloured by source and
      stated no reading at all. That component was deleted on
      2026-09-06 on the owner's instruction, so there is no nearest
      surviving surface either: no shipping component draws any of
      the six metrics. The product rule under the case is the one in
      point 3 above, and it is still carried by
      `components/ui/autonomy-surfaces.test.ts` over every `.tsx`
      that ships.

   5. `%s prints a reading the bar beside it agrees with` — nine
      cells checking that the number the security row printed and
      the 0-100 bar next to it were computed from the same `raw`,
      the two having disagreed on four of the nine blueprints. Both
      the row and the bar were `MetricBars`; the disagreement it
      caught cannot occur in a component that no longer exists.
   ============================================================ */
