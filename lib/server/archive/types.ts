/* ============================================================
   DarkPrint backend — archive: published record shapes
   Mirrors what `addRelease` stores (second amendment, backend.md,
   T010): the only door T080, T090 and T100 have to a release's
   content, since none of them own `lib/db/schema.ts` and the
   layering rule forbids reaching past this module's own barrel.
   ============================================================ */

import type { AutonomyResult, BundleManifest, PhaseCoverage, SecurityResult } from "@/lib/server/types";

export interface BundleRecord {
  id: string;
  ownerId: string;
  slug: string;
  visibility: "public" | "private";
  lineage?: { ownerId: string; slug: string; version: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseRecord {
  id: string;
  bundleId: string;
  version: string;
  digest: string;
  createdAt: Date;
  dot: string;
  manifest: BundleManifest;
  cardRefs: readonly string[];
  cardDigests: readonly string[];
  vocabulary?: unknown;
  analysis?: { autonomy: AutonomyResult; security: SecurityResult; phaseCoverage: PhaseCoverage };
}
