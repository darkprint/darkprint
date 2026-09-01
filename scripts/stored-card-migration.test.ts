/* ============================================================
   The stored-card migration transforms exactly three things
   `scripts/migrate-stored-cards.ts` rewrites 58 `card_version`
   rows and 16 `release` rows in place, bypassing `addCard` and
   `addRelease` because neither has an update path. The one thing
   standing between that and a corrupted registry is that the
   transform itself is a pure function with no database in it —
   so it is exercised here, on fixtures shaped like the corpus,
   before it is pointed at anything.

   What these cases are for, one by one:

   * The mixed case is D-101's whole point. `code-builder@1.0.0`
     is the real card it is drawn from: `acceptance-criteria` is a
     `data-type` the resolver ENFORCES on every incoming edge, and
     the sentence beside it is a promise the engine can only read.
     A transform that moved both, or kept both, erases exactly the
     distinction the split was made for.

   * The all-prose case is 55 of the 57 archive cards. It is the
     one that has to emit `cannot: []` rather than leaving a
     dangling `cannot:` header with no entries under it.

   * The already-empty case is the one where the right answer is
     to change nothing at all. A transform that unconditionally
     appends `will_not:` would write an empty block here.

   * The retired-field cases are D-92 and D-93. They are WARNINGS
     to the validator, not errors, so nothing else in the suite
     would notice if they survived.

   And the negative half, which matters more: the entry counts are
   asserted on BOTH sides of the split, because a transform that
   deleted the 85 prose sentences instead of moving them satisfies
   every shape check, every digest check, and `storedCardGaps` —
   the resulting cards are internally perfect and silently claim
   the nodes refuse nothing. Only a count can see it.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, cardDigest, loadCard, ontologyView, type NodeCard, type OntologyView } from "@/lib/core";
import {
  CardMigrationRefusal,
  censusOf,
  dollarQuoted,
  jsonbLiteral,
  migrateCardBody,
  migrateCardSource,
  splitProhibitions,
  textArrayLiteral,
} from "./stored-card-migration.ts";

const ontology: OntologyView = ontologyView(CORE_ONTOLOGY);

/**
 * A card in the corpus's exact layout: folded scalars, the blank line before `risk_markers`,
 * `ontology_version` last. `PROHIBITIONS` is spliced in so every case below differs from the
 * others in one region only, which is what lets the byte-preservation assertions mean
 * something.
 */
function fixture(prohibitions: string): string {
  return [
    "id: probe-node",
    "name: Probe node",
    "type: validation",
    "phase: testing",
    "",
    "action: >-",
    "  Read the submitted change and say whether it holds, without quoting what it was judged",
    "  against.",
    "spec: >-",
    "  You are handed a change and a set of conditions. Run each condition against the change in",
    "  turn and record whether it held. Emit the change unaltered when every one of them holds.",
    "tools: []",
    "mcp: []",
    "params:",
    "  stop_on_first_failure: false",
    "",
    "inputs:",
    "  - name: criteria",
    "    type: acceptance-criteria",
    "    description: The conditions the change is judged against.",
    "outputs:",
    "  - name: approved",
    "    type: artifact",
    "    description: The change unaltered, once every condition has held.",
    "dependencies: []",
    prohibitions,
    "",
    "requires_human: false",
    "risk_markers: []",
    "notes: >-",
    "  Doc 2 §5.5: seeing the conditions lets a node write work built to pass them. The `cannot`",
    "  entry is the enforced half and the `will_not` entry is the stated half.",
    "",
    "version: 1.0.0",
    "author: orin",
    "ontology_version: 0.1.0",
    "",
  ].join("\n");
}

/** The body a card of that shape parses to, before the migration. */
function storedBody(cannot: readonly string[]): Record<string, unknown> {
  return {
    id: "probe-node",
    name: "Probe node",
    type: "validation",
    phases: ["testing"],
    action: "Read the submitted change and say whether it holds.",
    spec: "You are handed a change and a set of conditions.",
    tools: [],
    mcp: [],
    params: { stop_on_first_failure: false },
    inputs: [{ name: "criteria", type: "acceptance-criteria", description: "The conditions." }],
    outputs: [{ name: "approved", type: "artifact", description: "The change unaltered." }],
    dependencies: [],
    cannot: [...cannot],
    riskMarkers: [],
    notes: "Doc 2 §5.5.",
    version: "1.0.0",
    author: "orin",
    requiresHuman: false,
    ontologyVersion: "0.1.0",
  };
}

const MIXED = ["acceptance-criteria", "read the checks the work will be run against"];
const ALL_PROSE = ["quote a criterion in the evidence it emits", "edit the mitigation it judges"];

describe("splitProhibitions", () => {
  it("keeps an ontology `data-type` in `cannot` and moves a sentence to `willNot`", () => {
    expect(splitProhibitions(MIXED, ontology)).toEqual({
      cannot: ["acceptance-criteria"],
      willNot: ["read the checks the work will be run against"],
    });
  });

  it("moves everything when no entry names a `data-type`", () => {
    expect(splitProhibitions(ALL_PROSE, ontology)).toEqual({ cannot: [], willNot: [...ALL_PROSE] });
  });

  it("returns two empty lists for an empty list", () => {
    expect(splitProhibitions([], ontology)).toEqual({ cannot: [], willNot: [] });
  });

  /* `checkTerm` pins `cannot` to `data-type` and reports any other kind as
     `card/wrong-term-kind`, an ERROR. So a `tool` or a `phase` left in `cannot` would make
     the migrated card unloadable, which is the state the migration exists to leave. */
  it("moves a real term of the wrong kind, because `cannot` is pinned to `data-type`", () => {
    expect(splitProhibitions(["web-search", "planning", "report"], ontology)).toEqual({
      cannot: ["report"],
      willNot: ["web-search", "planning"],
    });
  });

  it("preserves order inside each half and loses nothing", () => {
    const entries = ["report", "a", "acceptance-criteria", "b", "code", "c"];
    const split = splitProhibitions(entries, ontology);
    expect(split.cannot).toEqual(["report", "acceptance-criteria", "code"]);
    expect(split.willNot).toEqual(["a", "b", "c"]);
    expect([...split.cannot, ...split.willNot].sort()).toEqual([...entries].sort());
  });
});

describe("migrateCardSource", () => {
  it("splits a mixed `cannot` block and leaves every other byte alone", () => {
    const before = fixture(["cannot:", "  - acceptance-criteria", "  - read the checks the work will be run against"].join("\n"));
    const after = migrateCardSource("probe-node@1.0.0", before, ontology);

    expect(after).toContain("cannot:\n  - acceptance-criteria\nwill_not:\n  - read the checks the work will be run against\n");
    // The blank line that followed the block, and the key after it, are untouched.
    expect(after).toContain("  - read the checks the work will be run against\n\nrisk_markers: []");
    expect(after.endsWith("author: orin\n")).toBe(true);
    // Everything outside the three edited regions is byte-identical.
    expect(after.split("\n").filter((l) => !l.startsWith("cannot") && !l.startsWith("will_not") && !l.startsWith("  - "))).toEqual(
      before.split("\n").filter((l) => !l.startsWith("cannot") && !l.startsWith("  - ") && !l.startsWith("requires_human") && !l.startsWith("ontology_version")),
    );
  });

  it("collapses `cannot` to the empty flow sequence when every entry is prose", () => {
    const before = fixture(["cannot:", ...ALL_PROSE.map((e) => `  - ${e}`)].join("\n"));
    const after = migrateCardSource("probe-node@1.0.0", before, ontology);

    expect(after).toContain(`cannot: []\nwill_not:\n  - ${ALL_PROSE[0]}\n  - ${ALL_PROSE[1]}\n`);
    expect(after).not.toContain("cannot:\n");
  });

  it("writes no `will_not` block for a card whose `cannot` was already empty", () => {
    const before = fixture("cannot: []");
    const after = migrateCardSource("probe-node@1.0.0", before, ontology);

    expect(after).toContain("dependencies: []\ncannot: []\n\nrisk_markers: []");
    // The prose in `notes` names the field, so this asks about a KEY line and not a substring.
    expect(after.split("\n").some((l) => l.startsWith("will_not"))).toBe(false);
  });

  it("deletes both retired keys, in both spellings, wherever they sit", () => {
    const before = fixture("cannot: []").replace("requires_human: false\n", "requiresHuman: false\nontologyVersion: 0.1.0\n");
    const after = migrateCardSource("probe-node@1.0.0", before, ontology);

    for (const key of ["requires_human", "requiresHuman", "ontology_version", "ontologyVersion"]) {
      expect(after.split("\n").some((l) => l.startsWith(`${key}:`)), key).toBe(false);
    }
  });

  /* A retired key is only retired at the top level. `notes` quotes `requires_human` in prose
     and an indented line inside a folded scalar is content, not a key: deleting one would
     silently rewrite a card's own explanation of why the field went away. */
  it("leaves the retired names alone where they are prose rather than keys", () => {
    const before = fixture("cannot: []").replace(
      "  entry is the enforced half and the `will_not` entry is the stated half.",
      "  requires_human: this sentence is inside a folded scalar and is not a key.",
    );
    const after = migrateCardSource("probe-node@1.0.0", before, ontology);
    expect(after).toContain("  requires_human: this sentence is inside a folded scalar and is not a key.");
  });

  it("produces a card the engine loads with no diagnostics at all", () => {
    const before = fixture(["cannot:", "  - acceptance-criteria", "  - read the checks the work will be run against"].join("\n"));
    const loaded = loadCard(migrateCardSource("probe-node@1.0.0", before, ontology), { ontology, format: "yaml" });

    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.card?.cannot).toEqual(["acceptance-criteria"]);
    expect(loaded.card?.willNot).toEqual(["read the checks the work will be run against"]);
  });

  /* The premise of the assertion above: the UNMIGRATED source is refused at error severity,
     so "loads clean" is a statement about the migration and not about the fixture. */
  it("is migrating a source the engine refuses today", () => {
    const before = fixture(["cannot:", "  - acceptance-criteria", "  - read the checks the work will be run against"].join("\n"));
    const loaded = loadCard(before, { ontology, format: "yaml" });

    expect(loaded.card).toBeUndefined();
    expect(loaded.diagnostics.some((d) => d.severity === "error" && d.code === "card/unknown-term")).toBe(true);
    expect(loaded.diagnostics.filter((d) => d.code === "card/retired-field")).toHaveLength(2);
  });

  it("refuses a document that already carries `will_not`", () => {
    const before = fixture(["cannot: []", "will_not:", "  - already migrated"].join("\n"));
    expect(() => migrateCardSource("probe-node@1.0.0", before, ontology)).toThrow(CardMigrationRefusal);
  });

  it("refuses a `cannot` holding a non-empty inline sequence", () => {
    expect(() => migrateCardSource("probe-node@1.0.0", fixture("cannot: [acceptance-criteria]"), ontology)).toThrow(
      /inline sequence/,
    );
  });

  it("refuses a quoted entry, whose text is not what the line holds", () => {
    const before = fixture(["cannot:", '  - "acceptance-criteria"'].join("\n"));
    expect(() => migrateCardSource("probe-node@1.0.0", before, ontology)).toThrow(/quoted, empty or multi-line/);
  });

  it("refuses a source with a carriage return rather than leaving it unmigrated", () => {
    const before = fixture("cannot: []").replaceAll("\n", "\r\n");
    expect(() => migrateCardSource("probe-node@1.0.0", before, ontology)).toThrow(/carriage return/);
  });

  it("refuses a second top-level `cannot` key", () => {
    const before = fixture(["cannot:", "  - acceptance-criteria"].join("\n")) + "cannot: []\n";
    expect(() => migrateCardSource("probe-node@1.0.0", before, ontology)).toThrow(/second column-0/);
  });

  it("names the ref and the line, and quotes none of the card's own text", () => {
    const before = fixture(["cannot:", '  - "acceptance-criteria"'].join("\n"));
    try {
      migrateCardSource("probe-node@1.0.0", before, ontology);
      expect.unreachable("the quoted entry should have been refused");
    } catch (err) {
      expect(err).toBeInstanceOf(CardMigrationRefusal);
      const refusal = err as CardMigrationRefusal;
      expect(refusal.ref).toBe("probe-node@1.0.0");
      expect(refusal.line).toBeGreaterThan(0);
      expect(refusal.message).not.toContain("acceptance-criteria");
    }
  });
});

describe("migrateCardBody", () => {
  it("drops both retired fields and splits `cannot`, leaving every other field alone", () => {
    const before = storedBody(MIXED);
    const after = migrateCardBody("probe-node@1.0.0", before, ontology);

    expect(after.requiresHuman).toBeUndefined();
    expect(after.ontologyVersion).toBeUndefined();
    expect(Object.hasOwn(after, "requiresHuman")).toBe(false);
    expect(Object.hasOwn(after, "ontologyVersion")).toBe(false);
    expect(after.cannot).toEqual(["acceptance-criteria"]);
    expect(after.willNot).toEqual(["read the checks the work will be run against"]);
    for (const field of ["id", "name", "type", "phases", "action", "spec", "params", "inputs", "outputs", "notes", "version", "author"]) {
      expect(after[field], field).toEqual(before[field]);
    }
  });

  it("does not mutate the row it was handed", () => {
    const before = storedBody(MIXED);
    migrateCardBody("probe-node@1.0.0", before, ontology);
    expect(before.cannot).toEqual(MIXED);
    expect(before.requiresHuman).toBe(false);
  });

  it("writes `willNot: []` for a card that has no prohibitions at all", () => {
    const after = migrateCardBody("probe-node@1.0.0", storedBody([]), ontology);
    expect(after.cannot).toEqual([]);
    expect(after.willNot).toEqual([]);
  });

  it("agrees with the source transform on the same card", () => {
    const source = fixture(["cannot:", "  - acceptance-criteria", "  - read the checks the work will be run against"].join("\n"));
    const fromSource = loadCard(migrateCardSource("probe-node@1.0.0", source, ontology), { ontology, format: "yaml" }).card as NodeCard;
    const fromBody = migrateCardBody("probe-node@1.0.0", storedBody(MIXED), ontology);

    expect(fromBody.cannot).toEqual(fromSource.cannot);
    expect(fromBody.willNot).toEqual(fromSource.willNot);
  });

  it("changes the digest, which is why the whole cascade has to move", () => {
    const before = storedBody(MIXED) as unknown as NodeCard;
    const after = migrateCardBody("probe-node@1.0.0", before, ontology) as unknown as NodeCard;
    expect(cardDigest(after)).not.toBe(cardDigest(before));
  });

  it("refuses a body that already carries `willNot`", () => {
    expect(() => migrateCardBody("probe-node@1.0.0", { ...storedBody(MIXED), willNot: [] }, ontology)).toThrow(/already carries/);
  });

  it("refuses a `cannot` that is not a list of strings", () => {
    expect(() => migrateCardBody("probe-node@1.0.0", { ...storedBody([]), cannot: "acceptance-criteria" }, ontology)).toThrow(
      /list of strings/,
    );
  });

  it("refuses a body that is not an object", () => {
    expect(() => migrateCardBody("probe-node@1.0.0", ["not", "a", "card"], ontology)).toThrow(/not a JSON object/);
  });
});

describe("censusOf", () => {
  it("counts what the migration is defined to change, on both sides of it", () => {
    expect(censusOf(storedBody(MIXED))).toEqual({
      retiredKeys: 2,
      hasWillNot: false,
      cannotEntries: 2,
      willNotEntries: 0,
      proseInCannot: 1,
    });
    expect(censusOf(migrateCardBody("probe-node@1.0.0", storedBody(MIXED), ontology))).toEqual({
      retiredKeys: 0,
      hasWillNot: true,
      cannotEntries: 1,
      willNotEntries: 1,
      proseInCannot: 0,
    });
  });

  /* The census is what would catch a transform that DELETED the sentences: everything else
     about the result would be perfect. */
  it("separates a migrated card from one whose prohibitions were dropped", () => {
    const dropped = { ...migrateCardBody("probe-node@1.0.0", storedBody(MIXED), ontology), willNot: [] };
    expect(censusOf(dropped).willNotEntries).toBe(0);
  });
});

describe("SQL literals for the rollback file", () => {
  it("carries a single quote through unescaped", () => {
    expect(dollarQuoted("the builder's first pass")).toBe("$dp$the builder's first pass$dp$");
  });

  it("carries a backslash through unescaped, which a quoted literal would not", () => {
    expect(dollarQuoted("a\\b")).toBe("$dp$a\\b$dp$");
  });

  it("grows the tag until it cannot occur in the value", () => {
    expect(dollarQuoted("ends with $dp$ inside")).toBe("$dpx$ends with $dp$ inside$dpx$");
    expect(dollarQuoted("$dp$ and $dpx$")).toBe("$dpxx$$dp$ and $dpx$$dpxx$");
  });

  it("never emits a delimiter that appears in its own body", () => {
    for (const value of ["", "$", "$$", "$d$", "$dp", "dp$", "$dp$", "$dpx$$dp$", "'; drop table card_version; --"]) {
      const quoted = dollarQuoted(value);
      const tag = quoted.slice(0, quoted.indexOf("$", 1) + 1);
      expect(value.includes(tag), JSON.stringify(value)).toBe(false);
      expect(quoted).toBe(`${tag}${value}${tag}`);
    }
  });

  it("casts an empty array so the column still types", () => {
    expect(textArrayLiteral([])).toBe("ARRAY[]::text[]");
    expect(textArrayLiteral(["sha256:aa", "sha256:bb"])).toBe("ARRAY[$dp$sha256:aa$dp$, $dp$sha256:bb$dp$]::text[]");
  });

  it("renders a null column as the keyword and not as a JSON null", () => {
    expect(jsonbLiteral(null)).toBe("NULL");
    expect(jsonbLiteral(undefined)).toBe("NULL");
    expect(jsonbLiteral({ slug: "smoke-checker" })).toBe('$dp${"slug":"smoke-checker"}$dp$::jsonb');
  });
});
