import { describe, expect, it } from "vitest";

import { DuplicateOntologyVersionError, OntologyStoreError } from "./errors";

/* ============================================================
   T010 paid two rounds for a `DrizzleQueryError` reaching a
   caller: it opens with the whole INSERT and every bound
   parameter, which for this module is the caller's entire
   vocabulary. These assertions are the shape that prevents it.
   ============================================================ */

/** What a driver error looks like from the outside, minus nothing that matters here. */
const DRIVER_ERROR = Object.assign(new Error("insert into ontology_term ... $1 $2 $3"), {
  code: "23505",
  constraint: "ontology_version_version_key",
  query: "insert into ontology_term (...) values ($1, $2, $3)",
  parameters: ["the caller's whole vocabulary"],
});

describe("T030 no rejection carries the statement or its parameters", () => {
  it("has own properties of exactly message and cause", () => {
    const err = new DuplicateOntologyVersionError("Version `1.0.0` is already published.", DRIVER_ERROR);
    expect(Object.getOwnPropertyNames(err).sort()).toEqual(["cause", "message"]);
  });

  it("keeps the own-property set stable when there is no cause", () => {
    expect(Object.getOwnPropertyNames(new OntologyStoreError("no cause")).sort()).toEqual([
      "cause",
      "message",
    ]);
  });

  it("cannot be reached by JSON.stringify, because cause is non-enumerable", () => {
    const err = new DuplicateOntologyVersionError("Version `1.0.0` is already published.", DRIVER_ERROR);
    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
    expect(JSON.stringify({ err })).not.toContain("$1");
    expect(Object.getOwnPropertyDescriptor(err, "cause")?.enumerable).toBe(false);
  });

  it("states only the caller's own identifiers in its message", () => {
    const err = new DuplicateOntologyVersionError("Version `1.0.0` is already published.", DRIVER_ERROR);
    expect(err.message).toContain("1.0.0");
    for (const leak of ["insert into", "$1", "23505", "vocabulary"]) {
      expect(err.message.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  it("keeps the driver error reachable at cause for debugging", () => {
    const err = new DuplicateOntologyVersionError("Version `1.0.0` is already published.", DRIVER_ERROR);
    expect(err.cause).toBe(DRIVER_ERROR);
    expect((err.cause as Error).stack).toBeDefined();
  });

  it("names itself through the prototype, so name is not an own property", () => {
    const err = new DuplicateOntologyVersionError("x");
    expect(err.name).toBe("DuplicateOntologyVersionError");
    expect(Object.hasOwn(err, "name")).toBe(false);
    expect(err).toBeInstanceOf(OntologyStoreError);
  });
});
