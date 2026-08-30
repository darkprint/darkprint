import { describe, expect, it } from "vitest";

import { buildRegistry } from "./registry";
import { resolveBundle } from "../bundle/resolve";
import { cardRef, type CardRef, type NodeCard } from "../card/schema";
import { CORE_ONTOLOGY, CORE_PHASE_IDS } from "../ontology/core";
import { ontologyView } from "../ontology/resolve";

import type { BundleManifest, ResolvedBlueprint, ResolvedNode } from "../bundle/types";
import type { Graph } from "../dot/graph";
import type { OntologyView } from "../ontology/resolve";

/* ------------------------------------------------------------------
   Fixtures. The registry reads only `manifest`, `digest` and `nodes`,
   so blueprints are built by hand; `graph` and `ontology` are inert
   stand-ins, not usable objects.

   Cards are written against ontology v0.1 (doc 3): one of the five
   phases, one of the six real node types, and a `spec` that is a
   real self-sufficient instruction (doc 1 §3.2) rather than a
   placeholder — a card the validator would accept, because a
   fixture that could not be published is not evidence of anything.
   ------------------------------------------------------------------ */

/** Read off the vocabulary itself, so a fixture cannot drift from the ontology it cites. */

const STUB_GRAPH: Graph = {
  ids: [],
  successors: () => [],
  predecessors: () => [],
  hasNode: () => false,
  sources: () => [],
  sinks: () => [],
  descendants: () => new Set<string>(),
  ancestors: () => new Set<string>(),
  reachable: () => new Set<string>(),
  cycles: () => [],
  exitEdges: () => [],
};

const STUB_ONTOLOGY: OntologyView = {
  ontology: CORE_ONTOLOGY,
  get: () => undefined,
  resolve: () => undefined,
  isA: () => false,
  ancestors: () => [],
  children: () => [],
  byKind: () => [],
  validate: () => [],
};

function makeCard(id: string, version: string, over: Partial<NodeCard> = {}): NodeCard {
  return {
    id,
    name: `Card ${id}`,
    type: "agent",
    phases: ["implementation"],
    action: "Draft a candidate solution for the sub-task",
    spec: "Read the task on the `task` port and write one candidate solution to `draft` as JSON. Do not look at anything else.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [{ name: "task", type: "text" }],
    outputs: [{ name: "draft", type: "json" }],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [],
    version,
    ...over,
  };
}

/** Digests are synthetic but ref-derived, so distinct cards differ unless a test says otherwise. */
function makeNode(card: NodeCard, over: Partial<ResolvedNode> = {}): ResolvedNode {
  const ref = cardRef(card.id, card.version);
  return {
    nodeId: card.id.replace("/", "_"),
    ref,
    card,
    digest: `sha256:${ref}`,
    attrs: {},
    ...over,
  };
}

function makeBlueprint(
  slug: string,
  nodes: readonly ResolvedNode[],
  manifest: Partial<BundleManifest> = {},
  extraCards: readonly NodeCard[] = [],
): ResolvedBlueprint {
  const cards = new Map<CardRef, NodeCard>(nodes.map((n) => [n.ref, n.card]));
  for (const c of extraCards) cards.set(cardRef(c.id, c.version), c);
  return {
    manifest: {
      slug,
      title: `Blueprint ${slug}`,
      summary: "A pipeline.",
      tags: [],
      ...manifest,
    },
    dot: "digraph {}",
    digest: `sha256:bp-${slug}`,
    nodes,
    edges: [],
    graph: STUB_GRAPH,
    ontology: STUB_ONTOLOGY,
    cards,
    // Inert like `graph` and `ontology`: `buildRegistry` reads phases off the indexed
    // cards, not off this field (see the notes on `phases()`), and computing it here
    // over a stub graph would suggest the registry consults it.
    phaseCoverage: { covered: [], missing: [], byPhase: {}, unphased: [] },
  };
}

/* ------------------------------------------------------------------
   A small world used by most tests:
     alpha  pins solver-a@1.10.0 and checker-b@1.0.0
     beta   pins solver-a@1.10.0 (shared) and solver-a@2.0.0
   ------------------------------------------------------------------ */

const solver110 = makeCard("solver-a", "1.10.0");
// A real second major version says something the first did not — otherwise the two are
// the same card twice over, which is what `duplicates()` exists to point out.
const solver200 = makeCard("solver-a", "2.0.0", {
  action: "Draft two candidate solutions and pick the stronger one",
});
const checker = makeCard("checker-b", "1.0.0", {
  name: "Checker B",
  type: "validation",
  phases: ["testing"],
  action: "Verify the draft against the acceptance criteria",
  spec: "Run the declared checks over the incoming draft and emit a pass or fail verdict with the evidence that produced it.",
  inputs: [{ name: "draft", type: "json" }],
  outputs: [{ name: "verdict", type: "status" }],
  notes: "Rejects anything without a citation.",
});

const alpha = makeBlueprint("alpha", [makeNode(solver110), makeNode(checker)], {
  tags: ["retry", "validation"],
  category: "research",
});
const beta = makeBlueprint(
  "beta",
  [makeNode(solver110, { nodeId: "solver_shared" }), makeNode(solver200)],
  { tags: ["validation", "agents"], category: "ops" },
);

const world = buildRegistry([alpha, beta]);

describe("buildRegistry — empty input", () => {
  const empty = buildRegistry([]);

  it("answers every collection query with an empty list", () => {
    expect(empty.blueprints()).toEqual([]);
    expect(empty.cards()).toEqual([]);
    expect(empty.latestCards()).toEqual([]);
    expect(empty.duplicates()).toEqual([]);
    expect(empty.tags()).toEqual([]);
    expect(empty.categories()).toEqual([]);
    expect(empty.phases()).toEqual([]);
    expect(empty.versionsOf("solver-a")).toEqual([]);
    expect(empty.usersOf("solver-a")).toEqual([]);
    expect(empty.cardsByPhase("planning")).toEqual([]);
    expect(empty.searchCards("solver")).toEqual([]);
    expect(empty.searchCards("")).toEqual([]);
  });

  it("answers every lookup with undefined", () => {
    expect(empty.blueprint("alpha")).toBeUndefined();
    expect(empty.card("solver-a@1.0.0")).toBeUndefined();
  });

  it("indexes a blueprint that pins nothing", () => {
    const bare = buildRegistry([makeBlueprint("bare", [], { tags: ["empty"] })]);

    expect(bare.blueprints()).toHaveLength(1);
    expect(bare.blueprint("bare")?.cardRefs).toEqual([]);
    expect(bare.cards()).toEqual([]);
    expect(bare.tags()).toEqual(["empty"]);
    // No cards, so no phases — a blueprint covers what its nodes declare, nothing more.
    expect(bare.phases()).toEqual([]);
  });
});

describe("blueprints", () => {
  it("sorts by slug rather than input order", () => {
    const registry = buildRegistry([
      makeBlueprint("zeta", []),
      makeBlueprint("alpha", []),
      makeBlueprint("mid", []),
    ]);

    expect(registry.blueprints().map((b) => b.slug)).toEqual(["alpha", "mid", "zeta"]);
  });

  it("records the manifest, the bundle digest and the distinct sorted pins", () => {
    const record = world.blueprint("alpha");

    expect(record?.digest).toBe("sha256:bp-alpha");
    expect(record?.manifest.category).toBe("research");
    expect(record?.cardRefs).toEqual(["checker-b@1.0.0", "solver-a@1.10.0"]);
  });

  it("lists a ref once even when several nodes instantiate it", () => {
    const twice = makeBlueprint("twice", [
      makeNode(solver110, { nodeId: "first" }),
      makeNode(solver110, { nodeId: "second" }),
    ]);

    expect(buildRegistry([twice]).blueprint("twice")?.cardRefs).toEqual(["solver-a@1.10.0"]);
  });

  it("returns undefined for a slug it does not hold", () => {
    expect(world.blueprint("gamma")).toBeUndefined();
    expect(world.blueprint("")).toBeUndefined();
  });

  it("keeps the first blueprint claiming a slug and skips the namesake whole", () => {
    const first = makeBlueprint("dup", [makeNode(solver110)], { title: "First" });
    const second = makeBlueprint("dup", [makeNode(solver200)], { title: "Second" });
    const registry = buildRegistry([first, second]);

    expect(registry.blueprints()).toHaveLength(1);
    expect(registry.blueprint("dup")?.manifest.title).toBe("First");
    expect(registry.cards().map((c) => c.ref)).toEqual(["solver-a@1.10.0"]);
  });
});

describe("cards and versions", () => {
  const versions = ["1.0.0", "1.9.0", "1.10.0", "2.0.0"];
  const many = buildRegistry([
    makeBlueprint(
      "history",
      versions.map((v) => makeNode(makeCard("solver-a", v), { nodeId: `n_${v}` })),
    ),
  ]);

  it("orders every version of one id newest first", () => {
    expect(many.versionsOf("solver-a").map((c) => c.version)).toEqual([
      "2.0.0",
      "1.10.0",
      "1.9.0",
      "1.0.0",
    ]);
  });

  it("sorts cards by id ascending, then version descending", () => {
    expect(world.cards().map((c) => c.ref)).toEqual([
      "checker-b@1.0.0",
      "solver-a@2.0.0",
      "solver-a@1.10.0",
    ]);
  });

  it("splits the ref into the id and version it pins", () => {
    const record = world.card("solver-a@1.10.0");

    expect(record?.id).toBe("solver-a");
    expect(record?.version).toBe("1.10.0");
    expect(record?.digest).toBe("sha256:solver-a@1.10.0");
    expect(record?.card).toBe(solver110);
  });

  it("falls back to the card's own fields when the ref is not a pinned reference", () => {
    // resolveBundle would already have raised bundle/unpinned-card; the row is still indexed.
    const loose = makeBlueprint("loose", [makeNode(solver110, { ref: "solver-a" })]);
    const record = buildRegistry([loose]).card("solver-a");

    expect(record?.id).toBe("solver-a");
    expect(record?.version).toBe("1.10.0");
  });

  it("returns undefined for an unknown or unpinned ref", () => {
    expect(world.card("solver-a")).toBeUndefined();
    expect(world.card("solver-a@9.9.9")).toBeUndefined();
    expect(world.card("")).toBeUndefined();
  });

  it("returns an empty list for an id it does not hold", () => {
    expect(many.versionsOf("nope")).toEqual([]);
    expect(many.versionsOf("")).toEqual([]);
  });

  it("picks the newest version of each distinct id for latestCards", () => {
    expect(world.latestCards().map((c) => c.ref)).toEqual([
      "checker-b@1.0.0",
      "solver-a@2.0.0",
    ]);
    expect(many.latestCards().map((c) => c.ref)).toEqual(["solver-a@2.0.0"]);
  });

  it("keeps namespaced ids separate from bare ones", () => {
    const mine = makeCard("berti/solver-a", "3.0.0");
    const registry = buildRegistry([
      makeBlueprint("ns", [makeNode(solver110), makeNode(mine, { nodeId: "berti" })]),
    ]);

    expect(registry.latestCards().map((c) => c.id)).toEqual(["berti/solver-a", "solver-a"]);
    expect(registry.versionsOf("solver-a")).toHaveLength(1);
  });
});

describe("usedIn and usersOf", () => {
  it("credits every blueprint that pins the exact version", () => {
    expect(world.card("solver-a@1.10.0")?.usedIn).toEqual(["alpha", "beta"]);
    expect(world.card("solver-a@2.0.0")?.usedIn).toEqual(["beta"]);
    expect(world.card("checker-b@1.0.0")?.usedIn).toEqual(["alpha"]);
  });

  it("names a blueprint once however many of its nodes pin the card", () => {
    const twice = makeBlueprint("twice", [
      makeNode(solver110, { nodeId: "first" }),
      makeNode(solver110, { nodeId: "second" }),
    ]);

    expect(buildRegistry([twice]).card("solver-a@1.10.0")?.usedIn).toEqual(["twice"]);
  });

  it("unions the users across every version of an id, sorted", () => {
    expect(world.usersOf("solver-a")).toEqual(["alpha", "beta"]);
    expect(world.usersOf("checker-b")).toEqual(["alpha"]);
  });

  it("returns an empty list for an id nobody uses", () => {
    expect(world.usersOf("ghost")).toEqual([]);
    expect(world.usersOf("")).toEqual([]);
  });

  it("does not index a card that sits in the bundle unreferenced", () => {
    // An orphan has no digest and no user — bundle/orphan-card is the resolver's business.
    const orphan = makeCard("orphan-c", "1.0.0", { phases: ["deployment"] });
    const registry = buildRegistry([
      makeBlueprint("with-orphan", [makeNode(solver110)], {}, [orphan]),
    ]);

    expect(registry.card("orphan-c@1.0.0")).toBeUndefined();
    expect(registry.cards().map((c) => c.id)).toEqual(["solver-a"]);
    // And it contributes no phase either: an unreferenced card is not part of what runs.
    expect(registry.phases()).toEqual(["implementation"]);
  });
});

/* ------------------------------------------------------------------
   Phase coverage (doc 2 §8, doc 3 §2), made queryable: the gallery
   badge and the /nodes filter both read these two methods.
   ------------------------------------------------------------------ */

describe("phases and cardsByPhase", () => {
  const planner = makeCard("planner-a", "1.0.0", {
    name: "Planner A",
    phases: ["planning"],
    action: "Turn the request into a plan and acceptance criteria",
    spec: "Read the request and write both a step-by-step plan and the acceptance criteria the result will be judged against.",
    outputs: [{ name: "criteria", type: "acceptance-criteria" }],
  });
  const builder = makeCard("builder-b", "1.0.0", {
    name: "Builder B",
    phases: ["implementation"],
    spec: "Take the plan on the input port and produce the artefact it describes, writing the result to the `draft` port.",
  });
  const tester = makeCard("tester-c", "1.0.0", {
    name: "Tester C",
    type: "validation",
    phases: ["testing"],
    action: "Run the checks and produce the evidence",
    spec: "Run every declared check against the artefact and emit the verdict together with the evidence each check produced.",
  });
  const fixer = makeCard("fixer-d", "1.0.0", {
    name: "Fixer D",
    phases: ["debugging"],
    action: "Turn failure evidence into a targeted fix",
    spec: "Read the failing evidence, locate the smallest cause you can defend, and write a fix that addresses only that cause.",
  });
  const shipper = makeCard("shipper-e", "1.0.0", {
    name: "Shipper E",
    type: "human-gate",
    phases: ["deployment"],
    action: "Approve the release",
    spec: "Show the artefact and the verdict to a person and wait for an explicit approval or rejection before releasing.",
  });

  it("reports the phases in doc 3 lifecycle order, not alphabetically", () => {
    // Pinned in a scrambled order, and every alphabetical ordering of these five differs
    // from the lifecycle one — "debugging" would come first if the index sorted.
    const registry = buildRegistry([
      makeBlueprint("whole", [
        makeNode(shipper),
        makeNode(fixer),
        makeNode(planner),
        makeNode(tester),
        makeNode(builder),
      ]),
    ]);

    expect(registry.phases()).toEqual([
      "planning",
      "implementation",
      "testing",
      "debugging",
      "deployment",
    ]);
    expect(registry.phases()).toEqual(CORE_PHASE_IDS);
    expect([...registry.phases()].sort()).not.toEqual(registry.phases());
  });

  it("reports only the phases that are present, still in lifecycle order", () => {
    // Doc 2 §1.1 / doc 3 §2: three phases out of five is a description, not a gap —
    // the two missing ones are simply absent, with no placeholder and no count.
    const registry = buildRegistry([
      makeBlueprint("partial", [makeNode(shipper), makeNode(builder), makeNode(planner)]),
    ]);

    expect(registry.phases()).toEqual(["planning", "implementation", "deployment"]);
  });

  it("names a phase once however many cards or blueprints declare it", () => {
    const registry = buildRegistry([
      makeBlueprint("one", [makeNode(planner), makeNode(builder)]),
      makeBlueprint("two", [makeNode(solver110), makeNode(planner)]),
    ]);

    expect(registry.phases()).toEqual(["planning", "implementation"]);
    expect(registry.cardsByPhase("implementation").map((c) => c.id)).toEqual([
      "builder-b",
      "solver-a",
    ]);
  });

  it("returns the cards of one phase in cards() order — id ascending, version descending", () => {
    const registry = buildRegistry([
      makeBlueprint("ordered", [
        makeNode(makeCard("solver-a", "1.9.0"), { nodeId: "old" }),
        makeNode(solver200, { nodeId: "new" }),
        makeNode(builder),
        makeNode(planner),
      ]),
    ]);
    const inPhase = registry.cardsByPhase("implementation");

    expect(inPhase.map((c) => c.ref)).toEqual([
      "builder-b@1.0.0",
      "solver-a@2.0.0",
      "solver-a@1.9.0",
    ]);
    // The same order the full listing has, with the other phases filtered out.
    expect(inPhase).toEqual(registry.cards().filter((c) => c.card.phases.includes("implementation")));
  });

  it("returns an empty list for a phase no card declares", () => {
    // "debugging" is a real phase of the vocabulary; this index simply has none.
    expect(world.phases()).toEqual(["implementation", "testing"]);
    expect(world.cardsByPhase("debugging")).toEqual([]);
    expect(world.phases()).not.toContain("debugging");
  });

  it.each([
    ["a phase that is not in the vocabulary at all", "release"],
    ["an empty phase", ""],
    ["a phase differing only in case", "Implementation"],
  ])("returns an empty list for %s", (_name, phase) => {
    expect(world.cardsByPhase(phase)).toEqual([]);
  });

  it("partitions cards() — every indexed row sits under exactly one phase", () => {
    const registry = buildRegistry([
      makeBlueprint("full", [
        makeNode(planner),
        makeNode(builder),
        makeNode(tester),
        makeNode(fixer),
        makeNode(shipper),
        makeNode(solver110),
      ]),
    ]);
    const regrouped = registry.phases().flatMap((p) => [...registry.cardsByPhase(p)]);

    expect(regrouped).toHaveLength(registry.cards().length);
    expect(new Set(regrouped)).toEqual(new Set(registry.cards()));
  });

  it("files two versions of one card under the phase each declares", () => {
    // A phase change is a major bump (doc 1 §4), so the two versions are genuinely
    // different cards and belong in different buckets.
    const moved = makeCard("solver-a", "2.0.0", { phases: ["debugging"] });
    const registry = buildRegistry([
      makeBlueprint("moved", [makeNode(solver110), makeNode(moved, { nodeId: "later" })]),
    ]);

    expect(registry.phases()).toEqual(["implementation", "debugging"]);
    expect(registry.cardsByPhase("implementation").map((c) => c.ref)).toEqual([
      "solver-a@1.10.0",
    ]);
    expect(registry.cardsByPhase("debugging").map((c) => c.ref)).toEqual(["solver-a@2.0.0"]);
  });

  it("treats a blank phase as an absent one and never lists it", () => {
    // card/missing-field is the validator's to raise; the index just refuses to invent
    // a phase named "" and put it on a badge.
    const blank = makeCard("blank-f", "1.0.0", { phases: [""] });
    const registry = buildRegistry([makeBlueprint("blank", [makeNode(blank), makeNode(tester)])]);

    expect(registry.phases()).toEqual(["testing"]);
    expect(registry.cardsByPhase("")).toEqual([]);
    // The card itself is still indexed — only its phase is missing, not the card.
    expect(registry.card("blank-f@1.0.0")).toBeDefined();
  });

  it("reports a phase outside the five after them, rather than hiding it", () => {
    // Doc 3 §7 closes the phase dimension and the validator rejects a namespaced one, so
    // this cannot reach the index from validated content. If it ever does, `phases()`
    // omitting a bucket `cardsByPhase()` answers would make the gallery filter lie.
    const local = makeCard("local-g", "1.0.0", { phases: ["berti/simulation"] });
    const registry = buildRegistry([
      makeBlueprint("local", [makeNode(local), makeNode(tester), makeNode(planner)]),
    ]);

    expect(registry.phases()).toEqual(["planning", "testing", "berti/simulation"]);
    expect(registry.cardsByPhase("berti/simulation").map((c) => c.id)).toEqual(["local-g"]);
  });

  it("sorts several non-core phases among themselves, after the five", () => {
    const zulu = makeCard("zulu-h", "1.0.0", { phases: ["zulu"] });
    const acme = makeCard("acme-i", "1.0.0", { phases: ["acme"] });
    const registry = buildRegistry([
      makeBlueprint("odd", [makeNode(zulu), makeNode(acme), makeNode(builder)]),
    ]);

    expect(registry.phases()).toEqual(["implementation", "acme", "zulu"]);
  });
});

describe("duplicates", () => {
  /** Byte-identical to `card` apart from the ref it is published under. */
  function fork(card: NodeCard, id: string, version = "1.0.0"): NodeCard {
    return { ...card, id, version };
  }

  it("groups distinct refs whose content is the same", () => {
    // The same content republished under a second id: §4 dedup, made visible.
    // `cardDigest` hashes id and version, so the digests differ and cannot be the key.
    const forked = fork(solver110, "solver-fork");
    const registry = buildRegistry([
      makeBlueprint("dup-world", [
        makeNode(solver110),
        makeNode(forked, { nodeId: "fork" }),
        makeNode(checker),
      ]),
    ]);

    const groups = registry.duplicates();
    expect(groups).toHaveLength(1);
    expect(groups[0].map((c) => c.ref)).toEqual(["solver-a@1.10.0", "solver-fork@1.0.0"]);
    // The two rows really are distinct publications, digest included.
    expect(groups[0][0].digest).not.toBe(groups[0][1].digest);
  });

  it("groups a republished version that changed nothing", () => {
    const republished = { ...solver110, version: "1.11.0" };
    const registry = buildRegistry([
      makeBlueprint("stale", [
        makeNode(solver110),
        makeNode(republished, { nodeId: "solver_new" }),
      ]),
    ]);

    expect(registry.duplicates().map((g) => g.map((c) => c.ref))).toEqual([
      ["solver-a@1.11.0", "solver-a@1.10.0"],
    ]);
  });

  it("finds a collision spanning two blueprints", () => {
    const forked = fork(solver110, "solver-fork");
    const registry = buildRegistry([
      makeBlueprint("one", [makeNode(solver110)]),
      makeBlueprint("two", [makeNode(forked)]),
    ]);

    expect(registry.duplicates().map((g) => g.map((c) => c.ref))).toEqual([
      ["solver-a@1.10.0", "solver-fork@1.0.0"],
    ]);
  });

  it("reports nothing when the cards genuinely differ", () => {
    expect(world.duplicates()).toEqual([]);
    expect(buildRegistry([alpha]).duplicates()).toEqual([]);
  });

  it("is not fooled by author or provenance, which are not part of a card's content", () => {
    const attributed = { ...fork(solver110, "solver-fork"), author: "ada", provenance: "import" };
    const registry = buildRegistry([
      makeBlueprint("attributed", [makeNode(solver110), makeNode(attributed, { nodeId: "fork" })]),
    ]);

    expect(registry.duplicates()).toHaveLength(1);
  });

  it("does not group two cards that differ by a single field", () => {
    const nearly = { ...fork(solver110, "solver-fork"), notes: "Same, but noted." };
    const registry = buildRegistry([
      makeBlueprint("nearly", [makeNode(solver110), makeNode(nearly, { nodeId: "fork" })]),
    ]);

    expect(registry.duplicates()).toEqual([]);
  });

  it.each([
    ["phase", { phases: ["debugging"] }],
    ["spec", { spec: "Read the task and write one candidate solution, but explain each choice first." }],
  ])("does not group two cards that differ only in %s", (_name, over) => {
    // Both are content, not naming: `phase` re-buckets the card in every coverage
    // calculation and `spec` is the instruction the agent actually receives.
    const nearly = { ...fork(solver110, "solver-fork"), ...over };
    const registry = buildRegistry([
      makeBlueprint("differs", [makeNode(solver110), makeNode(nearly, { nodeId: "fork" })]),
    ]);

    expect(registry.duplicates()).toEqual([]);
  });

  it("does not treat one card pinned by two blueprints as a duplicate", () => {
    // solver-a@1.10.0 is in both alpha and beta, but it is one row, not two.
    expect(world.duplicates()).toEqual([]);
    expect(world.card("solver-a@1.10.0")?.usedIn).toHaveLength(2);
  });

  it("groups three-way collisions in one group", () => {
    const base = makeCard("a-first", "1.0.0");
    const registry = buildRegistry([
      makeBlueprint("triple", [
        makeNode(fork(base, "c-third"), { nodeId: "third" }),
        makeNode(base, { nodeId: "first" }),
        makeNode(fork(base, "b-second"), { nodeId: "second" }),
      ]),
    ]);

    expect(registry.duplicates()).toHaveLength(1);
    expect(registry.duplicates()[0].map((c) => c.id)).toEqual(["a-first", "b-second", "c-third"]);
  });
});

describe("tags and categories", () => {
  it("returns distinct sorted values across every blueprint", () => {
    expect(world.tags()).toEqual(["agents", "retry", "validation"]);
    expect(world.categories()).toEqual(["ops", "research"]);
  });

  it("omits a blueprint with no category and skips empty values", () => {
    const registry = buildRegistry([
      makeBlueprint("no-cat", [], { tags: ["a", ""] }),
      makeBlueprint("with-cat", [], { tags: [], category: "ops" }),
      makeBlueprint("blank-cat", [], { tags: [], category: "" }),
    ]);

    expect(registry.tags()).toEqual(["a"]);
    expect(registry.categories()).toEqual(["ops"]);
  });

  it("is case-sensitive — the ontology, not the index, normalizes vocabulary", () => {
    const registry = buildRegistry([makeBlueprint("t", [], { tags: ["Retry", "retry"] })]);

    expect(registry.tags()).toEqual(["Retry", "retry"]);
  });
});

describe("searchCards", () => {
  it.each([
    ["lowercase query", "checker"],
    ["uppercase query", "CHECKER"],
    ["mixed case query", "ChEcKeR"],
    ["padded query", "  checker  "],
  ])("matches the id case-insensitively for a %s", (_name, query) => {
    expect(world.searchCards(query).map((c) => c.ref)).toEqual(["checker-b@1.0.0"]);
  });

  it("matches a mixed-case field from a lowercase query", () => {
    // "Checker B" lives in `name`; the query is folded on both sides.
    expect(world.searchCards("checker b").map((c) => c.ref)).toEqual(["checker-b@1.0.0"]);
  });

  it.each([
    ["action", "acceptance criteria"],
    ["notes", "citation"],
    ["name", "Card solver-a"],
  ])("searches %s too", (_name, query) => {
    expect(world.searchCards(query).length).toBeGreaterThan(0);
  });

  it("returns every version that matches, in cards() order", () => {
    expect(world.searchCards("solver").map((c) => c.ref)).toEqual([
      "solver-a@2.0.0",
      "solver-a@1.10.0",
    ]);
  });

  it.each([
    ["empty query", ""],
    ["whitespace-only query", "   \n"],
  ])("filters nothing for an %s", (_name, query) => {
    expect(world.searchCards(query)).toEqual(world.cards());
  });

  it("returns nothing when the query matches no field", () => {
    expect(world.searchCards("no-such-node")).toEqual([]);
  });

  it("does not match on version or ref", () => {
    // The ref is a lookup key, not search text — `card()` is the way to reach it.
    expect(world.searchCards("1.10.0")).toEqual([]);
    expect(world.searchCards("@")).toEqual([]);
  });

  it("does not fold the spec into the corpus", () => {
    // Doc 1 §3.2 makes `spec` a long self-sufficient instruction; searching it would
    // match nearly everything. `phase` and `type` are structured, and have their own
    // queries rather than a substring match.
    // A phrase that appears in the spec and nowhere else on the card.
    expect(solver110.spec).toContain("Do not look at anything else");
    expect(world.searchCards("do not look at anything else")).toEqual([]);
    expect(world.searchCards("implementation")).toEqual([]);
  });
});

describe("immutability", () => {
  it("freezes every array a query hands out", () => {
    expect(Object.isFrozen(world.cards())).toBe(true);
    expect(Object.isFrozen(world.blueprints())).toBe(true);
    expect(Object.isFrozen(world.latestCards())).toBe(true);
    expect(Object.isFrozen(world.versionsOf("solver-a"))).toBe(true);
    expect(Object.isFrozen(world.usersOf("solver-a"))).toBe(true);
    expect(Object.isFrozen(world.tags())).toBe(true);
    expect(Object.isFrozen(world.phases())).toBe(true);
    expect(Object.isFrozen(world.cardsByPhase("testing"))).toBe(true);
    expect(Object.isFrozen(world.cardsByPhase("debugging"))).toBe(true);
    expect(Object.isFrozen(world.searchCards("solver"))).toBe(true);
  });

  it("refuses edits to a record's own arrays", () => {
    const record = world.card("solver-a@1.10.0");
    expect(record).toBeDefined();
    if (record === undefined) return;

    expect(() => record.usedIn.push("gamma")).toThrow(TypeError);
    expect(record.usedIn).toEqual(["alpha", "beta"]);
  });

  it("returns the same instances on repeated calls", () => {
    expect(world.cards()).toBe(world.cards());
    expect(world.phases()).toBe(world.phases());
    expect(world.cardsByPhase("testing")).toBe(world.cardsByPhase("testing"));
    expect(world.card("solver-a@2.0.0")).toBe(world.cards()[1]);
  });

  it("does not read the blueprints it was given after building", () => {
    const nodes = [makeNode(solver110)];
    const mutable = makeBlueprint("mutable", nodes);
    const registry = buildRegistry([mutable]);

    nodes.push(makeNode(solver200));

    expect(registry.blueprint("mutable")?.cardRefs).toEqual(["solver-a@1.10.0"]);
    expect(registry.cards()).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------
   One test on real pipeline output rather than hand-built records:
   the duplicate has to survive `resolveBundle`, whose digests are the
   ones `cardDigest` actually produces, and whose cards have been
   through the validator.
   ------------------------------------------------------------------ */

describe("over a resolved bundle", () => {
  const twin = (id: string): string => `id: ${id}
name: Twin
type: agent
phase: implementation
action: Draft a candidate solution for the sub-task
spec: Read the task on the task port and write one candidate solution to the draft port, without consulting anything else.
inputs:
  - { name: task, type: text }
outputs:
  - { name: draft, type: json }
version: 1.0.0
`;

  const resolved = resolveBundle(
    {
      manifest: {
        slug: "twins",
        title: "Twins",
        summary: "Two names for one card.",
        tags: [],
      },
      dot: 'digraph twins { a [card="twin-a@1.0.0"]; b [card="twin-b@1.0.0"]; }',
      cardFiles: { "cards/a.yaml": twin("twin-a"), "cards/b.yaml": twin("twin-b") },
    },
    ontologyView(CORE_ONTOLOGY),
  );

  it("groups two cards published under different ids with the same content", () => {
    const blueprint = resolved.blueprint;
    expect(blueprint).toBeDefined();
    if (blueprint === undefined) return;

    const registry = buildRegistry([blueprint]);
    const groups = registry.duplicates();

    expect(groups.map((g) => g.map((c) => c.ref))).toEqual([["twin-a@1.0.0", "twin-b@1.0.0"]]);
    // The digests differ because `cardDigest` hashes the id — which is precisely why
    // grouping by digest could never surface this.
    expect(groups[0][0].digest).not.toBe(groups[0][1].digest);
  });

  it("indexes the phase the validated cards declare", () => {
    const blueprint = resolved.blueprint;
    expect(blueprint).toBeDefined();
    if (blueprint === undefined) return;

    const registry = buildRegistry([blueprint]);

    expect(registry.phases()).toEqual(["implementation"]);
    expect(registry.cardsByPhase("implementation").map((c) => c.ref)).toEqual([
      "twin-a@1.0.0",
      "twin-b@1.0.0",
    ]);
  });
});
