/* ============================================================
   T030 — acceptance criteria (1), (2) and (5)

   AC1: "a merged view of core plus overlay reports the base version".
   AC2: "a shadowing overlay term is reported and keeps the shadowed
        term's position".
   AC5: "`isA` answers identically for one view across consecutive
        resolutions".

   All three run against `openView(db, version, extensions?)`, which
   the contract names for what AC5 requires:

     "`openView` is named for what AC5 requires: one instance, held
      by the caller. `isA` memoizes per view instance, and two
      bundles' scores are only comparable when they were resolved
      against the same instance. A function that builds a fresh view
      per call cannot satisfy AC5 no matter how it is tested, so the
      verb is `open` rather than `get`. Do **not** add a module-scope
      cache keyed by version."

   AC5 therefore has two halves and only one of them is the criterion
   as written. The other is the converse, and it is the one a
   module-scope cache would sail through: a cache keyed by version
   makes "identical across consecutive resolutions" trivially true
   and silently turns a per-batch guarantee into a process-lifetime
   one. Both are below.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

import { asDiagnostics, asView, bind, of } from "./contract";
import { BASE_VERSION, type TestDb, baseTerms, clean, db, openDatabase, sortedIds, term } from "./fixtures";

let t: TestDb;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);
afterAll(async () => {
  await t?.drop();
});
beforeEach(async () => {
  await clean(t);
  const add = await bind("addOntologyVersion");
  await add(db(t), { version: BASE_VERSION, terms: baseTerms() });
});

/** The overlay a bundle brings: namespaced, rooted in the stored base. */
function overlay() {
  return [term("berti/deep-validation", { broader: "validation" })];
}

describe("AC1: a merged view reports the base version", () => {
  it("AC1 reports the base version when an overlay is merged in", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, overlay()), "openView");

    // "The view keeps the *base* version: a local overlay does not mint a new vocabulary
    // version, which is what lets a card still declare `ontology_version: 0.1.0` while using
    // local terms." (`lib/core/ontology/resolve.ts:125-127`)
    expect(view.ontology.version).toBe(BASE_VERSION);
  });

  it("AC1 reports the base version with no overlay at all", async () => {
    const open = await bind("openView");
    expect(asView(await open(db(t), BASE_VERSION), "openView").ontology.version).toBe(BASE_VERSION);
  });

  it("AC1 reports the base version even when an overlay term claims a different `since`", async () => {
    const open = await bind("openView");
    const view = asView(
      await open(db(t), BASE_VERSION, [term("berti/x", { broader: "agent", since: "9.9.9" })]),
      "openView",
    );

    // A term's `since` is a fact about the term. Nothing about it mints a vocabulary version.
    expect(view.ontology.version).toBe(BASE_VERSION);
  });

  it("AC1 reports the base version of whichever version was opened", async () => {
    const add = await bind("addOntologyVersion");
    const open = await bind("openView");
    await add(db(t), { version: "0.2.0", terms: [...baseTerms(), term("critic")] });

    expect(asView(await open(db(t), "0.1.0", overlay()), "openView").ontology.version).toBe("0.1.0");
    expect(asView(await open(db(t), "0.2.0", overlay()), "openView").ontology.version).toBe("0.2.0");
  });

  it("AC1 merges the overlay in rather than dropping it", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, overlay()), "openView");

    // The companion to the criterion: reporting the base version is only interesting if the
    // overlay actually arrived. A view that ignored `extensions` would pass AC1 alone.
    expect(view.get("berti/deep-validation")?.id).toBe("berti/deep-validation");
    expect(view.isA("berti/deep-validation", "evaluative")).toBe(true);
  });

  /**
   * Flagged: `Ontology` requires a `title` and no column stores one, so the merged view has to
   * supply a constant. That it equals `CORE_ONTOLOGY.title` reached this suite by message and is
   * not in backend.md — asserted in one test that can move on its own, and read from `lib/core`
   * rather than restated, so this file does not become the third place that string lives.
   */
  it("titles the merged view with the core vocabulary's own title", async () => {
    const open = await bind("openView");
    expect(asView(await open(db(t), BASE_VERSION), "openView").ontology.title).toBe(CORE_ONTOLOGY.title);
  });
});

describe("AC2: a shadowing overlay term is reported and keeps its position", () => {
  const SHADOWED = "evaluative";

  function shadowing() {
    return [term(SHADOWED, { label: "Evaluative, locally redefined" })];
  }

  it("AC2 keeps the shadowed term's position in the merged vocabulary", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, shadowing()), "openView");

    // Terms are read back sorted by `term_id`, so the base order is known exactly. An override
    // "replaces it in place — the view keeps working … so an override keeps the position of the
    // term it shadows and the vocabulary's reading order stays stable."
    expect(
      view.ontology.terms.map((x) => x.id),
      "the overlay was appended, or the shadowed term was dropped, instead of being replaced in place",
    ).toEqual(sortedIds(baseTerms()));
  });

  it("AC2 puts the overlay's term in that position, not the base's", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, shadowing()), "openView");
    const at = view.ontology.terms.findIndex((x) => x.id === SHADOWED);

    expect(view.ontology.terms[at].label).toBe("Evaluative, locally redefined");
    expect(view.get(SHADOWED)?.label).toBe("Evaluative, locally redefined");
  });

  it("AC2 reports the shadowing", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, shadowing()), "openView");
    const ds = asDiagnostics(view.validate(), "openView(...).validate()");

    expect(ds.some((d) => d.message.includes(SHADOWED)), "no diagnostic names the shadowed term").toBe(true);
  });

  it("AC2 reports it as `bundle/ontology-mismatch`, at warning", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, shadowing()), "openView");
    const ds = asDiagnostics(view.validate(), "openView(...).validate()");

    // Pinned in its own test so a code change reds one thing. The contract cites
    // `lib/core/ontology/resolve.ts` for the reporting, and this is the code it emits: a
    // deliberate divergence from the curated core, not a structural defect.
    const mismatch = of(ds, "bundle/ontology-mismatch");
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0].severity).toBe("warning");
  });

  it("AC2 reports nothing when the overlay shadows nothing", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, overlay()), "openView");

    expect(of(asDiagnostics(view.validate(), "validate"), "bundle/ontology-mismatch")).toEqual([]);
  });

  it("AC2 appends an overlay term that shadows nothing, after the base", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, overlay()), "openView");

    expect(view.ontology.terms.map((x) => x.id)).toEqual([...sortedIds(baseTerms()), "berti/deep-validation"]);
  });

  it("AC2 keeps the position when the overlay shadows the first and last terms at once", async () => {
    const open = await bind("openView");
    const ids = sortedIds(baseTerms());
    const view = asView(
      await open(db(t), BASE_VERSION, [
        term(ids[ids.length - 1], { label: "last, redefined" }),
        term(ids[0], { label: "first, redefined" }),
      ]),
      "openView",
    );

    // Supplied last-then-first, so an implementation that re-sorts or appends shows up here.
    expect(view.ontology.terms.map((x) => x.id)).toEqual(ids);
    expect(view.ontology.terms[0].label).toBe("first, redefined");
    expect(view.ontology.terms[ids.length - 1].label).toBe("last, redefined");
    expect(of(asDiagnostics(view.validate(), "validate"), "bundle/ontology-mismatch")).toHaveLength(2);
  });
});

describe("AC5: one view, one set of answers", () => {
  /** Pairs whose answers span true, false and absent, so a wrong memo shows up somewhere. */
  const PROBES: readonly (readonly [string, string])[] = [
    ["validation", "evaluative"],
    ["evaluative", "validation"],
    ["validation", "validation"],
    ["agent", "evaluative"],
    ["berti/deep-validation", "evaluative"],
    ["berti/deep-validation", "agent"],
    ["nobody-defined-this", "agent"],
  ];

  it("AC5 answers identically across consecutive resolutions of one view", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, overlay()), "openView");

    const first = PROBES.map(([id, ancestor]) => view.isA(id, ancestor));
    const second = PROBES.map(([id, ancestor]) => view.isA(id, ancestor));
    const third = PROBES.map(([id, ancestor]) => view.isA(id, ancestor));

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("AC5 is not disturbed by the reverse question asked in between", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, overlay()), "openView");

    const before = view.isA("berti/deep-validation", "evaluative");
    view.isA("evaluative", "berti/deep-validation");
    view.ancestors("berti/deep-validation");
    view.children("evaluative");

    expect(view.isA("berti/deep-validation", "evaluative")).toBe(before);
  });

  it("AC5 answers one view's whole batch identically under concurrent callers", async () => {
    const open = await bind("openView");
    const view = asView(await open(db(t), BASE_VERSION, overlay()), "openView");
    const alone = PROBES.map(([id, ancestor]) => view.isA(id, ancestor));

    // What a resolution batch actually looks like: many callers sharing one instance.
    const runs = await Promise.all(
      Array.from({ length: 24 }, async () => PROBES.map(([id, ancestor]) => view.isA(id, ancestor))),
    );
    for (const run of runs) expect(run).toEqual(alone);
  });

  /* ---------- the converse: two opens are two instances ---------- */

  it("AC5 hands two callers two instances, never one cached by version", async () => {
    const open = await bind("openView");
    const first = asView(await open(db(t), BASE_VERSION), "openView");
    const second = asView(await open(db(t), BASE_VERSION), "openView");

    expect(
      second,
      "backend.md §T030: \"Do **not** add a module-scope cache keyed by version: that turns a " +
        'per-batch guarantee into a process-lifetime one." A cache would return this same object.',
    ).not.toBe(first);
  });

  it("AC5 gives each caller its own overlay, not the one opened before it", async () => {
    const open = await bind("openView");
    const withOverlay = asView(await open(db(t), BASE_VERSION, overlay()), "openView");
    const plain = asView(await open(db(t), BASE_VERSION), "openView");

    // The failure a module-scope cache keyed by version produces, and the reason object
    // identity alone is not enough of a test: two bundles resolving against one version would
    // silently share whichever overlay reached the cache first.
    expect(withOverlay.get("berti/deep-validation")?.id).toBe("berti/deep-validation");
    expect(plain.get("berti/deep-validation"), "the second caller inherited the first's overlay").toBeUndefined();
  });

  it("AC5 gives each caller its own overlay whichever order they open in", async () => {
    const open = await bind("openView");
    const plain = asView(await open(db(t), BASE_VERSION), "openView");
    const withOverlay = asView(await open(db(t), BASE_VERSION, overlay()), "openView");

    expect(plain.get("berti/deep-validation")).toBeUndefined();
    expect(withOverlay.get("berti/deep-validation")?.id, "the overlay never reached the second view").toBe(
      "berti/deep-validation",
    );
  });

  it("AC5 keeps two different overlays apart under one version", async () => {
    const open = await bind("openView");
    const a = asView(await open(db(t), BASE_VERSION, [term("a/one", { broader: "agent" })]), "openView");
    const b = asView(await open(db(t), BASE_VERSION, [term("b/two", { broader: "agent" })]), "openView");

    expect(a.get("a/one")?.id).toBe("a/one");
    expect(a.get("b/two")).toBeUndefined();
    expect(b.get("b/two")?.id).toBe("b/two");
    expect(b.get("a/one")).toBeUndefined();
  });

  it("AC5 does not let one view's `isA` memo answer for another", async () => {
    const open = await bind("openView");
    const rooted = asView(await open(db(t), BASE_VERSION, [term("x/probe", { broader: "validation" })]), "openView");
    expect(rooted.isA("x/probe", "evaluative")).toBe(true);

    const plain = asView(await open(db(t), BASE_VERSION), "openView");
    expect(
      plain.isA("x/probe", "evaluative"),
      "a view that never saw `x/probe` answered as though it had",
    ).toBe(false);
  });

  it("AC5 opens views on two versions without either standing in for the other", async () => {
    const add = await bind("addOntologyVersion");
    const open = await bind("openView");
    await add(db(t), { version: "0.2.0", terms: [...baseTerms(), term("critic")] });

    const older = asView(await open(db(t), "0.1.0"), "openView");
    const newer = asView(await open(db(t), "0.2.0"), "openView");

    expect(older.get("critic")).toBeUndefined();
    expect(newer.get("critic")?.id).toBe("critic");
    expect(older.ontology.version).toBe("0.1.0");
    expect(newer.ontology.version).toBe("0.2.0");
  });
});
