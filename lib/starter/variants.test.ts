/* ============================================================
   The workspace — the variant engine, checked against the
   engine that scores it.

   Doc 2 §5.7 is the reason this file walks `STARTER_VARIANTS`
   rather than a couple of interesting cases: "Tutte e 8 devono
   produrre una fabbrica scaricabile e funzionante. Da esplicitare,
   altrimenti si testano i percorsi principali e i restanti si
   rompono in silenzio."

   Every number here comes from `loadBundle` on a real assembled
   bundle, and every threshold comes from `DARKPRINT_CONFIG`. A
   test that hard-codes 2.0 for `criteria-leak` keeps passing after
   somebody retunes the weight and the page starts printing a
   number the engine no longer produces.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { criteriaVerdict } from "@/lib/criteria-state";
import {
  DARKPRINT_CONFIG,
  SHINGLE_WIDTH,
  bumpSatisfies,
  carriesShingleEvidence,
  declaredBump,
  emitAttractorDot,
  hasErrors,
  inferBump,
  jaccardSimilarity,
  lintAttractor,
  loadBundle,
  loadCard,
  ontologyView,
  parseDot,
  CORE_ONTOLOGY,
  type Bundle,
  type BlueprintAnalysis,
  type Diagnostic,
  type NodeCard,
  type ResolvedBlueprint,
} from "@/lib/core";

import {
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  DEFAULT_ITERATIONS,
  STARTER_APPROVALS,
  STARTER_OUTPUTS,
  STARTER_PROFILES,
  STARTER_VARIANTS,
  buildStarterBundle,
  cardDocument,
  clampIterations,
  starterDot,
  starterRunBudget,
  starterSlug,
  type StarterChoices,
  type StarterVariant,
} from "./variants";
import { starterNodes, type StarterCardSpec } from "./cards";

/* --------------------- helpers --------------------- */

const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

interface Loaded {
  bundle: Bundle;
  blueprint: ResolvedBlueprint;
  analysis: BlueprintAnalysis;
  diagnostics: readonly Diagnostic[];
}

/** Build a variant and put it through the real engine. Fails loudly if it did not resolve. */
function load(choices: StarterChoices): Loaded {
  const bundle = buildStarterBundle(choices);
  const result = loadBundle(bundle, { ontology: ONTOLOGY });
  expect(result.blueprint, `${starterSlug(choices)} did not resolve`).toBeDefined();
  expect(result.analysis).toBeDefined();
  const blueprint = result.blueprint;
  const analysis = result.analysis;
  if (blueprint === undefined || analysis === undefined) throw new Error("unreachable");
  return { bundle, blueprint, analysis, diagnostics: result.diagnostics };
}

function errorsOf(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((d) => d.severity === "error");
}

function describeDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics.map((d) => `[${d.severity}] ${d.code}: ${d.message}`).join("\n");
}

function edgeExists(bp: ResolvedBlueprint, source: string, target: string): boolean {
  return bp.edges.some((e) => e.source === source && e.target === target);
}

const AT_THREE = (variant: StarterVariant): StarterChoices => ({
  ...variant,
  maxIterations: 3,
});

/**
 * The same bundle with the `max_iterations` line deleted from whichever card declares it.
 *
 * A control rather than a variant: nothing the workspace can produce looks like this, and
 * that is the point. It is what makes "the cap is load-bearing" a checked statement.
 */
function stripIterationCap(bundle: Bundle): Bundle {
  const cardFiles: Record<string, string> = {};
  let removed = 0;
  for (const [file, text] of Object.entries(bundle.cardFiles)) {
    const without = text.replace(/^ {2}max_iterations: \d+\n/m, "");
    if (without !== text) removed += 1;
    cardFiles[file] = without;
  }
  expect(removed, "no card declared an iteration cap").toBe(1);
  return { ...bundle, cardFiles };
}

/* ============================================================
   1. All eight variants, through the real engine
   ============================================================ */

describe.each(STARTER_VARIANTS)(
  "variant $output / $approval",
  (variant) => {
    const loaded = load(AT_THREE(variant));
    const { bundle, blueprint, analysis, diagnostics } = loaded;
    const human = variant.approval === "human";

    it("resolves with no error diagnostic", () => {
      expect(errorsOf(diagnostics), describeDiagnostics(diagnostics)).toEqual([]);
      expect(hasErrors([...diagnostics])).toBe(false);
    });

    it("reports exactly one warning, and it is the walk stopping at the tester", () => {
      // Doc 2 §5.5 endorses `tester -> debugger -> tester` by name, and the engine declines
      // to trace the criteria through a validation node while saying out loud that it
      // stopped. The reference starter in `content/` produces this same single warning, so
      // a generated factory that produced fewer would be quieter than the archive it copies.
      expect(diagnostics.map((d) => d.code)).toEqual(["analysis/criteria-relayed-through-judge"]);
      expect(diagnostics[0].location?.nodeId).toBe("debugger");
    });

    it("has doc 2 §5.2's five nodes, plus the approver under human approval", () => {
      const ids = [...blueprint.graph.ids].sort();
      expect(ids).toEqual(
        human
          ? ["approver", "builder", "debugger", "deployer", "planner", "tester"]
          : ["builder", "debugger", "deployer", "planner", "tester"],
      );
      expect(blueprint.nodes.length).toBe(human ? 6 : 5);
    });

    it("covers all five phases", () => {
      expect(analysis.phaseCoverage.missing).toEqual([]);
      expect([...analysis.phaseCoverage.covered].sort()).toEqual(
        ["debugging", "deployment", "implementation", "planning", "testing"].sort(),
      );
    });

    it("reads autonomy off the fraction the graph produces", () => {
      const bands = DARKPRINT_CONFIG.autonomy;
      const { autonomy } = analysis;
      expect(autonomy.totalNodes).toBe(human ? 6 : 5);
      expect(autonomy.autonomousNodes).toBe(5);
      if (human) {
        // 5 of 6 run unattended. The band, not a constant, decides what that is called.
        expect(autonomy.fraction).toBeLessThanOrEqual(bands.level4);
        expect(autonomy.fraction).toBeGreaterThanOrEqual(bands.level3);
        expect(autonomy.level).toBe(3);
        const staffed = autonomy.contributions.filter((c) => c.requiresHuman);
        expect(staffed.map((c) => c.nodeId)).toEqual(["approver"]);
        expect(staffed[0].reason).toBe("human-in-the-loop-type");
      } else {
        expect(autonomy.fraction).toBeGreaterThan(bands.level4);
        expect(autonomy.level).toBe(4);
        expect(autonomy.contributions.filter((c) => c.requiresHuman)).toEqual([]);
      }
      expect(autonomy.contributions.every((c) => c.resolved)).toBe(true);
    });

    it("scores security at the top of the scale with nothing charged", () => {
      expect(analysis.security.raw).toBe(4);
      expect(analysis.security.level).toBe(4);
      expect(analysis.security.penalties).toEqual([]);
      expect(analysis.security.findings).toEqual([]);
    });

    it("keeps the criteria off the builder, on the graph and in the prose", () => {
      expect(edgeExists(blueprint, "planner", "builder")).toBe(false);
      // The engine's own reading of its most important check: the walk ran, found the
      // producer and the generators, and stopped at the judge by design.
      const verdict = criteriaVerdict(analysis.security);
      expect(verdict.state).toBe("relayed");
      expect(verdict.leaks).toEqual([]);
      expect(verdict.unanchored).toBeUndefined();
      expect(verdict.suspected).toEqual([]);
      expect(verdict.outOfBand).toEqual([]);
    });

    it("keeps the builder's spec below the configured similarity threshold", () => {
      // Doc 1 §3.2's second half, measured rather than asserted: an absent edge with the
      // criteria paraphrased into the prose is a false isolation.
      const p = STARTER_PROFILES[variant.output];
      const planner = cardModel(variant, `${p.slug}-planner`);
      const builder = cardModel(variant, `${p.slug}-builder`);
      expect(carriesShingleEvidence(planner.spec, SHINGLE_WIDTH)).toBe(true);
      expect(carriesShingleEvidence(builder.spec, SHINGLE_WIDTH)).toBe(true);
      const score = jaccardSimilarity(builder.spec, planner.spec, SHINGLE_WIDTH);
      expect(score).toBeLessThan(DARKPRINT_CONFIG.criteriaLeak.similarityThreshold);
    });

    it("wires every edge to a port pair the engine could resolve", () => {
      for (const edge of blueprint.edges) {
        expect(edge.fromPort, `${edge.source} -> ${edge.target} has no output port`).toBeDefined();
        expect(edge.toPort, `${edge.source} -> ${edge.target} has no input port`).toBeDefined();
      }
      expect(edgeExists(blueprint, "tester", "debugger")).toBe(true);
      expect(edgeExists(blueprint, "debugger", "tester")).toBe(true);
      // Doc 2 §5.5: the loop never returns to the builder.
      expect(edgeExists(blueprint, "debugger", "builder")).toBe(false);
      expect(edgeExists(blueprint, "tester", "builder")).toBe(false);
      if (human) {
        expect(edgeExists(blueprint, "tester", "approver")).toBe(true);
        expect(edgeExists(blueprint, "approver", "deployer")).toBe(true);
        expect(edgeExists(blueprint, "tester", "deployer")).toBe(false);
      } else {
        expect(edgeExists(blueprint, "tester", "deployer")).toBe(true);
      }
    });

    it("emits an Attractor pipeline that parses and lints clean", () => {
      // The two checks Attractor performs before it will run a file, which is what
      // "downloadable and working" reduces to on a static site.
      const factory = emitAttractorDot(blueprint);
      const parsed = parseDot(factory, "factory.dot");
      expect(errorsOf(parsed.diagnostics), describeDiagnostics(parsed.diagnostics)).toEqual([]);
      expect(parsed.graph).toBeDefined();
      if (parsed.graph === undefined) throw new Error("unreachable");
      const lint = lintAttractor(parsed.graph, factory, "factory.dot");
      expect(errorsOf(lint), describeDiagnostics(lint)).toEqual([]);
      // The cap reaches the runnable artefact, which is the whole reason it lives in params.
      expect(factory).toContain("max_retries=3");
      // Every node carries the spec the agent is handed (doc 1 §0.1.2).
      expect(factory.match(/prompt=/g)?.length).toBe(human ? 6 : 5);
    });

    it("names every card file after the ref the DOT pins", () => {
      const files = Object.keys(bundle.cardFiles).sort();
      const expected = blueprint.nodes.map((n) => `cards/${n.ref}.yaml`).sort();
      expect(files).toEqual(expected);
    });

    it("round-trips every card document through the engine's own loader", () => {
      for (const node of starterNodes(AT_THREE(variant))) {
        const text = bundle.cardFiles[`cards/${node.card.id}@${node.card.version}.yaml`];
        expect(text, `no document for ${node.card.id}`).toBeDefined();
        const parsed = loadCard(text, { ontology: ONTOLOGY, file: `cards/${node.card.id}.yaml` });
        expect(
          errorsOf(parsed.diagnostics),
          `${node.card.id}\n${describeDiagnostics(parsed.diagnostics)}`,
        ).toEqual([]);
        expect(parsed.card).toBeDefined();
        if (parsed.card === undefined) throw new Error("unreachable");
        expect(parsed.card).toEqual(expectedNodeCard(node.card));
      }
    });

    it("is deterministic", () => {
      const again = buildStarterBundle(AT_THREE(variant));
      expect(again).toEqual(bundle);
      expect(JSON.stringify(again)).toBe(JSON.stringify(bundle));
    });
  },
);

/**
 * The `NodeCard` the engine should produce from one document.
 *
 * Written out here rather than compared field by field inside the loop so the round-trip
 * test is a single `toEqual`: a writer that silently drops `params` or folds two ports into
 * one has to survive an exact structural comparison, not a spot check.
 */
function expectedNodeCard(card: StarterCardSpec): NodeCard {
  const out: NodeCard = {
    id: card.id,
    name: card.name,
    type: card.type,
    phases: [card.phase],
    action: card.action,
    spec: card.spec,
    tools: [...card.tools],
    mcp: [...card.mcp],
    params: { ...(card.params ?? {}) },
    inputs: card.inputs.map((port) => {
      const p: NodeCard["inputs"][number] = {
        name: port.name,
        type: port.type,
        description: port.description,
      };
      if (port.required === false) p.required = false;
      return p;
    }),
    outputs: card.outputs.map((port) => ({
      name: port.name,
      type: port.type,
      description: port.description,
    })),
    dependencies: [...card.dependencies],
    cannot: [...card.cannot],
    requiresHuman: card.requiresHuman,
    riskMarkers: [...card.riskMarkers],
    notes: card.notes,
    version: card.version,
    provenance: card.provenance,
    ontologyVersion: card.ontologyVersion,
  };
  if (card.agent !== undefined) out.agent = card.agent;
  if (card.skill !== undefined) out.skill = card.skill;
  return out;
}

/** The model of one card in one variant, by id. */
function cardModel(variant: StarterVariant, id: string): StarterCardSpec {
  const node = starterNodes(AT_THREE(variant)).find((n) => n.card.id === id);
  expect(node, `no card ${id} in ${starterSlug(variant)}`).toBeDefined();
  if (node === undefined) throw new Error("unreachable");
  return node.card;
}

/* ============================================================
   2. The eight variants at every cap on the slider
   ============================================================ */

describe("the iteration cap does not multiply the structural cases", () => {
  it("every variant at every cap from 1 to 10 resolves clean and scores the same", () => {
    for (const variant of STARTER_VARIANTS) {
      const reference = load(AT_THREE(variant));
      for (let cap = MIN_ITERATIONS; cap <= MAX_ITERATIONS; cap += 1) {
        const loaded = load({ ...variant, maxIterations: cap });
        expect(
          errorsOf(loaded.diagnostics),
          `${starterSlug(variant)} @ ${cap}\n${describeDiagnostics(loaded.diagnostics)}`,
        ).toEqual([]);
        expect(loaded.diagnostics.map((d) => d.code)).toEqual(
          reference.diagnostics.map((d) => d.code),
        );
        expect(loaded.analysis.autonomy.level).toBe(reference.analysis.autonomy.level);
        expect(loaded.analysis.security.level).toBe(reference.analysis.security.level);
        expect(loaded.blueprint.edges.length).toBe(reference.blueprint.edges.length);
        expect(loaded.blueprint.graph.ids.length).toBe(reference.blueprint.graph.ids.length);
      }
    }
  });

  it("clamps a slider value that arrived out of range", () => {
    expect(clampIterations(0)).toBe(MIN_ITERATIONS);
    expect(clampIterations(-4)).toBe(MIN_ITERATIONS);
    expect(clampIterations(11)).toBe(MAX_ITERATIONS);
    expect(clampIterations(2.4)).toBe(2);
    expect(clampIterations(2.6)).toBe(3);
    expect(clampIterations(Number.NaN)).toBe(DEFAULT_ITERATIONS);
    // A clamped bundle is still a working bundle, which is the point of clamping.
    const loaded = load({ output: "python", approval: "tester", maxIterations: 99 });
    expect(errorsOf(loaded.diagnostics)).toEqual([]);
    expect(loaded.bundle.dot).toContain(`@1.${MAX_ITERATIONS}.0`);
  });
});

/* ============================================================
   3. Doc 2 §5.3 choice 2 — the graph moves, the number moves,
      and nothing in the artefact reads as a penalty
   ============================================================ */

describe("choice 2: who decides the work is finished", () => {
  it("moves autonomy from 4 to 3 and names the node responsible", () => {
    for (const output of STARTER_OUTPUTS) {
      const alone = load({ output, approval: "tester", maxIterations: 3 });
      const gated = load({ output, approval: "human", maxIterations: 3 });
      expect(alone.analysis.autonomy.level).toBe(4);
      expect(gated.analysis.autonomy.level).toBe(3);
      const staffed = gated.analysis.autonomy.contributions.filter((c) => c.requiresHuman);
      expect(staffed).toHaveLength(1);
      expect(staffed[0].nodeId).toBe("approver");
      // Doc 1 §8.3: the metric names the node and says what it is, in the engine's words.
      expect(staffed[0].explanation).toContain("A person acts here");
      // Doc 2 §5.3: the choice moves autonomy alone.
      expect(gated.analysis.security.level).toBe(alone.analysis.security.level);
      expect(gated.analysis.phaseCoverage.missing).toEqual(alone.analysis.phaseCoverage.missing);
    }
  });

  it("satisfies the validator's rule for a human type", () => {
    // Doc 3 §3: a type under `human-in-the-loop` with `requires_human` unset is an error,
    // not a warning. This is the rule a hand-written gate gets wrong.
    const gate = cardModel({ output: "python", approval: "human" }, "python-script-approval");
    expect(gate.type).toBe("human-gate");
    expect(gate.requiresHuman).toBe(true);
    const parsed = loadCard(cardDocument(gate), { ontology: ONTOLOGY, file: "cards/gate.yaml" });
    expect(errorsOf(parsed.diagnostics), describeDiagnostics(parsed.diagnostics)).toEqual([]);
    expect(parsed.diagnostics.some((d) => d.code === "card/human-type-inconsistent")).toBe(false);
  });

  it("says nothing about the human gate that reads as a shortfall", () => {
    // Doc 2 §1.1. The graph changes, the number changes, and the words stay descriptive.
    // Every string the user can read in the artefact is searched, not a sample of them.
    const banned = [
      "out of 4",
      "4 out of",
      "fully autonomous",
      "not autonomous",
      "less autonomous",
      "more autonomous",
      "room for improvement",
      "should automate",
      "penalty",
      "penalise",
      "downgrade",
      "lower score",
      "costs you",
      "held back",
      "falls short",
    ];
    for (const variant of STARTER_VARIANTS) {
      const bundle = buildStarterBundle(AT_THREE(variant));
      const surfaces = [
        bundle.dot,
        bundle.manifest.title,
        bundle.manifest.summary,
        bundle.manifest.description ?? "",
        ...Object.values(bundle.cardFiles),
      ];
      for (const text of surfaces) {
        const lower = text.toLowerCase();
        for (const phrase of banned) {
          expect(lower.includes(phrase), `${starterSlug(variant)} contains "${phrase}"`).toBe(
            false,
          );
        }
      }
    }
  });

  /**
   * Spec part 2, on the surfaces the reader keeps.
   *
   * `notes` on the approval card is rendered in `/build`'s Cards tab and written
   * byte for byte into the downloaded bundle, and `manifest.description` is the field
   * `toBlueprintView` reads as the body copy of a blueprint page. Both used to spell the
   * autonomy reading as an ordinal — "the blueprint reads autonomy level 3. Without it,
   * level 4" — which is the per-graph description wearing the 1-to-5 organisational
   * ladder's clothes, on a card sitting beside a meter that says "Autonomy class
   * Conditional".
   *
   * Two halves, because either one alone is weak. The first says no artefact surface
   * carries a number next to the word autonomy. The second says the class the copy names
   * is the class the engine computes for that exact bundle, so the sentence cannot drift
   * away from the analyzer the way a hand-typed number did.
   */
  it("names the class in the artefact and never the band behind it", () => {
    const ordinal = /autonomy[^.\n]{0,32}level\s*\d|\blevel\s*\d[^.\n]{0,32}autonomy|\bautonomy\s+\d/i;
    for (const variant of STARTER_VARIANTS) {
      const bundle = buildStarterBundle(AT_THREE(variant));
      const surfaces: [string, string][] = [
        ["dot", bundle.dot],
        ["title", bundle.manifest.title],
        ["summary", bundle.manifest.summary],
        ["description", bundle.manifest.description ?? ""],
        ...Object.entries(bundle.cardFiles),
      ];
      for (const [where, text] of surfaces) {
        expect(ordinal.test(text), `${starterSlug(variant)} ${where} prints a band`).toBe(
          false,
        );
      }
    }
  });

  /**
   * The DOT comments, which the band test above walks straight past.
   *
   * `starterDot` writes the teaching material into the file, and the file is read twice:
   * `buildPaneModel` puts it in the DOT pane of `/build` verbatim, and `exportBundle`
   * writes the same bytes as `topology.dot` in the downloaded folder. The approval branch
   * said "the autonomy level changes with it, from 4 to 3", which the `ordinal` regex
   * cannot see — it wants a digit touching the word "level", and that sentence put five
   * words between them. So the phrase is banned by name, together with the transition it
   * framed as a decrease, and the positive half checks the class names are the engine's
   * rather than a hole where the sentence used to be.
   */
  it("writes the class into the DOT comments and never an ordinal", () => {
    const banned = ["autonomy level", "from 4 to 3", "from 3 to 4", "autonomy drops"];
    for (const variant of STARTER_VARIANTS) {
      const dot = buildStarterBundle(AT_THREE(variant)).dot.toLowerCase();
      for (const phrase of banned) {
        expect(dot.includes(phrase), `${starterSlug(variant)} dot says "${phrase}"`).toBe(
          false,
        );
      }
    }

    for (const output of STARTER_OUTPUTS) {
      const gated = load({ output, approval: "human", maxIterations: 3 });
      const alone = load({ output, approval: "tester", maxIterations: 3 });
      // Both classes, in the branch that adds the person: the one this graph is and the
      // one the other choice draws. Taken off the analyzer, so the comment cannot drift.
      expect(gated.bundle.dot).toContain(gated.analysis.autonomy.autonomyClass);
      expect(gated.bundle.dot).toContain(alone.analysis.autonomy.autonomyClass);
    }
  });

  it("quotes the class the engine computes for the bundle the card ships in", () => {
    for (const output of STARTER_OUTPUTS) {
      const gated = load({ output, approval: "human", maxIterations: 3 });
      const alone = load({ output, approval: "tester", maxIterations: 3 });
      const file = Object.keys(gated.bundle.cardFiles).find((f) => f.includes("-approval@"));
      expect(file, `${output}: no approval card in the bundle`).toBeDefined();
      const document = gated.bundle.cardFiles[file ?? ""] ?? "";
      // Both classes are named in the same sentence: the one this bundle is, and the one
      // the other choice produces. Neither is phrased as the destination of the other.
      expect(document).toContain(gated.analysis.autonomy.autonomyClass);
      expect(document).toContain(alone.analysis.autonomy.autonomyClass);
      expect(gated.bundle.manifest.description ?? "").toContain(
        gated.analysis.autonomy.autonomyClass,
      );
    }
  });

  it("keeps the two release cards apart so one ref never covers two behaviours", () => {
    // The deployer's `dependencies` differ between the two modes, and doc 1 §4 makes the ref
    // the key to the content. Two ids rather than one version of a card that means two things.
    const alone = buildStarterBundle({ output: "data", approval: "tester", maxIterations: 3 });
    const gated = buildStarterBundle({ output: "data", approval: "human", maxIterations: 3 });
    const shared = Object.keys(alone.cardFiles).filter((f) => f in gated.cardFiles);
    for (const file of shared) {
      expect(gated.cardFiles[file], `${file} differs between approval modes`).toBe(
        alone.cardFiles[file],
      );
    }
    expect(Object.keys(alone.cardFiles)).toContain("cards/data-transform-release-gate@1.0.0.yaml");
    expect(Object.keys(gated.cardFiles)).toContain(
      "cards/data-transform-approved-release@1.0.0.yaml",
    );
  });
});

/* ============================================================
   4. Doc 2 §5.4 — the demonstration switch
   ============================================================ */

describe("the §5.4 switch: can the builder see the acceptance criteria", () => {
  const leakWeight = DARKPRINT_CONFIG.security.weights["criteria-leak"];

  it("is a real weight in the shipped configuration", () => {
    expect(typeof leakWeight).toBe("number");
    expect(leakWeight).toBeGreaterThan(0);
  });

  it.each(STARTER_VARIANTS)("fires criteria-leak on the builder ($output / $approval)", (variant) => {
    const off = load(AT_THREE(variant));
    const on = load({ ...AT_THREE(variant), criteriaVisibleToBuilder: true });

    // The edge appears, and it is the only structural difference.
    expect(edgeExists(on.blueprint, "planner", "builder")).toBe(true);
    expect(on.blueprint.edges.length).toBe(off.blueprint.edges.length + 1);
    expect(on.blueprint.graph.ids).toEqual(off.blueprint.graph.ids);

    // The engine charges it, on the node doc 2 §3 is about.
    const verdict = criteriaVerdict(on.analysis.security);
    expect(verdict.state).toBe("leak");
    expect(verdict.inferred).toBe(true);
    expect(verdict.leaks.map((f) => f.nodeId)).toEqual(["builder"]);
    expect(verdict.leaks[0].establishedBy).toBe("inferred");

    // The number is the configured weight, subtracted from a clean 4.
    expect(on.analysis.security.raw).toBe(4 - leakWeight);
    expect(on.analysis.security.penalties.map((p) => p.marker)).toEqual(["criteria-leak"]);
    expect(on.analysis.security.penalties[0].weight).toBe(leakWeight);
    expect(on.analysis.security.level).toBeLessThan(off.analysis.security.level);
    // The demonstration is about security. Nothing else moves.
    expect(on.analysis.autonomy.level).toBe(off.analysis.autonomy.level);
    expect(on.analysis.autonomy.rationale).toBe(off.analysis.autonomy.rationale);

    // The builder's card declares `acceptance-criteria` under `cannot`, and that entry
    // names a `data-type` in the vocabulary, so the resolver refuses the edge as well.
    // The demonstration used to cost the security level alone; it now costs an error too,
    // which is the point of writing the prohibition down. One diagnostic, on the edge the
    // switch drew, naming the node doc 2 §3 is about.
    const errors = errorsOf(on.diagnostics);
    expect(errors.map((d) => d.code), describeDiagnostics(on.diagnostics)).toEqual([
      "bundle/prohibition-violated",
    ]);
    expect(errors[0].location?.nodeId).toBe("builder");
    expect(errors[0].location?.edge).toEqual({ source: "planner", target: "builder" });
    expect(errors[0].message).toContain("acceptance-criteria");
  });

  it.each(STARTER_VARIANTS)(
    "resolves with no error at all while the switch is off ($output / $approval)",
    (variant) => {
      const off = load(AT_THREE(variant));
      expect(errorsOf(off.diagnostics), describeDiagnostics(off.diagnostics)).toEqual([]);
      // The prohibition is on the card in both states. What changes is whether an edge
      // walks into it, so the artefact a reader downloads carries the rule and no error.
      const builder = off.blueprint.nodes.find((n) => n.nodeId === "builder");
      expect(builder?.card.cannot).toContain("acceptance-criteria");
    },
  );

  it("changes the DOT and nothing else, so it cannot be persisted by accident", () => {
    for (const variant of STARTER_VARIANTS) {
      const off = buildStarterBundle(AT_THREE(variant));
      const on = buildStarterBundle({ ...AT_THREE(variant), criteriaVisibleToBuilder: true });
      expect(on.cardFiles).toEqual(off.cardFiles);
      expect(on.manifest).toEqual(off.manifest);
      expect(on.dot).not.toBe(off.dot);
      // The added line is marked in the file the user would be looking at.
      expect(on.dot).toContain("Doc 2 §5.4");
      expect(on.dot).toContain("planner  -> builder");
    }
  });

  it("goes back to a clean 4 when the switch is flipped off", () => {
    const choices: StarterChoices = { output: "react", approval: "tester", maxIterations: 3 };
    const on = load({ ...choices, criteriaVisibleToBuilder: true });
    const back = load({ ...choices, criteriaVisibleToBuilder: false });
    expect(on.analysis.security.level).toBe(2);
    expect(back.analysis.security.level).toBe(4);
    expect(back.analysis.security.findings).toEqual([]);
    expect(back.bundle).toEqual(buildStarterBundle(choices));
  });

  it("reports the refused prohibition and the undeclared dependency it creates", () => {
    // The builder's card does not list the planner, because the card must not learn
    // anything from a switch that is meant to be turned back off. The engine says so, and
    // it says the prohibition was walked into as well: two readings of one edge, one at
    // error severity because the author wrote the rule down and one at warning because
    // the dependency list disagrees with the graph.
    const on = load({
      output: "python",
      approval: "tester",
      maxIterations: 3,
      criteriaVisibleToBuilder: true,
    });
    const codes = on.diagnostics.map((d) => d.code).sort();
    expect(codes).toEqual([
      "analysis/criteria-relayed-through-judge",
      "bundle/prohibition-violated",
      "bundle/undeclared-dependency",
    ]);
  });
});

/* ============================================================
   5. Doc 2 §5.5 and §5.6 — the loop, and what the slider moves
   ============================================================ */

describe("the debugging loop", () => {
  it("runs tester -> debugger -> tester and never returns to the builder", () => {
    for (const variant of STARTER_VARIANTS) {
      const { blueprint } = load(AT_THREE(variant));
      const cycles = blueprint.graph.cycles().map((scc) => [...scc].sort());
      expect(cycles).toEqual([["debugger", "tester"]]);
      const intoBuilder = blueprint.edges.filter((e) => e.target === "builder");
      expect(intoBuilder).toEqual([]);
    }
  });

  it("declares the cap on the loop node, so unbounded-loop stays quiet", () => {
    const { blueprint, analysis } = load({ output: "data", approval: "tester", maxIterations: 7 });
    const node = blueprint.nodes.find((n) => n.nodeId === "debugger");
    expect(node?.card.params["max_iterations"]).toBe(7);
    expect(analysis.security.findings.some((f) => f.marker === "unbounded-loop")).toBe(false);
  });

  it("charges the loop the configured weight when the cap is taken away", () => {
    // Not a variant, a control: it is what makes the sentence "the cap is load-bearing"
    // checkable rather than a claim in a comment.
    const bundle = buildStarterBundle({ output: "data", approval: "tester", maxIterations: 7 });
    const uncapped = stripIterationCap(bundle);
    const result = loadBundle(uncapped, { ontology: ONTOLOGY });
    const security = result.analysis?.security;
    expect(security).toBeDefined();
    if (security === undefined) throw new Error("unreachable");
    const weight = DARKPRINT_CONFIG.security.weights["unbounded-loop"];
    expect(security.penalties.map((p) => p.marker)).toEqual(["unbounded-loop"]);
    expect(security.raw).toBe(4 - weight);
    expect([...(security.penalties[0]?.nodeIds ?? [])].sort()).toEqual(["debugger", "tester"]);
  });

  it("writes the progress criterion and the escalation into the card", () => {
    // Doc 2 §5.5 asks for three things. The cap is topological (the analyzer reads
    // `params`), the other two are properties of two consecutive runs and of what happens
    // after the last one, and neither is expressible as an edge. See the card's own notes.
    for (const output of STARTER_OUTPUTS) {
      const card = cardModel({ output, approval: "tester" }, `${STARTER_PROFILES[output].slug}-debugger`);
      expect(card.params?.["stop_on_repeated_evidence"]).toBe(true);
      expect(card.params?.["on_cap_exhausted"]).toBe("stop-and-report");
      expect(card.spec).toContain("Stop earlier if two consecutive runs hand you the same evidence");
      expect(card.spec).toContain("When the cap is spent");
      // The debugger reads evidence and never the criteria set (doc 2 §5.5).
      expect(card.inputs.map((p) => p.type)).toEqual(["report"]);
      expect(card.inputs.some((p) => p.type === "acceptance-criteria")).toBe(false);
    }
  });

  it("keeps the escalation out of the graph for a reason that can be checked", () => {
    // An edge `debugger -> planner` is the other option doc 2 §5.5 offers, and it would
    // break the artefact: `emitAttractorDot` takes the entry set from the in-degree-0
    // nodes, so giving the planner an incoming edge moves the run's start onto the builder,
    // which then runs with no brief. This is that claim, executed.
    const { blueprint } = load({ output: "python", approval: "tester", maxIterations: 3 });
    expect([...blueprint.graph.sources()].sort()).toEqual(["builder", "planner"]);
    const withEscalation = buildStarterBundle({
      output: "python",
      approval: "tester",
      maxIterations: 3,
    });
    const escalated: Bundle = {
      ...withEscalation,
      dot: withEscalation.dot.replace(/\n\}\n$/, '\n  debugger -> planner [label="cap spent"];\n}\n'),
    };
    const result = loadBundle(escalated, { ontology: ONTOLOGY });
    expect(result.blueprint).toBeDefined();
    if (result.blueprint === undefined) throw new Error("unreachable");
    expect([...result.blueprint.graph.sources()]).toEqual(["builder"]);
    const factory = emitAttractorDot(result.blueprint);
    expect(factory).toContain("__start -> builder");
    expect(factory).not.toContain("__start -> planner");
  });
});

describe("doc 2 §5.6: what the slider actually moves", () => {
  const variant: StarterVariant = { output: "python", approval: "tester" };
  const at3 = load({ ...variant, maxIterations: 3 });
  const at10 = load({ ...variant, maxIterations: 10 });

  it("moves the artefact: the card ref, the cap and the bundle digest", () => {
    expect(at3.bundle.dot).toContain("@1.3.0");
    expect(at10.bundle.dot).toContain("@1.10.0");
    expect(at3.blueprint.digest).not.toBe(at10.blueprint.digest);
    expect(emitAttractorDot(at3.blueprint)).toContain("max_retries=3");
    expect(emitAttractorDot(at10.blueprint)).toContain("max_retries=10");
  });

  it("moves the run budget, which is arithmetic over the graph and the cap", () => {
    const three = starterRunBudget({ ...variant, maxIterations: 3 });
    const ten = starterRunBudget({ ...variant, maxIterations: 10 });
    expect(three).toEqual({
      maxIterations: 3,
      testerRunsAtMost: 4,
      debuggerRunsAtMost: 3,
      modelCallsAtMost: 9,
    });
    expect(ten).toEqual({
      maxIterations: 10,
      testerRunsAtMost: 11,
      debuggerRunsAtMost: 10,
      modelCallsAtMost: 23,
    });
    expect(ten.modelCallsAtMost).toBeGreaterThan(three.modelCallsAtMost);
    // The budget counts the nodes Attractor hands to a model: `agent` and `validation`.
    const kinds = at3.blueprint.nodes.map((n) => n.card.type).filter((t) => t !== "tool");
    expect(kinds).toEqual(["agent", "agent", "validation", "agent"]);
  });

  /**
   * §5.6 wants the trade delivered by the control rather than argued underneath it, so the
   * slider carries three figures (`CapSlider`'s readings, in `BuildWorkspace.tsx`): what a run
   * may spend, how many passes it may take, and how many rounds of failure evidence the
   * debugger can accumulate on the way. Each has to move at every position of the slider,
   * or a reader dragging it through that stretch watches nothing happen.
   */
  it("gives the slider three figures that rise together, at every position", () => {
    for (let cap = MIN_ITERATIONS; cap < MAX_ITERATIONS; cap += 1) {
      const here = starterRunBudget({ ...variant, maxIterations: cap });
      const next = starterRunBudget({ ...variant, maxIterations: cap + 1 });
      expect(next.modelCallsAtMost, `cap ${cap}`).toBeGreaterThan(here.modelCallsAtMost);
      expect(next.testerRunsAtMost, `cap ${cap}`).toBeGreaterThan(here.testerRunsAtMost);
      expect(next.debuggerRunsAtMost, `cap ${cap}`).toBeGreaterThan(here.debuggerRunsAtMost);
    }
    // The isolation figure is the debugger's own run count rather than a second number
    // invented for the occasion: one round of evidence is one run of the debugger.
    expect(starterRunBudget({ ...variant, maxIterations: 6 }).debuggerRunsAtMost).toBe(6);
  });

  /**
   * Doc 2 §5.6 promises four things move together on this slider: cost, time, autonomy and
   * security. Measured against this engine, none of the four does.
   *
   * Autonomy is a fraction over node types and security reads the *presence* of a cap
   * (`declaresIterationCap`) and never its size, so both are flat from 1 to 10. Cost and
   * time are doc 1 §8's reported figures, which come from opt-in telemetry that does not
   * exist yet. This test is the record of that, so the page cannot be written against a
   * claim the engine does not produce.
   */
  it("does not move autonomy or security, and this is the record of it", () => {
    expect(at10.analysis.autonomy.level).toBe(at3.analysis.autonomy.level);
    expect(at10.analysis.autonomy.fraction).toBe(at3.analysis.autonomy.fraction);
    expect(at10.analysis.autonomy.rationale).toBe(at3.analysis.autonomy.rationale);
    expect(at10.analysis.security.level).toBe(at3.analysis.security.level);
    expect(at10.analysis.security.raw).toBe(at3.analysis.security.raw);
    expect(at10.analysis.security.rationale).toBe(at3.analysis.security.rationale);
    // What security does read is whether a cap exists at all — proven in the loop suite.
    expect(at3.analysis.security.findings).toEqual([]);
    expect(at10.analysis.security.findings).toEqual([]);
  });

  it("bumps the debugger card's version by the level the engine gives the change", () => {
    const three = cardModel(variant, "python-script-debugger");
    const ten = starterNodes({ ...variant, maxIterations: 10 }).find(
      (n) => n.nodeId === "debugger",
    );
    expect(ten).toBeDefined();
    if (ten === undefined) throw new Error("unreachable");
    const previous = loadCard(cardDocument(three), { ontology: ONTOLOGY }).card;
    const next = loadCard(cardDocument(ten.card), { ontology: ONTOLOGY }).card;
    expect(previous).toBeDefined();
    expect(next).toBeDefined();
    if (previous === undefined || next === undefined) throw new Error("unreachable");
    const analysis = inferBump(previous, next);
    // The cap moves `params` and the `spec` sentence that tells the agent when to stop, and
    // the engine calls a changed spec a minor bump. The version scheme follows the engine
    // rather than a rule written into `cards.ts`.
    expect(analysis.level).toBe("minor");
    expect(previous.version).toBe("1.3.0");
    expect(next.version).toBe("1.10.0");
    expect(declaredBump(previous.version, next.version)).toBe("minor");
    expect(bumpSatisfies(declaredBump(previous.version, next.version), analysis.level)).toBe(true);
  });
});

/* ============================================================
   6. The surfaces a page will read
   ============================================================ */

describe("the surfaces the workspace reads", () => {
  it("lists eight variants, four outputs by two approval modes", () => {
    expect(STARTER_VARIANTS).toHaveLength(8);
    expect(new Set(STARTER_VARIANTS.map((v) => v.output)).size).toBe(STARTER_OUTPUTS.length);
    expect(new Set(STARTER_VARIANTS.map((v) => v.approval)).size).toBe(STARTER_APPROVALS.length);
    expect(new Set(STARTER_VARIANTS.map(starterSlug)).size).toBe(8);
  });

  it("gives every variant its own card namespace", () => {
    const seen = new Map<string, string>();
    for (const variant of STARTER_VARIANTS) {
      const bundle = buildStarterBundle(AT_THREE(variant));
      for (const [file, text] of Object.entries(bundle.cardFiles)) {
        const previous = seen.get(file);
        // Doc 1 §4: one ref, one content. A file that appears in two variants has to be
        // byte-identical in both.
        if (previous !== undefined) expect(text).toBe(previous);
        else seen.set(file, text);
      }
    }
  });

  it("hands back the nodes with their DOT ids, in declaration order", () => {
    const nodes = starterNodes({ output: "docs", approval: "human", maxIterations: 5 });
    expect(nodes.map((n) => n.nodeId)).toEqual([
      "planner",
      "builder",
      "tester",
      "debugger",
      "approver",
      "deployer",
    ]);
    const dot = starterDot({ output: "docs", approval: "human", maxIterations: 5 });
    const declared = [...dot.matchAll(/^ {2}(\w+)\s+\[card="/gm)].map((m) => m[1]);
    expect(declared).toEqual(nodes.map((n) => n.nodeId));
  });

  /**
   * The README opens with this sentence and prints `nodes N` three lines below it
   * (`lib/content/bundle-export.ts`). A count written into the profile rather than taken
   * off the graph put "A five-node blueprint" above a table of six rows for every variant
   * with an approver in it, which writes the node the reader chose out of the description
   * of their own artefact.
   */
  it("counts the nodes of the graph it describes in its own summary", () => {
    const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
    for (const variant of STARTER_VARIANTS) {
      const { bundle, blueprint } = load(AT_THREE(variant));
      const count = blueprint.nodes.length;
      expect(count, starterSlug(variant)).toBe(variant.approval === "human" ? 6 : 5);
      expect(bundle.manifest.summary, starterSlug(variant)).toContain(
        `A ${WORDS[count]}-node blueprint that `,
      );
      // And no other count is asserted anywhere in the sentence.
      for (const word of WORDS.filter((w) => w !== WORDS[count])) {
        expect(bundle.manifest.summary.includes(`${word}-node`), starterSlug(variant)).toBe(
          false,
        );
      }
    }
  });

  it("writes a manifest the engine accepts and a slug that reads", () => {
    const bundle = buildStarterBundle({ output: "react", approval: "human", maxIterations: 3 });
    expect(bundle.manifest.slug).toBe("react-component-factory-with-approval");
    expect(bundle.manifest.ontologyVersion).toBe(CORE_ONTOLOGY.version);
    expect(bundle.manifest.tags).toContain("human-in-the-loop");
    // No accounts exist yet (doc 2 §6 is a later phase), so nothing invents an author.
    expect(bundle.manifest.author).toBeUndefined();
    expect(bundle.manifest.createdAt).toBeUndefined();
    expect(bundle.manifest.updatedAt).toBeUndefined();
  });
});
