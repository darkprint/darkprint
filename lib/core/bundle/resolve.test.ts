/* ============================================================
   Tests for bundle resolution (doc 1 §2, spec PART 5).
   Everything here is a real bundle: hand-written DOT plus hand-written
   YAML cards. One five-node blueprint resolves cleanly, and every
   broken variant is derived from it, so each diagnostic is provably
   caused by the one thing that was changed.

   The card library was rewritten against ontology v0.1 (doc 3): one
   of the five phases and one of the vocabulary node types on every card, a
   `spec` that is a real instruction rather than a placeholder, and
   the vocabulary version the engine actually ships. The old
   `trigger` / `sink` / `memory` types and the `image` port type no
   longer exist, and a fixture that used them would be testing a
   vocabulary nobody can write cards against.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { computeAutonomy } from "../analysis/autonomy";
import { computePhaseCoverage } from "../analysis/phase-coverage";
import { computeSecurity } from "../analysis/security";
import { loadCard } from "../card/validate";
import type { Diagnostic, DiagnosticCode } from "../diagnostics";
import { cardDigest, shortDigest } from "../hash/digest";
import { CORE_ONTOLOGY } from "../ontology/core";
import { ontologyView } from "../ontology/resolve";
import { resolveBundle } from "./resolve";
import type { Bundle, BundleManifest, ResolvedBlueprint, ResolveResult } from "./types";

const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/** Read off the vocabulary, so a fixture cannot drift from the ontology it is read against. */
const ONTOLOGY_VERSION = CORE_ONTOLOGY.version;

/* ------------------------------------------------------------------ */
/* the card library                                                     */
/* ------------------------------------------------------------------ */

const INTAKE = `
id: intake
name: Intake
type: tool
phase: planning
action: Receive the request that starts a run
spec: Take the request text exactly as the operator submitted it and put it on the request port without editing or summarising it.
inputs: []
outputs:
  - { name: request, type: text }
version: 1.0.0
`;

const PLANNER = `
id: planner
name: Planner
type: agent
phase: planning
action: Break the request into steps
spec: Read the request and write an ordered plan of the sections the article needs, one line per section, with nothing about how the result will be judged.
inputs:
  - { name: request, type: text }
outputs:
  - { name: plan, type: plan }
dependencies: [intake]
version: 1.0.0
`;

const WRITER = `
id: writer
name: Writer
type: agent
phase: implementation
action: Draft the article the plan describes
spec: Write the article the plan asks for, in Markdown, one section per line of the plan. Do not go looking for the acceptance criteria.
inputs:
  - { name: plan, type: plan }
outputs:
  - { name: draft, type: markdown }
dependencies: [planner]
version: 1.0.0
`;

const REVIEW = `
id: review
name: Review
type: validation
phase: testing
action: Check the draft against the plan
spec: Compare the draft against the plan section by section and emit a verdict plus the approved text, quoting the evidence for every rejection.
inputs:
  - { name: draft, type: markdown }
outputs:
  - { name: verdict, type: status }
  - { name: approved, type: markdown }
dependencies: [writer]
version: 1.0.0
`;

const DELIVER = `
id: deliver
name: Deliver
type: tool
phase: deployment
action: Publish the approved article
spec: Publish the approved article to the channel named in the run configuration and report the published location.
inputs:
  - { name: article, type: markdown }
outputs: []
dependencies: [review]
version: 1.0.0
`;

/** Two ports of the same family — anything that accepts `any` pairs with both. */
const ARCHIVE = `
id: archive
name: Archive
type: tool
phase: deployment
action: Keep whatever the run produced
spec: Store whatever arrives on the item port under the run identifier, without inspecting or transforming it.
inputs:
  - { name: item, type: any }
outputs: []
version: 1.0.0
`;

/** Accepts a broader type than the planner produces — exercises subsumption. */
const BROAD = `
id: broad
name: Broad
type: agent
phase: implementation
action: Accept anything with a shape and hand it on
spec: Take the structured payload, leave its contents alone, and pass it on unchanged to whatever comes next.
inputs:
  - { name: payload, type: structured }
outputs:
  - { name: result, type: any }
version: 1.0.0
`;

/** Wants an artifact; nothing upstream produces one. */
const PICKY = `
id: picky
name: Picky
type: agent
phase: implementation
action: Retouch the build output
spec: Open the artifact on the photo port, apply the retouching profile, and write the result back in place.
inputs:
  - { name: photo, type: artifact }
outputs: []
version: 1.0.0
`;

/** Produces a type that subsumes `artifact` — the wrong way round for `picky`. */
const SCANNER = `
id: scanner
name: Scanner
type: tool
phase: implementation
action: Digitise whatever is on the platen
spec: Scan the sheet on the platen at the configured resolution and emit the raw bytes without interpreting them.
inputs: []
outputs:
  - { name: bytes, type: binary }
version: 1.0.0
`;

/** Declares no interface at all. */
const MUTE = `
id: mute
name: Mute
type: agent
phase: implementation
action: Do something the card does not describe
spec: Carry out the step the run configuration names, using only what the configuration itself provides.
inputs: []
outputs: []
version: 1.0.0
`;

/** Instantiated twice in the cycle fixtures. */
const LOOPER = `
id: looper
name: Looper
type: agent
phase: debugging
action: Go round again
spec: Take the value on the input port, try the same repair once more, and emit whatever came of it on the output port.
inputs:
  - { name: input, type: any }
outputs:
  - { name: output, type: any }
version: 1.0.0
`;

const CARD_FILES: Readonly<Record<string, string>> = {
  "cards/intake@1.0.0.yaml": INTAKE,
  "cards/planner@1.0.0.yaml": PLANNER,
  "cards/writer@1.0.0.yaml": WRITER,
  "cards/review@1.0.0.yaml": REVIEW,
  "cards/deliver@1.0.0.yaml": DELIVER,
};

/* ------------------------------------------------------------------ */
/* the blueprint                                                        */
/* ------------------------------------------------------------------ */

const BASE_DOT = `digraph editorial {
  rankdir=LR;
  node [shape=box, style=rounded];

  intake  [card="intake@1.0.0"];
  planner [card="planner@1.0.0"];
  writer  [version="1.0.0"];
  review  [card="review@1.0.0"];
  deliver [card="deliver@1.0.0"];

  intake  -> planner [label="request"];
  planner -> writer;
  writer  -> review  [label="draft"];
  review  -> deliver [label="approved"];
}`;

const MANIFEST: BundleManifest = {
  slug: "editorial",
  title: "Editorial pipeline",
  summary: "Intake, plan, write, review, deliver.",
  tags: ["writing"],
};

function makeBundle(
  dot: string,
  cardFiles: Readonly<Record<string, string>> = CARD_FILES,
  manifest: Partial<BundleManifest> = {},
): Bundle {
  return { manifest: { ...MANIFEST, ...manifest }, dot, cardFiles };
}

function resolve(
  dot: string,
  cardFiles?: Readonly<Record<string, string>>,
  manifest?: Partial<BundleManifest>,
): ResolveResult {
  return resolveBundle(makeBundle(dot, cardFiles, manifest), ONTOLOGY);
}

/** Narrow the optional blueprint, failing with the diagnostics instead of casting. */
function mustResolve(result: ResolveResult): ResolvedBlueprint {
  if (result.blueprint === undefined) {
    throw new Error(`expected a blueprint, got: ${JSON.stringify(result.diagnostics, null, 2)}`);
  }
  return result.blueprint;
}

function codes(ds: readonly Diagnostic[]): DiagnosticCode[] {
  return ds.map((d) => d.code);
}

function withCode(ds: readonly Diagnostic[], code: DiagnosticCode): Diagnostic[] {
  return ds.filter((d) => d.code === code);
}

/** Exactly one diagnostic of `code`, or a failure naming what was actually reported. */
function one(ds: readonly Diagnostic[], code: DiagnosticCode): Diagnostic {
  const found = withCode(ds, code);
  if (found.length !== 1) {
    throw new Error(`expected one ${code}, got ${found.length} of ${JSON.stringify(codes(ds))}`);
  }
  return found[0];
}

/** The digest a card file hashes to, computed the way the resolver computes it. */
function digestOfCard(text: string): string {
  const loaded = loadCard(text, { ontology: ONTOLOGY });
  if (loaded.card === undefined) {
    throw new Error(`fixture card is invalid: ${JSON.stringify(loaded.diagnostics)}`);
  }
  return cardDigest(loaded.card);
}

/** A DOT body wrapped in the standard header, for the small purpose-built graphs. */
function dot(body: string): string {
  return `digraph fixture {\n${body}\n}`;
}

/* ================================================================== */

describe("a well-formed bundle", () => {
  const result = resolve(BASE_DOT);
  const bp = mustResolve(result);

  it("resolves with no diagnostics at all", () => {
    expect(result.diagnostics).toEqual([]);
  });

  it("joins every DOT node to its card", () => {
    expect(bp.nodes.map((n) => n.nodeId)).toEqual([
      "intake",
      "planner",
      "writer",
      "review",
      "deliver",
    ]);
    expect(bp.nodes.map((n) => n.ref)).toEqual([
      "intake@1.0.0",
      "planner@1.0.0",
      "writer@1.0.0",
      "review@1.0.0",
      "deliver@1.0.0",
    ]);
    expect(bp.nodes.map((n) => n.card.name)).toEqual([
      "Intake",
      "Planner",
      "Writer",
      "Review",
      "Deliver",
    ]);
  });

  it("carries the DOT attributes, defaults included, onto the resolved node", () => {
    const intake = bp.nodes[0];
    expect(intake.attrs).toEqual({
      shape: "box",
      style: "rounded",
      card: "intake@1.0.0",
    });
  });

  it("digests every card and the bundle as a whole", () => {
    for (const node of bp.nodes) {
      expect(node.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    expect(bp.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(bp.nodes[0].digest).toBe(digestOfCard(INTAKE));
  });

  it("wires each edge to the one type-compatible pair of ports", () => {
    expect(
      bp.edges.map((e) => `${e.source}.${e.fromPort?.name} -> ${e.target}.${e.toPort?.name}`),
    ).toEqual([
      "intake.request -> planner.request",
      "planner.plan -> writer.plan",
      "writer.draft -> review.draft",
      "review.approved -> deliver.article",
    ]);
  });

  it("keeps the edge label and attributes", () => {
    expect(bp.edges[0].label).toBe("request");
    expect(bp.edges[0].attrs).toEqual({ label: "request" });
    expect(bp.edges[1].label).toBeUndefined();
  });

  it("exposes the topology and the vocabulary it was read against", () => {
    expect(bp.graph.ids).toEqual(["intake", "planner", "writer", "review", "deliver"]);
    expect(bp.graph.sources()).toEqual(["intake"]);
    expect(bp.graph.sinks()).toEqual(["deliver"]);
    expect(bp.ontology).toBe(ONTOLOGY);
    expect(bp.manifest).toEqual(MANIFEST);
    expect(bp.dot).toBe(BASE_DOT);
  });

  it("indexes every card in the bundle by ref", () => {
    expect([...bp.cards.keys()].sort()).toEqual([
      "deliver@1.0.0",
      "intake@1.0.0",
      "planner@1.0.0",
      "review@1.0.0",
      "writer@1.0.0",
    ]);
  });

  it("is deterministic — same bundle, same digest and same diagnostics", () => {
    const again = mustResolve(resolve(BASE_DOT));
    expect(again.digest).toBe(bp.digest);
    expect(again.nodes).toEqual(bp.nodes);
    expect(again.edges).toEqual(bp.edges);
  });

  it("does not depend on the order the card files arrived in", () => {
    const reversed: Record<string, string> = {};
    for (const file of Object.keys(CARD_FILES).reverse()) reversed[file] = CARD_FILES[file];
    const shuffled = resolve(BASE_DOT, reversed);
    expect(shuffled.diagnostics).toEqual([]);
    expect(mustResolve(shuffled).digest).toBe(bp.digest);
  });

  it("feeds the analyzers without complaint", () => {
    expect(computeAutonomy(bp).level).toBe(4);
    expect(computeSecurity(bp).level).toBe(4);
  });

  it("establishes phase coverage from the cards the graph pins", () => {
    // Doc 2 §8 and spec PART 5. Four of the five phases, in doc 3 §2 lifecycle order —
    // and `missing` is a statement of scope, not a to-do list (doc 2 §1.1).
    expect(bp.phaseCoverage.covered).toEqual([
      "planning",
      "implementation",
      "testing",
      "deployment",
    ]);
    expect(bp.phaseCoverage.missing).toEqual(["debugging"]);
    expect(bp.phaseCoverage.byPhase).toEqual({
      planning: ["intake", "planner"],
      implementation: ["writer"],
      testing: ["review"],
      debugging: [],
      deployment: ["deliver"],
    });
  });
});

/* ------------------------------------------------------------------ */
/* phase coverage (doc 2 §8, doc 3 §2, spec PART 5)                     */
/* ------------------------------------------------------------------ */

describe("phase coverage on the resolved blueprint", () => {
  it("agrees with computePhaseCoverage over the same blueprint", () => {
    const bp = mustResolve(resolve(BASE_DOT));
    expect(bp.phaseCoverage).toEqual(computePhaseCoverage(bp));
  });

  it("leaves a node whose card is missing out of every group", () => {
    const src = BASE_DOT.replace('card="planner@1.0.0"', 'card="planner@2.0.0"');
    const bp = mustResolve(resolve(src));
    expect(bp.graph.ids).toContain("planner");
    expect(bp.phaseCoverage.byPhase.planning).toEqual(["intake"]);
  });

  it("covers nothing for an empty graph, and still names all five phases", () => {
    const bp = mustResolve(resolve("digraph empty {}", {}));
    expect(bp.phaseCoverage.covered).toEqual([]);
    expect(bp.phaseCoverage.missing).toEqual([
      "planning",
      "implementation",
      "testing",
      "debugging",
      "deployment",
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* Attractor compatibility (doc 1 §0.1.1, spec PART 0)                  */
/* ------------------------------------------------------------------ */

describe("the Attractor linter, merged in", () => {
  it("says nothing about a bundle that already fits the subset", () => {
    expect(codes(resolve(BASE_DOT).diagnostics)).toEqual([]);
  });

  it("warns — never errors — about a node id Attractor cannot read", () => {
    const files = {
      ...CARD_FILES,
      "cards/looper@1.0.0.yaml": LOOPER,
    };
    const src = dot(`
      "kebab-case" [card="looper@1.0.0"];
      ok           [card="looper@1.0.0"];
      "kebab-case" -> ok;
    `);
    const { diagnostics, blueprint } = resolve(src, files);
    const bad = withCode(diagnostics, "attractor/bad-node-id");
    expect(bad).toHaveLength(1);
    expect(bad[0].severity).toBe("warning");
    expect(bad[0].location).toMatchObject({ file: "topology.dot", nodeId: "kebab-case" });
    // The two layers stay apart: DarkPrint read the file, Attractor would not run it.
    expect(withCode(diagnostics, "dot/parse-error")).toEqual([]);
    expect(blueprint).toBeDefined();
  });

  it("reports a `#` comment, which Graphviz accepts and Attractor does not", () => {
    const src = `digraph fixture {\n  # a Graphviz comment\n  a [card="looper@1.0.0"];\n}`;
    const { diagnostics } = resolve(src, { "cards/looper@1.0.0.yaml": LOOPER });
    expect(withCode(diagnostics, "attractor/hash-comment")).toHaveLength(1);
  });

  it("does not run the linter on an undirected graph, which dot/not-directed already owns", () => {
    const { diagnostics } = resolve("graph undirected { a -- b; }");
    expect(codes(diagnostics)).toContain("dot/not-directed");
    expect(codes(diagnostics).some((c) => c.startsWith("attractor/"))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* how a node points at a card (§2, §4)                                 */
/* ------------------------------------------------------------------ */

describe("the card pointer", () => {
  it("accepts the canonical card= form and the version= fallback", () => {
    const result = resolve(BASE_DOT);
    const bp = mustResolve(result);
    expect(bp.nodes[2]).toMatchObject({ nodeId: "writer", ref: "writer@1.0.0" });
  });

  it("tolerates whitespace around a hand-written reference", () => {
    const src = BASE_DOT.replace('card="intake@1.0.0"', 'card="  intake@1.0.0  "');
    const result = resolve(src);
    expect(result.diagnostics).toEqual([]);
    expect(mustResolve(result).nodes[0].ref).toBe("intake@1.0.0");
  });

  it("lets card= win when version= is also present", () => {
    const src = BASE_DOT.replace('review  [card="review@1.0.0"]', 'review  [card="review@1.0.0", version="9.9.9"]');
    const result = resolve(src);
    expect(result.diagnostics).toEqual([]);
    expect(mustResolve(result).nodes[3].ref).toBe("review@1.0.0");
  });

  it.each([
    ["no version at all", 'card="planner"'],
    ["a floating version", 'card="planner@latest"'],
    ["a range", 'card="planner@^1.0.0"'],
    ["an unpinned fallback", 'version="latest"'],
  ])("reports bundle/unpinned-card for %s", (_label, attrs) => {
    const src = BASE_DOT.replace('planner [card="planner@1.0.0"]', `planner [${attrs}]`);
    const { diagnostics } = resolve(src);
    const d = one(diagnostics, "bundle/unpinned-card");
    expect(d.severity).toBe("error");
    expect(d.location).toMatchObject({ file: "topology.dot", nodeId: "planner" });
  });

  it("reports an unpinned node that names a card the bundle carries, and lists the versions", () => {
    const src = BASE_DOT.replace('planner [card="planner@1.0.0"]', "planner");
    const { diagnostics } = resolve(src);
    const d = one(diagnostics, "bundle/unpinned-card");
    expect(d.message).toContain("does not say which version");
    expect(d.hint).toContain("`planner@1.0.0`");
  });

  it("lists every version the bundle carries in the hint", () => {
    const files = {
      ...CARD_FILES,
      "cards/planner@1.1.0.yaml": PLANNER.replace("version: 1.0.0", "version: 1.1.0"),
    };
    const src = BASE_DOT.replace('planner [card="planner@1.0.0"]', "planner");
    const { diagnostics } = resolve(src, files);
    expect(one(diagnostics, "bundle/unpinned-card").hint).toContain(
      "`planner@1.0.0`, `planner@1.1.0`",
    );
  });

  /*
   * §4's bump rule, at the one place a bundle can supply the predecessor.
   *
   * The rule shipped as a diagnostic code no caller could raise: `validateCard` wants
   * `opts.previous` and nothing passed it, while `/spec` listed the code as an error that
   * refuses a bundle. A bundle carrying two versions of one card is exactly the case where
   * the predecessor is in hand, so the check runs here now and these two hold it there.
   */
  it("refuses a bundle whose second version of a card under-declares its bump", () => {
    const files = {
      ...CARD_FILES,
      /* Anchored on `dependencies:`, which is the last key before the version line. It used
         to insert before `ontology_version:`, and that key is gone from the card schema. */
      "cards/planner@1.1.0.yaml": PLANNER.replace("version: 1.0.0", "version: 1.1.0").replace(
        "dependencies: [intake]",
        "dependencies: [intake]\ncannot:\n  - acceptance-criteria",
      ),
    };
    const src = BASE_DOT.replace('planner [card="planner@1.0.0"]', 'planner [card="planner@1.1.0"]');
    const { diagnostics } = resolve(src, files);
    const d = one(diagnostics, "card/version-bump-too-small");
    expect(d.severity).toBe("error");
    expect(d.message).toContain("major");
    expect(d.hint).toContain("2.0.0");
    expect(d.hint).toContain("narrows what the node accepts");
    expect(d.location?.file).toBe("cards/planner@1.1.0.yaml");
  });

  it("says nothing when the same edit is published as a major", () => {
    const files = {
      ...CARD_FILES,
      "cards/planner@2.0.0.yaml": PLANNER.replace("version: 1.0.0", "version: 2.0.0").replace(
        "dependencies: [intake]",
        "dependencies: [intake]\ncannot:\n  - acceptance-criteria",
      ),
    };
    const src = BASE_DOT.replace('planner [card="planner@1.0.0"]', 'planner [card="planner@2.0.0"]');
    const { diagnostics } = resolve(src, files);
    expect(withCode(diagnostics, "card/version-bump-too-small")).toEqual([]);
  });

  it("reports bundle/missing-card for a node with no pointer and no candidate card", () => {
    const src = dot(`
      intake [card="intake@1.0.0"];
      ghost;
      intake -> ghost;
    `);
    const { diagnostics } = resolve(src);
    const d = one(diagnostics, "bundle/missing-card");
    expect(d.message).toContain("does not point at a card");
    expect(d.severity).toBe("error");
  });

  it("reports bundle/missing-card when the pinned version is not in the bundle", () => {
    const src = BASE_DOT.replace('card="planner@1.0.0"', 'card="planner@2.0.0"');
    const { diagnostics } = resolve(src);
    const d = one(diagnostics, "bundle/missing-card");
    expect(d.message).toContain("`planner@2.0.0`");
    expect(d.hint).toContain("`planner@1.0.0`");
    expect(d.location).toMatchObject({ nodeId: "planner", cardRef: "planner@2.0.0" });
  });

  it("reports bundle/missing-card when the node id cannot be a card id", () => {
    const src = dot(`
      Intake_A [version="1.0.0"];
      Intake_A -> Intake_A;
    `);
    const { diagnostics } = resolve(src);
    expect(one(diagnostics, "bundle/missing-card").message).toContain("not a legal card id");
  });

  it("keeps a card-less node in the graph but out of nodes", () => {
    const src = BASE_DOT.replace('card="planner@1.0.0"', 'card="planner@2.0.0"');
    const bp = mustResolve(resolve(src));
    expect(bp.graph.ids).toContain("planner");
    expect(bp.nodes.map((n) => n.nodeId)).not.toContain("planner");
    expect(bp.graph.successors("planner")).toEqual(["writer"]);
  });

  it("still yields a blueprint the analyzers can score", () => {
    const src = BASE_DOT.replace('card="planner@1.0.0"', 'card="planner@2.0.0"');
    const bp = mustResolve(resolve(src));
    const autonomy = computeAutonomy(bp);
    // The card-less node is scored too: doc 3 §6 divides by nodi totali, and a node nobody
    // can read cannot be shown to run unattended.
    expect(autonomy.totalNodes).toBe(5);
    expect(autonomy.autonomousNodes).toBe(4);
    expect(autonomy.contributions.map((c) => c.nodeId)).toContain("planner");
    // …and it is not a node where a person acts either: it has no `type` for doc 3 §6's
    // category test to read, so the schematic gets no intervention marker where nobody is.
    expect(autonomy.contributions.find((c) => c.nodeId === "planner")).toMatchObject({
      ref: "",
      requiresHuman: false,
      resolved: false,
    });
    expect(autonomy.diagnostics.map((d) => d.code)).toEqual(["analysis/unresolved-node"]);
    expect(() => computeSecurity(bp)).not.toThrow();
    expect(computeSecurity(bp).level).toBe(4);
  });

  it("does not emit port diagnostics for an edge whose endpoint has no card", () => {
    const src = BASE_DOT.replace('card="planner@1.0.0"', 'card="planner@2.0.0"');
    const { diagnostics } = resolve(src);
    expect(withCode(diagnostics, "bundle/type-mismatch")).toEqual([]);
    expect(withCode(diagnostics, "bundle/port-mismatch")).toEqual([]);
  });

  it("surfaces the card's own validation errors and then reports the node as missing", () => {
    const files = { ...CARD_FILES, "cards/planner@1.0.0.yaml": PLANNER.replace("type: agent", "type: wizard") };
    const { diagnostics } = resolve(BASE_DOT, files);
    expect(one(diagnostics, "card/unknown-term").location).toMatchObject({
      file: "cards/planner@1.0.0.yaml",
    });
    expect(withCode(diagnostics, "bundle/missing-card")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* the digest pin                                                       */
/* ------------------------------------------------------------------ */

describe("the digest pin", () => {
  const real = digestOfCard(REVIEW);

  it.each([
    ["the full digest", real],
    ["the short display form", shortDigest(real)],
    ["a bare hex prefix", real.slice("sha256:".length, "sha256:".length + 12)],
    ["upper case", shortDigest(real).toUpperCase()],
  ])("accepts %s", (_label, pin) => {
    const src = BASE_DOT.replace('review  [card="review@1.0.0"]', `review  [card="review@1.0.0", digest="${pin}"]`);
    expect(resolve(src).diagnostics).toEqual([]);
  });

  it.each([
    ["a wrong digest", "sha256:deadbeef"],
    ["an empty pin", ""],
    ["a prefix of the wrong algorithm", "md5:0000"],
  ])("reports bundle/digest-mismatch for %s", (_label, pin) => {
    const src = BASE_DOT.replace('review  [card="review@1.0.0"]', `review  [card="review@1.0.0", digest="${pin}"]`);
    const d = one(resolve(src).diagnostics, "bundle/digest-mismatch");
    expect(d.severity).toBe("error");
    expect(d.hint).toContain(real);
  });

  it("still resolves the node, so a stale pin does not erase the topology", () => {
    const src = BASE_DOT.replace('review  [card="review@1.0.0"]', 'review  [card="review@1.0.0", digest="sha256:deadbeef"]');
    const bp = mustResolve(resolve(src));
    expect(bp.nodes.map((n) => n.nodeId)).toContain("review");
  });

  it("reports two card files that claim one ref with different content", () => {
    const files = {
      ...CARD_FILES,
      "cards/zz-review-copy.yaml": REVIEW.replace("Check the draft against the plan", "Check it twice"),
    };
    const d = one(resolve(BASE_DOT, files).diagnostics, "bundle/digest-mismatch");
    expect(d.severity).toBe("error");
    expect(d.message).toContain("declared twice");
    // The first file in filename order wins, so resolution stays decidable however
    // the caller happened to build the record.
    expect(mustResolve(resolve(BASE_DOT, files)).cards.get("review@1.0.0")?.action).toBe(
      "Check the draft against the plan",
    );
  });

  it("says nothing when the duplicate is byte-identical — §4 dedup", () => {
    const files = { ...CARD_FILES, "cards/zz-review-copy.yaml": REVIEW };
    expect(resolve(BASE_DOT, files).diagnostics).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* orphans                                                              */
/* ------------------------------------------------------------------ */

describe("orphan cards", () => {
  const files = { ...CARD_FILES, "cards/mute@1.0.0.yaml": MUTE };
  const result = resolve(BASE_DOT, files);

  it("warns about a card no node instantiates", () => {
    const d = one(result.diagnostics, "bundle/orphan-card");
    expect(d.severity).toBe("warning");
    expect(d.message).toContain("`mute@1.0.0`");
    expect(d.location).toMatchObject({ file: "cards/mute@1.0.0.yaml", cardRef: "mute@1.0.0" });
  });

  it("still yields a blueprint, and keeps the orphan in `cards`", () => {
    const bp = mustResolve(result);
    expect(bp.cards.has("mute@1.0.0")).toBe(true);
    expect(bp.nodes).toHaveLength(5);
  });

  it("leaves the orphan out of the bundle digest — it is not part of what runs", () => {
    expect(mustResolve(result).digest).toBe(mustResolve(resolve(BASE_DOT)).digest);
  });

  it("does not call a card orphaned when two nodes share it", () => {
    const src = dot(`
      a [card="looper@1.0.0"];
      b [card="looper@1.0.0"];
      a -> b;
    `);
    const { diagnostics } = resolve(src, { "cards/looper@1.0.0.yaml": LOOPER });
    expect(withCode(diagnostics, "bundle/orphan-card")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* edge ports (§2 "ruolo degli archi")                                  */
/* ------------------------------------------------------------------ */

describe("edge port resolution", () => {
  const PORT_FILES = {
    "cards/review@1.0.0.yaml": REVIEW,
    "cards/writer@1.0.0.yaml": WRITER.replace("dependencies: [planner]\n", ""),
    "cards/planner@1.0.0.yaml": PLANNER,
    "cards/archive@1.0.0.yaml": ARCHIVE,
    "cards/broad@1.0.0.yaml": BROAD,
    "cards/picky@1.0.0.yaml": PICKY,
    "cards/scanner@1.0.0.yaml": SCANNER,
    "cards/mute@1.0.0.yaml": MUTE,
    "cards/deliver@1.0.0.yaml": DELIVER,
  };

  it("honours an explicit out=/in= pin over the inferred pairing", () => {
    const src = dot(`
      review  [card="review@1.0.0"];
      archive [card="archive@1.0.0"];
      review -> archive [out="approved", in="item"];
    `);
    const bp = mustResolve(resolve(src, PORT_FILES));
    expect(bp.edges[0].fromPort?.name).toBe("approved");
    expect(bp.edges[0].toPort?.name).toBe("item");
  });

  it("reports bundle/port-mismatch when a pinned output does not exist", () => {
    const src = dot(`
      review  [card="review@1.0.0"];
      archive [card="archive@1.0.0"];
      review -> archive [out="nope"];
    `);
    const d = one(resolve(src, PORT_FILES).diagnostics, "bundle/port-mismatch");
    expect(d.severity).toBe("error");
    expect(d.message).toContain("`nope`");
    expect(d.hint).toContain("`verdict` (`status`)");
    expect(d.location).toMatchObject({ edge: { source: "review", target: "archive" } });
  });

  it("reports bundle/port-mismatch when a pinned input does not exist", () => {
    const src = dot(`
      review  [card="review@1.0.0"];
      archive [card="archive@1.0.0"];
      review -> archive [in="nope"];
    `);
    expect(one(resolve(src, PORT_FILES).diagnostics, "bundle/port-mismatch").message).toContain(
      "input port `nope`",
    );
  });

  it("does not guess the other side once a pin is broken", () => {
    const src = dot(`
      review  [card="review@1.0.0"];
      archive [card="archive@1.0.0"];
      review -> archive [out="nope"];
    `);
    const result = resolve(src, PORT_FILES);
    expect(withCode(result.diagnostics, "bundle/port-ambiguous")).toEqual([]);
    expect(mustResolve(result).edges[0].toPort).toBeUndefined();
  });

  it("reports bundle/port-mismatch when a side declares no ports at all", () => {
    const src = dot(`
      mute    [card="mute@1.0.0"];
      archive [card="archive@1.0.0"];
      mute -> archive;
    `);
    const d = one(resolve(src, PORT_FILES).diagnostics, "bundle/port-mismatch");
    expect(d.message).toContain("`mute` declares no output ports");
  });

  it("names both empty sides when neither declares a port", () => {
    const src = dot(`
      a [card="mute@1.0.0"];
      b [card="mute@1.0.0"];
      a -> b;
    `);
    expect(one(resolve(src, PORT_FILES).diagnostics, "bundle/port-mismatch").message).toContain(
      "`a` declares no output ports and `b` declares no input ports",
    );
  });

  it("warns bundle/port-ambiguous and picks the first pairing deterministically", () => {
    const src = dot(`
      review  [card="review@1.0.0"];
      archive [card="archive@1.0.0"];
      review -> archive;
    `);
    const result = resolve(src, PORT_FILES);
    const d = one(result.diagnostics, "bundle/port-ambiguous");
    expect(d.severity).toBe("warning");
    expect(d.message).toContain("2 type-compatible pairings");
    expect(d.hint).toContain('out="verdict", in="item"');
    const bp = mustResolve(result);
    expect(bp.edges[0].fromPort?.name).toBe("verdict");
    expect(bp.edges[0].toPort?.name).toBe("item");
  });

  it("half-pins: an explicit out= narrows the pairing back to one", () => {
    const src = dot(`
      review  [card="review@1.0.0"];
      archive [card="archive@1.0.0"];
      review -> archive [out="approved"];
    `);
    const result = resolve(src, PORT_FILES);
    expect(withCode(result.diagnostics, "bundle/port-ambiguous")).toEqual([]);
    expect(mustResolve(result).edges[0].toPort?.name).toBe("item");
  });

  it("reports bundle/type-mismatch naming both types", () => {
    const src = dot(`
      writer [card="writer@1.0.0"];
      picky  [card="picky@1.0.0"];
      writer -> picky;
    `);
    const d = one(resolve(src, PORT_FILES).diagnostics, "bundle/type-mismatch");
    expect(d.severity).toBe("error");
    expect(d.message).toContain("`writer` produces `markdown`");
    expect(d.message).toContain("`picky` accepts `artifact`");
  });

  it("reports bundle/type-mismatch on an explicitly pinned incompatible pair", () => {
    const src = dot(`
      review [card="review@1.0.0"];
      picky  [card="picky@1.0.0"];
      review -> picky [out="verdict", in="photo"];
    `);
    const result = resolve(src, PORT_FILES);
    expect(one(result.diagnostics, "bundle/type-mismatch").message).toContain("`status`");
    // The ports the author pinned are still reported, so the UI can show the broken wire.
    expect(mustResolve(result).edges[0].fromPort?.name).toBe("verdict");
  });

  it("accepts a narrower output into a broader input (isA)", () => {
    const src = dot(`
      planner [card="planner@1.0.0"];
      broad   [card="broad@1.0.0"];
      planner -> broad;
    `);
    const result = resolve(src, PORT_FILES);
    expect(withCode(result.diagnostics, "bundle/type-mismatch")).toEqual([]);
    expect(mustResolve(result).edges[0].toPort?.type).toBe("structured");
  });

  it("does not accept a broader output into a narrower input", () => {
    const src = dot(`
      scanner [card="scanner@1.0.0"];
      picky   [card="picky@1.0.0"];
      scanner -> picky;
    `);
    // `binary` subsumes `artifact`, not the other way round: subsumption is directional.
    expect(one(resolve(src, PORT_FILES).diagnostics, "bundle/type-mismatch").message).toContain(
      "produces `binary`",
    );
  });

  it("treats `any` as compatible with everything", () => {
    const src = dot(`
      broad   [card="broad@1.0.0"];
      deliver [card="deliver@1.0.0"];
      broad -> deliver;
    `);
    const result = resolve(src, PORT_FILES);
    expect(withCode(result.diagnostics, "bundle/type-mismatch")).toEqual([]);
    expect(mustResolve(result).edges[0].fromPort?.type).toBe("any");
  });

  it("resolves both edges of a fan-out independently", () => {
    const src = dot(`
      review  [card="review@1.0.0"];
      archive [card="archive@1.0.0"];
      deliver [card="deliver@1.0.0"];
      review -> deliver;
      review -> archive [out="verdict", in="item"];
    `);
    const bp = mustResolve(resolve(src, PORT_FILES));
    expect(bp.edges.map((e) => e.fromPort?.name)).toEqual(["approved", "verdict"]);
  });
});

/* ------------------------------------------------------------------ */
/* declared prohibitions — doc 2 §3 made checkable                      */
/* ------------------------------------------------------------------ */

/**
 * The starter's shape in miniature: a planner that emits a plan *and* the criteria the
 * work will be judged by, a builder that receives only the plan, and a judge that holds
 * one against the other. The builder declares `cannot: [acceptance-criteria]`, so the edge
 * the starter deliberately omits stops being a convention and becomes a rule.
 */
const CRITERIA_PLANNER = `
id: criteria-planner
name: Criteria planner
type: agent
phase: planning
action: Turn the request into a plan and the criteria it is judged by
spec: Read the request and write two independent artefacts, an ordered plan on the plan port and the conditions the finished work must satisfy on the criteria port.
inputs: []
outputs:
  - { name: plan, type: plan }
  - { name: criteria, type: acceptance-criteria }
version: 1.0.0
`;

const GUARDED_BUILDER = `
id: guarded-builder
name: Guarded builder
type: agent
phase: implementation
action: Build what the brief describes and nothing else
spec: Work through the brief in order and write the source it describes, staying inside the files each step names and adding no behaviour nobody asked for.
inputs:
  - { name: brief, type: plan }
outputs:
  - { name: build, type: code }
cannot: [acceptance-criteria]
version: 1.0.0
`;

const JUDGE = `
id: judge
name: Judge
type: validation
phase: testing
action: Hold the build against the criteria and report a verdict
spec: Run the build against every criterion in turn and emit a verdict carrying the evidence for each condition that was not met.
inputs:
  - { name: work, type: code }
  - { name: rules, type: acceptance-criteria }
outputs:
  - { name: verdict, type: status }
dependencies: [criteria-planner, guarded-builder]
version: 1.0.0
`;

describe("edge guards and weights", () => {
  const FILES: Readonly<Record<string, string>> = {
    "cards/review@1.0.0.yaml": REVIEW,
    "cards/archive@1.0.0.yaml": ARCHIVE,
  };

  const NODES = `
      review  [card="review@1.0.0"];
      archive [card="archive@1.0.0"];`;

  /** An expression Attractor's §10 grammar reads and DarkPrint deliberately does not. */
  const GUARD = "attempts > 3 && !approved";

  const GUARDED = dot(`${NODES}
      review -> archive [label="verdict", condition="${GUARD}", weight=0];
    `);

  const PLAIN = dot(`${NODES}
      review -> archive [label="verdict"];
    `);

  const edgeOf = (src: string) => mustResolve(resolve(src, FILES)).edges[0];

  it("carries the guard and the weight verbatim onto the edge", () => {
    const edge = edgeOf(GUARDED);
    expect(edge.condition).toBe(GUARD);
    // A string, and the string the source spells: `0` and `0.0` are different bytes in a
    // file somebody else's runner reads, and coercing either to a number loses that.
    expect(edge.weight).toBe("0");
  });

  it("leaves the raw attribute bag intact, so nothing is moved out from under a reader", () => {
    const edge = edgeOf(GUARDED);
    expect(edge.attrs.condition).toBe(GUARD);
    expect(edge.attrs.weight).toBe("0");
  });

  it("leaves both absent on an edge that declares neither", () => {
    const edge = edgeOf(PLAIN);
    expect(edge.condition).toBeUndefined();
    expect(edge.weight).toBeUndefined();
    // Absent, not empty: `condition: ""` would be an edge guarded by the empty expression.
    expect(Object.prototype.hasOwnProperty.call(edge, "condition")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(edge, "weight")).toBe(false);
  });

  /**
   * THE RULE, at the structural level: a guarded edge is an edge.
   *
   * `buildGraph` is handed every edge statement, and every reachability-based reading in
   * `lib/core/analysis` walks the graph it returns. A filter there on `condition` — or a
   * ranking on `weight` — is the single edit that would make a guarded edge count for
   * less than an unconditional one everywhere at once. This is the cell that fails when
   * somebody makes it.
   */
  it("puts a guarded edge in the graph exactly as it puts an unguarded one", () => {
    const guarded = mustResolve(resolve(GUARDED, FILES)).graph;
    const plain = mustResolve(resolve(PLAIN, FILES)).graph;
    expect(guarded.successors("review")).toEqual(plain.successors("review"));
    expect(guarded.descendants("review")).toEqual(plain.descendants("review"));
    expect(guarded.sinks()).toEqual(plain.sinks());
  });

  it("still resolves the ports on a guarded edge", () => {
    // The guard is a passenger and nothing about it is allowed to change what the edge
    // carries: a reader who adds a condition must not lose the port pairing under it.
    expect(edgeOf(GUARDED).fromPort).toEqual(edgeOf(PLAIN).fromPort);
    expect(edgeOf(GUARDED).toPort).toEqual(edgeOf(PLAIN).toPort);
  });
});

describe("declared prohibitions", () => {
  const ISOLATION_FILES: Readonly<Record<string, string>> = {
    "cards/criteria-planner@1.0.0.yaml": CRITERIA_PLANNER,
    "cards/guarded-builder@1.0.0.yaml": GUARDED_BUILDER,
    "cards/judge@1.0.0.yaml": JUDGE,
  };

  const NODES = `
      planner [card="criteria-planner@1.0.0"];
      builder [card="guarded-builder@1.0.0"];
      judge   [card="judge@1.0.0"];`;

  /** The starter's topology: the criteria reach the judge and never the builder. */
  const ISOLATED = dot(`${NODES}
      planner -> judge;
      builder -> judge;
    `);

  /** The same graph with doc 2 §5.4's demonstration edge added. */
  const LEAKED = dot(`${NODES}
      planner -> judge;
      builder -> judge;
      planner -> builder;
    `);

  /** Every card in `ISOLATION_FILES`, with one of them patched. */
  const patched = (file: string, from: string, to: string): Readonly<Record<string, string>> => ({
    ...ISOLATION_FILES,
    [file]: ISOLATION_FILES[file].replace(from, to),
  });

  it("resolves clean when no edge reaches the builder from the criteria", () => {
    // The whole point of the field: a card may declare a prohibition and say nothing at
    // all about a graph that honours it.
    expect(resolve(ISOLATED, ISOLATION_FILES).diagnostics).toEqual([]);
  });

  it("errors when an incoming edge carries the prohibited type", () => {
    const result = resolve(LEAKED, ISOLATION_FILES);
    const d = one(result.diagnostics, "bundle/prohibition-violated");
    expect(d.severity).toBe("error");
    // Doc 2 §3's argument, enforced: the card, the edge and the type all named.
    expect(d.message).toContain("`guarded-builder@1.0.0`");
    expect(d.message).toContain("`builder`");
    expect(d.message).toContain("`acceptance-criteria`");
    expect(d.message).toContain("`planner -> builder`");
    expect(d.location).toMatchObject({
      file: "topology.dot",
      nodeId: "builder",
      cardRef: "guarded-builder@1.0.0",
      edge: { source: "planner", target: "builder" },
    });
  });

  /**
   * THE RULE, on the check that costs the most to lose: a guard does not buy an exemption.
   *
   * `condition="false"` is the cheapest thing an author could write to make a leaking edge
   * look like an edge that is never taken, and if the resolver read it the whole isolation
   * argument of doc 2 §3 would be enforceable only against authors who did not know the
   * trick. The condition is evaluated at run time, on somebody else's machine, against
   * data DarkPrint never sees. A leak that can happen is a leak, and this cell holds the
   * guarded edge to the same diagnostic as the bare one, field for field.
   */
  it("refuses the leak just as loudly when the leaking edge carries a guard", () => {
    const GUARDED_LEAK = dot(`${NODES}
      planner -> judge;
      builder -> judge;
      planner -> builder [condition="false"];
    `);
    const guarded = one(
      resolve(GUARDED_LEAK, ISOLATION_FILES).diagnostics,
      "bundle/prohibition-violated",
    );
    const bare = one(resolve(LEAKED, ISOLATION_FILES).diagnostics, "bundle/prohibition-violated");
    expect(guarded).toEqual(bare);
  });

  it("names the output port that carries it, so the author knows which one to cut", () => {
    const d = one(resolve(LEAKED, ISOLATION_FILES).diagnostics, "bundle/prohibition-violated");
    expect(d.hint).toContain("`criteria` (`acceptance-criteria`)");
    expect(d.hint).toContain("`cannot`");
  });

  it("fires even though the pairing the resolver inferred carries the plan", () => {
    // The builder's only input is `brief: plan`, so the inferred pairing is plan → brief
    // and the criteria port is never selected. Reading the check off that pairing would
    // make the demonstration edge resolve clean, and doc 3 §4.1's `criteria-leak` reads
    // the same edge at node level. Two isolation checks must not disagree about one edge.
    const bp = mustResolve(resolve(LEAKED, ISOLATION_FILES));
    const leak = bp.edges.find((e) => e.source === "planner" && e.target === "builder");
    expect(leak?.fromPort?.type).toBe("plan");
    expect(withCode(resolve(LEAKED, ISOLATION_FILES).diagnostics, "bundle/prohibition-violated"))
      .toHaveLength(1);
  });

  it("honours an explicit `out=` pin, which says what the edge is for", () => {
    const src = dot(`${NODES}
      planner -> judge;
      builder -> judge;
      planner -> builder [out="plan", in="brief"];
    `);
    const result = resolve(src, ISOLATION_FILES);
    expect(withCode(result.diagnostics, "bundle/prohibition-violated")).toEqual([]);
  });

  it("reports nothing extra when the pin names a port that does not exist", () => {
    // Already a `bundle/port-mismatch`; answering a typo with a second, unrelated error
    // would bury the one the author can act on.
    const src = dot(`${NODES}
      planner -> judge;
      builder -> judge;
      planner -> builder [out="nonexistent"];
    `);
    const result = resolve(src, ISOLATION_FILES);
    expect(withCode(result.diagnostics, "bundle/port-mismatch")).toHaveLength(1);
    expect(withCode(result.diagnostics, "bundle/prohibition-violated")).toEqual([]);
  });

  it("catches a narrower type: refusing `structured` refuses the criteria too", () => {
    const files = patched(
      "cards/guarded-builder@1.0.0.yaml",
      "cannot: [acceptance-criteria]",
      "cannot: [structured]",
    );
    const d = one(resolve(LEAKED, files).diagnostics, "bundle/prohibition-violated");
    expect(d.message).toContain("`structured`");
    // Declaration order picks the carrier, and `plan` is the planner's first output.
    expect(d.hint).toContain("`plan` (`plan`)");
  });

  it("does not read subsumption the other way round", () => {
    // `acceptance-criteria` is a kind of `structured`, so a node refusing the specific
    // type is not refusing everything the general one covers.
    const files = patched(
      "cards/criteria-planner@1.0.0.yaml",
      "{ name: criteria, type: acceptance-criteria }",
      "{ name: criteria, type: structured }",
    );
    expect(withCode(resolve(LEAKED, files).diagnostics, "bundle/prohibition-violated")).toEqual([]);
  });

  it("does not fire on an output typed `any`, which asserts nothing", () => {
    const files = patched(
      "cards/criteria-planner@1.0.0.yaml",
      "{ name: criteria, type: acceptance-criteria }",
      "{ name: criteria, type: any }",
    );
    expect(withCode(resolve(LEAKED, files).diagnostics, "bundle/prohibition-violated")).toEqual([]);
  });

  it("never reads `will_not`, whatever the sentence in it says", () => {
    /* The half of the prohibition pair the engine cannot check, moved out of `cannot` at the
       split. This cell used to put the same sentences INSIDE `cannot` and assert that the
       resolver stayed quiet about them; the card would not load at all now, and the silence
       it was asking for is the resolver simply not looking at the other field. The first
       sentence names the prohibited type in words on purpose: a resolver that had started
       matching text would fire on it. */
    const files = patched(
      "cards/guarded-builder@1.0.0.yaml",
      "cannot: [acceptance-criteria]",
      'cannot: []\nwill_not: ["never sees the acceptance criteria", "does not open a shell"]',
    );
    const result = resolve(LEAKED, files);
    expect(withCode(result.diagnostics, "bundle/prohibition-violated")).toEqual([]);
    expect(withCode(result.diagnostics, "card/unknown-term")).toEqual([]);
    expect(withCode(result.diagnostics, "card/prohibition-misfiled")).toEqual([]);
  });

  it("stays silent even when `will_not` holds the very term the edge carries", () => {
    /* The cell above cannot see the mutation this one exists for. Its `will_not` holds
       sentences, so a resolver that concatenated the two fields and looked up every entry
       would resolve none of them and report nothing, and the cell would pass against the
       broken engine. Measured: adding `...to.card.willNot` to `checkProhibitions` reddened
       0 of 113 before this cell existed.

       Here `will_not` holds `acceptance-criteria` itself, on the graph where the planner
       really does edge into the builder. So the ONLY thing standing between this fixture and
       a `bundle/prohibition-violated` is the resolver reading one field rather than two.
       The card is `card/prohibition-misfiled` at the same time, which is the point: the
       author wrote a rule the engine could have enforced into the field where it never will
       be, and the validator says so at the card while the resolver refuses to act on it. */
    const files = patched(
      "cards/guarded-builder@1.0.0.yaml",
      "cannot: [acceptance-criteria]",
      "cannot: []\nwill_not: [acceptance-criteria]",
    );
    const result = resolve(LEAKED, files);
    expect(
      withCode(result.diagnostics, "bundle/prohibition-violated"),
      "the stated half is not enforced, however enforceable its entry happens to be",
    ).toEqual([]);
    expect(
      withCode(result.diagnostics, "card/prohibition-misfiled").length,
      "and the author is told at the card, which is where they can move it",
    ).toBe(1);
  });

  it("stays silent about an entry the card was already told off for", () => {
    /* `cannot` takes `data-type` ids only, so `planning` and `human-gate` are
       `card/wrong-term-kind` at the card and the card never loads. The resolver's own
       silence is still worth pinning: a second complaint from the edges would name a graph
       that has nothing wrong with it. */
    const files = patched(
      "cards/guarded-builder@1.0.0.yaml",
      "cannot: [acceptance-criteria]",
      "cannot: [planning, human-gate, shell]",
    );
    const result = resolve(LEAKED, files);
    expect(withCode(result.diagnostics, "bundle/prohibition-violated")).toEqual([]);
    expect(
      withCode(result.diagnostics, "card/wrong-term-kind").length,
      "the card is what refuses these, and it refuses all three",
    ).toBe(3);
  });

  it("reports one diagnostic per prohibited type, not per repetition of it", () => {
    const files = patched(
      "cards/guarded-builder@1.0.0.yaml",
      "cannot: [acceptance-criteria]",
      "cannot: [acceptance-criteria, acceptance-criteria]",
    );
    expect(withCode(resolve(LEAKED, files).diagnostics, "bundle/prohibition-violated"))
      .toHaveLength(1);
  });

  it("reports each prohibited type the same edge carries", () => {
    const files = patched(
      "cards/guarded-builder@1.0.0.yaml",
      "cannot: [acceptance-criteria]",
      "cannot: [acceptance-criteria, plan]",
    );
    const found = withCode(resolve(LEAKED, files).diagnostics, "bundle/prohibition-violated");
    expect(found).toHaveLength(2);
    expect(found.map((d) => d.message.includes("`plan`")).sort()).toEqual([false, true]);
  });

  it("says nothing when the source node has no card in the bundle", () => {
    // `bundle/missing-card` has already reported the broken pointer, and nothing states
    // what such a node emits.
    const src = dot(`
      ghost   [card="absent@1.0.0"];
      builder [card="guarded-builder@1.0.0"];
      ghost -> builder;
    `);
    const result = resolve(src, ISOLATION_FILES);
    expect(withCode(result.diagnostics, "bundle/missing-card")).toHaveLength(1);
    expect(withCode(result.diagnostics, "bundle/prohibition-violated")).toEqual([]);
  });

  it("reads the vocabulary rather than a fixed list, so a local data-type is enforced", () => {
    // Doc 3 §7: a local term rooted in the core is a first-class term, and the check asks
    // the ontology the bundle was resolved against instead of naming types itself.
    const local = ontologyView(CORE_ONTOLOGY, [
      {
        id: "berti/secret-material",
        kind: "data-type",
        label: "Secret material",
        description: "Credentials and keys the run must not hand to a generating node.",
        broader: "binary",
        since: "0.1.0",
      },
    ]);
    const files = {
      ...patched(
        "cards/criteria-planner@1.0.0.yaml",
        "{ name: criteria, type: acceptance-criteria }",
        "{ name: criteria, type: berti/secret-material }",
      ),
      "cards/guarded-builder@1.0.0.yaml": GUARDED_BUILDER.replace(
        "cannot: [acceptance-criteria]",
        "cannot: [berti/secret-material]",
      ),
    };
    // `judge` still asks for `acceptance-criteria` nobody produces now, so the edge into
    // it is checked on its own terms; only the prohibition is asserted here.
    const result = resolveBundle(makeBundle(LEAKED, files), local);
    const d = one(result.diagnostics, "bundle/prohibition-violated");
    expect(d.message).toContain("`berti/secret-material`");
  });
});

/* ------------------------------------------------------------------ */
/* declared dependencies                                                */
/* ------------------------------------------------------------------ */

describe("dependencies", () => {
  const withDeps = (deps: string): Readonly<Record<string, string>> => ({
    ...CARD_FILES,
    "cards/writer@1.0.0.yaml": WRITER.replace("dependencies: [planner]", `dependencies: [${deps}]`),
  });

  it("says nothing when a card declares its incoming edges exactly", () => {
    expect(resolve(BASE_DOT).diagnostics).toEqual([]);
  });

  it("reports bundle/missing-dependency when nothing supplies a declared dependency", () => {
    const d = one(resolve(BASE_DOT, withDeps("ghost")).diagnostics, "bundle/missing-dependency");
    expect(d.severity).toBe("error");
    expect(d.message).toContain("`ghost`");
    expect(d.location).toMatchObject({
      file: "cards/writer@1.0.0.yaml",
      cardRef: "writer@1.0.0",
      nodeId: "writer",
      path: "dependencies[0]",
    });
  });

  it("points at the offending entry by index", () => {
    const d = one(
      resolve(BASE_DOT, withDeps("planner, ghost")).diagnostics,
      "bundle/missing-dependency",
    );
    expect(d.location?.path).toBe("dependencies[1]");
  });

  it("warns bundle/undeclared-dependency for an edge the card does not list", () => {
    const src = BASE_DOT.replace("planner -> writer;", "planner -> writer;\n  intake -> writer;");
    const result = resolve(src);
    const d = one(result.diagnostics, "bundle/undeclared-dependency");
    expect(d.severity).toBe("warning");
    expect(d.message).toContain("`intake`");
    expect(d.location).toMatchObject({ edge: { source: "intake", target: "writer" } });
    // A warning still yields a blueprint.
    expect(result.blueprint).toBeDefined();
  });

  it("warns for every incoming edge when the card declares no dependencies at all", () => {
    // §8 states the rule unconditionally, and an empty list under two incoming edges is
    // exactly the omission it exists to point at — §3.3 has `dependencies` make the
    // link explicit, so saying nothing is not the same as having nothing to say.
    const src = BASE_DOT.replace("planner -> writer;", "planner -> writer;\n  intake -> writer;");
    const files = { ...CARD_FILES, "cards/writer@1.0.0.yaml": WRITER.replace("dependencies: [planner]\n", "") };
    const { diagnostics } = resolve(src, files);
    const undeclared = withCode(diagnostics, "bundle/undeclared-dependency");
    expect(undeclared.map((d) => d.location?.edge?.source).sort()).toEqual(["intake", "planner"]);
    expect(undeclared.every((d) => d.severity === "warning")).toBe(true);
    expect(withCode(diagnostics, "bundle/missing-dependency")).toEqual([]);
  });

  it("accepts the DOT node id as a spelling of the card it instantiates", () => {
    const files = {
      "cards/looper@1.0.0.yaml": LOOPER,
      "cards/sink@1.0.0.yaml": DELIVER.replace("id: deliver", "id: sink").replace(
        "inputs:\n  - { name: article, type: markdown }",
        "inputs:\n  - { name: article, type: any }\ndependencies: [feeder]",
      ),
    };
    const src = dot(`
      feeder [card="looper@1.0.0"];
      out    [card="sink@1.0.0"];
      feeder -> out;
    `);
    const { diagnostics } = resolve(src, files);
    expect(withCode(diagnostics, "bundle/missing-dependency")).toEqual([]);
    expect(withCode(diagnostics, "bundle/undeclared-dependency")).toEqual([]);
  });

  it("does not blame a card for a predecessor that has no card of its own", () => {
    const src = BASE_DOT.replace('card="planner@1.0.0"', 'card="planner@2.0.0"');
    const { diagnostics } = resolve(src);
    expect(withCode(diagnostics, "bundle/undeclared-dependency")).toEqual([]);
    // The declared dependency is still unmet, and that is worth an error.
    expect(withCode(diagnostics, "bundle/missing-dependency")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* structure                                                            */
/* ------------------------------------------------------------------ */

describe("structural checks", () => {
  const LOOP_FILES = { "cards/looper@1.0.0.yaml": LOOPER, "cards/deliver@1.0.0.yaml": DELIVER };

  it("warns bundle/no-entry and bundle/no-exit for a graph that is one cycle", () => {
    const src = dot(`
      a [card="looper@1.0.0"];
      b [card="looper@1.0.0"];
      a -> b;
      b -> a;
    `);
    const { diagnostics } = resolve(src, LOOP_FILES);
    expect(one(diagnostics, "bundle/no-entry").severity).toBe("warning");
    expect(one(diagnostics, "bundle/no-exit").severity).toBe("warning");
  });

  it("suppresses the unreachable cascade when there is no entry point at all", () => {
    const src = dot(`
      a [card="looper@1.0.0"];
      b [card="looper@1.0.0"];
      a -> b;
      b -> a;
    `);
    expect(withCode(resolve(src, LOOP_FILES).diagnostics, "bundle/unreachable-node")).toEqual([]);
  });

  it("warns bundle/no-exit alone when the graph ends in a cycle", () => {
    const src = dot(`
      start [card="looper@1.0.0"];
      a     [card="looper@1.0.0"];
      b     [card="looper@1.0.0"];
      start -> a;
      a -> b;
      b -> a;
    `);
    const { diagnostics } = resolve(src, LOOP_FILES);
    expect(withCode(diagnostics, "bundle/no-entry")).toEqual([]);
    expect(withCode(diagnostics, "bundle/no-exit")).toHaveLength(1);
  });

  it("warns bundle/no-entry alone when a sink hangs off a closed cycle", () => {
    const src = dot(`
      a [card="looper@1.0.0"];
      b [card="looper@1.0.0"];
      c [card="looper@1.0.0"];
      a -> b;
      b -> a;
      b -> c;
    `);
    const { diagnostics } = resolve(src, LOOP_FILES);
    expect(withCode(diagnostics, "bundle/no-entry")).toHaveLength(1);
    expect(withCode(diagnostics, "bundle/no-exit")).toEqual([]);
  });

  it("warns bundle/unreachable-node for a component no entry point reaches", () => {
    const src = BASE_DOT.replace(
      "  review  -> deliver [label=\"approved\"];",
      `  review  -> deliver [label="approved"];
  island_a [card="looper@1.0.0"];
  island_b [card="looper@1.0.0"];
  island_a -> island_b;
  island_b -> island_a;`,
    );
    const files = { ...CARD_FILES, "cards/looper@1.0.0.yaml": LOOPER };
    const { diagnostics } = resolve(src, files);
    const unreachable = withCode(diagnostics, "bundle/unreachable-node");
    expect(unreachable.map((d) => d.location?.nodeId)).toEqual(["island_a", "island_b"]);
    expect(unreachable[0].severity).toBe("warning");
  });

  it("says nothing structural about an empty graph", () => {
    const { blueprint, diagnostics } = resolve("digraph empty {}", {});
    expect(diagnostics).toEqual([]);
    expect(blueprint?.nodes).toEqual([]);
    expect(blueprint?.graph.ids).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* the declared vocabulary (§6.2)                                       */
/* ------------------------------------------------------------------ */

describe("ontology version", () => {
  /*
   * Three cells stood here and all three are gone with what they measured. A manifest
   * declared an `ontologyVersion` and every card declared one too, and `resolveBundle`
   * reported `bundle/ontology-mismatch` when the manifest disagreed with the vocabulary it
   * was being read against, and once more for every card that disagreed with the manifest.
   * Three hand-maintained copies of one number, and a diagnostic whose content was that they
   * had drifted apart.
   *
   * The code SURVIVES and is raised by `lib/core/ontology/resolve.ts` for the case that is
   * about the vocabulary rather than about a version string: a local overlay term shadowing a
   * curated core id. So a cell here asserts what this resolver does with a bundle nobody can
   * write a version into, which is nothing.
   */
  it("raises no vocabulary diagnostic, because nothing in a bundle declares a version", () => {
    const { blueprint, diagnostics } = resolve(BASE_DOT, CARD_FILES);
    expect(withCode(diagnostics, "bundle/ontology-mismatch")).toEqual([]);
    expect(blueprint).toBeDefined();
    /* The reading the code used to report on is still recorded, on the analysis, and it comes
       off the view rather than off anything the author typed. `resolveBundle` does not score,
       so this cell can only say the view it was handed is the one the caller passed; the
       stamp itself is `analysis/analyze.test.ts`'s. */
    expect(blueprint?.ontology.ontology.version).toBe(ONTOLOGY_VERSION);
  });
});

/* ------------------------------------------------------------------ */
/* when resolution cannot proceed                                       */
/* ------------------------------------------------------------------ */

describe("a bundle that cannot be resolved", () => {
  it("returns no blueprint when the DOT does not parse", () => {
    const result = resolve("digraph broken { a -> ; }");
    expect(result.blueprint).toBeUndefined();
    expect(codes(result.diagnostics)).toContain("dot/parse-error");
  });

  it("returns no blueprint when the graph is not directed", () => {
    const result = resolve("graph undirected { a -- b; }");
    expect(result.blueprint).toBeUndefined();
    expect(codes(result.diagnostics)).toContain("dot/not-directed");
  });

  it("does not report card problems it cannot yet attribute to a node", () => {
    const result = resolve("graph undirected { a -- b; }");
    expect(codes(result.diagnostics).every((c) => c.startsWith("dot/"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* the bundle digest                                                    */
/* ------------------------------------------------------------------ */

describe("the bundle digest", () => {
  const base = mustResolve(resolve(BASE_DOT)).digest;

  it("changes when a card changes", () => {
    const files = { ...CARD_FILES, "cards/review@1.0.0.yaml": REVIEW.replace("Check the", "Re-check the") };
    expect(mustResolve(resolve(BASE_DOT, files)).digest).not.toBe(base);
  });

  it("changes when the DOT changes", () => {
    const src = BASE_DOT.replace('label="draft"', 'label="the draft"');
    expect(mustResolve(resolve(src)).digest).not.toBe(base);
  });

  it("counts a card pinned twice twice", () => {
    const files = { "cards/looper@1.0.0.yaml": LOOPER };
    const once = mustResolve(resolve(dot('a [card="looper@1.0.0"];'), files)).digest;
    const twice = mustResolve(
      resolve(dot('a [card="looper@1.0.0"];\nb [card="looper@1.0.0"];'), files),
    ).digest;
    expect(twice).not.toBe(once);
  });
});

/* ------------------------------------------------------------------ */
/* robustness                                                           */
/* ------------------------------------------------------------------ */

describe("hostile input", () => {
  it.each([
    ["a card file that is not YAML", { "cards/x.yaml": "id: [unclosed" }],
    ["a card file that is empty", { "cards/x.yaml": "   " }],
    ["a card file that is a list", { "cards/x.yaml": "- one\n- two" }],
    ["a card with no id", { "cards/x.yaml": "name: Nameless\n" }],
    ["params that cannot be hashed", { "cards/x.yaml": `${MUTE}params:\n  n: .inf\n` }],
  ])("reports %s instead of throwing", (_label, files) => {
    const call = (): ResolveResult => resolve(BASE_DOT, files);
    expect(call).not.toThrow();
    expect(call().diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("does not throw on a DOT full of attributes it knows nothing about", () => {
    const src = dot(`
      a [card="looper@1.0.0", colour="ultraviolet", out="", in="", digest=""];
      a -> a [out="", in="", weight=3];
    `);
    expect(() => resolve(src, { "cards/looper@1.0.0.yaml": LOOPER })).not.toThrow();
  });

  it("survives an empty bundle", () => {
    const result = resolveBundle(
      { manifest: MANIFEST, dot: "digraph {}", cardFiles: {} },
      ONTOLOGY,
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.blueprint?.nodes).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* diagnostics as a whole                                               */
/* ------------------------------------------------------------------ */

describe("the diagnostic list", () => {
  const src = BASE_DOT.replace('card="planner@1.0.0"', 'card="planner@2.0.0"').replace(
    '  review  -> deliver [label="approved"];',
    `  review  -> deliver [label="approved"];
  island_a [card="looper@1.0.0"];
  island_b [card="looper@1.0.0"];
  island_a -> island_b;
  island_b -> island_a;`,
  );
  const files = { ...CARD_FILES, "cards/looper@1.0.0.yaml": LOOPER, "cards/mute@1.0.0.yaml": MUTE };
  const { diagnostics, blueprint } = resolve(src, files);

  it("reports every problem in one pass rather than stopping at the first", () => {
    expect(new Set(codes(diagnostics))).toEqual(
      new Set([
        "bundle/missing-card",
        "bundle/missing-dependency",
        "bundle/orphan-card",
        "bundle/undeclared-dependency",
        "bundle/unreachable-node",
      ]),
    );
  });

  it("puts errors first", () => {
    const severities = diagnostics.map((d) => d.severity);
    expect(severities).toEqual([...severities].sort((a, b) => (a === b ? 0 : a === "error" ? -1 : 1)));
  });

  it("hands back a blueprint even so — the wizard has to show the broken graph", () => {
    expect(blueprint).toBeDefined();
    expect(blueprint?.graph.ids).toContain("planner");
  });

  it("gives every diagnostic a message and a hint worth reading", () => {
    for (const d of diagnostics) {
      expect(d.message.endsWith(".")).toBe(true);
      expect(d.hint).toBeDefined();
    }
  });
});
