/* ============================================================
   DarkPrint backend — observability: the reader
   ============================================================ */

import { and, asc, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { NotPermittedError } from "./errors";
import { withStore } from "./store";
import type { AuditRecord } from "./types";

/**
 * Whether `actor` is a usable break-glass operator.
 *
 * **This is `lib/server/policy/is-owner.ts`'s `isOperator`, COPIED WITH ITS ATTRIBUTION
 * rather than reached for**, and the duplication is reported rather than hidden. T060
 * owns this predicate and hardened it — `can.ts:189` says in as many words that
 * *possession of the discriminant is not authority* — but it is **not on the policy
 * barrel**, which publishes `can`, `visibleTo` and three types. `can` cannot decide this
 * one: `Resource` has no `audit` kind and `Action` has no member meaning *read the audit
 * log*, which is exactly why D-240-04 ruled the permission here instead. That leaves a
 * deep import, which `lib/db/index.ts`'s rule forbids, or this — the same choice
 * `lib/server/naming/pg-error.ts` faced against `lib/server/cards/pg-error.ts`, resolved
 * the same way and for the same reason.
 *
 * All three of T060's rulings travel with the copy, because a weakened copy is worse than
 * none: an empty-string id is not an id (it is what an unset column and a half-built
 * session row both look like), possession of the `operator` discriminant is not authority
 * without a real `accountId`, and neither field may be INHERITED — `Object.hasOwn`, so a
 * prototype-polluted or `Object.create`-d actor cannot borrow its way in.
 *
 * **Delete this the day `isOperator` reaches the policy barrel.**
 */
function isOperatorActor(actor: Actor): boolean {
  return (
    Object.hasOwn(actor, "kind") &&
    actor.kind === "operator" &&
    Object.hasOwn(actor, "accountId") &&
    typeof actor.accountId === "string" &&
    actor.accountId.length > 0
  );
}

/**
 * The audit log, newest first, for the operator alone.
 *
 * **Operator only (D-240-04, B-13).** Anonymous and account are both refused with the one
 * published sentence, which says nothing about the target — naming a target the caller
 * may not see is itself a leak, B-03's 404-not-403 one layer down. The refusal is thrown
 * before any statement is built, so a refused caller cannot time the difference between a
 * filter that matched and one that did not.
 *
 * **`filter` has no `actorId` member and that absence is deliberate.** Whether an account
 * may read the rows naming itself is a product decision nobody has made, so there is no
 * half-answer to it here.
 *
 * ── The order, and why it is spelled out ──
 *
 * **Truncated to the millisecond `occurredAt` actually carries.** `audit.occurred_at` is
 * `timestamptz` and holds MICROSECONDS; the `Date` in `AuditRecord` holds milliseconds. An
 * uncast sort therefore orders on precision the published record cannot express, so two
 * rows 100 microseconds apart come back in an order a caller cannot predict from what it
 * was given. That is D-140-11, one module over.
 *
 * **The tie-breaks are total in terms a caller can compute from the records alone**, which
 * is the property that matters rather than uniqueness: `action`, `actorId`, `targetKind`
 * and `targetId` are all published fields, and `actorKind` and `decision` are cast to
 * `text` because `ORDER BY` on a Postgres enum sorts by DECLARATION order, not
 * alphabetically (D-140-09). `audit.id` is deliberately NOT a tie-break — it is
 * `defaultRandom()`, so ordering on it is an unordered read with extra steps, exactly the
 * defect T140 found in its own first version.
 *
 * Two rows agreeing on all six and differing only in `detail` are interchangeable, and
 * their relative order is not defined: `jsonb` has no total order worth asserting, and no
 * caller can compute one either.
 */
export async function listAudit(
  db: Db,
  actor: Actor,
  filter: { targetKind?: string; targetId?: string; since?: Date },
): Promise<AuditRecord[]> {
  if (!isOperatorActor(actor)) throw new NotPermittedError();

  return withStore("listAudit", async () => {
    const conditions: SQL[] = [];
    if (filter.targetKind !== undefined) {
      conditions.push(eq(schema.audit.targetKind, filter.targetKind));
    }
    if (filter.targetId !== undefined) {
      conditions.push(eq(schema.audit.targetId, filter.targetId));
    }
    /* Inclusive: a row stamped exactly at `since` is "since `since`". */
    if (filter.since !== undefined) {
      conditions.push(gte(schema.audit.occurredAt, filter.since));
    }

    const rows = await db
      .select()
      .from(schema.audit)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(
        desc(sql`date_trunc('milliseconds', ${schema.audit.occurredAt})`),
        asc(schema.audit.action),
        asc(schema.audit.actorId),
        asc(sql`${schema.audit.actorKind}::text`),
        asc(schema.audit.targetKind),
        asc(schema.audit.targetId),
        asc(sql`${schema.audit.decision}::text`),
      );

    return rows.map((row) => ({
      actorId: row.actorId,
      actorKind: row.actorKind,
      action: row.action as AuditRecord["action"],
      targetKind: row.targetKind ?? undefined,
      targetId: row.targetId ?? undefined,
      decision: row.decision,
      /* `detail` is `jsonb`, so the driver hands back `unknown`. The column is only ever
         written through `writeAudit`, whose parameter type is the scalar-only map — but
         this cast is the one place that premise is trusted rather than checked, and it is
         trusted about rows this process did not write. Named here rather than left to
         read as a guarantee. */
      detail: (row.detail ?? {}) as AuditRecord["detail"],
      occurredAt: row.occurredAt,
    }));
  });
}
