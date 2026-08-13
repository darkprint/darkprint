import { describe, expect, it } from "vitest";

import {
  ALICE,
  BERTRAND,
  type Actor,
  alice,
  anonymous,
  bertrand,
  canFn,
  granted,
  label,
  note,
  operator,
  strictly,
} from "./contract";

/* ============================================================
   T060 — a note inherits its parent's privacy (amendment, 2026-08-14)

       | { kind: "note"; authorId: string;
             parent: { ownerId: string; visibility: "public" | "private" } }

   backend.md, in its own words: "`Resource.note` carried only
   `authorId`, so its implementer modelled note reads as open to
   everyone ... a note on a **private** bundle would have been
   world-readable, because the shape gave the policy nothing to
   check privacy against."

   So the failure this file exists to catch is an implementation
   that reads `authorId`, decides, and never looks at `parent` —
   which is exactly what the old shape forced and what the old
   fixtures would still pass.

   Three rules, and they pull in different directions, which is why
   each has tests of its own:

     read   — decided by the parent. The note's own author does not
              enter it.
     write  — the author, and nobody else.
     delete — the author (B-18: "An author may edit and delete their
              own notes"), and the operator ("the operator may
              remove any").

   ── the case that decides whether `parent` is read at all ──
   A note authored by Alice on Bertrand's *private* blueprint. Every
   field in it points somewhere different: an implementation keyed
   on `authorId` hands it to Alice, an implementation keyed on the
   parent hands it to Bertrand, and only one of those is the
   amendment. Anonymous is denied by both, which is why the
   anonymous case alone is not enough to catch this.
   ============================================================ */

/** Alice wrote it. Bertrand owns the blueprint it hangs on, and that blueprint is private. */
const NOTE_ON_A_PRIVATE_STRANGER = note(ALICE, { ownerId: BERTRAND, visibility: "private" });
/** The same note, on the same stranger's blueprint, published. */
const NOTE_ON_A_PUBLIC_STRANGER = note(ALICE, { ownerId: BERTRAND, visibility: "public" });
/** Bertrand's note on Alice's private blueprint: the author is a stranger to the parent. */
const STRANGERS_NOTE_ON_A_PRIVATE_PARENT = note(BERTRAND, {
  ownerId: ALICE,
  visibility: "private",
});

describe("T060 a note on a private parent is not readable", () => {
  it("is not readable by an anonymous caller", async () => {
    const can = await canFn();
    expect(
      strictly(can, anonymous, "read", NOTE_ON_A_PRIVATE_STRANGER),
      "a note on a private blueprint was world-readable, which is the leak the " +
        "2026-08-14 amendment to Resource.note exists to close",
    ).toBe(false);
  });

  it("is not readable by a signed-in caller who does not own the parent", async () => {
    const can = await canFn();
    const stranger: Actor = {
      kind: "account",
      accountId: "acct_01J9Z3K7Q8V2M4Y0",
      handle: "cressida",
    };
    expect(strictly(can, stranger, "read", NOTE_ON_A_PRIVATE_STRANGER)).toBe(false);
    expect(strictly(can, stranger, "read", STRANGERS_NOTE_ON_A_PRIVATE_PARENT)).toBe(false);
  });

  it("is not readable by its own author when somebody else owns the private parent", async () => {
    const can = await canFn();
    /* The case that separates the two implementations. Alice wrote this note; the
       blueprint under it is Bertrand's and it is private. Read is the parent's decision,
       and the amendment says the note's own author does not enter it. */
    expect(
      strictly(can, alice, "read", NOTE_ON_A_PRIVATE_STRANGER),
      "the note's author was handed a read on a private blueprint they do not own, which " +
        "means `parent` was not consulted and `authorId` decided the read",
    ).toBe(false);
  });

  it("is readable by whoever owns the parent", async () => {
    const can = await canFn();
    expect(
      strictly(can, bertrand, "read", NOTE_ON_A_PRIVATE_STRANGER),
      "the owner of the private blueprint cannot read a note left on it",
    ).toBe(true);
    expect(strictly(can, alice, "read", STRANGERS_NOTE_ON_A_PRIVATE_PARENT)).toBe(true);
  });

  it("is readable by the break-glass operator", async () => {
    const can = await canFn();
    expect(strictly(can, operator, "read", NOTE_ON_A_PRIVATE_STRANGER)).toBe(true);
    expect(strictly(can, operator, "read", STRANGERS_NOTE_ON_A_PRIVATE_PARENT)).toBe(true);
  });
});

describe("T060 a note on a public parent is readable", () => {
  it("is readable by anonymous callers and by strangers", async () => {
    const can = await canFn();
    /* Without this, a policy that denied every note read would pass everything above. */
    expect(
      strictly(can, anonymous, "read", NOTE_ON_A_PUBLIC_STRANGER),
      "a note on a published blueprint is community content and cannot be hidden",
    ).toBe(true);
    expect(strictly(can, bertrand, "read", NOTE_ON_A_PUBLIC_STRANGER)).toBe(true);
    expect(strictly(can, alice, "read", NOTE_ON_A_PUBLIC_STRANGER)).toBe(true);
  });
});

describe("T060 writing and deleting a note stay with its author", () => {
  it("lets the author edit and delete their own note on a stranger's blueprint", async () => {
    const can = await canFn();
    /* B-18: "An author may edit and delete their own notes". The parent is somebody
       else's, and that is the normal case for a note — it is a comment on their work. */
    expect(strictly(can, alice, "write", NOTE_ON_A_PUBLIC_STRANGER)).toBe(true);
    expect(strictly(can, alice, "delete", NOTE_ON_A_PUBLIC_STRANGER)).toBe(true);
  });

  it("does not let the parent's owner edit or delete somebody else's note", async () => {
    const can = await canFn();
    /* B-18 names two subjects for a note and the blueprint's owner is neither: "An author
       may edit and delete their own notes; the operator may remove any." Owning the wall
       is not owning what was written on it. */
    expect(
      strictly(can, bertrand, "write", NOTE_ON_A_PUBLIC_STRANGER),
      "the blueprint's owner edited a note somebody else wrote",
    ).toBe(false);
    expect(
      strictly(can, bertrand, "delete", NOTE_ON_A_PUBLIC_STRANGER),
      "the blueprint's owner deleted a note somebody else wrote",
    ).toBe(false);
  });

  it("does not let an anonymous caller write or delete any note", async () => {
    const can = await canFn();
    for (const resource of [NOTE_ON_A_PUBLIC_STRANGER, NOTE_ON_A_PRIVATE_STRANGER]) {
      expect(strictly(can, anonymous, "write", resource)).toBe(false);
      expect(strictly(can, anonymous, "delete", resource)).toBe(false);
    }
  });

  it("lets the operator remove any note, on either kind of parent", async () => {
    const can = await canFn();
    expect(strictly(can, operator, "delete", NOTE_ON_A_PUBLIC_STRANGER)).toBe(true);
    expect(strictly(can, operator, "delete", NOTE_ON_A_PRIVATE_STRANGER)).toBe(true);
    expect(strictly(can, operator, "delete", STRANGERS_NOTE_ON_A_PRIVATE_PARENT)).toBe(true);
  });
});

describe("T060 a note whose parent is missing or malformed is not readable", () => {
  it("grants no read when `parent` is absent, null or the wrong type", async () => {
    const can = await canFn();
    /* The shape a caller written against the old union would produce. It has to fail
       closed: this is the one input where "the policy has nothing to check privacy
       against" is literally true, and answering `true` to it is the leak again. */
    const malformed: unknown[] = [
      { kind: "note", authorId: ALICE },
      { kind: "note", authorId: ALICE, parent: null },
      { kind: "note", authorId: ALICE, parent: undefined },
      { kind: "note", authorId: ALICE, parent: {} },
      { kind: "note", authorId: ALICE, parent: "public" },
      { kind: "note", authorId: ALICE, parent: [] },
      { kind: "note", authorId: ALICE, parent: { ownerId: BERTRAND } },
      { kind: "note", authorId: ALICE, parent: { visibility: "public" } },
      { kind: "note", authorId: ALICE, parent: { ownerId: BERTRAND, visibility: "unlisted" } },
      { kind: "note", authorId: ALICE, parent: { ownerId: BERTRAND, visibility: "Public" } },
      { kind: "note", authorId: ALICE, parent: { ownerId: null, visibility: "public" } },
    ];
    for (const resource of malformed) {
      expect(
        granted(can, anonymous, "read", resource),
        `an anonymous read was granted on ${label(resource)}`,
      ).toBe(false);
      expect(
        granted(can, bertrand, "read", resource),
        `a stranger's read was granted on ${label(resource)}`,
      ).toBe(false);
    }
  });

  it("does not read the parent's visibility off the note itself", async () => {
    const can = await canFn();
    /* A note carrying a stray `visibility` of its own. If this is granted, the check is
       looking at the wrong object and a caller can publish a private parent's notes by
       setting a field the union does not have. */
    const smuggled = {
      kind: "note",
      authorId: ALICE,
      visibility: "public",
      ownerId: BERTRAND,
      parent: { ownerId: BERTRAND, visibility: "private" },
    };
    expect(granted(can, anonymous, "read", smuggled)).toBe(false);
    expect(granted(can, alice, "read", smuggled)).toBe(false);
  });
});
