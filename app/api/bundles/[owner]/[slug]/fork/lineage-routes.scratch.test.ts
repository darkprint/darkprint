/**
 * Scratch coverage of `app/api/bundles/[owner]/[slug]/{fork,forks,drift}/**`, run by the
 * implementer only — does not count as verification (docs/ORCHESTRATION.md, Agent A).
 *
 * ── why one file, sitting under `fork/` ──
 * The three routes are one wire surface over one lineage operation — fork it, list who forked
 * it, see how it has drifted — and they sit in sibling directories under
 * `app/api/bundles/[owner]/[slug]/`, a directory this task does not own (T280's `Owns` names
 * `fork/**`, `forks/**` and `drift/**` as three separate leaves, not their parent). There is no
 * directory "beside" all three this task may write into, so this lives under the first of them
 * and dynamically imports the other two — the same shape `app/api/files/routes.scratch.test.ts`
 * uses for route files nested under the directory it sits in.
 *
 * ── the shared-client swap ──
 * A route handler takes no `Db`; it reaches `getSharedDbClient()`, cached on `globalThis`
 * behind `Symbol.for("darkprint.db.sharedClient")` so the pool survives Next's hot reload. It
 * is redirected to a scratch client before the first request and restored after the last —
 * checked rather than assumed, in the first cell below (`tests/server/t100/routes.test.ts`'s
 * pattern) — and closed before the scratch database is dropped, or the DROP fails with "is
 * being accessed by other users" (`app/api/files/routes.scratch.test.ts`'s own recorded cost of
 * skipping that step).
 *
 * `SESSION_SECRET` is pinned to a literal here rather than read from the shell: every session
 * this file mints is encoded and decoded inside this one process (`withSession` never leaves
 * it — there is no real HTTP hop), so the value only has to agree with itself, and pinning it
 * means this suite does not depend on `.env.local` carrying a variable it never signs anything
 * real with.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type DbClient } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { addRelease, createBundle } from "@/lib/server/archive";
import { createTestDb, type TestDb } from "@/tests/support";

const hasDb = Boolean(process.env.DATABASE_URL);

process.env.SESSION_SECRET ??= "lineage-routes-scratch-secret";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const ORIGIN = "http://localhost";

type Params = { owner: string; slug: string };
type Handler = (request: Request, context: { params: Promise<Params> }) => Promise<Response>;

/* Literal `import()` calls, one per route — not a helper taking a computed path, because a
   bundler resolving `@/...` aliases needs the specifier visible at the call site, the same
   reason every route test in this tree (`t100/routes.test.ts`, `files/routes.scratch.test.ts`)
   writes the string out at each site rather than building it. */
async function forkPOST(): Promise<Handler> {
  const mod = (await import("@/app/api/bundles/[owner]/[slug]/fork/route")) as Record<string, unknown>;
  return mod["POST"] as Handler;
}
async function forksGET(): Promise<Handler> {
  const mod = (await import("@/app/api/bundles/[owner]/[slug]/forks/route")) as Record<string, unknown>;
  return mod["GET"] as Handler;
}
async function driftGET(): Promise<Handler> {
  const mod = (await import("@/app/api/bundles/[owner]/[slug]/drift/route")) as Record<string, unknown>;
  return mod["GET"] as Handler;
}

function cookieFor(accountId: string, handle: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
}

async function postFork(owner: string, slug: string, body: unknown, cookie?: string): Promise<Response> {
  const POST = await forkPOST();
  return POST(
    new Request(`${ORIGIN}/api/bundles/${owner}/${slug}/fork`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ owner, slug }) },
  );
}

async function getForks(owner: string, slug: string, cookie?: string): Promise<Response> {
  const GET = await forksGET();
  return GET(
    new Request(`${ORIGIN}/api/bundles/${owner}/${slug}/forks`, {
      headers: cookie === undefined ? {} : { cookie },
    }),
    { params: Promise.resolve({ owner, slug }) },
  );
}

async function getDrift(owner: string, slug: string, cookie?: string): Promise<Response> {
  const GET = await driftGET();
  return GET(
    new Request(`${ORIGIN}/api/bundles/${owner}/${slug}/drift`, {
      headers: cookie === undefined ? {} : { cookie },
    }),
    { params: Promise.resolve({ owner, slug }) },
  );
}

describe.skipIf(!hasDb)("app/api/bundles/[owner]/[slug]/{fork,forks,drift}", () => {
  let testDb: TestDb;
  let previousUrl: string | undefined;
  let previousClient: DbClient | undefined;

  /** Handles double as logins: `makeAccount` sets both from the one string. */
  let AUTHOR: string;
  let FORKER: string;
  let STRANGER: string;
  let author: string; // account id
  let forker: string;
  let stranger: string;

  async function makeAccount(handle: string, defaultVisibility: "public" | "private" = "public"): Promise<string> {
    const [row] = await testDb.client.db
      .insert(schema.account)
      .values({ githubId: handle, githubLogin: handle, handle, defaultVisibility })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;
    previousClient = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
    (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] = testDb.client;

    AUTHOR = "route-author";
    FORKER = "route-forker";
    STRANGER = "route-stranger";
    author = await makeAccount(AUTHOR);
    forker = await makeAccount(FORKER);
    stranger = await makeAccount(STRANGER);
  }, 120_000);

  afterAll(async () => {
    /* The shared slot holds `testDb.client` itself (installed above), not a second pool
       `getSharedDbClient()` lazily built — so `testDb.drop()` below is the ONE place this
       pool is closed. Closing it here too raised "Called end on pool more than once"
       (`pg-pool`'s own guard against a double `end()`), which is what told the two functions
       apart during this file's own first run. */
    const withShared = globalThis as GlobalWithSharedClient;
    if (previousClient === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previousClient;
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
    await testDb.drop();
  });

  /** A public bundle with one release pinning `refs`, owned by `ownerId`. */
  async function makeBundle(
    ownerId: string,
    slug: string,
    visibility: "public" | "private",
    version: string,
    refs: readonly string[] = [],
  ): Promise<void> {
    const bundle = await createBundle(testDb.client.db, { ownerId, slug, visibility });
    await addRelease(testDb.client.db, {
      bundleId: bundle.id,
      version,
      dot: `digraph { ${slug} }`,
      manifest: { slug, title: slug, summary: "fixture", tags: [] },
      cardRefs: refs,
      cardDigests: refs.map((ref) => `d-${ref.replace("@", "-")}`),
    });
  }

  async function makeCard(ownerId: string, cardId: string, version: string): Promise<void> {
    await testDb.client.db.insert(schema.cardVersion).values({
      cardId,
      version,
      digest: `d-${cardId}-${version}`,
      ownerId,
      visibility: "public",
      body: { id: cardId, version },
      source: `id: ${cardId}\nversion: ${version}\n`,
    });
  }

  it("reads the installed scratch client — the premise every cell below relies on", async () => {
    /* `route-author` exists ONLY in the scratch database. Anything but a 401/404 confirms the
       route resolved a real actor and bundle through the installed client rather than opening
       its own pool against the shared `darkprint` database, where every cell below would be
       measuring an empty database and passing for the wrong reason. */
    await makeBundle(author, "premise", "public", "1.0.0");
    const response = await postFork("route-author", "premise", { version: "1.0.0" }, cookieFor(forker, FORKER));
    expect(response.status).toBe(200);
  });

  describe("POST .../fork", () => {
    it("401s an anonymous caller, even against a public upstream", async () => {
      await makeBundle(author, "anon-target", "public", "1.0.0");
      const response = await postFork("route-author", "anon-target", { version: "1.0.0" });
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toBe("application/problem+json");
    });

    /**
     * D-110-09 over the wire, asserted in BOTH directions (the module suite's own reasoning,
     * `lineage.db.scratch.test.ts:213-219`): a route that hardcoded `"private"` would pass the
     * first case and fail only the second, so either direction alone is the exact defect this
     * pair exists to catch, not a property of the route.
     */
    it.each([
      ["private" as const, "private" as const],
      ["public" as const, "public" as const],
    ])(
      "omits `visibility` from the body and gets the forker's own account default (%s)",
      async (accountDefault, expected) => {
        const who = await makeAccount(`route-forker-${accountDefault}`, accountDefault);
        await makeBundle(author, `default-vis-${accountDefault}`, "public", "1.0.0");

        const response = await postFork(
          "route-author",
          `default-vis-${accountDefault}`,
          { version: "1.0.0" },
          cookieFor(who, `route-forker-${accountDefault}`),
        );
        expect(response.status).toBe(200);
        const body = (await response.json()) as { visibility: string; slug: string };
        expect(body.visibility).toBe(expected);
        /* Omitted target slug copies the source's own. */
        expect(body.slug).toBe(`default-vis-${accountDefault}`);
      },
    );

    it("an explicit `visibility` in the body overrides the forker's own account default", async () => {
      const who = await makeAccount("route-forker-override", "private");
      await makeBundle(author, "explicit-vis", "public", "1.0.0");

      const response = await postFork(
        "route-author",
        "explicit-vis",
        { version: "1.0.0", visibility: "public" },
        cookieFor(who, "route-forker-override"),
      );
      expect(response.status).toBe(200);
      expect(((await response.json()) as { visibility: string }).visibility).toBe("public");
    });

    it("an explicit `slug` in the body wins over the source's own", async () => {
      await makeBundle(author, "rename-source", "public", "1.0.0");
      const response = await postFork(
        "route-author",
        "rename-source",
        { version: "1.0.0", slug: "renamed" },
        cookieFor(forker, FORKER),
      );
      expect(response.status).toBe(200);
      expect(((await response.json()) as { slug: string }).slug).toBe("renamed");
    });

    it("records the lineage columns and the release taken, verbatim on the wire", async () => {
      await makeBundle(author, "lineage-check", "public", "1.0.0", []);
      const response = await postFork(
        "route-author",
        "lineage-check",
        { version: "1.0.0" },
        cookieFor(forker, FORKER),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ownerId: string;
        lineage: { ownerId: string; slug: string; version: string };
      };
      expect(body.ownerId).toBe(forker);
      expect(body.lineage).toEqual({ ownerId: author, slug: "lineage-check", version: "1.0.0" });
    });

    it("409s a slug the forker already holds — forking your own bundle at its own slug included", async () => {
      await makeBundle(author, "self-fork", "public", "1.0.0");
      /* The default target slug is the SOURCE's own, so the author forking their own bundle
         with no `slug` override collides with the bundle it is forking. */
      const response = await postFork("route-author", "self-fork", { version: "1.0.0" }, cookieFor(author, AUTHOR));
      expect(response.status).toBe(409);
      expect(response.headers.get("content-type")).toBe("application/problem+json");
      const detail = (await response.json()) as { type: string; detail: string };
      expect(detail.type).toBe("https://darkprint.io/problems/fork-slug-taken");
      expect(detail.detail).toBe("forkBundle: `self-fork` is already yours.");
    });

    it("404s identically for an owner nobody holds and for a bundle the caller may not read (B-03)", async () => {
      await makeBundle(stranger, "hidden", "private", "1.0.0");

      const noOwner = await postFork("nobody-at-all", "whatever", { version: "1.0.0" }, cookieFor(forker, FORKER));
      const hidden = await postFork("route-stranger", "hidden", { version: "1.0.0" }, cookieFor(forker, FORKER));

      expect(noOwner.status).toBe(404);
      expect(hidden.status).toBe(404);
      const noOwnerBody = (await noOwner.json()) as { type: string; detail: string };
      const hiddenBody = (await hidden.json()) as { type: string; detail: string };
      expect(noOwnerBody.type).toBe("https://darkprint.io/problems/fork-no-such-bundle");
      expect(noOwnerBody.detail).toBe("forkBundle: no such bundle.");
      /* `type` and `detail` only: `instance` is the request path (RFC 9457 §3.1) and the two
         requests differ in owner and slug on purpose, so it is expected to differ too — that
         is the caller's own submission echoed back, not the existence leak B-03 forbids. */
      expect(hiddenBody.type).toBe(noOwnerBody.type);
      expect(hiddenBody.detail).toBe(noOwnerBody.detail);
    });

    it("404s a version the upstream never released, distinguishably from `no such bundle`", async () => {
      await makeBundle(author, "no-such-release", "public", "1.0.0");
      const response = await postFork(
        "route-author",
        "no-such-release",
        { version: "9.9.9" },
        cookieFor(forker, FORKER),
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as { type: string; detail: string };
      expect(body.type).toBe("https://darkprint.io/problems/fork-no-such-release");
      expect(body.detail).toBe("forkBundle: no such release.");
    });

    it("400s a body missing `version`", async () => {
      await makeBundle(author, "missing-version", "public", "1.0.0");
      const response = await postFork("route-author", "missing-version", {}, cookieFor(forker, FORKER));
      expect(response.status).toBe(400);
      expect((await response.json() as { detail: string }).detail).toContain("version");
    });

    it("400s a `visibility` that is neither `public` nor `private`", async () => {
      await makeBundle(author, "bad-visibility", "public", "1.0.0");
      const response = await postFork(
        "route-author",
        "bad-visibility",
        { version: "1.0.0", visibility: "sideways" },
        cookieFor(forker, FORKER),
      );
      expect(response.status).toBe(400);
      expect((await response.json() as { detail: string }).detail).toContain("visibility");
    });
  });

  describe("GET .../forks", () => {
    it("AC2/Q1 over the wire: a private fork is invisible to everyone, its own owner and the upstream author included, until it turns public", async () => {
      await makeBundle(author, "forks-listed", "public", "1.0.0");
      const forkResponse = await postFork(
        "route-author",
        "forks-listed",
        { version: "1.0.0", slug: "quiet-fork", visibility: "private" },
        cookieFor(forker, FORKER),
      );
      expect(forkResponse.status).toBe(200);
      const { id: forkId } = (await forkResponse.json()) as { id: string };

      for (const [owner, cookie] of [
        ["route-forker", cookieFor(forker, FORKER)],
        ["route-author", cookieFor(author, AUTHOR)],
        ["route-stranger", cookieFor(stranger, STRANGER)],
        ["anonymous", undefined],
      ] as const) {
        const response = await getForks("route-author", "forks-listed", cookie);
        expect(response.status, `as ${owner}`).toBe(200);
        expect((await response.json()) as { forks: unknown[] }, `as ${owner}`).toEqual({ forks: [] });
      }

      /* No verb turns a fork public after the fact (module suite's own note); the flip is a
         raw UPDATE, matching `lineage.db.scratch.test.ts`'s AC2 cell exactly. */
      await testDb.client.db.update(schema.bundle).set({ visibility: "public" }).where(eq(schema.bundle.id, forkId));

      const after = await getForks("route-author", "forks-listed");
      expect(after.status).toBe(200);
      const body = (await after.json()) as { forks: { slug: string; ownerId: string }[] };
      expect(body.forks).toHaveLength(1);
      expect(body.forks[0]!.slug).toBe("quiet-fork");
      expect(body.forks[0]!.ownerId).toBe(forker);
    });

    it("answers `ok({ forks: [] })`, never a 404, for an owner nobody holds", async () => {
      const response = await getForks("nobody-at-all", "whatever");
      expect(response.status).toBe(200);
      expect((await response.json()) as { forks: unknown[] }).toEqual({ forks: [] });
    });
  });

  describe("GET .../drift", () => {
    it("reports `ok` for a fresh, unmodified fork", async () => {
      await makeCard(author, "alpha", "1.0.0");
      await makeBundle(author, "drift-ok", "public", "1.0.0", ["alpha@1.0.0"]);
      const forkResponse = await postFork(
        "route-author",
        "drift-ok",
        { version: "1.0.0", slug: "drift-ok-fork" },
        cookieFor(forker, FORKER),
      );
      expect(forkResponse.status).toBe(200);

      const response = await getDrift("route-forker", "drift-ok-fork", cookieFor(forker, FORKER));
      expect(response.status).toBe(200);
      expect((await response.json()) as unknown).toEqual({ drift: { tone: "ok", repins: [] } });
    });

    it("reports `moved`, naming both versions, once the upstream repins", async () => {
      await makeCard(author, "beta", "1.0.0");
      await makeCard(author, "beta", "2.0.0");
      const upstream = await createBundle(testDb.client.db, { ownerId: author, slug: "drift-moved", visibility: "public" });
      await addRelease(testDb.client.db, {
        bundleId: upstream.id,
        version: "1.0.0",
        dot: "digraph { drift_moved }",
        manifest: { slug: "drift-moved", title: "drift-moved", summary: "fixture", tags: [] },
        cardRefs: ["beta@1.0.0"],
        cardDigests: ["d-beta-1.0.0"],
      });

      const forkResponse = await postFork(
        "route-author",
        "drift-moved",
        { version: "1.0.0", slug: "drift-moved-fork" },
        cookieFor(forker, FORKER),
      );
      expect(forkResponse.status).toBe(200);

      await addRelease(testDb.client.db, {
        bundleId: upstream.id,
        version: "2.0.0",
        dot: "digraph { drift_moved }",
        manifest: { slug: "drift-moved", title: "drift-moved", summary: "fixture", tags: [] },
        cardRefs: ["beta@2.0.0"],
        cardDigests: ["d-beta-2.0.0"],
      });

      const response = await getDrift("route-forker", "drift-moved-fork", cookieFor(forker, FORKER));
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        drift: { tone: string; repins: { card: string; from: string; to: string; at: string }[] };
      };
      expect(body.drift.tone).toBe("moved");
      expect(body.drift.repins).toHaveLength(1);
      expect(body.drift.repins[0]).toMatchObject({ card: "beta", from: "1.0.0", to: "2.0.0" });
      /* Serialised over the wire as an ISO string (`Response.json` on a `Date`), and still a
         real, parseable instant. */
      expect(Number.isNaN(new Date(body.drift.repins[0]!.at).getTime())).toBe(false);
    });

    it("answers the same `ok` drift, never a 404, for an owner nobody holds", async () => {
      const response = await getDrift("nobody-at-all", "whatever");
      expect(response.status).toBe(200);
      expect((await response.json()) as unknown).toEqual({ drift: { tone: "ok", repins: [] } });
    });
  });
});
