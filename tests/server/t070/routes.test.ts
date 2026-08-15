/* ============================================================
   T070 — the two routes D-70-03 publishes

       GET /api/names/handles/[handle]       -> { available, reason?, suggestion? }
       GET /api/names/slugs/[owner]/[slug]   -> { available, reason?, suggestion? }

     "Both 200 with the `Availability` payload; there is no 404,
      because 'not found' **is** the available answer. No allocation
      route: allocation happens through T050's sign-up and
      handle-change paths, which is why `Blocks` names T050."

   `app/api/names/**` has been in T070's `Owns` set since the
   partition and no route was published until D-70-03 — "third
   instance of this defect in one wave" — so this whole file is
   coverage that arrived after the code, which is what D-70-12
   re-opened this suite to fix.

   ── [owner] is a HANDLE, and that is a join ──
   D-70-14b: "The route block publishes `[owner]` while `checkSlug`
   publishes `ownerId`, so somebody joins them; reading it as a
   handle and doing the lookup **in the route** is correct, because
   the module's parameter is an id and the translation belongs at the
   edge, not inside a second module entry point."

   So the slug route has a step the module does not: handle → id.
   Every test below that drives it goes through a handle, never an
   id, and `fixtures.ts` seats the handle in both tables a reader
   could consult — see its header for why.

   ── the unknown owner, and why it is TWO tests ──
   The ruling settles the behaviour: "an owner nobody is must still
   be refused the four profile-tab slugs. The reserved set is a
   property of the **URL space**, not of an owner — `/u/<handle>/blueprints`
   is a tab for every handle that exists or ever will, so answering
   `available` for an unknown owner is a promise the product breaks
   the moment that handle is created."

   And then it names a second property, deliberately as a
   consequence rather than a justification: "an unknown owner becomes
   indistinguishable from an existing owner holding no bundles, so
   the route does not leak whether a handle exists. That is B-03's
   principle arriving for free. It is recorded as a consequence
   rather than a justification, because a design defended by a
   benefit it did not aim at is a design nobody has actually
   checked."

   So it is checked here, in its own right and by construction rather
   than on one hand-picked slug — because a behaviour nobody designed
   is a behaviour nobody has tested, and the next person to touch
   this route will not know it was load-bearing. The comparison is
   over the whole answer (status, content-type, raw body text), not
   over the parsed payload: a difference in key order or an extra
   member distinguishes the two just as well as a different value.

   ── how these routes reach this file's database ──
   A route handler gets its `Db` from `getSharedDbClient()`, which
   reads `DATABASE_URL`. So the variable is repointed at this file's
   scratch database before any route module is loaded, and restored
   at teardown. vitest gives each file its own worker, so the
   repoint is scoped here.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RESERVED_PROFILE_SEGMENTS } from "@/components/profile/tabs";
import { getSharedDbClient } from "@/lib/db";

import { ROUTES, answerOf, bind, payloadOf, routePatternFor } from "./contract";
import {
  MAX_NAME_LENGTH,
  type Scratch,
  closeDatabase,
  createAccount,
  createAccountWithHandle,
  createBundle,
  freeHandle,
  freeSlug,
  nameOfLength,
  openDatabase,
  seatHandle,
} from "./fixtures";

/** An owner that exists and holds one bundle. */
const OWNER_HANDLE = "t070-route-owner";
const OWNER_SLUG = "t070-route-bundle";
/** An owner that exists and holds NOTHING — the control for the indistinguishability property. */
const EMPTY_HANDLE = "t070-route-empty";
/** A handle nobody has, in neither `account.handle` nor `handle_reservation`. */
const UNKNOWN_HANDLE = "t070-route-nobody";

/** A handle allocated and then released: taken forever, and held by no live account. */
const RELEASED_HANDLE = "t070-route-released";

let t: Scratch;
let takenHandle: string;
let originalDatabaseUrl: string | undefined;

beforeAll(async () => {
  t = await openDatabase();

  const owner = await createAccountWithHandle(t, OWNER_HANDLE);
  await createBundle(t, owner, OWNER_SLUG);
  await createAccountWithHandle(t, EMPTY_HANDLE);

  /* A handle the handles route must report as taken, seated by hand rather than through
     `allocateHandle`: the route is what is under test here, and a fixture built through the
     module would make a red ambiguous between the two. */
  takenHandle = freeHandle();
  const holder = await createAccount(t);
  await seatHandle(t, holder, takenHandle);

  const released = await createAccount(t);
  await seatHandle(t, released, RELEASED_HANDLE);
  await t.query("update handle_reservation set status = 'released' where handle = $1", [
    RELEASED_HANDLE,
  ]);
  await t.query("update account set handle = null where id = $1", [released]);

  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = t.url;
}, 60_000);

afterAll(async () => {
  /* Closed before the variable is restored, so the pool that gets shut is the scratch one and
     not a fresh handle on the shared development database. */
  try {
    await getSharedDbClient().close();
  } catch {
    /* Teardown is not under test: a route module that never loaded left no pool to close. */
  }
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  await closeDatabase();
}, 60_000);

/* ============================================================
   Both URLs are served at all
   ============================================================ */

describe("the two URLs D-70-03 publishes are routed", () => {
  it(`serves ${ROUTES.handle.url}`, () => {
    /* Asked without importing a module or opening a database, so a red here says the URL is
       unserved rather than that a request failed. `app/api/names/**` is owned by this task, so
       an absent tree is a failed criterion and not a test looking in the wrong place. */
    expect(routePatternFor(ROUTES.handle.sample("mara-veil"))).toBe("/api/names/handles/[handle]");
  });

  it(`serves ${ROUTES.slug.url}`, () => {
    expect(routePatternFor(ROUTES.slug.sample("mara-veil", "frontline-triage"))).toBe(
      "/api/names/slugs/[owner]/[slug]",
    );
  });
});

/* ============================================================
   GET /api/names/handles/[handle]
   ============================================================ */

describe(`${ROUTES.handle.url}`, () => {
  it("answers 200 and `{ available: true }` for a handle nobody has", async () => {
    /* "there is no 404, because 'not found' **is** the available answer." A route that 404s a
       free handle inverts the whole surface — the sign-up form reads a 404 as an error and
       tells the user the one name that IS free is unusable. `payloadOf` fails on any status
       other than 200 and quotes that sentence. */
    const answer = await answerOf("handle", ROUTES.handle.sample(freeHandle()));
    const payload = payloadOf(answer, ROUTES.handle.url);
    expect(payload.available).toBe(true);
    expect(payload.reason).toBeUndefined();
  });

  it('answers `{ available: false, reason: "taken" }` for a handle somebody has', async () => {
    const answer = await answerOf("handle", ROUTES.handle.sample(takenHandle));
    const payload = payloadOf(answer, ROUTES.handle.url);
    expect(payload.available).toBe(false);
    expect(payload.reason).toBe("taken");
  });

  it("reports a RELEASED handle as taken, which is AC4 across the transport", async () => {
    /* AC4 is a module criterion and this is where a caller actually reads it. The account that
       held `RELEASED_HANDLE` no longer carries it in `account.handle`, so a route that answers
       from the account table alone reports it free — and a sign-up form then offers a name the
       module underneath will refuse forever. Neither the module tests nor the two route tests
       above can see that: it needs a handle that is reserved and unseated at once. */
    const answer = await answerOf("handle", ROUTES.handle.sample(RELEASED_HANDLE));
    const payload = payloadOf(answer, ROUTES.handle.url);
    expect(payload.available).toBe(false);
    expect(payload.reason).toBe("taken");
  });

  it('answers `{ available: false, reason: "illegal" }` for a name the grammar refuses', async () => {
    const answer = await answerOf("handle", ROUTES.handle.sample("Not A Handle"));
    const payload = payloadOf(answer, ROUTES.handle.url);
    expect(payload.available).toBe(false);
    expect(payload.reason).toBe("illegal");
  });

  it("answers `illegal` past the length bound rather than 500ing", async () => {
    const answer = await answerOf("handle", ROUTES.handle.sample(nameOfLength(MAX_NAME_LENGTH + 1)));
    const payload = payloadOf(answer, ROUTES.handle.url);
    expect(payload.available).toBe(false);
    expect(payload.reason).toBe("illegal");
  });

  it("answers JSON, and nothing outside the published three members", async () => {
    /* `payloadOf` runs `asAvailability`, which refuses a fourth member — the published shape is
       the whole shape, and an extra field on the wire is a second declaration of one interface
       by another route. D-70-10 was charged for exactly that in the contract; this is the same
       defect at the edge. */
    for (const handle of [freeHandle(), takenHandle, "Not A Handle"]) {
      const answer = await answerOf("handle", ROUTES.handle.sample(handle));
      expect(answer.contentType, `content-type for \`${handle}\``).toMatch(/application\/json/);
      payloadOf(answer, ROUTES.handle.url);
    }
  });

  it("agrees with the module it fronts", async () => {
    /* The join. A route that answers correctly while calling nothing — a hardcoded
       `{ available: true }`, a stub left in — passes every assertion above for the free case,
       and this is what catches it: the same three names, through the two surfaces, must agree. */
    const check = await bind("checkHandle");
    for (const handle of [freeHandle(), takenHandle, RELEASED_HANDLE, "Not A Handle"]) {
      const direct = (await check(t.db, handle)) as Record<string, unknown>;
      const viaRoute = payloadOf(
        await answerOf("handle", ROUTES.handle.sample(handle)),
        ROUTES.handle.url,
      );
      expect(viaRoute.available, `\`${handle}\`: route vs module`).toBe(direct.available);
      expect(viaRoute.reason, `\`${handle}\`: route vs module reason`).toBe(direct.reason);
    }
  });
});

/* ============================================================
   GET /api/names/slugs/[owner]/[slug]
   ============================================================ */

describe(`${ROUTES.slug.url}`, () => {
  it('answers `{ available: false, reason: "taken" }` for a slug that owner holds', async () => {
    /* The join D-70-14b rules on: the URL carries a HANDLE and `checkSlug` takes an id, so a
       route that passed the handle straight through as `ownerId` would raise 22P02 — or, worse,
       match nothing and report every slug free for every owner. */
    const answer = await answerOf("slug", ROUTES.slug.sample(OWNER_HANDLE, OWNER_SLUG));
    const payload = payloadOf(answer, ROUTES.slug.url);
    expect(payload.available).toBe(false);
    expect(payload.reason).toBe("taken");
  });

  it("answers `available` for a slug that owner does not hold", async () => {
    const answer = await answerOf("slug", ROUTES.slug.sample(OWNER_HANDLE, freeSlug()));
    expect(payloadOf(answer, ROUTES.slug.url).available).toBe(true);
  });

  it("answers `available` to a DIFFERENT owner for the same slug — AC2 across the transport", async () => {
    /* B-09 is per-owner, and the route is where the owner comes from. A lookup that resolved
       every handle to the same id, or ignored the segment, passes the two tests above and
       fails here. */
    const answer = await answerOf("slug", ROUTES.slug.sample(EMPTY_HANDLE, OWNER_SLUG));
    expect(payloadOf(answer, ROUTES.slug.url).available).toBe(true);
  });

  for (const segment of RESERVED_PROFILE_SEGMENTS) {
    it(`answers \`reserved\` for \`${segment}\` — AC1 across the transport`, async () => {
      const answer = await answerOf("slug", ROUTES.slug.sample(OWNER_HANDLE, segment));
      const payload = payloadOf(answer, ROUTES.slug.url);
      expect(payload.available).toBe(false);
      expect(payload.reason).toBe("reserved");
    });
  }

  it('answers `{ available: false, reason: "illegal" }` for a slug the grammar refuses', async () => {
    const answer = await answerOf("slug", ROUTES.slug.sample(OWNER_HANDLE, "Not A Slug"));
    const payload = payloadOf(answer, ROUTES.slug.url);
    expect(payload.available).toBe(false);
    expect(payload.reason).toBe("illegal");
  });
});

/* ============================================================
   D-70-14b: the unknown owner
   ============================================================ */

describe("an owner nobody is, is still refused the profile-tab slugs", () => {
  /* Quantified over `RESERVED_PROFILE_SEGMENTS` by construction, so a fifth tab is covered the
     day it is added. The ruling's own reasoning is the failure mode: short-circuiting to
     `available` for an unknown handle "would be wrong at exactly the moment it mattered" —
     the handle is created, the reserved name was promised, and the tab shadows the bundle. */
  for (const segment of RESERVED_PROFILE_SEGMENTS) {
    it(`refuses \`${segment}\` to \`${UNKNOWN_HANDLE}\`, which is nobody`, async () => {
      const answer = await answerOf("slug", ROUTES.slug.sample(UNKNOWN_HANDLE, segment));
      const payload = payloadOf(answer, ROUTES.slug.url);
      expect(
        payload.available,
        "the reserved set is a property of the URL space, not of an owner",
      ).toBe(false);
      expect(payload.reason).toBe("reserved");
    });
  }

  it("answers `available` to an unknown owner for an ordinary slug", async () => {
    /* The other side, and it is what stops the test above from being satisfied by a route that
       refuses everything for an unknown handle. That route would also be a leak — "no" for a
       stranger and "yes" for a real owner is the oracle B-03 exists to close. */
    const answer = await answerOf("slug", ROUTES.slug.sample(UNKNOWN_HANDLE, freeSlug()));
    expect(payloadOf(answer, ROUTES.slug.url).available).toBe(true);
  });

  it("does not 404 an owner nobody is", async () => {
    /* "there is no 404, because 'not found' **is** the available answer" — and a 404 here is
       also the leak, since a real owner's free slug answers 200. The status is asserted on its
       own rather than only through `payloadOf`, so the red names the right thing. */
    const answer = await answerOf("slug", ROUTES.slug.sample(UNKNOWN_HANDLE, freeSlug()));
    expect(answer.status).toBe(200);
  });
});

describe("the consequence D-70-14b did not aim at, tested in its own right", () => {
  /* "an unknown owner becomes indistinguishable from an existing owner holding no bundles, so
     the route does not leak whether a handle exists … recorded as a consequence rather than a
     justification, because a design defended by a benefit it did not aim at is a design nobody
     has actually checked."

     Checked here. The pair is `UNKNOWN_HANDLE` (nobody) against `EMPTY_HANDLE` (a real account
     holding no bundles), and the comparison is over the WHOLE answer rather than the parsed
     payload: an extension member, a different key order, a `WWW-Authenticate`, a 404 against a
     200 — each reinstates the oracle exactly as well as a different `available` would.

     Quantified over a set covering all three reasons plus the available case, because the
     property has to hold for every slug and not for the one somebody picked. A route that
     short-circuits only on the reserved list would pass a single-slug version of this test. */

  const SLUGS: ReadonlyArray<readonly [string, string]> = [
    [RESERVED_PROFILE_SEGMENTS[0], "a reserved segment"],
    [RESERVED_PROFILE_SEGMENTS[RESERVED_PROFILE_SEGMENTS.length - 1], "another reserved segment"],
    ["overview", "the tab that has no segment, so not reserved"],
    ["frontline-triage", "an ordinary slug"],
    ["Not A Slug", "a slug the grammar refuses"],
    [nameOfLength(MAX_NAME_LENGTH + 1), "a slug past the length bound"],
  ];

  for (const [slug, why] of SLUGS) {
    it(`answers identically for nobody and for an owner with no bundles — ${why}`, async () => {
      const unknown = await answerOf("slug", ROUTES.slug.sample(UNKNOWN_HANDLE, slug));
      const empty = await answerOf("slug", ROUTES.slug.sample(EMPTY_HANDLE, slug));

      expect(unknown.status, "status distinguishes them").toBe(empty.status);
      expect(unknown.contentType, "content-type distinguishes them").toBe(empty.contentType);
      expect(
        unknown.body,
        `the response for a handle nobody has differs from the response for a real account ` +
          `holding no bundles, so \`${ROUTES.slug.url}\` reports whether a handle exists.`,
      ).toBe(empty.body);
    });
  }

  it("and the pair is genuinely a pair: one of them really is an account, the other really is not", async () => {
    /* The control. Every assertion above is satisfied by two handles that are both unknown, or
       both real — at which point the property is true and untested. This is the same shape as
       the AC5 control: an equality that holds for the wrong reason reports nothing. */
    const seated = await t.query("select handle from account where handle = $1", [EMPTY_HANDLE]);
    expect(seated.length, `\`${EMPTY_HANDLE}\` is meant to be a real account`).toBe(1);

    const absent = await t.query(
      "select handle from account where handle = $1 " +
        "union all select handle from handle_reservation where handle = $1",
      [UNKNOWN_HANDLE],
    );
    expect(absent, `\`${UNKNOWN_HANDLE}\` is meant to be nobody, in either table`).toEqual([]);
  });
});
