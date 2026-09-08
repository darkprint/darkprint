/* ============================================================
   POST /api/cards, driven as a handler against a scratch database.

   The subject is the wire: who may call, which status each
   refusal answers, that the card lands under the caller's handle
   with its document rewritten to match, and that what was stored
   is visible to exactly the readers the visibility says. The
   registry's pin index does not hold a card nothing pins, so
   visibility is asserted through the readers that do see such a
   row: `lib/server/cards` and the author profile behind
   `GET /api/authors/<handle>`.

   The write-key harness installs the scratch client where every
   route reads it, and the rate-limit cell runs last because the
   counter is process-wide and it exhausts its own account.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { schema } from "@/lib/db";
import { addCard, getCard, listCardVersions } from "@/lib/server/cards";
import type { Actor } from "@/lib/server/policy";

import {
  type Account,
  type Harness,
  type Key,
  Setup,
  bearer,
  cookieFor,
  installScratch,
  mintKey,
  problemOf,
  seedAccount,
} from "../t230/write-key-harness";

interface Env {
  harness: Harness;
  alice: Account;
  bob: Account;
  handleless: Account;
  flooder: Account;
  aliceWrite: Key;
  aliceRead: Key;
}

const setup = new Setup<Env>("the card publish scratch database");

beforeAll(async () => {
  await setup.run(async () => {
    const harness = await installScratch("cards");
    const alice = await seedAccount(harness, "cards-alice");
    const bob = await seedAccount(harness, "cards-bob");
    return {
      harness,
      alice,
      bob,
      handleless: await seedAccount(harness, null),
      flooder: await seedAccount(harness, "cards-flooder"),
      aliceWrite: await mintKey(harness, alice, "write"),
      aliceRead: await mintKey(harness, alice, "read"),
    };
  });
}, 60_000);

afterAll(async () => {
  await setup.optional()?.harness.release();
});

const ANONYMOUS: Actor = { kind: "anonymous" };

function actorOf(account: Account): Actor {
  return { kind: "account", accountId: account.accountId, handle: account.handle };
}

/**
 * A card that resolves against the core vocabulary. `inputs` is the one field varied,
 * because adding a required input is the change `checkVersionChain` prices as a major
 * bump, which is how the store's own refusal is reached from the wire.
 */
function cardYaml(options: { id: string; version: string; spec?: string; inputs?: boolean }): string {
  const spec = options.spec ?? "Read the brief, write the plan as numbered steps, and hand it to the builder.";
  const inputs = options.inputs === true
    ? ["inputs:", "  - name: brief", "    type: report", "    description: What the planner starts from."]
    : ["inputs: []"];
  return [
    "# written by hand, for the publish tests",
    `id: ${options.id}`,
    "name: Planner",
    "type: agent",
    "phase: [planning]",
    "action: Write the plan.",
    `spec: ${JSON.stringify(spec)}`,
    "tools: []",
    "mcp: []",
    "params: {}",
    ...inputs,
    "outputs: []",
    "dependencies: []",
    "cannot: []",
    "will_not: []",
    "risk_markers: []",
    `version: ${options.version}`,
    "author: somebody",
    "",
  ].join("\n");
}

async function post(body: unknown, headers: Record<string, string>): Promise<Response> {
  const { POST } = await import("@/app/api/cards/route");
  return POST(
    new Request("http://localhost/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function profileCardCount(handle: string, headers: Record<string, string>): Promise<number> {
  const { GET } = await import("@/app/api/authors/[handle]/route");
  const response = await GET(new Request(`http://localhost/api/authors/${handle}`, { headers }), {
    params: Promise.resolve({ handle }),
  });
  expect(response.status, await response.clone().text()).toBe(200);
  const profile = (await response.json()) as { counts: { cards: number } };
  return profile.counts.cards;
}

async function rowsAt(env: Env, cardId: string) {
  return env.harness.client.db
    .select({ version: schema.cardVersion.version, ownerId: schema.cardVersion.ownerId })
    .from(schema.cardVersion)
    .where(eq(schema.cardVersion.cardId, cardId));
}

interface Published {
  card: { cardId: string; version: string; visibility: string; ownerId: string; source: string; body: { id: string } };
  path: string;
}

describe("POST /api/cards", () => {
  it("redirects the shared client at the scratch database", async () => {
    const env = setup.require();
    const { getSharedDbClient } = await import("@/lib/db");
    expect(getSharedDbClient()).toBe(env.harness.client);
  });

  it("answers 401 with no credential, and writes nothing", async () => {
    const env = setup.require();
    const response = await post({ source: cardYaml({ id: "anon", version: "1.0.0" }) }, {});
    const problem = await problemOf(response);
    expect(problem.status).toBe(401);
    expect(await rowsAt(env, "cards-alice/anon")).toHaveLength(0);
  });

  it("refuses a read-scoped key with the guard's 401, and writes nothing", async () => {
    const env = setup.require();
    const response = await post(
      { source: cardYaml({ id: "readkey", version: "1.0.0" }) },
      { authorization: bearer(env.aliceRead.secret) },
    );
    const problem = await problemOf(response);
    expect(problem.status).toBe(401);
    expect(problem.detail).toContain("write-scoped");
    expect(await rowsAt(env, "cards-alice/readkey")).toHaveLength(0);
  });

  it("refuses a card that does not validate, with the validator's diagnostics", async () => {
    const env = setup.require();
    const response = await post({ source: "id: Not A Card\nname: x\n" }, { cookie: cookieFor(env.alice) });
    const problem = (await problemOf(response)) as { diagnostics?: { severity: string; code: string }[] } & {
      type: string;
      status: number;
    };
    expect(problem.status).toBe(422);
    expect(problem.type).toBe("https://darkprint.io/problems/card-publish-card-invalid");
    expect(problem.diagnostics?.length ?? 0).toBeGreaterThan(0);
    expect(problem.diagnostics?.some((d) => d.severity === "error" && d.code === "card/bad-id")).toBe(true);
    const rows = await env.harness.client.db.select().from(schema.cardVersion);
    expect(rows.filter((row) => row.ownerId === env.alice.accountId)).toHaveLength(0);
  });

  it("publishes a good card under the caller's handle and answers 201 with its page path", async () => {
    const env = setup.require();
    const source = cardYaml({ id: "planner", version: "1.0.0" });
    const response = await post({ source, visibility: "public" }, { cookie: cookieFor(env.alice) });
    expect(response.status, await response.clone().text()).toBe(201);

    const payload = (await response.json()) as Published;
    expect(payload.card.cardId).toBe("cards-alice/planner");
    expect(payload.card.version).toBe("1.0.0");
    expect(payload.card.visibility).toBe("public");
    expect(payload.card.ownerId).toBe(env.alice.accountId);
    expect(payload.path).toBe("/nodes/cards-alice/planner");

    /* The document is rewritten to carry the id it is stored under, and only that: the
       author's comment and their own `author` line survive. */
    expect(payload.card.body.id).toBe("cards-alice/planner");
    expect(payload.card.source).toContain("id: cards-alice/planner");
    expect(payload.card.source).toContain("# written by hand, for the publish tests");
    expect(payload.card.source).toContain("author: somebody");

    /* Visible to a stranger through the readers that see an unpinned row. */
    const read = await getCard(env.harness.client.db, ANONYMOUS, "cards-alice/planner", "1.0.0");
    expect(read?.digest).toMatch(/^sha256:/);
    expect(await profileCardCount("cards-alice", {})).toBe(1);
  });

  it("publishes as the key's account when the caller holds a write-scoped key", async () => {
    const env = setup.require();
    const response = await post(
      { source: cardYaml({ id: "keyed", version: "1.0.0" }) },
      { authorization: bearer(env.aliceWrite.secret) },
    );
    expect(response.status, await response.clone().text()).toBe(201);
    const payload = (await response.json()) as Published;
    expect(payload.card.cardId).toBe("cards-alice/keyed");
    expect(payload.card.ownerId).toBe(env.alice.accountId);
  });

  it("stores a card whose declared id already carries the caller's handle byte for byte", async () => {
    const env = setup.require();
    const source = cardYaml({ id: "cards-alice/verbatim", version: "1.0.0" });
    const response = await post({ source }, { cookie: cookieFor(env.alice) });
    expect(response.status, await response.clone().text()).toBe(201);
    const payload = (await response.json()) as Published;
    expect(payload.card.cardId).toBe("cards-alice/verbatim");
    expect(payload.card.source).toBe(source);
  });

  it("replaces somebody else's namespace with the caller's, since an id admits one", async () => {
    const env = setup.require();
    const response = await post(
      { source: cardYaml({ id: "lupo/borrowed", version: "1.0.0" }) },
      { cookie: cookieFor(env.alice) },
    );
    expect(response.status, await response.clone().text()).toBe(201);
    expect(((await response.json()) as Published).card.cardId).toBe("cards-alice/borrowed");
  });

  it("takes `name` as the un-namespaced half of the id", async () => {
    const env = setup.require();
    const response = await post(
      { source: cardYaml({ id: "planner", version: "1.0.0" }), name: "renamed-planner" },
      { cookie: cookieFor(env.alice) },
    );
    expect(response.status, await response.clone().text()).toBe(201);
    const payload = (await response.json()) as Published;
    expect(payload.card.cardId).toBe("cards-alice/renamed-planner");
    expect(payload.card.body.id).toBe("cards-alice/renamed-planner");
  });

  it("keeps a private card away from a stranger and shows it to its owner", async () => {
    const env = setup.require();
    const response = await post(
      { source: cardYaml({ id: "secret", version: "1.0.0" }), visibility: "private" },
      { cookie: cookieFor(env.alice) },
    );
    expect(response.status, await response.clone().text()).toBe(201);
    expect(((await response.json()) as Published).card.visibility).toBe("private");

    const db = env.harness.client.db;
    expect(await getCard(db, ANONYMOUS, "cards-alice/secret", "1.0.0")).toBeUndefined();
    expect(await getCard(db, actorOf(env.bob), "cards-alice/secret", "1.0.0")).toBeUndefined();
    expect((await getCard(db, actorOf(env.alice), "cards-alice/secret", "1.0.0"))?.visibility).toBe("private");

    /* The profile counts what its reader may see, so the owner's figure runs one higher. */
    const asStranger = await profileCardCount("cards-alice", { cookie: cookieFor(env.bob) });
    const asOwner = await profileCardCount("cards-alice", { cookie: cookieFor(env.alice) });
    expect(asOwner - asStranger).toBe(1);
  });

  it("refuses a second publish of the same version with 409, and stores nothing", async () => {
    const env = setup.require();
    const before = await rowsAt(env, "cards-alice/planner");
    expect(before.map((row) => row.version)).toContain("1.0.0");

    const response = await post(
      { source: cardYaml({ id: "planner", version: "1.0.0", spec: "A different spec, same version, which a stored row never takes." }) },
      { cookie: cookieFor(env.alice) },
    );
    const problem = await problemOf(response);
    expect(problem.status).toBe(409);
    expect(problem.type).toBe("https://darkprint.io/problems/card-publish-card-version-exists");
    expect(problem.detail).toContain("cards-alice/planner@1.0.0");
    expect(await rowsAt(env, "cards-alice/planner")).toHaveLength(before.length);
  });

  it("accepts a version bump into the caller's own chain", async () => {
    const env = setup.require();
    const response = await post(
      { source: cardYaml({ id: "planner", version: "1.1.0" }) },
      { cookie: cookieFor(env.alice) },
    );
    expect(response.status, await response.clone().text()).toBe(201);
    expect(((await response.json()) as Published).card.version).toBe("1.1.0");

    const versions = await listCardVersions(env.harness.client.db, ANONYMOUS, "cards-alice/planner");
    expect(versions.map((v) => v.version)).toEqual(["1.1.0", "1.0.0"]);
  });

  it("passes the store's own refusal through as 422 when the bump is smaller than the change", async () => {
    const env = setup.require();
    /* A required input added under a patch bump: `addCard` prices that as a major bump and
       refuses with its own sentence, which reaches the wire unaltered. */
    const response = await post(
      { source: cardYaml({ id: "planner", version: "1.1.1", inputs: true }) },
      { cookie: cookieFor(env.alice) },
    );
    const problem = await problemOf(response);
    expect(problem.status).toBe(422);
    expect(problem.type).toBe("https://darkprint.io/problems/card-refused");
    expect(problem.detail).toContain("smaller than the change requires");
    expect((await rowsAt(env, "cards-alice/planner")).map((row) => row.version)).not.toContain("1.1.1");
  });

  it("refuses an id somebody else already holds, with 409", async () => {
    const env = setup.require();
    /* A bundle publish can write any id it pins, so a row at `cards-alice/<name>` owned by
       bob is reachable; the door must not append alice's version to bob's chain. */
    const squat = cardYaml({ id: "cards-alice/squatted", version: "0.1.0" });
    const { validateCardSource } = await import("@/lib/server/engine");
    const body = validateCardSource(squat).card;
    if (body === undefined) throw new Error("the squat fixture does not validate");
    await addCard(env.harness.client.db, {
      cardId: "cards-alice/squatted",
      version: "0.1.0",
      ownerId: env.bob.accountId,
      visibility: "private",
      body,
      source: squat,
    });

    const response = await post(
      { source: cardYaml({ id: "squatted", version: "1.0.0" }) },
      { cookie: cookieFor(env.alice) },
    );
    const problem = await problemOf(response);
    expect(problem.status).toBe(409);
    expect(problem.type).toBe("https://darkprint.io/problems/card-publish-card-id-taken");
    expect((await rowsAt(env, "cards-alice/squatted")).map((row) => row.ownerId)).toEqual([env.bob.accountId]);
  });

  it("refuses a name that is not a legal identifier, with 400", async () => {
    const env = setup.require();
    const response = await post(
      { source: cardYaml({ id: "planner", version: "2.0.0" }), name: "My Planner" },
      { cookie: cookieFor(env.alice) },
    );
    const problem = await problemOf(response);
    expect(problem.status).toBe(400);
    expect(problem.type).toBe("https://darkprint.io/problems/card-publish-card-id-invalid");
    expect(problem.detail).toContain("`My Planner`");
  });

  it("refuses a signed-in account with no handle, with 403", async () => {
    const env = setup.require();
    const response = await post(
      { source: cardYaml({ id: "planner", version: "1.0.0" }) },
      { cookie: cookieFor(env.handleless) },
    );
    const problem = await problemOf(response);
    expect(problem.status).toBe(403);
    expect(problem.type).toBe("https://darkprint.io/problems/card-publish-no-handle");
  });

  it("answers 400 for a malformed body, before anything is read", async () => {
    const env = setup.require();
    const cookie = cookieFor(env.alice);
    expect((await post("not json", { cookie })).status).toBe(400);
    expect((await post({ name: "x" }, { cookie })).status).toBe(400);
    const badVisibility = await post(
      { source: cardYaml({ id: "planner", version: "3.0.0" }), visibility: "unlisted" },
      { cookie },
    );
    expect(badVisibility.status).toBe(400);
    expect((await problemOf(badVisibility)).detail).toContain("`visibility`");
    expect((await rowsAt(env, "cards-alice/planner")).map((row) => row.version)).not.toContain("3.0.0");
  });

  it("answers problem+json on every refusal", async () => {
    const env = setup.require();
    const response = await post({ source: "id: x\n" }, { cookie: cookieFor(env.alice) });
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect((await response.json()) as { instance: string }).toMatchObject({ instance: "/api/cards" });
  });

  /* Last, on purpose: the counter is process-wide and this exhausts its own account. The
     bucket is spent before the body is read, so thirty malformed bodies are enough. */
  it("spends the upload bucket and answers 429 past its ceiling", async () => {
    const env = setup.require();
    const cookie = cookieFor(env.flooder);
    let last = 0;
    for (let i = 0; i < 30; i += 1) {
      last = (await post({}, { cookie })).status;
    }
    expect(last).toBe(400);
    const refused = await post({}, { cookie });
    const problem = await problemOf(refused);
    expect(problem.status).toBe(429);
    expect(problem.type).toBe("https://darkprint.io/problems/rate-limited");
    expect(problem.detail).toContain("upload");
  });
});
