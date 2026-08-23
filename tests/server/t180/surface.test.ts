/* ============================================================
   T180 — the published surface

   The floor, the pin, and the barrel's own exports.

   These cells are DERIVED from `### T180,` and are independent
   of every question still open on AC4. They red against the
   absent module — the blind position — and each red names its
   criterion rather than the import.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  BARREL,
  barrelExports,
  describe_,
  fieldNames,
  measurementWords,
  MEASUREMENT_WORDS_FLOOR,
  published,
  publishedBlock,
  REFUSAL_FORMS_FLOOR,
  required,
  requiredFn,
  ruledMessages,
  signature,
} from "./contract";

/* ============================================================
   the floor

   The domain is parsed, not transcribed. These constants exist
   only so the parse has something to disagree with: the day
   `### T180,` changes shape, one of these reds and names the
   change, instead of the parse silently narrowing to nothing
   and every cell below going vacuously green.
   ============================================================ */

const SIGNATURE_FLOOR = ["submitReport", "reportedCost"] as const;
const INTERFACE_FLOOR = ["RunReport", "ReportedCost"] as const;
const CRITERIA_FLOOR = 6;

const REPORTED_COST_FLOOR = [
  "runs",
  "median",
  "spread",
  "model",
  "excluded",
  "isSample",
] as const;

const RUN_REPORT_FLOOR = [
  "releaseDigest",
  "model",
  "provider",
  "hardware",
  "inputSize",
  "harnessVersion",
  "costUnits",
  "durationMs",
  "occurredAt",
] as const;

describe("the parse of §T180 agrees with the floor", () => {
  it("declares exactly the two published signatures", () => {
    expect(publishedBlock().signatures.map((s) => s.name)).toEqual([...SIGNATURE_FLOOR]);
  });

  it("declares exactly the two published interfaces", () => {
    expect(publishedBlock().interfaces.map((i) => i.name)).toEqual([...INTERFACE_FLOOR]);
  });

  /**
   * `spread` is ONE field and the depth-zero split is what keeps it one.
   *
   * A `;` split that ignored brace depth would read `spread: { p10: number` and
   * `p90: number }` as two fields, and the response-shape cells would then quantify over a
   * key set this section never published. Asserted as an equality over the whole list, in
   * document order, because a `toContain` would admit exactly that corruption.
   */
  it("reads `ReportedCost` as six fields with `spread` intact", () => {
    const iface = published("ReportedCost");
    expect(fieldNames(iface)).toEqual([...REPORTED_COST_FLOOR]);
    expect(iface.fields).toContain("spread: { p10: number; p90: number }");
  });

  it("reads `RunReport` as the nine fields the CLI submits", () => {
    expect(fieldNames(published("RunReport"))).toEqual([...RUN_REPORT_FLOOR]);
  });

  it("reads six acceptance criteria", () => {
    expect(publishedBlock().criteria).toHaveLength(CRITERIA_FLOOR);
  });

  /**
   * The admissible form is parsed and there is exactly one.
   *
   * §T180 writes "Admissible message form:", singular, where §T240 writes "forms:". A
   * parser that read only the plural returns `[]` here, and every refusal cell that
   * compared against `forms[0]` would then compare against `undefined` — which
   * `toBe(undefined)` would happily accept from a module that threw nothing at all.
   */
  it("parses exactly one admissible message form", () => {
    const forms = publishedBlock().admissible;
    expect(forms).toHaveLength(1);
    expect(forms[0]).toBe("submitReport: no release at digest `<digest>`.");
  });

  it("parses AC6's forbidden words and they match the floor", () => {
    expect(measurementWords()).toEqual([...MEASUREMENT_WORDS_FLOOR]);
  });

  /**
   * Three refusal forms, and the block publishes ONE of them.
   *
   * D-180-03 and D-180-04 rule two more messages and a class, in PROSE — the Published
   * signatures block still declares two interfaces and two functions, and its admissible
   * list still carries only the digest form. Measured, not assumed: the parser's
   * `declarations` is `[]` and its `admissible` has length 1.
   *
   * So this cell reads the whole section, and the assertion below records the divergence
   * rather than hiding it: the block is owed an update, and until it lands a suite that
   * parsed only the block would compare every new refusal against `undefined`.
   */
  it("rules three refusal forms, of which the block publishes one", () => {
    expect(ruledMessages()).toEqual([...REFUSAL_FORMS_FLOOR]);
    expect(publishedBlock().admissible).toHaveLength(1);
    expect(publishedBlock().declarations).toEqual([]);
  });
});

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
