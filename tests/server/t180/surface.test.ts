/* ============================================================
   T180 — the published surface

   The barrel's own exports. Each cell reds against the absent
   module and names its criterion rather than the import.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { BARREL, barrelExports, describe_, required, requiredFn, signature } from "./contract";

const SIGNATURE_FLOOR = ["submitReport", "reportedCost"] as const;

/* ============================================================
   the barrel

   Bound LAST in each cell, after the premises above. An early
   bind masks every assertion below it while being correct about
   its own subject.
   ============================================================ */

describe("the barrel publishes what §T180 declares", () => {
  /**
   * The three-state discriminator, reported as a value rather than left for the reader.
   *
   * This cell is expected to report `module-absent` for as long as `lib/server/runs` does
   * not exist. That is the blind position and it is not a defect — but it is stated here
   * ONCE, so the cells below can be read as failing criteria rather than as one import.
   */
  it("reports which of the three states it is in", async () => {
    const state = await barrelExports();
    expect(["module-absent", "present"]).toContain(state.state);
    if (state.state === "module-absent") {
      throw new Error(
        `${BARREL} is ABSENT — the blind position, not a failed criterion.\n` +
          `  Cause: ${describe_(state.cause)}\n` +
          `  Every cell in this suite that names a criterion is reporting the same absence. ` +
          `Re-read them once the module lands.`,
      );
    }
    expect(state.keys.length).toBeGreaterThan(0);
  });

  for (const name of SIGNATURE_FLOOR) {
    /**
     * One cell per published function, so an absent `reportedCost` does not hide behind an
     * absent `submitReport`. A single cell asserting both would report one criterion where
     * the contract publishes two.
     */
    it(`exports \`${name}\` as a function`, async () => {
      const clause = signature(name).text;
      const state = await barrelExports();
      if (state.state === "module-absent") {
        throw new Error(
          `\`${name}\` cannot be checked: ${BARREL} is absent (blind position).\n` +
            `  the contract publishes: ${clause}`,
        );
      }
      const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
      expect(typeof requiredFn(mod, name, clause)).toBe("function");
    });
  }

  /**
   * D-180-03's class, which the signatures block does not declare.
   *
   * Its own cell rather than folded into the two function cells: an absent refusal class
   * is a different failure from an absent `submitReport`, and the barrel could publish
   * both functions and neither error.
   */
  it("exports `RunReportRefusedError`", async () => {
    const state = await barrelExports();
    if (state.state === "module-absent") {
      throw new Error(
        `\`RunReportRefusedError\` cannot be checked: ${BARREL} is absent (blind position).\n` +
          `  the contract rules: D-180-03, the module's own refusal class`,
      );
    }
    const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
    const cls = required(mod, "RunReportRefusedError", "D-180-03: the module's own refusal class");
    expect(typeof cls).toBe("function");
    expect(Object.create((cls as { prototype: object }).prototype)).toBeInstanceOf(Error);
  });

  /**
   * Arity, and the two ways it can be wrong are named because they read alike.
   *
   * Both signatures take three REQUIRED parameters. `Function.length` counts parameters
   * before the first default or rest — an optional `?` erases at runtime and still counts,
   * but a `= undefined` default does not. So a module that published
   * `reportedCost(db, actor, releaseDigest = "")` reports 2 here while satisfying every
   * behavioural cell in this suite, and that is a contract change nothing else would catch.
   */
  it.each([...SIGNATURE_FLOOR])("publishes `%s` with three required parameters", async (name) => {
    const declared = signature(name);
    expect(declared.params).toHaveLength(3);
    const state = await barrelExports();
    if (state.state === "module-absent") {
      throw new Error(`\`${name}\` arity cannot be checked: ${BARREL} is absent (blind position).`);
    }
    const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
    const fn = requiredFn(mod, name, declared.text);
    expect(fn.length).toBe(3);
  });
});
