/* ============================================================
   T080 — the eleven routes D-80-02 publishes

   `Owns` was three route trees with nothing specified for them.
   D-80-02 published the path, the method, the 200 body and the
   404 for each, so they are now part of the surface a blind suite
   can bind to. AC5's half of that lives in `unknown-key.test.ts`;
   this file covers the 200 envelope of every route, and carries
   AC6 across the transport — "no private bundle or private card
   appears in **any** response" does not stop at the module
   boundary, and a route is where a caller actually reads one.

   Routes reach this file's scratch database the way
   `unknown-key.test.ts` explains: `DATABASE_URL` is repointed
   before any route module loads, and restored at teardown.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSharedDbClient } from "@/lib/db";

import {
  ROUTES,
  type RouteName,
  type Scratch,
  assertTellsCannotOverMatch,
  callRoute,
  dropScratchDatabases,
  findTokens,
  insertAccount,
  insertBundle,
  insertCard,
  insertOntologyVersion,
  insertRelease,
  manifest,
  mark,
  scratchDatabase,
} from "./contract";

const SLUG = "route-fixture";
const SEALED_SLUG = "route-sealed-fixture";
const TWIN_A = "route-twin-one";
const TWIN_B = "route-twin-two";
const VERSIONED = "route-versioned-card";
/** A namespaced id: one card id spanning two URL segments, which `CARD_ID` admits. */
const NAMESPACED = "t080ns/route-ns-card";
const HIDDEN = "route-hidden-card";
const PHASE = "planning";
const SEALED_PHASE = "deployment";
const SEALED_TAG = "route-sealed-tag";
const SEALED_CATEGORY = "Route-Sealed-Category";

let s: Scratch;
let handle: string;
let tells: string[];
let originalDatabaseUrl: string | undefined;

/** One concrete URL per published route, so the sweep and the envelope check agree. */
let calls: Record<RouteName, string>;

beforeAll(async () => {
  s = await scratchDatabase();
  const owner = await insertAccount(s, mark("t080-routes"));
  handle = owner.handle;

  const twinBody = { name: "Route Twin", action: "route-twin-action", spec: "One shared spec." };
  const twinA = await insertCard(s, { ownerId: owner.id, id: TWIN_A, phases: [PHASE], ...twinBody });
  const twinB = await insertCard(s, { ownerId: owner.id, id: TWIN_B, phases: [PHASE], ...twinBody });
  /* Distinct `action` per version, and the reason is not cosmetic: `duplicates()` groups
     on the body minus `id`/`version`/`author`/`provenance`, so two versions of one card
     whose bodies are otherwise identical *are* a duplicate group. Caught by running this
     suite against a correct reference, where the twin-group assertion below saw three
     cards it had not put there. */
  const v1 = await insertCard(s, {
    ownerId: owner.id,
    id: VERSIONED,
    version: "1.0.0",
    action: "route-versioned-action-v1",
  });
  const v2 = await insertCard(s, {
    ownerId: owner.id,
    id: VERSIONED,
    version: "2.0.0",
    action: "route-versioned-action-v2",
  });
  const namespaced = await insertCard(s, {
    ownerId: owner.id,
    id: NAMESPACED,
    action: "route-namespaced-action",
  });
  const hidden = await insertCard(s, {
    ownerId: owner.id,
    id: HIDDEN,
    visibility: "private",
    phases: [SEALED_PHASE],
    action: "route-hidden-action",
  });

  const ontology = await insertOntologyVersion(s, "0.1.0", "sha256:route-ontology");
  const bundle = await insertBundle(s, { owner, slug: SLUG });
  await insertRelease(s, {
    bundle,
    version: "1.0.0",
    cards: [twinA, twinB, v1, v2, hidden, namespaced],
    manifest: manifest({ slug: SLUG, tags: ["route-open-tag"], category: "Route-Open-Category" }),
    autonomy: { autonomyClass: "supervised", level: 2 },
    security: { level: 3, raw: 3, penalties: [], findings: [], rationale: "4 − 1.00 → 3" },
    phaseCoverage: { covered: [PHASE], missing: [], byPhase: {}, unphased: [] },
    scoredOntologyVersionId: ontology.id,
  });

  const sealed = await insertBundle(s, { owner, slug: SEALED_SLUG, visibility: "private" });
  await insertRelease(s, {
    bundle: sealed,
    version: "1.0.0",
    cards: [v1],
    manifest: manifest({ slug: SEALED_SLUG, tags: [SEALED_TAG], category: SEALED_CATEGORY }),
  });

  tells = [SEALED_SLUG, SEALED_TAG, SEALED_CATEGORY, SEALED_PHASE, HIDDEN, hidden.ref, hidden.digest, sealed.id];
  assertTellsCannotOverMatch(tells, [
    handle,
    SLUG,
    TWIN_A,
    TWIN_B,
    VERSIONED,
    PHASE,
    "route-open-tag",
    "Route-Open-Category",
    twinBody,
  ]);

  calls = {
    blueprints: "/api/blueprints",
    blueprint: `/api/blueprints/${handle}/${SLUG}`,
    cards: "/api/cards",
    card: `/api/cards/${TWIN_A}@1.0.0`,
    versions: `/api/cards/${VERSIONED}/versions`,
    users: `/api/cards/${VERSIONED}/users`,
    duplicates: "/api/cards/duplicates",
    phases: `/api/ontology/phases`,
    phaseCards: `/api/ontology/phases/${PHASE}/cards`,
    tags: "/api/ontology/tags",
    categories: "/api/ontology/categories",
  };

  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = s.url;
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

const ROUTE_NAMES = Object.keys(ROUTES) as RouteName[];

/** The 200 body of `GET /api/blueprints/[owner]/[slug]` carries two members; every other one carries one. */
const EXTRA_MEMBERS: Partial<Record<RouteName, readonly string[]>> = { blueprint: ["scores"] };

describe("D-80-02 the published 200 envelope", () => {
  for (const name of ROUTE_NAMES) {
    it(`\`${ROUTES[name].url}\` answers 200 with { ${ROUTES[name].payloadKey}: … }`, async () => {
      const response = await callRoute(name, calls[name]);
      expect(response.status, `${ROUTES[name].url} answered ${response.status}`).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(
        Object.keys(body).sort(),
        `D-80-02 publishes this route's 200 body. "Every response is B-03's envelope at 200".`,
      ).toEqual([ROUTES[name].payloadKey, ...(EXTRA_MEMBERS[name] ?? [])].sort());
      expect(body[ROUTES[name].payloadKey]).toBeDefined();
    });
  }

  it("serves a namespaced card id and both of its sub-resources", async () => {
    /* `CARD_ID` admits an `owner/name` namespace, so this id spans two URL segments and no
       literal `[id]` folder can express it — the fact that made the folder-syntax reading
       of the published templates wrong. Driven by URL, so whatever pattern serves them has
       to reassemble the id from every segment before the sub-resource name. */
    const lookup = await callRoute("card", `/api/cards/${NAMESPACED}@1.0.0`);
    expect(lookup.status, `/api/cards/${NAMESPACED}@1.0.0`).toBe(200);
    const body = (await lookup.json()) as { card?: { ref?: unknown; id?: unknown } };
    expect(body.card?.ref).toBe(`${NAMESPACED}@1.0.0`);
    expect(body.card?.id).toBe(NAMESPACED);

    const versions = await callRoute("versions", `/api/cards/${NAMESPACED}/versions`);
    expect(versions.status, `/api/cards/${NAMESPACED}/versions`).toBe(200);
    expect(((await versions.json()) as { versions?: unknown[] }).versions).toHaveLength(1);

    const users = await callRoute("users", `/api/cards/${NAMESPACED}/users`);
    expect(users.status, `/api/cards/${NAMESPACED}/users`).toBe(200);
    expect(((await users.json()) as { users?: unknown[] }).users).toHaveLength(1);
  });

  it("does not read a bare sub-resource name as a card with an empty id", async () => {
    /* `/api/cards/versions` and `/api/cards/users` reach whatever serves `/api/cards/*`
       with a single segment. Read as a sub-resource, that is a versions listing for the
       empty id — a 200 carrying somebody's cards under a URL that names no card. Read as a
       card ref, `versions` has no `@` and resolves to nothing, which is the 404 the
       admissible-message clause publishes.

       Only reachable by URL: dispatched by module, the sub-resource handler is called
       directly and the ambiguity never arises. */
    for (const path of ["/api/cards/versions", "/api/cards/users"]) {
      const response = await callRoute("card", path);
      expect(response.status, `${path} answered ${response.status}`).toBe(404);
      const problem = (await response.json()) as { detail?: unknown };
      expect(problem.detail, path).toBe("card: no such card.");
    }
  });

  it("`GET /api/cards/duplicates` answers the twin group rather than being shadowed by [...ref]", async () => {
    const response = await callRoute("duplicates", "/api/cards/duplicates");
    const body = (await response.json()) as { groups?: unknown };
    const groups = body.groups as { ref: string }[][] | undefined;
    expect(
      groups?.map((group) => group.map((c) => c.ref).sort()),
      `\`/api/cards/duplicates\` is a static segment under the same parent as the catch-all ` +
        `\`/api/cards/[...ref]\`, so it is the one path where the two route trees D-80-02 ` +
        `publishes overlap. If the catch-all wins, this answers a card lookup for the ref ` +
        `"duplicates" instead.`,
    ).toEqual([[`${TWIN_A}@1.0.0`, `${TWIN_B}@1.0.0`].sort()]);
  });
});

describe("AC6 across the transport", () => {
  for (const name of ROUTE_NAMES) {
    it(`AC6: \`${ROUTES[name].url}\` shows an anonymous caller no private content`, async () => {
      const response = await callRoute(name, calls[name]);
      const body: unknown = response.status === 200 ? await response.json() : await response.text();
      const leaked = findTokens(body, tells);
      expect(
        leaked,
        `AC6 says "no private bundle or private card appears in **any** response", and a ` +
          `route is where a caller reads one. \`${ROUTES[name].url}\` leaked ` +
          `${JSON.stringify(leaked)}. The private bundle is \`${SEALED_SLUG}\` and the ` +
          `private card is \`${HIDDEN}\`, which the *public* bundle pins — so the card ` +
          `filter is the only thing keeping it out of \`/api/cards\`.`,
      ).toEqual([]);
    });
  }
});
