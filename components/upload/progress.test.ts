/* ============================================================
   The three states, over the folder a reader actually drops.
   ------------------------------------------------------------
   `bundleProgress` exists to keep one sentence off the page — that
   an author who has written three of eight cards has been rejected
   — so the case it has to get right is the one nothing else here
   produces: a real archive bundle with cards TAKEN OUT of it, which
   is what the DarkPrint skill's working directory looks like on its
   way to being finished.

   Everything below is built out of `content/` through the same
   exporter `scripts/generate-bundles.ts` runs, for the reason
   `dropzone.test.ts` gives at length: a fixture that resembles the
   download proves nothing about the download.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  CORE_ONTOLOGY,
  isReleasable,
  isStorable,
  loadBundle,
  ontologyView,
  type Bundle,
} from "@/lib/core";
import { readContent } from "@/lib/content/read";

import { bundleProgress } from "./progress";

/** One archive bundle as `loadBundle` takes it, straight off `content/`. */
function bundleFor(slug: string): Bundle {
  const entry = readContent().find((b) => b.slug === slug);
  expect(entry, `${slug} is not in the archive`).toBeDefined();
  if (entry === undefined) throw new Error("unreachable");
  const cardFiles: Record<string, string> = {};
  for (const card of entry.cardFiles) cardFiles[card.file] = card.text;
  return { manifest: entry.blueprint.manifest, dot: entry.blueprint.dot, cardFiles };
}

/** The same bundle with `keep` of its card files left in it, in filename order. */
function truncated(slug: string, keep: number): Bundle {
  const whole = bundleFor(slug);
  const names = Object.keys(whole.cardFiles).sort();
  const cardFiles: Record<string, string> = {};
  for (const name of names.slice(0, keep)) cardFiles[name] = whole.cardFiles[name];
  return { ...whole, cardFiles };
}

const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/**
 * The blueprint this file is written over.
 *
 * It resolves against the curated core alone — no `extensions.yaml`, which is what the
 * wizard builds its view from (`UploadFlow`'s `viewFor`) — so the finished case below is
 * genuinely clean rather than clean-except-for-two-unknown-terms. `frontline-triage` is
 * the one bundle that would not be, and its own vocabulary is why.
 */
const SLUG = "starter-software-factory";

describe("a bundle that is finished", () => {
  it("resolves, with every node carrying its card", () => {
    const progress = bundleProgress(loadBundle(bundleFor(SLUG), { ontology: ONTOLOGY }));
    expect(progress.state).toBe("resolves");
    expect(progress.waiting).toBe(0);
    expect(progress.placed).toBe(progress.total);
    // A floor rather than a count: this holds the arithmetic to a graph with nodes in it,
    // not the archive to a shape.
    expect(progress.total).toBeGreaterThan(1);
  });
});

describe("a bundle that is still being written", () => {
  /**
   * The skill's ordinary output halfway through: the topology whole, some of the cards
   * written. Every complaint is one node with no card behind it, which is the state the
   * word "unfinished" exists for.
   */
  it("reads as unfinished, and counts the cards that are there", () => {
    const whole = bundleProgress(loadBundle(bundleFor(SLUG), { ontology: ONTOLOGY }));
    const result = loadBundle(truncated(SLUG, 2), { ontology: ONTOLOGY });
    const progress = bundleProgress(result);

    expect(progress.state).toBe("unfinished");
    expect(progress.total).toBe(whole.total);
    expect(progress.placed).toBe(2);
    expect(progress.waiting).toBe(whole.total - 2);
    // The premise the whole state rests on: the engine really did raise errors, and one
    // per node it could not open. What else they drag behind them is the third suite.
    expect(
      result.diagnostics.filter((d) => d.code === "bundle/missing-card"),
    ).toHaveLength(progress.waiting);
  });

  it("still reads as unfinished with nothing but the topology in the folder", () => {
    const progress = bundleProgress(loadBundle(truncated(SLUG, 0), { ontology: ONTOLOGY }));
    expect(progress.state).toBe("unfinished");
    expect(progress.placed).toBe(0);
    expect(progress.waiting).toBe(progress.total);
  });
});

describe("a bundle with something actually wrong in it", () => {
  it("is rejected when the DOT does not parse", () => {
    const progress = bundleProgress(
      loadBundle({ ...bundleFor(SLUG), dot: "digraph {" }, { ontology: ONTOLOGY }),
    );
    expect(progress.state).toBe("rejected");
    expect(progress.total).toBe(0);
  });

  it("stays unfinished when a contradiction joins the absences (D-109)", () => {
    /* This cell asserted `rejected` until the owner's 2026-08-30 ruling split the gate by
       lifecycle stage. A port that does not fit is DarkPrint comparing two things the author
       wrote, `gate.ts`'s rule 4 forbids an inference from refusing anybody's work, and the
       reading is now printed beside the bundle instead of used to withhold it. The bundle is
       still `unfinished`, because three of its five nodes have no card — which is what makes
       this cell discriminating rather than merely updated: it fails if the port mismatch
       drags the state DOWN to rejected, and it fails equally if the missing cards stop
       holding it BELOW resolves. The edge is `builder -> tester`, whose two cards are both in
       the truncated folder: the resolver skips port checks on an edge with an unresolved end,
       so pinning a port on any other edge here would produce no diagnostic at all. */
    const whole = bundleFor(SLUG);
    const edge = /builder\s*->\s*tester\s*\[/;
    expect(edge.test(whole.dot), "the starter no longer wires builder into tester").toBe(true);
    const dot = whole.dot.replace(edge, 'builder -> tester [out="no-such-port", ');
    const result = loadBundle({ ...truncated(SLUG, 2), dot }, { ontology: ONTOLOGY });
    expect(
      result.diagnostics.some((d) => d.code === "bundle/port-mismatch"),
      "the pinned port was accepted, so this case never happened",
    ).toBe(true);
    const progress = bundleProgress(result);
    expect(progress.state).toBe("unfinished");
    // Both halves of the reading, so neither can drift silently: storable despite the
    // contradiction, and not releasable while the cards are missing.
    expect(isStorable(result.diagnostics)).toBe(true);
    expect(isReleasable(result.diagnostics)).toBe(false);
  });
});

describe("the errors an unwritten card drags behind it", () => {
  /**
   * The case this module was rewritten for. `acceptance-tester` is in the folder and
   * declares a dependency on `spec-planner`, which is not — so `bundle/missing-dependency`
   * fires on a card the author has finished, about a card they have not started.
   * Classifying that as a defect made three of the archive's own bundles read as broken
   * the moment two files were taken out of them.
   */
  it("counts a dependency unmet by an uncarded predecessor as part of the absence", () => {
    const result = loadBundle(truncated(SLUG, 2), { ontology: ONTOLOGY });
    const codes = result.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
    expect(codes).toContain("bundle/missing-dependency");
    expect(bundleProgress(result).state).toBe("unfinished");
  });

  it("keeps it an error, and publishes it, once every node has its card (D-109)", () => {
    /* The same code, with nothing absent to explain it: the whole folder, and one edge
       removed so a declared dependency genuinely has no path into the node.

       This asserted `rejected` before the 2026-08-30 ruling. The diagnostic has not moved
       and is asserted below at error severity exactly as before — what changed is that a
       genuine unmet dependency is a finding on a complete blueprint rather than a refusal to
       hold or publish it. The severity assertion is what keeps this cell honest: if the
       engine ever stopped reporting the defect, this would fail rather than quietly agree. */
    const whole = bundleFor(SLUG);
    const dot = whole.dot.replace(/^\s*planner\s*->\s*tester.*$/m, "");
    const result = loadBundle({ ...whole, dot }, { ontology: ONTOLOGY });
    const unmet = result.diagnostics.filter((d) => d.code === "bundle/missing-dependency");
    expect(unmet.length, "removing the edge did not leave a dependency unmet").toBeGreaterThan(0);
    expect(unmet.every((d) => d.severity === "error")).toBe(true);
    const progress = bundleProgress(result);
    expect(progress.waiting).toBe(0);
    expect(progress.state).toBe("resolves");
    expect(isReleasable(result.diagnostics)).toBe(true);
  });
});
