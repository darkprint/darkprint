import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, loadBundle, ontologyView, type Bundle, type NodeCard } from "@/lib/core";
import type { CommunitySignals } from "@/lib/data/community";

import { autonomyStatement } from "@/lib/format";
import { agentNodeKind, graphForBlueprint, withoutCardLinks } from "@/lib/graph-seed";
import { toBlueprintView } from "./view";

const ontology = ontologyView(CORE_ONTOLOGY);

function cardOf(type: string, over: Partial<NodeCard> = {}): NodeCard {
  return {
    id: "probe",
    name: "Probe",
    type,
    // `phases` is a list a card may leave empty, and doc 1 §3.2 makes `spec` the payload
    // the agent receives. Neither is read by `agentNodeKind`, but a NodeCard without
    // them is not a NodeCard — the field is required, its contents are not.
    phases: ["implementation"],
    action: "Stand in for a real card while the mapping is exercised.",
    spec: "Stand in for a real card while the ontology→schematic mapping is exercised, and produce nothing.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    requiresHuman: false,
    riskMarkers: [],
    version: "1.0.0",
    ontologyVersion: "0.1.0",
    ...over,
  };
}

/* ============================================================
   The seam, on ontology v0.1. `lib/graph-seed.ts` used to key its
   reverse map on the pre-doc-3 tree — `trigger`, `control`,
   `memory`, `sink`, `human-control`, `manual-input` — and none of
   those is a term any more; the rows are gone, and with them the
   case that asserted they still answered. Two gaps recorded by the
   content migration are closed here rather than restated:
   `human-input` draws as a kind of its own — doc 3 §3 makes it the
   type where a person supplies data, which is not the type where a
   person approves — and `start` is reachable again through position
   instead of through a type nobody can declare.
   ============================================================ */

/** Mid-line: something upstream, something downstream. The common case. */
const MIDLINE = { isEntry: false, isTerminal: false };

describe("agentNodeKind — the ontology→schematic seam", () => {
  it("maps all six of doc 3 §3's concrete types", () => {
    const cases: [string, string][] = [
      ["agent", "executor"],
      ["tool", "tool"],
      ["validation", "verifier"],
      ["decision", "router"],
      ["human-gate", "gate"],
      // Was the recorded defect, twice over: with no row of its own it walked past
      // every ancestor and landed on the neutral `executor`, drawing a working node
      // where a person is; a row pointing it at `gate` then drew it labelled *Human
      // gate*, asserting the approval checkpoint doc 3 §3 defines as the *other* human
      // type. A person supplies data here, and that is a kind of its own.
      ["human-input", "human-input"],
    ];
    for (const [type, kind] of cases) {
      expect([type, agentNodeKind(cardOf(type), ontology, MIDLINE)]).toEqual([type, kind]);
    }
  });

  it("reads a tool-family node's position, which is all that tells intake from delivery", () => {
    // v0.1 folded `trigger`, `sink`, `memory` and `control` into `tool`, so both ends of
    // a pipeline declare the same term and only the topology separates them.
    const tool = cardOf("tool");
    expect(agentNodeKind(tool, ontology, MIDLINE)).toBe("tool");
    expect(agentNodeKind(tool, ontology, { isEntry: true, isTerminal: false })).toBe("start");
    expect(agentNodeKind(tool, ontology, { isEntry: false, isTerminal: true })).toBe("ship");
    // Both ends at once — a node with no edges either way. Terminal wins: nothing
    // follows it, which is the more useful of the two things to say.
    expect(agentNodeKind(tool, ontology, { isEntry: true, isTerminal: true })).toBe("ship");
  });

  it("never lets position override a type that is not in the tool family", () => {
    // The starter blueprint's `planner` and `builder` both sit at the head of the graph.
    const entry = { isEntry: true, isTerminal: false };
    expect(agentNodeKind(cardOf("agent"), ontology, entry)).toBe("executor");
    expect(agentNodeKind(cardOf("human-gate"), ontology, { isEntry: false, isTerminal: true })).toBe(
      "gate",
    );
  });

  it("walks up to the nearest mapped ancestor for a local type", () => {
    // Doc 3 §7's mechanism, seen from the UI: a namespaced type rooted at a core one
    // draws as whatever the core term draws as, without the table naming it.
    const local = ontologyView(CORE_ONTOLOGY, [
      {
        id: "acme/spot-check",
        kind: "node-type",
        label: "Spot check",
        description: "A local specialisation of `validation`.",
        broader: "validation",
        since: "0.1.0",
      },
      {
        id: "acme/publisher",
        kind: "node-type",
        label: "Publisher",
        description: "A local specialisation of `tool`.",
        broader: "tool",
        since: "0.1.0",
      },
      {
        id: "acme/sign-off",
        kind: "node-type",
        label: "Sign-off",
        description: "A local human type rooted straight at the abstract category.",
        broader: "human-in-the-loop",
        impliesHuman: true,
        since: "0.1.0",
      },
    ]);
    expect(agentNodeKind(cardOf("acme/spot-check"), local, MIDLINE)).toBe("verifier");
    expect(agentNodeKind(cardOf("acme/publisher"), local, MIDLINE)).toBe("tool");
    expect(agentNodeKind(cardOf("acme/publisher"), local, { isEntry: false, isTerminal: true })).toBe(
      "ship",
    );
    // Doc 3 §3's promise, held at the seam: a new human type falls into the category
    // without the metric's code changing, so the drawing has to follow it there too —
    // otherwise the schematic contradicts the autonomy score printed beside it.
    expect(agentNodeKind(cardOf("acme/sign-off"), local, MIDLINE)).toBe("gate");
  });

  it("falls back to the neutral kind for a type outside the vocabulary", () => {
    expect(agentNodeKind(cardOf("berti/whatsit"), ontology, MIDLINE)).toBe("executor");
  });
});

/* ============================================================
   `analysis.diagnostics` is the *whole* list, resolution included.
   The shipped archive resolves clean, so the only honest way to test
   this seam is against a bundle built to be broken: `sink` receives
   from `source` and does not declare it, which only the resolver
   notices. Pinning the assertion to real content would mean keeping a
   defect in the gallery so a test could find it.
   ============================================================ */

const YAML_SOURCE = `
id: source
name: Source
type: tool
# Three of the five, with sink carrying the other two, so the probe is a dark factory
# under both halves of the rule: nobody waits in it AND it covers the whole lifecycle.
# Before 2026-08-04 the flag asked only the first question and this card declared planning
# alone. The phases are a fixture detail, since nothing here asserts coverage, but a
# two-phase probe would now class as "not a factory" and the assertion below would be
# testing the wrong thing.
phase: [planning, implementation, testing]
action: Emit one payload so the probe bundle has something to carry.
spec: >-
  Emit exactly one payload on \`payload\` so the bundle downstream of you has something to
  carry, and then stop. Nothing is handed to you and nothing else is expected.
tools: []
params: {}
inputs: []
outputs:
  - name: payload
    type: json
dependencies: []
requires_human: false
risk_markers: []
version: 1.0.0
ontology_version: 0.1.0
`;

const YAML_SINK = `
id: sink
name: Sink
type: tool
phase: [debugging, deployment]
action: Swallow the payload, declaring no dependency on whoever sent it.
spec: >-
  Take the payload you are handed on \`payload\`, write it to the fixture's destination
  unchanged, and emit nothing onward — this is the last step of the run.
tools: []
params: {}
inputs:
  - name: payload
    type: json
outputs: []
dependencies: []
requires_human: false
risk_markers: []
version: 1.0.0
ontology_version: 0.1.0
`;

const PROBE_BUNDLE: Bundle = {
  manifest: {
    slug: "probe",
    title: "Probe",
    summary: "A two-node bundle whose only purpose is to raise a resolver warning.",
    tags: [],
    ontologyVersion: "0.1.0",
  },
  dot: `digraph probe {
  source [card="source@1.0.0"];
  sink   [card="sink@1.0.0"];
  source -> sink;
}`,
  cardFiles: {
    "cards/source@1.0.0.yaml": YAML_SOURCE,
    "cards/sink@1.0.0.yaml": YAML_SINK,
  },
};

const community: CommunitySignals = {
  downloads: 0,
  votes: 0,
  comments: [],
  efficacy: 0,
  reliability: 0,
  transparency: 0,
  cost: 0,
};

describe("toBlueprintView — the diagnostics passthrough", () => {
  const result = loadBundle(PROBE_BUNDLE, { ontology });

  it("the probe bundle really does raise a resolver-only warning", () => {
    expect(result.diagnostics.map((d) => d.code)).toContain("bundle/undeclared-dependency");
    // The analyzers never see it — which is what makes it a passthrough test.
    expect(result.analysis?.diagnostics.map((d) => d.code) ?? []).not.toContain(
      "bundle/undeclared-dependency",
    );
  });

  it("carries the supplied list through to `analysis.diagnostics`", () => {
    const view = toBlueprintView({
      blueprint: result.blueprint!,
      analysis: result.analysis!,
      community,
      diagnostics: result.diagnostics,
    });
    expect(view.analysis?.diagnostics.map((d) => d.code)).toContain(
      "bundle/undeclared-dependency",
    );
  });

  it("falls back to the analyzers' own list when none is supplied", () => {
    const view = toBlueprintView({
      blueprint: result.blueprint!,
      analysis: result.analysis!,
      community,
    });
    expect(view.analysis?.diagnostics).toEqual(result.analysis!.diagnostics);
  });
});

/* ============================================================
   Spec part 3 — a node of a rendered graph opens its card, and
   only where that card has a page.

   The seed carries the id under `cardsInRegistry` and not
   otherwise. That is the whole guard: `/nodes/[...id]` is
   statically generated with `dynamicParams = false`, so a link
   built for a bundle the reader dropped into the upload wizard,
   or for the variant cards the workspace generates a moment
   before drawing them, lands on a 404. Only the archive path can
   promise the page exists, and only the archive path passes the
   flag.
   ============================================================ */

describe("graphForBlueprint — the card id on the seed", () => {
  const bp = loadBundle(PROBE_BUNDLE, { ontology }).blueprint!;

  it("leaves the seed unlinked by default", () => {
    for (const node of graphForBlueprint(bp).nodes) {
      expect([node.id, node.cardId]).toEqual([node.id, undefined]);
    }
  });

  it("carries the card id, without its version, when the cards are in the registry", () => {
    const nodes = graphForBlueprint(bp, { cardsInRegistry: true }).nodes;
    expect(nodes.map((n) => n.cardId)).toEqual(["source", "sink"]);
    // The bare id is what `/nodes/<id>` is keyed on: it resolves to the newest published
    // version, and the pin this bundle holds is stated in the bundle panel instead.
    expect(nodes.every((n) => !(n.cardId ?? "").includes("@"))).toBe(true);
  });

  it("puts the id on every drawn node of a view-model blueprint", () => {
    const view = toBlueprintView({
      blueprint: bp,
      analysis: loadBundle(PROBE_BUNDLE, { ontology }).analysis!,
      community,
    });
    expect(view.graph.nodes.map((n) => n.cardId)).toEqual(["source", "sink"]);
  });
});

/* ============================================================
   The other half of spec part 3: a pane that claims the click
   takes the links off first.

   `cardsInRegistry` says the cards have pages. It does **not** say
   every mount of that graph may draw anchors, and treating it that
   way shipped a real defect: `app/blueprints/[slug]/page.tsx`
   hands one archive graph to `BlueprintCanvas`, where the links
   belong, and to `SynchronisedPanes` → `GraphPane`, whose wrapper
   reads a click on a node as doc 2 §5.1's selection. `AgentNode`
   calls `stopPropagation` on the anchor, so on that page a pointer
   aimed at a node name cancelled the pane's handler and navigated
   off the blueprint instead of moving the selection across the
   four panes. Enter on the same link diverged the other way: the
   pane calls `preventDefault`, so the keyboard selected the node
   and never navigated.

   The panes that claim the gesture now strip the ids themselves.
   This is that step, isolated from React so it can be checked.
   ============================================================ */

describe("withoutCardLinks — the graph a click-claiming pane draws", () => {
  const bp = loadBundle(PROBE_BUNDLE, { ontology }).blueprint!;
  const linked = graphForBlueprint(bp, { cardsInRegistry: true });

  it("takes the card id off every node", () => {
    expect(linked.nodes.map((n) => n.cardId)).toEqual(["source", "sink"]);
    const stripped = withoutCardLinks(linked);
    expect(stripped.nodes.map((n) => n.cardId)).toEqual([undefined, undefined]);
    // Absent, not present-and-empty: `AgentNode` renders the plain name for `undefined`
    // and would build a link to `/nodes/` for "".
    for (const node of stripped.nodes) {
      expect(Object.hasOwn(node, "cardId")).toBe(false);
    }
  });

  it("changes nothing else about the drawing", () => {
    const stripped = withoutCardLinks(linked);
    expect(stripped.dot).toBe(linked.dot);
    expect(stripped.edges).toEqual(linked.edges);
    expect(stripped.nodes.map((n) => n.id)).toEqual(linked.nodes.map((n) => n.id));
    expect(stripped.nodes.map((n) => n.kind)).toEqual(linked.nodes.map((n) => n.kind));
    expect(stripped.nodes.map((n) => n.label)).toEqual(linked.nodes.map((n) => n.label));
    expect(stripped.nodes.map((n) => n.position)).toEqual(
      linked.nodes.map((n) => n.position),
    );
  });

  it("leaves an already unlinked graph alone", () => {
    const plain = graphForBlueprint(bp);
    expect(withoutCardLinks(plain)).toEqual(plain);
  });

  it("does not mutate the graph it was handed", () => {
    withoutCardLinks(linked);
    expect(linked.nodes.map((n) => n.cardId)).toEqual(["source", "sink"]);
  });
});

/* ============================================================
   Spec part 2 — the view model states the class and never the
   number.

   `level` survives on `AutonomyInfo` because a filter list needs a
   stable order and doc 3 §6's thresholds are arithmetic. What the
   surfaces read is `autonomyClass`, `label` and `isDarkFactory`,
   and the last of those is counted from the human nodes rather
   than read off the band — which is why the two-node probe below
   and the three-node one beside it are both worth having.
   ============================================================ */

const YAML_GATE = `
id: gate
name: Release gate
type: human-gate
phase: deployment
action: Hold the payload until a person approves the release.
spec: >-
  Show the payload you are handed on \`payload\` to the person on duty and wait. Release it
  onward only once they approve, and stop the run if they refuse.
tools: []
params: {}
inputs:
  - name: payload
    type: json
outputs:
  - name: approved
    type: json
dependencies:
  - source
requires_human: true
risk_markers: []
version: 1.0.0
ontology_version: 0.1.0
`;

/** The probe with a person standing in the middle of it. */
const STAFFED_BUNDLE: Bundle = {
  manifest: { ...PROBE_BUNDLE.manifest, slug: "staffed", title: "Staffed" },
  dot: `digraph staffed {
  source [card="source@1.0.0"];
  gate   [card="gate@1.0.0"];
  sink   [card="sink@1.0.0"];
  source -> gate;
  gate -> sink;
}`,
  cardFiles: { ...PROBE_BUNDLE.cardFiles, "cards/gate@1.0.0.yaml": YAML_GATE },
};

describe("toBlueprintView — autonomy as a class", () => {
  const dark = loadBundle(PROBE_BUNDLE, { ontology });
  const staffed = loadBundle(STAFFED_BUNDLE, { ontology });

  const viewOf = (r: typeof dark) =>
    toBlueprintView({ blueprint: r.blueprint!, analysis: r.analysis!, community });

  it("takes the class, the label and the flag straight from the engine", () => {
    for (const r of [dark, staffed]) {
      const view = viewOf(r);
      expect(view.autonomy.autonomyClass).toBe(r.analysis!.autonomy.autonomyClass);
      expect(view.autonomy.label).toBe(r.analysis!.autonomy.label);
      expect(view.autonomy.isDarkFactory).toBe(r.analysis!.autonomy.isDarkFactory);
    }
  });

  it("classes an unattended graph covering all five phases a dark factory", () => {
    const view = viewOf(dark);
    expect(view.autonomy.isDarkFactory).toBe(true);
    expect(view.autonomy.autonomyClass).toBe("closed-loop");
  });

  it("keeps the classification off a graph a person stands in", () => {
    // Two of three nodes run unattended, so the band is not the top one either. The
    // point of the pair is that the flag is counted from the human nodes and never read
    // off the band: `isDarkFactory` is false here because somebody is in the graph, and
    // it would still be false at a fraction the top band accepts.
    const view = viewOf(staffed);
    expect(view.autonomy.isDarkFactory).toBe(false);
    expect(view.autonomy.autonomyClass).toBe("supervised");
  });

  it("gives every class a blurb that says what the design does", () => {
    for (const r of [dark, staffed]) {
      const { blurb } = viewOf(r).autonomy;
      expect(blurb.length).toBeGreaterThan(0);
      // Doc 2 §1.1: nothing implying a maximum, a ranking or a shortfall, and no number
      // for the 1-to-5 organisational ladder to collide with.
      expect(blurb).not.toMatch(/out of|level|\blevels?\b|only|fully|achiev|score/i);
    }
  });

  it("keeps the band available for ordering and out of everything a reader sees", () => {
    // The one sanctioned use: a filter list needs a stable order, and the class names
    // have none of their own. Nothing in `AutonomyInfo` prints it.
    const view = viewOf(dark);
    expect(view.autonomy.level).toBe(dark.analysis!.autonomy.level);
    expect(view.autonomy.label).not.toMatch(/\d/);
    expect(view.autonomy.blurb).not.toMatch(/\d/);
  });

  /**
   * `Blueprint` crosses the server/client boundary — `GalleryBrowser` and
   * `BlueprintCanvas` are client components — so everything on it is serialised into the
   * RSC payload of every page that renders one, whether or not a surface prints it. The
   * engine's raw rationale ends in "→ level 4 (Closed-loop)", so passing it through
   * would put the band in the shipped HTML of pages that never show it.
   *
   * The bridge substitutes the display sentence and nothing else, which the second half
   * of this test pins: same counts, same fraction, same class, one number fewer.
   */
  it("carries an autonomy rationale with no band ordinal in it", () => {
    for (const r of [dark, staffed]) {
      const view = viewOf(r);
      const raw = r.analysis!.autonomy.rationale;

      expect(view.analysis.autonomy.rationale).not.toMatch(/level\s*\d/);
      expect(view.analysis.autonomy.rationale).toBe(autonomyStatement(raw));
      // Everything the sentence said other than the ordinal is still in it.
      expect(view.analysis.autonomy.rationale).toContain(
        `${r.analysis!.autonomy.autonomousNodes} of ${r.analysis!.autonomy.totalNodes}`,
      );
      expect(view.analysis.autonomy.rationale).toContain(r.analysis!.autonomy.label);

      // The rest of the engine's reading is untouched.
      expect(view.analysis.autonomy.level).toBe(r.analysis!.autonomy.level);
      expect(view.analysis.autonomy.fraction).toBe(r.analysis!.autonomy.fraction);
      expect(view.analysis.autonomy.contributions).toEqual(r.analysis!.autonomy.contributions);
      expect(view.analysis.autonomy.ontologyVersion).toBe(r.analysis!.autonomy.ontologyVersion);
    }
  });
});
