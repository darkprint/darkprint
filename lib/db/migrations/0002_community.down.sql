-- Reverse of 0002_community.up.sql. Table drops in dependency order (children before
-- the parents they reference) so this runs cleanly without CASCADE, mirroring
-- 0001_init.down.sql.
--
-- AC6's standard is that applying, rolling back and applying again leaves a
-- structurally identical schema — compared against the database, never by reading
-- this file. So every object the up script creates is named here, including the two
-- a `DROP TABLE` would not reach: the trigger function, which lives outside any
-- table, and the NOT NULL below. This migration adds no enum type — D-05-02 ruled
-- the ballot wide, so its metrics are columns and there is no `ballot_metric` to drop.

-- Dropping the table drops its trigger; the function it calls survives and would
-- collide on a re-apply.
DROP TRIGGER IF EXISTS "run_report_release_exists_trigger" ON "run_report";
DROP FUNCTION IF EXISTS "run_report_release_exists"();

DROP TABLE IF EXISTS "note_vote";
DROP TABLE IF EXISTS "note";
DROP TABLE IF EXISTS "save";
DROP TABLE IF EXISTS "run_report";
DROP TABLE IF EXISTS "ballot";
DROP TABLE IF EXISTS "api_key";

-- AC7a, reversed. Restoring the nullability matters more than it looks: without it a
-- rollback to 0001 leaves a schema that is *not* the schema 0001 produces, and AC6's
-- structural comparison is the only thing that would ever notice.
ALTER TABLE "handle_reservation" ALTER COLUMN "account_id" DROP NOT NULL;
