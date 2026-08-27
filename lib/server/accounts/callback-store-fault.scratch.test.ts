/* ============================================================
   D-50-18's THIRD site: the OAuth callback's store path.
   Its own file, and mocking one dependency, both for stated
   reasons rather than convenience.

   **Why this cannot be driven for real.** `resolveGithubIdentity`
   performs a live token exchange against GitHub, and T000's own
   contract records that this route "cannot be exercised end to end
   without a real GitHub OAuth App's client id/secret (nobody has
   one yet)". With the credentials unset the route returns its 502
   **before** reaching `upsertFromGitHub`, so the store path is
   unreachable by any input. Replacing exactly that one call is
   what makes the rest of the route real: the state cookie is
   minted and verified for real, the wrapper is the shipped one,
   and the store is a genuinely dead socket.

   **Why its own file.** `vi.mock` is hoisted and file-scoped, so
   putting it beside the other 45 assertions would put every one of
   them behind a mocked module they do not need. Blast radius zero.

   Without this the callback fix would be a change with no
   observer — which is the shape this round was charged for one
   layer up, and repeating it in the fix would be worse than the
   original.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth/github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/auth/github")>()),
  /* The one call no test in this repository can make for real. */
  resolveGithubIdentity: async () => ({ githubId: "gh-transport", login: "transport" }),
}));

const { createDbClient } = await import("@/lib/db");
const { createOAuthState, oauthStateCookieHeader } = await import("@/lib/server/auth");
const { GET: callbackRoute } = await import("@/app/api/auth/github/callback/route");
type DbClient = Awaited<ReturnType<typeof createDbClient>>;

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

describe("the OAuth callback answers problem+json 500 when the store cannot answer", () => {
  let dead: DbClient;
  let previous: DbClient | undefined;
  let previousSecret: string | undefined;

  beforeAll(() => {
    previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "t050-callback-secret";
    dead = createDbClient("postgres://nobody:nobody@127.0.0.1:1/nothing");
    const withShared = globalThis as GlobalWithSharedClient;
    previous = withShared[SHARED_CLIENT_KEY];
    withShared[SHARED_CLIENT_KEY] = dead;
  });

  afterAll(async () => {
    const withShared = globalThis as GlobalWithSharedClient;
    if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previous;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
    await dead.close();
  });

  /** A callback request whose CSRF state is minted and matched for real. */
  function signedCallback(): Request {
    const state = createOAuthState();
    const cookie = oauthStateCookieHeader(state).split(";")[0];
    return new Request(`https://darkprint.io/api/auth/github/callback?code=abc&state=${state}`, {
      headers: { cookie },
    });
  }

  it("wears the envelope on the store path, as it already did on the GitHub path", async () => {
    /* Before this fix the route had `problem+json` 502 for GitHub failing and NOTHING
       for the store failing underneath it — one of its two failure modes in the
       envelope and the other in Next's generic 500. */
    const response = await callbackRoute(signedCallback());
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = (await response.json()) as { type: string; detail: string };
    expect(body.type).toBe("https://darkprint.io/problems/store-failed");
    expect(body.detail).toBe("upsertFromGitHub: the account store failed.");
  });

  it("sets no session cookie when the account could not be reached", async () => {
    /* The consequence that would matter to a user: a signed session naming an account
       that was never written. */
    const response = await callbackRoute(signedCallback());
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("carries no connection string, host or driver tell", async () => {
    const raw = await (await callbackRoute(signedCallback())).text();
    for (const tell of ["nobody", "127.0.0.1", "nothing", "ECONNREFUSED", "postgres://"]) {
      expect(raw).not.toContain(tell);
    }
  });
});
