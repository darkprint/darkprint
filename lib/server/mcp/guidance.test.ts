/* ============================================================
   What `get_blueprint` tells an agent, and the half of it that
   must not depend on a parameter nobody is required to send.

   ── the defect this file exists for ──
   `instantiationSteps` emitted two sentences only when the caller
   named a harness other than `generic`: run each node in its own
   context, and stop at every human gate. `generic` IS the default,
   so the ordinary call — owner and slug, nothing else — received
   neither. The least safe answer was the one a caller got by not
   knowing a parameter existed, and the sentence it dropped is the
   one that mentions irreversible work.

   Nothing tested this module, which is how a conditional around a
   safety instruction survived. The cells below hold the contract
   against EVERY harness including the default, and hold it EQUAL
   across them, because what varies by harness is vocabulary and
   what does not is the format's own meaning.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { instantiationSteps, runContract, type GuidanceInput } from "./guidance";
import { MCP_HARNESSES, type McpHarness } from "./types";

const FILES = [
  { path: "README.md", text: "# A blueprint\n\n## Run it\n\nyours\n" },
  { path: "topology.dot", text: 'digraph g { a [card="x@1.0.0"]; }\n' },
  { path: "cards/x@1.0.0.yaml", text: "id: x\n" },
];

function input(over: Partial<GuidanceInput> = {}): GuidanceInput {
  return {
    harness: "generic",
    owner: "autogen",
    slug: "demo",
    digest: `sha256:${"c".repeat(64)}`,
    files: FILES,
    ...over,
  };
}

const joined = (steps: readonly string[]) => steps.join("\n").toLowerCase();

describe("the run contract reaches every caller", () => {
  it.each([...MCP_HARNESSES])("%s gets it, named or not", (harness: McpHarness) => {
    const run = runContract(input({ harness }));
    expect(run.length).toBeGreaterThan(3);
    const text = joined(run);
    expect(text, "a reader is not told to get agreement before running").toContain("agreement");
    expect(text, "a node is not told to run in its own context").toContain("own context");
    expect(text, "the declared prohibitions are not named as refusals").toContain("will_not");
    expect(text, "the retry bound is not named, so a loop has no stated end").toContain("max_retries");
  });

  /**
   * The cell that would have caught the original defect, and it has to compare the DEFAULT
   * against a named harness rather than assert on one: the bug was a difference between
   * them, and any cell reading a single harness passed while it shipped.
   */
  it("says the same thing whichever harness is named, including none", () => {
    const byHarness = MCP_HARNESSES.map((harness) => runContract(input({ harness })));
    for (const run of byHarness) {
      expect(
        run,
        "the run contract varies by harness, so a caller who named none gets a different " +
          "answer about how to execute somebody else's graph",
      ).toEqual(byHarness[0]);
    }
  });

  it("carries the human gates the scorecard found, not a guess", () => {
    const named = joined(runContract(input({ humanGates: ["review", "sign-off"] })));
    expect(named).toContain("review");
    expect(named).toContain("sign-off");

    /* An empty list is a MEASUREMENT — the scorecard looked and found none — and reads
       differently from an absent one, where nothing looked. Both must still stop an agent
       at irreversible work, which is the only thing left holding it. */
    const none = joined(runContract(input({ humanGates: [] })));
    expect(none).toContain("irreversible");
    const unknown = joined(runContract(input()));
    expect(unknown).toContain("stop");
  });
});

describe("the instantiation notes stay about files", () => {
  it("names every file of the answer and the digest to ask by", () => {
    const steps = joined(instantiationSteps(input()));
    expect(steps).toContain("topology.dot");
    expect(steps).toContain("cards/x@1.0.0.yaml");
    expect(steps).toContain("readme.md");
    expect(steps).toContain("c".repeat(64));
  });

  /* The division of labour, held so a later edit cannot quietly move the safety half back
     under a conditional: how to RUN is `run`'s, and the notes point at it. */
  it("hands the execution question to the run contract rather than answering it", () => {
    for (const harness of MCP_HARNESSES) {
      expect(joined(instantiationSteps(input({ harness })))).toContain("`run`");
    }
  });
});
