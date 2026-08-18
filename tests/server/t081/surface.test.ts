/* ============================================================
   T081 AC1 and AC5 — the class, and the guard that measures it

   AC1: `RegistryStoreError` is exported from `@/lib/server/registry`,
   sealed to D-13's four-part clause, carrying THE OPERATION ALONE —
   no statement, no bound parameter, no SQLSTATE — with the driver
   error on `cause`.

   AC5: `tests/error-hygiene.test.ts` measures the new class at both
   arities. It could measure nothing before, because the barrel
   exported no error class at all and that guard builds its domain
   from `prototype instanceof Error` — an absent class leaks by not
   existing. What is asserted here is that the class enters that
   domain and satisfies the clause under both of the guard's own
   call shapes, so a green there is about this class rather than
   about an empty set.

   ── the pin, and why it is not a literal ──
   The block says `message` is "the OPERATION alone" and also that
   the wrapper mirrors T050's, whose form is
   `changeHandle: the account store failed.` Those are two different
   strings and the block does not choose. Inventing one here would
   red every implementation that phrased it the other way, which is
   a candidate list in a new hat. So the property is asserted in the
   form that needs no wording: `message` is a FUNCTION OF THE
   OPERATION AND OF NOTHING ELSE — invariant under the cause,
   distinct across operations, and containing the operation. Those
   are exact equalities between measured values and cannot go
   vacuous the way a substring scan does. The gap is reported.

   Nothing in this file opens a socket except the positive control,
   which points at a closed port. No database, no gate slot.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { schema } from "@/lib/db";

import {
  PUBLISHED_T081,
  READER_NAMES,
  NON_READER_EXPORTS,
  REGISTRY,
  T081_NAMES,
  bindT081,
  checkNoStatementLeak,
  deadDb,
  loadRegistry,
  registryStoreErrorClass,
  rejects,
  sqlOf,
  storeFailureMessage,
  tokens,
} from "./contract";

/**
 * The two call shapes `tests/error-hygiene.test.ts` uses, copied verbatim rather than
 * approximated: AC5 is a claim about what THAT guard measures, so a claim made against
 * different arguments would be about something else.
 */
const HYGIENE_SHAPES: readonly (readonly unknown[])[] = [
  ["probe detail"],
  ["probe detail", { code: "23505", constraint: "probe_constraint" }],
];

describe("AC1 — RegistryStoreError is published and sealed", () => {
  it("is exported from the barrel as an Error subclass", async () => {
    const ctor = await registryStoreErrorClass();
    expect(typeof ctor).toBe("function");
  });

  it("carries the driver error on `cause`, non-enumerably", async () => {
    const ctor = await registryStoreErrorClass();
    const driver = new Error('Failed query: select "id" from "bundle"');
    const err = new (ctor as unknown as new (op: string, cause: unknown) => Error)(
      "probeOperation",
      driver,
    );

    /* `Object.getOwnPropertyDescriptor`, not `err.cause !== undefined`. Presence and value are
       separate questions, and a class that never passes a cause renders identically to one that
       passes `undefined` — the whitelist-over-renderings gap this repository already recorded. */
    const descriptor = Object.getOwnPropertyDescriptor(err, "cause");
    expect(
      descriptor,
      "AC1 requires the driver error on `cause`. No own `cause` descriptor means the class " +
        "discarded it, and the diagnostic chain is gone with it — a rendering-based assertion " +
        "cannot see that, because a dropped cause and a cause never passed render identically: " +
        "as nothing.",
    ).toBeDefined();
    expect(descriptor?.value, "`cause` must be the driver error itself, not a copy of it").toBe(
      driver,
    );
    expect(
      err.propertyIsEnumerable("cause"),
      "an enumerable `cause` puts the whole driver error into `JSON.stringify(err)`, which is " +
        "D-13's leak with an extra step",
    ).toBe(false);
  });

  it("satisfies D-13's four-part hygiene clause at both arities (AC5)", async () => {
    const ctor = await registryStoreErrorClass();
    const rendered: string[] = [];
    const traceless: string[] = [];

    for (const args of HYGIENE_SHAPES) {
      let err: Error;
      try {
        err = new ctor(...(args as never[]));
      } catch (cause) {
        throw new Error(
          `RegistryStoreError could not be constructed with ${args.length} argument(s), so ` +
            `tests/error-hygiene.test.ts cannot measure it either — that guard throws rather ` +
            `than skipping on an unconstructible class, so this would make the repo-wide gate ` +
            `red for a reason that reads as unrelated (AC5).`,
          { cause },
        );
      }
      const keys = Object.keys(err);
      const json = JSON.stringify(err);
      if (keys.length > 0 || json !== "{}") {
        rendered.push(
          `${args.length} arg(s): Object.keys=${JSON.stringify(keys)}, JSON.stringify=${json}`,
        );
      }
      if (typeof err.stack !== "string" || err.stack === "") {
        traceless.push(`${args.length} arg(s): stack is ${JSON.stringify(err.stack)}`);
      }
    }

    expect(
      rendered,
      "An enumerable own property means anything that renders this error — a log line, a JSON " +
        "body, a spread into a response — carries that property with it. Assign on the " +
        "prototype or with `Object.defineProperty(this, …, { enumerable: false })`; a plain " +
        "`this.x =` in a constructor is always enumerable.",
    ).toEqual([]);
    expect(
      traceless,
      "The clause's fourth part, and the only one that is not a statement about enumerability. " +
        "The other three are all satisfiable by deleting `stack`, at the cost of every real " +
        "failure's trace, so a class with no stack renders as {} and passes them.",
    ).toEqual([]);
  });

  it("the message is a function of the operation and of nothing else", async () => {
    const ctor = await registryStoreErrorClass();
    const New = ctor as unknown as new (op: string, cause: unknown) => Error;

    /* Two causes that share no word, so a message interpolating either diverges. */
    const causeA = new Error('Failed query: select "id", "owner_id" from "bundle"');
    const causeB = new Error("connect ECONNREFUSED 198.51.100.7:5432");

    const alphaWithA = new New("probeAlphaOperation", causeA).message;
    const alphaWithB = new New("probeAlphaOperation", causeB).message;
    const betaWithA = new New("probeBetaOperation", causeA).message;

    expect(
      alphaWithA,
      "Two faults on ONE operation rendered differently, so the message carries something from " +
        "the driver error. That is D-13's clause verbatim: no rejection may carry the failed " +
        "statement or its bound parameters. This is asserted as an equality between two " +
        "measured messages rather than against a literal, because the block publishes " +
        '"the OPERATION alone" and also says the wrapper mirrors T050\'s ' +
        "`<operation>: the account store failed.` — two different strings, and choosing one " +
        "blind would red a correct implementation that chose the other.",
    ).toBe(alphaWithB);

    expect(
      betaWithA,
      "Two DIFFERENT operations rendered identically, so the message does not name the " +
        "operation and the class is a constant string. A caller then cannot tell which read " +
        "failed, and D-50-08's rule — each message keeps one author, and a rendering names the " +
        "operation that actually failed — has nothing to hold.",
    ).not.toBe(alphaWithA);

    expect(
      alphaWithA,
      "D-81-01 ruled the wording: `${operation}: the registry store failed.`, which is the form " +
        "already shipped at archive/errors.ts:74 and in T050 rather than a third one. The " +
        "expected string is a literal in this suite and is NOT imported from the module — an " +
        "expectation built from its own subject asserts that the module agrees with itself and " +
        "survives the template starting to interpolate a driver value.\n" +
        "  Kept beside the two equalities above rather than replacing them: an exact match " +
        "cannot observe whether a DRIVER value reached the rendering, because the literal is " +
        "the same either way.",
    ).toBe(storeFailureMessage("probeAlphaOperation"));
  });
});

describe("AC1 — the wrappers are published", () => {
  for (const name of T081_NAMES.filter((n) => n !== "RegistryStoreError")) {
    it(`${name} is exported from ${REGISTRY} as a function`, async () => {
      const fn = await bindT081(name);
      expect(typeof fn).toBe("function");
    });
  }
});

describe("the barrel publishes what the two blocks name, and nothing else", () => {
  /**
   * A constructed domain owes BOTH set differences, and the reason this direction matters is
   * not tidiness: an export nobody published is an interface a downstream task can bind to
   * before anyone has decided it is one, and it is discovered at the point where the contract
   * can no longer be amended. Thirteen tasks are behind T080's barrel.
   */
  it("the exported functions are exactly the thirteen readers, actorFrom and T081's three", async () => {
    const mod = await loadRegistry();
    const exported = Object.entries(mod)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();

    const expected = [...READER_NAMES, ...NON_READER_EXPORTS, ...T081_NAMES].sort();

    const unpublished = exported.filter((name) => !expected.includes(name));
    const missing = expected.filter((name) => !exported.includes(name));

    expect(
      { unpublished, missing },
      "`unpublished` is a function on the barrel that neither §T080's nor §T081's Published " +
        "signatures block names. D-01 makes the barrel the inventory of what the module " +
        "promises, so an addition is a contract amendment and belongs in the block. `missing` " +
        "is a published name the barrel does not export, which is a failed acceptance " +
        "criterion. Both directions are asserted because a domain constructed to avoid a " +
        "maintained list owes what it demands that should not be demanded AND what it omits " +
        "that should be included.",
    ).toEqual({ unpublished: [], missing: [] });
  });
});

describe("the leak instrument can register the quantity it measures", () => {
  /**
   * A positive control, and it is the reason every green in `readers.test.ts` and
   * `routes.test.ts` is worth anything. A leak scanner that cannot detect the KNOWN leak reads
   * zero for the same reason a broken one does — a reference that could not have gone red is
   * not an oracle. So the predicate is run over the raw `DrizzleQueryError` the driver
   * produces, which is the exact error the contract measured escaping `GET /api/cards`, and it
   * is required to report a leak.
   *
   * This binds nothing of T081: the query goes through `@/lib/db`'s published client against
   * a closed port, so the control holds whether or not the module exists.
   */
  it("reports a leak against the raw DrizzleQueryError the driver produces", async () => {
    const dead = deadDb();
    try {
      const db = dead.client.db;
      const raw = await rejects(
        () => db.select().from(schema.bundle),
        'db.select().from(bundle) against a closed port',
      );

      const sql = sqlOf(raw);
      expect(
        sql,
        "The probe could not read the statement off the driver's own error, so every deny set " +
          "this suite builds is empty and every leak sweep in it passes over nothing. That is a " +
          "finding about the INSTRUMENT, not about the module: `sqlOf` reads drizzle's `query` " +
          "property and its `Failed query:` line, and one of those has moved. Fix it before " +
          "reading any other result in this suite as evidence.",
      ).not.toBe("");

      const statementTokens = tokens(sql);
      expect(
        [...statementTokens].some((t) => t === "select"),
        `the statement read off the driver does not look like SQL: ${JSON.stringify(sql)}`,
      ).toBe(true);
      expect(
        [...statementTokens].some((t) => t === "bundle"),
        `the statement read off the driver does not name the table it queried: ` +
          `${JSON.stringify(sql)}`,
      ).toBe(true);

      const check = checkNoStatementLeak(raw, [], "raw DrizzleQueryError");
      expect(
        check.vacuous,
        "the deny set was empty against an error that demonstrably carries a statement",
      ).toBe(false);
      expect(
        check.leaks.length,
        "The unwrapped driver error passed the leak check, so the check cannot see the very " +
          "leak T081 exists to seal and every clean result it returns elsewhere means nothing. " +
          "This is the T090 oracle rule at the level of a predicate: an instrument that cannot " +
          "register the quantity reads zero for the same reason a broken one does.",
      ).toBeGreaterThan(0);
    } finally {
      await dead.close();
    }
  }, 30_000);
});

describe("the published clause is quoted, not paraphrased", () => {
  it("names all three T081 exports", () => {
    /* A floor over the suite's own domain: if this list is ever trimmed, the per-name tests
       above shrink silently and the file still passes. */
    expect(T081_NAMES.length).toBe(3);
    expect(Object.keys(PUBLISHED_T081).sort()).toEqual(
      ["RegistryStoreError", "withRegistryErrors", "withRegistryStore"].sort(),
    );
  });
});
