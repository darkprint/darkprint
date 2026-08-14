/* ============================================================
   T030 — the store: versions in, versions out

   No acceptance criterion names these four functions, which is
   exactly why they are here. Across three tasks the blind suites
   earned their keep on what no criterion states.

   Two facts from the contract shape most of it:

     "Terms are rows, not a blob. `ontology_term` is one row per
      `(ontology_version_id, term_id)` with the full `OntologyTerm`
      in `body jsonb` — so a version's terms are written as N rows
      in one transaction and read back sorted by `term_id` for a
      total order."

     "`body` being `jsonb` means a term round-trips
      **value-identically**, never byte-identically; the same
      distinction T010's AC1 needed and did not have."

   So nothing here asserts byte or reference identity on a term.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { asRecord, bind, rejects, swallow } from "./contract";
import {
  BASE_VERSION,
  SECRET,
  type TestDb,
  baseTerms,
  clean,
  db,
  openDatabase,
  sortedIds,
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

describe("addOntologyVersion: the digest is computed here", () => {
  it("returns a record whose digest it computed itself", async () => {
    const add = await bind("addOntologyVersion");
    const record = asRecord(await add(db(t), { version: BASE_VERSION, terms: baseTerms() }), "addOntologyVersion");

    expect(record.version).toBe(BASE_VERSION);
    expect(record.digest.length, "a digest nobody computed is not a digest").toBeGreaterThan(0);
  });

  it("ignores a digest the caller tried to supply", async () => {
    const add = await bind("addOntologyVersion");
    const forged = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    const record = asRecord(
      await add(db(t), { version: BASE_VERSION, terms: baseTerms(), digest: forged }),
      "addOntologyVersion",
    );

    // "digest is COMPUTED here, never supplied". A store that takes the caller's word for the
    // identity of a release has no identity at all.
    expect(record.digest).not.toBe(forged);
  });

  it("gives one answer for one input", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const written = asRecord(await add(db(t), { version: BASE_VERSION, terms: baseTerms() }), "addOntologyVersion");
    const read = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");

    expect(read.digest).toBe(written.digest);
  });

  it("gives two different digests to two term sets under one version", async () => {
    const add = await bind("addOntologyVersion");
    const first = asRecord(await add(db(t), { version: "1.0.0", terms: baseTerms() }), "addOntologyVersion");
    await clean(t);
    const second = asRecord(
      await add(db(t), { version: "1.0.0", terms: [...baseTerms(), term("critic")] }),
      "addOntologyVersion",
    );

    expect(second.digest, "the digest has to distinguish what it names").not.toBe(first.digest);
  });

  /**
   * Published now, at `95033be`: "Ruling: the digest covers `version` as well as the terms",
   * from `lib/core/hash/digest.ts`. It reached this suite by message first and was asserted on
   * the strength of that file rather than the message — the ruling is in the contract, so the
   * provenance caveat this comment used to carry is gone.
   */
  it("gives two different digests to one term set under two versions", async () => {
    const add = await bind("addOntologyVersion");
    const first = asRecord(await add(db(t), { version: "1.0.0", terms: baseTerms() }), "addOntologyVersion");
    const second = asRecord(await add(db(t), { version: "1.1.0", terms: baseTerms() }), "addOntologyVersion");

    expect(second.digest).not.toBe(first.digest);
  });
});

describe("getOntologyVersion: terms round-trip value-identically", () => {
  it("reads back every term with its value intact", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const terms = baseTerms();
    await add(db(t), { version: BASE_VERSION, terms });

    const read = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");

    // Value equality, never byte or reference equality: `body` is `jsonb`, so the bytes are the
    // database's business and the value is the contract.
    expect([...read.terms].sort((a, b) => (a.id < b.id ? -1 : 1))).toEqual(
      [...terms].sort((a, b) => (a.id < b.id ? -1 : 1)),
    );
  });

  it("reads them back sorted by term id, for a total order", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    // Written in an order that is neither sorted nor reverse-sorted.
    const terms = [term("text"), term("agent"), term("validation"), term("evaluative")];
    await add(db(t), { version: BASE_VERSION, terms });

    const read = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");
    expect(read.terms.map((x) => x.id)).toEqual(sortedIds(terms));
  });

  it("invents no keys on a term that came back", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const one = term("agent");
    await add(db(t), { version: BASE_VERSION, terms: [one] });

    const read = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");
    expect(Object.keys(read.terms[0]).sort()).toEqual(Object.keys(one).sort());
  });

  it("keeps a falsy weight, which is a declaration and not an absence", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    // `resolve.ts`: "A declared `0` is a choice and passes: `??` only falls through on
    // `undefined`." A round trip that drops it turns a priced marker into an unpriced one.
    await add(db(t), {
      version: BASE_VERSION,
      terms: [term("zero-cost", { kind: "risk-marker", defaultWeight: 0 })],
    });

    const read = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");
    expect(read.terms[0].defaultWeight).toBe(0);
  });

  it("answers `undefined` for a version nobody published", async () => {
    const get = await bind("getOntologyVersion");
    expect(await get(db(t), "9.9.9")).toBeUndefined();
  });

  it("answers `undefined` for the empty string", async () => {
    const get = await bind("getOntologyVersion");
    await (await bind("addOntologyVersion"))(db(t), { version: BASE_VERSION, terms: baseTerms() });
    expect(await get(db(t), "")).toBeUndefined();
  });

  it("ignores an argument the signature does not declare", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    const plain = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");
    const surplus = asRecord(await get(db(t), BASE_VERSION, "extra", 42), "getOntologyVersion");
    expect(surplus).toEqual(plain);
  });
});

describe("getLatestOntologyVersion and listOntologyVersions", () => {
  it("answers `undefined` when nothing has been published", async () => {
    const latest = await bind("getLatestOntologyVersion");
    expect(await latest(db(t))).toBeUndefined();
  });

  it("returns the only version there is", async () => {
    const add = await bind("addOntologyVersion");
    const latest = await bind("getLatestOntologyVersion");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    expect(asRecord(await latest(db(t)), "getLatestOntologyVersion").version).toBe(BASE_VERSION);
  });

  it("returns the highest of versions published in ascending order", async () => {
    const add = await bind("addOntologyVersion");
    const latest = await bind("getLatestOntologyVersion");
    for (const version of ["0.1.0", "0.2.0", "1.0.0"]) await add(db(t), { version, terms: baseTerms() });

    // Both readings of "latest" — by semver and by arrival — agree here, so this one holds
    // whichever the implementation chose.
    expect(asRecord(await latest(db(t)), "getLatestOntologyVersion").version).toBe("1.0.0");
  });

  /**
   * The case where the two readings disagree, and the one the contract does not settle.
   *
   * Bound to semver because this repository has already answered the same question once, in the
   * card path T030 mirrors: `checkVersionChain` orders "by semver rather than by the order they
   * arrived, because 'the last published one' is a fact about the numbers and not about a
   * directory listing" (`lib/core/card/validate.ts`). Derived, not published — flagged in the
   * Log so the orchestrator can rule, and isolated in one test so only this one moves.
   */
  it("returns the highest version even when an older one was published after it", async () => {
    const add = await bind("addOntologyVersion");
    const latest = await bind("getLatestOntologyVersion");
    await add(db(t), { version: "2.0.0", terms: baseTerms() });
    await add(db(t), { version: "1.0.0", terms: baseTerms() });

    expect(asRecord(await latest(db(t)), "getLatestOntologyVersion").version).toBe("2.0.0");
  });

  it("lists exactly what was published, and nothing else", async () => {
    const add = await bind("addOntologyVersion");
    const list = await bind("listOntologyVersions");
    for (const version of ["0.2.0", "1.0.0", "0.1.0"]) await add(db(t), { version, terms: baseTerms() });

    const rows = await list(db(t));
    expect(Array.isArray(rows)).toBe(true);
    const versions = (rows as unknown[]).map((r) => asRecord(r, "listOntologyVersions").version);
    expect([...versions].sort()).toEqual(["0.1.0", "0.2.0", "1.0.0"]);
  });

  it("lists in a stable order across calls", async () => {
    const add = await bind("addOntologyVersion");
    const list = await bind("listOntologyVersions");
    for (const version of ["0.2.0", "1.0.0", "0.1.0"]) await add(db(t), { version, terms: baseTerms() });

    // The direction is unnamed and is not asserted. A listing whose order changes between two
    // calls over unchanged data is a defect under any reading of it.
    const first = ((await list(db(t))) as unknown[]).map((r) => asRecord(r, "listOntologyVersions").version);
    const second = ((await list(db(t))) as unknown[]).map((r) => asRecord(r, "listOntologyVersions").version);
    expect(second).toEqual(first);
  });

  it("lists nothing when nothing has been published", async () => {
    const list = await bind("listOntologyVersions");
    expect(await list(db(t))).toEqual([]);
  });
});

describe("addOntologyVersion: one version per version string", () => {
  it("refuses a version string that is already published", async () => {
    const add = await bind("addOntologyVersion");
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });

    await rejects(
      () => add(db(t), { version: BASE_VERSION, terms: [termWithSecret("agent")] }) as Promise<unknown>,
      [SECRET],
      "addOntologyVersion (duplicate version)",
    );
  });

  it("leaves the published version untouched after refusing the duplicate", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const original = asRecord(await add(db(t), { version: BASE_VERSION, terms: baseTerms() }), "addOntologyVersion");

    await swallow(() => add(db(t), { version: BASE_VERSION, terms: [term("usurper")] }));

    const read = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");
    expect(read.digest, "the refused write overwrote the published one").toBe(original.digest);
    expect(read.terms.map((x) => x.id)).toEqual(sortedIds(baseTerms()));
  });

  it("lets exactly one of two concurrent writers claim a version", async () => {
    const add = await bind("addOntologyVersion");
    const list = await bind("listOntologyVersions");

    const settled = await Promise.allSettled([
      add(db(t), { version: BASE_VERSION, terms: baseTerms() }),
      add(db(t), { version: BASE_VERSION, terms: baseTerms() }),
    ]);

    expect(settled.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    expect(((await list(db(t))) as unknown[]).length).toBe(1);
  });

  it("lets concurrent writers claim different versions", async () => {
    const add = await bind("addOntologyVersion");
    const list = await bind("listOntologyVersions");
    const versions = ["1.0.0", "1.1.0", "1.2.0", "2.0.0", "2.1.0"];

    const settled = await Promise.allSettled(versions.map((version) => add(db(t), { version, terms: baseTerms() })));

    expect(settled.every((s) => s.status === "fulfilled")).toBe(true);
    const stored = ((await list(db(t))) as unknown[]).map((r) => asRecord(r, "listOntologyVersions").version);
    expect([...stored].sort()).toEqual([...versions].sort());
  });
});

describe("addOntologyVersion: N rows in one transaction", () => {
  /**
   * "a version's terms are written as N rows in one transaction". The way to make row k fail
   * without touching anything else is the constraint the schema already declares,
   * `ontology_term_version_term_key` on `(ontology_version_id, term_id)`: two terms sharing an
   * id inside one input. What must not survive is a half-written version.
   */
  it("writes no version at all when one of its terms cannot be written", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const list = await bind("listOntologyVersions");

    await rejects(
      () =>
        add(db(t), {
          version: BASE_VERSION,
          terms: [term("agent"), term("evaluative"), termWithSecret("agent", { label: "again" })],
        }) as Promise<unknown>,
      [SECRET],
      "addOntologyVersion (duplicate term id)",
    );

    expect(await get(db(t), BASE_VERSION), "the version row outlived the terms it was for").toBeUndefined();
    expect(await list(db(t))).toEqual([]);
  });

  it("leaves no orphan version when the terms are refused for their content", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");

    await rejects(
      () =>
        add(db(t), {
          version: BASE_VERSION,
          terms: [term("agent"), term("broken", { label: "lone \uD800 surrogate" })],
        }) as Promise<unknown>,
      ["insert", "ontology_term"],
      "addOntologyVersion (ill-formed term)",
    );

    expect(await get(db(t), BASE_VERSION)).toBeUndefined();
  });

  it("publishes a version whose terms all land", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");
    const terms = baseTerms();
    await add(db(t), { version: BASE_VERSION, terms });

    const read = asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");
    expect(read.terms).toHaveLength(terms.length);
  });

  /**
   * A vocabulary with no terms. The contract does not say whether it is publishable, so this
   * asserts only that the two answers are the two coherent ones — stored and readable as empty,
   * or refused outright. What it rules out is the third: a version row that exists and cannot
   * be read back.
   */
  it("is coherent about a version with no terms", async () => {
    const add = await bind("addOntologyVersion");
    const get = await bind("getOntologyVersion");

    let published = true;
    try {
      await add(db(t), { version: BASE_VERSION, terms: [] });
    } catch {
      published = false;
    }

    const read = await get(db(t), BASE_VERSION);
    if (published) {
      expect(asRecord(read, "getOntologyVersion").terms).toEqual([]);
    } else {
      expect(read, "refused, and yet a version row is there to be read").toBeUndefined();
    }
  });
});
