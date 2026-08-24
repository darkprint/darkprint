/* ============================================================
   DarkPrint backend — publish: the D-260-24 stamp and the
   D-300-06 F4.2 wiring, witnessed through the PRODUCTION writer.

   The orchestrator's one visit to publish.ts (both rulings name
   it) landed two changes: the release's scorecard gains its
   fourth field, and a publish triggers `reembedRelease`. Neither
   had a witness anywhere — D-260-24's own history is a column
   nothing wrote while every suite stamped its fixtures by hand,
   and "every hand-built row is a claim that some code path
   produces it" is the T260 finding this file exists to honour.
   So the world here is built by `runImport`, which composes
   `publish()` for all nine bundles: the exact path a real
   publish takes, not a fixture more complete than the writer.

   Falsified at authorship (2026-08-24), both directions:
   removing the stamp spread in publish.ts reds the scoresOf
   cells and nothing else; removing the `reembedRelease` call
   reds the embedding cells and nothing else; restoring greens
   all. Each mutation was verified landed by marker grep before
   the run scored.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { schema, type Db, type ObjectStorage } from "@/lib/db";
import { scoresOf } from "@/lib/server/registry";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { planImport, runImport } from "@/lib/server/seed";

const ANONYMOUS: Actor = { kind: "anonymous" };

/** Same reason as `seed.scratch.test.ts`: the shared bucket is a cross-commit cache. */
function memoryStorage(): ObjectStorage {
  const objects = new Map<string, Uint8Array>();
  return {
    async put(digest, body) {
      objects.set(digest, typeof body === "string" ? new TextEncoder().encode(body) : body);
    },
    async get(digest) {
      return objects.get(digest);
    },
    async delete(digest) {
      objects.delete(digest);
    },
  };
}

let testDb: TestDb;
let db: Db;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.client.db;
  await runImport(db, await planImport(), memoryStorage());
}, 180_000);

afterAll(async () => {
  await testDb?.drop();
});

describe("D-260-24: a publish stamps the fourth scorecard field", () => {
  /**
   * Through the published reader, not the column: `scoresOf` is the party that refuses a
   * three-field scorecard ("a half-written scorecard is not a scorecard"), so its answer
   * moving from `undefined` to a value is the whole defect closing. Before the stamp this
   * exact call answered `undefined` for every release ever published (D-260-24, measured).
   */
  it("scoresOf answers a complete scorecard for a freshly published release", async () => {
    const scores = await scoresOf(db, ANONYMOUS, "darkprint", "frontline-triage");
    expect(scores, "scoresOf answered undefined: the stamp did not land through publish()").toBeDefined();
    expect(scores?.autonomy).toBeDefined();
    expect(scores?.security).toBeDefined();
    expect(scores?.phaseCoverage).toBeDefined();
  });

  /**
   * The stamp names the row the score was computed against, not merely A row. One seeded
   * ontology version exists in this world ("0.1.0", `planImport`'s own pin), so every
   * release must point at exactly it — an id from anywhere else has no source here.
   */
  it("all nine releases carry the seeded ontology version's own id", async () => {
    const [version] = await db
      .select({ id: schema.ontologyVersion.id })
      .from(schema.ontologyVersion);
    expect(version).toBeDefined();
    const rows = await db
      .select({ stamped: schema.release.scoredOntologyVersionId })
      .from(schema.release);
    expect(rows.length).toBe(9);
    for (const row of rows) expect(row.stamped).toBe(version?.id);
  });
});

describe("D-300-06 F4.2: a publish triggers re-embedding", () => {
  /**
   * One vector per release and one per pinned card version, written by the publish itself —
   * no suite fixture called `reembedRelease` in this world, so a row here can only have
   * come through the wiring. 57 card files under 53 ids: `card_version_embedding` keys by
   * card VERSION row, so 57 is the count that says every pinned document embedded.
   */
  it("writes one release vector per bundle and one card vector per pinned version", async () => {
    const [releases] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.releaseEmbedding);
    const [cards] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.cardVersionEmbedding);
    expect(releases?.n, "release_embedding is empty: the reembedRelease wiring did not run").toBe(9);
    expect(cards?.n).toBe(57);
  });
});
