/* ============================================================
   The generated references do not drift
   `skills/darkprint/references/*.md` ships to strangers over
   `npx skills@latest add Brotherhood94/darkprint`, which does a
   shallow git clone and reads files off it. It never runs npm, so
   whatever is committed IS what an installer gets — a stale
   reference is not a build artefact anybody regenerates, it is the
   documentation.

   This is a stronger guard than `bundle-equivalence.test.ts`, which
   pins digests of in-memory bundles: it compares the committed
   bytes on disk against what the generator produces today, so
   adding a term to the ontology or a key to the validator fails
   here until `npm run generate:skill-refs` has been run and the
   result committed.
   ============================================================ */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { BUMP_LEVELS, BUMP_PRICING, GENERATED_REFS, absolutePathOf } from "./skill-refs.ts";
import { CARD_KNOWN_KEYS, CORE_ONTOLOGY, inferBump, type NodeCard } from "@/lib/core";

describe("the skill's generated references", () => {
  for (const ref of GENERATED_REFS) {
    it(`${ref.path} matches its generator`, () => {
      const committed = readFileSync(absolutePathOf(ref), "utf8");
      const rendered = ref.render();
      // Compared as whole strings rather than line by line: the failure output is long,
      // and the fix is one command either way.
      expect(
        committed === rendered,
        `${ref.path} is stale. Run \`npm run generate:skill-refs\` and commit the result.`,
      ).toBe(true);
    });
  }

  /**
   * The point of generating at all, asserted directly.
   *
   * A generator can render from the runtime value and still print a table nobody's term
   * appears in — a filter typo, a `kind` renamed. These two checks say the shipped
   * reference names every term the validator will resolve and every key it will accept,
   * which is the promise the skill makes to an author writing a card by hand.
   *
   * Both look for the term in the **structure that carries it** — a table row for a term,
   * a list bullet for a key — and not merely somewhere in the document. Anywhere-in-the-
   * document was the obvious reading and it was shielded: 28 of the 49 term ids are also
   * named in the hand-written prose around the tables (`unvalidated-external-access`
   * excludes ``git``, ``vector-store``, ``shell``…), so dropping one of those from
   * `byKind` deleted its row, regenerated a file that matched its own generator, and
   * passed here on the strength of a sentence that merely mentions it. Measured: a filter
   * skipping `vector-store` left the tool table at eleven rows and this suite green.
   */
  it("names every ontology term and every accepted card key", () => {
    const ontology = GENERATED_REFS.find((r) => r.path.endsWith("ontology.md"));
    const schema = GENERATED_REFS.find((r) => r.path.endsWith("card-schema.md"));
    expect(ontology).toBeDefined();
    expect(schema).toBeDefined();

    // Every kind renders its terms as one table whose first cell is the id, so one row
    // shape covers phases, node types, risk markers, data types and tools alike.
    const ontologyRows = new Set(
      ontology!
        .render()
        .split("\n")
        .map((line) => /^\| `([^`]+)` \|/.exec(line)?.[1])
        .filter((id): id is string => id !== undefined),
    );
    const missingTerms = CORE_ONTOLOGY.terms
      .map((t) => t.id)
      .filter((id) => !ontologyRows.has(id));
    expect(missingTerms).toEqual([]);

    const schemaBullets = new Set(
      schema!
        .render()
        .split("\n")
        .map((line) => /^- `([^`]+)`$/.exec(line)?.[1])
        .filter((key): key is string => key !== undefined),
    );
    const missingKeys = [...CARD_KNOWN_KEYS].filter((k) => !schemaBullets.has(k));
    expect(missingKeys).toEqual([]);
  });
});

/* ============================================================
   The version-pricing table says what `inferBump` does
   ------------------------------------------------------------
   The drift test above cannot see a wrong sentence in generator
   prose: the committed file matches the generator by construction.
   The pricing used to be one such sentence, and it priced a changed
   `params` value as major when the code prices it patch. So every
   phrase in `BUMP_PRICING` is held here against a card pair that
   makes exactly that edit, and the two sets of phrases are compared
   both ways so a row added to the table without a pair, or a pair
   whose phrase left the table, fails rather than passing quietly.
   ============================================================ */

const BASE: NodeCard = {
  id: "solver",
  name: "Solver",
  type: "agent",
  phases: ["implementation"],
  action: "Write the solution the brief asks for.",
  spec: "Read the brief on the `brief` port and write the solution to the `result` port.",
  model: "model-a",
  agent: "Solver",
  tools: ["file-io"],
  mcp: ["filesystem"],
  skill: "skills/solver.md",
  params: { depth: 2, budget: 10 },
  inputs: [
    { name: "brief", type: "plan", description: "The ordered brief." },
    { name: "hints", type: "text", description: "Optional hints.", required: false },
  ],
  outputs: [{ name: "result", type: "code", description: "The solution." }],
  dependencies: ["planner"],
  cannot: ["acceptance-criteria"],
  willNot: ["never opens a shell"],
  riskMarkers: ["secret-access"],
  notes: "Deliberately no `irreversible-action`.",
  version: "1.0.0",
};

/** A copy of `BASE` with one edit applied, so every pair differs in exactly one thing. */
function edited(change: (card: NodeCard) => void): NodeCard {
  const next: NodeCard = structuredClone(BASE);
  change(next);
  return next;
}

/**
 * One or more card pairs per phrase, keyed by the phrase the reference prints.
 *
 * A phrase naming several fields (`name`, `action` or `notes`) carries one pair per field,
 * because the level is asserted per pair and a phrase is only true when every field it
 * names prices the same.
 */
const PAIRS: Record<string, readonly NodeCard[]> = {
  "a port removed or renamed": [
    edited((c) => c.outputs.splice(0, 1)),
    edited((c) => {
      c.inputs[0].name = "brief-renamed";
    }),
  ],
  "a port's `type` changed": [
    edited((c) => {
      c.outputs[0].type = "text";
    }),
  ],
  "an existing input made required": [
    edited((c) => {
      c.inputs[1].required = true;
    }),
  ],
  "a required input added": [
    edited((c) => c.inputs.push({ name: "criteria", type: "acceptance-criteria" })),
  ],
  "`id` changed": [
    edited((c) => {
      c.id = "solver-b";
    }),
  ],
  "`type` changed": [
    edited((c) => {
      c.type = "validation";
    }),
  ],
  "a `cannot` entry added": [edited((c) => c.cannot.push("report"))],
  "a `will_not` entry withdrawn": [edited((c) => c.willNot.splice(0, 1))],

  "`spec` changed": [
    edited((c) => {
      c.spec = "Read the brief on the `brief` port and write the solution to `result`, tested.";
    }),
  ],
  "`skill` set, repointed or dropped": [
    edited((c) => {
      c.skill = "skills/other.md";
    }),
    edited((c) => {
      delete c.skill;
    }),
  ],
  "`model` set, changed or dropped": [
    edited((c) => {
      c.model = "model-b";
    }),
    edited((c) => {
      delete c.model;
    }),
  ],
  "an optional input added": [
    edited((c) => c.inputs.push({ name: "context", type: "text", required: false })),
  ],
  "an output added": [edited((c) => c.outputs.push({ name: "log", type: "text" }))],
  "a `tools`, `mcp`, `risk_markers` or `dependencies` entry added": [
    edited((c) => c.tools.push("git")),
    edited((c) => c.mcp.push("github")),
    edited((c) => c.riskMarkers.push("unchecked-write")),
    edited((c) => c.dependencies.push("reviewer")),
  ],
  "a `params` key added": [
    edited((c) => {
      c.params.max_retries = 2;
    }),
  ],
  "a `cannot` entry withdrawn": [edited((c) => c.cannot.splice(0, 1))],
  "a `will_not` entry stated": [edited((c) => c.willNot.push("does not edit the tests"))],
  "a phase added or dropped": [
    edited((c) => c.phases.push("testing")),
    edited((c) => c.phases.splice(0, 1)),
  ],

  "`name`, `action` or `notes` reworded": [
    edited((c) => {
      c.name = "The Solver";
    }),
    edited((c) => {
      c.action = "Write the solution the brief describes.";
    }),
    edited((c) => {
      c.notes = "Reworded.";
    }),
  ],
  "a port `description` changed": [
    edited((c) => {
      c.inputs[0].description = "The brief, as the run supplied it.";
    }),
  ],
  "`agent` changed": [
    edited((c) => {
      c.agent = "Implementer";
    }),
  ],
  "a `params` value changed, or a `params` key removed": [
    edited((c) => {
      c.params.depth = 3;
    }),
    edited((c) => {
      delete c.params.budget;
    }),
  ],
  "an input no longer required": [
    edited((c) => {
      c.inputs[0].required = false;
    }),
  ],
  "a `tools`, `mcp`, `risk_markers` or `dependencies` entry withdrawn": [
    edited((c) => c.tools.splice(0, 1)),
    edited((c) => c.mcp.splice(0, 1)),
    edited((c) => c.riskMarkers.splice(0, 1)),
    edited((c) => c.dependencies.splice(0, 1)),
  ],
  "a list reordered": [
    edited((c) => {
      c.params = { budget: 10, depth: 2 };
      c.inputs = [c.inputs[1], c.inputs[0]];
    }),
  ],
};

describe("the version-pricing table the schema reference prints", () => {
  it("covers exactly the phrases that have a card pair, and no others", () => {
    const printed = BUMP_LEVELS.flatMap((level) => BUMP_PRICING[level]);
    expect([...printed].sort()).toEqual(Object.keys(PAIRS).sort());
    expect(new Set(printed).size).toBe(printed.length);
  });

  it("prices `BASE` against itself as no change, so every pair below is a real edit", () => {
    expect(inferBump(BASE, structuredClone(BASE)).level).toBe("none");
  });

  it.each(
    BUMP_LEVELS.flatMap((level) => BUMP_PRICING[level].map((phrase) => [phrase, level] as const)),
  )("%s prices as %s", (phrase, level) => {
    for (const next of PAIRS[phrase]) {
      const analysis = inferBump(BASE, next);
      expect(analysis.level, analysis.reasons.join("; ")).toBe(level);
    }
  });
});
