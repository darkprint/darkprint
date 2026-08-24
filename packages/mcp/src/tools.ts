/* ============================================================
   darkprint mcp — the four tools
   `/mcp` names four operations in words and DELIBERATELY publishes
   no signatures: "There are no `search_blueprints(...)` signatures
   on this page because no signature has been designed, and a
   plausible one would be the same lie `McpJourney` was telling in
   a different font." So the four names below are the closest thing
   an MCP tool name can be to the page's own words — MCP names are
   identifiers and cannot hold spaces — and nothing is renamed:
   `search`, `read a card`, `inspect provenance`, `fetch a release`
   become `search`, `read_card`, `inspect_provenance`,
   `fetch_release`.

   Every tool is one HTTP call to one route this task owns, so the
   answer has ONE author whether it is reached in-process or over
   the wire (D-220-10). Nothing here merges, ranks, projects or
   filters: `mcpSearch` did that, and a second copy of AC5's law in
   a distributable is a second thing that can stop agreeing with
   `hits.every(...)`.
   ============================================================ */

import { request, type RegistryOptions } from "./registry";

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (options: RegistryOptions, args: Record<string, unknown>) => Promise<string>;
}

/** A required string argument. Absent, empty and non-string all refuse the same way. */
function str(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`\`${key}\` is required and must be a non-empty string.`);
  }
  return value;
}

const segment = encodeURIComponent;

export const TOOLS: readonly Tool[] = [
  {
    name: "search",
    title: "Search the registry",
    /* The description is what an agent reads to decide whether to call this, so it says the
       two things that change how the result should be used: prose beats keywords, and the
       response's own `ordered` flag says whether the order means anything (AC5). */
    description:
      "Find blueprints and cards for a task described in your own words. Prose works better " +
      "than keywords. Each hit carries its kind, its ref, its digest and the evidence for why " +
      "it matched — `<field>:<token>`, naming the field and the word in the document. The " +
      "response's `ordered` flag is false when the results carry no ranking claim; do not " +
      "read an order into them when it is.",
    inputSchema: {
      type: "object",
      properties: { task: { type: "string", description: "What you are trying to build." } },
      required: ["task"],
    },
    run: (options, args) => request(options, `/api/mcp/search?task=${segment(str(args, "task"))}`),
  },
  {
    name: "read_card",
    title: "Read a card",
    description:
      "Fetch one node card as published, verbatim YAML. `ref` is `id@version` — always " +
      "pinned, never `latest` — and an id may be namespaced, as in `berti/solver-a@1.2.0`.",
    inputSchema: {
      type: "object",
      properties: { ref: { type: "string", description: "`id@version`, e.g. `planner@1.0.0`." } },
      required: ["ref"],
    },
    run: (options, args) => {
      /* Each path segment is encoded separately: a namespaced id spans two segments, so
         encoding the whole ref would turn its `/` into `%2F` and address nothing. */
      const ref = str(args, "ref").split("/").map(segment).join("/");
      return request(options, `/api/mcp/cards/${ref}`);
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
      properties: {
        owner: { type: "string", description: "The owner's handle." },
        slug: { type: "string", description: "The blueprint's slug." },
      },
      required: ["owner", "slug"],
    },
    run: (options, args) =>
      request(
        options,
        `/api/mcp/blueprints/${segment(str(args, "owner"))}/${segment(str(args, "slug"))}/provenance`,
      ),
  },
  {
    name: "fetch_release",
    title: "Fetch a release",
    /* The slug/digest distinction is the one thing `/mcp` calls load-bearing, so it is in the
       description rather than left for an agent to discover by being surprised. */
    description:
      "List the files of one exact release. Addressed by DIGEST, not by version: by slug you " +
      "get whatever the registry holds today, by digest the bytes you tested against, and a " +
      "digest keeps naming them after a newer release is cut. Fetch a file's contents from " +
      "`/api/files/blueprints/<owner>/<slug>/d/<digest>/<path>`.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "The owner's handle." },
        slug: { type: "string", description: "The blueprint's slug." },
        digest: { type: "string", description: "`sha256:` and 64 hex digits, from provenance." },
      },
      required: ["owner", "slug", "digest"],
    },
    run: (options, args) =>
      request(
        options,
        `/api/mcp/releases/${segment(str(args, "owner"))}/${segment(str(args, "slug"))}` +
          `/d/${segment(str(args, "digest"))}`,
      ),
  },
];
