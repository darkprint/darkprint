/* ============================================================
   DarkPrint backend — observability: what the closed set buys
   These cells are the ones D-240-03 exists to make possible. Over
   an open `string` every one of them is unfalsifiable — there is
   nothing to quantify over — so the set being closed is not a
   convenience here, it is the precondition for the product's
   absolute constraint being checked at all.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, type AuditEntry } from "./types";

describe("AUDIT_ACTIONS", () => {
  /**
   * An EQUALITY over the ratified thirteen, not a floor. `note.remove` was added under D-240-09's
   * amendment path at T170's dispatch, on a charge from the task that has the caller.
   *
   * D-240-09 puts amendment with the orchestrator at a task's dispatch, precisely because
   * T170, T160 and T250 each need a member and each is Forbidden from editing this file.
   * A floor would absorb a member added here on spec and say nothing; this reds, which is
   * what makes the amendment path a path rather than a preference.
   */
  it("is exactly the thirteen ratified members", () => {
    expect([...AUDIT_ACTIONS]).toEqual([
      "account.create",
      "account.update",
      "handle.allocate",
      "handle.release",
      "bundle.create",
      "release.add",
      "bundle.publish",
      "card.add",
      "ontology.release",
      "key.issue",
      "key.revoke",
      "counter.write_failed",
      "note.remove",
    ]);
  });

  it("has no duplicate member", () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
  });

  /**
   * The product's absolute constraint, quantified over the live set.
   *
   * The registry holds this bundle and who owns it, and not "a run, a key, or any
   * telemetry about either". So **no action may name a
   * blueprint run, in any spelling** — this is the test the block promised and could not
   * have, because `audit.action` is `text` and an open string has no live set.
   */
  it("names no blueprint run", () => {
    const offenders = AUDIT_ACTIONS.filter((action) => /run|execut|invoc|trace|telemetry/i.test(action));
    expect(offenders).toEqual([]);
  });

  /**
   * Exclusion 2, and the edge that was added to it rather than punched through it.
   *
   * A per-download audit row is B-14's derivation with the arrow reversed, so no member
   * may name a download. `counter.write_failed` names the counter FAULT — it records
   * failures only, never volume — which is why it satisfies this cell rather than needing
   * an exception carved for it.
   */
  it("names no download, star or vote", () => {
    const offenders = AUDIT_ACTIONS.filter((action) => /download|star|vote|ballot/i.test(action));
    expect(offenders).toEqual([]);
    expect(AUDIT_ACTIONS).toContain("counter.write_failed");
  });

  /**
   * AC2's distinction is the `actor_kind` COLUMN and must not be spelled a second time.
   * Two sources for one quantity is the shape that lets them disagree, and nothing would
   * compare them.
   */
  it("encodes no actor kind in an action string", () => {
    const offenders = AUDIT_ACTIONS.filter((action) => /operator|owner|system/i.test(action));
    expect(offenders).toEqual([]);
  });

  it("is shaped noun.verb throughout", () => {
    for (const action of AUDIT_ACTIONS) {
      expect(action).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });
});

describe("AuditEntry, the half of AC3 the type does hold", () => {
  /**
   * The structural clause: a scalar-only map cannot hold a nested object, so a DOT source,
   * a card body or a driver error **cannot be passed**. A compile-time cell in the shape
   * T060's `Exact<>` check established — the directive suppresses only the line beneath
   * it, so each rejected literal stays on one line or the directive itself reds as unused.
   */
  it("rejects a nested value in detail at compile time", () => {
    // @ts-expect-error — a nested object is exactly what AC3 keeps out of a log field.
    const nested: AuditEntry["detail"] = { body: { dot: "digraph { a -> b }" } };
    // @ts-expect-error — an array is nested too, and is how a card body would arrive.
    const list: AuditEntry["detail"] = { refs: ["berti/solver-a", "berti/solver-b"] };
    expect(nested).toBeDefined();
    expect(list).toBeDefined();
  });

  /**
   * **The other half, asserted as the LIMIT it is (D-240-07).** A credential is a flat
   * string, so this assigns cleanly — and that is the point of the cell. It exists so a
   * reader cannot take the cell above as covering AC3 whole: keeping a secret out of
   * `detail` is a caller's discipline, and no type in this module enforces it.
   */
  it("does NOT reject a flat credential, which is why the claim is narrowed", () => {
    const admitted: AuditEntry["detail"] = { key: "dp_live_s3cr3t" };
    expect(admitted).toEqual({ key: "dp_live_s3cr3t" });
  });

  /** Against the two schema defaults: a dropped field must be a compile error, not an `owner`/`allowed` row. */
  it("requires actorKind and decision", () => {
    // @ts-expect-error — omitting `actorKind` would otherwise default to `owner` at the column.
    const noKind: AuditEntry = { actorId: null, action: "card.add", decision: "allowed" };
    // @ts-expect-error — omitting `decision` would otherwise default to `allowed` at the column.
    const noDecision: AuditEntry = { actorId: null, actorKind: "system", action: "card.add" };
    expect(noKind).toBeDefined();
    expect(noDecision).toBeDefined();
  });

  it("rejects an action outside the closed set", () => {
    // @ts-expect-error — the constraint made structural: a run action cannot be passed.
    const run: AuditEntry["action"] = "blueprint.run";
    expect(run).toBe("blueprint.run");
  });
});
