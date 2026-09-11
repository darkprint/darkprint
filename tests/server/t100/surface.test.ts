/* ============================================================
   T100 — the published surface

   No database. What this file asks is whether the barrel
   T100's contract promises exists and carries the names it
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
   absent, and it is written anyway.** Today these lines compile no
   matter what the contract says, and their passing establishes
   NOTHING about `PublishInput` or `PublishResult`.

   **And the vacuity is worse than "resolves to `any`", which is
   what an earlier version of this header claimed. Measured here:**
   an unresolved import does not become `any`-the-type, it becomes
   the ERROR type, and the whole pin collapses with it. A pin
   against the absent barrel accepts `true`, accepts `false`, and
   accepts anything else, with no diagnostic beyond the `TS2307` on
   the import itself. `IsAny`'s condition is computed over the error
   type too, so the short-circuit never even gets to decide — a
   guard cannot report its own operand's absence from inside the
   type system.

   The reason that claim was wrong is worth more than the claim: it
   was validated against `type Absent = any` as a STAND-IN, and
   against the stand-in the short-circuit fires perfectly. The model
   behaves differently from the problem, so the experiment confirmed
   the instrument rather than the fact. Re-run against a genuinely
   unresolved import, both branches compiled. (Found by T231's blind
   author against its own tree; re-measured here before this header
   was rewritten, because a finding taken on report is a finding
   nobody checked.)

   **So the absence detector is NOT a type.** It is the runtime
   binding cell above, and the source cell below, both of which sit
   outside the type system and can therefore see what it cannot.

   What they are for is the day after the merge. The moment the
   barrel lands, the same lines start comparing the real declared
   shapes against the Published signatures block, and a field the
   implementer spelled differently, widened, or left optional stops
   the typecheck.

   **The debt this leaves, stated so it can be collected.** It is
   the SHAPE half only — the absence half is covered by the source
   cell below and does not wait for the merge. Nobody in this
   worktree can falsify these pins — the falsification is
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
 *
 * **`Keys<T>` distributes, and a bare `keyof` would not.** `keyof (A | B)` is the INTERSECTION
 * of the arms' keys, so an optional member added inside ONE arm of a union leaves `keyof`
 * unchanged and a non-distributive clause stays green — measured here: two three-armed unions
 * differing by one optional member compared EXACT under a bare `keyof` and correctly unequal
 * under this one. `PublishInput` and `PublishResult` are interfaces rather than unions, so the
 * distinction does not currently bite these pins; it is here so it never can. Reported by
 * T231's blind author, verified in this tree before being adopted.
 */
type Keys<T> = T extends unknown ? keyof T : never;

type Exact<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? [Keys<A>] extends [Keys<B>]
      ? [Keys<B>] extends [Keys<A>]
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

/* ------------------------------------------------------------
   The two lines that fail the typecheck once the barrel exists
   and disagrees — and they only became those lines just now.

   **They read `= true as PinInput` until this commit, and the cast
   made them inert.** `true as false` is a permitted comparability
   conversion, so the assertion absorbed exactly the disagreement it
   was written to surface: four mutations to the real interfaces
   produced no diagnostic here at all, and the only line that caught
   them was the runtime comparison below — the one this file's own
   comment called bookkeeping rather than a guard.

   Measured before changing it, on a local `type Disagrees = false`
   so the absent barrel could not confound the result:
   `const a: Disagrees = true as Disagrees` compiles clean, and
   `const a: Disagrees = true` is `TS2322`. The cast was the whole
   difference.

   That is the corollary from the `Exact<>` work arriving one level
   in: **the line described as decoration was the guard, and the
   lines described as the guard were decoration** — with a comment
   inviting a tidier to delete the working one.
   ------------------------------------------------------------ */
const _pinInput: PinInput = true;
const _pinResult: PinResult = true;

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
type UnionA = { k: "a"; x: string } | { k: "b"; y: string };
type UnionB = { k: "a"; x: string; extra?: number } | { k: "b"; y: string };

const _exactDiscriminates: [
  Exact<{ a: string }, { a: string }>,
  Exact<{ a: string }, { a: string; b?: number }>,
  Exact<{ a: string }, { a?: string }>,
  Exact<{ a: string }, { a: number }>,
  /* The union near-miss. A bare `keyof` answers `true` here and cannot see the added member. */
  Exact<UnionA, UnionB>,
] = [true, false, false, false, false];

describe("T100 published shapes", () => {
  it("pins PublishInput and PublishResult — vacuous until the barrel lands", () => {
    /* **This comparison is a second compile-time guard, not bookkeeping**, and the earlier
       version of this comment saying otherwise is what made the file misleading. When a pin
       resolves to `false`, `_pinInput === true` is `TS2367` — "these types have no overlap" —
       so this line reds at build time exactly as the declarations above now do. It was in fact
       the ONLY line that caught four mutations to the real interfaces while those declarations
       still carried their neutering cast.

       Both are kept. They fail with different codes (`TS2322` on the declaration, `TS2367`
       here) and a reader who sees only one has still been told. The runtime `expect` also puts
       the debt in the run's output rather than only in a comment nobody opens. */
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
    ).toEqual([true, false, false, false, false]);
  });
});

/* ============================================================
   The absence detector, which cannot be a type

   A type-level instrument cannot observe its own blindness;
   something outside it has to. The pins above are inert against an
   absent barrel — not weakly, but completely, accepting every
   verdict with no diagnostic — so nothing in this file's type space
   can tell a reader whether a red typecheck means *a member is
   missing* or *an assertion failed*.

   `publish` itself has a runtime witness: the binding cells at the
   top of this file import the barrel and red with the clause that
   published it. **`PublishInput` and `PublishResult` have none** —
   types are erased, so no import can observe them at runtime, and
   the pins that would observe them at compile time are exactly the
   ones the error type absorbs.

   That leaves reading the source. A string search is a weaker
   instrument than a type check and it is not pretending otherwise:
   its whole job is answering "is the name there at all", which is
   the one question the strong instrument provably cannot answer.
   The pins take over on shape the moment the barrel exists.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BARREL_DIR = join(process.cwd(), "lib", "server", "publish");
const BARREL_FILE = join(BARREL_DIR, "index.ts");

describe("T100 — the barrel exists and names what it published", () => {
  it("has a barrel at `lib/server/publish/index.ts`", () => {
    expect(
      existsSync(BARREL_FILE),
      `${BARREL_FILE} does not exist.\n` +
        `  T100 owns \`lib/server/publish/**\` and its Published signatures block ` +
        `ends "Barrel: \`@/lib/server/publish\`".\n` +
        `  This cell exists because the type pins in this file CANNOT report it: an unresolved ` +
        `import collapses to the error type and every pin over it accepts any verdict.`,
    ).toBe(true);
  });

  it("names `PublishInput` and `PublishResult` in an export position", () => {
    if (!existsSync(BARREL_FILE)) {
      throw new Error(
        `${BARREL_FILE} does not exist; see the cell above. Reported separately so an absent ` +
          `barrel and a barrel missing a type are two different reds rather than one.`,
      );
    }
    const source = readFileSync(BARREL_FILE, "utf8");

    /* Permissive on purpose: `export type { PublishInput }`, `export interface PublishInput`,
       a multi-line `export type { … } from "./types"` block, and two separate export lines all
       count. What is being asked is whether the NAME is published at all — the `Exact<>` pins
       decide its shape, and they become meaningful the instant this file resolves.

       **Falsified against six synthetic barrels rather than asserted to work**, since the real
       one cannot be created from this worktree (`lib/server/publish/**` is the implementer's
       partition). It passes both-re-exported, both-declared-inline and two-separate-lines; it
       reds one-missing, both-missing, and — the case worth having — names that are DECLARED
       but never exported, which a naive `includes()` would wave through.

       Its one known blind spot, stated rather than left for a reader to find: `[^;]*` crosses
       newlines, so a semicolon-less export statement sitting immediately above a non-exported
       declaration of the same name would false-pass. No barrel in this repository is written
       that way, and the cost of narrowing the pattern is losing the multi-line export block,
       which every barrel here does use. */
    const missing = (["PublishInput", "PublishResult"] as const).filter(
      (name) => !new RegExp(`export[^;]*\\b${name}\\b`, "u").test(source),
    );

    expect(
      missing,
      `The barrel does not export ${missing.join(" or ")}.\n` +
        `  Published as:\n    ${PUBLISHED.PublishInput}\n    ${PUBLISHED.PublishResult}\n` +
        `  A type absent from the barrel is a type no blind suite can bind, and the \`Exact<>\` ` +
        `pins above stay silently vacuous rather than reporting it.`,
    ).toEqual([]);
  });
});
