/* ============================================================
   T120 — the published surface

   Two kinds of cell live here and the file says which is which,
   because counting them together would overstate the coverage.

   **Surface cells** bind the module. Every one of them RESOLVES
   the barrel first, so in the blind position they red, and that
   red IS the blind position rather than a defect.

   **Document-floor cells** read `backend.md` alone and are GREEN
   in the blind position by construction. They are not criterion
   coverage and must never be counted as any: what they do is red
   the day the parse and the contract disagree, which is the one
   failure a derived domain cannot see in itself. T180's contract
   keeps the same split for the same reason.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  BARREL,
  barrelExports,
  describe_,
  isAdmissible,
  keysOf,
  loadLifecycle,
  pendingAmendments,
  publishedBlock,
  required,
  requiredFn,
  signature,
  type Namespace,
} from "./contract";

/* --------------------- document floors --------------------- */

describe("T120 document floor — the parse and the contract agree (GREEN blind; not criterion coverage)", () => {
  it("§T120 publishes four verbs, two interfaces and six criteria", () => {
    const block = publishedBlock();
    expect(block.signatures.map((s) => s.name)).toEqual([
      "planTransfer",
      "transferBundle",
      "planDeletion",
      "deleteAccount",
    ]);
    expect(block.interfaces.map((i) => i.name)).toEqual(["TransferPlan", "DeletionPlan"]);
    expect(block.criteria).toHaveLength(6);
  });

  it("the two plan shapes carry the key sets D-120-08/09/15 ruled", () => {
    /* D-120-15 amended the block after both halves charged that "the block is amended" was a
       sentence about an edit that had not happened (F-120-P). These two lines are what red if
       it is ever un-amended: the ruling and the block have to keep saying the same thing. */
    expect(keysOf("TransferPlan")).toEqual([
      "bundleId",
      "fromAccountId",
      "toAccountId",
      "slug",
      "collides",
    ]);
    expect(keysOf("DeletionPlan")).toEqual([
      "accountId",
      "handle",
      "privateBundles",
      "privateCards",
      "publishedBundles",
      "publishedCards",
    ]);
    /* D-120-08: `null` means no handle was ever allocated. The type, not just the key. */
    expect(publishedBlock().interfaces[1].fields[1]).toBe("handle: string | null");
  });

  it("no amendment of this suite's own is still needed, so the F-120-P workaround stays retired", () => {
    /* `AMENDMENTS` rewrote the block's key set while D-120-08/09 had not reached it. It is
       inert now and kept rather than deleted: it is the executable record of that defect and
       it reds if the block regresses. A workaround with no expiry is a second contract, so
       this cell is the expiry. */
    expect(
      pendingAmendments().map((a) => `${a.ruling}: ${a.what}`),
      "an amendment in tests/server/t120/contract.ts is live again, which means backend.md " +
        "§T120's published block has drifted back behind a ruling in its own section.",
    ).toEqual([]);
  });

  it("the section publishes twelve refusal forms over seven bodies, and three error classes", () => {
    const block = publishedBlock();
    /* TWELVE (verb, body) pairs over SEVEN bodies. Eleven for one round: the twelfth,
       `planDeletion: not this account's owner.`, is the pair D-120-12's K required and no
       ruling enumerated — this suite MEASURED the module raising it and D-120-20 was
       corrected. Reached by parsing rather than by agreeing with the count. */
    expect(block.forms).toHaveLength(12);
    expect(block.bodies).toHaveLength(7);
    expect(block.errorClasses).toEqual([
      "DeletionRefusedError",
      "LifecycleStoreError",
      "TransferRefusedError",
    ]);
  });

  it("D-120-20: the section's one FORBIDDEN pairing is read as forbidden, not as published", () => {
    const block = publishedBlock();
    /* D-120-20 closed this suite's declared E1 gap and poisoned its reader in the same
       sentence: it quotes `deleteAccount: only the owner may transfer a bundle.` in order to
       outlaw it, and a delimiter-keyed reader cannot tell that from publishing it. The count
       went 11 -> 12 and `isAdmissible` began accepting the one pairing just outlawed. The
       quote is now kept as `forbidden` rather than dropped, which turns the hazard into this
       assertion. */
    expect(block.forbidden.map((f) => f.message)).toEqual([
      "deleteAccount: only the owner may transfer a bundle.",
    ]);
    expect(isAdmissible("deleteAccount", "deleteAccount: only the owner may transfer a bundle.")).toBe(
      false,
    );
    /* And the partition is non-empty on BOTH sides, so a future ruling that moved every form
       to one side reds here instead of silently emptying the admissible set. */
    expect(block.forms.length).toBeGreaterThan(0);
    expect(block.forbidden.length).toBeGreaterThan(0);
  });

  it("the admissible reader accepts a rendered form and refuses a reworded one", () => {
    /* `isAdmissible` is this suite's whole refusal instrument, and an instrument that accepts
       everything is worse than none: `rejects.toThrow(undefined)` is satisfied by any throw,
       which is the blind-position launderer D-180-06 names. Both directions, here, once. */
    expect(isAdmissible("transferBundle", "transferBundle: no bundle at `abc`.")).toBe(true);
    expect(isAdmissible("transferBundle", "transferBundle: something else entirely.")).toBe(false);
    /* The verb prefix must be the verb that raised it — a `deleteAccount:` sentence out of
       `transferBundle` is not admissible however well-published the body is. */
    expect(isAdmissible("transferBundle", "deleteAccount: not this account's owner.")).toBe(false);
    /* And the sentence ends where the contract ends it: trailing prose is a different message. */
    expect(isAdmissible("transferBundle", "transferBundle: no bundle at `abc`. Retry.")).toBe(false);
    /* D-120-20 made this PAIR matching: a body paired with a verb the rulings do not send
       down it is a module defect, not an admissible variant. `transferBundle` has a
       `no bundle at` arm and `planDeletion` does not, so the same body is admissible from one
       and refused from the other — which is the whole content of the ruling. */
    expect(isAdmissible("planDeletion", "planDeletion: no bundle at `abc`.")).toBe(false);
    expect(isAdmissible("planDeletion", "planDeletion: no account at `abc`.")).toBe(true);
  });
});

/* --------------------- the surface itself --------------------- */

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
