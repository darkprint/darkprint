/* ============================================================
   T261 — the shared premises, and the reason each one is raised
   as its own failure rather than folded into an assertion.

   Every cell in this suite is either a FREEZE ("this still behaves
   as it did") or a NEGATIVE ("this no longer happens"). Both are
   green against an absent subject, so the subject's presence is
   raised separately, with its own repair. `tests/server/t260/
   contract.ts` established the construction and its own recorded
   failure mode is why: a walk that returns nothing satisfies every
   absence assertion at once.

   ── route paths are NAMED, never walked ──
   T260's and T262's partitions both record the rule and this task
   is the one it was written for: a route path IS a URL, so a
   deleted or moved route must red here rather than quietly shrink
   a scan. This is a URL migration; a scan that stopped matching
   would read exactly like a migration that completed.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";

export class PartitionError extends Error {
  override readonly name = "PartitionError";
}

/** Below this a source file cannot be carrying the declarations any cell here is about. */
export const BYTE_FLOOR = 200;

export interface Source {
  path: string;
  raw: string;
}

/**
 * Read named files, refusing every shape that would make a later assertion vacuous.
 *
 * The three refusals are ordered by how quietly each one passes: a shrunken LIST is the
 * quietest (nothing reds, the freeze simply covers less), a MISSING file is next, and an
 * EMPTIED file is the one that satisfies "exists" and every absence assertion at once.
 */
export function sources(paths: readonly string[], atLeast: number): Source[] {
  if (paths.length < atLeast) {
    throw new PartitionError(
      `expected at least ${atLeast} files, the list names ${paths.length}. A shrunken list is ` +
        `how a freeze goes vacuous without anything redding.`,
    );
  }
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new PartitionError(
      `these files do not exist: ${missing.join(", ")}. A freeze over a missing file passes.`,
    );
  }
  const read = paths.map((path) => ({ path, raw: readFileSync(path, "utf8") }));
  const thin = read.filter((source) => source.raw.length < BYTE_FLOOR);
  if (thin.length > 0) {
    throw new PartitionError(
      `below the ${BYTE_FLOOR}-byte floor: ${thin
        .map((source) => `${source.path} (${source.raw.length}B)`)
        .join(", ")}. An emptied file satisfies "exists" and every absence assertion at once.`,
    );
  }
  return read;
}

/* ============================================================
   THE URL MIGRATION'S OWN VOCABULARY

   Spelled once, here, because a suite that writes `/blueprints/`
   inline in forty places cannot be re-pointed and cannot be read
   for what it claims. D-261-01 rules the canonical shape and
   D-220-13 rules the key: `ownerHandle/slug`, never slug alone.
   ============================================================ */

/** D-261-01: the canonical public detail URL. */
export function canonicalBlueprintPath(ownerHandle: string, slug: string): string {
  return `/blueprints/${ownerHandle}/${slug}`;
}

/** The single-segment shape B-09 migrates away from, which D-261-02 turns into a redirector. */
export function legacyBlueprintPath(slug: string): string {
  return `/blueprints/${slug}`;
}

/**
 * The route files this task moves, named.
 *
 * `REDIRECTOR` and `CANONICAL` are siblings under `app/blueprints/` on purpose and the
 * pair is load-bearing: D-261-02 puts the redirector at `[slug]` and the canonical page
 * at `[owner]/[slug]`, which `route-shape.test.ts` measures as buildable AND as
 * foreclosing any page at `/blueprints/{owner}`.
 */
export const ROUTES = {
  redirector: "app/blueprints/[slug]/page.tsx",
  canonical: "app/blueprints/[owner]/[slug]/page.tsx",
  nodes: "app/nodes/[...id]/page.tsx",
  ontology: "app/ontology/[...term]/page.tsx",
  profileBundle: "app/u/[username]/[slug]/page.tsx",
} as const;

/** D-261-03: the ruled per-request spelling, and the one it is ruled AGAINST. */
export const FORCE_DYNAMIC = 'export const dynamic = "force-dynamic"';
export const REFUSED_MARKER = "connection()";

/** The deletions AC3 rests on (`dynamicParams = false` and the static-params generator). */
export const STATIC_PARAMS_MARKERS = [
  "export const dynamicParams",
  "generateStaticParams",
] as const;
