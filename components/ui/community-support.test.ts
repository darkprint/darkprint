import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { downloadsFor, starsFor } from "@/lib/data/node-community";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("community support on detail pages", () => {
  it("puts the seeded blueprint support count beside the title", () => {
    const source = readFileSync(`${ROOT}/app/blueprints/[slug]/page.tsx`, "utf8");
    expect(source).toContain("count={bp.votes}");
    expect(source).toMatch(/<h1[\s\S]*?<FavoriteStar[\s\S]*?count=\{bp\.votes\}/);
  });

  it("puts the seeded node support count beside the title", () => {
    const source = readFileSync(`${ROOT}/app/nodes/[...id]/page.tsx`, "utf8");
    expect(source).toContain("const stars = starsFor(card.id)");
    expect(source).toMatch(/<h1[\s\S]*?<FavoriteStar[\s\S]*?count=\{stars\}/);
  });

  it("keeps an unknown node at zero support", () => {
    expect(downloadsFor("not-in-the-archive")).toBe(0);
    expect(starsFor("not-in-the-archive")).toBe(0);
  });
});
