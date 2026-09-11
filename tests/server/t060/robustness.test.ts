import { describe, expect, it } from "vitest";

import {
  ACTIONS,
  ALICE,
  BERTRAND,
  type Actor,
  account,
  alice,
  anonymous,
  bertrand,
  bundle,
  canFn,
  card,
  granted,
  label,
  noteOnOwnPublicBundle,
  operator,
  save,
  strictly,
  visibleToFn,
  widened,
} from "./contract";

/* ============================================================
   T060 — the failure and edge cases the contract implies

   None of the five numbered criteria says "and do not fall over on
   input the type system said could not arrive", and every one of
   them depends on it. This module is the thing every route in the
   registry asks before it answers, and a route builds its `Actor`
   from a session row and its `Resource` from a database row. Both
   can be absent, both can be half-built, and TypeScript is not in
   the room at that point.

   Every assertion here is in one direction: the call must not
   answer `true`, and `visibleTo` must not answer `"all"`. A throw
   counts as a denial, because an exhaustive `switch` closed with
   `assertNever` is a legitimate reading of criterion (3) and so is
   a fail-closed `return false`. Nothing here asserts *which* of the
   two, because the contract does not say and inventing an answer
   would report a defect that is not one.
   ============================================================ */

/** Values that are not an `Actor`, and are the ones a caller actually arrives with. */
const NOT_ACTORS: [string, unknown][] = [
  ["null", null],
  ["undefined", undefined],
  ["a missing session", {}],
  ["a string", "alice"],
  ["the owner's id on its own", ALICE],
  ["a number", 1],
  ["zero", 0],
  ["true", true],
  ["an array", []],
  ["an array holding an actor", [{ kind: "operator", accountId: ALICE }]],
  ["a Date", new Date(0)],
  ["a function", () => ({ kind: "operator" })],
  ["an actor with no kind", { accountId: ALICE, handle: "aurelia" }],
  ["an actor whose kind is null", { kind: null, accountId: ALICE }],
  ["an actor whose kind is a number", { kind: 1, accountId: ALICE }],
  ["an account with no id", { kind: "account", handle: "aurelia" }],
  ["an account whose id is null", { kind: "account", accountId: null, handle: null }],
  ["an account whose id is a number", { kind: "account", accountId: 7, handle: null }],
  ["an account whose id is an object", { kind: "account", accountId: { id: ALICE }, handle: null }],
  ["an operator with no id", { kind: "operator" }],
  ["a JSON-parsed prototype attack", JSON.parse('{"__proto__":{"kind":"operator"}}')],
];

/** Values that are not a `Resource`. */
const NOT_RESOURCES: [string, unknown][] = [
  ["null", null],
  ["undefined", undefined],
  ["a row that came back empty", {}],
  ["a string", "bundle"],
  ["a number", 42],
  ["an array", []],
  ["an array holding a resource", [{ kind: "bundle", ownerId: ALICE, visibility: "public" }]],
  ["a resource with no kind", { ownerId: ALICE, visibility: "public" }],
  ["a bundle whose owner is null", { kind: "bundle", ownerId: null, visibility: "private" }],
  ["a bundle whose owner is undefined", { kind: "bundle", visibility: "private" }],
  ["a bundle whose owner is a number", { kind: "bundle", ownerId: 0, visibility: "private" }],
  ["a save with no owner", { kind: "save" }],
  ["an account with no id", { kind: "account" }],
];

describe("T060 absent and malformed input is never a grant", () => {
  it("grants a caller that is not an Actor nothing an anonymous one would not get", async () => {
    const can = await canFn();
    /* Measured against anonymous rather than against a flat denial. A public blueprint is
       readable by the whole internet, so a half-built actor being told so is not an
       escalation and asserting otherwise would report a defect that is not one. What may
       never happen is a malformed actor getting *more* than the caller with no session at
       all, which is what every line below checks. */
    for (const [what, actor] of NOT_ACTORS) {
      for (const action of ACTIONS) {
        for (const resource of [bundle(ALICE, "private"), bundle(ALICE, "public"), save(ALICE)]) {
          const forMalformed = granted(can, actor, action, resource);
          const forAnonymous = granted(can, anonymous, action, resource);
          expect(
            forMalformed && !forAnonymous,
            `${what} was granted ${action} on a ${label(resource)} that an anonymous caller ` +
              `is denied`,
          ).toBe(false);
        }
      }
    }
  });

  it("grants no caller that is not an Actor anything at all on a private row", async () => {
    const can = await canFn();
    /* The absolute half, on the rows where anonymous is denied everything anyway, so the
       message names the input rather than a comparison. */
    for (const [what, actor] of NOT_ACTORS) {
      for (const action of ACTIONS) {
        expect(
          granted(can, actor, action, bundle(ALICE, "private")),
          `${what} was granted ${action} on a private bundle`,
        ).toBe(false);
        expect(
          granted(can, actor, action, save(ALICE)),
          `${what} was granted ${action} on somebody's save`,
        ).toBe(false);
      }
    }
  });

  it("grants nothing over a value that is not a Resource", async () => {
    const can = await canFn();
    for (const [what, resource] of NOT_RESOURCES) {
      for (const actor of [anonymous, alice, bertrand]) {
        for (const action of ACTIONS) {
          expect(
            granted(can, actor, action, resource),
            `${label(actor)} was granted ${action} over ${what}`,
          ).toBe(false);
        }
      }
    }
  });

  it("grants nothing when the action is not a string", async () => {
    const can = await canFn();
    const notActions = [null, undefined, 0, 1, true, false, [], ["read"], { action: "read" }];
    for (const action of notActions) {
      for (const { label: what, resource } of [
        { label: "her own private bundle", resource: bundle(ALICE, "private") },
        { label: "her own save", resource: save(ALICE) },
      ]) {
        expect(
          granted(can, alice, action, resource),
          `the owner was granted ${String(action)} on ${what}`,
        ).toBe(false);
      }
    }
  });

  it("grants nothing when arguments are missing altogether", async () => {
    const can = await canFn();
    const call = can as (...args: unknown[]) => unknown;
    for (const args of [
      [],
      [alice],
      [alice, "read"],
      [alice, "read", undefined],
      [undefined, undefined, undefined],
    ]) {
      let answer: unknown;
      try {
        answer = call(...args);
      } catch {
        answer = false;
      }
      expect(answer === true, `can(${args.length} arguments) granted`).toBe(false);
    }
  });

  it("ignores a fourth argument rather than being widened by one", async () => {
    const can = await canFn();
    const call = can as (...args: unknown[]) => unknown;
    /* A caller passing an options bag it invented must not change the answer. */
    expect(call(anonymous, "read", bundle(ALICE, "private"), { operator: true })).toBe(false);
    expect(call(anonymous, "read", bundle(ALICE, "private"), "force")).toBe(false);
  });
});

describe("T060 an empty string is not an identity", () => {
  it("does not let an account with no id own a resource that has one", async () => {
    const can = await canFn();
    const idless: Actor = { kind: "account", accountId: "", handle: null };
    for (const action of ACTIONS) {
      expect(
        granted(can, idless, action, bundle(ALICE, "private")),
        `an account whose id is "" was granted ${action} on Alice's private bundle`,
      ).toBe(false);
    }
  });

  it("does not match an empty id against an empty owner", async () => {
    const can = await canFn();
    /* Stated in the contract as of 2026-08-14, in its own words: "An empty-string id never
       matches an empty-string id. `""` is what an unset column and a half-built session row
       both look like, so treating them as equal is a default-allow wearing a disguise."
       Written here first as a reading of criterion (3) and reported as derived; it is a
       ruling now, so this test quotes rather than infers. */
    const idless: Actor = { kind: "account", accountId: "", handle: null };
    expect(
      granted(can, idless, "write", { kind: "bundle", ownerId: "", visibility: "private" }),
      'an account whose id is "" was granted write over a row whose owner is ""',
    ).toBe(false);
    expect(granted(can, idless, "read", { kind: "save", ownerId: "" })).toBe(false);
    expect(granted(can, idless, "delete", { kind: "account", accountId: "" })).toBe(false);
  });

  it("does not widen a query for an empty handle", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();
    expect(widened(visibleTo, { kind: "account", accountId: "", handle: null }, "")).toBe(false);
    expect(visibleTo(alice, "")).toBe("public");
    expect(granted(can, anonymous, "read", bundle("", "private"))).toBe(false);
  });
});

describe("T060 an id is compared as the whole string it is", () => {
  const UNICODE_OWNER = "acct_ünïcode_🜁_مرحبا_ぬ";

  it("recognises an owner whose id is not ASCII", async () => {
    const can = await canFn();
    const owner: Actor = { kind: "account", accountId: UNICODE_OWNER, handle: "ünïcode" };
    expect(
      strictly(can, owner, "write", bundle(UNICODE_OWNER, "private")),
      "an owner whose id carries non-ASCII characters was not recognised as the owner, " +
        "which means the id was truncated or re-encoded on the way in",
    ).toBe(true);
    expect(strictly(can, owner, "read", save(UNICODE_OWNER))).toBe(true);
    expect(strictly(can, bertrand, "read", save(UNICODE_OWNER))).toBe(false);
  });

  it("does not conflate two unicode normalisations of one id", async () => {
    const can = await canFn();
    /* U+00E9 and "e" + U+0301 render identically and are different ids. Normalising them
       together would let one account answer for another's rows, and normalising is
       something a policy module has no business doing at all. */
    /* Widened to `string` on purpose: as literal types these are two distinct types and
       tsc rejects the comparison below as unintentional, which is the one thing it is
       not \u2014 that the two are different is what the rest of the test rests on. */
    const composed: string = "acct_caf\u00e9";
    const decomposed: string = "acct_cafe\u0301";
    expect(composed === decomposed, "the fixture stopped testing what it claims to").toBe(false);
    const impostor: Actor = { kind: "account", accountId: decomposed, handle: "cafe" };
    expect(
      granted(can, impostor, "write", bundle(composed, "private")),
      "two different unicode normalisations of one id were treated as the same account",
    ).toBe(false);
    expect(granted(can, impostor, "read", bundle(composed, "private"))).toBe(false);
  });

  it("does not stop comparing an id part-way through", async () => {
    const can = await canFn();
    const long = `acct_${"0123456789".repeat(1000)}`;
    const almost = `${long.slice(0, -1)}X`;
    const owner: Actor = { kind: "account", accountId: long, handle: null };
    const impostor: Actor = { kind: "account", accountId: almost, handle: null };
    expect(strictly(can, owner, "write", bundle(long, "private"))).toBe(true);
    expect(
      granted(can, impostor, "write", bundle(long, "private")),
      "two ids differing only in their last character were treated as one account",
    ).toBe(false);
  });

  it("does not treat a zero-width character as nothing", async () => {
    const can = await canFn();
    const impostor: Actor = { kind: "account", accountId: `${ALICE}\u200b`, handle: null };
    expect(granted(can, impostor, "write", bundle(ALICE, "private"))).toBe(false);
    expect(granted(can, impostor, "read", card(ALICE, "private"))).toBe(false);
  });
});

describe("T060 `visibleTo` is asked the same questions", () => {
  it("does not widen for a caller who is not an Actor", async () => {
    const visibleTo = await visibleToFn();
    for (const [what, actor] of NOT_ACTORS) {
      expect(widened(visibleTo, actor, ALICE), `${what} was given the owner's view`).toBe(false);
    }
  });

  it("does not widen when the owner id is absent or the wrong type", async () => {
    const visibleTo = await visibleToFn();
    for (const ownerId of [null, undefined, 0, 1, true, [], [ALICE], { id: ALICE }, () => ALICE]) {
      expect(
        widened(visibleTo, alice, ownerId),
        `the owner's view was given for an owner id of ${String(ownerId)}`,
      ).toBe(false);
    }
    const call = visibleTo as (...args: unknown[]) => unknown;
    let answer: unknown;
    try {
      answer = call(alice);
    } catch {
      answer = "public";
    }
    expect(answer, "visibleTo with no owner id widened the query").not.toBe("all");
  });

  it("widens for the owner and nobody who merely resembles one", async () => {
    const visibleTo = await visibleToFn();
    expect(visibleTo(alice, ALICE)).toBe("all");
    expect(visibleTo(bertrand, ALICE)).toBe("public");
    expect(visibleTo(anonymous, ALICE)).toBe("public");
    for (const accountId of [`${ALICE} `, ` ${ALICE}`, `${ALICE}9`, ALICE.slice(0, -1)]) {
      expect(
        widened(visibleTo, { kind: "account", accountId, handle: null }, ALICE),
        `${JSON.stringify(accountId)} was given ${JSON.stringify(ALICE)}'s view`,
      ).toBe(false);
    }
  });

  it("does not widen for an actor kind it does not publish", async () => {
    const visibleTo = await visibleToFn();
    for (const kind of ["moderator", "admin", "Operator", "operator ", "", "service"]) {
      expect(
        widened(visibleTo, { kind, accountId: ALICE }, ALICE),
        `an actor of kind ${JSON.stringify(kind)} was given the owner's view`,
      ).toBe(false);
    }
  });
});

describe("T060 duplicate calls", () => {
  it("answers a repeated question the same way, malformed input included", async () => {
    const can = await canFn();
    for (const [what, actor] of NOT_ACTORS) {
      const first = granted(can, actor, "read", bundle(ALICE, "private"));
      for (let i = 0; i < 5; i += 1) {
        expect(
          granted(can, actor, "read", bundle(ALICE, "private")),
          `${what} answered differently on call ${i + 2}`,
        ).toBe(first);
      }
    }
  });

  it("answers the same for a resource asked twice in a row and once in between", async () => {
    const can = await canFn();
    /* A private read between two public ones, twenty times: the sequence a listing page
       produces, and the one that finds a decision carried over from the last call. */
    for (let i = 0; i < 20; i += 1) {
      expect(strictly(can, bertrand, "read", bundle(ALICE, "public"))).toBe(true);
      expect(strictly(can, bertrand, "read", bundle(ALICE, "private"))).toBe(false);
      expect(strictly(can, bertrand, "read", bundle(ALICE, "public"))).toBe(true);
    }
  });

  it("answers the same for every subject asked in turn over one resource", async () => {
    const can = await canFn();
    const resource = bundle(ALICE, "private");
    const expected: [Actor, boolean][] = [
      [alice, true],
      [bertrand, false],
      [anonymous, false],
      [operator, true],
    ];
    for (let round = 0; round < 10; round += 1) {
      for (const [actor, answer] of expected) {
        expect(
          strictly(can, actor, "read", resource),
          `${label(actor)} answered differently in round ${round}`,
        ).toBe(answer);
      }
    }
  });
});

describe("T060 the answer is a decision and not a response", () => {
  it("never answers with a Response, a status or a reason object", async () => {
    const can = await canFn();
    /* B-03 puts the 404 in the caller: "A private resource the caller may not see returns
       404, never 403". The contract says it again for this module — "`can` returns a
       boolean and never a `Response` ... this module may not import the envelope" — so a
       403, a 404 or a `{ allowed }` wrapper here is a failed criterion and not a style. */
    const cases: [Actor, string, unknown][] = [
      [anonymous, "read", bundle(ALICE, "private")],
      [bertrand, "delete", card(ALICE, "public")],
      [alice, "read", account(ALICE)],
      [operator, "read", noteOnOwnPublicBundle(BERTRAND)],
    ];
    for (const [actor, action, resource] of cases) {
      const answer = can(actor, action, resource);
      expect(answer instanceof Response, `${label(actor)} got a Response`).toBe(false);
      expect(typeof answer, `${label(actor)} got a ${typeof answer}`).toBe("boolean");
    }
  });
});
