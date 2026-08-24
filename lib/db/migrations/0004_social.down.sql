-- Reverse of 0004_social.up.sql.
--
-- THIS PAIR IS UNDER T005 AC6 AND THE STEPWISE HALF IS THE ONE THAT BITES.
-- `tests/server/t005/harness.ts:310` derives `t005Migrations` as every applied
-- id that is not `0001_init`, so this migration is in that set; then
-- `reversibility.test.ts` rolls the set back ONE STEP AT A TIME, asserting each
-- step moves exactly one, and re-applies -- comparing the full schema shape at
-- every level. So every object the up script creates has to be named here, and
-- "the next DROP TABLE would have taken it anyway" is not true of a type.
--
-- The indexes and the foreign keys go with the tables that carry them. The enum
-- does NOT: `pin_kind` lives outside any table, so a down script that drops
-- three tables and stops leaves a type behind that the next `migrateUp` meets
-- on its own `CREATE TYPE` -- the shape 0002's own header records for the
-- trigger function it has to drop by hand.
--
-- No CASCADE anywhere below. A `DROP ... CASCADE` reaches further than the
-- migration that wrote it, and the thing on the other end of every foreign key
-- here is `account` -- a table T000 shipped and eight merged tasks query.
-- `reversibility.test.ts` asserts exactly that in its own words.

DROP TABLE IF EXISTS "account_support";
DROP TABLE IF EXISTS "profile_pin";
DROP TABLE IF EXISTS "follow";

DROP TYPE IF EXISTS "public"."pin_kind";
