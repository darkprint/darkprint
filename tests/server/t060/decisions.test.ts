import { describe, expect, it } from "vitest";

import {
  ACTIONS,
  ALICE,
  BERTRAND,
  type Action,
  type Actor,
  type Resource,
  account,
  alice,
  aliceWithoutHandle,
  anonymous,
  bertrand,
  bundle,
  canFn,
  card,
  everyPrivateResourceOwnedBy,
  everyResourceOwnedBy,
  granted,
  label,
  noteOnOwnPublicBundle,
  save,
  strictly,
} from "./contract";

/* ============================================================
   T060 criterion (3) — an exhaustive case list, no default-allow

   (3) every action is decided by an exhaustive case list with no
       default-allow branch

   Two halves, and only the second is hard.

   The first is that every published combination is *decided*: five
   actions across every published resource shape, for every
   published actor shape, answers `true` or `false` and never
   `undefined`. `strictly` enforces that on the spot, because an
   unhandled case returning `undefined` reads as a denial in every
   `=== true` downstream and would otherwise pass the security half
   of this suite while failing this criterion outright.

   The second is "no default-allow branch", which is a claim about
   the *shape* of the implementation and cannot be read off a
   passing decision. What it can be read off is an unpublished one.
   A case list that is genuinely exhaustive has nowhere to send an
   action it does not know, so it cannot answer `true` to one; an
   implementation whose owner branch reads

       if (resource.ownerId === actor.accountId) return true

   answers `true` to every string in the world and is the exact
   shape this criterion forbids. So the unknown-action tests below
   are run against the *owner*, not only against a stranger. Against
   a stranger they would pass on an implementation that has no case
   list at all.

   A throw is accepted as a denial throughout. An exhaustive
   `switch` closed with `assertNever` throws on an input TypeScript
   said could not arrive, and that is a legitimate reading of
   "exhaustive"; so is a fail-closed `return false`. What neither
   may do is answer `true`, and that is the whole of what `granted`
   asserts.
   ============================================================ */

/** An id that looks like it belongs to an operator and does not make its bearer one. */
const OPERATORISH = "acct_01J9Z3K7Q8V2M4X8";

/** Every actor shape the contract publishes, and no operator: the operator is criterion (4). */
const SUBJECTS: [string, Actor][] = [
  ["anonymous", anonymous],
  ["the owner", alice],
  ["the owner, before choosing a handle", aliceWithoutHandle],
  ["a signed-in stranger", bertrand],
];

describe("T060 (3) every published combination is decided", () => {
  it("answers true or false for every actor, action and resource", async () => {
    const can = await canFn();
    let decisions = 0;
    for (const [, actor] of SUBJECTS) {
      for (const owner of [ALICE, BERTRAND]) {
        for (const { resource } of everyResourceOwnedBy(owner)) {
          for (const action of ACTIONS) {
            /* `strictly` throws on anything that is not a boolean, naming the case. */
            strictly(can, actor, action, resource);
            decisions += 1;
          }
        }
      }
    }
    expect(decisions).toBe(
      SUBJECTS.length * 2 * everyResourceOwnedBy(ALICE).length * ACTIONS.length,
    );
  });
});

describe("T060 (3) the owner is allowed what the contract says the owner is allowed", () => {
  it("lets the owner read every one of their own resources, private included", async () => {
    const can = await canFn();
    for (const { label: what, resource } of everyResourceOwnedBy(ALICE)) {
      expect(strictly(can, alice, "read", resource), `the owner cannot read her own ${what}`).toBe(
        true,
      );
    }
  });

  it("lets the owner write and delete their own resources", async () => {
    const can = await canFn();
    const own: [string, Resource][] = [
      ["bundle", bundle(ALICE, "private")],
      ["public bundle", bundle(ALICE, "public")],
      ["card", card(ALICE, "private")],
      ["save", save(ALICE)],
      /* B-18, in its own words: "An author may edit and delete their own notes". */
      ["note", noteOnOwnPublicBundle(ALICE)],
      /* T120 is account deletion; the account row is the owner's own settings. */
      ["account", account(ALICE)],
    ];
    for (const [what, resource] of own) {
      expect(strictly(can, alice, "write", resource), `the owner cannot write her own ${what}`).toBe(
        true,
      );
      expect(
        strictly(can, alice, "delete", resource),
        `the owner cannot delete her own ${what}`,
      ).toBe(true);
    }
  });

  it("lets the owner publish and transfer their own bundle", async () => {
    const can = await canFn();
    /* B-06: "A bundle first exists at its first publish", by its owner. T120 is the
       transfer of that ownership, and the owner is the only non-operator subject there is
       to initiate one. */
    expect(strictly(can, alice, "publish", bundle(ALICE, "private"))).toBe(true);
    expect(strictly(can, alice, "transfer", bundle(ALICE, "public"))).toBe(true);
  });
});

describe("T060 (3) nobody but the owner mutates anything", () => {
  const MUTATIONS: Action[] = ["write", "delete", "publish", "transfer"];

  it("denies every mutation to an anonymous caller", async () => {
    const can = await canFn();
    for (const { label: what, resource } of everyResourceOwnedBy(ALICE)) {
      for (const action of MUTATIONS) {
        expect(
          strictly(can, anonymous, action, resource),
          `an anonymous caller may ${action} a ${what}`,
        ).toBe(false);
      }
    }
  });

  it("denies every mutation to a signed-in stranger", async () => {
    const can = await canFn();
    for (const { label: what, resource } of everyResourceOwnedBy(ALICE)) {
      for (const action of MUTATIONS) {
        expect(
          strictly(can, bertrand, action, resource),
          `a signed-in stranger may ${action} somebody else's ${what}`,
        ).toBe(false);
      }
    }
  });

  it("denies a stranger every read of a private resource", async () => {
    const can = await canFn();
    /* "a private bundle has no resolved graph and therefore no reading" — and the same for
       a private card (B-07) and for a save, which has no public half at all. */
    for (const { label: what, resource } of everyPrivateResourceOwnedBy(ALICE)) {
      expect(strictly(can, anonymous, "read", resource), `anonymous read of a ${what}`).toBe(false);
      expect(strictly(can, bertrand, "read", resource), `a stranger read a ${what}`).toBe(false);
    }
  });

  it("allows a stranger the reads a public resource is for", async () => {
    const can = await canFn();
    /* The denial half above passes on a policy that denies everything, so the allow half
       runs beside it. A public blueprint is the registry's whole point. */
    expect(strictly(can, anonymous, "read", bundle(ALICE, "public"))).toBe(true);
    expect(strictly(can, bertrand, "read", bundle(ALICE, "public"))).toBe(true);
    expect(strictly(can, anonymous, "read", card(ALICE, "public"))).toBe(true);
    expect(strictly(can, bertrand, "read", card(ALICE, "public"))).toBe(true);
  });
});

/**
 * Strings that are not `Action`, chosen for the ways a case list leaks. `"READ"` and
 * `"Read"` catch a case-insensitive match; `" read"`, `"read\n"` and a NUL-terminated one catch
 * a trimmed or truncated one; `"reаd"` carries a Cyrillic а and catches a lookalike; `""`
 * catches a falsy short circuit; `"*"`, `"admin"`, `"__proto__"`, `"constructor"` and
 * `"toString"` catch a decision looked up as a property of a plain object.
 */
const NOT_ACTIONS: string[] = [
  "",
  " ",
  "READ",
  "Read",
  "read ",
  " read",
  "reаd",
  "readwrite",
  "admin",
  "*",
  "own",
  "__proto__",
  "constructor",
  "toString",
  "read\u0000",
  "read\n",
  "移動",
];

/**
 * Discriminants that are not a `Resource` kind. `"blueprint"` is the word the product uses
 * for a bundle in the UI and is the most likely near-miss of the lot.
 */
const NOT_RESOURCE_KINDS: string[] = [
  "",
  "blueprint",
  "bundles",
  "Bundle",
  "BUNDLE",
  "user",
  "term",
  "release",
  "__proto__",
];

describe("T060 (3) no default-allow branch", () => {
  it("grants no unpublished action, not even to the owner of the resource", async () => {
    const can = await canFn();
    /* The owner is the subject here on purpose: this is the assertion that separates a
       case list from `if (isOwner) return true`. A stranger is denied by both. */
    for (const action of NOT_ACTIONS) {
      for (const { label: what, resource } of everyResourceOwnedBy(ALICE)) {
        expect(
          granted(can, alice, action, resource),
          `can(owner, ${JSON.stringify(action)}, ${what}) granted. ` +
            `${JSON.stringify(action)} is not one of ${ACTIONS.join(", ")}, so an ` +
            `exhaustive case list has nowhere to decide it.`,
        ).toBe(false);
      }
    }
  });

  it("grants no unpublished action to a stranger or an anonymous caller", async () => {
    const can = await canFn();
    for (const action of NOT_ACTIONS) {
      for (const actor of [anonymous, bertrand]) {
        expect(granted(can, actor, action, bundle(ALICE, "public"))).toBe(false);
        expect(granted(can, actor, action, bundle(ALICE, "private"))).toBe(false);
      }
    }
  });

  it("grants nothing over a resource kind it does not publish", async () => {
    const can = await canFn();
    for (const kind of NOT_RESOURCE_KINDS) {
      const resource = { kind, ownerId: ALICE, authorId: ALICE, accountId: ALICE, visibility: "public" };
      for (const action of ACTIONS) {
        for (const [who, actor] of SUBJECTS) {
          expect(
            granted(can, actor, action, resource),
            `can(${who}, "${action}", ${label(resource)}) granted over an unpublished ` +
              `resource kind. The five kinds are bundle, card, save, note and account.`,
          ).toBe(false);
        }
      }
    }
  });

  it("fails closed on a visibility it does not publish", async () => {
    const can = await canFn();
    /* `"unlisted"` is the plausible third value somebody adds later without touching this
       module, and `"Public"` is the same value with the wrong case. Either one reaching a
       branch that treats "not private" as public turns a draft into a publication. */
    for (const visibility of ["unlisted", "Public", "PUBLIC", "public ", "", "draft"]) {
      for (const kind of ["bundle", "card"]) {
        const resource = { kind, ownerId: ALICE, visibility };
        expect(
          granted(can, anonymous, "read", resource),
          `anonymous read granted on a ${kind} whose visibility is ` +
            `${JSON.stringify(visibility)}; only "public" is public.`,
        ).toBe(false);
        expect(granted(can, bertrand, "read", resource)).toBe(false);
      }
    }
  });

  it("fails closed on a bundle with no visibility at all", async () => {
    const can = await canFn();
    const resource = { kind: "bundle", ownerId: ALICE };
    expect(
      granted(can, anonymous, "read", resource),
      "a bundle row with no visibility column was read as public",
    ).toBe(false);
    expect(granted(can, bertrand, "read", resource)).toBe(false);
  });

  it("grants nothing to an actor kind it does not publish", async () => {
    const can = await canFn();
    /* `"moderator"` is ruled out by B-13 in as many words: "No moderator tier, no
       organisations, no team ownership." The rest are the ways a discriminant check
       written as anything other than an equality test lets one through. */
    const impostors = [
      { kind: "moderator", accountId: ALICE },
      { kind: "admin", accountId: ALICE },
      { kind: "Operator", accountId: OPERATORISH },
      { kind: "OPERATOR", accountId: OPERATORISH },
      { kind: "operator ", accountId: OPERATORISH },
      { kind: " operator", accountId: OPERATORISH },
      { kind: "operators", accountId: OPERATORISH },
      { kind: "", accountId: ALICE },
      { kind: "service", accountId: ALICE },
    ];
    for (const actor of impostors) {
      for (const action of ACTIONS) {
        expect(
          granted(can, actor, action, bundle(ALICE, "private")),
          `can(${label(actor)}, "${action}", private bundle) granted. The published Actor ` +
            `union has three members: anonymous, account, operator.`,
        ).toBe(false);
      }
    }
  });

  it("does not let an account claim operator powers with an extra field", async () => {
    const can = await canFn();
    /* A route that builds its actor from a session row is one careless spread away from
       carrying an attacker-supplied flag into this call. The discriminant is `kind`. */
    const impostors = [
      { kind: "account", accountId: BERTRAND, handle: "bertrand", operator: true },
      { kind: "account", accountId: BERTRAND, handle: "bertrand", isOperator: true },
      { kind: "account", accountId: BERTRAND, handle: "bertrand", role: "operator" },
      { kind: "account", accountId: BERTRAND, handle: "bertrand", ownerId: ALICE },
      { kind: "anonymous", accountId: ALICE, handle: "aurelia" },
    ];
    for (const actor of impostors) {
      expect(
        granted(can, actor, "read", bundle(ALICE, "private")),
        `${label(actor)} was granted a read of somebody else's private bundle`,
      ).toBe(false);
      expect(granted(can, actor, "delete", bundle(ALICE, "public"))).toBe(false);
    }
  });
});

describe("T060 (3) ownership is an exact match on the id", () => {
  it("does not treat a prefix, a suffix or a case variant as the owner", async () => {
    const can = await canFn();
    const nearMisses = [
      ALICE.slice(0, -1),
      `${ALICE}9`,
      ` ${ALICE}`,
      `${ALICE} `,
      `${ALICE}\n`,
      ALICE.toLowerCase(),
      ALICE.toUpperCase(),
      ALICE.replace("_", "-"),
    ].filter((id) => id !== ALICE);

    for (const accountId of nearMisses) {
      const actor: Actor = { kind: "account", accountId, handle: "impostor" };
      expect(
        granted(can, actor, "write", bundle(ALICE, "private")),
        `${JSON.stringify(accountId)} was treated as the owner ${JSON.stringify(ALICE)}`,
      ).toBe(false);
      expect(granted(can, actor, "read", bundle(ALICE, "private"))).toBe(false);
      expect(granted(can, actor, "delete", save(ALICE))).toBe(false);
    }
  });

  it("reads a note's author from `authorId` and an account's owner from `accountId`", async () => {
    const can = await canFn();
    /* The published Resource union names a different field per kind. A policy that reads
       `ownerId` off all five silently denies the author of a note everything, and a policy
       that falls back across the fields grants on the first one that happens to be set —
       which is why the impostors below carry the wrong field with the right value. */
    const alicesNote = noteOnOwnPublicBundle(ALICE);
    expect(
      strictly(can, alice, "delete", alicesNote),
      "the author cannot delete her own note",
    ).toBe(true);
    expect(strictly(can, bertrand, "delete", alicesNote)).toBe(false);
    expect(strictly(can, alice, "write", account(ALICE)), "the owner cannot write her account").toBe(
      true,
    );
    expect(strictly(can, bertrand, "write", account(ALICE))).toBe(false);
    expect(
      granted(can, bertrand, "delete", {
        kind: "note",
        authorId: ALICE,
        ownerId: BERTRAND,
        parent: { ownerId: ALICE, visibility: "public" },
      }),
      "a stranger deleted a note by putting their own id in an `ownerId` the note has not got",
    ).toBe(false);
    expect(
      granted(can, bertrand, "write", { kind: "account", accountId: ALICE, ownerId: BERTRAND }),
      "a stranger wrote an account by putting their own id in an `ownerId` it has not got",
    ).toBe(false);
  });
});
