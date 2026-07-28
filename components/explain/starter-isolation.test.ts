/* ============================================================
   /what-it-isnt — the demonstration, checked against the engine
   that produces it.

   The page argues that isolation is a property of the topology and
   therefore checkable, and it argues it by running `loadBundle` on
   two bundles. This file holds the derivation to what the engine
   actually returns, so the page cannot go on quoting one half of an
   answer after the other half appeared.

   Server-side and build-time, like the module it tests: both reach
   into `lib/content`, which reads `content/` off the disk. That is
   what makes these the archive's real numbers rather than fixtures.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { hasErrors } from "@/lib/core";

import {
  ABSENT_EDGE,
  ADDED_DOT_LINE,
  errorsOf,
  isolationDemo,
} from "./starter-isolation";

const demo = isolationDemo();

describe("the isolation demonstration", () => {
  it("assembles both bundles from the archive", () => {
    expect(demo, "the starter blueprint is not in content/").toBeDefined();
  });

  it("adds exactly the edge the page names", () => {
    expect(ADDED_DOT_LINE).toContain(ABSENT_EDGE.source);
    expect(ADDED_DOT_LINE).toContain(ABSENT_EDGE.target);
  });

  /**
   * The finding this file exists for.
   *
   * `code-builder@1.0.0` declares `cannot: [acceptance-criteria]`. Enforcing `cannot`
   * turned the added edge from a graph that scores badly into a bundle that does not
   * resolve, and `bundle/prohibition-violated` is an error. Before that the leaked variant
   * carried one warning and nothing else, which is why the page was written to quote a
   * security level and stop — so this asserts the new state rather than the old one, on
   * the page whose own header promises it "runs the analyzer on two bundles and quotes
   * it".
   */
  it("computes the prohibition the builder's card declares", () => {
    if (demo === undefined) return;
    const errors = errorsOf(demo.leaked);
    expect(errors.map((d) => d.code)).toContain("bundle/prohibition-violated");
    expect(hasErrors(demo.leaked.diagnostics)).toBe(true);

    const violation = errors.find((d) => d.code === "bundle/prohibition-violated");
    expect(violation).toBeDefined();
    // The engine names the edge, which is what lets the page point at the one line it
    // added rather than at the graph in general.
    expect(violation?.message).toContain(ABSENT_EDGE.source);
    expect(violation?.message).toContain(ABSENT_EDGE.target);
    expect(violation?.message).toContain("acceptance-criteria");
  });

  /**
   * The half that predates the change, kept.
   *
   * The two checks answer the same question independently: one is a rule a card's author
   * wrote about their own node, the other is what the metric reads off a topology nobody
   * declared anything about. The page shows both, so both are asserted here — dropping
   * the security comparison would leave the page arguing from a single check.
   */
  it("still charges criteria-leak on the builder and drops the security reading", () => {
    if (demo === undefined) return;
    const published = demo.published.analysis.security;
    const leaked = demo.leaked.security;
    expect(leaked.level).toBeLessThan(published.level);

    const finding = leaked.findings.find((f) => f.marker === "criteria-leak");
    expect(finding, "criteria-leak no longer fires on the leaked variant").toBeDefined();
    expect(finding?.nodeId).toBe(ABSENT_EDGE.target);
  });

  it("leaves the published bundle clean, so the comparison is between two states", () => {
    if (demo === undefined) return;
    expect(demo.published.analysis.security.findings.map((f) => f.marker)).not.toContain(
      "criteria-leak",
    );
  });
});
