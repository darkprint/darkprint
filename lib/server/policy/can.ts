/* ============================================================
   DarkPrint backend — the authorization decision
   B-13: two subjects only, the owner of a resource and a break-glass
   operator. Every other actor gets whatever a resource concedes to
   the public. AC3 requires an exhaustive case list with no
   default-allow branch, so each resource kind gets its own switch
   over `Action`, and the compiler is made to enforce completeness:
   the `never` assignment in each `default` only type-checks while
   every case above it is handled, so a new `Action` or `Resource`
   variant fails `tsc` here rather than silently falling through to
   an allow.
   ============================================================ */

import type { Action, Actor, Resource } from "./types";

function isOwner(actor: Actor, ownerId: string): boolean {
  return actor.kind === "account" && actor.accountId === ownerId;
}

/** Bundle and card share a shape: an owner, and a public/private visibility. */
function canOnVisibilityScoped(
  actor: Actor,
  action: Action,
  resource: { ownerId: string; visibility: "public" | "private" },
): boolean {
  const owner = isOwner(actor, resource.ownerId);
  switch (action) {
    // A private bundle/card has no resolved graph and therefore no reading (T060 contract) —
    // only its owner may read it; a public one is readable by anyone.
    case "read":
      return owner || resource.visibility === "public";
    case "write":
      return owner;
    case "delete":
      return owner;
    case "publish":
      return owner;
    case "transfer":
      return owner;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/** A save is private and so is its count (T060 contract) — no non-owner action reaches it. */
function canOnSave(actor: Actor, action: Action, resource: { ownerId: string }): boolean {
  const owner = isOwner(actor, resource.ownerId);
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
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/**
 * A note carries no `visibility` field, unlike bundle/card — it has no private state to
 * gate a read against, so reading one is open to any actor; only its author may change it.
 */
function canOnNote(actor: Actor, action: Action, resource: { authorId: string }): boolean {
  const owner = isOwner(actor, resource.authorId);
  switch (action) {
    case "read":
      return true;
    case "write":
      return owner;
    case "delete":
      return owner;
    case "publish":
      return false;
    case "transfer":
      return false;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/** An account's own row (settings, identity) is visible and changeable only to the account itself. */
function canOnAccount(actor: Actor, action: Action, resource: { accountId: string }): boolean {
  const owner = isOwner(actor, resource.accountId);
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
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/**
 * Whether `actor` may perform `action` on `resource`. Pure: same inputs, same answer, no
 * I/O. Never returns a `Response` — mapping a denial to 404 rather than 403 is the caller's
 * job (B-03).
 *
 * The operator check runs first and unconditionally grants access (AC4: "the operator
 * subject can reach any resource"). Because `Actor`'s `operator` variant is a distinct,
 * carried-through case rather than a fallback, any caller that logs its `can()` calls can
 * tell an operator override apart from an ordinary owner grant — which is what makes it
 * auditable without this module doing any I/O itself.
 */
export function can(actor: Actor, action: Action, resource: Resource): boolean {
  if (actor.kind === "operator") return true;

  switch (resource.kind) {
    case "bundle":
      return canOnVisibilityScoped(actor, action, resource);
    case "card":
      return canOnVisibilityScoped(actor, action, resource);
    case "save":
      return canOnSave(actor, action, resource);
    case "note":
      return canOnNote(actor, action, resource);
    case "account":
      return canOnAccount(actor, action, resource);
    default: {
      const exhaustive: never = resource;
      return exhaustive;
    }
  }
}
