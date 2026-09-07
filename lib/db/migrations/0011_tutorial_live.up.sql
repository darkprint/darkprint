-- 0011 -- the live tutorial channel: one row per page a reader opened at
-- /tutorial/live/<token>, holding the last draft the blueprint-writing skill
-- posted for it.
--
-- ADDITIVE ONLY. One table and one index; nothing existing is touched, so the
-- frozen-shape guard over the base tables sees no delta.
--
-- WHY A TABLE AND NOT A CACHE. The skill posts from the author's machine and
-- the page polls from a browser, and on a serverless host those two requests
-- land on different instances with no memory in common. The row is the only
-- thing both can reach.
--
-- WHY THERE IS NO ACCOUNT COLUMN. The page is opened before the reader has an
-- account; that is the point of the tutorial. The token IS the authority: it
-- is 32 URL-safe characters from 24 random bytes, it names exactly one row,
-- and anyone holding it may read and overwrite that row until it expires.
--
-- `phase` is text rather than an enum. The phase vocabulary lives in
-- `lib/core/tutorial/live.ts` and the route validates against it before a
-- write; a second copy here would be one more list to keep in step, and this
-- table holds nothing a query needs to compare phases on.
--
-- `expires_at` has no default because the module computes it from the clock
-- it also compares against; a database default would put the write and the
-- read on two clocks. The index is for the sweep every open runs
-- (`delete ... where expires_at <= now`), which would otherwise scan the
-- whole table once the tutorial has had a few thousand readers.
create table "tutorial_draft" (
  "token" text primary key,
  "phase" text not null,
  "draft" jsonb not null,
  "revision" integer not null default 1,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "expires_at" timestamptz not null
);
create index "tutorial_draft_expires_at_idx" on "tutorial_draft" ("expires_at");
