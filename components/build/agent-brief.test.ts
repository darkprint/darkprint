import { describe, expect, it } from "vitest";

import { CORE_PHASE_IDS } from "@/lib/core";

import { agentBrief } from "./AgentHandoff";

/**
 * The brief `/build` hands to a reader's own agent.
 *
 * Held to the vocabulary rather than to a snapshot: the wording is copy and may be
 * rewritten, but a brief that names a phase the validator does not know, or that leaves
 * out the step the whole pattern turns on, sends somebody's agent to write a bundle that
 * will not resolve.
 *
 * It is the mirror of `bundleAgents` in `lib/content/bundle-export.ts` — that one says
 * "here is a pattern, adapt it", this one says "here is how to describe a pattern you
 * want". Both put the prohibitions first, and the case below is what keeps them agreeing.
 */
describe("agentBrief", () => {
  const brief = agentBrief();

  it("names every phase the vocabulary defines, and invents none", () => {
    for (const phase of CORE_PHASE_IDS) {
      expect(brief, phase).toContain(phase);
    }
    // The five are a closed list (doc 3 §7). A sixth here would be a term the validator
    // rejects, printed as though it were one it accepts.
    const named = brief.slice(brief.indexOf("use these phases:"));
    const line = named.split("\n")[1] ?? "";
    expect(line.split(",").map((s) => s.trim())).toEqual([...CORE_PHASE_IDS]);
  });

  it("says the five are not all required", () => {
    // Doc 2 §1.1's rule reaches this page too: a blueprint covering three phases is a
    // pattern about three phases, not an unfinished one. A brief that read as a checklist
    // would have agents padding graphs with nodes nobody wants.
    expect(brief).toContain("Not every blueprint needs all five");
  });

  it("asks for the prohibitions first, and for the absent edges by name", () => {
    const cannotAt = brief.indexOf("cannot");
    const graphAt = brief.indexOf("Write the graph in DOT");
    expect(cannotAt).toBeGreaterThan(-1);
    expect(graphAt).toBeGreaterThan(-1);
    // Decided before the wiring, because the wiring is what a prohibition constrains.
    expect(cannotAt).toBeLessThan(graphAt);
    expect(brief).toContain("decide this first");
    expect(brief).toContain("An edge you do not draw");
    expect(brief).toContain("tell me which edges you deliberately did not draw");
  });

  it("names the card fields the schema actually has", () => {
    // Every one of these is a `NodeCard` key. A brief naming a field the parser ignores
    // produces a card that silently loses whatever the agent put in it.
    for (const field of [
      "id",
      "name",
      "type",
      "phase",
      "action",
      "spec",
      "model",
      "tools",
      "mcp",
      "inputs",
      "outputs",
      "cannot",
      "requires_human",
    ]) {
      expect(brief, field).toContain(field);
    }
  });

  it("tells the agent to ask rather than guess", () => {
    expect(brief).toContain("ask me before guessing");
    expect(brief).toContain("say where it comes from instead of wiring one in");
  });
});
