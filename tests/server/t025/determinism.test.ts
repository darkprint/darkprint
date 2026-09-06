/* ============================================================
   T025 — acceptance criterion (5)

   AC-5: "the same two inputs always infer the same level".

   Read as strictly as it is written: *always*, so a repeat, a fresh
   pair of objects carrying the same content, an interleaved caller
   working on something else and a concurrent one all get the same
   answer. The failure this guards against is a module-level
   accumulator — the shape `@/lib/core`'s `inferBump` avoids by
   building its `reasons` array inside the call — where the second
   caller inherits the first one's reasons and a blueprint is priced
   at whatever the request before it changed.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { type BumpAnalysis } from "@/lib/core";

import {
  asBumpAnalysis,
  asDiagnostics,
  checkDeclaredBump,
  inferBlueprintBump,
  type UnknownFn,
} from "./contract";
import { BASE_DOT, BASE_REFS, snapshot } from "./fixtures";

const REPEATS = 25;

/** The pair every blueprint case below is compared against: a card repinned to a new major. */
function blueprintPair() {
  return [snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, ["intake@1.0.0", "solver@2.0.0"])] as const;
}

/** A second, different blueprint pair, so an interleaved caller has something else to ask. */
function otherBlueprintPair() {
  return [snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, [...BASE_REFS, "reviewer@1.0.0"])] as const;
}

/* The two ontology pairs stood here, and AC-5's ontology arms with them: `inferOntologyBump`
   was removed on 2026-09-05 when the owner repealed vocabulary versioning (§11.0 Q26). AC-5
   itself survives whole — it is a claim about the subject being stateless, and it is still
   held below over the two subjects that remain. */

function repeat(fn: UnknownFn, previous: unknown, next: unknown, where: string): BumpAnalysis[] {
  return Array.from({ length: REPEATS }, () => asBumpAnalysis(fn(previous, next), where));
}

describe("AC-5: the same two inputs always infer the same level", () => {
  it("AC-5 answers a repeated blueprint comparison identically", async () => {
    const fn = await inferBlueprintBump();
    const [previous, next] = blueprintPair();
    const runs = repeat(fn, previous, next, "inferBlueprintBump");

    for (const run of runs) expect(run).toEqual(runs[0]);
  });

  it("AC-5 does not depend on object identity: equal content, equal answer", async () => {
    const fn = await inferBlueprintBump();
    const first = asBumpAnalysis(fn(...blueprintPair()), "inferBlueprintBump");
    const second = asBumpAnalysis(fn(...blueprintPair()), "inferBlueprintBump");

    expect(second, "two structurally equal snapshots were priced differently").toEqual(first);
  });

  it("AC-5 keeps two interleaved blueprint comparisons apart", async () => {
    const fn = await inferBlueprintBump();
    const alone = asBumpAnalysis(fn(...blueprintPair()), "inferBlueprintBump");
    const otherAlone = asBumpAnalysis(fn(...otherBlueprintPair()), "inferBlueprintBump");

    for (let i = 0; i < REPEATS; i += 1) {
      expect(asBumpAnalysis(fn(...blueprintPair()), "inferBlueprintBump")).toEqual(alone);
      expect(asBumpAnalysis(fn(...otherBlueprintPair()), "inferBlueprintBump")).toEqual(otherAlone);
    }
  });

  it("AC-5 gives concurrent callers the same answers a lone caller gets", async () => {
    const blueprint = await inferBlueprintBump();
    const blueprintAlone = asBumpAnalysis(blueprint(...blueprintPair()), "inferBlueprintBump");
    const otherAlone = asBumpAnalysis(blueprint(...otherBlueprintPair()), "inferBlueprintBump");

    /* Sixty callers still, over the two pairs that are left rather than the three there
       were: an accumulator shared between callers is what this cell is looking for, and it
       needs two DIFFERENT questions in flight to find one, not three. */
    const work = Array.from({ length: 60 }, (_, i) => async () => {
      if (i % 2 === 0) return { kind: "blueprint", got: asBumpAnalysis(blueprint(...blueprintPair()), "inferBlueprintBump") };
      return { kind: "other", got: asBumpAnalysis(blueprint(...otherBlueprintPair()), "inferBlueprintBump") };
    });

    const expected: Record<string, BumpAnalysis> = {
      blueprint: blueprintAlone,
      other: otherAlone,
    };
    for (const { kind, got } of await Promise.all(work.map((run) => run()))) {
      expect(got, `a concurrent caller got a different ${kind} answer`).toEqual(expected[kind]);
    }
  });

  it("AC-5 is not disturbed by the reverse comparison running in between", async () => {
    const fn = await inferBlueprintBump();
    const [previous, next] = blueprintPair();
    const forward = asBumpAnalysis(fn(previous, next), "inferBlueprintBump");

    asBumpAnalysis(fn(next, previous), "inferBlueprintBump");

    expect(asBumpAnalysis(fn(previous, next), "inferBlueprintBump")).toEqual(forward);
  });

  it("AC-5 gives every caller its own reasons array", async () => {
    const fn = await inferBlueprintBump();
    const first = asBumpAnalysis(fn(...blueprintPair()), "inferBlueprintBump");
    const before = [...first.reasons];

    try {
      first.reasons.push("injected by a previous caller");
    } catch {
      return; // a frozen result is a fine way to be immune to this
    }

    expect(asBumpAnalysis(fn(...blueprintPair()), "inferBlueprintBump").reasons).toEqual(before);
  });

  it("AC-5 answers a repeated `checkDeclaredBump` identically", async () => {
    const fn = await checkDeclaredBump();
    const inferred: BumpAnalysis = { level: "major", reasons: ["output `answer` was removed"] };
    const runs = Array.from({ length: REPEATS }, () =>
      asDiagnostics(fn("card", "1.0.0", "1.1.0", inferred), "checkDeclaredBump"),
    );

    for (const run of runs) expect(run).toEqual(runs[0]);
  });
});
