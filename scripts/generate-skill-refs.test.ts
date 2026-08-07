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

import { GENERATED_REFS, absolutePathOf } from "./skill-refs.ts";
import { CARD_KNOWN_KEYS, CORE_ONTOLOGY } from "@/lib/core";

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
