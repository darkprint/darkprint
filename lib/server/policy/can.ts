/* ============================================================
   DarkPrint backend — the authorization decision
   B-13: two subjects only, the owner of a resource and a break-glass
   operator. Every other actor gets whatever a resource concedes to
   the public. AC3 requires an exhaustive case list with no
   default-allow branch, verified by invocation and not only by the
   type checker: `assertNever` is a no-op whose parameter type is
   `never`, so it still fails `tsc` if a case is left unhandled, but
   unlike `const exhaustive: never = action; return exhaustive`, it
   does not hand back its own input at runtime if that guarantee is
   ever bypassed (`as never`, a malformed caller) — the `return
   false` right after it is what actually executes then, so an
   unreachable branch stays unreachable in the type system and
   fails closed if it is ever reached anyway (2026-08-14 ruling:
   `can` and `visibleTo` fail closed and never throw).

   `Actor` and `Resource` are plain data, and authority is never
   inherited (2026-08-14 ruling): every field either function reads
   to decide is fetched through `Object.hasOwn` first, on both types
   — `kind` and `accountId` for the actor (in `is-owner.ts`), and
   `kind`, `ownerId`, `visibility`, `accountId`, `authorId`, and
   `parent.ownerId`/`parent.visibility` for the resource, here. A
   field that only exists on a prototype (pollution, `Object.create`)
   reads as absent rather than as whatever the prototype supplies.
   ============================================================ */

import type { Action, Actor, Resource } from "./types";
import { isId, isOperator, isOwner } from "./is-owner";

function assertNever(value: never): void {
  void value;
}

/** `Object.hasOwn`-gated field read: absent from `obj`'s own properties reads as `undefined`. */
function ownField(obj: object, key: string): unknown {
  return Object.hasOwn(obj, key) ? (obj as Record<string, unknown>)[key] : undefined;
}

const ACTIONS: ReadonlySet<Action> = new Set(["read", "write", "delete", "publish", "transfer"]);

/** The operator grant, gated on `action` actually being one of the five (2026-08-14 ruling: the operator path must consult `action` too, not skip straight to a grant). */
function isOperatorGrant(actor: Actor, action: Action): boolean {
  return isOperator(actor) && ACTIONS.has(action);
}

/** Bundle and card share a shape: an owner, and a public/private visibility. */
function canOnVisibilityScoped(
  actor: Actor,
  action: Action,
  resource: { ownerId: string; visibility: "public" | "private" },
): boolean {
  const owner = isOwner(actor, ownField(resource, "ownerId"));
  const isPublic = ownField(resource, "visibility") === "public";
  switch (action) {
    // A private bundle/card has no resolved graph and therefore no reading (T060 contract) —
    // only its owner may read it; a public one is readable by anyone.
    case "read":
      return owner || isPublic;
    case "write":
      return owner;
    case "delete":
      return owner;
    case "publish":
      return owner;
    case "transfer":
      return owner;
    default: {
      assertNever(action);
      return false;
    }
  }
}

/** A save is private and so is its count (T060 contract) — no non-owner action reaches it. */
function canOnSave(actor: Actor, action: Action, resource: { ownerId: string }): boolean {
  const owner = isOwner(actor, ownField(resource, "ownerId"));
  switch (action) {
    case "read":
      return owner;
    case "write":
      return owner;
    case "delete":
      return owner;
    case "publish":
      return false;
    case "transfer":
      return false;
    default: {
      assertNever(action);
      return false;
    }
  }
}

/**
 * A note has no visibility of its own — it inherits its parent bundle/card's. A note on a
 * private parent is readable only by that parent's owner; write/delete stay with the note's
 * own author. `resource.parent` is read defensively rather than assumed well-formed: both
 * `ownerId` and `visibility` have to be present (as *own* properties — a prototype-supplied
 * field reads as absent) and valid before either grant path trusts it, so a parent that is
 * missing, `null`, or has only one of the two fields loaded denies the read entirely —
 * including to an actor whose id happens to match the half that did load. Trusting a
 * partial match is exactly the leak the parent amendment closed for a complete record and
 * left open for an incomplete one (2026-08-14 ruling: a half-loaded parent is not evidence
 * of publicness, or of ownership).
 *
 * `ownerId` and `visibility` are each read off `parent` exactly once, into `parentOwnerId`
 * and `parentVisibility`, and every check below reads the local, never `parent` again — a
 * validated value is the value used (2026-08-14 ruling). A `parent` backed by a getter that
 * answers differently on a second read (a lazily-materialised row, for instance) would
 * otherwise pass the well-formedness check on one read and grant on another.
 */
function canOnNote(
  actor: Actor,
  action: Action,
  resource: { authorId: string; parent: { ownerId: string; visibility: "public" | "private" } },
): boolean {
  const author = isOwner(actor, ownField(resource, "authorId"));
  const parent = ownField(resource, "parent");
  const isParentObject = typeof parent === "object" && parent !== null;
  const parentOwnerId = isParentObject ? ownField(parent, "ownerId") : undefined;
  const parentVisibility = isParentObject ? ownField(parent, "visibility") : undefined;
  const parentWellFormed =
    isParentObject && isId(parentOwnerId) && (parentVisibility === "public" || parentVisibility === "private");
  const parentOwner = parentWellFormed && isOwner(actor, parentOwnerId);
  const parentPublic = parentWellFormed && parentVisibility === "public";
  switch (action) {
    case "read":
      return parentOwner || parentPublic;
    case "write":
      return author;
    case "delete":
      return author;
    case "publish":
      return false;
    case "transfer":
      return false;
    default: {
      assertNever(action);
      return false;
    }
  }
}

/** An account's own row (settings, identity) is visible and changeable only to the account itself. */
function canOnAccount(actor: Actor, action: Action, resource: { accountId: string }): boolean {
  const owner = isOwner(actor, ownField(resource, "accountId"));
  switch (action) {
    case "read":
      return owner;
    case "write":
      return owner;
    case "delete":
      return owner;
    case "publish":
      return false;
    case "transfer":
      return owner;
    default: {
      assertNever(action);
      return false;
    }
  }
}

/**
 * Whether `actor` may perform `action` on `resource`. Pure: same inputs, same answer, no
 * I/O. Never returns a `Response` — mapping a denial to 404 rather than 403 is the caller's
 * job (B-03). Never throws — a malformed `actor` or `resource` (not an object, `null`, a
 * `kind` outside either union, or a `kind` that only exists on a prototype) is a denial, not
 * an exception (2026-08-14 ruling).
 *
 * `resource.kind` is read through the same `Object.hasOwn` gate as every other resource
 * field before it ever reaches the `switch`, so a resource whose `kind` is inherited rather
 * than its own denies immediately instead of dispatching to a handler at all.
 *
 * The operator grant lives inside each resource-kind case below, not as a blanket check
 * before the switch: a malformed resource is a denial for everyone, including a genuine
 * operator (2026-08-14 ruling) — `can(validOperator, "read", null)` and
 * `can(validOperator, "read", { kind: "unknown" })` both deny, because neither ever reaches
 * a case that grants anything. An operator's grant is therefore exactly as wide as a
 * recognized resource, never wider — it is unconditional once `resource.kind` is one of the
 * five, not before. It also requires `isOperatorGrant`, not just `isOperator(actor)`: the
 * operator path has to agree with the owner path about what counts as an `action`
 * (2026-08-14 ruling) — an invented action like `"frobnicate"` falls through to the same
 * per-kind handler an owner would hit, whose own exhaustive switch denies it the same way
 * for either actor.
 *
 * `isOperator`, not just `actor.kind === "operator"`: possession of the discriminant is not
 * authority (2026-08-14 ruling) — an actor tagged `operator` with no `accountId` gets an
 * anonymous caller's answer instead, because `isOwner` below only ever grants to `kind ===
 * "account"` and so never mistakes an unidentified operator for one. (AC4's audit
 * requirement was withdrawn from this task and belongs to the call site and T240, not to
 * this module.)
 */
export function can(actor: Actor, action: Action, resource: Resource): boolean {
  if (typeof actor !== "object" || actor === null) return false;
  if (typeof resource !== "object" || resource === null) return false;
  if (!Object.hasOwn(resource, "kind")) return false;

  switch (resource.kind) {
    case "bundle":
      return isOperatorGrant(actor, action) || canOnVisibilityScoped(actor, action, resource);
    case "card":
      return isOperatorGrant(actor, action) || canOnVisibilityScoped(actor, action, resource);
    case "save":
      return isOperatorGrant(actor, action) || canOnSave(actor, action, resource);
    case "note":
      return isOperatorGrant(actor, action) || canOnNote(actor, action, resource);
    case "account":
      return isOperatorGrant(actor, action) || canOnAccount(actor, action, resource);
    default: {
      assertNever(resource);
      return false;
    }
  }
}
