/* ============================================================
   DarkPrint backend — publish: the D-260-24 scorecard and the
   D-300-06 F4.2 wiring, witnessed through the PRODUCTION writer.

   The orchestrator's one visit to publish.ts (both rulings name
   it) landed two changes: the release's scorecard gains the field
   that makes it complete, and a publish triggers `reembedRelease`.
   Neither had a witness anywhere — D-260-24's own history is a
   column nothing wrote while every suite stamped its fixtures by
   hand, and "every hand-built row is a claim that some code path
   produces it" is the T260 finding this file exists to honour.
   So the world here is built by `runImport`, which composes
   `publish()` for all nine bundles: the exact path a real
   publish takes, not a fixture more complete than the writer.

   ── the stamp changed carrier twice, and then went ──
   D-260-24's field was `release.scored_ontology_version_id`, a
   uuid into `ontology_version`. Losing the vocabulary-version
   registry moved the stamp onto the string
   `AutonomyResult.ontologyVersion`;
   `0009_drop_ontology_versioning` then withdrew that too, along
   with the column and both tables. The vocabulary names what an
   Attractor node IS, Attractor fixes those shapes in its own spec
   and carries no vocabulary version, so a DarkPrint-only version
   on top was a second thing to keep in step with nothing. What
   D-260-24 was about survives in the first cell and is unchanged:
   `scoresOf` answering a complete scorecard for a release the
   production writer published.

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

describe("D-260-24: a publish writes a scorecard `scoresOf` accepts", () => {
  /**
   * Through the published reader, not the column: `scoresOf` is the party that refuses a
   * three-field scorecard ("a half-written scorecard is not a scorecard"), so its answer
   * moving from `undefined` to a value is the whole defect closing. Before the stamp this
   * exact call answered `undefined` for every release ever published (D-260-24, measured).
   */
  it("scoresOf answers a complete scorecard for a freshly published release", async () => {
    const scores = await scoresOf(db, ANONYMOUS, "autogen", "frontline-triage");
    expect(scores, "scoresOf answered undefined: the stamp did not land through publish()").toBeDefined();
    expect(scores?.autonomy).toBeDefined();
    expect(scores?.security).toBeDefined();
    expect(scores?.phaseCoverage).toBeDefined();
  });

  /* A second cell stood here. It held the vocabulary stamp in both directions at once —
     `release.scored_ontology_version_id` NULL on all nine rows so a stamp nobody writes
     could not quietly reappear, `AutonomyResult.ontologyVersion` present on all nine, and
     `ontology_version` empty. 0009 removed the column, the field and both tables, so all
     three halves lost their subject together and there is nothing left for the cell to be
     wrong about. The premise it also carried, that `runImport` publishes nine releases, is
     kept below where the embedding counts state it. */

  it("publishes every bundle, so the cells here read a full world", async () => {
    const rows = await db.select({ id: schema.release.id }).from(schema.release);
    expect(rows.length, "`runImport` publishes the whole archive; a short world is a broken fixture").toBe(16);
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
    expect(releases?.n, "release_embedding is empty: the reembedRelease wiring did not run").toBe(16);
    expect(cards?.n).toBe(103);
  });
});
