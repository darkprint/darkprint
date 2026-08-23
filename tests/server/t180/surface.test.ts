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
  responseInterface,
  responseTypeName,
  RESPONSE_TYPE_NAMES,
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
/** The submitted type, plus WHICHEVER response name the block currently carries. */
const SUBMITTED_FLOOR = "RunReport";
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

  /**
   * Two interfaces: the submitted one by name, the response one by ROLE.
   *
   * D-180-01 ratifies `ReportedCostUnits` as the published type and the block still writes
   * `ReportedCost`. Pinning either name reds a correct module over a rename the contract
   * has already settled, so the name is tolerated and the KEY SET — which D-180-01 says is
   * unchanged — is what gets pinned, below.
   */
  it("declares the submitted type and exactly one response type", () => {
    const names = publishedBlock().interfaces.map((i) => i.name);
    expect(names).toContain(SUBMITTED_FLOOR);
    expect(names).toHaveLength(2);
    expect(RESPONSE_TYPE_NAMES).toContain(responseTypeName());
  });

  /**
   * `spread` is ONE field and the depth-zero split is what keeps it one.
   *
   * A `;` split that ignored brace depth would read `spread: { p10: number` and
   * `p90: number }` as two fields, and the response-shape cells would then quantify over a
   * key set this section never published. Asserted as an equality over the whole list, in
   * document order, because a `toContain` would admit exactly that corruption.
   */
  it("reads the response type as six fields with `spread` intact", () => {
    const iface = responseInterface();
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
   * All three admissible forms, parsed off the block, delimiter-agnostic.
   *
   * **This cell has been wrong twice and each time the document was right.** It first
   * asserted ONE form, which was true when §T180 published one. D-180-06's repair gave the
   * block all three — written with a different delimiter, `` `...` `` rather than
   * `` `"..."` `` — and the parse went to ZERO against a block that had just been given
   * everything, so the cell reported the block publishing none. A reader keyed to one
   * delimiter answers "absent" for a form it cannot see, which is the same failure as the
   * message walker's nested backticks and as a case-sensitive grep over a ruling in caps.
   *
   * Now the parse runs `submitReport:` to the closing period and reads every Admissible
   * line, so the delimiter cannot decide the answer.
   */
  it("parses all three admissible message forms", () => {
    expect(publishedBlock().admissible).toEqual([...REFUSAL_FORMS_FLOOR]);
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
   * So this cell reads the whole section, and asserts the block and the prose now AGREE.
   *
   * **D-180-06's divergence is closed and this cell is where that is recorded.** It has
   * tracked three states: `declarations: []` with one message (the original defect), then
   * the class landed and the messages had not (the half-applied repair), and now both. Each
   * time the previous assertion was stale rather than wrong — which is the argument for a
   * cell that pins the CURRENT state loudly instead of tolerating a range.
   */
  it("rules three refusal forms and the block now publishes all three", () => {
    expect(ruledMessages()).toEqual([...REFUSAL_FORMS_FLOOR]);
    expect(publishedBlock().declarations.map((d) => `${d.kind} ${d.name}`)).toEqual([
      "class RunReportRefusedError",
    ]);
    /* The whole point of D-180-06: the block and the prose say the same thing. */
    expect(publishedBlock().admissible).toEqual(ruledMessages());
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
