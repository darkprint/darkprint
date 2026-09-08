/* ============================================================
   T080 — the published surface exists

   Not an acceptance criterion of its own: the seven criteria
   beside this file need these names, and a red here says *which*
   name is missing instead of leaving the reader to infer it from
   sixty failures that all say "undefined is not a function".
   ============================================================ */

import { describe, expect, it } from "vitest";

import { PUBLISHED, READER_NAMES, REGISTRY, ROUTES, bind, loadRegistry, routePatternFor } from "./contract";

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
   * An edit trimming `READER_NAMES` silently shrinks the loop above without failing
   * anything, so the count is asserted rather than trusted.
   *
   * **Its original reason was wrong and is corrected here rather than carried.** It said
   * `READER_NAMES` is what `privacy.test.ts` iterates; that suite imports the `ReaderName`
   * TYPE and iterates its own hand-written `CALLS` table, because AC6 needs arguments per
   * reader that no name can supply. So this number never guarded the sweep's width, and
   * saying it did would have made a real gap invisible — see `contract.ts`'s note on the
   * three readers T132 added that `CALLS` does not yet cover (D-132-02 C-8).
   */
  it("keeps this suite's reader table at the eighteen the contract publishes", () => {
    expect(
      READER_NAMES.length,
      `Thirteen at T080's merge — D-80-02b added \`scoresOf\` because AC7 was unreachable ` +
        `through any published surface: "none of the twelve readers returns a score". T132 ` +
        `added three amendments to this merged record: \`graphsOf\` and \`scoresFor\` ` +
        `(D-132-01, owed to T260) and \`cardsOwnedBy\` (D-132-02, the reader ` +
        `\`counts.cards\` needed). \`PUBLISHED\` is an equality over reader names, so an ` +
        `addition reds this BY DESIGN and the amendment lands in the same commit — the ` +
        `sanctioned path D-260-14 names. T260's merge added \`usersOfMany\` (D-260-31), the ` +
        `batch form the /nodes cutover armed. The single-card publish door added ` +
        `\`storedVersionsOf\`, the reader the page path it answers resolves through. If this ` +
        `number moved without a ruling, that is the defect it exists to catch.`,
    ).toBe(18);
    expect(PUBLISHED.scoresOf).toContain("scoresOf(db: Db, actor: Actor");
    expect(PUBLISHED.graphsOf).toContain("graphsOf(db: Db, actor: Actor");
    expect(PUBLISHED.scoresFor).toContain("scoresFor(db: Db, actor: Actor");
    expect(PUBLISHED.cardsOwnedBy).toContain("cardsOwnedBy(db: Db, actor: Actor");
    expect(PUBLISHED.usersOfMany).toContain("usersOfMany(db: Db, actor: Actor");
    expect(PUBLISHED.storedVersionsOf).toContain("storedVersionsOf(db: Db, actor: Actor");
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
      `T080's Out of scope line: "semantic search (T200)". \`lib/core\`'s \`Registry\` ` +
        `declares \`searchCards\`; the Published signatures block leaves it out on purpose.`,
    ).toEqual([]);
  });
});

describe("T080 published routes (D-80-02)", () => {
  /**
   * Asked of the URL, never of a file. The contract publishes paths; the App Router folder
   * layout that serves them is the implementation's, and a suite that bound to one would
   * red a correct implementation whose layout differed — and, because a dynamic `import()`
   * specifier resolves at compile time, take `tsc` and `npm run build` down with it. The
   * first version of this file did exactly that.
   */
  for (const [, spec] of Object.entries(ROUTES)) {
    it(`serves \`${spec.url}\``, () => {
      expect(
        routePatternFor(spec.sample),
        `\`${spec.sample}\` is a concrete instance of the published template.`,
      ).toMatch(/^\/api\//);
    });
  }

  /**
   * The two sub-resources are the reason the templates cannot be read as folder names.
   * `CARD_ID` admits an `owner/name` namespace, so `berti/solver-a` is **one id spanning
   * two URL segments** and no literal `[id]` folder can express it. Whatever pattern serves
   * them must therefore also serve the namespaced form.
   */
  it("serves a namespaced card id, which a literal [id] segment cannot express", () => {
    for (const path of [
      "/api/cards/berti/solver-a@1.0.0",
      "/api/cards/berti/solver-a/versions",
      "/api/cards/berti/solver-a/users",
    ]) {
      expect(routePatternFor(path), path).toMatch(/^\/api\/cards\//);
    }
  });
});
