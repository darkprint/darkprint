/* ============================================================
   T081 — the two wrappers, driven directly

   `withRegistryStore` and `withRegistryErrors` are published
   functions, so they are reachable without going through a reader
   or a route. Driving them here separates the MECHANISM from its
   COVERAGE: readers.test.ts and routes.test.ts measure that every
   site is wrapped, and a mutation removing one site reds only its
   own cases there. A mutation to the wrapper itself reds this file
   as well as all of those, which is what tells a mechanism apart
   from the sites it serves — disjointness is the right property
   between peers and the wrong one between a mechanism and what it
   carries.

   ── the fault is a real one ──
   Every fault below is a genuine `DrizzleQueryError` from a real
   query against a closed port, not a hand-built object. A wrapper
   proved against an error somebody constructed proves that the
   assertion works, not that the wrapper catches what the driver
   produces. This repository has the instance: a leak suite of four
   error classes by five renderings, every error built by hand, and
   breaking the store's wrap reddened nothing.

   ── one deliberate non-assertion, named rather than left silent ──
   Nothing here asserts what `withRegistryStore` does when it is
   handed a fault that is ALREADY a `RegistryStoreError`, nor what
   `withRegistryErrors` does with a class it does not recognise.
   The block's own OPEN paragraph says whether this read model has
   any decisions at all is not established and that inventing an
   `isDecision` shape would be a ruling implemented as narrowly as
   its worked example running the other way. A blind author that
   picks one of two readings has removed the finding rather than
   made it. Both are in the handback as gaps.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { schema } from "@/lib/db";

import {
  PROBLEM_MEDIA_TYPE,
  STORE_FAILED_TYPE,
  bindT081,
  checkNoStatementLeak,
  checkTextForStatement,
  deadDb,
  registryStoreErrorClass,
  rejects,
  sqlOf,
  statementOf,
  storeFailureMessage,
} from "./contract";

/** A genuine `DrizzleQueryError`: a real statement, a real driver, a server that is not there. */
async function driverFault(): Promise<unknown> {
  const dead = deadDb();
  try {
    const db = dead.client.db;
    return await rejects(
      () => db.select().from(schema.bundle),
      "db.select().from(bundle) against a closed port",
    );
  } finally {
    await dead.close();
  }
}

describe("withRegistryStore", () => {
  it("passes a resolved value through unchanged", async () => {
    const withRegistryStore = await bindT081("withRegistryStore");
    const value = { probe: "t081-passthrough" };
    const answered = await withRegistryStore("probeOperation", async () => value);
    expect(
      answered,
      "The block publishes `withRegistryStore<T>(operation, work): Promise<T>`. A wrapper that " +
        "alters the success path is doing something the signature does not say it does, and " +
        "thirteen readers would return it.",
    ).toBe(value);
  });

  it("wraps a driver fault as RegistryStoreError naming the operation", async () => {
    const withRegistryStore = await bindT081("withRegistryStore");
    const ctor = await registryStoreErrorClass();
    const raw = await driverFault();

    const err = await rejects(
      () =>
        withRegistryStore("probeOperation", async () => {
          throw raw;
        }),
      'withRegistryStore("probeOperation", …) over a driver fault',
    );

    expect(
      err instanceof ctor,
      `withRegistryStore let the driver error through as ${
        err instanceof Error ? (err.constructor?.name ?? "an Error") : typeof err
      }. This is the mechanism AC2 quantifies over: a reader that calls it is only sealed if ` +
        `it is.\n  message: ${JSON.stringify((err as Error)?.message)}`,
    ).toBe(true);

    expect(
      (err as Error).message,
      "the block publishes `message` as the operation alone, so the operation the caller named " +
        "has to be the one the rendering names",
    ).toContain("probeOperation");

    expect(
      Object.getOwnPropertyDescriptor(err as object, "cause")?.value,
      "AC1 requires the driver error on `cause`. Read through a descriptor rather than through " +
        "`err.cause`, because a dropped cause and a cause passed as `undefined` are different " +
        "facts that render identically: as nothing.",
    ).toBe(raw);
  }, 30_000);

  it("its rejection carries no substring of the statement that failed", async () => {
    const withRegistryStore = await bindT081("withRegistryStore");
    const raw = await driverFault();

    expect(
      sqlOf(raw),
      "The driver error this test hands the wrapper carries no statement, so the check below " +
        "has an empty deny set and passes over nothing. A finding about the probe, not the " +
        "module.",
    ).not.toBe("");

    const err = await rejects(
      () =>
        withRegistryStore("probeOperation", async () => {
          throw raw;
        }),
      'withRegistryStore("probeOperation", …) over a driver fault',
    );

    /* `probeOperation` is the caller's own identifier here, in the same sense a handle or a
       slug is at a reader: the allow set is what the caller supplied. */
    const check = checkNoStatementLeak(err, ["probeOperation"], "withRegistryStore");
    expect(check.vacuous, "the deny set came back empty against an error carrying a statement").toBe(
      false,
    );
    expect(
      check.leaks,
      "D-13 at the mechanism. Whatever leaks here leaks from all thirteen readers at once, " +
        "which is why the wrapper is measured on its own as well as through them.",
    ).toEqual([]);
  }, 30_000);
});

describe("withRegistryErrors", () => {
  const request = (): Request => new Request("https://darkprint.test/api/cards");

  it("passes a Response through unchanged", async () => {
    const withRegistryErrors = await bindT081("withRegistryErrors");
    const answered = (await withRegistryErrors(request(), async () =>
      Response.json({ cards: [] }),
    )) as Response;

    expect(answered.status).toBe(200);
    expect(
      await answered.json(),
      "The block publishes `withRegistryErrors(request, work): Promise<Response>`. Eleven " +
        "routes serve their 200 through it, so a wrapper that touches the success path changes " +
        "every one of them.",
    ).toEqual({ cards: [] });
  });

  it("answers problem+json 500 store-failed for a RegistryStoreError", async () => {
    const withRegistryErrors = await bindT081("withRegistryErrors");
    const ctor = await registryStoreErrorClass();
    const raw = await driverFault();
    const storeError = new (ctor as unknown as new (op: string, cause: unknown) => Error)(
      "probeOperation",
      raw,
    );

    const answered = (await withRegistryErrors(request(), async () => {
      throw storeError;
    })) as Response;

    expect(
      answered instanceof Response,
      "AC4: a store fault ANSWERS. D-50-18 ruled that a recognised, sanitized fault answers " +
        "`problem+json` and does not re-throw — throwing produces a 500 too, but Next's own " +
        "generic one, outside the envelope every other failure on the route uses.",
    ).toBe(true);
    expect(answered.status).toBe(500);
    expect(answered.headers.get("content-type") ?? "").toContain(PROBLEM_MEDIA_TYPE);

    const body = (await answered.json()) as Record<string, unknown>;
    expect(
      body.type,
      "AC4 publishes this URI exactly; it is what a caller branches on.",
    ).toBe(STORE_FAILED_TYPE);
    expect(body.instance, "D-02: `instance` is the request path").toBe("/api/cards");

    expect(
      body.detail,
      "D-81-02: `detail` is the instance's own `message`, byte for byte. This is D-50-08's " +
        "\"passes through unaltered, so each message keeps one author\" at the envelope, and it " +
        "is the assertion that fails a wrapper which re-renders, substitutes a generic string, " +
        "or re-wraps the fault into a second class on the way out. It is safe to assert only " +
        "because the message itself is sealed — a class whose own message leaked a bound " +
        "parameter would satisfy this perfectly, which is what the leak sweeps cover " +
        "separately.",
    ).toBe(storeError.message);
    expect(
      body.detail,
      "and the message it passes through is D-81-01's ruled form",
    ).toBe(storeFailureMessage("probeOperation"));
  }, 30_000);

  it("the served document carries no substring of the statement that failed", async () => {
    const withRegistryErrors = await bindT081("withRegistryErrors");
    const ctor = await registryStoreErrorClass();
    const raw = await driverFault();
    const storeError = new (ctor as unknown as new (op: string, cause: unknown) => Error)(
      "probeOperation",
      raw,
    );

    const answered = (await withRegistryErrors(request(), async () => {
      throw storeError;
    })) as Response;
    const text = await answered.text();

    /* The deny set is derived from the statement on the fault the wrapper was handed, so this
       measures the ENVELOPE half of D-13 rather than the message half: a wrapper that renders
       `String(err.cause)` into `detail` produces a well-formed problem document carrying the
       whole query.

       The allow set is the caller's own operation name and the request path's segments, plus —
       AMENDED at T280 — "title" and only "title" of the problem document's member names. The
       earlier stance ("a collision would be a fixture question to answer, not a leak to
       permit") held while a collision could only arrive through a probe's own choices;
       migration 0007 gave `bundle` a `title` column, so every real registry statement now
       carries the envelope's own member name and no fixture can decline it. Admitting it stays
       sound for the reason the routes suite states: the sibling describe pins each member to
       its fixed value, so the only "title" a document may carry is the pinned literal, and a
       wrapper rendering `String(err.cause)` into `detail` still reds on every other statement
       token (falsified: a probe rendering the statement into `detail` reds this cell on
       fifteen tokens). The other four member names stay DENIED — `status` and `detail` are
       live column names elsewhere in the schema, and pre-forgiving them would blind the scan
       the day a registry statement reaches those tables. */
    const check = checkTextForStatement(
      text,
      statementOf(raw),
      ["probeOperation", "api", "cards", "title"],
      "withRegistryErrors' served document",
    );
    expect(check.vacuous, "the deny set came back empty against an error carrying a statement").toBe(
      false,
    );
    expect(
      check.leaks,
      `The problem document served for a store fault carries something from the statement.\n` +
        `  body: ${text.slice(0, 600)}`,
    ).toEqual([]);
  }, 30_000);
});
