/* ============================================================
   T050 — what a caller sees when the store cannot answer

   D-50-18, ruled: a store fault answers `problem+json` **500**,
   `type` `https://darkprint.io/problems/store-failed`, "body
   carrying the published form and nothing else". It is NOT
   re-thrown — throwing produces a 500 too, but Next's own generic
   one, "outside the envelope every other failure on the route uses
   and unobservable to anything driving the handler directly."

   ── why this file exists, stated plainly ──
   The 142 tests already in this suite pass **identically before
   and after** the D-50-18 fix. That is not a near miss; it is the
   measurement that says nothing on either side observed the
   behaviour, which is what made the divergence contract-versus-code
   rather than something a suite could have caught. The three fixed
   sites are witnessed by five colocated tests and zero blind ones,
   and a behaviour observed only from inside the module it lives in
   has one witness. This is the other one.

   ── the sites are derived from the contract, not found in the code ──
   I was asked not to read the implementation to locate them, and I
   did not. I did not need to: **every published function in T050's
   half takes `db: Db`**, so a store fault is reachable from every
   route that calls one, and the published route block enumerates
   those routes. So the property below is quantified over the
   published route set **by construction** rather than over three
   sites someone listed — which also covers the two routes nobody
   named, and a sixth added later.

   `app/api/auth/github/callback` is driven too, because
   it is published as "upserts
   a bare `account` row keyed by GitHub id" and `upsertFromGitHub`
   takes a `Db`. Its route file was not opened; it is imported and
   driven, which is not the same as read.

   ── no database is used anywhere in this file ──
   `DATABASE_URL` is pointed at a closed port. Nothing is created,
   nothing is dropped, and this file leaves no scratch database, so
   it runs off-slot while another session holds the gate.

   `getSharedDbClient()` caches on `globalThis` behind
   `Symbol.for("darkprint.db.sharedClient")` (`lib/db/client.ts:50`),
   so the repoint must happen **and the cache be cleared** before the
   first handler call, or the route reaches a pool built against the
   real host and this whole file measures nothing.

   ── D-50-21's `NamingStoreError` arm has NO blind witness, and the
      reason is derivable from the contract rather than from code ──
   That arm is the one with no colocated witness either, so it would
   have been the most valuable cell here. It cannot be reached from
   T050's half by closing a port, and **D-50-20 is what settles it**:
   `changeHandle` "takes `SELECT … FOR UPDATE` on the account row",
   locking the account row **first** to remove the lock-order
   inversion. With every store call failing, the class a caller
   receives is decided by the first call attempted — and the contract
   says that call is the account read. So a closed port yields
   `AccountStoreError` at `PATCH /api/account/handle`, never
   `NamingStoreError`, and a cell claiming to witness the naming arm
   would be a green for the wrong reason.

   Reaching it needs the store UP and naming's own call failing,
   which needs a database operation rather than a closed port. It is
   reported as owed rather than faked here, and the route-level cell
   below covers `PATCH /api/account/handle` for whichever class does
   arrive — which is stated as the limitation it is, not as coverage
   of the arm.

   **And the claim is CONDITIONAL, which is the part worth writing
   down rather than leaving to be inferred.** It was measured, not
   asserted: deleting the naming arm from a reference that follows
   D-50-20 reds **0**, exactly as predicted. But that zero says
   "unreachable *given D-50-20 is honoured*", not "unreachable".
   An implementation that reached naming before locking the account
   row would violate D-50-20 **and** make the arm reachable — and
   **nothing in this suite observes D-50-20's ordering**, so those
   two would go uncaught together. That composition is the honest
   shape of the gap, and it is why the arm is reported as owed to a
   round that can hold the store up rather than closed.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  createOAuthState,
  encodeSession,
} from "@/lib/server/auth";

import { ROUTES, ROUTE_NAMES, type RouteName, assertProblem, callRoute } from "./contract";
import { plantedSecret } from "./fixtures";

/** D-50-18's published type, written out as a literal and never imported from the module. */
const STORE_FAILED_TYPE = "https://darkprint.io/problems/store-failed";

/** A port nothing listens on. `connect` refuses immediately, so no test here waits on a timeout. */
const CLOSED_PORT_URL = "postgres://darkprint:darkprint@127.0.0.1:1/darkprint";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");

/** An account id and a handle that never reach a database — nothing here stores anything. */
const ACCOUNT_ID = "00000000-0000-4000-8000-00000000f00d";
const HANDLE = "t050-store-fault";

function session(handle: string | null = HANDLE): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId: ACCOUNT_ID, handle })}`;
}

/**
 * Every body a route can hand back, checked for the things D-13 forbids.
 *
 * Derived rather than curated where it can be: the planted secret is a value only the module
 * could have put there. The fixed list beside it covers the driver's own machinery, which no
 * caller supplies and so cannot be planted.
 */
const DRIVER_TELLS = [
  "econnrefused",
  "connect ",
  "select ",
  "insert into",
  "update ",
  "returning",
  "$1",
  "drizzlequeryerror",
  "127.0.0.1",
  "5432",
  "postgres://",
  "password",
  "at Object.",
  "node_modules",
];

function expectNoDriverProse(body: string, where: string): void {
  const lowered = body.toLowerCase();
  for (const tell of DRIVER_TELLS) {
    expect(
      lowered.includes(tell),
      `${where}: the body carries \`${tell}\`.\n` +
        `  D-50-17: the form "carries the operation alone — no statement, no bound parameter, ` +
        `no SQLSTATE".\n  body: ${body.slice(0, 400)}`,
    ).toBe(false);
  }
}

let originalDatabaseUrl: string | undefined;

beforeAll(() => {
  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = CLOSED_PORT_URL;
  delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];
});

afterAll(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  /* Cleared rather than closed: the pool was never connected, and a `close()` on a client
     built against a closed port is a second failure to handle for no gain. Removing the slot
     is what stops the next file in this worker inheriting a client aimed at port 1. */
  delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];
});

/* ============================================================
   The property, over every published route
   ============================================================ */

/** What each published route needs in order to REACH the store rather than refuse earlier. */
const REACHES_THE_STORE: readonly { name: RouteName; body?: unknown }[] = [
  { name: "account" },
  { name: "profile", body: { displayName: "Store Fault Probe" } },
  { name: "handle", body: { handle: "t050-store-fault-new" } },
  { name: "email", body: { email: "store-fault@example.test" } },
  { name: "defaultVisibility", body: { visibility: "private" } },
];

describe("every published route answers problem+json 500 when the store cannot answer", () => {
  /* Quantified over the published route set rather than over the three sites I was handed.
     A list of sites is a site list; this is the property D-50-18 states, applied wherever the
     contract says a `Db` is reached — which is every one of these, since every published
     function takes one. */

  it("covers every route the contract publishes, so the set cannot silently shrink", () => {
    /* The floor. A loop over a set someone quietly narrowed reports coverage of nothing, and
       nothing in a passing run distinguishes five cells from three.

       Measured, and labelled for the same reason as the `PROBLEM_BASE` pin in `routes.test.ts`:
       run against an absent module this file reports `15 failed | 1 passed (16)`, and this is
       the 1. It compares two lists that both live in this suite, so no implementation can fail
       it and a green here is not evidence about T050. It is a guard on THIS FILE — it reds the
       day someone drops a route from the loop or the contract publishes a sixth — and it is
       counted as that and not as coverage. */
    expect(REACHES_THE_STORE.map((r) => r.name).sort()).toEqual([...ROUTE_NAMES].sort());
  });

  for (const route of REACHES_THE_STORE) {
    const spec = ROUTES[route.name];

    it(`\`${spec.method} ${spec.path}\` answers 500 \`store-failed\``, async () => {
      const answer = await callRoute(route.name, {
        cookie: session(),
        ...(route.body === undefined ? {} : { body: route.body }),
      });

      assertProblem(
        answer,
        { status: 500, type: STORE_FAILED_TYPE, instance: spec.path },
        `${spec.method} ${spec.path} with the store unreachable`,
      );
    });

    it(`\`${spec.method} ${spec.path}\` carries no statement, parameter or SQLSTATE`, async () => {
      const answer = await callRoute(route.name, {
        cookie: session(),
        ...(route.body === undefined ? {} : { body: route.body }),
      });
      expectNoDriverProse(answer.body, `${spec.method} ${spec.path}`);
    });
  }

  it("names the operation and nothing else in `detail`", async () => {
    /* The published form is `"<operation>: the account store failed."` — the operation alone.
       Asserted as a property of what the body may CONTAIN rather than as an equality against
       one wording, because D-50-17 publishes the module's message and not the route's
       `detail`, and inventing the route's copy would be a candidate list in a new hat. */
    const answer = await callRoute("account", { cookie: session() });
    const body = answer.json as Record<string, unknown>;
    expect(body.detail).toBeTypeOf("string");
    expect(String(body.detail).length).toBeGreaterThan(0);
    expectNoDriverProse(String(body.detail), "GET /api/account detail");
  });
});

describe("the email route is the one where the bound parameter IS the secret (D-50-17)", () => {
  it("keeps a planted address out of the 500 body", async () => {
    /* D-50-17's own argument, driven rather than quoted: "on `setEmail` the bound parameter
       **is** the email, so *no `email` value appears in any rejection, including one about the
       email* is false the moment a driver fault leaves unwrapped."

       So this is AC2 failing through a transport path rather than through a validation one,
       and it is the cell that makes the store door a criterion rather than hygiene. The secret
       is minted per run and cannot reach a body except by the module putting it there. */
    const secret = plantedSecret();
    const answer = await callRoute("email", {
      cookie: session(),
      body: { email: `${secret}@example.test` },
    });

    expect(answer.status).toBe(500);
    expect(
      answer.body.includes(secret),
      `the address reached the 500 body. A driver fault leaving unwrapped carries every bound ` +
        `parameter, and on this route one of them is the email AC2 forbids in any rejection.\n` +
        `  body: ${answer.body.slice(0, 400)}`,
    ).toBe(false);
  });

  it("keeps a planted handle out of the 500 body on the handle route", async () => {
    const secret = plantedSecret();
    const answer = await callRoute("handle", {
      cookie: session(),
      body: { handle: `t050-${secret}` },
    });

    expect(answer.status).toBe(500);
    expect(answer.body.includes(secret)).toBe(false);
  });
});

/* ============================================================
   The OAuth callback

   routes.md:56 publishes what it does: "verifies state, upserts a
   bare `account` row keyed by GitHub id, sets the session cookie."
   `upsertFromGitHub` takes a `Db`, so the store is reachable and
   the same property binds.

   The route file was NOT opened. What is stubbed is `globalThis.fetch`,
   because `resolveGithubIdentity` — T000's, merged, and a published
   dependency this task consumes — reaches GitHub through it and its
   endpoints are module constants with no injection point
   (`lib/server/auth/github.ts:12-14`). Stubbing a Node global at a
   merged dependency's boundary is not reading the subject.
   ============================================================ */

const CALLBACK_PATH = "/api/auth/github/callback";

interface Fetched {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function githubStub(githubId: string, login: string): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Fetched> => {
    const url = String(input);
    if (url.includes("access_token")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ access_token: "stub-token", token_type: "bearer" }),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ id: githubId, login, name: null, avatar_url: null, email: null }),
    });
  }) as unknown as typeof globalThis.fetch;
}

/**
 * Drives the shipped callback handler. Takes no identity: the GitHub subject is supplied
 * by `githubStub`, installed on `globalThis.fetch` by the caller.
 *
 * It used to take `githubId` and `login` and use neither, which `eslint` reported as two
 * unused parameters. They are DELETED rather than `_`-prefixed, and the difference
 * matters here: underscoring says "intentionally unused" and preserves the appearance
 * that a caller sets the identity through this function, when the value that reaches the
 * module comes from the stub on the line above. Both call sites passed the planted secret
 * twice, once effectively and once inertly, and a later reader varying the arguments to
 * change the subject would have changed nothing.
 */
async function callCallback(): Promise<Response> {
  const state = createOAuthState();
  const mod = (await import("@/app/api/auth/github/callback/route")) as {
    GET?: (request: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
  };
  if (typeof mod.GET !== "function") {
    throw new Error(
      `${CALLBACK_PATH} exports no \`GET\`. routes.md:56 publishes it as a GET that finishes ` +
        `the exchange.`,
    );
  }
  const request = new Request(
    `https://darkprint.test${CALLBACK_PATH}?code=stub-code&state=${encodeURIComponent(state)}`,
    { headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${state}` } },
  );
  return mod.GET(request, { params: Promise.resolve({}) });
}

describe("the OAuth callback answers problem+json 500 when the store cannot answer", () => {
  const originalFetch = globalThis.fetch;

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("does not hand a caller Next's generic 500, and does not carry the driver", async () => {
    /* The whole of D-50-18 in one cell: "throwing produces a 500 too, but Next's own generic
       one, outside the envelope every other failure on the route uses **and unobservable to
       anything driving the handler directly**." Driving the handler directly is exactly what
       this does, so a re-throw arrives here as a rejected promise rather than as a Response —
       which is why the call is not wrapped in a try/catch that would convert it into a pass. */
    const secret = plantedSecret();
    globalThis.fetch = githubStub(`gh-${secret}`, `login-${secret}`);

    const response = await callCallback();

    expect(response).toBeInstanceOf(Response);
    expect(
      response.status,
      `the callback reaches \`upsertFromGitHub\`, which takes a \`Db\` (routes.md:56), so a ` +
        `store fault is reachable here and D-50-18 binds.`,
    ).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/problem+json");

    const body = await response.text();
    expectNoDriverProse(body, CALLBACK_PATH);
    expect(
      body.includes(secret),
      `the GitHub subject reached the body. It is the caller-supplied value on this route and ` +
        `it is a bound parameter of the upsert.`,
    ).toBe(false);

    const parsed = JSON.parse(body) as Record<string, unknown>;
    expect(parsed.type).toBe(STORE_FAILED_TYPE);
    for (const member of ["type", "title", "status", "detail", "instance"]) {
      expect(parsed[member], `RFC 9457 member \`${member}\` is absent`).toBeDefined();
    }
    expect(parsed.status).toBe(500);
  });

  it("does not set a session cookie on a sign-in that did not complete", async () => {
    /* The consequence nobody would look for, and it is the one that matters to a user: the
       callback's published job is "upserts a bare `account` row ... **sets the session
       cookie**". If the upsert did not happen, a cookie handed out anyway names an account
       that does not exist, and `withSession` never reads the database — so the holder is
       signed in as nobody, for thirty days, and every route they touch fails somewhere deeper.

       A store fault must therefore be observable as an ABSENCE here, not only as a status. */
    const secret = plantedSecret();
    globalThis.fetch = githubStub(`gh-${secret}`, `login-${secret}`);

    const response = await callCallback();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(
      setCookie.includes(`${SESSION_COOKIE_NAME}=`) &&
        !setCookie.includes(`${SESSION_COOKIE_NAME}=;`),
      `a session cookie was issued although the account row was never written.\n` +
        `  set-cookie: ${setCookie.slice(0, 200)}`,
    ).toBe(false);
  });
});
