/* ============================================================
   DarkPrint backend — federated identities and the linking policy

   `upsertFromGitHub` predates this file and resolves ONE provider
   by writing `account.github_id`. A second provider cannot be added
   that way: `github_id` is NOT NULL and unique, and the ten base
   tables' column shape is frozen by `tests/server/t005/existing.
   test.ts`. So `account_identity` (0006) carries identity, and this
   file is the one place that decides which account a provider
   identity resolves to.

   ── THE LINKING POLICY, and it is one function ──
   `resolveFromProvider` implements LINK BY VERIFIED EMAIL: signing
   in with Google using an address that already belongs to an
   account joins that account rather than minting a second one. The
   alternatives — always separate, or link only after an explicit
   confirmation screen — differ from this file ONLY inside
   `accountForIdentity`, which is why the decision lives in a named
   function rather than being spread through a callback route.

   **Why the `verified` flag is load-bearing rather than
   defensive.** Linking on an address a provider has not proved is a
   documented account-takeover route: register `you@example.com` at
   any provider that will assert it unverified, sign in, and land
   inside the existing account. So an unverified address never
   links. It falls through to "new account", which is recoverable —
   a duplicate account is an annoyance, and a stranger inside your
   account is not.

   ── the order of the three questions ──
   1. Has this exact (provider, provider_id) been seen? Then it is
      that account, whatever the email says now. An address can move
      between people; a subject id does not.
   2. Otherwise, does a VERIFIED address match an existing account?
      Then link.
   3. Otherwise, mint an account and its first identity.
   Asking (2) before (1) would re-point an established identity at
   another account the day somebody changed their address.
   ============================================================ */

import { eq, and } from "drizzle-orm";

import { schema, type Db } from "@/lib/db";
import { AccountStoreError, accountStoreError } from "./errors";

export type Provider = "github" | "google";

export interface ProviderIdentity {
  provider: Provider;
  /** The provider's stable subject id. Never an email. */
  providerId: string;
  /** A display login used to seed nothing but `github_login`'s legacy column. */
  login: string;
  email: string | null;
  /** Whether the PROVIDER proved the address. Only a proven address may link (see header). */
  emailVerified: boolean;
}

export interface ResolvedAccount {
  accountId: string;
  handle: string | null;
  /** True when this sign-in attached a new provider to an account that already existed. */
  linked: boolean;
}

/**
 * The account behind a provider identity: the one it already names, the one its verified
 * address already belongs to, or a new one.
 *
 * Answers what a session needs — the account id and whether a handle has been chosen —
 * exactly as `upsertFromGitHub` does, so a callback route's shape does not change per
 * provider.
 */
export async function resolveFromProvider(db: Db, identity: ProviderIdentity): Promise<ResolvedAccount> {
  /* Before a connection is opened, matching `upsertFromGitHub`'s door: an empty subject id
     is a malformed identity, and `AccountStoreError` is the sanctioned form (D-50-17). */
  if (identity.providerId.length === 0) {
    throw accountStoreError("resolveFromProvider", new Error("providerId is empty"));
  }

  try {
    /* (1) An identity already seen resolves to its own account, whatever the email is now. */
    const [existing] = await db
      .select({ accountId: schema.accountIdentity.accountId })
      .from(schema.accountIdentity)
      .where(
        and(
          eq(schema.accountIdentity.provider, identity.provider),
          eq(schema.accountIdentity.providerId, identity.providerId),
        ),
      )
      .limit(1);

    if (existing !== undefined) {
      const account = await accountRow(db, existing.accountId);
      return { accountId: account.id, handle: account.handle, linked: false };
    }

    /* (2) and (3): find an account to link to, or mint one. */
    const target = await accountForIdentity(db, identity);

    /* The link itself. `onConflictDoNothing` rather than a plain insert: two concurrent
       first sign-ins for one identity both reach here, and the unique index is what makes
       exactly one of them win. The loser re-reads below rather than raising, because both
       callers are the same person signing in twice and both deserve a session. */
    await db
      .insert(schema.accountIdentity)
      .values({
        provider: identity.provider,
        providerId: identity.providerId,
        accountId: target.accountId,
        email: identity.email,
      })
      .onConflictDoNothing();

    const [settled] = await db
      .select({ accountId: schema.accountIdentity.accountId })
      .from(schema.accountIdentity)
      .where(
        and(
          eq(schema.accountIdentity.provider, identity.provider),
          eq(schema.accountIdentity.providerId, identity.providerId),
        ),
      )
      .limit(1);

    if (settled === undefined) {
      throw accountStoreError("resolveFromProvider", new Error("the identity insert left no row"));
    }

    const account = await accountRow(db, settled.accountId);
    return { accountId: account.id, handle: account.handle, linked: target.linked };
  } catch (err) {
    if (err instanceof AccountStoreError) throw err;
    /* D-13: a driver fault must not leave carrying the statement and its parameters. */
    throw accountStoreError("resolveFromProvider", err);
  }
}

/**
 * **THE LINKING DECISION.** Change this function to change the policy; nothing else in the
 * codebase encodes it.
 *
 * Today: a VERIFIED address matching an existing account links to it, and anything else
 * mints a new account. See this file's header for why unverified never links.
 */
async function accountForIdentity(
  db: Db,
  identity: ProviderIdentity,
): Promise<{ accountId: string; linked: boolean }> {
  if (identity.email !== null && identity.emailVerified) {
    const [match] = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(eq(schema.account.email, identity.email))
      .limit(1);
    if (match !== undefined) return { accountId: match.id, linked: true };
  }

  /* A new account. `github_id` is NOT NULL and unique and cannot be widened (see the
     header), so a non-GitHub first provider stores a NAMESPACED value there — inert,
     because `account_identity` is what every sign-in resolves against, and collision-free
     because a real GitHub id is digits. `lib/server/seed/run.ts` set the same precedent
     when it wrote "0" for the registry actor. */
  const legacyId =
    identity.provider === "github" ? identity.providerId : `${identity.provider}:${identity.providerId}`;

  const [created] = await db
    .insert(schema.account)
    .values({
      githubId: legacyId,
      githubLogin: identity.login,
      /* The address is stored so a later provider can link to it, and because the account
         page has nowhere else to get one. It is NOT marked verified anywhere: this codebase
         has no verified-email column, and inventing the claim here would put a fact in the
         database that nothing checked. */
      ...(identity.email === null ? {} : { email: identity.email }),
    })
    .onConflictDoUpdate({
      target: schema.account.githubId,
      set: { githubLogin: identity.login, updatedAt: new Date() },
    })
    .returning({ id: schema.account.id });

  if (created === undefined) {
    throw accountStoreError("resolveFromProvider", new Error("the account upsert returned no row"));
  }
  return { accountId: created.id, linked: false };
}

async function accountRow(db: Db, accountId: string): Promise<{ id: string; handle: string | null }> {
  const [row] = await db
    .select({ id: schema.account.id, handle: schema.account.handle })
    .from(schema.account)
    .where(eq(schema.account.id, accountId))
    .limit(1);
  if (row === undefined) {
    /* An identity pointing at an account that is gone. The foreign key makes this
       unreachable today; it is raised as a fault rather than dereferenced as undefined. */
    throw accountStoreError("resolveFromProvider", new Error("the identity names no account"));
  }
  return row;
}
