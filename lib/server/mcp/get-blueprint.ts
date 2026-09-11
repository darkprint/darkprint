/* ============================================================
   DarkPrint backend: mcpGetBlueprint
   One call for a whole blueprint: every file of a release, its
   manifest, its scorecard, its provenance, and the notes for
   instantiating it. Without a digest the current release answers;
   with one, exactly those bytes. The scorecard and the manifest are
   read off the release asked for rather than off the current one,
   so a pinned older digest describes itself.
   ============================================================ */

import type { Db } from "@/lib/db";
import { listReleases, type ReleaseRecord } from "@/lib/server/archive";
import { exportRelease } from "@/lib/server/export";
import type { Actor } from "@/lib/server/policy";
import { blueprint } from "@/lib/server/registry";
import { readableBundle } from "./bundle";
import { McpRefusedError } from "./errors";
import { instantiationSteps, runContract } from "./guidance";
import { mcpProvenance } from "./provenance";
import { withMcpStore } from "./store";
import type { McpBlueprint, McpHarness, McpScorecard } from "./types";

export interface GetBlueprintOptions {
  /** `sha256:` and 64 hex digits. Absent means the current release. */
  digest?: string;
  /** Shapes the instantiation notes only. Default `generic`. */
  harness?: McpHarness;
}

/**
 * A whole blueprint at one digest, as `actor` may read it.
 *
 * Throws `McpRefusedError` for a handle nobody holds, a slug naming no bundle, a bundle this
 * actor may not read, a bundle with no release, and a digest naming no release of it: one
 * sentence for all five.
 */
export async function mcpGetBlueprint(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
  options: GetBlueprintOptions = {},
): Promise<McpBlueprint> {
  return withMcpStore("mcpGetBlueprint", async () => {
    const bundle = await readableBundle(db, actor, ownerHandle, slug);
    if (bundle === undefined) throw new McpRefusedError("mcpGetBlueprint");

    const current = await blueprint(db, actor, ownerHandle, slug);
    const digest = options.digest ?? current?.digest;
    if (digest === undefined) throw new McpRefusedError("mcpGetBlueprint");

    const release = (await listReleases(db, bundle.id)).find((row) => row.digest === digest);
    if (release === undefined) throw new McpRefusedError("mcpGetBlueprint");

    const files = await exportRelease(db, actor, bundle.id, digest);
    const provenance = await mcpProvenance(db, actor, ownerHandle, slug);
    const scorecard = scorecardOf(release);
    const harness = options.harness ?? "generic";

    /* One input for both, so the notes and the contract cannot disagree about which nodes
       wait for a person. */
    const guidance = {
      harness,
      owner: provenance.publishedBy,
      slug: bundle.slug,
      digest,
      files,
      ...(scorecard === undefined ? {} : { humanGates: scorecard.autonomy.humanGates }),
    };
    const out: McpBlueprint = {
      owner: provenance.publishedBy,
      slug: bundle.slug,
      digest,
      version: release.version,
      current: current?.digest === digest,
      manifest: manifestOf(release),
      files,
      provenance,
      instantiate: { harness, steps: instantiationSteps(guidance) },
      run: runContract(guidance),
    };
    if (scorecard !== undefined) out.scorecard = scorecard;
    return out;
  });
}

function manifestOf(release: ReleaseRecord): McpBlueprint["manifest"] {
  const { manifest } = release;
  const out: McpBlueprint["manifest"] = {
    title: manifest.title,
    summary: manifest.summary,
    tags: manifest.tags,
  };
  if (manifest.description !== undefined) out.description = manifest.description;
  if (manifest.category !== undefined) out.category = manifest.category;
  return out;
}

/** The stored scorecard, or `undefined` when the release was never scored. */
function scorecardOf(release: ReleaseRecord): McpScorecard | undefined {
  const analysis = release.analysis;
  if (analysis === undefined) return undefined;
  return {
    autonomy: {
      class: analysis.autonomy.autonomyClass,
      fraction: analysis.autonomy.fraction,
      humanGates: analysis.autonomy.contributions
        .filter((node) => node.requiresHuman)
        .map((node) => node.nodeId),
    },
    security: {
      level: analysis.security.level,
      markers: analysis.security.penalties.map((penalty) => penalty.marker),
    },
    phases: {
      covered: analysis.phaseCoverage.covered,
      missing: analysis.phaseCoverage.missing,
    },
  };
}
