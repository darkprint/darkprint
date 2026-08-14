/* ============================================================
   T030 — the published surface exists

   Not an acceptance criterion of its own: the six criteria below
   need these names, and a red here says *which* name is missing
   instead of leaving the reader to infer it from thirty failures
   that all say "undefined is not a function".
   ============================================================ */

import { describe, expect, it } from "vitest";

import * as core from "@/lib/core";

import { ONTOLOGY, PUBLISHED, bind, loadOntology } from "./contract";

describe("T030 published signatures", () => {
  it("publishes the barrel the task owns", async () => {
    expect(typeof (await loadOntology())).toBe("object");
  });

  for (const name of Object.keys(PUBLISHED) as (keyof typeof PUBLISHED)[]) {
    it(`publishes \`${name}\` from ${ONTOLOGY}`, async () => {
      expect(typeof (await bind(name))).toBe("function");
    });
  }

  /**
   * `ontologyView` "is the merge and is **consumed, never reimplemented**". Re-exporting it is
   * consuming it and is fine; publishing a *second* function under the same name forks the
   * merge semantics AC1 and AC2 are written against. So the test is identity, not absence.
   */
  it.each(["ontologyView", "partitionTerms", "splitTermId"] as const)(
    "does not reimplement `%s`, which the contract says it consumes from lib/core",
    async (name) => {
      const mod = await loadOntology();
      if (mod[name] === undefined) return; // not re-exported at all, the ordinary case
      expect(
        mod[name],
        `${ONTOLOGY} exports its own \`${name}\`. Re-exporting \`@/lib/core\`'s is fine; a ` +
          `second implementation under the same name is a second set of merge semantics.`,
      ).toBe(core[name]);
    },
  );

  /**
   * "T030 never reads the `release` table and `lib/server/archive/**` is not its dependency."
   * A barrel that grew an archive-shaped export is the first sign the overlay stopped travelling
   * on the release and became a global row.
   */
  it("publishes nothing that reads a release", async () => {
    const mod = await loadOntology();
    const archiveShaped = Object.keys(mod).filter((name) => /release|bundle|archive/i.test(name));
    expect(
      archiveShaped,
      `backend.md §T030: "T030 never reads the \`release\` table and \`lib/server/archive/**\` ` +
        `is not its dependency." A local overlay travels on the release and reaches the merge ` +
        `through \`openView\`'s \`extensions\` parameter, supplied by the caller per bundle.`,
    ).toEqual([]);
  });
});
