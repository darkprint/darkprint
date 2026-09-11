/* ============================================================
   T400: what a caller sees when the store cannot answer

   No database is created anywhere in this file: the client is
   built from a connection string naming a closed port, so the
   fault arrives through the real driver and `connect` refuses at
   once. The module half asks the three verbs directly; the route
   half points `DATABASE_URL` at the same port and asks the URLs.

   What is asserted on both halves: the rejection is this module's
   own class with its fixed sentence, nothing a caller can read off
   it carries the statement, the table name, the host or the
   token, and the driver's error is still there on `cause` for
   whoever logs it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "@/lib/db";
import { TutorialStoreError, getLive, openLive, putLive } from "@/lib/server/tutorial";
import { parseLiveDraft } from "@/lib/core/tutorial/live";

import { UNKNOWN_TOKEN, asProblem, callRoute, draftAt, pointRoutesAt, restoreRoutesDatabase } from "./contract";

/** A port nothing listens on. */
const CLOSED_PORT_URL = "postgres://darkprint:darkprint@127.0.0.1:1/darkprint";

/** Tokens of the driver's own machinery and of this file's inputs; none may reach a rendering. */
const TELLS = ["select", "insert", "update", "delete", "tutorial_draft", "127.0.0.1", "econnrefused", "$1", UNKNOWN_TOKEN.toLowerCase()];

function rendering(error: unknown): string {
  const parts: string[] = [];
  if (error instanceof Error) parts.push(error.message, String(error), JSON.stringify(Object.keys(error)));
  parts.push(JSON.stringify(error) ?? "");
  return parts.join("\n").toLowerCase();
}

let client: DbClient;

beforeAll(() => {
  client = createDbClient(CLOSED_PORT_URL);
});

afterAll(async () => {
  await client.close().catch(() => undefined);
});

describe("the three verbs seal a driver fault", () => {
  const draft = parseLiveDraft(draftAt("nodes"));
  if ("detail" in draft) throw new Error(`fixture: ${draft.detail}`);

  it.each([
    ["openLive", () => openLive(client.db, { origin: "https://www.darkprint.io" })],
    ["putLive", () => putLive(client.db, UNKNOWN_TOKEN, draft.draft)],
    ["getLive", () => getLive(client.db, UNKNOWN_TOKEN)],
  ])("%s rejects with TutorialStoreError naming the verb and nothing else", async (verb, call) => {
    let thrown: unknown;
    try {
      await call();
    } catch (error) {
      thrown = error;
    }
    expect(thrown, `${verb} resolved against a closed port`).toBeInstanceOf(TutorialStoreError);
    const error = thrown as TutorialStoreError;
    expect(error.message).toBe(`${verb}: the tutorial store failed.`);
    expect(error.name).toBe("TutorialStoreError");
    expect(Object.keys(error)).toEqual([]);
    expect(JSON.stringify(error)).toBe("{}");
    expect(error.cause).toBeDefined();
    const text = rendering(error);
    expect(TELLS.filter((tell) => text.includes(tell))).toEqual([]);
  });

  it("the raw driver error would have leaked, so the tells measure something", async () => {
    let raw: unknown;
    try {
      await client.query(`select "token" from "tutorial_draft" where "token" = $1`, [UNKNOWN_TOKEN]);
    } catch (error) {
      raw = error;
    }
    expect(raw).toBeDefined();
    const text = [rendering(raw), String((raw as { message?: string }).message ?? "")].join("\n").toLowerCase();
    expect(TELLS.filter((tell) => text.includes(tell)).length).toBeGreaterThan(0);
  });
});

describe("the routes answer a store fault as problem+json", () => {
  beforeAll(() => {
    pointRoutesAt(CLOSED_PORT_URL);
  });

  afterAll(async () => {
    await restoreRoutesDatabase();
  });

  it.each([
    ["POST /api/tutorial/live", "POST", "/api/tutorial/live", undefined, "openLive"],
    ["GET /api/tutorial/live/[token]", "GET", `/api/tutorial/live/${UNKNOWN_TOKEN}`, undefined, "getLive"],
    ["PUT /api/tutorial/live/[token]", "PUT", `/api/tutorial/live/${UNKNOWN_TOKEN}`, draftAt("nodes"), "putLive"],
  ])("%s answers 500 store-failed naming the verb", async (label, method, path, body, verb) => {
    const answer = await callRoute(method, path, {
      headers: { "x-forwarded-for": "198.51.100.99", "content-type": "application/json" },
      body,
    });
    expect(answer.status, label).toBe(500);
    const problem = await asProblem(answer, label);
    expect(problem.type).toBe("https://darkprint.io/problems/store-failed");
    expect(problem.detail).toBe(`${verb}: the tutorial store failed.`);
    const text = JSON.stringify(problem).toLowerCase();
    expect(TELLS.filter((tell) => tell !== UNKNOWN_TOKEN.toLowerCase() && text.includes(tell))).toEqual([]);
  });
});
