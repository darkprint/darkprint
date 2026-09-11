/* ============================================================
   The HTTP executor: which route each tool reaches, and the one
   tool that compiles

   `export_pipeline` is served out of `public/bundles/frontline-triage`,
   which IS the exporter's output, so the tool is compiling the bytes
   the site publishes rather than a fixture written next to the
   assertion. No socket is opened anywhere here: `fetch` is injected.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { hasErrors, lintAttractor, parseDot } from "../../../lib/core";
import { exportPipeline } from "../../cli/src/index";
import { toolDefinition } from "./definitions";
import type { RegistryOptions } from "./registry";
import { httpExecutor } from "./tools";

const SOURCE = resolve("public/bundles/frontline-triage");
const OWNER = "lupo";
const SLUG = "frontline-triage";
const DIGEST = "sha256:a4c9d09c6acdb62d082cd870546eb2dc4d9564435e0a91b0f1d9467f81a108d1";

/** Every file of the exported folder, bundle-relative. */
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
    const url = new URL(String(input));
    asked.push(url.pathname + url.search);

    if (url.pathname.includes("/api/mcp/releases/")) return new Response(JSON.stringify({ files: list }));
    if (url.pathname.includes("/api/files/blueprints/")) {
      const after = url.pathname.split(`/d/${encodeURIComponent(DIGEST)}/`)[1] ?? "";
      const relPath = after.split("/").map(decodeURIComponent).join("/");
      const override = overrides[relPath];
      if (override !== undefined) return new Response(override);
      return new Response(readFileSync(join(SOURCE, relPath), "utf8"));
    }
    return new Response("{}");
  }) as unknown as typeof fetch;

  return { options: { baseUrl: "https://registry.invalid", fetch: stub }, asked };
}

const ARGS = { owner: OWNER, slug: SLUG, digest: DIGEST };

describe("each tool reaches its route", () => {
  it("builds the find, bundle and card addresses from the arguments, encoded", async () => {
    const { options, asked } = registry();
    const run = httpExecutor(options);

    await run("find_blueprints", { task: "review my pull requests", limit: 3, include_forks: true });
    await run("find_cards", { task: "triage a ticket" });
    await run("get_blueprint", { owner: OWNER, slug: SLUG, digest: DIGEST, harness: "codex" });
    await run("get_blueprint", { owner: OWNER, slug: SLUG });
    await run("read_card", { ref: "berti/solver-a@1.2.0" });
    await run("inspect_provenance", { owner: "a b", slug: SLUG });

    expect(asked).toEqual([
      "/api/mcp/blueprints/find?task=review+my+pull+requests&limit=3&forks=all",
      "/api/mcp/cards/find?task=triage+a+ticket",
      `/api/mcp/blueprints/${OWNER}/${SLUG}/bundle?digest=${encodeURIComponent(DIGEST)}&harness=codex`,
      `/api/mcp/blueprints/${OWNER}/${SLUG}/bundle`,
      "/api/mcp/cards/berti/solver-a%401.2.0",
      `/api/mcp/blueprints/a%20b/${SLUG}/provenance`,
    ]);
  });

  it("refuses a missing or malformed argument before the network", async () => {
    const { options, asked } = registry();
    const run = httpExecutor(options);
    await expect(run("find_blueprints", {})).rejects.toThrow(/`task` is required/);
    await expect(run("find_blueprints", { task: "x", limit: "many" })).rejects.toThrow(/`limit` must be an integer/);
    await expect(run("export_pipeline", { owner: OWNER, slug: SLUG })).rejects.toThrow(/`digest` is required/);
    await expect(run("no_such_tool", {})).rejects.toThrow(/Unknown tool/);
    expect(asked).toEqual([]);
  });
});

describe("export_pipeline's own shape", () => {
  it("is defined with the three arguments the release address needs", () => {
    const exporter = toolDefinition("export_pipeline")!;
    expect(exporter.title).toBe("Export a pipeline");
    expect((exporter.inputSchema as { required: string[] }).required).toEqual(["owner", "slug", "digest"]);
    expect(Object.keys((exporter.inputSchema as { properties: object }).properties).sort()).toEqual([
      "digest",
      "owner",
      "slug",
    ]);
  });

  it("tells an agent what the artefact cannot express, before it decides to call", () => {
    /* The description is where an agent decides, and an agent that acts on the returned DOT
       without reading its header has been told nowhere else. */
    const said = toolDefinition("export_pipeline")!.description;
    for (const missing of ["goal gate", "timeout", "max_retries"]) {
      expect(said.includes(missing), `the description does not mention ${missing}`).toBe(true);
    }
    expect(said).toContain("refused");
  });
});

describe("what export_pipeline compiles", () => {
  it("returns a DOT that Attractor's grammar and its lint rules both accept", async () => {
    const { options } = registry();
    const dot = await httpExecutor(options)("export_pipeline", ARGS);

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
    const dot = await httpExecutor(options)("export_pipeline", ARGS);

    expect(dot.startsWith("// Attractor-compatible DOT")).toBe(true);
    for (const missing of ["goal_gate", "timeout", "loop_restart", "model_stylesheet"]) {
      expect(dot.includes(missing), `the header does not mention \`${missing}\``).toBe(true);
    }
  });

  it("agrees byte for byte with `darkprint export --attractor` on the same folder", async () => {
    /* Two genuinely different paths reach the file: one reads a directory off disk, the
       other assembles a file map from two HTTP routes. An agreement, not a function compared
       to itself. */
    const { options } = registry();
    const overWire = await httpExecutor(options)("export_pipeline", ARGS);
    const onDisk = exportPipeline(SOURCE, "attractor").dot;

    expect(overWire).toBe(onDisk);
  });

  it("reaches the release route and the files route and nothing else", async () => {
    const { options, asked } = registry();
    await httpExecutor(options)("export_pipeline", ARGS);

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
    /* A topology pinning a card the release does not hold: the emitter would write a graph
       whose middle step carries no prompt. The refusal names the caller's own arguments and
       nothing about the host it was fetched from. */
    const { options } = registry({
      "topology.dot": 'digraph broken { a [card="nobody@9.9.9"]; a -> b; }',
    });
    const run = httpExecutor(options)("export_pipeline", ARGS);

    await expect(run).rejects.toThrow(new RegExp(`${OWNER}/${SLUG}@`));
    await expect(run).rejects.toThrow(/does not resolve/);
    await expect(run).rejects.toThrow(/darkprint validate/);
    await expect(run).rejects.not.toThrow(/registry\.invalid/);
  });

  it("refuses a release with no topology rather than compiling an empty pipeline", async () => {
    const { options } = registry();
    const noTopology = { ...options, fetch: emptyListing(options.fetch) };
    await expect(httpExecutor(noTopology)("export_pipeline", ARGS)).rejects.toThrow(/topology\.dot/);
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
