-- T131: follows, pins and per-account support. Number assigned at dispatch
-- (D-131-03) so this and T190's `0005_notifications` cannot collide; shapes
-- ratified at D-131-08.
--
-- NEW TABLES AND ONE NEW TYPE. NO `ALTER TYPE`, AND THE SECTION'S OWN SENTENCE
-- SAYING OTHERWISE IS CORRECTED BY D-131-02. `target_kind` cannot name an
-- account as a target and `target_actor_kind` cannot name a follow as an act,
-- and the obvious fix -- adding a member to each -- is what T005 AC7's guard
-- exists to refuse: `tests/server/t005/existing.test.ts` reds any base enum
-- that "gained, lost or reordered a label", and its own comment names these two
-- as the exact temptation, because `target_kind` gaining a member widens what
-- every merged task's `target` rows may hold.
--
-- WHY `pin_kind` IS A NEW TYPE RATHER THAN A REUSE OF `target_kind`. Not only
-- because the latter is frozen. The pin union's arms are `blueprint` and
-- `node`; `target_kind`'s are `blueprint`, `card` and `term`. A different set
-- with a different member, so reusing it would store a pin under a label the
-- union does not have and admit two labels it does not carry.
--
-- NOT ONE COUNTER COLUMN ANYWHERE, WHICH IS THE POINT. `watchers` and `support`
-- are `count(*)` over the rows below. T130's AC1 -- inherited here unchanged --
-- is that anything countable is counted and never stored as a counter: a
-- counter column satisfies every criterion in the section and drifts silently
-- the first time an account is deleted, and nothing reds when it does.

CREATE TYPE "public"."pin_kind" AS ENUM('blueprint', 'node');

-- One row per (follower, followed). Both sides are accounts and there is no
-- polymorphic target row: a follow is not a thing done TO a blueprint, and
-- routing it through `target`/`target_actor` is what would have needed the
-- frozen enum.
--
-- `watchers` is the count of rows here for one `followed_id`. The UNIQUE index
-- IS the idempotency guarantee rather than an index on top of one -- T005's
-- reasoning for `save`, and the reason `toggleFollow` cannot double-count under
-- two concurrent callers the way a SELECT-then-INSERT would.
--
-- ON DELETE CASCADE ON BOTH SIDES, RATIFIED AT D-131-08 AS A CRITERION'S
-- OBSERVABILITY RATHER THAN A STYLE CHOICE. AC4 asks that the watcher count
-- equal the follower count, which is only a real criterion if a derived count
-- and an incremented counter can be told apart -- and the one fixture that
-- separates them is a follower's `account` row deleted behind the module's
-- back. With CASCADE a derived count drops and a counter does not. Without it
-- the delete raises 23503 instead, and a cell whose two outcomes mean opposite
-- things is not a measurement (`test/t130-profiles` `32556b7`,
-- `follow.test.ts`'s header, which reported the hole it could not close).
CREATE TABLE "follow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL REFERENCES "public"."account"("id") ON DELETE CASCADE,
	"followed_id" uuid NOT NULL REFERENCES "public"."account"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- At most two, which is what the two-column grid holds. `position` carries the
-- ORDER, which the union does not: `pinned` is an array and the first entry is
-- the first card drawn, so a set with no order would redraw a profile
-- differently on each read.
--
-- `ref` holds the discriminated union's payload and `kind` says how to read it:
-- a `blueprint` pin's `slug`, or a `node` pin's canonical `id@version`. The
-- union itself is `lib/data/profiles.ts:29`'s and is imported rather than
-- restated (D-131-01), so a drift between the two is a compile error rather
-- than an empty array.
--
-- WHAT THIS TABLE DELIBERATELY DOES NOT ENFORCE: that a pin resolves. AC3 makes
-- an unresolvable pin ABSENT from the read, so the fixture every AC3 cell needs
-- is a stored pin whose target is then removed -- and a foreign key, or a
-- write-time resolution check, would make that fixture unbuildable and the
-- criterion undrivable through the published surface (D-131-04, A7). `ref` is
-- therefore plain text with no reference, and resolution happens per actor in
-- `getProfile` where the criterion can be observed.
CREATE TABLE "profile_pin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL REFERENCES "public"."account"("id") ON DELETE CASCADE,
	"position" smallint NOT NULL,
	"kind" "public"."pin_kind" NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Community support for a PERSON. The subject is an account, which is what
-- separates this from every star in the archive: `lib/data/profiles.ts:41-44`
-- calls it "the same seeded figure `FavoriteStar` prints beside a blueprint"
-- and `ProfileHeader.tsx:174` places it "at the one place on the site where the
-- subject is a person rather than a bundle".
--
-- It is NOT the fold over this handle's items' stars. `ProfileShell.tsx:76-78`
-- computes that separately as `stars` and passes `support` through untouched,
-- so the two are different figures and conflating them is a defect rather than
-- a shortcut (D-131-05).
--
-- T150 could not hold it and this is not a second copy of its decision:
-- `CounterTargetKind` IS `target_kind`, which is frozen, so `toggleStar` cannot
-- name an account either. The door is shut on both sides.
CREATE TABLE "account_support" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supporter_id" uuid NOT NULL REFERENCES "public"."account"("id") ON DELETE CASCADE,
	"supported_id" uuid NOT NULL REFERENCES "public"."account"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "follow_follower_followed_key" ON "follow" USING btree ("follower_id","followed_id");
CREATE UNIQUE INDEX "profile_pin_account_position_key" ON "profile_pin" USING btree ("account_id","position");
CREATE UNIQUE INDEX "account_support_supporter_supported_key" ON "account_support" USING btree ("supporter_id","supported_id");

-- The counted direction. Both unique indexes above lead with the ACTING account
-- -- which is the column the idempotency guarantee needs -- and both counts read
-- the other one, so without these two every `watchers` and every `support` on
-- every profile read is a sequential scan. `run_report_account_id_idx` is the
-- merged precedent for exactly this shape.
CREATE INDEX "follow_followed_id_idx" ON "follow" USING btree ("followed_id");
CREATE INDEX "account_support_supported_id_idx" ON "account_support" USING btree ("supported_id");
