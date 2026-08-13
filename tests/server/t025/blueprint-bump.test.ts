/* ============================================================
   T025 — acceptance criteria (2) and (3)

   AC-2: "a blueprint release repinning a card to a new major is
   itself inferred major".
   AC-3: "a blueprint release changing only the manifest prose is
   inferred patch".

   Both run against `inferBlueprintBump(previous, next)`, whose
   inputs are the whole of what the contract lets a blueprint's
   version depend on: "A blueprint's diff is its DOT plus the set of
   card refs it pins; nothing else moves a blueprint's version."

   ── the one place this suite reads the contract twice ──
   `BlueprintSnapshot` carries no manifest, so a release that changed
   only the manifest prose reaches this function as two *identical*
   snapshots. AC-3 says that is "inferred patch"; `@/lib/core`'s
   BumpLevel also has "none", which is what `inferBump` returns for
   two identical cards. Both readings are defensible and they differ
   only in the level reported — `checkDeclaredBump` accepts a
   declared patch either way. The literal words of AC-3 are what is
   bound below, and the tension is reported to the orchestrator
   rather than settled here.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { bumpSatisfies } from "@/lib/core";

import {
  asBumpAnalysis,
  deepFreeze,
  inferBlueprintBump,
  neverSilentlyNone,
} from "./contract";
import { BASE_DOT, BASE_REFS, dotPinning, snapshot } from "./fixtures";

const WHERE = "inferBlueprintBump";

/** What the function says when neither half of the snapshot moved. */
async function baseline() {
  const fn = await inferBlueprintBump();
  return asBumpAnalysis(fn(snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, BASE_REFS)), WHERE);
}

describe("AC-2: repinning a card to a new major is a major blueprint release", () => {
  it("AC-2 infers major when a pinned card moves to a new major version", async () => {
    const fn = await inferBlueprintBump();
    const previous = snapshot(BASE_DOT, ["intake@1.0.0", "solver@1.2.0"]);
    const next = snapshot(BASE_DOT, ["intake@1.0.0", "solver@2.0.0"]);

    expect(asBumpAnalysis(fn(previous, next), WHERE).level).toBe("major");
  });

  it("AC-2 infers major when the DOT is rewritten to carry the new pin too", async () => {
    const fn = await inferBlueprintBump();
    const before: readonly string[] = ["intake@1.0.0", "solver@1.2.0"];
    const after: readonly string[] = ["intake@1.0.0", "solver@2.0.0"];
    const previous = snapshot(dotPinning(before), before);
    const next = snapshot(dotPinning(after), after);

    expect(asBumpAnalysis(fn(previous, next), WHERE).level).toBe("major");
  });

  it("AC-2 says which card forced it, because a reason nobody can act on is not a reason", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(
      fn(snapshot(BASE_DOT, ["intake@1.0.0", "solver@1.2.0"]), snapshot(BASE_DOT, ["intake@1.0.0", "solver@2.0.0"])),
      WHERE,
    );

    expect(analysis.reasons.length).toBeGreaterThan(0);
    expect(analysis.reasons.join("\n"), "the reasons name neither the card nor the version it moved to").toContain(
      "solver",
    );
  });

  it("reports a repin below a major as something, since the pinned set did move", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(
      fn(snapshot(BASE_DOT, ["intake@1.0.0", "solver@1.2.0"]), snapshot(BASE_DOT, ["intake@1.0.0", "solver@1.3.0"])),
      WHERE,
    );

    expect(analysis, "a changed pin is part of the blueprint's diff and cannot read as no change").not.toEqual(
      await baseline(),
    );
  });

  it("reports a card added to the pinned set", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(
      fn(snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, [...BASE_REFS, "reviewer@1.0.0"])),
      WHERE,
    );
    expect(analysis).not.toEqual(await baseline());
  });

  it("reports a card dropped from the pinned set", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(fn(snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, ["intake@1.0.0"])), WHERE);
    expect(analysis).not.toEqual(await baseline());
  });
});

describe("AC-3: a release that moved neither the DOT nor the pins", () => {
  it("AC-3 infers patch when only the manifest prose changed, which the snapshot does not carry", async () => {
    const fn = await inferBlueprintBump();
    // Two identical snapshots is exactly what a prose-only release looks like from here.
    expect(asBumpAnalysis(fn(snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, BASE_REFS)), WHERE).level).toBe(
      "patch",
    );
  });

  it("AC-3 never prices a prose-only release above a patch", async () => {
    const fn = await inferBlueprintBump();
    const { level } = asBumpAnalysis(fn(snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, BASE_REFS)), WHERE);

    // `bumpSatisfies(a, b)` is "a is at least b", so this reads: a patch is enough.
    expect(
      bumpSatisfies("patch", level),
      `a release whose DOT and pins are unchanged was priced at ${level}; the contract says ` +
        `"nothing else moves a blueprint's version"`,
    ).toBe(true);
  });

  it("AC-3 ignores anything else hanging off the snapshot object", async () => {
    const fn = await inferBlueprintBump();
    const plain = snapshot(BASE_DOT, BASE_REFS);
    const decorated = {
      ...plain,
      manifest: { title: "Rewritten from top to bottom", summary: "Every word of it." },
      digest: "sha256:0000",
      updatedAt: "2026-08-13T00:00:00.000Z",
    };

    expect(
      asBumpAnalysis(fn(plain, decorated), WHERE),
      "a field outside `dot` and `cardRefs` moved a blueprint's version",
    ).toEqual(asBumpAnalysis(fn(plain, plain), WHERE));
  });
});

describe("inferBlueprintBump: the DOT half of the diff", () => {
  it("reports a DOT that changed while the pins stayed put", async () => {
    const fn = await inferBlueprintBump();
    const rewired = ["digraph blueprint {", "  intake -> solver;", "  solver -> intake;", "}"].join("\n");
    const analysis = asBumpAnalysis(fn(snapshot(BASE_DOT, BASE_REFS), snapshot(rewired, BASE_REFS)), WHERE);

    expect(analysis, "the DOT is half the blueprint's diff").not.toEqual(await baseline());
    expect(analysis.reasons.length).toBeGreaterThan(0);
  });

  it("reports a DOT that appeared where there was none", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(fn(snapshot("", []), snapshot(BASE_DOT, [])), WHERE);
    expect(analysis).not.toEqual(asBumpAnalysis(fn(snapshot("", []), snapshot("", [])), WHERE));
  });

  it("treats two empty blueprints as a release that moved nothing", async () => {
    const fn = await inferBlueprintBump();
    expect(asBumpAnalysis(fn(snapshot("", []), snapshot("", [])), WHERE)).toEqual(await baseline());
  });

  it("reports a DOT that differs only in a non-ASCII label", async () => {
    const fn = await inferBlueprintBump();
    const before = ['digraph blueprint {', '  intake [label="café"];', "}"].join("\n");
    const after = ['digraph blueprint {', '  intake [label="caffè"];', "}"].join("\n");
    const analysis = asBumpAnalysis(fn(snapshot(before, []), snapshot(after, [])), WHERE);

    expect(analysis).not.toEqual(asBumpAnalysis(fn(snapshot(before, []), snapshot(before, [])), WHERE));
  });

  it("reads an identical non-ASCII DOT as identical", async () => {
    const fn = await inferBlueprintBump();
    const dot = ['digraph 蓝图 {', '  收集 [label="收集 📥"];', "  收集 -> 求解;", "}"].join("\n");
    expect(asBumpAnalysis(fn(snapshot(dot, []), snapshot(dot, [])), WHERE)).toEqual(await baseline());
  });
});

describe("inferBlueprintBump: `the set of card refs` is a set", () => {
  it("reads a reordered pin list as the same set", async () => {
    const fn = await inferBlueprintBump();
    const previous = snapshot(BASE_DOT, ["intake@1.0.0", "solver@1.2.0"]);
    const next = snapshot(BASE_DOT, ["solver@1.2.0", "intake@1.0.0"]);

    expect(
      asBumpAnalysis(fn(previous, next), WHERE),
      "the contract says the diff is the *set* of card refs, and a set has no order",
    ).toEqual(await baseline());
  });

  it("reads a repeated pin as the same set", async () => {
    const fn = await inferBlueprintBump();
    const previous = snapshot(BASE_DOT, ["intake@1.0.0", "solver@1.2.0"]);
    const next = snapshot(BASE_DOT, ["intake@1.0.0", "solver@1.2.0", "solver@1.2.0", "intake@1.0.0"]);

    expect(asBumpAnalysis(fn(previous, next), WHERE)).toEqual(await baseline());
  });

  it("reads two empty pin lists as the same set", async () => {
    const fn = await inferBlueprintBump();
    expect(asBumpAnalysis(fn(snapshot(BASE_DOT, []), snapshot(BASE_DOT, [])), WHERE)).toEqual(await baseline());
  });

  it("reports a pin whose id is non-ASCII", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(
      fn(snapshot(BASE_DOT, ["café-solver@1.0.0"]), snapshot(BASE_DOT, ["café-solver@2.0.0"])),
      WHERE,
    );
    expect(analysis.level).toBe("major");
  });

  it("reports a pin that is the empty string, rather than dropping it", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(fn(snapshot(BASE_DOT, []), snapshot(BASE_DOT, [""])), WHERE);
    expect(analysis, "an empty ref is a member of the set like any other").not.toEqual(await baseline());
  });
});

describe("inferBlueprintBump: unreadable input is never `nothing changed`", () => {
  it.each([
    { name: "undefined", value: undefined },
    { name: "null", value: null },
    { name: "a string", value: "digraph {}" },
    { name: "a snapshot with no dot", value: { cardRefs: [] } },
    { name: "a snapshot with no cardRefs", value: { dot: "digraph {}" } },
    { name: "a snapshot whose cardRefs is a string", value: { dot: "digraph {}", cardRefs: "solver@1.0.0" } },
    { name: "a snapshot whose dot is a number", value: { dot: 42, cardRefs: [] } },
  ])("does not answer `none` when the previous snapshot is $name", async ({ value }) => {
    const fn = await inferBlueprintBump();
    neverSilentlyNone(() => fn(value, snapshot(BASE_DOT, BASE_REFS)), WHERE);
  });

  it.each([
    { name: "undefined", value: undefined },
    { name: "null", value: null },
    { name: "a snapshot with no dot", value: { cardRefs: [] } },
  ])("does not answer `none` when the next snapshot is $name", async ({ value }) => {
    const fn = await inferBlueprintBump();
    neverSilentlyNone(() => fn(snapshot(BASE_DOT, BASE_REFS), value), WHERE);
  });

  it("does not answer `none` when called with nothing at all", async () => {
    const fn = await inferBlueprintBump();
    neverSilentlyNone(() => fn(), WHERE);
  });
});

describe("inferBlueprintBump: purity", () => {
  it("does not mutate the snapshots it was handed", async () => {
    const fn = await inferBlueprintBump();
    // Frozen, so an in-place `sort()` over `cardRefs` — the obvious way to compare two
    // ref lists as sets — throws instead of silently rewriting a caller's release record.
    const previous = deepFreeze(snapshot(BASE_DOT, ["solver@1.2.0", "intake@1.0.0"]));
    const next = deepFreeze(snapshot(BASE_DOT, ["solver@2.0.0", "intake@1.0.0"]));

    expect(() => fn(previous, next)).not.toThrow();
    expect(previous.cardRefs).toEqual(["solver@1.2.0", "intake@1.0.0"]);
    expect(next.cardRefs).toEqual(["solver@2.0.0", "intake@1.0.0"]);
  });
});
