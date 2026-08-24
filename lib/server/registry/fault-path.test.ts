/* ============================================================
   DarkPrint backend — T081's fault path, measured
   D-13: no rejection may carry the failed statement or its bound
   parameters. This file is the measurement, not the argument.

   ── Why a closed port and not a stub ──
   AC2 names it: point the client at a port nothing is listening
   on and drive each published reader. The rejection that arrives
   is a REAL `DrizzleQueryError` whose message opens with the full
   `select … from "bundle"`, produced by the shipped driver rather
   than by a fixture. A stub proves the wrapper catches what you
   hand it; a genuine driver fault proves it catches what the
   driver produces. It needs no live database and no gate slot,
   which is what makes it cheap enough to run on every gate.

   ── Why the deny set is DERIVED and the pin is EXACT ──
   Two instruments, and neither is a substring blacklist over
   hand-written table names. The pin is D-81-01's exact form,
   `` `${operation}: the registry store failed.` ``, written out
   here as a literal rather than imported from the module — a test
   that builds its expectation from the subject asserts the subject
   agrees with itself. It is kept ALONGSIDE the three invariances
   below rather than replacing them: a literal pins the string this
   implementation produces, and the invariances pin properties a
   literal cannot express. The second
   instrument derives its deny set from the driver error carried on
   `cause`, word by word: the oracle is the thing being agreed
   with, so a token nobody enumerated is caught the moment the
   driver puts it in its own message.

   Word by word rather than by substring, deliberately. `card` is
   an operation here and a substring of the column `card_version`,
   so `includes` would red a CORRECT implementation — T-04's shape,
   which this run has already paid for twice.

   ── Why every reader is checked for having REACHED the driver ──
   A rejection whose `cause` carries no statement satisfies the
   deny check trivially, so the check would pass over a probe that
   never got near Postgres. `card()` makes that concrete: an
   unparseable ref answers `undefined` before any query runs, so a
   probe using a ref that does not parse measures nothing. Every
   case below asserts the driver was reached BEFORE asserting that
   nothing from it escaped.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDbClient, type Db, type DbClient } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/server/auth";
import type { Actor } from "@/lib/server/policy";
import * as registry from "@/lib/server/registry";
import { RegistryStoreError, withRegistryErrors, withRegistryStore } from "@/lib/server/registry";

import { GET as getBlueprints } from "@/app/api/blueprints/route";
import { GET as getBlueprint } from "@/app/api/blueprints/[owner]/[slug]/route";
import { GET as getCards } from "@/app/api/cards/route";
import { GET as getCardPath } from "@/app/api/cards/[...ref]/route";
import { GET as getCardVersions } from "@/app/api/cards/[id]/versions/route";
import { GET as getCardUsers } from "@/app/api/cards/[id]/users/route";
import { GET as getDuplicates } from "@/app/api/cards/duplicates/route";
import { GET as getPhases } from "@/app/api/ontology/phases/route";
import { GET as getPhaseCards } from "@/app/api/ontology/phases/[phase]/cards/route";
import { GET as getTags } from "@/app/api/ontology/tags/route";
import { GET as getCategories } from "@/app/api/ontology/categories/route";

/**
 * Port 1 refuses immediately on this host and on every CI host: it is privileged, so
 * nothing an unprivileged run can start is listening there. `ECONNREFUSED` rather than a
 * timeout is what keeps the whole battery under a second. Credentials are `probe:probe`
 * so that if a future driver ever did put the connection string in a message, the value
 * it leaked would still be nobody's secret.
 */
const CLOSED_PORT_URL = "postgres://probe:probe@127.0.0.1:1/darkprint_closed_port";

/** `getSharedDbClient`'s cache slot, so the eleven routes can be pointed at the dead client. */
const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const ANON: Actor = { kind: "anonymous" };

/** A ref that PARSES, so `card()` reaches the store instead of short-circuiting. */
const PROBE_REF = "probe@1.0.0";

let client: DbClient;
let db: Db;
let previousShared: DbClient | undefined;

beforeAll(() => {
  client = createDbClient(CLOSED_PORT_URL);
  db = client.db;
  const withShared = globalThis as GlobalWithSharedClient;
  previousShared = withShared[SHARED_CLIENT_KEY];
  withShared[SHARED_CLIENT_KEY] = client;
});

afterAll(async () => {
  const withShared = globalThis as GlobalWithSharedClient;
  if (previousShared === undefined) delete withShared[SHARED_CLIENT_KEY];
  else withShared[SHARED_CLIENT_KEY] = previousShared;
  await client.close();
});

/* ------------------------------------------------------------------ */
/* The domain, built by construction from the barrel                   */
/* ------------------------------------------------------------------ */

/**
 * The thirteen published readers, each with the operation its rejection must name and the
 * arguments that get it to the driver. The names are written out rather than derived,
 * because the operation string is exactly what is under test: deriving it from the module
 * would make every pin below assert that the module agrees with itself.
 *
 * `invoke` passes `PROBE_REF` wherever a reader takes a string, which is a legal card ref,
 * a legal card id, a legal phase, a legal handle and a legal slug all at once — so one
 * value reaches the store through all thirteen and no reader is probed with an input that
 * short-circuits ahead of it.
 */
const READERS: readonly { operation: string; invoke: (db: Db) => Promise<unknown> }[] = [
  { operation: "blueprints", invoke: (d) => registry.blueprints(d, ANON) },
  { operation: "blueprint", invoke: (d) => registry.blueprint(d, ANON, PROBE_REF, PROBE_REF) },
  { operation: "cards", invoke: (d) => registry.cards(d, ANON) },
  { operation: "latestCards", invoke: (d) => registry.latestCards(d, ANON) },
  { operation: "versionsOf", invoke: (d) => registry.versionsOf(d, ANON, PROBE_REF) },
  { operation: "card", invoke: (d) => registry.card(d, ANON, PROBE_REF) },
  { operation: "usersOf", invoke: (d) => registry.usersOf(d, ANON, PROBE_REF) },
  { operation: "duplicates", invoke: (d) => registry.duplicates(d, ANON) },
  /* The three T132 readers (D-132-01/03). Probes carry non-empty keys because an empty
     list answers without a statement and never reaches the dead pool -- a green measuring
     nothing (D-132-05's own rule, applied here in the same commit as the merge). */
  { operation: "graphsOf", invoke: (d) => registry.graphsOf(d, ANON, [{ ownerHandle: PROBE_REF, slug: PROBE_REF }]) },
  { operation: "scoresFor", invoke: (d) => registry.scoresFor(d, ANON, [{ ownerHandle: PROBE_REF, slug: PROBE_REF }]) },
  { operation: "cardsOwnedBy", invoke: (d) => registry.cardsOwnedBy(d, ANON, PROBE_REF) },
  { operation: "phases", invoke: (d) => registry.phases(d, ANON) },
  { operation: "cardsByPhase", invoke: (d) => registry.cardsByPhase(d, ANON, PROBE_REF) },
  { operation: "tags", invoke: (d) => registry.tags(d, ANON) },
  { operation: "categories", invoke: (d) => registry.categories(d, ANON) },
  { operation: "scoresOf", invoke: (d) => registry.scoresOf(d, ANON, PROBE_REF, PROBE_REF) },
];

/**
 * The barrel exports that are NOT readers, declared here so the partition below is total.
 * This is an exemption list and it is written to fail CLOSED: a new barrel export lands in
 * neither set and reds, so nobody can add a reader without also adding its fault-path case,
 * and nobody can add a second published error class without this file objecting.
 */
const NON_READERS: readonly string[] = [
  "actorFrom",
  "withRegistryStore",
  "withRegistryErrors",
  "RegistryStoreError",
];

/** The eleven routes, with the params Next hands each one. */
/**
 * `operation` is the reader THIS route reaches first, so the `detail` assertion below is a
 * per-route check that the 500 came from its own reader rather than from any reader at all.
 * `/api/blueprints/[owner]/[slug]` calls two — `blueprint` then `scoresOf` — and names the
 * first, because the first one to fail is the only one a dead store lets it reach.
 */
const ROUTES: readonly { path: string; operation: string; drive: () => Promise<Response> }[] = [
  { path: "GET /api/blueprints", operation: "blueprints", drive: () => getBlueprints(req("/api/blueprints")) },
  {
    path: "GET /api/blueprints/[owner]/[slug]", operation: "blueprint",
    drive: () =>
      getBlueprint(req("/api/blueprints/probe/probe"), {
        params: Promise.resolve({ owner: "probe", slug: "probe" }),
      }),
  },
  { path: "GET /api/cards", operation: "cards", drive: () => getCards(req("/api/cards")) },
  {
    path: "GET /api/cards/[...ref]", operation: "card",
    drive: () =>
      getCardPath(req(`/api/cards/${PROBE_REF}`), { params: Promise.resolve({ ref: [PROBE_REF] }) }),
  },
  {
    path: "GET /api/cards/[id]/versions", operation: "versionsOf",
    drive: () =>
      getCardVersions(req("/api/cards/probe/versions"), { params: Promise.resolve({ id: "probe" }) }),
  },
  {
    path: "GET /api/cards/[id]/users", operation: "usersOf",
    drive: () =>
      getCardUsers(req("/api/cards/probe/users"), { params: Promise.resolve({ id: "probe" }) }),
  },
  { path: "GET /api/cards/duplicates", operation: "duplicates", drive: () => getDuplicates(req("/api/cards/duplicates")) },
  { path: "GET /api/ontology/phases", operation: "phases", drive: () => getPhases(req("/api/ontology/phases")) },
  {
    path: "GET /api/ontology/phases/[phase]/cards", operation: "cardsByPhase",
    drive: () =>
      getPhaseCards(req("/api/ontology/phases/probe/cards"), {
        params: Promise.resolve({ phase: "probe" }),
      }),
  },
  { path: "GET /api/ontology/tags", operation: "tags", drive: () => getTags(req("/api/ontology/tags")) },
  { path: "GET /api/ontology/categories", operation: "categories", drive: () => getCategories(req("/api/ontology/categories")) },
];

/** Every member but `instance`, which RFC 9457 §3.1 makes per-occurrence and which SHOULD differ. */
function withoutInstance(doc: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...doc };
  delete copy.instance;
  return copy;
}

function req(path: string): Request {
  return new Request(`https://darkprint.io${path}`);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Every message down the `cause` chain, which is where the driver's own text lives. */
function causeChainText(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = (err as { cause?: unknown }).cause;
  for (let depth = 0; current !== undefined && current !== null && depth < 16; depth += 1) {
    if (current instanceof Error) parts.push(current.message);
    else parts.push(String(current));
    current = (current as { cause?: unknown }).cause;
  }
  return parts.join("\n");
}

/**
 * Words, not substrings, and `_` is a word character so `card_version` is one token rather
 * than two. That is the whole reason this instrument does not over-match on the operation
 * `card`, and it is the distinction T-04 was charged for missing.
 */
function words(text: string): Set<string> {
  return new Set(text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []);
}

/** The four renderings a route or a log can reach. */
function renderings(err: Error): readonly string[] {
  return [err.message, String(err), JSON.stringify(err), JSON.stringify({ detail: err.message })];
}

async function rejectionOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (err) {
    return err;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* AC1 + AC3: the class, and what it may carry                         */
/* ------------------------------------------------------------------ */

describe("AC1: RegistryStoreError carries the operation and nothing else", () => {
  it("renders as {} and keeps its stack, at both arities", () => {
    /* `tests/error-hygiene.test.ts` constructs every published class at one argument and at
       two, because an `Error` `cause` is only installed when the option is passed and a
       constructor that assigns conditionally satisfies the clause under one shape and
       violates it under the other. The published signature requires `cause`, so reaching the
       one-argument shape needs a cast — the same cast that guard makes with `never[]`. */
    type AnyArity = new (...args: unknown[]) => Error;
    const construct = RegistryStoreError as unknown as AnyArity;
    const shapes: readonly unknown[][] = [
      ["probeOperation"],
      ["probeOperation", { code: "23505", constraint: "probe_constraint" }],
    ];
    for (const args of shapes) {
      const err = new construct(...args);
      expect(err).toBeInstanceOf(Error);
      expect(err.message, `with ${args.length} arg(s)`).toBe("probeOperation: the registry store failed.");
      expect(Object.keys(err), `with ${args.length} arg(s)`).toEqual([]);
      expect(JSON.stringify(err), `with ${args.length} arg(s)`).toBe("{}");
      expect(typeof err.stack, `with ${args.length} arg(s)`).toBe("string");
      expect((err.stack ?? "").length, `with ${args.length} arg(s)`).toBeGreaterThan(0);
      expect(err.name, `with ${args.length} arg(s)`).toBe("RegistryStoreError");
      expect(
        Object.prototype.propertyIsEnumerable.call(err, "name"),
        "`name` must not be an own enumerable property, or every rendering carries it",
      ).toBe(false);
    }
  });

  it("keeps the driver error on a non-enumerable `cause`, present even when it is undefined", () => {
    const driver = new Error('Failed query: select "id" from "bundle"');
    const sealed = new RegistryStoreError("probeOperation", driver);
    expect(sealed.cause).toBe(driver);
    expect(Object.prototype.propertyIsEnumerable.call(sealed, "cause")).toBe(false);

    /* Presence and value are different questions, and a rendering has no property for the
       filter to be present in — `getOwnPropertyDescriptor` is the only thing that separates
       "no cause was passed" from "a cause of undefined was passed". */
    const withoutCause = new RegistryStoreError("probeOperation", undefined);
    expect(Object.getOwnPropertyDescriptor(withoutCause, "cause")).not.toBeUndefined();
    expect(JSON.stringify(withoutCause)).toBe("{}");
  });
});

describe("withRegistryStore", () => {
  it("passes a value through untouched", async () => {
    await expect(withRegistryStore("probeOperation", async () => 41 + 1)).resolves.toBe(42);
  });

  it("seals a rejection as the operation it was given, with the original on `cause`", async () => {
    const raw = new Error('Failed query: select "id" from "bundle" -- params: ["secret"]');
    const err = await rejectionOf(() =>
      withRegistryStore("probeOperation", () => Promise.reject(raw)),
    );
    expect(err).toBeInstanceOf(RegistryStoreError);
    expect((err as Error).message).toBe("probeOperation: the registry store failed.");
    expect((err as Error).cause).toBe(raw);
  });

  it("does not re-wrap an already sealed fault, so the rendering keeps naming the reader that failed", async () => {
    /* A sanitizer applied twice does not sanitize twice, it RELABELS. Unreachable through
       the barrel today — no reader calls another — and observable here, which is the point:
       a defence nothing can exercise is a defence nobody can tell apart from an absent one. */
    const err = await rejectionOf(() =>
      withRegistryStore("outerOperation", () =>
        withRegistryStore("innerOperation", () => Promise.reject(new Error("driver"))),
      ),
    );
    expect((err as Error).message).toBe("innerOperation: the registry store failed.");
  });
});

/* ------------------------------------------------------------------ */
/* The premise: this module publishes no decision                      */
/* ------------------------------------------------------------------ */

describe("the barrel's fault surface is exactly one class, and its exports are partitioned", () => {
  it("publishes RegistryStoreError and no other error class", () => {
    const errorClasses = Object.entries(registry as Record<string, unknown>)
      .filter(
        ([, value]) =>
          typeof value === "function" && (value as { prototype?: unknown }).prototype instanceof Error,
      )
      .map(([name]) => name)
      .sort();
    expect(
      errorClasses,
      "This module's wrapper converts EVERY rejection because it was measured to author none " +
        "of its own — zero `throw` statements, every absent or empty answer a value. A second " +
        "published error class falsifies that premise: it is a refusal somebody wrote, and " +
        "whoever wrote it has to decide whether `withRegistryStore` should pass it through " +
        "unwrapped the way T050's `withStore` passes a decision. Do not silence this by widening " +
        "the list; decide the question it is asking.",
    ).toEqual(["RegistryStoreError"]);
  });

  it("every function the barrel exports is either a measured reader or a declared non-reader", () => {
    const exported = Object.entries(registry as Record<string, unknown>)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    const accounted = [...READERS.map((r) => r.operation), ...NON_READERS].sort();
    expect(
      exported,
      "A barrel export is in neither set. If it is a reader it owes a case in READERS, which " +
        "is what measures that its rejection is sealed; if it is not, it owes a line in " +
        "NON_READERS and a reason. Both set differences are asserted here rather than one, " +
        "because a domain built to avoid a maintained list still has one unless the exclusions " +
        "fall out of something the code carries.",
    ).toEqual(accounted);
  });
});

/* ------------------------------------------------------------------ */
/* AC2 + AC3: every published reader, against a closed port            */
/* ------------------------------------------------------------------ */

describe("AC2/AC3: every published reader seals what the driver throws", () => {
  it("thirteen readers, each rejecting with its own operation and nothing from the statement", async () => {
    expect(
      READERS.length,
      "An empty or shortened case list would make every assertion below pass over nothing. " +
        "Sixteen readers are published (13 + T132's three, D-132-01/03) from the barrel; the partition test above is what keeps " +
        "this number honest as the surface changes.",
    ).toBe(16);

    const leaked: string[] = [];
    const unreached: string[] = [];
    const mislabelled: string[] = [];

    for (const { operation, invoke } of READERS) {
      const err = await rejectionOf(() => invoke(db));

      if (!(err instanceof RegistryStoreError)) {
        mislabelled.push(
          `${operation}: rejected with ${err === undefined ? "nothing at all" : String(err)}, ` +
            "not a RegistryStoreError",
        );
        continue;
      }

      const driverText = causeChainText(err);
      /* THE ANTI-VACUITY CHECK, and it comes first. A rejection whose cause carries no
         statement satisfies the deny check trivially, so without this the green below would
         be evidence that the probe never reached Postgres rather than that nothing escaped. */
      if (!/\bselect\b/i.test(driverText)) {
        unreached.push(
          `${operation}: the cause chain carries no statement (${JSON.stringify(driverText.slice(0, 120))}), ` +
            "so this case measured nothing about what a driver error can leak",
        );
        continue;
      }

      /* D-81-01: the exact form, written out as a literal here rather than imported from
         the module — a test that builds its expectation from its subject asserts that the
         subject agrees with itself. */
      const expected = `${operation}: the registry store failed.`;
      if (err.message !== expected) {
        mislabelled.push(
          `${operation}: message is ${JSON.stringify(err.message)}, want ${JSON.stringify(expected)}`,
        );
      }

      /* Derived, not enumerated: the deny set is every word the driver put in its own
         message, minus the one word this module is allowed to say. */
      const denied = words(driverText);
      for (const own of words(expected)) denied.delete(own);
      for (const rendering of renderings(err)) {
        for (const word of words(rendering)) {
          if (denied.has(word)) {
            leaked.push(`${operation}: rendering ${JSON.stringify(rendering)} carries "${word}"`);
          }
        }
      }
    }

    expect(
      unreached,
      "A probe answered without reaching the driver, so its green says nothing about D-13. " +
        "The usual cause is an argument that short-circuits ahead of the store — `card()` with " +
        "a ref that does not parse is the one this module has.",
    ).toEqual([]);
    expect(
      mislabelled,
      "A published reader either did not seal its rejection or named the wrong operation. The " +
        "message must equal the reader's own exported name, exactly.",
    ).toEqual([]);
    expect(
      leaked,
      "A rendering of a sealed rejection carries a word the driver error carries — the failed " +
        "statement, a bound parameter, a SQLSTATE or a constraint name (D-13). Everything the " +
        "driver produced belongs on `cause`, which is non-enumerable and reaches no rendering.",
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* D-81-01's three invariances, kept ALONGSIDE the exact-match pin      */
/* ------------------------------------------------------------------ */

describe("D-81-01: the message varies with the operation and with nothing else", () => {
  /* These are not replaced by the exact-match pin above and are not redundant with it. A
     literal pins the string this implementation happens to produce; these pin PROPERTIES a
     literal cannot express — that no argument and no connection detail reaches the message.
     The third is what stops the other two being satisfied by a constant: a message of `""`
     for every reader is invariant under both and names nothing. */

  it("one reader, two different argument lists, byte-identical message", async () => {
    const withArgs = async (a: string, b: string): Promise<string> => {
      const err = await rejectionOf(() => registry.blueprint(db, ANON, a, b));
      expect(err).toBeInstanceOf(RegistryStoreError);
      return (err as Error).message;
    };
    /* Deliberately different in length, alphabet and shape: if any of them reached the
       message, no two of these three could agree. */
    const first = await withArgs("probe", "probe");
    const second = await withArgs("a-very-long-owner-handle", "another-slug-entirely");
    const third = await withArgs("Ω", "1");
    expect(second, "an argument reached the message").toBe(first);
    expect(third, "an argument reached the message").toBe(first);
  });

  it("two unreachable servers differing in user, password, port and database, byte-identical message", async () => {
    /* The stronger of the two, and the one a fixed literal cannot fake: every field a
       connection string carries is different between these clients, so a message carrying
       ANY driver-derived value would differ. Both ports are privileged, so nothing an
       unprivileged process can start is listening on either and both refuse immediately. */
    const other = createDbClient("postgres://someone-else:another-secret@127.0.0.1:2/a_different_database");
    try {
      const here = await rejectionOf(() => registry.cards(db, ANON));
      const there = await rejectionOf(() => registry.cards(other.db, ANON));
      expect(here).toBeInstanceOf(RegistryStoreError);
      expect(there).toBeInstanceOf(RegistryStoreError);

      /* Anti-vacuity, first: if the two drivers produced the same text, the equality below
         would hold for a reason that has nothing to do with the message being sealed. */
      const hereCause = causeChainText(here);
      const thereCause = causeChainText(there);
      expect(/\bselect\b/i.test(hereCause) && /\bselect\b/i.test(thereCause)).toBe(true);
      expect(
        thereCause,
        "the two drivers produced identical text, so the equality below discriminates nothing",
      ).not.toBe(hereCause);

      expect((there as Error).message).toBe((here as Error).message);
    } finally {
      await other.close();
    }
  });

  it("the thirteen readers' messages are pairwise distinct", async () => {
    /* Without this, a constant string satisfies both invariances above perfectly and names
       nothing — which is the value-versus-presence failure at the level of the whole set
       rather than of one field. */
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const { operation, invoke } of READERS) {
      const err = await rejectionOf(() => invoke(db));
      expect(err, `${operation} did not reject`).toBeInstanceOf(RegistryStoreError);
      const message = (err as Error).message;
      const already = seen.get(message);
      if (already !== undefined) collisions.push(`${already} and ${operation} both say ${JSON.stringify(message)}`);
      seen.set(message, operation);
    }
    expect(collisions, "two readers render identically, so a rendering names no operation").toEqual([]);
    expect(seen.size, "the case list shrank").toBe(READERS.length);
  });
});

/* ------------------------------------------------------------------ */
/* AC4: all eleven routes, through the envelope                        */
/* ------------------------------------------------------------------ */

describe("AC4: a store fault answers problem+json 500 on every registry route", () => {
  it("eleven routes, each store-failed, none carrying the statement", async () => {
    expect(
      ROUTES.length,
      "Eleven routes import this barrel. A shortened list would make the assertions below pass " +
        "over the routes that were dropped.",
    ).toBe(11);

    /* The deny set for the route half, taken from a reader's real rejection rather than
       written out — same oracle, so the two halves cannot disagree about what the driver
       said. Asserted non-trivial before it is used. */
    const sample = await rejectionOf(() => registry.blueprints(db, ANON));
    const driverText = causeChainText(sample);
    expect(
      /\bselect\b/i.test(driverText),
      "The sample rejection carries no statement, so the deny set below is empty and every " +
        "route assertion would pass vacuously.",
    ).toBe(true);
    /* D-81-02 makes `detail` the instance's own message, so the admissible words are
       subtracted from the deny set before it is used — otherwise the check would red on the
       module's own published wording. Subtracted rather than skipped, so every OTHER word the
       driver produced is still denied. */
    const denied = words(driverText);
    for (const own of words("probe: the registry store failed.")) denied.delete(own);
    for (const { operation } of READERS) denied.delete(operation);

    const wrong: string[] = [];
    const leaked: string[] = [];

    for (const { path, operation, drive } of ROUTES) {
      let response: Response;
      try {
        response = await drive();
      } catch (err) {
        wrong.push(`${path}: threw ${String(err)} instead of answering`);
        continue;
      }

      const body = await response.text();
      if (response.status !== 500) wrong.push(`${path}: status ${response.status}`);
      if (response.headers.get("content-type") !== "application/problem+json") {
        wrong.push(`${path}: content-type ${String(response.headers.get("content-type"))}`);
      }

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(body) as Record<string, unknown>;
      } catch {
        wrong.push(`${path}: body is not JSON`);
      }
      if (parsed.type !== "https://darkprint.io/problems/store-failed") {
        wrong.push(`${path}: type ${JSON.stringify(parsed.type)}`);
      }
      /* D-81-02: `detail` is the instance's own message, byte for byte. Written out as a
         literal rather than read off the error — and per route, so this also pins WHICH
         reader produced the 500 rather than only that some reader did. */
      const expected = `${operation}: the registry store failed.`;
      if (parsed.detail !== expected) {
        wrong.push(`${path}: detail ${JSON.stringify(parsed.detail)}, want ${JSON.stringify(expected)}`);
      }
      if (parsed.title !== "Store failed") {
        wrong.push(`${path}: title ${JSON.stringify(parsed.title)}`);
      }

      for (const word of words(body)) {
        if (denied.has(word)) leaked.push(`${path}: body carries "${word}"`);
      }
    }

    expect(
      wrong,
      "A registry route did not answer B-03's envelope for a store fault. D-50-18: a " +
        "recognised, sanitized fault answers `problem+json` — throwing gives a 500 too, but " +
        "Next's own generic one, outside the envelope every other failure on these routes uses " +
        "and unobservable to anything driving the handler directly, which is exactly how this " +
        "defect survived a merge and a tag.",
    ).toEqual([]);
    expect(
      leaked,
      "A route's response body carries a word from the driver error. `type`, `title` and " +
        "`detail` are each pinned above, so the shape this catches and they cannot is an RFC 9457 " +
        "§3.2 EXTENSION member — a `sqlstate` or a `constraint` added beside them. The driver " +
        "error rides on `cause`, which is non-enumerable and reaches no rendering; anything of it " +
        "in this body is D-13 on the wire.",
    ).toEqual([]);
  });

  it("D-81-02: one route, two different path segments, one problem document apart from `instance`", async () => {
    /* The weaker of D-81-02's two assertions and it fails differently from the byte-equality
       pin, which is why both are kept. A `detail` interpolating the handle, the slug, the id
       or the phase the caller sent diverges HERE — and that is a leak of caller data into a
       rendering, which the equality pin catches too but from the other side. Two instruments,
       different failure modes, neither complete. */
    const drive = async (owner: string, slug: string): Promise<Record<string, unknown>> => {
      const response = await getBlueprint(req(`/api/blueprints/${owner}/${slug}`), {
        params: Promise.resolve({ owner, slug }),
      });
      expect(response.status).toBe(500);
      return (await response.json()) as Record<string, unknown>;
    };
    const first = await drive("probe", "probe");
    const second = await drive("a-completely-different-owner", "and-another-slug");

    /* `instance` is RFC 9457 §3.1 — it identifies the occurrence and SHOULD differ, so it is
       removed rather than asserted equal. Anti-vacuity: check it actually differed, or the
       comparison below is over two identical requests. */
    expect(second.instance, "the two requests reached the same path").not.toBe(first.instance);
    expect(
      withoutInstance(second),
      "a path segment the caller supplied reached the problem document",
    ).toEqual(withoutInstance(first));
  });

  it("rethrows what it does not recognise, rather than dressing a bug as a store failure", async () => {
    const bug = new TypeError("probe: not a store fault");
    await expect(
      withRegistryErrors(req("/api/cards"), () => Promise.reject(bug)),
    ).rejects.toBe(bug);
  });

  it("rethrows a REAL fault raised outside a reader, driven through a real route", async () => {
    /* The assertion above hands the wrapper a fault it constructed, which proves the arm
       works on what you give it and not that anything reaches it. A rethrow arm with no
       witness is this run's most-charged shape: a guard nothing can reach.

       This is the reachable path, and it is reachable without a database: `actorFrom` calls
       `getSession`, which resolves `SESSION_SECRET` through a default parameter evaluated
       before the body can return early (`session.ts:101`), so a request carrying a session
       cookie on a host with the secret unset throws from inside the handler. It is not a
       `RegistryStoreError` — no store was involved — so it must leave the wrapper unchanged
       and become Next's own generic 500, rather than being reported as a store failure. */
    const saved = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      const withCookie = new Request("https://darkprint.io/api/cards", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=probe.signature` },
      });
      const err = await rejectionOf(() => getCards(withCookie));
      expect(err, "the handler answered instead of throwing").toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(RegistryStoreError);
      expect((err as Error).message).toBe("SESSION_SECRET is not set");
    } finally {
      if (saved === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = saved;
    }
  });
});
