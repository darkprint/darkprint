import { describe, expect, it } from "vitest";
import { compareSummary, rankOf, summarise } from "./rag-eval.metrics";

describe("retrieval evaluation measurements", () => {
  it("does not call a distinct rank a delivered rank", () => {
    const keys = ["a", "a", "b", "b", "c", "target"];
    expect(rankOf(keys, "target")).toBe(4);
    expect(rankOf(keys, "target", false)).toBe(6);
    expect(summarise([rankOf(keys, "target", false)]).recallAt5).toBe(0);
  });

  it("counts absent targets as zero reciprocal rank", () => {
    expect(summarise([1, 5, 6, undefined])).toEqual({ n: 4, recallAt5: 2, top1: 1, top3: 1, mrr: 0.3417 });
    expect(rankOf([], "missing")).toBeUndefined();
  });

  it("rejects an MRR regression even with unchanged recall counts", () => {
    expect(compareSummary("cards", summarise([1, 2]), summarise([1, 3]))).toEqual(["cards.mrr 0.75 -> 0.6667"]);
  });

  it("rejects incomparable sample sizes instead of passing larger sets by count", () => {
    expect(compareSummary("cards", summarise([1]), summarise([1, 1]))).toEqual([
      "cards.n 1 -> 2: incomparable evaluation sets",
    ]);
  });
});
