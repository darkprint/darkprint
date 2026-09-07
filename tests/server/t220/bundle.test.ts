/* ============================================================
   get a blueprint: the whole release in one answer

   The file set is held to `exportRelease`, which is the verb the
   site itself exports a folder with, so a difference below is the
   MCP verb's and not the exporter's. The seeded world carries a
   blueprint with two releases, so a pinned older digest can be told
   from the current one by its file names.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { README_RUNNER_SECTION, TOPOLOGY_DOT } from "@/lib/content/bundle-export";
import { exportRelease } from "@/lib/server/export";

import { loadMcp, outcome, verb } from "./contract";
import { anonymous, dropScratchDatabases, seededWorld } from "./fixtures";

const world = seededWorld();

afterAll(async () => {
  await dropScratchDatabases();
});

interface Blueprint {
  owner: string;
  slug: string;
  digest: string;
  version: string;
  current: boolean;
  manifest: { title: string; summary: string; tags: unknown };
  files: { path: string; text: string }[];
  scorecard?: {
    autonomy: { class: string; fraction: number; humanGates: string[] };
    security: { level: number; markers: string[] };
    phases: { covered: string[]; missing: string[] };
  };
  provenance: unknown;
  instantiate: { harness: string; steps: string[] };
}

async function bundleId(w: Awaited<ReturnType<typeof world>>): Promise<string> {
  const [row] = await w.scratch.query(
    `select b.id from "bundle" b join "account" a on a.id = b.owner_id where b.slug = $1 and a.handle = $2`,
    [w.twice, w.registry.handle],
  );
  return String(row!.id);
}

describe("get a blueprint", () => {
  it("answers the current release with every file exportRelease writes", async () => {
    const w = await world();
    const id = await bundleId(w);
    const getBlueprint = await verb("mcpGetBlueprint");
    const got = (await getBlueprint(w.scratch.db, anonymous, w.registry.handle, w.twice)) as Blueprint;

    expect(got.owner).toBe(w.registry.handle);
    expect(got.slug).toBe(w.twice);
    expect(got.current).toBe(true);
    expect(got.digest).toBe(w.second.digest);
    expect(got.version).toBe(w.second.version);
    const files = await exportRelease(w.scratch.db as never, anonymous, id, got.digest);
    expect(got.files).toEqual(files);
    expect(got.files.some((file) => file.path === TOPOLOGY_DOT)).toBe(true);
  });

  it("answers a pinned older digest with its own files, manifest and scorecard", async () => {
    const w = await world();
    const id = await bundleId(w);
    const getBlueprint = await verb("mcpGetBlueprint");
    const older = (await getBlueprint(w.scratch.db, anonymous, w.registry.handle, w.twice, {
      digest: w.first.digest,
    })) as Blueprint;
    const newer = (await getBlueprint(w.scratch.db, anonymous, w.registry.handle, w.twice)) as Blueprint;

    expect(older.current).toBe(false);
    expect(older.digest).toBe(w.first.digest);
    expect(older.version).toBe(w.first.version);
    expect(older.files).toEqual(await exportRelease(w.scratch.db as never, anonymous, id, w.first.digest));
    expect(older.files.map((f) => f.path)).not.toEqual(newer.files.map((f) => f.path));
    expect(typeof older.manifest.title).toBe("string");
    expect(older.scorecard, "a published release carries a scorecard").toBeDefined();
    expect(typeof older.scorecard!.autonomy.class).toBe("string");
    expect(older.scorecard!.security.level).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(older.scorecard!.phases.covered)).toBe(true);
  });

  it("carries the provenance the provenance verb answers", async () => {
    const w = await world();
    const getBlueprint = await verb("mcpGetBlueprint");
    const provenance = await verb("mcpProvenance");
    const got = (await getBlueprint(w.scratch.db, anonymous, w.registry.handle, w.twice)) as Blueprint;
    expect(got.provenance).toEqual(await provenance(w.scratch.db, anonymous, w.registry.handle, w.twice));
  });

  it("writes instantiation steps that name only things in the answer", async () => {
    const w = await world();
    const getBlueprint = await verb("mcpGetBlueprint");

    const generic = (await getBlueprint(w.scratch.db, anonymous, w.registry.handle, w.twice)) as Blueprint;
    expect(generic.instantiate.harness).toBe("generic");
    const steps = generic.instantiate.steps;
    expect(steps.length).toBeGreaterThan(3);
    for (const file of generic.files) expect(steps[0]).toContain(file.path);
    expect(steps.some((s) => s.includes(TOPOLOGY_DOT))).toBe(true);
    expect(steps.some((s) => s.includes("export_pipeline") && s.includes(generic.digest))).toBe(true);
    expect(steps.some((s) => s.includes("subagent"))).toBe(false);
    const readme = generic.files.find((f) => f.path === "README.md");
    const sectionTitle = README_RUNNER_SECTION.replace(/^#+ /, "");
    expect(steps.some((s) => s.includes(sectionTitle))).toBe(readme?.text.includes(README_RUNNER_SECTION) === true);

    for (const harness of ["claude-code", "codex"] as const) {
      const shaped = (await getBlueprint(w.scratch.db, anonymous, w.registry.handle, w.twice, {
        harness,
      })) as Blueprint;
      expect(shaped.instantiate.harness).toBe(harness);
      expect(shaped.files, "the harness filters nothing").toEqual(generic.files);
      expect(shaped.instantiate.steps.some((s) => s.includes("subagent"))).toBe(true);
      expect(shaped.instantiate.steps.some((s) => s.toLowerCase().includes("human"))).toBe(true);
      expect(shaped.instantiate.steps.some((s) => s.includes(harness))).toBe(true);
    }
  });

  it("refuses an unknown digest and an unknown slug with one sentence naming neither", async () => {
    const w = await world();
    const getBlueprint = await verb("mcpGetBlueprint");
    const { McpRefusedError } = (await loadMcp()) as { McpRefusedError: new () => Error };
    const missingDigest = `sha256:${"0".repeat(64)}`;
    const missingSlug = "no-such-bundle-t220";

    const byDigest = await outcome(
      () => getBlueprint(w.scratch.db, anonymous, w.registry.handle, w.twice, { digest: missingDigest }) as Promise<unknown>,
    );
    const bySlug = await outcome(
      () => getBlueprint(w.scratch.db, anonymous, w.registry.handle, missingSlug) as Promise<unknown>,
    );
    for (const got of [byDigest, bySlug]) {
      expect(got.ok).toBe(false);
      if (got.ok) continue;
      expect(got.error).toBeInstanceOf(McpRefusedError);
      const message = (got.error as Error).message;
      expect(message).toBe("mcpGetBlueprint: no such object in the registry.");
      expect(message).not.toContain(missingSlug);
      expect(message).not.toContain(missingDigest);
    }
  });
});
