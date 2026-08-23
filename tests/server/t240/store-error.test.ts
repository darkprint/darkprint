/* ============================================================
   T240 D-240-05 — `writeAudit` PROPAGATES a driver fault,
   wrapped, and leaves nothing behind when it does

   The block says this module "writes rows rather than raising".
   D-240-05 rules what that means: it makes **no policy
   decision**, not that it swallows faults. `audit.actor_id` is a
   real foreign key to `account.id`, so an entry naming an
   account that does not exist is a Postgres `23503` — and
   swallowing it violates AC1 in the direction nobody checks:
   **zero rows, silently.** An operation would report itself
   audited with no row anywhere to show for it, and no cell
   asserting "one row was written" would ever run, because the
   call that was supposed to write it returned normally.

   ── the half a `rejects.toThrow()` cannot see ──
   **Assert what the writer LEFT BEHIND, not only that it threw.**
   A mutation that inserts a row and *then* throws satisfies
   every `rejects.toThrow()` a reviewer would write, and leaves
   the row that breaks a reader forever. So every cell here
   brackets the failing call with a whole-database snapshot and
   asserts the delta is zero.

   ── the hygiene half, and the two false leaks it reported ──
   B-03: error responses carry no stack, no query and no internal
   path. §T240 publishes no admissible form for THIS class — it
   publishes one, and it is `listAudit`'s refusal — so an exact
   pin is unavailable and inventing one would red every
   implementation that phrased the sentence differently. Both
   sides are derived instead.

   **The first version of that derivation reported the correct
   implementation as leaking, twice, and both are recorded rather
   than quietly fixed.** It flagged `store`, which came out of
   `cause.stack` — the runtime's record of the module's OWN
   filenames, which put every file in `lib/server/**` in the deny
   set and forbade the module from naming itself. Narrowed to
   `cause.message`, it then flagged `failed`, a word drizzle uses
   in its `Failed query` prefix and a word any wrapper
   legitimately uses. **A deny set holding ordinary English reds a
   correct module for being written in English.**

   So the criterion is now carried by TWO instruments that cover
   different things and neither subsumes the other:

     • `leakedWords` — IDENTIFIER-shaped tokens only (snake_case,
       or quoted by the driver), with the allow set derived from
       `getTableConfig(schema.audit)` plus the caller's own
       values. `audit` and `audit_actor_id_fkey` are different
       tokens, so a module naming its own table is not charged.
     • `statementShape` — the statement as SHAPE: a `$n`
       placeholder, a `params:` dump, a DML keyword. This is the
       half a word check structurally cannot make, because a
       wrapper echoing `insert into "audit" ("id", "actor_id", …)`
       uses nothing but names the allow set legitimately grants.

   Both are falsified in both directions in the last cell, and
   the GREEN half of that falsification is the one that matters:
   it is what the two false leaks above would have failed.

   And one thing is stated rather than tested, because it cannot
   be tested from here: `cause` is NON-ENUMERABLE (D-240-05), and
   a walk of enumerable properties is blind to it by
   construction. The sealed-shape cell asserts what SHIPS
   (`JSON.stringify` is `{}`); it does not and cannot assert that
   nothing sensitive hides behind a non-enumerable member. That
   tension is real and it is D-13's, not this suite's to resolve.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditOwnNames,
  boundAuditStoreError,
  boundWriteAudit,
  describeAdded,
  enumerableShape,
  leakedWords,
  RecordedSetup,
  refusalFrom,
  rowsAdded,
  scratchDatabase,
  snapshotRows,
  statementShape,
  totalAdded,
  type Scratch,
} from "./contract";

const setup = new RecordedSetup<Scratch>("The T240 store-error scratch database");

/**
 * A well-formed uuid with no `account` row, so the insert fails on the FK and not on a cast.
 *
 * A malformed string would fail as `22P02` (invalid input syntax) before the constraint was
 * ever consulted — a different fault, arriving from a different layer, and the cell would be
 * measuring the driver's parser instead of D-240-05.
 */
const ABSENT_ACCOUNT = "00000000-0000-4000-8000-0000000t240f";

/** The entry every cell here writes: valid in every respect except the actor that does not exist. */
function orphanEntry() {
  return {
    actorId: "00000000-0000-4000-8000-000000000240",
    actorKind: "owner" as const,
    action: "bundle.publish",
    targetKind: "bundle",
    targetId: "sol-antczak/orphan@1.0.0",
    decision: "allowed" as const,
  };
}

beforeAll(async () => {
  await setup.run(scratchDatabase);
});

afterAll(async () => {
  await setup.optional()?.drop();
});

describe("T240 D-240-05 — a driver fault propagates, wrapped", () => {
  it("rejects with `AuditStoreError` rather than resolving on a foreign-key violation", async () => {
    const scratch = setup.require();
    const entry = orphanEntry();

    /* The premise, measured rather than assumed: the account this entry names really is
       absent, so the insert really will hit the constraint. Without this the cell could pass
       for the wrong reason on a database where the uuid happened to exist. */
    const present = await scratch.client.query<{ n: string }>(
      `select count(*)::text as n from "account" where id = $1`,
      [entry.actorId],
    );
    expect(
      present.rows[0].n,
      `the fixture's absent-account premise is false: ${entry.actorId} exists in this ` +
        `scratch database, so nothing here would violate a constraint.`,
    ).toBe("0");

    const write = await boundWriteAudit();
    const AuditStoreError = await boundAuditStoreError();

    const refusal = await refusalFrom(
      write(scratch.client.db, entry),
      "D-240-05",
    );

    expect(
      refusal instanceof AuditStoreError,
      `D-240-05: \`writeAudit\` rejected with ${refusal.name}: ${refusal.message}\n` +
        `  The ruling wraps a driver fault in \`AuditStoreError\`. A bare driver error ` +
        `reaching a caller is the B-03 leak this class exists to close; a resolved call is ` +
        `AC1 violated in the direction nobody checks — zero rows, silently.`,
    ).toBe(true);
  });

  /**
   * **The half `rejects.toThrow()` cannot see.**
   *
   * An implementation that inserts and then throws satisfies the cell above completely. This
   * is the only one that separates "it refused" from "it refused and changed nothing", and
   * the snapshot is whole-database rather than scoped to `audit` for the same reason it is
   * everywhere else in this suite.
   */
  it("leaves nothing behind, in any table, when it rejects", async () => {
    const scratch = setup.require();
    const before = await snapshotRows(scratch);

    const write = await boundWriteAudit();
    await refusalFrom(write(scratch.client.db, orphanEntry()), "D-240-05");

    const added = rowsAdded(before, await snapshotRows(scratch));
    expect(
      totalAdded(added),
      `D-240-05: a rejected \`writeAudit\` left ${totalAdded(added)} rows behind ` +
        `(${describeAdded(added)}).\n` +
        `  A writer that inserts and THEN throws passes every \`rejects.toThrow()\` a ` +
        `reviewer would write, and leaves the row that breaks a reader forever.`,
    ).toBe(0);
  });
});

describe("T240 D-240-05 / B-03 — what the wrapper is allowed to say", () => {
  it("carries the driver error on a non-enumerable `cause` and ships as `{}`", async () => {
    const scratch = setup.require();

    const write = await boundWriteAudit();
    const refusal = await refusalFrom(write(scratch.client.db, orphanEntry()), "D-240-05");

    const shape = enumerableShape(refusal);
    expect(
      shape.json,
      `B-03: the error serialises as ${shape.json}. Its enumerable own properties are what ` +
        `\`JSON.stringify\` ships and therefore what can reach a client, and D-240-05 has ` +
        `\`AuditStoreError\` carry the operation alone.\n` +
        `  own enumerable keys: ${shape.keys.join(", ") || "(none)"}`,
    ).toBe("{}");

    expect(
      shape.keys,
      `B-03: the error carries enumerable own properties ${shape.keys.join(", ")}.`,
    ).toEqual([]);

    /* `name` on the PROTOTYPE, which is what D-240-05 states and what keeps it out of the
       serialised shape above. An own `name` would have shown up in `keys` — asserted
       separately anyway, because the two happen to agree today and are different claims. */
    expect(
      Object.prototype.hasOwnProperty.call(refusal, "name"),
      `D-240-05: \`name\` is an OWN property of the instance. The ruling puts it on the ` +
        `prototype, which is what keeps it out of \`JSON.stringify\`.`,
    ).toBe(false);
    expect(refusal.name, "D-240-05: the class does not name itself.").toBe("AuditStoreError");

    /* And the cause must be THERE — non-enumerable is not the same as absent, and an
       implementation that drops it satisfies every hygiene assertion above while making the
       fault undiagnosable. Read directly rather than through `enumerableShape`, which is
       blind to it by construction. */
    expect(
      refusal.cause,
      `D-240-05: the wrapper carries no \`cause\`. Non-enumerable is not absent — the driver ` +
        `error has to survive for the fault to be diagnosable at all, it just may not ship.`,
    ).toBeDefined();
    expect(
      Object.prototype.propertyIsEnumerable.call(refusal, "cause"),
      `D-240-05: \`cause\` is ENUMERABLE, so the driver error ships in the serialised body — ` +
        `which is the B-03 leak (no stack, no query, no internal path) in the one place a ` +
        `reviewer looking at \`message\` would never check.`,
    ).toBe(false);
  });

  /**
   * The message, with both sides derived rather than either curated.
   *
   * §T240 publishes no admissible form for this class, so there is nothing to match exactly
   * — and a blind author inventing one reds every implementation that phrased it
   * differently. What is checkable without inventing anything: no word that the driver put
   * in its own error, and that the caller did not supply, may appear in the wrapper's
   * message.
   *
   * Word by word rather than by substring, because `audit` and `audit_actor_id_fkey` are
   * different tokens — a substring scan for the table name reds a correct implementation
   * that names its own table, and `A whitelist asserted with a blacklist test IS a
   * blacklist`.
   */
  it("names no word the driver error carries that the caller did not supply", async () => {
    const scratch = setup.require();
    const entry = orphanEntry();

    const write = await boundWriteAudit();
    const refusal = await refusalFrom(write(scratch.client.db, entry), "D-240-05");

    /* Derived on both sides, curated on neither. The caller's own identifiers, plus every
       name `getTableConfig` reports for `audit` — a word the module is entitled to say
       about its own storage is not a leak, and deriving the entitlement means a column
       added to schema.ts does not silently start reading as one. */
    const allowed = [
      entry.actorId,
      entry.actorKind,
      entry.action,
      entry.targetKind,
      entry.targetId,
      entry.decision,
      ...auditOwnNames(),
      "writeAudit",
      "listAudit",
      "AuditStoreError",
      "NotPermittedError",
      "observability",
    ];

    /* **The half a word comparison structurally cannot make.** D-13 forbids the failed
       statement and its bound parameters, and a wrapper echoing
       `insert into "audit" ("id", "actor_id", …)` uses nothing but names the allow set
       above legitimately grants — so the lexical check waves it straight through. This one
       is about SHAPE: a `$n` placeholder, a `params:` dump, a DML keyword. It is also the
       clause that matters most here, because `params` for this module ARE the audit
       `detail` — the exact field AC3 exists to keep out of a rendering. */
    const statement = statementShape(refusal.message);
    expect(
      statement,
      `D-13/B-03: the message carries ${statement.join(", ")}.\n` +
        `  message: ${JSON.stringify(refusal.message)}\n` +
        `  For this module the bound parameters ARE the audit \`detail\`, so a driver error ` +
        `reaching a caller leaks precisely the field AC3 is built to protect.`,
    ).toEqual([]);

    const leaked = leakedWords(refusal.message, refusal.cause, allowed);
    expect(
      leaked,
      `B-03: the wrapper's message repeats ${leaked.join(", ")} from the driver error it ` +
        `wraps.\n` +
        `  message: ${JSON.stringify(refusal.message)}\n` +
        `  cause:   ${JSON.stringify(String((refusal.cause as Error | undefined)?.message ?? ""))}\n` +
        `  Both sides are DERIVED — the deny set is the driver's own words, the allow set is ` +
        `what the caller passed plus this module's vocabulary — so nothing here is a ` +
        `hand-curated blacklist that goes stale when the driver rewords itself.`,
    ).toEqual([]);

    /* The cheapest and most concrete half of B-03, and the one an implementation is likeliest
       to get wrong by accident: a stack, or an absolute path out of this machine. Asserted as
       an exclusion rather than as a scan for a keyword — a message may legitimately contain
       the word `at`, it may not contain this repository's own path. */
    expect(
      refusal.message.includes("/Users/") || refusal.message.includes("node_modules"),
      `B-03: the message carries an internal path.\n  message: ${refusal.message}`,
    ).toBe(false);
    expect(
      /\n\s+at\s/.test(refusal.message),
      `B-03: the message carries a stack frame.\n  message: ${refusal.message}`,
    ).toBe(false);
  });

  /**
   * **The instrument, falsified.**
   *
   * `leakedWords` returning `[]` above is a claim about the instrument until something shows
   * the instrument can return anything else. This cell runs it against a message that
   * deliberately repeats the driver's words and asserts it reports them — so the green above
   * is discrimination rather than resolution.
   *
   * A consistency check on the machinery, written by the author of the assertions, and
   * therefore NOT a second axis on the implementation. It says only that a zero from this
   * function means something.
   */
  it("falsifies both instruments: each reports a real leak and neither reports a clean message", () => {
    const cause = new Error(
      'Failed query: insert into "audit" ("id", "actor_id") values (default, $1)\n' +
        'params: 00000000-0000-4000-8000-000000000240\n' +
        'violates foreign key constraint "audit_actor_id_fkey"',
    );
    const allowed = [...auditOwnNames(), "writeAudit", "bundle.publish"];
    const clean = "writeAudit: the audit store failed.";

    /* GREEN on the clean message — and this half is not decoration. Both of this
       instrument's narrowings were made BECAUSE it reported this exact string as a leak:
       first `store`, out of the module's own filename in `cause.stack`, then `failed`, out
       of drizzle's English prose. A cell that only checked the red direction would have let
       both false positives ship. */
    expect(
      leakedWords(clean, cause, allowed),
      "the clean message reports a leak, so the allow set is too narrow and every green in " +
        "this file is a false negative waiting to happen.",
    ).toEqual([]);
    expect(statementShape(clean), "the clean message reports statement shape.").toEqual([]);

    /* RED on a constraint name — a Postgres-generated identifier `getTableConfig` does not
       report, which is what keeps `audit` and `audit_actor_id_fkey` different tokens. */
    expect(
      leakedWords(
        'writeAudit failed: violates foreign key constraint "audit_actor_id_fkey"',
        cause,
        allowed,
      ),
      "the instrument did not report a message repeating the driver's constraint name " +
        "verbatim, so its zeros above mean nothing.",
    ).toEqual(["audit_actor_id_fkey"]);

    /* RED on the statement, which the WORD check cannot see: every identifier below is a
       name the allow set grants, so `leakedWords` is silent and only the shape check fires.
       The pair is the assertion; neither half covers the other. */
    const echoed = 'writeAudit: Failed query: insert into "audit" ("id", "actor_id") values (default, $1)';
    expect(
      leakedWords(echoed, cause, allowed),
      "sanity: the word check is expected to be BLIND to this one — if it fires, the two " +
        "instruments overlap and the shape check is not carrying its own weight.",
    ).toEqual([]);
    expect(
      statementShape(echoed),
      "the shape check did not report an echoed statement, so it covers nothing the word " +
        "check does not already cover.",
    ).not.toEqual([]);
  });
});

/* Referenced so the constant above is not quietly unused if a cell is edited: the malformed
   uuid is the fault this suite deliberately does NOT provoke, and saying so in code keeps the
   distinction from being lost the next time someone edits `orphanEntry`. */
describe("T240 D-240-05 — the fault this suite does not measure", () => {
  it("records that a malformed uuid is a different fault, from a different layer", () => {
    expect(
      /^[0-9a-f-]{36}$/.test(ABSENT_ACCOUNT),
      `${ABSENT_ACCOUNT} is not uuid-shaped, which is the point: an entry carrying it would ` +
        `fail as 22P02 in the driver's parser BEFORE the foreign key was consulted, so a ` +
        `cell using it would measure the parser and report it as D-240-05. \`orphanEntry\` ` +
        `uses a well-formed uuid with no row on purpose.`,
    ).toBe(false);
  });
});
