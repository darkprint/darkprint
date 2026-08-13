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
  inferOntologyBump,
  type UnknownFn,
} from "./contract";
import { BASE_DOT, BASE_REFS, snapshot, term } from "./fixtures";

const REPEATS = 25;

/** The pair every blueprint case below is compared against: a card repinned to a new major. */
function blueprintPair() {
  return [snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, ["intake@1.0.0", "solver@2.0.0"])] as const;
}

/** A second, different blueprint pair, so an interleaved caller has something else to ask. */
function otherBlueprintPair() {
  return [snapshot(BASE_DOT, BASE_REFS), snapshot(BASE_DOT, [...BASE_REFS, "reviewer@1.0.0"])] as const;
}

function ontologyPair() {
  return [
    [term("agent"), term("validation")],
    [term("agent")],
  ] as const;
}

function otherOntologyPair() {
  return [
    [term("agent"), term("validation")],
    [term("agent"), term("validation"), term("critic")],
  ] as const;
}

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

  it("AC-5 answers a repeated ontology comparison identically", async () => {
    const fn = await inferOntologyBump();
    const [previous, next] = ontologyPair();
    const runs = repeat(fn, previous, next, "inferOntologyBump");

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

  it("AC-5 keeps two interleaved ontology comparisons apart", async () => {
    const fn = await inferOntologyBump();
    const alone = asBumpAnalysis(fn(...ontologyPair()), "inferOntologyBump");
    const otherAlone = asBumpAnalysis(fn(...otherOntologyPair()), "inferOntologyBump");

    for (let i = 0; i < REPEATS; i += 1) {
      expect(asBumpAnalysis(fn(...ontologyPair()), "inferOntologyBump")).toEqual(alone);
      expect(asBumpAnalysis(fn(...otherOntologyPair()), "inferOntologyBump")).toEqual(otherAlone);
    }
  });

  it("AC-5 gives concurrent callers the same answers a lone caller gets", async () => {
    const blueprint = await inferBlueprintBump();
    const ontology = await inferOntologyBump();
    const blueprintAlone = asBumpAnalysis(blueprint(...blueprintPair()), "inferBlueprintBump");
    const ontologyAlone = asBumpAnalysis(ontology(...ontologyPair()), "inferOntologyBump");
    const otherAlone = asBumpAnalysis(blueprint(...otherBlueprintPair()), "inferBlueprintBump");

    const work = Array.from({ length: 60 }, (_, i) => async () => {
      if (i % 3 === 0) return { kind: "blueprint", got: asBumpAnalysis(blueprint(...blueprintPair()), "inferBlueprintBump") };
      if (i % 3 === 1) return { kind: "other", got: asBumpAnalysis(blueprint(...otherBlueprintPair()), "inferBlueprintBump") };
      return { kind: "ontology", got: asBumpAnalysis(ontology(...ontologyPair()), "inferOntologyBump") };
    });

    const expected: Record<string, BumpAnalysis> = {
      blueprint: blueprintAlone,
      other: otherAlone,
      ontology: ontologyAlone,
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
      asDiagnostics(fn("1.0.0", "1.1.0", inferred), "checkDeclaredBump"),
    );

    for (const run of runs) expect(run).toEqual(runs[0]);
  });
});
