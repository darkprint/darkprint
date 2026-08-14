/* ============================================================
   T080 — the published surface exists

   Not an acceptance criterion of its own: the seven criteria
   beside this file need these names, and a red here says *which*
   name is missing instead of leaving the reader to infer it from
   sixty failures that all say "undefined is not a function".
   ============================================================ */

import { describe, expect, it } from "vitest";

import { PUBLISHED, READER_NAMES, REGISTRY, ROUTES, bind, loadRegistry, routeGet } from "./contract";

describe("T080 published signatures", () => {
  it("publishes the barrel the task owns", async () => {
    expect(typeof (await loadRegistry())).toBe("object");
  });

  for (const name of READER_NAMES) {
    it(`publishes \`${name}\` from ${REGISTRY}`, async () => {
      expect(typeof (await bind(name))).toBe("function");
    });
  }

  /**
   * A guard on THIS SUITE, not on the module — the only test in the tree that passes with
   * `lib/server/registry/**` absent, and it is labelled so that is not read as coverage.
   * `READER_NAMES` is what `privacy.test.ts` iterates, so a later edit trimming it silently
   * shrinks the AC6 sweep from thirteen readers to twelve without failing anything. The
   * count is the thing the sweep's claim rests on, so it is asserted rather than trusted.
   */
  it("keeps this suite's reader table at the thirteen the contract publishes", () => {
    expect(
      READER_NAMES.length,
      `D-80-02b added \`scoresOf\` because AC7 was unreachable through any published ` +
        `surface: "none of the twelve readers returns a score". AC6 is asserted across ` +
        `all thirteen, and this is what keeps that number honest.`,
    ).toBe(13);
    expect(PUBLISHED.scoresOf).toContain("scoresOf(db: Db, actor: Actor");
  });

  /**
   * "Out of scope: semantic search (T200)". `lib/core`'s `Registry` carries a thirteenth
   * method, `searchCards`, and the Published signatures block deliberately does not — an
   * implementation that copies the interface wholesale takes T200's surface with it.
   */
  it("publishes no search reader, which is T200's", async () => {
    const mod = await loadRegistry();
    const searchShaped = Object.keys(mod).filter((name) => /search|rank|query/i.test(name));
    expect(
      searchShaped,
      `backend.md §T080 Out of scope: "semantic search (T200)". \`lib/core\`'s \`Registry\` ` +
        `declares \`searchCards\`; the Published signatures block leaves it out on purpose.`,
    ).toEqual([]);
  });
});

describe("T080 published routes (D-80-02)", () => {
  for (const [name, spec] of Object.entries(ROUTES)) {
    it(`publishes \`${spec.url}\``, async () => {
      expect(typeof (await routeGet(name as keyof typeof ROUTES))).toBe("function");
    });
  }
});
