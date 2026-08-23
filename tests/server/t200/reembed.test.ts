/* ============================================================
   T200 AC6 — "re-embedding is triggered by a release and is
   idempotent for unchanged content"

   ── three claims, and a single cell would conflate them ──
   "Writes nothing when the row is there" is a NEGATIVE, and a
   negative is satisfied by a function whose body is empty. So it
   is driven as three separate cells, because they are three
   different statements and two of them are not implied by the
   third:

     1. the POSITIVE CONTROL — a release with no row gets one, in
        both tables, or "writes nothing the second time" is a
        claim about a function that never writes at all;
     2. IDEMPOTENCY — a second call leaves `created_at` and
        `embedding` byte-identical;
     3. DETERMINISM — deleting the row and re-embedding the same
        content reproduces the same vector. Not implied by the
        other two, and the one that catches a derivation seeded
        from anything ambient: a clock, a counter, a random.

   ── why `::text` on both columns ──
   `created_at` through a `Date` truncates Postgres microseconds,
   so two writes inside one millisecond compare equal and an
   idempotency cell meaning "the row was not rewritten" passes
   against a row that was. That is the same hazard that produced
   a 29% flake elsewhere in this run (D-110-16). `embedding` as
   text is the stored value rather than whatever the driver makes
   of an unregistered type OID.

   ── both tables ──
   D-200-12: `reembedRelease` writes the release's vector AND a
   `card_version_embedding` row for each pinned card version that
   has none. B-12 names the manifest and the card specs, and
   `card_version_embedding` has no other published writer, so a
   surface that wrote only the release half would leave that table
   permanently empty and `searchCards` with no recall vector.

   ── the absent release ──
   D-200-13: a no-op returning `void`, not a throw. It matches the
   registry's value-not-refusal convention, and a typed refusal
   would change this barrel's published class list — which a blind
   author cannot bind to until it exists. So the cell asserts what
   the writer LEFT BEHIND, element-wise, and reports whether it
   threw without asserting on it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

import { PUBLISHED, bind } from "./contract";
import {
  cardVersionEmbeddings,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertOntologyTerm,
  insertOntologyVersion,
  insertRelease,
  manifest,
  mark,
  recordedSetup,
  releaseEmbeddings,
  scratchDatabase,
  type CardFixture,
  type EmbeddingRow,
  type ReleaseFixture,
  type Scratch,
} from "./fixtures";

interface Corpus {
  bundleId: string;
  /** One release, pinning two cards, neither of which any other release pins. */
  alone: ReleaseFixture;
  aloneCards: readonly CardFixture[];

  /** A second bundle whose release SHARES one card version with `alone`. */
  sharedBundleId: string;
  shared: ReleaseFixture;
  sharedCard: CardFixture;
  ownCard: CardFixture;
}

let s: Scratch;
let c: Corpus;
const setup = recordedSetup("the T200 re-embedding corpus");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    const ontology = await insertOntologyVersion(s, CORE_ONTOLOGY.version);
    for (const term of CORE_ONTOLOGY.terms) {
      await insertOntologyTerm(s, {
        versionId: ontology.id,
        term: term as unknown as Record<string, unknown>,
      });
    }
    const owner = await insertAccount(s, mark("t200e"));

    const cardOne = await insertCard(s, { ownerId: owner.id, id: mark("embed-card-one") });
    const cardTwo = await insertCard(s, { ownerId: owner.id, id: mark("embed-card-two") });
    const bundleA = await insertBundle(s, { owner, slug: mark("embed-a") });
    const alone = await insertRelease(s, {
      bundle: bundleA,
      version: "1.0.0",
      cards: [cardOne, cardTwo],
      manifest: manifest({ slug: bundleA.slug, title: `Embeddable ${mark("t")}` }),
      scoredOntologyVersionId: ontology.id,
    });

    const ownCard = await insertCard(s, { ownerId: owner.id, id: mark("embed-card-own") });
    const bundleB = await insertBundle(s, { owner, slug: mark("embed-b") });
    const shared = await insertRelease(s, {
      bundle: bundleB,
      version: "1.0.0",
      /* `cardOne` is pinned by both releases: D-200-12 says the second call finds its row
         present and writes nothing, which is the same rule as the release's own vector. */
      cards: [cardOne, ownCard],
      manifest: manifest({ slug: bundleB.slug, title: `Also embeddable ${mark("t")}` }),
      scoredOntologyVersionId: ontology.id,
    });

    c = {
      bundleId: bundleA.id,
      alone,
      aloneCards: [cardOne, cardTwo],
      sharedBundleId: bundleB.id,
      shared,
      sharedCard: cardOne,
      ownCard,
    };
  });
});

afterAll(async () => {
  await dropScratchDatabases();
});

async function reembed(bundleId: string, digest: string): Promise<void> {
  const fn = await bind("reembedRelease");
  await fn(s.db, bundleId, digest);
}

/** `[0.1,-0.2,…]` as Postgres prints it, back to numbers. */
function parseVector(text: string): number[] {
  const inner = text.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (inner === "") return [];
  return inner.split(",").map((part) => Number(part));
}

function l2(values: readonly number[]): number {
  return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
}

function byId(rows: readonly EmbeddingRow[]): Map<string, EmbeddingRow> {
  return new Map(rows.map((row) => [row.subjectId, row]));
}

/* --------------------- the positive control --------------------- */

describe("AC6 the positive control — a release with no vector gets one", () => {
  it("writes the release's own row", async () => {
    setup.check();
    const before = await releaseEmbeddings(s);
    expect(
      before.map((r) => r.subjectId),
      "the premise: nothing has been embedded yet, so a row appearing is this call's work",
    ).not.toContain(c.alone.id);

    await reembed(c.bundleId, c.alone.digest);

    const after = byId(await releaseEmbeddings(s));
    expect(
      after.has(c.alone.id),
      `AC6: ${PUBLISHED.reembedRelease}. Without this cell every "writes nothing" assertion ` +
        `below is a claim about a function whose body is empty — which is exactly the shape ` +
        `a negative criterion is satisfiable by.`,
    ).toBe(true);
  });

  it("writes a row for each card version the release pins (D-200-12)", async () => {
    setup.check();
    await reembed(c.bundleId, c.alone.digest);
    const rows = byId(await cardVersionEmbeddings(s));
    const missing = c.aloneCards.filter((card) => !rows.has(card.rowId)).map((card) => card.ref);
    expect(
      missing,
      `D-200-12: \`reembedRelease\` writes BOTH vectors. B-12 names the manifest AND the ` +
        `card specs, \`card_version_embedding\` has no other published writer, and inventing ` +
        `a second entry point would put two owners on one table.\n` +
        `  A surface that wrote only the release half leaves that table permanently empty ` +
        `through the published API, and \`searchCards\` with no recall vector at all.`,
    ).toEqual([]);
  });

  it("the vector is 384-wide and L2-normalised (D-200-11)", async () => {
    setup.check();
    await reembed(c.bundleId, c.alone.digest);
    const row = byId(await releaseEmbeddings(s)).get(c.alone.id);
    expect(row, "the premise: the positive control above wrote a row").toBeDefined();
    const values = parseVector(row!.embedding);

    /* The width is also enforced by `vector(384) NOT NULL`, so this half is the database
       agreeing with itself and is kept only to make a malformed read obvious. The norm is
       not enforced anywhere, and it is the half that measures the derivation. */
    expect(values.length, "the column is `vector(384)`, so a different width cannot be stored").toBe(
      384,
    );
    expect(
      l2(values),
      `D-200-11: the derivation is character 3-grams of normalised text, hashed into the 384 ` +
        `buckets, L2-NORMALISED. Normalisation is what makes cosine distance a comparison of ` +
        `direction rather than of length — and \`vector_cosine_ops\` was chosen over ` +
        `\`vector_l2_ops\` precisely because L2 ranks by magnitude, which for token counts is ` +
        `document LENGTH: an ordering that looks plausible and puts a long document above a ` +
        `relevant one.\n  The stored vector's norm is ${l2(values)}.\n` +
        `  Four decimal places rather than more: pgvector stores \`float4\`, so 384 squares ` +
        `summed back out of single precision drift by roughly 1e-6 even when the write was ` +
        `exactly normalised. A vector that was NOT normalised misses by far more than that.`,
    ).toBeCloseTo(1, 4);
  });
});

/* --------------------- idempotency --------------------- */

describe("AC6 a second call writes nothing", () => {
  it("leaves the release's `created_at` and `embedding` byte-identical", async () => {
    setup.check();
    await reembed(c.bundleId, c.alone.digest);
    const first = byId(await releaseEmbeddings(s)).get(c.alone.id);
    expect(first, "the premise: the first call wrote a row").toBeDefined();

    await reembed(c.bundleId, c.alone.digest);
    const second = byId(await releaseEmbeddings(s)).get(c.alone.id);

    expect(
      second,
      `AC6/D-200-03: a \`release\` row is content-addressed — \`digest\` is derived from the ` +
        `bytes, so a row's digest cannot change — therefore a \`release_embedding\` row IS ` +
        `already a vector for that digest, and re-embedding must write nothing when the row ` +
        `is present.\n` +
        `  Both columns are compared as \`::text\`: a \`Date\` round trip truncates Postgres ` +
        `microseconds, so a rewrite inside the same millisecond would compare EQUAL and this ` +
        `cell would pass against exactly the defect it exists to catch.`,
    ).toEqual(first);
  });

  it("leaves every card row byte-identical too", async () => {
    setup.check();
    await reembed(c.bundleId, c.alone.digest);
    const first = await cardVersionEmbeddings(s);
    expect(first.length, "the premise: the first call wrote card rows").toBeGreaterThan(0);

    await reembed(c.bundleId, c.alone.digest);
    const second = await cardVersionEmbeddings(s);
    expect(
      second,
      "D-200-12: idempotency has two subjects, and both halves must be driven — a second " +
        "call writes neither.",
    ).toEqual(first);
  });

  it("a card version pinned by a SECOND release keeps the row the first one wrote", async () => {
    setup.check();
    await reembed(c.bundleId, c.alone.digest);
    const shared = byId(await cardVersionEmbeddings(s)).get(c.sharedCard.rowId);
    expect(shared, "the premise: the first release embedded the shared card").toBeDefined();

    await reembed(c.sharedBundleId, c.shared.digest);
    const rows = byId(await cardVersionEmbeddings(s));

    expect(
      rows.get(c.sharedCard.rowId),
      `D-200-12: "a card pinned by two bundles is reached by two releases, and the second ` +
        `finds the row present and writes nothing" — the same rule as the release's own ` +
        `vector, and it holds because \`card_version\` is immutable per \`(cardId, version)\` ` +
        `(lib/db/schema.ts), so a present row is already the vector for that content.`,
    ).toEqual(shared);

    /* And the control, without which the cell above is satisfied by a second call that did
       nothing at all: the second release's OWN card, which nothing had embedded, must now
       have a row. */
    expect(
      rows.has(c.ownCard.rowId),
      `the control: the second release pins a card the first one does not, and that card had ` +
        `no row. "The shared row was not rewritten" proves nothing if the second call wrote ` +
        `nothing anywhere.`,
    ).toBe(true);
  });
});

/* --------------------- determinism --------------------- */

describe("AC6 unchanged content re-embeds to the same vector", () => {
  it("deleting the row and re-embedding reproduces it exactly", async () => {
    setup.check();
    await reembed(c.bundleId, c.alone.digest);
    const first = byId(await releaseEmbeddings(s)).get(c.alone.id);
    const firstCards = await cardVersionEmbeddings(s);
    expect(first, "the premise: there is a row to delete").toBeDefined();

    await s.query("delete from release_embedding where release_id = $1", [c.alone.id]);
    await s.query("delete from card_version_embedding where card_version_id = any($1::uuid[])", [
      c.aloneCards.map((card) => card.rowId),
    ]);

    await reembed(c.bundleId, c.alone.digest);
    const second = byId(await releaseEmbeddings(s)).get(c.alone.id);

    expect(
      second?.embedding,
      `AC6 read literally: "unchanged content re-embeds to the same vector". This is a ` +
        `DIFFERENT claim from "a second call writes nothing" — that one is satisfied by a ` +
        `function that checks for a row and returns, and this one is not.\n` +
        `  D-200-01: the derivation is LOCAL AND DETERMINISTIC, no network, no key, no ` +
        `provider. A derivation seeded from a clock, a counter, a hash salt that varies per ` +
        `process, or anything else ambient passes every other cell in this file and fails ` +
        `here.`,
    ).toBe(first?.embedding);

    const secondCards = byId(await cardVersionEmbeddings(s));
    for (const card of c.aloneCards) {
      const before = firstCards.find((r) => r.subjectId === card.rowId);
      expect(
        secondCards.get(card.rowId)?.embedding,
        `the same claim for the card half: \`${card.ref}\` re-embedded to a different vector.`,
      ).toBe(before?.embedding);
    }
  });
});

/* --------------------- the absent release --------------------- */

describe("D-200-13 an absent release is a no-op, and the state proves it", () => {
  it("a digest nothing carries writes no row", async () => {
    setup.check();
    await reembed(c.bundleId, c.alone.digest);
    const before = { releases: await releaseEmbeddings(s), cards: await cardVersionEmbeddings(s) };
    expect(before.releases.length, "the premise: there is state to leave alone").toBeGreaterThan(0);

    let threw: unknown;
    try {
      await reembed(c.bundleId, `sha256:${mark("no-such-digest").replaceAll("-", "")}`);
    } catch (cause) {
      threw = cause;
    }

    const after = { releases: await releaseEmbeddings(s), cards: await cardVersionEmbeddings(s) };
    expect(
      after,
      `D-200-13: an absent release is a NO-OP returning \`void\`, not a throw — it matches the ` +
        `registry's value-not-refusal convention, and a typed refusal would change this ` +
        `barrel's published class list, which a blind author cannot bind to until it exists.\n` +
        `  Asserted on what the writer LEFT BEHIND, element-wise and column by column, rather ` +
        `than on whether it threw: a call that inserts a row and THEN throws satisfies every ` +
        `\`rejects.toThrow()\` a reviewer would write.` +
        (threw === undefined ? "" : `\n  It also threw: ${String(threw)}`),
    ).toEqual(before);

    expect(
      threw,
      `D-200-13 makes this a no-op returning \`void\`. It threw ${String(threw)}.`,
    ).toBeUndefined();
  });

  it("a bundle id nothing carries writes no row", async () => {
    setup.check();
    await reembed(c.bundleId, c.alone.digest);
    const before = { releases: await releaseEmbeddings(s), cards: await cardVersionEmbeddings(s) };

    let threw: unknown;
    try {
      /* A well-formed uuid that names no bundle: the resolution fails on the row rather
         than on the type, which is the state a stale trigger actually produces. */
      await reembed("00000000-0000-4000-8000-000000000000", c.alone.digest);
    } catch (cause) {
      threw = cause;
    }

    const after = { releases: await releaseEmbeddings(s), cards: await cardVersionEmbeddings(s) };
    expect(
      after,
      `D-200-13: \`(bundleId, digest)\` resolves a release or it does not, and not resolving ` +
        `is a value rather than a refusal. The digest here IS a real one — it just belongs to ` +
        `another bundle — so a resolver keyed on the digest alone writes a row here and a ` +
        `resolver keyed on the pair does not.` +
        (threw === undefined ? "" : `\n  It also threw: ${String(threw)}`),
    ).toEqual(before);
  });
});
