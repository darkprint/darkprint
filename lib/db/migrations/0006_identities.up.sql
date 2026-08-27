-- 0006 — federated sign-in identities.
--
-- `account.github_id` is NOT NULL and unique, and the ten base tables' column
-- shape is frozen by tests/server/t005/existing.test.ts with exactly one
-- licensed delta — so a second provider cannot be added by widening `account`.
-- This table carries identity instead, and `account` is left untouched.
--
-- One row per (provider, provider_id). The unique index is what makes a repeat
-- sign-in resolve to the SAME account rather than minting a second one, and it
-- is the constraint the upsert races against rather than a read-then-write.
create table account_identity (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_id text not null,
  account_id uuid not null references account(id),
  -- The verified address the provider asserted AT LINK TIME. Kept for the
  -- audit trail of why two identities were joined; never read as current.
  email text,
  created_at timestamptz not null default now()
);

create unique index account_identity_provider_key on account_identity (provider, provider_id);
create index account_identity_account_id_idx on account_identity (account_id);

-- Backfill: every account that exists today arrived through GitHub, so its
-- github_id IS its github identity. Done in the migration rather than by a
-- script so a database that has run 0006 is never half-migrated.
insert into account_identity (provider, provider_id, account_id, email)
select 'github', github_id, id, email from account;
