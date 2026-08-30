/* ============================================================
   T220 — the published surface exists and is the right shape

   Not an acceptance criterion of its own. It is the cell every
   other file's red would otherwise be reported as: a criterion
   cannot fail informatively against a module that is not there, and
   a suite whose every red says "cannot find module" has measured
   the hand-off rather than the work.

   ── the advertised operations may not be renamed ──
   D-220-01 (3) makes `app/mcp/page.tsx:85-110` the advertised
   contract. What this file holds the module to is the BLOCK's
   names, because a page's prose does not spell an identifier — the
   page itself says so: *"There are no `search_blueprints(...)`
   signatures on this page because no signature has been designed."*
   What the page fixes is HOW MANY operations there are and what
   they are called, and that is asserted against the page's own
   count rather than against a transcription.

   ── one of them is not a server verb, and that is checked ──
   D-107 added `export a pipeline`, which `lib/server/mcp` publishes
   no verb for: it is `mcpFetchRelease` followed by a pure local
   compile, reaching no route `fetch a release` does not already
   reach. So "the barrel publishes one verb per operation" is no
   longer an equality, and the cell below does NOT relax to `>=` —
   that would stop it detecting the thing it was written for, a tool
   published against no barrel verb at all. `contract.ts`'s
   `COMPOSED` names the exceptions and what each one composes, and
   the cell holds every constituent to being published itself. A
   sixth operation with neither a verb nor an entry still reds.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ADVERTISED,
  advertisedOperations,
  COMPOSED,
  MCP,
  PUBLISHED,
  PUBLISHED_ARITY,
  PUBLISHED_CLASSES,
  PUBLISHED_NAMES,
  describe_,
  loadMcp,
  verb,
} from "./contract";

describe("T220 — the barrel publishes the four verbs", () => {
  for (const name of PUBLISHED_NAMES) {
    it(`publishes \`${name}\``, async () => {
      const bound = await verb(name);
      expect(typeof bound, `${name} is ${describe_(bound)}`).toBe("function");
    });
  }

  it("publishes exactly as many operations as /mcp advertises", async () => {
    /* Read off the page rather than off this file's own transcription. The transcription
       compared to `PUBLISHED_NAMES.length` is 4 === 4 with both fours written here, and it
       was measured passing in the blind position — a cell that cannot fail, reading as
       coverage of the advertised contract. `app/mcp/page.tsx` is Forbidden to both halves,
       which is what makes it a second author rather than a copy. */
    const page = readFileSync(
      fileURLToPath(new URL("../../../app/mcp/page.tsx", import.meta.url)),
      "utf8",
    );
    const advertised = advertisedOperations(page);
    expect(
      advertised,
      "the page's own OPERATIONS table is where the names live",
    ).toEqual([...ADVERTISED]);

    const mod = await loadMcp();
    const exported = PUBLISHED_NAMES.filter((n) => mod[n] !== undefined);

    /* Every advertised operation is either a server verb or a named composition of them.
       Subtracting the compositions keeps this an EQUALITY: a tool published against no verb
       and no `COMPOSED` entry still reds, which is the only failure this cell was written to
       catch. */
    const composed = advertised.filter((name) => name in COMPOSED);
    expect(
      exported,
      `/mcp advertises ${advertised.length} operations (${advertised.join(", ")}), of which ` +
        `${composed.length} compose others (${composed.join(", ") || "none"}). They may not be ` +
        "renamed (D-220-01 (3)). The barrel must publish one verb for each operation that is " +
        "not a composition.",
    ).toHaveLength(advertised.length - composed.length);

    /* And a composition may only name constituents the barrel really publishes, so
       `COMPOSED` cannot become a place to park an operation nothing implements. */
    for (const [name, parts] of Object.entries(COMPOSED)) {
      for (const part of parts) {
        expect(
          exported,
          `\`${name}\` is declared to compose \`${part}\`, which the barrel does not publish.`,
        ).toContain(part);
      }
    }
  });

  /* Arity is pinned because two spellings of an optional parameter differ observably here
     and this repository has charged one of them: TypeScript's `?` erases to nothing, so it
     still counts in `Function.length`, while `= undefined` does not. `publish` shipped the
     `?` spelling once and was charged as F5, and `runImport` carries the fix with the reason
     written beside it. A verb whose arity is one high has an optional parameter spelled the
     way that was already ruled wrong. */
  for (const name of PUBLISHED_NAMES) {
    it(`\`${name}\` takes the ${PUBLISHED_ARITY[name]} parameters the block publishes`, async () => {
      const bound = await verb(name);
      expect(
        bound.length,
        `backend.md §T220 publishes:\n    ${PUBLISHED[name]}\n` +
          "  A count one HIGH is usually an optional parameter spelled `?` where the ruling " +
          "requires `= undefined` — `?` erases at runtime and still counts.",
      ).toBe(PUBLISHED_ARITY[name]);
    });
  }

  for (const name of PUBLISHED_CLASSES) {
    it(`publishes \`${name}\` and it is an Error subclass`, async () => {
      const mod = await loadMcp();
      const held = Object.keys(mod).sort();
      const ctor = mod[name];
      expect(
        ctor,
        `${MCP} exports: ${held.join(", ") || "(nothing)"}.\n` +
          "  D-220-06 rules two classes for this surface. A class no barrel exports is a " +
          "class a caller cannot branch on, which is the defect D-133-02 F3 names.",
      ).toBeDefined();
      /* `prototype instanceof Error` is the language's own answer, so no name pattern
         decides membership — the same predicate `tests/error-hygiene.test.ts` builds its
         domain from. */
      expect(
        typeof ctor === "function" &&
          (ctor as { prototype?: unknown }).prototype instanceof Error,
        `\`${name}\` is ${describe_(ctor)}, not an Error subclass.`,
      ).toBe(true);
    });
  }

  /* A source cell, and the only thing that separates "a member is absent" from "an assertion
     failed": every type pin in this suite is erased at run time, so a file of pure type
     assertions passes against a module that does not exist. This reads the namespace off
     disk and says what it actually holds. */
  it("exports the four names and says what it holds when it does not", async () => {
    const mod = await loadMcp();
    const held = Object.keys(mod).sort();
    const missing = PUBLISHED_NAMES.filter((n) => mod[n] === undefined);
    expect(
      missing,
      `${MCP} exports: ${held.join(", ") || "(nothing)"}.\n` +
        "  backend.md §T220's Published signatures block names all four.",
    ).toEqual([]);
  });
});
