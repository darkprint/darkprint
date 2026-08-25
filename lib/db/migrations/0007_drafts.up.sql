-- 0007 -- drafts: GitHub-style creation (T280, "Drafts + visibility").
--
-- ADDITIVE ONLY, and that is the whole of this migration: five nullable columns
-- on the existing `bundle` table, no new table, no new type, no column altered
-- or dropped.
--
-- `bundle` details travel with the bundle rather than waiting for a release
-- (B-06's "a bundle first exists at its first publish" is relaxed by this
-- migration, not replaced: a bundle may now also first exist at draft creation,
-- the GitHub empty-repo analogy). Every column is nullable because every bundle
-- `publish()` still creates directly -- the whole existing archive, and every
-- bundle these five columns will ever describe once it has a release -- carries
-- none of them: a release's own manifest stays the authoritative title/summary
-- once one exists, and this column set is not a second copy of it. A
-- release-first bundle's five columns stay NULL forever, which is exactly what
-- "release-first" has always looked like on this table.
--
-- REPORTED RATHER THAN SILENTLY AVOIDED: `bundle` is one of the ten tables
-- `tests/server/t005/existing.test.ts` freezes against `baseline.json`
-- (BASE_TABLES), and every migration since T005 (0004, 0005, 0006) deliberately
-- shipped extension-only -- new tables, new enum members never -- to keep that
-- guard's delta at exactly AC7a's one licensed cell. This migration is the
-- alteration that guard exists to catch, added anyway because T280's contract
-- names this exact table and these five exact columns. `tests/server/t005/**`
-- is not this task's `Owns`, so the fix (a new licensed delta in `baseline.json`,
-- or a ruling that the freeze no longer holds past T005) is the orchestrator's.
alter table "bundle" add column "title" text;
alter table "bundle" add column "summary" text;
alter table "bundle" add column "description" text;
alter table "bundle" add column "category" text;
alter table "bundle" add column "tags" text[];
