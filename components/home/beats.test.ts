import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Wordmark } from "@/components/hero/Wordmark";
import { SectionBlueprint } from "@/components/home/SectionBlueprint";
import { SectionFirstBlueprint } from "@/components/home/SectionFirstBlueprint";
import { SectionNodeIsCard } from "@/components/home/SectionNodeIsCard";
import { SectionRegistry } from "@/components/home/SectionRegistry";
import {
  ARROW,
  GOAL_LABEL_SIZE,
  PILL,
  ROUTE_PAD,
  SCENE,
  STEPS,
  SectionSameRun,
} from "@/components/home/SectionSameRun";
import { NAV } from "@/components/site/SiteHeader";
import { plainText } from "@/components/ui/visible-text";
import { FLOW, VIZ } from "@/components/viz";
import { ADVANCE } from "@/components/viz/label-boxes";
import { DEFAULT_LIMITS } from "@/lib/server/limits/config";

import { LANDING_NARROW, LANDING_WIDE } from "./graph";
import { ROLE_ABSENCE, ROLE_BOXES } from "./roles";

const render = (component: React.ComponentType) =>
  renderToStaticMarkup(createElement(component));

describe("the blueprint-first landing", () => {
  it("opens with the product, and the fold's two doors are routes", () => {
    const html = render(Wordmark);
    const text = plainText(html);
    expect(text).toContain("Reusable blueprints for agent workflows.");
    expect(text).toContain(
      "Find a blueprint for your task and fetch it as a folder your agent can run.",
    );

    // The routes are in the static frame; only the account line waits for the session.
    expect(html).toContain('href="/blueprints"');
    expect(html).toContain('href="/tutorial"');
    expect(text).toContain("Browse blueprints");

    /* The account line's server frame is its claimless placeholder: a "Sign in" here would
       tell a signed-in reader something false for a frame, the failure
       `components/upload/session.ts` documents. */
    expect(html).toContain("animate-pulse");
    expect(text).not.toContain("Welcome,");
    expect(text).not.toContain("Sign in with");
    expect(text.toLowerCase()).not.toContain("sign in");
  });

  it("keeps both loops reachable from the landing, through the header", () => {
    /* The ending is one door, on the owner's instruction, so the two ways in it used to
       carry, search the registry and make one with the skill, are held where every page
       has them: the header's own table. */
    const hrefs = NAV.map((row) => row.href);
    expect(hrefs).toContain("/blueprints");
    expect(hrefs).toContain("/skill");
  });

  /* Beat 2, and the only beat on the landing that argues rather than shows. Both claims
     are pinned because the beat is worthless without either half: claim A on its own is a
     statement about control that nobody asked for, and claim B on its own is unintelligible
     and, worse, reads as a promise that this site measures something. */
  /* A 360 phone, the narrowest width `FLOW.frame` lays out for: `container-page` keeps
     1.5rem a side and each sheet spends a 1px border a side before its own padding. */
  const PHONE_COLUMN = FLOW.frame.phone - 2 * 24;

  it("fits the route inside a phone's sheet, and keeps the mock's pills from lg up", () => {
    const body = PHONE_COLUMN - 2 - 2 * ROUTE_PAD.phone;
    const pill = (body - (STEPS.length - 1) * ARROW.width) / STEPS.length;
    // The pills set `text-[13px]` mono, and `ADVANCE` is the widest advance a mono face has.
    const longest = Math.max(...STEPS.map((step) => step.length));
    const label = longest * 13 * ADVANCE + 2 * VIZ.stroke.base;
    expect(
      pill,
      `a ${pill.toFixed(1)}px pill cannot hold a ${label.toFixed(1)}px label`,
    ).toBeGreaterThanOrEqual(label);
    // The breakpoint note's 451px of body at a 1024 window still holds three 128px pills.
    expect(STEPS.length * PILL.width + (STEPS.length - 1) * ARROW.width).toBeLessThanOrEqual(451);

    const html = render(SectionSameRun);
    expect([...html.matchAll(/flex:1 1 128px;max-width:128px;min-width:0/g)]).toHaveLength(
      STEPS.length,
    );
    expect(html, "a pill has a fixed width again, so the row overflows a phone").not.toMatch(
      /[;"]width:128px/,
    );
  });

  it("draws the goal's label above the legibility floor on a phone", () => {
    const body = PHONE_COLUMN - 2 - 2 * 20; // the left sheet's `px-5`
    const rendered = (GOAL_LABEL_SIZE * body) / SCENE.width;
    expect(rendered, `"goal" renders at ${rendered.toFixed(2)}px`).toBeGreaterThanOrEqual(
      FLOW.frame.legible,
    );
    expect(render(SectionSameRun)).toContain(`font-size="${GOAL_LABEL_SIZE}"`);
  });

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
     a run. The page that carried that sentence for a reader was `/reading-the-radar`, and it
     came off the site on 2026-09-04, so the row is now pinned over a component no route
     mounts. This beat comes nearer that line than anything else on the landing, and with the
     page gone it is the nearest thing to it that a reader actually sees. It stays on the
     right side of it
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

  /* The beat draws the blueprint and no listing, so it may not claim a line count or that
     the archive's file is shown; that claim belongs to `/spec/topology`. */
  it("shows the drawing without claiming to show the file", () => {
    const text = plainText(render(SectionBlueprint));
    expect(text).not.toMatch(/\d+ lines/);
    expect(text).not.toContain("as the archive stores them");
  });

  it("closes beat 2 on what a blueprint pins, and the page that explains one", () => {
    const html = render(SectionBlueprint);
    expect(plainText(html)).toContain(
      "A blueprint pins the handoffs, loops, checkpoints, and deliberate absences that make a workflow reusable.",
    );
    expect(plainText(html)).toContain("What a blueprint is");
    expect(html).toContain('href="/what-a-blueprint-is"');
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

  /* The registry beat is where a reader learns the site is more than a course: what can be
     read with no account, and what signing in adds. Each figure it states is pinned to the
     code that makes it true. */
  it("says what the registry offers without an account, and what an account adds", () => {
    const html = render(SectionRegistry);
    const text = plainText(html);
    expect(text).toContain("When you need an account");
    expect(text).toContain("Without an account");
    expect(text).toContain("With an account");
    for (const href of ["/blueprints", "/nodes", "/mcp", "/settings"]) {
      expect(html, `the registry beat lost its link to ${href}`).toContain(`href="${href}"`);
    }
    // The account default is public (`lib/db/schema.ts`), so no visibility is a default here.
    expect(text).toContain("each one public or private");
    expect(text.toLowerCase()).not.toContain("by default");
    expect(text).toContain("raises the read limit tenfold");
    expect(
      DEFAULT_LIMITS.read.key.limit / DEFAULT_LIMITS.read.anonymous.limit,
      "the landing says tenfold",
    ).toBe(10);
  });

  it("puts the registry beat after the card and before the ending", () => {
    const page = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
    const at = (tag: string) => {
      const index = page.indexOf(tag);
      expect(index, `app/page.tsx does not render ${tag}`).toBeGreaterThan(-1);
      return index;
    };
    expect(at("<SectionNodeIsCard")).toBeLessThan(at("<SectionRegistry"));
    expect(at("<SectionRegistry")).toBeLessThan(at("<SectionFirstBlueprint"));
  });

  /* The ending: the heading, four steps, and exactly one link. The registry and the account
     story are the beat above, so the ending can stay one instruction. */
  it("ends the landing on the tutorial, with the path it walks spelled out", () => {
    const html = render(SectionFirstBlueprint);
    const text = plainText(html);
    expect(text).toContain("Write your first blueprint");
    for (const step of ["01", "02", "03", "04"]) {
      expect(text).toContain(step);
    }

    // One door and nothing else links out of the ending, so the one instruction stays one
    // instruction and the reader has one thing to click.
    expect(html, "the ending lost its door").toContain('href="/tutorial"');
    expect([...html.matchAll(/<a\b/g)]).toHaveLength(1);
  });
});
