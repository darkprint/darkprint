import { describe, expect, it } from "vitest";

import type { Db } from "@/lib/db";

import {
  DuplicateOntologyVersionError,
  InvalidVocabularyError,
  MalformedContentError,
  OntologyStoreError,
} from "./errors";
import { addOntologyVersion } from "./store";

/* ============================================================
   T010 paid two rounds for a `DrizzleQueryError` reaching a
   caller: it opens with the whole INSERT and every bound
   parameter, which for this module is the caller's entire
   vocabulary.

   Written against the 2026-08-14 amendment, which replaced "own
   properties exactly [message, cause]" — unsatisfiable, since
   `stack` is an own property of every V8 Error — with what that
   clause was always reaching for: nothing leaks through any
   rendering a route or a log might use, and `stack` is retained.
   ============================================================ */

/** What a driver error looks like from the outside. */
const DRIVER_ERROR = Object.assign(
  new Error('insert into "ontology_term" ("term_id", "body") values ($1, $2)'),
  {
    code: "23505",
    constraint: "ontology_version_version_key",
    detail: "Key (version)=(1.0.0) already exists.",
    table: "ontology_version",
    schema: "public",
    severity: "ERROR",
    routine: "_bt_check_unique",
    query: 'insert into "ontology_term" ("term_id", "body") values ($1, $2)',
    parameters: ["agent", '{"label":"A privileged internal label"}'],
  },
);

/** Every way a route or a logger might turn an error into text. */
function renderings(err: Error): string[] {
  return [
    err.message,
    String(err),
    JSON.stringify(err),
    JSON.stringify({ detail: err.message }),
    JSON.stringify(Object.getOwnPropertyNames(err)),
  ];
}

/** The five classes the amendment names, as they would appear in this module. */
const LEAKS: [string, string][] = [
  ["the SQL statement", "insert into"],
  ["a bound parameter", "A privileged internal label"],
  ["the caller's content", "privileged"],
  ["a SQLSTATE", "23505"],
  ["a `pg` internal", "_bt_check_unique"],
];

const EVERY_ERROR: [string, Error][] = [
  ["OntologyStoreError", new OntologyStoreError("Ontology version `1.0.0` could not be published.", DRIVER_ERROR)],
  ["DuplicateOntologyVersionError", new DuplicateOntologyVersionError("Ontology version `1.0.0` is already published.", DRIVER_ERROR)],
  ["InvalidVocabularyError", new InvalidVocabularyError("Ontology version `1.0.0` declares the same term id twice.", DRIVER_ERROR)],
  ["MalformedContentError", new MalformedContentError("Ontology version `1.0.0` holds a unpaired-surrogate at `[1].label`.")],
];

describe("T030 no rendering carries the statement, a parameter, content, a SQLSTATE or a pg internal", () => {
  for (const [name, err] of EVERY_ERROR) {
    for (const [what, needle] of LEAKS) {
      it(`${name} leaks ${what} through no rendering`, () => {
        for (const rendered of renderings(err)) {
          expect(rendered.toLowerCase(), `leaked through: ${rendered.slice(0, 120)}`).not.toContain(
            needle.toLowerCase(),
          );
        }
      });
    }
  }
});

describe("T030 the error shape the amendment specifies", () => {
  const err = new DuplicateOntologyVersionError(
    "Ontology version `1.0.0` is already published.",
    DRIVER_ERROR,
  );

  it("enumerates to nothing: Object.keys empty, JSON.stringify exactly {}", () => {
    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
  });

  it("carries cause, and cause is non-enumerable by propertyIsEnumerable, not by inference", () => {
    expect(err.cause).toBe(DRIVER_ERROR);
    expect(err.propertyIsEnumerable("cause")).toBe(false);
  });

  it("retains stack, so a real failure keeps its trace", () => {
    expect(typeof err.stack).toBe("string");
    expect(err.stack).toContain("DuplicateOntologyVersionError");
  });

  it("keeps the driver error's own stack reachable for the log", () => {
    expect((err.cause as Error).stack).toBeDefined();
  });

  it("names itself through the prototype, so name is not an own property", () => {
    expect(err.name).toBe("DuplicateOntologyVersionError");
    expect(Object.hasOwn(err, "name")).toBe(false);
    expect(err).toBeInstanceOf(OntologyStoreError);
  });

  it("still enumerates to nothing when there is no cause at all", () => {
    const bare = new OntologyStoreError("no cause");
    expect(Object.keys(bare)).toEqual([]);
    expect(JSON.stringify(bare)).toBe("{}");
    expect(bare.propertyIsEnumerable("cause")).toBe(false);
  });

  it("renders the caller's own identifier, which is deliberate", () => {
    // The amendment forbids the caller's *content*; an identifier is what makes the failure
    // actionable, and the vocabulary's terms and labels never appear in any rendering above.
    expect(err.message).toContain("1.0.0");
  });
});

/* ============================================================
   The assertions above build errors by hand, so they cannot see
   whether the *store* actually wraps what the driver throws — and
   that is the path a caller reaches in production. Falsifying the
   wrap (rethrowing `cause` unwrapped from `addOntologyVersion`)
   reddened nothing until this block existed, which is a coverage
   gap the falsification found rather than confirmed.

   No database: the failure being tested is the catch path, so a
   stub whose transaction rejects reaches it exactly.
   ============================================================ */

/**
 * `addOntologyVersion` reads before it writes — the existence check that AC6's ruled ordering
 * put in front of the bump check — so the stub has to answer `select()` as well as
 * `transaction()`. It answers "no such version and no predecessor", which is the shape that
 * reaches the write with nothing else refusing first.
 */
function dbWhoseTransactionRejects(rejection: unknown): Db {
  // Every builder method returns the same thenable, which resolves to no rows: the store reads
  // before it writes (the existence check AC6's ruled ordering put ahead of the bump check),
  // and "no such version, no predecessor" is the shape that reaches the write with nothing
  // else refusing first. A chain rather than a fixed shape so a later `.where`/`.orderBy`
  // added to a read cannot silently break this into a TypeError again.
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit", "orderBy", "select"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve);
  return {
    select: () => chain,
    transaction: () => Promise.reject(rejection),
  } as unknown as Db;
}

const ONE_GOOD_TERM = [
  { id: "agent", kind: "node-type" as const, label: "Agent", description: "", since: "0.1.0" },
];

describe("T030 the store wraps what the driver throws", () => {
  it("turns a unique violation on the version index into a typed conflict", async () => {
    const db = dbWhoseTransactionRejects(DRIVER_ERROR);
    await expect(
      addOntologyVersion(db, { version: "1.0.0", terms: ONE_GOOD_TERM }),
    ).rejects.toBeInstanceOf(DuplicateOntologyVersionError);
  });

  it("leaks nothing through any rendering of what the store actually threw", async () => {
    const db = dbWhoseTransactionRejects(DRIVER_ERROR);
    const thrown = await addOntologyVersion(db, { version: "1.0.0", terms: ONE_GOOD_TERM }).then(
      () => undefined,
      (err: unknown) => err as Error,
    );
    expect(thrown).toBeInstanceOf(OntologyStoreError);
    for (const [what, needle] of LEAKS) {
      for (const rendered of renderings(thrown as Error)) {
        expect(rendered.toLowerCase(), `${what} leaked: ${rendered.slice(0, 120)}`).not.toContain(
          needle.toLowerCase(),
        );
      }
    }
    expect((thrown as Error).cause).toBe(DRIVER_ERROR);
    expect((thrown as Error).propertyIsEnumerable("cause")).toBe(false);
  });

  it("wraps an unrecognised driver failure rather than passing it through", async () => {
    const other = Object.assign(new Error("connection terminated unexpectedly"), {
      code: "57P01",
      query: "insert into ontology_version ...",
    });
    const db = dbWhoseTransactionRejects(other);
    const thrown = await addOntologyVersion(db, { version: "2.0.0", terms: ONE_GOOD_TERM }).then(
      () => undefined,
      (err: unknown) => err as Error,
    );
    expect(thrown).toBeInstanceOf(OntologyStoreError);
    expect(thrown).not.toBe(other);
    for (const rendered of renderings(thrown as Error)) {
      expect(rendered).not.toContain("57P01");
      expect(rendered.toLowerCase()).not.toContain("insert into");
    }
  });
});
