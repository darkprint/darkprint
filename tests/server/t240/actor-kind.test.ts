/* ============================================================
   T240 AC2 — an operator action is audited and distinguishable
   from an owner's

   T240's contract: "AC2 is `actor_kind`, already in the schema
   … State it so nobody adds a parallel `isOperator` boolean or
   encodes the distinction in `action` strings."

   So AC2 has three clauses and only the first is obvious:

     1. an operator action IS audited — a row exists;
     2. it is DISTINGUISHABLE from an owner's;
     3. and the distinction lives in `actor_kind` and nowhere
        else.

   A suite that writes one operator row and asserts
   `actor_kind === "operator"` covers (1) and appears to cover
   (2). It covers neither of the other two, because
   distinguishable is a claim about a PAIR — and an
   implementation that encodes the operator-ness in the action
   string ("operator.bundle.transfer" vs "bundle.transfer")
   satisfies every single-row assertion while making every filter
   and every reader downstream carry a string convention nobody
   published.

   ── so every cell here reads the PAIR ──
   One fixture, written once and memoised: same action, same
   target, same detail, differing in `actorKind` and in the
   account each names. Every assertion is then over the two rows
   TOGETHER — what must be equal, what must differ, and that
   nothing else moved.

   ── the schema default is the hazard ──
   `actor_kind` is `NOT NULL DEFAULT 'owner'`. An implementation
   that drops the field writes `owner` for both rows: two rows
   exist, both are well-shaped, both are at the right time, and
   AC2 is false. The cells EXCLUDE `owner` for the operator row
   rather than admitting `operator` — which is the same
   assertion only when the implementation is already correct.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditRows,
  auditTuple,
  boundWriteAudit,
  RecordedSetup,
  scratchDatabase,
  type Scratch,
} from "./contract";

const setup = new RecordedSetup<Scratch>("The T240 actor-kind scratch database");

/** The nine columns `schema.ts` declares on `audit`, and the whole of what a row may carry. */
const AUDIT_COLUMNS = [
  "id",
  "actor_id",
  "actor_kind",
  "action",
  "target_kind",
  "target_id",
  "decision",
  "detail",
  "occurred_at",
] as const;

beforeAll(async () => {
  await setup.run(scratchDatabase);
});

afterAll(async () => {
  await setup.optional()?.drop();
});

describe("T240 AC2 — the operator/owner distinction, asserted over the pair", () => {
  /**
   * The pair, written once and read by all three cells below.
   *
   * Same action, same target, same detail, same everything except `actorKind` and the
   * account each names. If the two rows come back differing in anything else, the module has
   * put the distinction somewhere the contract did not.
   */
  const action = "bundle.transfer";
  const targetId = "sol-antczak/handover@1.0.0";

  /**
   * Memoised, and it has to be: three cells read this pair and each would otherwise write it
   * again, leaving four rows under one target and failing the `rows.length !== 2` premise
   * for a reason that is the fixture's and not the module's.
   *
   * The memo holds the PROMISE, rejection included, so the absent module reaches each cell as
   * its own copy of the same red rather than as an unhandled rejection in the next.
   */
  let pair: Promise<{ owner: Record<string, unknown>; operator: Record<string, unknown> }> | undefined;

  function writePair(scratch: Scratch) {
    pair ??= plantPair(scratch);
    return pair;
  }

  async function plantPair(scratch: Scratch): Promise<{ owner: Record<string, unknown>; operator: Record<string, unknown> }> {
    const write = await boundWriteAudit();
    await write(scratch.client.db, {
      actorId: scratch.ownerId,
      actorKind: "owner",
      action,
      targetKind: "bundle",
      targetId,
      decision: "allowed",
    });
    await write(scratch.client.db, {
      actorId: scratch.operatorId,
      actorKind: "operator",
      action,
      targetKind: "bundle",
      targetId,
      decision: "allowed",
    });

    const rows = (await auditRows(scratch)).filter((r) => r.target_id === targetId);
    if (rows.length !== 2) {
      throw new Error(
        `AC2: the pair fixture wrote two entries and ${rows.length} rows came back. ` +
          `Every assertion below is about the PAIR, so this is the criterion failing before ` +
          `it can be measured: an operator action that is not audited at all is AC2's first ` +
          `clause, and it fails here.`,
      );
    }
    const owner = rows.find((r) => r.actor_id === scratch.ownerId);
    const operator = rows.find((r) => r.actor_id === scratch.operatorId);
    if (owner === undefined || operator === undefined) {
      throw new Error(
        `AC2: the two rows do not name the two accounts they were written for — ` +
          `${JSON.stringify(rows.map((r) => r.actor_id))}.`,
      );
    }
    return { owner, operator };
  }

  it("audits the operator action and marks it `operator`, which excludes the schema default", async () => {
    const scratch = setup.require();
    const { operator } = await writePair(scratch);

    expect(
      operator.actor_kind,
      `AC2: the operator's row carries actor_kind ${JSON.stringify(operator.actor_kind)}.\n` +
        `  \`actor_kind\` is NOT NULL DEFAULT 'owner' in schema.ts, so an implementation ` +
        `that never sets the field writes 'owner' here — a plausible row rather than a ` +
        `failure, and AC2 false with nothing to show for it.`,
    ).toBe("operator");
  });

  /**
   * **The clause a single-row cell cannot reach.** Two rows for the same action, and the
   * only thing that may differ between them is who acted.
   *
   * `action` equal is the assertion that forecloses the encoded-in-the-string
   * implementation: if the module writes `operator.bundle.transfer` for one and
   * `bundle.transfer` for the other, both rows exist, both carry an `actor_kind`, and every
   * reader downstream now has to know a naming convention that appears in no contract.
   */
  it("differs from the owner's row in `actor_kind` and in nothing else the entry shared", async () => {
    const scratch = setup.require();
    const { owner, operator } = await writePair(scratch);

    expect(
      operator.action,
      `AC2: the two rows carry different actions — owner ${JSON.stringify(owner.action)}, ` +
        `operator ${JSON.stringify(operator.action)}.\n` +
        `  T240's contract: nobody may "encode the distinction in \`action\` strings". Both ` +
        `entries named the same action, so both rows must.`,
    ).toBe(owner.action);

    const ownerTuple = auditTuple(owner);
    const operatorTuple = auditTuple(operator);
    expect(
      { ...operatorTuple, actor_id: null, actor_kind: null },
      `AC2: the two rows differ somewhere other than actor_id/actor_kind.\n` +
        `  owner:    ${JSON.stringify(ownerTuple)}\n` +
        `  operator: ${JSON.stringify(operatorTuple)}`,
    ).toEqual({ ...ownerTuple, actor_id: null, actor_kind: null });

    /* And they must actually be distinguishable, which the equality above cannot say. */
    expect(
      operatorTuple.actor_kind === ownerTuple.actor_kind,
      `AC2: both rows carry actor_kind ${JSON.stringify(ownerTuple.actor_kind)}, so an ` +
        `operator action is NOT distinguishable from an owner's — which is the criterion.`,
    ).toBe(false);
  });

  /**
   * The "no parallel `isOperator` boolean" clause, tested where such a flag could actually
   * land.
   *
   * T240 cannot alter `schema.ts` — that file is another task's — so a parallel flag cannot
   * become a column. It CAN become a key in `detail`, which is a `jsonb` map the module
   * controls entirely, and that is the shape this cell looks for: both entries passed no
   * `detail` at all, so both rows must carry the column default and nothing else.
   *
   * The row's key set is asserted too. It is not the flag's likely home, but it is the
   * cheapest possible statement of what a row is allowed to be, and it costs one assertion.
   */
  it("carries no parallel flag: `detail` is empty and the row is the schema's nine columns", async () => {
    const scratch = setup.require();
    const { owner, operator } = await writePair(scratch);

    for (const [label, row] of [
      ["owner", owner],
      ["operator", operator],
    ] as const) {
      expect(
        row.detail,
        `AC2: the ${label} row's \`detail\` is ${JSON.stringify(row.detail)}. Neither entry ` +
          `passed a detail, so a key here is the module putting the operator distinction ` +
          `somewhere besides \`actor_kind\` — the parallel \`isOperator\` boolean, in the ` +
          `one place T240 could still put it.`,
      ).toEqual({});

      expect(
        Object.keys(row).sort(),
        `AC2: the ${label} \`audit\` row's columns are not the nine schema.ts declares.`,
      ).toEqual([...AUDIT_COLUMNS].sort());
    }
  });
});
