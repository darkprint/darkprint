/**
 * Scratch coverage for the two routes D-70-03 published, run by the implementer only —
 * does not count as verification (docs/ORCHESTRATION.md, Agent A). Colocated under
 * `app/api/names/**`, which is T070's `Owns` and which `vitest.config.ts` began
 * collecting for exactly this: "four tasks own route files under `app/` and any
 * colocated test beside one was never going to be collected".
 *
 * The route reaches for `getSharedDbClient()`, which opens `DATABASE_URL` — the shared
 * development database. So the shared slot is pointed at a scratch database for the
 * duration, and **the injection verifies itself**: the first case asserts a handle that
 * exists only in the scratch database reads as taken. An injection that silently failed
 * would put the question to the shared database, which does not have that row, and the
 * answer would be `available` — red, rather than a test quietly measuring the wrong
 * server. Both routes only read, so nothing here can write to the shared database even
 * if the slot were missed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type DbClient } from "@/lib/db";
import { createTestDb, type TestDb } from "../../../tests/support/db";
import { GET as getHandle } from "./handles/[handle]/route";
import { GET as getSlug } from "./slugs/[owner]/[slug]/route";

/** The well-known slot `getSharedDbClient()` caches on. Named here, not imported: it is
 *  `Symbol.for`, so the registry lookup is the same object T000 stores under. */
const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("app/api/names", () => {
  let testDb: TestDb | undefined;
  let previous: DbClient | undefined;
  let ownerId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    const withShared = globalThis as GlobalWithSharedClient;
    previous = withShared[SHARED_CLIENT_KEY];
    withShared[SHARED_CLIENT_KEY] = testDb.client;

    const [account] = await testDb.client.db
      .insert(schema.account)
      .values({ githubId: "gh-routes", githubLogin: "gh-routes", handle: "mara-veil" })
      .returning();
    ownerId = account.id;
    await testDb.client.db
      .insert(schema.handleReservation)
      .values({ handle: "mara-veil", accountId: ownerId, status: "active" });
    await testDb.client.db
      .insert(schema.bundle)
      .values({ ownerId, slug: "frontline-triage", visibility: "public" });
  });

  afterAll(async () => {
    const withShared = globalThis as GlobalWithSharedClient;
    if (previous === undefined) delete withShared[SHARED_CLIENT_KEY];
    else withShared[SHARED_CLIENT_KEY] = previous;
    await testDb?.drop();
  });

  async function handleRoute(handle: string): Promise<{ status: number; body: unknown }> {
    const response = await getHandle(new Request(`http://t/api/names/handles/${handle}`), {
      params: Promise.resolve({ handle }),
    });
    return { status: response.status, body: await response.json() };
  }

  async function slugRoute(owner: string, slug: string): Promise<{ status: number; body: unknown }> {
    const response = await getSlug(new Request(`http://t/api/names/slugs/${owner}/${slug}`), {
      params: Promise.resolve({ owner, slug }),
    });
    return { status: response.status, body: await response.json() };
  }

  it("D-70-09: the handle route answers 200 with the Availability payload", async () => {
    /* Also the injection check — `mara-veil` exists only in the scratch database. */
    expect(await handleRoute("mara-veil")).toEqual({
      status: 200,
      body: { available: false, reason: "taken", suggestion: "mara-veil-2" },
    });
    expect(await handleRoute("k0bra")).toEqual({ status: 200, body: { available: true } });
  });

  it("D-70-09: a name nothing holds is 200 and available, never 404", async () => {
    /* The contract's own words: there is no 404, because "not found" IS the available
       answer. A 404 here would report the good case as a failure. */
    const free = await handleRoute("nobody-has-this-one");
    expect(free.status).toBe(200);
    expect(free.body).toEqual({ available: true });

    const illegal = await handleRoute("Mara Veil");
    expect(illegal.status).toBe(200);
    expect(illegal.body).toEqual({ available: false, reason: "illegal" });
  });

  it("D-70-09: the slug route reads [owner] as a handle and scopes by that owner", async () => {
    expect(await slugRoute("mara-veil", "frontline-triage")).toEqual({
      status: 200,
      body: { available: false, reason: "taken", suggestion: "frontline-triage-2" },
    });
    expect(await slugRoute("mara-veil", "incident-commander")).toEqual({
      status: 200,
      body: { available: true },
    });
  });

  it("D-70-09: an owner nobody is holds nothing, but the tabs still hold their three", async () => {
    /* The case the `NOBODY` sentinel exists for. Short-circuiting an unknown owner to
       `{available:true}` would hand out `saved`, which is a profile tab for every handle
       and cannot become a bundle name for any of them. */
    expect(await slugRoute("no-such-author", "frontline-triage")).toEqual({
      status: 200,
      body: { available: true },
    });
    expect(await slugRoute("no-such-author", "saved")).toEqual({
      status: 200,
      body: { available: false, reason: "reserved", suggestion: "saved-2" },
    });
    /* T280 made Blueprints the segmentless index tab, so `blueprints` left the reserved
       set and is an ordinary available name now; `cards` still holds its segment. Both
       directions asserted so the reservation list moving is visible here, not just in
       tabs.test.ts. */
    expect(await slugRoute("mara-veil", "blueprints")).toEqual({
      status: 200,
      body: { available: true },
    });
    expect(await slugRoute("mara-veil", "cards")).toEqual({
      status: 200,
      body: { available: false, reason: "reserved", suggestion: "cards-2" },
    });
  });

  it("D-70-09: an owner segment that is not a legal handle reaches no driver", async () => {
    /* `account.handle` is a `text` column, so an unpaired surrogate in this segment would
       be sent as U+FFFD and the lookup would be about a handle nobody typed. The answer
       still has to be the slug's own. */
    expect(await slugRoute("Not A Handle", "frontline-triage")).toEqual({
      status: 200,
      body: { available: true },
    });
    expect(await slugRoute("mara\uD800veil", "saved")).toEqual({
      status: 200,
      body: { available: false, reason: "reserved", suggestion: "saved-2" },
    });
  });
});
