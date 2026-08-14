/* ============================================================
   T030 — acceptance criterion (6)

   AC6: "publishing an ontology version that removes a term is
        inferred major and refused if declared minor".

   ── why this file is expected to be red, and why that is right ──
   backend.md §T030: "AC6 is the one criterion that waits on T025.
   `inferOntologyBump` and `checkDeclaredBump("ontology", …)` are
   T025's published surface and do **not** exist in `lib/core` …
   Build everything else, and if `lib/server/versioning/**` has not
   merged by the time the gates run, leave AC6's call site as a
   single named function that reports the absent dependency, say so
   in the Log, and let the criterion stand red. Do **not** reimplement
   bump inference inside `lib/server/ontology/**` to make it green —
   two implementations of one rule is the defect the partition exists
   to prevent."

   So the tests are written to T025's published signature and will
   red on that module until it merges. `contract.ts` gives that red a
   message saying which module is missing and whose it is, so nobody
   reads it as a T030 defect.

   The previous term set comes out of T030's store rather than out of
   a literal, because the criterion is about *publishing*: what a new
   version is judged against is what the registry actually holds.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { asDiagnostics, asRecord, bind, bindT025, of } from "./contract";
import { BASE_VERSION, type TestDb, baseTerms, clean, db, openDatabase, term } from "./fixtures";

let t: TestDb;

const TOO_SMALL = "ontology/version-bump-too-small";

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
 * Publishing is deliberately *not* in `beforeEach`, and every test below binds T025 before it
 * touches the store.
 *
 * Both modules are absent today, so whichever is reached first is the one the red names. With
 * the publish in `beforeEach`, all of AC6 reddened on `@/lib/server/ontology` and the criterion
 * that "waits on T025" said nothing about T025 at all. Binding the dependency first makes the
 * red name the module the contract says this criterion is waiting for.
 */
async function published() {
  const add = await bind("addOntologyVersion");
  await add(db(t), { version: BASE_VERSION, terms: baseTerms() });
  const get = await bind("getOntologyVersion");
  return asRecord(await get(db(t), BASE_VERSION), "getOntologyVersion");
}

describe("AC6: removing a term is a major ontology version", () => {
  it("AC6 infers major when the proposed version drops a published term", async () => {
    const infer = await bindT025("inferOntologyBump");
    const previous = await published();
    const next = previous.terms.filter((x) => x.id !== "validation");

    const analysis = infer(previous.terms, next) as { level?: unknown };
    expect(analysis.level).toBe("major");
  });

  it("AC6 refuses that version when its author declared a minor", async () => {
    const infer = await bindT025("inferOntologyBump");
    const check = await bindT025("checkDeclaredBump");
    const previous = await published();
    const next = previous.terms.filter((x) => x.id !== "validation");

    const inferred = infer(previous.terms, next);
    const ds = asDiagnostics(check("ontology", previous.version, "0.2.0", inferred), "checkDeclaredBump");

    expect(ds, "0.2.0 on 0.1.0 is a minor bump and a removal requires a major").toHaveLength(1);
    expect(ds[0].code, "the subject is an ontology, so the code is the ontology one").toBe(TOO_SMALL);
    expect(ds[0].severity).toBe("error");
  });

  it("AC6 names the term that forced the major", async () => {
    const infer = await bindT025("inferOntologyBump");
    const check = await bindT025("checkDeclaredBump");
    const previous = await published();
    const next = previous.terms.filter((x) => x.id !== "validation");

    const inferred = infer(previous.terms, next);
    const ds = asDiagnostics(check("ontology", previous.version, "0.2.0", inferred), "checkDeclaredBump");
    const text = ds.map((d) => `${d.message} ${d.hint ?? ""}`).join("\n");

    expect(text, "a refusal an author cannot act on is not a refusal").toContain("validation");
  });

  it("AC6 accepts the same removal once the author declares the major", async () => {
    const infer = await bindT025("inferOntologyBump");
    const check = await bindT025("checkDeclaredBump");
    const previous = await published();
    const next = previous.terms.filter((x) => x.id !== "validation");

    const inferred = infer(previous.terms, next);
    expect(asDiagnostics(check("ontology", previous.version, "1.0.0", inferred), "checkDeclaredBump")).toEqual([]);
  });

  it("AC6 does not refuse a version that only adds a term", async () => {
    const infer = await bindT025("inferOntologyBump");
    const check = await bindT025("checkDeclaredBump");
    const previous = await published();
    const next = [...previous.terms, term("critic")];

    const inferred = infer(previous.terms, next) as { level?: unknown };
    expect(inferred.level, "adding a term is minor").toBe("minor");
    expect(asDiagnostics(check("ontology", previous.version, "0.2.0", inferred), "checkDeclaredBump")).toEqual([]);
  });

  it("AC6 refuses an addition declared as a patch", async () => {
    const infer = await bindT025("inferOntologyBump");
    const check = await bindT025("checkDeclaredBump");
    const previous = await published();

    const inferred = infer(previous.terms, [...previous.terms, term("critic")]);
    const ds = asDiagnostics(check("ontology", previous.version, "0.1.1", inferred), "checkDeclaredBump");

    expect(ds).toHaveLength(1);
    expect(of(ds, TOO_SMALL)).toHaveLength(1);
  });

  it("AC6 judges the proposal against what the registry actually holds", async () => {
    const infer = await bindT025("inferOntologyBump");
    const add = await bind("addOntologyVersion");
    const latest = await bind("getLatestOntologyVersion");

    // A second version is published, and the next proposal is judged against *it*, not against
    // the first. Reading the previous terms from a literal would hide a store that hands back
    // the wrong version.
    await add(db(t), { version: BASE_VERSION, terms: baseTerms() });
    await add(db(t), { version: "0.2.0", terms: [...baseTerms(), term("critic")] });
    const head = asRecord(await latest(db(t)), "getLatestOntologyVersion");
    expect(head.version).toBe("0.2.0");

    const analysis = infer(head.terms, head.terms.filter((x) => x.id !== "critic")) as { level?: unknown };
    expect(analysis.level, "dropping the term 0.2.0 added is a removal against 0.2.0").toBe("major");
  });
});
