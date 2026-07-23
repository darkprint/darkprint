import type { Part } from "@/lib/types";
import { AUTHORS } from "./users";
import {
  pRetry,
  pValidation,
  pNegotiation,
  pRouting,
  pMemory,
  pEscalation,
} from "./graphs";

export const PARTS: Part[] = [
  {
    kind: "part",
    slug: "bounded-retry",
    title: "Bounded Retry",
    summary:
      "Wrap any action in an exponential-backoff retry that gives up after N attempts and surfaces the last error cleanly.",
    description:
      "The single most reused node in a dark factory. Drop it around any flaky action — a tool call, a model request, a network hop — and it retries with backoff up to a hard cap, then fails loudly with the last error instead of hanging. The cap is the whole point: unbounded retries are how factories quietly burn a budget at 3am.",
    partKind: "retry",
    tags: ["retry", "backoff", "resilience"],
    author: AUTHORS.kwame,
    graph: pRetry,
    interface: { inputs: ["action", "max_attempts", "backoff_ms"], outputs: ["result", "last_error"] },
    usedIn: 41,
    downloads: 8900,
    votes: 512,
    createdAt: "2026-01-14",
  },
  {
    kind: "part",
    slug: "schema-gate",
    title: "Schema Gate",
    summary:
      "Validate a candidate against a schema plus custom assertions; accept on pass, route to a fix loop on fail.",
    description:
      "A hard boundary you can trust. It checks a candidate object against a schema and any extra assertions you attach, accepting only what passes and diverting failures to a repair path. Put one wherever agent output crosses into a system that expects a guarantee.",
    partKind: "validation",
    tags: ["validation", "schema", "guardrail"],
    author: AUTHORS.lupo,
    graph: pValidation,
    interface: { inputs: ["candidate", "schema", "assertions"], outputs: ["accepted", "violations"] },
    usedIn: 33,
    downloads: 6100,
    votes: 388,
    createdAt: "2026-02-02",
  },
  {
    kind: "part",
    slug: "weighted-vote",
    title: "Weighted Vote",
    summary:
      "Collect competing proposals and pick one by weighted score — validator weight, confidence, or a custom rubric.",
    description:
      "The negotiation primitive from the Adversarial Consensus Line, packaged on its own. Feed it two or more proposals and a weighting rule and it returns a single chosen result plus the tally, so the decision is auditable rather than a black box.",
    partKind: "negotiation",
    tags: ["negotiation", "voting", "consensus"],
    author: AUTHORS.mara,
    graph: pNegotiation,
    interface: { inputs: ["proposals", "weights", "rubric"], outputs: ["chosen", "tally"] },
    usedIn: 27,
    downloads: 4300,
    votes: 291,
    createdAt: "2026-03-11",
  },
  {
    kind: "part",
    slug: "intent-router",
    title: "Intent Router",
    summary:
      "Classify an input and dispatch it down one of several typed lanes, with a default lane for the unrecognized.",
    description:
      "A clean fan-out. It reads an input, classifies intent, and routes to the matching lane — keeping each downstream branch simple and single-purpose. The default lane means nothing falls on the floor.",
    partKind: "routing",
    tags: ["routing", "classification", "dispatch"],
    author: AUTHORS.hachi,
    graph: pRouting,
    interface: { inputs: ["input", "labels"], outputs: ["lane", "confidence"] },
    usedIn: 22,
    downloads: 3550,
    votes: 204,
    createdAt: "2026-03-27",
  },
  {
    kind: "part",
    slug: "episodic-memory",
    title: "Episodic Memory",
    summary:
      "Write events to a store and recall the k most relevant on demand — shared working memory for a multi-agent line.",
    description:
      "State that outlives a single step. Agents write what they did; later stages recall the k-nearest relevant episodes to stay coherent across a long run. Without something like this, every stage re-derives context it should have remembered.",
    partKind: "memory",
    tags: ["memory", "state", "retrieval"],
    author: AUTHORS.orin,
    graph: pMemory,
    interface: { inputs: ["event", "query", "k"], outputs: ["context"] },
    usedIn: 18,
    downloads: 2980,
    votes: 176,
    createdAt: "2026-04-08",
  },
  {
    kind: "part",
    slug: "confidence-escalation",
    title: "Confidence Escalation",
    summary:
      "Auto-accept high-confidence results and route low-confidence ones to a human — the safety valve every autonomous line needs.",
    description:
      "The honest off-ramp. It reads a confidence signal and lets high-confidence work through untouched while parking the doubtful cases for a human, with the full context attached. Adding one is often the difference between an autonomy-3 line you can actually run and an autonomy-4 line you're afraid to.",
    partKind: "escalation",
    tags: ["escalation", "human-in-loop", "safety"],
    author: AUTHORS.sol,
    graph: pEscalation,
    interface: { inputs: ["result", "confidence", "threshold"], outputs: ["accepted", "escalated"] },
    usedIn: 25,
    downloads: 3820,
    votes: 233,
    createdAt: "2026-02-20",
  },
];

export function getPart(slug: string): Part | undefined {
  return PARTS.find((p) => p.slug === slug);
}
