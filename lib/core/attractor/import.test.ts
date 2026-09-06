/* ============================================================
   The importer, unit by unit.

   `tests/attractor-round-trip.test.ts` is where the two directions
   are held to inverting each other over a corpus, and it is the
   real gate. This file is the other half of that pair: the pieces
   the gate composes, driven directly, so that a round trip failing
   points at one of these rather than at "something in the middle".

   Two of them are worth naming before the cells. The reverse
   mapping table is DERIVED from `emit.ts`'s, and the cells here
   check the derivation against the forward table rather than
   against a transcription — a hand-written expectation would be a
   second copy of the thing that is not allowed to have one.
   `unquoteAttractorString` is the half of Attractor's `String` rule
   that DarkPrint's Graphviz-compatible lexer does not apply, and
   every one of its cells is a case where a chain of `replace` calls
   would give a different, wrong answer.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  ATTRACTOR_TYPE_SHAPES,
  attractorClassName,
} from "./emit";
import {
  ATTRACTOR_SHAPE_TYPES,
  DERIVED_PROVENANCE_PREFIX,
  DRAFT_CARD_VERSION,
  attractorTypeFor,
  importAttractorDot,
  unquoteAttractorString,
} from "./import";

const OPTIONS = { origin: "somewhere.dot", author: "mara-veil" };

/** The importer over a source written inline, which is how most cells here are driven. */
function importing(dot: string) {
  return importAttractorDot(dot, OPTIONS);
}

describe("Attractor's String rule, the half the lexer does not apply", () => {
  it.each([
    { name: "a line feed", input: "a\\nb", expected: "a\nb" },
    { name: "a tab", input: "a\\tb", expected: "a\tb" },
    { name: "a backslash", input: "a\\\\b", expected: "a\\b" },
    { name: "nothing to do", input: "plain text", expected: "plain text" },
  ])("$name", ({ input, expected }) => {
    expect(unquoteAttractorString(input)).toBe(expected);
  });

  it("consumes an escaped backslash whole, so `\\\\n` is not a line feed", () => {
    /* The case a chain of `replace` calls gets wrong. `\\n` is an escaped backslash
       followed by the letter n; running a `\n` → line feed pass first turns it into a
       backslash and a line feed, which is a different string. One left-to-right scan is the
       only reading that cannot do that, and this is the cell that would catch a rewrite. */
    expect(unquoteAttractorString("a\\\\nb")).toBe("a\\nb");
    expect(unquoteAttractorString("a\\\\tb")).toBe("a\\tb");
  });

  it("leaves a backslash Attractor's rule cannot express exactly where it stands", () => {
    /* `\q` is not one of the four escapes, so the rule has no interpretation for it and
       inventing one would edit somebody's condition expression on the way past. A trailing
       backslash is the same case at the end of the string. */
    expect(unquoteAttractorString("a\\qb")).toBe("a\\qb");
    expect(unquoteAttractorString("trailing\\")).toBe("trailing\\");
  });
});

describe("the reverse mapping table", () => {
  it("accounts for every row of the forward table and invents none", () => {
    /* Derived, so this compares the derivation against its source rather than against a
       list somebody typed. A tenth row added to `emit.ts` joins both sides here at once,
       which is the whole reason the table is not written out twice. */
    const forward = Object.entries(ATTRACTOR_TYPE_SHAPES);
    const flattened = Object.entries(ATTRACTOR_SHAPE_TYPES).flatMap(([shape, types]) =>
      types.map((type) => [type, shape] as const),
    );
    expect(flattened.map(([type, shape]) => `${type}=${shape}`).sort()).toEqual(
      forward.map(([type, kind]) => `${type}=${kind.shape}`).sort(),
    );
  });

  it("keeps the declaration order inside a shape, which is what the fallback picks", () => {
    // Five types share two shapes and the first of each row is what a foreign file gets.
    expect(ATTRACTOR_SHAPE_TYPES.box).toEqual(["agent", "tool", "validation"]);
    expect(ATTRACTOR_SHAPE_TYPES.hexagon).toEqual(["human-gate", "human-input"]);
  });

  it("gives `parallelogram` a row, so an imported tool node is not silently downgraded", () => {
    /* The reverse table is DERIVED from `ATTRACTOR_TYPE_SHAPES`, so a shape no forward row
       emits has no reverse row and `attractorTypeFor` answers `undefined` — which the
       caller reports and then types as `agent`. `tool` moved to `box` when §4.10 made a
       parallelogram with no `tool_command` a node that FAILs on sight, and without the
       `shell-tool` row moving it would have taken `parallelogram` with it: every genuine
       Attractor tool node would have come in as an agent and gone back out as a box, with
       the command dropped in between. */
    expect(ATTRACTOR_SHAPE_TYPES.parallelogram).toEqual(["shell-tool"]);
    expect(ATTRACTOR_TYPE_SHAPES["shell-tool"].handler).toBe("tool");
  });

  it("resolves a shared shape by the class DarkPrint writes, and falls back without one", () => {
    expect(attractorTypeFor("box", [])).toBe("agent");
    expect(attractorTypeFor("box", [attractorClassName("validation")])).toBe("validation");
    expect(attractorTypeFor("hexagon", [])).toBe("human-gate");
    expect(attractorTypeFor("hexagon", [attractorClassName("human-input")])).toBe("human-input");
    /* A class naming the OTHER member of a different pair must not win: the shape decides
       the family and the class only picks inside it. */
    expect(attractorTypeFor("box", [attractorClassName("human-input")])).toBe("agent");
  });

  it("answers `undefined` for a shape no row emits", () => {
    expect(attractorTypeFor("ellipse", [])).toBeUndefined();
    expect(attractorTypeFor("", [])).toBeUndefined();
    expect(attractorTypeFor("parallelogram", [])).toBe("shell-tool");
  });
});

describe("the boundary", () => {
  it("drops the synthesised start and exit, by shape and by id alike", () => {
    /* Attractor resolves the boundary two ways (§3.2, §4.4) and both are dropped: a node
       called `end` IS the pipeline's exit as far as a runner is concerned, whatever
       DarkPrint would have called it. */
    const result = importing(
      `digraph d {\n` +
        `  __start [label="start", shape=${ATTRACTOR_ENTRY_KIND.shape}];\n` +
        `  work [label="W", shape=box, prompt="Do the work."];\n` +
        `  end [label="done", shape=box, prompt="This is the exit by name."];\n` +
        `  __exit [label="exit", shape=${ATTRACTOR_EXIT_KIND.shape}];\n` +
        `  __start -> work;\n  work -> end;\n  end -> __exit;\n}\n`,
    );
    expect(result.cards.map((c) => c.nodeId)).toEqual(["work"]);
    expect(result.dot).not.toContain("__start");
    expect(result.dot).not.toContain("__exit");
  });

  it("says which boundary node had prose on it, since that prose is dropped", () => {
    const result = importing(
      'digraph d {\n  start [label="start", shape=Mdiamond, prompt="Set the scene."];\n' +
        '  work [label="W", shape=box, prompt="Do the work."];\n  start -> work;\n}\n',
    );
    const said = result.diagnostics.find((d) => d.message.includes("`start`"));
    expect(said?.severity).toBe("warning");
    expect(said?.message).toContain("prompt");
  });
});

describe("a node it cannot type", () => {
  it("reports it and imports it as an agent, rather than crashing or dropping it", () => {
    const result = importing(
      'digraph d {\n  odd [label="Odd", shape=ellipse, prompt="Do something unusual."];\n}\n',
    );
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].card.type).toBe("agent");
    const said = result.diagnostics.find((d) => d.message.includes("ellipse"));
    expect(said?.severity).toBe("warning");
    /* The hint names the shapes that DO map, from the derived table, so a reader is told
       what to write instead without opening this repository. */
    expect(said?.hint).toContain("parallelogram");
  });

  it("reports a node with no shape at all as a guess", () => {
    const result = importing('digraph d {\n  bare [label="Bare", prompt="Work."];\n}\n');
    expect(result.diagnostics.some((d) => d.message.includes("no `shape`"))).toBe(true);
    expect(result.cards[0].card.type).toBe("agent");
  });
});

describe("what a card comes back carrying", () => {
  const result = importing(
    'digraph pipeline {\n' +
      '  goal="Ship the thing.";\n  label="A pipeline";\n' +
      '  work [label="Do the work", shape=box, prompt="Write the code.", llm_model="claude-opus-5", max_retries=4, class="dp-validation,dp-testing"];\n' +
      "}\n",
  );
  const card = result.cards[0].card;

  it("takes the prompt as the spec and the label as the name", () => {
    expect(card.spec).toBe("Write the code.");
    expect(card.name).toBe("Do the work");
  });

  it("takes the model, the cap and the type the class disambiguated", () => {
    expect(card.model).toBe("claude-opus-5");
    /* `max_iterations` and not `max_retries`, because it is the first of
       `ITERATION_CAP_KEYS` and therefore the one `readIterationCap` and the security
       analyzer both find. */
    expect(card.params).toEqual({ max_iterations: 4 });
    expect(card.type).toBe("validation");
    expect(card.phases).toEqual(["testing"]);
  });

  it("reads the class list as §2.12 comma-separates it, spaces around the comma included", () => {
    /* Both halves matter and they fail differently. A comma-separated list read on
       whitespace is ONE class named `dp-validation,dp-testing`, which disambiguates
       nothing — the node comes home as `agent` with no phase. A hand-written
       `class="a, b"` read on the comma alone leaves ` b`, which §8.2's
       `ClassName ::= [a-z0-9-]+` cannot spell, so the phase is silently dropped. */
    const spaced = importing(
      'digraph p {\n  work [shape=box, prompt="Write the code.", class="dp-validation, dp-testing"];\n}\n',
    ).cards[0].card;
    expect(spaced.type).toBe("validation");
    expect(spaced.phases).toEqual(["testing"]);

    /* A space-SEPARATED list is not a list at all under §2.12, and reading it as one would
       put the old defect back: this is the cell that reds if the splitter widens to
       whitespace again. */
    const invalid = importing(
      'digraph p {\n  work [shape=box, prompt="Write the code.", class="dp-validation dp-testing"];\n}\n',
    ).cards[0].card;
    expect(invalid.type).toBe("agent");
    expect(invalid.phases).toEqual([]);
  });

  it("brings a `tool_command` home as `params.tool_command`, under the key `emit.ts` reads", () => {
    /* The only thing a genuine §4.10 node carries, and the round trip claims to lose
       nothing a runner reads. `params` and not a top-level field, because that is where
       `emit.ts` looks for it — the two directions have to agree on the key or the command
       is dropped on the way back out while the folder still appears to hold it. */
    const tool = importing(
      'digraph p {\n  build [label="Build", shape=parallelogram, tool_command="make -j4 test"];\n}\n',
    ).cards[0].card;
    expect(tool.type).toBe("shell-tool");
    expect(tool.action).toBe(ATTRACTOR_TYPE_SHAPES["shell-tool"].handler);
    expect(tool.params).toEqual({ tool_command: "make -j4 test" });

    // An empty one carries nothing: §4.10 FAILs on it, so there is no command to keep.
    const empty = importing(
      'digraph p {\n  build [shape=parallelogram, prompt="Build.", tool_command="  "];\n}\n',
    ).cards[0].card;
    expect(empty.params).toEqual({});
  });

  it("reads the action off the shape, which is the only thing the pipeline said it does", () => {
    // The Attractor handler the shape selects. Not the label, which is a name, and not
    // something invented — those are the only three options and two of them say nothing.
    expect(card.action).toBe(ATTRACTOR_TYPE_SHAPES.validation.handler);
  });

  it("leaves the DarkPrint half empty, because no pipeline has ever carried it", () => {
    expect(card.inputs).toEqual([]);
    expect(card.outputs).toEqual([]);
    expect(card.dependencies).toEqual([]);
    expect(card.cannot).toEqual([]);
    expect(card.willNot).toEqual([]);
    expect(card.riskMarkers).toEqual([]);
  });

  it("names who brought it and where the prose came from", () => {
    expect(card.author).toBe("mara-veil");
    expect(card.provenance).toBe(`${DERIVED_PROVENANCE_PREFIX} somewhere.dot`);
    expect(card.version).toBe(DRAFT_CARD_VERSION);
  });

  it("takes the manifest from the graph's own attributes", () => {
    expect(result.manifest.slug).toBe("pipeline");
    expect(result.manifest.title).toBe("A pipeline");
    expect(result.manifest.summary).toBe("Ship the thing.");
  });
});

describe("identity", () => {
  it("translates a node id onto the card id grammar", () => {
    /* Attractor's Identifier rule wants `spec_planner` and a card id wants `spec-planner`,
       and the two are incompatible for every multi-word name. This is `emit.ts`'s
       translation run backwards. */
    const result = importing('digraph d {\n  spec_planner [shape=box, prompt="Plan."];\n}\n');
    expect(result.cards[0].ref).toBe(`spec-planner@${DRAFT_CARD_VERSION}`);
    expect(result.cards[0].file).toBe(`cards/spec-planner@${DRAFT_CARD_VERSION}.yaml`);
  });

  it("keeps the pin a DarkPrint file already carries, version and all", () => {
    const result = importing(
      'digraph d {\n  n [shape=box, prompt="Work.", card="berti/solver-a@2.3.1"];\n}\n',
    );
    expect(result.cards[0].ref).toBe("berti/solver-a@2.3.1");
    expect(result.cards[0].card.version).toBe("2.3.1");
  });

  it("writes one document for two nodes that instantiate one card", () => {
    /* Ordinary in DarkPrint: `resolveBundle` counts each node separately and the bundle
       digest counts the card twice. Two documents under one name would be two answers to
       `bundle/digest-mismatch`'s question. */
    const result = importing(
      'digraph d {\n  a [shape=box, prompt="Work.", card="solver@1.0.0"];\n' +
        '  b [shape=box, prompt="Work.", card="solver@1.0.0"];\n  a -> b;\n}\n',
    );
    expect(Object.keys(result.cardFiles)).toEqual(["cards/solver@1.0.0.yaml"]);
    expect(result.dot.match(/card="solver@1\.0\.0"/g)).toHaveLength(2);
  });

  it("tells two nodes apart when their ids collapse onto one card id", () => {
    const result = importing(
      'digraph d {\n  a_b [shape=box, prompt="One."];\n  a__b [shape=box, prompt="Two."];\n}\n',
    );
    expect(result.cards.map((c) => c.ref).sort()).toEqual([
      `a-b-2@${DRAFT_CARD_VERSION}`,
      `a-b@${DRAFT_CARD_VERSION}`,
    ]);
  });
});

describe("the refusals and the reports", () => {
  it("refuses to compile anything without a name to attach it to", () => {
    const source = 'digraph d {\n  a [shape=box, prompt="Work."];\n}\n';
    expect(() => importAttractorDot(source, { origin: "x", author: "" })).toThrow(/author/);
    expect(() => importAttractorDot(source, { origin: "x", author: "   " })).toThrow(/author/);
  });

  it("hands back an empty draft and the parser's own complaint for a file that is not a graph", () => {
    const result = importing("this is not a graph\n");
    expect(result.cards).toEqual([]);
    expect(result.dot).toBe("");
    /* The parser's diagnostics, unaltered: a second opinion about why a file did not parse
       would be a second author on one sentence. */
    expect(result.diagnostics.some((d) => d.code === "dot/parse-error")).toBe(true);
  });

  it("drops a `max_retries` that is not a whole number, and says so", () => {
    /* `readIterationCap` would refuse it anyway, so carrying it would leave a params key
       holding a cap nothing reads — which is a cap an author thinks they have. */
    const result = importing(
      'digraph d {\n  a [shape=box, prompt="Work.", max_retries="lots"];\n}\n',
    );
    expect(result.cards[0].card.params).toEqual({});
    expect(result.diagnostics.some((d) => d.message.includes("max_retries=lots"))).toBe(true);
  });

  it("drops an edge value no DOT string reads back unchanged, rather than writing a lie", () => {
    /* A backslash immediately before a quote has no spelling DarkPrint's lexer returns
       intact: `\` `\` `"` gives it an escaped backslash and then an unterminated string.
       Carrying the value anyway would break the one guarantee the round trip is about. */
    const result = importing(
      'digraph d {\n  a [shape=box, prompt="One."];\n  b [shape=box, prompt="Two."];\n' +
        '  a -> b [condition="path == \\"c:\\\\\\\\\\""];\n}\n',
    );
    const said = result.diagnostics.find((d) => d.message.includes("cannot carry"));
    expect(said?.severity).toBe("warning");
    expect(result.dot).not.toContain("condition=");
  });

  it("carries an ordinary condition through untouched", () => {
    // The control for the cell above: the refusal must be about the one unencodable shape
    // and not about conditions in general.
    const result = importing(
      'digraph d {\n  a [shape=box, prompt="One."];\n  b [shape=box, prompt="Two."];\n' +
        '  a -> b [condition="score >= 0.8", label="sure", weight=3];\n}\n',
    );
    expect(result.diagnostics.filter((d) => d.message.includes("cannot carry"))).toEqual([]);
    expect(result.dot).toContain('condition="score >= 0.8"');
    expect(result.dot).toContain('label="sure"');
    expect(result.dot).toContain('weight="3"');
  });
});
