/* ============================================================
   T025 — acceptance criterion (1), and the whole of `checkDeclaredBump`

   AC-1: "a card chain the engine calls major and the author declared
   minor is refused, naming the reasons".

   The card half of the engine is consumed, not reimplemented:
   `inferBump` from `@/lib/core` decides what the change requires,
   and the T025 surface under test is `checkDeclaredBump`, which the
   contract states as returning "`[]` when the declared version is at
   least the inferred level, and otherwise one diagnostic at
   **`error`** severity carrying the engine's own `reasons`, with the
   code mapped from `subject`".

   ── the `subject` parameter ──
   The first round of these tests was written against a two-string
   signature and reported that the diagnostic's code and severity
   were unnamed. Both are named now, and the code is named *by* a
   closed `subject` union the function maps to a code itself. So the
   mapping is asserted here, on the function, rather than assumed of
   whoever calls it.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { type BumpAnalysis, hasErrors, inferBump } from "@/lib/core";

import {
  SUBJECT_CODES,
  type Subject,
  asDiagnostics,
  checkDeclaredBump,
  deepFreeze,
  diagnosticText,
  neverSilentlyAccepts,
} from "./contract";
import { card } from "./fixtures";

const WHERE = "checkDeclaredBump";
/** AC-1 is about a card chain; the other two subjects get their own block below. */
const CARD: Subject = "card";

/** Two cards a version apart whose diff `inferBump` prices at major. */
const PUBLISHED_CARD = card({ version: "1.0.0" });
/** The output port is gone and the name was reworded: one major reason and one patch reason. */
const BREAKING_EDIT = card({ version: "1.1.0", outputs: [], name: "Solver II" });

function analysis(level: BumpAnalysis["level"], reasons: string[] = []): BumpAnalysis {
  return { level, reasons };
}

describe("AC-1: a declared bump smaller than the inferred one is refused", () => {
  it("AC-1 refuses a major change the author declared as a minor, naming the engine's reasons", async () => {
    const fn = await checkDeclaredBump();
    const inferred = inferBump(PUBLISHED_CARD, BREAKING_EDIT);

    // The premise, stated so a change in `@/lib/core` kills this test loudly rather than
    // quietly turning it into a test of nothing.
    expect(inferred.level, "the fixture's diff is what `@/lib/core` prices as major").toBe("major");
    expect(inferred.reasons.length).toBeGreaterThan(0);

    const ds = asDiagnostics(fn(CARD, "1.0.0", "1.1.0", inferred), WHERE);

    expect(ds.length, "1.1.0 on 1.0.0 is a minor bump and the change requires a major").toBe(1);
    const text = ds.map(diagnosticText).join("\n");
    for (const reason of inferred.reasons) {
      expect(text, `the diagnostic drops the engine's reason "${reason}"`).toContain(reason);
    }
  });

  it("AC-1 refuses at error severity, because a refusal a caller may ignore is not a refusal", async () => {
    const fn = await checkDeclaredBump();
    const inferred = inferBump(PUBLISHED_CARD, BREAKING_EDIT);
    const ds = asDiagnostics(fn(CARD, "1.0.0", "1.1.0", inferred), WHERE);

    // Now stated by the contract. It was derived, in the first round, from B-03 putting data
    // and diagnostics together at 200 — which makes `hasErrors` the only thing separating
    // "this release is refused" from "here is a note about it".
    expect(ds.every((d) => d.severity === "error")).toBe(true);
    expect(hasErrors(ds), "a warning does not refuse anything").toBe(true);
  });

  it("AC-1 accepts the same change once the author declares the major", async () => {
    const fn = await checkDeclaredBump();
    const inferred = inferBump(PUBLISHED_CARD, card({ ...BREAKING_EDIT, version: "2.0.0" }));
    expect(inferred.level).toBe("major");

    expect(asDiagnostics(fn(CARD, "1.0.0", "2.0.0", inferred), WHERE)).toEqual([]);
  });

  it("AC-1 holds every consecutive pair of a chain, and refuses only the step that is short", async () => {
    const fn = await checkDeclaredBump();
    // 1.0.0 → 1.1.0 adds an optional input (minor, declared minor: fine)
    // 1.1.0 → 1.2.0 removes an output (major, declared minor: refused)
    // 1.2.0 → 2.0.0 rewords the name (patch, declared major: more than enough)
    const withHint = [{ name: "task", type: "text" }, { name: "hint", type: "text", required: false }];
    const chain = [
      card({ version: "1.0.0" }),
      card({ version: "1.1.0", inputs: withHint }),
      card({ version: "1.2.0", inputs: withHint, outputs: [] }),
      card({ version: "2.0.0", inputs: withHint, outputs: [], name: "Solver II" }),
    ];

    const refused = chain.slice(1).map((next, i) => {
      const previous = chain[i];
      const ds = asDiagnostics(fn(CARD, previous.version, next.version, inferBump(previous, next)), WHERE);
      return { step: `${previous.version} → ${next.version}`, count: ds.length };
    });

    expect(refused).toEqual([
      { step: "1.0.0 → 1.1.0", count: 0 },
      { step: "1.1.0 → 1.2.0", count: 1 },
      { step: "1.2.0 → 2.0.0", count: 0 },
    ]);
  });
});

describe("checkDeclaredBump: `subject` picks the code, and the function owns the mapping", () => {
  it.each(Object.keys(SUBJECT_CODES) as Subject[])(
    "codes a refused %s release as its own `version-bump-too-small`",
    async (subject) => {
      const fn = await checkDeclaredBump();
      const ds = asDiagnostics(
        fn(subject, "1.0.0", "1.1.0", analysis("major", ["output `answer` was removed"])),
        WHERE,
      );

      expect(ds.length).toBe(1);
      expect(
        ds[0].code,
        `backend.md §T025 maps \`subject\` to the code; "${subject}" is ${SUBJECT_CODES[subject]}`,
      ).toBe(SUBJECT_CODES[subject]);
      expect(ds[0].severity).toBe("error");
    },
  );

  it("carries the engine's reasons whichever subject is being judged", async () => {
    const fn = await checkDeclaredBump();
    for (const subject of Object.keys(SUBJECT_CODES) as Subject[]) {
      const ds = asDiagnostics(fn(subject, "1.0.0", "1.1.0", analysis("major", ["term `agent` was removed"])), WHERE);
      expect(ds.map(diagnosticText).join("\n")).toContain("term `agent` was removed");
    }
  });

  it("accepts a sufficient bump whichever subject is being judged", async () => {
    const fn = await checkDeclaredBump();
    for (const subject of Object.keys(SUBJECT_CODES) as Subject[]) {
      expect(asDiagnostics(fn(subject, "1.0.0", "2.0.0", analysis("major", ["gone"])), WHERE)).toEqual([]);
    }
  });

  it.each([
    { name: "a subject outside the union", subject: "blueprint" },
    { name: "the empty string", subject: "" },
    { name: "undefined", subject: undefined },
    { name: "null", subject: null },
    { name: "a number", subject: 0 },
  ])("does not accept a release judged under $name", async ({ subject }) => {
    const fn = await checkDeclaredBump();
    // The union is closed. A subject outside it leaves the function with no code to emit,
    // which is the exact hole the parameter was added to close — so it may not answer "fine".
    neverSilentlyAccepts(() => fn(subject, "1.0.0", "1.1.0", analysis("major", ["gone"])), WHERE);
  });
});

describe("checkDeclaredBump: what `at least the inferred level` means", () => {
  it("accepts a declaration stronger than the change requires", async () => {
    const fn = await checkDeclaredBump();
    expect(asDiagnostics(fn(CARD, "1.0.0", "2.0.0", analysis("patch", ["`notes` changed"])), WHERE)).toEqual([]);
  });

  it("refuses a patch declared against an inferred minor", async () => {
    const fn = await checkDeclaredBump();
    const ds = asDiagnostics(fn(CARD, "1.0.0", "1.0.1", analysis("minor", ["output `draft` was added"])), WHERE);
    expect(ds.length).toBe(1);
    expect(ds.map(diagnosticText).join("\n")).toContain("output `draft` was added");
  });

  it("refuses a version that did not move at all", async () => {
    const fn = await checkDeclaredBump();
    const ds = asDiagnostics(fn(CARD, "1.0.0", "1.0.0", analysis("patch", ["`notes` changed"])), WHERE);
    expect(ds.length, "an unchanged version declares no bump, and the change requires a patch").toBe(1);
  });

  it("refuses a version that went backwards", async () => {
    const fn = await checkDeclaredBump();
    const ds = asDiagnostics(fn(CARD, "2.0.0", "1.0.0", analysis("patch", ["`notes` changed"])), WHERE);
    expect(ds.length).toBe(1);
  });

  it("accepts anything when the engine inferred `none`", async () => {
    const fn = await checkDeclaredBump();
    // `none` is the floor of `@/lib/core`'s BumpLevel, so every declaration is at least it.
    expect(asDiagnostics(fn(CARD, "1.0.0", "1.0.1", analysis("none")), WHERE)).toEqual([]);
    expect(asDiagnostics(fn(CARD, "1.0.0", "1.0.0", analysis("none")), WHERE)).toEqual([]);
  });

  it("refuses a major change even when the engine handed over no reasons", async () => {
    const fn = await checkDeclaredBump();
    // A refusal keyed off `reasons.length` would let this through. The level is the rule;
    // the reasons are how the refusal is explained.
    const ds = asDiagnostics(fn(CARD, "1.0.0", "1.1.0", analysis("major")), WHERE);
    expect(ds.length).toBe(1);
  });
});

describe("checkDeclaredBump: malformed and boundary versions", () => {
  const unparseable = ["v2.0.0", "2.0", "latest", "", "  2.0.0  ", "01.0.0", "2.0.0.0", "-1.0.0"];

  it.each(unparseable)("refuses a major change declared as %j, which is not a semver", async (declared) => {
    const fn = await checkDeclaredBump();
    const ds = asDiagnostics(fn(CARD, "1.0.0", declared, analysis("major", ["output `answer` was removed"])), WHERE);
    expect(
      ds.length,
      `${JSON.stringify(declared)} is not a version at all, so it is not "at least" a major bump`,
    ).toBe(1);
  });

  it.each(unparseable)("refuses a major change published on top of %j, which is not a semver", async (previous) => {
    const fn = await checkDeclaredBump();
    const ds = asDiagnostics(fn(CARD, previous, "2.0.0", analysis("major", ["output `answer` was removed"])), WHERE);
    expect(
      ds.length,
      `a bump from ${JSON.stringify(previous)} cannot be shown to be a major, so it is not accepted`,
    ).toBe(1);
  });

  it("refuses when both versions are the empty string", async () => {
    const fn = await checkDeclaredBump();
    const ds = asDiagnostics(fn(CARD, "", "", analysis("major", ["output `answer` was removed"])), WHERE);
    expect(ds.length).toBe(1);
  });

  it("accepts the smallest possible patch, 0.0.0 → 0.0.1", async () => {
    const fn = await checkDeclaredBump();
    expect(asDiagnostics(fn(CARD, "0.0.0", "0.0.1", analysis("patch", ["`notes` changed"])), WHERE)).toEqual([]);
  });

  it("accepts 0.9.9 → 0.10.0 as a minor, which a string comparison would call a downgrade", async () => {
    const fn = await checkDeclaredBump();
    expect(asDiagnostics(fn(CARD, "0.9.9", "0.10.0", analysis("minor", ["output `draft` was added"])), WHERE)).toEqual(
      [],
    );
  });

  it("accepts a major across a boundary no 32-bit counter survives", async () => {
    const fn = await checkDeclaredBump();
    expect(
      asDiagnostics(
        fn(CARD, "4294967295.0.0", "4294967296.0.0", analysis("major", ["output `answer` was removed"])),
        WHERE,
      ),
    ).toEqual([]);
  });

  it("refuses a major when the author only promoted a prerelease", async () => {
    const fn = await checkDeclaredBump();
    // semver §11 orders 1.0.0-rc.1 below 1.0.0, so the release components are equal and the
    // promotion is a patch at most — not a major.
    const ds = asDiagnostics(
      fn(CARD, "1.0.0-rc.1", "1.0.0", analysis("major", ["output `answer` was removed"])),
      WHERE,
    );
    expect(ds.length).toBe(1);
  });

  it("accepts a major declared as a prerelease of the next major", async () => {
    const fn = await checkDeclaredBump();
    expect(
      asDiagnostics(fn(CARD, "1.0.0", "2.0.0-rc.1", analysis("major", ["output `answer` was removed"])), WHERE),
    ).toEqual([]);
  });
});

describe("checkDeclaredBump: unreadable input is never a silent acceptance", () => {
  it.each([
    { name: "null", inferred: null },
    { name: "undefined", inferred: undefined },
    { name: "an object with no level", inferred: {} },
    { name: "a level nothing in BumpLevel names", inferred: { level: "breaking", reasons: [] } },
    { name: "a string", inferred: "major" },
    { name: "an array", inferred: [] },
  ])("does not accept a release against $name as the inferred analysis", async ({ inferred }) => {
    const fn = await checkDeclaredBump();
    neverSilentlyAccepts(() => fn(CARD, "1.0.0", "1.0.1", inferred), WHERE);
  });

  it.each([
    { name: "null", declared: null },
    { name: "undefined", declared: undefined },
    { name: "a number", declared: 2 },
  ])("does not accept a major change declared as $name", async ({ declared }) => {
    const fn = await checkDeclaredBump();
    neverSilentlyAccepts(
      () => fn(CARD, "1.0.0", declared, analysis("major", ["output `answer` was removed"])),
      WHERE,
    );
  });
});

describe("checkDeclaredBump: unicode, purity and repetition", () => {
  it("carries a reason through verbatim, whatever is in it", async () => {
    const fn = await checkDeclaredBump();
    const reasons = [
      "output `réponse` was removed",
      "输出 `答案` 已被移除",
      "input `naïve-café` changed type: texte → 📄",
      "output `\u{1D11E}` was removed",
    ];
    const ds = asDiagnostics(fn(CARD, "1.0.0", "1.0.1", analysis("major", reasons)), WHERE);
    const text = ds.map(diagnosticText).join("\n");
    for (const reason of reasons) expect(text).toContain(reason);
  });

  it("does not touch the analysis it was handed", async () => {
    const fn = await checkDeclaredBump();
    const inferred = deepFreeze(analysis("major", ["output `answer` was removed"]));
    expect(() => fn(CARD, "1.0.0", "1.1.0", inferred)).not.toThrow();
    expect(inferred.reasons).toEqual(["output `answer` was removed"]);
  });

  it("gives every caller its own array, so one caller cannot poison the next", async () => {
    const fn = await checkDeclaredBump();
    const first = asDiagnostics(fn(CARD, "1.0.0", "2.0.0", analysis("major", ["output `answer` was removed"])), WHERE);
    expect(first).toEqual([]);
    try {
      (first as unknown[]).push({ code: "card/version-bump-too-small", severity: "error", message: "injected" });
    } catch {
      return; // a frozen constant is a fine way to be immune to this
    }
    const second = asDiagnostics(
      fn(CARD, "1.0.0", "2.0.0", analysis("major", ["output `answer` was removed"])),
      WHERE,
    );
    expect(second, "a second call returned the array the first call's caller mutated").toEqual([]);
  });

  it("answers a repeated call identically", async () => {
    const fn = await checkDeclaredBump();
    const inferred = inferBump(PUBLISHED_CARD, BREAKING_EDIT);
    const runs = Array.from({ length: 5 }, () => asDiagnostics(fn(CARD, "1.0.0", "1.1.0", inferred), WHERE));
    for (const run of runs) expect(run).toEqual(runs[0]);
  });

  it("does not let one subject's refusal leak into the next subject's", async () => {
    const fn = await checkDeclaredBump();
    const inferred = analysis("major", ["output `answer` was removed"]);
    const alone = Object.fromEntries(
      (Object.keys(SUBJECT_CODES) as Subject[]).map((s) => [
        s,
        asDiagnostics(fn(s, "1.0.0", "1.1.0", inferred), WHERE),
      ]),
    );

    for (let i = 0; i < 10; i += 1) {
      for (const subject of Object.keys(SUBJECT_CODES) as Subject[]) {
        expect(asDiagnostics(fn(subject, "1.0.0", "1.1.0", inferred), WHERE)).toEqual(alone[subject]);
      }
    }
  });
});
