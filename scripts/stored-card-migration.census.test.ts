import { describe, expect, it } from "vitest";
import {
  cardIdOf,
  classifyStoredRef,
  expectedTotalsFrom,
  prohibitionsConserved,
} from "./stored-card-migration";

const ARCHIVE = new Set(["spec-planner@1.0.0", "intent-router@1.1.0", "intent-router@2.1.0", "schema-gate@1.0.0"]);

describe("classifyStoredRef", () => {
  it("names a ref the archive still carries", () => {
    expect(classifyStoredRef("spec-planner@1.0.0", ARCHIVE)).toBe("archive");
  });

  it("names a ref the archive has bumped past, at any version of the same id", () => {
    expect(classifyStoredRef("intent-router@2.0.0", ARCHIVE)).toBe("superseded");
    expect(classifyStoredRef("intent-router@1.0.0", ARCHIVE)).toBe("superseded");
    expect(classifyStoredRef("schema-gate@0.9.0", ARCHIVE)).toBe("superseded");
  });

  it("names a ref whose id the archive has never had", () => {
    expect(classifyStoredRef("alessandro-smoke-checker@1.0.0", ARCHIVE)).toBe("database-only");
  });

  it("does not let a shared prefix pass for the same id", () => {
    expect(classifyStoredRef("spec@1.0.0", ARCHIVE)).toBe("database-only");
    expect(classifyStoredRef("spec-planner-v2@1.0.0", ARCHIVE)).toBe("database-only");
  });
});

describe("cardIdOf", () => {
  it("splits on the last @, so a scoped id keeps its namespace", () => {
    expect(cardIdOf("intent-router@2.0.0")).toBe("intent-router");
    expect(cardIdOf("lupo/pii-guard@1.0.0")).toBe("lupo/pii-guard");
    expect(cardIdOf("no-version")).toBe("no-version");
  });
});

describe("prohibitionsConserved", () => {
  const before = { cannot: ["acceptance-criteria", "Never merges without review.", "Does not call paid APIs."] };

  it("holds when every old entry is in the new cannot or the new willNot", () => {
    const after = { cannot: ["acceptance-criteria"], willNot: ["Never merges without review.", "Does not call paid APIs."] };
    expect(prohibitionsConserved(before, after)).toBe(true);
  });

  it("fails when an entry was deleted instead of moved", () => {
    const after = { cannot: ["acceptance-criteria"], willNot: ["Never merges without review."] };
    expect(prohibitionsConserved(before, after)).toBe(false);
  });

  it("fails when an entry appeared from nowhere, or was reworded", () => {
    expect(prohibitionsConserved(before, { cannot: ["acceptance-criteria"], willNot: ["Never merges without review.", "Does not call paid APIs.", "Extra."] })).toBe(false);
    expect(prohibitionsConserved(before, { cannot: ["acceptance-criteria"], willNot: ["Never merges without review", "Does not call paid APIs."] })).toBe(false);
  });

  it("treats an absent list as empty on both sides", () => {
    expect(prohibitionsConserved({}, { cannot: [], willNot: [] })).toBe(true);
    expect(prohibitionsConserved({ cannot: [] }, {})).toBe(true);
    expect(prohibitionsConserved({ cannot: ["x"] }, {})).toBe(false);
  });
});

describe("expectedTotalsFrom", () => {
  it("counts rows from the plan and entries from the bodies about to be written", () => {
    const plan = [
      { newBody: { cannot: ["acceptance-criteria"], willNot: ["a", "b"] } },
      { newBody: { cannot: [], willNot: ["c"] } },
      { newBody: { cannot: [], willNot: [] } },
    ];
    expect(expectedTotalsFrom(plan, 9)).toEqual({ cardVersions: 3, releases: 9, cannotEntries: 1, willNotEntries: 3 });
  });

  it("is zero for an empty plan rather than undefined", () => {
    expect(expectedTotalsFrom([], 0)).toEqual({ cardVersions: 0, releases: 0, cannotEntries: 0, willNotEntries: 0 });
  });
});
