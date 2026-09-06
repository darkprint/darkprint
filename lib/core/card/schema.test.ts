import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { cardRef, parseCardRef, type NodeCard } from "./schema";

describe("cardRef", () => {
  it("joins id and version with @", () => {
    expect(cardRef("solver-a", "1.2.0")).toBe("solver-a@1.2.0");
  });

  it("leaves a namespaced id intact", () => {
    expect(cardRef("berti/solver-a", "0.1.0")).toBe("berti/solver-a@0.1.0");
  });
});

describe("parseCardRef round-trips", () => {
  const valid = [
    { id: "a", version: "1.0.0" },
    { id: "solver-a", version: "1.2.0" },
    { id: "solver-a-2", version: "0.0.1" },
    { id: "berti/solver-a", version: "1.2.0-beta.1" },
    { id: "ns2/x9", version: "10.20.30" },
    { id: "solver", version: "1.0.0+build.5" },
  ];

  it.each(valid)("$id@$version survives cardRef -> parseCardRef", ({ id, version }) => {
    expect(parseCardRef(cardRef(id, version))).toEqual({ id, version });
  });

  it("splits on the last @, so a stray one invalidates the ref", () => {
    expect(parseCardRef("solver-a@1.0.0@2.0.0")).toBeUndefined();
  });

  it("tolerates surrounding whitespace from hand-written DOT attributes", () => {
    expect(parseCardRef("  solver-a@1.2.0\n")).toEqual({ id: "solver-a", version: "1.2.0" });
  });
});

describe("parseCardRef rejections", () => {
  it.each([
    ["empty string", ""],
    ["whitespace only", "   "],
    ["no version — the §4 unpinned case", "solver-a"],
    ["trailing @ with no version", "solver-a@"],
    ["leading @ with no id", "@1.0.0"],
    ["empty both sides", "@"],
    ["double @", "solver-a@@1.0.0"],
    ["floating version", "solver-a@latest"],
    ["range instead of a pin", "solver-a@^1.0.0"],
    ["v prefix", "solver-a@v1.0.0"],
    ["uppercase id", "Solver-A@1.0.0"],
    ["underscore id", "solver_a@1.0.0"],
    ["trailing hyphen id", "solver-@1.0.0"],
    ["leading hyphen id", "-solver@1.0.0"],
    ["double hyphen id", "solver--a@1.0.0"],
    ["empty namespace", "/solver-a@1.0.0"],
    ["double slash namespace", "ns//solver-a@1.0.0"],
    ["nested namespace", "a/b/c@1.0.0"],
    ["space inside id", "solver a@1.0.0"],
    ["space inside version", "solver-a@1.0 .0"],
    ["dot in id", "solver.a@1.0.0"],
  ])("rejects %s", (_name, ref) => {
    expect(parseCardRef(ref)).toBeUndefined();
  });

  it("does not accept a ref that cardRef built from an illegal id", () => {
    expect(parseCardRef(cardRef("Solver A", "1.0.0"))).toBeUndefined();
  });
});

describe("NodeCard shape", () => {
  // Compile-time contract check: the minimal card of §4 with every default applied.
  const minimal: NodeCard = {
    id: "solver-a",
    name: "Solver A",
    type: "agent",
    // Doc 3 §1 makes `phase` a first-level dimension beside `type`, and doc 1 §3.2 makes
    // `spec` the payload the agent is handed. Neither is optional, so neither can be
    // absent from the minimal card.
    phases: ["implementation"],
    action: "Draft a candidate solution for the sub-task",
    spec: "Read the sub-task, draft one candidate solution, and return it as JSON on the draft port.",
    tools: [],
    // `mcp`, `cannot` and `willNot` default to `[]` on the wire and are required on the
    // model, the way `tools` and `risk_markers` are: an empty list is the answer for a node
    // that needs no server and declares no prohibition, and it is not an absent one.
    mcp: [],
    params: {},
    inputs: [{ name: "task", type: "text" }],
    outputs: [{ name: "draft", type: "json" }],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [],
    version: "1.0.0",
  };

  it("accepts the minimal card and refs it", () => {
    expect(cardRef(minimal.id, minimal.version)).toBe("solver-a@1.0.0");
    expect(parseCardRef(cardRef(minimal.id, minimal.version))).toEqual({
      id: "solver-a",
      version: "1.0.0",
    });
  });

  it("holds nested JSON in params", () => {
    const card: NodeCard = {
      ...minimal,
      params: { retries: 3, backoff: { kind: "exponential", factor: 1.5 }, tags: ["a", null] },
    };
    expect(JSON.parse(JSON.stringify(card.params))).toEqual(card.params);
  });

  it("carries the four fields the paradigm needs, with `skill` optional", () => {
    const card: NodeCard = {
      ...minimal,
      mcp: ["filesystem", "github"],
      skill: "skills/solver.md",
      cannot: ["acceptance-criteria"],
      willNot: ["never opens a shell"],
    };
    expect(card.mcp).toEqual(["filesystem", "github"]);
    expect(card.skill).toBe("skills/solver.md");
    /* The two prohibitions, in the two fields that decide what happens to them. This
       assertion used to hold BOTH of these strings in `cannot`, one array, with a comment
       explaining that the first names an ontology `data-type` the resolver checks and the
       second names no term and is read by a person. That comment was the whole defect: the
       type could not tell them apart, so a reader had to be told in prose which entry was
       which. Held apart here so the shape itself says it, and a regression that folded them
       back into one list would red on the array that lost a member rather than on a comment
       nobody compiles. */
    expect(card.cannot).toEqual(["acceptance-criteria"]);
    expect(card.willNot).toEqual(["never opens a shell"]);
    // `skill` is the only one of the four that may be absent.
    expect(minimal.skill).toBeUndefined();
  });

  it("keeps `mcp` and `tools` as separate questions", () => {
    // `tools` holds `tool` capability terms and says what the node may do; `mcp` names the
    // concrete servers that supply it. A node can carry either without the other, so the
    // two are never merged and neither implies the other.
    const serverOnly: NodeCard = { ...minimal, tools: [], mcp: ["filesystem"] };
    const capabilityOnly: NodeCard = { ...minimal, tools: ["file-io"], mcp: [] };
    expect(serverOnly.tools).toEqual([]);
    expect(capabilityOnly.mcp).toEqual([]);
  });
});

/* ============================================================
   The model-stylesheet precedence, spec §8.5
   ------------------------------------------------------------
   `components/spec/rows.test.ts` holds four surfaces to this
   claim, and it exists because every one of them shipped it
   backwards: a reversed precedence reads exactly as fluently as
   the right one and no gate could see it. The `model` docblock
   below is the FIFTH carrier and it was outside that guard, which
   matters more than the other four rather than less. It states
   the contract for the field, `scripts/skill-refs.ts` copies this
   file verbatim into `skills/darkprint/references/card-schema.md`,
   and that reference ships to strangers over
   `npx skills@latest add`, where nothing regenerates it.

   Held over the SOURCE, because a docblock is not a value any
   suite can import. The extraction takes the one comment attached
   to `model?: string;` and nothing else, so the paragraph that
   quotes the wrong reading in order to explain it is inside the
   guarded text on purpose: it is part of what the docblock says,
   and a checker that could not see it would be a checker no future
   correction could be written past.

   `node:fs` here, in `lib/core`. The isomorphic rule is about the
   modules that ship to the browser on `/upload`; a `.test.ts` is
   never bundled and vitest runs it under `environment: "node"`.
   `schema.ts` itself imports nothing and stays isomorphic.
   ============================================================ */

describe("the `model` docblock, and the direction spec §8.5 gives it", () => {
  /**
   * The comment attached to `model?: string;`, read off this file's own directory.
   *
   * `(?:(?!\*\/)[\s\S])*?` is what makes the match start at the LAST `/**` before the
   * field: a plain lazy wildcard would start at the first block comment in the file and
   * swallow every docblock between, which passes every assertion below on the strength of
   * paragraphs about other fields.
   */
  function modelDocblock(): string {
    const source = readFileSync(new URL("./schema.ts", import.meta.url), "utf8");
    const match = /\/\*\*(?:(?!\*\/)[\s\S])*?\*\/\n\s*model\?: string;/.exec(source);
    if (match === null) throw new Error("no docblock attached to `model?: string;`");
    return match[0];
  }

  it("is the model docblock and not the file", () => {
    // The premise every assertion below rests on. `spec` is the field immediately above
    // and `agent` the one immediately below, so their sentences appearing here would mean
    // the extraction had run away in one direction or the other.
    const text = modelDocblock();
    expect(text).toContain("llm_model");
    expect(text).not.toContain("non vede il resto del grafo");
    expect(text).not.toContain("A label the card's author chose");
    expect(text.length).toBeLessThan(3000);
  });

  it("cites §8.5, where the order is settled, and §8.3 beside it", () => {
    // §2.6's "Overridable by stylesheet" names the field and ranks it against nothing.
    // Citing it for the ranking is the move that produced the four reversed sentences, so
    // the sections that settle the question have to be named here.
    const text = modelDocblock();
    expect(text).toContain("§8.5");
    expect(text).toContain("§8.3");
  });

  it("says the explicit node attribute outranks the sheet", () => {
    expect(modelDocblock()).toMatch(
      /\bexplicit node attribute\b[^.]*\boutranks\b[^.]*\bsheet\b/i,
    );
  });

  it.each([
    // "a model_stylesheet outranks the field on the card"
    [/\b(model_)?stylesheets?\b[^.;]*\boutranks?\b[^.;]*\b(node|card|field|attribute|line)\b/i],
    // "the stylesheet overrides an explicit node attribute"
    [/\b(model_)?stylesheets?\b[^.;]*\boverrid\w*\b[^.;]*\b(node|card|field|attribute|line)\b/i],
    // "the sheet wins" in any of its spellings
    [/\b(stylesheet|sheet)\b[^.;]*\bwins\b/i],
  ])("carries no sentence putting the sheet above the node (%s)", (inverted) => {
    expect(modelDocblock()).not.toMatch(inverted);
  });
});
