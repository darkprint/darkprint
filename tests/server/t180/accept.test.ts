/* ============================================================
   T180 — AC1: accepted on well-formedness and the digest
   existing, with NO verification claimed

   AC1 is deliberately weak and §T180 says that weakness is a
   promise. So it is stated here as something the module asserts
   about itself: a well-formed report the platform has every
   reason to disbelieve is ACCEPTED, and the cell that says so
   reds the day somebody adds a plausibility check.

   The refusal is a PRE-CHECK throwing the admissible message,
   ruled. `run_report_release_exists` raising 23503 is the
   backstop, not the interface — a driver error carries the
   digest into a message D-13 keeps clean.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { barrelExports, BARREL, publishedBlock, requiredFn } from "./contract";
import {
  ABSENT_DIGEST,
  DIGEST,
  MODAL_MODEL,
  RecordedSetup,
  reportsAt,
  scratchDatabase,
  type Scratch,
} from "./fixtures";

const setup = new RecordedSetup<Scratch>("The T180 acceptance scratch database");

beforeAll(async () => {
  await setup.run(scratchDatabase);
}, 60_000);

afterAll(async () => {
  await setup.optional()?.drop();
});

interface RunReport {
  releaseDigest: string;
  model: string;
  provider: string;
  hardware: string;
  inputSize: number;
  harnessVersion: string;
  costUnits: number;
  durationMs: number;
  occurredAt: Date;
}

function wellFormed(overrides: Partial<RunReport> = {}): RunReport {
  return {
    releaseDigest: DIGEST,
    model: MODAL_MODEL,
    provider: "anthropic",
    hardware: "m3-max-64gb",
    inputSize: 4096,
    harnessVersion: "darkprint-cli/0.4.1",
    costUnits: 17,
    durationMs: 1200,
    occurredAt: new Date(Date.UTC(2026, 7, 1, 12, 0, 0)),
    ...overrides,
  };
}

/**
 * Fails the cell outright when the module is absent, BEFORE any `rejects`/`resolves`.
 *
 * **This exists because of a false green measured in this suite.** "leaves no row behind"
 * was written as `rejects.toThrow()` with no argument followed by a row-count assertion,
 * and against the absent module the blind-position throw SATISFIED the rejection while the
 * empty table satisfied the count. The cell went green in the blind position — a cell no
 * mutation could red, testing nothing, in the exact shape wave-blind warns about. A
 * `rejects` wrapper will consume any throw, the instrument's own included, so the presence
 * check has to happen outside it.
 */
async function requireModule(criterion: string): Promise<void> {
  const state = await barrelExports();
  if (state.state === "module-absent") {
    throw new Error(`${criterion} cannot be checked: ${BARREL} is absent (blind position).`);
  }
}

/** Bound LAST, after every premise and every planting. */
async function submit(scratch: Scratch, report: RunReport, criterion: string): Promise<void> {
  const state = await barrelExports();
  if (state.state === "module-absent") {
    throw new Error(`${criterion} cannot be checked: ${BARREL} is absent (blind position).`);
  }
  const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
  const submitReport = requiredFn(mod, "submitReport", "submitReport(db, actor, report)");
  await submitReport(
    scratch.client.db,
    { kind: "account", accountId: scratch.submitterId, handle: "t180-submitter" },
    report,
  );
}

describe("a report against an unknown digest is refused", () => {
  /**
   * The admissible form, by EXACT match, with the caller's own digest substituted.
   *
   * Exact rather than `toContain`: a whitelist asserted with a blacklist test is a
   * blacklist, and an `includes` answers "do these characters appear" where the claim is
   * "does anything else leak". A message that appended a connection string, a table name
   * or the driver's own prose would pass a `toContain` and fail here, which is the point.
   *
   * The form is PARSED out of §T180 rather than retyped, so the day the orchestrator
   * rewords it this cell follows without anyone editing the file.
   */
  it("throws the admissible message and nothing else", async () => {
    const scratch = setup.require();
    await requireModule("AC1's refusal");
    const form = publishedBlock().admissible[0];
    expect(form, "the admissible form must parse; see surface.test.ts").toBeDefined();
    const expected = form.replace("<digest>", ABSENT_DIGEST);

    await expect(
      submit(scratch, wellFormed({ releaseDigest: ABSENT_DIGEST }), "AC1's refusal"),
    ).rejects.toThrow(expected);
  });

  /**
   * And it LEFT NOTHING BEHIND.
   *
   * A mutation that inserts the row and *then* throws satisfies every `rejects.toThrow()`
   * a reviewer would write. The refusal is only a refusal if the table is untouched, so
   * the row count at the absent digest is asserted after the throw — and asserted as
   * exactly zero rather than as "not more than before", because the digest is fresh.
   *
   * **Measured caveat, and it is the honest reading of this cell.** A stand-in mutated to
   * insert the row and then throw reddened 0 of 41 cells, and the zero was falsified on a
   * second axis: `run_report_release_exists` raises SQLSTATE 23503 and REFUSES the insert,
   * so at an absent digest no implementation can leave a row behind whatever it does.
   * Probed directly against a migrated scratch database — sqlstate `23503`, rows left `0`.
   *
   * The guard for this scenario therefore lives in the trigger (D-05-01), one layer below
   * the module, and this cell is defence in depth rather than coverage. It is kept because
   * the trigger is T005's and could be dropped by a migration that never mentions T180 —
   * but it must not be counted as evidence that the module orders its writes correctly.
   */
  it("leaves no row behind", async () => {
    const scratch = setup.require();
    await requireModule("AC1's leaves-nothing-behind");

    /* The ADMISSIBLE message, not merely "something threw". A bare `rejects.toThrow()`
       is satisfied by any error at all — including this suite's own blind-position throw,
       which is how this cell was green against an absent module before the guard above. */
    const expected = publishedBlock().admissible[0].replace("<digest>", ABSENT_DIGEST);
    await expect(
      submit(scratch, wellFormed({ releaseDigest: ABSENT_DIGEST }), "AC1's leaves-nothing-behind"),
    ).rejects.toThrow(expected);

    const rows = await reportsAt(scratch, ABSENT_DIGEST);
    expect(rows).toEqual([]);
  });
});

describe("acceptance claims no verification, and that weakness is the promise", () => {
  /**
   * A well-formed report the platform has every reason to disbelieve is ACCEPTED.
   *
   * §T180: AC1 is "deliberately weak and that weakness is a promise ... state it as
   * something the module asserts about itself, so nobody later adds plausibility checks
   * that would amount to a claim the product does not make."
   *
   * So this cell asserts the module does NOT check: an absurd cost, a duration longer
   * than the release has existed, an unknown harness and an unknown provider all land.
   * It is an unusual shape for a test and it is deliberate — it reds the day somebody
   * adds the plausibility check that would turn `reported` into `verified`.
   */
  it("accepts a well-formed report it has every reason to disbelieve", async () => {
    const scratch = setup.require();
    await requireModule("AC1's no-verification promise");
    const implausible = wellFormed({
      costUnits: 999_999_999,
      durationMs: 2_147_483_000,
      harnessVersion: "not-a-harness-anybody-ships/0.0.0",
      provider: "a-provider-that-does-not-exist",
      hardware: "hardware-nobody-has",
      inputSize: 0,
      occurredAt: new Date(Date.UTC(1999, 0, 1)),
    });

    await expect(submit(scratch, implausible, "AC1's no-verification promise")).resolves.toBeUndefined();

    const rows = await reportsAt(scratch, DIGEST);
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe("a-provider-that-does-not-exist");
    expect(rows[0].harness_version).toBe("not-a-harness-anybody-ships/0.0.0");
  });

  /**
   * And what the registry stored is what it was given.
   *
   * B-16's promise is that the registry stores what the caller submitted. `cost_units` is
   * unqualified `numeric` (D-05-09) precisely so a submitted decimal is not silently
   * rounded on the way in — a truncation converts a rejectable input into a wrong number
   * and it then feeds the median. Compared as a NUMBER against the submitted value, so a
   * stored `"0.123457"` where `0.1234567` was sent reds rather than passing a string
   * comparison nobody looks at.
   */
  it("stores the cost it was given, undamaged", async () => {
    const scratch = setup.require();
    const submitted = 0.1234567;
    await submit(scratch, wellFormed({ costUnits: submitted }), "B-16's store-what-you-were-given");

    const rows = await reportsAt(scratch, DIGEST);
    const stored = rows.map((r) => Number(r.cost_units));
    expect(stored).toContain(submitted);
  });
});
