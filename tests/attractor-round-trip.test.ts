/* ============================================================
   The round-trip gate: `import(export(b))` keeps the Attractor half
   of `b`, and everything it does not keep is named.

   Doc 1 §0.1.1 records a verdict — "the formats ARE compatible" —
   and until this file existed the evidence for it was that the
   emitter's own output satisfied the emitter's own linter. That is
   a claim about one direction checked by one author. A round trip
   is the two-sided version: a pipeline goes out through
   `emitAttractorDot`, comes back through `importAttractorDot`, goes
   out again, and every attribute an Attractor runner would have
   read is still there, unchanged, byte for byte as that runner
   would read it.

   ── "the Attractor half" is not this file's word ──
   `ATTRACTOR_EMITTED_ATTRIBUTES` is the mechanical definition, and
   it is published from `lib/core/attractor/emit.ts` for this gate
   to consume. Nothing here transcribes a list of names, so a name
   the emitter learns to write joins the comparison in the same edit
   and a name it stops writing leaves it. `round-trip.ts` holds the
   whole reduction.

   ── it is CORRECT for this gate to lose things ──
   The two formats are not the same size, and where DarkPrint
   genuinely cannot say what Attractor can, the honest answer is a
   named exception carrying the exact value and the reason — never a
   looser comparison. `corpus.ts`'s `losses` is that list, it is
   compared in both directions, and ten of the twelve pipelines
   have an empty one. A silent pass would be worse than a red,
   because the red is what tells somebody the claim has moved.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ATTRACTOR_NODE_ATTRIBUTES,
  ATTRACTOR_UNEXPRESSED_ATTRIBUTES,
  CORE_ONTOLOGY,
  DERIVED_PROVENANCE_PREFIX,
  attractorClassesFor,
  emitAttractorDot,
  hasErrors,
  importAttractorDot,
  isStorable,
  lintAttractor,
  loadBundle,
  ontologyView,
  parseDot,
  type Bundle,
  type LoadBundleResult,
  type ResolvedBlueprint,
} from "@/lib/core";
import { CORPUS, type CorpusEntry } from "./attractor-corpus/corpus";
import {
  attractorHalf,
  describeDifference,
  describeLoss,
  diffAttractorHalf,
  type Difference,
} from "./attractor-corpus/round-trip";

const CORPUS_DIR = "tests/attractor-corpus";
const BUNDLES_DIR = "public/bundles";
const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/**
 * The one difference the corpus does not enumerate, because it is checked instead.
 *
 * `emitAttractorDot` writes a `class` onto every carded node — the type chain and the
 * phases, `dp-` prefixed — and a foreign pipeline carries none, so every round trip of a
 * foreign file ADDS one. Listing that per node in `corpus.ts` would be forty-odd waivers
 * saying nothing, and a waiver would accept a WRONG class as readily as a right one.
 *
 * So the addition is proved rather than excused: the value has to equal the class list the
 * emitter derives from the card the import produced. That makes the added attribute a
 * consequence of the type that survived the trip, which is the thing actually under test.
 * A class naming a type the node did not come home as reds here.
 */
const CLASS_IS_DERIVED = "class";

interface RoundTrip {
  source: string;
  imported: ReturnType<typeof importAttractorDot>;
  loaded: LoadBundleResult;
  blueprint: ResolvedBlueprint;
  output: string;
}

function roundTrip(entry: CorpusEntry): RoundTrip {
  const source = readFileSync(join(CORPUS_DIR, entry.file), "utf8");
  const imported = importAttractorDot(source, { origin: entry.file, author: "corpus-runner" });
  const loaded = loadBundle({
    manifest: imported.manifest,
    dot: imported.dot,
    cardFiles: imported.cardFiles,
  });
  const blueprint = loaded.blueprint;
  /* A missing blueprint would make every comparison below vacuously empty, so the premise
     fails here, outside the assertions, naming the file. */
  if (blueprint === undefined) {
    throw new Error(
      `${entry.file} did not resolve into a blueprint at all: ` +
        loaded.diagnostics.map((d) => `${d.code} ${d.message}`).join("; "),
    );
  }
  return { source, imported, loaded, blueprint, output: emitAttractorDot(blueprint) };
}

/** The class differences, split off so the rest can be compared against the declared list. */
function partition(diff: readonly Difference[]): {
  classes: Difference[];
  rest: Difference[];
} {
  const classes: Difference[] = [];
  const rest: Difference[] = [];
  for (const d of diff) {
    const derived =
      d.scope === "node" && d.attribute === CLASS_IS_DERIVED && (d.kind === "added" || d.kind === "changed");
    if (derived) classes.push(d);
    else rest.push(d);
  }
  return { classes, rest };
}

describe("a pipeline survives export, import and export again", () => {
  it.each(CORPUS)("$file — $exercises", (entry) => {
    const { source, imported, blueprint, output } = roundTrip(entry);

    /* PREMISE. A comparison over an empty half is green against an importer that returns
       nothing, which is the shape a blind negative takes. Every file in this corpus has
       work nodes, so a half with none of them means the import stopped early. */
    const before = attractorHalf(source, entry.file);
    expect(before.nodes.size, `${entry.file} has no work nodes to compare`).toBeGreaterThan(0);
    expect(blueprint.graph.ids.length).toBe(before.nodes.size);

    const after = attractorHalf(output, `${entry.file} (re-exported)`);
    const { classes, rest } = partition(diffAttractorHalf(before, after));

    expect(
      rest.map(describeDifference).sort(),
      `${entry.file}: the differences the round trip actually has, against the ones ` +
        `corpus.ts declares. A new line here is a loss nobody has accounted for; a missing ` +
        `line is a declared loss that stopped happening and whose entry should go.`,
    ).toEqual(entry.losses.map(describeLoss).sort());

    /* The added classes, proved rather than excused — see CLASS_IS_DERIVED. */
    const cardByNode = new Map(imported.cards.map((c) => [c.nodeId, c.card]));
    for (const difference of classes) {
      const card = cardByNode.get(difference.at);
      expect(card, `${entry.file}: a class on \`${difference.at}\`, which imported no card`).toBeDefined();
      if (card === undefined) continue;
      expect(difference.to, `${entry.file}: the class on \`${difference.at}\``).toBe(
        attractorClassesFor(card, ONTOLOGY).join(","),
      );
    }
  });

  it.each(CORPUS)("$file — comes back out as a file Attractor's own rules accept", (entry) => {
    const { output } = roundTrip(entry);
    const parsed = parseDot(output, "factory.dot");
    expect(hasErrors(parsed.diagnostics), parsed.diagnostics.map((d) => d.message).join("; ")).toBe(
      false,
    );
    if (parsed.graph === undefined) throw new Error("the re-export did not parse");
    /* The publish gate's own test (`lib/server/export/build.ts`'s `checkFactoryDot`), so a
       file this corpus produces is one the site would let out of the door. */
    expect(lintAttractor(parsed.graph, output, "factory.dot")).toEqual([]);
  });
});

describe("what the round trip loses, named rather than discovered", () => {
  it("drops every reserved name a DarkPrint blueprint has no field for", () => {
    /* `runner-only.dot` carries one of each, and the disclosure header `emitAttractorDot`
       writes says they are dropped. This is where that sentence is checked instead of
       believed. The names come from `ATTRACTOR_UNEXPRESSED_ATTRIBUTES`, which is derived
       from the reserved sets minus what the emitter writes — so the day the emitter learns
       to carry one, it leaves that list and leaves this assertion in the same edit. */
    const entry = CORPUS.find((e) => e.file === "runner-only.dot");
    if (entry === undefined) throw new Error("runner-only.dot left the corpus");
    const { source, output } = roundTrip(entry);

    const parsedIn = parseDot(source, entry.file);
    const parsedOut = parseDot(output, "factory.dot");
    if (parsedIn.graph === undefined || parsedOut.graph === undefined) {
      throw new Error("the corpus file or its re-export did not parse");
    }

    const outNodes = parsedOut.graph.nodes;
    const outEdges = parsedOut.graph.edges;
    let checked = 0;
    for (const name of ATTRACTOR_UNEXPRESSED_ATTRIBUTES.graph) {
      if (!(name in parsedIn.graph.graphAttrs)) continue;
      checked += 1;
      expect(name in parsedOut.graph.graphAttrs, `graph \`${name}\` survived the round trip`).toBe(false);
    }
    for (const name of ATTRACTOR_UNEXPRESSED_ATTRIBUTES.node) {
      if (!parsedIn.graph.nodes.some((n) => name in n.attrs)) continue;
      checked += 1;
      expect(outNodes.some((n) => name in n.attrs), `node \`${name}\` survived the round trip`).toBe(
        false,
      );
    }
    for (const name of ATTRACTOR_UNEXPRESSED_ATTRIBUTES.edge) {
      if (!parsedIn.graph.edges.some((e) => name in e.attrs)) continue;
      checked += 1;
      expect(outEdges.some((e) => name in e.attrs), `edge \`${name}\` survived the round trip`).toBe(
        false,
      );
    }
    /* A fixture that carried none of them would make every assertion above vacuous and the
       cell would read as coverage. Twenty is the number `runner-only.dot` was written to
       carry; the floor is what makes the zeroes above mean something. */
    expect(checked, "runner-only.dot stopped carrying the attributes it exists to carry").toBeGreaterThanOrEqual(
      20,
    );
  });

  it("holds back the node `type` override rather than dropping it by accident", () => {
    /* The one reserved name `emit.ts` withholds ON PURPOSE: a DarkPrint node's type arrives
       as its `shape`, and a `type` here would override the handler the shape just selected.
       So it is absent from the re-export AND absent from the unexpressed list, and this
       cell is the only place both halves of that are stated together. */
    const entry = CORPUS.find((e) => e.file === "runner-only.dot");
    if (entry === undefined) throw new Error("runner-only.dot left the corpus");
    const { source, output } = roundTrip(entry);

    expect(source).toContain('type="codergen"');
    expect(ATTRACTOR_NODE_ATTRIBUTES).toContain("type");
    expect(ATTRACTOR_UNEXPRESSED_ATTRIBUTES.node).not.toContain("type");

    const parsedOut = parseDot(output, "factory.dot");
    if (parsedOut.graph === undefined) throw new Error("the re-export did not parse");
    expect(parsedOut.graph.nodes.some((n) => "type" in n.attrs)).toBe(false);
  });

  it("loses the subgraphs, and with them the classes §2.10 would have derived", () => {
    /* DarkPrint's parser flattens a subgraph and keeps its members; nothing records that
       they were grouped, and the emitter writes no subgraph at all. Attractor derives a
       node's class from the label of the subgraph it sits in, so a stylesheet rule written
       against `writing` matches nothing after a round trip. Every node survives, which is
       what makes this a loss of STRUCTURE rather than of work. */
    const entry = CORPUS.find((e) => e.file === "subgraph-classes.dot");
    if (entry === undefined) throw new Error("subgraph-classes.dot left the corpus");
    const { source, imported, output } = roundTrip(entry);

    expect(source).toContain("subgraph cluster_writing");
    /* A `subgraph` STATEMENT, not the word: this pipeline is called `subgraph_classes`, so
       a substring check passes on the graph's own name and would have reported the loss
       whether or not it happened. */
    const STATEMENT = /\bsubgraph[\s{]/;
    expect(source).toMatch(STATEMENT);
    expect(output).not.toMatch(STATEMENT);
    expect(imported.dot).not.toMatch(STATEMENT);
    expect(imported.cards.map((c) => c.nodeId).sort()).toEqual(["draft", "facts", "outline"]);
    /* And the classes it does carry name the type, never the group. Stated so the loss is
       not confused with the class the emitter adds for its own reasons. */
    for (const card of imported.cards) {
      expect(attractorClassesFor(card.card, ONTOLOGY)).not.toContain("dp-writing");
    }
  });

  it("cannot tell a validation node from an agent, or a human-input from a human-gate", () => {
    /* Six DarkPrint types share three shapes and Attractor stores nothing that separates
       the members of a pair — both select the same handler. A file that came out of
       DarkPrint says which it meant in its `class` and comes home unchanged; a foreign file
       has no class and takes the first row. `human-gates.dot`'s second hexagon was written
       as a `human-input` in prose and arrives as a `human-gate`, which is the loss. */
    const entry = CORPUS.find((e) => e.file === "human-gates.dot");
    if (entry === undefined) throw new Error("human-gates.dot left the corpus");
    const { imported } = roundTrip(entry);
    const types = new Map(imported.cards.map((c) => [c.nodeId, c.card.type]));
    expect(types.get("approve")).toBe("human-gate");
    expect(types.get("collect")).toBe("human-gate");

    /* The other direction, which is what makes the loss a property of the FILE and not of
       the importer: the same shape with the class DarkPrint writes comes home correctly. */
    const withClass = importAttractorDot(
      'digraph d {\n  a [label="A", shape=hexagon, prompt="Ask.", class="dp-human-input"];\n}\n',
      { origin: "inline", author: "corpus-runner" },
    );
    expect(withClass.cards[0]?.card.type).toBe("human-input");
  });
});

describe("a DarkPrint bundle comes home byte for byte", () => {
  /* The strongest form of the gate, and the one the compatibility claim is actually about:
     for a bundle DarkPrint published, `export(import(export(b)))` is the same FILE as
     `export(b)` — not the same Attractor half, the same bytes. Nothing is normalised away
     and no exception list is consulted, so there is nowhere for a difference to hide.

     One line differs by construction and is removed: the header's blueprint digest. The
     imported cards are not the published cards — they carry no ports, no dependencies, a
     `provenance` and an `author` — so the bundle's digest moves, and it is supposed to. */
  const slugs = readdirSync(BUNDLES_DIR).filter((name) =>
    readdirSync(join(BUNDLES_DIR, name)).includes("topology.dot"),
  );

  it("has the nine shipped bundles to run over", () => {
    // A `readdirSync` that came back empty would make every cell below vanish silently.
    expect(slugs.length).toBeGreaterThanOrEqual(9);
  });

  it.each(slugs)("%s", (slug) => {
    const dir = join(BUNDLES_DIR, slug);
    const cardFiles: Record<string, string> = {};
    for (const name of readdirSync(join(dir, "cards"))) {
      cardFiles[`cards/${name}`] = readFileSync(join(dir, "cards", name), "utf8");
    }
    const bundle: Bundle = {
      manifest: { slug, title: slug, summary: `The ${slug} blueprint.`, tags: [] },
      dot: readFileSync(join(dir, "topology.dot"), "utf8"),
      cardFiles,
    };

    const first = loadBundle(bundle);
    if (first.blueprint === undefined) throw new Error(`${slug} did not resolve`);
    const exported = emitAttractorDot(first.blueprint);

    const imported = importAttractorDot(exported, { origin: `${slug}.dot`, author: "corpus-runner" });
    const second = loadBundle({
      manifest: imported.manifest,
      dot: imported.dot,
      cardFiles: imported.cardFiles,
    });
    if (second.blueprint === undefined) throw new Error(`${slug} did not resolve after the import`);

    expect(withoutDigest(emitAttractorDot(second.blueprint))).toBe(withoutDigest(exported));

    /* And the DarkPrint side, which the byte comparison above cannot see. Six types share
       three shapes, so a `validation` node that came home as an `agent` would draw the same
       `shape=box`, emit the same bytes and score differently — the `class` the emitter
       writes is the only thing that separates them, and this is the assertion that makes it
       load-bearing rather than decorative. Deleting the class emission reddens nothing above
       and reddens this. */
    const before = new Map(first.blueprint.nodes.map((n) => [n.nodeId, n.card.type]));
    const after = new Map(second.blueprint.nodes.map((n) => [n.nodeId, n.card.type]));
    expect(after).toEqual(before);
    expect(new Set(before.values()).size).toBeGreaterThan(1);

    /* The phases travel on the same attribute and are lost the same way, silently. */
    const phasesBefore = new Map(first.blueprint.nodes.map((n) => [n.nodeId, n.card.phases.join(",")]));
    const phasesAfter = new Map(second.blueprint.nodes.map((n) => [n.nodeId, n.card.phases.join(",")]));
    expect(phasesAfter).toEqual(phasesBefore);
    expect([...phasesBefore.values()].some((p) => p !== "")).toBe(true);
  });
});

function withoutDigest(dot: string): string {
  return dot
    .split("\n")
    .filter((line) => !line.startsWith("// Blueprint digest:"))
    .join("\n");
}

describe("an import is a draft, and it says whose", () => {
  it("marks every synthesised card DERIVED and names where the prose came from", () => {
    const entry = CORPUS.find((e) => e.file === "conditional-routing.dot");
    if (entry === undefined) throw new Error("conditional-routing.dot left the corpus");
    const { imported } = roundTrip(entry);

    expect(imported.cards.length).toBeGreaterThan(0);
    for (const { card } of imported.cards) {
      expect(card.author).toBe("corpus-runner");
      expect(card.provenance).toBe(`${DERIVED_PROVENANCE_PREFIX} conditional-routing.dot`);
      /* A version nobody would publish by reflex. §4 makes a published version immutable,
         and the first thing this draft needs is to be edited. */
      expect(card.version).toBe("0.1.0");
    }
    /* The prose is carried and not paraphrased: a `prompt` is somebody's writing, and the
       whole reason the two attribution fields exist is that this string is theirs. */
    const classify = imported.cards.find((c) => c.nodeId === "classify");
    expect(classify?.card.spec).toBe(
      "Read the ticket and score your confidence between 0 and 1.",
    );
  });

  it("refuses to compile a foreign file into cards with nobody's name on them", () => {
    const source = readFileSync(join(CORPUS_DIR, "minimal.dot"), "utf8");
    expect(() => importAttractorDot(source, { origin: "minimal.dot", author: "  " })).toThrow(
      /author/,
    );
  });

  it("is STORABLE and not APPROVED, which is the whole of `gate.ts` in one bundle", () => {
    /* An imported draft carries no ports on any card, so every edge in it raises
       `bundle/port-mismatch` at error severity. Under `hasErrors` that folder is
       "rejected". Under the named blocking set it parses, it is addressable and it is
       attributable, so it may be held — and what is wrong with it is a reading, published
       beside it rather than in place of it. The two answers differ here, on a real bundle,
       which is what makes the separation something other than a refactor. */
    const entry = CORPUS.find((e) => e.file === "conditional-routing.dot");
    if (entry === undefined) throw new Error("conditional-routing.dot left the corpus");
    const { loaded } = roundTrip(entry);

    expect(hasErrors(loaded.diagnostics)).toBe(true);
    expect(isStorable(loaded.diagnostics)).toBe(true);
  });
});

describe("the instrument itself", () => {
  const before = readFileSync(join(CORPUS_DIR, "minimal.dot"), "utf8");

  it("reports a difference when one is planted", () => {
    /* A comparison that reds on nothing is a comparison nobody can trust, and every cell
       above is a green over a diff. This plants one change in each of the three scopes and
       requires all three to be found. */
    const half = attractorHalf(before, "before");
    const changed = attractorHalf(
      before
        .replace('goal="Answer one question and stop."', 'goal="Something else."')
        .replace('label="Answer"', 'label="Different"')
        .replace("start -> answer;", 'start -> answer [label="wired"];'),
      "after",
    );
    const diff = diffAttractorHalf(half, changed).map(describeDifference);
    expect(diff).toHaveLength(3);
    expect(diff.join("\n")).toContain("changed on graph `goal`");
    expect(diff.join("\n")).toContain("changed on node `answer` `label`");
    expect(diff.join("\n")).toContain("added on edge `<start> -> answer` `label`");
  });

  it("looks at the reserved half and nothing else", () => {
    /* `card` and `dp_node` are DarkPrint's own and Attractor ignores them, so they have to
       be invisible to this comparison — otherwise every round trip of a foreign file would
       red on the pin the export adds, and the exception list would grow a waiver that hides
       real differences behind it. */
    const withPrivate = before.replace(
      'shape=box, prompt=',
      'shape=box, card="answer@1.0.0", dp_node="Answer!", prompt=',
    );
    expect(withPrivate).not.toBe(before);
    expect(diffAttractorHalf(attractorHalf(before, "a"), attractorHalf(withPrivate, "b"))).toEqual([]);
  });

  it("sees a difference the boundary normalisation could have swallowed", () => {
    /* The normalisation exists so a `start` and a `__start` compare equal. It must not also
       make two DIFFERENT work nodes compare equal, which is what a normalisation applied
       one step too widely would do. */
    const renamed = before.replace(/answer/g, "reply");
    const diff = diffAttractorHalf(attractorHalf(before, "a"), attractorHalf(renamed, "b"));
    expect(diff.map((d) => d.kind).sort()).toEqual(["edge-added", "edge-added", "edge-dropped", "edge-dropped", "node-added", "node-dropped"]);
  });
});
