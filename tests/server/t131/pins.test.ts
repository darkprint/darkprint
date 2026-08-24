/* ============================================================
   T131 AC3 — a pin at a target that no longer resolves is ABSENT

   "A pin whose target no longer resolves is absent from the array,
   never present as a null. ... `setPins` accepts at most two."

   D-131-04 divides the work between the two verbs and the division
   is what most of this file is about:

     * `setPins` validates ONLY arity (max 2) and the union's own
       shape. **No write-time resolution and no write-time
       visibility check** (the implementer's A7, ratified).
     * `getProfile` does ALL resolution, per actor.

   ── why the division is a criterion and not an internal detail ──
   The ruling gives its own reason and it is the sharpest instrument
   note in this task: **a write-time guard deletes the reader's
   witnesses.** If `setPins` refused a pin at a target that does not
   resolve, then AC3's deleted-target fixture would be
   unconstructible — you could never get a pin INTO the store whose
   target then goes away, because the store would have refused it at
   the door. The criterion would read as covered and nothing would
   have tested it.

   So this file drives both halves and asserts the seam between
   them: `pinRows()` reads what the STORE holds, `getProfile` reads
   what the ACTOR resolves, and the interesting cells are the ones
   where those two DISAGREE. A suite that could only see the answer
   cannot tell "the pin was dropped from the answer" from "the pin
   was never written", which are opposite verdicts about `setPins`.

   ── the resolution rules, all three ruled at D-131-04 ──
   (1) a blueprint pin's `slug` resolves against the PROFILE
       OWNER'S OWN bundles (C-9 ruled (a)); a pin at another
       handle's blueprint is unresolvable and ABSENT. This was the
       charge: `bundle_owner_slug_key` is unique on `(ownerId,
       slug)` and NOT on `slug` (D-130-14), so a bare slug does not
       address a bundle, and because AC3 makes an unresolvable pin
       absent a wrong reading would have yielded `pinned: []` and
       gone quietly green.
   (2) a node pin `id@version` resolves through the pin index and
       goes ABSENT when no current release pins that version, while
       the row survives (C-10).
   (3) a pin at a target the actor cannot see is ABSENT for that
       actor and RESOLVES for the owner and a genuine operator
       (C-11, D-132-04 C-D extended to `pinned`).

   ── the module is bound LAST in every cell ──
   After the premises and after the planting. An early red masks
   every write below it while being correct about its own subject,
   and a red in 0ms where I/O was expected is a cell that never
   started.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PUBLISHED,
  account,
  anonymous,
  asProfileRecord,
  bind,
  blueprintPin,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  mark,
  nodePin,
  operator,
  pinRows,
  scratchDatabase,
  type AccountFixture,
  type PinnedRef,
  type Scratch,
} from "./contract";

let s: Scratch;

interface Owner {
  account: AccountFixture;
  actor: ReturnType<typeof account>;
}

async function freshOwner(tag: string): Promise<Owner> {
  const a = await insertAccount(s, { handle: mark(`t131-pins-${tag}`).toLowerCase() });
  return { account: a, actor: account(a.id, a.handle) };
}

/** What `getProfile` resolves for one actor. The READER's half of the seam. */
async function pinnedFor(handle: string, actor: unknown): Promise<readonly PinnedRef[]> {
  const getProfile = await bind("getProfile");
  return asProfileRecord(
    await getProfile(s.db, actor, handle),
    `getProfile(db, actor, "${handle}")`,
  ).pinned;
}

/**
 * Run a call that may legitimately reject, and report which it did.
 *
 * `() => unknown` rather than `() => Promise<unknown>`: `bind` answers an `UnknownFn` whose
 * return type is `unknown`, so a thunk wrapping one is `() => unknown`. `await` on an `unknown`
 * is well defined and is what this needs.
 */
async function attempt(run: () => unknown): Promise<"resolved" | "rejected"> {
  try {
    await run();
    return "resolved";
  } catch {
    return "rejected";
  }
}

beforeAll(async () => {
  s = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC3: at most two, and exactly two", () => {
  it("accepts two pins and reports both", async () => {
    /* The saturation half. A `setPins` refusing everything satisfies a criterion written only
       about refusal, so the cap needs its ACCEPTING end asserted as well as its rejecting one.
       Every bound owes both. */
    const o = await freshOwner("two");
    const card = await insertCard(s, {
      id: `${o.account.handle}/two-card`,
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const bundle = await insertBundle(s, { owner: o.account, slug: "two", cards: [card] });

    const setPins = await bind("setPins");
    const returned = asProfileRecord(
      await setPins(s.db, o.actor, o.account.id, [
        blueprintPin(bundle.slug),
        nodePin(card.ref),
      ]),
      "setPins(db, owner, ownerId, [blueprintPin, nodePin])",
    );
    expect(returned.pinned, PUBLISHED.setPins).toHaveLength(2);

    /* `setPins` and `getProfile` are two published readers of one fact, and a record that agrees
       with itself and not with the store is exactly the state neither reader alone can report. */
    expect(await pinnedFor(o.account.handle, o.actor)).toEqual([...returned.pinned]);
  });

  it("refuses a third pin and leaves the store holding two", async () => {
    /* T130's inherited cell could only assert `length <= 2`, because whether a third pin was
       REFUSED or silently dropped was unpublished and both readings share "the account never
       holds three". D-131-04 rules it: `setPins` VALIDATES arity, so the call refuses. The
       tolerance is retired rather than kept — a tolerance kept after its ambiguity is decided is
       an assertion quietly switched off.

       Asserted at the STORE, not at the answer: a `setPins` that wrote three rows and resolved
       only two would satisfy every assertion about `pinned` and have violated the cap. */
    const o = await freshOwner("three");
    const cardA = await insertCard(s, {
      id: `${o.account.handle}/three-a`,
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const cardB = await insertCard(s, {
      id: `${o.account.handle}/three-b`,
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const bundle = await insertBundle(s, { owner: o.account, slug: "three", cards: [cardA] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(bundle.slug), nodePin(cardA.ref)]);

    const outcome = await attempt(() =>
      setPins(s.db, o.actor, o.account.id, [
        blueprintPin(bundle.slug),
        nodePin(cardA.ref),
        nodePin(cardB.ref),
      ]),
    );
    expect(
      outcome,
      `D-131-04: "\`setPins\` validates ONLY arity (max 2) and the union's own shape". Three ` +
        `pins is the arity it validates, so the call refuses rather than truncating — a silent ` +
        `drop would make the caller's third pin disappear with nothing said.`,
    ).toBe("rejected");

    expect(
      await pinRows(s, o.account.id),
      `the store after a refused three-pin write. \`profile_pin\` is UNIQUE on ` +
        `(account_id, position) and the cap is two, so a partial write that landed the first ` +
        `two of three and then refused is indistinguishable at the ANSWER from a clean refusal.`,
    ).toHaveLength(2);
  });

  it("clears the pins when handed an empty list", async () => {
    const o = await freshOwner("clear");
    const bundle = await insertBundle(s, { owner: o.account, slug: "clear", cards: [] });
    const setPins = await bind("setPins");

    await setPins(s.db, o.actor, o.account.id, [blueprintPin(bundle.slug)]);
    expect(await pinnedFor(o.account.handle, o.actor)).toHaveLength(1);

    const cleared = asProfileRecord(
      await setPins(s.db, o.actor, o.account.id, []),
      "setPins(db, owner, ownerId, [])",
    );
    expect(cleared.pinned).toEqual([]);
    expect(await pinnedFor(o.account.handle, o.actor)).toEqual([]);
    expect(
      await pinRows(s, o.account.id),
      "an empty list CLEARS rather than being ignored, and the rows are where that is visible: " +
        "a `setPins([])` that returned an empty array without deleting anything answers the " +
        "same thing this cell would otherwise assert.",
    ).toEqual([]);
  });

  it("replaces rather than accumulating", async () => {
    /* `setPins` takes the whole array, so a second call is a REPLACEMENT. An implementation that
       inserts without clearing reaches three rows here while `pinned` still shows two, and the
       cap assertion above would not see it. */
    const o = await freshOwner("replace");
    const a = await insertBundle(s, { owner: o.account, slug: "replace-a", cards: [] });
    const b = await insertBundle(s, { owner: o.account, slug: "replace-b", cards: [] });
    const c = await insertBundle(s, { owner: o.account, slug: "replace-c", cards: [] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(a.slug), blueprintPin(b.slug)]);
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(c.slug)]);

    expect(await pinnedFor(o.account.handle, o.actor)).toEqual([
      { kind: "blueprint", slug: c.slug },
    ]);
    expect(
      (await pinRows(s, o.account.id)).map((r) => r.ref),
      "the store after a replacing write. Two calls that both INSERT leave three rows behind a " +
        "two-element answer.",
    ).toEqual([c.slug]);
  });
});

describe("AC3: a pin at a deleted target is omitted, not nulled", () => {
  it("shortens the array when the pinned blueprint is deleted, and keeps the row", async () => {
    const o = await freshOwner("gone-bundle");
    const card = await insertCard(s, {
      id: `${o.account.handle}/survivor`,
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const doomed = await insertBundle(s, { owner: o.account, slug: "doomed", cards: [card] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(doomed.slug), nodePin(card.ref)]);
    expect(await pinnedFor(o.account.handle, o.actor)).toHaveLength(2);

    await s.query("delete from release where bundle_id = $1", [doomed.id]);
    await s.query("delete from bundle where id = $1", [doomed.id]);

    const after = await pinnedFor(o.account.handle, o.actor);
    expect(
      after,
      `AC3: "a pin whose target no longer resolves is ABSENT from the array, never present as ` +
        `a null" — the array length CHANGES. \`asProfileRecord\` reds separately on a null ` +
        `element, so a \`(PinnedRef | null)[]\` cannot satisfy this by keeping the length.`,
    ).toEqual([{ kind: "node", ref: card.ref }]);

    /* The other half of the seam, and it is the ruled behaviour rather than an implementation
       detail: `setPins` does no write-time resolution, so the ROW is still there. A module that
       swept unresolvable pins out of the store would pass the assertion above and would have
       deleted the user's pin because a bundle was briefly missing. */
    expect(
      (await pinRows(s, o.account.id)).map((r) => r.ref).sort(),
      "D-131-04: resolution happens in `getProfile`, per actor, and NOT at write time. The pin " +
        "row survives its target; only the ANSWER shortens.",
    ).toEqual([card.ref, doomed.slug].sort());
  });

  it("shortens the array when the pinned card version is deleted", async () => {
    const o = await freshOwner("gone-card");
    const doomed = await insertCard(s, {
      id: `${o.account.handle}/doomed-card`,
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const bundle = await insertBundle(s, { owner: o.account, slug: "kept", cards: [doomed] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(bundle.slug), nodePin(doomed.ref)]);
    expect(await pinnedFor(o.account.handle, o.actor)).toHaveLength(2);

    await s.query("delete from card_version where id = $1", [doomed.rowId]);

    expect(await pinnedFor(o.account.handle, o.actor)).toEqual([
      { kind: "blueprint", slug: bundle.slug },
    ]);
  });

  it("omits a pin at a target that never existed", async () => {
    /* The other end of the same rule, and it is not the same cell: "no longer resolves" covers a
       target that went away, this covers one that was never there. A module resolving pins
       lazily passes the two above and can still echo a ref nothing carries. */
    const o = await freshOwner("never");
    const setPins = await bind("setPins");

    /* Accepted at the door, because `setPins` validates the union's SHAPE and not the target's
       existence — this pin is well-formed and points at nothing. */
    await setPins(s.db, o.actor, o.account.id, [nodePin("no-such-card@9.9.9")]);

    expect(
      await pinnedFor(o.account.handle, o.actor),
      "a pin at nothing is not in the array. `setPins` accepted it (no write-time resolution, " +
        "D-131-04), so this is `getProfile`'s omission and not a refusal at the door.",
    ).toEqual([]);
    expect(
      await pinRows(s, o.account.id),
      "and the row is there, which is what makes the assertion above about RESOLUTION rather " +
        "than about an empty store.",
    ).toHaveLength(1);
  });

  it("goes absent when no current release pins the version, while the card row survives", async () => {
    /* C-10, ruled. A node pin resolves through the PIN INDEX — `loadSnapshot` indexes only the
       versions some current release pins — so a pinned version that no release carries any more
       is unresolvable even though `card_version` still holds it. This is the case that separates
       "the row is gone" from "nothing points at the row", and no cell above reaches it. */
    const o = await freshOwner("unpinned-version");
    const v1 = await insertCard(s, {
      id: `${o.account.handle}/drifting`,
      version: "1.0.0",
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const v2 = await insertCard(s, {
      id: `${o.account.handle}/drifting`,
      version: "2.0.0",
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const bundle = await insertBundle(s, { owner: o.account, slug: "drift", cards: [v1] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [nodePin(v1.ref)]);
    expect(
      await pinnedFor(o.account.handle, o.actor),
      "the premise: while a current release pins 1.0.0, the pin resolves. Without this the " +
        "assertion below is evidence of nothing — an empty array is what a broken fixture gives.",
    ).toEqual([{ kind: "node", ref: v1.ref }]);

    /* Move the release onto 2.0.0. Nothing is deleted: `card_version` still holds 1.0.0. */
    await s.query("update release set card_refs = $1, card_digests = $2 where id = $3", [
      [v2.ref],
      [v2.digest],
      bundle.releaseId,
    ]);

    expect(
      await pinnedFor(o.account.handle, o.actor),
      `C-10, ruled at D-131-04: "a node pin \`id@version\` resolves through the pin index and ` +
        `goes ABSENT when no current release pins that version while the row survives".`,
    ).toEqual([]);

    const [surviving] = await s.query("select id from card_version where id = $1", [v1.rowId]);
    expect(
      surviving?.id,
      "and the row survives. If it had been deleted this cell would be the deleted-target cell " +
        "above wearing a different name, and would prove nothing about the index.",
    ).toBe(v1.rowId);
  });
});

describe("AC3: a blueprint pin's slug is the PROFILE OWNER'S own (C-9, ruled (a))", () => {
  it("resolves the owner's own slug and NOT a stranger's identical one", async () => {
    /* THE CHARGE THIS CELL CARRIES. `PinnedRef`'s blueprint arm has no owner, and
       `bundle_owner_slug_key` is unique on `(ownerId, slug)` and not on `slug` (D-130-14), so a
       bare slug does not address a bundle. Ruled (a): it resolves against the profile owner's
       own bundles.

       Two accounts hold a bundle at the SAME slug, which is exactly the state that unique index
       permits and the reason the ruling was needed. The pinner owns neither reading's answer by
       accident: if the module resolved globally it would answer the stranger's bundle here, and
       under (a) it answers the owner's — and both answers have length 1, so a length assertion
       cannot tell them apart. The identity is what is asserted. */
    const o = await freshOwner("own-slug");
    const stranger = await freshOwner("other-slug");
    const shared = "contested-slug";

    const mine = await insertBundle(s, { owner: o.account, slug: shared, cards: [] });
    const theirs = await insertBundle(s, { owner: stranger.account, slug: shared, cards: [] });
    expect(
      mine.id === theirs.id,
      "the premise: two DIFFERENT bundle rows at one slug. `bundle_owner_slug_key` is per " +
        "owner, so this is storable — and if it were not, this cell would be measuring nothing.",
    ).toBe(false);

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(shared)]);

    expect(
      await pinnedFor(o.account.handle, o.actor),
      "the pin is the owner's own bundle at that slug (D-131-04, C-9 ruled (a)).",
    ).toEqual([{ kind: "blueprint", slug: shared }]);
  });

  it("goes absent when the owner's own bundle at that slug is deleted and a stranger's survives", async () => {
    /* THE SECOND WITNESS, authorized at D-131-09(1), written on that authority and not on mine.

       Mapping M1 against my own cells before the sweep showed the discriminating pair was not
       one: `PinnedRef`'s blueprint arm carries only `slug`, so the POSITIVE cell answers
       `{ kind: "blueprint", slug }` under owner-scoping and under a global find alike — the
       union cannot express WHICH bundle matched, and presence/absence is the only observable.
       C-9's protection therefore rested on the single absence cell below, one of 83.

       This is a second absence of a DIFFERENT SHAPE. Above, the owner never held the slug; here
       the owner held it, the pin resolved, and then the owner's bundle went away while the
       stranger's identically-slugged one stayed. Owner-scoped resolution loses the pin. A global
       find keeps answering, because a bundle at that slug still exists — it is simply somebody
       else's. The two cells fail together only under a mutation that breaks resolution outright,
       and separately under the reading C-9 refused. */
    const o = await freshOwner("deleted-own-slug");
    const stranger = await freshOwner("surviving-slug");
    const slug = "outlives-its-owner";

    const mine = await insertBundle(s, { owner: o.account, slug, cards: [] });
    await insertBundle(s, { owner: stranger.account, slug, cards: [] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(slug)]);
    expect(
      await pinnedFor(o.account.handle, o.actor),
      "the premise: while the owner holds the slug the pin resolves. Without this the absence " +
        "below is evidence of nothing.",
    ).toEqual([{ kind: "blueprint", slug }]);

    await s.query("delete from release where bundle_id = $1", [mine.id]);
    await s.query("delete from bundle where id = $1", [mine.id]);

    const [survivor] = await s.query(
      "select count(*)::int as n from bundle where slug = $1",
      [slug],
    );
    expect(
      Number(survivor?.n),
      "the second premise, and the one that makes this cell different from the deleted-target " +
        "cell above: a bundle at this slug STILL EXISTS. If the stranger's had gone too, this " +
        "would be an ordinary deleted-target absence and would not discriminate at all.",
    ).toBe(1);

    expect(
      await pinnedFor(o.account.handle, o.actor),
      "C-9 ruled (a): the slug resolves against the PROFILE OWNER'S OWN bundles. A global find " +
        "answers the stranger's surviving bundle here and this array is not empty.",
    ).toEqual([]);
  });

  it("goes absent when only a stranger holds the slug", async () => {
    /* The discriminating half, and the one a global-lookup implementation fails. Above, both
       readings answer a one-element array; here reading (a) answers `[]` and a global lookup
       answers the stranger's bundle. Without this cell the pair is not a measurement. */
    const o = await freshOwner("no-slug");
    const stranger = await freshOwner("holds-slug");
    const slug = "only-theirs";
    await insertBundle(s, { owner: stranger.account, slug, cards: [] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(slug)]);

    expect(
      await pinnedFor(o.account.handle, o.actor),
      `C-9 ruled (a): "a blueprint pin's \`slug\` resolves against the PROFILE OWNER'S OWN ` +
        `bundles ... a pin at another handle's blueprint is therefore unresolvable and ABSENT". ` +
        `A global \`allBlueprints().find(b => b.slug === pin.slug)\` — which is what ` +
        `\`components/profile/load.ts\` does — answers the stranger's bundle here.`,
    ).toEqual([]);
    expect(
      await pinRows(s, o.account.id),
      "the row is written all the same: `setPins` does no write-time resolution, so this is an " +
        "absence in the ANSWER and the pin comes back if the owner later publishes that slug.",
    ).toHaveLength(1);
  });
});

describe("B-03: a pin does not disclose a private target to a visitor (C-11)", () => {
  it("omits the owner's private blueprint for a visitor and resolves it for the owner", async () => {
    /* C-11, ruled at D-131-04 by extending D-132-04 C-D to `pinned`: absent for callers who
       cannot see the target, resolves for the owner and a genuine operator. `pinned` is the only
       member of `ProfileRecord` that can carry an archive identifier, so it is the only door
       this leak has.

       Two factors, because a visitor's empty array is also what a broken pin produces: the
       owner's own read must resolve it. */
    const o = await freshOwner("private-pin");
    const visitor = await freshOwner("private-visitor");
    const sealedSlug = "sealed-pin-target";
    await insertBundle(s, {
      owner: o.account,
      slug: sealedSlug,
      cards: [],
      visibility: "private",
    });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(sealedSlug)]);

    expect(
      await pinnedFor(o.account.handle, o.actor),
      "the owner's own private pin has to resolve, or the visitor's empty array is evidence of " +
        "nothing.",
    ).toEqual([{ kind: "blueprint", slug: sealedSlug }]);

    for (const [who, actor] of [
      ["a signed-in visitor", visitor.actor],
      ["an anonymous reader", anonymous],
    ] as const) {
      const seen = await pinnedFor(o.account.handle, actor);
      expect(
        seen.filter((p) => p.kind === "blueprint" && p.slug === sealedSlug),
        `${who} may not learn that \`${sealedSlug}\` exists. B-03: a private resource the ` +
          `caller may not see does not leak its existence, and a pin is a string the caller ` +
          `did not supply.`,
      ).toEqual([]);
      expect(seen, `${who} sees the pin omitted, not nulled`).toEqual([]);
    }
  });

  it("resolves a private pin for a genuine operator", async () => {
    /* D-131-07's own sentence — "an operator passes every write T060 grants ... the refusal
       sentences' 'owner' wording is the common case, not policy" — read on the READ side, where
       C-11 names the operator explicitly beside the owner. Written because the two cells above
       assert an absence, and an implementation that answered `[]` for EVERY non-owner would
       satisfy both while breaking this. */
    const o = await freshOwner("op-pin");
    const op = await freshOwner("op-reader");
    const slug = "operator-visible";
    await insertBundle(s, { owner: o.account, slug, cards: [], visibility: "private" });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(slug)]);

    expect(
      await pinnedFor(o.account.handle, operator(op.account.id)),
      "C-11: absent for callers who cannot see the target, RESOLVES for the owner and a " +
        "genuine operator (D-132-04 C-D, extended to `pinned` at D-131-04).",
    ).toEqual([{ kind: "blueprint", slug }]);
  });
});

describe("only the account's own owner rewrites its pins", () => {
  it("a stranger's `setPins` leaves the target's pins as they were", async () => {
    /* B-13: the only subjects are the owner of a resource and a break-glass operator. D-131-07
       rules the ROUTE's refusal (404, never 403); what the MODULE does with a stranger's
       `accountId` is not spelled, so nothing here pins a class, a status or a message — only
       that the store did not move.

       Two factors, because "the pins did not change" is also what a `setPins` that does nothing
       at all produces: the same call by the OWNER must change them. */
    const o = await freshOwner("owner-write");
    const stranger = await freshOwner("stranger-write");
    const a = await insertBundle(s, { owner: o.account, slug: "mine-a", cards: [] });
    const b = await insertBundle(s, { owner: o.account, slug: "mine-b", cards: [] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(a.slug)]);
    const before = await pinnedFor(o.account.handle, o.actor);
    expect(before).toHaveLength(1);

    const outcome = await attempt(() =>
      setPins(s.db, stranger.actor, o.account.id, [blueprintPin(b.slug)]),
    );
    expect(
      await pinnedFor(o.account.handle, o.actor),
      `a stranger's \`setPins\` against somebody else's \`accountId\` ${outcome}, and the ` +
        `target's pins are what B-13 protects. ${PUBLISHED.setPins}`,
    ).toEqual([...before]);

    /* The control: the identical call by the owner does move them, so the assertion above is not
       satisfied by a `setPins` that never writes. */
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(b.slug)]);
    const after = await pinnedFor(o.account.handle, o.actor);
    expect(after).toEqual([{ kind: "blueprint", slug: b.slug }]);
    expect(after).not.toEqual([...before]);
  });

  it("an anonymous `setPins` moves nothing", async () => {
    const o = await freshOwner("anon-write");
    const a = await insertBundle(s, { owner: o.account, slug: "anon-a", cards: [] });
    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(a.slug)]);

    const outcome = await attempt(() => setPins(s.db, anonymous, o.account.id, []));
    expect(
      await pinRows(s, o.account.id),
      `an anonymous \`setPins\` ${outcome}; there is no account behind the caller, so the ` +
        `store cannot have moved. Read at the ROWS because the emptying this cell guards ` +
        `against would leave the answer empty either way.`,
    ).toHaveLength(1);
  });
});
