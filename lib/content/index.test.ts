import { describe, expect, it } from "vitest";

import { AUTONOMY_LABELS } from "@/lib/format";
import { AUTHOR_LIST } from "@/lib/data/users";
import { COMMUNITY } from "@/lib/data/community";
import { parseCardRef } from "@/lib/core";
import type { MetricKey } from "@/lib/types";

import {
  allBlueprints,
  allNodeCards,
  bundleSource,
  cardSource,
  getBlueprintBySlug,
  getNodeCard,
  getOntologyView,
  getRegistry,
  nodeCardVersions,
} from "./index";

const SLUGS = [
  "adversarial-consensus-line",
  "checkpoint-resume-runner",
  "frontline-triage",
  "grounded-research-desk",
  "guarded-merge-bot",
  "incident-commander",
  "nightly-data-janitor",
  "schema-forge-etl",
  // Doc 2 §5.2's canonical factory, and the only bundle in the archive that gives doc 3
  // §4.1's `criteria-leak` check something to anchor on: `spec-planner` is the one card
  // declaring an `acceptance-criteria` output port.
  "starter-software-factory",
];

const METRIC_ORDER: MetricKey[] = [
  "autonomy",
  "efficacy",
  "reliability",
  "transparency",
  "cost",
  "security",
];

const blueprints = allBlueprints();

describe("allBlueprints", () => {
  it("resolves all nine, sorted by slug", () => {
    expect(blueprints.map((b) => b.slug)).toEqual(SLUGS);
  });

  it("is memoized", () => {
    expect(allBlueprints()).toBe(blueprints);
    expect(getBlueprintBySlug("incident-commander")).toBe(
      blueprints.find((b) => b.slug === "incident-commander"),
    );
  });

  it("reports no error-severity diagnostic anywhere in the archive", () => {
    for (const bp of blueprints) {
      expect(bp.analysis?.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    }
  });

  // The archive ships clean on both counts. A warning is not fatal to the build, so
  // nothing else would catch one drifting in — which is exactly why it is asserted
  // here rather than left to the loader's error check. The wiring that carries a
  // resolver diagnostic into the view model is exercised in `view.test.ts`, against a
  // bundle built to be broken, so this stays a statement about the content.
  it("resolves every bundle with no diagnostic at all — no errors, no warnings", () => {
    for (const bp of blueprints) {
      expect([bp.slug, bp.analysis?.diagnostics.map((d) => `${d.severity} ${d.code}`)]).toEqual([
        bp.slug,
        [],
      ]);
    }
  });

  it("carries complete narrative metadata", () => {
    for (const bp of blueprints) {
      expect(bp.kind).toBe("blueprint");
      expect(bp.title.trim()).not.toBe("");
      expect(bp.summary.trim()).not.toBe("");
      expect(bp.description.trim()).not.toBe("");
      expect(bp.category.trim()).not.toBe("");
      expect(bp.tags.length).toBeGreaterThan(0);
      expect(bp.tags.every((t) => t.trim() !== "")).toBe(true);
      expect(bp.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(bp.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("attributes every blueprint to a real author", () => {
    const known = new Set(AUTHOR_LIST.map((a) => a.username));
    for (const bp of blueprints) expect(known).toContain(bp.author.username);
  });
});

describe("derived metrics", () => {
  it("carries the six metrics, in order, with finite values on the 0–100 axis", () => {
    for (const bp of blueprints) {
      expect(bp.metrics.map((m) => m.key)).toEqual(METRIC_ORDER);
      for (const metric of bp.metrics) {
        expect(Number.isFinite(metric.value)).toBe(true);
        expect(Number.isInteger(metric.value)).toBe(true);
        expect(metric.value).toBeGreaterThanOrEqual(0);
        expect(metric.value).toBeLessThanOrEqual(100);
        expect(metric.label.trim()).not.toBe("");
        expect(metric.detail.trim()).not.toBe("");
      }
    }
  });

  it("derives the two static metrics from the engine and nothing else", () => {
    for (const bp of blueprints) {
      const analysis = bp.analysis;
      expect(analysis).toBeDefined();
      if (analysis === undefined) return;

      const autonomy = bp.metrics[0];
      expect(autonomy.source).toBe("auto");
      expect(autonomy.value).toBe(Math.round(analysis.autonomy.fraction * 100));
      expect(autonomy.detail).toBe(analysis.autonomy.rationale);

      const security = bp.metrics[5];
      expect(security.source).toBe("auto");
      const clamped = Math.min(Math.max(analysis.security.raw, 0), 4);
      expect(security.value).toBe(Math.round((clamped / 4) * 100));
      expect(security.detail).toBe(analysis.security.rationale);
    }
  });

  it("takes the subjective and measured metrics from the index, unchanged", () => {
    for (const bp of blueprints) {
      const row = COMMUNITY[bp.slug];
      expect(bp.metrics[1].value).toBe(row.efficacy);
      expect(bp.metrics[2].value).toBe(row.reliability);
      expect(bp.metrics[3].value).toBe(row.transparency);
      expect(bp.metrics[4].value).toBe(row.cost);
      expect(bp.downloads).toBe(row.downloads);
      expect(bp.votes).toBe(row.votes);
      expect(bp.comments).toEqual(row.comments);
    }
  });

  it("labels the autonomy level from the shared map", () => {
    for (const bp of blueprints) {
      expect(bp.autonomy.level).toBe(bp.analysis?.autonomy.level);
      expect(bp.autonomy.label).toBe(AUTONOMY_LABELS[bp.autonomy.level]);
      expect(bp.autonomy.blurb.trim()).not.toBe("");
    }
  });
});

describe("the React Flow seeds", () => {
  it("gives every node a label, a kind and a finite position", () => {
    for (const bp of blueprints) {
      expect(bp.graph.nodes.length).toBeGreaterThan(0);
      for (const node of bp.graph.nodes) {
        expect(node.id.trim()).not.toBe("");
        expect(node.label.trim()).not.toBe("");
        expect(Number.isFinite(node.position.x)).toBe(true);
        expect(Number.isFinite(node.position.y)).toBe(true);
        if (node.sub !== undefined) expect(node.sub.trim()).not.toBe("");
      }
      const ids = bp.graph.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("keeps both endpoints of every edge inside the node set", () => {
    for (const bp of blueprints) {
      const ids = new Set(bp.graph.nodes.map((n) => n.id));
      for (const edge of bp.graph.edges) {
        expect(ids).toContain(edge.source);
        expect(ids).toContain(edge.target);
      }
      const edgeIds = bp.graph.edges.map((e) => e.id);
      expect(new Set(edgeIds).size).toBe(edgeIds.length);
    }
  });

  /**
   * Rewritten for ontology v0.1. The old assertion was "every line opens on a `start`",
   * which held while the vocabulary had a `trigger` type; v0.1 folded intake into the
   * deterministic `tool` type (there are six types now, and `trigger` is not one of
   * them), so no card in the archive can declare itself the opening any more. What is
   * still true — and is what the assertion was really about — is that every blueprint
   * has an entry with nothing upstream of it and closes on a delivery the schematic
   * draws as `ship`, which `agentNodeKind` derives from being terminal rather than
   * from the type.
   *
   * The gap this used to record — that `start` had become unreachable — is closed:
   * `placeTool` now recovers it from position, the same way it recovers `ship`. The
   * assertion below stays topological anyway, because that is the property that holds
   * regardless of which glyph the seam picks for either end.
   */
  it("closes on a delivery, and its entry node has nothing upstream", () => {
    for (const bp of blueprints) {
      expect([bp.slug, bp.graph.nodes.some((n) => n.kind === "ship")]).toEqual([bp.slug, true]);

      const targets = new Set(bp.graph.edges.map((e) => e.target));
      const entries = bp.graph.nodes.filter((n) => !targets.has(n.id));
      expect([bp.slug, entries.length > 0]).toEqual([bp.slug, true]);
    }
  });

  it("draws every node with a kind ontology v0.1 can actually produce", () => {
    // `planner`, `negotiator`, `retry` and `memory` are the four kinds nothing can reach:
    // v0.1 has no term for the first two, and folded `control` and `memory` into `tool`.
    // They are the "deliberate losses" `lib/graph-seed.ts` records, and this is the assertion
    // that keeps them out of the archive.
    //
    // `human-input` is off the list for a different reason: it is reachable — doc 3 §3's
    // `human-input` type draws as it — but no card in the archive declares that type
    // today, so no blueprint here produces one. It goes on the list the moment one does.
    //
    // `start` is NOT one of them, though it was while this file was written. Like `ship` it
    // comes from the topology rather than the type: `placeTool` reads a tool-family node's
    // position, and a node with nothing upstream is the intake the run starts from. Pinned
    // directly in `view.test.ts`.
    const REACHABLE = new Set(["start", "executor", "verifier", "router", "gate", "tool", "ship"]);
    for (const bp of blueprints) {
      for (const node of bp.graph.nodes) {
        expect([bp.slug, node.id, REACHABLE.has(node.kind)]).toEqual([bp.slug, node.id, true]);
      }
    }
  });

  it("draws the failure paths and the loop-closing edges differently from data flow", () => {
    const adversarial = getBlueprintBySlug("adversarial-consensus-line");
    const variant = (source: string, target: string) =>
      adversarial?.graph.edges.find((e) => e.source === source && e.target === target)?.variant;

    expect(variant("task", "plan")).toBe("flow");
    expect(variant("verify", "reopen")).toBe("fallback");
    expect(variant("reopen", "vote")).toBe("control");
    // A verdict is a control signal even where the DOT says nothing about style.
    expect(
      getBlueprintBySlug("guarded-merge-bot")?.graph.edges.find((e) => e.source === "gate")?.variant,
    ).toBe("control");
  });

  it("lays the layers out left to right with no node stacked on another", () => {
    for (const bp of blueprints) {
      const seen = new Set<string>();
      for (const node of bp.graph.nodes) {
        const key = `${node.position.x},${node.position.y}`;
        expect(seen).not.toContain(key);
        seen.add(key);
      }
      const xs = bp.graph.nodes.map((n) => n.position.x);
      expect(Math.min(...xs)).toBe(0);
      expect(Math.max(...xs)).toBeGreaterThan(0);
    }
  });

  it("ships the real DOT source, not a paraphrase", () => {
    for (const bp of blueprints) {
      expect(bp.graph.dot).toBe(bundleSource(bp.slug).dot);
      expect(bp.graph.dot).toContain("digraph");
      expect(bp.graph.dot).toContain("card=");
    }
  });
});

describe("requirements", () => {
  it("lists the agents and tools the graph actually asks for", () => {
    for (const bp of blueprints) {
      expect(bp.requiredAgents.length).toBeGreaterThan(0);
      expect(new Set(bp.requiredAgents).size).toBe(bp.requiredAgents.length);
      expect(bp.requiredAgents.every((a) => a.trim() !== "")).toBe(true);
      expect(new Set(bp.requiredTools).size).toBe(bp.requiredTools.length);
      expect(bp.requiredTools.every((t) => t.trim() !== "")).toBe(true);
    }

    // Tool ids come back as their ontology labels, not their raw term ids.
    expect(getBlueprintBySlug("incident-commander")?.requiredTools).toContain("Shell");
    expect(getBlueprintBySlug("grounded-research-desk")?.requiredTools).toContain("Web search");
  });
});

describe("archive identity", () => {
  it("carries a bundle digest and the refs it pins, in graph order", () => {
    const digests = new Set<string>();
    for (const bp of blueprints) {
      expect(bp.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      digests.add(bp.digest ?? "");

      const refs = bp.cardRefs ?? [];
      expect(refs).toHaveLength(bp.graph.nodes.length);
      for (const ref of refs) expect(parseCardRef(ref)).toBeDefined();
    }
    expect(digests.size).toBe(blueprints.length);
  });
});

describe("the registry", () => {
  const registry = getRegistry();

  it("indexes every blueprint and every pinned card", () => {
    expect(registry.blueprints().map((b) => b.slug)).toEqual(SLUGS);
    expect(registry.cards().length).toBeGreaterThan(0);
    for (const record of registry.cards()) {
      expect(record.usedIn.length).toBeGreaterThan(0);
      expect(record.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("sees each shared card as used by exactly two blueprints", () => {
    const support = ["frontline-triage", "incident-commander"];
    for (const id of ["event-intake", "intent-router", "resolution-composer", "confidence-escalation"]) {
      expect(registry.usersOf(id)).toEqual(support);
    }

    const etl = ["nightly-data-janitor", "schema-forge-etl"];
    for (const id of ["field-normalizer", "schema-gate", "record-repairer", "record-store"]) {
      expect(registry.usersOf(id)).toEqual(etl);
    }
  });

  it("stores a card pinned by two blueprints once, under one ref", () => {
    // §2's "same card referenced by different blueprints without duplication".
    const shared = registry.card("result-delivery@1.0.0");
    expect(shared?.usedIn).toEqual(["adversarial-consensus-line", "checkpoint-resume-runner"]);
    expect(registry.cards().filter((c) => c.ref === "result-delivery@1.0.0")).toHaveLength(1);
  });

  it("keeps the older version of a card alive while a blueprint still pins it", () => {
    // §4: the history is immutable, so both versions are indexed and both have a user.
    const multi = ["acceptance-verifier", "bounded-retry", "intent-router", "schema-gate"];
    for (const id of multi) {
      const versions = registry.versionsOf(id);
      expect(versions.length).toBeGreaterThanOrEqual(2);
      // Newest first.
      expect(versions[0].version).toBe("1.1.0");
      expect(versions[versions.length - 1].version).toBe("1.0.0");
      for (const version of versions) expect(version.usedIn.length).toBeGreaterThan(0);
    }
  });

  it("agrees with the card lookups on the public API", () => {
    const latest = allNodeCards();
    expect(latest).toEqual([...registry.latestCards()]);
    expect(new Set(latest.map((c) => c.id)).size).toBe(latest.length);

    expect(getNodeCard("schema-gate")?.version).toBe("1.1.0");
    expect(getNodeCard("schema-gate", "1.0.0")?.ref).toBe("schema-gate@1.0.0");
    expect(getNodeCard("schema-gate", "9.9.9")).toBeUndefined();
    expect(getNodeCard("not-a-card")).toBeUndefined();
    expect(nodeCardVersions("bounded-retry").map((c) => c.version)).toEqual(["1.1.0", "1.0.0"]);
    expect(nodeCardVersions("not-a-card")).toEqual([]);
  });
});

describe("raw source", () => {
  it("hands back the DOT and every card document a bundle pins", () => {
    for (const bp of blueprints) {
      const source = bundleSource(bp.slug);
      expect(source.cards).toHaveLength(bp.graph.nodes.length);
      for (const card of source.cards) {
        expect(card.file).toMatch(/^content\/cards\/.+@\d+\.\d+\.\d+\.yaml$/);
        expect(card.text).toContain("ontology_version");
      }
    }
    expect(bundleSource("nope")).toEqual({ dot: "", cards: [] });
  });

  it("resolves a card ref, and a bare id to its newest version", () => {
    const pinned = cardSource("schema-gate@1.0.0");
    expect(pinned).toContain("version: 1.0.0");
    expect(cardSource("schema-gate")).toBe(cardSource("schema-gate@1.1.0"));
    expect(cardSource("schema-gate@9.9.9")).toBeUndefined();
    expect(cardSource("no-such-card")).toBeUndefined();
  });
});

describe("the vocabulary", () => {
  it("is structurally sound and is the one every bundle was read against", () => {
    const ontology = getOntologyView();
    expect(ontology.validate()).toEqual([]);
    // Doc 3 §8. `0.1.0` is doc 3's own number, and the `1.0.0` this assertion used to
    // carry named the pre-contract vocabulary that was never a published contract.
    expect(ontology.ontology.version).toBe("0.1.0");
  });

  it("carries the archive's one local term, rooted and weighted (doc 3 §7)", () => {
    const ontology = getOntologyView();
    // Doc 3 §4 has no marker for personal data, so the archive declares one locally
    // rather than extending a curated set from the content side.
    const local = ontology.get("lupo/pii-handling");
    expect(local?.kind).toBe("risk-marker");
    expect(ontology.isA("lupo/pii-handling", "isolation-breach")).toBe(true);
    expect(local?.defaultWeight).toBeGreaterThan(0);
  });

  it("declares exactly the five phases and the six node types of doc 3", () => {
    const ontology = getOntologyView();
    expect(ontology.byKind("phase").map((t) => t.id).sort()).toEqual([
      "debugging",
      "deployment",
      "implementation",
      "planning",
      "testing",
    ]);
    const concrete = ontology
      .byKind("node-type")
      .filter((t) => t.id !== "human-in-the-loop" && t.id !== "evaluative")
      .map((t) => t.id);
    expect(concrete).toEqual([
      "agent",
      "decision",
      "human-gate",
      "human-input",
      "tool",
      "validation",
    ]);
  });
});
