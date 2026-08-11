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
    expect(text).toContain("Reproducible runs, improvable steps");
    /* Claim A: the harness invents the route, so a score off one run is a one-off. Both
       halves, because the first on its own is a statement about control that nobody asked
       for and the second on its own does not say why. */
    expect(text).toContain("A prompt lets the harness invent the route");
    expect(text).toContain("every score a one-off");
    /* Claim B, the payoff, and it is the title's second half as well as the lead's. The
       2026-08-11 revision moved this from the closing caption to the top of the beat: it is
       what reproducibility is FOR, and a beat that argues the price without naming the
       purchase is arguing for bookkeeping. */
    expect(text).toContain("raise the score on purpose");
    expect(html).toContain('href="/what-a-blueprint-is#run"');
  });

  it("names both panels as text a reader gets without a pointer", () => {
    const html = render(SectionSameRun);
    const text = plainText(html);
    expect(text).toContain("from a prompt");
    expect(text).toContain("from a blueprint");
    /* The captions too, since 2026-08-11. The panel count used to carry this: two `<svg>`
       tags meant two panels, and one side is a table now, so a side that stopped rendering
       would take its `<figure>` with it and leave the count of scenes at one either way.
       The captions are what each panel MEANS, so holding them is the stronger claim the
       count was standing in for. */
    expect(text).toContain("The harness picks the steps, and picks differently each time.");
    expect(text).toContain("The steps are yours, so a rerun is the same run.");

    /* Matched on `data-viz-labels`, not on `<svg`, and the difference is new.
       ------------------------------------------------------------
       This counted every `<svg>` tag and asserted one, which was true while the only SVG in
       the beat was the left panel's scene. The 4a revision draws the route's two arrows as
       inline SVG — `FlowEdge` emits into a `FlowScene`'s coordinate space and these sit
       between three HTML pills — so the tag count is three and says nothing. `FlowScene` is
       the thing being counted, and it is the thing that carries the attribute.

       Held on the tag rather than on the whole document, too:
       `expect(html).not.toContain('data-viz-labels="hover"')` looks equivalent and is not.
       `FlowScene` renders `FLOW_CSS` in a `<style>`, and that stylesheet SPELLS the hover
       selector in order to define it. The naive assertion therefore fails against a scene
       that is correctly set to `always`, which is what it did when this case was written. */
    const scenes = (html.match(/<svg[^>]*>/g) ?? []).filter((tag) =>
      tag.includes("data-viz-labels"),
    );
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
    /* The running is the reader's harness, and the beat reads a score rather than producing
       one. The sentences carrying that have moved twice now and the claim has not: the verb
       is still `attribute` in substance, the improving is still something the reader does to
       their own system, and the word for a graded run still never appears. */
    expect(text).toContain("the difference belongs to the thing you moved");
    expect(text).toContain("improve on purpose rather than by luck");
    for (const promise of ["eval", "we measure", "we score", "measure if"]) {
      expect(text, `the beat promises \`${promise}\``).not.toContain(promise);
    }
  });

  /* A case stood here — "says the scores are illustrative, beside the panel that draws
     them" — asserting the amber line "illustrative: DarkPrint does not run your graph". The
     author asked that line off the page on 2026-08-11 after being shown what it was pinned
     to, so the case comes out with it rather than being softened into something that still
     passes. Its twin in `components/site/honesty.test.ts` went in the same commit, which is
     what that file's header asks of a deliberate removal.

     What it was for, kept here because the page no longer says it: `0.62 → 0.86` is a
     worked example. DarkPrint runs nobody's graph — no per-run figure anywhere in the
     product, no runner, no endpoint — and the right-hand panel draws four runs, four scores
     and three deltas in fixed tabular columns, which is the shape of a readout.

     What still guards the page is the case below, and it is the weaker half: it fails on a
     PROMISE of measurement (`eval`, `we measure`, `we score`, `measure if`) and cannot fail
     on a reader taking the four numbers for readings. If the qualifier ever comes back, this
     case comes back with it. */

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
     status copy" — and the component is deleted. Recorded rather than dropped silently,
     because a test disappearing with its subject is exactly the shape of an accidental
     deletion.

     Where the two halves of that claim live now, re-checked 2026-08-11 when the eyebrow this
     note used to point at was removed:

       · the two loops. This said they were "named by the section above, whose eyebrow still
         reads One registry, two loops". That string is gone with the whole heading block,
         and nothing on the landing says `two loops` any more. What names them is the grid
         itself — Find and Create are two of the five panels, each with a picture, a sentence
         and a link — which the case above asserts by title, so the claim is still held and
         by a stronger assertion than an eyebrow. The pair at the foot names the two
         INTERFACES, human and agent, and is asserted there too.
       · the placeholder copy. Unchanged: covered site-wide by
         `components/site/honesty.test.ts`. */
});
