import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { McpJourney } from "./McpJourney";

describe("McpJourney", () => {
  it("renders least-privilege setup, recovery, search, provenance, and exact-release actions", () => {
    const html = renderToStaticMarkup(
      createElement(McpJourney, {
        results: [
          {
            slug: "starter-software-factory",
            title: "Starter Software Factory",
            summary: "A separated software workflow.",
            digest: "sha256:1234567890abcdef",
            author: "darkprint",
          },
        ],
      }),
    );
    expect(html).toContain("registry:read");
    expect(html).toContain("Private workspaces");
    expect(html).toContain("Show failure recovery");
    expect(html).toContain("Search registry");
    expect(html).toContain("Inspect and fetch this exact release");
    expect(html).toContain("Digest");
  });
});
