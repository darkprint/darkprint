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
  PUBLISHED,
  scratchDatabase,
  type Cards,
  type Scratch,
} from "./contract";

/* ============================================================
   T020 — the published surface, and the two round trips

   No acceptance criterion states the shape of `CardRecord` or the
   difference between how `source` and `body` come back, and both
   are in the Published signatures block, so both are asserted here.
   The `source`/`body` split is T010's AC1 defect written down
   before it costs a round: `source` is `text` and comes back
   **byte-identical**; `body` is `jsonb` and can only come back
   **value-identical**, because jsonb preserves neither key order
   nor number spelling. Asserting byte-identity on `body` would be
   an unsatisfiable criterion, so nothing here does.
   ============================================================ */

let api: Cards;
let scratch: Scratch;
let ownerId: string;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    api = await cards();
    scratch = await scratchDatabase();
    ownerId = await insertAccount(scratch, marker("surface-owner"));
  } catch (cause) {
    setupFailure = cause;
  }
}, 120_000);

/**
 * A `beforeAll` that throws marks every test in the file **skipped**, and a run reporting
 * skips reads as green at a glance. Rethrown per test, an absent module is one red per
 * criterion, which is what it is.
 */
beforeEach(() => {
  if (setupFailure !== undefined) throw setupFailure;
});

afterAll(async () => {
  const dropped = await dropScratchDatabases();
  console.log(`t020/surface teardown: dropped ${dropped} databases`);
}, 120_000);

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${what} produced ${value === null ? "null" : typeof value}; expected a record.`);
  }
  return value as Record<string, unknown>;
}

describe("the published surface", () => {
  it("publishes all seven names from @/lib/server/cards", () => {
    expect(typeof api.addCard, PUBLISHED.addCard).toBe("function");
    expect(typeof api.getCard, PUBLISHED.getCard).toBe("function");
    expect(typeof api.getLatestCard, PUBLISHED.getLatestCard).toBe("function");
    expect(typeof api.listCardVersions, PUBLISHED.listCardVersions).toBe("function");
    expect(typeof api.resolveCardRef, PUBLISHED.resolveCardRef).toBe("function");
    expect(typeof api.findCardsByDigest, PUBLISHED.findCardsByDigest).toBe("function");
  });

  it("returns a CardRecord shaped exactly as the contract publishes it", async () => {
    const fixture = card({ id: cardIdFor("shape") });
    const record = asRecord(
      await api.addCard(scratch.db, {
        cardId: fixture.cardId,
        version: fixture.version,
        ownerId,
        visibility: "public",
        body: fixture.body,
        source: fixture.source,
      }),
      "addCard",
    );

    /* Equality, not a subset check. "Has at least these fields" would pass against a record
       that had dropped `source` — which is the authoritative artefact a consumer receives —
       and against one that leaked the raw row. Both have to red. */
    expect(Object.keys(record).sort(), PUBLISHED.cardRecord).toEqual(
      [
        "body",
        "cardId",
        "createdAt",
        "digest",
        "id",
        "ownerId",
        "source",
        "version",
        "visibility",
      ].sort(),
    );
    expect(typeof record.id).toBe("string");
    expect(record.cardId).toBe(fixture.cardId);
    expect(record.version).toBe(fixture.version);
    expect(record.ownerId).toBe(ownerId);
    expect(record.visibility).toBe("public");
    expect(record.createdAt).toBeInstanceOf(Date);
  });

  it("computes the digest rather than taking one from the caller", async () => {
    const fixture = card({ id: cardIdFor("digest") });
    const lie = `sha256:${"0".repeat(64)}`;

    /* `addCard`'s input has no `digest` field: "digest is COMPUTED here, never supplied".
       Refusing the surplus field and ignoring it are both faithful to that; honouring it is
       not, and that is the only outcome this rejects. */
    const outcome = await Promise.resolve(
      api.addCard(scratch.db, {
        cardId: fixture.cardId,
        version: fixture.version,
        ownerId,
        body: fixture.body,
        source: fixture.source,
        digest: lie,
      }),
    ).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: undefined }),
    );

    if (outcome.ok) {
      const record = asRecord(outcome.value, "addCard");
      expect(record.digest).toBe(fixture.digest);
      expect(record.digest).not.toBe(lie);
    }
    await expect(api.findCardsByDigest(scratch.db, anonymous, lie)).resolves.toEqual([]);
  });

  it("defaults visibility rather than storing null when it is not given", async () => {
    const fixture = card({ id: cardIdFor("defaultvis") });
    /* `visibility?` is optional in the input and `NOT NULL` in the schema, so something has
       to choose. Whichever it chooses, it is one of the two published values and it is what
       a read hands back — a record whose visibility is `null` or `undefined` would make
       every policy decision downstream undefined behaviour. */
    const record = asRecord(
      await api.addCard(scratch.db, {
        cardId: fixture.cardId,
        version: fixture.version,
        ownerId,
        body: fixture.body,
        source: fixture.source,
      }),
      "addCard",
    );
    expect(["public", "private"]).toContain(record.visibility);

    const read = asRecord(
      await api.getCard(scratch.db, account(ownerId), fixture.cardId, fixture.version),
      "getCard",
    );
    expect(read.visibility).toBe(record.visibility);
  });
});

describe("source is byte-identical and body is value-identical", () => {
  it("returns `source` byte for byte, including its trailing newline", async () => {
    const fixture = card({ id: cardIdFor("bytes") });
    await api.addCard(scratch.db, {
      cardId: fixture.cardId,
      version: fixture.version,
      ownerId,
      visibility: "public",
      body: fixture.body,
      source: fixture.source,
    });

    const read = asRecord(
      await api.getCard(scratch.db, anonymous, fixture.cardId, fixture.version),
      "getCard",
    );
    expect(read.source, PUBLISHED.sourceVsBody).toBe(fixture.source);
    expect(String(read.source).length).toBe(fixture.source.length);
    expect(String(read.source).endsWith("\n")).toBe(true);
  });

  it("keeps whitespace, CRLF and indentation in `source` untouched", async () => {
    const fixture = card({ id: cardIdFor("ws") });
    /* A store that trims, re-indents or re-serialises `source` from `body` changes the
       artefact a consumer downloads. The contract says it in as many words: "Never
       reconstruct `source` by re-serialising `body`." */
    const padded = `# a comment\r\n${fixture.source}\n   \n`;
    await api.addCard(scratch.db, {
      cardId: fixture.cardId,
      version: fixture.version,
      ownerId,
      visibility: "public",
      body: fixture.body,
      source: padded,
    });

    const read = asRecord(
      await api.getCard(scratch.db, anonymous, fixture.cardId, fixture.version),
      "getCard",
    );
    expect(read.source).toBe(padded);
  });

  it("returns `body` value-identical, and the digest still matches the engine's", async () => {
    const fixture = card({ id: cardIdFor("value") });
    await api.addCard(scratch.db, {
      cardId: fixture.cardId,
      version: fixture.version,
      ownerId,
      visibility: "public",
      body: fixture.body,
      source: fixture.source,
    });

    const read = asRecord(
      await api.getCard(scratch.db, anonymous, fixture.cardId, fixture.version),
      "getCard",
    );
    /* Value-identical, which is all jsonb can promise — key order and number spelling are
       not preserved and asserting them would be an unsatisfiable criterion. What *is*
       asserted is that nothing was lost: the round-tripped body hashes to the same digest
       the engine computed before it was stored, which is the property the identity rests on. */
    expect(read.body, PUBLISHED.sourceVsBody).toEqual(fixture.body);
    expect(cardDigest(read.body as never)).toBe(fixture.digest);
    expect(read.digest).toBe(fixture.digest);
  });

  it("round-trips emoji, Arabic, CJK and combining marks in both source and body", async () => {
    const id = cardIdFor("unicode");
    /* The other half of "refused, not repaired": the refusal must not become a blanket
       unicode ban. Every one of these is well-formed UTF-16 and has to survive. */
    const notes =
      "\u{1F468}\u{200D}\u{1F4BB} zwj | \u0645\u0631\u062D\u0628\u0627 arabic | \u4E2D\u6587 cjk | " +
      "e\u0301 decomposed | \u{1D11E} astral";
    const fixture = card({ id, notes });
    await api.addCard(scratch.db, {
      cardId: fixture.cardId,
      version: fixture.version,
      ownerId,
      visibility: "public",
      body: fixture.body,
      source: fixture.source,
    });

    const read = asRecord(await api.getCard(scratch.db, anonymous, id, "1.0.0"), "getCard");
    expect(read.source).toBe(fixture.source);
    expect(String(read.source).includes(notes)).toBe(true);
    expect((read.body as { notes?: string }).notes).toBe(notes);
    /* And unnormalised: NFC would fold the combining sequence and change the digest. */
    expect((read.body as { notes?: string }).notes).not.toBe(notes.normalize("NFC"));
    expect(read.digest).toBe(fixture.digest);
  });
});
