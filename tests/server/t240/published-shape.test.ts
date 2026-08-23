/* ============================================================
   T240 — the published shapes, pinned where only `tsc` can read
   them

   AC3's structural half is *"the type rejects a nested value"*,
   and vitest does not typecheck, so **no runtime cell in this
   file can observe it at all.** The assertions are the `const`
   declarations below; `npm run typecheck` evaluates them, and
   the `it()` blocks exist only so the caveats travel with the
   pins instead of living in a handback nobody reads next to the
   code.

   ── THIS WHOLE FILE IS VACUOUS TODAY, and HOW it is vacuous is
      not what I predicted ──
   `@/lib/server/observability` is not on disk at `fe143a7`
   (measured — `surface.test.ts` prints the barrel state). The
   inherited finding, from this run's T231, was that an
   unresolved operand collapses the whole pin to the error type,
   so a guard accepts `true`, accepts `false`, and accepts the
   vacuity sentence itself.

   **I predicted that would hold uniformly here and MEASURED that
   it does not.** `npm run typecheck` at `fe143a7` produces
   exactly 7 errors, ALL of them in `tests/server/t240/**` and
   none anywhere else in the repository, and they split along a
   line the inherited finding does not draw:

     1 x TS2307   the import line below
     1 x TS2307   the same specifier in `contract.ts`
     5 x TS2322   every `Assignable<…> = false` NEGATIVE

   and **zero** on any `Pin<…> = true` positive.

   The split is by which operand sits in the conditional's CHECK
   position. `Assignable<A, B> = [A] extends [B] ? …` with a
   CONCRETE `A` and the unresolved import in `B` resolves
   normally — the error type behaves like `any` on the right of
   `extends`, so the conditional takes its true branch, the
   negative evaluates to `true`, and `= false` reds. Loud, and
   about nothing. `Pin<A, B>` puts the unresolved import in `A`,
   where it is the type being CHECKED, and there the collapse the
   inherited finding describes does happen.

   **Falsified rather than reasoned about**: flipping
   `auditEntryIsTheSevenFields` from `= true` to `= false` and
   re-running `tsc` produced NO new error. The positive accepts
   both, so it asserts nothing at all — while the six negatives
   below red for a reason that has nothing to do with any
   criterion.

   **So the six TS2322s are not findings and must not be read as
   any.** They go away when the module lands, and become
   load-bearing the same day. What reports the absence is not a
   type at all: the two `TS2307`s, and the runtime cell in
   `surface.test.ts` that dynamic-imports the barrel and lists
   `Object.keys`. Read that cell first; then read these.

   The `any` short-circuit in `Pin<>` is kept because it is not
   useless — it fires for an operand that is genuinely `any`
   rather than unresolved — but it must not be read as covering
   the absent-module case, which is the case that holds here.

   ── which text these pins are bound to ──
   The rulings, not the Published signatures block, wherever the
   two disagree — `GAP-240-A` in `surface.test.ts` is that
   disagreement written down as a red. The rulings are the later
   text. Specifically: `listAudit`'s return is D-240-02's, and
   `action` is D-240-03's union rather than the block's `string`.
   ============================================================ */

import { describe, expect, it } from "vitest";

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type {
  AUDIT_ACTIONS,
  AuditEntry,
  AuditStoreError,
  listAudit,
  writeAudit,
} from "@/lib/server/observability";

import { publishedBlock, signature } from "./contract";

/* ============================================================
   the pin machinery

   Mutual assignability ALONE reports `{a: string}` and
   `{a: string; b?: number}` as EQUAL, because an optional member
   is assignable in both directions — and an implementer adding a
   field nobody published is precisely what a pin on a published
   interface most needs to catch. `AuditEntry` has three optional
   members, so this file would be blind to a fourth without the
   key-set clause.

   `Keys<T>` DISTRIBUTES. `keyof` on a union is the INTERSECTION
   of its arms' keys, so the obvious repair misses the defect on
   any union — and `Actor`, which `listAudit` takes, is a
   three-armed one.
   ============================================================ */

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
 * `ExactK`, with the vacuity stated rather than inherited — for the `any` case only.
 *
 * See the header: this short-circuit is INERT for the case that actually holds today, an
 * unresolved import, because the error type collapses the conditional along with everything
 * else. It is kept for the genuinely-`any` case and claims nothing beyond it.
 */
type Pin<A, B> = IsAny<A> extends true
  ? "VACUOUS: the pinned type resolved to `any`, so this pin was NEVER EVALUATED. Read surface.test.ts's barrel-state cell, not this line."
  : IsAny<B> extends true
    ? "VACUOUS: the expected type resolved to `any`, so this pin was NEVER EVALUATED."
    : ExactK<A, B>;

/** One-way. Every negative below is `Assignable<…> = false`. */
type Assignable<A, B> = [A] extends [B] ? true : false;

/* ============================================================
   AuditEntry — the block's seven fields, exactly

   `action` is D-240-03's union and not the block's `string`;
   GAP-240-A carries that divergence as a red of its own.
   ============================================================ */

const auditEntryIsTheSevenFields: Pin<
  AuditEntry,
  {
    actorId: string | null;
    actorKind: "owner" | "operator" | "system";
    action: (typeof AUDIT_ACTIONS)[number];
    targetKind?: string;
    targetId?: string;
    decision: "allowed" | "denied" | "error";
    detail?: Record<string, string | number | boolean>;
  }
> = true;

/**
 * AC5, as a type: the three decisions are exactly the schema's enum and nothing else.
 *
 * A fourth member would make `decision` unable to answer the question AC5 asks of it, and a
 * missing `denied` collapses a policy refusal into a fault — which is D-240's central
 * hazard, held here structurally as well as at the row.
 */
const decisionIsTheThreeMembers: Pin<
  AuditEntry["decision"],
  "allowed" | "denied" | "error"
> = true;

/** AC2, as a type: the distinction is `actorKind`, so its domain is the schema's enum. */
const actorKindIsTheThreeMembers: Pin<
  AuditEntry["actorKind"],
  "owner" | "operator" | "system"
> = true;

/**
 * **D-240-03's whole point, and it is a negative.**
 *
 * With `action` typed as the closed `AUDIT_ACTIONS` union, an action naming a blueprint run
 * CANNOT BE PASSED. Over an open `string` — which is what the Published signatures block
 * still writes — this pin is `true` and the product's absolute constraint is held by
 * remembering. The negative is the assertion; the positive above cannot express it.
 */
const anInventedActionIsRefused: Assignable<
  { actorId: null; actorKind: "system"; action: "blueprint.run"; decision: "allowed" },
  AuditEntry
> = false;

/* ============================================================
   AC3's structural half — and D-240-07's correction to what it
   is allowed to claim

   The block: "a scalar-only map cannot hold a nested object, so
   a DOT source, a card body or a driver error CANNOT BE PASSED
   rather than merely being discouraged."

   True, and the first pin is that sentence. **D-240-07 rules
   that this is ONE of AC3's two clauses and the block claims
   both.** AC3 also says "or a credential", and a credential is a
   flat string: `detail: { key: secret }` typechecks. So does
   spreading a validated flat body — and the block's own example
   (old handle, new handle) is that exact shape, so the shape
   cannot be refused without refusing the example.

   The second pin states that in the same place, as a POSITIVE,
   deliberately. Without it a reader finds a green "the type
   rejects a nested value" and inherits the stronger claim that
   AC3 is covered. **Half of AC3 is a caller's discipline and
   nothing here holds it.**
   ============================================================ */

type Detail = NonNullable<AuditEntry["detail"]>;

/** The clause the type DOES hold: a nested object cannot be passed. */
const aNestedDetailIsRefused: Assignable<{ dot: { source: string } }, Detail> = false;

/** An array is the same defect in another shape — a card body arrives as one. */
const anArrayDetailIsRefused: Assignable<{ nodes: string[] }, Detail> = false;

/** A driver error is an object, and B-03 is the reason it must not reach a log field. */
const anErrorDetailIsRefused: Assignable<{ cause: Error }, Detail> = false;

/**
 * **The clause the type does NOT hold, pinned as a green so nobody mistakes the above for
 * coverage of AC3.**
 *
 * This is not a criterion failing. It is D-240-07's ruling, asserted: a credential is a flat
 * string and the scalar-only map admits it. If this ever goes red the type was widened or
 * narrowed in a way the ruling did not authorise, and the module comment that says *which
 * clause the type holds* has to move with it.
 */
const aFlatCredentialIsADMITTED: Assignable<{ apiKey: string }, Detail> = true;

/** The block's own example, which is the shape that cannot be refused. Same green, said twice. */
const theBlocksOwnExampleIsAdmitted: Assignable<
  { oldHandle: string; newHandle: string },
  Detail
> = true;

/* ============================================================
   the two functions
   ============================================================ */

/** `writeAudit(db, entry): Promise<void>` — the block's line, unamended by any ruling. */
const writeAuditTakesADbAndAnEntry: Pin<
  typeof writeAudit,
  (db: Db, entry: AuditEntry) => Promise<void>
> = true;

/**
 * **D-240-02, and it is the ruling this pin exists for.**
 *
 * The block writes `Promise<AuditEntry[]>`. AC1 names *"actor, action, target **and
 * time**"*, `AuditEntry` carries no time, and the same signature takes `since?: Date` — a
 * filter over a quantity its own return type cannot expose. The ruling adds `occurredAt` to
 * the READ shape only; writers still leave the column to its DB default, which is why
 * `AuditEntry` itself is unchanged above.
 */
const listAuditReturnsEntriesCarryingTheirTime: Pin<
  typeof listAudit,
  (
    db: Db,
    actor: Actor,
    filter: { targetKind?: string; targetId?: string; since?: Date },
  ) => Promise<(AuditEntry & { occurredAt: Date })[]>
> = true;

/**
 * The negative that makes the pin above load-bearing rather than decorative.
 *
 * A `listAudit` returning the block's bare `AuditEntry[]` must STOP type-checking against
 * the ruled signature. Without this, an implementation that shipped the block's return type
 * would satisfy a reader who only looked at the positive — mutual assignability plus a
 * matching key set is what separates them, and `occurredAt` is the one key that differs.
 */
const theBlocksBareReturnIsRefused: Assignable<
  (db: Db, actor: Actor, filter: { targetKind?: string; targetId?: string; since?: Date }) => Promise<AuditEntry[]>,
  typeof listAudit
> = false;

/**
 * **D-240-04 has no `actorId` member on `filter`, and that absence is deliberate.**
 *
 * "Whether an account may read its own `actorId` rows is a product decision nobody has
 * made; `filter` has no `actorId` member to express it with." So a filter carrying one is a
 * contract change, and this pin is where it announces itself instead of arriving as a quiet
 * widening.
 *
 * **Written as an `ExactK` over the filter parameter and NOT as an `Assignable<…> = false`
 * over the whole function, and the difference was measured rather than assumed.** The
 * obvious negative — a `listAudit` whose filter carries `actorId?` must stop type-checking
 * against the published one — is WRONG, and it would have reddened a correct
 * implementation: under `strictFunctionTypes` a parameter is checked contravariantly, so a
 * function taking the WIDER filter is assignable to one taking the narrower, because
 * `{targetKind?; targetId?; since?}` is assignable to the same object plus an OPTIONAL
 * `actorId?`. The negative would have evaluated to `true` and reported the added member as
 * absent.
 *
 * `Pin<>` catches it where the defect actually lives: its distributing key-set clause is
 * exactly the thing mutual assignability is blind to, and an added optional member changes
 * the key set.
 */
const theFilterHasNoActorIdMember: Pin<
  Parameters<typeof listAudit>[2],
  { targetKind?: string; targetId?: string; since?: Date }
> = true;

/* ============================================================
   D-240-05 — `AuditStoreError` is a class, not a shape
   ============================================================ */

/**
 * The instance shape, pinned only where the ruling pins it: `cause` is NON-ENUMERABLE and
 * `name` sits on the prototype, so neither is a member this type can see. What is asserted
 * is that the class exists and that an instance is an `Error` — the rest of the ruling is
 * about enumerability, which is a runtime property and is asserted in `store-error.test.ts`
 * where it can actually be observed.
 */
const auditStoreErrorIsAnError: Assignable<AuditStoreError, Error> = true;

/* ============================================================
   the near-miss, against a LOCAL restatement

   This shows the technique separates two shapes differing by
   exactly one optional member. It is a consistency check on the
   INSTRUMENT and it says nothing whatever about the
   implementation — a check written by the author of the
   assertions is never a second axis. It is here because zero
   errors alone is RESOLUTION; green-against-red on two shapes
   differing by one member is DISCRIMINATION, and only the second
   is worth reporting.
   ============================================================ */

interface LocalEntry {
  actorId: string | null;
  actorKind: "owner" | "operator" | "system";
  action: string;
  decision: "allowed" | "denied" | "error";
}

interface LocalEntryPlusOne extends LocalEntry {
  /** The added optional member a mutual-assignability pin is blind to. */
  requestId?: string;
}

/** Green: the pin resolves the identity it should. */
const theInstrumentSeesAMatch: Pin<LocalEntry, LocalEntry> = true;

/** Red-if-broken: the added OPTIONAL member is the case `Exact<>` by assignability misses. */
const theInstrumentSeesAnAddedOptional: Pin<LocalEntry, LocalEntryPlusOne> = false;

/** And the distributing key-set clause, over a union — `keyof` alone would answer the intersection. */
type LocalUnion = { tag: "a"; only: string } | { tag: "b"; other: number };
type LocalUnionPlusOne = { tag: "a"; only: string; added?: boolean } | { tag: "b"; other: number };
const theInstrumentSeesAnAddedOptionalInsideAUnionArm: Pin<LocalUnion, LocalUnionPlusOne> = false;

describe("T240 — the type-level pins, and what they are worth today", () => {
  /**
   * Every declaration above is referenced, so `noUnusedLocals` cannot quietly delete the
   * file's assertions, and so a reader running vitest is told where the assertions actually
   * live. The `expect` is trivial on purpose: the pin is the `const`, not this line.
   */
  it("declares the pins tsc evaluates (vitest cannot read any of them)", () => {
    const pins = [
      auditEntryIsTheSevenFields,
      decisionIsTheThreeMembers,
      actorKindIsTheThreeMembers,
      anInventedActionIsRefused,
      aNestedDetailIsRefused,
      anArrayDetailIsRefused,
      anErrorDetailIsRefused,
      aFlatCredentialIsADMITTED,
      theBlocksOwnExampleIsAdmitted,
      writeAuditTakesADbAndAnEntry,
      listAuditReturnsEntriesCarryingTheirTime,
      theBlocksBareReturnIsRefused,
      theFilterHasNoActorIdMember,
      auditStoreErrorIsAnError,
      theInstrumentSeesAMatch,
      theInstrumentSeesAnAddedOptional,
      theInstrumentSeesAnAddedOptionalInsideAUnionArm,
    ];
    expect(
      pins.length,
      "a pin was added or removed without this list moving with it, so `noUnusedLocals` is " +
        "no longer holding the file together.",
    ).toBe(17);
  });

  /**
   * The one thing about this file vitest CAN check: that the block it is pinned against is
   * the block that was read. Not a substitute for the pins — a guard on their subject.
   */
  it("is pinned against a block that still declares both functions and AuditEntry", () => {
    expect(signature("writeAudit").returns).toBe("Promise<void>");
    expect(
      publishedBlock().interfaces.map((i) => i.name),
      "the pins above quantify over `AuditEntry` as the block declares it.",
    ).toContain("AuditEntry");
  });

  /**
   * **The claim this file makes about itself, stated as a cell so it is not a comment
   * nobody reads.**
   *
   * `theInstrumentSeesAnAddedOptional` and its union sibling are declared `= false`. If the
   * key-set clause were dropped from `ExactK`, both would resolve `true` and `tsc` would red
   * them — that is the near-miss, and it is what distinguishes an instrument that works from
   * one that merely resolves. It is a consistency check on the machinery and NOT a second
   * axis on the implementation, and the difference is why this cell asserts nothing about
   * `@/lib/server/observability`.
   */
  it("claims discrimination for the machinery and nothing for the module", () => {
    expect(theInstrumentSeesAMatch).toBe(true);
    expect(theInstrumentSeesAnAddedOptional).toBe(false);
    expect(theInstrumentSeesAnAddedOptionalInsideAUnionArm).toBe(false);
  });
});
