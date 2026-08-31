/* ============================================================
   The boundary between `jsonb` and `NodeCard`.

   Every cell here is written against the SHAPE the real defect had,
   not against an invented one: on 2026-08-31 the dev registry held
   58 card bodies carrying `requiresHuman` and no `willNot`, because
   the schema moved and the rows did not. `row.body as NodeCard`
   handed those to a renderer that read `.length` off `undefined`.

   The two failure modes this file has to separate:
     - the guard is absent or too lax, and a body missing a required
       field still comes back as a card. That is the defect.
     - the guard is too strict, and a body that IS a card is refused.
       That is a registry that stops serving its own archive, which
       is worse than a crash because it looks like an empty shelf.
   Both directions are asserted below.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { storedCard, storedCardGaps } from "./stored-card";

/** A body with every required field, in the shape the migrated archive writes. */
function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "spec-planner",
    name: "Spec Planner",
    type: "agent",
    phases: ["planning"],
    action: "Turn the request into a plan.",
    spec: "Read the feature request and produce a plan and acceptance criteria.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [{ name: "request", type: "text" }],
    outputs: [{ name: "plan", type: "plan" }],
    dependencies: [],
    cannot: [],
    willNot: ["write any of the code it plans"],
    riskMarkers: [],
    version: "1.0.0",
    ...overrides,
  };
}

describe("storedCard reads a body that really is a card", () => {
  it("answers the card when every required field is present", () => {
    const value = body();
    expect(storedCardGaps(value)).toEqual([]);
    expect(storedCard(value)?.id).toBe("spec-planner");
  });

  it("does not require the interface's optional members", () => {
    /* `model`, `agent`, `skill`, `notes`, `author` and `provenance` are `?` on `NodeCard`.
       A guard that demanded them would refuse most of the archive, which is the
       too-strict failure this file exists to catch as well as the too-lax one. */
    const value = body();
    for (const optional of ["model", "agent", "skill", "notes", "author", "provenance"]) {
      expect(Object.hasOwn(value, optional), `${optional} leaked into the fixture`).toBe(false);
    }
    expect(storedCard(value)).toBeDefined();
  });

  it("accepts a card carrying fields the schema has since retired", () => {
    /* The real rows carry `requiresHuman` and `ontologyVersion`, withdrawn by D-92 and
       D-93. An unknown key is not a reason to refuse to serve a card: `card/validate.ts`
       reports one at INFO precisely so a document written against another schema still
       loads. This guard must not be stricter than that. */
    const value = body({ requiresHuman: false, ontologyVersion: "0.1.0" });
    expect(storedCardGaps(value)).toEqual([]);
    expect(storedCard(value)).toBeDefined();
  });
});

describe("storedCard refuses a body that is not one", () => {
  it("refuses the exact row that crashed the node page", () => {
    /* The measured case: `willNot` absent because the row predates the field. The cast
       returned it, the type said `string[]`, and `list(c.willNot)` threw. */
    const stale = body();
    delete stale.willNot;
    expect(storedCardGaps(stale)).toEqual(["`willNot` is missing"]);
    expect(storedCard(stale)).toBeUndefined();
  });

  it("names every missing required field, not just the first", () => {
    const stale = body();
    for (const field of ["willNot", "cannot", "riskMarkers"]) delete stale[field];
    expect(storedCardGaps(stale)).toEqual([
      "`cannot` is missing",
      "`willNot` is missing",
      "`riskMarkers` is missing",
    ]);
  });

  it("refuses a required field of the wrong kind, not only an absent one", () => {
    // The other half of the same lie: present, and not what the interface promises.
    expect(storedCardGaps(body({ willNot: "not an array" }))).toEqual(["`willNot` is the wrong kind"]);
    expect(storedCardGaps(body({ phases: [1, 2] }))).toEqual(["`phases` is the wrong kind"]);
    expect(storedCardGaps(body({ params: [] }))).toEqual(["`params` is the wrong kind"]);
  });

  it("refuses a port array whose members are not ports", () => {
    /* `inputs` and `outputs` are dereferenced as `.name`/`.type` all over the UI, so an
       array of the wrong things is the same defect one level down. */
    expect(storedCardGaps(body({ inputs: ["request"] }))).toEqual(["`inputs` is the wrong kind"]);
    expect(storedCardGaps(body({ outputs: [{ name: "plan" }] }))).toEqual([
      "`outputs` is the wrong kind",
    ]);
  });

  it("refuses what is not an object at all, without throwing on it", () => {
    for (const value of [undefined, null, "a string", 7, [], true]) {
      expect(storedCard(value), `${JSON.stringify(value ?? null)} came back as a card`).toBeUndefined();
    }
    expect(storedCardGaps(null)).toEqual(["the body is not an object"]);
  });

  it("treats an explicit `undefined` as absent rather than as a value", () => {
    // `Object.hasOwn` is true here, so a `hasOwn`-only check would accept it and the
    // renderer would throw exactly as before.
    expect(storedCardGaps(body({ willNot: undefined }))).toEqual(["`willNot` is missing"]);
  });
});

describe("the guard cannot fall behind the interface it guards", () => {
  it("checks every field NodeCard declares", () => {
    /* `FIELDS` is a `Record<keyof NodeCard, …>`, so a field added to the interface without
       a check here fails to COMPILE. This runtime cell holds the other direction — that the
       fixture above really exercises the required set — so a future reader who deletes a
       line from `body()` learns it from a red rather than from a silent narrowing. */
    const required = storedCardGaps({}).filter((gap) => gap.endsWith("is missing"));
    expect(required.length).toBeGreaterThanOrEqual(15);
    expect(required).toContain("`willNot` is missing");
    expect(required).toContain("`cannot` is missing");
    // And the optional members must NOT appear in that list.
    for (const optional of ["model", "agent", "skill", "notes", "author", "provenance"]) {
      expect(required, `${optional} is optional and was demanded`).not.toContain(
        `\`${optional}\` is missing`,
      );
    }
  });
});
