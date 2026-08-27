/* ============================================================
   T230 — the published surface

   `The contract must name the interface, not only the behaviour`.
   Every loop below quantifies over the block parsed out of
   `backend.md`, never over a list typed in this suite — and the
   first test is the floor that reds the day those two disagree.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  BARREL,
  TRANSCRIBED,
  loadLimits,
  messageForm,
  publishedArity,
  publishedBlock,
  publishedInterface,
  publishedInterfaces,
  publishedProblem,
  publishedType,
  requiredFn,
} from "./contract";

describe("T230 the domain this suite quantifies over", () => {
  /**
   * THE FLOOR. Every other loop in this suite iterates `publishedBlock()`, so a
   * contract that grew a fifth function would be covered silently and a contract that
   * renamed a field would be covered instead of the one these cells were written
   * against. Equality on the whole set rather than a subset or a count, because a
   * floor absorbs additions silently and then stops detecting removals.
   *
   * A red here is a contract amendment this suite has not been re-read against. It is
   * not a defect in `lib/server/limits`, and the message says so.
   */
  it("the parsed block is exactly the surface these cells were written against", () => {
    const block = publishedBlock();
    const stale =
      `backend.md §T230's Published signatures block has changed since this suite was ` +
      `written at \`dae638e\`. Nothing here is a statement about the implementation: the ` +
      `cells below quantify over the parsed block, so they are now covering a different ` +
      `surface than the one they were reasoned about. Re-read them against the amendment.`;

    expect(block.functions.map((f) => f.name).sort(), stale).toEqual(
      [...TRANSCRIBED.functions].sort(),
    );
    expect([...new Set(block.interfaces.map((i) => i.name))].sort(), stale).toEqual(
      Object.keys(TRANSCRIBED.interfaces).sort(),
    );
    expect(block.admissible.map((a) => a.name), stale).toEqual([...TRANSCRIBED.admissible]);

    for (const [name, fields] of Object.entries(TRANSCRIBED.interfaces)) {
      expect([...publishedInterface(name).fields].sort(), `${stale}\n  interface ${name}`).toEqual(
        [...fields].sort(),
      );
    }

    /* D-230-03's two aliases and the tier vocabulary `buckets()` recognises a config by. */
    expect(block.types.map((t) => t.name).sort(), stale).toEqual([...TRANSCRIBED.types].sort());
    expect(publishedType("Tier").literals, `${stale}\n  type Tier`).toEqual([
      ...TRANSCRIBED.tiers,
    ]);
  });

  /**
   * The block declares `LimitVerdict` TWICE — once in the signature list and once inside
   * D-230-10's own ruling — and two declarations of one shape in one document is two
   * chances for one to drift.
   *
   * This nearly went unnoticed here in the way that matters: the canonical line now ends
   * `}  // windowMs added by D-230-10`, so an `^interface ... \}$` match skipped it and
   * bound to the RESTATEMENT instead. Same shape, wrong source, and nothing would have
   * reddened the day the two disagreed.
   *
   * It is the peer's "two constructors for one document" charge one level up, at the
   * contract rather than at the code.
   */
  it("every shape the block declares more than once agrees with itself", () => {
    const byName = new Map<string, string[]>();
    for (const declared of publishedBlock().interfaces) {
      byName.set(declared.name, [...(byName.get(declared.name) ?? []), declared.fields.join(",")]);
    }
    for (const [name, spellings] of byName) {
      expect(
        [...new Set(spellings)].length,
        `The block declares \`interface ${name}\` ${spellings.length} times and they do not ` +
          `agree:\n` +
          publishedInterfaces(name)
            .map((i) => `    ${i.text}`)
            .join("\n") +
          `\n  A blind suite binds to whichever a parser matches first, so this cannot be ` +
          `resolved by choosing one — the declarations have to be reconciled in the block.`,
      ).toBe(1);
    }
  });

  /**
   * D-230-09's member list, parsed. This is the floor under `refusal.test.ts`'s
   * strongest cell, and the ruling says why the set rather than the members: T081's
   * key-set whitelist was the only instrument that caught an extension member carrying
   * a driver value once `type`, `title` and `detail` were each pinned. A whitelist
   * built from a list typed in this file would be a second contract; built from the
   * block it is the contract.
   */
  it("the 429's published member set is exactly the nine the block writes", () => {
    const problem = publishedProblem(429);
    expect(
      problem.members,
      `backend.md §T230's \`problem+json 429 members exactly:\` block has changed. ` +
        `refusal.test.ts asserts key-set EQUALITY against it, so a changed set changes what ` +
        `that file admits — and admitting one member too many is the whole failure D-230-09 ` +
        `published the set to prevent.`,
    ).toEqual([...TRANSCRIBED.problem429]);
    expect(
      problem.pinned.keysAvailable,
      `The block pins \`keysAvailable\` to a literal and that literal is what T220's AC6 ` +
        `reads as "the fact that a key exists".`,
    ).toBe("true");
  });

  /**
   * The form is parsed too, so `refusal.test.ts` cannot drift from the sentence it
   * pins. Four slots: the bucket name, the number, the window and the instant — which
   * is the whole content of AC1's "naming the limit and the reset".
   */
  it("the admissible message form parses to the four slots AC1 names", () => {
    const form = messageForm();
    expect(
      form.slots,
      `The admissible form is now ${JSON.stringify(form.form)}. refusal.test.ts asserts one ` +
        `slot per value the caller can already see, so a changed slot list changes what that ` +
        `file is measuring.`,
    ).toEqual(["bucket", "n", "window", "ISO instant"]);
  });
});

describe("T230 published surface", () => {
  for (const name of TRANSCRIBED.functions) {
    it(`publishes ${name} from the barrel the contract names`, async () => {
      const fn = await requiredFn(name);
      expect(typeof fn).toBe("function");
    });
  }

  /**
   * Declared arity, because three of the four take a `db` first and two take an
   * `actor` second, so a swapped parameter list is silent at the boundary a dynamic
   * import crosses. Declared only: a default or a rest parameter moves this number
   * legitimately, which is why the message says so rather than treating any other
   * number as a defect on its own.
   */
  it("takes the parameter lists the Published signatures block states", async () => {
    for (const name of publishedBlock().functions.map((f) => f.name)) {
      const fn = await requiredFn(name);
      expect(
        fn.length,
        `${BARREL}'s \`${name}\` declares ${fn.length} parameters.\n` +
          `  backend.md §T230: ${publishedBlock().functions.find((f) => f.name === name)?.text}\n` +
          `  A default or rest parameter moves this number legitimately; a swapped parameter ` +
          `list does not.`,
      ).toBe(publishedArity(name));
    }
  });

  /**
   * `LimitVerdict` and `ApiKeyRecord` are interfaces, so they have no runtime witness
   * and are pinned where they are actually produced — `limits.test.ts` and
   * `secret.test.ts`, on a verdict really returned and a key really issued. Stated
   * here so this file is not read as covering them.
   */
  for (const name of Object.keys(TRANSCRIBED.interfaces)) {
    it(`does not export ${name} as a value, because it is an interface`, async () => {
      const mod = await loadLimits();
      expect(
        mod[name],
        `${BARREL} exports a runtime value called \`${name}\`. The contract publishes it as ` +
          `\`${publishedInterface(name).text}\` — an interface. Its key set is pinned on a real ` +
          `value elsewhere in this suite.`,
      ).toBeUndefined();
    });
  }

  /**
   * A READING, and F-230-B is why it is only a reading.
   *
   * `RateLimitedError` appears in the block as the class of the admissible message
   * form and in no signature. Two merged precedents say a named rejection class is a
   * barrel export a caller branches on — T081's `RegistryStoreError` and T050's four,
   * whose barrel says in as many words that "a caller that cannot name a class cannot
   * branch on it". Against that, nothing published returns or throws this one, so it
   * is possible the contract means it as a name for a shape rather than an export.
   *
   * Asserted as the export, flagged as the reading, and if this red turns out to be
   * the test rather than the code, the fix is one line in the block.
   */
  it("publishes RateLimitedError as a rejection class a caller can branch on", async () => {
    const mod = await loadLimits();
    const cls = mod.RateLimitedError;
    expect(
      typeof cls,
      `${BARREL} exports no \`RateLimitedError\`.\n` +
        `  backend.md §T230 names it as the class of the admissible refusal form ` +
        `${JSON.stringify(messageForm().form)}, and names it in no signature — so this ` +
        `assertion is a READING of the block, taken because T081's \`RegistryStoreError\` ` +
        `and T050's four classes are both exported for a caller to branch on.\n` +
        `  F-230-B: nothing published RETURNS or THROWS this class either, so AC1 has no ` +
        `published caller at all. If this red is the test, the block is what needs the edit.`,
    ).toBe("function");
    expect(Object.create((cls as { prototype: object }).prototype)).toBeInstanceOf(Error);
  });
});
