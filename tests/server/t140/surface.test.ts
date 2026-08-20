/* ============================================================
   T140 — the published surface

   Every name here is bound EXACTLY. backend.md §T140 carries a
   Published signatures block, and the rule above it is that the
   contract must name the interface and not only the behaviour, so
   a name the block publishes is no longer a thing either side may
   choose. There is no candidate list anywhere in this suite: two
   rounds of evidence in T000 showed a list that resolves to the
   WRONG thing is more dangerous than one resolving to nothing,
   because the failure it reports is indistinguishable from a
   defect until somebody checks by hand.

   No database. Nothing here touches Postgres, so it runs wherever
   the barrel does.

   ── what is deliberately NOT asserted here ──
   That the barrel exports NOTHING beyond what is named. D-140-02
   published `SaveStoreError` after this file was first written, and
   a module may reasonably publish a store wrapper beside it the way
   `registry` publishes `withRegistryStore`. The block names neither
   way, so an exhaustive assertion would be a suite filling the
   contract's silence and becoming a second contract.

   What IS asserted about the boundary is D-140-02's own structural
   claim: `NotAccountOwnerError` is CONSUMED from
   `@/lib/server/accounts` rather than minted here. Stated as an
   IDENTITY rather than as a prohibition — a re-export of T050's
   class is fine and a second class of the same name is not, and
   only an object comparison separates those two.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { NotAccountOwnerError } from "@/lib/server/accounts";

import {
  MESSAGE_FORMS,
  NOT_ACCOUNT_OWNER_ERROR,
  PUBLISHED,
  PUBLISHED_KINDS,
  PUBLISHED_NAMES,
  PUBLISHED_READERS,
  PUBLISHED_WRITERS,
  SAVES,
  SAVE_RECORD_KEYS,
  bind,
  bindSaveStoreError,
  loadSaves,
  schemaTargetKinds,
  storeFailedMessage,
} from "./contract";
import type { PublishedName } from "./contract";

/* ============================================================
   `SaveRecord`, bound at COMPILE time

   `npm run typecheck` is what evaluates the line below, and it is
   the only instrument that can bind a type: a runtime check sees
   an object's keys and never its declaration. T060's precedent —
   an `Exact<>` identity check over `Actor`/`Resource`/`Action`,
   falsified three ways, each lighting up its own slot.

   The import is `import type`, so it erases and cannot break
   collection while the module is absent; `tsc` reports it and the
   assignment below, which is the expected red until the barrel
   exists, pre-registered rather than discovered.
   ============================================================ */

import type { SaveRecord } from "@/lib/server/saves";

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

/** Verbatim from the block: `{ targetKind: "blueprint" | "card" | "term"; refId: string; savedAt: Date }`. */
interface PublishedSaveRecord {
  targetKind: "blueprint" | "card" | "term";
  refId: string;
  savedAt: Date;
}

const saveRecordIsExact: Exact<SaveRecord, PublishedSaveRecord> = true;

describe("T140 publishes exactly the surface backend.md names", () => {
  /* One test per name, so an absence is its own red rather than five hidden behind the first. */
  it.each(PUBLISHED_NAMES)("%s is exported from the barrel as a function", async (name) => {
    const fn = await bind(name as PublishedName);
    expect(typeof fn, `${SAVES} must export \`${name}\`: ${PUBLISHED[name as PublishedName]}`).toBe(
      "function",
    );
  });

  it("the record spells the kind `targetKind` and the parameter spells it `kind`", () => {
    /*
     * Both spellings are published in the same block and both are bound. This cell exists
     * because the asymmetry looks like a slip and is the single most likely thing for an
     * implementation to "tidy" into one name — at which point `SaveRecord` is no longer the
     * shape T262 was promised.
     *
     * `saveRecordIsExact` is referenced here rather than asserted in a cell of its own,
     * deliberately. At RUNTIME that constant is `true` whatever `SaveRecord` turns out to be —
     * a standalone `expect(saveRecordIsExact).toBe(true)` is a cell that cannot fail, and this
     * run's rule is to delete one rather than carry it. The check it carries is real and it is
     * `tsc`'s: a member added, removed, widened or made optional collapses `Exact<>` to `never`
     * and `npm run typecheck` reports TS2322 on the declaration above. The assertions in this
     * body are the ones that can fail.
     */
    void saveRecordIsExact;
    expect([...SAVE_RECORD_KEYS].sort()).toEqual(["refId", "savedAt", "targetKind"]);
    for (const name of ["saveTarget", "unsaveTarget", "migrateLocalSaves"] as const) {
      expect(
        PUBLISHED[name],
        `the \`target\` parameter of \`${name}\` is published with \`kind\`, not \`targetKind\``,
      ).toContain('kind: "blueprint" | "card" | "term"');
    }
  });
});

describe("the domain this suite quantifies over is the published one", () => {
  /*
   * The construction's own guard. Every privacy cell in this suite is a cross product over
   * `PUBLISHED_READERS` and `PUBLISHED_WRITERS`, which are DERIVED from the published text by
   * asking which signatures end in `Promise<void>`. That derivation is only a construction over
   * the surface if the partition is total and neither half is empty — a partition that silently
   * collapsed to one side would leave every cell on the other side vacuous while the counts
   * still looked plausible, which is this run's most-charged shape.
   *
   * Equalities, not floors. A floor absorbs additions silently and then stops detecting
   * removals; an equality reds in both directions, so a sixth published function cannot land
   * without somebody looking at this line.
   */
  it("the five published names partition into readers and writers, totally", () => {
    expect(PUBLISHED_NAMES.length, "backend.md §T140 publishes five functions").toBe(5);
    expect([...PUBLISHED_READERS, ...PUBLISHED_WRITERS].sort()).toEqual([...PUBLISHED_NAMES].sort());
    expect(PUBLISHED_READERS.length, "listSaves and countSaves hand the caller data").toBe(2);
    expect(PUBLISHED_WRITERS.length, "saveTarget, unsaveTarget and migrateLocalSaves answer void").toBe(3);
  });

  it("the three target kinds the block publishes are the three the schema declares", () => {
    /*
     * BOTH directions, deliberately. Deriving the kind domain from `schema.targetKind` alone
     * would make this suite robust to the schema changing and BLIND to it disagreeing with the
     * contract — those are opposite properties of one choice, and a derived fill answers "what
     * must I supply?" and never "is that what was published?".
     *
     * `lib/db/schema.ts` is Forbidden to T140 to EDIT. Reading it through drizzle is the route
     * the contract checklist already names for exactly this case.
     */
    const declared = [...schemaTargetKinds()].sort();
    const published = [...PUBLISHED_KINDS].sort();
    expect(
      declared,
      "`target_kind` and the block's union must name the same three kinds. If the enum gained a " +
        "member the block does not publish, this suite's cross products are covering a kind " +
        "nobody specified; if the block publishes one the enum lacks, no save of that kind can " +
        "be stored at all.",
    ).toEqual(published);
    expect(published, "blueprint, card and term — B-10's polymorphic target").toEqual([
      "blueprint",
      "card",
      "term",
    ]);
  });
});

/* ============================================================
   D-140-02 — the two classes, and which barrel each comes from

   The ruling's content is a SPLIT: T140 publishes `SaveStoreError`
   for D-13 and CONSUMES `NotAccountOwnerError` from
   `@/lib/server/accounts` rather than minting a second class for
   one decision. Binding them from different places is the
   assertion, not an accident of where they happen to live.
   ============================================================ */

describe("D-140-02: the module publishes one class and consumes the other", () => {
  it("`SaveStoreError` is exported from the barrel and is an Error", async () => {
    const SaveStoreError = await bindSaveStoreError();
    expect(
      SaveStoreError.prototype instanceof Error || SaveStoreError.prototype === Error.prototype,
      "`tests/store-modules-seal-their-faults.test.ts` requires a lib/server module importing " +
        "@/lib/db to publish an error class, and `tests/error-hygiene.test.ts` walks every " +
        "export whose `prototype instanceof Error` — a class outside that walk is invisible to " +
        "both. An absent class leaks by not existing.",
    ).toBe(true);
  });

  it("`SaveStoreError` constructs at the published arity and renders the published form", async () => {
    const SaveStoreError = await bindSaveStoreError();
    const cause = new Error("a driver fault this suite minted");
    const err = new (SaveStoreError as new (operation: string, cause: unknown) => Error)(
      "saveTarget",
      cause,
    );

    expect(
      err.message,
      `D-140-02 publishes the form \`${MESSAGE_FORMS.SaveStoreError}\`, and it is built here as a ` +
        `LITERAL rather than imported — an expectation taken from the module asserts that the ` +
        `module agrees with itself.`,
    ).toBe(storeFailedMessage("saveTarget"));

    /*
     * The one-argument arity too. `tests/error-hygiene.test.ts` constructs at both, because the
     * ES2022 cause option installs the property non-enumerably even when what is passed is
     * `undefined` — which is what keeps the two shapes rendering identically.
     */
    const bare = new (SaveStoreError as new (operation: string, cause?: unknown) => Error)(
      "listSaves",
    );
    expect(JSON.stringify(bare), "B-21: the enumerable surface is empty at either arity").toBe("{}");
    expect(Object.keys(bare)).toEqual([]);
  });

  it("`NotAccountOwnerError` is T050's class, not a second one wearing its name", async () => {
    const mod = await loadSaves();
    const reexported = mod[NOT_ACCOUNT_OWNER_ERROR];

    if (reexported === undefined) {
      /*
       * The ordinary case and it is a pass: the ruling says CONSUME, and a consumer does not
       * have to re-publish. `privacy.test.ts` is where the consumption is actually observed —
       * it asserts every writer's refusal is `instanceof` the class imported from
       * `@/lib/server/accounts`, which is the behavioural half and the one that matters.
       */
      expect(reexported).toBeUndefined();
      return;
    }

    expect(
      reexported,
      "the barrel exports something called `NotAccountOwnerError` that is NOT T050's class. " +
        "D-140-02 rules it CONSUMED from `@/lib/server/accounts` rather than minted here, and a " +
        "second class of the same name satisfies every check that compared names while failing " +
        "every `instanceof` a caller writes against T050's export. A re-export of the same " +
        "object is fine; this is not one.",
    ).toBe(NotAccountOwnerError);
  });
});
