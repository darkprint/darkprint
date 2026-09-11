/* ============================================================
   The published MCP surface exists and is the right shape

   The cell every other file's red would otherwise be reported as:
   a criterion cannot fail informatively against a module that is
   not there. The tool table on `/mcp` is the advertised surface,
   and the barrel is held to one verb per advertised tool that is
   not a named composition, so a tool published against no verb
   reds here rather than shipping as a promise nothing answers.
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

describe("the barrel publishes the six verbs", () => {
  for (const name of PUBLISHED_NAMES) {
    it(`publishes \`${name}\``, async () => {
      const bound = await verb(name);
      expect(typeof bound, `${name} is ${describe_(bound)}`).toBe("function");
    });
  }

  it("publishes exactly as many verbs as /mcp advertises tools, compositions aside", async () => {
    /* Read off the page rather than off this suite's own transcription: the transcription
       compared to `PUBLISHED_NAMES.length` is two numbers written here, a cell that passes
       against an absent module. */
    const page = readFileSync(
      fileURLToPath(new URL("../../../app/mcp/page.tsx", import.meta.url)),
      "utf8",
    );
    const advertised = advertisedOperations(page);
    expect(advertised, "the page's own OPERATIONS table is where the names live").toEqual([
      ...ADVERTISED,
    ]);

    const mod = await loadMcp();
    const exported = PUBLISHED_NAMES.filter((n) => mod[n] !== undefined);

    /* Subtracting the compositions keeps this an equality: a tool with no verb and no
       `COMPOSED` entry still reds. */
    const composed = advertised.filter((name) => name in COMPOSED);
    expect(
      exported,
      `/mcp advertises ${advertised.length} tools (${advertised.join(", ")}), of which ` +
        `${composed.length} compose others (${composed.join(", ") || "none"}). The barrel must ` +
        "publish one verb for each tool that is not a composition.",
    ).toHaveLength(advertised.length - composed.length);

    for (const [name, parts] of Object.entries(COMPOSED)) {
      for (const part of parts) {
        expect(
          exported,
          `\`${name}\` is declared to compose \`${part}\`, which the barrel does not publish.`,
        ).toContain(part);
      }
    }
  });

  /* Arity is pinned because two spellings of an optional parameter differ observably:
     TypeScript's `?` erases to nothing, so it still counts in `Function.length`, while a
     default does not. */
  for (const name of PUBLISHED_NAMES) {
    it(`\`${name}\` takes the ${PUBLISHED_ARITY[name]} parameters it publishes`, async () => {
      const bound = await verb(name);
      expect(
        bound.length,
        `published as:\n    ${PUBLISHED[name]}\n` +
          "  A count one HIGH is usually an optional parameter spelled `?` rather than with " +
          "a default; `?` erases at runtime and still counts.",
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
          "  A class no barrel exports is a class a caller cannot branch on.",
      ).toBeDefined();
      expect(
        typeof ctor === "function" &&
          (ctor as { prototype?: unknown }).prototype instanceof Error,
        `\`${name}\` is ${describe_(ctor)}, not an Error subclass.`,
      ).toBe(true);
    });
  }

  /* A source cell, and the only thing that separates "a member is absent" from "an assertion
     failed": every type pin is erased at run time, so a file of pure type assertions passes
     against a module that does not exist. */
  it("exports the six names and says what it holds when it does not", async () => {
    const mod = await loadMcp();
    const held = Object.keys(mod).sort();
    const missing = PUBLISHED_NAMES.filter((n) => mod[n] === undefined);
    expect(
      missing,
      `${MCP} exports: ${held.join(", ") || "(nothing)"}.\n  The barrel names all six.`,
    ).toEqual([]);
  });
});
