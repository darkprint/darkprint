/* ============================================================
   T240 — the absolute constraint: no audit action names a
   blueprint run

   The registry stores a bundle and who owns it. It does not store a
   run, a key, or any telemetry about either: execution stays on the
   author's machine, and the audit log is the one table that could
   quietly start recording otherwise. `AUDIT_ACTIONS` is a closed
   set and `action` is typed as that union, which makes an action
   naming a run unpassable rather than merely discouraged. These
   cells quantify over whatever set lands.

   Only *run* is charged. `key` is not: API keys are a stored
   registry object with an audit obligation of their own, so
   `key.revoke` is a legitimate action name and a cell charging
   `key` would red a correct implementation.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditRows,
  boundAuditActions,
  ratifiedActions,
  boundWriteAudit,
  RecordedSetup,
  scratchDatabase,
  type Scratch,
} from "./contract";

/**
 * Charged: no action may name a blueprint run. `runs` and `run_id` are the same word in a
 * dotted or snake-cased action name, which is why an action is split into segments and
 * matched by stem rather than by substring: `rerun` would over-match and `bundle.run` would
 * not be caught by an equality check.
 */
const CHARGED = ["run"] as const;

/** Segments of an action name: `bundle.publish`, `api_key.revoke`, `bundle-run` all split. */
function segments(action: string): string[] {
  return action.toLowerCase().split(/[.\-_/:\s]+/).filter((s) => s !== "");
}

const setup = new RecordedSetup<Scratch>("The T240 vocabulary scratch database");

beforeAll(async () => {
  await setup.run(scratchDatabase);
});

afterAll(async () => {
  await setup.optional()?.drop();
});

describe("T240 — `AUDIT_ACTIONS` is a closed set worth quantifying over", () => {
  it("is a non-empty set of distinct strings", async () => {
    const actions = await boundAuditActions();

    expect(
      actions.length,
      `\`AUDIT_ACTIONS\` is empty. Every assertion in this file quantifies over it, so an ` +
        `empty set makes the product's absolute constraint vacuously satisfied.`,
    ).toBeGreaterThan(0);

    const duplicates = actions.filter((a, i) => actions.indexOf(a) !== i);
    expect(
      [...new Set(duplicates)],
      `\`AUDIT_ACTIONS\` repeats ${[...new Set(duplicates)].join(", ")}. A union type ` +
        `collapses duplicates silently, so the set and the type would disagree about their ` +
        `own size with nothing to show for it.`,
    ).toEqual([]);
  });

  /**
   * The closed vocabulary as an EQUALITY, compared as sorted sets: a member added in the
   * module with no caller reds here, and the grouping by subject is not an order either
   * side commits to.
   */
  it("is EXACTLY the thirteen ratified members, no more and no fewer", async () => {
    const ratified = ratifiedActions();

    const actions = await boundAuditActions();
    expect(
      [...actions].sort(),
      `\`AUDIT_ACTIONS\` is not the ratified set.\n` +
        `  extra (in the module, NOT ratified):  ` +
        `${actions.filter((a) => !ratified.includes(a)).join(", ") || "(none)"}\n` +
        `  missing (ratified, not in module):    ` +
        `${ratified.filter((a) => !actions.includes(a)).join(", ") || "(none)"}\n` +
        `  The set grows only with the caller that writes the new member: a member no ` +
        `caller exists for is a guard that cannot fail.`,
    ).toEqual([...ratified].sort());
  });

  /**
   * The criterion, quantified over the live set.
   *
   * Matched by SEGMENT rather than by substring: `bundle.run` and `run_id` are hits,
   * `rerun-policy` is not, and neither is a legitimate action that happens to contain the
   * three letters. A substring scan would red a correct implementation and then be widened
   * until it stopped meaning anything.
   */
  it("names no blueprint run, over whatever set landed", async () => {
    const actions = await boundAuditActions();
    const offending = actions.filter((action) =>
      segments(action).some((segment) =>
        CHARGED.some((noun) => segment === noun || segment === `${noun}s`),
      ),
    );

    expect(
      offending,
      `The absolute constraint: ${offending.join(", ")} names a blueprint run. The registry ` +
        `stores a bundle and who owns it, never a run, a key, or any telemetry about either; ` +
        `download counts come from an explicit event at the serving edge, never from ` +
        `request logs.`,
    ).toEqual([]);
  });

  /**
   * The set has to be LIVE, not merely declared.
   *
   * A published vocabulary with a member the writer cannot store is a set that lies: the type
   * admits it, a caller writes it, and the insert fails at runtime on a value the contract
   * says is legal. Every member is written and read back, so the set's own claim about itself
   * is measured rather than trusted.
   *
   * Asserted as the whole map at once rather than per action: one red naming every member
   * that did not survive, instead of N reds for one defect.
   */
  it("every published action actually round-trips into the column", async () => {
    const scratch = setup.require();
    const actions = await boundAuditActions();

    const write = await boundWriteAudit();
    for (const action of actions) {
      await write(scratch.client.db, {
        actorId: scratch.ownerId,
        actorKind: "owner",
        action,
        targetKind: "vocabulary",
        targetId: action,
        decision: "allowed",
      });
    }

    const stored = (await auditRows(scratch))
      .filter((r) => r.target_kind === "vocabulary")
      .map((r) => String(r.action))
      .sort();

    expect(
      stored,
      `The published set and what the column actually holds disagree.\n` +
        `  A member the writer cannot store is a set that lies: the union admits it, a caller ` +
        `passes it, and the insert fails at runtime on a value the contract calls legal.`,
    ).toEqual([...actions].sort());
  });
});
