import type { Ontology } from "@/lib/types";
import { AUTHORS } from "./users";

export const ONTOLOGIES: Ontology[] = [
  {
    kind: "ontology",
    slug: "agent-pipeline-core",
    title: "Agent Pipeline Core",
    summary:
      "The base vocabulary for describing any dark factory as a typed graph: the node kinds, the edge kinds, and what a valid pipeline is.",
    description:
      "Before you can score a factory you have to agree on what its parts are called. Agent Pipeline Core is the reference ontology the DarkPrint analyzers read: it defines the canonical node kinds (planner, executor, verifier, gate, …) and the edge kinds (control, data-flow, fallback), plus the well-formedness rules that let a blueprint be graded automatically. Every blueprint in the gallery types against this.",
    domain: "Orchestration",
    tags: ["core", "typing", "grading"],
    author: AUTHORS.lupo,
    nodeTypes: [
      { name: "Planner", description: "Decomposes a goal into an ordered set of sub-tasks." },
      { name: "Executor", description: "Performs a unit of work, usually via a model or tool." },
      { name: "Verifier", description: "Checks output against acceptance criteria." },
      { name: "Router", description: "Dispatches to one of several typed lanes." },
      { name: "Negotiator", description: "Reconciles competing proposals into one result." },
      { name: "Gate", description: "A human-approval checkpoint — caps autonomy." },
      { name: "Memory", description: "Persists and recalls state across stages." },
      { name: "Ship", description: "Delivers the final artifact out of the factory." },
    ],
    edgeTypes: [
      { name: "data-flow", from: "any", to: "any", description: "Passes a produced artifact downstream." },
      { name: "control", from: "any", to: "any", description: "Directs execution without carrying a payload." },
      { name: "fallback", from: "verifier", to: "any", description: "Failure path taken when a check does not pass." },
    ],
    downloads: 5200,
    votes: 340,
    createdAt: "2026-01-30",
  },
  {
    kind: "ontology",
    slug: "trust-and-provenance",
    title: "Trust & Provenance",
    summary:
      "Types for tracking where a claim came from, who verified it, and how much weight a validator's signature carries.",
    description:
      "An overlay ontology for factories that produce claims, not just artifacts. It types evidence, citations, verifier signatures and validator weight, so a downstream consumer can ask 'why should I believe this?' and get a structured answer. Pairs naturally with research and analysis blueprints.",
    domain: "Verification",
    tags: ["provenance", "trust", "evidence"],
    author: AUTHORS.sol,
    nodeTypes: [
      { name: "Claim", description: "An assertion produced by the factory." },
      { name: "Evidence", description: "A retrieved source backing or refuting a claim." },
      { name: "Signature", description: "A verifier's or validator's attestation on a claim." },
      { name: "Weight", description: "The trust weight attached to a signer." },
    ],
    edgeTypes: [
      { name: "supports", from: "Evidence", to: "Claim", description: "Evidence grounds a claim." },
      { name: "refutes", from: "Evidence", to: "Claim", description: "Evidence contradicts a claim." },
      { name: "attests", from: "Signature", to: "Claim", description: "A signer vouches for a claim." },
    ],
    downloads: 2450,
    votes: 178,
    createdAt: "2026-03-16",
  },
  {
    kind: "ontology",
    slug: "cost-and-risk",
    title: "Cost & Risk",
    summary:
      "A shared schema for the permissions, budgets and blast-radius a blueprint declares — the input to the automated security score.",
    description:
      "The ontology behind the Security and Cost metrics. It types the scopes a blueprint requests (read, write, execute), the budget envelope it runs within, and the blast radius of each privileged action. The static analyzer reads these declarations straight off the graph to grade autonomy and security without running anything.",
    domain: "Governance",
    tags: ["security", "cost", "permissions"],
    author: AUTHORS.mara,
    nodeTypes: [
      { name: "Scope", description: "A permission the blueprint requests (read/write/execute)." },
      { name: "Budget", description: "A token or wall-clock ceiling for a run." },
      { name: "BlastRadius", description: "The reach of a privileged action if it goes wrong." },
    ],
    edgeTypes: [
      { name: "requires", from: "any", to: "Scope", description: "A node needs a given permission." },
      { name: "bounded-by", from: "any", to: "Budget", description: "A subgraph runs within a budget." },
    ],
    downloads: 1780,
    votes: 132,
    createdAt: "2026-04-22",
  },
];

export function getOntology(slug: string): Ontology | undefined {
  return ONTOLOGIES.find((o) => o.slug === slug);
}
