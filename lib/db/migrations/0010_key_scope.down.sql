-- Reverse of 0010_key_scope.up.sql. Exact inverse, in the mirror of the order
-- the up script built in: the column that USES the type goes first, then the
-- type itself, because a type cannot be dropped while a column is declared with
-- it and `DROP TYPE ... CASCADE` would silently take the column with it.
--
-- WHAT THIS LOSES, AND WHY IT IS NOTHING. Rolling back discards which scope each
-- key was minted with. That is a real fact and it is recoverable in the only
-- direction that matters: re-applying stamps every row 'read', which is the
-- SAFE reading of a key whose scope is no longer known. A rollback and a
-- re-apply therefore demotes any write key back to read rather than granting a
-- read key a write it never had. The lossy direction is the one that removes
-- authority, which is the direction a rollback should fail in.
--
-- No `IF EXISTS` on either statement. The pair is applied and rolled back as a
-- unit by `lib/db/migrate.ts` inside one transaction, so a half-applied state is
-- not reachable, and a guard against an impossible state hides the real fault
-- the day the state stops being impossible.
alter table "api_key" drop column "scope";
drop type "api_key_scope";
