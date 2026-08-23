/* ============================================================
   T110 — the published surface

   What the barrel promises, asked two ways.

   ── why a SOURCE cell sits beside the binding cells ──
   A type-level instrument cannot observe its own blindness. A pin
   against an absent module is silently vacuous; a pin against a
   present barrel missing a member is loudly useless; and a negative
   whose probe matches neither shape is falsely green. None of the
   three can tell *a member is absent* from *an assertion failed*.
   So the last cell in this file reads `lib/server/lineage/index.ts`
   off disk as TEXT and reports what is written there. It is the one
   instrument here that answers "the barrel does not name this" in
   those words.

   That cell is also the only thing in this suite that touches a
   path under `lib/server/lineage/**`, and it READS it — the
   partition forbids this author writing there, and a suite that
   cannot say which names a barrel publishes cannot report a missing
   export as anything but a mystery.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { LINEAGE, PUBLISHED, RULINGS, loadLineage, warmLineage } from "./contract";

/* Before any cell awaits the import. The cold transform of the graph behind this barrel was
   measured at 21.13s against a 20s `testTimeout`, and the cell it timed out was this file's
   first — reporting a missing export that was present. See `warmLineage`. */
/* This suite's cells build their own fixture — see `RecordedSetup` — and a fixture here publishes
   two or three bundles through T100, which is engine work, database writes and object storage.
   The shared `testTimeout` is 20s (`vitest.config.ts`), raised there from vitest's 5s default
   because "with nine worktree sessions competing for ten cores, one of them crossed 5s and
   reported a timeout for a test that was never wrong". The same argument reaches further here:
   with the planting inside the cell, four cells crossed 20s on a loaded machine and reported
   `Test timed out` in place of the cause they exist to report.

   Raised per FILE rather than in `vitest.config.ts`, which is shared and is not this task's to
   widen for everybody. A genuine hang still fails, four times later. */
vi.setConfig({ testTimeout: 80_000, hookTimeout: 80_000 });

beforeAll(warmLineage);

const BARREL = fileURLToPath(new URL("../../../lib/server/lineage/index.ts", import.meta.url));

/** The three verbs, with the clause that published each. */
const VERBS = [
  ["forkBundle", PUBLISHED.forkBundle, 4],
  ["driftOf", PUBLISHED.driftOf, 3],
  ["forksOf", PUBLISHED.forksOf, 3],
] as const;

describe("T110 surface: the barrel publishes three verbs", () => {
  for (const [name, clause] of VERBS) {
    it(`\`${name}\` is exported from ${LINEAGE}`, async () => {
      const mod = await loadLineage();
      expect(
        typeof mod[name],
        `${LINEAGE} exports \`${name}\` as ${typeof mod[name]}.\n` +
          `  Published as: ${clause}\n` +
          `  It exports: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
      ).toBe("function");
    });
  }

  for (const [name, clause, arity] of VERBS) {
    /**
     * The published PARAMETER COUNT, which is a different claim from "a function of this name
     * exists" and catches the one substitution the kind check cannot: an export that is a
     * function but not this signature.
     *
     * `Function.length` counts the parameters before the first one with a default, so an
     * implementation that adds a trailing `storage: X | undefined = undefined` — which is what
     * T100's `publish` does, deliberately, `publish.ts:111-127` — keeps this number. An
     * implementation that turns a published parameter into `to?: ...` loses it, and that is a
     * signature change rather than a style choice: `?` erases at runtime while `= undefined`
     * does not, so the two are not interchangeable here.
     */
    it(`\`${name}\` takes the ${arity} parameters the contract publishes`, async () => {
      const mod = await loadLineage();
      const fn = mod[name];
      if (typeof fn !== "function") {
        throw new Error(
          `${LINEAGE} exports \`${name}\` as ${typeof fn}, so its arity cannot be read.\n` +
            `  Published as: ${clause}`,
        );
      }
      expect(
        fn.length,
        `\`${name}\` declares ${fn.length} parameters before its first default; the contract ` +
          `publishes ${arity}.\n  Published as: ${clause}\n` +
          `  A trailing parameter written \`= undefined\` does not change this number and is not ` +
          `what this cell objects to; a published parameter written \`?\` does.`,
      ).toBe(arity);
    });
  }
});

describe("T110 surface: read off disk, so an absent member says so", () => {
  /**
   * The barrel exists and names the three verbs and the three types.
   *
   * Read as TEXT rather than imported, because that is the only reading that distinguishes "the
   * file is not there", "the file is there and does not export this" and "the export is there and
   * an assertion about it failed". An import collapses the first two into one rejection.
   */
  it("`lib/server/lineage/index.ts` re-exports the six published names", () => {
    let source: string;
    try {
      source = readFileSync(BARREL, "utf8");
    } catch (cause) {
      throw new Error(
        `${BARREL} cannot be read.\n` +
          `  backend.md §T110 owns \`lib/server/lineage/**\` and publishes "Barrel: ` +
          `\`@/lib/server/lineage\`". This is the module being absent, which is the failed ` +
          `acceptance criterion and not a broken test.\n` +
          `  Cause: ${String(cause)}`,
      );
    }

    const names = ["forkBundle", "driftOf", "forksOf", "DriftTone", "Repin", "Drift"] as const;
    const missing = names.filter((name) => !new RegExp(`\\b${name}\\b`, "u").test(source));
    expect(
      missing,
      `The barrel does not name ${missing.join(", ")}.\n` +
        `  The Published signatures block names all six:\n` +
        `    ${PUBLISHED.DriftTone}\n    ${PUBLISHED.Repin}\n    ${PUBLISHED.Drift}\n` +
        `    ${PUBLISHED.forkBundle}\n    ${PUBLISHED.driftOf}\n    ${PUBLISHED.forksOf}\n` +
        `  What the barrel does say:\n${source}`,
    ).toEqual([]);
  });

  /**
   * The contract's one negative, and it is stated twice — in the signatures block ("there is no
   * `Fork` type and no second list") and in the Contract line ("lineage is one optional field on
   * the ordinary bundle record, not an entity").
   *
   * `\bFork\b` and not `Fork`: `forkBundle` and `forksOf` both contain the letters and neither is
   * the thing forbidden. A check blinded by matching the string it is looking for is a check that
   * reports a defect on every correct implementation, which has already happened once in this run.
   * The word boundary is what separates the entity from the verbs named after it.
   */
  it("the barrel publishes no `Fork` entity", () => {
    let source: string;
    try {
      source = readFileSync(BARREL, "utf8");
    } catch (cause) {
      throw new Error(
        `${BARREL} cannot be read, so the negative cannot be checked.\n  Cause: ${String(cause)}`,
      );
    }
    const offending = source
      .split("\n")
      .filter((line) => /\bFork\b/u.test(line))
      .map((line) => line.trim());
    expect(
      offending,
      `The barrel names a \`Fork\` on ${offending.length} line(s):\n  ${offending.join("\n  ")}\n` +
        `  backend.md §T110: "there is no \`Fork\` type and no second list ` +
        `(\`lib/data/bundles.ts:1-28\`)", and that file's own header makes the same argument — ` +
        `"\`forkedFrom\` is one optional field on the same row every other bundle uses".\n` +
        `  \`forkBundle\` and \`forksOf\` are not matched by this cell: it looks for \`Fork\` as a ` +
        `whole word, which is the entity, not the verbs named after it.`,
    ).toEqual([]);
  });
});

describe("T110 surface: the rulings this suite was written under", () => {
  /**
   * Not a claim about the implementation. Nine places where `backend.md` was silent were charged
   * before, and while, this suite was written, and answered on 2026-08-23 —
   * six at dispatch and three as D-110-09/10/11, and several cells turn on
   * an answer rather than on the block. This cell fails if a ruling is ever edited out of
   * `contract.ts` without the cells that depend on it being revisited — the cheapest guard
   * available against a suite whose reasons have quietly left it.
   */
  it("records the eleven answers the cells below depend on", () => {
    expect(Object.keys(RULINGS).sort()).toEqual(
      [
        "AC2_transition",
        "D110_09_defaultVisibility",
        "D110_10_anonymous",
        "D110_11_noSuchRelease",
        "F4_movedDirection",
        "Q1_forksOf",
        "Q2_repinAt",
        "Q3_repinCard",
        "Q4_noLineage",
        "Q5_blockedReason",
        "Q6_noRoutes",
      ].sort(),
    );
  });
});
