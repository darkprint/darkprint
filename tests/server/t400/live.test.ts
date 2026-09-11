/* ============================================================
   T400: the live tutorial channel, driven through its two URLs

   Every cell here goes through the router: a page is opened with
   POST, written with PUT and read with GET, and what the store
   holds is checked by SQL against the scratch database only where
   the contract says something about the row itself (that an
   expired one is gone, that the sweep runs, that the index exists).

   ── addresses ──
   The rate limiter counts anonymous callers by address and its
   counter is process-wide, so each describe block sends its own
   `x-forwarded-for` and the ceiling cell has an address of its own.
   Without that, sixty opens in one block would 429 the next.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LIVE_DRAFT_MAX_BYTES, LIVE_TOKEN_PATTERN } from "@/lib/core/tutorial/live";
import { SITE_ORIGIN } from "@/lib/site";

import {
  OPEN_ROUTE,
  PAGE_ROUTE,
  UNKNOWN_TOKEN,
  asProblem,
  callRoute,
  draftAt,
  dropScratchDatabases,
  pointRoutesAt,
  restoreRoutesDatabase,
  routePatternFor,
  scratchDatabase,
  type Scratch,
} from "./contract";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Slack for the wall clock between the store's `new Date()` and this file's. */
const SLACK_MS = 5_000;

let s: Scratch;

beforeAll(async () => {
  s = await scratchDatabase();
  pointRoutesAt(s.url);
});

afterAll(async () => {
  await restoreRoutesDatabase();
  await dropScratchDatabases();
});

function from(ip: string, extra: Record<string, string> = {}): Record<string, string> {
  /* The JSON content type on every request, because POST refuses a body without it: a
     cross-site form cannot send that header, and both real callers do. */
  return { "x-forwarded-for": ip, "content-type": "application/json", ...extra };
}

async function openPage(ip: string): Promise<{ token: string; url: string; expiresAt: string }> {
  const answer = await callRoute("POST", "/api/tutorial/live", { headers: from(ip) });
  expect(answer.status, `${OPEN_ROUTE} status`).toBe(200);
  return (await answer.json()) as { token: string; url: string; expiresAt: string };
}

async function expireBySql(token: string, by = "1 hour"): Promise<void> {
  await s.query(`update "tutorial_draft" set "expires_at" = now() - interval '${by}' where "token" = $1`, [token]);
}

async function rowCount(token: string): Promise<number> {
  const [row] = await s.query(`select count(*)::int as n from "tutorial_draft" where "token" = $1`, [token]);
  return Number(row!.n);
}

describe("the published URLs are served", () => {
  it("routes the collection and the page to two distinct patterns", () => {
    expect(routePatternFor("/api/tutorial/live")).toBe("/api/tutorial/live");
    expect(routePatternFor(`/api/tutorial/live/${UNKNOWN_TOKEN}`)).toBe("/api/tutorial/live/[token]");
  });

  it("the collection takes POST only: GET answers 405 with Allow, OPTIONS 204", async () => {
    const refused = await callRoute("GET", "/api/tutorial/live");
    expect(refused.status).toBe(405);
    expect(refused.headers.get("allow")).toBe("POST");
    const problem = await asProblem(refused, "GET /api/tutorial/live");
    expect(problem.type).toBe("https://darkprint.io/problems/method-not-allowed");

    const options = await callRoute("OPTIONS", "/api/tutorial/live");
    expect(options.status).toBe(204);
    expect(options.headers.get("allow")).toBe("POST");
  });

  it("the table carries the index the sweep reads", async () => {
    const rows = await s.query(
      `select indexname from pg_indexes where schemaname = 'public' and tablename = 'tutorial_draft' order by indexname`,
    );
    expect(rows.map((r) => r.indexname)).toEqual(["tutorial_draft_expires_at_idx", "tutorial_draft_pkey"]);
  });
});

describe(`${OPEN_ROUTE} then GET`, () => {
  const IP = "198.51.100.1";

  it("opens a page with a 32-character token, the site's URL and a 24-hour expiry", async () => {
    const before = Date.now();
    const opened = await openPage(IP);
    expect(opened.token).toMatch(LIVE_TOKEN_PATTERN);
    expect(opened.token).toHaveLength(32);
    expect(opened.url).toBe(`${SITE_ORIGIN}/tutorial/live/${opened.token}`);
    const expiresIn = new Date(opened.expiresAt).getTime() - before;
    expect(expiresIn).toBeGreaterThan(DAY_MS - SLACK_MS);
    expect(expiresIn).toBeLessThanOrEqual(DAY_MS + SLACK_MS);
  });

  it("builds the URL from the site's origin, never from the request's host", async () => {
    const answer = await callRoute("POST", "/api/tutorial/live", {
      headers: from(IP, { host: "evil.example", "x-forwarded-host": "evil.example" }),
    });
    expect(answer.status).toBe(200);
    const { url } = (await answer.json()) as { url: string };
    expect(url.startsWith(`${SITE_ORIGIN}/`)).toBe(true);
    expect(url).not.toContain("evil.example");
    /* The request itself was made against darkprint.test; a route reading `request.url`
       would answer that host, which is also not the site's. */
    expect(url).not.toContain("darkprint.test");
  });

  it("answers the opened page at revision 1 with an empty first-phase draft, ETag and no-store", async () => {
    const opened = await openPage(IP);
    const answer = await callRoute("GET", `/api/tutorial/live/${opened.token}`, { headers: from(IP) });
    expect(answer.status, `${PAGE_ROUTE} status`).toBe(200);
    expect(answer.headers.get("etag")).toBe('"1"');
    expect(answer.headers.get("cache-control")).toBe("no-store");
    const record = (await answer.json()) as Record<string, unknown>;
    expect(Object.keys(record).sort()).toEqual(["draft", "expiresAt", "revision", "token", "updatedAt"]);
    expect(record.token).toBe(opened.token);
    expect(record.revision).toBe(1);
    expect(record.expiresAt).toBe(opened.expiresAt);
    expect(new Date(String(record.updatedAt)).toISOString()).toBe(record.updatedAt);
    expect(record.draft).toEqual({
      phase: "need",
      bundle: { manifest: { slug: "", title: "", summary: "", tags: [] }, dot: "", cardFiles: {} },
    });
  });

  it("mints a different token per open", async () => {
    const a = await openPage(IP);
    const b = await openPage(IP);
    expect(a.token).not.toBe(b.token);
  });
});

describe(`PUT ${PAGE_ROUTE.slice("GET, PUT ".length)}`, () => {
  const IP = "198.51.100.2";

  it("stores the draft, increments the revision on every accepted write, and GET reads it back", async () => {
    const { token } = await openPage(IP);
    const path = `/api/tutorial/live/${token}`;

    const first = await callRoute("PUT", path, { headers: from(IP), body: draftAt("nodes") });
    expect(first.status).toBe(200);
    const written = (await first.json()) as Record<string, unknown>;
    expect(Object.keys(written).sort()).toEqual(["expiresAt", "revision", "updatedAt"]);
    expect(written.revision).toBe(2);

    const second = await callRoute("PUT", path, { headers: from(IP), body: draftAt("ports") });
    expect(((await second.json()) as { revision: number }).revision).toBe(3);

    const read = await callRoute("GET", path, { headers: from(IP) });
    expect(read.headers.get("etag")).toBe('"3"');
    const record = (await read.json()) as { revision: number; draft: Record<string, unknown> };
    expect(record.revision).toBe(3);
    expect(record.draft).toEqual(draftAt("ports"));

    /* The phase column is lifted off the draft on every write. */
    const [row] = await s.query(`select "phase" from "tutorial_draft" where "token" = $1`, [token]);
    expect(row!.phase).toBe("ports");
  });

  it("refreshes the expiry to 24 hours after the write", async () => {
    const { token } = await openPage(IP);
    /* Open and PUT happen a millisecond apart, so without this push the expiry an open set
       and the one a write should set are the same instant, and a write that forgot to
       refresh would pass. */
    await s.query(`update "tutorial_draft" set "expires_at" = "expires_at" - interval '1 hour' where "token" = $1`, [token]);
    const [before] = await s.query(`select "expires_at" from "tutorial_draft" where "token" = $1`, [token]);
    const pushedBack = (before!.expires_at as Date).getTime();

    const answer = await callRoute("PUT", `/api/tutorial/live/${token}`, { headers: from(IP), body: draftAt("guards") });
    expect(answer.status).toBe(200);
    const written = (await answer.json()) as { updatedAt: string; expiresAt: string };
    const ttl = new Date(written.expiresAt).getTime() - new Date(written.updatedAt).getTime();
    expect(ttl).toBeGreaterThan(DAY_MS - SLACK_MS);
    expect(ttl).toBeLessThanOrEqual(DAY_MS + SLACK_MS);
    expect(new Date(written.expiresAt).getTime() - pushedBack).toBeGreaterThan(60 * 60 * 1000 - SLACK_MS);
  });

  it("refuses a malformed draft with 400 naming the field, and the revision does not move", async () => {
    const { token } = await openPage(IP);
    const path = `/api/tutorial/live/${token}`;

    const cases: [string, unknown, string][] = [
      ["an unknown phase", draftAt("nope"), "`phase`"],
      ["a manifest slug that is not a string", draftAt("nodes", { bundle: { manifest: { slug: 1, title: "t", summary: "s", tags: [] }, dot: "", cardFiles: {} } }), "`bundle.manifest.slug`"],
      ["a card file that is not a string", draftAt("nodes", { bundle: { manifest: { slug: "a", title: "t", summary: "s", tags: [] }, dot: "", cardFiles: { "cards/x.yaml": 7 } } }), "`bundle.cardFiles[\"cards/x.yaml\"]`"],
      ["a ledger missing a list", draftAt("nodes", { ledger: { settled: [] } }), "`ledger`"],
      ["a JSON array", [draftAt("nodes")], "JSON object"],
      ["text that is not JSON", "{not json", "not valid JSON"],
    ];
    for (const [label, body, names] of cases) {
      const answer = await callRoute("PUT", path, { headers: from(IP), body });
      expect(answer.status, label).toBe(400);
      const problem = await asProblem(answer, label);
      expect(problem.type, label).toBe("https://darkprint.io/problems/bad-request");
      expect(String(problem.detail), label).toContain(names);
    }

    const read = await callRoute("GET", path, { headers: from(IP) });
    expect(read.headers.get("etag")).toBe('"1"');
  });

  it("answers 413 above LIVE_DRAFT_MAX_BYTES and accepts a body of exactly that size", async () => {
    const { token } = await openPage(IP);
    const path = `/api/tutorial/live/${token}`;

    /* ASCII only, so one character is one byte and the padding lands the body on the bound
       exactly rather than near it: this is the cell that tells `>` from `>=`. */
    const skeleton = JSON.stringify(draftAt("nodes", { task: "" }));
    const room = LIVE_DRAFT_MAX_BYTES - Buffer.byteLength(skeleton, "utf8");
    const exact = JSON.stringify(draftAt("nodes", { task: "p".repeat(room) }));
    expect(Buffer.byteLength(exact, "utf8")).toBe(LIVE_DRAFT_MAX_BYTES);
    const over = JSON.stringify(draftAt("nodes", { task: "p".repeat(room + 1) }));

    const refused = await callRoute("PUT", path, { headers: from(IP), body: over });
    expect(refused.status).toBe(413);
    const problem = await asProblem(refused, "oversize PUT");
    expect(problem.type).toBe("https://darkprint.io/problems/limit-exceeded");
    expect(String(problem.detail)).toContain(String(LIVE_DRAFT_MAX_BYTES));
    expect(String(problem.detail)).not.toContain("ppp");

    const read = await callRoute("GET", path, { headers: from(IP) });
    expect(read.headers.get("etag"), "a refused draft is not stored").toBe('"1"');

    const accepted = await callRoute("PUT", path, { headers: from(IP), body: exact });
    expect(accepted.status).toBe(200);
  });
});

describe("tokens that are not pages", () => {
  const IP = "198.51.100.3";

  it.each([
    ["too short", "a".repeat(31)],
    ["too long", "a".repeat(33)],
    ["the right length with a character outside the alphabet", `${"a".repeat(31)}.`],
  ])("a token that is %s answers 400 on GET and PUT without echoing it", async (_label, token) => {
    const path = `/api/tutorial/live/${token}`;
    for (const [method, body] of [["GET", undefined], ["PUT", draftAt("nodes")]] as const) {
      const answer = await callRoute(method, path, { headers: from(IP), body });
      expect(answer.status, method).toBe(400);
      const problem = await asProblem(answer, method);
      expect(String(problem.detail), method).toContain("`token`");
      expect(String(problem.detail), method).not.toContain(token);
    }
  });

  it("a well-formed token nobody minted answers 404 on GET and PUT, in the same words", async () => {
    const path = `/api/tutorial/live/${UNKNOWN_TOKEN}`;
    const got = await callRoute("GET", path, { headers: from(IP) });
    expect(got.status).toBe(404);
    const getProblem = await asProblem(got, "GET unknown");
    expect(getProblem.type).toBe("https://darkprint.io/problems/not-found");

    const put = await callRoute("PUT", path, { headers: from(IP), body: draftAt("nodes") });
    expect(put.status).toBe(404);
    const putProblem = await asProblem(put, "PUT unknown");
    expect(putProblem.detail).toBe(getProblem.detail);
  });

  it("an expired page answers 404 on GET, and the row is gone afterwards", async () => {
    const { token } = await openPage(IP);
    await expireBySql(token);
    expect(await rowCount(token)).toBe(1);

    const answer = await callRoute("GET", `/api/tutorial/live/${token}`, { headers: from(IP) });
    expect(answer.status).toBe(404);
    const problem = await asProblem(answer, "GET expired");
    expect(problem.type).toBe("https://darkprint.io/problems/not-found");
    expect(await rowCount(token)).toBe(0);
  });

  it("an expired page refuses a PUT with 404 and is not revived by it", async () => {
    const { token } = await openPage(IP);
    await expireBySql(token);

    const answer = await callRoute("PUT", `/api/tutorial/live/${token}`, { headers: from(IP), body: draftAt("nodes") });
    expect(answer.status).toBe(404);
    const [row] = await s.query(`select "revision", "expires_at" from "tutorial_draft" where "token" = $1`, [token]);
    expect(row!.revision).toBe(1);
    expect((row!.expires_at as Date).getTime()).toBeLessThan(Date.now());
  });

  it("opening a page sweeps every expired row", async () => {
    const stale = await openPage(IP);
    const fresh = await openPage(IP);
    await expireBySql(stale.token);

    await openPage(IP);
    expect(await rowCount(stale.token)).toBe(0);
    expect(await rowCount(fresh.token), "a live row survives the sweep").toBe(1);
  });
});

describe("If-None-Match", () => {
  const IP = "198.51.100.4";

  it("answers 304 with no body to a matching validator, strong or weak, and 200 otherwise", async () => {
    const { token } = await openPage(IP);
    const path = `/api/tutorial/live/${token}`;

    for (const validator of ['"1"', 'W/"1"', '"0", "1"']) {
      const answer = await callRoute("GET", path, { headers: from(IP, { "if-none-match": validator }) });
      expect(answer.status, validator).toBe(304);
      expect(answer.headers.get("etag"), validator).toBe('"1"');
      expect(answer.headers.get("cache-control"), validator).toBe("no-store");
      expect(await answer.text(), validator).toBe("");
    }

    const stale = await callRoute("GET", path, { headers: from(IP, { "if-none-match": '"0"' }) });
    expect(stale.status).toBe(200);

    await callRoute("PUT", path, { headers: from(IP), body: draftAt("nodes") });
    const moved = await callRoute("GET", path, { headers: from(IP, { "if-none-match": '"1"' }) });
    expect(moved.status).toBe(200);
    expect(moved.headers.get("etag")).toBe('"2"');
  });
});

describe("the live bucket", () => {
  const IP = "198.51.100.60";

  it("admits sixty opens from one address in an hour, refuses the sixty-first and every write after it, and leaves reads alone", async () => {
    let token = "";
    for (let i = 0; i < 60; i += 1) token = (await openPage(IP)).token;

    const refused = await callRoute("POST", "/api/tutorial/live", { headers: from(IP) });
    expect(refused.status).toBe(429);
    const problem = await asProblem(refused, "61st open");
    expect(problem.type).toBe("https://darkprint.io/problems/rate-limited");
    expect(problem.limit).toBe(60);
    expect(String(problem.detail).startsWith("live:")).toBe(true);

    const put = await callRoute("PUT", `/api/tutorial/live/${token}`, { headers: from(IP), body: draftAt("nodes") });
    expect(put.status, "a draft post spends the same bucket as an open").toBe(429);

    const read = await callRoute("GET", `/api/tutorial/live/${token}`, { headers: from(IP) });
    expect(read.status, "a poll spends the read bucket, which is untouched").toBe(200);
  }, 60_000);
});

describe("opening a page needs the JSON content type", () => {
  /* A simple cross-site POST carries a form content type or none. Refusing anything else
     before a slot is spent is what keeps another page from opening live pages against a
     visitor's address; the body itself is still ignored. */
  it("answers 415 to a POST without it and spends no slot", async () => {
    const ip = "198.51.100.77";
    const refused = await callRoute("POST", "/api/tutorial/live", {
      headers: { "x-forwarded-for": ip },
    });
    expect(refused.status).toBe(415);
    const problem = await asProblem(refused, "POST without a content type");
    expect(problem.type).toBe("https://darkprint.io/problems/unsupported-media-type");
    const formed = await callRoute("POST", "/api/tutorial/live", {
      headers: { "x-forwarded-for": ip, "content-type": "application/x-www-form-urlencoded" },
    });
    expect(formed.status).toBe(415);
    const opened = await openPage(ip);
    expect(opened.token).toHaveLength(32);
  });
});
