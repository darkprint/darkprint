/* ============================================================
   darkprint mcp — the four registry reads, and the compiler
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

   Each of those four is one HTTP call to one route this task owns,
   so the answer has ONE author whether it is reached in-process or
   over the wire (D-220-10). Nothing here merges, ranks, projects or
   filters: `mcpSearch` did that, and a second copy of AC5's law in
   a distributable is a second thing that can stop agreeing with
   `hits.every(...)`.

   ── the fifth, and why it is a different shape ──
   `export_pipeline` compiles a release into Attractor DOT. It is
   not one of the four operations `/mcp` advertises and does not
   claim to be: it is not a registry read, it reaches no route the
   four do not, and it grants no capability the contract's "read
   access and nothing else" withholds. What it does is take the
   bytes `fetch_release` and the files route already serve and run
   them through `packages/cli`'s compiler, the one behind
   `darkprint export --attractor`, so an agent can get the artefact
   without shelling out and can check it by cloning the same digest.

   It is the one tool that makes more than one HTTP call, and that
   is the registry's shape rather than a preference: no address
   answers a whole bundle. The alternative was a route that emits
   DOT, which would put a second producer of the same artefact on
   the server, and two producers of one file is the arrangement the
   one-author rule exists to prevent.
   ============================================================ */

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-117) (cited at line 21): n/a — no route of its own; it reads SEAM-91's
// release address and SEAM-19's file address, both already served

import {
  attractorPipeline,
  fetchFile,
  fetchFileList,
  pipelineFromFiles,
} from "../../cli/src/index";
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
      "it matched, as `<field>:<token>`, naming the field and the word in the document. The " +
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
      "Fetch one node card as published, verbatim YAML. `ref` is `id@version`, always " +
      "pinned and never `latest`, and an id may be namespaced, as in `berti/solver-a@1.2.0`.",
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
  {
    name: "export_pipeline",
    title: "Export a pipeline",
    /* The description carries the disclaimer as well as the artefact does, because an agent
       decides whether to call this from the description and may act on the DOT without ever
       reading its header. Saying it twice is cheap; saying it nowhere an agent looks is the
       failure this whole task is about. */
    description:
      "Compile one published release into an Attractor-runnable DOT pipeline and return it " +
      "as text. Addressed by DIGEST, like `fetch_release`, so the pipeline is compiled from " +
      "the bytes you pinned. Read the header: it lists every Attractor attribute a DarkPrint " +
      "blueprint has no way to set, including goal gates, timeouts and every part of the " +
      "retry policy above `max_retries`, and each of those falls back to the runner's own " +
      "default. A node's prompt is all the runner gets from its card, so the card's ports " +
      "and its declared prohibitions are not enforced by anything in this file. A release " +
      "DarkPrint reports errors on is refused rather than compiled.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "The owner's handle." },
        slug: { type: "string", description: "The blueprint's slug." },
        digest: { type: "string", description: "`sha256:` and 64 hex digits, from provenance." },
      },
      required: ["owner", "slug", "digest"],
    },
    /**
     * The one tool that is not a single GET, and the reason is the registry's own shape.
     *
     * `/api/mcp/releases/…` answers file NAMES and `/api/files/…` answers one file's bytes
     * (D-220-15), so there is no address that hands over a whole bundle, and a compiler
     * needs the whole bundle. The alternative was a new route that serves DOT, which would
     * put a second producer of this artefact on the server beside the one in
     * `packages/cli`; the two would then have to be kept in step by hand, which is exactly
     * what "one author" was protecting against. So the composition happens here, over
     * routes that already exist, using the compiler `darkprint export` uses. An agent can
     * check this output by cloning the same digest and running that command.
     *
     * Nothing is written and nothing is ranked, so AC1 and AC5 are untouched: this reaches
     * the same two read routes `clone` reaches and derives its answer from their bytes.
     */
    run: async (options, args) => {
      const owner = str(args, "owner");
      const slug = str(args, "slug");
      const digest = str(args, "digest");

      const paths = await fetchFileList(options, owner, slug, digest);
      const files: Record<string, string> = {};
      for (const path of paths) {
        files[path] = await fetchFile(options, owner, slug, digest, path);
      }

      /* `<owner>/<slug>@<digest>` is what a refusal names, and every part of it is the
         caller's own argument, which the admissible-message rule permits. */
      const source = `${owner}/${slug}@${digest}`;
      return attractorPipeline(pipelineFromFiles(files, slug), source).dot;
    },
  },
];
