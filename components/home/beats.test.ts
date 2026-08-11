import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Wordmark } from "@/components/hero/Wordmark";
import { SectionBlueprint } from "@/components/home/SectionBlueprint";
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
    /* Claim A: a prompt does not model the steps, so a score off one is a one-off. Both
       halves, because the first on its own is a statement about control that nobody asked
       for and the second on its own does not say why. */
    expect(text).toContain("A prompt does not model the steps.");
    expect(text).toContain("every score it earns is a one-off");
    // Claim B, the payoff: fixing the steps is what makes the number mean something.
    expect(text).toContain("turns a score into an instrument you can act on");
    expect(html).toContain('href="/what-a-blueprint-is#run"');
  });

  it("names both panels as text a reader gets without a pointer", () => {
    const html = render(SectionSameRun);
    const text = plainText(html);
    expect(text).toContain("from a prompt");
    expect(text).toContain("from a blueprint, run by a harness");
    /* The captions too, since 2026-08-11. The panel count used to carry this: two `<svg>`
       tags meant two panels, and one side is a table now, so a side that stopped rendering
       would take its `<figure>` with it and leave the count of scenes at one either way.
       The captions are what each panel MEANS, so holding them is the stronger claim the
       count was standing in for. */
    expect(text).toContain("Three runs of one goal.");
    expect(text).toContain("Four runs of one blueprint.");

    /* Held on the `<svg>` tag rather than on the whole document.
       `expect(html).not.toContain('data-viz-labels="hover"')` looks equivalent and is not:
       `FlowScene` renders `FLOW_CSS` in a `<style>`, and that stylesheet SPELLS the hover
       selector in order to define it. The naive assertion therefore fails against a scene
       that is correctly set to `always`, which is what it did when this case was written. */
    const scenes = html.match(/<svg[^>]*>/g) ?? [];
    expect(scenes, "the left panel should draw one scene").toHaveLength(1);
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
    /* The running is the reader's harness, and the beat reads a score rather than
       producing one. Both sentences moved in the 2026-08-11 rewrite and both claims are
       the same ones: nothing here measures anything. */
    expect(text).toContain("a harness can only tell you what a change did");
    expect(text).toContain("the difference belongs to the thing you moved");
    for (const promise of ["eval", "we measure", "we score", "measure if"]) {
      expect(text, `the beat promises \`${promise}\``).not.toContain(promise);
    }
  });

  /* The rewrite put numbers on the page and the numbers are a worked example.

     `0.62 → 0.86` is illustrative: DarkPrint does not run anybody's graph, so there is no
     per-run figure anywhere in the product, and the right-hand panel is shaped exactly like
     a readout. The qualifier is beside the panel rather than in a comment, and
     `components/site/honesty.test.ts` carries the ledger row. This case is the cheap half:
     a length pass that takes the line fails here first. */
  it("says the scores are illustrative, beside the panel that draws them", () => {
    const text = plainText(render(SectionSameRun));
    expect(text).toContain("illustrative: DarkPrint does not run your graph");
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

  /**
   * The five steps, the pair at the foot, and **no links at all**.
   *
   * This section is the landing's ending now, so its five links are load-bearing rather
   * than duplicative.
   *
   * The page used to close twice: five panels here, each with a CTA, and then
   * `SectionDoors` asking "find one, or create one" with two buttons — a choice already
   * inside these five. One of the two had to go, and the author cut the doors: five ways in
   * with a picture and a sentence each beats two cards, and Learn, Use and Publish are
   * three doors the band never had.
   *
   * So the case holds every panel to a link, which is the property that made cutting the
   * doors safe. Losing one silently would leave the landing with no way out of the beat it
   * ends on.
   */
  it("ends the landing with a way into each of the five", () => {
    const html = render(SectionLifecycle);
    const text = plainText(html);
    for (const step of ["Learn", "Find", "Create", "Use", "Publish"]) {
      expect(text).toContain(step);
    }
    expect(text).toContain("00");
    expect(html).not.toMatch(/<h3[^>]*>Validate<\/h3>/);

    // One link per panel, and every one of them a route this site has.
    for (const href of [
      "/what-a-blueprint-is",
      "/blueprints",
      "/skill",
      "/blueprints/starter-software-factory#use-this-blueprint",
      "/upload",
    ]) {
      expect(html, `the ${href} panel lost its link`).toContain(`href="${href}"`);
    }
    expect([...html.matchAll(/<a\b/g)]).toHaveLength(5);

    expect(text).toContain("Human interface");
    expect(text).toContain("Agent interface");
  });

  /* `SectionDoors` had a case here — "closes on the same two loops without placeholder
     status copy" — and the component is deleted. The claim it protected is not lost: the
     two loops are named by the section above, whose eyebrow still reads "One registry, two
     loops", and the placeholder-copy half is covered site-wide by
     `components/site/honesty.test.ts`. Recorded rather than dropped silently, because a
     test disappearing with its subject is exactly the shape of an accidental deletion. */
});
