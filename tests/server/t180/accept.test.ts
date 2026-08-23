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

import { barrelExports, BARREL, describe_, refusalForm, required, requiredFn } from "./contract";
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

/** A published field removed, without a destructuring binding eslint reads as dead. */
function without(report: RunReport, field: keyof RunReport): RunReport {
  const copy: Record<string, unknown> = { ...report };
  delete copy[field];
  return copy as unknown as RunReport;
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
async function submit(
  scratch: Scratch,
  report: RunReport,
  criterion: string,
  actor?: unknown,
): Promise<void> {
  const state = await barrelExports();
  if (state.state === "module-absent") {
    throw new Error(`${criterion} cannot be checked: ${BARREL} is absent (blind position).`);
  }
  const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
  const submitReport = requiredFn(mod, "submitReport", "submitReport(db, actor, report)");
  await submitReport(
    scratch.client.db,
    actor ?? { kind: "account", accountId: scratch.submitterId, handle: "t180-submitter" },
    report,
  );
}

/** D-180-03's published class, bound from the barrel. */
async function refusedError(criterion: string): Promise<new (...a: never[]) => Error> {
  const state = await barrelExports();
  if (state.state === "module-absent") {
    throw new Error(`${criterion} cannot be checked: ${BARREL} is absent (blind position).`);
  }
  const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
  const cls = required(
    mod,
    "RunReportRefusedError",
    "D-180-03: `RunReportRefusedError`, the module's own refusal class",
  );
  if (typeof cls !== "function") {
    throw new Error(`${BARREL} exports \`RunReportRefusedError\` as ${describe_(cls)}, not a class.`);
  }
  return cls as new (...a: never[]) => Error;
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
    const expected = refusalForm("no release at digest").replace("<digest>", ABSENT_DIGEST);
    const Refused = await refusedError("AC1's refusal");

    await expect(
      submit(scratch, wellFormed({ releaseDigest: ABSENT_DIGEST }), "AC1's refusal"),
    ).rejects.toThrow(expected);
    /* D-180-04: the class as well as the message. A message pin alone is satisfied by a
       driver fault whose text happens to match, which D-13 forbids surfacing at all. */
    await expect(
      submit(scratch, wellFormed({ releaseDigest: ABSENT_DIGEST }), "AC1's refusal"),
    ).rejects.toBeInstanceOf(Refused);
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
    const expected = refusalForm("no release at digest").replace("<digest>", ABSENT_DIGEST);
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

/* ============================================================
   D-180-03 and D-180-04, ruled after the suite was written
   ============================================================ */

describe("an anonymous submission is refused before the write", () => {
  /**
   * D-180-03. `Actor`'s `anonymous` member carries no `accountId` and
   * `run_report.account_id` is `NOT NULL`, so the state is structurally unstorable — and
   * letting the database refuse it would surface a driver fault as a store failure, which
   * D-13 forbids. The refusal is the module's own class, raised before the write.
   */
  it("throws the module's own class with the ruled message", async () => {
    const scratch = setup.require();
    await requireModule("D-180-03's anonymous refusal");
    const expected = refusalForm("needs an account");
    const Refused = await refusedError("D-180-03's anonymous refusal");

    await expect(
      submit(scratch, wellFormed(), "D-180-03's anonymous refusal", { kind: "anonymous" }),
    ).rejects.toThrow(expected);
    await expect(
      submit(scratch, wellFormed(), "D-180-03's anonymous refusal", { kind: "anonymous" }),
    ).rejects.toBeInstanceOf(Refused);
  });

  /**
   * "Raised **before** the write" is the half a message pin cannot see.
   *
   * A module that attempted the insert and translated the constraint violation would throw
   * the right class with the right text and still have gone to the database — which is the
   * exact failure D-180-03 exists to prevent. The digest here EXISTS, so the trigger cannot
   * do the refusing for the module the way it does at an absent digest: any row that lands
   * is the module's own.
   */
  it("leaves no row behind, at a digest that exists", async () => {
    const scratch = setup.require();
    await requireModule("D-180-03's before-the-write ordering");
    const before = await reportsAt(scratch, DIGEST);

    await expect(
      submit(scratch, wellFormed(), "D-180-03's before-the-write ordering", { kind: "anonymous" }),
    ).rejects.toThrow();

    expect(await reportsAt(scratch, DIGEST)).toHaveLength(before.length);
  });
});

describe("a malformed report and an unknown digest are one class", () => {
  /**
   * D-180-04's well-formedness half.
   *
   * **The malformed PREDICATE is unruled and this cell does not invent one.** §T180 says a
   * report is accepted "on well-formedness" without saying what that excludes, so the
   * input here is the least ambiguous instance available: a required published field of
   * `RunReport` is absent entirely. Anything subtler — a negative `inputSize`, an empty
   * `provider` — would be this suite guessing a boundary the contract never drew, and
   * `accepts a well-formed report it has every reason to disbelieve` above is the cell
   * that keeps that guess from creeping in.
   */
  it("refuses a report missing a published field", async () => {
    const scratch = setup.require();
    await requireModule("D-180-04's well-formedness half");
    const expected = refusalForm("malformed");
    const Refused = await refusedError("D-180-04's well-formedness half");

    const malformed = without(wellFormed(), "model");

    await expect(submit(scratch, malformed, "D-180-04's well-formedness half")).rejects.toThrow(expected);
    await expect(submit(scratch, malformed, "D-180-04's well-formedness half")).rejects.toBeInstanceOf(Refused);
  });

  /**
   * The ruling's actual content: a caller must NOT be able to tell them apart by `instanceof`.
   *
   * Both cells above pin a class each, and both would pass against a module publishing two
   * sibling classes with those two messages. This is the cell that forbids it — the two
   * refusals are caught and their constructors compared to each other, so a split reds here
   * and nowhere else. It is the difference between "each refusal has a class" and "a caller
   * distinguishing them would be distinguishing two things it must handle identically".
   */
  it("gives both refusals the same constructor, not two siblings", async () => {
    const scratch = setup.require();
    await requireModule("D-180-04's one-class rule");

    const caught: unknown[] = [];
    for (const report of [
      wellFormed({ releaseDigest: ABSENT_DIGEST }),
      without(wellFormed(), "model"),
    ]) {
      try {
        await submit(scratch, report, "D-180-04's one-class rule");
        throw new Error("expected a refusal and got none");
      } catch (e) {
        caught.push(e);
      }
    }

    const [unknownDigest, malformed] = caught as Error[];
    expect(unknownDigest.message).not.toBe(malformed.message);
    expect(malformed.constructor).toBe(unknownDigest.constructor);
  });
});
