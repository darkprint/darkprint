/* ============================================================
   T025 — acceptance criteria (2) and (3)

   AC-2: "a blueprint release repinning a card to a new major is
   itself inferred major".
   AC-3: "two identical snapshots infer `none`, not `patch` — a
   `BlueprintSnapshot` is exactly what identity is computed over, so
   a change it cannot see is a change that does not move the version,
   and prose lives in the manifest which the snapshot deliberately
   excludes".

   Both run against `inferBlueprintBump(previous, next)`, whose
   inputs are the whole of what the contract lets a blueprint's
   version depend on: "A blueprint's diff is its DOT plus the set of
   card refs it pins; nothing else moves a blueprint's version."

   AC-3 used to read "a blueprint release changing only the manifest
   prose is inferred patch", and the first round of these tests bound
   those literal words while reporting that `none` was equally
   available and that `checkDeclaredBump` would accept a declared
   patch under either. The ruling went to `none`, which is also what
   `@/lib/core`'s `inferBump` returns for two identical cards, so the
   two halves of the engine now agree.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { bumpSatisfies } from "@/lib/core";

import {
  asBumpAnalysis,
  asDiagnostics,
  checkDeclaredBump,
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

  // A repin below a major, a card joining and a card leaving used to be asserted here as
  // "not the baseline". The multiset block below pins each to an exact level instead, which
  // strictly dominates, so they are not repeated.
});

describe("AC-3: a release that moved neither the DOT nor the pins", () => {
  it("AC-3 infers none from two identical snapshots, which is what a prose-only release is here", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(fn(snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, BASE_REFS)), WHERE);

    expect(analysis.level).toBe("none");
    // `@/lib/core`'s `inferBump` returns `{ level: "none", reasons: [] }` for two identical
    // cards. Nothing moved, so there is nothing to give a reason for.
    expect(analysis.reasons).toEqual([]);
  });

  it("AC-3 never prices an unmoved snapshot above a patch", async () => {
    const fn = await inferBlueprintBump();
    const { level } = asBumpAnalysis(fn(snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, BASE_REFS)), WHERE);

    // The weaker companion guard, kept: `bumpSatisfies(a, b)` is "a is at least b", so this
    // reads as "a patch would be enough". It fails on minor and major independently of
    // whether the floor is `none` or `patch`, which is what made it worth keeping when the
    // floor was still open.
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

/* ============================================================
   The pin collection is a MULTISET, compared order-independently.

   This block replaces one that read `cardRefs` as a deduplicated
   set. That assertion was wrong, and it is worth being precise about
   why, because the protocol treats the two cases differently: a test
   that changes to match the code is a failed task, and this is the
   other thing — the contract was silent, two agents who could not
   see each other read the silence in opposite directions, and the
   contract has been amended. The reading it settled on is not a
   preference. It is forced by what identity is computed over, and
   all three facts are checked in this tree rather than taken from
   the amendment:

     `lib/core/hash/digest.ts:62` — `cardDigests.slice().sort(byCodeUnit)`.
       It **sorts**, so order can never move the digest; it does
       **not** deduplicate, so multiplicity always can.
     `lib/db/schema.ts:156` — "pinning one card twice is a different
       digest from pinning it once, and deduplicating here would
       erase that."
     `lib/core/bundle/resolve.ts:749` — the digest is fed
       `nodes.map((n) => n.digest)`: one entry per node, in node
       order. Two nodes pinning different versions of one card is an
       ordinary graph, not a degenerate input.

   So if identity distinguishes two releases, inference has to as
   well — otherwise a release whose bytes moved is not required to
   move its version, and B-04 has every release carry a declared
   semver *and* a computed digest that cannot disagree.
   ============================================================ */
describe("inferBlueprintBump: the pin collection is a multiset, compared order-independently", () => {
  it("does not let the order of the pin list change the answer", async () => {
    const fn = await inferBlueprintBump();
    const previous = snapshot(BASE_DOT, ["intake@1.0.0", "solver@1.2.0"]);
    const next = snapshot(BASE_DOT, ["solver@1.2.0", "intake@1.0.0"]);

    expect(
      asBumpAnalysis(fn(previous, next), WHERE),
      "`bundleDigest` sorts before hashing, so node order cannot move a version",
    ).toEqual(await baseline());
  });

  /**
   * The property `bundleDigest`'s sort guarantees, and the easiest one to lose: pairing an
   * id's versions by first occurrence rather than sorting them makes the answer depend on
   * which node came first. It cost this contract a round — `[a@1] → [a@1, a@2]` inferred
   * patch while `[a@1] → [a@2, a@1]` inferred major, over the same DOT and the same members.
   */
  it("gives one answer however the added version is ordered", async () => {
    const fn = await inferBlueprintBump();
    const previous = snapshot(BASE_DOT, ["solver@1.0.0"]);

    const appended = asBumpAnalysis(fn(previous, snapshot(BASE_DOT, ["solver@1.0.0", "solver@2.0.0"])), WHERE);
    const prepended = asBumpAnalysis(fn(previous, snapshot(BASE_DOT, ["solver@2.0.0", "solver@1.0.0"])), WHERE);

    expect(prepended, "node order alone decided the level").toEqual(appended);
    expect(appended.level, "a pin was added, so the digest moved").not.toBe("none");
  });

  it("gives one answer however a longer pin list is permuted", async () => {
    const fn = await inferBlueprintBump();
    const members = ["intake@1.0.0", "solver@1.2.0", "solver@2.0.0", "reviewer@0.9.0"];
    const previous = snapshot(BASE_DOT, ["intake@1.0.0", "solver@1.2.0", "reviewer@0.9.0"]);

    // Every rotation is the same multiset. Rotations rather than a shuffle: the fixture has
    // to be the same on every run, and `lib/core` is isomorphic code with no `Math.random()`.
    const rotations = members.map((_, i) => [...members.slice(i), ...members.slice(0, i)]);
    const answers = rotations.map((refs) => asBumpAnalysis(fn(previous, snapshot(BASE_DOT, refs)), WHERE));

    for (const answer of answers) expect(answer).toEqual(answers[0]);
  });

  it("prices a pure duplicate at least a patch, because the digest moved", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(
      fn(snapshot(BASE_DOT, ["solver@1.0.0"]), snapshot(BASE_DOT, ["solver@1.0.0", "solver@1.0.0"])),
      WHERE,
    );

    expect(
      analysis.level,
      "`cardDigests` is an array: pinning one card twice is a different digest from pinning " +
        "it once, so the release must be allowed to move its version",
    ).not.toBe("none");
    expect(bumpSatisfies(analysis.level, "patch"), "at least a patch").toBe(true);
  });

  it("prices dropping one of two identical pins at least a patch", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(
      fn(snapshot(BASE_DOT, ["solver@1.0.0", "solver@1.0.0"]), snapshot(BASE_DOT, ["solver@1.0.0"])),
      WHERE,
    );

    expect(analysis.level, "multiplicity fell, so the digest moved").not.toBe("none");
    expect(bumpSatisfies(analysis.level, "patch")).toBe(true);
  });

  it("infers major when a second node pinning the same card is repinned across a major", async () => {
    const fn = await inferBlueprintBump();
    // Two nodes instantiate `solver`, one at 1.0.0 and one at 2.0.0, and the second moves to
    // 3.0.0. Pairing by first-occurrence-per-id hides this entirely: it compares 1.0.0 to
    // 1.0.0, sees nothing, and a major repin ships as a patch release.
    const analysis = asBumpAnalysis(
      fn(
        snapshot(BASE_DOT, ["solver@1.0.0", "solver@2.0.0"]),
        snapshot(BASE_DOT, ["solver@1.0.0", "solver@3.0.0"]),
      ),
      WHERE,
    );

    expect(analysis.level).toBe("major");
  });

  it("does not let that major repin ship as a patch release", async () => {
    // The whole point of the level, end to end: AC-2's inference feeding AC-1's refusal.
    const infer = await inferBlueprintBump();
    const check = await checkDeclaredBump();
    const inferred = asBumpAnalysis(
      infer(
        snapshot(BASE_DOT, ["solver@1.0.0", "solver@2.0.0"]),
        snapshot(BASE_DOT, ["solver@1.0.0", "solver@3.0.0"]),
      ),
      WHERE,
    );

    const ds = asDiagnostics(check("bundle", "1.0.0", "1.0.1", inferred), "checkDeclaredBump");
    expect(ds.length, "a major repin declared as a patch has to be refused").toBe(1);
    expect(ds[0].code).toBe("bundle/version-bump-too-small");
  });

  it("prices a moved version by `declaredBump` on that pair", async () => {
    const fn = await inferBlueprintBump();
    const at = async (from: string, to: string) =>
      asBumpAnalysis(fn(snapshot(BASE_DOT, [`solver@${from}`]), snapshot(BASE_DOT, [`solver@${to}`])), WHERE).level;

    expect(await at("1.2.0", "2.0.0")).toBe("major");
    expect(await at("1.2.0", "1.3.0")).toBe("minor");
    expect(await at("1.2.0", "1.2.1")).toBe("patch");
  });

  it("does not answer `none` when a pin is rolled back to an older version", async () => {
    const fn = await inferBlueprintBump();
    // `declaredBump("2.0.0", "1.0.0")` is `none` — a downgrade declares no bump — but the
    // pin moved and so did `cardDigests`. Only the floor is asserted: the contract prices a
    // moved version by `declaredBump` and separately argues from identity, and those two
    // sentences meet on exactly this case. Reported rather than resolved here.
    const analysis = asBumpAnalysis(
      fn(snapshot(BASE_DOT, ["solver@2.0.0"]), snapshot(BASE_DOT, ["solver@1.0.0"])),
      WHERE,
    );

    expect(analysis.level).not.toBe("none");
  });

  it("infers major when an id loses every one of its occurrences", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(
      fn(snapshot(BASE_DOT, ["solver@1.0.0", "solver@2.0.0"]), snapshot(BASE_DOT, ["intake@1.0.0"])),
      WHERE,
    );
    expect(analysis.level).toBe("major");
  });

  it("infers minor when a new id joins the pin list", async () => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(
      fn(snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, [...BASE_REFS, "reviewer@1.0.0"])),
      WHERE,
    );
    expect(analysis.level).toBe("minor");
  });

  it("reads two empty pin lists as no change", async () => {
    const fn = await inferBlueprintBump();
    expect(asBumpAnalysis(fn(snapshot(BASE_DOT, []), snapshot(BASE_DOT, [])), WHERE)).toEqual(await baseline());
  });
});

describe("inferBlueprintBump: a ref the parser rejects is still a member", () => {
  // `parseCardRef`'s id rule is ASCII (`lib/core/card/schema.ts`), so none of these pair by
  // id. The contract pins the floor and not the level: "never answer `none` for input you
  // could not read. Deferring to the validator is a defensible policy; silently accepting is
  // not." So each of these asserts the floor exactly, and nothing above it.
  it.each([
    { name: "an unparseable ref repinned", previous: ["café-solver@1.0.0"], next: ["café-solver@2.0.0"] },
    { name: "an unparseable ref disappearing", previous: ["café-solver@1.0.0"], next: [] },
    { name: "an unparseable ref appearing", previous: [], next: ["café-solver@1.0.0"] },
    { name: "a ref with no version at all", previous: ["solver"], next: ["solver@1.0.0"] },
    { name: "a ref pinned to `latest`", previous: ["solver@latest"], next: ["solver@1.0.0"] },
    { name: "the empty string as a ref", previous: [], next: [""] },
    { name: "a repeated pin added at a conflicting version", previous: ["solver@1.0.0"], next: ["solver@1.0.0", "sölver@2.0.0"] },
  ])("does not answer `none` for $name", async ({ previous, next }) => {
    const fn = await inferBlueprintBump();
    const analysis = asBumpAnalysis(fn(snapshot(BASE_DOT, previous), snapshot(BASE_DOT, next)), WHERE);

    expect(analysis.level, "a member of the collection moved, so the digest did").not.toBe("none");
  });

  it("still compares order-independently when the refs do not parse", async () => {
    const fn = await inferBlueprintBump();
    const previous = snapshot(BASE_DOT, ["café-solver@1.0.0", "solver@1.0.0"]);
    const forward = asBumpAnalysis(fn(previous, snapshot(BASE_DOT, ["café-solver@1.0.0", "solver@1.0.0"])), WHERE);
    const reversed = asBumpAnalysis(fn(previous, snapshot(BASE_DOT, ["solver@1.0.0", "café-solver@1.0.0"])), WHERE);

    expect(reversed).toEqual(forward);
    expect(forward, "nothing moved").toEqual(await baseline());
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
