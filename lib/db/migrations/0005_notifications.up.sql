-- T190: the notification queue and its unsubscribe tokens (D-190-01).
--
-- NUMBERED 0005 BY DISPATCH, not by counting the directory. T131 holds
-- `0004_social` and is in flight in another worktree, so the two in-flight tasks
-- cannot collide on a number. `loadMigrations` is a readdir plus an id sort, so
-- the gap this tree shows while 0004 is unmerged applies cleanly in both trees.
--
-- EXTENSION ONLY. Two new tables and one new enum type; nothing existing is
-- altered. `tests/server/t005/existing.test.ts` holds the delta over the ten base
-- tables to exactly AC7a's one licensed cell and compares the five base enums
-- label by label in declaration order -- a new type is admitted extension there,
-- an altered one is not, and `baseline.json` is untouched.
--
-- `account.notification_preferences` is NOT created here. T000 shipped it in
-- `0001_init` as `jsonb NOT NULL DEFAULT '{}'`, reserved for this task in
-- `schema.ts`'s own comment. Adding or altering it would be exactly the
-- base-table alteration the guard above refuses.
--
-- This migration is rolled back STEPWISE by a merged suite: `t005Migrations` is
-- every applied id except `0001_init` (`tests/server/t005/harness.ts:359`), so
-- `reversibility.test.ts` rolls this one back on its own and re-applies it. The
-- down script therefore drops only what this script created, and uses no
-- `DROP ... CASCADE` -- that file reds a down whose reach exceeds the migration
-- that owns it.
CREATE TYPE "notification_kind" AS ENUM ('repin', 'fork', 'deprecation', 'digest');

-- The row IS the idempotency (D-190-01). `enqueue` inserts and catches the
-- conflict on the unique key below, so a fan-out retried after a partial failure
-- writes nothing twice. A status column plus a counter passes a sequential test
-- and double-delivers under two concurrent workers, which is why there is no such
-- pair here.
--
-- `subject_digest` is `contentDigest(canonicalJson(subject))` -- both already
-- published from `@/lib/core`, so no digest is authored for this table.
-- `Record<string, string>` has no canonical byte form of its own; the key-sorted
-- serialisation is what makes two spellings of one subject collide.
--
-- `delivered_at` is the drain CURSOR and not a retry state machine (D-190-02):
-- written once, never counted, and answering only "has this been handed to the
-- mailer". Rows are retained after delivery, because deleting one would free its
-- unique key and let the same event enqueue again.
CREATE TABLE "notification_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"account_id" uuid NOT NULL REFERENCES "account"("id"),
	"subject" jsonb NOT NULL,
	"subject_digest" text NOT NULL,
	"delivered_at" timestamptz,
	"created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "notification_queue_kind_account_subject_key"
	ON "notification_queue" ("kind", "account_id", "subject_digest");

-- The drain's own query. Partial, so it holds what is still owed rather than
-- growing with every row ever delivered -- which is worth having precisely
-- because delivered rows are retained forever.
CREATE INDEX "notification_queue_pending_idx"
	ON "notification_queue" ("created_at") WHERE "delivered_at" IS NULL;

-- AC6, stored rather than signed (D-190-01): "no longer valid" needs revocation,
-- and a row deleted on use IS revocation. A signed token would put key management
-- on a task with no key owner and could never stop being valid.
--
-- Its own table rather than a column on the queue row (D-190-03): deleting a
-- token on use would take the queue row with it, and that row is the idempotency
-- key AC5 rests on.
--
-- Unique on (account_id, kind), so `enqueue` reuses one link per kind rather than
-- minting one per email. The link names the kind; `token` is opaque and this row
-- is the only thing that resolves it to an account.
CREATE TABLE "unsubscribe_token" (
	"token" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL REFERENCES "account"("id"),
	"kind" "notification_kind" NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "unsubscribe_token_account_kind_key"
	ON "unsubscribe_token" ("account_id", "kind");
