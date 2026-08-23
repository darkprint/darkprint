-- T200: the vectors for semantic search. B-12 names the manifest and the card
-- specs, so the two subjects are `release` and `card_version`. Added here
-- because `lib/db/schema.ts` is Forbidden to T200 and it cannot add them itself.
--
-- SEPARATE TABLES RATHER THAN A COLUMN ON EACH, AND THE GUARD IS WHY. The first
-- version of this migration put a nullable `embedding` on `release` and on
-- `card_version` directly. Both are in T005's BASE_TABLES, and
-- `tests/server/t005/existing.test.ts` holds the delta over those ten to exactly
-- one licensed cell -- "an alteration to a table eight merged tasks already
-- query, and nothing downstream would find out until it broke". It redded, and
-- widening the licence would have been negotiating with the instrument.
--
-- The separate table is better on its own terms, which is how you can tell the
-- guard was right rather than merely in the way:
--   * `embedding` is NOT NULL here. A row exists if and only if that release has
--     been embedded, so "never embedded" is the ABSENCE of a row rather than a
--     null inside one, and the state is representable exactly once. On a column
--     it was a nullable field whose null had to carry that meaning by
--     convention.
--   * No row eight merged tasks already select from gains a field. A
--     `select().from(release)` returns what it returned yesterday.
--   * ON DELETE CASCADE makes a stale vector unrepresentable rather than
--     something a sweep has to remember.
--
-- WHY 384: pgvector refuses an index on a column declared without a dimension,
-- so the width has to be chosen before anything can be indexed, and changing it
-- later rewrites every row. 384 is the width of the common small sentence
-- encoders, so replacing the derivation behind these tables with a real provider
-- is a drop-in rather than a migration.
CREATE TABLE "release_embedding" (
	"release_id" uuid PRIMARY KEY NOT NULL REFERENCES "release"("id") ON DELETE CASCADE,
	"embedding" vector(384) NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "card_version_embedding" (
	"card_version_id" uuid PRIMARY KEY NOT NULL REFERENCES "card_version"("id") ON DELETE CASCADE,
	"embedding" vector(384) NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now()
);

-- Cosine, matching the distance a normalised bag-of-tokens derivation is defined
-- under. `vector_l2_ops` would rank by magnitude, which for token counts is
-- document LENGTH -- the ordering that looks plausible and ranks a long document
-- above a relevant one.
CREATE INDEX "release_embedding_vec_idx" ON "release_embedding" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "card_version_embedding_vec_idx" ON "card_version_embedding" USING hnsw ("embedding" vector_cosine_ops);
