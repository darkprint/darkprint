import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ALL_COMBINATIONS } from "@/components/build/choices";
import { buildState } from "@/components/build/state";
import { ScorePanel, ScoreStrip } from "@/components/build/ScorePanel";

const state = buildState(ALL_COMBINATIONS[0], false);
const autonomy = state.analysis?.autonomy;
if (autonomy === undefined) {
  throw new Error("fixture combination did not resolve an autonomy reading");
}

describe("ScorePanel shows the segmented autonomy gauge alongside the class label", () => {
  it("renders AutonomyBar's accessible name for the real reading", () => {
    const html = renderToStaticMarkup(createElement(ScorePanel, { autonomy }));
    expect(html).toContain(
      `Autonomy class ${autonomy.label}, level ${autonomy.level} of 4`,
    );
  });

  it("renders nothing extra when there is no resolved autonomy", () => {
    const html = renderToStaticMarkup(createElement(ScorePanel, {}));
    expect(html).toContain("No graph resolved, so nothing was counted.");
    expect(html).not.toContain("Autonomy class");
  });
});

describe("ScoreStrip shows the same gauge in its compact form", () => {
  it("renders AutonomyBar's accessible name for the real reading", () => {
    const html = renderToStaticMarkup(createElement(ScoreStrip, { autonomy }));
    expect(html).toContain(
      `Autonomy class ${autonomy.label}, level ${autonomy.level} of 4`,
    );
  });
});
