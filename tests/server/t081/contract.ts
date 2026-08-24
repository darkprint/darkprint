/* ============================================================
   T081 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── what T081 is ──
   D-13 says no rejection may carry the failed statement or its
   bound parameters. T080 merged with no error class and no store
   wrapper, so a driver fault escapes eleven merged, tagged routes
   as a raw `DrizzleQueryError` whose message opens with the full
   `select … from "bundle"`. T081 publishes `RegistryStoreError`,
   `withRegistryStore` and `withRegistryErrors` to close it.

   ── why every load is a dynamic import ──
   This suite was written in a worktree branched from `backend`
   before the implementation existed. A static top-level import of
   an absent module fails the whole FILE at collection, which
   reports one red where the protocol asks for one per acceptance
   criterion. Loading inside the test that needs it turns "the
   module is not there yet" into the per-criterion red the handback
   is supposed to produce. The specifier stays a literal so the `@`
   alias resolves.

   Note what that costs and what it does not: the barrel is reached
   only through `loadRegistry()`, whose result is typed `Namespace`
   (`Record<string, unknown>`), so `tsc` reports NOTHING for the
   three names T081 has not published yet. The absence is visible
   as reds and is invisible to typecheck — stated because a suite
   whose absent subject shows up in a gate number and one whose
   does not are different artefacts, and only the reds are evidence
   here.

   ── why this needs no database and no gate slot ──
   AC2: the fault is produced by pointing a connection string at a
   CLOSED PORT. Port 1 is reserved and never listening, so `connect`
   fails with ECONNREFUSED and drizzle wraps that in the
   `DrizzleQueryError` carrying the statement — which is the exact
   error the contract measured escaping `GET /api/cards` and
   `GET /api/blueprints`. Nothing here creates, migrates or drops a
   database, so every assertion in this suite runs off-slot.

   ── the shape of the AC3 predicate, and why it is not a blacklist ──
   `not.toContain("select")` excludes the leaks somebody thought of.
   What is asserted instead is derived on BOTH sides:

     * the deny set is every token of THE SQL THE DRIVER ACTUALLY
       RAN, read off the `DrizzleQueryError` on `cause` rather than
       typed here, plus every bound parameter it carried;
     * the allow set is the caller's own identifiers and the
       operation name, and `assertTellsCannotOverMatch` proves at
       fixture time that no deny token is a substring of any of
       them, so an over-match cannot masquerade as a leak (T-04).

   The instrument carries a POSITIVE CONTROL: `surface.test.ts`
   runs the same predicate over the raw `DrizzleQueryError` and
   requires it to report a leak. A leak scanner that cannot
   register the quantity reads zero for the same reason a broken
   one does, so every green below rests on a check shown able to go
   red on the very error T081 exists to seal.

   ── two contract gaps, reported and since ruled ──
   Both were reported as gaps rather than filled, because the block
   resolved two ways and a blind author that picks reds a correct
   implementation that picked the other way. Both are now ruled,
   and the pins are in.

   D-81-01: `message` is `` `${operation}: the registry store
   failed.` `` exactly — the form already shipped twice, at
   `archive/errors.ts:74` and in T050. Pinned by exact match, with
   the expected string written out as a LITERAL here rather than
   imported from the module: an expectation built from its own
   subject asserts that the module agrees with itself and passes
   unchanged if the template starts interpolating a driver value.

   D-81-02: a store fault's `detail` is the instance's own
   `message`, byte for byte.

   The three invariance assertions are KEPT ALONGSIDE the pins
   rather than replaced by them, because they test what an exact
   match cannot:

     * one reader, two argument lists, byte-identical message —
       no bound parameter reaches the rendering;
     * one reader, two unreachable servers differing in user,
       password, port and database, byte-identical message — no
       DRIVER value reaches it, which no literal pin observes;
     * the thirteen messages pairwise distinct — which is what
       stops a constant string satisfying both invariances
       perfectly while naming nothing.

   Still unpublished and still not invented: the problem
   document's `title` literal. D-81-02 says it is "the problem
   type's own", which fixes it per type without giving the string.
   What is asserted is that it is a non-empty string and the SAME
   one on all eleven routes and for every caller. If the wording
   is published, that becomes a fourth exact match.
   ============================================================ */

import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { expect } from "vitest";

import { getRouteMatcher } from "next/dist/shared/lib/router/utils/route-matcher.js";
import { getRouteRegex } from "next/dist/shared/lib/router/utils/route-regex.js";
import { getSortedRoutes } from "next/dist/shared/lib/router/utils/sorted-routes.js";

import { createDbClient, type DbClient } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const REGISTRY = "@/lib/server/registry";

/** AC4 publishes this URI exactly. It is the one string in the whole task pinned by literal. */
export const STORE_FAILED_TYPE = "https://darkprint.io/problems/store-failed";

/** RFC 9457's media type, which B-03 requires of every transport failure. */
export const PROBLEM_MEDIA_TYPE = "application/problem+json";

/**
 * D-81-01, written out as a literal rather than imported from the module under test.
 *
 * "Assert `message` equals the constructed form" is only a check if the expected string is
 * written here. A test that builds its expectation from the subject — importing the template,
 * reusing the format helper, reconstructing it from an exported constant — asserts that the
 * module agrees with itself, and passes unchanged if the template itself starts interpolating
 * a driver value. A blind author gets this right by necessity; the exposure is the later
 * reader for whom importing the shared constant looks like removing duplication. Doing that to
 * this function is a REMOVED ASSERTION and is treated as one.
 */
export function storeFailureMessage(operation: string): string {
  return `${operation}: the registry store failed.`;
}

/**
 * D-81-01's template with the operation left open, so a red can say WHICH half is wrong: a
 * message that fails this regex disagrees about the wording, and one that passes it while
 * naming an unexpected operation disagrees about which read failed. Those need different
 * fixes and a single equality cannot tell them apart.
 */
export const STORE_FAILURE_FORM = /^(.+): the registry store failed\.$/;

/* --------------------- loading the barrel --------------------- */

let registry: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, so every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadRegistry(): Promise<Namespace> {
  registry ??= import("@/lib/server/registry").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${REGISTRY} does not load.\n` +
          `  backend.md §T081 publishes three names from this barrel: ` +
          `${Object.keys(PUBLISHED_T081).join(", ")}.\n` +
          `  This is a failed acceptance criterion, not a broken test. The specifier is a ` +
          `literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return registry;
}

function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${REGISTRY} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion and not a naming difference. The Published ` +
      `signatures block names this export exactly; the rule above it ("the contract must name ` +
      `the interface, not only the behaviour") exists because two rounds of candidate lists in ` +
      `T000 each resolved to the wrong thing. Do not add a synonym here.`,
  );
}

/* --------------------- what T081 publishes --------------------- */

/**
 * backend.md §T081's Published signatures block, quoted so a red says where the name comes
 * from rather than only that a test wanted it.
 */
export const PUBLISHED_T081 = {
  RegistryStoreError:
    "class RegistryStoreError extends Error { constructor(operation: string, cause: unknown) } " +
    "— `message` is the OPERATION alone",
  withRegistryStore:
    "withRegistryStore<T>(operation: string, work: () => Promise<T>): Promise<T>",
  withRegistryErrors:
    "withRegistryErrors(request: Request, work: () => Promise<Response>): Promise<Response>",
} as const;

export type PublishedT081Name = keyof typeof PUBLISHED_T081;

/** The three names T081 adds to the barrel, in the order the block publishes them. */
export const T081_NAMES = Object.keys(PUBLISHED_T081) as PublishedT081Name[];

/**
 * The readers backend.md §T080's Published signatures block names, and the only surface
 * AC2's "every published read wraps" can mean. Quoted rather than re-derived, so a red
 * against this list is a disagreement with a published block.
 *
 * **Thirteen at T081's merge, sixteen since T132.** The last three are that task's ruled
 * amendments to T080's merged record — `graphsOf` and `scoresFor` (D-132-01, the batch
 * readers owed to T260 under D-260-14 and D-260-21) and `cardsOwnedBy` (D-132-02 reading
 * (a), the reader `counts.cards` needed). They are added HERE rather than left out because
 * `surface.test.ts`'s barrel-agreement check is the thing that caught them, in its own
 * words: *an addition is a contract amendment and belongs in the block*. Leaving them out
 * would have narrowed AC2's "every" to thirteen of sixteen while the criterion still said
 * every, which is the failure that check exists to prevent.
 */
export const PUBLISHED_READERS = {
  blueprints: "blueprints(db: Db, actor: Actor): Promise<readonly BlueprintSummary[]>",
  blueprint:
    "blueprint(db: Db, actor: Actor, ownerHandle: string, slug: string): " +
    "Promise<BlueprintSummary | undefined>",
  cards: "cards(db: Db, actor: Actor): Promise<readonly CardSummary[]>",
  latestCards: "latestCards(db: Db, actor: Actor): Promise<readonly CardSummary[]>",
  versionsOf:
    "versionsOf(db: Db, actor: Actor, cardId: string): Promise<readonly CardSummary[]>",
  card: "card(db: Db, actor: Actor, ref: CardRef): Promise<CardSummary | undefined>",
  usersOf:
    "usersOf(db: Db, actor: Actor, cardId: string): Promise<readonly BlueprintSummary[]>",
  duplicates:
    "duplicates(db: Db, actor: Actor): Promise<readonly (readonly CardSummary[])[]>",
  phases: "phases(db: Db, actor: Actor): Promise<readonly string[]>",
  cardsByPhase:
    "cardsByPhase(db: Db, actor: Actor, phase: string): Promise<readonly CardSummary[]>",
  tags: "tags(db: Db, actor: Actor): Promise<readonly string[]>",
  categories: "categories(db: Db, actor: Actor): Promise<readonly string[]>",
  scoresOf:
    "scoresOf(db: Db, actor: Actor, ownerHandle: string, slug: string): " +
    "Promise<Scores | undefined>",
  graphsOf:
    "graphsOf(db: Db, actor: Actor, keys: readonly BlueprintKey[]): " +
    "Promise<ReadonlyMap<string, { graph: BlueprintGraph; requiredAgents: readonly " +
    "string[]; requiredTools: readonly string[] }>>",
  scoresFor:
    "scoresFor(db: Db, actor: Actor, keys: readonly BlueprintKey[]): " +
    "Promise<ReadonlyMap<string, Scores>>",
  cardsOwnedBy:
    "cardsOwnedBy(db: Db, actor: Actor, ownerHandle: string): " +
    "Promise<readonly CardSummary[]>",
} as const;

export type ReaderName = keyof typeof PUBLISHED_READERS;

export const READER_NAMES = Object.keys(PUBLISHED_READERS) as ReaderName[];

/**
 * `actorFrom` is on the barrel and is not a read: it takes a `Request`, never a `Db`, so it
 * cannot raise a driver fault and owes no wrapper. Named here rather than filtered out inside
 * an assertion, because the barrel-agreement check below owes BOTH set differences and an
 * exclusion buried in a `.filter()` is the hand-maintained list a constructed domain exists
 * to remove.
 */
export const NON_READER_EXPORTS = ["actorFrom"] as const;

/* --------------------- the caller's own identifiers --------------------- */

/**
 * The arguments the probes supply. They are the allow set for the leak sweep, so they are
 * chosen to share no token with any SQL identifier in this schema — and
 * `assertTellsCannotOverMatch` proves that at fixture time rather than trusting it. T-04 is
 * the same defect from the other side: a tell that matches the fixture's own identifier reds
 * like a real leak, and T020's suite shipped two of them.
 *
 * `t081-probe-gamma` satisfies `CARD_ID` (`lib/core/card/schema.ts`), so `card()` and
 * `versionsOf()` reach the driver instead of refusing the shape before a connection opens.
 */
export const PROBE = {
  ownerHandle: "t081-probe-alpha",
  slug: "t081-probe-beta",
  cardId: "t081-probe-gamma",
  ref: "t081-probe-gamma@1.0.0",
  phase: "t081-probe-delta",
} as const;

/** Anonymous: `actorFrom` answers this for a request with no cookie, so no secret is needed. */
export const ANONYMOUS: Actor = { kind: "anonymous" };

/**
 * One concrete argument list per published reader, and the second is deliberately DIFFERENT
 * in every caller-supplied value. G1's invariance axis needs two calls to one reader that
 * differ only in what the caller supplied: identical messages then say the message carries no
 * bound parameter, which is D-13's clause verbatim and needs no published wording.
 *
 * The readers taking no argument past `(db, actor)` have one call shape, so that axis is
 * unavailable for them and is not claimed — see `hasCallerInputs`.
 */
export interface ReaderProbe {
  /** `(db, actor, …)` for the first call. */
  args: readonly unknown[];
  /** The same reader with every caller-supplied value changed, or `undefined` if it takes none. */
  variantArgs?: readonly unknown[];
  /** The caller-supplied strings in `args`, for the allow set and for the T-04 guard. */
  supplied: readonly string[];
}

const VARIANT = {
  ownerHandle: "t081-variant-epsilon",
  slug: "t081-variant-zeta",
  cardId: "t081-variant-eta",
  ref: "t081-variant-eta@2.0.0",
  phase: "t081-variant-theta",
} as const;

export const READER_PROBES: Record<ReaderName, ReaderProbe> = {
  blueprints: { args: [], supplied: [] },
  blueprint: {
    args: [PROBE.ownerHandle, PROBE.slug],
    variantArgs: [VARIANT.ownerHandle, VARIANT.slug],
    supplied: [PROBE.ownerHandle, PROBE.slug],
  },
  cards: { args: [], supplied: [] },
  latestCards: { args: [], supplied: [] },
  versionsOf: {
    args: [PROBE.cardId],
    variantArgs: [VARIANT.cardId],
    supplied: [PROBE.cardId],
  },
  card: { args: [PROBE.ref], variantArgs: [VARIANT.ref], supplied: [PROBE.ref] },
  usersOf: { args: [PROBE.cardId], variantArgs: [VARIANT.cardId], supplied: [PROBE.cardId] },
  duplicates: { args: [], supplied: [] },
  phases: { args: [], supplied: [] },
  cardsByPhase: { args: [PROBE.phase], variantArgs: [VARIANT.phase], supplied: [PROBE.phase] },
  tags: { args: [], supplied: [] },
  categories: { args: [], supplied: [] },
  scoresOf: {
    args: [PROBE.ownerHandle, PROBE.slug],
    variantArgs: [VARIANT.ownerHandle, VARIANT.slug],
    supplied: [PROBE.ownerHandle, PROBE.slug],
  },
  /* The two batch readers take a LIST, and it must be non-empty here. Both answer an empty
     map for an empty one without issuing a statement — deliberate, and it would make this
     probe resolve instead of reaching the driver, which is a green measuring nothing. */
  graphsOf: {
    args: [[{ ownerHandle: PROBE.ownerHandle, slug: PROBE.slug }]],
    variantArgs: [[{ ownerHandle: VARIANT.ownerHandle, slug: VARIANT.slug }]],
    supplied: [PROBE.ownerHandle, PROBE.slug],
  },
  scoresFor: {
    args: [[{ ownerHandle: PROBE.ownerHandle, slug: PROBE.slug }]],
    variantArgs: [[{ ownerHandle: VARIANT.ownerHandle, slug: VARIANT.slug }]],
    supplied: [PROBE.ownerHandle, PROBE.slug],
  },
  cardsOwnedBy: {
    args: [PROBE.ownerHandle],
    variantArgs: [VARIANT.ownerHandle],
    supplied: [PROBE.ownerHandle],
  },
};

export function hasCallerInputs(name: ReaderName): boolean {
  return READER_PROBES[name].variantArgs !== undefined;
}

/* --------------------- a database that is not there --------------------- */

/**
 * Port 1 is reserved and never listening, so `connect` fails with ECONNREFUSED before any
 * statement is sent — the shape a SQLSTATE-keyed catch cannot classify, because there is no
 * SQLSTATE. It is also the exact probe the contract used to measure the defect.
 *
 * `createDbClient` attaches its own pool `error` listener, so a refused connection cannot take
 * the worker down with an unhandled `EventEmitter` error.
 */
export const DEAD_URL = "postgres://darkprint:darkprint@127.0.0.1:1/darkprint";

/**
 * A second unreachable server. It shares the scheme and the loopback host with the first —
 * said plainly, because "shares nothing" was the first wording here and it is false — and
 * differs in user, password, port and database name, which are the four fields a rendering
 * would have to interpolate to leak anything about the connection.
 *
 * G1's other invariance axis: if the two produce byte-identical messages, no value derived
 * from the DRIVER'S OWN ERROR reached the rendering. All four differing strings appear in
 * `String(cause)`, so a message built by interpolating the cause diverges here without anyone
 * having to predict which field the port or the credentials arrived in.
 *
 * Stated limit: this axis is silent about anything the two errors SHARE, the statement
 * included. That half is `checkNoStatementLeak`'s, and neither substitutes for the other.
 */
export const OTHER_DEAD_URL = "postgres://kappa:lambda@127.0.0.1:2/mu";

export interface DeadDb {
  db: unknown;
  client: DbClient;
  close: () => Promise<void>;
}

export function deadDb(url: string = DEAD_URL): DeadDb {
  const client = createDbClient(url);
  return {
    db: client.db,
    client,
    close: async () => {
      try {
        await client.close();
      } catch {
        /* a pool that never connected has nothing to end; teardown is not under test */
      }
    },
  };
}

/* --------------------- the eleven routes, by URL --------------------- */

/**
 * D-80-02 publishes eleven route paths, their methods and their response shapes, and
 * D-80-07 rules that THE URLS ARE THE CONTRACT and the file layout is the implementation's.
 * So the table below is discovered by walking `app/api/**` for route files, ordered by Next's
 * own `getSortedRoutes` and matched by its own `getRouteRegex`/`getRouteMatcher` — this file
 * cannot disagree with the router about precedence or about what a catch-all captures.
 *
 * The file that wins is imported by its absolute path, which is a runtime value and binds
 * nothing at compile time. A blind suite that imports route MODULES takes `tsc` and
 * `npm run build` down with it, which is the gate block D-80-07 records.
 *
 * `context.params` is a promise in this version of Next
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`), so a
 * handler is invoked with one and never with a plain object.
 */
export interface RouteProbe {
  /** The published URL template, quoted in failure messages. */
  url: string;
  /** A concrete instantiation, driven against the closed port. */
  path: string;
  /**
   * The same URL with every caller-supplied segment changed, for G2's invariance axis, or
   * `undefined` for a route with no dynamic segment.
   */
  variantPath?: string;
  /** The caller-supplied segments in `path`. */
  supplied: readonly string[];
}

export type RouteName =
  | "blueprints"
  | "blueprint"
  | "cards"
  | "card"
  | "versions"
  | "users"
  | "duplicates"
  | "phases"
  | "phaseCards"
  | "tags"
  | "categories";

export const ROUTE_PROBES: Record<RouteName, RouteProbe> = {
  blueprints: { url: "GET /api/blueprints", path: "/api/blueprints", supplied: [] },
  blueprint: {
    url: "GET /api/blueprints/[owner]/[slug]",
    path: `/api/blueprints/${PROBE.ownerHandle}/${PROBE.slug}`,
    variantPath: `/api/blueprints/${VARIANT.ownerHandle}/${VARIANT.slug}`,
    supplied: [PROBE.ownerHandle, PROBE.slug],
  },
  cards: { url: "GET /api/cards", path: "/api/cards", supplied: [] },
  card: {
    url: "GET /api/cards/[...ref]",
    /* A NAMESPACED id, which is the shape that made the folder-syntax reading of the published
       paths wrong: `CARD_ID` admits `owner/name`, so one id spans two URL segments. */
    path: `/api/cards/${PROBE.ownerHandle}/${PROBE.cardId}@1.0.0`,
    variantPath: `/api/cards/${VARIANT.ownerHandle}/${VARIANT.cardId}@2.0.0`,
    supplied: [PROBE.ownerHandle, PROBE.cardId],
  },
  versions: {
    url: "GET /api/cards/[id]/versions",
    path: `/api/cards/${PROBE.cardId}/versions`,
    variantPath: `/api/cards/${VARIANT.cardId}/versions`,
    supplied: [PROBE.cardId],
  },
  users: {
    url: "GET /api/cards/[id]/users",
    path: `/api/cards/${PROBE.cardId}/users`,
    variantPath: `/api/cards/${VARIANT.cardId}/users`,
    supplied: [PROBE.cardId],
  },
  duplicates: {
    url: "GET /api/cards/duplicates",
    path: "/api/cards/duplicates",
    supplied: [],
  },
  phases: { url: "GET /api/ontology/phases", path: "/api/ontology/phases", supplied: [] },
  phaseCards: {
    url: "GET /api/ontology/phases/[phase]/cards",
    path: `/api/ontology/phases/${PROBE.phase}/cards`,
    variantPath: `/api/ontology/phases/${VARIANT.phase}/cards`,
    supplied: [PROBE.phase],
  },
  tags: { url: "GET /api/ontology/tags", path: "/api/ontology/tags", supplied: [] },
  categories: {
    url: "GET /api/ontology/categories",
    path: "/api/ontology/categories",
    supplied: [],
  },
};

export const ROUTE_NAMES = Object.keys(ROUTE_PROBES) as RouteName[];

/** The three trees T081 owns under `app/api/**`, and the only ones this file walks. */
const OWNED_API_TREES = ["blueprints", "cards", "ontology"] as const;

interface DiscoveredRoute {
  pattern: string;
  file: string;
}

const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;
const API_ROOT = fileURLToPath(new URL("../../../app/api/", import.meta.url));

let table: DiscoveredRoute[] | undefined;

function walk(dir: string, segments: string[], out: DiscoveredRoute[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // a tree the implementation has not created
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walk(join(dir, entry.name), [...segments, entry.name], out);
    else if (ROUTE_FILE.test(entry.name)) {
      out.push({ pattern: `/api/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

/** Every route the implementation publishes under the three owned trees, in Next's own order. */
export function routeTable(): readonly DiscoveredRoute[] {
  if (table !== undefined) return table;
  const found: DiscoveredRoute[] = [];
  for (const tree of OWNED_API_TREES) walk(join(API_ROOT, tree), [tree], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under app/api/{${OWNED_API_TREES.join(",")}}/**.\n` +
        `  backend.md §T081 owns those three trees and AC4 quantifies over "all eleven routes".\n` +
        `  Nothing here binds a file path: the routes are discovered, so this says the read API ` +
        `is absent rather than that a guessed path is wrong.`,
    );
  }
  const byPattern = new Map(found.map((r) => [r.pattern, r]));
  let ordered: string[];
  try {
    ordered = getSortedRoutes([...byPattern.keys()]);
  } catch (cause) {
    throw new Error(
      `The published route tree does not sort: ${String(cause)}\n` +
        `  Patterns found: ${[...byPattern.keys()].sort().join(", ")}\n` +
        `  This is Next's own conflict check, not this suite's opinion about layout.`,
      { cause },
    );
  }
  table = ordered.map((pattern) => byPattern.get(pattern)!);
  return table;
}

function matchRoute(path: string): { route: DiscoveredRoute; params: Record<string, unknown> } {
  const routes = routeTable();
  for (const route of routes) {
    const params = getRouteMatcher(getRouteRegex(route.pattern))(path);
    if (params !== false) return { route, params };
  }
  throw new Error(
    `No published route matches \`${path}\`.\n` +
      `  Discovered patterns, in the App Router's precedence order: ` +
      `${routes.map((r) => r.pattern).join(", ")}\n` +
      `  The contract publishes URLs and the layout is the implementation's, so this says the ` +
      `URL is unserved rather than that a file is missing from a guessed path.`,
  );
}

/**
 * Which published pattern serves a URL. Answers the surface question — "is this URL routed at
 * all" — without importing a module or opening a socket, so a red says the URL is unserved
 * rather than that a request failed.
 */
export function routePatternFor(path: string): string {
  return matchRoute(path).route.pattern;
}

/**
 * Drive a published URL the way a caller does: matched through Next's router, dispatched to
 * whichever file wins, invoked with `params` as a promise.
 *
 * `name` names the published route only so a red can quote the contract; it takes no part in
 * choosing the module, which is what makes this a measurement of the served surface rather
 * than of a file this suite picked.
 *
 * **A handler that THROWS is returned as a rejection here rather than caught**, because AC4's
 * whole content is that a store fault answers `problem+json` and does not escape into Next's
 * generic 500. Swallowing the throw would make the criterion unobservable in the one direction
 * it is about.
 */
export async function callRoute(name: RouteName, path: string): Promise<Response> {
  const spec = ROUTE_PROBES[name];
  const { route, params } = matchRoute(path);
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(
      `\`${route.pattern}\` — the route serving \`${path}\` — does not load.\n` +
        `  Driving the published URL \`${spec.url}\`.`,
      { cause },
    );
  }
  const get = mod.GET;
  if (typeof get !== "function") {
    throw new Error(
      `\`${route.pattern}\` exports no \`GET\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}). D-80-02 publishes the method, ` +
        `and this route is the one serving \`${spec.url}\`.`,
    );
  }
  const request = new Request(`https://darkprint.test${path}`);
  const answered = await (get as UnknownFn)(request, { params: Promise.resolve(params) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${spec.url}\` answered ${describe_(answered)}; a route handler returns a Response.`,
    );
  }
  return answered;
}

/* --------------------- pointing the routes at the closed port --------------------- */

/**
 * `getSharedDbClient()` reads `DATABASE_URL` and caches the pool on `globalThis` behind
 * `Symbol.for("darkprint.db.sharedClient")` (`lib/db/client.ts`). A route handler calls it
 * inside the handler, so repointing the variable before the first call is enough — but the
 * cache is cleared explicitly anyway, because "no other file in this worker created one
 * first" is a PREMISE and this run's standing rule is to check a premise rather than inherit
 * it. Clearing it costs one line and turns an assumption into an operation.
 */
const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

let savedDatabaseUrl: string | undefined;

export function pointRoutesAtClosedPort(): void {
  savedDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = DEAD_URL;
  delete (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
}

export async function restoreRoutesDatabase(): Promise<void> {
  const withShared = globalThis as GlobalWithSharedClient;
  const client = withShared[SHARED_CLIENT_KEY];
  delete withShared[SHARED_CLIENT_KEY];
  if (client !== undefined) {
    try {
      await client.close();
    } catch {
      /* a pool that never connected has nothing to end */
    }
  }
  if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedDatabaseUrl;
}

/* --------------------- rejections --------------------- */

/**
 * Await `work` and require it to reject. Returns the thrown value so the caller can assert on
 * it, and fails with `where` in the message so a red names the call rather than the helper.
 */
export async function rejects(work: () => unknown, where: string): Promise<unknown> {
  let resolved: unknown;
  try {
    resolved = await work();
  } catch (thrown) {
    return thrown;
  }
  throw new Error(
    `${where} RESOLVED with ${describe_(resolved)} against a server that refuses every ` +
      `connection.\n` +
      `  AC2 quantifies over "every published read", measured by pointing the connection at a ` +
      `closed port. A read that answers here is answering without the store, which is a ` +
      `different defect from the one T081 exists to fix and a worse one.`,
  );
}

/* --------------------- what the driver actually ran --------------------- */

/** Every error in a `cause` chain, outermost first. Depth-bounded: a cycle must not hang a run. */
export function causeChain(err: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current !== undefined && current !== null && !seen.has(current) && chain.length < 32) {
    seen.add(current);
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

/**
 * The SQL the driver ran, read off the error rather than typed here. Drizzle 0.45's
 * `DrizzleQueryError` carries the statement on a `query` property and repeats it in its
 * message as `Failed query: <sql>` followed by `params: <values>`; both are read, and the
 * union is what AC3's "a substring of the SQL it ran" quantifies over.
 *
 * Returns `""` when no statement can be found, which the callers treat as a VACUOUS
 * measurement and red on — a leak scanner with an empty deny set passes everything.
 */
export function sqlOf(err: unknown): string {
  const parts: string[] = [];
  for (const link of causeChain(err)) {
    const query = (link as { query?: unknown }).query;
    if (typeof query === "string" && query.length > 0) parts.push(query);
    const message = (link as { message?: unknown }).message;
    if (typeof message === "string") {
      const match = /Failed query:\s*([\s\S]*?)(?:\n\s*params:|$)/.exec(message);
      if (match?.[1] !== undefined && match[1].trim().length > 0) parts.push(match[1].trim());
    }
  }
  return parts.join("\n");
}

/** The bound parameters the driver carried, rendered — D-13's second clause. */
export function boundParamsOf(err: unknown): string {
  const parts: string[] = [];
  for (const link of causeChain(err)) {
    const params = (link as { params?: unknown }).params;
    if (Array.isArray(params) && params.length > 0) parts.push(params.map(String).join(" "));
    const message = (link as { message?: unknown }).message;
    if (typeof message === "string") {
      const match = /\n\s*params:\s*([\s\S]*)$/.exec(message);
      if (match?.[1] !== undefined && match[1].trim().length > 0) parts.push(match[1].trim());
    }
  }
  return parts.join(" ");
}

/**
 * Tokens, matched at a word boundary rather than by substring. `includes` answers "do these
 * characters appear" where the claim is "does this leak an identifier", and the second is
 * narrower — `ontology_version` inside `ontology_version_version_key` is the instance this
 * repository already paid for. The leading class admits a DIGIT so a SQLSTATE like `23505` is
 * representable; the earlier form required a letter and produced no token at all for exactly
 * the value the clause names.
 *
 * Minimum length 3, stated as a limit rather than left implicit: `id`, `on` and `as` are not
 * tokens here, so this predicate cannot see a rendering that leaks only a two-character
 * identifier. That case is covered instead by `contiguousLeak`, which works on the raw text.
 */
export function tokens(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.toLowerCase().matchAll(/[a-z0-9_]{3,}/g)) found.add(match[0]);
  return found;
}

/**
 * The longest run of `needle` that appears verbatim in `haystack`, or `""` if none reaches
 * `floor`. This is AC3's clause read literally — "a substring of the SQL it ran" — with a
 * floor so a coincidental short overlap is not reported as a leak. 12 characters is longer
 * than any single identifier in this schema and shorter than any two joined by a space, so a
 * hit means a fragment of the statement travelled rather than a word.
 */
export function contiguousLeak(haystack: string, needle: string, floor = 12): string {
  const hay = haystack.toLowerCase();
  const hint = needle.toLowerCase();
  /* A sliding window of exactly `floor`, not every substring of every length: any run of
     `floor` or more contains a window of exactly `floor`, so this finds the same set in
     O(needle) comparisons rather than O(needle × window). The corpus in `routes.test.ts` is
     thirteen statements joined, and the quadratic form took minutes on it. */
  for (let start = 0; start + floor <= hint.length; start++) {
    const slice = hint.slice(start, start + floor);
    /* A window that is mostly whitespace matches almost any prose, so it says nothing. */
    if (slice.replace(/\s+/g, "").length < 8) continue;
    if (hay.includes(slice)) return slice;
  }
  return "";
}

/**
 * The renderings a route, a log line or a spread can reach. Nothing here reads `cause`
 * directly: `cause` is where the driver error is SUPPOSED to live, non-enumerably, and the
 * clause is about what escapes without it.
 */
export function renderings(err: unknown): Record<string, string> {
  const asError = err as Error;
  return {
    message: typeof asError?.message === "string" ? asError.message : String(asError?.message),
    "String(err)": String(err),
    "JSON.stringify(err)": JSON.stringify(err) ?? "undefined",
    'JSON.stringify({ detail: err.message })': JSON.stringify({ detail: asError?.message }),
    "Object.keys(err)": JSON.stringify(Object.keys(err as object)),
  };
}

/* --------------------- the AC3 predicate --------------------- */

export interface LeakCheck {
  /** Every rendering that carried something from the statement, empty when clean. */
  leaks: string[];
  /** True when the deny set was empty, which makes a clean result meaningless. */
  vacuous: boolean;
  /** What the deny set was built from, quoted in a failure so a red is diagnosable. */
  sql: string;
  params: string;
}

/**
 * AC3, applied to one rejection: no rendering may contain a substring of the SQL the driver
 * ran, nor any bound parameter it carried.
 *
 * Both sides are DERIVED. The deny set is whatever the driver put in its own error — so a
 * seventh thing nobody enumerated is caught the moment the driver puts it there — and the
 * allow set is the caller's own identifiers plus the operation name, which is exactly what
 * D-13's whitelist admits.
 *
 * `vacuous` is not a detail. A deny set built from an error carrying no statement passes
 * every rendering, and a set that can only be empty is not a measurement.
 */
export interface Statement {
  sql: string;
  params: string;
}

/** What the driver ran, for a deny set. Read off the error rather than typed anywhere. */
export function statementOf(err: unknown): Statement {
  return { sql: sqlOf(err), params: boundParamsOf(err) };
}

/**
 * The deny set: every token of the statement and of its bound parameters that the caller did
 * not itself supply. Both sides derived, so a seventh thing nobody enumerated is caught the
 * moment the driver puts it in its own error.
 */
export function denySet(statement: Statement, allowed: readonly string[]): Set<string> {
  const allow = new Set<string>();
  for (const value of allowed) for (const token of tokens(value)) allow.add(token);
  const deny = new Set<string>();
  for (const token of tokens(statement.sql)) if (!allow.has(token)) deny.add(token);
  for (const token of tokens(statement.params)) if (!allow.has(token)) deny.add(token);
  return deny;
}

/**
 * AC3 applied to one string. Kept separate from the error form because a served response body
 * is a string with no `cause` to derive from, and folding the two would mean handing this
 * function an object carrying the driver error — whose own `JSON.stringify` would then report
 * the probe's scaffolding as a leak.
 */
export function checkTextForStatement(
  text: string,
  statement: Statement,
  allowed: readonly string[],
  subject: string,
): LeakCheck {
  const deny = denySet(statement, allowed);
  const leaks: string[] = [];
  const present = [...tokens(text)].filter((token) => deny.has(token)).sort();
  if (present.length > 0) {
    leaks.push(
      `${subject} carries ${present.length} token(s) from the statement: ${present.join(", ")}` +
        `\n    text: ${text.slice(0, 600)}`,
    );
  }
  if (statement.sql.length > 0) {
    const run = contiguousLeak(text, statement.sql);
    if (run !== "") {
      leaks.push(`${subject} carries a run of the statement: ${JSON.stringify(run)}`);
    }
  }
  return {
    leaks,
    vacuous: deny.size === 0,
    sql: statement.sql,
    params: statement.params,
  };
}

/**
 * AC3 applied to one rejection, across every rendering a route, a log line or a spread can
 * reach. The statement is read off the rejection's own `cause` chain — which is where AC1
 * requires the driver error to live — so the deny set for a given fault is that fault's.
 */
export function checkNoStatementLeak(
  err: unknown,
  allowed: readonly string[],
  subject: string,
): LeakCheck {
  const statement = statementOf(err);
  const leaks: string[] = [];
  for (const [name, text] of Object.entries(renderings(err))) {
    leaks.push(...checkTextForStatement(text, statement, allowed, `${subject} — ${name}`).leaks);
  }
  return {
    leaks,
    vacuous: denySet(statement, allowed).size === 0,
    sql: statement.sql,
    params: statement.params,
  };
}

/**
 * T-04, run at fixture time rather than trusted. A deny token that is a substring of a
 * caller-supplied identifier reds like a real leak, and the fix is not to delete the tell: it
 * is to prove the tell cannot over-match. Word-boundary tokenising already removes most of
 * that hazard; this asserts the rest, so a probe value that happens to embed a schema
 * identifier is a BROKEN TEST reported as one rather than a leak reported against correct code.
 */
export function assertTellsCannotOverMatch(err: unknown, supplied: readonly string[]): void {
  const sql = sqlOf(err);
  const statementTokens = tokens(sql);
  const collisions: string[] = [];
  for (const value of supplied) {
    for (const token of statementTokens) {
      if (value.toLowerCase().includes(token)) {
        collisions.push(`${JSON.stringify(value)} contains the statement token ${token}`);
      }
    }
  }
  expect(
    collisions,
    "A value this suite supplies embeds an identifier from the statement, so the leak sweep " +
      "could report a leak against a correct implementation. This is a defect in the FIXTURE " +
      "and not in the module: re-mint the probe identifier. T-04 is the same defect from the " +
      "other side, where a pid containing `23505` reddened a whole leak sweep.",
  ).toEqual([]);
}

/* --------------------- binding the published names --------------------- */

export async function bindReader(name: ReaderName): Promise<UnknownFn> {
  const mod = await loadRegistry();
  const value = requireFrom(mod, name, PUBLISHED_READERS[name]);
  if (typeof value !== "function") {
    throw new Error(
      `${REGISTRY} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${PUBLISHED_READERS[name]}`,
    );
  }
  return value as UnknownFn;
}

export async function bindT081(name: PublishedT081Name): Promise<UnknownFn> {
  const mod = await loadRegistry();
  const value = requireFrom(mod, name, PUBLISHED_T081[name]);
  if (typeof value !== "function") {
    throw new Error(
      `${REGISTRY} exports \`${name}\` as ${describe_(value)}; the contract publishes it as ` +
        `${PUBLISHED_T081[name]}`,
    );
  }
  return value as UnknownFn;
}

export async function registryStoreErrorClass(): Promise<new (...args: never[]) => Error> {
  const ctor = await bindT081("RegistryStoreError");
  if (!((ctor as { prototype?: unknown }).prototype instanceof Error)) {
    throw new Error(
      `${REGISTRY} exports \`RegistryStoreError\` but its prototype is not an Error.\n` +
        `  the contract publishes: ${PUBLISHED_T081.RegistryStoreError}\n` +
        `  tests/error-hygiene.test.ts builds its domain from ` +
        `\`prototype instanceof Error\`, so a class that fails this is invisible to the ` +
        `repo-wide hygiene guard as well as wrong here (AC5).`,
    );
  }
  return ctor as unknown as new (...args: never[]) => Error;
}
