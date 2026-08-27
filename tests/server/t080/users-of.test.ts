/* ============================================================
   T080 AC2 — "usersOf for a card pinned by two blueprints
   returns both, sorted and distinct"

   The discriminating fixture is **two owners holding the same
   slug**, which D-80-01 made reachable and which the seed content
   cannot exhibit: B-20 puts every seeded bundle under one handle,
   so a reader that dedupes or sorts on the bare slug passes every
   test built from `content/**` and collapses two real blueprints
   into one the first time a second account publishes `starter`.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  anonymous,
  asArray,
  asBlueprintSummary,
  asCardSummary,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertRelease,
  keyOf,
  mark,
  scratchDatabase,
} from "./contract";

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The card two blueprints pin. Owned by one account; pinning is not ownership. */
const SHARED = "two-user-card";
/** Pinned by one blueprint only, and only by a release that is no longer current. */
const STALE = "stale-pin-card";
/** Pinned by B's `a-only`, which exists so a same-slug non-pinner is in the answer's way. */
const FILLER = "filler-card";

const SHARED_SLUG = "same-slug-two-owners";
const A_ONLY_SLUG = "a-only";
const STALE_SLUG = "stale-pinner";

let s: Scratch;
let handleA: string;
let handleB: string;
let handleC: string;

beforeAll(async () => {
  s = await scratchDatabase();
  /* `-a-`, `-b-`, `-c-` so the handles have a stated order and the sort assertions are
     about the reader rather than about which uuid Postgres happened to mint.
     Three owners and not two: with two, "slug then handle" and "handle then slug" happen
     to produce the same sequence on every arrangement this fixture can hold, and a
     mutation swapping them reddened nothing. C holds `a-only` — an *early* slug under a
     *late* handle — which is the only shape that separates the two orders. */
  const a = await insertAccount(s, mark("t080-a-owner"));
  const b = await insertAccount(s, mark("t080-b-owner"));
  const c = await insertAccount(s, mark("t080-c-owner"));
  handleA = a.handle;
  handleB = b.handle;
  handleC = c.handle;
  expect(byCodeUnit(handleA, handleB)).toBeLessThan(0);
  expect(byCodeUnit(handleB, handleC)).toBeLessThan(0);

  const shared1 = await insertCard(s, { ownerId: a.id, id: SHARED, version: "1.0.0" });
  const shared2 = await insertCard(s, { ownerId: a.id, id: SHARED, version: "2.0.0" });
  const stale = await insertCard(s, { ownerId: a.id, id: STALE });

  /* Inserted C, B, A within each same-slug group — the reverse of handle order — and that
     is load-bearing rather than tidy. `Array.prototype.sort` is stable, so a sort keyed on
     slug alone leaves the equal-slug rows in whatever order the reader received them; with
     the rows inserted in handle order, dropping the handle tiebreak changes nothing and a
     mutation removing it reds nothing. Inserting them backwards is what makes the missing
     tiebreak show. It also states the weakness honestly: the tiebreak is observable here
     because the unsorted source order disagrees with it, and a reader that happened to
     receive its rows already handle-ordered would satisfy this test without one. */

  /* C holds the early slug under the late handle, and does pin the card. */
  const cOnly = await insertBundle(s, { owner: c, slug: A_ONLY_SLUG });
  await insertRelease(s, { bundle: cOnly, version: "1.0.0", cards: [shared1] });

  /* B holds `a-only` too, and does NOT pin the shared card. Without this row, matching the
     users on the bare slug is behaviourally identical to matching on the pair — every slug
     in the answer happened to belong to exactly the owners who pinned the card, and a
     mutation dropping the owner from the match reddened nothing. */
  const filler = await insertCard(s, { ownerId: b.id, id: FILLER, action: "filler-action" });
  const bOnly = await insertBundle(s, { owner: b, slug: A_ONLY_SLUG });
  await insertRelease(s, { bundle: bOnly, version: "1.0.0", cards: [filler] });

  /* One blueprint pinning the same ref twice: legal (`card_digests` is an array, not a set)
     and the distinctness case that lives inside a single blueprint rather than across two. */
  const aOnly = await insertBundle(s, { owner: a, slug: A_ONLY_SLUG });
  await insertRelease(s, { bundle: aOnly, version: "1.0.0", cards: [shared1, shared1] });

  /* Same slug, two owners — the case B-09 legalised and `lib/core`'s record could not express. */
  const bShared = await insertBundle(s, { owner: b, slug: SHARED_SLUG });
  /* A *different* version of the same card id: "blueprint slugs using any version of `id`"
     (lib/core/archive/registry.ts:60), so both blueprints are users of `two-user-card`. */
  await insertRelease(s, { bundle: bShared, version: "1.0.0", cards: [shared2] });
  const aShared = await insertBundle(s, { owner: a, slug: SHARED_SLUG });
  await insertRelease(s, { bundle: aShared, version: "1.0.0", cards: [shared1] });

  /* Pinned only by a release that is no longer current. */
  const stalePinner = await insertBundle(s, { owner: b, slug: STALE_SLUG });
  await insertRelease(s, { bundle: stalePinner, version: "1.0.0", cards: [stale] });
  await insertRelease(s, { bundle: stalePinner, version: "2.0.0", cards: [shared1] });
});

afterAll(async () => {
  await dropScratchDatabases();
});

async function usersOfCard(cardId: string): Promise<ReturnType<typeof asBlueprintSummary>[]> {
  const usersOf = await bind("usersOf");
  const rows = asArray(await usersOf(s.db, anonymous, cardId), `usersOf(${cardId})`);
  return rows.map((row, i) => asBlueprintSummary(row, `usersOf(${cardId})[${i}]`));
}

describe("AC2 usersOf", () => {
  it("returns both blueprints that pin the card", async () => {
    const users = await usersOfCard(SHARED);
    const keys = users.map(keyOf).sort(byCodeUnit);
    expect(keys).toEqual(
      [
        `${handleA}/${SHARED_SLUG}`,
        `${handleA}/${A_ONLY_SLUG}`,
        `${handleB}/${SHARED_SLUG}`,
        /* Its current release, 2.0.0, pins `two-user-card@1.0.0`. */
        `${handleB}/${STALE_SLUG}`,
        `${handleC}/${A_ONLY_SLUG}`,
      ].sort(byCodeUnit),
    );
  });

  it("returns two entries when two owners hold the same slug, not one", async () => {
    const users = await usersOfCard(SHARED);
    const sameSlug = users.filter((u) => u.slug === SHARED_SLUG);
    expect(
      sameSlug.map((u) => u.ownerHandle).sort(byCodeUnit),
      `D-80-01: "\`blueprints()\` returns \`alice/foo\` and \`bob/foo\` as two records both ` +
        `reading \`slug: "foo"\`, indistinguishable to the caller … AC2's 'sorted and ` +
        `distinct' has no total key to sort or dedupe on". A reader that dedupes on the ` +
        `bare slug answers one here and is right about every seeded bundle, because B-20 ` +
        `puts all of them under one handle.`,
    ).toEqual([handleA, handleB]);
  });

  it("does not return a same-slug blueprint under another owner that pins nothing", async () => {
    const users = await usersOfCard(SHARED);
    expect(
      users.map(keyOf).sort(byCodeUnit),
      `Three owners hold \`${A_ONLY_SLUG}\` and only A's and C's pin \`${SHARED}\`. Matching ` +
        `the users on the bare slug returns B's as well — and is indistinguishable from the ` +
        `correct answer on any fixture where every slug in the result belongs to exactly ` +
        `the owners who pinned the card.`,
    ).not.toContain(`${handleB}/${A_ONLY_SLUG}`);
  });

  it("is distinct, including a blueprint that pins the same ref twice", async () => {
    const users = await usersOfCard(SHARED);
    const keys = users.map(keyOf);
    expect(
      new Set(keys).size,
      `\`${A_ONLY_SLUG}\` pins \`${SHARED}@1.0.0\` twice in one release — legal, because ` +
        `\`card_digests\` "is an array, not a set: pinning one card twice is a different ` +
        `digest from pinning it once" (lib/db/schema.ts). It is still one user.`,
    ).toBe(keys.length);
  });

  it("is sorted by slug, then by owner handle", async () => {
    const users = await usersOfCard(SHARED);
    expect(
      users.map(keyOf),
      `Ruled: "\`blueprints()\` and \`usersOf()\` sort by slug, then by owner handle." The ` +
        `two \`${SHARED_SLUG}\` rows are the only place the tiebreak is observable, and it ` +
        `is observable only because two owners hold that slug — which no fixture built ` +
        `from the seed content can exhibit, since B-20 puts all of it under one handle.`,
    ).toEqual([
      `${handleA}/${A_ONLY_SLUG}`,
      `${handleC}/${A_ONLY_SLUG}`,
      `${handleA}/${SHARED_SLUG}`,
      `${handleB}/${SHARED_SLUG}`,
      `${handleB}/${STALE_SLUG}`,
    ]);
  });

  it("orders a card's usedIn by slug, then by owner handle", async () => {
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()");
    const shared = rows
      .map((row, i) => asCardSummary(row, `cards()[${i}]`))
      .find((c) => c.ref === `${SHARED}@1.0.0`);
    expect(shared, `${SHARED}@1.0.0 must be indexed for this to say anything`).toBeDefined();
    expect(
      shared?.usedIn.map(keyOf),
      `\`usedIn\` carries the same order as \`usersOf()\`. \`${A_ONLY_SLUG}\` under C — an ` +
        `early slug under a late handle — is what separates "slug then handle" from ` +
        `"handle then slug"; with only A and B the two sequences coincide.`,
    ).toEqual([
      `${handleA}/${A_ONLY_SLUG}`,
      `${handleC}/${A_ONLY_SLUG}`,
      `${handleA}/${SHARED_SLUG}`,
      `${handleB}/${STALE_SLUG}`,
    ]);
  });

  it("blueprints() applies the same slug-then-handle order", async () => {
    const blueprints = await bind("blueprints");
    const rows = asArray(await blueprints(s.db, anonymous), "blueprints()");
    const all = rows.map((row, i) => asBlueprintSummary(row, `blueprints()[${i}]`));
    const sameSlug = all.filter((b) => b.slug === SHARED_SLUG).map((b) => b.ownerHandle);
    expect(
      sameSlug,
      `Both owners hold \`${SHARED_SLUG}\`, so the pair appears adjacent and in handle order.`,
    ).toEqual([handleA, handleB]);
    const keys = all.map((b) => `${b.slug}\u0000${b.ownerHandle}`);
    for (let i = 1; i < keys.length; i += 1) {
      expect(byCodeUnit(keys[i - 1], keys[i]), JSON.stringify(keys)).toBeLessThanOrEqual(0);
    }
  });

  it("returns BlueprintSummary records, not bare slugs", async () => {
    const usersOf = await bind("usersOf");
    const rows = asArray(await usersOf(s.db, anonymous, SHARED), `usersOf(${SHARED})`);
    expect(rows.length).toBeGreaterThan(0);
    for (const [i, row] of rows.entries()) {
      expect(
        typeof row,
        `\`lib/core\`'s \`usersOf(id)\` answers \`readonly string[]\`; T080's published ` +
          `signature answers \`Promise<readonly BlueprintSummary[]>\`.`,
      ).toBe("object");
      asBlueprintSummary(row, `usersOf()[${i}]`);
    }
  });

  it("does not count a blueprint whose pin is only in a superseded release", async () => {
    const users = await usersOfCard(STALE);
    expect(
      users.map(keyOf),
      `\`${STALE_SLUG}\` pinned \`${STALE}\` at 1.0.0 and dropped it at 2.0.0, which is the ` +
        `current release under D-80-03.`,
    ).toEqual([]);
  });

  it("answers [] for a card id nothing pins", async () => {
    expect(await usersOfCard("no-such-card-at-all")).toEqual([]);
  });
});
