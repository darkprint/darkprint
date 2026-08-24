/* ============================================================
   T180 — the telemetry boundary

   `components/bundle/Aside.tsx:33-36`: what the registry stores
   is this bundle and who owns it, and NOT "a run, a key, or any
   telemetry about either".

   Ruled, after two blind halves reached it from different
   evidence: **the registry never holds a record it PRODUCED
   about a run — it holds a claim, with its claimant.** So
   `run_report` is not a breach of that sentence; a row the
   platform wrote off its own observation would be.

   Three cells, and the third is the load-bearing one.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AUDIT_ACTIONS } from "@/lib/server/observability";

import { BARREL, barrelExports, fieldNames, published, requiredFn, responseInterface } from "./contract";
import {
  auditRows,
  DIGEST,
  MODAL_COSTS,
  MODAL_MODEL,
  plantReports,
  RecordedSetup,
  reportsAt,
  scratchDatabase,
  type Scratch,
} from "./fixtures";

const setup = new RecordedSetup<Scratch>("The T180 scratch database, two accounts and two releases");

beforeAll(async () => {
  await setup.run(scratchDatabase);
}, 60_000);

afterAll(async () => {
  await setup.optional()?.drop();
});

/* ============================================================
   1. which side of B-14 this task sits on
   ============================================================ */

describe("the operational log knows nothing about a run", () => {
  /**
   * The vocabulary, quantified over the live set rather than over a count.
   *
   * **Deliberately not a length assertion.** `AUDIT_ACTIONS` is twelve on this branch and
   * thirteen once T170's `note.remove` merges, so a count pin here would red on a merge
   * that has nothing to do with T180. The property is what the closed set BUYS — that no
   * action can name a blueprint run — and that is invariant under every amendment the
   * orchestrator makes at a dispatch.
   *
   * The same regex `lib/server/observability/types.test.ts:52` uses, on purpose: this is
   * the sibling of that guard, not a second spelling of it.
   */
  it("publishes no action naming a run, in any spelling", () => {
    const offenders = AUDIT_ACTIONS.filter((a) => /run|execut|invoc|trace|telemetry/i.test(a));
    expect(offenders).toEqual([]);
  });

  /**
   * B-14's arrow, as a measurement: an accepted report leaves the audit log untouched.
   *
   * B-14 counts downloads from an explicit event at the serving edge and never derives
   * them from a log, because deriving product data from an operational log points the
   * arrow the wrong way. A run report is the same shape — product data submitted at the
   * edge — so it lands in `run_report` and the operational log never learns of it.
   *
   * Asserted BEFORE and AFTER rather than as "the log is empty at the end": an empty
   * table is also what a `submitReport` that threw before writing anything leaves, and
   * that would pass while testing nothing. The report's own row is asserted alongside, so
   * the cell distinguishes *wrote nothing anywhere* from *wrote the right thing only*.
   */
  it("writes no audit row when a report is accepted", async () => {
    const scratch = setup.require();
    const before = await auditRows(scratch);

    const state = await barrelExports();
    if (state.state === "module-absent") {
      throw new Error(
        `AC/B-14 boundary cannot be checked: ${BARREL} is absent (blind position).\n` +
          `  The criterion: an accepted run report writes NO audit row.`,
      );
    }
    const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
    const submitReport = requiredFn(mod, "submitReport", "submitReport(db, actor, report)");

    await submitReport(scratch.client.db, { kind: "account", accountId: scratch.submitterId, handle: "t180-submitter" }, {
      releaseDigest: DIGEST,
      model: MODAL_MODEL,
      provider: "anthropic",
      hardware: "m3-max-64gb",
      inputSize: 4096,
      harnessVersion: "darkprint-cli/0.4.1",
      costUnits: 17,
      durationMs: 1200,
      occurredAt: new Date(Date.UTC(2026, 7, 1, 12, 0, 0)),
    });

    const after = await auditRows(scratch);
    expect(after).toHaveLength(before.length);

    /* The other half: it wrote the report, so the zero above is not "wrote nothing". */
    const rows = await reportsAt(scratch, DIGEST);
    expect(rows.length).toBeGreaterThan(0);
  });
});

/* ============================================================
   2. the aggregate is not derived from anything operational
   ============================================================ */

describe("the aggregate reads reports and nothing else", () => {
  /**
   * Reports planted straight into `run_report`, with the audit log EMPTY, aggregate in full.
   *
   * This is the discriminating direction. A `reportedCost` that derived any part of its
   * answer from the operational log — a join, a count of `audit` rows, a fallback — cannot
   * return the full population here, because there is nothing in that log to derive from.
   * A cell that instead wrote audit rows and checked they were ignored would be satisfied
   * by a module that reads the log and finds nothing relevant.
   */
  it("aggregates rows the operational log never saw", async () => {
    const scratch = setup.require();
    await plantReports(scratch, MODAL_COSTS.map((costUnits) => ({ costUnits })));

    /**
     * The premise, asserted rather than assumed — and the message names BOTH ways it can
     * fail, because the cells in this file share one scratch database and the cell above
     * calls `submitReport`. A module that writes an audit row on accept reds here as well
     * as in its own cell, which is a true positive reporting a plausible wrong cause: the
     * subject of this cell is the READ, not the write.
     */
    const log = await auditRows(scratch);
    expect(
      log,
      "the audit log must be empty for this cell's premise to hold: either `submitReport` " +
        "wrote a row in the cell above (a write defect, see `writes no audit row`), or " +
        "something else in this suite did",
    ).toEqual([]);

    const state = await barrelExports();
    if (state.state === "module-absent") {
      throw new Error(
        `B-14 arrow cannot be checked: ${BARREL} is absent (blind position).\n` +
          `  The criterion: the aggregate derives from \`run_report\`, never from a log.`,
      );
    }
    const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
    const reportedCost = requiredFn(mod, "reportedCost", "reportedCost(db, actor, releaseDigest)");
    const result = (await reportedCost(
      scratch.client.db,
      { kind: "account", accountId: scratch.submitterId, handle: "t180-submitter" },
      DIGEST,
    )) as { runs?: number } | undefined;

    expect(result).toBeDefined();
    expect(result?.runs).toBeGreaterThan(0);
  });
});

/* ============================================================
   3. the published read exposes no individual run
      — the load-bearing cell, blessed as such
   ============================================================ */

describe("no fact about any single run is readable from the response", () => {
  /**
   * The nine fields the CLI submits, against the six the registry publishes back.
   *
   * This is what makes the Aside sentence survive T180, and it turns on the singular:
   * the registry holds an aggregate over reports, which is not telemetry about *a* run.
   * The moment one per-run field appears in the response, that reading collapses and the
   * product copy becomes false.
   *
   * Asserted over the CONTRACT rather than over a returned object, because a response is
   * one sample and a field can be absent from it by accident. Both directions are
   * checked below; this one fixes the domain.
   */
  it("publishes no per-run field in the response type", () => {
    const submitted = fieldNames(published("RunReport"));
    const returned = fieldNames(responseInterface());

    /* `model` is the one field that legitimately crosses: the aggregate is per model, so
       naming the group is naming the population and not a member of it. */
    const crossing = submitted.filter((f) => returned.includes(f));
    expect(crossing).toEqual(["model"]);

    /* Named individually as well, so a future field added to `RunReport` cannot quietly
       widen the intersection above while this cell keeps reading `["model"]`. */
    for (const perRun of [
      "provider",
      "hardware",
      "inputSize",
      "harnessVersion",
      "durationMs",
      "occurredAt",
      "releaseDigest",
      "costUnits",
    ]) {
      expect(returned).not.toContain(perRun);
    }
  });

  /**
   * And the same over what is actually returned, nested keys included.
   *
   * The contract cell above cannot see a member the implementation adds and the document
   * does not publish, which is exactly how a per-run field would arrive. `accountId` and
   * `id` are checked too: neither is in `RunReport`, both are in the row, and either
   * would identify a submitter or a run.
   */
  it("returns no per-run field and no identity", async () => {
    const scratch = setup.require();
    await plantReports(scratch, [{ costUnits: 11 }, { costUnits: 13 }, { costUnits: 15 }]);

    const state = await barrelExports();
    if (state.state === "module-absent") {
      throw new Error(
        `The load-bearing boundary cell cannot be checked: ${BARREL} is absent (blind position).\n` +
          `  The criterion: the response exposes no fact about any individual run.`,
      );
    }
    const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
    const reportedCost = requiredFn(mod, "reportedCost", "reportedCost(db, actor, releaseDigest)");
    const result = await reportedCost(
      scratch.client.db,
      { kind: "account", accountId: scratch.submitterId, handle: "t180-submitter" },
      DIGEST,
    );

    expect(result).toBeDefined();
    const { nestedKeys } = await import("./contract");
    const leaves = nestedKeys(result).map((p) => (p.split(".").at(-1) ?? p).toLowerCase());
    for (const perRun of [
      "provider",
      "hardware",
      "inputsize",
      "harnessversion",
      "durationms",
      "occurredat",
      "reportedat",
      "accountid",
      "id",
    ]) {
      expect(leaves).not.toContain(perRun);
    }
  });
});
