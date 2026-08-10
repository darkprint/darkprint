import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync(join(process.cwd(), "app/reading-the-radar/page.tsx"), "utf8");

describe("the radar documentation page", () => {
  it("shows the real radar at its phone and desktop geometry", () => {
    expect(PAGE).toContain("<ScoreRadar");
    expect(PAGE).toContain("render={285}");
    expect(PAGE).toContain("render={480}");
  });

  it("documents the missing autonomy spoke, provenance, and arithmetic", () => {
    expect(PAGE).toContain("Autonomy has no spoke");
    expect(PAGE).toContain("<SourceBadge");
    expect(PAGE).toContain("<ScoringModel");
  });
});
