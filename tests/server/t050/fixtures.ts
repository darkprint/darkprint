/* ============================================================
   T050 — fixtures and the database each suite owns

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── every fixture is built through a PUBLISHED surface ──
   D-70-22's lesson, and the reason it is worth restating here
   rather than citing: T070's blind suite "covered" the
   `released_at` trap only because a route fixture manufactured a
   row marked `status = 'released'` with a NULL `released_at` — a
   state the ruling says cannot occur. The impossible row made a
   broken predicate read the right way and the mutation was caught
   by accident, while no test exercised the real reclaimed state at
   all.

   So this file seeds NOTHING by hand. Accounts come from
   `upsertFromGitHub`, handles from `changeHandle`, releases and
   reclaims from `changeHandle` again — every row is one production
   supplies, by construction rather than by inspection. The cost is
   that a fixture depends on the module under test; the benefit is
   that no test can pass against a state production cannot reach.

   Where a premise has to hold before a test means anything, it is
   ASSERTED at seed time (see `withHandle`) rather than assumed, so
   a broken fixture reds as a broken fixture instead of quietly
   inverting a later result.

   ── handle state is observed through T070, not through a column ──
   `handle_reservation.released_at` is on no published return (R2),
   so a blind suite cannot read it without reaching past the
   barrel. It does not need to: T070 publishes `checkHandle`, and
   D-70-19 gives it the exact discriminator this suite needs —
   `active` answers `taken`, `released` answers `reserved`. That is
   a published surface of a merged dependency this task's
   `Depends on` line already names, so using it is a caller doing
   what a caller does.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { checkHandle } from "@/lib/server/naming";

import {
  type Scratch,
  bind,
  dropScratchDatabases,
  scratchDatabase,
} from "./contract";

export type { Scratch };

/** One scratch database per suite file; vitest gives each file its own worker. */
export async function openDatabase(): Promise<Scratch> {
  return scratchDatabase();
}

export async function closeDatabase(): Promise<void> {
  await dropScratchDatabases();
}

/* --------------------- names --------------------- */

let counter = 0;

/**
 * A handle nothing has claimed, legal under D-70-04's one grammar and short enough that no
 * length bound reaches it.
 *
 * Deliberately well under 32: T071 (`MAX_HANDLE_LENGTH = 32`) is `todo`, and a fixture near
 * either bound would make this whole suite change colour the day it merges. Nothing here
 * tests a length — T070 and T071 own that.
 */
export function freeHandle(): string {
  counter += 1;
  return `t050-h${counter}-${process.pid % 10000}`;
}

/** A GitHub subject nobody has signed in as. Keyed on the id, never on the login (AC3). */
export function freeGithubId(): string {
  return `gh-${randomUUID()}`;
}

export function freeGithubLogin(): string {
  counter += 1;
  return `octo-${counter}-${process.pid % 10000}`;
}

/**
 * A random token that cannot appear in any admissible message, planted as a caller's own
 * VALUE so a leak of it is a leak by provenance rather than by a curated list.
 *
 * Alphanumeric on purpose: T-04's SQLSTATE tells over-matched because a fixture's `process.pid`
 * could contain `23505`, and a tell that can occur naturally reds like a real leak. A 24-char
 * random token cannot arrive in a rendering except by the module putting it there.
 */
export function plantedSecret(): string {
  return `zq${randomUUID().replaceAll("-", "").slice(0, 22)}`;
}

/* --------------------- accounts, through the published surface --------------------- */

export interface SeededAccount {
  accountId: string;
  githubId: string;
  githubLogin: string;
}

/** A signed-in account with NO handle — exactly what the OAuth callback creates (AC1). */
export async function signIn(s: Scratch): Promise<SeededAccount> {
  const upsert = await bind("upsertFromGitHub");
  const githubId = freeGithubId();
  const githubLogin = freeGithubLogin();
  const answer = (await upsert(s.db, { githubId, githubLogin })) as {
    accountId?: unknown;
    handle?: unknown;
  };
  const accountId = answer?.accountId;
  if (typeof accountId !== "string" || accountId === "") {
    throw new Error(
      `upsertFromGitHub answered no \`accountId\`: ${JSON.stringify(answer)}\n` +
        `  published: { accountId: string; handle: string | null }`,
    );
  }
  if (answer.handle !== null) {
    throw new Error(
      `upsertFromGitHub on a NEW GitHub subject answered handle ${JSON.stringify(answer.handle)}, ` +
        `expected null.\n` +
        `  routes.md:56 — "upserts a bare \`account\` row keyed by GitHub id ... \`handle\` stays ` +
        `null until T070/T050 allocate one". A fixture whose premise is wrong inverts every test ` +
        `built on it, so it is asserted here rather than assumed.`,
    );
  }
  return { accountId, githubId, githubLogin };
}

/**
 * A signed-in account holding `handle`, allocated the only way T050 publishes: `changeHandle`.
 *
 * There is no second path. `allocateHandle` is T070's and takes no `Actor`; T050's surface
 * offers exactly one function that moves an account from `handle: null` to a handle, which is
 * a reading worth stating because AC1 ("a first sign-in with no handle cannot complete until
 * one is chosen and allocated") never names the function that completes it.
 */
export async function withHandle(
  s: Scratch,
  handle: string = freeHandle(),
): Promise<SeededAccount & { handle: string }> {
  const account = await signIn(s);
  const change = await bind("changeHandle");
  await change(s.db, { kind: "account", accountId: account.accountId, handle: null }, account.accountId, handle);

  /* The premise every handle test rests on, asserted at seed time through T070's own published
     query rather than trusted: after allocation the handle is held and answers `taken`
     (D-70-19, `status = 'active'`). A fixture that silently failed to allocate would make
     "a stranger cannot claim it" pass for the wrong reason. */
  const availability = await checkHandle(s.db as never, handle);
  if (availability.available !== false || availability.reason !== "taken") {
    throw new Error(
      `after changeHandle, \`checkHandle("${handle}")\` answered ` +
        `${JSON.stringify(availability)}; D-70-19 makes an ACTIVE handle answer ` +
        `\`{ available: false, reason: "taken" }\`.\n` +
        `  This is the fixture's own premise, checked so a later green cannot rest on an ` +
        `allocation that never happened.`,
    );
  }
  return { ...account, handle };
}

/* --------------------- observing handle state, through T070 --------------------- */

/** What every caller is told about a handle. D-70-19: `taken` = active, `reserved` = released. */
export async function availabilityOf(
  s: Scratch,
  handle: string,
): Promise<{ available: boolean; reason?: string; suggestion?: string }> {
  return checkHandle(s.db as never, handle);
}

/**
 * D-70-19's two live values for a handle, named so a red reads as a state rather than as a
 * shape. `undefined` where the answer is `available`.
 */
export async function handleStateOf(s: Scratch, handle: string): Promise<string | undefined> {
  const a = await availabilityOf(s, handle);
  return a.available ? undefined : a.reason;
}
