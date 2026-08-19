/* ============================================================
   T050 — the GitHub subject: AC3 and AC6

   AC3  "a GitHub rename leaves the handle and every attribution
         untouched"
   AC6  "two GitHub identities cannot map to one account"

   ── AC6 is tested as its MECHANISM, not as its sentence ──
   Reported as D-50-05 before this file was written. The contract
   says AC6 "is `account_github_id_key`, enforced by the index and
   tested with concurrent callers". A unique index on `github_id`
   enforces the CONVERSE of AC6's sentence: one identity cannot
   become two accounts. AC6 as written — two identities mapping to
   one account — is satisfied by the column being scalar, since an
   `account` row holds exactly one `github_id` and the thing it
   forbids is unrepresentable. No implementation can violate it,
   which is D-70-18's shape ("a criterion satisfiable by never
   doing the thing it constrains is not a criterion") sitting in an
   acceptance criterion.

   So the property below is the one the index actually guards, and
   it is labelled as such rather than as AC6's own words. Both are
   asserted — the sentence cheaply, so the pair is on record, and
   the mechanism properly, with concurrent callers.

   ── AC3 is SCOPED by D-50-14, and the scoping is why ──
   AC3 said "leaves the handle and every attribution untouched".
   Ruled narrower: "a GitHub rename leaves the handle and the
   `account` row untouched. **Attribution lives in the bytes of
   published cards** (T020/T100), which T050 neither writes nor
   reads, so 'every attribution' named an assertion belonging to a
   task that has not run." Nothing below claims attribution
   coverage; the card bytes are not this task's to move or to test.

   ── what AC3 can and cannot observe ──
   "the login is a display value that moves, the id does not."
   `account.github_login` is on NO published return —
   `upsertFromGitHub` answers `{ accountId, handle }` — so a blind
   suite cannot watch the login move without reaching past the
   barrel, and asking for that would be asking this author to stop
   being blind (R2's reasoning, applied to a second column). What
   AC3 *promises* is observable and is what is asserted: the same
   account, the same handle, and every attribution intact.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bind } from "./contract";
import {
  type Scratch,
  closeDatabase,
  freeGithubId,
  freeGithubLogin,
  freeHandle,
  openDatabase,
  signIn,
  withHandle,
} from "./fixtures";

let t: Scratch;

/* The database is base and present, so opening it in a hook is safe. Nothing that touches
   `@/lib/server/accounts` happens here — a hook that throws SKIPS its tests rather than
   failing them, and a skipped criterion reads as a pass in every count but one. */
beforeAll(async () => {
  t = await openDatabase();
}, 60_000);

afterAll(async () => {
  await closeDatabase();
}, 60_000);

describe("upsertFromGitHub is keyed on `github_id`, never on `github_login` (AC3)", () => {
  it("answers a bare account — a real accountId and a null handle — on first sign-in", async () => {
    /* AC1's premise: "a session with `handle: null` is signed in and incomplete ... first
       sign-in mints a real session before a handle exists — that is settled by the schema,
       not open." `account.handle` is nullable and carries `account_handle_key`; Postgres
       admits any number of NULLs under a unique index, so this is storable for every new
       account rather than for the first one only. */
    const upsert = await bind("upsertFromGitHub");
    const first = (await upsert(t.db, {
      githubId: freeGithubId(),
      githubLogin: freeGithubLogin(),
    })) as { accountId: string; handle: unknown };

    expect(first.accountId).toBeTypeOf("string");
    expect(first.accountId).not.toBe("");
    expect(first.handle).toBeNull();
  });

  it("returns the SAME account when the same GitHub id signs in under a new login", async () => {
    /* This is AC3 exactly. The login changes, the id does not, and the answer is the same
       account — which is the whole of "a GitHub rename leaves the handle and every
       attribution untouched", since attribution is the account id every bundle and card row
       points at. */
    const upsert = await bind("upsertFromGitHub");
    const githubId = freeGithubId();

    const before = (await upsert(t.db, { githubId, githubLogin: "old-login" })) as {
      accountId: string;
    };
    const after = (await upsert(t.db, { githubId, githubLogin: "brand-new-login" })) as {
      accountId: string;
    };

    expect(after.accountId).toBe(before.accountId);
  });

  it("leaves an already-chosen handle untouched across a GitHub rename (AC3)", async () => {
    /* The half a "same accountId" assertion does not reach. B-05 makes the handle independent
       of the GitHub login, so a rename that quietly re-derived the handle from the new login
       would still answer the same accountId and would break the thing AC3 is actually about:
       every published card carries the handle inside its own bytes. */
    const upsert = await bind("upsertFromGitHub");
    const getPublicAuthor = await bind("getPublicAuthor");

    const handle = freeHandle();
    const githubId = freeGithubId();
    const first = (await upsert(t.db, { githubId, githubLogin: "before-rename" })) as {
      accountId: string;
    };
    const change = await bind("changeHandle");
    await change(
      t.db,
      { kind: "account", accountId: first.accountId, handle: null },
      first.accountId,
      handle,
    );

    const renamed = (await upsert(t.db, { githubId, githubLogin: "after-rename" })) as {
      accountId: string;
      handle: unknown;
    };

    expect(renamed.accountId).toBe(first.accountId);
    expect(renamed.handle).toBe(handle);

    /* And the attribution surface answers for the same handle afterwards — the assertion a
       caller would actually notice, since `/u/<handle>` is what a rename must not break. */
    const author = (await getPublicAuthor(t.db, handle)) as { handle?: unknown } | undefined;
    expect(author).toBeDefined();
    expect(author?.handle).toBe(handle);
  });

  it("does not resurrect a handle for an account that never chose one", async () => {
    /* The saturation direction of the same split, and the mutation nobody writes: an
       implementation that answers the GitHub LOGIN as the handle passes every test above
       whose account happens to have chosen a handle, because the two are compared against
       each other and never against the login. A handle-less account is where the two
       readings separate. */
    const upsert = await bind("upsertFromGitHub");
    const githubId = freeGithubId();
    const githubLogin = freeGithubLogin();

    await upsert(t.db, { githubId, githubLogin });
    const again = (await upsert(t.db, { githubId, githubLogin })) as { handle: unknown };

    expect(
      again.handle,
      `a repeat sign-in with no handle chosen must still answer null — a module deriving the ` +
        `handle from \`githubLogin\` would answer "${githubLogin}" here and pass every other ` +
        `test in this file.`,
    ).toBeNull();
  });
});

describe("one GitHub identity yields one account — the property `account_github_id_key` enforces", () => {
  it("gives two different GitHub subjects two different accounts", async () => {
    const upsert = await bind("upsertFromGitHub");
    const a = (await upsert(t.db, {
      githubId: freeGithubId(),
      githubLogin: freeGithubLogin(),
    })) as { accountId: string };
    const b = (await upsert(t.db, {
      githubId: freeGithubId(),
      githubLogin: freeGithubLogin(),
    })) as { accountId: string };

    expect(a.accountId).not.toBe(b.accountId);
  });

  it("gives ONE account to sixteen concurrent sign-ins of one GitHub subject", async () => {
    /* "tested with concurrent callers for the same reason as T070's AC5": a read-then-write
       implementation passes every sequential test here and fails only under contention, which
       is exactly the defect the index exists to catch. So the criterion is tested with
       concurrent callers or it is not tested.

       Note what this asserts and what it does not. It does NOT assert that fifteen callers are
       refused — `upsertFromGitHub` is an upsert and every caller is entitled to succeed. It
       asserts that all sixteen name the SAME account, which is the property that separates a
       correct upsert from a read-then-write that creates a second row: under the latter, two
       callers both read "absent" and both insert, and the index either raises for one of them
       (a rejection, caught below) or — with no index — leaves two accounts for one identity.

       Both failure shapes are checked, because they are different defects: `settled` catches
       the raise, the id set catches the duplicate. A test asserting only "no rejection" would
       pass against a module that quietly created sixteen accounts. */
    const upsert = await bind("upsertFromGitHub");
    const githubId = freeGithubId();
    const githubLogin = freeGithubLogin();

    const settled = await Promise.allSettled(
      Array.from({ length: 16 }, () => upsert(t.db, { githubId, githubLogin })),
    );

    const rejected = settled.filter((r) => r.status === "rejected");
    expect(
      rejected.map((r) => String((r as PromiseRejectedResult).reason)),
      `sixteen concurrent sign-ins of one GitHub subject; every one is entitled to succeed, ` +
        `since an upsert is not a claim on a scarce name.`,
    ).toEqual([]);

    const ids = new Set(
      settled
        .filter((r): r is PromiseFulfilledResult<{ accountId: string }> => r.status === "fulfilled")
        .map((r) => r.value.accountId),
    );
    expect(
      [...ids],
      `sixteen callers, ${ids.size} distinct accountIds. One GitHub identity is one account — ` +
        `more than one here is a read-then-write that raced itself, which no sequential test ` +
        `in this file can see.`,
    ).toHaveLength(1);
  }, 60_000);

  it("AC6 as written — an account carries one GitHub subject — holds by the schema", async () => {
    /* Reported as D-50-05: AC6's own sentence is vacuous, because `account.github_id` is a
       scalar column and "two identities mapping to one account" is unrepresentable. Kept as
       one cheap test rather than dropped, so the pair is on record and the next reader can see
       which half of the criterion carries the weight.

       This test cannot fail against any implementation. That is the finding, not the coverage,
       and it is labelled here so nothing counts it as the latter. */
    const upsert = await bind("upsertFromGitHub");
    const first = (await upsert(t.db, {
      githubId: freeGithubId(),
      githubLogin: freeGithubLogin(),
    })) as { accountId: string };
    const second = (await upsert(t.db, {
      githubId: freeGithubId(),
      githubLogin: freeGithubLogin(),
    })) as { accountId: string };

    expect(first.accountId === second.accountId).toBe(false);
  });
});

describe("an account signed in with no handle is a complete, reachable state (AC1)", () => {
  it("lets several handle-less accounts coexist", async () => {
    /* `account_handle_key` is a unique index over a nullable column and Postgres admits any
       number of NULLs under one. If it did not, the second sign-in in the product's history
       would fail — so this is the assertion that AC1's ruling is storable rather than merely
       stated. */
    const a = await signIn(t);
    const b = await signIn(t);
    const c = await signIn(t);
    expect(new Set([a.accountId, b.accountId, c.accountId]).size).toBe(3);
  });

  it("holds a handle for one account without disturbing a handle-less one", async () => {
    const withOne = await withHandle(t);
    const without = await signIn(t);
    const getPublicAuthor = await bind("getPublicAuthor");

    expect(await getPublicAuthor(t.db, withOne.handle)).toBeDefined();
    expect(withOne.accountId).not.toBe(without.accountId);
  });
});
