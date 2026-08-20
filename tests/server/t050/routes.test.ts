/* ============================================================
   T050 — the five routes D-50-03 published

     GET   /api/account                    -> 200 AccountRecord | 401
     PATCH /api/account/profile            -> 200 | 400 401 403
     PATCH /api/account/handle             -> 200 | 400 401 409
     PATCH /api/account/email              -> 200 | 400 401 403
     PATCH /api/account/default-visibility -> 200 | 400 401 403

   `app/api/account/**` sat in `Owns` with nothing published —
   fourth instance of that defect in this run, and it cost T070 a
   round as D-70-03. This whole file is coverage that arrived after
   the contract, which is the shape D-70-12 re-opened a blind suite
   to fix; the difference here is that it arrived before any code.

   `docs/architecture/seams.md` carried a CONTRADICTING second
   reading — `{ ok, verificationSent }` payloads, a `DELETE
   /api/account` that is T120's, a `GET /api/auth/me` the tree
   never had — and `CLAUDE.md` makes that document binding, so a
   blind author could have bound to it in good faith. It is marked
   superseded above its own rows. Nothing here reads it: every
   expectation below comes from the contract's own route block.

   ── the four SHIPPED auth routes are not driven here ──
   They are base, they are in T050's `Owns`, and this author never
   opened them — reading today's source of a file this task may
   rewrite would bind the suite to a shape nobody promised to keep.
   `tests/server/session.test.ts` already holds T000's AC3 against
   `/api/auth/session`, so nothing is uncovered by leaving them
   alone; what would be new is a claim about how T050 changes them,
   and the contract makes no such claim.

   ── each route gets its own database, pointed at by name ──
   A route handler takes its `Db` from `getSharedDbClient()`, which
   reads `DATABASE_URL`. So the variable is repointed at this
   file's scratch database before any route module loads, and
   restored at teardown. vitest gives each file its own worker, so
   the repoint is scoped here.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { getSharedDbClient } from "@/lib/db";

import {
  HANDLE_REQUIRED_TYPE,
  PROBLEM_BASE,
  ROUTES,
  ROUTE_NAMES,
  UNAUTHORIZED_TYPE,
  WRITE_ROUTES,
  assertAccountRecordKeys,
  assertProblem,
  callRoute,
  isServed,
  servedPatterns,
  sessionCookie,
} from "./contract";
import {
  type Scratch,
  closeDatabase,
  freeHandle,
  handleStateOf,
  openDatabase,
  signIn,
  withHandle,
} from "./fixtures";

const BACKEND_MD = fileURLToPath(new URL("../../../backend.md", import.meta.url));

let t: Scratch;
let originalDatabaseUrl: string | undefined;

beforeAll(async () => {
  t = await openDatabase();
  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = t.url;
}, 60_000);

afterAll(async () => {
  /* Closed before the variable is restored, so the pool that gets shut is the scratch one and
     not a fresh handle on the shared development database. */
  try {
    await getSharedDbClient().close();
  } catch {
    /* Teardown is not under test: a route module that never loaded left no pool to close. */
  }
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  await closeDatabase();
}, 60_000);

describe("the five published URLs are served", () => {
  for (const name of ROUTE_NAMES) {
    it(`serves ${ROUTES[name].method} ${ROUTES[name].path}`, () => {
      /* Asked without importing a module or opening a database, so a red says the URL is
         unserved rather than that a request failed. */
      expect(
        isServed(ROUTES[name].path),
        `discovered under app/api/account/: ${servedPatterns().join(", ") || "(nothing)"}`,
      ).toBe(true);
    });
  }

  it("serves no route under app/api/account/ that no task claims", () => {
    /*
     * This asked the wrong question until T140's implementer measured it against real routes.
     *
     * It compared every served pattern under `app/api/account/` against T050's five and called
     * the difference "a partition breach". But `Forbidden` in T050's section means *forbidden to
     * T050* — `app/api/account/{notifications,saves,delete,keys}/**` are T190's, T140's, T120's
     * and T230's `Owns`. **Treating "not mine" as "must not exist" is a different claim**, and
     * under it the guard reds for each of those four tasks the moment its own granted route
     * lands: T140's `/api/account/saves` and `/api/account/saves/migrate` reded it at `ecd6b29`,
     * and T230's `app/api/account/keys/**` is the next one queued.
     *
     * That is `## A guard must not demand what its own reader is forbidden to write` — the
     * reader here would have met a red in a merged blind suite, naming a partition breach, in a
     * file it may not edit, against a path its own `Owns` grants. The cheap reading is *my route
     * is in the wrong place* and the cheap fix is to move a route the contract publishes.
     *
     * So the criterion is now what it always meant: **a served route under this tree belongs to
     * SOME task**. T050's five, or a path some section's `Owns` line claims. The domain is
     * derived from `backend.md` rather than from a list here, so the next task granted a subtree
     * is covered the day its row says so and this file is not edited again.
     *
     * Fails CLOSED: if no `app/api/account/` claim is found anywhere in the document, the parse
     * broke and that is an error, not an empty exemption set.
     */
    const md = readFileSync(BACKEND_MD, "utf8");
    const claimed = md
      .split(/^### /m)
      .slice(1)
      .flatMap((section) => {
        if (!/^T\d{3},/.test(section)) return [];
        /* Contract only, never the Log — a Log entry quoting a path is a record of what happened,
           not a declaration of what the task owns. Same rule as `wave-dependencies`. */
        const owns = /- \*\*Owns:\*\* (.*)$/m.exec(section.split("- **Log:**")[0] ?? "")?.[1] ?? "";
        return [...owns.matchAll(/`(app\/api\/account\/[^`]*)`/g)].map((m) => m[1]!);
      })
      /*
       * A subtree claim and a single-file claim are NOT the same shape, and collapsing them
       * into one string is a bug this guard was written with and caught in its own falsification.
       *
       * `app/api/account/saves/**` claims `/api/account/saves` **and everything under it**.
       * `app/api/account/route.ts` claims `/api/account` **and nothing under it** — T050's `Owns`
       * enumerates five exact route FILES rather than a subtree (`lib/server/accounts/http.ts`
       * says so and explains why). Normalising both to a bare string and prefix-matching made
       * `/api/account` swallow the whole tree, so an unclaimed `/api/account/zzz` went green.
       * **The narrowest claim in the document subsumed every other**, and the falsification that
       * had red a moment earlier stopped redding — which is the only reason it was noticed.
       */
      .map((glob) => {
        const withoutApp = glob.replace(/^app/, "");
        return withoutApp.endsWith("/route.ts")
          ? { pattern: withoutApp.replace(/\/route\.ts$/, ""), subtree: false }
          : { pattern: withoutApp.replace(/\/\*+$/, "").replace(/\/$/, ""), subtree: true };
      });

    expect(
      claimed.length,
      "No `app/api/account/...` path was found in any task's Owns line in backend.md. Either the " +
        "Owns format moved or the section split did — both make the assertion below vacuous, and " +
        "a vacuous version of this check passes every unclaimed route.",
    ).toBeGreaterThan(0);

    const published = new Set<string>(ROUTE_NAMES.map((n) => ROUTES[n].path));
    const unclaimed = servedPatterns().filter(
      (p) =>
        !published.has(p) &&
        !claimed.some((c) => p === c.pattern || (c.subtree && p.startsWith(`${c.pattern}/`))),
    );
    expect(
      unclaimed,
      "A route is served under app/api/account/ and no task's Owns line claims it. This is not " +
        "about T050: a path that belongs to nobody is a route whose contract, error surface and " +
        "auth rule have no author. Add it to the owning task's Owns in backend.md, or move it " +
        "under a tree that is claimed. Claimed today: " +
        claimed.map((c) => (c.subtree ? `${c.pattern}/**` : c.pattern)).join(", "),
    ).toEqual([]);
  });
});

describe("AC5 — reading the account without a session is problem+json 401, never a fixture", () => {
  it("answers 401 with all five RFC 9457 members and no body from the handler", async () => {
    const answer = await callRoute("account");
    const body = assertProblem(
      answer,
      { status: 401, type: UNAUTHORIZED_TYPE, instance: ROUTES.account.path },
      "GET /api/account, cookieless",
    );

    /* "never a fixture" is the operative half. `lib/data/account.ts` seeds Mara Veiga as the
       signed-in account for every inert frontend surface, and the failure this criterion names
       is a route reaching for it when there is no session. Checked by name, since that is the
       one fixture a route could plausibly fall back to. */
    expect(answer.body).not.toContain("mara");
    expect(answer.body).not.toContain("Veiga");
    expect(body.detail).toBeTypeOf("string");
  });

  it("answers 401 for a cookie that does not verify, exactly as for none at all", async () => {
    /* A forged or tampered cookie and an absent one are one answer — `decodeSession` returns
       `undefined` for both and never throws, so a route branching on the difference would be
       inventing a third state. The two are compared whole, because a difference in `detail` or
       in member order tells an attacker their forgery parsed. */
    const none = await callRoute("account");
    const forged = await callRoute("account", { cookie: "darkprint_session=not.a.real.token" });

    expect(forged.status).toBe(401);
    expect(forged.body).toBe(none.body);
  });

  it("answers 200 with the AccountRecord for a signed-in owner", async () => {
    const account = await withHandle(t);
    const answer = await callRoute("account", {
      cookie: sessionCookie(account.accountId, account.handle),
    });

    expect(answer.status, `body: ${answer.body.slice(0, 300)}`).toBe(200);
    const record = assertAccountRecordKeys(answer.json, "GET /api/account");
    expect(record.accountId).toBe(account.accountId);
  });

  it("answers 200 for a signed-in account that has no handle yet (AC1)", async () => {
    /* Reading is not writing. AC1's 403 governs the routes that WRITE something owned by an
       account; a handle-less caller reading its own record is exactly the caller the settings
       page has to serve in order to tell it to pick a handle. A route applying the
       handle-required guard uniformly locks that user out of the only page that can fix it. */
    const account = await signIn(t);
    const answer = await callRoute("account", { cookie: sessionCookie(account.accountId, null) });

    expect(answer.status, `body: ${answer.body.slice(0, 300)}`).toBe(200);
    const record = assertAccountRecordKeys(answer.json, "GET /api/account, handle-less");
    expect((record.author as Record<string, unknown>).handle).toBeNull();
  });
});

describe("AC1 — a handle-requiring route refuses a handle-less session with 403", () => {
  /* "It refuses with `problem+json` 403 and `type`
     `https://darkprint.io/problems/handle-required`, which is distinguishable from 401 (no
     session at all) and from 404 (a resource you may not see)."

     The `.io` base is D-50-01's ruling: the contract's own AC1 paragraph still says
     `darkprint.dev`, which occurs once in the whole repository, while six live responses and
     `lib/server/http/problem.ts:8` carry `.io`. The code won. */

  for (const route of WRITE_ROUTES.filter((r) => !r.acceptsHandlelessSession)) {
    it(`\`PATCH ${ROUTES[route.name].path}\` answers 403 handle-required`, async () => {
      const account = await signIn(t);
      const answer = await callRoute(route.name, {
        cookie: sessionCookie(account.accountId, null),
        body: route.body(),
      });

      assertProblem(
        answer,
        { status: 403, type: HANDLE_REQUIRED_TYPE, instance: ROUTES[route.name].path },
        `PATCH ${ROUTES[route.name].path}, handle-less session`,
      );
    });
  }

  it("`PATCH /api/account/handle` accepts a handle-less session, or AC1 is unreachable", async () => {
    /* D-50-05, and the asymmetry that makes the criterion satisfiable at all: this is the route
       that allocates the first handle, so requiring one to reach it would mean no account could
       ever get one. The uniform implementation — one guard applied to every write — is the
       natural one and is wrong exactly here. */
    const account = await signIn(t);
    const handle = freeHandle();
    const answer = await callRoute("handle", {
      cookie: sessionCookie(account.accountId, null),
      body: { handle },
    });

    expect(
      answer.status,
      `a handle-less session must reach this route. body: ${answer.body.slice(0, 300)}`,
    ).toBe(200);
    const record = assertAccountRecordKeys(answer.json, "PATCH /api/account/handle");
    expect((record.author as Record<string, unknown>).handle).toBe(handle);
  });

  it("403 is distinguishable from the 401 a cookieless caller gets", async () => {
    /* The criterion names the distinction explicitly, so it is asserted as a distinction rather
       than as two independent statuses. A route answering 401 for both cases satisfies every
       "is it refused?" test and tells a signed-in user to sign in again, forever. */
    const account = await signIn(t);
    const cookieless = await callRoute("profile", { body: { displayName: "x" } });
    const handleless = await callRoute("profile", {
      cookie: sessionCookie(account.accountId, null),
      body: { displayName: "x" },
    });

    expect(cookieless.status).toBe(401);
    expect(handleless.status).toBe(403);
    expect((cookieless.json as Record<string, unknown>).type).toBe(UNAUTHORIZED_TYPE);
    expect((handleless.json as Record<string, unknown>).type).toBe(HANDLE_REQUIRED_TYPE);
  });

  it("refuses the handle-less write BEFORE it writes anything", async () => {
    /* A 403 returned after the write is a 403 in name only, and nothing about the response
       shows it. Checked through a second route rather than through the database, so the
       observation stays on the published surface. */
    const account = await signIn(t);
    await callRoute("email", {
      cookie: sessionCookie(account.accountId, null),
      body: { email: "should-not-land@example.test" },
    });

    const handle = freeHandle();
    await callRoute("handle", {
      cookie: sessionCookie(account.accountId, null),
      body: { handle },
    });
    const read = await callRoute("account", { cookie: sessionCookie(account.accountId, handle) });

    expect(read.status).toBe(200);
    expect((read.json as Record<string, unknown>).email).toBeNull();
  });
});

describe("every write route refuses a cookieless caller with 401", () => {
  for (const route of WRITE_ROUTES) {
    it(`\`PATCH ${ROUTES[route.name].path}\` answers 401`, async () => {
      const answer = await callRoute(route.name, { body: route.body() });
      assertProblem(
        answer,
        { status: 401, type: UNAUTHORIZED_TYPE, instance: ROUTES[route.name].path },
        `PATCH ${ROUTES[route.name].path}, cookieless`,
      );
    });
  }
});

describe("PATCH /api/account/handle re-mints the session cookie (D-50-06)", () => {
  it("returns a `set-cookie` carrying the new handle", async () => {
    /* The consequence of a stateless token that T000 recorded only half of. `handle` lives
       INSIDE the signed token, `withSession` never reads the database, and `Max-Age` is 30
       days — so without a re-mint an account that just allocated its first handle stays 403'd
       out of every route it just qualified for, for a month, and every downstream reader of
       `session.handle` (T100, T130, T262) sees the stale value.

       The cookie's presence is asserted here; that it actually carries the new handle is
       asserted below by USING it, because a `set-cookie` header is easy to emit and hard to
       emit correctly. */
    const account = await signIn(t);
    const answer = await callRoute("handle", {
      cookie: sessionCookie(account.accountId, null),
      body: { handle: freeHandle() },
    });

    expect(answer.status).toBe(200);
    expect(
      answer.setCookie,
      `no \`set-cookie\` on a successful handle allocation. The session token is where ` +
        `\`handle\` lives, and nothing else refreshes it inside 30 days.`,
    ).toBeTruthy();
    expect(answer.setCookie).toContain("darkprint_session=");
  });

  it("issues a cookie that immediately passes the handle-required guard", async () => {
    /* Driven rather than parsed: the re-minted cookie is fed straight back into a route that
       403s a handle-less session. A `set-cookie` carrying the OLD payload, or one carrying a
       token signed with the wrong secret, emits a header and fails here — which is the
       difference between the route doing the thing and the route appearing to. */
    const account = await signIn(t);
    const allocated = await callRoute("handle", {
      cookie: sessionCookie(account.accountId, null),
      body: { handle: freeHandle() },
    });
    expect(allocated.status).toBe(200);

    const raw = allocated.setCookie ?? "";
    const value = raw.split(";")[0] ?? "";
    expect(value.startsWith("darkprint_session=")).toBe(true);

    const next = await callRoute("profile", { cookie: value, body: { displayName: "Now Allowed" } });
    expect(
      next.status,
      `the re-minted cookie did not satisfy the handle-required guard. ` +
        `body: ${next.body.slice(0, 300)}`,
    ).toBe(200);
  });

  it("re-mints on a RENAME too, not only on the first allocation", async () => {
    /* The stale value is worse after a rename than after a first allocation: the token names a
       handle the account no longer holds, so every downstream reader attributes new work to a
       handle that is now reserved and ownerless. A module re-minting only when the old handle
       was null passes the two tests above. */
    const account = await withHandle(t);
    const next = freeHandle();
    const answer = await callRoute("handle", {
      cookie: sessionCookie(account.accountId, account.handle),
      body: { handle: next },
    });

    expect(answer.status).toBe(200);
    expect(answer.setCookie).toBeTruthy();

    const value = (answer.setCookie ?? "").split(";")[0] ?? "";
    const read = await callRoute("account", { cookie: value });
    expect(read.status).toBe(200);
    expect(
      ((read.json as Record<string, unknown>).author as Record<string, unknown>).handle,
    ).toBe(next);
  });
});

describe("the statuses the route block publishes for a bad request", () => {
  it("answers 409 when the handle another account holds is requested", async () => {
    /* `HandleTakenError` -> 409 via `conflict()` (D-50-08). 409 and not 400: the request is
       well-formed and the name is unavailable, which is a state of the world rather than a
       fault in what was sent, and a client retries the two differently. */
    const account = await withHandle(t);
    const occupied = await withHandle(t);
    const answer = await callRoute("handle", {
      cookie: sessionCookie(account.accountId, account.handle),
      body: { handle: occupied.handle },
    });

    expect(answer.status, `body: ${answer.body.slice(0, 300)}`).toBe(409);
    expect(answer.contentType).toContain("application/problem+json");
    expect(await handleStateOf(t, account.handle)).toBe("taken");
  });

  it("answers 400 for a handle that fails the grammar", async () => {
    /* `InvalidNameError` -> 400 via `badRequest()`. The name is malformed, so it is the request
       that is wrong. No length is used to trigger this — D-70-04's grammar is a single URL
       segment, so a slash is ill-formed at any length and stays ill-formed the day T071 lands
       a length bound. */
    const account = await withHandle(t);
    const answer = await callRoute("handle", {
      cookie: sessionCookie(account.accountId, account.handle),
      body: { handle: "not/one/segment" },
    });

    expect(answer.status, `body: ${answer.body.slice(0, 300)}`).toBe(400);
    expect(answer.contentType).toContain("application/problem+json");
  });

  it("answers 400 for a body that is not the published shape", async () => {
    const account = await withHandle(t);
    const answer = await callRoute("profile", {
      cookie: sessionCookie(account.accountId, account.handle),
      body: { avatarHue: 40000 },
    });

    expect(answer.status, `body: ${answer.body.slice(0, 300)}`).toBe(400);
    expect(answer.contentType).toContain("application/problem+json");
  });

  it("carries no driver prose or caller value in any problem body", async () => {
    /* The whitelist, at the transport. D-07 is why: T000's callback leaked
       `"GITHUB_CLIENT_SECRET is not set"` into a 502 body because the message went straight
       through, and a route is the last place a module's care about renderings can be undone. */
    const account = await withHandle(t);
    const occupied = await withHandle(t);

    const answers = [
      await callRoute("handle", {
        cookie: sessionCookie(account.accountId, account.handle),
        body: { handle: occupied.handle },
      }),
      await callRoute("profile", {
        cookie: sessionCookie(account.accountId, account.handle),
        body: { avatarHue: 40000 },
      }),
      await callRoute("account"),
    ];

    for (const answer of answers) {
      const lowered = answer.body.toLowerCase();
      for (const tell of ["insert into", "update ", "select ", "$1", "drizzlequeryerror", "23505", "22003"]) {
        expect(lowered, `a problem body carried \`${tell}\`: ${answer.body.slice(0, 300)}`).not.toContain(
          tell,
        );
      }
    }
  });
});

describe("every problem type this task emits sits under the shipped base", () => {
  /* ── THE ONE TEST IN THIS SUITE THAT IS NOT EVIDENCE ABOUT T050 ──
     Measured, not assumed: run against an absent module the whole suite reports
     `141 failed | 1 passed (142)`, and this is the 1. It compares two constants in
     `contract.ts` against two literals, so no implementation can make it fail and a green
     here says nothing whatever about one.

     It is kept anyway, and the reason is the only thing that justifies it: its job is to stop
     a LATER editor deriving `PROBLEM_BASE` from `lib/server/http/problem.ts`, which would make
     D-50-01's pin agree with whatever the module happens to say. That is the same trap the
     Published signatures block names for `MAX_NAME_LENGTH` — "a test that imports the constant
     it bounds moves with it".

     So: a guard against a change to this suite, not a guard on the subject. Labelled because a
     set that can only be full is no more a measurement than one that can only be empty, and
     counting it toward coverage would be borrowing credibility from the 141 beside it. */
  it("uses `https://darkprint.io/problems`, which is the one the code defines", () => {
    expect(PROBLEM_BASE).toBe("https://darkprint.io/problems");
    expect(HANDLE_REQUIRED_TYPE).toBe("https://darkprint.io/problems/handle-required");
  });
});
