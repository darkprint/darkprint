import { statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("the canonical ontology route", () => {
  it("moves the index to /spec/ontology and preserves term detail routes", async () => {
    expect(statSync(`${ROOT}/app/ontology/page.tsx`, { throwIfNoEntry: false })).toBeUndefined();
    expect(statSync(`${ROOT}/app/ontology/[...term]/page.tsx`, { throwIfNoEntry: false })).toBeDefined();

    const redirects = await nextConfig.redirects?.();
    expect(redirects).toContainEqual({
      source: "/ontology",
      destination: "/spec/ontology",
      permanent: true,
    });
  });

  it("combines the vocabulary catalog, extension model and engine checks", () => {
    const page = readFileSync(`${ROOT}/app/spec/ontology/page.tsx`, "utf8");
    const catalog = readFileSync(`${ROOT}/components/ontology/OntologyCatalog.tsx`, "utf8");

    expect(page).toContain("<OntologyCatalog showHeading={false} />");
    expect(page).toContain("The overlay");
    expect(page).toContain("ONTOLOGY_ROWS");
    expect(catalog).toContain("The five kinds of term");
    expect(catalog).toContain("One curated core, room for local terms");
  });
});
