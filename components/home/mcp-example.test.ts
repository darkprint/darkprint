import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  EXAMPLE_ADDED,
  EXAMPLE_ADDED_AFTER,
  EXAMPLE_HITS,
  EXAMPLE_IRREVERSIBLE,
  EXAMPLE_LINE,
  EXAMPLE_LOOP,
  EXAMPLE_OWNER,
  EXAMPLE_PROMPT,
  EXAMPLE_TASK,
  SectionMcpExample,
} from "@/components/home/SectionMcpExample";
import { MCP_FIRST_PROMPT } from "@/components/mcp/clients";
import { plainText } from "@/components/ui/visible-text";
import { parseDot } from "@/lib/core";
import { getNodeCard } from "@/lib/content";
import { mcpFindBlueprints, mcpGetBlueprint } from "@/lib/server/mcp";
import { REGISTRY_HANDLE, planImport, runImport } from "@/lib/server/seed";
import { createTestDb, type TestDb } from "@/tests/support";

/* The landing's example claims a search result, a graph and a run contract. Each claim is
   held here to what produces it: the archive's own files for the graph, and the MCP verbs
   over a seeded registry for the search and the contract. */

const text = plainText(renderToStaticMarkup(createElement(SectionMcpExample)));

function topology(slug: string) {
  const src = readFileSync(join(process.cwd(), "content/blueprints", slug, "topology.dot"), "utf8");
  const graph = parseDot(src).graph;
  if (graph === undefined) throw new Error(`content/blueprints/${slug}/topology.dot does not parse.`);
  return graph;
}

const chosen = topology(EXAMPLE_HITS[0]);
const edges = new Set(chosen.edges.map((edge) => `${edge.source} -> ${edge.target}`));
const pairs = (ids: readonly string[]) => ids.slice(1).map((id, i) => `${ids[i]} -> ${id}`);

/** The card pinned on one of the chosen blueprint's nodes, as the archive stores it. */
function cardOf(nodeId: string) {
  const ref = chosen.nodes.find((node) => node.id === nodeId)?.attrs.card;
  if (typeof ref !== "string") throw new Error(`${nodeId} pins no card.`);
  const [id, version] = ref.split("@");
  const card = getNodeCard(id, version)?.card;
  if (card === undefined) throw new Error(`The archive has no card ${ref}.`);
  return card;
}

describe("the landing's MCP example, against the archive", () => {
  it("prints the /mcp page's first prompt with the task filled in", () => {
    expect(MCP_FIRST_PROMPT.split("<your task>"), "the placeholder is gone or doubled").toHaveLength(2);
    expect(EXAMPLE_PROMPT).toBe(MCP_FIRST_PROMPT.replace("<your task>", EXAMPLE_TASK));
    expect(text).toContain(EXAMPLE_PROMPT);
  });

  it("names each hit by the ref the seed publishes it under, with its node count", () => {
    expect(EXAMPLE_OWNER).toBe(REGISTRY_HANDLE);
    for (const slug of EXAMPLE_HITS) {
      expect(text).toContain(`${EXAMPLE_OWNER}/${slug}`);
      expect(text).toContain(`${topology(slug).nodes.length} nodes`);
    }
  });

  it("draws a route and a loop that are edges of the blueprint, and covers every node", () => {
    for (const pair of [...pairs(EXAMPLE_LINE), ...pairs(EXAMPLE_LOOP)]) {
      expect(edges, `the example draws ${pair}, which the topology does not have`).toContain(pair);
    }
    expect(new Set([...EXAMPLE_LINE, ...EXAMPLE_LOOP])).toEqual(new Set(chosen.nodes.map((node) => node.id)));
    expect(text).toContain(EXAMPLE_LINE.join(" → "));
    expect(text).toContain(EXAMPLE_LOOP.join(" → "));
  });

  it("adds a node for the email no card sends, fed by a node that has an output", () => {
    expect(chosen.nodes.map((node) => node.id)).not.toContain(EXAMPLE_ADDED);
    for (const node of chosen.nodes) {
      const card = cardOf(node.id);
      expect(`${card.action} ${card.spec}`, `${node.id} already emails`).not.toMatch(/e-?mail/i);
    }
    expect(cardOf(EXAMPLE_ADDED_AFTER).outputs.length).toBeGreaterThan(0);
    expect(cardOf(EXAMPLE_IRREVERSIBLE).outputs, `${EXAMPLE_IRREVERSIBLE} emits something a summary could read`).toEqual([]);
    expect(cardOf(EXAMPLE_IRREVERSIBLE).spec).toContain("channel");
    expect(text).toContain(`after ${EXAMPLE_ADDED_AFTER} that writes`);
  });

  it("names the last node as the one whose card marks its work irreversible", () => {
    expect(EXAMPLE_LINE.at(-1)).toBe(EXAMPLE_IRREVERSIBLE);
    const marked = chosen.nodes
      .filter((node) => cardOf(node.id).riskMarkers.includes("irreversible-action"))
      .map((node) => node.id);
    expect(marked).toEqual([EXAMPLE_IRREVERSIBLE]);
  });
});

describe("the landing's MCP example, against a seeded registry", () => {
  let test: TestDb | undefined;

  beforeAll(async () => {
    test = await createTestDb();
    await runImport(test.client.db as never, await planImport());
  }, 120_000);

  afterAll(async () => {
    await test?.drop();
  });

  it("ranks the two hits it prints first and second, by meaning", async () => {
    const found = await mcpFindBlueprints(test!.client.db as never, { kind: "anonymous" }, EXAMPLE_TASK);
    expect(found.encoder, "without the encoder the order is lexical and proves nothing here").toBe("present");
    expect(found.ordered).toBe(true);
    expect(found.hits.slice(0, EXAMPLE_HITS.length).map((hit) => hit.ref)).toEqual(
      EXAMPLE_HITS.map((slug) => `${EXAMPLE_OWNER}/${slug}`),
    );
    for (const hit of found.hits.slice(0, EXAMPLE_HITS.length)) {
      expect(text).toContain(`${hit.ref} ${hit.title} ${hit.nodes} nodes`);
    }
  });

  it("hands back the folder and the run contract the example describes", async () => {
    const got = await mcpGetBlueprint(test!.client.db as never, { kind: "anonymous" }, EXAMPLE_OWNER, EXAMPLE_HITS[0], {
      harness: "claude-code",
    });
    expect(got.instantiate.steps[0]).toContain(`under ./${EXAMPLE_HITS[0]}/`);
    expect(text).toContain(`./${EXAMPLE_HITS[0]}/`);
    expect(got.run[0]).toContain("Show the graph and the scorecard");
    expect(got.run[1]).toContain("Run one node at a time, each in its own context");
    expect(got.run.at(-1)).toContain("stop yourself wherever the work is irreversible");
  });
});
