/* ============================================================
   T231 AC1 — the precondition is a TYPE, and `tsc` is the only
   instrument that can read it

   AC1 is *"passing an unresolved key is a **compile error**"*.
   Vitest does not typecheck, so **no runtime cell in this file
   can observe AC1 at all**. The assertions are the `const`
   declarations below; `npm run typecheck` evaluates them and the
   `it()` blocks exist only so the caveats travel with the pins
   instead of living in a handback nobody reads next to the code.

   ── how this instrument lies, in BOTH directions ──
   Established by this run today and stated here because the
   silent half was the only half documented before:

   1. **Silent.** While a member is absent the import resolves to
      `any`, and `Exact<any, T>` is `true`. A pin over an absent
      type PASSES, reporting nothing. That is a green that means
      nothing.
   2. **Loud, and worse.** `@/lib/server/limits` **exists** in this
      tree — this branch is `backend` at `25ef93d`, T230 merged —
      so a missing member is `TS2305` on a PRESENT module, which
      reds `npm run typecheck` for a reason that has nothing to do
      with whether the pin discriminates. *Not a green that meant
      nothing, but a red that drowned the signal.*

   Both end at **the pin cannot be read**, and this file sits in
   the second case rather than the first, which is the opposite of
   where T230's blind suite sat.

   ── so which pins here are readable TODAY, measured not assumed ──
   `LimitSubject`, `checkLimit`, `enforceLimit`, `listKeys` and
   `ApiKeyRecord` all EXIST at T230's shapes. Pins over those are
   **live**: they resolve to `false` against the shipped signature
   and red as `TS2322`, which is a real assertion failing, and they
   go green when the implementation lands. That is a red-to-green
   measurement and not a vacuity.

   **`ResolvedKey` is the one absent member**, so the four pins
   that name it are `TS2305` — the loud lie — and are VACUOUS as
   assertions until it exists. They are written anyway, because
   they are the only place D-231-01's brand is stated as a type
   rather than as a message, and they become load-bearing the
   moment `types.ts` declares it.

   **Their falsification, in both directions, is owed to whoever
   holds the tree after the merge**: widening `key` back to
   `ApiKeyRecord`, or dropping the brand, must each red the
   declaration below, and restoring it must take the tree back to
   zero. That debt was created and paid inside one day this
   afternoon on T133's equivalent block.

   ── what this file actually produces, MEASURED at `25ef93d` ──
   Reported rather than predicted, and re-measured after the
   `Pin<>` repair. `npm run typecheck` goes from **0 errors** to
   **6**, all six in this file:

     1 x TS2724  `ResolvedKey` is not exported (the loud lie; a
                 TS2305 variant, since `resolveKey` is a near name)
     5 x TS2322  genuine assertion failures

   The five are: the subject is not yet the union; **the old bare
   `keyId` subject is still accepted, which is AC1 measured FALSE
   today**; `checkLimit` still takes a `db`; `enforceLimit` still
   takes a `db` (F-231-D's half); and `aResolvedKeyIsAccepted`,
   which reds for the vacuity rather than for a criterion.

   **And three of the four negatives pass today for the WRONG
   reason** — `bareStringKeyIsRefused`, `aListedKeyCannotBeSpent`
   and `forgedRecordIsRefused` are all green because nothing
   carrying a `tier` is assignable to the OLD subject either, not
   because AC1 holds. That is a third variant of this instrument
   lying, alongside the two above: **a negative pin over a union
   that does not exist yet passes because the probe does not match
   the shipped shape either.** Those three become meaningful the
   moment `LimitSubject` is the union and are worth nothing before
   it. Do not read this file's green cells as coverage.

   ── resolution versus discrimination, said plainly ──
   Zero errors on its own is **resolution**. What this file claims
   is **discrimination**, and it is claimed for the INSTRUMENT
   rather than for the module: `describe("the pin machinery…")`
   below runs the near-miss against a local restatement that owes
   nothing to `lib/server/limits`, and it compiles today. It shows
   the technique separates two shapes differing by one member. It
   does **not** show anything about the implementation, and reading
   it as if it did would be the co-authored-reference error — a
   check written by the author of the assertions is a consistency
   check, never a second axis.

   ── what these pins may NOT claim (F-231-B, as amended) ──
   The brand proves **PROVENANCE, never non-revocation**. The
   published `ResolvedKey` is `ApiKeyRecord & { readonly [resolved]:
   true }` with **no `revokedAt: null` narrowing**, because a
   narrowing could only come from a cast and would have made
   F-230-J's mutation inert — deleting `isNull(revokedAt)` from
   `resolveKey`'s WHERE still mints a branded record. Non-revocation
   stays defended at runtime where it is falsifiable. **No pin here
   asserts a `ResolvedKey` is unrevoked.**
   ============================================================ */

import { describe, expect, it } from "vitest";

import type { Db } from "@/lib/db";
import type {
  ApiKeyRecord,
  LimitSubject,
  LimitVerdict,
  ResolvedKey,
  checkLimit,
  enforceLimit,
  listKeys,
  resolveKey,
} from "@/lib/server/limits";

import { BARREL, loadLimits, moduleSource, PUBLISHED, required, withoutComments } from "./contract";

/* -- the pin, and the fourth way this instrument lies --
   Mutual assignability ALONE reports `{a: string}` and `{a: string; b?: number}` as EQUAL,
   because an optional member is assignable in both directions. That is the single divergence
   a pin on a published interface most needs to catch: an implementer adding a field nobody
   published sails straight through a green pin.

   Found in T100's blind suite and propagated here. Verified rather than assumed, by
   predicting eleven verdicts and letting `tsc` rule on them; all eleven held, including the
   two below that a reader would not expect.

   **`keyof` on a UNION is the INTERSECTION of its arms' keys**, so the obvious repair --
   adding a `keyof A extends keyof B` clause -- MISSES this defect on exactly the shape this
   file pins. `LimitSubject` is a three-armed union; an added optional inside the keyed arm
   leaves `keyof` unchanged and the naive repair green. `Keys<T>` distributes over the union
   so each arm contributes, which is what makes the clause bite here.

   -- and the vacuity CANNOT be made loud from inside the type system --
   `Pin<>` below short-circuits on `any` and resolves to a sentence saying the pin was never
   evaluated. **Measured: that short-circuit is INERT for the case it was written for.**

   The prediction was that adding the key-set clause would flip a pin over an absent member
   from silently-`true` to loudly-`false`, and that the short-circuit would catch it and say
   why. `tsc` disagreed, and the disagreement is the finding:

   **When an operand is an UNRESOLVED IMPORT, the whole pin collapses to the error type.**
   It is not `any`-the-type, it is the error type, and it swallows the conditional that was
   supposed to detect it: `Pin<A, ResolvedKey | undefined>` accepts `true`, accepts `false`,
   and accepts the VACUOUS string itself -- measured, all three, against this tree. So no
   formulation of the guard can report the absence, because the guard's own condition is
   computed over the error type and collapses with it.

   **The `any` short-circuit is kept because it is not useless** -- it fires for an operand
   that is genuinely `any` rather than unresolved -- but it must not be read as covering the
   absent-member case, which is the case that actually occurs here.

   **What reports the absence is therefore NOT a type at all**: the `TS2305`/`TS2724` on the
   import line, and the source cells at the bottom of this file, which read `types.ts` from
   disk and red today for a reason a reader can act on. A type-level instrument cannot
   observe its own blindness; something outside it has to.

   The lesson is the one that produced the finding: **the first version of this experiment
   used `type Absent = any` as a stand-in for an absent member, and the stand-in behaved
   DIFFERENTLY from the real thing.** Testing an instrument against a model of the problem
   is the co-authored-reference error one level down. */

/** Distributes, so each arm of a union contributes its own keys rather than the intersection. */
type Keys<T> = T extends unknown ? keyof T : never;

type IsAny<T> = 0 extends 1 & T ? true : false;

/** Mutual assignability AND matching key sets. */
type ExactK<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? [Keys<A>] extends [Keys<B>]
      ? [Keys<B>] extends [Keys<A>]
        ? true
        : false
      : false
    : false
  : false;

/**
 * `ExactK`, with the vacuity stated rather than inherited.
 *
 * A pin whose subject is absent resolves to the sentence below, so the red says *this was
 * never evaluated* instead of *`true` is not assignable to `false`* -- which is the same
 * error text a genuine divergence produces and is indistinguishable from it.
 */
type Pin<A, B> = IsAny<A> extends true
  ? "VACUOUS: the pinned type resolved to `any`, so this pin was NEVER EVALUATED. A member is absent from the barrel -- read the TS2305/TS2724 above and not this line. It becomes load-bearing when the member lands."
  : IsAny<B> extends true
    ? "VACUOUS: the expected type resolved to `any`, so this pin was NEVER EVALUATED. A member named in it is absent from the barrel -- read the TS2305/TS2724 above and not this line."
    : ExactK<A, B>;

/** One-way. The AC1 pins are negatives, and a negative is `Assignable<…> = false`. */
type Assignable<A, B> = [A] extends [B] ? true : false;

/* ============================================================
   AC1 — D-231-01's subject, pinned

   LIVE: `LimitSubject` exists today as
   `{ accountId: string | null; keyId: string | null; ip: string }`,
   so this resolves to `false` against the shipped module and reds
   as a genuine assertion rather than as a missing member.
   ============================================================ */

/**
 * D-231-01's union, restated as the pin. The literal on the right is the contract text and
 * is the half a reviewer diffs against the ruling.
 *
 * `accountId` appears on ONE arm and the keyed arm carries it inside `ResolvedKey` — a
 * subject holding both is the two-sources-for-one-quantity shape D-230-10 already forecloses
 * in this same module at `windowMs`.
 */
const subjectIsTheThreeArmedUnion: Pin<
  LimitSubject,
  | { tier: "anonymous"; ip: string }
  | { tier: "account"; accountId: string; ip: string }
  | { tier: "key"; key: ResolvedKey; ip: string }
> = true;

/**
 * AC1's negative, and the whole criterion: the shipped subject must stop type-checking.
 *
 * This is the shape every caller passes today. If it is still assignable, `checkLimit` still
 * takes a bare `keyId: string`, the precondition is still caller discipline, and AC1 is
 * false however the rest of the module reads.
 */
const oldBareKeyIdSubjectIsRefused: Assignable<
  { accountId: string | null; keyId: string | null; ip: string },
  LimitSubject
> = false;

/** The bare-string case, isolated: a key that is a `string` is not a key that was resolved. */
const bareStringKeyIsRefused: Assignable<{ tier: "key"; key: string; ip: string }, LimitSubject> =
  false;

/**
 * **The concrete leak this task closes, and it is not hypothetical.**
 *
 * `listKeys` returns `ApiKeyRecord[]` and D-230-11 has it list REVOKED rows rather than
 * filter them, deliberately, because `revokedAt` moving from `null` to an instant is AC4's
 * only HTTP-observable form. Those rows are structurally identical to what `resolveKey`
 * answers. So today a caller can take a listed, revoked key straight from `listKeys` to
 * `checkLimit` and be handed the 6 000 ceiling — which is the end-to-end number F-230-J
 * measured, 6 000 against 600, on a defect no cell in either half could see.
 *
 * Branded, that path is a compile error. This pin is that sentence.
 *
 * Quantified over `listKeys`'s own return type rather than over a restatement of
 * `ApiKeyRecord`, so it follows the function if the record shape ever moves.
 */
const aListedKeyCannotBeSpent: Assignable<
  { tier: "key"; key: Awaited<ReturnType<typeof listKeys>>[number]; ip: string },
  LimitSubject
> = false;

/**
 * The near-miss, against the real module: two shapes differing by exactly the brand.
 *
 * VACUOUS until `ResolvedKey` exists — with it absent both sides are `any` and both pins
 * pass reporting nothing. The pair is the assertion; neither half means anything alone.
 */
const forgedRecordIsRefused: Assignable<{ tier: "key"; key: ApiKeyRecord; ip: string }, LimitSubject> =
  false;
const aResolvedKeyIsAccepted: Assignable<
  { tier: "key"; key: ResolvedKey; ip: string },
  LimitSubject
> = true;

/** D-231-01: `| undefined`, matching what `resolveKey` already returns. Never `| null`. */
const resolveKeyAnswersTheBrandedType: Pin<
  Awaited<ReturnType<typeof resolveKey>>,
  ResolvedKey | undefined
> = true;

/* ============================================================
   AC2 — `db` leaves BOTH functions

   F-231-D asked whether the wrapper keeps it and the answer is
   no: if `db` stayed on `enforceLimit` the hazard survives one
   call over, on the spelling `app/api/account/keys/route.ts:50`
   actively recommends to every task that wires a route.

   Pinned as *no parameter is a `Db`* rather than as an arity,
   because arity is 2 under both the shipped shape and the
   published one — `options` is a defaulted third parameter, so
   `checkLimit.length` stays 2 either way and cannot separate them.
   ============================================================ */

type NoParameterIsADb<F extends (...args: never[]) => unknown> =
  Db extends Parameters<F>[number] ? false : true;

const checkLimitTakesNoDb: NoParameterIsADb<typeof checkLimit> = true;
const enforceLimitTakesNoDb: NoParameterIsADb<typeof enforceLimit> = true;

/** F-231-E, upheld: `enforceLimit` throws. A union return is a refusal a caller can drop. */
const enforceLimitReturnsAVerdictAndNotAUnion: Pin<
  Awaited<ReturnType<typeof enforceLimit>>,
  LimitVerdict
> = true;

/** AC4's neighbour: `checkLimit` still answers the verdict D-230-10 published. */
const checkLimitStillAnswersTheVerdict: Pin<
  Awaited<ReturnType<typeof checkLimit>>,
  LimitVerdict
> = true;

const PINS = {
  subjectIsTheThreeArmedUnion,
  oldBareKeyIdSubjectIsRefused,
  bareStringKeyIsRefused,
  aListedKeyCannotBeSpent,
  forgedRecordIsRefused,
  aResolvedKeyIsAccepted,
  resolveKeyAnswersTheBrandedType,
  checkLimitTakesNoDb,
  enforceLimitTakesNoDb,
  enforceLimitReturnsAVerdictAndNotAUnion,
  checkLimitStillAnswersTheVerdict,
} as const;

describe("AC1/AC2 — the precondition is a type, evaluated by `tsc` and not by this runner", () => {
  it("carries the pins, and says out loud that vitest is not what reads them", () => {
    /* The eleven constants above are the assertion. This cell contributes a runtime
       observation and keeps the caveat beside the pin; it cannot fail for the reason the
       pins can, and must never be read as if it had checked them. */
    expect(Object.values(PINS)).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  /**
   * The control that disambiguates a `TS2305` red from an AC1 red.
   *
   * A missing member reds the typecheck AND silently makes the pins over it vacuous, so a
   * reader looking at a red typecheck cannot tell which of the two they are in. This cell
   * can: it reads the barrel at runtime, where a name either is or is not exported, and it
   * needs no type system to answer.
   */
  it("reports whether the barrel exports the values D-231-01 names", async () => {
    const limits = await loadLimits();
    expect(typeof required(limits, "checkLimit", PUBLISHED.checkLimit)).toBe("function");
    expect(typeof required(limits, "enforceLimit", PUBLISHED.enforceLimit)).toBe("function");
    expect(typeof required(limits, "resolveKey", PUBLISHED.resolveKey)).toBe("function");
    expect(typeof required(limits, "listKeys", PUBLISHED.listKeys)).toBe("function");
  });
});

/* ============================================================
   the pin machinery, falsified against a LOCAL restatement

   Read the label before the result. This block owes nothing to
   `lib/server/limits` and therefore says nothing about it. What
   it establishes is that `Assignable<>` over a branded type
   SEPARATES two shapes differing by exactly one member — so a
   `false` from the pins above is a discrimination and not an
   artefact of a technique that answers `false` to everything.

   Without this, the four negatives above have the shape the
   memory calls out: a zero is a claim about an instrument until
   something proves otherwise, and a mutation that reds nothing
   against a correct module always reds nothing.
   ============================================================ */

declare const localBrand: unique symbol;

interface LocalRecord {
  keyId: string;
  accountId: string;
  label: string;
  createdAt: Date;
  revokedAt: Date | null;
}
type LocalResolved = LocalRecord & { readonly [localBrand]: true };
type LocalSubject =
  | { tier: "anonymous"; ip: string }
  | { tier: "account"; accountId: string; ip: string }
  | { tier: "key"; key: LocalResolved; ip: string };

/* The near-miss, in full: the two shapes differ by the brand and by nothing else. */
const localBrandedIsAccepted: Assignable<
  { tier: "key"; key: LocalResolved; ip: string },
  LocalSubject
> = true;
const localForgedIsRefused: Assignable<{ tier: "key"; key: LocalRecord; ip: string }, LocalSubject> =
  false;
const localBareStringIsRefused: Assignable<
  { tier: "key"; key: string; ip: string },
  LocalSubject
> = false;
/** A revoked record is refused for the SAME reason — it lacks the brand, not because of
 *  `revokedAt`. Stated as a pin so nobody later reads the brand as a revocation check
 *  (F-231-B, as amended): `LocalResolved` admits `revokedAt: Date` and always did. */
const localRevokedIsRefusedForLackOfBrandOnly: Assignable<
  { tier: "key"; key: LocalRecord & { revokedAt: Date }; ip: string },
  LocalSubject
> = false;
const localBrandAdmitsARevokedInstant: Assignable<
  LocalResolved & { revokedAt: Date },
  LocalResolved
> = true;

/* The fourth lie, controlled locally: an added OPTIONAL member is the divergence mutual
   assignability cannot see, and `LimitSubject` is a union, where the obvious `keyof` repair
   also cannot see it. Both are pinned, so neither can regress silently. */
type LocalSubjectPlusOptional =
  | { tier: "anonymous"; ip: string }
  | { tier: "account"; accountId: string; ip: string }
  | { tier: "key"; key: LocalResolved; ip: string; keyId?: string };

const localAddedOptionalIsCaught: Pin<LocalSubject, LocalSubjectPlusOptional> = false;
const localIdenticalUnionsAgree: Pin<LocalSubject, LocalSubject> = true;
/** The reason the repair had to distribute: `keyof` over a union answers the INTERSECTION. */
const keyofAUnionIsTheIntersection: Assignable<
  keyof LocalSubjectPlusOptional,
  "tier" | "ip"
> = true;
/** ...while `Keys<>` answers the union, which is what makes the added member visible. */
const distributedKeysSeeTheAddedMember: Assignable<
  "keyId",
  Keys<LocalSubjectPlusOptional>
> = true;

describe("the pin machinery discriminates — a control on the instrument, not on the module", () => {
  it("separates a branded key from a five-member forgery of it", () => {
    expect([
      localBrandedIsAccepted,
      localForgedIsRefused,
      localBareStringIsRefused,
      localRevokedIsRefusedForLackOfBrandOnly,
      localBrandAdmitsARevokedInstant,
    ]).toEqual([true, false, false, false, true]);
  });

  it("catches an added optional member, which mutual assignability alone cannot see", () => {
    /* The near-miss one level down: not two shapes of a key, but two shapes of the PIN.
       `localIdenticalUnionsAgree` is the positive half — without it, a `Pin<>` that answered
       `false` to everything would satisfy the negative and look like discrimination. */
    expect([localAddedOptionalIsCaught, localIdenticalUnionsAgree]).toEqual([false, true]);
  });

  it("records WHY the repair had to distribute over the union", () => {
    /* Both constants are `true`, and they are `true` about opposite things: `keyof` over this
       union answers only the two keys every arm shares, while `Keys<>` reaches the added
       member. A repair that used `keyof` would be green here and blind upstairs. */
    expect([keyofAUnionIsTheIntersection, distributedKeysSeeTheAddedMember]).toEqual([true, true]);
  });

  it("names the barrel it is NOT reaching, so this block cannot be quoted as a module result", () => {
    /* A cheap, literal statement of scope. `BARREL` appears here and nowhere else in this
       block; if a later edit points these pins at the real module the constant stops being
       a lie about what was measured and starts being one, which is the point of naming it. */
    expect(BARREL).toBe("@/lib/server/limits");
  });
});

/* ============================================================
   what reports the absence, since no type can

   A pin whose operand is unresolved collapses to the error type
   and accepts everything — measured above. So the only instrument
   that can say *the type is not there yet* is one that does not
   live in the type system. These cells read `lib/server/limits`
   from disk.

   They are the disambiguator for the `TS2724` next door: a reader
   looking at a red typecheck cannot tell a missing member from a
   failed assertion, and these say which. They red today, for a
   reason a reader can act on, and go green when `types.ts`
   declares the two names.
   ============================================================ */

describe("the types the pins name are declared, which no pin can check", () => {
  for (const name of ["ResolvedKey", "LimitSubject"] as const) {
    it(`\`types.ts\` declares \`${name}\``, () => {
      const source = withoutComments(moduleSource("types.ts"));
      expect(
        new RegExp(`export\\s+(?:type|interface)\\s+${name}\\b`).test(source),
        `\`lib/server/limits/types.ts\` declares no \`${name}\`.\n` +
          `  Every \`Pin<>\` in this file that names it is COLLAPSED TO THE ERROR TYPE and ` +
          `accepts true, false and its own vacuity message alike — so its green says nothing ` +
          `and its red, if it had one, would say nothing either.\n` +
          `  This cell is the only thing in the partition that can tell you that.`,
      ).toBe(true);
    });
  }

  it("`index.ts` re-exports both, since a type no barrel exports cannot be pinned", () => {
    /* D-133-02 F4, one sentence: *a published shape nobody can import is not published.*
       The pins reach these through the barrel, so a declaration in `types.ts` that the
       barrel does not re-export leaves them collapsed exactly as an absent one would. */
    const barrel = withoutComments(moduleSource("index.ts"));
    for (const name of ["ResolvedKey", "LimitSubject"] as const) {
      expect(
        new RegExp(`\\b${name}\\b`).test(barrel),
        `\`lib/server/limits/index.ts\` does not re-export \`${name}\`.`,
      ).toBe(true);
    }
  });

  it("reads a non-empty `types.ts` — the control", () => {
    /* Every cell above is a regex over a file read. An empty or moved read makes all of them
       red for a reason that has nothing to do with whether the type was declared. */
    expect(moduleSource("types.ts").length).toBeGreaterThan(500);
    expect(withoutComments(moduleSource("types.ts"))).toContain("LimitVerdict");
  });
});
