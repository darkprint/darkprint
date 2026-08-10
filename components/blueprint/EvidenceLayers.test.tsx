import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { plainText } from "@/components/ui/visible-text";
import { EvidenceLayers } from "./EvidenceLayers";

describe("EvidenceLayers", () => {
  it("keeps structural, community, and run provenance separate", () => {
    const blueprint = allBlueprints()[0];
    if (blueprint === undefined) throw new Error("the fixture archive is empty");
    const text = plainText(
      renderToStaticMarkup(createElement(EvidenceLayers, { blueprint })),
    );
    expect(text).toContain("Structural evidence");
    expect(text).toContain("Community assessment");
    expect(text).toContain("Run evidence");
    expect(text).toContain("insufficient sample");
    expect(text).toContain("no verified runs");
    expect(text).toContain("not a security audit");
  });
});
