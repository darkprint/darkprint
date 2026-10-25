import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BlueprintFilesMotion } from "./BlueprintFilesMotion";
import type { RevealPhase } from "@/components/viz/useReveal";

const mock = vi.hoisted(() => ({ phase: "static" as RevealPhase }));
vi.mock("@/components/viz/useReveal", () => ({
  useReveal: () => ({ ref: { current: null }, phase: mock.phase }),
}));

const css = readFileSync(new URL("./SectionBlueprintFiles.module.css", import.meta.url), "utf8");

describe("blueprint graph and card motion", () => {
  it("adds motion only after entry and keeps the complete content in every phase", () => {
    for (const phase of ["static", "armed", "shown"] as const) {
      mock.phase = phase;
      const html = renderToStaticMarkup(
        <BlueprintFilesMotion className="workbench"><p>Code Builder card and graph</p></BlueprintFilesMotion>,
      );
      expect(html).toContain("Code Builder card and graph");
      expect(html.includes('data-blueprint-motion="playing"'), `motion activation in ${phase}`).toBe(phase === "shown");
      expect(html).not.toMatch(/hidden|opacity-0|aria-hidden/);
    }
  });

  it("gates every decorative animation behind the reduced-motion preference", () => {
    const media = "@media (prefers-reduced-motion: no-preference)";
    const start = css.indexOf(media);
    expect(start, "all workbench motion must respect reduced motion").toBeGreaterThanOrEqual(0);
    const open = css.indexOf("{", start);
    let depth = 1;
    let end = open + 1;
    while (depth > 0 && end < css.length) {
      if (css[end] === "{") depth++;
      if (css[end] === "}") depth--;
      end++;
    }
    expect(depth).toBe(0);
    const outside = css.slice(0, start) + css.slice(end);
    expect(outside, "animation declarations must stay inside the motion gate").not.toMatch(/\banimation(?:-[a-z-]+)?\s*:/);
    expect(css.slice(open, end)).toContain("animation: trace-work");
    expect(css, "labels and base graph must never disappear for animation").not.toMatch(/opacity\s*:\s*0(?:\s|;|\})|visibility\s*:\s*hidden|display\s*:\s*none/);
  });
});
