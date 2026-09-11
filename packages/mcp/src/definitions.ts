/* ============================================================
   darkprint mcp: the tool table
   Pure data with no imports, so the remote endpoint, the stdio
   server and the two pages that print this list all read the same
   seven definitions and cannot disagree about a name, a schema or
   a sentence. The descriptions are written for the agent that reads
   a tool list: what to call first, what each answer carries, and
   what the digest buys.
   ============================================================ */

export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/** The three instantiation flavours `get_blueprint` writes notes for. Nothing else reads it. */
export const HARNESSES = ["claude-code", "codex", "generic"] as const;

const OWNER = { type: "string", description: "The owner's handle, the first half of a blueprint ref." };
const SLUG = { type: "string", description: "The blueprint's slug, the second half of a blueprint ref." };
const DIGEST = {
  type: "string",
  description: "`sha256:` followed by 64 hex digits, as a find result or `inspect_provenance` lists it.",
};
const HARNESS = {
  type: "string",
  enum: [...HARNESSES],
  description:
    "Shapes the instantiation notes only. It filters nothing: the files are the same whichever " +
    "you name, and `generic` is the default.",
};
const LIMIT = {
  type: "integer",
  minimum: 1,
  maximum: 20,
  description: "How many hits to return. Default 5, at most 20.",
};

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: "find_blueprints",
    title: "Find blueprints for a task",
    description:
      "Search the public registry for blueprints that fit a task described in your own words. " +
      "Write a sentence or two about the work and its constraints; prose finds more than " +
      "keywords. Results come back ranked by how close each blueprint's document is to the " +
      "task, best first: the cosine similarity between the two plus a small bonus for words " +
      "that match. Each hit carries its `ref`, written `owner/slug`, its `author`, the `digest` of its " +
      "current release, a `score`, the `similarity` when the vector channel was available, the " +
      "`evidence` naming every field a word matched, and a scorecard summary: node count, the " +
      "human-gate node ids, autonomy class, security level and covered phases. The response's " +
      "`encoder` field reads `absent` when the order is lexical coverage alone. Call this " +
      "first, then `get_blueprint` on the ref you choose. A score is a similarity and says " +
      "nothing about quality.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The task, in prose." },
        limit: LIMIT,
        include_forks: {
          type: "boolean",
          description: "Also list published forks of other blueprints. Off by default, as on the site.",
        },
      },
      required: ["task"],
    },
  },
  {
    name: "find_cards",
    title: "Find node cards for a task",
    description:
      "Search the public card library for single nodes that fit a task described in your own " +
      "words, ranked the same way as `find_blueprints`. Each card id appears once: the " +
      "highest-scoring version, and on a tie the highest version number. Each hit carries its " +
      "`ref`, written `id@version`, plus `digest`, `name`, `type`, `action`, `phases`, `tools`, " +
      "`riskMarkers`, the blueprints that pin it in `usedIn`, a `score`, the `similarity` when " +
      "available and the `evidence`. Use `read_card` on a ref to get the whole document.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The task, in prose." },
        limit: LIMIT,
      },
      required: ["task"],
    },
  },
  {
    name: "get_blueprint",
    title: "Get a whole blueprint",
    description:
      "Return one blueprint in a single call: every file of the release (topology.dot, " +
      "cards/*.yaml, README.md, and ontology/extensions.yaml when the blueprint declares local " +
      "terms), its manifest, its scorecard, its provenance, and numbered notes for " +
      "instantiating it under the harness you name. Without `digest` you get the current " +
      "release; with one you get exactly those bytes, and they keep answering after a newer " +
      "release is cut. Call this once `find_blueprints` has found the blueprint you want. With " +
      "an API key sent as a bearer token, your own private blueprints are reachable here too.",
    inputSchema: {
      type: "object",
      properties: { owner: OWNER, slug: SLUG, digest: DIGEST, harness: HARNESS },
      required: ["owner", "slug"],
    },
  },
  {
    name: "read_card",
    title: "Read a card",
    description:
      "Fetch one node card as published, verbatim YAML. `ref` is `id@version`, always pinned " +
      "and never `latest`, and an id may be namespaced, as in `berti/solver-a@1.2.0`.",
    inputSchema: {
      type: "object",
      properties: { ref: { type: "string", description: "`id@version`, e.g. `planner@1.0.0`." } },
      required: ["ref"],
    },
  },
  {
    name: "inspect_provenance",
    title: "Inspect provenance",
    description:
      "Who published a blueprint, what it was forked from, and every release with its version " +
      "and digest. Take a digest from here to pin a release that will not move.",
    inputSchema: {
      type: "object",
      properties: { owner: OWNER, slug: SLUG },
      required: ["owner", "slug"],
    },
  },
  {
    name: "fetch_release",
    title: "Fetch a release",
    description:
      "List the files of one exact release, addressed by digest. A slug names whatever the " +
      "registry holds today; a digest names the bytes you tested against and keeps naming " +
      "them after a newer release is cut. Fetch each file's contents from " +
      "`/api/files/blueprints/<owner>/<slug>/d/<digest>/<path>`, or call `get_blueprint` to " +
      "get every file in one answer.",
    inputSchema: {
      type: "object",
      properties: { owner: OWNER, slug: SLUG, digest: DIGEST },
      required: ["owner", "slug", "digest"],
    },
  },
  {
    name: "export_pipeline",
    title: "Export a pipeline",
    description:
      "Compile one published release into a DOT pipeline for Attractor, the runner DarkPrint " +
      "compiles to, and return it as text. Addressed by digest like `fetch_release`, so the " +
      "pipeline is compiled from the bytes you pinned. Read the header: it lists every " +
      "Attractor attribute a DarkPrint blueprint has no way to set, including goal gates, " +
      "timeouts and every part of the retry policy above `max_retries`, and each of those " +
      "falls back to the runner's own default. A node's prompt is all the runner gets from " +
      "its card, so the card's ports and its declared prohibitions are not enforced by " +
      "anything in this file. A release DarkPrint reports errors on is refused rather than " +
      "compiled.",
    inputSchema: {
      type: "object",
      properties: { owner: OWNER, slug: SLUG, digest: DIGEST },
      required: ["owner", "slug", "digest"],
    },
  },
];

/** The seven names, in the table's order. */
export const TOOL_NAMES: readonly string[] = TOOL_DEFINITIONS.map((tool) => tool.name);

export function toolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((tool) => tool.name === name);
}
