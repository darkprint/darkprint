/* ============================================================
   T131 — the five write routes (D-131-07)

       PUT    /api/authors/[handle]/pinned  { pinned: PinnedRef[] }
                                 -> 200 { pinned } | 400 | 401 | 404
       POST   /api/authors/[handle]/watch   -> 200 { watching, watchers } | 401 | 404
       DELETE /api/authors/[handle]/watch   -> 200 { watching, watchers } | 401 | 404
       POST   /api/authors/[handle]/support -> 200 { supported, support } | 401 | 404
       DELETE /api/authors/[handle]/support -> 200 { supported, support } | 401 | 404

   ── the two things this file exists to catch ──

   **IDEMPOTENCE.** D-131-07 (A6 ratified): POST/DELETE are
   idempotent over the toggle verbs, and the reason is stated as a
   property of HTTP rather than a preference — *no HTTP retry is
   safe against a toggling POST*. A route that simply forwards to
   `toggleFollow` passes every single-call assertion and unfollows
   on a retry, which is a data loss a browser can cause by itself.
   So every write is driven TWICE and the second call must be a
   no-op, and that is asserted at the ROWS as well as at the body:
   a route that flipped the row twice inside one request would
   answer the same body both times.

   **THE WIRE SPELLING.** `watching` here, `followedByCaller` at the
   module (D-131-04(c): both published, the route maps between
   them). This is the one seam where a suite that reused a
   validator would prove nothing, so the wire assertions are
   written against the wire's own key set and `asFollowAnswer` is
   deliberately not used below.

   ── the route is bound by URL, never by module path ──
   The table is discovered by walking `app/api/**` and ordered by
   Next's own `getSortedRoutes`, so this file cannot disagree with
   the router about which file serves a URL. What the contract
   publishes is a URL; the layout is the implementation's.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PINNED_ROUTE,
  asProblem,
  blueprintPin,
  callRoute,
  dropScratchDatabases,
  followRowCount,
  insertAccount,
  insertBundle,
  mark,
  pinRows,
  routePatternFor,
  scratchDatabase,
  sessionCookie,
  supportRowCount,
  type AccountFixture,
  type Scratch,
} from "./contract";

let s: Scratch;

async function person(tag: string): Promise<AccountFixture> {
  return insertAccount(s, { handle: mark(`t131-routes-${tag}`).toLowerCase() });
}

/**
 * `getSharedDbClient()` caches its pool on `globalThis` behind a well-known symbol, which makes
 * the ROUTE half of any suite two problems rather than one. Both were found here by a leak
 * check rather than by a red, and both are already solved in the merged T130 suite — this file
 * had neither until the first baseline run left a scratch database standing.
 *
 * **Repointing `DATABASE_URL` is not enough on its own.** If anything in the same worker has
 * already called `getSharedDbClient()`, the pool is cached against whatever host the shell
 * named, and every route cell below then drives the DEVELOPMENT database while asserting about
 * fixtures in a scratch one. That failure is silent in both directions: the assertions fail for
 * a reason that has nothing to do with the route, and the writes land somewhere nobody looks.
 * So the cache is cleared as well as the variable set, before the first call.
 */
const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");

let restoreDatabaseUrl: string | undefined;

beforeAll(async () => {
  s = await scratchDatabase();
  restoreDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = s.url;
  delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];
});

afterAll(async () => {
  /* Closed BEFORE the drop, and this is the leak. `DROP DATABASE` against a database with a
     live connection is refused — `database "..." is being accessed by other users` — and the
     pool the route opened through `getSharedDbClient()` is exactly that connection. The refusal
     surfaces as one line in the run output and does NOT fail the file, so a suite that skips
     this leaves one scratch database per run behind and reports a clean result. Measured: two
     runs, two survivors, both holding this file's own `t131-routes-*` handles. */
  const cached = (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY] as
    | { close?: () => Promise<void> }
    | undefined;
  if (typeof cached?.close === "function") await cached.close().catch(() => undefined);
  delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];

  if (restoreDatabaseUrl !== undefined) process.env.DATABASE_URL = restoreDatabaseUrl;
  await dropScratchDatabases();
});

function body(subject: AccountFixture, suffix: string): string {
  return `/api/authors/${subject.handle}/${suffix}`;
}

describe("D-131-07: the five URLs are served", () => {
  for (const suffix of ["pinned", "watch", "support"] as const) {
    it(`\`/api/authors/[handle]/${suffix}\` resolves to a route`, async () => {
      /* Surface only: no database, no session. A red here says the URL is UNSERVED, which is a
         different fact from a handler that refuses, and reading them apart is why this cell
         does not also drive a request. */
      expect(routePatternFor(`/api/authors/somebody/${suffix}`)).toBe(
        `/api/authors/[handle]/${suffix}`,
      );
    });
  }

  it("does not shadow the merged `GET /api/authors/[handle]`", async () => {
    /* The extension's own hazard. `app/api/authors/**` is T131's to extend and the merged read
       route lives inside it, so a new dynamic segment in the wrong place is how the profile page
       stops resolving — a failure with no cell of its own anywhere, because T130's suite was
       written before these paths existed. Next's `getSortedRoutes` decides precedence and this
       asks it rather than asserting a layout. */
    expect(routePatternFor("/api/authors/somebody")).toBe("/api/authors/[handle]");
  });
});

describe("D-131-07: an unauthenticated write is 401 and moves nothing", () => {
  for (const [method, suffix] of [
    ["PUT", "pinned"],
    ["POST", "watch"],
    ["DELETE", "watch"],
    ["POST", "support"],
    ["DELETE", "support"],
  ] as const) {
    it(`\`${method} .../${suffix}\` with no session answers 401`, async () => {
      const subject = await person(`anon-${method}-${suffix}`);
      const answer = await callRoute(method, body(subject, suffix), {
        body: suffix === "pinned" ? { pinned: [] } : undefined,
      });

      expect(answer.status, "D-131-07 publishes 401 for a caller with no session").toBe(401);
      asProblem(await answer.json(), `${method} ${body(subject, suffix)}`);

      /* And nothing moved. A 401 emitted AFTER the write satisfies every status assertion a
         reviewer would write, which is the shape "assert what the writer LEFT BEHIND" names. */
      expect(await followRowCount(s, subject.id)).toBe(0);
      expect(await supportRowCount(s, subject.id)).toBe(0);
      expect(await pinRows(s, subject.id)).toEqual([]);
    });
  }
});

describe("D-131-07: a write against an unknown handle is 404, and a non-owner write is 404 too", () => {
  it("answers 404 for a handle no account holds", async () => {
    const caller = await person("unknown-caller");
    const answer = await callRoute("POST", `/api/authors/${mark("t131-nobody").toLowerCase()}/watch`, {
      headers: sessionCookie(caller.id, caller.handle),
    });
    expect(answer.status).toBe(404);
  });

  it("answers 404 and NOT 403 when a stranger writes another account's pins", async () => {
    /* B9, ratified at D-131-07: "non-owner writes answer 404, never 403". That is B-03's letter
       — a 403 confirms the resource exists to somebody who may not see it — and the merged
       `tests/server/t130/routes.test.ts` already holds a "does not answer 403" cell for this
       family, so the two halves agree about the family rather than about one route.

       Asserted as `not 403` beside `is 404`, because those are different claims: a 500 is also
       not 403. */
    const owner = await person("pin-owner");
    const stranger = await person("pin-stranger");
    const bundle = await insertBundle(s, { owner, slug: "strangers-target", cards: [] });

    const answer = await callRoute("PUT", body(owner, "pinned"), {
      headers: sessionCookie(stranger.id, stranger.handle),
      body: { pinned: [blueprintPin(bundle.slug)] },
    });

    expect(answer.status, "B9: a non-owner write is 404, never 403").not.toBe(403);
    expect(answer.status).toBe(404);
    expect(
      await pinRows(s, owner.id),
      "and the target's pins are what B-13 protects: nothing was written",
    ).toEqual([]);
  });
});

describe("D-131-07: `PUT .../pinned` answers `{ pinned }` and validates its body", () => {
  it("writes the owner's pins and answers the refs, not resolved items", async () => {
    const owner = await person("pin-write");
    const a = await insertBundle(s, { owner, slug: "route-a", cards: [] });
    const b = await insertBundle(s, { owner, slug: "route-b", cards: [] });

    const answer = await callRoute("PUT", body(owner, "pinned"), {
      headers: sessionCookie(owner.id, owner.handle),
      body: { pinned: [blueprintPin(a.slug), blueprintPin(b.slug)] },
    });
    expect(answer.status, PINNED_ROUTE).toBe(200);

    const payload = (await answer.json()) as Record<string, unknown>;
    expect(
      Object.keys(payload).sort(),
      "D-131-07 publishes `200 { pinned }` — the wire returns the pins alone and not the whole " +
        "record, which is decision (b) of D-131-04.",
    ).toEqual(["pinned"]);
    expect(
      payload.pinned,
      "REFS, never resolved items. SEAM-55's `{ pinned: PinnedItem[] }` is a frontend view " +
        "shape carrying `Blueprint` and `CardVersionRecord`, and D-131-04 supersedes it here.",
    ).toEqual([
      { kind: "blueprint", slug: a.slug },
      { kind: "blueprint", slug: b.slug },
    ]);
  });

  it("answers 400 for a third pin and for a body that is not the published shape", async () => {
    const owner = await person("pin-400");
    const bundle = await insertBundle(s, { owner, slug: "four-hundred", cards: [] });
    const auth = sessionCookie(owner.id, owner.handle);

    const cases: [string, unknown][] = [
      ["three pins, over the cap of two", { pinned: [1, 2, 3].map(() => blueprintPin(bundle.slug)) }],
      ["a pin with a kind the union does not admit", { pinned: [{ kind: "card", ref: "x@1.0.0" }] }],
      ["a blueprint pin carrying `ref` instead of `slug`", { pinned: [{ kind: "blueprint", ref: "x" }] }],
      ["`pinned` absent altogether", {}],
      ["`pinned` as a bare string array, T130's withdrawn spelling", { pinned: [bundle.slug] }],
    ];

    for (const [what, sent] of cases) {
      const answer = await callRoute("PUT", body(owner, "pinned"), { headers: auth, body: sent });
      expect(
        answer.status,
        `${what}: D-131-07 publishes 400 for a malformed body. The last case is the one that ` +
          `matters most — \`readonly string[]\` is what T130's withdrawn block published and ` +
          `D-131-01 replaced, so a route still accepting it has bound to the wrong contract.`,
      ).toBe(400);
      expect(await pinRows(s, owner.id), `${what}: nothing was written`).toEqual([]);
    }
  });
});

describe("D-131-07: POST and DELETE are IDEMPOTENT over the toggle verbs (A6)", () => {
  for (const [suffix, onKey, countKey] of [
    ["watch", "watching", "watchers"],
    ["support", "supported", "support"],
  ] as const) {
    it(`two POSTs to .../${suffix} leave the caller on, not off`, async () => {
      /* THE CELL A6 EXISTS FOR. A route that forwards straight to the toggle answers
         `${onKey}: true` on the first call and `false` on the second — and a browser retry, a
         double click or a proxy replay is enough to cause it. The published contract is that
         the route reads current state and calls the module only when a flip is needed. */
      const subject = await person(`idem-post-${suffix}`);
      const caller = await person(`idem-poster-${suffix}`);
      const auth = sessionCookie(caller.id, caller.handle);

      const first = (await (await callRoute("POST", body(subject, suffix), { headers: auth })).json()) as Record<string, unknown>;
      expect(first[onKey], `the first POST turns it on`).toBe(true);
      expect(first[countKey]).toBe(1);

      const second = await callRoute("POST", body(subject, suffix), { headers: auth });
      expect(second.status).toBe(200);
      const payload = (await second.json()) as Record<string, unknown>;
      expect(
        payload,
        `D-131-07: "two POSTs must not unfollow, because no HTTP retry is safe against a ` +
          `toggling POST". A route forwarding straight to the toggle answers ` +
          `{ ${onKey}: false, ${countKey}: 0 } here.`,
      ).toEqual({ [onKey]: true, [countKey]: 1 });

      const rows =
        suffix === "watch"
          ? await followRowCount(s, subject.id)
          : await supportRowCount(s, subject.id);
      expect(
        rows,
        "and at the rows, because a route that flipped twice inside one request would answer " +
          "the same body while having written and deleted",
      ).toBe(1);
    });

    it(`two DELETEs to .../${suffix} leave the caller off, not on`, async () => {
      const subject = await person(`idem-del-${suffix}`);
      const caller = await person(`idem-deleter-${suffix}`);
      const auth = sessionCookie(caller.id, caller.handle);

      await callRoute("POST", body(subject, suffix), { headers: auth });
      const first = (await (await callRoute("DELETE", body(subject, suffix), { headers: auth })).json()) as Record<string, unknown>;
      expect(first).toEqual({ [onKey]: false, [countKey]: 0 });

      const second = await callRoute("DELETE", body(subject, suffix), { headers: auth });
      expect(second.status).toBe(200);
      expect(
        await second.json(),
        `a DELETE against a state already off is a no-op, not a re-follow. The symmetric half ` +
          `of A6 and the one a "toggle on any write" implementation fails.`,
      ).toEqual({ [onKey]: false, [countKey]: 0 });

      const rows =
        suffix === "watch"
          ? await followRowCount(s, subject.id)
          : await supportRowCount(s, subject.id);
      expect(rows).toBe(0);
    });

    it(`.../${suffix} answers the WIRE's key set and never the module's`, async () => {
      /* D-131-04(c). The module says `followedByCaller` and SEAM-57's wire says `watching`; the
         route maps. A route handing the module's answer straight through answers
         `{ followedByCaller, watchers }` and passes every count assertion above, because the
         count member's name is the same on both sides. Only the key set catches it. */
      const subject = await person(`wire-${suffix}`);
      const caller = await person(`wire-caller-${suffix}`);
      const answer = await callRoute("POST", body(subject, suffix), {
        headers: sessionCookie(caller.id, caller.handle),
      });
      const payload = (await answer.json()) as Record<string, unknown>;
      expect(
        Object.keys(payload).sort(),
        `D-131-07 publishes \`{ ${onKey}, ${countKey} }\` on the wire. For \`watch\` the module ` +
          `says \`followedByCaller\` (D-131-04(c)) and the route maps it to \`watching\`; ` +
          `passing the module's object through is the failure this key set catches and the ` +
          `count assertions cannot.`,
      ).toEqual([countKey, onKey].sort());
    });
  }
});

describe("the route's actor is the session's, and an operator passes", () => {
  it("attributes the follow to the session's account rather than to nobody", async () => {
    /* T080's adversary found `actorFrom` regressed to "nobody" in a merged task with every
       assertion still passing, because no cell drove a route with a real session AND checked
       whose row it wrote. The count alone cannot see it: one anonymous-but-accepted write also
       reads 1. */
    const subject = await person("attr-subject");
    const caller = await person("attr-caller");
    await callRoute("POST", body(subject, "watch"), {
      headers: sessionCookie(caller.id, caller.handle),
    });

    const rows = await s.query(
      "select follower_id from follow where followed_id = $1",
      [subject.id],
    );
    expect(
      rows.map((r) => String(r.follower_id)),
      "the row names the SESSION's account. A route that wrote any other id would answer the " +
        "same `{ watching: true, watchers: 1 }`.",
    ).toEqual([caller.id]);
  });

  it("cannot mint an operator from a session, so even a validator's write is 404", async () => {
    /* RETARGETED AT FIRST CONTACT, and the reason is a real limit rather than a bug.

       D-131-07 says "an operator passes every write T060 grants ... cells drive all three actor
       kinds on the writes". At the MODULE that is drivable and driven — seven cells across
       `follow`, `support` and `set-verbs` pass `operator(id)` directly and all pass. **At the
       ROUTE it is unsatisfiable by construction**: `lib/server/registry/actor.ts` states that
       `SessionPayload` carries `{ accountId, handle }` and nothing naming an operator, so **no
       request can produce an `operator` actor yet, deliberately** — an actor kind invented there
       would widen `visibleTo` on evidence a session does not carry.

       So the ruling's clause reaches two of three actor kinds at this layer, and that gap is a
       property of T060's session shape rather than of anything T131 built. My original cell
       asserted 200 and reported the fixture as the suspect if it failed; it failed, and the
       fixture was indeed the suspect — there is no way to mint the actor it needed.

       Retargeted to pin the LIMIT, which is worth a cell in its own right: the day somebody
       teaches `actorFrom` to read an operator off a session, this reds, and that is exactly the
       widening `actor.ts`'s own comment exists to prevent. */
    const owner = await person("op-owner");
    const validator = await insertAccount(s, {
      handle: mark("t131-routes-validator").toLowerCase(),
      validator: true,
    });
    const bundle = await insertBundle(s, { owner, slug: "operator-writable", cards: [] });

    const answer = await callRoute("PUT", body(owner, "pinned"), {
      headers: sessionCookie(validator.id, validator.handle),
      body: { pinned: [blueprintPin(bundle.slug)] },
    });

    expect(
      answer.status,
      "a session names an account and never an operator (`actor.ts`), so a validator writing " +
        "somebody else's pins is just a non-owner: 404 under B9, never 403, and never 200.",
    ).toBe(404);
    expect(answer.status, "B9: never 403 for this family").not.toBe(403);
    expect(
      await pinRows(s, owner.id),
      "and nothing was written to the target's pins",
    ).toEqual([]);
  });
});

describe("the read route still answers the seven-member record", () => {
  it("`GET /api/authors/[handle]` carries the four new members on the wire", async () => {
    /* The merged route is not T131's to rewrite, but its BODY changes underneath it the moment
       `ProfileRecord` grows — and the merged suite's own `asWireProfileRecord` pins three keys
       until D-131-08's grant moves it. This cell is the blind half of that move: written here,
       without seeing the merged file change, so the two agreements are independent. */
    const subject = await person("read-back");
    const answer = await callRoute("GET", `/api/authors/${subject.handle}`);
    expect(answer.status).toBe(200);

    const { asWireProfileRecord } = await import("./contract");
    const wire = asWireProfileRecord(await answer.json(), `GET /api/authors/${subject.handle}`);
    expect(typeof wire.joinedAt, "on the wire `joinedAt` is an ISO string").toBe("string");
    expect({ watchers: wire.watchers, support: wire.support, validated: wire.validated }).toEqual({
      watchers: 0,
      support: 0,
      validated: 0,
    });
    expect(wire.pinned).toEqual([]);
  });
});
