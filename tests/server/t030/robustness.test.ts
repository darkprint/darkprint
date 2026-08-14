/* ============================================================
   T030 — the three inherited hardening rules, and the inputs no
   criterion mentions

   backend.md §T030: "The same three inherited hardening rules apply
   as to T020, and for the same reasons: content that cannot
   round-trip is refused rather than repaired (unpaired surrogates in
   a term id, label or any nested string), the well-formedness walk
   is **iterative from the start**, and no rejection carries the
   statement or its parameters — typed `Error`, own properties
   exactly `["message", "cause"]`, `cause` non-enumerable."

   Why each has teeth, from T020's own statement of them:

     surrogates — "`pg` encodes parameters as UTF-8, an unpaired
       UTF-16 surrogate has no UTF-8 encoding and is silently
       replaced with U+FFFD", so a stored term is not the term whose
       digest was computed. Refused, not repaired — and *not* a
       blanket unicode ban: ZWJ emoji, Arabic, CJK and combining
       marks still round-trip.

     iterative — "T010 shipped a recursive walk that closed cycles
       and still died with `RangeError` at 20 000 deep, and a 120 KB
       request body reaches that depth."

     sealed errors — "a `DrizzleQueryError` opens with the whole
       INSERT and every bound parameter". T010 paid two rounds for it.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { OntologyTerm } from "@/lib/core";

import { asRecord, asView, bind, expectCausePresent, notARangeError, rejects, swallow } from "./contract";
import {
  BASE_VERSION,
  ILL_FORMED,
  NUL,
  SECRET,
  type TestDb,
  WELL_FORMED,
  baseTerms,
  clean,
  db,
  deeplyNestedTerm,
  openDatabase,
  term,
  termWithSecret,
} from "./fixtures";

let t: TestDb;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);
afterAll(async () => {
  await t?.drop();
});
beforeEach(async () => {
  await clean(t);
});

/**
 * The caller's own content, which is the half only this suite knows about. The statement
 * fragments, bound-parameter markers, SQLSTATEs and `pg` internals are checked for every
 * rejection by `expectSealedError` itself, so they are not repeated per call site — and bare
 * table names are deliberately not on either list, because a typed conflict may name the
 * constraint it matched and `ontology_version` is a substring of that constraint's name.
 */
const NEVER_ECHOED = [SECRET];

describe("content that cannot round-trip is refused, not repaired", () => {
  it.each([
    { name: "a term id", build: () => term(`berti/${ILL_FORMED.loneHigh}`) },
    { name: "a label", build: () => term("berti/x", { label: `bad ${ILL_FORMED.loneLow} label` }) },
    { name: "a description", build: () => term("berti/x", { description: ILL_FORMED.highThenText }) },
    { name: "a deprecation note", build: () => term("berti/x", { deprecated: { since: "0.2.0", note: ILL_FORMED.reversedPair } }) },
    { name: "a `broader` pointer", build: () => term("berti/x", { broader: `agent${ILL_FORMED.loneHigh}` }) },
    { name: "the version string itself", build: () => term("berti/x") },
  ])("refuses an unpaired surrogate in $name", async ({ name, build }) => {
    const add = await bind("addOntologyVersion");
    const version = name === "the version string itself" ? `0.1.0${ILL_FORMED.loneHigh}` : BASE_VERSION;

    await rejects(
      () => add(db(t), { version, terms: [build()] }) as Promise<unknown>,
      NEVER_ECHOED,
      `addOntologyVersion (${name})`,
    );
  });

  it("stores nothing at all when a term is refused for its content", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const list = await bind("listOntologyVersions");

    await swallow(() => add(db(t), { version: BASE_VERSION, terms: [term("agent"), term("berti/x", { label: ILL_FORMED.loneHigh })] }));

    expect(await get(db(t), BASE_VERSION)).toBeUndefined();
    expect(await list(db(t))).toEqual([]);
  });

  it("does not repair the surrogate into U+FFFD and store it anyway", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");

    await swallow(() => add(db(t), { version: BASE_VERSION, terms: [term("berti/x", { label: `a${ILL_FORMED.loneHigh}b` })] }));

    const read = await get(db(t), BASE_VERSION);
    if (read !== undefined) {
      const stored = asRecord(read, "getOntologyVersion").terms[0]?.label ?? "";
      expect(
        stored.includes("�"),
        "the term was stored with the surrogate replaced: the digest names bytes the store does not hold",
      ).toBe(false);
    }
  });

  it("refuses a NUL byte, which Postgres text cannot hold either", async () => {
    const add = await bind("addOntologyVersion");
    await rejects(
      () => add(db(t), { version: BASE_VERSION, terms: [termWithSecret("berti/x", { label: NUL })] }) as Promise<unknown>,
      NEVER_ECHOED,
      "addOntologyVersion (NUL)",
    );
  });

  it.each(Object.entries(WELL_FORMED))("round-trips %s value-identically", async (_name, text) => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const written = term(`berti/${_name}`, { label: text, description: `${text} — described` });

    await add(db(t), { version: BASE_VERSION, terms: [written] });
    const read = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");

    // Not a blanket unicode ban: every one of these has a UTF-8 encoding and must survive.
    expect(read.terms[0]).toEqual(written);
  });

  it("round-trips a non-ASCII term id, which is also the row's key", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const written = term("berti/内存-泄漏");

    await add(db(t), { version: BASE_VERSION, terms: [written] });
    expect(asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion").terms[0].id).toBe("berti/内存-泄漏");
  });

  it("keeps two ids apart that differ only by a combining mark", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    // Precomposed é and e + U+0301. Different ids; a store that normalised would collapse them
    // into one row and trip its own unique index.
    await add(db(t), { version: BASE_VERSION, terms: [term("berti/café"), term("berti/café")] });

    expect(asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion").terms).toHaveLength(2);
  });
});

describe("the well-formedness walk is iterative", () => {
  it("finds an ill-formed string 20 000 levels down without overflowing", async () => {
    const add = await bind("addOntologyVersion");
    const deep = deeplyNestedTerm("berti/deep", 20_000);
    // Plant the defect at the bottom, so the walk has to reach it. A recursive walk dies on the
    // way down with `RangeError`; an iterative one refuses the term.
    let cursor = (deep as unknown as { nested: Record<string, unknown> }).nested;
    while (typeof cursor.next === "object" && cursor.next !== null) cursor = cursor.next as Record<string, unknown>;
    cursor.leaf = ILL_FORMED.loneHigh;

    try {
      await add(db(t), { version: BASE_VERSION, terms: [deep] });
      throw new Error("addOntologyVersion accepted a term carrying an unpaired surrogate 20 000 deep.");
    } catch (err) {
      notARangeError(err, "addOntologyVersion (20 000 deep)");
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("does not overflow on a well-formed term nested 20 000 deep", async () => {
    const add = await bind("addOntologyVersion");
    try {
      await add(db(t), { version: BASE_VERSION, terms: [deeplyNestedTerm("berti/deep", 20_000)] });
    } catch (err) {
      // Refusing a term this deep is a defensible policy and passes. Dying in the walk is not.
      notARangeError(err, "addOntologyVersion (20 000 deep, well formed)");
    }
  });

  it("round-trips ordinary nesting", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const written = deeplyNestedTerm("berti/nested", 200);

    await add(db(t), { version: BASE_VERSION, terms: [written] });
    expect(asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion").terms[0]).toEqual(written);
  });
});

describe("no rejection carries the statement, its parameters or a SQLSTATE", () => {
  it("seals the duplicate-version rejection", async () => {
    const add = await bind("addOntologyVersion");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    await rejects(
      () => add(db(t), { version: BASE_VERSION, terms: [termWithSecret("agent")] }) as Promise<unknown>,
      NEVER_ECHOED,
      "addOntologyVersion (23505)",
    );
  });

  it("seals the duplicate-term rejection", async () => {
    const add = await bind("addOntologyVersion");
    await rejects(
      () =>
        add(db(t), {
          version: BASE_VERSION,
          terms: [term("agent"), termWithSecret("agent", { label: "again" })],
        }) as Promise<unknown>,
      NEVER_ECHOED,
      "addOntologyVersion (duplicate term)",
    );
  });

  it("keeps the stack, which the amended clause requires retained", async () => {
    const add = await bind("addOntologyVersion");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    // The clause this replaced — "own properties exactly ["message", "cause"]" — was
    // unsatisfiable: `stack` is an own property of every `new Error()` in V8, so the only way to
    // meet it was to delete `stack` and cost every real failure its trace. `expectSealedError`
    // holds the whole amended clause; this test exists so a deleted stack reds under its own name
    // rather than inside a five-part assertion.
    const err = await rejects(
      () => add(db(t), { version: BASE_VERSION, terms: [termWithSecret("agent")] }) as Promise<unknown>,
      NEVER_ECHOED,
      "addOntologyVersion (stack retained)",
    );

    expect(typeof err.stack).toBe("string");
    expect((err.stack ?? "").length, "an error nobody can locate is the worse outcome").toBeGreaterThan(0);
  });

  it("carries a non-enumerable `cause` on a refusal the database raised", async () => {
    const add = await bind("addOntologyVersion");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    const err = await rejects(
      () => add(db(t), { version: BASE_VERSION, terms: [termWithSecret("agent")] }) as Promise<unknown>,
      NEVER_ECHOED,
      "addOntologyVersion (cause present)",
    );

    // Presence is asserted here and not on a refusal this module raised for itself: a bad-input
    // rejection has nothing underneath it to carry, and requiring one there would read the clause
    // past what it settles. Non-enumerability is checked on every rejection by `expectSealedError`.
    expectCausePresent(err, "addOntologyVersion (cause present)");
  });

  it("names the caller's own identifiers, which is all a caller can act on", async () => {
    const add = await bind("addOntologyVersion");
    await add(db(t), { version: "7.7.7", terms: baseTerms() });

    const err = await rejects(
      () => add(db(t), { version: "7.7.7", terms: [termWithSecret("agent")] }) as Promise<unknown>,
      NEVER_ECHOED,
      "addOntologyVersion (message)",
    );

    // The sealing rule is about the driver's payload, not about saying nothing: an error that
    // does not name what the caller asked for is unactionable in the other direction.
    expect(err.message.length, "an empty refusal is not a refusal").toBeGreaterThan(0);
  });
});

describe("inputs no criterion mentions", () => {
  it.each([
    { name: "no input at all", input: undefined },
    { name: "null", input: null },
    { name: "a string", input: "0.1.0" },
    { name: "an object with no version", input: { terms: [] } },
    { name: "an object with no terms", input: { version: "0.1.0" } },
    { name: "a numeric version", input: { version: 1, terms: [] } },
    { name: "terms that are not an array", input: { version: "0.1.0", terms: "agent" } },
    { name: "terms holding null", input: { version: "0.1.0", terms: [null] } },
    { name: "terms holding a string", input: { version: "0.1.0", terms: ["agent"] } },
    { name: "a term with no id", input: { version: "0.1.0", terms: [{ kind: "node-type", label: "x" }] } },
    { name: "a term whose id is not a string", input: { version: "0.1.0", terms: [{ id: 7, kind: "node-type" }] } },
    { name: "a term of no known kind", input: { version: "0.1.0", terms: [{ id: "x", kind: "sideways", label: "x", description: "x", since: "0.1.0" }] } },
  ])("refuses $name, and stores nothing", async ({ input }) => {
    const add = await bind("addOntologyVersion");
    const list = await bind("listOntologyVersions");

    await rejects(() => add(db(t), input) as Promise<unknown>, NEVER_ECHOED, "addOntologyVersion (malformed input)");
    expect(await list(db(t)), "a refused write left a row behind").toEqual([]);
  });

  it("ignores a property the input shape does not declare", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms(), createdAt: new Date(0), id: "chosen-by-caller" });

    const read = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");
    expect(read.id, "the caller chose the row's primary key").not.toBe("chosen-by-caller");
    expect(read.createdAt.getTime(), "the caller chose the row's timestamp").not.toBe(0);
  });

  it("does not answer for a version nobody published", async () => {
    const open = await bind("openView");
    // The contract does not say what `openView` does here. What it may not do is answer as
    // though the version existed: a view claiming a version the registry does not hold would
    // let a bundle resolve against a vocabulary nobody published.
    let view: unknown;
    try {
      view = await open(db(t), "9.9.9");
    } catch {
      return; // refusing is a coherent answer
    }
    expect(
      view === undefined || view === null,
      "openView returned a usable view for a version that was never published",
    ).toBe(true);
  });

  it.each([
    { name: "extensions that are not an array", extensions: "berti/x" },
    { name: "extensions holding null", extensions: [null] },
    { name: "extensions holding a string", extensions: ["berti/x"] },
    { name: "a term with no id", extensions: [{ kind: "node-type", label: "x" }] },
  ])("does not silently drop $name", async ({ extensions }) => {
    const add = await bind("addOntologyVersion");
    const open = await bind("openView");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    // Either refuse, or produce a view — but never a view that quietly claims the overlay was
    // merged when it was discarded. The base has to still be there either way.
    let view: unknown;
    try {
      view = await open(db(t), BASE_VERSION, extensions);
    } catch {
      return;
    }
    expect(asView(view, "openView").get("agent")?.id, "the base vocabulary went missing too").toBe("agent");
  });

  it("treats an absent overlay and an empty one the same", async () => {
    const add = await bind("addOntologyVersion");
    const open = await bind("openView");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    const absent = asView(await open(db(t), BASE_VERSION), "openView");
    const empty = asView(await open(db(t), BASE_VERSION, []), "openView");

    expect(empty.ontology.terms).toEqual(absent.ontology.terms);
    expect(empty.validate()).toEqual(absent.validate());
  });

  it("does not mutate the overlay it was handed", async () => {
    const add = await bind("addOntologyVersion");
    const open = await bind("openView");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    // Frozen, so an in-place sort or push over `extensions` throws instead of rewriting a
    // caller's release record.
    const extensions = Object.freeze([
      Object.freeze(term("berti/b", { broader: "agent" })),
      Object.freeze(term("berti/a", { broader: "agent" })),
    ]);

    await open(db(t), BASE_VERSION, extensions);
    expect(extensions.map((x) => x.id)).toEqual(["berti/b", "berti/a"]);
  });

  it("does not mutate the terms it was handed", async () => {
    const add = await bind("addOntologyVersion");
    const terms = Object.freeze(baseTerms().map((x) => Object.freeze(x)));

    await add(db(t), { version: BASE_VERSION, terms });
    expect(terms.map((x) => x.id)).toEqual(baseTerms().map((x) => x.id));
  });

  it("answers a duplicate read identically", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    const runs = await Promise.all(Array.from({ length: 8 }, () => get(db(t), BASE_VERSION)));
    const first = asRecord(runs[0], "getOntologyVersion");
    for (const run of runs) expect(asRecord(run, "getOntologyVersion")).toEqual(first);
  });

  it("serves concurrent readers of one version one answer", async () => {
    const add = await bind("addOntologyVersion");
    const open = await bind("openView");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    const views = await Promise.all(Array.from({ length: 12 }, () => open(db(t), BASE_VERSION)));
    const ids = views.map((v) => asView(v, "openView").ontology.terms.map((x) => x.id));
    for (const run of ids) expect(run).toEqual(ids[0]);
  });
});

describe("the walk carries T-02's `seen` set, which this task's input requires", () => {
  /**
   * "**Any task whose input can be built in-process rather than parsed must add it.** T010 ships
   * without it deliberately; T020 and T030 copy the same walk and inherit the same condition."
   *
   * T030's input qualifies: `terms` is a `readonly OntologyTerm[]` a caller constructs, not a
   * parsed body, and `structuredClone` preserves sharing where `JSON.parse` cannot. Without the
   * `seen` set of containers already walked clean, a diamond is re-walked per path: measured on
   * T010's walk at 6 025 ms for 24 levels, a clean x4 per +2.
   *
   * The offending term is second in the list, so the walk has to finish the diamond before it can
   * reach the refusal. That keeps the test independent of traversal order, and it never reaches
   * the driver — which matters, because `JSON.stringify` expands shared structure exponentially
   * too and would confound the measurement.
   */
  it("refuses in bounded time whichever end of the list the offending term sits at", async () => {
    const add = await bind("addOntologyVersion");

    // 24 levels of diamond: 25 distinct objects, 2^24 paths. T010's measurement of the
    // path-scoped-only walk puts that at 6 025 ms, a clean x4 per +2; with the `seen` set it is
    // 25 visits.
    const diamondTerm = () => {
      let shared: Record<string, unknown> = { leaf: "bottom" };
      for (let i = 0; i < 24; i += 1) shared = { left: shared, right: shared };
      return { ...term("berti/diamond"), nested: shared } as unknown as OntologyTerm;
    };
    const bad = () => term("berti/bad", { label: ILL_FORMED.loneHigh });

    // **Both arrangements, and this is the point of the test.** A first version of it put the
    // offending term second and measured nothing: the reference walk pops its stack LIFO, so the
    // bad label was found before the diamond was ever entered, and removing the `seen` set
    // reddened nothing. Traversal order is not something a blind suite may assume, and for any
    // deterministic order one of these two arrangements walks the diamond first.
    const timings: Record<string, number> = {};
    for (const [where, terms] of [
      ["offending term last", [diamondTerm(), bad()]],
      ["offending term first", [bad(), diamondTerm()]],
    ] as const) {
      await clean(t);
      const started = Date.now();
      await rejects(
        () => add(db(t), { version: BASE_VERSION, terms }) as Promise<unknown>,
        NEVER_ECHOED,
        `addOntologyVersion (shared substructure, ${where})`,
      );
      timings[where] = Date.now() - started;
    }

    const worst = Math.max(...Object.values(timings));
    expect(
      worst,
      `the walk took ${JSON.stringify(timings)} over a 24-level diamond, which is the O(2^n) ` +
        `re-walk T-02 names. backend.md: "Any task whose input can be built in-process rather ` +
        `than parsed must add it" — T030's \`terms\` is a caller-built array, and ` +
        `\`structuredClone\` preserves sharing where \`JSON.parse\` cannot. Add the \`seen\` set of ` +
        `containers already walked clean, beside the path-scoped \`open\` set that handles cycles.`,
    ).toBeLessThan(3_000);
  }, 120_000);

  it("still refuses an ill-formed string reachable only through shared substructure", async () => {
    const add = await bind("addOntologyVersion");

    // The `seen` set must not become a way to skip a subtree that was never actually cleared.
    let shared: Record<string, unknown> = { leaf: ILL_FORMED.loneLow };
    for (let i = 0; i < 8; i += 1) shared = { left: shared, right: shared };

    await rejects(
      () =>
        add(db(t), {
          version: BASE_VERSION,
          terms: [{ ...term("berti/diamond"), nested: shared } as unknown as OntologyTerm],
        }) as Promise<unknown>,
      NEVER_ECHOED,
      "addOntologyVersion (shared ill-formed leaf)",
    );
  }, 60_000);
});
