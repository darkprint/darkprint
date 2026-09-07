/* ============================================================
   T025 — the published surface exists

   Not an acceptance criterion of its own: the criteria below need
   these three names, and a red here says *which* name is missing
   instead of leaving the reader to infer it from five failures that
   all say "undefined is not a function".
   ============================================================ */

import { describe, expect, it } from "vitest";

import * as core from "@/lib/core";

import { PUBLISHED, VERSIONING, loadVersioning, requiredFn } from "./contract";

describe("T025 published signatures", () => {
  it("publishes the barrel the task owns", async () => {
    const mod = await loadVersioning();
    expect(typeof mod).toBe("object");
  });

  for (const name of Object.keys(PUBLISHED) as (keyof typeof PUBLISHED)[]) {
    it(`publishes \`${name}\` from ${VERSIONING}`, async () => {
      const fn = requiredFn(await loadVersioning(), name);
      expect(typeof fn).toBe("function");
    });
  }

  /**
   * `lib/core` is the other half of this task's contract — `inferBump`,
   * `checkVersionChain`, `parseSemver` and `compareSemver` "already exist in `lib/core`
   * for cards and are **consumed, never reimplemented**". Re-exporting one is consuming
   * it and is fine; publishing a *second* function under the same name forks the
   * authority this task exists to centralise (B-04), and two authorities that can
   * disagree is the failure it is meant to remove. So the test is identity, not absence.
   */
  it.each(["inferBump", "checkVersionChain", "parseSemver", "compareSemver"] as const)(
    "does not reimplement `%s`, which the contract says it consumes from lib/core",
    async (name) => {
      const mod = await loadVersioning();
      if (mod[name] === undefined) return; // not re-exported at all, which is the ordinary case
      expect(
        mod[name],
        `${VERSIONING} exports its own \`${name}\`. T025's contract says it "already ` +
          `exists in \`lib/core\` for cards and is **consumed, never reimplemented**". ` +
          `Re-exporting \`@/lib/core\`'s is fine; a second implementation under the same ` +
          `name is a second versioning authority.`,
      ).toBe(core[name]);
    },
  );
});
