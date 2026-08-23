/* ============================================================
   T180 — AC5: a report on one's own blueprint

   Ruled: self-reported runs on one's own release are ACCEPTED
   and AGGREGATED — they are honest data — but `validated` is a
   claim about *others* having used the thing.

   T180's half is that `submitReport` records the submitting
   account. The not-incremented half is T131's, per the ruling,
   and is not asserted here: a blind suite charging a criterion
   its module does not own produces a defect report against
   somebody who followed the contract.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { barrelExports, BARREL, requiredFn } from "./contract";
import {
  DIGEST,
  MODAL_MODEL,
  OWN_DIGEST,
  RecordedSetup,
  reportsAt,
  scratchDatabase,
  type Scratch,
} from "./fixtures";

const setup = new RecordedSetup<Scratch>("The T180 self-report scratch database");

beforeAll(async () => {
  await setup.run(scratchDatabase);
}, 60_000);

afterAll(async () => {
  await setup.optional()?.drop();
});

async function submitAs(
  scratch: Scratch,
  accountId: string,
  handle: string,
  digest: string,
  criterion: string,
): Promise<void> {
  const state = await barrelExports();
  if (state.state === "module-absent") {
    throw new Error(`${criterion} cannot be checked: ${BARREL} is absent (blind position).`);
  }
  const mod = (await import("@/lib/server/runs")) as unknown as Record<string, unknown>;
  const submitReport = requiredFn(mod, "submitReport", "submitReport(db, actor, report)");
  await submitReport(
    scratch.client.db,
    { kind: "account", accountId, handle },
    {
      releaseDigest: digest,
      model: MODAL_MODEL,
      provider: "anthropic",
      hardware: "m3-max-64gb",
      inputSize: 4096,
      harnessVersion: "darkprint-cli/0.4.1",
      costUnits: 17,
      durationMs: 1200,
      occurredAt: new Date(Date.UTC(2026, 7, 1, 12, 0, 0)),
    },
  );
}

describe("a report on one's own blueprint", () => {
  /**
   * Accepted, not refused. This is the half the ruling had to settle.
   *
   * `OWN_DIGEST` is a release of the bundle `submitterId` owns, so this is the exact case
   * AC5 names. Refusing it would discard honest data; the ruling keeps it and moves the
   * distinction to who is counted, not what is stored.
   */
  it("is accepted and stored", async () => {
    const scratch = setup.require();
    /* Outside the `resolves` wrapper: a wrapper consumes the blind-position throw and
       reports it as a failed criterion rather than as the absent module. */
    const state = await barrelExports();
    if (state.state === "module-absent") {
      throw new Error(`AC5's acceptance cannot be checked: ${BARREL} is absent (blind position).`);
    }
    await expect(
      submitAs(scratch, scratch.submitterId, "t180-submitter", OWN_DIGEST, "AC5's acceptance"),
    ).resolves.toBeUndefined();

    const rows = await reportsAt(scratch, OWN_DIGEST);
    expect(rows).toHaveLength(1);
  });

  /**
   * And the submitter is recorded, which is the whole reason `account_id` exists.
   *
   * D-05-07 carried `account_id NOT NULL` into the schema against T005's own published
   * block, on the grounds that AC5 is unimplementable without it. So the column's value is
   * T180's contribution to `validated`, and a module that wrote any other account — the
   * bundle's owner, a null, a default — would leave T131 filtering on the wrong thing while
   * every other cell in this suite passed.
   *
   * Asserted against the STRANGER's id as well, so a module that hardcodes the submitter,
   * or that writes the release owner, is separated from one that writes the actor.
   */
  it("records the submitting account and not the release owner", async () => {
    const scratch = setup.require();

    /* The submitter reports on their OWN release: actor and owner coincide, so this
       direction alone cannot tell "wrote the actor" from "wrote the owner". */
    await submitAs(scratch, scratch.submitterId, "t180-submitter", OWN_DIGEST, "AC5's attribution");

    /* And the STRANGER reports on the submitter's release: now they disagree. */
    await submitAs(scratch, scratch.strangerId, "t180-stranger", OWN_DIGEST, "AC5's attribution");

    const rows = await reportsAt(scratch, OWN_DIGEST);
    const accounts = rows.map((r) => r.account_id);
    expect(accounts).toContain(scratch.submitterId);
    expect(accounts).toContain(scratch.strangerId);
    /* The release owner is `submitterId`; a module writing the owner would produce two of
       those and none of the stranger's, which the line above already excludes. */
    expect(accounts.filter((a) => a === scratch.strangerId)).toHaveLength(1);
  });

  /**
   * A report on somebody ELSE's blueprint records that submitter too.
   *
   * B-16's subject is "a run that happened on somebody else's machine", so this is the
   * ordinary case and the cell above is the exception. Asserted separately because a
   * module that only ever wrote the actor for self-reports would pass the pair above.
   */
  it("records the submitter for somebody else's blueprint", async () => {
    const scratch = setup.require();
    await submitAs(scratch, scratch.submitterId, "t180-submitter", DIGEST, "AC5's ordinary case");

    const rows = await reportsAt(scratch, DIGEST);
    expect(rows).toHaveLength(1);
    expect(rows[0].account_id).toBe(scratch.submitterId);
  });
});
