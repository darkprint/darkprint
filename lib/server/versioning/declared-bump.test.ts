import { describe, expect, it } from "vitest";

import type { BumpAnalysis } from "@/lib/core";

import { checkDeclaredBump } from "./declared-bump";

const MAJOR: BumpAnalysis = { level: "major", reasons: ["input `task` was removed"] };
const MINOR: BumpAnalysis = { level: "minor", reasons: ["output `draft` was added"] };
const NONE: BumpAnalysis = { level: "none", reasons: [] };

describe("checkDeclaredBump, satisfied", () => {
  it("is empty when the declared bump matches what is inferred", () => {
    expect(checkDeclaredBump("card", "1.0.0", "2.0.0", MAJOR)).toEqual([]);
  });

  it("is empty when the declared bump is stronger than required", () => {
    expect(checkDeclaredBump("card", "1.0.0", "2.0.0", MINOR)).toEqual([]);
  });

  it("is empty when nothing changed and nothing was declared", () => {
    expect(checkDeclaredBump("card", "1.0.0", "1.0.0", NONE)).toEqual([]);
  });
});

describe("checkDeclaredBump, refused", () => {
  it("refuses a minor declared against a major requirement, naming the reasons", () => {
    const result = checkDeclaredBump("card", "1.0.0", "1.1.0", MAJOR);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("error");
    expect(result[0].code).toBe("card/version-bump-too-small");
    expect(result[0].message).toMatch(/only a minor bump/);
    expect(result[0].hint).toMatch(/input `task` was removed/);
  });

  it("refuses an unchanged version against any real requirement", () => {
    const result = checkDeclaredBump("card", "1.0.0", "1.0.0", MINOR);
    expect(result[0].message).toMatch(/unchanged/);
  });

  it("uses the bundle namespace for a blueprint release", () => {
    const result = checkDeclaredBump("bundle", "1.0.0", "1.0.1", MAJOR);
    expect(result[0].code).toBe("bundle/version-bump-too-small");
  });

  it("suggests the lowest version that would satisfy the requirement", () => {
    const result = checkDeclaredBump("card", "1.2.3", "1.2.4", MAJOR);
    expect(result[0].hint).toMatch(/2\.0\.0/);
  });
});

describe("checkDeclaredBump, an out-of-union subject", () => {
  /* `"ontology"` heads the list because it is the one that CHANGED SIDES. It was a subject
     until 2026-09-05, when the owner had vocabulary versioning removed (§11.0 Q26), and the
     cell above asserting it mapped to `ontology/version-bump-too-small` went with it. A name
     that was accepted yesterday and is refused today is the one an untyped caller is most
     likely to still be passing, so it is held to throwing rather than dropped in silence. */
  it.each(["ontology", "blueprint", "", undefined, null, 0])("throws rather than emit a diagnostic with no code, for %s", (subject) => {
    // @ts-expect-error -- exercising a caller that bypassed the closed union at runtime
    expect(() => checkDeclaredBump(subject, "1.0.0", "1.1.0", MAJOR)).toThrow();
  });
});
