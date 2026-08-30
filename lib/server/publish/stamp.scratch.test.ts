/* ============================================================
   DarkPrint backend — publish: the D-260-24 stamp and the
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

   ── the stamp changed carrier, and the criterion did not ──
   D-260-24's field was `release.scored_ontology_version_id`, a
   uuid into `ontology_version`. Removing the vocabulary-version
   registry took the table's only writer and the only reader that
   resolved an id back to a semver, so the stamp is now the string
   on the stored `AutonomyResult`. What D-260-24 was about is
   unchanged and is still what the first cell measures: `scoresOf`
   answering a complete scorecard for a release the production
   writer published. The second cell moved to the new carrier and
   gained the negative — the column must stay NULL — because a
   stamp nobody writes must not quietly reappear.

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
   * The stamp names the vocabulary the score was computed against, not merely A version.
   *
   * ── it moved, and the move is the point ──
   * It used to be `release.scored_ontology_version_id`, a uuid pointing at the one
   * `ontology_version` row `runImport` seeded, and this cell read the column and compared
   * ids. Nothing writes that table now: resolving a version STRING to a row id was the last
   * thing the vocabulary-version registry did for anybody, and it went with the registry.
   * The stamp is the string `computeAutonomy` puts on `AutonomyResult.ontologyVersion`,
   * which `publish()` stores verbatim in `release.autonomy` and which `scoresOf` reads.
   *
   * Asserted through the column as well as through the value, in both directions: the
   * column must be NULL on every release (a stamp nobody writes must not quietly reappear)
   * and the string must be present on every one. A cell that only checked the string would
   * stay green if publish started writing a dangling uuid again.
   */
  it("all nine releases carry the vocabulary version on the score, and no row stamp", async () => {
    const rows = await db
      .select({
        stamped: schema.release.scoredOntologyVersionId,
        autonomy: schema.release.autonomy,
      })
      .from(schema.release);
    expect(rows.length).toBe(9);
    for (const row of rows) {
      expect(row.stamped, "`scored_ontology_version_id` is written by nothing").toBeNull();
      expect((row.autonomy as { ontologyVersion?: unknown } | null)?.ontologyVersion).toBe("0.1.0");
    }
    const [version] = await db
      .select({ id: schema.ontologyVersion.id })
      .from(schema.ontologyVersion);
    expect(
      version,
      "`ontology_version` is written by nothing either, so a seeded registry holds no rows",
    ).toBeUndefined();
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
