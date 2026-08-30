/* ============================================================
   `export_pipeline`, the one tool that is not a registry read

   The registry is served out of `public/bundles/frontline-triage`,
   which IS the exporter's output, so the tool is compiling the
   bytes the site publishes rather than a fixture written next to
   the assertion. `network.test.ts` serves the same folder the same
   way for `clone`, and the two agreeing is the point of the cell
   that compares them.

   No socket is opened anywhere here: `fetch` is injected, which is
   also what keeps this file inside `tests/server/t300`'s egress
   guard.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { hasErrors, lintAttractor, parseDot } from "../../../lib/core";
import { exportPipeline } from "../../cli/src/index";
import type { RegistryOptions } from "./registry";
import { TOOLS, type Tool } from "./tools";

const SOURCE = resolve("public/bundles/frontline-triage");
const OWNER = "lupo";
const SLUG = "frontline-triage";
const DIGEST = "sha256:a4c9d09c6acdb62d082cd870546eb2dc4d9564435e0a91b0f1d9467f81a108d1";

/** Every file of the exported folder, bundle-relative. `network.test.ts`'s walk. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(SOURCE, full).split("\\").join("/"));
    }
  };
  walk(SOURCE);
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The two routes a release is assembled from, answered off disk, recording every path asked
 * for so a cell can assert the tool reached nothing else.
 */
function registry(overrides: Record<string, string> = {}): {
  options: RegistryOptions;
  asked: string[];
} {
  const asked: string[] = [];
  const list = sourceFiles();

  const stub = (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    asked.push(path);

    if (path.includes("/api/mcp/releases/")) return new Response(JSON.stringify({ files: list }));
    if (path.includes("/api/files/blueprints/")) {
      const after = path.split(`/d/${encodeURIComponent(DIGEST)}/`)[1] ?? "";
      const relPath = after.split("/").map(decodeURIComponent).join("/");
      const override = overrides[relPath];
      if (override !== undefined) return new Response(override);
      return new Response(readFileSync(join(SOURCE, relPath), "utf8"));
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;

  return { options: { baseUrl: "https://registry.invalid", fetch: stub }, asked };
}

const tool = (name: string): Tool => {
  const found = TOOLS.find((t) => t.name === name);
  if (found === undefined) throw new Error(`no tool \`${name}\` on TOOLS`);
  return found;
};

const ARGS = { owner: OWNER, slug: SLUG, digest: DIGEST };

describe("the tool's own shape", () => {
  it("matches the four registry tools: name, title, description, schema, run", () => {
    const exporter = tool("export_pipeline");
    expect(exporter.title).toBe("Export a pipeline");
    expect(typeof exporter.run).toBe("function");
    expect(exporter.inputSchema.required).toEqual(["owner", "slug", "digest"]);
    expect(Object.keys(exporter.inputSchema.properties as object).sort()).toEqual([
      "digest",
      "owner",
      "slug",
    ]);
  });

  it("tells an agent what the artefact cannot express, before it decides to call", () => {
    /* The description is where an agent decides, and an agent that acts on the returned DOT
       without reading its header has been told nowhere else. The three named in the brief
       are the load-bearing ones; the full list is in the file the tool returns. */
    const said = tool("export_pipeline").description;
    for (const missing of ["goal gate", "timeout", "max_retries"]) {
      expect(said.includes(missing), `the description does not mention ${missing}`).toBe(true);
    }
    expect(said).toContain("refused");
  });

  it("refuses a missing argument the way every other tool does", async () => {
    const { options, asked } = registry();
    await expect(tool("export_pipeline").run(options, { owner: OWNER, slug: SLUG })).rejects.toThrow(
      /`digest` is required/,
    );
    // Refused before the network, which is what makes the refusal free and the message honest.
    expect(asked).toEqual([]);
  });
});

describe("what it compiles", () => {
  it("returns a DOT that Attractor's grammar and its lint rules both accept", async () => {
    const { options } = registry();
    const dot = await tool("export_pipeline").run(options, ARGS);

    const parsed = parseDot(dot, "factory.dot");
    expect(hasErrors(parsed.diagnostics), parsed.diagnostics.map((d) => d.message).join("; ")).toBe(
      false,
    );
    expect(parsed.graph).toBeDefined();
    if (parsed.graph === undefined) return;
    expect(lintAttractor(parsed.graph, dot, "factory.dot")).toEqual([]);
  });

  it("carries the disclosure header into the agent's hands", async () => {
    const { options } = registry();
    const dot = await tool("export_pipeline").run(options, ARGS);

    expect(dot.startsWith("// Attractor-compatible DOT")).toBe(true);
    for (const missing of ["goal_gate", "timeout", "loop_restart", "model_stylesheet"]) {
      expect(dot.includes(missing), `the header does not mention \`${missing}\``).toBe(true);
    }
  });

  it("agrees byte for byte with `darkprint export --attractor` on the same folder", async () => {
    /* The claim the tool's description makes to an agent: clone this digest, run the
       command, get this file. Two genuinely different paths reach it — one reads a
       directory off disk through `readBundleDirectory`, the other assembles a file map from
       two HTTP routes through `pipelineFromFiles` — so this is an agreement and not a
       function compared to itself. It is also the cell that reds if either reader starts
       stubbing the manifest differently, which would silently rename the graph. */
    const { options } = registry();
    const overWire = await tool("export_pipeline").run(options, ARGS);
    const onDisk = exportPipeline(SOURCE, "attractor").dot;

    expect(overWire).toBe(onDisk);
  });

  it("reaches the release route and the files route and nothing else", async () => {
    const { options, asked } = registry();
    await tool("export_pipeline").run(options, ARGS);

    expect(asked.length).toBeGreaterThan(1);
    expect(asked.filter((path) => path.includes("/api/mcp/releases/"))).toHaveLength(1);
    for (const path of asked) {
      expect(
        path.includes("/api/mcp/releases/") || path.includes("/api/files/blueprints/"),
        `reached ${path}`,
      ).toBe(true);
    }
  });

  it("refuses a release DarkPrint reports errors on, naming what was asked for", async () => {
    /* A topology pinning a card the release does not hold. The bundle still resolves, so the
       emitter would write a graph whose middle step carries no prompt: a file that looks
       complete and runs nothing at that node. The refusal names the caller's own arguments
       and nothing about the host it was fetched from. */
    const { options } = registry({
      "topology.dot": 'digraph broken { a [card="nobody@9.9.9"]; a -> b; }',
    });
    const run = tool("export_pipeline").run(options, ARGS);

    await expect(run).rejects.toThrow(new RegExp(`${OWNER}/${SLUG}@`));
    await expect(run).rejects.toThrow(/does not resolve/);
    await expect(run).rejects.toThrow(/darkprint validate/);
    await expect(run).rejects.not.toThrow(/registry\.invalid/);
  });

  it("refuses a release with no topology rather than compiling an empty pipeline", async () => {
    const { options } = registry();
    /* The file list is the release's, so this cannot be reached by an ordinary release; it
       is reached by a caller pointing the tool at something that is not a bundle. The
       refusal has to say so instead of returning a `digraph` with a start and an exit. */
    const noTopology = { ...options, fetch: emptyListing(options.fetch) };
    await expect(tool("export_pipeline").run(noTopology, ARGS)).rejects.toThrow(/topology\.dot/);
  });
});

/** A registry whose release route lists a README and nothing else. */
function emptyListing(inner: typeof fetch): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.includes("/api/mcp/releases/")) {
      return new Response(JSON.stringify({ files: ["README.md"] }));
    }
    return await inner(input as never, init as never);
  }) as unknown as typeof fetch;
}
