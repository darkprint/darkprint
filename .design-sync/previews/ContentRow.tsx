import { ContentRow } from "darkprint";

/* `ContentRow` mounts on `/blueprints` and on an owner's profile: `<ContentRow item={bp}
   forks={forks.length} />`. The two caller-side props, `forks` and `lineage`, are what vary
   between one row and the next — the item itself stays the same shape every time — so both
   cells below share one fixture and only change those two. */

const item = {
  kind: "blueprint" as const,
  slug: "review-gated-merge",
  ownerHandle: "orin",
  title: "Review-Gated Merge Bot",
  summary:
    "A change lands only after a person approves the plan. Four unattended nodes and one gate: the planner proposes, a reviewer signs off, and only then does anything touch the tree.",
  description: "Full write-up lives on the bundle page.",
  tags: ["merge", "review-gate", "software"],
  category: "Software",
  author: { username: "orin", displayName: "Orin Solace", avatarHue: 190, validator: true },
  autonomy: {
    autonomyClass: "supervised" as const,
    label: "Supervised",
    isDarkFactory: false,
    level: 2 as const,
    blurb: "One node in this graph waits for a person.",
  },
  metrics: [],
  graph: {
    dot: "digraph { intake -> planner -> review -> executor -> verifier }",
    nodes: [
      { id: "intake", kind: "start" as const, label: "Intake", position: { x: 0, y: 60 } },
      { id: "planner", kind: "planner" as const, label: "Change Planner", position: { x: 220, y: 60 } },
      { id: "review", kind: "human-input" as const, label: "Review Gate", position: { x: 440, y: 60 } },
      { id: "executor", kind: "executor" as const, label: "Patch Executor", position: { x: 660, y: 60 } },
      { id: "verifier", kind: "verifier" as const, label: "Merge Verifier", position: { x: 880, y: 60 } },
    ],
    edges: [
      { id: "e1", source: "intake", target: "planner" },
      { id: "e2", source: "planner", target: "review", label: "change plan" },
      { id: "e3", source: "review", target: "executor", label: "approved" },
      { id: "e4", source: "executor", target: "verifier", label: "diff" },
    ],
  },
  requiredAgents: ["Planner", "Reviewer", "Executor"],
  requiredTools: ["filesystem"],
  createdAt: "2026-07-02",
  updatedAt: "2026-08-14",
  downloads: 214,
  votes: 37,
  comments: [],
  analysis: {
    autonomy: {
      contributions: [
        { nodeId: "intake", ref: "event-intake@1.0.0", name: "Intake", requiresHuman: false, resolved: true, explanation: "Runs unattended." },
        { nodeId: "planner", ref: "spec-planner@1.0.0", name: "Change Planner", requiresHuman: false, resolved: true, explanation: "Runs unattended." },
        { nodeId: "review", ref: "human-review-gate@1.0.0", name: "Review Gate", requiresHuman: true, resolved: true, explanation: "A person signs off before anything merges." },
        { nodeId: "executor", ref: "code-builder@1.0.0", name: "Patch Executor", requiresHuman: false, resolved: true, explanation: "Runs unattended." },
        { nodeId: "verifier", ref: "acceptance-tester@1.0.0", name: "Merge Verifier", requiresHuman: false, resolved: true, explanation: "Runs unattended." },
      ],
    },
    security: {},
    phaseCoverage: {
      covered: ["planning", "implementation", "testing", "deployment"],
      missing: ["debugging"],
    },
    diagnostics: [],
  },
  digest: "sha256:9c4f1a",
  cardRefs: ["spec-planner@1.0.0", "code-builder@1.0.0", "acceptance-tester@1.0.0"],
};

/** The plain row: no fork count, no upstream. */
export const Canonical = () => <ContentRow item={item} />;

/** A fork of a public upstream, with the count that comes from having been forked itself. */
export const ForkedWithCount = () => (
  <ContentRow item={item} forks={3} lineage={{ owner: "juno-reyes", slug: "review-gated-merge" }} />
);
