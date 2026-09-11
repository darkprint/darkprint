/* ============================================================
   The remote MCP endpoint and the three find/bundle routes, driven
   in-process against a scratch database

   One world: an account that publishes two public blueprints and
   one private one, and holds a read-scoped key. The route handlers
   are called as Next calls them, with the shared client repointed
   at the scratch database for the length of the file.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET as bundleRoute } from "@/app/api/mcp/blueprints/[owner]/[slug]/bundle/route";
import { GET as provenanceRoute } from "@/app/api/mcp/blueprints/[owner]/[slug]/provenance/route";
import { GET as findBlueprintsRoute } from "@/app/api/mcp/blueprints/find/route";
import { GET as findCardsRoute } from "@/app/api/mcp/cards/find/route";
import { GET as releasesRoute } from "@/app/api/mcp/releases/[owner]/[slug]/d/[digest]/route";
import { DELETE, GET, OPTIONS, POST } from "@/app/api/mcp/route";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { exportRelease } from "@/lib/server/export";
import { issueKey } from "@/lib/server/limits";
import { publish } from "@/lib/server/publish";
import { TOOL_NAMES } from "@/packages/mcp/src/definitions";
import { PROTOCOL_VERSION } from "@/packages/mcp/src/protocol";
import { NOT_FOUND_TEXT } from "@/packages/mcp/src/refusals";
import {
  content,
  disjointPair,
  dropScratchDatabases,
  makeAccount,
  recorded,
  scratchDatabase,
  type Scratch,
} from "@/tests/server/t220/fixtures";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: unknown };

interface World {
  scratch: Scratch;
  handle: string;
  publicA: { slug: string; digest: string; bundleId: string; title: string };
  publicB: { slug: string; digest: string };
  secret: { slug: string; digest: string; bundleId: string };
  key: string;
}

let scratch: Scratch;
let savedDatabaseUrl: string | undefined;

beforeAll(async () => {
  scratch = await scratchDatabase();
  savedDatabaseUrl = process.env.DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${scratch.name}`;
  process.env.DATABASE_URL = url.toString();
  /* Clearing the cache turns "no other file in this worker made one first" from a premise
     into an operation. */
  delete (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
});

afterAll(async () => {
  if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedDatabaseUrl;
  /* Close the pool before dropping the reference, or `DROP DATABASE` refuses with "is being
     accessed by other users" from `afterAll`, which vitest reports as a file-level failure
     while every cell passes. */
  const shared = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] as
    | { close?: () => Promise<void> }
    | undefined;
  if (typeof shared?.close === "function") await shared.close();
  delete (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
  await dropScratchDatabases();
});

/** Two public blueprints, one private, one read key. Recorded so a failure reds every cell. */
const world = recorded("the route world", async (): Promise<World> => {
  const db = scratch.db;
  const owner = await makeAccount(db, "route-owner", "routeowner");
  const { a, b } = disjointPair();
  const third = readContent().map((entry) => entry.slug).find((slug) => slug !== a && slug !== b)!;
  const vocabulary = contentVocabulary();

  const put = async (slug: string, visibility: "public" | "private") => {
    const bytes = content(slug);
    const result = (await publish(
      db as never,
      owner.actor,
      {
        ownerHandle: owner.handle,
        slug,
        version: "1.0.0",
        manifest: { ...bytes.manifest, slug },
        dot: bytes.dot,
        cardFiles: { ...bytes.cardFiles },
        ...(vocabulary === undefined ? {} : { vocabulary: { text: vocabulary.text, terms: vocabulary.terms } as never }),
        visibility,
      } as never,
      undefined,
    )) as { digest: string; bundleId: string };
    return { slug, digest: result.digest, bundleId: result.bundleId, title: bytes.manifest.title };
  };

  const publicA = await put(a, "public");
  const publicB = await put(b, "public");
  /* Private last: its cards already exist as public rows, which its owner can see, so the
     publish reuses them rather than colliding on the unique index. */
  const secret = await put(third, "private");
  const { secret: key } = await issueKey(db as never, owner.actor, owner.accountId, "route test");
  return { scratch, handle: owner.handle, publicA, publicB, secret, key };
});

const ORIGIN = "http://localhost";

function rpc(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, { headers });
}

const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

async function call(
  name: string,
  args: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<{ status: number; result?: { isError?: boolean; content: { text: string }[] }; error?: { code: number } }> {
  const response = await POST(
    rpc({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args } }, headers),
  );
  const body = (await response.json()) as { result?: never; error?: never };
  return { status: response.status, ...body };
}

describe("POST /api/mcp speaks stateless Streamable HTTP", () => {
  it("answers initialize with the negotiated version and echoes the protocol header", async () => {
    await world();
    const response = await POST(
      rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, {
        "mcp-protocol-version": "2025-03-26",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("mcp-protocol-version")).toBe("2025-03-26");
    const body = (await response.json()) as { id: number; result: Record<string, unknown> };
    expect(body.id).toBe(1);
    expect(body.result.protocolVersion).toBe("2025-03-26");
    expect(body.result.capabilities).toEqual({ tools: {} });
    expect((body.result.serverInfo as { name: string }).name).toBe("darkprint");

    const unknown = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } }));
    expect(((await unknown.json()) as { result: { protocolVersion: string } }).result.protocolVersion).toBe(PROTOCOL_VERSION);
  });

  it("accepts a notification with 202 and an empty body", async () => {
    await world();
    const response = await POST(rpc({ jsonrpc: "2.0", method: "notifications/initialized" }));
    expect(response.status).toBe(202);
    expect(await response.text()).toBe("");
  });

  it("lists the seven tools", async () => {
    await world();
    const response = await POST(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    const body = (await response.json()) as { result: { tools: { name: string }[] } };
    expect(body.result.tools.map((tool) => tool.name)).toEqual([...TOOL_NAMES]);
  });

  it("runs find_blueprints and answers the same JSON the GET route answers", async () => {
    const w = await world();
    const task = w.publicA.title;
    const over = await call("find_blueprints", { task, limit: 5 });
    expect(over.status).toBe(200);
    expect(over.error).toBeUndefined();
    expect(over.result?.isError).toBeUndefined();
    const text = over.result!.content[0]!.text;
    const parsed = JSON.parse(text) as { task: string; ordered: boolean; hits: { kind: string; ref: string; evidence: string[] }[] };
    expect(parsed.task).toBe(task);
    expect(parsed.hits.length).toBeGreaterThan(0);
    expect(parsed.hits.length).toBeLessThanOrEqual(5);
    expect(parsed.hits.map((hit) => hit.ref)).toContain(`${w.handle}/${w.publicA.slug}`);
    expect(parsed.hits.every((hit) => hit.kind === "blueprint" && hit.evidence.length > 0)).toBe(true);

    const direct = await findBlueprintsRoute(get(`/api/mcp/blueprints/find?task=${encodeURIComponent(task)}&limit=5`));
    expect(direct.status).toBe(200);
    expect(await direct.text()).toBe(text);
  });

  it("answers a batch with one response per request", async () => {
    await world();
    const response = await POST(
      rpc([
        { jsonrpc: "2.0", id: "a", method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: "b", method: "tools/list" },
      ]),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string }[];
    expect(body.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("refuses an unknown tool as an RPC error and a failed tool as a result", async () => {
    const w = await world();
    const unknown = await call("frobnicate", {});
    expect(unknown.error?.code).toBe(-32602);
    expect(unknown.result).toBeUndefined();

    const refused = await call("get_blueprint", { owner: w.handle, slug: "no-such-slug" });
    expect(refused.error).toBeUndefined();
    expect(refused.result?.isError).toBe(true);
    expect(refused.result?.content[0]!.text).toBe(NOT_FOUND_TEXT);
  });

  it("answers malformed JSON with 400 and a -32700 body, and an empty batch with -32600", async () => {
    await world();
    const malformed = await POST(rpc("{not json"));
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as { error: { code: number } }).error.code).toBe(-32700);

    const empty = await POST(rpc([]));
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as { error: { code: number } }).error.code).toBe(-32600);
  });

  it("answers GET and DELETE with 405 and Allow: POST", async () => {
    for (const handler of [GET, DELETE]) {
      const response = handler(new Request(`${ORIGIN}/api/mcp`));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
      expect(response.headers.get("content-type")).toBe("application/problem+json");
    }
    const options = OPTIONS();
    expect(options.status).toBe(204);
    expect(options.headers.get("allow")).toBe("POST");
  });
});

describe("the three GET routes", () => {
  it("find cards answers one hit per card id with the published shape", async () => {
    const w = await world();
    const response = await findCardsRoute(get(`/api/mcp/cards/find?task=${encodeURIComponent(w.publicA.title)}&limit=20`));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { hits: { kind: string; ref: string; usedIn: string[] }[] };
    expect(body.hits.length).toBeGreaterThan(0);
    expect(new Set(body.hits.map((hit) => hit.ref.split("@")[0])).size).toBe(body.hits.length);
    for (const hit of body.hits) {
      expect(hit.kind).toBe("card");
      expect(hit.ref).toMatch(/@/);
      expect(Array.isArray(hit.usedIn)).toBe(true);
    }
  });

  it("bundle answers every file exportRelease writes, and shapes the notes by harness", async () => {
    const w = await world();
    const generic = await bundleRoute(
      get(`/api/mcp/blueprints/${w.handle}/${w.publicA.slug}/bundle`),
      params({ owner: w.handle, slug: w.publicA.slug }),
    );
    expect(generic.status).toBe(200);
    const body = (await generic.json()) as {
      digest: string;
      current: boolean;
      files: { path: string; text: string }[];
      instantiate: { harness: string; steps: string[] };
    };
    expect(body.current).toBe(true);
    expect(body.digest).toBe(w.publicA.digest);
    expect(body.files).toEqual(
      await exportRelease(w.scratch.db as never, { kind: "anonymous" }, w.publicA.bundleId, w.publicA.digest),
    );
    expect(body.instantiate.harness).toBe("generic");

    const shaped = await bundleRoute(
      get(`/api/mcp/blueprints/${w.handle}/${w.publicA.slug}/bundle?harness=claude-code&digest=${w.publicA.digest}`),
      params({ owner: w.handle, slug: w.publicA.slug }),
    );
    const shapedBody = (await shaped.json()) as {
      instantiate: { harness: string; steps: string[] };
      run: string[];
    };
    expect(shapedBody.instantiate.harness).toBe("claude-code");
    /* The harness reaches the wording of the notes and nothing else. What it used to reach
       was the two sentences about isolating a node and stopping at a human gate, which meant
       the default answer was the least safe one; those are `run`'s now, and `run` is the same
       list whichever harness is named. */
    expect(shapedBody.instantiate.steps.some((step) => step.includes("claude-code"))).toBe(true);
    expect(shapedBody.run).toEqual((body as unknown as { run: string[] }).run);
    expect(shapedBody.run.join(" ")).toContain("own context");

    const unknownHarness = await bundleRoute(
      get(`/api/mcp/blueprints/${w.handle}/${w.publicA.slug}/bundle?harness=emacs`),
      params({ owner: w.handle, slug: w.publicA.slug }),
    );
    expect(((await unknownHarness.json()) as { instantiate: { harness: string } }).instantiate.harness).toBe("generic");
  });

  it("find blueprints lists the public shelf unranked for no task, forks aside", async () => {
    const w = await world();
    const response = await findBlueprintsRoute(get("/api/mcp/blueprints/find?limit=20"));
    const body = (await response.json()) as { ordered: boolean; hits: { ref: string }[] };
    expect(body.ordered).toBe(false);
    const refs = body.hits.map((hit) => hit.ref);
    expect(refs).toContain(`${w.handle}/${w.publicA.slug}`);
    expect(refs).toContain(`${w.handle}/${w.publicB.slug}`);
    expect(refs).not.toContain(`${w.handle}/${w.secret.slug}`);
  });
});

describe("a bearer key reads as its account", () => {
  it("keeps a private bundle invisible without a key or with a garbage one, and visible to its owner's key", async () => {
    const w = await world();
    const path = `/api/mcp/blueprints/${w.handle}/${w.secret.slug}/bundle`;
    const routeParams = params({ owner: w.handle, slug: w.secret.slug });

    const anonymous = await bundleRoute(get(path), routeParams);
    expect(anonymous.status).toBe(404);
    const garbage = await bundleRoute(get(path, { authorization: "Bearer dp_not_a_real_key_at_all" }), routeParams);
    expect(garbage.status).toBe(404);
    expect(await garbage.text()).toBe(await anonymous.text().catch(() => ""));

    const keyed = await bundleRoute(get(path, { authorization: `Bearer ${w.key}` }), routeParams);
    expect(keyed.status).toBe(200);
    const body = (await keyed.json()) as { digest: string; files: unknown[]; owner: string };
    expect(body.digest).toBe(w.secret.digest);
    expect(body.owner).toBe(w.handle);
    expect(body.files.length).toBeGreaterThan(0);

    const provenance = await provenanceRoute(
      get(`/api/mcp/blueprints/${w.handle}/${w.secret.slug}/provenance`, { authorization: `Bearer ${w.key}` }),
      routeParams,
    );
    expect(provenance.status).toBe(200);
    const releases = await releasesRoute(
      get(`/api/mcp/releases/${w.handle}/${w.secret.slug}/d/${w.secret.digest}`, { authorization: `Bearer ${w.key}` }),
      params({ owner: w.handle, slug: w.secret.slug, digest: w.secret.digest }),
    );
    expect(releases.status).toBe(200);
    const anonymousReleases = await releasesRoute(
      get(`/api/mcp/releases/${w.handle}/${w.secret.slug}/d/${w.secret.digest}`),
      params({ owner: w.handle, slug: w.secret.slug, digest: w.secret.digest }),
    );
    expect(anonymousReleases.status).toBe(404);
  });

  it("carries the key through the remote endpoint too", async () => {
    const w = await world();
    const without = await call("get_blueprint", { owner: w.handle, slug: w.secret.slug });
    expect(without.result?.isError).toBe(true);
    const withKey = await call("get_blueprint", { owner: w.handle, slug: w.secret.slug }, { authorization: `Bearer ${w.key}` });
    expect(withKey.result?.isError).toBeUndefined();
    expect((JSON.parse(withKey.result!.content[0]!.text) as { digest: string }).digest).toBe(w.secret.digest);
  });

  it("does not widen the find tools, which search public blueprints only", async () => {
    const w = await world();
    const response = await findBlueprintsRoute(get("/api/mcp/blueprints/find?limit=20", { authorization: `Bearer ${w.key}` }));
    const body = (await response.json()) as { hits: { ref: string }[] };
    expect(body.hits.map((hit) => hit.ref)).not.toContain(`${w.handle}/${w.secret.slug}`);
    expect(body.hits.map((hit) => hit.ref)).toContain(`${w.handle}/${w.publicA.slug}`);
  });
});
