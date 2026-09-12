import { describe, expect, it } from "vitest";

import { AUTONOMY_LABELS, autonomyStatement } from "@/lib/format";
import { communityFor } from "@/lib/data/community";
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
  "budget-aware-router",
  "checkpoint-resume-runner",
  "delegation-broker",
  "frontline-triage",
  "grounded-research-desk",
  "guarded-assistant-line",
  "guarded-merge-bot",
  // One of the four bundles that give doc 3 §4.1's `criteria-leak` check something to
  // anchor on, through `review-rubric`. The others are `objective-tracker`
  // (`metric-setter`), `producer-critic-refinery` (`rubric-author`) and
  // `starter-software-factory` (`spec-planner`, doc 2 §5.2's canonical factory); those
  // four cards are the only ones declaring an `acceptance-criteria` output port.
  "hypothesis-tournament",
  "incident-commander",
  "nightly-data-janitor",
  "objective-tracker",
  "pipeline-observability",
  "producer-critic-refinery",
  "schema-forge-etl",
  "starter-software-factory",
];

/**
 * The cards in `content/cards/` that no blueprint pins, which the registry therefore omits.
 *
 * Written out rather than derived, because a card that fell out of a topology would join this
 * set too and naming the members is what tells the two cases apart.
 */
const STANDALONE_CARDS = [
  "dynamic-repriority@1.0.0",
  "llm-judge@1.0.0",
  "panel-fan-in@1.0.0",
  "panel-fanout@1.0.0",
  "priority-scorer@1.0.0",
  "queue-scheduler@1.0.0",
  "sandboxed-python-runner@1.0.0",
  "trajectory-auditor@1.0.0",
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
  it("resolves every one, sorted by slug", () => {
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

  // A warning is not fatal to the build, so nothing else would catch one drifting in —
  // which is exactly why the whole set is pinned here rather than left to the loader's
  // error check. The wiring that carries a resolver diagnostic into the view model is
  // exercised in `view.test.ts`, against a bundle built to be broken, so this stays a
  // statement about the content.
  //
  // It used to read `toEqual([])` for every slug, and that was true right up until doc 3
  // §4.1's `criteria-leak` check learned to say when it had not run. It is not true now
  // and must not be made true: eight of the nine bundles give the check nothing to anchor
  // on — no node in them declares an output port typed `acceptance-criteria` — and the
  // whole point of `analysis/criteria-leak-unanchored` is that this is reported instead of
  // passing for silence. Blanking these expectations, or wiring an `acceptance-criteria`
  // port into eight blueprints to make them go quiet, would put the archive straight back
  // into the state the diagnostic was written to expose.
  //
  // So the set is pinned per slug instead of merely bounded. A bundle that gains an
  // anchor, loses one, or grows any *other* diagnostic fails here, which is the same
  // pressure the empty expectation used to apply.
  const EXPECTED_DIAGNOSTICS: Record<string, string[]> = {
    // `verify` (`acceptance-verifier`) judges `vote`, and nothing types a criteria port —
    // and the card names its criteria set in `params.criteria_ref`, so the criteria also
    // reach it from outside the graph, where topology cannot speak for them at all.
    "adversarial-consensus-line": [
      "warning analysis/criteria-leak-unanchored",
      "warning analysis/criteria-out-of-band",
    ],
    // `budget` and `critic` judge the router's arms and no node types a criteria port: the
    // bar a cheap answer has to clear lives with the caller, not in this graph.
    "budget-aware-router": ["warning analysis/criteria-leak-unanchored"],
    "checkpoint-resume-runner": [
      "warning analysis/criteria-leak-unanchored",
      "warning analysis/criteria-out-of-band",
    ],
    // `verify` judges work done by an agent this bundle cannot resolve, so the criteria the
    // delegate worked to are outside the graph by construction.
    "delegation-broker": ["warning analysis/criteria-leak-unanchored"],
    "frontline-triage": ["warning analysis/criteria-leak-unanchored"],
    "grounded-research-desk": ["warning analysis/criteria-leak-unanchored"],
    // `filter` and `sanitize` judge the assistant and the inbound text against a screening
    // bar no node publishes as a port.
    "guarded-assistant-line": ["warning analysis/criteria-leak-unanchored"],
    "guarded-merge-bot": ["warning analysis/criteria-leak-unanchored"],
    // `review-rubric` types its criteria port, so the check runs and stops at `review`,
    // once for each judged node downstream of it: `cluster`, `evolve` and `meta`.
    "hypothesis-tournament": [
      "warning analysis/criteria-relayed-through-judge",
      "warning analysis/criteria-relayed-through-judge",
      "warning analysis/criteria-relayed-through-judge",
    ],
    "incident-commander": ["warning analysis/criteria-leak-unanchored"],
    "nightly-data-janitor": ["warning analysis/criteria-leak-unanchored"],
    // `metric-setter` types its criteria port, and `monitor` relays to `correct`,
    // `escalate` and `execute`.
    "objective-tracker": [
      "warning analysis/criteria-relayed-through-judge",
      "warning analysis/criteria-relayed-through-judge",
      "warning analysis/criteria-relayed-through-judge",
    ],
    // `gate` judges `summariser` and no node types a criteria port: the observability line
    // sits on top of a pipeline somebody else wrote, so the criteria live in that graph.
    "pipeline-observability": ["warning analysis/criteria-leak-unanchored"],
    // The rubric is `rubric-author`'s output and `critique` is the only node holding both
    // it and the draft, so the check runs and names the one channel on to `revise`.
    "producer-critic-refinery": ["warning analysis/criteria-relayed-through-judge"],
    "schema-forge-etl": ["warning analysis/criteria-leak-unanchored"],
    // Doc 2 §5.2's canonical factory, and one of the four bundles where the check runs
    // rather than going quiet: `spec-planner` types its `criteria` port, `planner ->
    // builder` is absent, and the marker verdict is a real clean rather than a silence.
    //
    // The one warning is doc 2 §5.5's repair loop, and it is not a defect in this
    // blueprint. The criteria reach `tester`; `tester -> debugger` carries what the run
    // produced; `debugger -> tester` puts a patch back in front of the judge. The
    // topological walk stops at a judge on purpose — expanding through one would charge
    // the debugger of the very loop doc 2 §5.5 endorses by name — and the endorsed
    // `tester -> debugger -> tester` is indistinguishable in the graph from the
    // `tester -> builder` doc 2 §5.5 forbids two sentences later. So the analyzer names
    // the channel instead of guessing what crosses it. Doc 2 §5.5 raises the same channel
    // itself, as an "hint of the week": over many iterations the debugger can rebuild the
    // criteria out of accumulated error messages, which is why the iteration cap is a
    // leak control and not only a termination control. Nothing here is charged.
    "starter-software-factory": ["warning analysis/criteria-relayed-through-judge"],
  };

  it("carries exactly the criteria-leak reporting warnings, and no other diagnostic", () => {
    for (const bp of blueprints) {
      expect([bp.slug, bp.analysis?.diagnostics.map((d) => `${d.severity} ${d.code}`)]).toEqual([
        bp.slug,
        EXPECTED_DIAGNOSTICS[bp.slug],
      ]);
    }
  });

  // The reason the warnings above are tolerable: not one of them charges a risk marker.
  // `criteria-leak-unanchored` and `criteria-out-of-band` both report that the engine does
  // not know, and doc 3 §5 prices evidence, not ignorance — so an unanchored bundle must
  // never lose a point of security for being unanchored.
  it("charges no `criteria-leak` marker on a bundle where the check never ran", () => {
    for (const bp of blueprints) {
      const codes = bp.analysis?.diagnostics.map((d) => d.code) ?? [];
      if (!codes.includes("analysis/criteria-leak-unanchored")) continue;
      const leaks =
        bp.analysis?.security.findings.filter((f) => f.marker === "criteria-leak") ?? [];
      expect([bp.slug, leaks]).toEqual([bp.slug, []]);
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

  // The archive's blueprints are generated examples, credited to the registry account that
  // owns them. The assertion is about the credit: a handle outside `lib/data`'s fixture list
  // still renders, under its own name.
  it("attributes every blueprint to the registry handle", () => {
    for (const bp of blueprints) expect([bp.slug, bp.author.username]).toEqual([bp.slug, "autogen"]);
  });
});

describe("derived metrics", () => {
  it("carries the six metrics, in order, with finite values on the 0–100 axis", () => {
    for (const bp of blueprints) {
      expect(bp.metrics.map((m) => m.key)).toEqual(METRIC_ORDER);
      for (const metric of bp.metrics) {
        // `Metric.value` widened to `number | undefined` for the live cost row (D-180-01,
        // lib/content/view.ts); the fixture path this suite reads never takes that branch,
        // so `?? NaN` only satisfies the type checker and never masks a real absence here.
        expect(Number.isFinite(metric.value ?? NaN)).toBe(true);
        expect(Number.isInteger(metric.value ?? NaN)).toBe(true);
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
      // The engine's sentence, less the band ordinal it ends on. `MetricBars` and the
      // radar's caption print this `detail` verbatim and doc 2 §1.1 keeps that ordinal
      // off every surface; `format.test.ts` holds the transform to dropping the number
      // and nothing else.
      expect(autonomy.detail).toBe(autonomyStatement(analysis.autonomy.rationale));
      expect(autonomy.detail).not.toMatch(/level\s*\d/);

      const security = bp.metrics[5];
      expect(security.source).toBe("auto");
      const clamped = Math.min(Math.max(analysis.security.raw, 0), 4);
      expect(security.value).toBe(Math.round((clamped / 4) * 100));
      expect(security.detail).toBe(analysis.security.rationale);
    }
  });

  it("takes the subjective and measured metrics from the index, unchanged", () => {
    for (const bp of blueprints) {
      // `communityFor` rather than `COMMUNITY[slug]`: the index zero-fills a blueprint nobody
      // has voted on, and the view has to carry that zero through unchanged as well.
      const row = communityFor(bp.slug);
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
    // `human-input` is ON the list: doc 3 §3's `human-input` type draws as it, and
    // `goal-setter` declares that type, so a blueprint here produces one.
    //
    // `start` is NOT one of them, though it was while this file was written. Like `ship` it
    // comes from the topology rather than the type: `placeTool` reads a tool-family node's
    // position, and a node with nothing upstream is the intake the run starts from. Pinned
    // directly in `view.test.ts`.
    const REACHABLE = new Set(["start", "executor", "verifier", "router", "gate", "tool", "ship", "human-input"]);
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

  /**
   * Every indexed card still has a user, and `STANDALONE_CARDS` is why that is worth saying.
   *
   * `content/cards/` holds eight documents no blueprint pins. They are stored as card rows by
   * the seed and they are NOT in this index, because the index holds what a blueprint pins —
   * the same rule `lib/server/registry/snapshot.ts` keeps on the database side (D-80-06). The
   * two read models agree, and the cell below is what says so: the pinned set and the file set
   * differ by exactly those eight and by nothing else.
   */
  it("indexes every blueprint and every pinned card, and no standalone one", () => {
    expect(registry.blueprints().map((b) => b.slug)).toEqual(SLUGS);
    expect(registry.cards().length).toBeGreaterThan(0);
    for (const record of registry.cards()) {
      expect(record.usedIn.length).toBeGreaterThan(0);
      expect(record.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    const indexed = new Set(registry.cards().map((record) => record.ref));
    expect(STANDALONE_CARDS.filter((ref) => indexed.has(ref))).toEqual([]);
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
    //
    // The newest version is named per id rather than shared, because §4 also decides the
    // *number*: three of these four declare a prohibition their 1.0.0 did not, which
    // `inferBump` calls major, so they step to 2.0.0 and schema-gate stays at 1.1.0. The
    // list used to say 1.1.0 for all four, which is what an archive looks like when
    // nothing holds it to the rule the site teaches. `cardLibraryProblems` in
    // `lib/content/read.ts` now fails the build on it; this asserts the outcome.
    //
    // The OLDEST is named per id too, as of 2026-09-05. It was a shared "1.0.0" and that
    // was a second claim riding on the first: three of these four still open at 1.0.0, but
    // `intent-router` was RENAMED 1.0.0 -> 1.1.0 and 2.0.0 -> 2.1.0 when its spec took on
    // the `lane` emission (§11.0 Q17), so the archive holds no 1.0.0 of it to keep alive.
    // What this cell is about survives that untouched — `intent-router` still carries two
    // versions and `frontline-triage` still pins the older of them, which is the whole
    // claim — so the pair is re-derived from `content/cards/intent-router@*.yaml` rather
    // than the cell being loosened to stop naming an exact version at either end.
    const span: Record<string, readonly [newest: string, oldest: string]> = {
      "acceptance-verifier": ["2.0.0", "1.0.0"],
      "bounded-retry": ["2.0.0", "1.0.0"],
      "intent-router": ["2.1.0", "1.1.0"],
      "schema-gate": ["1.1.0", "1.0.0"],
    };
    for (const [id, [top, bottom]] of Object.entries(span)) {
      const versions = registry.versionsOf(id);
      expect(versions.length).toBeGreaterThanOrEqual(2);
      // Newest first.
      expect([id, versions[0].version]).toEqual([id, top]);
      expect([id, versions[versions.length - 1].version]).toEqual([id, bottom]);
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
    expect(nodeCardVersions("bounded-retry").map((c) => c.version)).toEqual(["2.0.0", "1.0.0"]);
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
        /* `version:` and not `ontology_version:`. This asserts the text really is the card
           DOCUMENT rather than an empty string or a path, so it needs a key every card
           carries; `ontology_version` was that key until it left the schema. */
        expect(card.text).toContain("version:");
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
    /* The version assertion that stood here is gone with the field. What made it worth
       asserting was that every bundle is read against ONE vocabulary, and that is checked
       by identity in `read.test.ts`; here the claim left is that the vocabulary is sound
       and that it is the shipped core with the archive's terms on top. */
    expect(ontology.get("agent")?.kind).toBe("node-type");
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

  it("declares exactly the five phases and the ten concrete node types", () => {
    const ontology = getOntologyView();
    expect(ontology.byKind("phase").map((t) => t.id).sort()).toEqual([
      "debugging",
      "deployment",
      "implementation",
      "planning",
      "testing",
    ]);
    // The three abstract categories are dropped by name: a card may not declare one
    // (`card/validate.ts` refuses it), so what is left is the set an author can write.
    const abstract = new Set(["human-in-the-loop", "evaluative", "orchestration"]);
    const concrete = ontology
      .byKind("node-type")
      .filter((t) => !abstract.has(t.id))
      .map((t) => t.id);
    expect(concrete).toEqual([
      "agent",
      "decision",
      "human-gate",
      "human-input",
      "manager-loop",
      "parallel",
      "parallel.fan-in",
      "shell-tool",
      "tool",
      "validation",
    ]);
  });
});
