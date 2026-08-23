/* ============================================================
   DarkPrint backend — observability: AC1 as D-240-01 narrowed it
   "One `writeAudit` call inserts exactly one row and nothing
   else, anywhere." That is a COUNTING criterion, and the way it
   gets tested wrong is a cell asserting a row EXISTS — which
   passes when three were written. These cells count, and they
   count without a database by recording what the statement was
   asked to insert.
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { AuditStoreError } from "./errors";
import type { AuditEntry } from "./types";
import { writeAudit } from "./write";

function recordingDb() {
  const inserts: { table: unknown; values: unknown }[] = [];
  const db = {
    insert(table: unknown) {
      return {
        values(values: unknown) {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      };
    },
  } as unknown as Db;
  return { db, inserts };
}

const ENTRY: AuditEntry = {
  actorId: "9f3c1d20-0000-4000-8000-000000000000",
  actorKind: "operator",
  action: "key.revoke",
  targetKind: "account",
  targetId: "aaaaaaaa-0000-4000-8000-000000000000",
  decision: "denied",
};

describe("writeAudit", () => {
  it("issues exactly one insert of exactly one row", async () => {
    const { db, inserts } = recordingDb();
    await writeAudit(db, ENTRY);
    expect(inserts).toHaveLength(1);
    /* One object, never an array: "exactly one" is the statement's shape rather than a
       count somebody maintains. An array of one would satisfy a laxer cell and would
       stop being one row the day a caller mapped over something. */
    expect(Array.isArray(inserts[0]!.values)).toBe(false);
  });

  /**
   * The two schema defaults are the AC5 hazard: `actor_kind` defaults to `owner` and
   * `decision` to `allowed`, so a dropped field writes a plausible row instead of
   * failing. This EXCLUDES both defaults rather than admitting the good values — a cell
   * asserting only `decision === "denied"` would pass while `actorKind` fell through.
   */
  it("writes actorKind and decision explicitly rather than letting the column default", async () => {
    const { db, inserts } = recordingDb();
    await writeAudit(db, ENTRY);
    const row = inserts[0]!.values as Record<string, unknown>;
    expect(row.actorKind).toBe("operator");
    expect(row.actorKind).not.toBe("owner");
    expect(row.decision).toBe("denied");
    expect(row.decision).not.toBe("allowed");
  });

  /** AC5 from the other side: a fault and a refusal are different values, not different wordings. */
  it("keeps a policy refusal and a fault distinguishable", async () => {
    const { db, inserts } = recordingDb();
    await writeAudit(db, { ...ENTRY, decision: "denied" });
    await writeAudit(db, { ...ENTRY, decision: "error" });
    const decisions = inserts.map((i) => (i.values as Record<string, unknown>).decision);
    expect(decisions).toEqual(["denied", "error"]);
  });

  /** `occurredAt` belongs to the database's clock, so a caller cannot backdate a row. */
  it("never supplies occurredAt", async () => {
    const { db, inserts } = recordingDb();
    await writeAudit(db, ENTRY);
    expect(Object.hasOwn(inserts[0]!.values as object, "occurredAt")).toBe(false);
  });

  it("normalises an absent target and an absent detail", async () => {
    const { db, inserts } = recordingDb();
    await writeAudit(db, { actorId: null, actorKind: "system", action: "ontology.release", decision: "allowed" });
    const row = inserts[0]!.values as Record<string, unknown>;
    expect(row.targetKind).toBeNull();
    expect(row.targetId).toBeNull();
    expect(row.detail).toEqual({});
  });

  /**
   * D-240-05: a fault PROPAGATES, wrapped. Swallowing it would violate AC1 in the one
   * direction nothing checks — zero rows, silently — because every cell anyone writes
   * counts rows that were asked for and looks for one too many rather than none.
   */
  it("propagates a store fault as this module's class, carrying no statement", async () => {
    const failing = {
      insert() {
        return {
          values() {
            return Promise.reject(
              new Error('Failed query: insert into "audit" -- params: dp_live_s3cr3t'),
            );
          },
        };
      },
    } as unknown as Db;
    const thrown = await writeAudit(failing, ENTRY).catch((err: unknown) => err);
    expect(thrown).toBeInstanceOf(AuditStoreError);
    expect((thrown as Error).message).toBe("writeAudit: the audit store failed.");
    expect(String(thrown)).not.toContain("dp_live_s3cr3t");
    expect(JSON.stringify(thrown)).toBe("{}");
  });
});
