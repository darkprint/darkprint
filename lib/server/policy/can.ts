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
 * A note has no visibility of its own — it inherits its parent bundle/card's. A note on a
 * private parent is readable only by that parent's owner (2026-08-14 contract amendment: the
 * first shape carried no `parent`, so a private parent's notes were unreadably-gated by
 * nothing, i.e. world-readable — a leak). Write/delete stay with the note's own author.
 */
function canOnNote(
  actor: Actor,
  action: Action,
  resource: { authorId: string; parent: { ownerId: string; visibility: "public" | "private" } },
): boolean {
  const author = isOwner(actor, resource.authorId);
  const parentOwner = isOwner(actor, resource.parent.ownerId);
  switch (action) {
    case "read":
      return parentOwner || resource.parent.visibility === "public";
    case "write":
      return author;
    case "delete":
      return author;
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
