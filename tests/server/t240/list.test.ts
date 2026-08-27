/* ============================================================
   T240 D-240-04 and D-240-02 — who may read the log, what the
   refusal is allowed to say, and what a read hands back

   D-240-04: `listAudit` permits **OPERATOR only** — B-13's
   break-glass. `can()` cannot decide it, because `Resource` has
   no `audit` kind and `Action` has no member meaning *read the
   audit log*, and adding one is `lib/server/policy/**`, another
   task's file. Anonymous and account are both refused with the
   published sentence.

   D-240-02: the read shape is `(AuditEntry & { occurredAt: Date
   })[]`. AC1 names *actor, action, target and time*, and the
   block's `AuditEntry` carries no time while the same signature
   takes `since?: Date` — a filter over a quantity its own return
   type could not expose.

   ── the refusal, and why it is asserted as an IDENTITY ──
   §T240: the message is `"listAudit: not permitted."` and
   "nothing about the target, since naming a target the caller
   may not see is itself a leak (B-03's 404-not-403, one layer
   down)".

   A cell that scans the refusal for the target string tests a
   blacklist, and `A whitelist asserted with a blacklist test IS
   a blacklist`: it passes for a message that leaks the target's
   *kind*, or its owner, or whether it exists — none of which is
   the literal it scanned for. So two things are asserted
   instead, and neither is a scan:

     • the message equals the published form EXACTLY;
     • and the refusal for a filter naming a target that EXISTS
       is byte-identical to the refusal for one naming a target
       that does not, and to the refusal for no filter at all.

   The second is the 404-not-403 clause stated as an experiment:
   if any part of the sentence varies with what the caller asked
   about, the log has answered a question it refused to answer.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditRows,
  boundListAudit,
  boundWriteAudit,
  dbNow,
  describeAdded,
  RecordedSetup,
  refusalForm,
  refusalFrom,
  rowsAdded,
  scratchDatabase,
  snapshotRows,
  totalAdded,
  type Row,
  type Scratch,
} from "./contract";

/** The corpus every read cell quantifies over, planted once. */
interface Planted extends Scratch {
  /** Written first, then a clock reading, then `late`. `since` must separate them. */
  early: readonly { targetKind: string; targetId: string; action: string }[];
  late: readonly { targetKind: string; targetId: string; action: string }[];
  between: Date;
}

const setup = new RecordedSetup<Scratch>("The T240 listAudit scratch database");

/**
 * The corpus, planted on first use rather than in `beforeAll`, and memoised.
 *
 * **The planting needs `writeAudit`, so it needs the module — and a bind inside `beforeAll`
 * would put the module's absence in the SETUP.** `RecordedSetup` would still turn that into
 * reds rather than skips, but every one of them would say "the fixture could not be set up"
 * where the protocol asks for one red per criterion: eight cells reporting the same sentence
 * about a hook, and not one of them naming the thing it was written to measure.
 *
 * Memoised as the promise, rejection included, so the module's absence reaches each cell as
 * its own copy of the same red rather than as an unhandled rejection in the next one.
 */
let planted: Promise<Planted> | undefined;

function corpus(scratch: Scratch): Promise<Planted> {
  planted ??= (async () => {
    const early = [
      { targetKind: "bundle", targetId: "sol-antczak/early-a@1.0.0", action: "bundle.publish" },
      { targetKind: "bundle", targetId: "sol-antczak/early-b@1.0.0", action: "bundle.publish" },
      { targetKind: "card", targetId: "sol-antczak/early-card", action: "card.publish" },
    ] as const;
    const late = [
      { targetKind: "bundle", targetId: "mara-veil/late-a@1.0.0", action: "bundle.transfer" },
    ] as const;

    const write = await boundWriteAudit();
    for (const e of early) {
      await write(scratch.client.db, {
        actorId: scratch.ownerId,
        actorKind: "owner",
        action: e.action,
        targetKind: e.targetKind,
        targetId: e.targetId,
        decision: "allowed",
      });
    }
    /* Read off Postgres's own clock, between the halves: `since` is asserted against an
       instant this run produced on the same clock `occurred_at`'s DEFAULT writes with, not
       against an offset from `Date.now()` on the test host's.

       The sleep exists because `pg` parses that clock into a JS Date, which truncates
       microseconds to milliseconds: a boundary read in the SAME millisecond as the last
       early write re-admits that write after truncation (`>= .605000` includes `.605432`).
       Measured exactly once in 9083 under full-suite load, and the admitted row was the
       last-written early row — the mechanism's fingerprint. Two milliseconds on Postgres's
       own clock puts the read beyond the millisecond any early row occupies, so the
       truncation has nothing left to hand back; the late half is written after this line
       and stays on the inclusive side. */
    await scratch.client.query("select pg_sleep(0.002)");
    const between = await dbNow(scratch);
    for (const e of late) {
      await write(scratch.client.db, {
        actorId: scratch.operatorId,
        actorKind: "operator",
        action: e.action,
        targetKind: e.targetKind,
        targetId: e.targetId,
        decision: "allowed",
      });
    }

    return { ...scratch, early, late, between };
  })();
  return planted;
}

const OPERATOR = (scratch: Scratch) => ({ kind: "operator" as const, accountId: scratch.operatorId });
const ANONYMOUS = { kind: "anonymous" as const };
const ACCOUNT = (scratch: Scratch) => ({
  kind: "account" as const,
  accountId: scratch.ownerId,
  handle: "t240-owner",
});

beforeAll(async () => {
  /* The hook does the one thing that cannot fail for a reason a criterion cares about: it
     creates the scratch database. The corpus is planted lazily, on the first cell that
     needs it — see `corpus` above. */
  await setup.run(scratchDatabase);
});

afterAll(async () => {
  await setup.optional()?.drop();
});

describe("T240 D-240-04 — the log is readable by an operator and by nobody else", () => {
  it("permits an operator", async () => {
    const env = await corpus(setup.require());
    const list = await boundListAudit();

    const rows = await list(env.client.db, OPERATOR(env), {});
    expect(
      Array.isArray(rows),
      `D-240-04: an operator read answered ${typeof rows}; B-13's break-glass is the one ` +
        `actor the log admits, so this is the permitted path.`,
    ).toBe(true);

    /* Element-wise, not a count. The planted corpus is four rows and the returned set must be
       those four targets — a count of four would pass over any four rows in the table. */
    expect(
      rows.map((r) => String((r as Row).targetId ?? "")).sort(),
      `D-240-04: an unfiltered operator read did not answer the planted corpus.`,
    ).toEqual([...env.early, ...env.late].map((e) => e.targetId).sort());
  });

  it("refuses an anonymous caller with the published sentence, exactly", async () => {
    const env = await corpus(setup.require());
    const list = await boundListAudit();

    const refusal = await refusalFrom(list(env.client.db, ANONYMOUS, {}), "D-240-04");
    expect(
      refusal.message,
      `D-240-04: an anonymous read was refused with ${JSON.stringify(refusal.message)}.\n` +
        `  §T240 publishes exactly one admissible form for this module and this is it. ` +
        `Matched by EXACT equality rather than by scanning for what should not be there — ` +
        `a whitelist asserted with a blacklist test is a blacklist.`,
    ).toBe(refusalForm());
  });

  /**
   * **The one D-240-04 settled that neither reading of the contract could.**
   *
   * An account is a signed-in visitor with a real identity, and "may I read my own audit
   * rows" is the plausible product answer that the ruling declined to give: `filter` has no
   * `actorId` member to express it with, and that absence is deliberate. So an account is
   * refused, with the same sentence, and if that is ever revisited this cell is where it
   * announces itself.
   */
  it("refuses a signed-in account with the same sentence", async () => {
    const env = await corpus(setup.require());
    const list = await boundListAudit();

    const refusal = await refusalFrom(list(env.client.db, ACCOUNT(env), {}), "D-240-04");
    expect(
      refusal.message,
      `D-240-04: a signed-in account read was refused with ` +
        `${JSON.stringify(refusal.message)}. The ruling permits OPERATOR only — whether an ` +
        `account may read its own rows "is a product decision nobody has made".`,
    ).toBe(refusalForm());
  });

  /**
   * B-03's 404-not-403, one layer down, as an experiment rather than as a scan.
   *
   * Three refusals: one asking about a target that exists in the corpus, one asking about a
   * target that does not exist at all, one asking about nothing. If the sentences differ in
   * any character, some part of it varies with what the caller asked about — and a refusal
   * that varies with the question has answered it.
   *
   * This catches leaks a scan for the target string cannot: a message that names the target
   * KIND, or says "no such target", or is merely longer when the target exists.
   */
  it("says the same thing whatever the caller asked about", async () => {
    const env = await corpus(setup.require());
    const list = await boundListAudit();

    const aboutExisting = await refusalFrom(
      list(env.client.db, ANONYMOUS, {
        targetKind: env.early[0].targetKind,
        targetId: env.early[0].targetId,
      }),
      "D-240-04",
    );
    const aboutAbsent = await refusalFrom(
      list(env.client.db, ANONYMOUS, {
        targetKind: "bundle",
        targetId: "nobody/there-is-no-such-bundle@9.9.9",
      }),
      "D-240-04",
    );
    const aboutNothing = await refusalFrom(list(env.client.db, ANONYMOUS, {}), "D-240-04");

    expect(
      [aboutExisting.message, aboutAbsent.message],
      `B-03: the refusal varies with what the caller asked about.\n` +
        `  about an existing target: ${JSON.stringify(aboutExisting.message)}\n` +
        `  about an absent target:   ${JSON.stringify(aboutAbsent.message)}\n` +
        `  about nothing:            ${JSON.stringify(aboutNothing.message)}\n` +
        `  §T240: "nothing about the target, since naming a target the caller may not see is ` +
        `itself a leak". A refusal that is longer, or differently worded, when the target ` +
        `exists has told the caller it exists — which is the whole of the 404-not-403 rule.`,
    ).toEqual([aboutNothing.message, aboutNothing.message]);
  });

  /** A read is a read. A refused read most of all. */
  it("writes nothing when it refuses", async () => {
    const env = await corpus(setup.require());
    const before = await snapshotRows(env);

    const list = await boundListAudit();
    await refusalFrom(list(env.client.db, ANONYMOUS, {}), "D-240-04");

    const added = rowsAdded(before, await snapshotRows(env));
    expect(
      totalAdded(added),
      `D-240-04: a refused \`listAudit\` wrote ${totalAdded(added)} rows ` +
        `(${describeAdded(added)}). A refused read is not a state change and audits nothing ` +
        `— an audit row for every refused read is how a log becomes an amplifier.`,
    ).toBe(0);
  });
});

describe("T240 D-240-02 — the read shape carries the time AC1 names", () => {
  it("hands back `occurredAt` on every element, inside the window the rows were written in", async () => {
    const env = await corpus(setup.require());
    const list = await boundListAudit();

    const rows = await list(env.client.db, OPERATOR(env), {});
    expect(rows.length, "D-240-02: the operator read answered nothing to assert on.").toBeGreaterThan(0);

    const missing = rows.filter((r) => (r as Row).occurredAt === undefined);
    expect(
      missing.length,
      `D-240-02: ${missing.length} of ${rows.length} entries carry no \`occurredAt\`. AC1 ` +
        `names "actor, action, target and TIME", and the block's bare \`AuditEntry[]\` return ` +
        `could not express it while the same signature took \`since?: Date\`.`,
    ).toBe(0);

    /* A Date, and a real one. `toBeInstanceOf(Date)` admits `new Date(0)`, so the instant is
       bracketed against the row's own stored `occurred_at` — the two must agree, which
       excludes both the epoch and any constant the read layer invented. */
    const stored = new Map(
      (await auditRows(env)).map((r) => [String(r.target_id), new Date(String(r.occurred_at)).getTime()]),
    );
    const disagreeing = rows.filter((r) => {
      const at = (r as Row).occurredAt;
      const seen = at instanceof Date ? at.getTime() : Number.NaN;
      return seen !== stored.get(String((r as Row).targetId));
    });
    expect(
      disagreeing.map((r) => [(r as Row).targetId, (r as Row).occurredAt]),
      `D-240-02: an entry's \`occurredAt\` is not the instant its row carries.\n` +
        `  Compared against the stored column rather than type-checked: ` +
        `\`toBeInstanceOf(Date)\` admits \`new Date(0)\`, and a read layer stamping ` +
        `\`new Date()\` on the way out would pass every check that only asks what type it is.`,
    ).toEqual([]);
  });

  it("carries the entry fields the write put in", async () => {
    const env = await corpus(setup.require());
    const list = await boundListAudit();

    const rows = await list(env.client.db, OPERATOR(env), {
      targetKind: env.late[0].targetKind,
      targetId: env.late[0].targetId,
    });
    expect(rows.length, `D-240-02: expected the one late row, got ${rows.length}.`).toBe(1);

    const entry = rows[0] as Row;
    expect(
      {
        actorId: entry.actorId,
        actorKind: entry.actorKind,
        action: entry.action,
        targetKind: entry.targetKind,
        targetId: entry.targetId,
        decision: entry.decision,
      },
      `D-240-02: the entry handed back does not name what was written.`,
    ).toEqual({
      actorId: env.operatorId,
      actorKind: "operator",
      action: env.late[0].action,
      targetKind: env.late[0].targetKind,
      targetId: env.late[0].targetId,
      decision: "allowed",
    });
  });
});

describe("T240 — `listAudit`'s three filters narrow to the right SET, not to the right count", () => {
  it("`targetKind` answers exactly the rows of that kind", async () => {
    const env = await corpus(setup.require());
    const list = await boundListAudit();

    const rows = await list(env.client.db, OPERATOR(env), { targetKind: "card" });
    expect(
      rows.map((r) => String((r as Row).targetId ?? "")).sort(),
      `filtering by targetKind "card" answered the wrong SET. A count would have passed over ` +
        `any one row in a four-row corpus.`,
    ).toEqual(env.early.filter((e) => e.targetKind === "card").map((e) => e.targetId).sort());
  });

  it("`targetId` answers exactly the rows for that target", async () => {
    const env = await corpus(setup.require());
    const list = await boundListAudit();

    const rows = await list(env.client.db, OPERATOR(env), {
      targetKind: env.early[0].targetKind,
      targetId: env.early[0].targetId,
    });
    expect(
      rows.map((r) => String((r as Row).targetId ?? "")),
      `filtering by targetId answered the wrong set.`,
    ).toEqual([env.early[0].targetId]);
  });

  /**
   * `since` is the filter D-240-02 exists for: before the ruling the return type could not
   * expose the quantity this filters on, so a caller could not have checked its own answer.
   *
   * The corpus is planted in two halves around a reading of Postgres's own clock, so the
   * boundary is a real instant this run produced rather than an offset from `Date.now()` on
   * a different clock.
   */
  it("`since` answers exactly the rows written after it", async () => {
    const env = await corpus(setup.require());
    const list = await boundListAudit();

    const rows = await list(env.client.db, OPERATOR(env), { since: env.between });
    expect(
      rows.map((r) => String((r as Row).targetId ?? "")).sort(),
      `filtering by \`since\` answered the wrong set. The corpus was planted in two halves ` +
        `around ${env.between.toISOString()}, read off Postgres's own clock — the same clock ` +
        `\`occurred_at\`'s DEFAULT writes with.`,
    ).toEqual(env.late.map((e) => e.targetId).sort());
  });
});
