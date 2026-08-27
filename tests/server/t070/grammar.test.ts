/* ============================================================
   T070 — the three pure functions

   `isReservedSlug`, `validateCardId` and `validateNamespace` take no
   `Db`, so nothing in this file can be satisfied by an outcome
   Postgres would have produced anyway. T-03's species — a test
   asserting what the storage layer already guarantees — has no way
   in here, and that is worth stating rather than assuming: it is the
   trap this run has now hit four times.

   ── where the expectations come from ──
   The contract does not restate a grammar. It cites one:

     "Ids must satisfy the engine's grammars (`CARD_ID`,
      `REF_VERSION`, `lib/core/card/schema.ts:167,174`) so a stored
      id is one a DOT node can pin."

   `CARD_ID` is `/^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/`
   — an optional namespace segment, a separator, and a local segment,
   each of them lowercase alphanumerics joined by single interior
   hyphens. It is `const`, not exported, so T070 cannot import it and
   this suite does not either; both sides read the same published
   sentence. `validateNamespace` is held to that same segment shape,
   which is the only reading the citation supports.

   ── what is NOT asserted, and why ──
   * No diagnostic CODE is pinned. The contract publishes none for
     either grammar, and `card/bad-id` is a plausible guess rather
     than a stated one. What is pinned is severity: an id the grammar
     rejects produces at least one `error`, and one it accepts
     produces none.
   * Surrounding whitespace IS here now, and round 1's reason for
     leaving it out is what D-70-04 overturned. Round 1 argued that
     `parseCardRef` trims "because refs arrive from hand-written DOT
     attributes", so trimming before matching was defensible. The
     ruling says the opposite and gives the mechanism: the check
     **round-trips** rather than parses, because "a bare
     `!== undefined` accepts `\" mara-veil\"` and reserves
     `mara-veil`, a different primary key from the one asked for,
     substituted with nothing reporting it". A name is legal only if
     `cardRef(parseCardRef(x))` is `x` again.
   * `REF_VERSION` is cited by the contract and reached by no
     published function — nothing in the signature block takes a
     version. Reported to the orchestrator, not tested around.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { RESERVED_PROFILE_SEGMENTS } from "@/components/profile/tabs";

import { asDiagnostics, bind, errorsOf } from "./contract";

/* ============================================================
   AC1's pure half: `isReservedSlug`
   ============================================================ */

describe("isReservedSlug: the four segments the profile tabs occupy", () => {
  /* Quantified over the set by CONSTRUCTION rather than over four literals. The contract asks
     for exactly this — "read them from that module rather than restating the list, so the
     profile tabs and this guard cannot drift" — so a fifth tab added to `tabs.ts` extends this
     test on its own instead of leaving a silently uncovered segment. */
  for (const segment of RESERVED_PROFILE_SEGMENTS) {
    it(`reserves \`${segment}\`, which is a profile tab's route segment`, async () => {
      const isReserved = await bind("isReservedSlug");
      expect(isReserved(segment)).toBe(true);
    });
  }

  it("covers the three segments backend.md §T070 names, and no others exist to cover", () => {
    /* A check on `components/profile/tabs.ts` rather than on T070: it states what the loop
       above currently ranges over, so the coverage claim cannot go stale silently. §T070 (T280
       revision): "The three reserved slugs are `cards`, `saved`, `terms`." Blueprints moved to
       the segmentless index at T280, so a red here means the tabs changed and §T070's list has
       to change with them. */
    expect([...RESERVED_PROFILE_SEGMENTS].sort()).toEqual(["cards", "saved", "terms"]);
  });

  it("does not reserve `blueprints`, whose tab has no segment of its own", async () => {
    /* The discriminating case, and the reason the loop above reads `RESERVED_PROFILE_SEGMENTS`
       and not `PROFILE_TABS`. Blueprints is the index as of T280 — `profileTabHref` sends it to
       `/u/<handle>` with an empty segment — so `/u/<handle>/blueprints` collides with nothing
       and a bundle may be called `blueprints`. An implementation built from the tab *ids*
       rather than their *segments* reserves a fourth name nobody asked it to. */
    const isReserved = await bind("isReservedSlug");
    expect(isReserved("blueprints")).toBe(false);
  });

  const ORDINARY = [
    "frontline-triage",
    "blueprint", // singular, and never reserved either way
    "overview", // the retired tab id: free the day the segment stopped being taken
    "card",
    "save",
    "term",
    "blueprints-2", // a prefix match, not an equal one
    "my-cards", // a suffix match, not an equal one
    "saved-searches",
  ];
  for (const slug of ORDINARY) {
    it(`does not reserve \`${slug}\``, async () => {
      /* Half of these are near-misses on purpose. A guard written with `startsWith`,
         `includes` or a singular/plural fold refuses names the product promised were free, and
         a criterion phrased only as "each reserved slug is refused" cannot see that: it has no
         case where the answer must be `false`. */
      const isReserved = await bind("isReservedSlug");
      expect(isReserved(slug)).toBe(false);
    });
  }

  it("answers `boolean` for every one of them, never a truthy stand-in", async () => {
    const isReserved = await bind("isReservedSlug");
    for (const slug of [...RESERVED_PROFILE_SEGMENTS, ...ORDINARY, "blueprints"]) {
      expect(isReserved(slug), `isReservedSlug(${JSON.stringify(slug)})`).toBeTypeOf("boolean");
    }
  });
});

/* ============================================================
   `validateCardId`
   ============================================================ */

const VALID_IDS = [
  "solver-a",
  "a",
  "a1",
  "1a",
  "solver",
  "a-b-c",
  "x1-y2",
  "mara-veil/frontline-triage", // the optional namespace segment `CARD_ID` admits
  "ns/x",
];

const INVALID_IDS: ReadonlyArray<readonly [string, string]> = [
  ["", "empty"],
  ["Solver-A", "uppercase"],
  ["solver_a", "an underscore"],
  ["-solver", "a leading hyphen"],
  ["solver-", "a trailing hyphen"],
  ["solver--a", "a doubled hyphen: `-` must be followed by `[a-z0-9]+`"],
  ["a/b/c", "two namespace separators"],
  ["/solver", "an empty namespace segment"],
  ["solver/", "an empty local segment"],
  ["solver a", "interior whitespace"],
  [" solver-a", "a leading space: `parseCardRef` TRIMS, so this does not round-trip (D-70-04)"],
  ["solver-a ", "a trailing space, the same way"],
  ["\tsolver-a", "a leading tab, which `String.prototype.trim` also removes"],
  ["solver.a", "a dot"],
  ["sólver", "a character outside `[a-z0-9-]`"],
  ["solver\u0000a", "a NUL, written as an escape rather than a literal byte (T-01)"],
];

describe("validateCardId: the grammar a DOT node can pin", () => {
  for (const id of VALID_IDS) {
    it(`accepts \`${id}\``, async () => {
      const validate = await bind("validateCardId");
      const diagnostics = asDiagnostics(validate(id), `validateCardId(${JSON.stringify(id)})`);
      expect(
        errorsOf(diagnostics).map((d) => `${d.code}: ${d.message}`),
        `\`${id}\` matches CARD_ID, so nothing here is an error`,
      ).toEqual([]);
    });
  }

  for (const [id, why] of INVALID_IDS) {
    it(`refuses ${JSON.stringify(id)} — ${why}`, async () => {
      const validate = await bind("validateCardId");
      const diagnostics = asDiagnostics(validate(id), `validateCardId(${JSON.stringify(id)})`);
      expect(
        errorsOf(diagnostics).length,
        `${JSON.stringify(id)} does not match CARD_ID (${why}), so validateCardId reports at ` +
          `least one error-severity diagnostic. It returned ${JSON.stringify(diagnostics)}.`,
      ).toBeGreaterThan(0);
    });
  }
});

/* ============================================================
   `validateNamespace`
   ============================================================ */

const VALID_NAMESPACES = ["mara-veil", "ns", "a1", "x-y-z", "berti", "1a"];

const INVALID_NAMESPACES: ReadonlyArray<readonly [string, string]> = [
  ["", "empty"],
  ["Mara", "uppercase"],
  ["mara_veil", "an underscore"],
  ["-mara", "a leading hyphen"],
  ["mara-", "a trailing hyphen"],
  ["mara--veil", "a doubled hyphen"],
  ["mara/veil", "a separator: a namespace is one segment, and `splitTermId` reads the first `/`"],
  ["mara veil", "interior whitespace"],
  [" mara-veil", "a leading space, which does not round-trip (D-70-04)"],
  ["mara-veil ", "a trailing space, the same way"],
  ["mara.veil", "a dot"],
  ["márá", "a character outside `[a-z0-9-]`"],
  ["ma\u0000ra", "a NUL, written as an escape rather than a literal byte (T-01)"],
];

describe("validateNamespace: the segment a term id may be published under", () => {
  for (const namespace of VALID_NAMESPACES) {
    it(`accepts \`${namespace}\``, async () => {
      const validate = await bind("validateNamespace");
      const diagnostics = asDiagnostics(
        validate(namespace),
        `validateNamespace(${JSON.stringify(namespace)})`,
      );
      expect(errorsOf(diagnostics).map((d) => `${d.code}: ${d.message}`)).toEqual([]);
    });
  }

  for (const [namespace, why] of INVALID_NAMESPACES) {
    it(`refuses ${JSON.stringify(namespace)} — ${why}`, async () => {
      const validate = await bind("validateNamespace");
      const diagnostics = asDiagnostics(
        validate(namespace),
        `validateNamespace(${JSON.stringify(namespace)})`,
      );
      expect(
        errorsOf(diagnostics).length,
        `${JSON.stringify(namespace)} is not a legal namespace segment (${why}). It returned ` +
          `${JSON.stringify(diagnostics)}.`,
      ).toBeGreaterThan(0);
    });
  }
});

/* ============================================================
   The two grammars against each other
   ============================================================ */

describe("the namespace grammar and the card-id grammar are the same grammar", () => {
  /* A property over the outputs of both functions, quantified over a set built by construction
     from the two lists above rather than over hand-picked pairs. `CARD_ID`'s namespace segment
     and its local segment have the same shape, so `validateNamespace(n)` and
     `validateCardId(n + "/solver-a")` cannot disagree about `n` without one of them being
     wrong — and this catches the drift in whichever of the two is the one that drifted, which
     neither function's own tests can do on their own. */

  for (const namespace of VALID_NAMESPACES) {
    it(`accepts \`${namespace}/solver-a\` because it accepts the namespace \`${namespace}\``, async () => {
      const validateId = await bind("validateCardId");
      const id = `${namespace}/solver-a`;
      const diagnostics = asDiagnostics(validateId(id), `validateCardId(${JSON.stringify(id)})`);
      expect(errorsOf(diagnostics).map((d) => `${d.code}: ${d.message}`)).toEqual([]);
    });
  }

  for (const [namespace, why] of INVALID_NAMESPACES) {
    it(`refuses ${JSON.stringify(namespace + "/solver-a")} because it refuses the namespace ${JSON.stringify(namespace)} — ${why}`, async () => {
      const validateId = await bind("validateCardId");
      const id = `${namespace}/solver-a`;
      const diagnostics = asDiagnostics(validateId(id), `validateCardId(${JSON.stringify(id)})`);
      expect(
        errorsOf(diagnostics).length,
        `the namespace segment ${JSON.stringify(namespace)} is illegal (${why}), so the id ` +
          `${JSON.stringify(id)} built from it is illegal too.`,
      ).toBeGreaterThan(0);
    });
  }
});
