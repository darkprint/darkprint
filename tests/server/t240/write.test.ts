/* ============================================================
   T240 AC1 — one `writeAudit` call inserts exactly one row and
   nothing else, anywhere, and the row names the right subject

   D-240-01 narrowed AC1 to what this task can own: the criterion
   is about `writeAudit` itself, because T240 owns
   `lib/server/observability/**`, every route file is Forbidden,
   and a grep for `writeAudit|listAudit|observability` over the
   tree returns zero call sites. The whole-corpus half — *each
   state-changing operation* — is recorded as unowned; nothing
   here pretends to test it.

   ── why not one assertion on a count ──
   **"Exactly one" is a claim about a COUNT, and a count is the
   property two genuinely different states are most likely to
   share.** A cell asserting one row passes whether the module
   wrote one row for the right reason or one row for the wrong
   one; and a cell asserting a TOTAL passes over a set that has
   changed underneath it. This run measured a Postgres stamp
   reading 14 before and 14 after across two entirely different
   name sets, and the check passed.

   So every cell here takes a whole-database `to_jsonb` snapshot
   before and after, diffs it as a MULTISET, and asserts:

     • the added set is exactly one row,
     • it is in `audit` and in no other table,
     • and its `actor_id`/`actor_kind`/`action`/`target_kind`/
       `target_id`/`decision`/`detail` equal a named tuple.

   The third is the one a count cannot make. A row naming the
   wrong actor is one row of the right shape at the right time.

   ── the two DEFAULTs, which is where a wrong implementation
      looks most correct ──
   `schema.ts` gives `actor_kind` a DEFAULT of `'owner'` and
   `decision` a DEFAULT of `'allowed'`. **An implementation that
   drops either on the floor writes a plausible row rather than
   failing** — the guard is in the schema and it points the wrong
   way. Every cell below therefore asserts a value that EXCLUDES
   the default rather than one that admits the good answer.

   ── ordering ──
   The module is bound LAST in every cell, after the planting and
   after the `before` snapshot. An early bind reds correctly
   about its own subject while masking every write below it; a
   red in 0ms where I/O was expected is a cell that never
   started.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditRows,
  auditTuple,
  boundWriteAudit,
  dbNow,
  describeAdded,
  RecordedSetup,
  rowsAdded,
  scratchDatabase,
  snapshotRows,
  totalAdded,
  type Scratch,
} from "./contract";

const setup = new RecordedSetup<Scratch>("The T240 write scratch database");

beforeAll(async () => {
  await setup.run(scratchDatabase);
});

afterAll(async () => {
  await setup.optional()?.drop();
});

describe("T240 AC1 — one call, one row, and the row is the one that was asked for", () => {
  it("adds exactly one row, in `audit`, and touches no other table", async () => {
    const scratch = setup.require();
    const before = await snapshotRows(scratch);

    const write = await boundWriteAudit();
    await write(scratch.client.db, {
      actorId: scratch.ownerId,
      actorKind: "owner",
      action: "bundle.publish",
      targetKind: "bundle",
      targetId: "sol-antczak/cold-start@1.0.0",
      decision: "allowed",
    });

    const added = rowsAdded(before, await snapshotRows(scratch));

    /* The whole-database half. An implementation writing its audit row AND something else
       satisfies every assertion scoped to `audit` alone; this is the only clause that sees
       it, and it is why the snapshot is not scoped to one table. */
    expect(
      [...added.keys()],
      `AC1: one \`writeAudit\` call added rows to ${describeAdded(added)}. It may add rows to ` +
        `\`audit\` and to nothing else — the module owns no other storage.`,
    ).toEqual(["audit"]);

    expect(
      totalAdded(added),
      `AC1: one \`writeAudit\` call added ${totalAdded(added)} rows (${describeAdded(added)}). ` +
        `backend.md §T240: "a test asserting a row EXISTS passes when three are written".`,
    ).toBe(1);
  });

  it("writes the actor, action, target and decision it was handed, element-wise", async () => {
    const scratch = setup.require();
    /* A target nothing else in this file uses, so a row from another cell cannot answer for
       this one. The suite shares one database across cells on purpose — a per-cell truncate
       would make the "nothing else was written" clause vacuous by construction. */
    const targetId = "mara-veil/pipeline-audit@2.3.1";
    const before = await snapshotRows(scratch);

    const write = await boundWriteAudit();
    await write(scratch.client.db, {
      actorId: scratch.operatorId,
      actorKind: "operator",
      action: "account.handle.rename",
      targetKind: "account",
      targetId,
      decision: "denied",
      detail: { oldHandle: "k0bra", newHandle: "k0bra-2", attempt: 3, forced: false },
    });

    const added = rowsAdded(before, await snapshotRows(scratch));
    const rows = added.get("audit") ?? [];
    expect(
      rows.length,
      `AC1: expected one added \`audit\` row, got ${rows.length} (${describeAdded(added)}).`,
    ).toBe(1);

    /* **The assertion a count cannot make.** One tuple compared in one `toEqual`, not six
       assertions that can each pass while the row names the wrong subject: `actor_id` and
       `actor_kind` are AC2, `decision` is AC5, and both DEFAULT to a plausible wrong answer
       in the schema. Asserting the whole tuple is what excludes `owner`/`allowed` here
       rather than merely preferring `operator`/`denied`. */
    expect(
      auditTuple(rows[0]),
      `AC1: the row \`writeAudit\` left behind does not name what it was handed.\n` +
        `  This is the clause a row COUNT cannot check — a row naming the wrong actor is ` +
        `one row, of the right shape, at the right time.\n` +
        `  Note both schema DEFAULTs: \`actor_kind\` defaults to 'owner' and \`decision\` ` +
        `to 'allowed', so an implementation that dropped either field writes a plausible ` +
        `row instead of failing.`,
    ).toEqual({
      actor_id: scratch.operatorId,
      actor_kind: "operator",
      action: "account.handle.rename",
      target_kind: "account",
      target_id: targetId,
      decision: "denied",
      detail: { oldHandle: "k0bra", newHandle: "k0bra-2", attempt: 3, forced: false },
    });
  });

  /**
   * Two calls, two rows — the clause that separates "writes exactly one row" from "keeps
   * exactly one row".
   *
   * An implementation upserting on `(actor, action, target)` satisfies every cell above:
   * one call adds one row, and the row names the right subject. It also destroys the log,
   * because the second occurrence of an action overwrites the first and the record of what
   * the registry did becomes a record of what it did last. Nothing else here can see that.
   */
  it("appends rather than upserts: the same entry twice leaves two rows", async () => {
    const scratch = setup.require();
    const entry = {
      actorId: scratch.ownerId,
      actorKind: "owner" as const,
      action: "bundle.transfer",
      targetKind: "bundle",
      targetId: "k0bra/twice-written@1.0.0",
      decision: "allowed" as const,
    };
    const before = await snapshotRows(scratch);

    const write = await boundWriteAudit();
    await write(scratch.client.db, entry);
    await write(scratch.client.db, entry);

    const added = rowsAdded(before, await snapshotRows(scratch));
    expect(
      totalAdded(added),
      `AC1: two identical \`writeAudit\` calls left ${totalAdded(added)} rows ` +
        `(${describeAdded(added)}).\n` +
        `  Two is the answer. One means the writer upserts, which satisfies every ` +
        `one-call-one-row cell while making the log unable to record that an action ` +
        `happened twice.`,
    ).toBe(2);

    /* And they must be two DISTINCT rows rather than one row counted twice — the ids differ,
       which is what `to_jsonb` multiset arithmetic would otherwise let collapse. */
    const ids = (added.get("audit") ?? []).map((r) => r.id);
    expect(new Set(ids).size, `AC1: the two rows share an id: ${JSON.stringify(ids)}.`).toBe(2);
  });
});

describe("T240 AC1 — the columns the entry does not name", () => {
  /**
   * `detail` is optional on `AuditEntry` and `NOT NULL DEFAULT '{}'` in the schema.
   *
   * The assertion EXCLUDES the two wrong answers rather than admitting the right one:
   * `null` (the column would reject it, but a writer passing the string `"null"` would not
   * be caught by a truthiness check) and the string `"undefined"`, which is what
   * `String(undefined)` produces when an optional field is interpolated instead of omitted.
   */
  it("defaults `detail` to an empty object, not to null and not to the string 'undefined'", async () => {
    const scratch = setup.require();
    const targetId = "sol-antczak/no-detail@0.1.0";
    const before = await snapshotRows(scratch);

    const write = await boundWriteAudit();
    await write(scratch.client.db, {
      actorId: scratch.ownerId,
      actorKind: "owner",
      action: "bundle.unpublish",
      targetKind: "bundle",
      targetId,
      decision: "allowed",
    });

    const rows = rowsAdded(before, await snapshotRows(scratch)).get("audit") ?? [];
    expect(rows.length, "AC1: expected one added row for the omitted-detail case.").toBe(1);
    expect(
      rows[0].detail,
      `AC1: an entry with no \`detail\` produced ${JSON.stringify(rows[0].detail)}. The ` +
        `column is \`jsonb NOT NULL DEFAULT '{}'\`, so an omitted detail is \`{}\`.`,
    ).toEqual({});
  });

  /**
   * `targetKind` and `targetId` are optional and NULLABLE, and this is where an omitted
   * optional most often becomes a lie: a writer that interpolates rather than omits stores
   * the four characters `null` or the nine characters `undefined`, and every downstream
   * filter then matches a target that does not exist.
   *
   * `toBeNull()` alone would admit neither of those, but it would also pass on a column the
   * writer never set — which is the correct answer here, so the cell adds the exclusion
   * explicitly rather than relying on a reader to notice the difference.
   */
  it("leaves an unnamed target NULL rather than storing 'null' or 'undefined'", async () => {
    const scratch = setup.require();
    const before = await snapshotRows(scratch);

    const write = await boundWriteAudit();
    await write(scratch.client.db, {
      actorId: null,
      actorKind: "system",
      action: "ontology.release",
      decision: "allowed",
    });

    const rows = rowsAdded(before, await snapshotRows(scratch)).get("audit") ?? [];
    expect(rows.length, "AC1: expected one added row for the no-target case.").toBe(1);

    const row = rows[0];
    expect(
      [row.target_kind, row.target_id],
      `AC1: an entry naming no target stored ` +
        `${JSON.stringify([row.target_kind, row.target_id])}. Both columns are nullable and ` +
        `an omitted optional is SQL NULL — the strings "null" and "undefined" are what an ` +
        `interpolating writer produces, and every later filter would match them.`,
    ).toEqual([null, null]);

    /* `actor_id` nullable is B-13's `system` actor: a state change no account initiated.
       Asserted here because the same interpolation defect would put a string in a uuid
       column, and Postgres would reject THAT — so this is the one of the three that fails
       loudly, and the cell records which is which. */
    expect(
      row.actor_id,
      `AC1: a \`system\` entry stored actor_id ${JSON.stringify(row.actor_id)}; B-13's ` +
        `\`system\` kind exists precisely for a state change no account initiated.`,
    ).toBeNull();
    expect(
      row.actor_kind,
      `AC1/AC2: the entry said \`system\` and the row says ${JSON.stringify(row.actor_kind)}. ` +
        `\`actor_kind\` DEFAULTS to 'owner' in the schema, so a dropped field lands here.`,
    ).toBe("system");
  });

  /**
   * AC1 names *time*, and this is the cell that makes "names a time" mean something.
   *
   * **`toBeInstanceOf(Date)` admits `new Date(0)`**, and a column left to a constant admits
   * every question the log exists to answer being answered wrongly. So the instant is
   * bracketed between two readings of Postgres's OWN clock taken either side of the call:
   * that excludes the epoch, excludes a hard-coded constant, and excludes a clock running
   * far ahead — none of which a type check or a non-null check can see.
   *
   * Both brackets come from `select now()` rather than from `Date.now()` on purpose. The
   * DEFAULT writes with the database's clock, so comparing against the test host's would
   * turn any skew into a flaky red, and skew in the other direction would make the bracket
   * admit an instant it should exclude.
   */
  it("stamps a time inside the window the call happened in, which excludes the epoch", async () => {
    const scratch = setup.require();
    const targetId = "k0bra/timed@1.0.0";
    const before = await dbNow(scratch);

    const write = await boundWriteAudit();
    await write(scratch.client.db, {
      actorId: scratch.ownerId,
      actorKind: "owner",
      action: "bundle.publish",
      targetKind: "bundle",
      targetId,
      decision: "allowed",
    });

    const after = await dbNow(scratch);
    const row = (await auditRows(scratch)).find((r) => r.target_id === targetId);
    expect(row, `AC1: no \`audit\` row was written for ${targetId}.`).toBeDefined();

    const stamped = new Date(String(row?.occurred_at));
    expect(
      Number.isFinite(stamped.getTime()),
      `AC1: occurred_at is ${JSON.stringify(row?.occurred_at)}, which is not an instant.`,
    ).toBe(true);

    expect(
      stamped.getTime() >= before.getTime() && stamped.getTime() <= after.getTime(),
      `AC1: occurred_at is ${stamped.toISOString()}, outside the window the call ran in ` +
        `(${before.toISOString()} … ${after.toISOString()}).\n` +
        `  Bracketed rather than type-checked on purpose: \`toBeInstanceOf(Date)\` admits ` +
        `\`new Date(0)\`, and a constant timestamp answers every question the log exists ` +
        `for with the same wrong answer.`,
    ).toBe(true);
  });
});
