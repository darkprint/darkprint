/* ============================================================
   T130 — the one published route, and AC5's other half

   D-130-05: `GET /api/authors/[handle]` -> `200 ProfileRecord |
   404`. **404 is AC5 and it is the ROUTE's**, because `getProfile`
   answers `undefined` (D-130-02) and `undefined` is not a status.
   `seams.md`'s SEAM-52/53 `ProfileView` is superseded.

   ── the two write routes are absent BY RULING ──
   D-130-05 publishes `PUT .../pinned` and `POST/DELETE .../watch`
   as BLOCKED, not as omissions: pins and follows have no column.
   No cell here drives either, and that is the marked absence
   rather than silence.

   ── why this file exists at all, and it is not thoroughness ──
   T040 shipped 81 blind cells that ALL bound the module. Six route
   mutations reddened zero of them; four were caught by the
   implementer's own colocated file and two by nothing at all. The
   half a blind suite cannot see is the half that ends up held by
   the party who wrote the code.

   ── the cell that is not a duplicate of the module's ──
   Everything else here could be read as the reader's behaviour
   arriving through a different door. `the actor is the session's`
   is not: it is the JOIN between transport and reader, and it is
   the only thing in this suite that observes whatever turns a
   `Request` into an `Actor`. T080's adversary found exactly that
   step regressed to "nobody" in a merged, tagged task with every
   assertion still passing, because every request its suite sent
   was anonymous.

   ── the 404's WORDING is not asserted ──
   D-130-02 withdrew the published message and put the string in
   "the route's `problem` detail rather than on a class", and
   published no string in its place. A pin would be wording I
   invented and would red a correct implementation phrased
   differently. The envelope is asserted; the sentence is not, and
   the day one is published this file gains one line.

   And its justification's second branch — "identical for an
   unknown handle and one the caller may NOT SEE" — has no
   reachable instance: `account` carries fifteen columns and not
   one hides a profile. No cell is written for a case that cannot
   be built.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AUTHOR_ROUTE,
  asProblem,
  asWireProfileRecord,
  callRoute,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  mark,
  routePatternFor,
  scratchDatabase,
  sessionCookie,
  type AccountFixture,
  type Scratch,
} from "./contract";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");

let s: Scratch;
let owner: AccountFixture;
let stranger: AccountFixture;

const JOINED = new Date("2026-03-04T11:22:33.000Z");
const PUBLIC_CARDS = 1;
const PRIVATE_CARDS = 1;

let originalDatabaseUrl: string | undefined;

function path(handle: string): string {
  return `/api/authors/${handle}`;
}

async function counts(handle: string, headers: Record<string, string> = {}) {
  const answer = await callRoute(path(handle), headers);
  expect(answer.status, `${AUTHOR_ROUTE} for a handle that exists`).toBe(200);
  const body = asWireProfileRecord(await answer.json(), `${AUTHOR_ROUTE} 200 body`);
  return body.counts as Record<string, number>;
}

beforeAll(async () => {
  s = await scratchDatabase();
  owner = await insertAccount(s, {
    handle: mark("t130-route-owner").toLowerCase(),
    createdAt: JOINED,
    displayName: "Route Owner",
  });
  stranger = await insertAccount(s, { handle: mark("t130-route-other").toLowerCase() });

  const openCard = await insertCard(s, {
    id: `${owner.handle}/open`,
    ownerId: owner.id,
    authorHandle: owner.handle,
  });
  await insertCard(s, {
    id: `${owner.handle}/sealed`,
    ownerId: owner.id,
    authorHandle: owner.handle,
    visibility: "private",
  });
  await insertBundle(s, { owner, slug: "route-bundle", cards: [openCard] });

  /* The handler reaches for `getSharedDbClient()`, which reads `DATABASE_URL` and caches on
     `globalThis` behind a well-known symbol. Both the repoint AND the cache clear have to
     happen before the first call, or the route opens a pool against whatever host the shell
     names and this whole file measures a different database. */
  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = s.url;
  delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];
});

afterAll(async () => {
  /* Closed BEFORE the drop: a `DROP DATABASE` against a database with a live connection is
     refused, and the pool the route opened is exactly that connection. */
  const cached = (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY] as
    | { close?: () => Promise<void> }
    | undefined;
  if (typeof cached?.close === "function") await cached.close().catch(() => undefined);
  delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];

  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;

  await dropScratchDatabases();
});

describe("the published URL is served", () => {
  it("`/api/authors/<handle>` matches a route the tree actually publishes", () => {
    /* No database, no module, no request: this asks only whether the URL is routed, so a red
       says the surface is absent rather than that a call failed. */
    expect(routePatternFor(path("someone"))).toBe("/api/authors/[handle]");
  });
});

describe(`${AUTHOR_ROUTE} answers 200 ProfileRecord`, () => {
  it("answers the record's three members, with `joinedAt` as an ISO string", async () => {
    const answer = await callRoute(path(owner.handle));
    expect(answer.status).toBe(200);
    const body = asWireProfileRecord(await answer.json(), `${AUTHOR_ROUTE} 200 body`);

    /* The record itself, not `{ profile: … }`. `GET /api/account` is the precedent the block
       is written in the shape of — `-> 200 AccountRecord`, served as `ok(record)` — and
       `asWireProfileRecord` reds on an envelope because the key set would be wrong. */
    expect(new Date(String(body.joinedAt)).toISOString()).toBe(JOINED.toISOString());
  });


});

describe("AC5: an unknown handle is a 404, and it is problem+json", () => {
  it("answers 404 with all five RFC 9457 members and the request path as `instance`", async () => {
    const target = path("t130-route-nobody");
    const answer = await callRoute(target);

    expect(answer.status, "AC5, and D-130-05 publishes the status").toBe(404);
    expect(
      answer.headers.get("content-type"),
      "B-03: transport failures are RFC 9457 `application/problem+json`",
    ).toContain("application/problem+json");

    const document = asProblem(await answer.json(), `${AUTHOR_ROUTE} 404 body`);
    expect(document.status, "the `status` member and the HTTP status are one fact").toBe(404);
    expect(
      document.instance,
      "RFC 9457 §3.1: `instance` identifies this occurrence, and every constructor in " +
        "`lib/server/http/problem.ts` derives it from the request path",
    ).toBe(target);
  });

  it("does not answer 403, and carries no record", async () => {
    /* B-03: "a private resource the caller may not see returns 404, never 403, so existence
       does not leak". Asserted at the one status that would reinstate the oracle, and beside
       it that the body is a problem document rather than a half-built record. */
    const answer = await callRoute(path("t130-route-nobody-either"));
    expect(answer.status).not.toBe(403);
    const document = await answer.json();
    expect(Object.keys(document as object)).not.toContain("counts");
    expect(Object.keys(document as object)).not.toContain("pinned");
  });
});
