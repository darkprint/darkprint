/* ============================================================
   DarkPrint backend — T120's four routes, at the transport
   Two properties, and neither needs a database:

   1. **T000's AC3**: an unauthenticated request never reaches a
      handler. `withSession` is the outermost wrapper on all four,
      so a missing cookie is 401 `problem+json` before anything
      else runs — which is also what makes `planTransfer`'s and
      `transferBundle`'s `not-signed-in` arm unreachable through
      HTTP, exactly as D-110-10 records for `forkBundle`. That arm
      still exists because both verbs are called at the module
      boundary too.
   2. **The presence check is the ROUTE's**, and it runs before
      `getSharedDbClient()` — so a preview missing a query
      parameter is a 400 rather than a `null` reaching
      `resolveOwner` and rendering as *no account holds `null`*, a
      refusal naming a handle nobody typed.

   No DB, no `getSharedDbClient()`, no mock: every assertion below
   is answered before the first line that would open a connection.
   The verbs themselves are driven against real Postgres in
   `lifecycle.db.scratch.test.ts`, which is where they belong —
   this file is about the boundary, not the behaviour.

   Colocated and importing `@/app/api/...`, which is the shipped
   convention: `lib/server/auth/{login,callback}-route.test.ts`,
   `lib/server/accounts/accounts.scratch.test.ts` and
   `lib/server/registry/fault-path.test.ts` all reach for a route
   the same way.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { POST as deletePost } from "@/app/api/account/delete/route";
import { GET as deletePlan } from "@/app/api/account/delete/plan/route";
import { POST as transferPost } from "@/app/api/transfer/route";
import { GET as transferPlan } from "@/app/api/transfer/plan/route";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";

const SECRET = "test-session-secret";
process.env.SESSION_SECRET = SECRET;

function signedIn(url: string, init: RequestInit = {}): Request {
  const cookie = `${SESSION_COOKIE_NAME}=${encodeSession({ accountId: "acc_1", handle: "berti" }, SECRET)}`;
  return new Request(url, { ...init, headers: { ...(init.headers ?? {}), cookie } });
}

describe("T120's routes refuse an unauthenticated request before the handler", () => {
  /* Every one of the four, enumerated rather than sampled: `withSession` is a per-file
     decision and a route that forgot it would look identical from the outside until the day
     an anonymous caller reached the verb. */
  const CASES = [
    { name: "GET /api/transfer/plan", run: () => transferPlan(new Request("https://d.io/api/transfer/plan?bundleId=b&toHandle=h")) },
    { name: "POST /api/transfer", run: () => transferPost(new Request("https://d.io/api/transfer", { method: "POST", body: "{}" })) },
    { name: "GET /api/account/delete/plan", run: () => deletePlan(new Request("https://d.io/api/account/delete/plan")) },
    { name: "POST /api/account/delete", run: () => deletePost(new Request("https://d.io/api/account/delete", { method: "POST" })) },
  ] as const;

  it.each(CASES)("$name answers 401 problem+json with no session", async ({ run }) => {
    const response = await run();
    expect(response.status).toBe(401);
    /* The envelope, not just the status: B-03's whole point is that a failure looks the same
       everywhere, and a bare 401 from somewhere else would satisfy the number alone. */
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });
});

describe("GET /api/transfer/plan checks its parameters before it opens a connection", () => {
  it("400s on an absent bundleId, naming the parameter and no value", async () => {
    const response = await transferPlan(signedIn("https://d.io/api/transfer/plan?toHandle=bob"));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({
      detail: "Expected a `bundleId` query parameter.",
    });
  });

  it("400s on an absent toHandle", async () => {
    const response = await transferPlan(signedIn("https://d.io/api/transfer/plan?bundleId=b"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      detail: "Expected a `toHandle` query parameter.",
    });
  });

  /* The discriminating case, and the reason the two checks are separate: an EMPTY parameter
     is present, so it is the module's answer rather than the route's. A route that treated
     `""` as absent would 400 where the block publishes a refusal sentence, and the caller
     would never see `no account holds \`\``. Asserted as "not 400" rather than as a status,
     because reaching the module here means reaching `getSharedDbClient()`. */
  it("an EMPTY parameter is present, and belongs to the module", async () => {
    const response = await transferPlan(signedIn("https://d.io/api/transfer/plan?bundleId=&toHandle=")).catch(
      () => undefined,
    );
    expect(response?.status).not.toBe(400);
  });
});

describe("POST /api/transfer checks its body's types before it opens a connection", () => {
  it("400s on a body that is not a JSON object", async () => {
    const response = await transferPost(
      signedIn("https://d.io/api/transfer", { method: "POST", body: "[]" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ detail: "Expected a JSON object body." });
  });

  it.each([
    { field: "bundleId", body: { bundleId: 1, toHandle: "bob" } },
    { field: "toHandle", body: { bundleId: "b", toHandle: 1 } },
  ])("400s when `$field` is not a string", async ({ field, body }) => {
    const response = await transferPost(
      signedIn("https://d.io/api/transfer", { method: "POST", body: JSON.stringify(body) }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      detail: `Expected \`${field}\` to be a string.`,
    });
  });
});
