/* ============================================================
   T130 AC3 — a pin at a target that no longer resolves is ABSENT

   "A pin whose target no longer resolves is absent from the array,
   never present as a null. So `pinned` is `readonly string[]` and
   never `(string | null)[]`, and the test asserts the array length
   changes rather than that an element is null. `setPins` accepts
   at most two."

   ── the spelling of a pin is DISCOVERED, not chosen ──
   `setPins(..., pins: readonly string[])` is published and what one
   of those strings looks like is not. The Contract line says "a
   blueprint or a card ref"; `docs/architecture/seams.md` SEAM-55
   publishes `{ pinned: PinnedRef[] }` — tagged objects, not strings
   — for the same surface; nothing says whether a blueprint pin
   carries its owner or whether a card pin carries its version.

   Guessing is worse here than in the ordinary case, and the
   direction is why. AC3 makes an unresolvable pin ABSENT, so a
   wrong guess yields `pinned: []` — and then every cell below
   passes over an empty array while asserting nothing at all. A
   wrong guess reds nothing; it goes quietly green.

   So the spelling is asked of the module: each candidate is driven
   through `setPins` and read back through `getProfile`, and the one
   that survives is used for the rest of the file. `pinSpellingFor`
   reds — naming the contract gap — when none survives.

   ── and the floor is its own cell, because that is what stops the
      rest of this file going vacuous ──
   "a blueprint pin spelling exists" and "a card pin spelling
   exists" are asserted as tests rather than assumed by the helper.
   A suite whose AC3 cells all passed over `[]` reports coverage of
   nothing, which is this run's most-charged defect; these two are
   the assertions that make the phrase "every AC3 cell passed"
   mean something.

   ── what is reported rather than pinned ──
   Whether a third pin is REFUSED or silently dropped is not
   published. Both readings share "the account never holds three",
   and that is what is asserted, at both ends of the bound —
   exactly two must be ACCEPTED, or a `setPins` that refuses
   everything satisfies a criterion written only about refusal.
   If the refusal is ruled, this tightens by one line and the
   tolerance is flagged here so it does not outlive the ambiguity.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  account,
  asProfileRecord,
  assertTellsCannotOverMatch,
  bind,
  blueprintPinSpellings,
  cardPinSpellings,
  collectStrings,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  mark,
  pinSpellingFor,
  scratchDatabase,
  type AccountFixture,
  type BundleFixture,
  type CardFixture,
  type PinSpelling,
  type Scratch,
} from "./contract";

let s: Scratch;

/**
 * Discovered once, in `beforeAll`, against a handle nothing else in this file touches.
 *
 * The failure is CAUGHT and re-thrown per test rather than allowed to escape the hook, and
 * that is deliberate: a `beforeAll` that throws runs no test, so vitest prints the file's
 * cells as SKIPPED and adds nothing to the failed column — `Tests 75 failed | 3 passed |
 * 7 skipped` is this repository's own recorded instance. Against `backend`, where the module
 * is absent, the discovery cannot succeed; carried in the hook it would hide ten criteria
 * behind one skipped file, which is the opposite of the per-criterion red a handback owes.
 */
let discovered: { blueprint: PinSpelling; card: PinSpelling } | undefined;
let discoveryFailure: unknown;

function spellings(): { blueprint: PinSpelling; card: PinSpelling } {
  if (discoveryFailure !== undefined) throw discoveryFailure;
  if (discovered === undefined) {
    throw new Error("the pin-spelling discovery did not run; `beforeAll` never completed.");
  }
  return discovered;
}

interface Owner {
  account: AccountFixture;
  actor: ReturnType<typeof account>;
}

async function freshOwner(tag: string): Promise<Owner> {
  const a = await insertAccount(s, { handle: mark(`t130-pins-${tag}`).toLowerCase() });
  return { account: a, actor: account(a.id, a.handle) };
}

/** The same spelling the discovery settled on, built for a different target. */
function blueprintPin(b: BundleFixture): string {
  return blueprintPinSpellings(b)[spellings().blueprint.index]!;
}

function cardPin(c: CardFixture): string {
  return cardPinSpellings(c)[spellings().card.index]!;
}

async function pinnedFor(handle: string, actor: unknown): Promise<readonly string[]> {
  const getProfile = await bind("getProfile");
  return asProfileRecord(
    await getProfile(s.db, actor, handle),
    `getProfile(db, actor, "${handle}")`,
  ).pinned;
}

/**
 * Run a call that may legitimately reject, and report which it did.
 *
 * `() => unknown` rather than `() => Promise<unknown>`: `bind` answers an `UnknownFn`, whose
 * return type is `unknown`, so a thunk wrapping one is `() => unknown` and the narrower
 * parameter reported three `TS2322`s that had nothing to do with the absent module. `await`
 * on an `unknown` is well defined and is what this needs.
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

  const probe = await freshOwner("probe");
  const card = await insertCard(s, {
    id: `${probe.account.handle}/probe-card`,
    ownerId: probe.account.id,
    authorHandle: probe.account.handle,
  });
  const bundle = await insertBundle(s, {
    owner: probe.account,
    slug: "probe-bundle",
    cards: [card],
  });

  try {
    const blueprint = await pinSpellingFor(
      s,
      probe.actor,
      probe.account.id,
      probe.account.handle,
      blueprintPinSpellings(bundle),
      "blueprint",
    );
    const cardKind = await pinSpellingFor(
      s,
      probe.actor,
      probe.account.id,
      probe.account.handle,
      cardPinSpellings(card),
      "card",
    );
    discovered = { blueprint, card: cardKind };
  } catch (failure) {
    discoveryFailure = failure;
  }
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("the floor: a pin of each kind resolves at all", () => {
  /* These two are what keep every cell below from passing over an empty array. Without them
     "all AC3 cells green" and "no pin the suite sent was ever recognised" are the same run. */

  it("a blueprint pin survives a `setPins` round trip", () => {
    const echoed = spellings().blueprint.echoed;
    expect(typeof echoed).toBe("string");
    expect(echoed).not.toBe("");
  });

  it("a card pin survives a `setPins` round trip", () => {
    const echoed = spellings().card.echoed;
    expect(typeof echoed).toBe("string");
    expect(echoed).not.toBe("");
  });
});

describe("AC3: at most two, and exactly two", () => {
  it("accepts two pins and reports both", async () => {
    /* The saturation half. A `setPins` refusing everything satisfies a criterion written only
       about refusal, so the cap needs its accepting end asserted as well as its rejecting one
       — every bound owes both. */
    const o = await freshOwner("two");
    const card = await insertCard(s, {
      id: `${o.account.handle}/two-card`,
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const bundle = await insertBundle(s, { owner: o.account, slug: "two", cards: [card] });

    const setPins = await bind("setPins");
    const returned = asProfileRecord(
      await setPins(s.db, o.actor, o.account.id, [blueprintPin(bundle), cardPin(card)]),
      "setPins(db, owner, ownerId, [blueprintPin, cardPin])",
    );
    expect(returned.pinned).toHaveLength(2);

    /* `setPins` and `getProfile` are two published readers of one fact, and a record that
       agrees with itself and not with the store is exactly the state neither reader alone can
       report. */
    expect(await pinnedFor(o.account.handle, o.actor)).toEqual([...returned.pinned]);
  });

  it("never leaves the account holding three", async () => {
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
    const outcome = await attempt(() =>
      setPins(s.db, o.actor, o.account.id, [blueprintPin(bundle), cardPin(cardA), cardPin(cardB)]),
    );

    const pinned = await pinnedFor(o.account.handle, o.actor);
    expect(
      pinned.length,
      `AC3: "\`setPins\` accepts at most two". The call ${outcome}; whether a third pin is ` +
        `REFUSED or silently dropped is not published, and this cell asserts only what both ` +
        `readings share. Tighten it the day that is ruled — a tolerance kept after its ` +
        `ambiguity is decided is an assertion quietly switched off.`,
    ).toBeLessThanOrEqual(2);
  });

  it("clears the pins when handed an empty list", async () => {
    const o = await freshOwner("clear");
    const bundle = await insertBundle(s, { owner: o.account, slug: "clear", cards: [] });
    const setPins = await bind("setPins");

    await setPins(s.db, o.actor, o.account.id, [blueprintPin(bundle)]);
    expect(await pinnedFor(o.account.handle, o.actor)).toHaveLength(1);

    const cleared = asProfileRecord(
      await setPins(s.db, o.actor, o.account.id, []),
      "setPins(db, owner, ownerId, [])",
    );
    expect(cleared.pinned).toEqual([]);
    expect(await pinnedFor(o.account.handle, o.actor)).toEqual([]);
  });
});

describe("AC3: a pin at a deleted target is omitted, not nulled", () => {
  it("shortens the array when the pinned blueprint is deleted", async () => {
    const o = await freshOwner("gone-bundle");
    const card = await insertCard(s, {
      id: `${o.account.handle}/survivor`,
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const doomed = await insertBundle(s, { owner: o.account, slug: "doomed", cards: [card] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(doomed), cardPin(card)]);
    expect(await pinnedFor(o.account.handle, o.actor)).toHaveLength(2);

    await s.query("delete from release where bundle_id = $1", [doomed.id]);
    await s.query("delete from bundle where id = $1", [doomed.id]);

    const after = await pinnedFor(o.account.handle, o.actor);
    expect(
      after,
      `AC3: "a pin whose target no longer resolves is ABSENT from the array, never present ` +
        `as a null" — the array length changes. \`asProfileRecord\` reds separately on a null ` +
        `element, so a \`(string | null)[]\` cannot satisfy this by keeping the length.`,
    ).toHaveLength(1);
  });

  it("shortens the array when the pinned card is deleted", async () => {
    const o = await freshOwner("gone-card");
    const doomed = await insertCard(s, {
      id: `${o.account.handle}/doomed-card`,
      ownerId: o.account.id,
      authorHandle: o.account.handle,
    });
    const bundle = await insertBundle(s, { owner: o.account, slug: "kept", cards: [] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(bundle), cardPin(doomed)]);
    expect(await pinnedFor(o.account.handle, o.actor)).toHaveLength(2);

    await s.query("delete from card_version where id = $1", [doomed.rowId]);

    expect(await pinnedFor(o.account.handle, o.actor)).toHaveLength(1);
  });

  it("omits a pin at a target that never existed", async () => {
    /* The other end of the same rule, and it is not the same cell: "no longer resolves"
       covers a target that went away, this covers one that was never there. A module
       resolving pins lazily passes the two above and can still echo a nonsense string. */
    const o = await freshOwner("never");
    const setPins = await bind("setPins");
    const outcome = await attempt(() =>
      setPins(s.db, o.actor, o.account.id, [`${o.account.handle}/no-such-thing-anywhere`]),
    );
    expect(
      await pinnedFor(o.account.handle, o.actor),
      `the call ${outcome}. Either way the array is what AC3 constrains, and a pin at nothing ` +
        `is not in it.`,
    ).toEqual([]);
  });
});

describe("only the account's own owner rewrites its pins", () => {
  it("a stranger's `setPins` leaves the target's pins as they were", async () => {
    /* DERIVED and labelled. `setPins` takes an `Actor` AND an `accountId`, which is T050's
       shape for every write it publishes, and B-13 says the only subjects are the owner of a
       resource and a break-glass operator. What T130 does NOT publish is how it refuses, so
       nothing here pins a class, a status or a message — only that the store did not move.

       Two factors, because "the pins did not change" is also what a `setPins` that does
       nothing at all produces: the same call by the OWNER must change them. */
    const o = await freshOwner("owner");
    const stranger = await freshOwner("stranger");
    const bundleA = await insertBundle(s, { owner: o.account, slug: "mine-a", cards: [] });
    const bundleB = await insertBundle(s, { owner: o.account, slug: "mine-b", cards: [] });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(bundleA)]);
    const before = await pinnedFor(o.account.handle, o.actor);
    expect(before).toHaveLength(1);

    const outcome = await attempt(() =>
      setPins(s.db, stranger.actor, o.account.id, [blueprintPin(bundleB)]),
    );
    expect(
      await pinnedFor(o.account.handle, o.actor),
      `a stranger's \`setPins\` against somebody else's \`accountId\` ${outcome}, and the ` +
        `target's pins are what B-13 protects.`,
    ).toEqual([...before]);

    /* The control: the identical call by the owner does move them, so the assertion above is
       not satisfied by a `setPins` that never writes. */
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(bundleB)]);
    const after = await pinnedFor(o.account.handle, o.actor);
    expect(after).toHaveLength(1);
    expect(after).not.toEqual([...before]);
  });
});

describe("B-03: a pin does not disclose a private target to a visitor", () => {
  it("omits the owner's private blueprint from a visitor's `pinned`", async () => {
    /* DERIVED from B-03 — "a private resource the caller may not see returns 404, never 403,
       so existence does not leak" — and from T080's "no account sees another account's
       private content", not from anything T130 publishes. `pinned` is the ONLY member of
       `ProfileRecord` that can carry an archive identifier, so it is the only door this leak
       has, and the rule that closes it is the same one AC3 already states for a pin that does
       not resolve: for that actor, it does not.

       Labelled so it can be struck by a ruling rather than argued about. */
    const o = await freshOwner("private-pin");
    const visitor = await freshOwner("private-pin-visitor");
    const sealedSlug = "sealed-pin-target";
    const sealed = await insertBundle(s, {
      owner: o.account,
      slug: sealedSlug,
      cards: [],
      visibility: "private",
    });

    const setPins = await bind("setPins");
    await setPins(s.db, o.actor, o.account.id, [blueprintPin(sealed)]);

    const ownerPinned = await pinnedFor(o.account.handle, o.actor);
    /* The two-factor half, and it is the one that stops this being a guard that cannot fail:
       if the owner's own pin did not resolve either, the visitor's empty array says nothing
       about privacy. */
    expect(
      ownerPinned,
      "the owner's own private pin has to resolve, or the visitor's empty array is evidence " +
        "of nothing",
    ).toHaveLength(1);

    assertTellsCannotOverMatch([sealedSlug], [
      { handle: o.account.handle, visitorHandle: visitor.account.handle },
    ]);

    const visitorPinned = await pinnedFor(o.account.handle, visitor.actor);
    const leaked = collectStrings(visitorPinned).filter((v) => v.includes(sealedSlug));
    expect(leaked, "B-03: existence does not leak").toEqual([]);
  });
});
