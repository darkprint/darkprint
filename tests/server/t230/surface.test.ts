/* ============================================================
   T230 — the published surface

   The barrel publishes the functions the contract names, at the
   declared arity, and no interface as a runtime value.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  BARREL,
  loadLimits,
  messageForm,
  publishedArity,
  publishedBlock,
  publishedInterface,
  requiredFn,
} from "./contract";

describe("T230 published surface", () => {
  for (const { name } of publishedBlock().functions) {
    it(`publishes ${name} from the barrel the contract names`, async () => {
      const fn = await requiredFn(name);
      expect(typeof fn).toBe("function");
    });
  }

  /**
   * Declared arity, because three of the five take a `db` first and two take an `actor`
   * second, so a swapped parameter list is silent at the boundary a dynamic import crosses.
   * A default or a rest parameter moves this number legitimately, which is why the message
   * says so rather than treating any other number as a defect on its own.
   */
  it("takes the parameter lists the published signatures state", async () => {
    for (const { name, text } of publishedBlock().functions) {
      const fn = await requiredFn(name);
      expect(
        fn.length,
        `${BARREL}'s \`${name}\` declares ${fn.length} parameters.\n` +
          `  published: ${text}\n` +
          `  A default or rest parameter moves this number legitimately; a swapped parameter ` +
          `list does not.`,
      ).toBe(publishedArity(name));
    }
  });

  /**
   * `LimitVerdict` and `ApiKeyRecord` are interfaces, so they have no runtime witness and
   * are pinned where they are produced: `limits.test.ts` and `secret.test.ts`, on a verdict
   * really returned and a key really issued.
   */
  for (const { name } of publishedBlock().interfaces) {
    it(`does not export ${name} as a value, because it is an interface`, async () => {
      const mod = await loadLimits();
      expect(
        mod[name],
        `${BARREL} exports a runtime value called \`${name}\`. The contract publishes it as ` +
          `\`${publishedInterface(name).text}\`, an interface. Its key set is pinned on a real ` +
          `value elsewhere in this suite.`,
      ).toBeUndefined();
    });
  }

  it("publishes RateLimitedError as a rejection class a caller can branch on", async () => {
    const mod = await loadLimits();
    const cls = mod.RateLimitedError;
    expect(
      typeof cls,
      `${BARREL} exports no \`RateLimitedError\`, the class of the admissible refusal form ` +
        `${JSON.stringify(messageForm().form)}. A caller that cannot name a class cannot ` +
        `branch on it.`,
    ).toBe("function");
    expect(Object.create((cls as { prototype: object }).prototype)).toBeInstanceOf(Error);
  });
});
