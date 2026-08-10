import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CreateEntry, briefFor } from "./CreateEntry";

describe("CreateEntry", () => {
  it("starts from the goal and asks the authoring agent not to guess", () => {
    const brief = briefFor("triage incidents");
    expect(brief).toContain("Create a DarkPrint blueprint for: triage incidents");
    expect(brief).toContain("asking before you guess");
    expect(brief).toContain("human checkpoint");
    expect(brief).toContain("must never receive");
    expect(brief).toContain("validating the bundle");
  });

  it("renders both the authoring-skill and client-agnostic paths", () => {
    const html = renderToStaticMarkup(createElement(CreateEntry));
    expect(html).toContain("Start with your goal");
    expect(html).toContain("Works in any agent client");
    expect(html).toContain('href="/skill"');
    expect(html).toContain('id="blueprint-goal"');
  });
});
