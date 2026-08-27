import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkVersionChain, loadCard, parseCardRef, type NodeCard } from "@/lib/core";

import { contentOntology, contentOntologyDiagnostics, readContent } from "./read";

/* --------------------- the real archive --------------------- */

describe("readContent over content/", () => {
  const loaded = readContent();

  it("loads all nine blueprints with no error-severity diagnostic", () => {
    expect(loaded.map((b) => b.slug)).toEqual([
      "adversarial-consensus-line",
      "checkpoint-resume-runner",
      "frontline-triage",
      "grounded-research-desk",
      "guarded-merge-bot",
      "incident-commander",
      "nightly-data-janitor",
      "schema-forge-etl",
      "starter-software-factory",
    ]);
    for (const bundle of loaded) {
      expect(bundle.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    }
  });

  // Doc 3 §3 makes `type` one of the things every node declares, doc 3 §2 makes `phase`
  // one it *may* declare, and doc 1 §3.2 makes `spec` the payload the agent actually
  // receives. The whole archive was migrated to v0.1 at once, so the cheapest way to
  // notice a card slipping back is to assert the vocabulary here rather than to trust 57
  // files to stay migrated.
  //
  // `phases` is checked entry by entry rather than for presence: the author's ruling makes
  // the five phases a description of the factory, not of every node in it, so an intake or
  // a retrieval strand declaring none is a complete answer and `[]` is asserted as legal.
  // What must never drift is an entry *outside* the five, or a namespaced one (doc 3 §7
  // keeps the dimension closed), or the same phase written twice.
  it("resolves every node against ontology v0.1 — five phases, six types, a real spec", () => {
    const PHASES = ["planning", "implementation", "testing", "debugging", "deployment"];
    const TYPES = ["agent", "tool", "human-gate", "human-input", "decision", "validation"];
    for (const bundle of loaded) {
      for (const node of bundle.blueprint.nodes) {
        const phases = node.card.phases;
        expect([node.ref, phases.every((p) => PHASES.includes(p))]).toEqual([node.ref, true]);
        expect([node.ref, new Set(phases).size]).toEqual([node.ref, phases.length]);
        expect([node.ref, TYPES.includes(node.card.type)]).toEqual([node.ref, true]);
        expect(node.card.spec.trim().length).toBeGreaterThan(40);
        expect(node.card.ontologyVersion).toBe("0.1.0");
      }
      expect(bundle.bundle.manifest.ontologyVersion).toBe("0.1.0");
    }
  });

  // The migration that made `phase` optional and repeatable is only real if the archive
  // actually uses both ends of it. Asserted as a property of the content rather than of the
  // schema, because a schema that permits `[]` and `[a, b]` while all 57 cards still carry
  // exactly one would leave the interesting paths — `unphased`, and a node in two groups —
  // untravelled by every page the site builds.
  it("exercises both ends of the new phase cardinality — none, and more than one", () => {
    const cards = loaded.flatMap((bundle) => bundle.blueprint.nodes.map((n) => n.card));
    expect(cards.some((card) => card.phases.length === 0)).toBe(true);
    expect(cards.some((card) => card.phases.length > 1)).toBe(true);
  });

  // Doc 3 §3's note: the two fields feed the same metric, so disagreeing is an error and
  // not a warning. The archive carries two `human-gate` cards and no `human-input` one.
  it("keeps `requires_human` consistent with every human type", () => {
    for (const bundle of loaded) {
      for (const node of bundle.blueprint.nodes) {
        const human = bundle.blueprint.ontology.isA(node.card.type, "human-in-the-loop");
        expect([node.ref, human]).toEqual([node.ref, node.card.requiresHuman]);
      }
    }
  });

  it("shares one vocabulary that carries the archive's local namespace (doc 3 §7)", () => {
    const view = contentOntology();
    // The extension file is loaded, and the term it declares is rooted in the core.
    const local = view.get("lupo/pii-handling");
    expect(local?.kind).toBe("risk-marker");
    expect(view.isA("lupo/pii-handling", "isolation-breach")).toBe(true);
    // A local overlay does not mint a new vocabulary version (doc 3 §8).
    expect(view.ontology.version).toBe("0.1.0");
    // …and the vocabulary itself holds together, which is what the loader checks first.
    expect(contentOntologyDiagnostics()).toEqual([]);
  });

  it("declares no marker the vocabulary cannot price", () => {
    const view = contentOntology();
    for (const bundle of loaded) {
      for (const node of bundle.blueprint.nodes) {
        for (const marker of node.card.riskMarkers) {
          expect([node.ref, marker, view.resolve(marker, "risk-marker") !== undefined]).toEqual([
            node.ref,
            marker,
            true,
          ]);
        }
      }
    }
  });

  it("is memoized: a second read returns the very same objects", () => {
    expect(readContent()).toBe(loaded);
  });

  it("pulls only the cards the DOT pins, so it manufactures no orphan warnings", () => {
    for (const bundle of loaded) {
      const pinned = new Set(bundle.blueprint.nodes.map((n) => n.ref));
      const carried = bundle.cardFiles.map((c) => c.file.replace(/^cards\/|\.yaml$/g, ""));

      expect(new Set(carried)).toEqual(pinned);
      expect(bundle.diagnostics.map((d) => d.code)).not.toContain("bundle/orphan-card");
    }
  });

  it("gives every card file a parsable ref and a repo-relative path", () => {
    for (const bundle of loaded) {
      for (const card of bundle.cardFiles) {
        const ref = card.file.replace(/^cards\/|\.yaml$/g, "");
        expect(parseCardRef(ref)).toBeDefined();
        expect(card.path).toBe(`content/cards/${ref}.yaml`);
        expect(card.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("resolves every node against a card and scores the graph", () => {
    for (const bundle of loaded) {
      expect(bundle.blueprint.nodes.length).toBeGreaterThan(0);
      expect(bundle.blueprint.nodes.length).toBe(bundle.blueprint.graph.ids.length);
      expect(bundle.blueprint.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect([1, 2, 3, 4]).toContain(bundle.analysis.autonomy.level);
      expect([1, 2, 3, 4]).toContain(bundle.analysis.security.level);
    }
  });

  it("shares the one ontology view across every bundle", () => {
    const views = new Set(loaded.map((b) => b.blueprint.ontology));
    expect(views.size).toBe(1);
  });
});

/* --------------------- a broken archive must fail the build --------------------- */

/** Minimal well-formed manifest text, so a fixture only breaks what it means to break. */
function manifest(slug: string, extra = ""): string {
  return [
    `slug: ${slug}`,
    `title: ${slug}`,
    "summary: A fixture.",
    "tags: []",
    'ontologyVersion: "0.1.0"',
    extra,
  ].join("\n");
}

/**
 * A card that satisfies ontology v0.1 in full: doc 3's dimensions and doc 1 §3.2's `spec`.
 * `spec` is written out rather than defaulted away because it is required, and a fixture
 * that omitted it would fail for a reason none of the tests below is about. `phase` is
 * *not* required — it is here only so the fixtures land in a phase group rather than in
 * `unphased`, which keeps the coverage they produce readable.
 */
function card(id: string, inputs: string, outputs: string, extra = ""): string {
  return [
    `id: ${id}`,
    `name: ${id}`,
    "type: agent",
    "phase: implementation",
    "version: 1.0.0",
    "ontology_version: 0.1.0",
    "action: Do the one thing this fixture exists to do.",
    "spec: >-",
    "  Do the one thing this fixture exists to do, and emit it on the port declared below.",
    "  Nothing else reaches you and nothing else is expected of you.",
    `inputs: ${inputs}`,
    `outputs: ${outputs}`,
    extra,
  ].join("\n");
}

/**
 * Run `readContent` against a throwaway archive. The content root is derived from
 * `process.cwd()` at module scope, so the module is re-imported under a stubbed cwd
 * rather than parameterised — the production path is the path under test.
 */
async function fixtureModule(build: (root: string) => void): Promise<typeof import("./read")> {
  const root = mkdtempSync(join(tmpdir(), "darkprint-content-"));
  roots.push(root);
  mkdirSync(join(root, "content", "blueprints"), { recursive: true });
  mkdirSync(join(root, "content", "cards"), { recursive: true });
  build(root);

  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
  return import("./read");
}

async function readFixture(build: (root: string) => void): Promise<() => unknown> {
  const fresh = await fixtureModule(build);
  return () => fresh.readContent();
}

/** `content/ontology/extensions.yaml` inside a fixture root. */
function writeExtensions(root: string, text: string): void {
  mkdirSync(join(root, "content", "ontology"), { recursive: true });
  writeFileSync(join(root, "content", "ontology", "extensions.yaml"), text);
}

/** A one-node archive, so an extensions fixture only exercises the vocabulary. */
function trivialArchive(root: string): void {
  const cards = join(root, "content", "cards");
  writeFileSync(join(cards, "only@1.0.0.yaml"), card("only", "[]", "[]"));
  const dir = join(root, "content", "blueprints", "solo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "blueprint.yaml"), manifest("solo"));
  writeFileSync(join(dir, "topology.dot"), 'digraph solo {\n  n [card="only@1.0.0"];\n}\n');
}

const roots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  while (roots.length > 0) {
    const root = roots.pop();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

describe("readContent on broken content", () => {
  it("throws, naming the file, the code and the hint, when a pinned card is missing", async () => {
    const read = await readFixture((root) => {
      const dir = join(root, "content", "blueprints", "ghosts");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "blueprint.yaml"), manifest("ghosts"));
      writeFileSync(
        join(dir, "topology.dot"),
        'digraph ghosts {\n  a [card="ghost-card@1.0.0"];\n  b [card="also-gone@2.0.0"];\n  a -> b;\n}\n',
      );
    });

    expect(read).toThrow(/DarkPrint content is broken/);
    expect(read).toThrow(/bundle\/missing-card/);
    expect(read).toThrow(/content\/blueprints\/ghosts\/topology\.dot:2/);
    expect(read).toThrow(/ghost-card@1\.0\.0/);
    expect(read).toThrow(/also-gone@2\.0\.0/);
    expect(read).toThrow(/hint:/);
  });

  it("throws on an edge whose ports cannot line up", async () => {
    const read = await readFixture((root) => {
      const cards = join(root, "content", "cards");
      // Two v0.1 data types on different branches of the lattice: `table` is under
      // `structured`, `code` under `text`, so neither subsumes the other and neither is
      // `any`. (The pre-v0.1 fixture used `image`, which the vocabulary no longer carries
      // — it would now fail as `card/unknown-term` before an edge was ever considered.)
      writeFileSync(
        join(cards, "producer@1.0.0.yaml"),
        card("producer", "[]", "[{ name: rows, type: table }]"),
      );
      writeFileSync(
        join(cards, "consumer@1.0.0.yaml"),
        card("consumer", "[{ name: source, type: code }]", "[]", "dependencies: [producer]"),
      );
      const dir = join(root, "content", "blueprints", "mismatch");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "blueprint.yaml"), manifest("mismatch"));
      writeFileSync(
        join(dir, "topology.dot"),
        'digraph mismatch {\n  p [card="producer@1.0.0"];\n  c [card="consumer@1.0.0"];\n  p -> c;\n}\n',
      );
    });

    expect(read).toThrow(/bundle\/type-mismatch/);
    expect(read).toThrow(/`table`/);
    expect(read).toThrow(/`code`/);
  });

  // Doc 3 §2 keeps the phase vocabulary closed and doc 1 §3.2 makes `spec` the payload the
  // agent receives, so the loader must refuse a card carrying a phase v0.1 does not have,
  // or carrying no `spec` at all — this is the failure the whole archive migration existed
  // to clear.
  //
  // What is *not* asserted here, and used to be: `card/missing-phase`. Declaring no phase
  // is now legal and silent, so the only phase failure left is declaring the wrong one.
  // The fixture says so both ways — `phase: coding` is the pre-v0.1 spelling of
  // `implementation` and must be reported, while the absent-phase case is covered in
  // `card/validate` and `analysis/analyze`, which own the silence.
  it("throws when a card predates ontology v0.1", async () => {
    const read = await readFixture((root) => {
      const cards = join(root, "content", "cards");
      writeFileSync(
        join(cards, "legacy@1.0.0.yaml"),
        [
          "id: legacy",
          "name: legacy",
          "type: trigger",
          "phase: coding",
          "version: 1.0.0",
          "ontology_version: 1.0.0",
          "action: Open the run.",
          "inputs: []",
          "outputs: [{ name: payload, type: json }]",
        ].join("\n"),
      );
      const dir = join(root, "content", "blueprints", "legacy");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "blueprint.yaml"), manifest("legacy"));
      writeFileSync(join(dir, "topology.dot"), 'digraph legacy {\n  n [card="legacy@1.0.0"];\n}\n');
    });

    expect(read).toThrow(/card\/unknown-phase/);
    expect(read).toThrow(/Phase `coding` is not one of the five phases/);
    expect(read).toThrow(/card\/missing-field/);
    expect(read).toThrow(/Field `spec` is missing/);
    // `trigger` was folded into `tool` by v0.1 and is no longer a term at all.
    expect(read).toThrow(/card\/unknown-term/);
    expect(read).toThrow(/Term `trigger` is not in the ontology/);
  });

  it("throws when a manifest is not shaped like a manifest", async () => {
    const read = await readFixture((root) => {
      const dir = join(root, "content", "blueprints", "headless");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "blueprint.yaml"), "slug: headless\nsummary: No title.\ntags: []\n");
      writeFileSync(join(dir, "topology.dot"), "digraph headless {\n}\n");
    });

    expect(read).toThrow(/blueprint\.yaml is missing a `title`/);
  });

  it("throws when the manifest slug and the directory disagree", async () => {
    const read = await readFixture((root) => {
      const dir = join(root, "content", "blueprints", "on-disk");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "blueprint.yaml"), manifest("in-the-file"));
      writeFileSync(join(dir, "topology.dot"), "digraph x {\n}\n");
    });

    expect(read).toThrow(/declares slug `in-the-file`, but it sits in a directory called `on-disk`/);
  });

  it("reports every broken bundle, not just the first", async () => {
    const read = await readFixture((root) => {
      for (const slug of ["one", "two"]) {
        const dir = join(root, "content", "blueprints", slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "blueprint.yaml"), manifest(slug));
        writeFileSync(
          join(dir, "topology.dot"),
          `digraph ${slug} {\n  n [card="nowhere@1.0.0"];\n}\n`,
        );
      }
    });

    expect(read).toThrow(/blueprints\/one\//);
    expect(read).toThrow(/blueprints\/two\//);
  });

  it("loads a fixture archive that is actually sound", async () => {
    const read = await readFixture((root) => {
      const cards = join(root, "content", "cards");
      writeFileSync(
        join(cards, "producer@1.0.0.yaml"),
        card("producer", "[]", "[{ name: draft, type: json }]"),
      );
      writeFileSync(
        join(cards, "consumer@1.0.0.yaml"),
        card("consumer", "[{ name: draft, type: json }]", "[]", "dependencies: [producer]"),
      );
      // Never pinned: it must not reach the bundle, and so must raise no orphan warning.
      writeFileSync(
        join(cards, "unused@1.0.0.yaml"),
        card("unused", "[]", "[{ name: nothing, type: json }]"),
      );
      const dir = join(root, "content", "blueprints", "sound");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "blueprint.yaml"), manifest("sound"));
      writeFileSync(
        join(dir, "topology.dot"),
        'digraph sound {\n  p [card="producer@1.0.0"];\n  c [card="consumer@1.0.0"];\n  p -> c;\n}\n',
      );
    });

    const bundles = read() as ReturnType<typeof readContent>;
    expect(bundles).toHaveLength(1);
    expect(bundles[0].cardFiles.map((f) => f.file)).toEqual([
      "cards/producer@1.0.0.yaml",
      "cards/consumer@1.0.0.yaml",
    ]);
    expect(bundles[0].diagnostics.map((d) => d.code)).not.toContain("bundle/orphan-card");
  });

  /*
   * §4's bump rule, held against `content/cards/` rather than against one bundle.
   *
   * The archive's version chains live in the shared card library and nowhere else: each
   * blueprint pins one version of each id, so `resolveBundle` never sees two of them
   * together and the rule went unenforced. Three published cards stepped 1.0.0 → 1.1.0
   * for an edit the engine calls major, the node pages printed that verdict in
   * `--color-signal` beside the number, and the build stayed green. It does not now.
   */
  it("throws when a second version of a library card under-declares its bump", async () => {
    const read = await readFixture((root) => {
      const cards = join(root, "content", "cards");
      writeFileSync(join(cards, "only@1.0.0.yaml"), card("only", "[]", "[]"));
      writeFileSync(
        join(cards, "only@1.1.0.yaml"),
        card("only", "[]", "[]", "cannot:\n  - read the acceptance criteria").replace(
          "version: 1.0.0",
          "version: 1.1.0",
        ),
      );
      const dir = join(root, "content", "blueprints", "solo");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "blueprint.yaml"), manifest("solo"));
      writeFileSync(join(dir, "topology.dot"), 'digraph solo {\n  n [card="only@1.0.0"];\n}\n');
    });

    expect(read).toThrow(/DarkPrint content is broken/);
    expect(read).toThrow(/card\/version-bump-too-small/);
    expect(read).toThrow(/content\/cards\/only@1\.1\.0\.yaml/);
    expect(read).toThrow(/Publish `2\.0\.0` or higher/);
  });

  it("accepts the same edit published as a major", async () => {
    const read = await readFixture((root) => {
      const cards = join(root, "content", "cards");
      writeFileSync(join(cards, "only@1.0.0.yaml"), card("only", "[]", "[]"));
      writeFileSync(
        join(cards, "only@2.0.0.yaml"),
        card("only", "[]", "[]", "cannot:\n  - read the acceptance criteria").replace(
          "version: 1.0.0",
          "version: 2.0.0",
        ),
      );
      const dir = join(root, "content", "blueprints", "solo");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "blueprint.yaml"), manifest("solo"));
      writeFileSync(join(dir, "topology.dot"), 'digraph solo {\n  n [card="only@1.0.0"];\n}\n');
    });

    expect(read()).toHaveLength(1);
  });

  /*
   * The archive's own chains, asserted as content rather than as engine behaviour. The
   * loader above would fail the build on a violation, so this is the positive statement:
   * every id in `content/cards/` that has more than one version declares a number the
   * engine agrees with, and the four multi-version ids are actually there to be checked.
   */
  it("publishes every card version at a number `inferBump` agrees with", () => {
    const chains = new Map<string, { card: NodeCard; file: string }[]>();
    for (const name of readdirSync(join(process.cwd(), "content", "cards")).sort()) {
      if (!name.endsWith(".yaml")) continue;
      const text = readFileSync(join(process.cwd(), "content", "cards", name), "utf8");
      const loaded = loadCard(text, { ontology: contentOntology(), file: name });
      expect([name, loaded.card === undefined]).toEqual([name, false]);
      const id = loaded.card!.id;
      const chain = chains.get(id) ?? [];
      chain.push({ card: loaded.card!, file: name });
      chains.set(id, chain);
    }

    const multi = [...chains.entries()].filter(([, chain]) => chain.length > 1);
    expect(multi.map(([id]) => id).sort()).toEqual([
      "acceptance-verifier",
      "bounded-retry",
      "intent-router",
      "schema-gate",
    ]);
    for (const [id, chain] of multi) {
      expect([id, checkVersionChain(chain)]).toEqual([id, []]);
    }
  });
});

/* --------------------- the local namespace, doc 3 §7 --------------------- */

/**
 * `content/ontology/extensions.yaml` is loaded into the one `OntologyView` every bundle
 * is read against, and `view.validate()` runs before any bundle does. Doc 3 §7's reason
 * is the sharp one: a local term the core does not subsume is "ignorata silenziosamente
 * … il peggior esito possibile" — every card using it would validate and every score
 * would quietly be wrong. So a broken extension set fails the build like broken content.
 */
describe("readContent and the local namespace", () => {
  const TERM = (extra: string): string =>
    [
      'version: "0.1.0"',
      "terms:",
      "  - id: acme/spooky-action",
      "    kind: risk-marker",
      "    label: Spooky action",
      "    description: A fixture marker.",
      '    since: "0.1.0"',
      extra,
    ].join("\n");

  it("layers a well-formed extension over the core and prices it", async () => {
    const mod = await fixtureModule((root) => {
      trivialArchive(root);
      writeExtensions(root, TERM("    broader: isolation-breach\n    defaultWeight: 0.5"));
    });

    expect(mod.contentOntologyDiagnostics()).toEqual([]);
    const view = mod.contentOntology();
    expect(view.get("acme/spooky-action")?.defaultWeight).toBe(0.5);
    expect(view.isA("acme/spooky-action", "isolation-breach")).toBe(true);
    // The overlay does not mint a vocabulary version of its own (doc 3 §8).
    expect(view.ontology.version).toBe("0.1.0");
    expect(mod.readContent()).toHaveLength(1);
  });

  it("fails the build when a local term is not rooted in the core", async () => {
    const mod = await fixtureModule((root) => {
      trivialArchive(root);
      writeExtensions(root, TERM("    defaultWeight: 0.5"));
    });

    expect(() => mod.readContent()).toThrow(/ontology\/local-term-unrooted/);
    expect(() => mod.readContent()).toThrow(/content\/ontology\/extensions\.yaml/);
    expect(mod.contentOntologyDiagnostics().map((d) => d.severity)).toContain("error");
  });

  it("fails the build when a local term tries to extend the closed phase set", async () => {
    const mod = await fixtureModule((root) => {
      trivialArchive(root);
      writeExtensions(
        root,
        [
          'version: "0.1.0"',
          "terms:",
          "  - id: acme/rollout",
          "    kind: phase",
          "    label: Rollout",
          "    description: A sixth phase, which doc 3 §7 does not allow.",
          '    since: "0.1.0"',
        ].join("\n"),
      );
    });

    expect(() => mod.readContent()).toThrow(/ontology\/phase-not-extensible/);
  });

  it("warns, without failing, when a local marker carries no weight", async () => {
    const mod = await fixtureModule((root) => {
      trivialArchive(root);
      writeExtensions(root, TERM("    broader: isolation-breach"));
    });

    const diagnostics = mod.contentOntologyDiagnostics();
    expect(diagnostics.map((d) => d.code)).toContain("ontology/local-marker-unweighted");
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    // A warning is not fatal: doc 3 §7 gives the case a defined outcome (it counts 0).
    expect(mod.readContent()).toHaveLength(1);
  });

  it("throws on an extensions file that is not shaped like one", async () => {
    const mod = await fixtureModule((root) => {
      trivialArchive(root);
      writeExtensions(root, 'version: "0.1.0"\nterms:\n  - id: acme/x\n    kind: nonsense\n');
    });

    expect(() => mod.readContent()).toThrow(/kind `nonsense`/);
  });

  it("treats a missing extensions file as an archive that adds nothing", async () => {
    const mod = await fixtureModule(trivialArchive);
    expect(mod.contentOntologyDiagnostics()).toEqual([]);
    expect(mod.contentOntology().get("lupo/pii-handling")).toBeUndefined();
    expect(mod.readContent()).toHaveLength(1);
  });
});
