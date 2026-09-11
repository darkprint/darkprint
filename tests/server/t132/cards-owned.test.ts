/* ============================================================
   T132 / D-132-03 — `cardsOwnedBy`, the fourteenth reader

   "cardsOwnedBy(db: Db, actor: Actor, ownerHandle: string):
   Promise<readonly CardSummary[]>" — serving `counts.cards` as
   `.length`, derived never stored.

   ── the reading this file is built to discriminate ──
   D-132-02 C-1 chose reading (a): "`counts.cards` is cards this
   handle OWNS and the actor may see", and a `card_version` reader
   NOT narrowed by the pin index. The decisive argument was a
   fixture: the archived T130 cell asserts a count that falls when
   an UNPINNED card row is deleted.

   Two readings differ by exactly two rows and nothing else, so
   both are seeded and both are asserted:

     owned, pinned by nothing   the index does not carry it and
                                ownership does — reading (a)
                                returns it, the index reading does
                                not
     pinned by this handle's
     blueprint, owned by
     someone else               the index carries it for this
                                handle and ownership does not —
                                reading (a) leaves it out

   A fixture where the two agreed would hide the question the
   ruling is about, which is the archived cell's own wording.

   ── `usedIn: []` is legal here and that is a ruling ──
   D-132-03: the "`usedIn: []` is impossible" assertion is SCOPED
   TO THE INDEX — `records.test.ts:820` and `build-parity.test.ts:210`
   build from `cards()`, the pin-narrowed reader, and those are the
   only two sites. A reader outside the index does not red it, and
   a card nothing pins has an empty `usedIn` by construction.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type AccountFixture,
  type CardFixture,
  FixtureGate,
  account,
  anonymous,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  mark,
  operator,
  query,
  scratchDatabase,
} from "./contract";
import { asCardSummary, keyOf as keyOfUse } from "../t080/contract";
import { asProfileRecord, bind as bindProfile } from "../t130/contract";

const gate = new FixtureGate();
let s: ReturnType<FixtureGate["get"]>;

interface Side {
  owner: AccountFixture;
  stranger: AccountFixture;
  /** Owned by `owner`, pinned by a blueprint. */
  pinned: CardFixture;
  /** Owned by `owner`, pinned by NOTHING. The row reading (a) keeps and the index drops. */
  unpinned: CardFixture;
  /** Owned by `stranger`, pinned by `owner`'s blueprint. The row the index keeps for the
      wrong handle and ownership drops. */
  borrowed: CardFixture;
  /** Owned by `owner`, private. */
  sealed: CardFixture;
}

let f: Side;

beforeAll(async () => {
  await gate.build(async () => {
    s = await scratchDatabase("cards-owned");
    const owner = await insertAccount(s, mark("t132-owned").toLowerCase());
    const stranger = await insertAccount(s, mark("t132-owned-other").toLowerCase());

    const pinned = await insertCard(s, { id: `${owner.handle}/pinned-card`, ownerId: owner.id });
    const unpinned = await insertCard(s, { id: `${owner.handle}/unpinned-card`, ownerId: owner.id });
    const borrowed = await insertCard(s, { id: `${stranger.handle}/borrowed-card`, ownerId: stranger.id });
    const sealed = await insertCard(s, {
      id: `${owner.handle}/sealed-card`,
      ownerId: owner.id,
      visibility: "private",
    });

    /* One blueprint of the owner's, pinning one card they own and one they do not. */
    await insertBundle(s, { owner, slug: "owned-blueprint", cards: [pinned, borrowed] });
    f = { owner, stranger, pinned, unpinned, borrowed, sealed };
    return s;
  });
}, 120000);

afterAll(async () => {
  await dropScratchDatabases();
});

/** Bound LAST, after the fixture gate: an early bind masks every planting below it. */
async function cardsOwnedBy(actor: unknown, handle: string): Promise<Record<string, unknown>[]> {
  const db = gate.get().db;
  const fn = await bind("cardsOwnedBy");
  const answered = await fn(db, actor, handle);
  if (!Array.isArray(answered)) {
    throw new Error(
      `cardsOwnedBy(db, actor, "${handle}") returned a non-array; D-132-03 publishes ` +
        `\`Promise<readonly CardSummary[]>\`, and \`counts.cards\` is its \`.length\`.`,
    );
  }
  return answered as Record<string, unknown>[];
}

function ids(rows: readonly unknown[]): string[] {
  return rows.map((row, i) => asCardSummary(row, `cardsOwnedBy()[${i}]`).id).sort();
}

/* --------------------- the fixture --------------------- */

describe("the fixture this file's readings rest on", () => {
  /**
   * A guard on THIS SUITE, green with nothing built. The whole file turns on two rows being
   * in states that differ between the two readings, and in the blind position every cell reds
   * on the absent member whether or not those rows exist.
   */
  it("seeded one owned-and-unpinned row and one pinned-but-not-owned row", async () => {
    const s = gate.get();
    const [unpinned] = await query(
      s,
      "select count(*)::int as n from release where $1 = any(card_refs)",
      [f.unpinned.ref],
    );
    expect(
      unpinned?.n,
      `\`${f.unpinned.ref}\` must be pinned by nothing: it is the row where "cards this handle ` +
        `owns" and "cards the index carries for this handle" disagree.`,
    ).toBe(0);
    const [borrowed] = await query(
      s,
      "select count(*)::int as n from release where $1 = any(card_refs)",
      [f.borrowed.ref],
    );
    expect(borrowed?.n, `\`${f.borrowed.ref}\` must be pinned by the owner's blueprint`).toBe(1);
    const [own] = await query(s, "select owner_id from card_version where id = $1", [f.borrowed.rowId]);
    expect(own?.owner_id, "and it must be owned by the stranger, not by the handle asked for").toBe(
      f.stranger.id,
    );
  });
});

/* --------------------- reading (a): ownership --------------------- */

describe("D-132-02 C-1: cards this handle OWNS, not cards its blueprints pin", () => {
  it("returns a card this handle owns that no blueprint pins", async () => {
    const rows = await cardsOwnedBy(anonymous, f.owner.handle);
    expect(
      ids(rows),
      `Reading (a), and the argument that chose it: "the archived T130 cell asserts a count ` +
        `that falls when an UNPINNED card row is deleted, the frontend counts ownership, and ` +
        `(a) is the only reading where the number cannot be quietly short". A reader built on ` +
        `\`cards()\` — the pin-narrowed index — is short by exactly this row.`,
    ).toContain(f.unpinned.cardId);
  });

  it("leaves out a card this handle's blueprint pins but does not own", async () => {
    const rows = await cardsOwnedBy(anonymous, f.owner.handle);
    expect(
      ids(rows),
      `\`${f.borrowed.ref}\` is pinned by \`${f.owner.handle}\`'s blueprint and owned by ` +
        `\`${f.stranger.handle}\`. The index carries it FOR this handle; ownership does not. ` +
        `This is the other half of the pair — without it, a reader built on the index passes ` +
        `the cell above by accident whenever every pinned card happens to be owned locally.`,
    ).not.toContain(f.borrowed.cardId);
  });

  it("returns it to its own owner instead", async () => {
    const rows = await cardsOwnedBy(anonymous, f.stranger.handle);
    expect(ids(rows)).toEqual([f.borrowed.cardId]);
  });

  it("answers an empty array for a handle nobody holds", async () => {
    const rows = await cardsOwnedBy(anonymous, "no-account-holds-this-handle");
    expect(
      rows,
      `D-132-03 publishes \`Promise<readonly CardSummary[]>\` with no \`| undefined\`, so the ` +
        `empty answer is the only one the signature admits — and \`counts.cards\` is ` +
        `\`.length\`, which needs a list rather than a refusal.`,
    ).toEqual([]);
  });

  it("publishes CardSummary, checked member by member", async () => {
    const rows = await cardsOwnedBy(anonymous, f.owner.handle);
    expect(rows.length).toBeGreaterThan(0);
    for (const [i, row] of rows.entries()) asCardSummary(row, `cardsOwnedBy()[${i}]`);
  });

  /**
   * D-132-03, quoted because it is the ruling that made this reader safe to add: the
   * "`usedIn: []` is impossible" assertion is scoped to the INDEX, and its only two sites
   * build from `cards()`. A card nothing pins has an empty `usedIn` here by construction, and
   * a reader that suppressed such rows to keep the invariant would be back to reading (b).
   */
  it("gives an unpinned card an empty `usedIn`, which is legal outside the index", async () => {
    const rows = await cardsOwnedBy(anonymous, f.owner.handle);
    const found = rows
      .map((row, i) => asCardSummary(row, `cardsOwnedBy()[${i}]`))
      .find((card) => card.id === f.unpinned.cardId);
    expect(found, "the unpinned row is the subject of this cell").toBeDefined();
    expect(
      found?.usedIn,
      `D-132-03: that invariant is SCOPED TO THE INDEX (\`records.test.ts:820\` and ` +
        `\`build-parity.test.ts:210\`, the only two sites, both built from \`cards()\`), "so a ` +
        `reader outside the index does not red it".`,
    ).toEqual([]);
  });

  it("still names the blueprints that pin a card it does carry", async () => {
    const rows = await cardsOwnedBy(anonymous, f.owner.handle);
    const found = rows
      .map((row, i) => asCardSummary(row, `cardsOwnedBy()[${i}]`))
      .find((card) => card.id === f.pinned.cardId);
    expect(found, "the pinned row is the subject of this cell").toBeDefined();
    expect(
      found?.usedIn.map(keyOfUse),
      `\`usedIn\` is a member of \`CardSummary\` and the record is the same one T080 ` +
        `publishes. "Empty is legal here" is not "empty always": a card two blueprints pin ` +
        `still says so, or the reader is returning a different record under the same name.`,
    ).toEqual([`${f.owner.handle}/owned-blueprint`]);
  });

  /**
   * DERIVED from the ruling's own words rather than from a clause about versions, and
   * flagged so it can be struck by one line: D-132-03 says "the query is its own
   * `card_version ⋈ account` filtered through `snapshot.ts`'s existing `readable()`".
   * `card_version` is the per-VERSION table — T080's `cards()` returns 57 rows over 53 ids on
   * the shipped archive, and `latestCards()` is the reader that collapses them — so two
   * versions of one id are two rows here and `counts.cards` counts two.
   */
  it("counts a second version of one card id as a second row", async () => {
    const s = gate.get();
    const owner = await insertAccount(s, mark("t132-owned-versions").toLowerCase());
    await insertCard(s, { id: `${owner.handle}/twice`, ownerId: owner.id, version: "1.0.0" });
    await insertCard(s, { id: `${owner.handle}/twice`, ownerId: owner.id, version: "1.1.0" });
    const rows = await cardsOwnedBy(anonymous, owner.handle);
    expect(
      rows.map((row, i) => asCardSummary(row, `cardsOwnedBy()[${i}]`).ref).sort(),
      `Derived from D-132-03's "its own \`card_version ⋈ account\`". If \`counts.cards\` is ` +
        `meant to count distinct card IDS the join is over \`latestCards\` instead and this ` +
        `cell is the one line to strike.`,
    ).toEqual([`${owner.handle}/twice@1.0.0`, `${owner.handle}/twice@1.1.0`]);
  });
});

/* --------------------- visibility, through the shared predicate --------------------- */

describe("D-132-04 C-C: cross-account blind, owner and operator widened", () => {
  it("hides a private card from an anonymous caller and a signed-in stranger", async () => {
    const anon = ids(await cardsOwnedBy(anonymous, f.owner.handle));
    const stranger = ids(await cardsOwnedBy(account(f.stranger.id, f.stranger.handle), f.owner.handle));
    expect(
      anon,
      `\`readable()\` is \`visibleTo(actor, ownerId) === "all" || visibility === "public"\`, ` +
        `and D-132-03 requires this reader to consume that predicate rather than copy it.`,
    ).not.toContain(f.sealed.cardId);
    expect(stranger).not.toContain(f.sealed.cardId);
    expect(
      anon,
      `T060's three read contexts collapse to two answers, the owner's and everybody else's. A ` +
        `reader that widened for "signed in" rather than for "the owner" passes the first half ` +
        `of this cell and fails here.`,
    ).toEqual(stranger);
  });

  it("shows an owner their own private card", async () => {
    const rows = ids(await cardsOwnedBy(account(f.owner.id, f.owner.handle), f.owner.handle));
    expect(
      rows,
      `D-132-04 C-C settled this by consequence: T130's AC2 requires an owner's card count to ` +
        `include their private rows, and \`counts.cards\` is this reader's \`.length\`. An ` +
        `owner blind to their own private cards makes the criterion unimplementable — which ` +
        `also means a reader that filters unconditionally looks SAFER than the correct one ` +
        `while quietly breaking the task this reader was created for.`,
    ).toContain(f.sealed.cardId);
  });

  it("shows a break-glass operator the same as the owner", async () => {
    const asOperator = ids(await cardsOwnedBy(operator(f.stranger.id), f.owner.handle));
    const asOwner = ids(await cardsOwnedBy(account(f.owner.id, f.owner.handle), f.owner.handle));
    expect(
      asOperator,
      `\`visibleTo\` answers "all" for a genuine operator too (B-13), and this reader consumes ` +
        `that predicate rather than holding an opinion about actors.`,
    ).toEqual(asOwner);
  });
});

/* --------------------- what it is for --------------------- */

describe("D-132-03: `counts.cards` is this reader's `.length`", () => {
  /**
   * The equality is asserted with ONE SIDE PINNED TO A LITERAL. Two readers agreeing is not
   * two readers being right: if `counts.cards` were computed by a second query that made the
   * same mistake, or if both answered zero, the equality alone would stay green. The fixture's
   * own arithmetic is the third point.
   */
  it("agrees with the profile's count, and both agree with the fixture's arithmetic", async () => {
    const owned = await cardsOwnedBy(anonymous, f.owner.handle);
    const getProfile = await bindProfile("getProfile");
    const record = asProfileRecord(
      await getProfile(gate.get().db, anonymous, f.owner.handle),
      `getProfile(db, anonymous, "${f.owner.handle}")`,
    );
    const counts = record.counts as unknown as Record<string, number>;
    expect(
      owned.length,
      `The fixture gives \`${f.owner.handle}\` three card rows — pinned, unpinned and sealed — ` +
        `of which an anonymous caller may see two. Pinned to a literal so that two readers ` +
        `answering zero together cannot pass as agreement.`,
    ).toBe(2);
    expect(
      counts.cards,
      `D-132-03: "\`counts.cards\` is \`.length\`, derived never stored". A profile count that ` +
        `disagreed with the list the same page renders would be two answers about one handle.`,
    ).toBe(owned.length);
  });

  it("agrees with the profile's count for the owner too, private rows included", async () => {
    const actor = account(f.owner.id, f.owner.handle);
    const owned = await cardsOwnedBy(actor, f.owner.handle);
    const getProfile = await bindProfile("getProfile");
    const record = asProfileRecord(
      await getProfile(gate.get().db, actor, f.owner.handle),
      `getProfile(db, owner, "${f.owner.handle}")`,
    );
    const counts = record.counts as unknown as Record<string, number>;
    expect(owned.length).toBe(3);
    expect(counts.cards).toBe(3);
  });
});
