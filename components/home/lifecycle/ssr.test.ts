/* ============================================================
   Spec §1, held to this directory's one remaining drawing.

   "The content must be in the prerendered HTML. Text, YAML, labels
   and headings are real DOM at SSR time; animation only changes
   opacity/transform/stroke of what is already there."

   `renderToStaticMarkup` rather than a DOM: `vitest.config.ts` runs
   this suite under `environment: "node"` on purpose, and the
   question here is what the server writes, which is exactly what
   this function answers.

   ── Why this file shrank to one drawing ──
   `DownloadScene.tsx`, `ComposeScene.tsx` and `UploadScene.tsx` are gone from this
   directory. They went through two rewrites — first from a drawn topology to a single
   glowing point apiece, then off the luminous-flow register entirely, on the author's
   second verdict that the register itself reads as "a blueprint" whatever is drawn
   inside it (see `SectionLifecycle`'s own header for both verdicts, quoted in full). What
   replaced all three is one static, aria-hidden Unicode character in a plain box — no
   `<svg>`, no client component, nothing this file has anything to check.

   `ForkScene.tsx` is the one file left, and it stays checked here even though
   `SectionLifecycle` has never rendered it: it lives in this directory and a different
   page draws it (the blueprint detail page's `ForkAction`), and this suite is about what
   this directory's scenes render at SSR, not about which page currently reaches for
   which file.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ForkScene } from "./ForkScene";

const fork = renderToStaticMarkup(createElement(ForkScene));

describe("the drawing renders its finished state on the server", () => {
  it("carries its labels as text", () => {
    for (const label of ["as published", "your copy", "deployer", "a person approves"]) {
      expect(fork).toContain(label);
    }
  });

  /**
   * `useReveal` reports `static` outside the browser, and `FlowScene` holds a scene at
   * nothing only while it is `armed`. Rendered opaque here, which is what makes the markup
   * above legible rather than merely present.
   */
  it("is not held at nothing", () => {
    expect(fork).toContain("opacity-100");
    expect(fork).not.toContain("opacity-0");
  });

  /**
   * No layout shift (spec §1): the box is reserved by the viewBox and the declared aspect
   * ratio before anything paints, so a drawing arriving does not move the paragraph under
   * it.
   */
  it("reserves its box", () => {
    expect(fork).toContain("viewBox=");
    expect(fork).toContain("aspect-ratio:");
  });
});
