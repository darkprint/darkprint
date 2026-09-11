/* ============================================================
   T260 / D-260-01 — the exported surface of `TermTable.tsx`

   TWO ROUTES T260 IS FORBIDDEN TO TOUCH IMPORT FROM A FILE T260
   OWNS, AND NOTHING IN THE REPOSITORY HOLDS THAT.

   `components/ontology/canonical-route.test.ts` and
   `weight-provenance.test.ts` sit INSIDE `components/ontology/**`,
   which is T260's `Owns`, so the only existing guards over this
   surface are deletable by the task they constrain. That is
   reported separately; this file is the guard that lives outside.

   ── what is asserted, and why it is not one big pin ──
   D-260-01 forbids four distinct things — changing, renaming,
   removing, or altering the signature or semantics — and they fail
   in different ways with different repairs:

     * REMOVED   caught by the source cell and by the consumer cell,
                 as an absent export naming the file that wants it.
     * RENAMED   the same two, because a rename is a removal at the
                 old name.
     * SIGNATURE the arity cells and the type-level pin.
     * SEMANTICS the behaviour cells, which are the bulk of this
                 file and the only ones a rename cannot reach.

   A single "the module still has these members" cell would pass a
   `markerWeight` that returned the wrong number, and a single
   golden would pass a `markerWeight` that had swapped its two
   lookup steps — see `contract.ts` on why that swap is invisible
   on every term that ships.

   ── the module is bound INSIDE each cell ──
   Removing an export is the principal violation, and a static
   import of a removed member takes the whole FILE down before any
   cell runs. The suite has to be loudest on the thing it exists
   for, not silent. See `contract.ts`.
   ============================================================ */

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { getRegistry } from "@/lib/content";
import { DARKPRINT_CONFIG } from "@/lib/core";
import {
  CONFIGURED_WEIGHTS,
  FORBIDDEN_CONSUMERS,
  TERM_TABLE,
  expectedWeight,
  riskTerm,
  sources,
  termTable,
} from "./contract";

/* ============================================================
   1. THE PREMISE: THE FILE, AND WHAT THE CONSUMERS ASK OF IT
   ============================================================ */

/**
 * Every name the two Forbidden routes take out of `TermTable.tsx`, pinned at `3daa325`.
 *
 * **D-260-01 names three of these; the import statement is SIX values and a type.** The
 * ruling quotes `app/ontology/[...term]/page.tsx:16` with an ellipsis and then freezes
 * `formatWeight`, `markerWeight` and `termUsageIndex` by name, which leaves `NO_USAGE`,
 * `TERM_KIND_META`, `TermKindBadge` and `type TermUsage` unprotected while a Forbidden
 * route imports all four. Reported to the orchestrator; pinned here meanwhile, because a
 * suite that waits for a ruling to cover a hole it can already see is a suite that watched.
 *
 * `TermUsage` is the one that is not merely tidiness: `narrowerReach` is declared IN the
 * Forbidden route as `(view, index: ReadonlyMap<string, TermUsage>, term)`
 * (`app/ontology/[...term]/page.tsx:113-115`), so reshaping it is a compile error inside a
 * file T260 may not fix — and it silently changes `termUsageIndex`'s SEMANTICS, which the
 * ruling does freeze.
 */
const CONSUMED_VALUES = [
  "NO_USAGE",
  "TERM_KIND_META",
  "TermKindBadge",
  "formatWeight",
  "markerWeight",
  "termUsageIndex",
] as const;

const CONSUMED_TYPES = ["TermUsage"] as const;

/** The three D-260-01 freezes by name, so a red says which list the missing name was on. */
const RULED_FROZEN = ["formatWeight", "markerWeight", "termUsageIndex"] as const;

function exportedNames(path: string, raw: string): Set<string> {
  const sf = ts.createSourceFile(path, raw, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>();
  const add = (node: ts.Node | undefined) => {
    if (node !== undefined && ts.isIdentifier(node)) names.add(node.text);
  };
  const exported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  const walk = (node: ts.Node) => {
    if (ts.isVariableStatement(node) && exported(node)) {
      for (const declaration of node.declarationList.declarations) add(declaration.name);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && exported(node)) {
      add(node.name);
    }
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && exported(node)) {
      add(node.name);
    }
    if (ts.isExportDeclaration(node) && node.exportClause !== undefined) {
      if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) add(element.name);
      }
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return names;
}

describe("D-260-01: the file two Forbidden routes import from", () => {
  /*
   * A SOURCE cell, and it is here because a type-level instrument cannot observe its own
   * blindness: type assertions erase, so a file of pure type pins is GREEN against a module
   * that does not exist. This is the only cell that distinguishes *the member is absent*
   * from *an assertion about it failed*, and it runs before every cell that would report
   * the first as the second.
   *
   * `TermTable.tsx` is in T260's `Owns` and this author has not read it. It is PARSED —
   * `tests/server/t262/frozen.test.ts` established that a machine reading a file in the
   * blind set is how a blind author holds a surface it may not open.
   */
  it("declares every name the two Forbidden consumers import", () => {
    const [source] = sources([TERM_TABLE], 1);
    const names = exportedNames(source.path, source.raw);

    const missing = [...CONSUMED_VALUES, ...CONSUMED_TYPES].filter((name) => !names.has(name));
    expect(
      missing,
      `${TERM_TABLE} no longer exports: ${missing.join(", ")}.\n\n` +
        `D-260-01 freezes ${RULED_FROZEN.join(", ")} by name. The rest of this list is ` +
        `imported by \`app/ontology/[...term]/page.tsx:8-16\`, a route T260 is FORBIDDEN to ` +
        `touch — so removing one breaks a surface this task may not repair, which is the ` +
        `defect D-260-01 exists to prevent. If the removal is intended it is a change to a ` +
        `Forbidden route and it needs a ruling; satisfying this cell by editing the consumer ` +
        `is editing a Forbidden file.`,
    ).toEqual([]);
  });

  /*
   * The same question asked from the other end, and it is NOT a restatement.
   *
   * The cell above reads a list this author pinned at `3daa325`; this one derives the list
   * from the consumer AS IT STANDS. They disagree in exactly two situations and each one is
   * worth a distinct red: T261 adds an import (this cell reds, the pin does not), or T261
   * drops one and T260 then removes it (the pin reds, this does not).
   *
   * A hard-coded pin alone has the failure mode `tests/error-hygiene.test.ts:113` has — a
   * domain that a later merge moves under the guard. A derived list alone has the opposite
   * one: the domain shrinks to nothing and the guard passes. Both, deliberately.
   */
  it.each(FORBIDDEN_CONSUMERS)("%s can still import what it imports", (consumer) => {
    const [source] = sources([consumer], 1);
    const sf = ts.createSourceFile(
      source.path,
      source.raw,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const wanted: string[] = [];
    const walk = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === "@/components/ontology/TermTable"
      ) {
        const clause = node.importClause;
        if (clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) wanted.push(element.name.text);
        }
      }
      node.forEachChild(walk);
    };
    walk(sf);

    /* The premise, and it fails OUTSIDE the negative: a consumer that stopped importing
       from `TermTable` would satisfy "everything it imports still exists" perfectly, and
       that is a change to a Forbidden route rather than a reason for this cell to pass. */
    expect(
      wanted.length,
      `${consumer} no longer imports from "@/components/ontology/TermTable". That is a ` +
        `change to a route T260 is FORBIDDEN to touch, so this cell reports it rather than ` +
        `passing over a domain that quietly emptied.`,
    ).toBeGreaterThan(0);

    const [table] = sources([TERM_TABLE], 1);
    const names = exportedNames(table.path, table.raw);
    const missing = wanted.filter((name) => !names.has(name));
    expect(
      missing,
      `${consumer} imports ${missing.join(", ")} from ${TERM_TABLE}, which no longer ` +
        `exports it. The consumer is Forbidden to T260; the module is T260's. D-260-01.`,
    ).toEqual([]);
  });

  it("binds at runtime, so the pins below are about behaviour and not about the parser", async () => {
    const bound = await termTable();
    const absent = CONSUMED_VALUES.filter(
      (name) => (bound as unknown as Record<string, unknown>)[name] === undefined,
    );
    expect(
      absent,
      `parsed but did not bind: ${absent.join(", ")}. A name the AST finds and the module ` +
        `does not export is a re-export that lost its target, which the source cell above ` +
        `cannot see.`,
    ).toEqual([]);
  });
});

/* ============================================================
   2. `markerWeight` — SEMANTICS, WHICH A RENAME CANNOT REACH
   ============================================================ */

describe("D-260-01: `markerWeight` prices a marker the way the engine does", () => {
  /*
   * The oracle is `expectedWeight` in `contract.ts`, computed from
   * `DARKPRINT_CONFIG.security.weights` — `lib/core`, which neither half of this task owns
   * and neither half may edit. That is what makes it a second axis rather than a
   * consistency check: it is not a transcription of what the module answered, it is the
   * rule the Forbidden consumer states in prose at `app/nodes/[...id]/page.tsx:817-829`,
   * evaluated independently.
   */
  it.each(Object.keys(CONFIGURED_WEIGHTS))("prices the core marker %s from the config", async (id) => {
    const term = riskTerm({ id });
    const bound = await termTable();
    expect(bound.markerWeight(term)).toBe(expectedWeight(term));
  });

  /*
   * THE ONLY CELL IN THIS FILE THAT SEPARATES THE TWO LOOKUP ORDERS.
   *
   * No term that exists can do it. Doc 3 §4 keeps the seven core weights in the config and
   * `lib/core/ontology/core.ts:171` records that no core term carries `defaultWeight`;
   * `content/ontology/extensions.yaml` ships exactly one local marker and it is not in the
   * config. So on the whole shipped vocabulary "config first" and "term first" AGREE, and a
   * suite built from the archive would red 0 against a module that had swapped them.
   *
   * `99` is chosen so the assertion EXCLUDES the bad output rather than admitting the good
   * one: it is not a weight anything in this repository could produce, so a red names the
   * swap and cannot be a coincidence of arithmetic.
   */
  it("takes the configured weight over the term's own when both exist", async () => {
    const term = riskTerm({ id: "unbounded-loop", defaultWeight: 99 });
    expect(expectedWeight(term), "the oracle itself must read config-first").toBe(1.5);

    const bound = await termTable();
    const answer = bound.markerWeight(term);
    expect(
      answer,
      `\`markerWeight\` answered ${String(answer)} for a marker that is priced 1.5 in ` +
        `DARKPRINT_CONFIG.security.weights and carries defaultWeight: 99. 99 means the two ` +
        `lookup steps were swapped. Doc 3 §4 puts the core weights in the config so a ` +
        `recalibration touches one file; a term that could override it would make the ` +
        `ontology version meaningless (\`lib/core/ontology/core.ts:171\`).`,
    ).toBe(1.5);
    expect(answer).not.toBe(99);
  });

  /**
   * `??` and not `||`, and the page renders the difference.
   *
   * A marker an author priced at zero is not a marker nobody priced: `/ontology/<term>`
   * prints "not priced" for `undefined` and a figure for `0` (`:663-668`), so collapsing
   * them puts the wrong sentence on the page. Doc 3 §7's own rule — a local marker with no
   * weight counts 0 and moves no score — is about the SCORE, not about the disclosure.
   */
  it("keeps a declared weight of zero distinct from an unpriced marker", async () => {
    const priced = riskTerm({ id: "lupo/priced-at-zero", defaultWeight: 0 });
    const unpriced = riskTerm({ id: "lupo/never-priced" });

    const bound = await termTable();
    expect(bound.markerWeight(priced), "`||` collapses a declared 0 into undefined").toBe(0);
    expect(bound.markerWeight(priced)).not.toBeUndefined();
    expect(bound.markerWeight(unpriced)).toBeUndefined();
    expect(bound.markerWeight(unpriced)).not.toBe(0);
  });

  /** The shipped local marker, from the vocabulary rather than from a literal. */
  it("prices the shipped local marker from the term", async () => {
    const term = riskTerm({ id: "lupo/pii-handling", defaultWeight: 0.5 });
    expect(CONFIGURED_WEIGHTS[term.id], "premise: it must NOT be in the config").toBeUndefined();

    const bound = await termTable();
    expect(bound.markerWeight(term)).toBe(0.5);
  });

  /**
   * The kind gate, which no consumer states and no ruling mentions.
   *
   * Measured: `markerWeight` answers `undefined` for every kind but `risk-marker`, even for
   * an id that IS in the weights map and even with a `defaultWeight` set. It is asserted
   * because it is semantics D-260-01 freezes, and because it is the clause most likely to
   * be dropped by a rewrite that reaches for the config map directly.
   */
  it.each(["tool", "phase", "node-type", "data-type"] as const)(
    "prices nothing of kind %s, even when the id is in the weights map",
    async (kind) => {
      const term = riskTerm({ id: "unbounded-loop", kind, defaultWeight: 7 });
      expect(expectedWeight(term)).toBeUndefined();

      const bound = await termTable();
      const answer = bound.markerWeight(term);
      expect(
        answer,
        `\`markerWeight\` priced a ${kind} at ${String(answer)}. Only a risk marker carries ` +
          `a security weight (doc 3 §4); pricing anything else puts a cost on a term that ` +
          `has none and the two figures that could leak in are 1.5 (the config) and 7 (the ` +
          `term's own).`,
      ).toBeUndefined();
    },
  );

  it("takes exactly one declared parameter", async () => {
    const bound = await termTable();
    expect(
      bound.markerWeight.length,
      "a second required parameter is a signature change under D-260-01, and both Forbidden " +
        "consumers call it with one argument (`[...id]:836`, `[...term]:183`).",
    ).toBe(1);
  });
});

/* ============================================================
   3. `formatWeight` — A GOLDEN, AND THE PROPERTIES A GOLDEN MISSES
   ============================================================ */

describe("D-260-01: `formatWeight` renders a weight", () => {
  /**
   * Captured by calling the module at blob `fa977a6`, not derived.
   *
   * The consumers interpolate the result and never inspect it, so no reading of them can
   * produce this table. It is admissible because D-260-01's criterion is literally
   * "unchanged" — the shipped output IS the specification here — and inventing a format
   * would red a correct bound. Every number below is one the archive can actually produce:
   * the seven configured weights, the one local weight, and `unknownMarkerWeight`.
   */
  const GOLDEN: readonly (readonly [number, string])[] = [
    [0, "0.00"],
    [0.5, "0.50"],
    [1, "1.00"],
    [1.5, "1.50"],
    [2, "2.00"],
  ];

  it.each(GOLDEN)("formats %d as %s", async (weight, rendered) => {
    const bound = await termTable();
    expect(bound.formatWeight(weight)).toBe(rendered);
  });

  /*
   * A GOLDEN TABLE IS SATISFIED BY A LOOKUP TABLE, so the properties are asserted too.
   *
   * The first is the one the consumers actually depend on and the one a golden hides:
   * `app/ontology/[...term]/page.tsx:468` interpolates the result into a TEMPLATE LITERAL,
   * so a `formatWeight` returning a ReactNode still renders correctly at the three JSX call
   * sites and puts "[object Object]" into that sentence. `toBe(string)` on the golden
   * happens to catch it; `typeof` says which criterion was violated.
   */
  it("returns a primitive string, because one consumer interpolates it into a sentence", async () => {
    const bound = await termTable();
    const answer: unknown = bound.formatWeight(1.5);
    expect(typeof answer, "`[...term]/page.tsx:468` puts this inside a template literal").toBe(
      "string",
    );
    expect(`${bound.formatWeight(1.5)}`).not.toContain("object");
  });

  /*
   * Injectivity over the weights that ship. A constant, an empty string, or a rounding to
   * whole numbers all red here and none of them reds a `typeof` check. Whole-number
   * rounding is the near miss worth naming: it passes 1 -> "1", 2 -> "2" and collapses 1.5
   * and 2 onto the same rendering, which on the page is two different risks priced alike.
   */
  it("renders the shipped weights distinguishably", async () => {
    const bound = await termTable();
    const weights = [...new Set([...Object.values(CONFIGURED_WEIGHTS), 0.5, 0])];
    expect(weights.length, "premise: the shipped weights must be distinct to begin with").toBe(
      new Set(weights).size,
    );

    const rendered = weights.map((weight) => bound.formatWeight(weight));
    expect(
      new Set(rendered).size,
      `${weights.length} distinct weights rendered as ${new Set(rendered).size} distinct ` +
        `strings: ${rendered.join(", ")}. Two markers priced differently now read alike.`,
    ).toBe(weights.length);
  });

  it("renders `unknownMarkerWeight` too, because a Forbidden route prints exactly that", async () => {
    /* `app/ontology/[...term]/page.tsx:443` and `:468`. It is 0, and 0 is the value most
       likely to fall out of a truthiness guard added during a rewrite. */
    const bound = await termTable();
    expect(bound.formatWeight(DARKPRINT_CONFIG.security.unknownMarkerWeight)).toBe("0.00");
  });

  it("takes exactly one declared parameter", async () => {
    const bound = await termTable();
    expect(bound.formatWeight.length).toBe(1);
  });
});

/* ============================================================
   4. `termUsageIndex` — AND `NO_USAGE`, WHICH IS HALF OF ITS CONTRACT
   ============================================================ */

describe("D-260-01: `termUsageIndex` answers what the Forbidden route asks it", () => {
  /*
   * Asserted as the CONSUMER uses it, not as a shape.
   *
   * `app/ontology/[...term]/page.tsx:149-163` does four things with the result and each one
   * is a separate way for a reshape to break the page:
   *
   *     const usageIndex = termUsageIndex(registry);          // 1. has `.get`
   *     const usage = usageIndex.get(term.id) ?? NO_USAGE;    // 2. keyed by term id
   *     usage.cards.map((id) => registry.versionsOf(id)[0])   // 3. `.cards` are CARD IDS
   *     usage.blueprints.map((slug) => registry.blueprint(slug))  // 4. `.blueprints` are SLUGS
   *
   * 3 and 4 are the ones a type cannot hold: both fields are `string[]`, so swapping them
   * typechecks and renders an empty list on every term page. They are checked by RESOLVING
   * every entry against the registry, which is the same archive the page resolves against.
   */
  it("is a map keyed by term id, over a non-empty archive", async () => {
    const registry = getRegistry();
    const bound = await termTable();
    const index = bound.termUsageIndex(registry);

    expect(typeof index.get, "the consumer calls `.get`").toBe("function");
    /* The premise. An index of size 0 satisfies every per-entry assertion below at once,
       and the archive is never empty (`lib/content/read.ts:185` throws if it is). */
    expect(
      index.size,
      "an empty index makes every assertion in this describe block vacuous",
    ).toBeGreaterThan(0);

    const view = registry.blueprint(registry.blueprints()[0]!.slug);
    expect(view, "premise: the registry itself must be readable").toBeDefined();
  });

  it("keys entries by ids the vocabulary knows", async () => {
    const bound = await termTable();
    const index = bound.termUsageIndex(getRegistry());
    const unknown = [...index.keys()].filter((id) => typeof id !== "string" || id.length === 0);
    expect(unknown, "a key that is not a term id cannot be found by `usageIndex.get(term.id)`").toEqual(
      [],
    );
  });

  it("puts CARD IDS in `.cards` and BLUEPRINT SLUGS in `.blueprints`", async () => {
    const registry = getRegistry();
    const bound = await termTable();
    const index = bound.termUsageIndex(registry);

    const badCards: string[] = [];
    const badBlueprints: string[] = [];
    let cardsSeen = 0;
    let blueprintsSeen = 0;

    for (const [termId, usage] of index) {
      for (const id of usage.cards) {
        cardsSeen += 1;
        if (registry.versionsOf(id)[0] === undefined) badCards.push(`${termId} -> ${id}`);
      }
      for (const slug of usage.blueprints) {
        blueprintsSeen += 1;
        if (registry.blueprint(slug) === undefined) badBlueprints.push(`${termId} -> ${slug}`);
      }
    }

    /* Both premises, and they are separate: an index whose entries all carry empty arrays
       passes both negatives below while telling the page nothing. */
    expect(cardsSeen, "no entry named a card, so the `.cards` check ran over nothing").toBeGreaterThan(0);
    expect(
      blueprintsSeen,
      "no entry named a blueprint, so the `.blueprints` check ran over nothing",
    ).toBeGreaterThan(0);

    expect(
      badCards,
      `\`.cards\` holds values \`registry.versionsOf()\` cannot resolve. ` +
        `\`app/ontology/[...term]/page.tsx:157\` maps exactly that call over this field, so ` +
        `these terms would render an empty card list on a page that says they are used.`,
    ).toEqual([]);
    expect(
      badBlueprints,
      `\`.blueprints\` holds values \`registry.blueprint()\` cannot resolve. ` +
        `\`app/ontology/[...term]/page.tsx:160\` maps exactly that call over this field.`,
    ).toEqual([]);
  });

  /**
   * `NO_USAGE` is the value the Forbidden route substitutes on a miss, so its key set has
   * to be the key set of a real entry. A `NO_USAGE` that lost a field, or an entry that
   * gained one, makes `usageIndex.get(id) ?? NO_USAGE` two different shapes depending on
   * whether the term is used — which typechecks and breaks only on the terms nothing names.
   */
  it("`NO_USAGE` carries exactly the fields a real entry carries", async () => {
    const bound = await termTable();
    const index = bound.termUsageIndex(getRegistry());
    const [, entry] = [...index.entries()][0] ?? [];
    expect(entry, "premise: there is a real entry to compare against").toBeDefined();

    expect(Object.keys(bound.NO_USAGE).sort()).toEqual(Object.keys(entry!).sort());
    for (const [key, value] of Object.entries(bound.NO_USAGE)) {
      expect(Array.isArray(value), `NO_USAGE.${key} is the empty case of a list`).toBe(true);
      expect(value as unknown[], `NO_USAGE.${key} must be empty`).toEqual([]);
    }
  });

  it("takes exactly one declared parameter", async () => {
    const bound = await termTable();
    expect(bound.termUsageIndex.length).toBe(1);
  });
});
