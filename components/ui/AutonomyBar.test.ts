import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AutonomyBar } from "@/components/ui/AutonomyBar";
import { plainText } from "@/components/ui/visible-text";

const LEVEL_COLOR = {
  1: "--color-violet",
  2: "--color-amber",
  3: "--color-cyan",
  4: "--color-emerald",
} as const;

function render(level: 1 | 2 | 3 | 4, label: string): string {
  return renderToStaticMarkup(createElement(AutonomyBar, { level, label }));
}

describe("AutonomyBar", () => {
  it("names the class and the level in its accessible text", () => {
    const html = render(3, "Conditional");
    expect(plainText(html)).toContain("Conditional");
    expect(html).toContain('aria-label="Autonomy class Conditional, level 3 of 4"');
  });

  it("fills exactly the segments up to and including the level, each in its own color", () => {
    const html = render(3, "Conditional");
    // Segments 1-3 (violet, amber, cyan) are filled; segment 4 (emerald) is not.
    expect(html).toContain(LEVEL_COLOR[1]);
    expect(html).toContain(LEVEL_COLOR[2]);
    expect(html).toContain(LEVEL_COLOR[3]);
    expect(html).not.toContain(LEVEL_COLOR[4]);
  });

  it("fills only the first segment at level 1", () => {
    const html = render(1, "Assisted");
    expect(html).toContain(LEVEL_COLOR[1]);
    expect(html).not.toContain(LEVEL_COLOR[2]);
    expect(html).not.toContain(LEVEL_COLOR[3]);
    expect(html).not.toContain(LEVEL_COLOR[4]);
  });

  it("fills all four segments at level 4", () => {
    const html = render(4, "Closed-loop");
    expect(html).toContain(LEVEL_COLOR[1]);
    expect(html).toContain(LEVEL_COLOR[2]);
    expect(html).toContain(LEVEL_COLOR[3]);
    expect(html).toContain(LEVEL_COLOR[4]);
  });

  it("never renders the alarm/signal color", () => {
    for (const level of [1, 2, 3, 4] as const) {
      const html = render(level, "x");
      expect(html).not.toContain("--color-signal");
      expect(html).not.toContain("text-signal");
    }
  });
});
