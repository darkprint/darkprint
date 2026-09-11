/* ============================================================
   T240 AC1's discriminating case — an operation that fails
   partway leaves ONE row saying so, not an `allowed` and an
   `error`

   T240's contract names this as the case AC1 turns on, and
   D-240-01 makes it drivable from this partition: **`writeAudit`
   handed a transaction handle participates in it**, so an
   operation that fails partway leaves ZERO rows and its caller
   writes the single `error` row.

   That is the whole mechanism, and without it the criterion is
   unsatisfiable rather than merely untested: a writer that opens
   its own connection cannot be rolled back by its caller, so the
   `allowed` row it wrote before the operation failed survives
   forever beside the `error` row that follows it, and the log
   permanently records an action as both.

   ── why the third cell is the one that matters ──
   The first two cells are the mechanism. The third is the
   criterion: it replays the composed sequence a real caller
   performs — write `allowed` inside the transaction, fail, roll
   back, write the single `error` outside — and asserts the
   database ends with EXACTLY ONE row, whose decision is `error`.

   A two-row outcome passes "a row exists". It passes "the row
   names the right actor". It passes every count taken per call.
   **Only a whole-operation delta sees it**, which is why the
   snapshot brackets the entire sequence rather than each write.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditTuple,
  boundWriteAudit,
  describeAdded,
  RecordedSetup,
  rowsAdded,
  scratchDatabase,
  snapshotRows,
  totalAdded,
  type Scratch,
} from "./contract";

const setup = new RecordedSetup<Scratch>("The T240 transaction scratch database");

beforeAll(async () => {
  await setup.run(scratchDatabase);
});

afterAll(async () => {
  await setup.optional()?.drop();
});

/** The sentinel a rolled-back transaction is unwound with. Never caught by anything else. */
class OperationFailedPartway extends Error {
  constructor() {
    super("t240: the fixture operation failed partway, on purpose");
    this.name = "OperationFailedPartway";
  }
}

describe("T240 AC1 — `writeAudit` participates in the caller's transaction", () => {
  it("commits with the transaction: one row after a transaction that succeeds", async () => {
    const scratch = setup.require();
    const targetId = "sol-antczak/committed@1.0.0";
    const before = await snapshotRows(scratch);

    const write = await boundWriteAudit();
    await scratch.client.db.transaction(async (tx) => {
      await write(tx, {
        actorId: scratch.ownerId,
        actorKind: "owner",
        action: "bundle.publish",
        targetKind: "bundle",
        targetId,
        decision: "allowed",
      });
    });

    const added = rowsAdded(before, await snapshotRows(scratch));
    expect(
      totalAdded(added),
      `D-240-01: a committed transaction left ${totalAdded(added)} rows ` +
        `(${describeAdded(added)}); expected the one that was written.`,
    ).toBe(1);
    expect(
      auditTuple((added.get("audit") ?? [])[0] ?? {}),
      "D-240-01: the committed row does not name what the transaction wrote.",
    ).toEqual({
      actor_id: scratch.ownerId,
      actor_kind: "owner",
      action: "bundle.publish",
      target_kind: "bundle",
      target_id: targetId,
      decision: "allowed",
      detail: {},
    });
  });

  /**
   * The mechanism, isolated.
   *
   * A writer that opens a connection of its own — a module-level pool, a fresh client per
   * call — passes every cell in `write.test.ts` and fails here, because its row is already
   * committed by the time the caller's transaction unwinds. This is the only cell that can
   * tell the two implementations apart, and the difference is not cosmetic: it is whether
   * an operation that fails partway can be recorded once or must be recorded twice.
   */
  it("rolls back with the transaction: ZERO rows, anywhere, after one that unwinds", async () => {
    const scratch = setup.require();
    const targetId = "mara-veil/rolled-back@1.0.0";
    const before = await snapshotRows(scratch);

    const write = await boundWriteAudit();
    await expect(
      scratch.client.db.transaction(async (tx) => {
        await write(tx, {
          actorId: scratch.ownerId,
          actorKind: "owner",
          action: "bundle.publish",
          targetKind: "bundle",
          targetId,
          decision: "allowed",
        });
        throw new OperationFailedPartway();
      }),
      "the fixture transaction was expected to unwind and did not.",
    ).rejects.toThrow(OperationFailedPartway);

    const added = rowsAdded(before, await snapshotRows(scratch));
    expect(
      totalAdded(added),
      `D-240-01: a rolled-back transaction left ${totalAdded(added)} rows ` +
        `(${describeAdded(added)}); \`writeAudit\` must participate in the caller's ` +
        `transaction, so a rollback leaves ZERO.\n` +
        `  A writer opening a connection of its own passes every per-call cell and fails ` +
        `here — and then an operation that failed partway is recorded twice, forever, as ` +
        `both allowed and errored.`,
    ).toBe(0);
  });

  /**
   * **AC1's criterion, as T240's contract states it**: "the discriminating case is an
   * operation that fails partway, which must write exactly one row saying so rather than
   * one saying `allowed` and another saying `error`."
   *
   * The sequence is the composed one a real caller performs, and the snapshot brackets the
   * WHOLE of it rather than each write — a per-write count reads 1 and 1 and reports
   * success on precisely the outcome this cell exists to reject.
   *
   * The assertion is over the added rows' decisions as a set, so the failure message names
   * what is actually in the log rather than only how many things are.
   */
  it("an operation that fails partway leaves exactly one row, and it says `error`", async () => {
    const scratch = setup.require();
    const targetId = "k0bra/failed-partway@1.0.0";
    const action = "bundle.publish";
    const before = await snapshotRows(scratch);

    const write = await boundWriteAudit();

    /* The operation: it records its intent, then fails. Both halves inside one transaction,
       which is what makes the record of the intent disappear with the work it described. */
    await expect(
      scratch.client.db.transaction(async (tx) => {
        await write(tx, {
          actorId: scratch.ownerId,
          actorKind: "owner",
          action,
          targetKind: "bundle",
          targetId,
          decision: "allowed",
        });
        throw new OperationFailedPartway();
      }),
    ).rejects.toThrow(OperationFailedPartway);

    /* And the caller records what actually happened — once, outside the transaction that
       carried nothing through. */
    await write(scratch.client.db, {
      actorId: scratch.ownerId,
      actorKind: "owner",
      action,
      targetKind: "bundle",
      targetId,
      decision: "error",
    });

    const added = rowsAdded(before, await snapshotRows(scratch));
    const rows = added.get("audit") ?? [];

    expect(
      rows.map((r) => r.decision),
      `AC1: the failed-partway operation left ${rows.length} rows deciding ` +
        `${JSON.stringify(rows.map((r) => r.decision))}.\n` +
        `  T240's contract: it "must write exactly one row saying so rather than one ` +
        `saying \`allowed\` and another saying \`error\`".\n` +
        `  \`["allowed","error"]\` is the failure this cell exists for, and it passes every ` +
        `per-call count — one call, one row, twice.`,
    ).toEqual(["error"]);

    expect(
      totalAdded(added),
      `AC1: the operation added rows to ${describeAdded(added)}; the whole operation is one ` +
        `audit row and nothing else.`,
    ).toBe(1);
  });
});
