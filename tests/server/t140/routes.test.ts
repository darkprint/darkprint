/* ============================================================
   T140 — D-140-07, the route surface

   Published after the 176 module cells were written, and read from
   the block rather than from the message that announced it. Four
   routes over ONE request shape — `saveTarget`'s own `target`
   parameter — so the route translates nothing and there is nothing
   here to guess.

   ── `instance` is not a reading, checked in the code ──
   `problem()` builds `{ ...details, instance: instanceOf(request) }`
   and `instanceOf` is `new URL(request.url).pathname`
   (`lib/server/http/problem.ts:53,63`). The DERIVATION is what
   settles it, and the mechanism is one step over from where it was
   put to me: `ProblemInput` carries `[extension: string]: unknown`,
   so a caller CAN pass an `instance` — it simply loses to the
   spread, because `instanceOf(request)` is written last. So the
   pin below cannot red as a wording disagreement; it can only red
   as a wrapper that never reached `problem()` at all, which is a
   stronger thing to be testing and is asserted without a caveat.

   ── what this file adds that a module cell cannot hold ──
   The transport, and only the transport. Idempotence, the
   visibility filter, the count agreement and every AC1 pair are
   already driven at the barrel by the other six files, and
   re-driving them through a handler would report coverage of
   something already held — the shape T050's blind author names
   when it declines to add a test for an amendment that costs
   nothing. So what is asserted here is: which URLs are served, the
   statuses and the envelope, `SavesView`'s shape, the ONE field
   whose type differs across the wire, and the two behaviours the
   ruling makes reachable only from a route.

   ── three things the ruling FORBIDS asserting, and they are the
      ones that would look like coverage ──
   **No 403.** Every route passes `session.accountId`, so
   `NotAccountOwnerError` compares an id against itself and cannot
   arise. AC1's non-owner denial is unreachable from HTTP in this
   task, and *its absence from the status lines is not evidence the
   denial is untested* — it is held by the seventy pairs in
   `privacy.test.ts`. Said here so a later reader does not go
   looking for it in this file and conclude it is missing.

   And that unreachability claim HAS A WITNESS in this file, which
   is the thing such a claim almost never has. "Every route passes
   `session.accountId`" is a binding on an implementation that does
   not exist yet, not a fact about one — so the last describe below
   drives a body carrying somebody else's `accountId` and requires
   the save to land on the SESSION's account. A route that read an
   account from the request would make the 403 reachable after all,
   and the sentence above would go quietly false with nothing red.
   *Every `unreachable` in this run is a claim that nothing reds
   when it is wrong*; this one is the exception and it is the
   exception on purpose.

   **No 404 on a write.** A write-time existence check on a
   polymorphic target is the oracle AC1 closes: 404 for a private
   blueprint against 200 for a public one names which private slugs
   are real. A cell expecting 404 would be asserting the leak.

   **No cell separating `count` from `saves.length`.** The ruling
   says `count` comes from `countSaves` and never from
   `saves.length`, and against a correct module those are equal in
   every state — so a route computing the wrong one is an
   EQUIVALENT MUTANT through the wire. What is observable is the
   agreement in a single response, and that is what is asserted.
   **The provenance half is held by nothing and this sentence is
   the record of that**, rather than a green that looks like it
   covers it.

   The ruling's own stated REASON for that clause — *"AC3's agree by
   construction would otherwise be satisfied by making the agreement
   unobservable"* — was withdrawn to me in a reply and **is still
   standing in the block**, classified by surface at `7bb2c33`: one
   occurrence, in the Published block, no withdrawal marker on it,
   and no retraction of it anywhere in the preamble. *A ruling
   granted in a reply is a ruling published nowhere*, arriving on
   the withdrawal of a reason rather than on a reason. Nothing here
   binds to it either way — the clause stands for what it buys, and
   what it buys is the cell below.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  PROBLEM_BASE,
  ROUTES,
  ROUTE_NAMES,
  WRITE_ROUTE_NAMES,
  asKeys,
  assertProblem,
  assertSavesView,
  bind,
  callRoute,
  plantedToken,
  routeTable,
  servedPatterns,
  sessionCookie,
  ruledOrder,
  seenOf,
  storeFailedMessage,
  viewTargetSet,
  withRoutesPointedAt,
  type RouteName,
  type Target,
} from "./contract";
import {
  type AccountFixture,
  type Scratch,
  closeDatabase,
  key,
  openDatabase,
  seedAccount,
  seedBundle,
  setBundleVisibility,
} from "./fixtures";

interface World {
  s: Scratch;
  owner: AccountFixture;
  cookie: string;
  /** A resolvable, publicly visible blueprint. */
  target: Target;
  /** A second one, so a cell can move state without disturbing the first. */
  other: Target;
}

let world: Promise<World> | undefined;

function theWorld(): Promise<World> {
  if (world === undefined) {
    world = build();
    world.catch(() => {});
  }
  return world;
}

async function build(): Promise<World> {
  const s = await openDatabase();
  const publisher = await seedAccount(s, "pub");
  const owner = await seedAccount(s, "owner");
  const a = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
  const b = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
  return {
    s,
    owner,
    cookie: sessionCookie(owner.id, owner.handle),
    target: { kind: "blueprint", refId: a.id },
    other: { kind: "blueprint", refId: b.id },
  };
}

afterAll(async () => {
  await closeDatabase();
});

/** Every route driven against this suite's scratch database rather than the shared one. */
async function call(
  w: World,
  name: RouteName,
  init: { cookie?: string; body?: unknown; rawBody?: string } = {},
) {
  return withRoutesPointedAt(w.s.url, () => callRoute(name, init));
}

describe("D-140-07: the four published URLs are served", () => {
  it.each(ROUTE_NAMES)("%s", async (name) => {
    const spec = ROUTES[name as RouteName];
    expect(
      servedPatterns(),
      `D-140-07 publishes \`${spec.method} ${spec.path}\`. The tree under ` +
        `\`app/api/account/saves/\` is WALKED rather than imported from a guessed path, so this ` +
        `red is "the URL is unserved" and not "a file is missing from where I looked".`,
    ).toContain(spec.path);
    /* And it exports the published METHOD — a file at the right URL answering the wrong verb
       serves nothing, and `routeTable()` alone cannot see that. */
    const w = await theWorld();
    const answer = await call(w, name as RouteName, {
      cookie: w.cookie,
      body: spec.body(w.target),
    });
    expect(answer.status, `${spec.method} ${spec.path} did not answer`).toBeLessThan(500);
  });

  it("two URLs across four routes, and `saves` carries three verbs", () => {
    /*
     * The block publishes GET, POST and DELETE on one path plus POST on a second. Asserted so a
     * later split into four paths — the shape the frontend mock published and D-140-04 withdrew — reds
     * here rather than passing because each route was individually findable.
     */
    expect(servedPatterns()).toEqual(["/api/account/saves", "/api/account/saves/migrate"]);
    expect(routeTable().length, "one file per URL").toBe(2);
  });
});

describe("D-140-07: 401 without a session, on every route", () => {
  it.each(ROUTE_NAMES)("%s answers `problem+json` 401", async (name) => {
    const w = await theWorld();
    const spec = ROUTES[name as RouteName];
    const answer = await call(w, name as RouteName, { body: spec.body(w.target) });

    assertProblem(answer, { status: 401, instance: spec.path }, `${spec.method} ${spec.path}`);
  });

  it("the 401 for a MALFORMED body is the same 401 as for a well-formed one", async () => {
    /*
     * Order of operations, and it is a leak question rather than tidiness: a route that parses
     * before it authenticates tells an anonymous caller whether its body was acceptable. The two
     * problem documents must be identical apart from nothing at all — same path, same status.
     */
    const w = await theWorld();
    const good = await call(w, "save", { body: { ...w.target } });
    const bad = await call(w, "save", { body: { kind: "not-a-kind" } });

    expect(good.status, "no session, well-formed body").toBe(401);
    expect(
      bad.status,
      "no session, malformed body — a 400 here says the body was read before the session was, " +
        "which tells an anonymous caller something about its own request that a 401 does not",
    ).toBe(401);
    expect(bad.body).toBe(good.body);
  });
});

describe("D-140-07: 400 for a body the published shape does not admit", () => {
  const bodies: { what: string; body?: unknown; rawBody?: string }[] = [
    { what: "an unpublished kind", body: { kind: "bundle", refId: "x" } },
    { what: "no refId", body: { kind: "blueprint" } },
    { what: "no kind", body: { refId: "x" } },
    { what: "a refId that is not a string", body: { kind: "blueprint", refId: 7 } },
    { what: "an array where the object is published", body: [{ kind: "blueprint", refId: "x" }] },
    { what: "text that is not JSON", rawBody: "not json at all" },
  ];

  it.each(bodies)("POST /api/account/saves refuses $what", async ({ body, rawBody }) => {
    const w = await theWorld();
    const answer = await call(w, "save", { cookie: w.cookie, body, rawBody });
    assertProblem(
      answer,
      { status: 400, instance: ROUTES.save.path },
      `POST ${ROUTES.save.path} with ${JSON.stringify(rawBody ?? body).slice(0, 60)}`,
    );
  });

  it("POST /api/account/saves/migrate refuses `targets` that is not an array", async () => {
    const w = await theWorld();
    const answer = await call(w, "migrate", {
      cookie: w.cookie,
      body: { targets: { kind: "blueprint", refId: "x" } },
    });
    assertProblem(answer, { status: 400, instance: ROUTES.migrate.path }, "POST …/migrate");
  });

  it("a 400 names no value the caller sent", async () => {
    /*
     * D-140-06 at the transport. The refId is a token minted here, so its only route into the
     * problem document is the route putting it there — provenance rather than a curated list,
     * and it cannot over-match the way T-04's SQLSTATE tells matched a fixture's own pid.
     */
    const w = await theWorld();
    const secret = plantedToken();
    const answer = await call(w, "save", {
      cookie: w.cookie,
      body: { kind: "not-a-kind", refId: secret },
    });
    expect(answer.status).toBe(400);
    expect(
      answer.body,
      "D-140-06 rules the whitelist toward T050's: the operation and the caller's own FIELD " +
        "NAME, never the caller's own VALUE. A `refId` echoed back is an existence oracle, " +
        "which is the thing AC1 exists to close.",
    ).not.toContain(secret);
  });
});

describe("D-140-07: every route answers the resulting `SavesView`", () => {
  it("a read renders `SavesView` with `savedAt` as an ISO STRING", async () => {
    const w = await theWorld();
    await call(w, "save", { cookie: w.cookie, body: { ...w.target } });
    const answer = await call(w, "list", { cookie: w.cookie });

    const view = assertSavesView(answer, `GET ${ROUTES.list.path}`);
    expect(view.saves.length).toBeGreaterThan(0);
    /*
     * The one field where a route cell and a module cell assert different types. `ok` is
     * `Response.json` over a `Date`, so the module's `Date` crosses as a string — and
     * `assertSavesView` reds on a number, on `null`, and on the `{}` a naive serialiser
     * produces for a non-Date object.
     */
    expect(typeof view.saves[0].savedAt).toBe("string");
  });

  it.each(WRITE_ROUTE_NAMES)("%s answers the view rather than a bare acknowledgement", async (name) => {
    /*
     * "The three writes answer the resulting `SavesView` rather than a 204 that
     * `lib/server/http` does not publish and this task may not add." That is what makes AC2
     * drivable in two requests instead of three, and it is transport-only: the module's writers
     * answer `Promise<void>` and can say nothing about it.
     */
    const w = await theWorld();
    const spec = ROUTES[name as RouteName];
    const answer = await call(w, name as RouteName, {
      cookie: w.cookie,
      body: spec.body(w.other),
    });
    assertSavesView(answer, `${spec.method} ${spec.path}`);
  });

  it("the view a write answers is the state a following read reports", async () => {
    /*
     * The target is seeded HERE and saved for the first time, and that is the whole cell rather
     * than housekeeping. It first used `w.other`, which the sweep above has already saved — so
     * the view before the write and the view after it were the same view, and a route answering
     * a STALE view passed. Mutation R3 found it: the patch that returns the pre-effect view
     * reddened a different cell entirely and left this one green, which is the signature of a
     * cell that cannot fail. *Assert the difference, do not arrange it* — the write has to CHANGE
     * something for the equality below to be evidence about anything.
     */
    const w = await theWorld();
    const publisher = await seedAccount(w.s, "pub");
    const fresh = await seedBundle(w.s, { ownerId: publisher.id, visibility: "public" });
    const target: Target = { kind: "blueprint", refId: fresh.id };

    const before = await call(w, "list", { cookie: w.cookie });
    const written = await call(w, "save", { cookie: w.cookie, body: { ...target } });
    const read = await call(w, "list", { cookie: w.cookie });

    expect(
      viewTargetSet(before, "the GET before the write"),
      "the write must ADD something, or the equality below holds between two identical views " +
        "whatever the route answers",
    ).not.toContain(key(target));
    expect(viewTargetSet(read, "the GET after the write")).toContain(key(target));

    expect(
      viewTargetSet(written, "the POST's own view"),
      "a write that answers a view computed BEFORE its own effect is a client showing the user " +
        "the previous state — and the whole reason the writes answer a view is that a client " +
        "should not need a second request to know what happened",
    ).toEqual(viewTargetSet(read, "the following GET"));
  });
});

describe("D-140-07: AC3's agreement, visible in ONE response", () => {
  it("`count` and `saves.length` agree after a target goes private", async () => {
    /*
     * The cell the extra query is paid for. Both numbers arrive in one payload precisely so a
     * disagreement is visible without a second request, and this is the only place in the suite
     * where AC3 is observed through the transport.
     *
     * Its own database, because this cell moves a target's visibility and every other cell in
     * this file shares one world.
     */
    const s = await openDatabase();
    const publisher = await seedAccount(s, "pub");
    const owner = await seedAccount(s, "owner");
    const cookie = sessionCookie(owner.id, owner.handle);
    const kept = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
    const shut = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });

    const drive = (name: RouteName, body?: unknown) =>
      withRoutesPointedAt(s.url, () => callRoute(name, { cookie, body }));

    await drive("save", { kind: "blueprint", refId: kept.id });
    await drive("save", { kind: "blueprint", refId: shut.id });

    const before = assertSavesView(await drive("list"), "GET, both public");
    expect(before.saves.length, "the fixture's own premise: both are listed first").toBe(2);
    expect(before.count, "and the count agrees before anything moves").toBe(2);

    await setBundleVisibility(s, shut.id, "private");

    const after = assertSavesView(await drive("list"), "GET, one private");
    expect(after.saves.length, "AC3: the listing omits the save whose target went private").toBe(1);
    expect(
      after.count,
      "AC3 through the transport: `count` is derived from the same filtered query, so it moves " +
        "with the listing. A route forwarding a `countSaves` that forgot the filter answers 2 " +
        "beside a one-element `saves`, and that disagreement is visible in this single response.",
    ).toBe(1);
  });
});

describe("D-140-07: a save of a target that does not exist is ACCEPTED and never listed", () => {
  it("200, and the returned view does not carry it", async () => {
    /*
     * The no-404 ruling, driven. `saveTarget` does not check that the target exists, because a
     * write-time existence check on a polymorphic target is the oracle AC1 closes — 404 for a
     * private blueprint against 200 for a public one names which private slugs are real.
     *
     * The cost is stated in the ruling and asserted here: a client typo is silently accepted.
     * This cell is the record of that trade rather than a complaint about it.
     */
    const w = await theWorld();
    const ghost: Target = { kind: "blueprint", refId: `t140-ghost-${plantedToken()}` };

    const answer = await call(w, "save", { cookie: w.cookie, body: { ...ghost } });

    expect(
      answer.status,
      "a 404 here would be the leak: it separates `no such target` from `a target you may not " +
        "see`, which is exactly what B-03 forbids.",
    ).toBe(200);
    expect(
      viewTargetSet(answer, "the POST's own view"),
      "and AC3 answers it at read time instead — the row is stored and the listing omits it",
    ).not.toContain(key(ghost));
  });
});

describe("D-140-07: the request shape carries no account, so no route can address another", () => {
  it("an `accountId` in the body is not an account selector", async () => {
    /*
     * The transport half of AC1, and the only form it can take here. The published request shape
     * is `{ kind, refId }` and every route passes `session.accountId`, so there is no 403 to
     * assert — but "the route cannot be MADE to address another account" is assertable, and it
     * is the property that makes the absent 403 structural rather than an omission.
     *
     * A route that honoured a body `accountId` would write to the victim's saves and answer the
     * victim's view. This cell reds on both halves.
     */
    const w = await theWorld();
    const victim = await seedAccount(w.s, "victim");
    const listSaves = await bind("listSaves");

    const answer = await call(w, "save", {
      cookie: w.cookie,
      body: { ...w.target, accountId: victim.id },
    });

    expect(
      [200, 400],
      `a body carrying an extra member is either refused as unpublished or ignored; what it must ` +
        `never be is honoured. Answered ${answer.status}.`,
    ).toContain(answer.status);

    const victimSaves = (await listSaves(w.s.db, { kind: "operator", accountId: "probe-operator" }, victim.id)) as unknown[];
    expect(
      victimSaves,
      "the save landed on somebody else's account, so the route read an account from the REQUEST " +
        "rather than from the SESSION — which is the 403 that D-140-07 says cannot arise, arising.",
    ).toEqual([]);
  });

  it("a session with `handle: null` reaches every route", async () => {
    /*
     * "No handle is required, and AC5 is the deciding case: the browser-local set migrates on
     * first sign-in, when the account still has `handle: null`." A route gated on a handle makes
     * AC5 unreachable for exactly the caller it exists for.
     */
    const w = await theWorld();
    const fresh = await seedAccount(w.s, "nohandle");
    const cookie = sessionCookie(fresh.id, null);

    for (const name of ROUTE_NAMES) {
      const spec = ROUTES[name];
      const answer = await call(w, name, { cookie, body: spec.body(w.target) });
      expect(
        answer.status,
        `${spec.method} ${spec.path} refused a handle-less session with ${answer.status}. ` +
          `A 403 \`handle-required\` here is T050's rule applied where D-140-07 says it does not ` +
          `belong, and it makes AC5's first-sign-in migration unreachable.`,
      ).toBe(200);
    }
  });
});

describe("D-140-07: a store fault answers `problem+json` 500 carrying the published message", () => {
  const closedPort = `postgresql://t140route:${plantedToken()}@127.0.0.1:1/darkprint_t140_${plantedToken()}`;

  it.each(ROUTE_NAMES)("%s", async (name) => {
    /*
     * D-50-18's mapping and D-140-02's form, at the transport. Needs no live database — the
     * point of a closed port — and it is the only place `withSaveErrors` is observable: a route
     * that lets `SaveStoreError` escape produces Next's own generic 500, outside the envelope
     * every other failure on that route uses.
     */
    const w = await theWorld();
    const spec = ROUTES[name as RouteName];
    const answer = await withRoutesPointedAt(closedPort, () =>
      callRoute(name as RouteName, { cookie: w.cookie, body: spec.body(w.target) }),
    );

    const problem = assertProblem(
      answer,
      { status: 500, instance: spec.path },
      `${spec.method} ${spec.path} against a closed port`,
    );
    expect(
      problem.type,
      "D-50-18: a sanitized store fault is `problem+json` with the `store-failed` type, not " +
        "Next's generic 500 — which is a 500 too, and outside the envelope, and unobservable to " +
        "anything driving the handler directly.",
    ).toBe(`${PROBLEM_BASE}/store-failed`);
    expect(
      problem.detail,
      "D-140-07: the published message UNALTERED. The operation is the module function that " +
        "failed, and the literal is written out here rather than imported — an expectation built " +
        "from the module asserts that the module agrees with itself.",
    ).toBe(storeFailedMessage(name === "list" ? "listSaves" : name === "save" ? "saveTarget" : name === "unsave" ? "unsaveTarget" : "migrateLocalSaves"));
  });

  it("two writes with different bodies give problem documents identical apart from `instance`", async () => {
    /*
     * T081's weaker assertion, kept alongside the `detail` pin because the two catch different
     * failures and neither is complete: a `detail` interpolating a refId diverges HERE while
     * still being a string the pin might have been written loosely enough to admit.
     */
    const w = await theWorld();
    const a = await withRoutesPointedAt(closedPort, () =>
      callRoute("save", { cookie: w.cookie, body: { kind: "blueprint", refId: plantedToken() } }),
    );
    const b = await withRoutesPointedAt(closedPort, () =>
      callRoute("save", { cookie: w.cookie, body: { kind: "card", refId: plantedToken() } }),
    );

    expect(a.status).toBe(500);
    expect(a.body).toBe(b.body);
  });
});

/* ============================================================
   A control on this file's own helper

   `withRoutesPointedAt` mutates two pieces of global state —
   `process.env.DATABASE_URL` and
   `globalThis[Symbol.for("darkprint.db.sharedClient")]` — because
   `getSharedDbClient()` is lazy and cached, so a route reaches
   whatever pool a previous test opened unless both are cleared
   before the first handler call.

   **A helper that leaked either would make every LATER file in the
   same worker measure a different database, and that failure does
   not show up in the file that caused it.** That is the shape this
   run charges as residue: scoped to the media its author thought
   of, landing in somebody else's tree. So the restoration is
   asserted here rather than trusted, in the file that does the
   mutating.

   A separate cell rather than a line inside another one,
   deliberately: an inline two-factor assertion can only be deleted
   and no suite catches that, where a cell of its own moves a count.
   ============================================================ */

describe("the helper restores the global state it borrows", () => {
  it("`DATABASE_URL` and the shared-client slot come back unchanged", async () => {
    const w = await theWorld();
    const key = Symbol.for("darkprint.db.sharedClient");
    const before = {
      url: process.env.DATABASE_URL,
      client: (globalThis as Record<symbol, unknown>)[key],
      hadClient: key in (globalThis as object),
    };

    await call(w, "list", { cookie: w.cookie });

    expect(
      process.env.DATABASE_URL,
      "`withRoutesPointedAt` points the routes at this suite's scratch database and must put " +
        "`DATABASE_URL` back. A leak here does not red this file — it reds whichever file runs " +
        "next in the same worker, against a database it never chose.",
    ).toBe(before.url);
    expect(
      key in (globalThis as object),
      "and the shared-client slot must be back in the state it was found in: present if it was " +
        "present, absent if it was absent. `getSharedDbClient()` is lazy and cached on " +
        "`globalThis`, so a slot left holding this suite's pool is handed to every later caller.",
    ).toBe(before.hadClient);
    expect((globalThis as Record<symbol, unknown>)[key]).toBe(before.client);
  });
});

/* ============================================================
   D-140-08 at the transport

   `SavesView.saves` forwards whatever `listSaves` returns, so a
   module cell alone would be satisfied by a route that re-sorted on
   the way out — and `count` would still agree, and every membership
   cell in this file would still pass. **The order is a property of
   the payload a client receives**, and this is the only surface
   that observes it there.

   Same comparator as the module cell, imported rather than
   restated: two transcriptions of one ruling agreeing with each
   other is the shape that has produced five charges in this run.
   `seenOf` normalises `savedAt` through `new Date(...)`, which is
   what lets one comparator read a `Date` from the barrel and an ISO
   string from the wire without either side knowing which it got.
   ============================================================ */

describe("D-140-08: `SavesView.saves` crosses in the ruled order", () => {
  it("the payload's sequence equals its own sort under the ruled comparator", async () => {
    /*
     * Its own database and its own account: this cell is about a SEQUENCE, so a target another
     * cell in this file saved would put a record in the middle of it that this cell did not
     * choose — and the assertion would still pass, which is the quiet way an order cell stops
     * measuring the thing it names.
     */
    const s = await openDatabase();
    const publisher = await seedAccount(s, "pub");
    const owner = await seedAccount(s, "ordowner");
    const cookie = sessionCookie(owner.id, owner.handle);

    const targets: Target[] = [];
    for (let i = 0; i < 4; i += 1) {
      const b = await seedBundle(s, { ownerId: publisher.id, visibility: "public" });
      targets.push({ kind: "blueprint", refId: b.id });
    }

    /* Supplied newest-last, so a route echoing insertion order answers the reverse of the rule. */
    for (const target of targets) {
      await withRoutesPointedAt(s.url, () =>
        callRoute("save", { cookie, body: { ...target } }),
      );
    }

    const answer = await withRoutesPointedAt(s.url, () => callRoute("list", { cookie }));
    const view = assertSavesView(answer, `GET ${ROUTES.list.path}`);
    const seen = view.saves.map((r, i) => seenOf(r, `SavesView.saves[${i}]`));

    expect(seen.length, "the fixture's own premise: four saves crossed the wire").toBe(4);
    expect(
      asKeys(seen),
      "D-140-08 orders `listSaves`, and `SavesView.saves` forwards it. A route that re-sorted — " +
        "or that rebuilt the array from a map, which loses order without anybody deciding to — " +
        "satisfies every module cell and fails here.",
    ).toEqual(asKeys(ruledOrder(seen)));

    /*
     * The anti-vacuity half, computed: the saves were supplied oldest-first, so the ruled
     * newest-first answer must NOT be the order they went in. Without this, a route echoing
     * insertion order passes the assertion above whenever insertion order happened to be right.
     */
    expect(
      asKeys(seen),
      "the ruled order must differ from the order the four saves were written in, or the " +
        "assertion above is satisfied by a route that returns rows exactly as it received them",
    ).not.toEqual(targets.map((t) => `${t.kind}:${t.refId}`));
  });
});
