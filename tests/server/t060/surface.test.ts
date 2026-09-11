import { describe, expect, it } from "vitest";

import type { Action as PublishedAction, Actor as PublishedActor, Resource as PublishedResource } from "@/lib/server/policy";

import {
  ACTIONS,
  type Action,
  type Actor,
  type Resource,
  PUBLISHED,
  alice,
  anonymous,
  bundle,
  canFn,
  everyResourceOwnedBy,
  loadPolicy,
  operator,
  ALICE,
  visibleToFn,
} from "./contract";

/* ============================================================
   T060 — the Published signatures block, bound

   Not one of the five numbered criteria. This is the block above
   them:

       type Actor / type Resource / type Action
       can(actor: Actor, action: Action, resource: Resource): boolean
       visibleTo(actor: Actor, ownerId: string): "all" | "public"

   Everything else in this directory calls those two names, so if
   one of them is absent every other file reds with the same
   message. This file exists so that the first red a reader sees
   says *which* name is missing and quotes the clause that publishes
   it, rather than leaving five criteria to be read as five
   independent failures of one missing export.

   ── the type-level half ──
   `Actor`, `Resource` and `Action` are types: they have no runtime
   identity, so nothing at runtime can assert on them. They are
   pinned at compile time instead, by `Exact<>`, and it is
   `npm run typecheck` that fails when the implementation publishes
   a different shape — a `handle` that is not `string | null`, a
   missing `"transfer"`, a `visibility` widened to `string`. The
   check is written once, here, so that a naming difference lights
   up in one place rather than in every fixture.
   ============================================================ */

/** True only when A and B are the same type to the compiler, not merely assignable. */
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

/**
 * Three compile-time assertions and one runtime value. `npm run typecheck` rejects this
 * declaration the moment `@/lib/server/policy` publishes a type whose shape differs from
 * the published block; the array is exported into the test below so that neither
 * eslint nor the reader has to wonder what an unused constant is doing here.
 */
const CONTRACT_TYPES_MATCH: [
  Exact<Actor, PublishedActor>,
  Exact<Resource, PublishedResource>,
  Exact<Action, PublishedAction>,
] = [true, true, true];

describe("T060 published signatures", () => {
  it("publishes `can` from the barrel `@/lib/server/policy`", async () => {
    const mod = await loadPolicy();
    expect(
      typeof mod.can,
      `the contract publishes: ${PUBLISHED.can}\n` +
        `  exported: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
    ).toBe("function");
  });

  it("publishes `visibleTo` from the barrel `@/lib/server/policy`", async () => {
    const mod = await loadPolicy();
    expect(
      typeof mod.visibleTo,
      `the contract publishes: ${PUBLISHED.visibleTo}\n` +
        `  exported: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
    ).toBe("function");
  });

  it("publishes `Actor`, `Resource` and `Action` with the shapes the block states", async () => {
    /* The assertion is the declaration above, and `npm run typecheck` is what evaluates
       it. The module is loaded here as well so this test is red for the same reason as
       every other one while the module is absent: a type-only test would pass against
       nothing at all, which is the one result this hand-off may not produce. */
    await loadPolicy();
    expect(CONTRACT_TYPES_MATCH).toEqual([true, true, true]);
  });

  it("answers a boolean for every published action, and never a Response", async () => {
    const can = await canFn();
    for (const action of ACTIONS) {
      for (const { label, resource } of everyResourceOwnedBy(ALICE)) {
        const answer = can(alice, action, resource);
        expect(answer instanceof Response, `can(owner, "${action}", ${label}) is a Response`).toBe(
          false,
        );
        expect(
          typeof answer,
          `can(owner, "${action}", ${label}) answered ${String(answer)}; ` +
            `the contract publishes: ${PUBLISHED.can}`,
        ).toBe("boolean");
      }
    }
  });

  it('answers "all" or "public" and nothing else', async () => {
    const visibleTo = await visibleToFn();
    const actors: [string, Actor][] = [
      ["anonymous", anonymous],
      ["the owner", alice],
      ["the operator", operator],
    ];
    for (const [name, actor] of actors) {
      for (const ownerId of [ALICE, "acct_someone_else"]) {
        const answer = visibleTo(actor, ownerId);
        expect(
          answer === "all" || answer === "public",
          `visibleTo(${name}, ${JSON.stringify(ownerId)}) answered ${JSON.stringify(answer)}.\n` +
            `  the contract publishes: ${PUBLISHED.visibleTo}\n` +
            `  A caller turns this into a WHERE clause, so a third value is a query with ` +
            `no filter on it.`,
        ).toBe(true);
      }
    }
  });

  it("is reachable without importing anything else the caller has to know about", async () => {
    /* The barrel rule, exercised rather than asserted: one import of one specifier is
       enough to decide something. A capability reachable only by a deep path is not
       public, and this is the call that proves it is not. */
    const { can } = (await loadPolicy()) as { can: (a: unknown, b: unknown, c: unknown) => unknown };
    expect(typeof can(anonymous, "read", bundle(ALICE, "public"))).toBe("boolean");
  });
});
