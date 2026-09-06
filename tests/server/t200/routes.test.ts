/* ============================================================
   T200 — the three routes D-200-16 publishes

   `Owns` included `app/api/search/**` with nothing specified for
   it, which the blind half reported before writing a cell: T080
   published its eleven routes explicitly under D-80-02 and this
   task published none, while AC3's "not a 404" is HTTP language
   and therefore puts a route unambiguously in scope. D-200-16
   published them:

     GET /api/search/blueprints?q&tag&cat&phase&autonomy&df&forks&sort
     GET /api/search/cards?q&type&phase&human&risk&sort
     GET /api/search/terms?q&kind&origin

   GET and not SEAM-93's `POST /api/search`, decided by the
   contract's own justification — the parameter sets are fixed by
   the LIVE URLS and may not change or shared links break, and a
   POST body is not a link.

   ── what a route can be wrong about that a module cannot ──
   Three things, and each has a cell here rather than a duplicate
   of a module cell:

     * AC3 is HTTP at this layer. "An empty result returns the
       facet vocabularies, NOT A 404" is a claim about a STATUS,
       and 200 is the only place it can be checked.
     * AC1's unknown key is a BOUNDARY property. A typed shape per
       surface makes an unknown key a 400 here while the module
       underneath is perfectly tolerant, which is exactly the
       breakage the contract's `Record<string, string>` exists to
       prevent.
     * AC4 does not stop at the module boundary. A route is where
       a caller actually reads a response.

   Routes reach this file's scratch database the way T080's do:
   `DATABASE_URL` is repointed before any route module loads —
   `getSharedDbClient()` reads it — and restored at teardown.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSharedDbClient } from "@/lib/db";

import {
  FACET_KEYS,
  RFC9457_MEMBERS,
  ROUTES,
  ROUTE_NAMES,
  asResults,
  callRoute,
  findTokens,
  isProblemContentType,
  itemKey,
  type RouteName,
} from "./contract";
import {
  dropScratchDatabases,
  insertBundle,
  insertCard,
  insertRelease,
  manifest,
  mark,
  recordedSetup,
  scratchDatabase,
  type Scratch,
} from "./fixtures";
import { buildWorld, type World } from "./world";

let s: Scratch;
let w: World;
let originalDatabaseUrl: string | undefined;
/** Strings a route body may not carry, whoever asked. */
let tells: string[] = [];
const setup = recordedSetup("the T200 route world");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);

    /* One sealed bundle beside the public world, so AC4 has something to leak at this
       layer. Its tells are minted here and are unique per process, so a hit is a leak. */
    const sealedSlug = mark("route-sealed-slug");
    const sealedToken = mark("route-sealed-title");
    const sealedTag = mark("route-sealed-tag");
    const sealedCard = await insertCard(s, {
      ownerId: w.alpha.id,
      id: mark("route-sealed-card"),
      visibility: "private",
      name: `A sealed card ${sealedToken}`,
    });
    const sealed = await insertBundle(s, {
      owner: w.alpha,
      slug: sealedSlug,
      visibility: "private",
    });
    await insertRelease(s, {
      bundle: sealed,
      version: "1.0.0",
      cards: [sealedCard],
      manifest: manifest({
        slug: sealedSlug,
        title: `Sealed ${sealedToken}`,
        summary: `Not discoverable, ${sealedToken}.`,
        tags: [sealedTag],
      }),
    });
    tells = [sealedSlug, sealedToken, sealedTag, sealedCard.cardId, sealedCard.ref, sealed.id];

    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = s.url;
  });
});

afterAll(async () => {
  try {
    await getSharedDbClient().close();
  } catch {
    /* Teardown is not under test. */
  }
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  await dropScratchDatabases();
});

/** A query that matches nothing on any of the three surfaces. */
function unmatchable(): Record<string, string> {
  return { q: w.missToken };
}

function facetKeysFor(name: RouteName): readonly string[] {
  return FACET_KEYS[name];
}

/* --------------------- the 200 envelope --------------------- */

describe("D-200-16 each published URL answers 200 with a `Results`", () => {
  for (const name of ROUTE_NAMES) {
    it(`\`${ROUTES[name].url}\` answers a bare call`, async () => {
      setup.check();
      const response = await callRoute(name);
      expect(
        response.status,
        `${ROUTES[name].url} answered ${response.status}. The 200 body is the \`Results\` ` +
          `object itself, not an envelope around it.`,
      ).toBe(200);
      expect(
        isProblemContentType(response.headers.get("content-type")),
        `${ROUTES[name].url} answered 200 with an \`application/problem+json\` body, which is ` +
          `an error envelope wearing a success status.`,
      ).toBe(false);
      const results = asResults(await response.json(), ROUTES[name].url);
      expect(
        Object.keys(results.facets).sort(),
        `D-200-18 keys the facet map by the URL parameter names, and the route hands back ` +
          `what the module returns.`,
      ).toEqual([...facetKeysFor(name)].sort());
    });
  }
});

/* --------------------- AC3, which only exists at this layer --------------------- */

describe("AC3 an empty result is 200 with the vocabularies, not a 404", () => {
  for (const name of ROUTE_NAMES) {
    it(`\`${ROUTES[name].url}\` answers 200 to a query that matches nothing`, async () => {
      setup.check();
      /* The control first: the same URL, with hits, so "200 with empty hits" is not a claim
         about a route that answers 200-and-nothing to everything. */
      const populated = asResults(await (await callRoute(name)).json(), ROUTES[name].url);
      expect(
        populated.hits.length,
        `the control failed: \`${ROUTES[name].url}\` answered no hits at all, so the cell ` +
          `below would be measuring a route with nothing to return.`,
      ).toBeGreaterThan(0);

      const response = await callRoute(name, unmatchable());
      expect(
        response.status,
        `AC3, in the criterion's own words: "an empty result returns the facet vocabularies, ` +
          `NOT A 404". An empty result is an answer, not a missing resource — and 404 is the ` +
          `status a route reaches for when a reader asks it to distinguish "nothing matched" ` +
          `from "no such thing".`,
      ).toBe(200);

      const results = asResults(await response.json(), ROUTES[name].url);
      expect(results.hits.map((h) => itemKey(h.item)), "the premise: nothing matched").toEqual([]);
      for (const key of facetKeysFor(name)) {
        expect(
          (results.facets[key] ?? []).length,
          `AC3: \`facets.${key}\` came back empty on an empty result, which is the exact ` +
            `state the criterion is about.`,
        ).toBeGreaterThan(0);
        expect(
          [...(results.facets[key] ?? [])].sort(),
          `AC3: \`facets.${key}\` differs between a populated and an empty result.`,
        ).toEqual([...(populated.facets[key] ?? [])].sort());
      }
    });
  }
});

/* --------------------- AC1 at the boundary --------------------- */

describe("AC1 an unknown query key does not become a 400", () => {
  for (const name of ROUTE_NAMES) {
    it(`\`${ROUTES[name].url}\` answers an unknown key exactly as it answers none`, async () => {
      setup.check();
      const bare = await callRoute(name);
      const bareBody = asResults(await bare.json(), ROUTES[name].url);

      const unknown = mark("zz-nobody-knows-this-key");
      const response = await callRoute(name, { [unknown]: "x" });
      expect(
        response.status,
        `AC1: "an unknown key is ignored rather than erroring" PROTECTS SHARED LINKS, which ` +
          `is why \`params\` is \`Record<string, string>\` rather than a typed shape per ` +
          `surface — a typed shape makes an unknown key a compile error at the call site and ` +
          `a 400 at the boundary, breaking exactly the URLs the contract says may not break.\n` +
          `  This is the layer where that 400 would appear.`,
      ).toBe(200);

      const body = asResults(await response.json(), ROUTES[name].url);
      expect(
        body.hits.map((h) => itemKey(h.item)),
        "and it must be ignored rather than merely tolerated: the same hits, in the same order",
      ).toEqual(bareBody.hits.map((h) => itemKey(h.item)));
    });

    it(`\`${ROUTES[name].url}\` honours a known key while ignoring an unknown one`, async () => {
      setup.check();
      const known: Record<string, string> =
        name === "searchBlueprints"
          ? { tag: w.tagA }
          : name === "searchCards"
            ? { type: "tool" }
            : { kind: "phase" };
      const filtered = asResults(await (await callRoute(name, known)).json(), ROUTES[name].url);
      const bare = asResults(await (await callRoute(name)).json(), ROUTES[name].url);

      expect(filtered.hits.length, "the control: the known key matched something").toBeGreaterThan(0);
      expect(
        filtered.hits.length,
        "the control: the known key narrowed, so this cell can tell an ignored unknown key " +
          "from a boundary that drops every key on the floor",
      ).toBeLessThan(bare.hits.length);

      const unknown = mark("zz-nobody-knows-this-key");
      const both = asResults(
        await (await callRoute(name, { ...known, [unknown]: "x" })).json(),
        ROUTES[name].url,
      );
      expect(
        both.hits.map((h) => itemKey(h.item)),
        "AC1's load-bearing cell, at the boundary: a route that parses into a typed shape " +
          "and refuses the unknown key fails here, and so does one that abandons the known " +
          "key the moment an unrecognised one appears beside it.",
      ).toEqual(filtered.hits.map((h) => itemKey(h.item)));
    });
  }
});

/* --------------------- AC4 across the transport --------------------- */

describe("AC4 no route body carries private content", () => {
  const PROBES: readonly { name: RouteName; reach: string; params: () => Record<string, string> }[] =
    [
      { name: "searchBlueprints", reach: "the whole shelf", params: () => ({}) },
      {
        name: "searchBlueprints",
        reach: "the sealed manifest's own title token",
        params: () => ({ q: tells[1] }),
      },
      {
        name: "searchBlueprints",
        reach: "a tag only the sealed manifest carries",
        params: () => ({ tag: tells[2] }),
      },
      { name: "searchCards", reach: "the whole card shelf", params: () => ({}) },
      {
        name: "searchCards",
        reach: "the sealed card's own id",
        params: () => ({ q: tells[3] }),
      },
    ];

  for (const probe of PROBES) {
    it(`\`${ROUTES[probe.name].url}\` leaks nothing through ${probe.reach}`, async () => {
      setup.check();
      const response = await callRoute(probe.name, probe.params());
      expect(response.status, "the premise: the route answered at all").toBe(200);
      const body: unknown = await response.json();
      const leaked = findTokens(body, tells);
      expect(
        leaked,
        `AC4 does not stop at the module boundary, and a route is where a caller actually ` +
          `reads a response. \`${ROUTES[probe.name].url}\` leaked ${JSON.stringify(leaked)}.\n` +
          `  The reach here is: ${probe.reach}.`,
      ).toEqual([]);
    });
  }
});

/* --------------------- a value the database itself refuses --------------------- */

describe("D-200-16 an error is RFC 9457 problem+json, never an unhandled body", () => {
  for (const name of ROUTE_NAMES) {
    it(`\`${ROUTES[name].url}\` handles a NUL byte in a query value`, async () => {
      setup.check();
      /* `?q=%00` is a shared link a browser will happily produce, and Postgres `text` cannot
         hold a NUL — so this is the one input reachable through the published parameters
         that can drive a route off its success path. Written as the escape and never as a
         raw NUL byte: one NUL makes git and grep treat the file as binary.

         Either answer is correct. A 200 with an empty result is a route that sanitised its
         input; a problem document is a route that refused it. A 500 carrying a stack trace,
         an HTML page or a bare string is neither, and that is what this cell excludes. */
      const response = await callRoute(name, { q: "\u0000" });
      if (response.status === 200) {
        const results = asResults(await response.json(), ROUTES[name].url);
        expect(
          Object.keys(results.facets).sort(),
          "a 200 here must still be a well-formed `Results` with its vocabularies",
        ).toEqual([...facetKeysFor(name)].sort());
        return;
      }
      expect(
        isProblemContentType(response.headers.get("content-type")),
        `D-200-16: "errors are RFC 9457 \`problem+json\` like every other route in the ` +
          `tree". \`${ROUTES[name].url}\` answered ${response.status} with content-type ` +
          `${JSON.stringify(response.headers.get("content-type"))}.`,
      ).toBe(true);
      const problem = (await response.json()) as Record<string, unknown>;
      const missing = RFC9457_MEMBERS.filter((member) => problem[member] === undefined);
      expect(missing, "RFC 9457 members absent from the problem document").toEqual([]);
    });
  }
});
