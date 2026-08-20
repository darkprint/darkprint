/* ============================================================
   T040 AC2 and the service boundary — degradation

   AC2 as ruled (D-40-01, reading (a)): "the verdict stays the
   caller's". `bundleProgress` lives in `components/upload/progress.ts`,
   which is Forbidden to T040 and re-exported from nowhere, and
   `LoadBundleResult` has no field that could carry a verdict — so
   the criterion is a property of what IS returned:

       blueprint.nodes.length === 3
       blueprint.graph.ids.length === 8
       every error in AWAITING_CARD or a shadow of it
       an autonomy class that differs from the whole bundle's

   **This file does not import `progress.ts`.** An earlier draft
   did, as an oracle for the three verdicts, and that was wrong for
   a reason worth keeping: it would bind these assertions to a
   module the implementation may not call, so a red could mean
   "T040 is wrong" or "that module changed" and nothing in the
   failure would say which. The predicate below is computed from
   the returned object using the criterion's own words.

   ── the four input classes ──
   What makes degradation a service-boundary question rather than
   an engine question is the set of inputs the boundary has to
   answer for, and the class this file exists to stop going
   unwritten is the third:

     1. an input that does not parse
     2. an input that parses and resolves nothing
     3. an input that RESOLVES WITH ERRORS — the answer that
        carries an analysis and error-severity diagnostics together
     4. an input that resolves with nothing to say

   Class 3 is the one a suite drifts away from. Unparseable DOT is
   easy to exhibit and a clean bundle is easy to exhibit, and then
   the whole middle — B-03's "a bundle that resolves with errors is
   an answer" — is covered by nothing. T090's blind author found
   exactly this hole in its own AC4.
   ============================================================ */

import { describe, expect, it } from "vitest";

import type { Diagnostic } from "@/lib/core";

import {
  asLoadBundleResult,
  bind,
  errorsOf,
  expectSortedLikeCore,
  returning,
  type LoadBundleResultShape,
} from "./contract";
import {
  EIGHT_NODE_BUNDLE,
  NOT_A_GRAPH,
  UNPARSEABLE_LINE_2,
  caseFor,
  cleanInput,
  keepCards,
  withDot,
} from "./fixtures";

/**
 * The two resolution errors that mean "not written yet" rather than "wrong", quoted from the
 * criterion rather than imported from the module that defines them.
 *
 * Both are raised per DOT node statement and both say the same thing about the author's
 * state: the graph names a node and the card behind it is not in the folder — either because
 * no file carries that ref (`bundle/missing-card`) or because the pointer is not yet a pinned
 * `id@version` (`bundle/unpinned-card`).
 */
const AWAITING_CARD: ReadonlySet<string> = new Set([
  "bundle/missing-card",
  "bundle/unpinned-card",
]);

/**
 * Whether an error is the *shadow* of a card that is not written yet.
 *
 * There is exactly one such code. `bundle/missing-dependency` fires on a card that IS in the
 * folder: it declares `dependencies: [x]` and the resolver looks for an incoming edge from a
 * node holding that card. When the predecessor's own card has not been written, that
 * predecessor is left out of the supply list, so the dependency reads as unmet purely because
 * the file on the other end of the edge does not exist yet.
 *
 * **Decided from the graph rather than from the message**, which is the only way it can be
 * decided from a returned object: the diagnostic carries `location.nodeId`, so the question
 * "could an unwritten card have caused this?" is answered by asking whether that node has a
 * predecessor with no card. A bundle where every node has its card can never take this
 * branch, which is what keeps a genuine unmet dependency an error in a finished blueprint.
 */
function shadowsAnUnwrittenCard(
  diagnostic: Diagnostic,
  blueprint: NonNullable<LoadBundleResultShape["blueprint"]>,
  carded: ReadonlySet<string>,
): boolean {
  if (diagnostic.code !== "bundle/missing-dependency") return false;
  const nodeId = diagnostic.location?.nodeId;
  if (nodeId === undefined) return false;
  return blueprint.graph.predecessors(nodeId).some((id) => !carded.has(id));
}

function cardedIds(blueprint: NonNullable<LoadBundleResultShape["blueprint"]>): Set<string> {
  return new Set(blueprint.nodes.map((node) => node.nodeId));
}

describe("AC2: three of eight nodes carded", () => {
  it("returns an analysis over the three, and the graph keeps all eight", async () => {
    const validateBundle = await bind("validateBundle");
    const input = keepCards(caseFor(EIGHT_NODE_BUNDLE).input, 3);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(3 of 8)"),
      "validateBundle(3 of 8)",
    );

    expect(result.analysis, "AC2: an analysis, not an error").toBeDefined();
    expect(result.blueprint, "AC2: a blueprint, degraded rather than withheld").toBeDefined();

    /* `blueprint.nodes` holds only what resolved; `graph.ids` keeps every id the DOT wrote.
       The difference between the two numbers is the whole of degradation, and a module that
       reported the same figure twice would have collapsed it. */
    expect(result.blueprint?.nodes).toHaveLength(3);
    expect(result.blueprint?.graph.ids).toHaveLength(8);

    /* Doc 3 §6 divides by *nodi totali*, so an analysis "over the three" is one whose fraction
       is still taken over eight with five recorded as uncarded. An implementation that dropped
       the five would produce a different and wrong number while passing both assertions above. */
    const contributions = result.analysis?.autonomy.contributions ?? [];
    expect(contributions).toHaveLength(8);
    expect(contributions.filter((c) => c.resolved)).toHaveLength(3);
  });

  /* The criterion's third clause, quantified over the errors rather than written per code, so
     a sixth error path added later reds instead of slipping through. A bundle that is merely
     UNFINISHED complains about nothing except the missing cards and their shadows; an error
     outside that set means the author wrote something that contradicts something else they
     wrote, and the two states are the distinction `progress.ts` exists to keep. */
  it("complains only about the cards that are not written yet", async () => {
    const validateBundle = await bind("validateBundle");
    const input = keepCards(caseFor(EIGHT_NODE_BUNDLE).input, 3);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(3 of 8)"),
      "validateBundle(3 of 8)",
    );
    const blueprint = result.blueprint;
    expect(blueprint).toBeDefined();
    if (blueprint === undefined) return;

    const carded = cardedIds(blueprint);
    const errors = errorsOf(result.diagnostics);

    expect(errors.length, "an unfinished bundle has something to say").toBeGreaterThan(0);
    const stray = errors.filter(
      (d) => !AWAITING_CARD.has(d.code) && !shadowsAnUnwrittenCard(d, blueprint, carded),
    );
    expect(
      stray.map((d) => `${d.code} ${d.message}`),
      "every error here is a card that is not written yet, or a direct consequence of one",
    ).toEqual([]);

    /* And the set is not vacuously clean: both shapes are present, so the predicate above is
       doing work on real inputs rather than quantifying over one code. */
    expect(errors.filter((d) => AWAITING_CARD.has(d.code)).length).toBeGreaterThan(0);
    expect(
      errors.filter((d) => shadowsAnUnwrittenCard(d, blueprint, carded)).length,
    ).toBeGreaterThan(0);
  });

  /* The reading is a DIFFERENT reading, not merely a present one — the criterion's fourth
     clause. The whole bundle is `closed-loop`; truncated to three cards it is `assisted`,
     because five of eight nodes now have no card to read a `type` off. A module answering with
     the full bundle's numbers — from a cache, or by resolving something other than what it was
     handed — passes every "analysis is defined" assertion and reds here. */
  it("answers with the truncated bundle's reading and not the whole bundle's", async () => {
    const validateBundle = await bind("validateBundle");
    const whole = caseFor(EIGHT_NODE_BUNDLE).input;

    const full = asLoadBundleResult(
      returning(() => validateBundle(whole), "validateBundle(8 of 8)"),
      "validateBundle(8 of 8)",
    );
    const partial = asLoadBundleResult(
      returning(() => validateBundle(keepCards(whole, 3)), "validateBundle(3 of 8)"),
      "validateBundle(3 of 8)",
    );

    expect(full.analysis?.autonomy.autonomyClass).toBe("closed-loop");
    expect(partial.analysis?.autonomy.autonomyClass).toBe("assisted");
    expect(partial.analysis?.autonomy.autonomyClass).not.toBe(
      full.analysis?.autonomy.autonomyClass,
    );
    expect(partial.blueprint?.digest).not.toBe(full.blueprint?.digest);
  });

  /* B-03, and the class this file was written to stop going unwritten: errors and an analysis
     in the same answer. A module that refused as soon as it saw an error-severity diagnostic
     would pass every AC3 test and every AC1 test and fail only this one. */
  it("carries error-severity diagnostics and an analysis in one answer", async () => {
    const validateBundle = await bind("validateBundle");
    const input = keepCards(caseFor(EIGHT_NODE_BUNDLE).input, 3);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(3 of 8)"),
      "validateBundle(3 of 8)",
    );

    expect(errorsOf(result.diagnostics).map((d) => d.code)).toContain("bundle/missing-card");
    expect(result.analysis).toBeDefined();
    expect(result.blueprint).toBeDefined();
    expectSortedLikeCore(result.diagnostics, "validateBundle(3 of 8)");
  });
});

/* ============================================================
   The four input classes at the boundary
   ============================================================ */

describe("the service boundary answers for every class of input", () => {
  it("does not parse: no blueprint, no analysis, an error that says why", async () => {
    const validateBundle = await bind("validateBundle");
    const input = withDot(caseFor(EIGHT_NODE_BUNDLE).input, NOT_A_GRAPH);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(not a graph)"),
      "validateBundle(not a graph)",
    );

    expect(result.blueprint).toBeUndefined();
    expect(result.analysis).toBeUndefined();
    expect(errorsOf(result.diagnostics).map((d) => d.code)).toContain("dot/parse-error");
  });

  /* Parses, resolves nothing. Every node names a card and the submission carries none, so the
     topology stands and not one reference does. The blueprint IS present — degradation goes as
     far as it can — which is the distinction from the class above and the reason both are here.

     Note what separates this from the three-of-eight case: there the analysis is over a
     non-empty set, here it is over an empty one, and `analysis/empty-graph` exists precisely so
     a vacuous score cannot read as a clean bill of health. */
  it("parses and resolves nothing: a blueprint with no nodes, and an analysis anyway", async () => {
    const validateBundle = await bind("validateBundle");
    const input = keepCards(caseFor(EIGHT_NODE_BUNDLE).input, 0);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(no cards)"),
      "validateBundle(no cards)",
    );

    expect(result.blueprint).toBeDefined();
    expect(result.blueprint?.nodes).toHaveLength(0);
    expect(result.blueprint?.graph.ids).toHaveLength(8);
    expect(result.analysis).toBeDefined();
    expect(errorsOf(result.diagnostics)).toHaveLength(8);
    expect(result.analysis?.autonomy.contributions.filter((c) => c.resolved)).toHaveLength(0);
  });

  /* Resolves with diagnostics and none of them an error — the shipped archive's own shape, and
     the case that separates "carries diagnostics" from "is broken". */
  it("resolves with warnings: an answer that carries complaints and no errors", async () => {
    const validateBundle = await bind("validateBundle");

    const result = asLoadBundleResult(
      returning(() => validateBundle(caseFor(EIGHT_NODE_BUNDLE).input), "validateBundle(whole)"),
      "validateBundle(whole)",
    );

    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(errorsOf(result.diagnostics)).toEqual([]);
    expect(result.blueprint?.nodes).toHaveLength(8);
  });

  /* Nothing to say. Measured against base: this fixture yields an EMPTY diagnostics array, and
     no shipped bundle does — so without it "the module can answer with silence" would go
     untested while the sweep in `archive.test.ts` looked like it covered everything. An
     implementation that always appends something of its own reds here and nowhere else. */
  it("resolves cleanly: an empty diagnostics array, not a token complaint", async () => {
    const validateBundle = await bind("validateBundle");

    const result = asLoadBundleResult(
      returning(() => validateBundle(cleanInput()), "validateBundle(clean)"),
      "validateBundle(clean)",
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.blueprint).toBeDefined();
    expect(result.analysis).toBeDefined();
  });

  /* The three classes above are three DIFFERENT answers, quantified so a module that collapsed
     any two of them reds. Written as a set comparison rather than as three assertions because
     that is the difference between "each of these is what I expect" and "these are not each
     other" — a collapse satisfies the first for whichever case it collapsed toward. */
  it("keeps the four classes distinguishable from one another", async () => {
    const validateBundle = await bind("validateBundle");
    const whole = caseFor(EIGHT_NODE_BUNDLE).input;

    const shapes: Record<string, string> = {};
    for (const [label, input] of Object.entries({
      "does not parse": withDot(whole, UNPARSEABLE_LINE_2),
      "resolves nothing": keepCards(whole, 0),
      "three of eight": keepCards(whole, 3),
      "resolves with warnings": whole,
      clean: cleanInput(),
    })) {
      const r = asLoadBundleResult(
        returning(() => validateBundle(input), `validateBundle(${label})`),
        `validateBundle(${label})`,
      );
      const placed = r.blueprint?.nodes.length;
      const total = r.blueprint?.graph.ids.length;
      shapes[label] =
        `blueprint=${r.blueprint !== undefined} placed=${placed ?? "-"}/${total ?? "-"} ` +
        `errors=${errorsOf(r.diagnostics).length} diagnostics=${r.diagnostics.length}`;
    }

    expect(shapes).toEqual({
      "does not parse": "blueprint=false placed=-/- errors=1 diagnostics=1",
      "resolves nothing": "blueprint=true placed=0/8 errors=8 diagnostics=9",
      "three of eight": "blueprint=true placed=3/8 errors=7 diagnostics=10",
      "resolves with warnings": "blueprint=true placed=8/8 errors=0 diagnostics=2",
      clean: "blueprint=true placed=1/1 errors=0 diagnostics=0",
    });
    expect(new Set(Object.values(shapes)).size, "five inputs, five distinct answers").toBe(5);
  });
});
