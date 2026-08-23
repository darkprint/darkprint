/* ============================================================
   DarkPrint backend — observability: the audit vocabulary
   ============================================================ */

/**
 * Every action this registry can record. **Closed, and that is the point** (D-240-08).
 *
 * The block promised *"a test asserts no `action` value in the enum's live set refers to
 * a run"* — and there is no enum: `audit.action` is `text` in `schema.ts`. Over an open
 * string that assertion has nothing to quantify over, so the product's absolute
 * constraint (the registry holds the bundle and who owns it, and not *"a run, a key, or
 * any telemetry about either"* — `components/bundle/Aside.tsx:33-36`) was held by memory.
 * Closed, an action naming a run **cannot be passed**, which is the same move the block
 * already makes for `detail`.
 *
 * Twelve members, derived from the published writers of the eight merged state-changing
 * modules rather than from recall. **No member encodes the operator**: an operator
 * removing a note writes the note's action with `actorKind: "operator"`, because the
 * distinction is the column and a second spelling of it is two sources for one quantity.
 *
 * **`bundle.publish` overlaps `bundle.create`/`release.add` deliberately, and the rule is
 * THE COMPOSING LAYER WRITES THE ROW, A MODULE UNDERNEATH DOES NOT.** A publish *is* a
 * create-or-append, so both writing would make one operation two rows — and AC1 as
 * narrowed would not catch it, because it counts one `writeAudit` call and that is two.
 * The other two survive for direct archive writes that skip publish; the seed import is
 * the live example.
 *
 * **`counter.write_failed` names the counter FAULT, never the download.** T090's
 * `serveFile` ruling audits a failed download-counter write here — the serve succeeds,
 * the failure is audited, the count is lost. It records failures only and never volume,
 * so no download is ever counted through this module, which is what keeps it the stated
 * edge of the `download.*` exclusion rather than a hole in it.
 *
 * **Amended by the orchestrator at a task's dispatch (D-240-09), never here on spec.**
 * T170, T160 and T250 each need a member and each is Forbidden from editing this file. A
 * member added before its caller exists is a guard that cannot fail, so none is.
 */
export const AUDIT_ACTIONS = [
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
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * One audit row, as a caller writes it.
 *
 * **`actorKind` and `decision` are REQUIRED, and that is deliberate against the schema.**
 * `actor_kind` defaults to `owner` and `decision` to `allowed`, so an implementation that
 * drops either on the floor writes a plausible row rather than failing — AC2 and AC5 both
 * become silently wrong instead of loudly absent. Requiring them here means the omission
 * is a compile error at the caller instead of a default at the database.
 *
 * **`detail` holds ONE of AC3's two clauses and this comment states which (D-240-07).**
 * A scalar-only map cannot hold a nested object, so a DOT source, a card body or a driver
 * error **cannot be passed** — that clause is structural and needs nobody to remember it.
 * **The credential clause is not.** A credential is a flat string: `{ key: secret }`
 * typechecks, and so does spreading a validated flat body — the old-handle/new-handle
 * example this field exists for is that exact shape, so the shape cannot be refused
 * without refusing the example. **A caller keeping a secret out of `detail` is discipline,
 * not a type.** Anyone reading a cell that asserts "the type rejects a nested value"
 * should not read it as covering AC3 whole.
 */
export interface AuditEntry {
  actorId: string | null;
  actorKind: "owner" | "operator" | "system";
  action: AuditAction;
  targetKind?: string;
  targetId?: string;
  decision: "allowed" | "denied" | "error";
  detail?: Record<string, string | number | boolean>;
}

/**
 * A row as `listAudit` returns it, which is an `AuditEntry` plus the time the database
 * stamped (D-240-02).
 *
 * The name is this module's; the block writes the intersection inline. Named for the
 * reason `SaveTarget` was: without one, every consumer retypes the same intersection and
 * a third spelling of one shape is what invites drift. **Writers never supply
 * `occurredAt`** — the column keeps its default, so one clock stamps every row.
 */
export type AuditRecord = AuditEntry & { occurredAt: Date };
