import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Wordmark } from "@/components/hero/Wordmark";
import { SectionBlueprint } from "@/components/home/SectionBlueprint";
import { SectionDoors } from "@/components/home/SectionDoors";
import { SectionLifecycle } from "@/components/home/SectionLifecycle";
import { SectionNodeIsCard } from "@/components/home/SectionNodeIsCard";
import { SectionSameRun } from "@/components/home/SectionSameRun";
import { plainText } from "@/components/ui/visible-text";

import { LANDING_NARROW, LANDING_WIDE } from "./graph";
import { ROLE_ABSENCE, ROLE_BOXES } from "./roles";

const render = (component: React.ComponentType) =>
  renderToStaticMarkup(createElement(component));

describe("the blueprint-first landing", () => {
  it("opens with the product and the two user loops", () => {
    const html = render(Wordmark);
    const text = plainText(html);
    expect(text).toContain("Reusable blueprints for agent workflows.");
    expect(text).toContain("Find a blueprint");
    expect(text).toContain("Create a blueprint");
    expect(html).toContain('href="/blueprints"');
    // The two loops are find and create, and create is the authoring skill at `/skill`
    // since the `/build` split. The sandbox that kept the old path is a Learn stop.
    expect(html).toContain('href="/skill"');
  });

  /* Beat 2, and the only beat on the landing that argues rather than shows. Both claims
     are pinned because the beat is worthless without either half: claim A on its own is a
     statement about control that nobody asked for, and claim B on its own is unintelligible
     and, worse, reads as a promise that this site measures something. */
  it("argues the blueprint against the prompt, in that order", () => {
    const html = render(SectionSameRun);
    const text = plainText(html);
    expect(text).toContain("The same run twice");
    // Claim A: the harness is handed a route, not a goal.
    expect(text).toContain(
      "A prompt gives your harness a goal and lets it invent the route.",
    );
    // Claim B, the payoff.
    expect(text).toContain("two runs differ only where you changed the blueprint");
    expect(html).toContain('href="/what-a-blueprint-is#run"');
  });

  it("names both panels as text a reader gets without a pointer", () => {
    const html = render(SectionSameRun);
    const text = plainText(html);
    expect(text).toContain("from a prompt");
    expect(text).toContain("from a blueprint");

    /* Held on the `<svg>` tags rather than on the whole document.
       `expect(html).not.toContain('data-viz-labels="hover"')` looks equivalent and is not:
       `FlowScene` renders `FLOW_CSS` in a `<style>`, and that stylesheet SPELLS the hover
       selector in order to define it. The naive assertion therefore fails against a scene
       that is correctly set to `always`, which is what it did when this case was written. */
    const scenes = html.match(/<svg[^>]*>/g) ?? [];
    expect(scenes, "the beat should draw two panels").toHaveLength(2);
    for (const scene of scenes) {
      expect(scene).toContain('data-viz-labels="always"');
      expect(scene).not.toContain('data-viz-labels="hover"');
    }
  });

  /* Every run in this beat is laid out by hand, and this register spells a point `[x, y]`.
     An `{x, y}` object typechecks nowhere but reads fine, and `flowRun` does arithmetic on
     the tuple, so the mistake does not throw: it emits `d="M NaN NaN Q NaN NaN NaN NaN"`
     and the edge draws nothing while keeping its tone, its pulse and its place in the DOM.
     A figure of two panels whose routes are all invisible would pass every other case here.
     This was a real defect in the first draft of the beat, caught by eye in the markup. */
  it("draws every run, with no point that failed to resolve", () => {
    expect(render(SectionSameRun)).not.toContain("NaN");
  });

  /* The honesty position, held as a test rather than as a comment.

     `components/site/honesty.test.ts` pins, in the open, that nothing on this site measures
     a run, and `/reading-the-radar` says there is no runner and no endpoint. This beat comes
     nearer that line than anything else on the landing, and it stays on the right side of it
     by three specific choices recorded in the spec: the running is the reader's, the verb is
     `attribute`, and the word `eval` never appears. A rewrite that promises a measurement
     fails here, which is the point at which it also needs a limit statement and a ledger row. */
  it("claims no measurement of its own", () => {
    const text = plainText(render(SectionSameRun)).toLowerCase();
    expect(text).toContain("run it again in your own harness");
    expect(text).toContain("attribute the difference to the swap");
    for (const promise of ["eval", "we measure", "we score", "measure if"]) {
      expect(text, `the beat promises \`${promise}\``).not.toContain(promise);
    }
  });

  /* Beats 3 and 4 are the drawings restored from `main`, and these two tests are `main`'s
     own assertions about them rather than new ones: the roles as readable text, the absent
     edge and the prohibition behind it, and both placements so a phone gets the squarer
     graph. What is added here is the caption each beat now closes on, which is the one part
     of these two sections that is not `main`'s.

     They are held on the FIGURE, not on the heading. A test that only checked the `h2`
     would pass against a section whose drawing had silently stopped rendering, which is the
     failure these beats can actually have. */
  it("demonstrates a real starter graph and its deliberate absent edge", () => {
    const html = render(SectionBlueprint);
    const text = plainText(html);
    expect(text).toContain("This is a blueprint");
    for (const box of ROLE_BOXES) {
      expect(html, `${box.label} is not in the markup`).toContain(`>${box.label}<`);
    }
    // Doc 2 §5.2. The label a reader has to be able to read without hovering anything.
    expect(html).toContain(ROLE_ABSENCE.prohibition);
    expect(html).toContain('data-viz="absent-edge"');
    expect(html).toContain(`0 0 ${LANDING_WIDE.width} ${LANDING_WIDE.height}`);
    expect(html).toContain(`0 0 ${LANDING_NARROW.width} ${LANDING_NARROW.height}`);
  });

  it("closes beat 2 on what a blueprint pins, and a way into one", () => {
    const html = render(SectionBlueprint);
    expect(plainText(html)).toContain(
      "A blueprint pins the handoffs, loops, checkpoints, and deliberate absences that make a workflow reusable.",
    );
    expect(html).toContain('href="/blueprints/starter-software-factory"');
  });

  it("shows a card as a contract with inputs, outputs, and prohibitions", () => {
    const text = plainText(render(SectionNodeIsCard));
    expect(text).toContain("Every node is a card");
    // The seventh part of the walk, and the one the resolver really enforces.
    expect(text).toContain("cannot");
    expect(text).toContain("acceptance-criteria");
  });

  it("closes beat 3 on the version pin, and the format reference", () => {
    const html = render(SectionNodeIsCard);
    expect(plainText(html)).toContain(
      "Each node pins an exact card version: its job, interface, tool reach, and prohibitions.",
    );
    expect(html).toContain('href="/spec/card"');
  });

  it("starts with learning, then names the finder and creator lifecycle", () => {
    const html = render(SectionLifecycle);
    const text = plainText(html);
    for (const step of ["Learn", "Find", "Create", "Use", "Publish"]) {
      expect(text).toContain(step);
    }
    expect(text).toContain("00");
    expect(html).toContain('href="/what-a-blueprint-is"');
    expect(html).not.toMatch(/<h3[^>]*>Validate<\/h3>/);
    expect(text).toContain("Human interface");
    expect(text).toContain("Agent interface");
    expect(html).toContain('href="/blueprints/starter-software-factory#use-this-blueprint"');
  });

  it("closes on the same two loops without placeholder status copy", () => {
    const text = plainText(render(SectionDoors));
    expect(text).toContain("Find and reuse");
    expect(text).toContain("Create and publish");
    expect(text.toLowerCase()).not.toContain("coming soon");
  });
});
