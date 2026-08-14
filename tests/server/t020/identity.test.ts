import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cardDigest } from "@/lib/core";

import {
  anonymous,
  account,
  card,
  cardIdFor,
  cards,
  dropScratchDatabases,
  insertAccount,
  marker,
  scratchDatabase,
  type Cards,
  type Scratch,
} from "./contract";

/* ============================================================
   T020 acceptance criterion 2 — the identity

   (2) two cards differing only in `author` or `provenance` share a
       digest

   Written as the amendment directs, and it is the stronger reading.
   `cardDigest` covers every field but those two — `id` and
   `version` included — so two *stored rows* cannot share a digest
   while `card_version_id_version_key` exists. The criterion is
   therefore a statement about the digest function plus the
   immutability that follows: store A, compute `cardDigest(B)` where
   B differs only in `author`/`provenance`, assert it equals what
   was stored for A, and assert B is refused as a duplicate. §4's
   dedup is two authors' identical cards collapsing onto **one
   identity**, not two rows coexisting.

   `findCardsByDigest` is tested for what it does — the matching row
   back, empty for an unknown digest. Its cardinality is left
   unpinned in both directions, per the amendment.
   ============================================================ */

let api: Cards;
let scratch: Scratch;
let ownerId: string;
let otherOwnerId: string;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    api = await cards();
    scratch = await scratchDatabase();
    ownerId = await insertAccount(scratch, marker("identity-owner"));
    otherOwnerId = await insertAccount(scratch, marker("identity-other"));
  } catch (cause) {
    setupFailure = cause;
  }
}, 120_000);

beforeEach(() => {
  if (setupFailure !== undefined) throw setupFailure;
});

afterAll(async () => {
  const dropped = await dropScratchDatabases();
  console.log(`t020/identity teardown: dropped ${dropped} databases`);
}, 120_000);

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${what} produced ${value === null ? "null" : typeof value}; expected a record.`);
  }
  return value as Record<string, unknown>;
}

async function attempt(promise: unknown): Promise<{ ok: boolean; value?: unknown }> {
  return Promise.resolve(promise).then(
    (value) => ({ ok: true, value }),
    () => ({ ok: false }),
  );
}

describe("AC2 — author and provenance are outside the identity", () => {
  it("AC2: a card differing only in `author` hashes to the digest already stored", async () => {
    const id = cardIdFor("ac2author");
    const mine = card({ id, author: "first-author" });
    const theirs = card({ id, author: "a-different-author" });

    /* The premise, checked rather than assumed: the two sources really do differ, and they
       differ only where the criterion says they may. */
    expect(theirs.source).not.toBe(mine.source);
    expect({ ...theirs.body, author: undefined }).toEqual({ ...mine.body, author: undefined });

    const stored = asRecord(
      await api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body: mine.body,
        source: mine.source,
      }),
      "addCard",
    );

    expect(cardDigest(theirs.body)).toBe(stored.digest);
  });

  it("AC2: a card differing only in `provenance` hashes to the same digest", async () => {
    const id = cardIdFor("ac2prov");
    const bare = card({ id });
    const attributed = card({ id, provenance: "lifted from another registry" });

    expect(attributed.source).not.toBe(bare.source);
    expect(cardDigest(attributed.body)).toBe(cardDigest(bare.body));

    const stored = asRecord(
      await api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body: bare.body,
        source: bare.source,
      }),
      "addCard",
    );
    expect(cardDigest(attributed.body)).toBe(stored.digest);
  });

  it("AC2: the other author's identical card is refused as a duplicate, not stored beside it", async () => {
    const id = cardIdFor("ac2dup");
    const mine = card({ id, author: "me" });
    const theirs = card({ id, author: "you" });

    await api.addCard(scratch.db, {
      cardId: id,
      version: "1.0.0",
      ownerId,
      visibility: "public",
      body: mine.body,
      source: mine.source,
    });

    /* One identity, so one row — even from a different account. This is what "dedup" means
       here: a bundle pinning either author's card pins the same thing. */
    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId: otherOwnerId,
        visibility: "public",
        body: theirs.body,
        source: theirs.source,
      }),
    );
    expect(outcome.ok).toBe(false);

    const [row] = await scratch.query(
      "select count(*)::int as n from card_version where card_id = $1",
      [id],
    );
    expect(Number(row?.n)).toBe(1);
  });

  it("AC2: a change anywhere else does move the digest", async () => {
    const id = cardIdFor("ac2moves");
    const base = card({ id });
    /* The half that keeps the criterion from being vacuous: a digest that ignored `notes`
       too, or ignored everything, would satisfy every assertion above. */
    expect(cardDigest(card({ id, notes: "a note" }).body)).not.toBe(cardDigest(base.body));
    expect(cardDigest(card({ id, name: "Another Name" }).body)).not.toBe(cardDigest(base.body));
    expect(cardDigest(card({ id, version: "2.0.0" }).body)).not.toBe(cardDigest(base.body));
    expect(cardDigest(card({ id: cardIdFor("ac2other") }).body)).not.toBe(cardDigest(base.body));
  });
});

describe("findCardsByDigest", () => {
  it("returns the row stored under that digest", async () => {
    const id = cardIdFor("bydigest");
    const fixture = card({ id });
    const stored = asRecord(
      await api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body: fixture.body,
        source: fixture.source,
      }),
      "addCard",
    );

    const found = (await api.findCardsByDigest(
      scratch.db,
      anonymous,
      String(stored.digest),
    )) as Record<string, unknown>[];
    expect(Array.isArray(found)).toBe(true);
    /* Cardinality left unpinned in both directions, per the amendment: the row is here, and
       nothing is asserted about how many rows this could ever hold. */
    expect(found.some((r) => r.id === stored.id)).toBe(true);
    const mine = found.find((r) => r.id === stored.id) as Record<string, unknown>;
    expect(mine.source).toBe(fixture.source);
    expect(mine.digest).toBe(fixture.digest);
  });

  it("returns an empty array for a well-formed digest nothing was stored under", async () => {
    const absent = cardDigest(card({ id: cardIdFor("neverstored") }).body);
    await expect(api.findCardsByDigest(scratch.db, anonymous, absent)).resolves.toEqual([]);
  });

  it("returns an empty array for a malformed digest rather than throwing", async () => {
    /* Absence is a value here, as it is for both single readers. A digest that never
       matched the stored shape cannot name a row, and answering that with a throw turns a
       bad path parameter into a 500. */
    for (const digest of ["", " ", "sha256:", "not-a-digest", `sha256:${"z".repeat(64)}`]) {
      const outcome = await Promise.resolve(
        api.findCardsByDigest(scratch.db, anonymous, digest),
      ).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, value: String(error) }),
      );
      expect(outcome, `findCardsByDigest(${JSON.stringify(digest)})`).toEqual({
        ok: true,
        value: [],
      });
    }
  });

  it("hides a private card from a stranger and shows it to its owner", async () => {
    const id = cardIdFor("bydigestpriv");
    const fixture = card({ id });
    const stored = asRecord(
      await api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "private",
        body: fixture.body,
        source: fixture.source,
      }),
      "addCard",
    );
    const digest = String(stored.digest);

    /* This reader takes an `Actor` like the others, so AC4 reaches it too — a digest lookup
       that skipped the filter would be the way round every other guard in the module. */
    await expect(api.findCardsByDigest(scratch.db, anonymous, digest)).resolves.toEqual([]);
    await expect(
      api.findCardsByDigest(scratch.db, account(otherOwnerId), digest),
    ).resolves.toEqual([]);
    const asOwner = (await api.findCardsByDigest(
      scratch.db,
      account(ownerId),
      digest,
    )) as Record<string, unknown>[];
    expect(asOwner.map((r) => r.id)).toContain(stored.id);
  });
});
