/* ============================================================
   T240 AC5 — a refused-by-policy operation is distinguishable
   in the log from one that errored

   **This is where a wrong implementation looks most correct.**
   `denied` is a policy refusal; `error` is a fault. A module
   that records a refusal as a fault writes one row, of the right
   shape, naming the right actor, the right action and the right
   target, at the right time — and makes the log unable to
   answer the one question it exists for. Every cell in
   `write.test.ts` passes on it. Every count passes on it.

   ── so the assertion is over a PAIR, and over what the pair
      EXCLUDES ──
   Same actor, same action, same target; one refused by policy,
   one faulted. The criterion is that the two rows come back
   different, so the cells assert the pair of decisions is
   exactly `["denied", "error"]` — which excludes:

     • `["error", "error"]`  — a refusal recorded as a fault,
       the failure mode this file is for;
     • `["denied", "denied"]` — a fault recorded as a refusal,
       the same defect in the other direction, and the one a
       reviewer forgets;
     • `["allowed", …]`      — the schema DEFAULT, which is what
       a dropped field writes.

   That third one is the reason no cell here asserts `not
   .toBe("allowed")` and stops. `decision` is `NOT NULL DEFAULT
   'allowed'`, so the wrong answer is already in the column
   waiting for an implementation that never sets it.

   ── and the distinction may not live in `action` ──
   backend.md §T240 forbids encoding it in action strings for
   `actor_kind`, and the same reasoning binds `decision`: a
   `bundle.publish.denied`/`bundle.publish.failed` pair
   distinguishes the two rows to a human reading the table and to
   nobody else. Both entries name the same action, so both rows
   must.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditRows,
  boundWriteAudit,
  RecordedSetup,
  scratchDatabase,
  type Scratch,
} from "./contract";

const setup = new RecordedSetup<Scratch>("The T240 decision scratch database");

/** The three the schema's `audit_decision` enum admits, and the whole of what AC5 quantifies over. */
const DECISIONS = ["allowed", "denied", "error"] as const;

beforeAll(async () => {
  await setup.run(scratchDatabase);
});

afterAll(async () => {
  await setup.optional()?.drop();
});

describe("T240 AC5 — `denied` is a policy refusal and `error` is a fault", () => {
  /**
   * The criterion, as a pair.
   *
   * Everything is held equal except the decision, so if the two rows come back the same the
   * only thing that could have collapsed them is the field under test.
   */
  it("records a refusal and a fault as two DIFFERENT decisions on the same action", async () => {
    const scratch = setup.require();
    const action = "bundle.publish";
    const targetId = "mara-veil/refused-then-faulted@1.0.0";

    const write = await boundWriteAudit();
    await write(scratch.client.db, {
      actorId: scratch.ownerId,
      actorKind: "owner",
      action,
      targetKind: "bundle",
      targetId,
      decision: "denied",
    });
    await write(scratch.client.db, {
      actorId: scratch.ownerId,
      actorKind: "owner",
      action,
      targetKind: "bundle",
      targetId,
      decision: "error",
    });

    const rows = (await auditRows(scratch)).filter((r) => r.target_id === targetId);
    expect(
      rows.length,
      `AC5: two entries were written for ${targetId} and ${rows.length} rows came back.`,
    ).toBe(2);

    expect(
      rows.map((r) => r.decision),
      `AC5: the refusal and the fault were recorded as ` +
        `${JSON.stringify(rows.map((r) => r.decision))}.\n` +
        `  \`["error","error"]\` is a policy refusal recorded as a fault. It writes one row, ` +
        `of the right shape, naming the right actor and target, at the right time — and the ` +
        `log can no longer answer whether the registry REFUSED or BROKE.\n` +
        `  \`["allowed","allowed"]\` is the schema DEFAULT, which is what an implementation ` +
        `that never sets the column writes.`,
    ).toEqual(["denied", "error"]);
  });

  /**
   * The distinction may not migrate into the action string.
   *
   * Same reasoning as AC2's clause: a `…denied`/`…failed` action pair distinguishes the rows
   * to a human reading the table and to no filter, no type and no reader.
   */
  it("leaves `action` identical, so the distinction lives in `decision` alone", async () => {
    const scratch = setup.require();
    const action = "card.publish";
    const targetId = "k0bra/same-action@1.0.0";

    const write = await boundWriteAudit();
    for (const decision of ["denied", "error"] as const) {
      await write(scratch.client.db, {
        actorId: scratch.ownerId,
        actorKind: "owner",
        action,
        targetKind: "card",
        targetId,
        decision,
      });
    }

    const rows = (await auditRows(scratch)).filter((r) => r.target_id === targetId);
    expect(rows.length, `AC5: expected two rows for ${targetId}, got ${rows.length}.`).toBe(2);

    expect(
      [...new Set(rows.map((r) => r.action))],
      `AC5: the two rows carry different actions — ${JSON.stringify(rows.map((r) => r.action))}. ` +
        `Both entries named ${JSON.stringify(action)}, so both rows must: encoding the ` +
        `decision in the action string makes every filter downstream depend on a naming ` +
        `convention no contract publishes.`,
    ).toEqual([action]);

    /* And the rows differ where they are supposed to, which the equality above cannot say. */
    expect(
      [...new Set(rows.map((r) => r.decision))].sort(),
      `AC5: the two rows share a decision, so a refusal and a fault are indistinguishable.`,
    ).toEqual(["denied", "error"]);
  });

  /**
   * Every member of the enum round-trips as itself.
   *
   * Quantified over the enum rather than written out per decision, so a fourth member
   * arriving in `schema.ts` is covered the day it lands rather than the day someone
   * remembers to add a cell — and so the loop's own domain is the thing under test.
   *
   * The assertion is the whole map at once. Three separate `toBe`s would each report a
   * different half of the same defect, and a reader counting reds would count three.
   */
  it("round-trips each of the three decisions as itself, not as the column default", async () => {
    const scratch = setup.require();
    const targetKind = "roundtrip";

    const write = await boundWriteAudit();
    for (const decision of DECISIONS) {
      await write(scratch.client.db, {
        actorId: scratch.ownerId,
        actorKind: "owner",
        action: "account.delete",
        targetKind,
        targetId: `roundtrip/${decision}`,
        decision,
      });
    }

    const rows = (await auditRows(scratch)).filter((r) => r.target_kind === targetKind);
    const observed = Object.fromEntries(
      rows.map((r) => [String(r.target_id).replace("roundtrip/", ""), r.decision]),
    );

    expect(
      observed,
      `AC5: the three decisions did not round-trip.\n` +
        `  Every wrong answer here is 'allowed', because that is the column's DEFAULT — so ` +
        `a writer that silently drops the field produces a full table of plausible rows.`,
    ).toEqual({ allowed: "allowed", denied: "denied", error: "error" });
  });
});
