/* ============================================================
   T131 / D-131-01 — the pin spelling, and the hole it closes

   "THE PIN SPELLING, RULED AT DISPATCH AS THE SECTION REQUIRES:
   `PinnedRef` IS `lib/data/profiles.ts:29`'s OWN UNION, VERBATIM
   AND CONSUMED, NEVER RESTATED -- `{ kind: "blueprint"; slug:
   string } | { kind: "node"; ref: string }`."

   ── why this file exists at all ──
   T130's blind author could not write it. Its `pins.test.ts`
   header records the reason and it is the sharpest statement of
   the hazard anyone in this run has written: `setPins` was
   published taking `readonly string[]` and what one of those
   strings looked like was not, **and because AC3 makes an
   unresolvable pin ABSENT, a wrong guess yields `pinned: []` and
   goes quietly green rather than red.** So it DISCOVERED the
   spelling by driving candidates through the module, and needed
   two floor cells whose only job was to stop the rest of the file
   passing over an empty array.

   D-131-01 removed that whole apparatus by ruling the spelling
   before this author writes. This file is what replaces it: the
   discovery is gone and the ruling is asserted directly.

   ── THE INSTRUMENT PROBLEM, STATED BEFORE THE CELLS ──
   The obvious way to hold a ruled type is to assign to it, and
   that way is **vacuous**. Types erase: a cell built out of
   `PinnedRef` assertions passes against a module that does not
   exist, passes against one whose union drifted underneath it, and
   passes against an absent barrel. A type-level instrument cannot
   observe its own blindness.

   So the spelling is held on TWO axes that fail for different
   reasons:

     * the COMPILER, at module scope below -- four assertions, two
       positive and two negative, which red at `tsc` and never at
       vitest;
     * the DECLARATION'S OWN BYTES, read off disk by
       `pinnedRefUnionSource()`. A different instrument answering a
       different question: not *do these two types agree* but *is
       the union D-131-01 names still the union at that address*.

   ── what is a PREMISE here and what is a CRITERION ──
   Stated because the counts are about to look strange. The source
   cells below are **premises about a MERGED file** and they are
   GREEN today by construction -- `lib/data/profiles.ts` is on
   `backend` at `bd89f6b` and D-131-01 did not move it. They are
   not coverage of T131 and must not be counted as any. What they
   buy is that the criterion cells are not vacuous: an assertion
   about a pin means nothing if the union it names has moved.

   The one CRITERION cell in this file is the last one, and it reds
   today, which is the blind position working.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  MERGED_EXPORTS,
  PUBLISHED,
  bind,
  blueprintPin,
  nodePin,
  pinnedRefUnionSource,
  type PinnedRef,
} from "./contract";

/* ============================================================
   COMPILER ASSERTIONS — they red at `tsc --noEmit`, not here

   Module scope is safe for these and only these: a type error is
   not a throw, so nothing below is deleted by them the way a
   module-scope PREMISE would delete the cells under it.

   Each `@ts-expect-error` covers exactly ONE line, so every
   literal is written on one line. A multi-line literal leaves the
   directive attached to the line above the error and `tsc` then
   reds it as an UNUSED expect-error, which is the same colour as
   the failure it was meant to catch and a different fact.
   ============================================================ */

/** Positive, arm one: a blueprint pin is `{ kind, slug }` and carries NO owner. */
const BLUEPRINT_ARM: PinnedRef = { kind: "blueprint", slug: "adversarial-consensus-line" };

/** Positive, arm two: a node pin is `{ kind, ref }`, the canonical `id@version`. */
const NODE_ARM: PinnedRef = { kind: "node", ref: "weighted-vote@1.0.0" };

/* Negative one: `card` is NOT a member. The frontend calls this arm `node` and the ruling
   quotes it as `node`, so a module reaching for the archive's own noun is the likely drift and
   this is where it stops. */
// @ts-expect-error `kind` admits "blueprint" and "node" only (D-131-01).
const NOT_A_CARD: PinnedRef = { kind: "card", ref: "weighted-vote@1.0.0" };

/* Negative two: the two arms do not share a payload key. A blueprint carries `slug` and a node
   carries `ref`, and an implementation collapsing them into one optional-everything object is
   the shape that would let a wrong pin through while still compiling. */
// @ts-expect-error a blueprint arm carries `slug`, never `ref` (D-131-01).
const BLUEPRINT_WITH_REF: PinnedRef = { kind: "blueprint", ref: "weighted-vote@1.0.0" };

/* Referenced so `noUnusedLocals` does not delete the four assertions above. Reading them is not
   the test; their COMPILING is. */
const COMPILER_ASSERTIONS = [BLUEPRINT_ARM, NODE_ARM, NOT_A_CARD, BLUEPRINT_WITH_REF];

describe("D-131-01: the union at `lib/data/profiles.ts` is still the one the ruling names", () => {
  /* PREMISES about a merged file. Green today. Not coverage of T131. */

  it("declares `PinnedRef` with both of the ruling's arms, read off disk", () => {
    const source = pinnedRefUnionSource();

    /* Asserted as the presence of each arm's OWN pair rather than as one normalised string:
       a whitespace-insensitive equality against a sentence written here would be checking
       this file's transcription of the declaration, which is the consistency check the brief
       warns about rather than a second axis. */
    expect(
      source.replace(/\s+/g, " "),
      `D-131-01 quotes the union as \`{ kind: "blueprint"; slug: string } | ` +
        `{ kind: "node"; ref: string }\`, VERBATIM AND CONSUMED. Read off disk:\n${source}`,
    ).toContain('{ kind: "blueprint"; slug: string }');

    expect(source.replace(/\s+/g, " "), `read off disk:\n${source}`).toContain(
      '{ kind: "node"; ref: string }',
    );
  });

  it("declares exactly two arms, so a third cannot arrive unobserved", () => {
    const source = pinnedRefUnionSource();

    /* The count is what a `toContain` pair cannot see. A union widened to three arms still
       contains both of the ruling's, so every assertion above stays green while the spelling
       has changed underneath both halves of this task -- and a pin at the new arm would be
       unresolvable, therefore ABSENT, therefore silent. Same failure direction the ruling
       exists to close, arriving through the type instead of through a guess. */
    const arms = source.split("|").length - 1;
    expect(
      arms,
      `\`PinnedRef\` is a TWO-arm union (D-131-01). Found ${arms} \`|\` separators in:\n` +
        `${source}\n  A third arm is a moved contract: both halves of T131 bind this union by ` +
        `import, so it is the one place a drift is silent rather than a compile error.`,
    ).toBe(2);
  });

  it("puts the declaration where the ruling addresses it, and the compiler assertions bind", () => {
    /* The address is part of the ruling's text -- `lib/data/profiles.ts:29` -- and this is the
       cell that keeps the four module-scope assertions from being dead weight: they compile
       against whatever `PinnedRef` IS, so if the import ever resolved to something else they
       would go on compiling and say nothing. Reading the values back proves the same module
       this file typed against is the one on disk. */
    expect(COMPILER_ASSERTIONS).toHaveLength(4);
    expect(blueprintPin("a-slug")).toEqual({ kind: "blueprint", slug: "a-slug" });
    expect(nodePin("weighted-vote@1.0.0")).toEqual({
      kind: "node",
      ref: "weighted-vote@1.0.0",
    });
  });
});

describe("the blind position: the pin write path is not on the barrel yet", () => {
  it("`@/lib/server/profiles` exports `setPins`", async () => {
    /* THE ONE CRITERION CELL IN THIS FILE, and it reds today.

       It is here rather than in the AC3 file because it is the only claim about `setPins` that
       does not depend on the SIGNATURE. D-131-04 has since published one — `setPins(db, actor,
       accountId, pins)` returning `ProfileRecord` — so the calling cells are written now and
       live in `pins.test.ts`; this one survives the change because "the barrel exports it" is a
       weaker claim than any of them and fails first, with a message about the barrel rather than
       about an argument.

       The red names what the barrel DOES export, which is what tells `a member is absent` apart
       from `the barrel broke`. */
    const setPins = await bind("setPins");
    expect(typeof setPins).toBe("function");
  });

  it("the four merged exports are still on the barrel, so the red above is an absence", async () => {
    /* The control for the cell above, and it is the reason that red is readable at all. A
       barrel that had LOST `getProfile` would fail `bind("setPins")` identically -- absent is
       absent -- and a reader would charge T131 for a regression in T130. This separates them:
       green here plus red above is "the extension has not landed", red here is something else
       entirely.

       Green in both worlds on purpose. It is an instrument control, not a criterion, and it is
       reported as one. */
    const mod = (await import("@/lib/server/profiles")) as Record<string, unknown>;
    const missing = MERGED_EXPORTS.filter((name) => mod[name] === undefined);
    expect(
      missing,
      `These were exported at bd89f6b, before T131 touched anything. If any is gone, read that ` +
        `before reading any other red in this suite: T131 EXTENDS this barrel and may not ` +
        `shrink it.\n  ${PUBLISHED.setPins}`,
    ).toEqual([]);
  });
});
