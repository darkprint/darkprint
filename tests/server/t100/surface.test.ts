/* ============================================================
   T100 — the published surface

   No database. What this file asks is whether the barrel
   backend.md §T100 promises exists and carries the names it
   published.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { PUBLISH, PUBLISHED, loadPublish } from "./contract";

describe("T100 published surface", () => {
  it("publishes `publish` from the barrel", async () => {
    const mod = await loadPublish();
    const fn = mod["publish"];
    expect(
      typeof fn,
      `${PUBLISH} does not export \`publish\`.\n  Published as: ${PUBLISHED.publish}\n` +
        `  It exports: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
    ).toBe("function");
  });

  it("takes `(db, actor, input)` — three parameters", async () => {
    const mod = await loadPublish();
    const fn = mod["publish"];
    if (typeof fn !== "function") {
      throw new Error(`${PUBLISH} does not export \`publish\`; see the cell above.`);
    }
    /* `Function.length` counts parameters before the first default or rest, which is exactly
       three here because none of the three is optional. A four-parameter `publish` is a
       different signature from the one published, and a caller written against the contract
       would be passing its third argument into the wrong slot. */
    expect(
      fn.length,
      `\`publish\` declares ${fn.length} required parameters.\n  Published as: ${PUBLISHED.publish}`,
    ).toBe(3);
  });
});

/* ============================================================
   The type pin, and what it is worth today

   **This assertion is VACUOUS while `lib/server/publish` is
   absent, and it is written anyway.** `tsc` resolves an import of
   a missing module to `any`, and `Pin<>` short-circuits on `any` to
   `true` — deliberately and in one named place, rather than relying
   on `Exact<any, T>` happening to answer `true`, which the strict
   `Exact` below does not. So today these lines compile no matter
   what the contract says, and their passing establishes NOTHING
   about `PublishInput` or `PublishResult`.

   What they are for is the day after the merge. The moment the
   barrel lands, the same lines start comparing the real declared
   shapes against the Published signatures block, and a field the
   implementer spelled differently, widened, or left optional stops
   the typecheck.

   **The debt this leaves, stated so it can be collected.** Nobody
   in this worktree can falsify these pins — the falsification is
   owed to whoever holds the tree after the merge, and the way to
   pay it is to break one member on purpose (drop `created`, widen
   `digest` to `unknown`, make `slug` optional) and watch
   `npm run typecheck` go red with a message naming that member. A
   pin nobody has ever seen fail is a pin nobody has evidence works.

   `vocabulary` carries D-133-09: `StoredVocabulary`, the published
   `{ text, terms }`, and not the bare `readonly OntologyTerm[]`
   that four independent readings reached for and that `addRelease`
   now refuses at the write.
   ============================================================ */

import type { StoredVocabulary } from "@/lib/server/archive";
import type { BundleManifest } from "@/lib/core";

/**
 * Exact shape equality: mutual assignability AND the same key set.
 *
 * **The key-set half was added because the near-miss below found it missing.** Mutual
 * assignability alone reports `{ a: string }` and `{ a: string; b?: number }` as EQUAL — an
 * optional member is assignable in both directions, so `[A] extends [B] ? [B] extends [A]`
 * answers `true`. That is exactly the divergence a pin on a published interface most needs to
 * catch: an implementer who adds a field the contract never published would have sailed through
 * a pin built the obvious way.
 *
 * Found by asserting the verdicts rather than by reading the type. The first version of
 * `_exactDiscriminates` predicted `false` for that pair, `tsc` said `true`, and the prediction
 * was the thing that was wrong — which is the whole reason a near-miss is worth writing down.
 */
type Exact<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? [keyof A] extends [keyof B]
      ? [keyof B] extends [keyof A]
        ? true
        : false
      : false
    : false
  : false;

type ContractPublishInput = {
  ownerHandle: string;
  slug: string;
  version: string;
  manifest: BundleManifest;
  dot: string;
  cardFiles: Record<string, string>;
  vocabulary?: StoredVocabulary;
  visibility?: "public" | "private";
  lineage?: { ownerHandle: string; slug: string; version: string };
};

type ContractPublishResult = {
  bundleId: string;
  releaseId: string;
  digest: string;
  created: boolean;
};

/**
 * `true` when `T` is `any` — which is what an import of an absent module resolves to.
 *
 * `0 extends 1 & T` is only satisfiable when `T` is `any`, because `1 & any` is `any` and `0`
 * extends `any`. For every other `T`, `1 & T` is `1` or `never` and `0` extends neither.
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * The pin, with its vacuity made EXPLICIT rather than left to accident.
 *
 * While `@/lib/server/publish` is absent, `Actual` is `any` and this short-circuits to `true`:
 * the pin passes and establishes nothing, which is the state the header describes. Once the
 * barrel lands, `Actual` is a real interface and the strict `Exact` above decides.
 *
 * Written this way rather than relying on `Exact<any, T>` happening to be `true`, because with
 * the key-set comparison added it is NOT — `keyof any` is `string | number | symbol`, so the
 * strict `Exact` answers `false` against an absent module and the pin would red for a reason
 * TS2307 already reports one line earlier. A pin whose vacuity is a side effect of one branch
 * of a conditional type is a pin that changes meaning the next time the helper is edited.
 */
type Pin<Actual, Contract> = IsAny<Actual> extends true ? true : Exact<Actual, Contract>;

type PinInput = Pin<
  import("@/lib/server/publish").PublishInput,
  ContractPublishInput
>;
type PinResult = Pin<
  import("@/lib/server/publish").PublishResult,
  ContractPublishResult
>;

/* The two lines that will start failing the typecheck once the barrel exists and disagrees. */
const _pinInput: PinInput = true as PinInput;
const _pinResult: PinResult = true as PinResult;

/* ------------------------------------------------------------
   Falsifying the INSTRUMENT, since the pin itself cannot be

   The pins above are vacuous today and nobody in this worktree can
   make them fail. What CAN be falsified here and now is the
   machinery they rest on — and a near-miss is what separates an
   `Exact<>` that discriminates from one that merely resolves to
   `true`.

   Four pairs, three of them near-misses differing by one member:
   an added OPTIONAL member, a member made optional, and a member
   retyped. If `Exact` were broken in the usual way — always `true`,
   which is precisely how it would fail against the real barrel and
   never be noticed — every slot below would be `true` and this line
   would stop compiling.

   The added-optional-member case is the one that earned its keep:
   it was predicted `false`, `tsc` answered `true`, and the fix was
   to `Exact` rather than to the prediction. See the type's own
   comment.

   So a green typecheck on this file is evidence about `Exact`, not
   about `PublishInput`. The pins' own falsification stays owed to
   whoever holds the tree after the merge.
   ------------------------------------------------------------ */
const _exactDiscriminates: [
  Exact<{ a: string }, { a: string }>,
  Exact<{ a: string }, { a: string; b?: number }>,
  Exact<{ a: string }, { a?: string }>,
  Exact<{ a: string }, { a: number }>,
  /* And the short-circuit itself: `any` on the left is what an absent module looks like, and
     the pin must answer `true` there — vacuously — while `Exact` alone answers `false`. */
  IsAny<import("@/lib/server/publish").PublishInput>,
  Pin<import("@/lib/server/publish").PublishInput, ContractPublishInput>,
] = [true, false, false, false, true, true];

describe("T100 published shapes", () => {
  it("pins PublishInput and PublishResult — vacuous until the barrel lands", () => {
    /* Deliberately not an assertion about the pins: they are a COMPILE-time claim and there is
       nothing for a runtime expectation to look at. This cell exists so the debt above appears
       in the run's output rather than only in a comment nobody opens. */
    expect(
      _pinInput === true && _pinResult === true,
      "The type pins live in this file's type space; see the header for what they establish " +
        "(nothing, until `@/lib/server/publish` exists) and who owes their falsification.",
    ).toBe(true);

    /* The instrument, which IS falsifiable today. These four values are checked by `tsc`
       against `Exact<>`'s verdict on four shape pairs, three of them near-misses differing by
       one member. An `Exact` that always answered `true` fails to compile this file. */
    expect(
      _exactDiscriminates,
      "`Exact<>` no longer discriminates shapes differing by one member, so the pins above " +
        "would pass against a `PublishInput` that does not match the contract.",
    ).toEqual([true, false, false, false, true, true]);
  });
});
