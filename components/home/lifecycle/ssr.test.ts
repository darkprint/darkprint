/* ============================================================
   Spec §1, held to this directory's drawings.

   "The content must be in the prerendered HTML. Text, YAML, labels
   and headings are real DOM at SSR time; animation only changes
   opacity/transform/stroke of what is already there."

   The rule is easy to keep and easy to lose. A scene that grew a
   `useState` for its own labels would still look right in a
   browser and would still pass every other test in the repo, while
   shipping an empty `<svg>` to a crawler and to a reader with no
   JS. So the drawings are rendered the way the build renders them
   — no DOM, no effects, no browser — and what comes back is read
   for the strings the panels are about.

   `renderToStaticMarkup` rather than a DOM: `vitest.config.ts` runs
   this suite under `environment: "node"` on purpose, and the
   question here is what the server writes, which is exactly what
   this function answers.

   ── Why three drawings, and not the same three as before ──
   `UpdateScene.tsx` is gone from this directory (the lifecycle-scoring pass, §2.3): the
   synthetic `inferBump` demo it drew is not this site's only versioning story, and
   `components/nodes/VersionHistory.tsx` tells the real one, off real published cards, on
   every multi-version node page. `ComposeScene.tsx` (new) took its seat in `SectionLifecycle`
   instead. `ForkScene.tsx` is still checked here even though `SectionLifecycle` no longer
   renders it — it lives in this directory and a different page now draws it (the blueprint
   detail page's `ForkAction`), and this suite is about what this directory's scenes render
   at SSR, not about which page currently reaches for which file.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { framesOf } from "@/components/viz/label-boxes";
import { ComposeScene } from "./ComposeScene";
import { DownloadScene } from "./DownloadScene";
import { ForkScene } from "./ForkScene";

const download = renderToStaticMarkup(createElement(DownloadScene));
const fork = renderToStaticMarkup(createElement(ForkScene));
const compose = renderToStaticMarkup(createElement(ComposeScene));

describe("the drawings render their finished state on the server", () => {
  it.each([
    ["download", download, ["factory.dot", "blueprint.dot", "README.md", "attractor run"]],
    ["fork", fork, ["as published", "your copy", "deployer", "a person approves"]],
    [
      "compose",
      compose,
      ["your blueprint", "a bigger pipeline", "builder", "tester", "assemble", "wires in"],
    ],
  ])("%s carries its labels as text", (_name, markup, labels) => {
    for (const label of labels) expect(markup).toContain(label);
  });

  /**
   * `useReveal` reports `static` outside the browser, and `FlowScene` holds a scene at
   * nothing only while it is `armed`. Rendered opaque here, which is what makes the markup
   * above legible rather than merely present.
   *
   * The class rather than an inline style since the conversion out of the CAD register:
   * these drawings hung their own `<g style={{opacity}}>` off `useSceneReveal`, and
   * the luminous scene owns the same decision on the `<svg>` so a scene cannot forget it.
   */
  it.each([
    ["download", download],
    ["fork", fork],
    ["compose", compose],
  ])("%s is not held at nothing", (_name, markup) => {
    expect(markup).toContain("opacity-100");
    expect(markup).not.toContain("opacity-0");
  });

  /**
   * No layout shift (spec §1): the box is reserved by the viewBox and the declared aspect
   * ratio before anything paints, so a drawing arriving does not move the paragraph under
   * it.
   */
  it.each([
    ["download", download],
    ["fork", fork],
    ["compose", compose],
  ])("%s reserves its box", (_name, markup) => {
    expect(markup).toContain("viewBox=");
    expect(markup).toContain("aspect-ratio:");
  });
});

describe("the compose drawing crosses into the bigger cluster, not before it", () => {
  /**
   * The whole argument of the drawing (`ComposeScene`'s own header comment): the crossing
   * edge lands on the pipeline's second node, `assemble`, rather than its first, `intake`,
   * which is what draws "joins a pipeline" rather than "runs before one". None of the
   * checks above read where an edge actually goes, so a future edit that slid the landing
   * point back onto the first node would pass every one of them; this reads the label's
   * own position instead of trusting the id it was given.
   */
  it("places the crossing edge's label nearer assemble than intake", () => {
    const [frame] = framesOf(createElement(ComposeScene));
    const wiresIn = frame.labels.find((label) => label.text === "wires in");
    const assemble = frame.labels.find((label) => label.text === "assemble");
    const intake = frame.labels.find((label) => label.text === "intake");
    expect(wiresIn, "the crossing edge's label is gone").toBeDefined();
    expect(assemble, "the pipeline lost its assemble node").toBeDefined();
    expect(intake, "the pipeline lost its intake node").toBeDefined();
    const midpoint = (wiresIn!.left + wiresIn!.right) / 2;
    const toAssemble = Math.abs(midpoint - (assemble!.left + assemble!.right) / 2);
    const toIntake = Math.abs(midpoint - (intake!.left + intake!.right) / 2);
    expect(toAssemble).toBeLessThan(toIntake);
  });
});
