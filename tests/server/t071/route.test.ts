/* ============================================================
   T071, F6 — the bound as a caller over HTTP sees it

     GET /api/names/handles/[handle]  ->  { available, reason?, suggestion? }

   D-071-02: "**F6 — YES, include the route cell** (33 characters
   through the published URL; it catches a route re-implementing
   availability, costs the implementer nothing)."

   ── this cell is expected to be free, and that is the argument for it ──
   `app/api/names/**` is §T071's Forbidden set. A correct
   implementation changes nothing here: the route calls `checkHandle`
   and inherits the bound. So a green costs the implementer nothing
   and a red is the one interesting shape — a route that answers
   availability for itself, from its own copy of the grammar or from
   a direct query, and therefore admits over the wire exactly what
   the module refuses in process.

   That shape is not hypothetical in this repository. D-70-14b put a
   handle-to-id lookup INSIDE the route rather than in the module, so
   the route already does some of its own reading, and a bound added
   to the module alone is precisely the kind of change a route with
   its own logic can miss.

   ── the route is driven, not imported by a guessed path ──
   The tree under `app/api/names/` is walked, the URL is matched
   through Next's own router, and whichever file wins is dispatched
   with `params` as a promise. A red therefore says "this URL
   answered wrongly" rather than "a file is missing from where I
   looked", and a route shadowed by a sibling dispatches here exactly
   as it would in production.

   ── D-70-03, quoted, so the status is not a preference ──
   "Both 200 with the `Availability` payload; there is no 404,
   because 'not found' **is** the available answer." An over-length
   handle is refused, not missing, so it is a 200 too.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getSharedDbClient } from "@/lib/db";

import { HANDLE_ROUTE, answerOf, payloadOf, routePatternFor } from "./contract";
import {
  MAX_HANDLE_LENGTH,
  clean,
  closeDatabase,
  databaseUrl,
  distinctNameOfLength,
  openDatabase,
} from "./fixtures";

const OVER = MAX_HANDLE_LENGTH + 1;

let originalDatabaseUrl: string | undefined;

beforeAll(async () => {
  await openDatabase();
  /* A route handler gets its `Db` from `getSharedDbClient()`, which reads `DATABASE_URL`. The
     only way to point it at this file's scratch database is to name it. Repointed here and
     restored in `afterAll`, scoped to this file's worker. */
  originalDatabaseUrl = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = databaseUrl();
  } catch {
    /* The scratch database is unavailable; `fixtures.scratch()` re-raises that inside whichever
       cell asks for it, which is where it belongs. Nothing to do here. */
  }
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

beforeEach(clean, 60_000);

describe(`${HANDLE_ROUTE.url} carries the product bound`, () => {
  it("the URL is served at all", () => {
    /* Asked without importing a module or opening a database, so a red here says the URL is
       unserved rather than that a request failed. */
    expect(routePatternFor(HANDLE_ROUTE.sample("mara-veil"))).toBe(HANDLE_ROUTE.pattern);
  });

  it(`answers 200 \`illegal\` with no suggestion at ${OVER} characters`, async () => {
    const handle = distinctNameOfLength(OVER, "route");
    const where = `${HANDLE_ROUTE.url} with ${OVER} characters`;
    const payload = payloadOf(await answerOf(HANDLE_ROUTE.sample(handle)), where);

    expect(payload.available, `${where} reported the handle as free over the wire.`).toBe(false);
    expect(
      payload.reason,
      `${where} answered \`{ available: false, reason: ${JSON.stringify(payload.reason)} }\`. ` +
        `The module answers "illegal" for this input; a route answering anything else is ` +
        `deciding availability for itself.`,
    ).toBe("illegal");
    expect(
      payload.suggestion,
      `${where} offered \`${payload.suggestion}\` over the wire. D-70-18 forbids a suggestion ` +
        `beside an ill-formed name and AC2 names the truncated candidate specifically. A route ` +
        `that adds one after the module declined to is handing a browser a name nobody asked ` +
        `for, at the surface where a reader is most likely to accept it.`,
    ).toBeUndefined();
  });

  it(`answers 200 \`available\` at ${MAX_HANDLE_LENGTH} characters — the bound is not off by one`, async () => {
    /* The control, and it is the direction that separates "the route carries the bound" from
       "the route refuses long-looking handles". Without it, every assertion above is satisfied
       by a route that answers `illegal` for everything over about twenty characters, or for
       everything at all. */
    const handle = distinctNameOfLength(MAX_HANDLE_LENGTH, "route");
    const where = `${HANDLE_ROUTE.url} with exactly ${MAX_HANDLE_LENGTH} characters`;
    const payload = payloadOf(await answerOf(HANDLE_ROUTE.sample(handle)), where);

    expect(
      payload.available,
      `${where} answered \`{ available: false, reason: ${JSON.stringify(payload.reason)} }\` ` +
        `for a free handle AT the bound. AC1 makes this one allocatable, so the route reporting ` +
        `it unavailable is a sign-up form refusing a name the registry would accept.`,
    ).toBe(true);
    expect(payload.reason, "an available answer explains nothing").toBeUndefined();
    expect(payload.suggestion, "D-70-21: nothing to suggest an alternative to").toBeUndefined();
  });
});
