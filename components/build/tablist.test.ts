// components/build/tablist.test.ts
import { describe, expect, it } from "vitest";

import { nextTabIndex } from "./tablist";

describe("nextTabIndex", () => {
  describe('orientation "both" — BuildPanes.tsx\'s own tablist', () => {
    it("moves forward on ArrowDown and on ArrowRight", () => {
      expect(nextTabIndex("ArrowDown", 1, 4, "both")).toBe(2);
      expect(nextTabIndex("ArrowRight", 1, 4, "both")).toBe(2);
    });

    it("moves backward on ArrowUp and on ArrowLeft", () => {
      expect(nextTabIndex("ArrowUp", 2, 4, "both")).toBe(1);
      expect(nextTabIndex("ArrowLeft", 2, 4, "both")).toBe(1);
    });
  });

  describe('orientation "horizontal" — WorkspaceStage.tsx\'s and InstallTabs.tsx\'s tablists', () => {
    it("moves forward on ArrowRight only", () => {
      expect(nextTabIndex("ArrowRight", 1, 5, "horizontal")).toBe(2);
    });

    it("moves backward on ArrowLeft only", () => {
      expect(nextTabIndex("ArrowLeft", 1, 5, "horizontal")).toBe(0);
    });

    it("does not bind ArrowUp or ArrowDown", () => {
      expect(nextTabIndex("ArrowUp", 1, 5, "horizontal")).toBeUndefined();
      expect(nextTabIndex("ArrowDown", 1, 5, "horizontal")).toBeUndefined();
    });
  });

  describe('orientation "vertical"', () => {
    it("moves forward on ArrowDown only", () => {
      expect(nextTabIndex("ArrowDown", 0, 3, "vertical")).toBe(1);
    });

    it("moves backward on ArrowUp only", () => {
      expect(nextTabIndex("ArrowUp", 1, 3, "vertical")).toBe(0);
    });

    it("does not bind ArrowLeft or ArrowRight", () => {
      expect(nextTabIndex("ArrowLeft", 1, 3, "vertical")).toBeUndefined();
      expect(nextTabIndex("ArrowRight", 1, 3, "vertical")).toBeUndefined();
    });
  });

  it("Home always jumps to index 0", () => {
    expect(nextTabIndex("Home", 3, 5, "both")).toBe(0);
    expect(nextTabIndex("Home", 0, 5, "horizontal")).toBe(0);
  });

  it("End always jumps to the last index", () => {
    expect(nextTabIndex("End", 0, 5, "both")).toBe(4);
    expect(nextTabIndex("End", 2, 5, "horizontal")).toBe(4);
  });

  it("wraps forward past the last index back to 0", () => {
    expect(nextTabIndex("ArrowRight", 4, 5, "horizontal")).toBe(0);
  });

  it("wraps backward past index 0 to the last index", () => {
    expect(nextTabIndex("ArrowLeft", 0, 5, "horizontal")).toBe(4);
  });

  it("answers every bound key with its own single index when length is 1", () => {
    // The docblock's own claim: a tablist of one tab answers every arrow key with its own
    // single index rather than cycling through a negative or an out-of-range one.
    expect(nextTabIndex("ArrowRight", 0, 1, "horizontal")).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 1, "horizontal")).toBe(0);
    expect(nextTabIndex("Home", 0, 1, "horizontal")).toBe(0);
    expect(nextTabIndex("End", 0, 1, "horizontal")).toBe(0);
  });

  it("is total for length 0 — returns undefined rather than NaN", () => {
    // `x % 0` is `NaN` for every `x`; the explicit `length <= 0` guard is what keeps the
    // function's own "total" claim true rather than leaking a NaN index to the caller.
    expect(nextTabIndex("ArrowRight", 0, 0, "horizontal")).toBeUndefined();
    expect(nextTabIndex("Home", 0, 0, "horizontal")).toBeUndefined();
    expect(nextTabIndex("End", 0, 0, "both")).toBeUndefined();
  });

  it("returns undefined for a key this tablist does not bind at all", () => {
    expect(nextTabIndex("Escape", 1, 5, "both")).toBeUndefined();
    expect(nextTabIndex("a", 1, 5, "both")).toBeUndefined();
    expect(nextTabIndex("Tab", 1, 5, "horizontal")).toBeUndefined();
  });
});
