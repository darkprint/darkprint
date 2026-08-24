/* ============================================================
   T220 — the published surface exists and is the right shape

   Not an acceptance criterion of its own. It is the cell every
   other file's red would otherwise be reported as: a criterion
   cannot fail informatively against a module that is not there, and
   a suite whose every red says "cannot find module" has measured
   the hand-off rather than the work.

   ── the four operations may not be renamed ──
   D-220-01 (3) makes `app/mcp/page.tsx:85-110` the advertised
   contract. What this file holds the module to is the BLOCK's four
   names, because a page's prose does not spell an identifier — the
   page itself says so: *"There are no `search_blueprints(...)`
   signatures on this page because no signature has been designed."*
   What the page does fix is that there are FOUR operations and no
   fifth, and that is asserted against the page's own count.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  ADVERTISED,
  MCP,
  PUBLISHED,
  PUBLISHED_ARITY,
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
    expect(PUBLISHED_NAMES).toHaveLength(ADVERTISED.length);
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
