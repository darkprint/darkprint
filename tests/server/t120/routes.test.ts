/* ============================================================
   T120 — the four published routes (D-120-14, D-120-18)

   D-WAVE-02 does not apply to this task: `POST /api/transfer`,
   `POST /api/account/delete` and — because AC3's *refused before
   anything moves* and AC6's *reviewed before it runs* are
   criteria about a PREVIEW, and a preview nobody can reach is
   not one — `GET /api/transfer/plan` and
   `GET /api/account/delete/plan`.

   ── the routes reach the database through `getSharedDbClient` ──
   which reads `DATABASE_URL`. So this file repoints that
   variable at its own scratch database and CLEARS the cached
   client first, which turns "no other file in this worker made
   one already" from a premise into an operation. Both are
   restored in `afterAll`, and the pool is CLOSED before the
   drop: F-230-F is the recorded case where dropping the
   reference without closing the pool left `DROP DATABASE`
   refusing with "is being accessed by other users", thrown from
   a hook — reported as a failed FILE while every cell passed,
   and an unbounded scratch-database leak on infrastructure every
   worktree shares.

   ── the routes are DISCOVERED, never listed ──
   Walking the two owned trees for `route.ts` is what makes "the
   published path is served" a real assertion. A list typed here
   would pass against a file at the wrong path as long as this
   file named the same wrong path.
   ============================================================ */

import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";

import { RecordedSetup, keysOf, type Namespace, type UnknownFn } from "./contract";
import {
  bundleRow,
  publishBundle,
  resolvingCorpus,
  scratchDatabase,
  seedAccount,
  type Account,
  type Scratch,
} from "./fixtures";

const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;

/** The paths D-120-14 and D-120-18 publish, with the tree each is served out of. */
const PUBLISHED_ROUTES = [
  { method: "POST", path: "/api/transfer", tree: "app/api/transfer" },
  { method: "GET", path: "/api/transfer/plan", tree: "app/api/transfer" },
  { method: "POST", path: "/api/account/delete", tree: "app/api/account/delete" },
  { method: "GET", path: "/api/account/delete/plan", tree: "app/api/account/delete" },
] as const;

const OWNED_TREES = ["app/api/transfer", "app/api/account/delete"] as const;

interface DiscoveredRoute {
  /** The URL Next serves this file at, derived from the path rather than declared. */
  pattern: string;
  file: string;
}

function walk(dir: string, segments: string[], out: DiscoveredRoute[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; /* a tree the implementation has not created — the blind position */
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walk(join(dir, entry.name), [...segments, entry.name], out);
    else if (ROUTE_FILE.test(entry.name)) {
      out.push({ pattern: `/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

function discovered(): DiscoveredRoute[] {
  const found: DiscoveredRoute[] = [];
  for (const tree of OWNED_TREES) {
    /* `app/` is the App Router's root and is NOT part of the served path: `app/api/transfer`
       is served at `/api/transfer`. The first version passed `tree.split("/")` whole and
       produced `/app/api/transfer`, so every cell in this file reported the published route
       as unserved — five reds against a route tree that was there. */
    const segments = tree.split("/").slice(1);
    walk(fileURLToPath(new URL(`../../../${tree}/`, import.meta.url)), segments, found);
  }
  return found.sort((a, b) => a.pattern.localeCompare(b.pattern));
}

/* --------------------- the shared client, repointed --------------------- */

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: unknown };

interface World {
  scratch: Scratch;
  alice: Account;
  bob: Account;
  bundleId: string;
}

const world = new RecordedSetup<World>("the T120 route fixture");
let savedDatabaseUrl: string | undefined;

beforeAll(async () => {
  await world.run(async () => {
    const scratch = await scratchDatabase("routes");
    savedDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = scratch.url;
    delete (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];

    const alice = await seedAccount(scratch, "t120-rt-alice");
    const bob = await seedAccount(scratch, "t120-rt-bob");
    const published = await publishBundle(scratch, alice, "rt-bundle", "public");
    return { scratch, alice, bob, bundleId: published.bundleId };
  });
}, 120_000);

afterAll(async () => {
  if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedDatabaseUrl;

  /* Close the pool before dropping the reference, then drop the database. F-230-F. */
  const shared = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] as
    | { close?: () => Promise<void> }
    | undefined;
  if (typeof shared?.close === "function") await shared.close();
  delete (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];

  await world.optional()?.scratch.drop();
});

function cookieFor(account: Account): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({
    accountId: account.accountId,
    handle: account.handle,
  })}`;
}

/** Drive one published route by importing the file discovery found at its path. */
async function call(
  method: string,
  path: string,
  options: { cookie?: string; body?: unknown } = {},
): Promise<Response> {
  const pattern = path.split("?")[0];
  const route = discovered().find((r) => r.pattern === pattern);
  if (route === undefined) {
    throw new Error(
      `No route file is served at \`${pattern}\`.\n` +
        `  D-120-14 and D-120-18 publish it under T120's own \`Owns\` trees, and the tree was ` +
        `walked rather than a path list trusted. Found: ` +
        `${discovered().map((r) => r.pattern).join(", ") || "(nothing under either tree)"}`,
    );
  }
  const mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
  const handler = mod[method];
  if (typeof handler !== "function") {
    throw new Error(
      `${pattern} exports no \`${method}\` handler; it exports ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}.`,
    );
  }
  const init: RequestInit = { method, headers: { "content-type": "application/json" } };
  if (options.cookie !== undefined) {
    init.headers = { ...(init.headers as Record<string, string>), cookie: options.cookie };
  }
  if (method !== "GET" && method !== "HEAD") init.body = JSON.stringify(options.body ?? {});

  const answered = await (handler as UnknownFn)(new Request(`https://darkprint.test${path}`, init), {
    params: Promise.resolve({}),
  });
  if (!(answered instanceof Response)) {
    throw new Error(`${method} ${pattern} answered ${String(answered)}; a route returns a Response.`);
  }
  return answered;
}

describe("T120 D-120-14/18 — the four published routes exist and are served", () => {
  it("every published path is served by a route file under an owned tree", () => {
    const served = discovered().map((r) => r.pattern);
    expect(
      served,
      `nothing is served under ${OWNED_TREES.join(" or ")}. D-120-14 rules that D-WAVE-02 does ` +
        `NOT apply to this task, so the module-only reading is not available here.`,
    ).not.toEqual([]);
    for (const route of PUBLISHED_ROUTES) {
      expect(served, `${route.method} ${route.path} is published and nothing serves it`).toContain(
        route.path,
      );
    }
  });

  it("`GET /api/transfer/plan` previews without transferring", async () => {
    const { alice, bob, bundleId, scratch } = world.require();
    const before = await bundleRow(scratch, bundleId);

    const response = await call(
      "GET",
      `/api/transfer/plan?bundleId=${bundleId}&toHandle=${bob.handle}`,
      { cookie: cookieFor(alice) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { plan?: Record<string, unknown> };
    expect(body.plan, "the envelope is `{ plan: TransferPlan }` (D-120-18)").toBeDefined();
    expect(Object.keys(body.plan ?? {}).sort()).toEqual([...keysOf("TransferPlan")].sort());
    expect(body.plan?.collides).toBe(false);

    /* The preview is the whole reason this route exists, so the cell that proves it is a
       preview is the one that reads the row back. */
    expect(await bundleRow(scratch, bundleId)).toEqual(before);
  });

  it("a COLLIDING preview is 200 with `collides: true`, never 409", async () => {
    const { alice, bob, scratch } = world.require();

    /* Alice and Bob both hold a bundle at this slug, so the transfer WOULD be refused — and
       the preview must not be. **A preview that refused would be the act.** The two `plan*`
       verbs exist because AC3 needs the collision observable without performing it, so a 409
       here would make the only surface that can answer *would this work* answer by failing;
       the 409 belongs to the POST, where the act is attempted.

       Both ends are asserted in one cell on purpose: `status` alone is satisfied by a preview
       that found no collision, and `collides` alone is satisfied by a 409 carrying a body. */
    const contested = await publishBundle(scratch, alice, "rt-contested", "public");
    await publishBundle(scratch, bob, "rt-contested", "public", { corpus: resolvingCorpus(1) });

    const response = await call(
      "GET",
      `/api/transfer/plan?bundleId=${contested.bundleId}&toHandle=${bob.handle}`,
      { cookie: cookieFor(alice) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { plan?: Record<string, unknown> };
    expect(body.plan?.collides).toBe(true);
    expect(body.plan?.slug).toBe("rt-contested");

    /* And it previewed rather than acted. */
    expect((await bundleRow(scratch, contested.bundleId))?.owner_id).toBe(alice.accountId);
  });

  it("`GET /api/account/delete/plan` previews the SESSION account, no body id", async () => {
    const { alice } = world.require();
    const response = await call("GET", "/api/account/delete/plan", { cookie: cookieFor(alice) });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { plan?: Record<string, unknown> };
    expect(body.plan).toBeDefined();
    expect(Object.keys(body.plan ?? {}).sort()).toEqual([...keysOf("DeletionPlan")].sort());
    /* D-120-14: you delete yourself. The plan is the caller's own, taken off the session. */
    expect(body.plan?.accountId).toBe(alice.accountId);
  });

  it("D-120-19's 403/404 split, driven at the transfer route", async () => {
    const { alice, bob, bundleId } = world.require();

    /* 404 for a bundle nobody holds — B-03: absent and unreadable are one answer, so a
       reader learns nothing about which it was. */
    const absent = await call("POST", "/api/transfer", {
      cookie: cookieFor(alice),
      body: { bundleId: "00000000-0000-4000-8000-0000000000ff", toHandle: bob.handle },
    });
    expect(absent.status).toBe(404);

    /* 403 for a bundle that exists and is somebody else's. D-120-19 rules this concedes
       nothing BECAUSE `not-owner` is only reachable after the read grant — a public bundle is
       readable by everyone, so the 403 tells Bob what he could already see. */
    const notOwner = await call("POST", "/api/transfer", {
      cookie: cookieFor(bob),
      body: { bundleId, toHandle: bob.handle },
    });
    expect(
      notOwner.status,
      "a transfer of a bundle the caller does not own answered " +
        `${notOwner.status}. D-120-19 rules the split 403 here and 404 above; collapsing both ` +
        "to 404 would be a leak-avoidance the ruling says is not needed, and collapsing both " +
        "to 403 would confirm that an unknown bundle id exists.",
    ).toBe(403);
  });

  it("`POST /api/account/delete` answers 200 with the plan it carried out", async () => {
    const { scratch } = world.require();

    /* Its own account, because this cell ends it. Seeded here rather than in `beforeAll` so
       no other cell in the file is reading a deleted session. */
    const doomed = await seedAccount(scratch, "t120-rt-doomed");
    await publishBundle(scratch, doomed, "rt-doomed-public", "public");

    const response = await call("POST", "/api/account/delete", { cookie: cookieFor(doomed) });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;

    /* D-120-19: 200 carrying a `DeletionPlan` — **BARE, not `{ plan: … }`**, and the
       difference is the document's own. D-120-18 wraps the two GET PREVIEWS in `{ plan: … }`;
       D-120-19 writes the POST's answer as `200 DeletionPlan` with no envelope. The first
       version of this cell asserted the wrapper on all three and reported a defect against a
       route that matched its ruling — E3 in the pre-registration, arriving exactly where it
       was predicted to. */
    expect(Object.keys(body).sort()).toEqual([...keysOf("DeletionPlan")].sort());
    expect(body.accountId).toBe(doomed.accountId);
    expect(body.publishedBundles).toBe(1);

    const row = await scratch.pool.query(`select github_id from "account" where id = $1`, [
      doomed.accountId,
    ]);
    expect(row.rows[0]?.github_id).toBe(`deleted:${doomed.accountId}`);
  });

  it("an anonymous caller reaches neither POST route", async () => {
    const { bob, bundleId } = world.require();
    /* No cookie at all. Both trees sit behind a session and neither publishes an anonymous
       reading — `POST /api/account/delete` has no body id precisely because the subject IS
       the session.
       Only the two POSTs, deliberately: the preview routes are asserted present by the cell
       above, and driving them here as well would report ONE absence as TWO reds. A count of
       reds is a count of causes only if each cause reds once. */
    expect((await call("POST", "/api/account/delete")).status).toBeGreaterThanOrEqual(400);
    expect(
      (await call("POST", "/api/transfer", { body: { bundleId, toHandle: bob.handle } })).status,
    ).toBeGreaterThanOrEqual(400);
  });
});
