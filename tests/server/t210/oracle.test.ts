/* ============================================================
   T210 — the shipped component, over the seeded archive

   `termUsageIndex(registry)` (`components/ontology/TermTable.tsx:190`)
   answers the same question over the same corpus and was written by
   neither half of this task. That is what makes it worth consulting.

   ── it is ONE instrument from two vantages, not two instruments ──
   Said plainly because a PASS here is a claim about absence and is
   worth exactly the shape of the check that found nothing. D-210-07
   records two conversions between the component's answer and the
   published surface, and BOTH conversions are written HERE, by the
   author of the assertions:

     * its `TermUsage` is three LISTS where the server's three
       fields of the same names are NUMBERS. A name collision across
       layers; converted below by taking `.length`.
     * its blueprint identity is a SLUG where D-210-08 makes the
       server's a two-part `ownerHandle/slug` key. On the seeded
       archive every bundle belongs to one account, so the two
       readings CANNOT disagree here — which is exactly why the cell
       that separates them lives in `ac1-counts.test.ts` against a
       synthetic two-account world, and why agreement in this file
       is not evidence about the key at all.

   So where this file and the module agree, that is one reading
   confirmed from two vantages. It shows the cells are satisfiable.
   It does not show the reading is right.

   ── what it CAN do that nothing else here can ──
   It is the only check over the REAL 9 / 57 / 49 corpus rather than
   over a fixture this suite designed. A fixture can only contain
   what its author thought to put in it; the archive contains what
   six invented authors actually wrote, including the four card ids
   carrying two versions, the cards declaring no phase at all, and
   the single local term. Those are shapes no fixture here plants.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { termUsageIndex } from "@/components/ontology/TermTable";
import { getRegistry } from "@/lib/content";

import { anonymous, dropScratchDatabases, seededWorld } from "./fixtures";
import { assertCandidate, assertUsage, bind } from "./contract";

/* The overlay's term ids, sorted, as literals: a list read off `content/ontology/extensions.yaml`
   would move with the file it is checking and assert nothing about what the corpus holds. */
const OVERLAY_TERMS = [
  "autogen/budget-overrun",
  "autogen/prompt-injection",
  "autogen/untrusted-text",
  "autogen/unverified-delegation",
  "lupo/pii-handling",
];

/* `autogen/untrusted-text` counts 2 cards and not the 3 that name it: `constrained-assistant`
   names it under `cannot`, and refusing a type is not using one. */

afterAll(async () => {
  await dropScratchDatabases();
});

interface ComponentUsage {
  cards: string[];
  blueprints: string[];
  authors: string[];
}

/** The component's answer, converted to the published shape with both conversions named. */
function componentIndex(): Map<string, { cards: number; blueprints: number; authors: number }> {
  const raw = termUsageIndex(getRegistry()) as ReadonlyMap<string, ComponentUsage>;
  const out = new Map<string, { cards: number; blueprints: number; authors: number }>();
  for (const [id, usage] of raw) {
    /* CONVERSION 1 — lists to counts. The two `TermUsage` types share three field NAMES and
       nothing else; a reader importing the wrong one gets a silently different shape (D-210-07).
       CONVERSION 2 — none applied to `blueprints`, and that is the point: the component's
       entries are SLUGS. On this corpus every bundle has one owner so the counts coincide, and
       this file therefore proves nothing about the two-part key. */
    out.set(id, {
      cards: usage.cards.length,
      blueprints: usage.blueprints.length,
      authors: usage.authors.length,
    });
  }
  return out;
}

describe("the seeded archive, against the shipped component", () => {
  it("the corpus really is the 10 / 61 / 57 one, so the comparison is over the archive", () => {
    const registry = getRegistry();
    const all = registry.cards();
    const ids = new Set(all.map((r: { id: string }) => r.id));
    /* Numbers as literals, deliberately. A bound imported from the thing it bounds moves with
       it and asserts nothing, and `public/bundles/` losing directories must not silently shrink
       this file's domain to a fraction of the archive — the failure T090's suite recorded. */
    expect(all.length).toBe(103);
    expect(ids.size).toBe(99);
    expect(registry.blueprints().length).toBe(16);
  });

  it("`usage()` and the component agree on every term either of them counts", async () => {
    const { scratch } = await seededWorld();
    const usage = await bind("usage");

    const rows = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    const mine = new Map(
      rows.map((r) => [r.termId, { cards: r.cards, blueprints: r.blueprints, authors: r.authors }]),
    );
    const theirs = componentIndex();

    /* Compared over the UNION of both key sets rather than by iterating one of them. Iterating
       the module's rows would make a term the module dropped invisible; iterating the
       component's would make an invented term invisible. The union catches both, and the
       message shows the whole disagreement in one object rather than failing on the first id. */
    const ids = [...new Set([...mine.keys(), ...theirs.keys()])].sort();
    const disagreements: Record<string, unknown> = {};
    for (const id of ids) {
      const a = mine.get(id);
      const b = theirs.get(id);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        disagreements[id] = { module: a ?? "(absent)", component: b ?? "(absent)" };
      }
    }
    expect(disagreements).toEqual({});
  });

  it("every local term is counted, and they are the only namespaced ids in the corpus", async () => {
    const theirs = componentIndex();
    const namespaced = [...theirs.keys()].filter((id) => id.includes("/")).sort();
    /* The overlay's terms, and nothing else namespaced (D-250-06). Asserted here because they
       are what makes the seeded corpus interesting to AC5 at all — and because none of them
       clears either threshold, which is why the seed's candidate list is empty and why every
       AC5 cell is synthetic. */
    expect(namespaced).toEqual(OVERLAY_TERMS);
    for (const id of OVERLAY_TERMS) {
      const usage = theirs.get(id);
      expect(usage, id).toBeDefined();
      expect(usage!.cards, id).toBeGreaterThan(0);
    }
  });

  it("`candidates()` over the seeded archive is every INELIGIBLE local term, not an empty list", async () => {
    const { scratch } = await seededWorld();
    const candidates = await bind("candidates");
    const list = await candidates(scratch.db, anonymous);

    /* ── this cell asserted EMPTY and was WRONG, and the correction is the finding ──
       D-210-08 records "with [the local filter] the seed's list is EMPTY — `lupo/pii-handling`
       at 2 cards / 1 bundle / 1 author clears neither threshold". That parenthetical was
       written under the PRE-D-210-02 reading, in which `candidates()` returned only the
       QUALIFYING set. D-210-02 replaced that reading: the list is every counted LOCAL term with
       its counts and both booleans, and the ELIGIBLE SUBSET is the conjunction.

       `lupo/pii-handling` is counted and is local, so under the governing ruling it MUST be in
       the list, ineligible. Measured on the merged tree: exactly one row, 2 / 1 / 1, both
       booleans false — which is D-210-08's own three numbers, so only its conclusion was stale,
       never its measurement.

       The module is right and this suite was wrong. Recorded here rather than quietly rewritten
       because a blind suite wrong about a published contract means the contract failed to bind,
       and because an EMPTY assertion is the weaker cell in any case: `[]` is satisfied by a
       `candidates()` that always returns a constant, where the row below pins the ineligibility
       itself. */
    expect(Array.isArray(list)).toBe(true);
    const rows = (list as unknown[]).map((row, i) => assertCandidate(row, `candidates()[${i}]`));
    expect(rows).toHaveLength(OVERLAY_TERMS.length);
    expect([...rows].sort((a, b) => (a.termId < b.termId ? -1 : 1))).toEqual([
      { termId: "autogen/budget-overrun", cards: 1, blueprints: 1, authors: 1, meetsAuthors: false, meetsBlueprints: false },
      { termId: "autogen/prompt-injection", cards: 2, blueprints: 1, authors: 1, meetsAuthors: false, meetsBlueprints: false },
      { termId: "autogen/untrusted-text", cards: 2, blueprints: 1, authors: 1, meetsAuthors: false, meetsBlueprints: false },
      { termId: "autogen/unverified-delegation", cards: 1, blueprints: 1, authors: 1, meetsAuthors: false, meetsBlueprints: false },
      { termId: "lupo/pii-handling", cards: 2, blueprints: 1, authors: 1, meetsAuthors: false, meetsBlueprints: false },
    ]);
    /* The eligible subset over the real archive IS empty, which is what D-210-08 was reaching
       for and is still true. Asserted as the derived quantity rather than as the list's length,
       so the two readings can never be confused again. */
    expect(rows.filter((r) => r.meetsAuthors && r.meetsBlueprints)).toEqual([]);
  });

  it("`usageOf` agrees with `usage()` across the whole archive, not a sampled part of it", async () => {
    const { scratch } = await seededWorld();
    const usageOf = await bind("usageOf");
    const usage = await bind("usage");

    const rows = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    expect(rows.length).toBeGreaterThan(0);

    const mismatches: Record<string, unknown> = {};
    for (const row of rows) {
      const single = assertUsage(
        await usageOf(scratch.db, anonymous, row.termId),
        `usageOf(${row.termId})`,
      );
      if (JSON.stringify(single) !== JSON.stringify(row)) {
        mismatches[row.termId] = { usageOf: single, usage: row };
      }
    }
    /* Every term, enumerated from what the module reported. A scoped agreement is a claim about
       the scope, and the scope here is "whatever `usage()` returned" rather than a list of ids
       chosen by me — so a term the module invents is inside the sweep by construction. */
    expect(mismatches).toEqual({});
  });
});
