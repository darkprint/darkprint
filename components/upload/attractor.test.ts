/* ============================================================
   /upload, given somebody else's Attractor pipeline

   Two claims are under test and they pull in opposite directions.

   The first is that a pipeline gets in: a `.dot` full of `prompt=`
   and `shape=` becomes a draft bundle the rest of the wizard reads,
   through the path a dropped folder already takes.

   The second is that a DarkPrint topology does NOT. That is the
   expensive half. `/upload`'s existing path is the one every reader
   uses, and a detector that mistook a topology for a pipeline would
   offer to convert a folder the reader already has cards for. So
   every shape of DarkPrint file this wizard can be handed is here
   with an assertion that the offer stays away from it, including
   the one that carries `shape=` and `prompt=` on every node.

   The fixtures are written here rather than read from
   `tests/attractor-corpus/`, which belongs to the round-trip gate.
   Sharing them would tie a UI decision to a file whose job is to
   hold the format contract, and the day that corpus grows a
   thirteenth pipeline this suite would silently start asserting
   something nobody wrote it to assert.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  ATTRACTOR_EMITTED_ATTRIBUTES,
  ATTRACTOR_UNEXPRESSED_ATTRIBUTES,
  CORE_ONTOLOGY,
  DARKPRINT_EMITTED_ATTRIBUTES,
  DERIVED_PROVENANCE_PREFIX,
  DRAFT_CARD_VERSION,
  loadBundle,
  ontologyView,
  parseDot,
  summarize,
} from "@/lib/core";

import { assembleBundle, classifyBundle, type UploadFile } from "./BundleDropzone";
import { bundleProgress } from "./progress";
import {
  IMPORTED_TOPOLOGY_NAME,
  attractorLosses,
  detectAttractorPipeline,
  importSelection,
  recordApplies,
} from "./attractor";

/* --------------------- fixtures --------------------- */

/**
 * A pipeline of the shape §2.13's minimal examples take, plus one of everything this
 * module has to have an answer for: a node with no `prompt` (§2.6 defaults it to `""`), a
 * §4.10 tool node carrying `tool_command`, a node `type=` handler override (§2.6, "takes
 * precedence over shape-based resolution"), reserved attributes on all three scopes, and
 * an attribute Attractor never reserved.
 */
const PIPELINE = `digraph release_train {
  goal="Ship the release without breaking the build.";
  label="Release train";
  graph [default_max_retries="2"];

  start [label="start", shape=Mdiamond];
  plan  [label="Plan", shape=box, prompt="Read the changelog and write the release plan.", max_retries="3", timeout="900s", owner="ops"];
  build [label="Build", shape=parallelogram, tool_command="make release", goal_gate=true];
  sign  [label="Sign off", shape=hexagon, type="wait.human"];
  exit  [label="exit", shape=Msquare];

  start -> plan;
  plan  -> build [label="go", condition="context.plan_ok=true", fidelity="full"];
  build -> sign;
  sign  -> exit;
}
`;

/** A DarkPrint topology: nodes pin cards and say nothing about how they run. */
const TOPOLOGY = `digraph frontline {
  intake [card="event-intake@1.0.0"];
  triage [card="triage-agent@1.0.0"];

  intake -> triage [label="event"];
}
`;

/**
 * The runnable copy DarkPrint used to ship beside the topology, and the reason the veto is
 * checked before anything else. Every node carries `shape=` and `prompt=` AND the `card=`
 * pin, so the evidence test alone would call this a foreign pipeline.
 */
const FACTORY = `digraph frontline {
  __start [shape=Mdiamond];
  intake  [card="event-intake@1.0.0", dp_node="intake", shape=box, prompt="Take the event.", class="dp-agent,dp-intake"];
  triage  [card="triage-agent@1.0.0", dp_node="triage", shape=box, prompt="Sort it."];
  __exit  [shape=Msquare];

  __start -> intake;
  intake -> triage;
  triage -> __exit;
}
`;

/** A topology the DarkPrint skill has started and not finished: nodes, no pins, no prompts. */
const UNPINNED = `digraph half_written {
  intake;
  triage;
  intake -> triage;
}
`;

const file = (name: string, text: string): UploadFile => ({ name, text });
const VIEW = () => ontologyView(CORE_ONTOLOGY);

/* --------------------- detection --------------------- */

describe("telling an Attractor pipeline from a DarkPrint topology", () => {
  it("recognises a pipeline, and counts the nodes that become cards", () => {
    const found = detectAttractorPipeline(file("release.dot", PIPELINE));
    expect(found).toBeDefined();
    // Three, not five: `start` and `exit` are the pipeline boundary Attractor resolves by
    // shape (§3.2, §4.4) and the import drops both.
    expect(found?.nodes).toBe(3);
    expect(found?.prompted).toBe(1);
    expect(found?.unprompted).toBe(2);
  });

  it("leaves a DarkPrint topology alone", () => {
    expect(detectAttractorPipeline(file("topology.dot", TOPOLOGY))).toBeUndefined();
  });

  it("leaves factory.dot alone, though every node in it carries a shape and a prompt", () => {
    /* The boundary that matters. Drop the `card=` veto and this file reads as a foreign
       pipeline, and the wizard offers to compile cards for a bundle whose cards the reader
       already has. Falsified by deleting the veto: this is the cell that goes red. */
    expect(detectAttractorPipeline(file("factory.dot", FACTORY))).toBeUndefined();
  });

  it("leaves a half-written topology alone, since an import would add nothing to it", () => {
    expect(detectAttractorPipeline(file("topology.dot", UNPINNED))).toBeUndefined();
  });

  it("does not read a boundary node as evidence of a pipeline", () => {
    /* `__start` and `__exit` carry a `shape` and nothing else does. Every node here would
       import with an empty `spec`, which is the state the file is already in, so the offer
       stays away. */
    const bare = `digraph half_written {
  __start [shape=Mdiamond];
  intake;
  __exit [shape=Msquare];
  __start -> intake;
  intake -> __exit;
}
`;
    expect(detectAttractorPipeline(file("topology.dot", bare))).toBeUndefined();
  });

  it("says nothing about a file that does not parse", () => {
    expect(detectAttractorPipeline(file("broken.dot", "digraph {{{"))).toBeUndefined();
  });

  it("does not offer to import the topology it just wrote", () => {
    /* Otherwise the panel returns the moment the import lands and the reader is invited to
       convert their own draft.

       TWO defences hold here, and it is worth writing down which one is load-bearing
       because they are not the same one. The synthesised topology pins every node, so the
       `card=` veto applies; it also carries no `shape` and no `prompt`, because
       `topologyDocument` writes node ids and pins and nothing else. Deleting the veto
       leaves this cell green and reds only the `factory.dot` cell, so the evidence test is
       what actually stands between a reader and an endless offer. */
    const found = detectAttractorPipeline(file("release.dot", PIPELINE));
    expect(found).toBeDefined();
    if (found === undefined) return;
    const record = importSelection(found, "berti", []);
    expect(detectAttractorPipeline(file(IMPORTED_TOPOLOGY_NAME, record.dot))).toBeUndefined();
  });
});

/* --------------------- what does not survive --------------------- */

describe("what an import drops, counted over the file in front of the reader", () => {
  const losses = () => {
    const parsed = parseDot(PIPELINE, "release.dot");
    expect(parsed.graph).toBeDefined();
    return parsed.graph === undefined ? [] : attractorLosses(parsed.graph);
  };

  it("names the reserved attributes a runner reads and no card field holds", () => {
    const named = losses().filter((l) => l.kind === "runner-reads");
    expect(named.map((l) => `${l.scope}.${l.attribute}`).sort()).toEqual([
      "edge.fidelity",
      "graph.default_max_retries",
      "node.goal_gate",
      "node.timeout",
    ]);
  });

  it("names the node `type` handler override on its own ground", () => {
    const override = losses().filter((l) => l.kind === "handler-override");
    expect(override).toHaveLength(1);
    expect(override[0].attribute).toBe("type");
    // Located, so the diagnostic can send a reader to the line rather than to the file.
    expect(override[0].firstNodeId).toBe("sign");
  });

  it("names an attribute somebody parked on a node for their own tooling", () => {
    const parked = losses().filter((l) => l.kind === "unreserved");
    expect(parked.map((l) => l.attribute)).toEqual(["owner"]);
  });

  it("says nothing about a pipeline that loses nothing", () => {
    const plain = `digraph minimal {
  goal="Answer one question and stop.";
  start  [label="start", shape=Mdiamond];
  answer [label="Answer", shape=box, prompt="Write the answer."];
  exit   [label="exit", shape=Msquare];
  start -> answer;
  answer -> exit;
}
`;
    const parsed = parseDot(plain, "minimal.dot");
    expect(parsed.graph).toBeDefined();
    expect(parsed.graph === undefined ? ["unparsed"] : attractorLosses(parsed.graph)).toEqual([]);
  });

  it("never reports an attribute the emitter writes, on any scope", () => {
    /* The claim `readsInScope` makes is that the importer reads exactly what the emitter
       writes, derived from the emitter's own two tables. This drives every one of those
       names through the loss walker at once: a name that arrives here has been called lost
       while the importer is in fact reading it, which is the failure a transcribed list
       would produce and this one cannot. */
    const scopes = ["graph", "node", "edge"] as const;
    for (const scope of scopes) {
      const names = [
        ...ATTRACTOR_EMITTED_ATTRIBUTES[scope],
        ...DARKPRINT_EMITTED_ATTRIBUTES[scope],
      ];
      const attrs = names.map((name) => `${name}="x"`).join(", ");
      const source =
        scope === "graph"
          ? `digraph g { graph [${attrs}]; a [shape=box, prompt="p"]; b; a -> b; }`
          : scope === "node"
            ? `digraph g { a [${attrs}]; b; a -> b; }`
            : `digraph g { a [shape=box, prompt="p"]; b; a -> b [${attrs}]; }`;
      const parsed = parseDot(source, "probe.dot");
      expect(parsed.graph, `${scope} probe did not parse`).toBeDefined();
      if (parsed.graph === undefined) continue;
      const reported = attractorLosses(parsed.graph)
        .filter((l) => l.scope === scope)
        .map((l) => l.attribute);
      expect(reported, `${scope}: the emitter writes these and the import reads them`).toEqual(
        [],
      );
    }
  });

  it("reports every unexpressed reserved attribute that is actually in the file", () => {
    /* The other direction. `ATTRACTOR_UNEXPRESSED_ATTRIBUTES` is what a DarkPrint blueprint
       cannot say, derived in `emit.ts` from the reserved sets; a node carrying all of them
       must therefore lose all of them, and none may be silently absorbed. */
    const names = ATTRACTOR_UNEXPRESSED_ATTRIBUTES.node;
    expect(names.length).toBeGreaterThan(0);
    /* Keys quoted: eight of these are namespaced (`manager.max_cycles`,
       `tool_hooks.pre`, `human.default_choice`) and a dot is not in the Identifier rule, so
       a bare key makes the whole file fail to parse and the cell would pass on an empty
       graph having lost nothing. */
    const attrs = names.map((name) => `"${name}"="x"`).join(", ");
    const parsed = parseDot(`digraph g { a [shape=box, prompt="p", ${attrs}]; b; a -> b; }`, "p.dot");
    expect(parsed.graph).toBeDefined();
    if (parsed.graph === undefined) return;
    const reported = new Set(
      attractorLosses(parsed.graph)
        .filter((l) => l.scope === "node")
        .map((l) => l.attribute),
    );
    for (const name of names) expect(reported.has(name), `${name} was not reported`).toBe(true);
  });
});

/* --------------------- attribution --------------------- */

describe("attribution, which has no default", () => {
  it("refuses a blank author rather than inventing one", () => {
    const found = detectAttractorPipeline(file("release.dot", PIPELINE));
    expect(found).toBeDefined();
    if (found === undefined) return;
    // The throw is `importAttractorDot`'s and it is passed through on purpose: a wrapper
    // that supplied "anonymous" here would defeat the refusal from one layer up.
    expect(() => importSelection(found, "   ", [])).toThrow(/author/);
  });

  it("writes the handle and the derived provenance into every card", () => {
    const found = detectAttractorPipeline(file("release.dot", PIPELINE));
    expect(found).toBeDefined();
    if (found === undefined) return;
    const record = importSelection(found, "berti", []);
    const cards = record.files.filter((f) => f.name.startsWith("cards/"));
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.text).toContain('author: "berti"');
      expect(card.text).toContain(`provenance: "${DERIVED_PROVENANCE_PREFIX} release.dot"`);
      expect(card.text).toContain(`version: "${DRAFT_CARD_VERSION}"`);
    }
  });
});

/* --------------------- into the flow that already exists --------------------- */

describe("the imported draft, handed to the wizard's own path", () => {
  const imported = () => {
    const found = detectAttractorPipeline(file("release.dot", PIPELINE));
    expect(found).toBeDefined();
    if (found === undefined) throw new Error("unreachable");
    return importSelection(found, "berti", [file("release.dot", PIPELINE)]);
  };

  it("classifies as a bundle: one topology, one manifest, three cards", () => {
    const parts = classifyBundle(imported().files);
    expect(parts.dot?.name).toBe(IMPORTED_TOPOLOGY_NAME);
    expect(parts.manifestDoc).toBeDefined();
    expect(parts.cards).toHaveLength(3);
    // The graph's `label`, since a draft with no title is a draft nothing can list.
    expect(parts.manifestDoc?.title).toBe("Release train");
    expect(parts.manifestDoc?.summary).toBe("Ship the release without breaking the build.");
  });

  it("resolves as far as it goes, and reads as unfinished rather than rejected", () => {
    const record = imported();
    const bundle = assembleBundle(classifyBundle(record.files), {
      title: "",
      summary: "",
      description: "",
      category: "",
      tags: [],
    });
    expect(bundle).toBeDefined();
    if (bundle === undefined) return;
    const result = loadBundle(bundle, { ontology: VIEW() });
    const progress = bundleProgress(result);
    /* `unfinished`, which is what a DRAFT is: storable, not releasable. The one node that
       carried a prompt resolved; the two that did not are waiting on a person. */
    expect(progress.state).toBe("unfinished");
    expect(progress.total).toBe(3);
    expect(progress.placed).toBe(1);
    expect(progress.waiting).toBe(2);
  });

  it("keeps the shape-to-type mapping §2.8 states, including the one hyphen DarkPrint moves", () => {
    const cards = imported().files.filter((f) => f.name.startsWith("cards/"));
    const text = (id: string) =>
      cards.find((c) => c.name.startsWith(`cards/${id}@`))?.text ?? "";
    // §2.8: box → codergen, parallelogram → tool, hexagon → wait.human.
    expect(text("plan")).toContain('type: "agent"');
    expect(text("plan")).toContain('action: "codergen"');
    expect(text("build")).toContain('type: "shell-tool"');
    expect(text("build")).toContain('action: "tool"');
    expect(text("sign")).toContain('type: "human-gate"');
    expect(text("sign")).toContain('action: "wait.human"');
  });

  it("carries the §4.10 command and the §2.6 retry cap into params", () => {
    const cards = imported().files.filter((f) => f.name.startsWith("cards/"));
    const build = cards.find((c) => c.name.startsWith("cards/build@"))?.text ?? "";
    const plan = cards.find((c) => c.name.startsWith("cards/plan@"))?.text ?? "";
    expect(build).toContain('tool_command: "make release"');
    // §2.6: `max_retries=3` is three attempts beyond the first. It lands under the key
    // `readIterationCap` reads, so the export writes the same number back out.
    expect(plan).toContain("max_iterations: 3");
  });

  it("names every node that arrived with an empty spec", () => {
    const record = imported();
    const empty = record.diagnostics.filter(
      (d) => d.code === "card/missing-field" && d.message.includes("no `prompt`"),
    );
    expect(empty.map((d) => d.location?.nodeId).sort()).toEqual(["build", "sign"]);
    for (const d of empty) expect(d.severity).toBe("warning");
  });

  it("carries the dropped attributes as diagnostics, so they reach the report", () => {
    const record = imported();
    const dropped = record.diagnostics.filter(
      (d) => d.code === "dot/unsupported" && d.message.includes("nothing in a DarkPrint bundle"),
    );
    const named = dropped.map((d) => d.message);
    for (const attribute of ["timeout", "goal_gate", "default_max_retries", "fidelity", "owner", "type"]) {
      expect(
        named.some((m) => m.startsWith(`\`${attribute}\``)),
        `${attribute} was dropped and nothing said so`,
      ).toBe(true);
    }
    // Warnings, every one. `gate.ts` rule 4 forbids a DarkPrint inference from refusing
    // anybody's work, and losing an attribute a runner reads is a fact about the format.
    for (const d of dropped) expect(d.severity).toBe("warning");
  });

  it("resolves once the two empty specs are written, with the port findings the panel warns about", () => {
    /* The whole claim of the lane, end to end: this is a real way into the registry rather
       than a decorative conversion. Fill in the half the pipeline could not say and every
       node joins a card.

       What is left is `bundle/port-mismatch` on each edge, and it is asserted here rather
       than tolerated. `import.ts` writes `inputs: []` and `outputs: []` on every card
       because no Attractor file has ever carried a port, so an imported draft cannot be
       free of these and a cell claiming it was would be describing a different importer.
       D-109 makes them an inference and an inference may not refuse a release, which is why
       the state is `resolves` with the findings printed beside it. `AttractorOffer` says so
       before the button is pressed. */
    const record = imported();
    const filled = record.files.map((f) =>
      f.name.startsWith("cards/")
        ? {
            name: f.name,
            text: f.text.replace(
              'spec: ""',
              'spec: "Run the release build and report what it produced, or what broke."',
            ),
          }
        : f,
    );
    const bundle = assembleBundle(classifyBundle(filled), {
      title: "",
      summary: "",
      description: "",
      category: "",
      tags: [],
    });
    expect(bundle).toBeDefined();
    if (bundle === undefined) return;
    const result = loadBundle(bundle, { ontology: VIEW() });
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.map((d) => d.code)).toEqual([
      "bundle/port-mismatch",
      "bundle/port-mismatch",
    ]);
    expect(summarize(result.diagnostics).error).toBe(errors.length);
    expect(bundleProgress(result).state).toBe("resolves");
    expect(result.blueprint?.nodes).toHaveLength(3);
  });
});

/* --------------------- the record's own scope --------------------- */

describe("whether an import record still describes what is on screen", () => {
  const record = () => {
    const found = detectAttractorPipeline(file("release.dot", PIPELINE));
    if (found === undefined) throw new Error("unreachable");
    return importSelection(found, "berti", [file("release.dot", PIPELINE)]);
  };

  it("applies to the selection it produced", () => {
    const r = record();
    expect(recordApplies(r, r.files)).toBe(true);
  });

  it("still applies after a card is removed, which is when its warnings matter most", () => {
    const r = record();
    expect(recordApplies(r, r.files.filter((f) => !f.name.startsWith("cards/")))).toBe(true);
  });

  it("stops applying once a different graph is dropped on top", () => {
    const r = record();
    const replaced = r.files.map((f) =>
      f.name === IMPORTED_TOPOLOGY_NAME ? file(IMPORTED_TOPOLOGY_NAME, TOPOLOGY) : f,
    );
    expect(recordApplies(r, replaced)).toBe(false);
  });

  it("does not apply to an empty selection", () => {
    expect(recordApplies(record(), [])).toBe(false);
    expect(recordApplies(undefined, [])).toBe(false);
  });

  it("keeps the selection the import replaced, so it can be put back", () => {
    expect(record().restore.map((f) => f.name)).toEqual(["release.dot"]);
  });
});
