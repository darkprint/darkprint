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

   ── Why four drawings, and not the same three as before ──
   `UpdateScene.tsx` is gone from this directory (the lifecycle-scoring pass, §2.3): the
   synthetic `inferBump` demo it drew is not this site's only versioning story, and
   `components/nodes/VersionHistory.tsx` tells the real one, off real published cards, on
   every multi-version node page. `ForkScene.tsx` is still checked here even though
   `SectionLifecycle` no longer renders it — it lives in this directory and a different
   page now draws it (the blueprint detail page's `ForkAction`), and this suite is about
   what this directory's scenes render at SSR, not about which page currently reaches for
   which file.

   `DownloadScene.tsx` and `ComposeScene.tsx` were rewritten a second time, and
   `UploadScene.tsx` is new outright: the author found the first pair still drew a graph
   ("I expected avoiding the use of a blueprint but a more minimal illustration. Same for
   the upload yours card"), so all three now draw a single motion — one point arriving,
   two points travelling into the one between them, one point rising and fading before it
   reaches the top — rather than a topology. None of them carries a per-node label any
   more (see `DownloadScene`'s header for why), so what this file checks about them
   changed shape too: the one caption each frame carries, and the geometric properties
   that are each drawing's actual argument now that there is no id to trust instead.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComposeScene } from "./ComposeScene";
import { DownloadScene } from "./DownloadScene";
import { ForkScene } from "./ForkScene";
import { UploadScene } from "./UploadScene";

const download = renderToStaticMarkup(createElement(DownloadScene));
const fork = renderToStaticMarkup(createElement(ForkScene));
const compose = renderToStaticMarkup(createElement(ComposeScene));
const upload = renderToStaticMarkup(createElement(UploadScene));

describe("the drawings render their finished state on the server", () => {
  it.each([
    ["download", download, ["arrived"]],
    ["fork", fork, ["as published", "your copy", "deployer", "a person approves"]],
    ["compose", compose, ["joined"]],
    ["upload", upload, ["not yet received"]],
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
    ["upload", upload],
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
    ["upload", upload],
  ])("%s reserves its box", (_name, markup) => {
    expect(markup).toContain("viewBox=");
    expect(markup).toContain("aspect-ratio:");
  });
});

describe("the drawing a reader gets with no script is the drawing that is true", () => {
  /**
   * `DownloadScene`'s whole argument: the point is shown already at rest, not partway
   * down the guide above it. `FlowLift`'s outer anchor carries the resting position as a
   * static SVG `transform`, so a reader with no JS never sees the pre-drop offset
   * `onScene` sets with `utils.set` — that call only runs once `phase === "shown"`, which
   * `renderToStaticMarkup` never reaches.
   */
  it("download's point sits on the anchor, not above it", () => {
    const anchor = /data-viz="lift-anchor" transform="translate\(([\d.]+) ([\d.]+)\)"><g data-viz="lift" data-viz-id="download-point"/.exec(
      download,
    );
    expect(anchor, "the download point's anchor is missing").not.toBeNull();
    // No inline transform on the `lift` group itself in the static markup — the offset
    // this drawing animates from is written by script, after the point this test reads.
    expect(download).not.toMatch(/data-viz-id="download-point"[^>]*style="[^"]*translate/);
  });

  /**
   * `ComposeScene`'s whole argument, read geometrically rather than by id: the two
   * satellites sit the same distance either side of the point they travel into, and that
   * middle point is the one carrying `data-viz-lit="on"` — the site's own way of marking
   * "this is the result", not a colour invented for this drawing. A future edit that
   * nudged one satellite closer than the other, or lit the wrong point, changes what the
   * drawing means without changing any id a coarser test could key on.
   */
  it("compose's two satellites are equidistant from the one they join", () => {
    const left = /data-viz-id="compose-left"/.exec(compose);
    const right = /data-viz-id="compose-right"/.exec(compose);
    expect(left, "the left satellite is missing").not.toBeNull();
    expect(right, "the right satellite is missing").not.toBeNull();

    const anchors = [...compose.matchAll(/lift-anchor" transform="translate\(([\d.]+) ([\d.]+)\)"><g data-viz="lift" data-viz-id="(compose-left|compose-right)"/g)];
    expect(anchors).toHaveLength(2);
    const byId = Object.fromEntries(anchors.map((m) => [m[3], Number(m[1])]));
    const centre = /<g data-viz="node-anchor" transform="translate\(([\d.]+) ([\d.]+)\)"><g data-viz="node" data-viz-lit="on"/.exec(
      compose,
    );
    expect(centre, "no node in this drawing is lit").not.toBeNull();
    const centreX = Number(centre![1]);
    expect(Math.abs(byId["compose-left"] - centreX)).toBeCloseTo(
      Math.abs(byId["compose-right"] - centreX),
      6,
    );

    // Exactly one lit node — the point everything becomes, not a second one. The shared
    // stylesheet's own selector text contains the literal substring `data-viz-lit="on"`
    // (`FLOW_CSS`'s hover rule), so the match requires the attribute's real prefix,
    // `data-viz="node" `, rather than counting every appearance of the string.
    expect(compose.match(/data-viz="node" data-viz-lit="on"/g)).toHaveLength(1);
  });

  /**
   * `UploadScene`'s whole argument: the one point in this drawing is amber, the colour
   * this site already spends on "not built yet" everywhere else (`ComingSoonBadge`, every
   * `◐ seeded` marker), and never the cyan the other two drawings use for something that
   * works today.
   */
  it("upload's point is amber, not cyan", () => {
    expect(upload).toContain("var(--color-amber)");
    expect(upload).not.toContain("var(--color-cyan)");
  });

  /** The fading trail above upload's point: three ticks, each dimmer than the last, so
      the drawing states "further to go" without animating anything to say it. */
  it("upload's trail fades going up", () => {
    const ticks = [...upload.matchAll(/<line[^>]*stroke-opacity="([\d.]+)"[^>]*><\/line>/g)].map(
      (m) => Number(m[1]),
    );
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < ticks.length; i += 1) expect(ticks[i]).toBeLessThan(ticks[i - 1]);
  });
});
