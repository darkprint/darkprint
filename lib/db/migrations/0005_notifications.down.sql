-- Reverses 0005_notifications, and reaches no further than it.
--
-- No `DROP ... CASCADE`: `tests/server/t005/reversibility.test.ts` rolls every
-- non-base migration back on its own and reds a down script that reaches past the
-- migration that owns it. Every object below was created by 0005 and by nothing
-- else -- the indexes and the foreign keys go with the tables that carry them, and
-- the enum type drops last because both tables reference it.
--
-- `account.notification_preferences` is NOT touched. It is `0001_init`'s column,
-- and dropping it here would make this reversal a reversal of base's work.
DROP TABLE IF EXISTS "unsubscribe_token";
DROP TABLE IF EXISTS "notification_queue";
DROP TYPE IF EXISTS "notification_kind";
