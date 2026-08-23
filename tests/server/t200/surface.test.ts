/* ============================================================
   T200 — the published surface

   Four functions, two published types and three routes. Nothing
   here opens a database: this file answers "is the surface there
   at all", so its reds say the module or the URL is absent rather
   than that a query returned the wrong thing. Every criterion
   file below it would otherwise report the same absence six times
   over with a longer message in front of it.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PUBLISHED,
  PUBLISHED_ADDITIONS,
  PUBLISHED_NAMES,
  ROUTES,
  ROUTE_NAMES,
  SEARCH,
  bind,
  loadSearch,
  routePatternFor,
  type PublishedName,
} from "./contract";

describe("the barrel", () => {
  it("loads", async () => {
    const mod = await loadSearch();
    expect(
      Object.keys(mod).length,
      `${SEARCH} loaded but exports nothing. backend.md §T200 publishes ` +
        `${PUBLISHED_NAMES.join(", ")} through this barrel.`,
    ).toBeGreaterThan(0);
  });
});

describe("the four published functions", () => {
  for (const name of PUBLISHED_NAMES) {
    it(`\`${name}\` is exported as a function`, async () => {
      /* `bind` throws with the clause that publishes the name and the list of what the
         barrel does export, so an absent member is distinguishable from a member of the
         wrong kind without a second assertion here. */
      const fn = await bind(name);
      expect(typeof fn, PUBLISHED[name]).toBe("function");
    });
  }
});

describe("D-200-32 the two approved additions to the block", () => {
  for (const name of PUBLISHED_ADDITIONS) {
    it(`\`${name}\` is exported`, async () => {
      const mod = await loadSearch();
      expect(
        typeof mod[name],
        `D-200-32 records \`searchParams\` and \`withSearchErrors\` as additions to the ` +
          `published block: three routes need ONE first-wins reading of a query string, and ` +
          `three copies is three places for it to stop being first-wins. Both are transport ` +
          `and both are this task's own.\n` +
          `  Recorded in the block rather than left undeclared, because the block is what the ` +
          `next task binds to — T220, T260 and T261 all list this task under Depends on.\n` +
          `  found: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
      ).toBe("function");
    });
  }
});

/* --------------------- the two published TYPES --------------------- */

/**
 * A type-level instrument cannot observe its own blindness.
 *
 * `Hit<T>` and `Results<T>` are published in the same block as the four functions, and a
 * type erases: a cell that imported them and asserted their shape would compile against a
 * module that does not exist and pass. Nothing at runtime can tell "the barrel does not
 * re-export `Results`" from "my assertion about `Results` was wrong", because there is no
 * runtime value either way.
 *
 * So this cell reads the barrel from disk and looks for the two names in its export
 * statements. It reports only the export STATEMENTS it matched — never the file's body —
 * because the author of this suite has not read `lib/server/search/**` and does not intend
 * a failure message to be the way around that.
 */
const SEARCH_DIR = fileURLToPath(new URL("../../../lib/server/search/", import.meta.url));

function barrelSource(): { path: string; text: string } {
  let entries: string[];
  try {
    entries = readdirSync(SEARCH_DIR);
  } catch (cause) {
    throw new Error(
      `lib/server/search/ does not exist. backend.md §T200 owns it and publishes the barrel ` +
        `\`${SEARCH}\`.`,
      { cause },
    );
  }
  const index = entries.find((name) => /^index\.(ts|tsx|js|mjs)$/.test(name));
  if (index === undefined) {
    throw new Error(
      `lib/server/search/ has no \`index\` module (it holds: ${entries.sort().join(", ")}).\n` +
        `  The contract publishes the barrel as \`${SEARCH}\`, and \`lib/core/index.ts\` ` +
        `states the rule the tree already follows: deep paths are internal and nothing ` +
        `outside should reach for one.`,
    );
  }
  return { path: `lib/server/search/${index}`, text: readFileSync(join(SEARCH_DIR, index), "utf8") };
}

/** Only the export statements, so a failure quotes the surface and never the implementation. */
function exportStatements(text: string): string[] {
  return text.split("\n").filter((line) => /^\s*export\b/.test(line)).map((line) => line.trim());
}

describe("the two published types are re-exported from the barrel", () => {
  for (const name of ["Hit", "Results"] as const) {
    it(`\`${name}\` appears in the barrel's exports`, () => {
      const barrel = barrelSource();
      const statements = exportStatements(barrel.text);
      const named = new RegExp(`\\b${name}\\b`);
      expect(
        statements.some((line) => named.test(line)),
        `${barrel.path} exports no \`${name}\`.\n` +
          `  backend.md §T200 publishes \`interface Hit<T> { item: T; evidence: readonly ` +
          `string[] }\` and \`interface Results<T> { hits: readonly Hit<T>[]; facets: ` +
          `Record<string, readonly string[]>; ordered: boolean }\` in the same block as the ` +
          `four functions, and every consumer named under Blocks — T220, T260, T261 — has ` +
          `to name the response shape to hold it.\n` +
          `  A type erases, so this is the only cell in the suite that can tell an absent ` +
          `type from a wrong assertion about one. Export statements found:\n    ` +
          statements.join("\n    "),
      ).toBe(true);
    });
  }
});

/* --------------------- the three routes (D-200-16) --------------------- */

describe("D-200-16 the three published URLs are served", () => {
  for (const name of ROUTE_NAMES) {
    it(`\`${ROUTES[name].url}\` is routed`, () => {
      /* Asked of Next's own router over the discovered tree, so this answers "is this URL
         served at all" without importing a handler or opening a database — and a red says
         the URL is unserved rather than that a request failed. */
      const pattern = routePatternFor(ROUTES[name].path);
      expect(pattern, `${ROUTES[name].url} resolved to \`${pattern}\``).toBe(ROUTES[name].path);
    });
  }
});

/* --------------------- the names, as one list --------------------- */

describe("the block publishes four names and no fewer", () => {
  it("all four are present together", async () => {
    const mod = await loadSearch();
    const missing: PublishedName[] = PUBLISHED_NAMES.filter((n) => mod[n] === undefined);
    expect(
      missing,
      `${SEARCH} is missing ${missing.length} of the four published functions.\n` +
        `  found: ${Object.keys(mod).sort().join(", ") || "(nothing)"}\n` +
        `  A per-name cell above reds for each one; this cell exists so the count is ` +
        `readable in one line rather than reconstructed from four.`,
    ).toEqual([]);
  });
});
