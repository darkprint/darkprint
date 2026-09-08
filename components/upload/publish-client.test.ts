/* ============================================================
   `publishCard`, over a stubbed `fetch`.

   The function promises never to throw and to turn every answer
   the route can give into one of four states. Each cell hands it
   one answer and reads the state back; the route's own behaviour
   is measured against Postgres in `tests/server/cards-publish`.
   ============================================================ */

import { afterEach, describe, expect, it } from "vitest";

import { publishCard } from "./publish-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function answering(status: number, body: unknown, contentType = "application/json"): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } })) as typeof fetch;
}

const SUBMISSION = { source: "id: planner\n", visibility: "private" as const };

describe("publishCard", () => {
  it("sends the document and the visibility to POST /api/cards", async () => {
    let seen: { url: string; method?: string; body?: unknown } | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(input), method: init?.method, body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({}), { status: 500 });
    }) as typeof fetch;
    await publishCard(SUBMISSION);
    expect(seen?.url).toBe("/api/cards");
    expect(seen?.method).toBe("POST");
    expect(seen?.body).toEqual(SUBMISSION);
  });

  it("reads a 201 into the four things the screen names", async () => {
    answering(201, {
      card: { cardId: "berti/planner", version: "1.0.0", visibility: "private", digest: "sha256:x" },
      path: "/nodes/berti/planner",
    });
    expect(await publishCard(SUBMISSION)).toEqual({
      state: "published",
      card: { cardId: "berti/planner", version: "1.0.0", visibility: "private", path: "/nodes/berti/planner" },
    });
  });

  it("treats a 2xx it cannot read as unreachable rather than as a success", async () => {
    answering(201, { card: { cardId: "berti/planner" } });
    const outcome = await publishCard(SUBMISSION);
    expect(outcome.state).toBe("unreachable");
  });

  it("recovers the refusal kind from the problem type, with the diagnostics", async () => {
    answering(
      422,
      {
        type: "https://darkprint.io/problems/card-publish-card-invalid",
        title: "Card invalid",
        status: 422,
        detail: "publishCard: the card was refused with 1 error.",
        instance: "/api/cards",
        diagnostics: [{ code: "card/bad-id", severity: "error", message: "Card id `X` is not a legal identifier." }],
      },
      "application/problem+json",
    );
    const outcome = await publishCard(SUBMISSION);
    expect(outcome).toMatchObject({ state: "refused", kind: "card-invalid" });
    if (outcome.state !== "refused") throw new Error("unreachable");
    expect(outcome.detail).toBe("publishCard: the card was refused with 1 error.");
    expect(outcome.diagnostics).toHaveLength(1);
  });

  it("reads the store's own refusal as a refusal too", async () => {
    answering(
      422,
      {
        type: "https://darkprint.io/problems/card-refused",
        title: "Card refused",
        status: 422,
        detail: "addCard: `berti/planner@1.0.1`'s declared bump is smaller than the change requires.",
        instance: "/api/cards",
      },
      "application/problem+json",
    );
    const outcome = await publishCard(SUBMISSION);
    expect(outcome).toMatchObject({ state: "refused", kind: "card-refused", diagnostics: [] });
  });

  it("does not invent a kind for a type it does not know", async () => {
    answering(
      409,
      {
        type: "https://darkprint.io/problems/card-publish-something-new",
        title: "New",
        status: 409,
        detail: "A refusal added after this file was written.",
        instance: "/api/cards",
      },
      "application/problem+json",
    );
    const outcome = await publishCard(SUBMISSION);
    expect(outcome).toMatchObject({ state: "rejected", status: 409, title: "New" });
  });

  it("says the session expired on a 401", async () => {
    answering(
      401,
      { type: "https://darkprint.io/problems/unauthorized", title: "Unauthorized", status: 401, detail: "Sign in required.", instance: "/api/cards" },
      "application/problem+json",
    );
    const outcome = await publishCard(SUBMISSION);
    expect(outcome).toMatchObject({ state: "rejected", status: 401 });
    if (outcome.state !== "rejected") throw new Error("unreachable");
    expect(outcome.detail).toContain("Your session has expired");
  });

  it("turns a network failure into a state rather than a throw", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    const outcome = await publishCard(SUBMISSION);
    expect(outcome.state).toBe("unreachable");
  });
});
