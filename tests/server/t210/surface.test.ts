/* ============================================================
   T210 — the published surface

   Three verbs and no fourth, plus the two record shapes, checked
   at RUNTIME against real values rather than pinned as types.

   ── why there is not a single type assertion in this file ──
   A type pin lies three ways and this repository has been bitten by
   all three: silently vacuous against an absent module (types
   erase, so a cell of pure type assertions is GREEN against a
   module that does not exist), loudly useless against a present
   barrel missing a member, and falsely green on a negative whose
   probe matches neither shape. `Exact<>` by mutual assignability is
   blind to an added optional member, and `keyof` over a union is
   the intersection.

   So every shape below is a key SET taken with `Object.keys` off a
   value the module actually returned, and every field is checked
   for KIND — because the live hazard is `count(distinct …)`
   arriving as the string `"3"`, which satisfies every matcher that
   is not `typeof`.

   ── and why one cell reads the file from disk ──
   A type-level instrument cannot observe its own blindness. The
   runtime binding above distinguishes "the module is absent" from
   "a member is absent" only because `loadTerms` separates the two
   rejections by hand. `the barrel names all three verbs and no
   withdrawn one` reads `lib/server/terms/index.ts` as TEXT, which
   is the only thing that can answer "is the name there" when the
   module will not load at all. It reads the barrel as a published
   surface — the same thing `tests/error-hygiene.test.ts` does to
   every module in the tree — never as an implementation.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  PROMOTION_CANDIDATE_KEYS,
  PUBLISHED,
  PUBLISHED_NAMES,
  TERM_USAGE_KEYS,
  TERMS,
  WITHDRAWN,
  assertCandidate,
  assertUsage,
  barrelSource,
  bind,
  describe_,
  loadTerms,
  outcomeOf,
} from "./contract";
import { AC1, ORDER, ac1World, ac5World, anonymous, dropScratchDatabases, orderWorld } from "./fixtures";

afterAll(async () => {
  await dropScratchDatabases();
});

describe("the barrel publishes exactly three verbs", () => {
  it.each(PUBLISHED_NAMES)("`%s` is exported as a function", async (name) => {
    /* The module is bound LAST — there is nothing else in this cell, so there is nothing for an
       early red to mask. Elsewhere in this suite the order matters and is stated there. */
    const fn = await bind(name);
    expect(typeof fn).toBe("function");
  });

  it.each(WITHDRAWN)("`%s` is ABSENT — it was withdrawn, and a verb nobody ruled back in is a shape nobody ruled on", async (name) => {
    const mod = await loadTerms();
    if (mod[name] === undefined) return;
    throw new Error(
      `${TERMS} exports \`${name}\`, which D-210-01 WITHDREW when the index was ruled ` +
        `read-time. Found it as ${describe_(mod[name])}.\n` +
        "  This is chargeable rather than cosmetic: the verb existed to refresh a STORED " +
        "projection, and there is no `term_usage` table for it to refresh. A module still " +
        "shipping it is either storing something the ruling removed or publishing a no-op " +
        "that a caller will believe in.",
    );
  });

  it("nothing else is exported except the sanctioned error surface", async () => {
    const mod = await loadTerms();
    const exported = Object.keys(mod).sort();
    /* D-210-08 sanctions `TermStoreError` and `withTermErrors` on the registry's shape. The
       assertion is a SET DIFFERENCE rather than an equality, because the error surface's exact
       membership is the implementer's to settle within that sanction and an equality here would
       red a correct module for adding the http half it was told to add. What is NOT admitted is
       an unexplained fourth READER: those are enumerated. */
    const admitted = new Set<string>([
      ...PUBLISHED_NAMES,
      "TermStoreError",
      "withTermStore",
      "withTermErrors",
    ]);
    const unexpected = exported.filter((name) => !admitted.has(name));
    expect(unexpected).toEqual([]);
  });
});

describe("the barrel, read from disk", () => {
  /**
   * The only instrument here that can tell "a member is absent" from "the module would not
   * load". Against an unmerged implementation the file is not there and this cell reds with
   * that stated, which is the blind position rather than a defect.
   */
  it("names all three verbs and no withdrawn one", () => {
    const source = barrelSource();
    if (source === undefined) {
      throw new Error(
        "`lib/server/terms/index.ts` is not on disk.\n" +
          "  Against an unmerged implementation this is the BLIND POSITION and not a defect. " +
          "It is asserted anyway because it is the one cell that distinguishes an absent " +
          "member from an absent module — every other cell in this file reports both the " +
          "same way.",
      );
    }
    for (const name of PUBLISHED_NAMES) {
      expect(source, `the barrel does not name \`${name}\``).toContain(name);
    }
    for (const name of WITHDRAWN) {
      /* A `\b`-terminated match rather than a substring: `refreshUsage` inside a comment
         explaining why it is gone must not red, but neither may a prefix of a longer name
         silently satisfy the positive checks above. Comments are the live case here — the
         ruling is recent enough that a barrel is likely to explain the withdrawal in prose. */
      const exportLine = new RegExp(`^\\s*export\\b.*\\b${name}\\b`, "m");
      expect(
        exportLine.test(source),
        `the barrel EXPORTS \`${name}\`, which D-210-01 withdrew`,
      ).toBe(false);
    }
  });
});

describe("TermUsage is the shape the contract publishes, checked on a real return", () => {
  it("`usageOf` returns exactly the four members, and three of them are integers", async () => {
    const { scratch } = await ac1World();
    const usageOf = await bind("usageOf");
    const record = await usageOf(scratch.db, anonymous, AC1.term);
    /* `assertUsage` compares the key set and then checks every count for KIND. A record whose
       `cards` is the string "1" fails here rather than passing three cells downstream. */
    const usage = assertUsage(record, `usageOf(${AC1.term})`);
    expect(usage.termId).toBe(AC1.term);
  });

  it("`usage` returns a list of the same shape, sorted by termId ascending", async () => {
    const { scratch } = await ac1World();
    const usage = await bind("usage");
    const list = await usage(scratch.db, anonymous);
    expect(Array.isArray(list)).toBe(true);
    const rows = (list as unknown[]).map((row, i) => assertUsage(row, `usage()[${i}]`));
    expect(rows.length).toBeGreaterThan(0);

    /* D-210-10 pins the order as ascending by CODE UNIT, which is what a bare `.sort()` does
       and is NOT what `localeCompare` does — the two disagree on exactly the namespaced ids
       this task cares about, since `/` sorts before every letter by code unit and after some
       of them under a locale. Compared against a copy sorted here rather than asserted
       pairwise, so the message shows the whole disagreement. */
    const ids = rows.map((r) => r.termId);
    expect(ids).toEqual([...ids].sort());
  });

  it("the order is CODE UNIT and not locale, on ids where the two disagree", async () => {
    const { scratch } = await orderWorld();
    const usage = await bind("usage");

    const rows = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    const mine = rows.map((r) => r.termId).filter((id) => ORDER.terms.includes(id as never));

    /* ── this cell replaces one that could not fail ──
       The cell above compares the returned ids to a copy sorted HERE with `.sort()`. Against
       an all-lowercase corpus that is a tautology dressed as an assertion: `.sort()` and
       `localeCompare` produce the same list, so a module using either passes. The sweep proved
       it — swapping the module's comparator for `localeCompare` reddened ZERO cells, which I
       had registered in advance as a zero I would charge against myself if it came up.

       `Zeta/marker` and `alpha/marker` are the smallest thing that separates them. Code unit
       puts `Z` (0x5A) before `a` (0x61); a locale comparator folds case at the primary level
       and puts `alpha` first. Both ids are planted on ONE card in ONE bundle, so they are
       adjacent in the returned list and a comparator swap moves them past each other and
       nothing else.

       Asserted against a literal rather than against a re-sort, because a re-sort computed in
       this file is the same tautology one layer along. */
    expect(mine).toEqual([...ORDER.codeUnitOrder]);
    /* And the fixture is only worth anything if the two orders really do disagree on it. A
       guard on the premise, so this cell cannot quietly become decorative again the way its
       predecessor did. */
    expect([...ORDER.terms].sort((a, b) => a.localeCompare(b))).not.toEqual([
      ...ORDER.codeUnitOrder,
    ]);
  });

  it("every id `usage` reports is distinct — a term counted twice is a term counted wrong", async () => {
    const { scratch } = await ac1World();
    const usage = await bind("usage");
    const rows = ((await usage(scratch.db, anonymous)) as unknown[]).map((row, i) =>
      assertUsage(row, `usage()[${i}]`),
    );
    const ids = rows.map((r) => r.termId);
    expect(ids).toEqual([...new Set(ids)]);
  });
});

describe("PromotionCandidate is TermUsage plus exactly two booleans", () => {
  it("every candidate carries the six members and both flags are real booleans", async () => {
    const { scratch } = await ac5World();
    const candidates = await bind("candidates");
    const list = await candidates(scratch.db, anonymous);
    expect(Array.isArray(list)).toBe(true);
    const rows = (list as unknown[]).map((row, i) => assertCandidate(row, `candidates()[${i}]`));
    /* Not an empty list. D-210-08 measured the seeded archive producing an EMPTY candidate
       list under D-210-05's filter, so a suite that only ever read the archive would have
       asserted the shape of nothing and called it coverage. This world is synthetic for
       exactly that reason, and this cell says so out loud. */
    expect(rows.length).toBeGreaterThan(0);
  });

  it("the two key sets stand in the extends relation the contract states", () => {
    /* A guard on this file's own constants rather than on the module: `PROMOTION_CANDIDATE_KEYS`
       is DERIVED from `TERM_USAGE_KEYS`, and this asserts the derivation still holds if someone
       edits one of them. A pair of hand-written lists that agree with each other is exactly the
       shape that hides a missing member from both. */
    for (const key of TERM_USAGE_KEYS) expect(PROMOTION_CANDIDATE_KEYS).toContain(key);
    expect(PROMOTION_CANDIDATE_KEYS).toHaveLength(TERM_USAGE_KEYS.length + 2);
  });
});

describe("the published arity", () => {
  it.each([
    ["usageOf", 3],
    ["usage", 2],
    ["candidates", 2],
  ] as const)("`%s` declares %i parameters", async (name, arity) => {
    const fn = await bind(name);
    /* `Function.length` and not a call: an OPTIONAL parameter still counts, because `?` erases
       to nothing at runtime. Only a default-value expression or a rest element stops one
       counting — which is why `publish` and `runImport` both spell their last parameter
       `= undefined` rather than `?`, and why one of them shipped as `?` once and was charged
       for it. A fourth parameter here would be an unruled shape however it is spelled. */
    expect((fn as unknown as { length: number }).length).toBe(arity);
  });
});

describe("the fault path leaves as a value, never as this suite's own throw", () => {
  it("`usageOf` on a live database resolves rather than rejecting", async () => {
    const { scratch } = await ac1World();
    const usageOf = await bind("usageOf");
    /* `outcomeOf` captures the rejection as a VALUE. A bare `rejects.toThrow()` here would be
       satisfied by this suite's OWN absent-module throw, so the cell would be green against a
       module that does not exist — the exact laundering that made a merged suite pass against
       nothing. */
    const outcome = await outcomeOf(() => usageOf(scratch.db, anonymous, AC1.term));
    if (!outcome.ok) {
      const error = outcome.error;
      throw new Error(
        `usageOf rejected against a live store: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    expect(outcome.value).toBeDefined();
  });

  it("the clause each published name is bound by is quoted, so a red says where it comes from", () => {
    /* A guard on the messages rather than on the module. A `required()` red that names no clause
       sends the reader back to the document to find out what was promised, and the whole reason
       the Published signatures block exists is that a name is no longer either side's to choose. */
    for (const name of PUBLISHED_NAMES) {
      expect(PUBLISHED[name]).toContain(name);
      expect((PUBLISHED[name] as string).length).toBeGreaterThan(name.length + 10);
    }
  });
});
