import { Explainability } from "darkprint";

/* Both stories sweep `isDarkFactory`, doc 2 §1.1's central classification: a graph with one
   human gate reads as first-class and staffed, never as an attempt that fell short of the
   graph beside it with nobody in it. `security.diagnostics: []` on both — the criteria-leak
   check reads `quiet` either way, which is the simplest of the five states `lib/criteria-state`
   defines and keeps this preview from having to fabricate a `DiagnosticCode` literal. */

const PHASE_ORDER = ["planning", "implementation", "testing", "debugging", "deployment"];

/** A supervised pipeline: one human gate, one inferred security finding. */
export const SupervisedWithFindings = () => (
  <Explainability
    nodeNames={{
      start: "Intake",
      planner: "Planner",
      executor: "Coder",
      verifier: "Tester",
      gate: "Human approve",
      ship: "Ship",
    }}
    highlighted="gate"
    onHighlight={() => {}}
    autonomy={{
      autonomyClass: "supervised",
      isDarkFactory: false,
      level: 3,
      label: "Supervised",
      fraction: 0.8333,
      autonomousNodes: 5,
      totalNodes: 6,
      rationale: "5 of 6 nodes run unattended (0.83 ≥ 0.70) → level 3",
      contributions: [
        { nodeId: "start", ref: "intake@1.0.0", name: "Intake", requiresHuman: false, resolved: true, explanation: "Reads the incoming brief and starts the run. No person is asked." },
        { nodeId: "planner", ref: "planner@1.0.0", name: "Planner", requiresHuman: false, resolved: true, explanation: "Turns the brief into a task list. Runs unattended." },
        { nodeId: "executor", ref: "coder@1.0.0", name: "Coder", requiresHuman: false, resolved: true, explanation: "Writes the patch and hands it to the tester." },
        { nodeId: "verifier", ref: "tester@1.0.0", name: "Tester", requiresHuman: false, resolved: true, explanation: "Runs the suite and reports back to the coder or forward to the gate." },
        { nodeId: "gate", ref: "human-approve@1.0.0", name: "Human approve", requiresHuman: true, reason: "human-in-the-loop-type", term: "human-in-the-loop", resolved: true, explanation: "A person reviews the diff and approves the merge before it ships." },
        { nodeId: "ship", ref: "ship@1.0.0", name: "Ship", requiresHuman: false, resolved: true, explanation: "Publishes the release once the gate has approved it." },
      ],
    }}
    security={{
      level: 3,
      raw: 3.25,
      rationale: "4 − 0.75 (unbounded-loop) → 3",
      penalties: [
        {
          marker: "unbounded-loop",
          weight: 0.75,
          nodeIds: ["executor"],
          explanation: "unbounded-loop found on 1 node (executor). Charged once for the blueprint.",
        },
      ],
      findings: [
        {
          marker: "unbounded-loop",
          nodeId: "executor",
          establishedBy: "inferred",
          explanation: "The coder loops back from the tester with no cap on iterations.",
          hint: "Add a max-retries parameter and route to the gate after N failures.",
        },
      ],
      diagnostics: [],
    }}
    phaseCoverage={{
      covered: ["planning", "implementation", "testing", "debugging"],
      missing: ["deployment"],
      byPhase: {
        planning: ["start", "planner"],
        implementation: ["executor"],
        testing: ["verifier"],
        debugging: ["executor"],
        deployment: [],
      },
      unphased: ["gate", "ship"],
    }}
  />
);

/** A dark factory: every node runs unattended, and static risk exposure keeps all 4 points. */
export const DarkFactoryClean = () => (
  <Explainability
    nodeNames={{
      start: "Intake",
      planner: "Planner",
      executor: "Coder",
      verifier: "Tester",
      gate: "Release",
      ship: "Ship",
    }}
    onHighlight={() => {}}
    autonomy={{
      autonomyClass: "closed-loop",
      isDarkFactory: true,
      level: 4,
      label: "Closed loop",
      fraction: 1,
      autonomousNodes: 6,
      totalNodes: 6,
      rationale: "6 of 6 nodes run unattended (1.00 ≥ 0.95) → level 4",
      contributions: [
        { nodeId: "start", ref: "intake@1.0.0", name: "Intake", requiresHuman: false, resolved: true, explanation: "Reads the incoming brief and starts the run." },
        { nodeId: "planner", ref: "planner@1.0.0", name: "Planner", requiresHuman: false, resolved: true, explanation: "Turns the brief into a task list." },
        { nodeId: "executor", ref: "coder@1.0.0", name: "Coder", requiresHuman: false, resolved: true, explanation: "Writes the patch and hands it to the tester." },
        { nodeId: "verifier", ref: "tester@1.0.0", name: "Tester", requiresHuman: false, resolved: true, explanation: "Runs the suite and reports back to the coder or forward to release." },
        { nodeId: "gate", ref: "release@1.0.0", name: "Release", requiresHuman: false, resolved: true, explanation: "Tags and merges once the suite passes. No person is asked." },
        { nodeId: "ship", ref: "ship@1.0.0", name: "Ship", requiresHuman: false, resolved: true, explanation: "Publishes the release." },
      ],
    }}
    security={{
      level: 4,
      raw: 4,
      rationale: "4 − 0 → 4",
      penalties: [],
      findings: [],
      diagnostics: [],
    }}
    phaseCoverage={{
      covered: PHASE_ORDER,
      missing: [],
      byPhase: {
        planning: ["start", "planner"],
        implementation: ["executor"],
        testing: ["verifier"],
        debugging: ["executor"],
        deployment: ["gate", "ship"],
      },
      unphased: [],
    }}
  />
);
