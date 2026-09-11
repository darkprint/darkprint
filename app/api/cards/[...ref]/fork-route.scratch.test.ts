/* ============================================================
   Scratch coverage of `POST /api/cards/[...ref]` — the card fork.
   Run by the implementer only; it does not count as verification.

   The subject is the WIRE: which status each refusal answers, that
   the body's three fields are read the way the contract says, and
   that a namespaced id reaches the handler as one card id rather
   than two segments. `forkCard`'s own behaviour is measured
   against Postgres next door in
   `lib/server/lineage/fork-card.db.scratch.test.ts`; nothing here
   re-asserts it.

   ── the shared-client swap ──
   A route handler takes no `Db`: it reaches `getSharedDbClient()`,
   cached on `globalThis` behind a symbol so the pool survives hot
   reload. It is redirected to a scratch client before the first
   request and restored after the last, and closed by `drop()`
   rather than separately — closing it twice raises pg-pool's own
   "Called end on pool more than once"
   (`app/api/bundles/[owner]/[slug]/fork/lineage-routes.scratch.test.ts`
   paid for that lesson and this file inherits it).

   `SESSION_SECRET` is pinned to a literal: every session this file
   mints is encoded and decoded inside this one process, so the
   value only has to agree with itself.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NodeCard } from "@/lib/core";
import { schema, type DbClient } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { addCard } from "@/lib/server/cards";
import { CARD_FORK_PROVENANCE_PREFIX } from "@/lib/server/lineage";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";

const hasDb = Boolean(process.env.DATABASE_URL);

process.env.SESSION_SECRET ??= "card-fork-routes-scratch-secret";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const ORIGIN = "http://localhost";

type Handler = (
  request: Request,
  context: { params: Promise<{ ref: string[] }> },
) => Promise<Response>;

/* A literal `import()`, for the reason every route test in this tree writes one out: a
   bundler resolving `@/...` needs the specifier visible at the call site. */
async function forkPOST(): Promise<Handler> {
  const mod = (await import("@/app/api/cards/[...ref]/route")) as Record<string, unknown>;
  return mod["POST"] as Handler;
}

function cookieFor(accountId: string, handle: string | null): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
}

async function postFork(ref: readonly string[], body: unknown, cookie?: string): Promise<Response> {
  const POST = await forkPOST();
  return POST(
    new Request(`${ORIGIN}/api/cards/${ref.join("/")}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ ref: [...ref] }) },
  );
}

function cardFixture(id: string, version: string): NodeCard {
  return {
    id,
    name: "Spec planner",
    type: "agent",
    phases: [],
    action: "plan",
    spec: "Write the plan.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [],
    version,
    author: "author",
  };
}

function sourceFor(card: NodeCard): string {
  return [
    `id: ${card.id}`,
    `name: ${JSON.stringify(card.name)}`,
    `type: ${card.type}`,
    "phase: []",
    `action: ${card.action}`,
    `spec: ${JSON.stringify(card.spec)}`,
    "tools: []",
    "mcp: []",
    "params: {}",
    "inputs: []",
    "outputs: []",
    "dependencies: []",
    "cannot: []",
    "will_not: []",
    "risk_markers: []",
    `version: ${card.version}`,
    `author: ${card.author}`,
    "",
  ].join("\n");
}

describe.skipIf(!hasDb)("POST /api/cards/[...ref] (fork)", () => {
  let testDb: TestDb;
  let previousUrl: string | undefined;
  let previousClient: DbClient | undefined;

  const AUTHOR = "route-author";
  const FORKER = "route-forker";
  let author: string;
  let forker: string;
  let handleless: string;

  async function makeAccount(login: string, handle: string | null): Promise<string> {
    const [row] = await testDb.client.db
      .insert(schema.account)
      .values({ githubId: login, githubLogin: login, handle })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  async function makeCard(
    ownerId: string,
    id: string,
    version: string,
    visibility: "public" | "private",
  ): Promise<void> {
    const body = cardFixture(id, version);
    await addCard(testDb.client.db, {
      cardId: id,
      version,
      ownerId,
      visibility,
      body,
      source: sourceFor(body),
    });
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;
    previousClient = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
    (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] = testDb.client;
  }, 120_000);

  afterAll(async () => {
    const withShared = globalThis as GlobalWithSharedClient;
    if (previousClient === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previousClient;
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
    await testDb.drop();
  });

  beforeEach(async () => {
    await resetTestDb(testDb.client);
    author = await makeAccount(AUTHOR, AUTHOR);
    forker = await makeAccount(FORKER, FORKER);
    handleless = await makeAccount("route-no-handle", null);
  });

  it("redirects the shared client at the scratch database", async () => {
    /* Checked rather than assumed: without this the suite would exercise whatever
       `DATABASE_URL` points at, and every cell below would still be green. */
    const { getSharedDbClient } = await import("@/lib/db");
    expect(getSharedDbClient()).toBe(testDb.client);
  });

  it("answers 401 with no session, and writes nothing", async () => {
    await makeCard(author, "planner", "1.0.0", "public");

    const response = await postFork(["planner", "fork"], { version: "1.0.0" });
    expect(response.status).toBe(401);

    const rows = await testDb.client.db.select().from(schema.cardVersion);
    expect(rows).toHaveLength(1);
  });

  it("forks a public card and answers 200 with the new record", async () => {
    await makeCard(author, "planner", "1.2.0", "public");

    const response = await postFork(["planner", "fork"], { version: "1.2.0" }, cookieFor(forker, FORKER));
    expect(response.status).toBe(200);

    const payload = (await response.json()) as { card: { cardId: string; version: string; body: NodeCard } };
    expect(payload.card.cardId).toBe(`${FORKER}/planner`);
    expect(payload.card.version).toBe("1.2.0");
    expect(payload.card.body.author).toBe(FORKER);
    expect(payload.card.body.provenance).toBe(`${CARD_FORK_PROVENANCE_PREFIX} planner@1.2.0 by ${AUTHOR}`);
  });

  it("takes a namespaced upstream id from two path segments", async () => {
    await makeCard(author, `${AUTHOR}/planner`, "1.0.0", "public");

    const response = await postFork(
      [AUTHOR, "planner", "fork"],
      { version: "1.0.0" },
      cookieFor(forker, FORKER),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { card: { cardId: string } };
    expect(payload.card.cardId).toBe(`${FORKER}/planner`);
  });

  it("answers 404 for a card the caller may not read, exactly as for one that is absent", async () => {
    await makeCard(author, "secret", "1.0.0", "private");

    const unreadable = await postFork(["secret", "fork"], { version: "1.0.0" }, cookieFor(forker, FORKER));
    const absent = await postFork(["nothing", "fork"], { version: "1.0.0" }, cookieFor(forker, FORKER));

    expect(unreadable.status).toBe(404);
    expect(absent.status).toBe(404);
    /* Everything but `instance`, which is the request path and is necessarily different —
       it is the one field that cannot tell a caller anything it did not already type. */
    const strip = async (response: Response): Promise<Record<string, unknown>> => {
      const { instance, ...rest } = (await response.json()) as Record<string, unknown>;
      void instance;
      return rest;
    };
    expect(await strip(unreadable)).toEqual(await strip(absent));
  });

  it("answers 404 for a version the card never published", async () => {
    await makeCard(author, "planner", "1.0.0", "public");

    const response = await postFork(["planner", "fork"], { version: "9.9.9" }, cookieFor(forker, FORKER));
    expect(response.status).toBe(404);
    expect((await response.json()) as { type: string }).toMatchObject({
      type: expect.stringContaining("fork-no-such-card-version") as unknown as string,
    });
  });

  it("answers 409 when the forker already holds the id", async () => {
    await makeCard(author, "planner", "1.0.0", "public");
    await makeCard(forker, `${FORKER}/planner`, "0.1.0", "public");

    const response = await postFork(["planner", "fork"], { version: "1.0.0" }, cookieFor(forker, FORKER));
    expect(response.status).toBe(409);
  });

  it("answers 400 for a name that is not a legal identifier", async () => {
    await makeCard(author, "planner", "1.0.0", "public");

    const response = await postFork(
      ["planner", "fork"],
      { version: "1.0.0", name: "My Planner" },
      cookieFor(forker, FORKER),
    );
    expect(response.status).toBe(400);
  });

  it("answers 403 for a signed-in account with no handle", async () => {
    await makeCard(author, "planner", "1.0.0", "public");

    const response = await postFork(["planner", "fork"], { version: "1.0.0" }, cookieFor(handleless, null));
    /* 403 and not 401: the caller is signed in, and what is missing is something only they
       can supply. A 401 would send them back to a sign-in page they have already been to. */
    expect(response.status).toBe(403);
  });

  it("answers 400 for a body with no version, before reading anything", async () => {
    await makeCard(author, "planner", "1.0.0", "public");

    const response = await postFork(["planner", "fork"], {}, cookieFor(forker, FORKER));
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { detail: string };
    expect(payload.detail).toContain("`version`");
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await postFork(["planner", "fork"], "not json at all", cookieFor(forker, FORKER));
    expect(response.status).toBe(400);
  });

  it("answers 400 for a visibility that is neither public nor private", async () => {
    await makeCard(author, "planner", "1.0.0", "public");

    const response = await postFork(
      ["planner", "fork"],
      { version: "1.0.0", visibility: "unlisted" },
      cookieFor(forker, FORKER),
    );
    expect(response.status).toBe(400);
  });

  it("takes an explicit private visibility", async () => {
    await makeCard(author, "planner", "1.0.0", "public");

    const response = await postFork(
      ["planner", "fork"],
      { version: "1.0.0", visibility: "private" },
      cookieFor(forker, FORKER),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { card: { visibility: string } };
    expect(payload.card.visibility).toBe("private");
  });

  it("answers 404 for a POST that is not a fork", async () => {
    await makeCard(author, "planner", "1.0.0", "public");

    const response = await postFork(["planner"], { version: "1.0.0" }, cookieFor(forker, FORKER));
    expect(response.status).toBe(404);
  });

  it("answers 404 for a fork path naming no card", async () => {
    const response = await postFork(["fork"], { version: "1.0.0" }, cookieFor(forker, FORKER));
    expect(response.status).toBe(404);
  });

  it("answers problem+json on every refusal", async () => {
    const response = await postFork(["nothing", "fork"], { version: "1.0.0" }, cookieFor(forker, FORKER));
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect((await response.json()) as { instance: string }).toMatchObject({
      instance: "/api/cards/nothing/fork",
    });
  });
});
