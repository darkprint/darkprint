/* ============================================================
   T260 — the reader `/blueprints` waits on, held from this side

   The orchestrator owes T080 a batch reader,
   `graphsOf(db, actor, keys)`, answering
   `{ graph, requiredAgents, requiredTools }` per key. It is not
   built: the registry barrel exports thirteen readers and none of
   them is it, and `grep -rn 'graphsOf\\|graphForBlueprint\\|
   requiredAgents\\|requiredTools' lib/server/` returns nothing at
   all — those three live only on the build-time side
   (`lib/graph-seed.ts`, `lib/content/view.ts`).

   ── why a blind author holds someone else's signature ──
   Because `/blueprints` cannot be cut over without it, and because
   the failure mode if it never lands is not a missing import. It is
   a route that computes the three itself, which is available
   (`lib/graph-seed.ts` is not Forbidden to T260) and which
   re-implements a projection T080 owns. `lib/server/search/
   blueprints.ts` names that exact temptation and refuses it in as
   many words: *"deriving the scorecard myself would re-implement
   D-80-03's current-release rule, which is the defect this run has
   charged more than any other."*

   So the cells below are two different criteria. One says the
   reader exists. The other says the route did not route around it —
   and that one is T260's own, it can fail independently, and it is
   the one that stays useful after the reader lands.

   ── what this file DOES NOT assert ──
   The per-key SHAPE of what `graphsOf` returns. Calling it needs a
   database and a seeded store, and a cell that pinned the shape
   without calling it would be a type assertion, which erases —
   green against a module that does not exist. The source cell below
   is what distinguishes *the export is absent* from *an assertion
   about it failed*, and it is the only honest instrument available
   from here until the reader is real.
   ============================================================ */

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { sources } from "./contract";
import {
  BROWSERS,
  ROUTES,
  SHELVES,
  importedFrom,
  importsOf,
  parse,
  propertyNames,
  readersCalledPerItem,
} from "./partition";

const REGISTRY_BARREL = "lib/server/registry/index.ts";

/** What `GalleryBrowser` consumes off each tile that no published reader answers today. */
const OWED = ["graph", "requiredAgents", "requiredTools"] as const;

/** Every name the registry barrel re-exports, read from the barrel rather than imported. */
function barrelExports(): Set<string> {
  const [source] = sources([REGISTRY_BARREL], 1);
  const sf = parse(source.path, source.raw);
  const names = new Set<string>();
  const walk = (node: ts.Node) => {
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause !== undefined &&
      ts.isNamedExports(node.exportClause)
    ) {
      for (const element of node.exportClause.elements) names.add(element.name.text);
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return names;
}

describe("T260's dependency: the batch graph reader `/blueprints` needs", () => {
  /*
   * The premise for everything below, and it is measured rather than assumed: if
   * `GalleryBrowser` stopped consuming these three, the reader would not be owed and this
   * whole file would be asserting a dependency that no longer exists.
   */
  it("`GalleryBrowser` really does consume all three", () => {
    const [source] = sources([BROWSERS.blueprints], 1);
    const names = propertyNames(parse(source.path, source.raw));

    const absent = OWED.filter((field) => !names.has(field));
    expect(
      absent,
      `${BROWSERS.blueprints} no longer reads ${absent.join(", ")}. If the shelf stopped ` +
        `rendering them then \`graphsOf\` is not owed after all and this file should go — ` +
        `but that is a change to what the tile SHOWS, which AC2 governs, so it needs a ` +
        `ruling rather than a quiet deletion here.`,
    ).toEqual([]);
  });

  /*
   * A SOURCE cell, and it is the reason this file can exist before the reader does.
   *
   * `import { graphsOf } from "@/lib/server/registry"` would throw at module load and take
   * every cell in the file with it — `Test Files 1 failed` beside `Tests 0`, which reads as
   * a collection error rather than as a missing dependency. Reading the barrel from disk
   * says exactly what is wrong and says it in a cell.
   */
  it("`lib/server/registry` publishes `graphsOf`", () => {
    const names = barrelExports();

    /* Falsifies the reader: a barrel this parse could not understand would return an empty
       set and make the negative below free. Thirteen readers are published today. */
    expect(
      names.size,
      `parsed no re-exports out of ${REGISTRY_BARREL}. The negative below would then pass ` +
        `against any barrel at all.`,
    ).toBeGreaterThan(5);

    expect(
      names.has("graphsOf"),
      `${REGISTRY_BARREL} does not export \`graphsOf\`.\n\n` +
        `It publishes: ${[...names].sort().join(", ")}\n\n` +
        `\`/blueprints\` cannot be cut over without it: \`GalleryBrowser\` renders ` +
        `${OWED.join(", ")} off every tile and nothing under \`lib/server/**\` answers any ` +
        `of the three. Owed by the orchestrator on T080 as ` +
        `\`graphsOf(db, actor, keys)\` -> \`{ graph, requiredAgents, requiredTools }\` per ` +
        `key. Until it lands this red IS the blocker, and it is the intended state — not a ` +
        `defect in T260 and not one in T080.`,
    ).toBe(true);
  });

  it("`graphsOf` is batch, not one call per tile", async () => {
    const names = barrelExports();
    /* Premise first, so an absent export reds as absent above and this cell says nothing
       new rather than reporting a signature failure about a function that is not there. */
    expect(names.has("graphsOf"), "blocked on the cell above; nothing to check yet").toBe(true);

    const registry: Record<string, unknown> = await import("@/lib/server/registry");
    const graphsOf = registry.graphsOf;
    expect(typeof graphsOf, "`graphsOf` is exported but does not bind as a function").toBe(
      "function",
    );

    /*
     * `(db, actor, keys)` — three parameters, the third plural.
     *
     * The whole reason it is owed is that the per-blueprint shape does not scale on a page
     * that renders per request (D-260-05) and filters client-side (D-260-06), so it needs
     * every tile's data on every load. A four-parameter `(db, actor, ownerHandle, slug)` —
     * which is exactly `scoresOf`'s shape — would be the per-tile version wearing the new
     * name, and the arity is the one thing about it a blind cell can check.
     */
    expect(
      (graphsOf as (...args: unknown[]) => unknown).length,
      "`graphsOf` takes four parameters, which is `scoresOf(db, actor, ownerHandle, slug)`'s " +
        "shape — per blueprint. The reader is owed BECAUSE the per-blueprint shape costs one " +
        "round trip per tile on a page that now renders per request.",
    ).toBe(3);
  });

  /*
   * T260'S OWN CRITERION, AND IT OUTLIVES THE DEPENDENCY.
   *
   * This is the cell that can fail while every other cell in this file passes: the reader
   * lands, and the route computes the graphs itself anyway — or the reader never lands, and
   * the route reaches for `lib/graph-seed.ts`, which is not Forbidden to T260 and which
   * would make the cutover appear complete.
   *
   * Either way the route would hold a second copy of a projection T080 owns, which is the
   * same shape as D-260-03's two-defaults-for-one-shelf: it does not fail on the day it is
   * written, it fails the day the two disagree.
   */
  it("the route does not compute the graphs itself", () => {
    const [source] = sources([ROUTES.blueprints], 1);
    const sf = parse(source.path, source.raw);
    const specifiers = importsOf(sf);

    const buildTime = specifiers.filter(
      (specifier) =>
        specifier === "@/lib/graph-seed" ||
        specifier.startsWith("@/lib/graph-seed/") ||
        specifier === "@/lib/content" ||
        specifier.startsWith("@/lib/content/"),
    );

    expect(
      buildTime,
      `${ROUTES.blueprints} imports ${buildTime.join(", ")}.\n\n` +
        `\`graphForBlueprint\`, \`requiredAgents\` and \`requiredTools\` are reachable from ` +
        `there and neither module is Forbidden to T260, so computing the three on the route ` +
        `is available and would look like a finished cutover. It is a second implementation ` +
        `of a projection T080 owns, and \`lib/server/search/blueprints.ts\` refuses the same ` +
        `move for the scorecard by name: re-implementing D-80-03's current-release rule is ` +
        `"the defect this run has charged more than any other".\n\n` +
        `If \`graphsOf\` is not ready, the correct state is a red — this cell and the ones ` +
        `above — not a route that fills the gap locally.`,
    ).toEqual([]);
  });

  /* ============================================================
     D-260-21 — THE DEFECT THE BATCH READERS PREVENT, ASSERTED AS
     A DEFECT RATHER THAN AS A SIGNATURE

     The ruling says the batch readers are owed in the plural and
     land together. It does NOT publish their signatures, and a
     cell pinning a signature the orchestrator has not published
     would red a correct T080 — so this asserts the shape of the
     defect instead, which is decidable now and stays decidable
     whatever the readers end up being called.

     `scoresOf(db, actor, ownerHandle, slug)` is per blueprint and
     costs three `db.select` calls; counted, not recalled. T200's
     module pays that willingly because it only fetches scorecards
     when `phase`, `autonomy` or `df` is set, AFTER the cheap
     filters have narrowed the candidates. **This page cannot use
     that escape**: under D-260-06 it filters client-side, so every
     tile needs its scorecard on every request — and `df` is
     `scores.autonomy.isDarkFactory`, so a tile is not even
     filterable without one.

     A batch call over an array of keys is invisible to this cell.
     A per-item reader called once, for one blueprint, is invisible
     too. What it finds is one round trip per tile, on a page whose
     premise under AC1 is that the number of tiles grows between
     deploys — correct and slow, with the slowness invisible on the
     nine bundles the store holds.
     ============================================================ */
  it.each(SHELVES)("`/%s` does not read the registry once per row", (shelf) => {
    const [source] = sources([ROUTES[shelf]], 1);
    const sf = parse(source.path, source.raw);

    /*
     * THE READER LIST IS WHAT THIS FILE IMPORTS, NOT WHAT THE BARREL PUBLISHES.
     *
     * The first version of this cell matched bare call names against the barrel's exports
     * and reddened `app/nodes/page.tsx` before the cutover had touched it. The match was
     * `usersOf() inside .map()` — and it was real, and it was not a defect: `usersOf` is a
     * method on `lib/core/archive/registry.ts`'s IN-MEMORY archive as well as a
     * published reader on `lib/server/registry`. Same name, no cost in common. One is a
     * property lookup on an object already in memory; the other is a query.
     *
     * A bare-name matcher cannot tell them apart, and after the cutover it would have been
     * right for the wrong reason — which is worse than being wrong, because nobody rechecks
     * a red that turns out to be correct. Gating on the import makes the two distinguishable
     * and costs nothing: a call is only a database read if the name came from the barrel.
     */
    const imported = importedFrom(sf, "@/lib/server/registry");
    const published = barrelExports();
    const readers = imported.filter(
      (name) => published.has(name) && !name.startsWith("with") && name !== "actorFrom",
    );

    /*
     * THE PREMISE THAT STOPS THIS GOING VACUOUS FOREVER, and it fails outside the negative.
     *
     * Before the cutover the route imports no reader, so `readers` is empty and the check
     * below is free. That is correct TODAY and would be a silent hole once the route stops
     * reading `content/` — a cell measuring nothing while reporting green. So the two states
     * are tied together: a route that has dropped the archive must have picked up a reader.
     */
    const stillOnTheArchive = importsOf(sf).some(
      (specifier) => specifier === "@/lib/content" || specifier.startsWith("@/lib/content/"),
    );
    expect(
      stillOnTheArchive || readers.length > 0,
      `${ROUTES[shelf]} imports neither the build-time archive nor any published registry ` +
        `reader, so this cell has nothing to measure and would report green forever. ` +
        `Whichever source the shelf reads from, it reads from one of them.`,
    ).toBe(true);

    const perItem = readersCalledPerItem(sf, readers);
    expect(
      perItem,
      `${ROUTES[shelf]} calls a published registry reader once per row: ${perItem.join(", ")}.\n\n` +
        `D-260-21: the batch readers are owed precisely so this is not necessary. ` +
        `\`scoresOf\` alone is three queries per blueprint, and this route renders per ` +
        `request (D-260-05) over every row (D-260-06), so a per-tile read is one round trip ` +
        `per tile on every load — growing with a registry that AC1 exists to let grow.\n\n` +
        `If the batch readers are not ready, the correct state is the reds above, not a ` +
        `loop that works on nine bundles.`,
    ).toEqual([]);
  });
});
