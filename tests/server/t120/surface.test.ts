/* ============================================================
   T120 — the published surface

   Every cell binds the barrel first, so an absent module reds
   here with the import named rather than as a wall of member
   errors downstream.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  BARREL,
  barrelExports,
  describe_,
  loadLifecycle,
  publishedBlock,
  required,
  requiredFn,
  signature,
  type Namespace,
} from "./contract";

describe("T120 surface — the barrel", () => {
  it("`@/lib/server/lifecycle` resolves at all", async () => {
    const state = await barrelExports();
    expect(
      state.state,
      `${BARREL} did not import.\n` +
        `  This is the MODULE absent, not a member absent, and it is what the blind position ` +
        `looks like before the implementation lands. Every other cell in this suite reports ` +
        `the same condition in its own words; this one exists so a reader can tell "the ` +
        `module is not there" from "an assertion failed" without going and looking.\n` +
        `  Cause: ${describe_(state.cause)}`,
    ).toBe("present");
  });

  it("publishes the four verbs as functions, at the arity the block states", async () => {
    const mod = (await loadLifecycle()) as Namespace;
    for (const published of publishedBlock().signatures) {
      const fn = requiredFn(mod, published.name, published.text);
      /* `Function.length`, and the parse is what it is compared against. A `?` on a parameter
         erases at runtime and still counts, so only a default-value expression or a rest
         element can lower this — which is why an arity that DISAGREES is a real signature
         change and not a spelling difference. T100's `publish` shipped `?` here once and it
         was charged as F5. */
      expect(
        fn.length,
        `${published.name} declares ${fn.length} parameters and the block publishes ` +
          `${published.params.length}: ${published.text}`,
      ).toBe(published.params.length);
    }
  });

  it("publishes the three sanctioned error classes, and exactly those three", async () => {
    const mod = (await loadLifecycle()) as Namespace;
    const exported = Object.entries(mod)
      .filter(([, v]) => typeof v === "function" && (v as { prototype?: unknown }).prototype instanceof Error)
      .map(([name]) => name)
      .sort();

    /* Exactly, not at least. Every other barrel in this tree documents why it declines to
       re-export another module's class: `tests/error-hygiene.test.ts` counts every class
       exported from every barrel, so a re-export is counted twice and the equality — 44
       today, 47 at this merge under D-120-03 — stops being derivable. An extra class here is
       therefore a defect in a guard nobody would think to look at. */
    expect(
      exported,
      `${BARREL} exports ${exported.length} error classes and D-120-03 sanctions three. A ` +
        `re-export of another task's class is counted a second time by tests/error-hygiene, ` +
        `whose equality this merge moves from 44 to 47.`,
    ).toEqual([...publishedBlock().errorClasses]);
  });

  it("the two refusal classes are DISTINCT constructors, not one class under two names", async () => {
    const mod = (await loadLifecycle()) as Namespace;
    const transfer = required(mod, "TransferRefusedError", "D-120-03");
    const deletion = required(mod, "DeletionRefusedError", "D-120-03");

    /* D-180-04's discriminating cell, and the reason it is written this way is recorded
       there: pinning a class per refusal is NOT the assertion — two aliases of one class pass
       a per-refusal `instanceof` cell in both directions. Comparing the CONSTRUCTORS is what
       forbids the collapse. Here it runs the other way from D-180-04's (which forbade a
       split), because §T120 publishes two classes for two different operations and a route
       maps them to different statuses under D-120-14. */
    expect(transfer).not.toBe(deletion);
    expect(
      Object.getPrototypeOf(transfer) === deletion || Object.getPrototypeOf(deletion) === transfer,
      "one refusal class extends the other, so `instanceof` cannot separate a transfer " +
        "refusal from a deletion refusal and D-120-14's per-kind statuses collapse.",
    ).toBe(false);
  });

  it("the store fault is its own class and is not a refusal", async () => {
    const mod = (await loadLifecycle()) as Namespace;
    const store = required(mod, "LifecycleStoreError", "D-120-03 sanctions the third class");
    const transfer = required(mod, "TransferRefusedError", "D-120-03");
    const deletion = required(mod, "DeletionRefusedError", "D-120-03");

    /* D-13's division: a caller's error and a store fault are different things and a caller
       branching on `instanceof` must be able to tell them apart. A `LifecycleStoreError` that
       extended either refusal would make a database being down read as a refused transfer. */
    expect(store).not.toBe(transfer);
    expect(store).not.toBe(deletion);
    for (const refusal of [transfer, deletion]) {
      expect(
        Object.getPrototypeOf(store) === refusal,
        "LifecycleStoreError extends a refusal class, so a driver fault is indistinguishable " +
          "from a caller error at every call site that branches on it (D-13).",
      ).toBe(false);
    }
  });

  it("the transfer verbs return what the block says, observed through the value not the type", async () => {
    const mod = (await loadLifecycle()) as Namespace;
    /* A type-level pin is silently vacuous against an absent module and loudly useless
       against a barrel missing a member, so the RETURN of each verb is checked where it can
       be observed — in the cells that call it. What is checkable here without a database is
       that the block still says what those cells assume, so a return-type change reds in one
       place rather than as six mysterious failures. */
    expect(signature("planTransfer").returns).toBe("Promise<TransferPlan>");
    expect(signature("transferBundle").returns).toBe("Promise<BundleRecord>");
    expect(signature("planDeletion").returns).toBe("Promise<DeletionPlan>");
    expect(signature("deleteAccount").returns).toBe("Promise<void>");
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
