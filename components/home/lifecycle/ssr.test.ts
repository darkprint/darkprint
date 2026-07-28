/* ============================================================
   Spec §1, held to this section's three drawings.

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
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DownloadScene } from "./DownloadScene";
import { ForkScene } from "./ForkScene";
import { UpdateScene } from "./UpdateScene";

const download = renderToStaticMarkup(createElement(DownloadScene));
const fork = renderToStaticMarkup(createElement(ForkScene));
const update = renderToStaticMarkup(
  createElement(UpdateScene, {
    cardId: "code-builder",
    from: "1.0.0",
    to: "2.0.0",
    added: "report",
    source: "tester",
  }),
);

describe("the drawings render their finished state on the server", () => {
  it.each([
    ["download", download, ["factory.dot", "blueprint.dot", "README.md", "attractor run"]],
    ["fork", fork, ["as published", "your copy", "deployer", "a person approves"]],
    ["update", update, ["code-builder", "@1.0.0", "@2.0.0", "+ report", "refused"]],
  ])("%s carries its labels as text", (_name, markup, labels) => {
    for (const label of labels) expect(markup).toContain(label);
  });

  /**
   * `useReveal` reports `static` outside the browser, and `FlowScene` holds a scene at
   * nothing only while it is `armed`. Rendered opaque here, which is what makes the markup
   * above legible rather than merely present.
   *
   * The class rather than an inline style since the conversion out of the CAD register:
   * these three drawings hung their own `<g style={{opacity}}>` off `useSceneReveal`, and
   * the luminous scene owns the same decision on the `<svg>` so a scene cannot forget it.
   */
  it.each([
    ["download", download],
    ["fork", fork],
    ["update", update],
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
    ["update", update],
  ])("%s reserves its box", (_name, markup) => {
    expect(markup).toContain("viewBox=");
    expect(markup).toContain("aspect-ratio:");
  });
});

describe("the update drawing takes its numbers from its caller", () => {
  /**
   * The panel's whole claim is that the version and the verdict are computed. A scene with
   * "2.0.0" written into it would keep printing 2.0.0 after `inferBump` changed its mind,
   * which is the failure this file exists to make impossible.
   */
  it("prints whatever version it is handed", () => {
    const other = renderToStaticMarkup(
      createElement(UpdateScene, {
        cardId: "spec-planner",
        from: "3.1.4",
        to: "3.2.0",
        added: "plan",
        source: "router",
      }),
    );
    expect(other).toContain("@3.1.4");
    expect(other).toContain("@3.2.0");
    expect(other).toContain("+ plan");
    expect(other).not.toContain("code-builder");
  });
});
