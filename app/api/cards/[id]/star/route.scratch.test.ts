/* ============================================================
   T280 implementer's scratch harness for the card star route —
   not the criterion suite (docs/ORCHESTRATION.md, Agent A). See
   the blueprint star route's own scratch harness for why the
   shared-client slot is asserted by identity rather than trusted:
   this route writes too, against the same `getSharedDbClient()`.

   The fixture is two REAL cards out of `readContent()` — different
   bundles, so their ids are guaranteed distinct without editing
   either one — rather than a hand-built `NodeCard`: `addCard`
   refuses anything that does not round-trip through
   `findWellFormednessIssue`, and the archive's own fixture already
   satisfies that.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readContent, type LoadedBundle } from "@/lib/content/read";
import { schema, type Db, type DbClient, getSharedDbClient } from "@/lib/db";
import { addCard } from "@/lib/server/cards";
import { encodeSession, SESSION_COOKIE_NAME } from "@/lib/server/auth";
import type { NodeCard } from "@/lib/server/types";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";
import { POST } from "./route";

const SECRET = "t280-card-star-scratch-secret";
process.env.SESSION_SECRET = SECRET;

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const hasDb = Boolean(process.env.DATABASE_URL);

/** The first card `entry` pins, as `addCard` wants it — the archive's own bytes, not a fixture of our own. */
function pinnedCardOf(entry: LoadedBundle): { cardId: string; version: string; body: NodeCard; source: string } {
  const pinned = entry.blueprint.nodes[0].ref;
  const [cardId, version] = pinned.split("@");
  const body = entry.blueprint.cards.get(pinned)!;
  const file = entry.cardFiles.find(
    (candidate) => candidate.file.replace(/^cards\//, "").replace(/\.yaml$/, "") === pinned,
  )!;
  return { cardId, version, body, source: file.text };
}

describe.skipIf(!hasDb)("POST /api/cards/[id]/star", () => {
  let testDb: TestDb;
  let previous: DbClient | undefined;
  let db: Db;
  let ownerId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    const withShared = globalThis as GlobalWithSharedClient;
    previous = withShared[SHARED_CLIENT_KEY];
    withShared[SHARED_CLIENT_KEY] = testDb.client;
    db = testDb.client.db;

    if (getSharedDbClient() !== testDb.client) {
      throw new Error(
        "The shared client slot is NOT the scratch database. This route WRITES stars, so " +
          "running on would mutate the shared development database. Refusing to run.",
      );
    }
  });

  beforeEach(async () => {
    await resetTestDb(testDb.client);
    /* Every card in this file needs an owner to point at, so it is seeded fresh after
       each truncation rather than once in `beforeAll` and then gone the moment the
       first test's cleanup runs. */
    const [account] = await db
      .insert(schema.account)
      .values({ githubId: "t280-card-owner", githubLogin: "t280-card-owner", handle: "card-owner" })
      .returning();
    ownerId = account.id;
  });

  afterAll(async () => {
    const withShared = globalThis as GlobalWithSharedClient;
    if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previous;
    await testDb.drop();
  });

  async function makeAccount(githubId: string, handle: string): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId, githubLogin: githubId, handle })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  function signedRequest(url: string, session: { accountId: string; handle: string | null }): Request {
    return new Request(url, {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeSession(session, SECRET)}` },
    });
  }

  it("stars a card by its BARE id — no `@version` in the address — and toggles off again", async () => {
    const entry = readContent()[0];
    const card = pinnedCardOf(entry);
    await addCard(db, { ...card, ownerId, visibility: "public" });
    const starrerId = await makeAccount("gh-card-starrer", "card-starrer");

    const on = await POST(
      signedRequest(`https://x/api/cards/${card.cardId}/star`, { accountId: starrerId, handle: "card-starrer" }),
      { params: Promise.resolve({ id: card.cardId }) },
    );
    expect(on.status).toBe(200);
    const onBody = (await on.json()) as { signals: { starCount: number; starredByCaller: boolean } };
    expect(onBody.signals.starCount).toBe(1);
    expect(onBody.signals.starredByCaller).toBe(true);

    const off = await POST(
      signedRequest(`https://x/api/cards/${card.cardId}/star`, { accountId: starrerId, handle: "card-starrer" }),
      { params: Promise.resolve({ id: card.cardId }) },
    );
    expect(off.status).toBe(200);
    const offBody = (await off.json()) as { signals: { starCount: number; starredByCaller: boolean } };
    expect(offBody.signals.starCount).toBe(0);
    expect(offBody.signals.starredByCaller).toBe(false);
  });

  it("anonymous is 401 and moves nothing", async () => {
    const entry = readContent()[0];
    const card = pinnedCardOf(entry);
    await addCard(db, { ...card, ownerId, visibility: "public" });

    const response = await POST(new Request(`https://x/api/cards/${card.cardId}/star`, { method: "POST" }), {
      params: Promise.resolve({ id: card.cardId }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await db.select().from(schema.target)).toHaveLength(0);
  });

  /**
   * B-03, the same Mind clause as the blueprint route: `toggleStar` performs no
   * visibility check, so `getLatestCard` resolving is this route's whole readability
   * gate. Falsified below.
   */
  it("a private card is 404 to a stranger — same message as an absent id — and starrable by its owner", async () => {
    /* A SECOND bundle's pinned card, so its id is guaranteed distinct from the public
       one above without editing either fixture. */
    const entry = readContent()[1];
    const card = pinnedCardOf(entry);
    await addCard(db, { ...card, ownerId, visibility: "private" });
    const strangerId = await makeAccount("gh-card-stranger", "card-stranger");

    const strangerResponse = await POST(
      signedRequest(`https://x/api/cards/${card.cardId}/star`, {
        accountId: strangerId,
        handle: "card-stranger",
      }),
      { params: Promise.resolve({ id: card.cardId }) },
    );
    expect(strangerResponse.status).toBe(404);
    const strangerBody = (await strangerResponse.json()) as { detail: string };

    const absentResponse = await POST(
      signedRequest("https://x/api/cards/nothing-at-all/star", {
        accountId: strangerId,
        handle: "card-stranger",
      }),
      { params: Promise.resolve({ id: "nothing-at-all" }) },
    );
    expect(absentResponse.status).toBe(404);
    expect(((await absentResponse.json()) as { detail: string }).detail).toBe(strangerBody.detail);
    expect(await db.select().from(schema.target)).toHaveLength(0);

    const ownerResponse = await POST(
      signedRequest(`https://x/api/cards/${card.cardId}/star`, { accountId: ownerId, handle: "card-owner" }),
      { params: Promise.resolve({ id: card.cardId }) },
    );
    expect(ownerResponse.status).toBe(200);
    const ownerBody = (await ownerResponse.json()) as { signals: { starCount: number } };
    expect(ownerBody.signals.starCount).toBe(1);
  });

  it("no residue in the shared database", async () => {
    expect(getSharedDbClient()).toBe(testDb.client);
  });
});
