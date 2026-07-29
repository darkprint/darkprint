/* ============================================================
   The sentences this site is not allowed to stop saying.

   Every entry below was on a page once, went missing during a pass
   that was cutting for length, and was found by a reviewer reading
   two builds side by side. That is twice now that a limit statement
   has left this site by accident, and PROJECT.md §4 asks for a
   guard rather than a note in a report: a check that a specific
   disclaimer is present costs nothing to run and does not depend on
   anybody remembering.

   Two things this file is careful about, because both were how the
   statements went in the first place.

   **Open, not merely present.** §3.1 licences moving reference
   depth behind `components/ui/More.tsx`, and a `<details>` really
   does keep the text in the prerendered HTML, keyboard-reachable
   and findable by find-in-page. But a sentence that qualifies
   something printed in the open has to be in the open with it, or
   the qualified thing is read alone. So each entry says which of
   the two it needs, `open` or `present`, and the difference is
   enforced.

   **The real archive, not a fixture.** Everything here renders the
   component the page renders, over `content/`. A statement that
   only appears for a bundle the archive no longer contains is a
   statement nobody reads.

   Adding to this file is the cheapest thing in the repository. If a
   pass removes a sentence deliberately, the entry comes out in the
   same commit and the reason goes in the message.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SpecCardPage from "@/app/spec/card/page";
import { allBlueprints } from "@/lib/content";
import { CARD_ROWS } from "@/components/spec/rows";
import { ScoringModel } from "@/components/spec/ScoringModel";
import { SectionComponentRecap } from "@/components/explain/SectionComponentRecap";
import { WhichTasksChecks } from "@/components/explain/WhichTasksChecks";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { openText, plainText } from "@/components/ui/visible-text";

/* --------------------- the surfaces --------------------- */

const BLUEPRINTS = allBlueprints();

/** The explainability panel exactly as `/blueprints/<slug>` renders it. */
function canvas(slug: string): string {
  const bp = BLUEPRINTS.find((b) => b.slug === slug);
  if (bp === undefined) throw new Error(`no blueprint ${slug} in content/`);
  return renderToStaticMarkup(
    createElement(BlueprintCanvas, { graph: bp.graph, analysis: bp.analysis }),
  );
}

const SPEC_CARD = renderToStaticMarkup(createElement(SpecCardPage as never));
const WHICH_TASKS = renderToStaticMarkup(createElement(WhichTasksChecks));
const RECAP = renderToStaticMarkup(createElement(SectionComponentRecap));
/**
 * The scoring panel `/spec` mounts under `#scoring` (PROJECT.md §3.4).
 *
 * It is the first surface on the site to print `minRuns` and `outlierZScore`, and two
 * named filters on cost and time read as a description of something running unless the
 * page says otherwise beside them. That sentence is the claim below.
 */
const SCORING = renderToStaticMarkup(createElement(ScoringModel));

/**
 * The starter is the one bundle whose criteria walk stops at a judge
 * (`analysis/criteria-relayed-through-judge`), so it is the only page carrying the
 * feedback-against-gaming statement. Asserted rather than assumed, below.
 */
const STARTER = canvas("starter-software-factory");

/* --------------------- the ledger --------------------- */

type Where = "open" | "present";

interface Claim {
  /** What the sentence is for, in the failure message. */
  why: string;
  /** Verbatim, lowercased at compare time. A paraphrase is a different sentence. */
  says: string;
  /** `open` when it qualifies something printed in the open beside it. */
  where: Where;
  html: string;
  surface: string;
}

/* The unanchored limit statement is not in this table. It is held over every bundle in
   that state, one case each, by the test under it. */
const CLAIMS: Claim[] = [
  {
    surface: "/blueprints/starter-software-factory · where the trace stopped",
    why: "why a channel the analyzer cannot follow is worth naming at all. The engine writes it into the hint on every row of that list, and every hint is behind a closed disclosure",
    says: "seeing the evidence of a failure you caused is feedback, seeing the criteria is gaming",
    where: "open",
    html: STARTER,
  },
  {
    surface: "/blueprints/starter-software-factory · where the trace stopped",
    why: "the limit stated in both directions. \"Nothing is charged\" says what the score did; this says what the silence means",
    says: "not evidence of a leak, and it is not evidence of isolation either",
    where: "open",
    html: STARTER,
  },

  /* ---- /spec/card ---- */
  {
    surface: "/spec/card · checked against the graph, or shown to a reader",
    why: "half of the page's thesis. Panel B asserts the free-text entry is legitimate; without this the symmetry has one side, and an entry nothing checks reads as an entry that failed",
    says: "both are legitimate, and a reader has to be able to tell which is which without running anything",
    where: "open",
    html: SPEC_CARD,
  },
  {
    surface: "/spec/card · the resolver's own sentence",
    why: 'the severity of the refusal in word form. It used to be in the prose ("at error severity"); after the length pass the only word form left was inside an `<svg>` plate and inside the folded field table',
    says: "error bundle/prohibition-violated",
    where: "open",
    html: SPEC_CARD,
  },

  /* ---- /spec#scoring ---- */
  {
    surface: "/spec · cost and time, if they are ever reported",
    why: "the whole telemetry block is a design nothing implements. `minRuns 5` and `outlierZScore 3` are printed as engine configuration, which is what every other number in that section is, and those two are filters on a pipeline that has never had an input. PROJECT.md §3.5 is the point at which this stops being free, so the sentence has to be beside the numbers rather than behind a disclosure",
    says: "nothing on this site measures a run, so these two filters describe a design rather than a behaviour",
    where: "open",
    html: SCORING,
  },

  /* ---- /towards-a-dark-factory/which-tasks ---- */
  {
    surface: "/towards-a-dark-factory/which-tasks · check 01",
    why: "the tester's structural position, which is why a task with no verdict is a veto rather than a caution. A grep for \"release gate\" over the built site returns one hit, and it describes the starter's wiring rather than the tester",
    says: "the tester is the one node standing between generated code and the release gate",
    where: "present",
    html: WHICH_TASKS,
  },
  {
    surface: "/towards-a-dark-factory/which-tasks · check 01",
    why: "what a rubber-stamping tester costs. The examples above say the tester passes whatever it is given; nothing else says what that makes the graph",
    says: "an expensive way to run one prompt",
    where: "present",
    html: WHICH_TASKS,
  },
  {
    surface: "/towards-a-dark-factory/which-tasks · check 03",
    why: "why ambiguity is not caught by the graph. The examples say every node downstream builds on a guess; this says the run ends before anyone can act on it",
    says: "the run is over before anyone finds out",
    where: "present",
    html: WHICH_TASKS,
  },

  /* ---- /what-it-isnt ---- */
  {
    surface: "/what-it-isnt · four words used precisely",
    why: "a not-built statement. It stays inside the recap's disclosure on purpose, because the composite node it qualifies is only mentioned there: what this pins is that the two halves never separate, so the feature can never be described without the qualifier",
    says: "reference another as a composite node, and nothing on the site does that today",
    where: "present",
    html: RECAP,
  },
];

describe("the surfaces the ledger is read off", () => {
  it("rendered something on each of them", () => {
    // A ledger held over an empty string passes every case in it.
    for (const [name, html] of [
      ["/spec/card", SPEC_CARD],
      ["/spec scoring panel", SCORING],
      ["which-tasks checks", WHICH_TASKS],
      ["the component recap", RECAP],
      ["the starter's canvas", STARTER],
    ] as const) {
      expect(html.length, name).toBeGreaterThan(2000);
    }
    expect(BLUEPRINTS.length).toBe(9);
  });

  it("still has a bundle whose criteria walk stops at a judge", () => {
    // The two starter claims above are only readable in the `relayed` state. If the
    // archive stops producing it, this fails here rather than passing vacuously there.
    expect(
      BLUEPRINTS.filter((bp) =>
        bp.analysis.security.diagnostics.some(
          (d) => d.code === "analysis/criteria-relayed-through-judge",
        ),
      ).map((bp) => bp.slug),
    ).toContain("starter-software-factory");
  });
});

describe("claims the site may not stop making", () => {
  it.each(CLAIMS.map((c) => [`${c.surface} — "${c.says.slice(0, 48)}…"`, c] as const))(
    "%s",
    (_name, claim) => {
      const body = (
        claim.where === "open" ? openText(claim.html) : plainText(claim.html)
      ).toLowerCase();
      expect(body, `${claim.why}. Surface: ${claim.surface}`).toContain(
        claim.says.toLowerCase(),
      );
    },
  );

  /**
   * The unanchored claim is held over every bundle in that state rather than over one, so
   * a change that fixes the panel for the blueprint somebody happened to open is not
   * enough. Eight of the nine are unanchored today.
   */
  it("states the unanchored limit in the open on every bundle in that state", () => {
    const unanchored = BLUEPRINTS.filter((bp) =>
      bp.analysis.security.diagnostics.some(
        (d) => d.code === "analysis/criteria-leak-unanchored",
      ),
    );
    expect(unanchored.length, "no bundle is unanchored any more").toBeGreaterThan(0);
    for (const bp of unanchored) {
      expect(openText(canvas(bp.slug)).toLowerCase(), bp.slug).toContain(
        "the absence of a finding here is silence, not a clean verdict",
      );
    }
  });
});

describe("claims carried by data rather than by copy", () => {
  /**
   * Deleted from the `inputs · outputs` row as wording. It is the reason typed ports
   * exist and the premise the whole `cannot` demonstration rests on, and a grep for
   * "checkable" over the built pages found it nowhere else.
   */
  it("says what typed ports are for, on the field the ports are declared in", () => {
    const row = CARD_ROWS.find((r) => r.name === "inputs · outputs");
    expect(row, "the inputs · outputs row was renamed or removed").toBeDefined();
    expect(row?.what).toContain("makes an edge checkable at all");
  });
});
