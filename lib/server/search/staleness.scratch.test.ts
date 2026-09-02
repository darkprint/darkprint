/**
 * `embedded_input_sha256` (0008): the column that lets a stored vector say what it was
 * computed from, and the repair path that column made possible.
 *
 * WHAT THIS EXISTS TO CATCH, in one sentence: commit ed3ae85 rewrote `card_version.body` and
 * `release.manifest` in place, under unchanged primary keys, and the insert-only writer that
 * preceded this change would have left every affected vector wrong forever with nothing in
 * the schema able to notice. That run happened to move only fields `cardText` and
 * `manifestText` never read, so nothing broke; the next one has no such guarantee.
 *
 * The pair that carries the weight is the ed3ae85 rehearsal and its control. One cell
 * rewrites a body field the encoder READS and demands the vector move. The next rewrites a
 * body field the encoder DOES NOT read and demands the vector hold. Either alone is
 * satisfiable by a broken writer: an unconditional rewriter passes the first, and the
 * shipped insert-only writer passed the second.
 *
 * `describe.skipIf` follows `ac1.scratch.test.ts`, and its cost is the same: with no
 * `DATABASE_URL` this file reports SKIPPED rather than failing, and a run with `skipped > 0`
 * is invalid rather than green. The two cells above the skip run everywhere, so this file
 * never reports zero.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { bundleDigest, sha256Hex } from "@/lib/core";
import { schema, type DbClient } from "@/lib/db";
import { createTestDb, resetTestDb, type TestDb } from "../../../tests/support/db";
import { MODEL_BLOB, encoderAvailable } from "./embed";
import { embeddedInput, reembedRelease } from "./reembed";

const hasDb = Boolean(process.env.DATABASE_URL);

/* --------------------- the half no database can drive --------------------- */

describe("the stamp names the encoder as well as the text", () => {
  /**
   * The exclusion is the point, and it is written as one rather than as a restatement of the
   * derivation. Every vector a scratch database holds was written by the one set of vendored
   * weights, so no row anywhere can witness that swapping them invalidates a stamp; the only
   * observable is that the stamp is NOT a function of the text alone.
   */
  it("is not the hash of the text by itself", () => {
    const text = "A specification, embedded.";
    expect(
      embeddedInput(text),
      "a text-only stamp matches across a model swap while every vector it describes stops " +
        "being comparable to the next one written, which is the second axis this column " +
        "was given the model pin to cover",
    ).not.toBe(`sha256:${sha256Hex(text)}`);
  });

  it("is a function of the text, and of the pin, and of nothing else", () => {
    const text = "A specification, embedded.";
    expect(embeddedInput(text)).toBe(`sha256:${sha256Hex(`${MODEL_BLOB.sha256}\n${text}`)}`);
    expect(embeddedInput(text), "the same input twice is the same stamp").toBe(embeddedInput(text));
    expect(embeddedInput(text), "a different input is a different stamp").not.toBe(embeddedInput(`${text} `));
  });
});

/* --------------------- the repair path, against a real database --------------------- */

interface Row {
  vec: string;
  at: string;
  stamp: string | null;
}

describe.skipIf(!hasDb)("a vector records the input it was built from", () => {
  let testDb: TestDb | undefined;
  let client: DbClient;

  beforeAll(async () => {
    testDb = await createTestDb();
    client = testDb.client;
  });

  beforeEach(async () => {
    await resetTestDb(client);
  });

  afterAll(async () => {
    await testDb?.drop();
  });

  /* --------------------- fixtures --------------------- */

  const SPEC =
    "Walk the aisles after closing and top up every bin that fell below its reorder line, " +
    "logging the count that closes the shift.";
  const CARD_ID = "replenisher";

  function body(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: CARD_ID,
      name: "Bin replenisher",
      type: "agent",
      phases: ["execution"],
      action: "replenish",
      spec: SPEC,
      model: "claude-opus-5",
      tools: [],
      riskMarkers: [],
      willNot: ["Reorder from a supplier the buyer has not approved."],
      ...over,
    };
  }

  /** One public bundle at one release, pinning one card. */
  async function publish(): Promise<{ bundleId: string; digest: string; releaseId: string; cardVersionId: string }> {
    const [owner] = await client.db
      .insert(schema.account)
      .values({ githubId: "alice", githubLogin: "alice", handle: "alice" })
      .returning();
    const [bundle] = await client.db
      .insert(schema.bundle)
      .values({ ownerId: owner.id, slug: "replenishment", visibility: "public" })
      .returning();

    const cardDigest = `sha256:${CARD_ID.padEnd(64, "0").slice(0, 64)}`;
    const [version] = await client.db
      .insert(schema.cardVersion)
      .values({
        cardId: CARD_ID,
        version: "1.0.0",
        digest: cardDigest,
        ownerId: owner.id,
        visibility: "public",
        body: body(),
        source: "id: replenisher\n",
      })
      .returning();

    const dot = "digraph { replenishment }";
    const digest = bundleDigest({ dot, cardDigests: [cardDigest] });
    const [release] = await client.db
      .insert(schema.release)
      .values({
        bundleId: bundle.id,
        version: "1.0.0",
        digest,
        dot,
        manifest: {
          slug: "replenishment",
          title: "Nightly warehouse replenishment",
          summary: "Pickers top up every bin that ran low.",
          description: "The pick list, the route through the racks, and the count that closes it.",
          category: "operations",
          tags: ["warehouse"],
        },
        cardRefs: [`${CARD_ID}@1.0.0`],
        cardDigests: [cardDigest],
      })
      .returning();

    return { bundleId: bundle.id, digest, releaseId: release.id, cardVersionId: version.id };
  }

  /**
   * `::text` on both columns, inherited from `tests/server/t200/reembed.test.ts` and for its
   * reason: `created_at` through a `Date` truncates Postgres microseconds, so two writes
   * inside one millisecond compare equal and a cell meaning "this row was not rewritten"
   * passes against a row that was.
   */
  async function read(table: "release_embedding" | "card_version_embedding", key: string, id: string): Promise<Row> {
    const result = await client.pool.query(
      `select embedding::text as vec, created_at::text as at, embedded_input_sha256 as stamp
         from ${table} where ${key} = $1`,
      [id],
    );
    expect(result.rows.length, `${table} holds exactly one row for ${id}`).toBe(1);
    const row = result.rows[0] as Row;
    return { vec: row.vec, at: row.at, stamp: row.stamp };
  }

  const card = (id: string) => read("card_version_embedding", "card_version_id", id);
  const rel = (id: string) => read("release_embedding", "release_id", id);

  /** Rewrite a stored body in place, under an unchanged row id. What ed3ae85 did. */
  async function rewriteBody(cardVersionId: string, next: Record<string, unknown>): Promise<void> {
    await client.db
      .update(schema.cardVersion)
      .set({ body: next })
      .where(eq(schema.cardVersion.id, cardVersionId));
  }

  /* --------------------- the premise --------------------- */

  it("the encoder is available, or every cell below is vacuous", async () => {
    expect(
      await encoderAvailable(),
      "with no encoder `reembedRelease` writes nothing and every assertion below passes " +
        "against an empty table. `models/all-MiniLM-L6-v2` is missing from this checkout.",
    ).toBe(true);
  });

  /* --------------------- the positive control --------------------- */

  it("a first embed stamps both tables", async () => {
    const p = await publish();
    await reembedRelease(client.db, p.bundleId, p.digest);

    const r = await rel(p.releaseId);
    const c = await card(p.cardVersionId);
    expect(r.stamp, "the release vector records its input").toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(c.stamp, "the card vector records its input").toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(r.stamp, "the manifest and the card are different documents").not.toBe(c.stamp);
  });

  /* --------------------- AC6, which this change must not have cost --------------------- */

  it("a second call over unchanged content rewrites nothing, stamp included", async () => {
    const p = await publish();
    await reembedRelease(client.db, p.bundleId, p.digest);
    const beforeRelease = await rel(p.releaseId);
    const beforeCard = await card(p.cardVersionId);

    await reembedRelease(client.db, p.bundleId, p.digest);

    expect(await rel(p.releaseId), "D-200-03's idempotency, unchanged by 0008").toEqual(beforeRelease);
    expect(await card(p.cardVersionId), "D-200-03's idempotency, unchanged by 0008").toEqual(beforeCard);
  });

  /* --------------------- the ed3ae85 rehearsal, and its control --------------------- */

  it("an in-place body rewrite that moves an EMBEDDED field is repaired", async () => {
    const p = await publish();
    await reembedRelease(client.db, p.bundleId, p.digest);
    const before = await card(p.cardVersionId);

    /* `spec` is the longest text `cardText` reads and the reason card vectors are stored at
       all. Rewritten under the same `card_version.id`, so `on delete cascade` cannot fire
       and nothing else in the schema can notice. */
    await rewriteBody(p.cardVersionId, body({ spec: "Escalate a failed pick to the floor lead and hold the aisle." }));
    await reembedRelease(client.db, p.bundleId, p.digest);
    const after = await card(p.cardVersionId);

    expect(
      after.vec,
      "the shipped writer was `onConflictDoNothing` with no DELETE anywhere in the module, " +
        "so it could never refresh a vector whose subject had been rewritten in place",
    ).not.toBe(before.vec);
    expect(after.stamp, "and the stamp moves with it, or the next call repairs a repaired row").not.toBe(before.stamp);
    expect(after.at, "a rewritten vector is dated when it was rewritten").not.toBe(before.at);
  });

  it("an in-place body rewrite that moves only an UNEMBEDDED field writes nothing", async () => {
    const p = await publish();
    await reembedRelease(client.db, p.bundleId, p.digest);
    const before = await card(p.cardVersionId);

    /* The control on the cell above, and the case ed3ae85 actually was: `willNot` is one of
       the fields that migration moved, and `cardText` reads none of them. A writer that
       rewrote unconditionally would pass the previous cell and red here, and a stamp taken
       over `card_version.digest` instead of over the encoder's input would red here too,
       because this edit moves the whole card's content hash. */
    await rewriteBody(p.cardVersionId, body({ willNot: ["Substitute a part number the buyer has not approved."] }));
    await reembedRelease(client.db, p.bundleId, p.digest);

    expect(
      await card(p.cardVersionId),
      "the stamp is over the text handed to the encoder, so a field outside `cardText` is " +
        "not a reason to re-encode anything",
    ).toEqual(before);
  });

  /* --------------------- the release half, where a digest column would have failed --------------------- */

  it("an in-place manifest rewrite is repaired, and the release digest never moves", async () => {
    const p = await publish();
    await reembedRelease(client.db, p.bundleId, p.digest);
    const before = await rel(p.releaseId);

    const [current] = await client.db
      .select({ manifest: schema.release.manifest, digest: schema.release.digest })
      .from(schema.release)
      .where(eq(schema.release.id, p.releaseId));
    await client.db
      .update(schema.release)
      .set({ manifest: { ...(current.manifest as Record<string, unknown>), title: "Overnight bin top-up" } })
      .where(eq(schema.release.id, p.releaseId));

    await reembedRelease(client.db, p.bundleId, p.digest);
    const after = await rel(p.releaseId);

    const [reread] = await client.db
      .select({ digest: schema.release.digest })
      .from(schema.release)
      .where(eq(schema.release.id, p.releaseId));
    expect(
      reread.digest,
      "`bundleDigest` hashes `{dot, cardDigests}` and the manifest is not in it, which is " +
        "why an `embedded_digest` column could not have seen this edit at all",
    ).toBe(current.digest);
    expect(after.vec, "the manifest is the whole of the release vector's input").not.toBe(before.vec);
    expect(after.stamp).not.toBe(before.stamp);
  });

  /* --------------------- the rows 0008 could not backfill --------------------- */

  it("a vector written before 0008 is re-encoded rather than trusted", async () => {
    const p = await publish();
    await reembedRelease(client.db, p.bundleId, p.digest);
    const before = await card(p.cardVersionId);

    /* Exactly the state the 42 card and 7 release rows were in on the morning of this
       change: a correct vector with no record of its input. It cannot be stamped from
       today's text, because that writes agreement onto a vector nobody checked. */
    await client.pool.query("update card_version_embedding set embedded_input_sha256 = null");
    await reembedRelease(client.db, p.bundleId, p.digest);
    const after = await card(p.cardVersionId);

    expect(after.stamp, "unknown provenance is treated as disagreement").toBe(before.stamp);
    expect(after.at, "which means the row really was re-encoded").not.toBe(before.at);
    expect(
      after.vec,
      "and the re-encode reproduces the same vector, which is the property that made the " +
        "local sweep of 49 unstamped rows safe to run",
    ).toBe(before.vec);
  });
});
