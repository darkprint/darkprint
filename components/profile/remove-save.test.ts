import { describe, expect, it } from "vitest";

import { attachStars, cardStarApi, removeSavedRow, type RemovalRequest } from "./remove-save";

/* ============================================================
   `Remove` on the Saved shelf has to clear the star as well as the save.

   §11.0 Q24: Save was folded into Star (D-132) and the removal path was not folded with
   them, so a card left the shelf while its public star stood. These cells hold the two
   writes together — delete the star request from `removeSavedRow` and the first one reds
   with the request list it actually issued.

   Every cell drives the real function through a recording `fetch`, so what is asserted is
   the requests that went out and in what order, which is the only thing the two stores
   can disagree about.
   ============================================================ */

interface Call {
  url: string;
  method: string | undefined;
  body: string | undefined;
}

/**
 * A `fetch` that records and answers from a script.
 *
 * `answers` is consumed in order; a call past the end of it is itself a finding, so it
 * throws rather than defaulting to a 200 that would make an unexpected extra request look
 * like success.
 */
function recorder(answers: readonly { ok: boolean; starred?: boolean }[]) {
  const calls: Call[] = [];
  let i = 0;
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({
      url,
      method: init?.method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    const answer = answers[i++];
    if (answer === undefined) throw new Error(`unscripted request ${i}: ${init?.method} ${url}`);
    return {
      ok: answer.ok,
      json: async () =>
        answer.starred === undefined
          ? {}
          : { signals: { starCount: 0, starredByCaller: answer.starred } },
    } as Response;
  };
  return { calls, fetchImpl };
}

const CARD: RemovalRequest = {
  target: { kind: "card", refId: "intent-router" },
  star: { api: "/api/cards/intent-router/star", starred: true },
};

describe("removeSavedRow", () => {
  it("clears the star as well as the save, star first", async () => {
    const { calls, fetchImpl } = recorder([
      { ok: true, starred: false },
      { ok: true },
    ]);

    const result = await removeSavedRow(CARD, fetchImpl);

    expect(result).toEqual({ removed: true, star: "cleared" });
    /* The whole of Q24 in one assertion: two requests, and the star one is not optional.
       A removal that issues only the DELETE reds here with a one-element list. */
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/cards/intent-router/star",
      "DELETE /api/account/saves",
    ]);
    expect(calls[1].body).toBe(JSON.stringify(CARD.target));
  });

  it("leaves the save alone when the star will not come down", async () => {
    const { calls, fetchImpl } = recorder([{ ok: false }]);

    const result = await removeSavedRow(CARD, fetchImpl);

    /* Nothing moved, which is the only end state that needs no explanation. Deleting the
       save here would put the shelf and the star back into exactly the disagreement this
       change removes, on an error path where nobody would see it. */
    expect(result).toEqual({ removed: false, star: "standing" });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
  });

  it("reports the save as still there when the star came down and the delete failed", async () => {
    const { calls, fetchImpl } = recorder([{ ok: true, starred: false }, { ok: false }]);

    const result = await removeSavedRow(CARD, fetchImpl);

    expect(result).toEqual({ removed: false, star: "cleared" });
    expect(calls).toHaveLength(2);
  });

  it("presses no star toggle for a row that has none", async () => {
    const { calls, fetchImpl } = recorder([{ ok: true }]);

    const result = await removeSavedRow(
      { target: { kind: "term", refId: "dp.core.retry" } },
      fetchImpl,
    );

    expect(result).toEqual({ removed: true, star: "absent" });
    expect(calls.map((c) => c.url)).toEqual(["/api/account/saves"]);
  });

  it("presses no star toggle for a card whose star is already down", async () => {
    const { calls, fetchImpl } = recorder([{ ok: true }]);

    /* A save that predates the fold: the row is on the shelf and no star was ever
       written. The route is a toggle, so a request here would STAR the card with the
       click that removes it. */
    const result = await removeSavedRow(
      { ...CARD, star: { api: CARD.star!.api, starred: false } },
      fetchImpl,
    );

    expect(result).toEqual({ removed: true, star: "cleared" });
    expect(calls.map((c) => c.url)).toEqual(["/api/account/saves"]);
  });

  it("puts the star back when a stale snapshot made the toggle go the wrong way", async () => {
    /* The page said starred, the account had un-starred it in another tab since, so the
       first POST turned it ON. Bounded at two: the second puts it back, and then the save
       is deleted. */
    const { calls, fetchImpl } = recorder([
      { ok: true, starred: true },
      { ok: true, starred: false },
      { ok: true },
    ]);

    const result = await removeSavedRow(CARD, fetchImpl);

    expect(result).toEqual({ removed: true, star: "cleared" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/cards/intent-router/star",
      "POST /api/cards/intent-router/star",
      "DELETE /api/account/saves",
    ]);
  });

  it("never presses the toggle a third time", async () => {
    /* Both toggles answered `starred`, which is a server this client cannot argue with.
       It stops and keeps the save, rather than looping against it. */
    const { calls, fetchImpl } = recorder([
      { ok: true, starred: true },
      { ok: true, starred: true },
    ]);

    const result = await removeSavedRow(CARD, fetchImpl);

    expect(result).toEqual({ removed: false, star: "standing" });
    expect(calls).toHaveLength(2);
  });

  it("keeps the save when the star request throws", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string): Promise<Response> => {
      calls.push(url);
      throw new Error("offline");
    };

    const result = await removeSavedRow(CARD, fetchImpl);

    expect(result).toEqual({ removed: false, star: "standing" });
    expect(calls).toEqual(["/api/cards/intent-router/star"]);
  });
});

describe("attachStars", () => {
  const rows: RemovalRequest[] = [
    { target: { kind: "card", refId: "intent-router" } },
    { target: { kind: "term", refId: "dp.core.retry" } },
    { target: { kind: "card", refId: "kb-resolver" } },
  ];

  it("gives every card row the star its save indexes, and nothing else one", () => {
    const out = attachStars(rows, new Map([["intent-router", true]]));

    /* The half of Q24 that lives in the loader: a card row with no `star` has a `Remove`
       that can only reach one of the two stores, and every cell above would still pass. */
    expect(out[0].star).toEqual({ api: cardStarApi("intent-router"), starred: true });
    expect(out[1].star).toBeUndefined();
    expect(out[2].star).toEqual({ api: cardStarApi("kb-resolver"), starred: false });
  });

  it("treats a card the counters have never seen as unstarred", () => {
    /* Not a detail: `undefined` read as starred would press the toggle and STAR a card
       with the click that removes it. */
    expect(attachStars(rows, new Map())[0].star?.starred).toBe(false);
  });

  it("addresses the bare card id, escaped", () => {
    expect(cardStarApi("a/b")).toBe("/api/cards/a%2Fb/star");
  });

  it("leaves the rows it was given alone", () => {
    const before = JSON.stringify(rows);
    attachStars(rows, new Map([["intent-router", true]]));
    expect(JSON.stringify(rows)).toBe(before);
  });
});
