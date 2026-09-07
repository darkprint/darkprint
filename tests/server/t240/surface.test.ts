/* ============================================================
   T240 — the barrel, and the one instrument that can tell
   *the module is absent* from *a member is absent* from
   *an assertion failed*

   Nothing here asserts behaviour. A type pin over an absent
   member is silently true, and an import rejection and a missing
   export both surface as "the test failed", so `barrelExports()`
   answers the question once, here, and the rest of the suite's
   reds can be read against that answer.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { BARREL, barrelExports } from "./contract";

/** Every value the barrel must export: two functions, the closed action set and two error classes. */
const PUBLISHED_VALUES = [
  "writeAudit",
  "listAudit",
  "AUDIT_ACTIONS",
  "AuditStoreError",
  "NotPermittedError",
] as const;

describe("T240 — which of the three states this suite is being read in", () => {
  /**
   * The cell every other red in this directory should be read against.
   *
   * It never fails on the module's absence. A state is a measurement, not a criterion, and
   * a cell that reddened on "the module is absent" would be asserting the implementer had
   * already finished — the blind position stated backwards. What it does is put the answer
   * in the run's own output, so a reader of `writeAudit is not a function` does not have to
   * go and find out whether there was anything there to be a function.
   */
  it("reports the barrel state and the exact export list", async () => {
    const barrel = await barrelExports();
    console.log(
      `T240 barrel state: ${barrel.state}\n` +
        `  ${BARREL} exports: ${barrel.keys.join(", ") || "(nothing)"}\n` +
        (barrel.cause === undefined ? "" : `  import rejected with: ${String(barrel.cause)}\n`),
    );

    /* The discrimination this instrument CLAIMS, asserted rather than assumed: in the
       present state it must have produced a key list, and in the absent state it must have
       produced the rejection. An instrument that answers "present" with no keys and
       "absent" with no cause is answering a coin flip, and every red downstream would be
       read against that coin flip. */
    if (barrel.state === "present") {
      expect(
        Array.isArray(barrel.keys) && barrel.keys.length > 0,
        `barrelExports() reported \`present\` with an empty export list. A barrel that ` +
          `resolves and exports nothing is indistinguishable here from one that does not ` +
          `exist, which is the exact distinction this instrument is for.`,
      ).toBe(true);
    } else {
      expect(
        barrel.cause,
        `barrelExports() reported \`module-absent\` without carrying the import rejection, ` +
          `so nothing downstream can tell an absent module from a module that threw on load.`,
      ).toBeDefined();
      expect(
        barrel.keys,
        `barrelExports() reported \`module-absent\` and still listed exports.`,
      ).toEqual([]);
    }
  });

  /**
   * The named members, reported as one list rather than asserted one at a time.
   *
   * One cell rather than four, and deliberately: four cells reporting "absent" for the same
   * absent module is four reds for one fact, and this run has already paid for reading a
   * count of reds as a count of defects.
   */
  it("names every published member that is missing, in one red", async () => {
    const barrel = await barrelExports();
    if (barrel.state === "module-absent") {
      throw new Error(
        `${BARREL} is not on disk yet — the blind position, not a defect.\n` +
          `  import rejected with: ${String(barrel.cause)}\n` +
          `  This cell becomes a criterion the moment the module lands.`,
      );
    }

    const missing = PUBLISHED_VALUES.filter((name) => !barrel.keys.includes(name));

    expect(
      missing,
      `${BARREL} resolved but does not export: ${missing.join(", ")}.\n` +
        `  The surface names \`writeAudit\` and \`listAudit\`, \`AUDIT_ACTIONS\` as a closed ` +
        `set, and the two error classes.\n` +
        `  found: ${barrel.keys.join(", ") || "(nothing)"}`,
    ).toEqual([]);
  });
});
