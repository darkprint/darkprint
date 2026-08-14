/* ============================================================
   DarkPrint backend — the registry's published record shapes
   D-80-01: `lib/core/archive/registry.ts`'s `BlueprintRecord` and
   `CardVersionRecord` are the index of a **single-owner archive**,
   keyed on `slug` alone, and this task serves a **multi-owner
   registry** (B-09). A record keyed on one half of a two-part key
   cannot tell `alice/foo` from `bob/foo`, so these carry the owner.
   Every field they share keeps `lib/core`'s name and meaning —
   only the key changes.
   ============================================================ */

import type {
  AutonomyResult,
  BundleManifest,
  CardRef,
  NodeCard,
  PhaseCoverage,
  SecurityResult,
} from "@/lib/server/types";

/** What identifies a blueprint since B-09: the owner's handle and the slug, together. */
export interface BlueprintKey {
  ownerHandle: string;
  slug: string;
}

/** One blueprint as the index sees it, projected from its current release. */
export interface BlueprintSummary {
  ownerHandle: string;
  slug: string;
  manifest: BundleManifest;
  digest: string;
  /** Refs of every card it pins that `actor` may read, distinct and sorted. */
  cardRefs: readonly CardRef[];
}

/** One published version of one card, plus the blueprints that pin it. */
export interface CardSummary {
  ref: CardRef;
  id: string;
  version: string;
  digest: string;
  card: NodeCard;
  /** Blueprints pinning this exact version that `actor` may read, distinct and sorted. */
  usedIn: readonly BlueprintKey[];
}

/**
 * The stored scorecard (B-08). Read from `release`, never recomputed here: T080 owns the
 * projection and the read, and the re-score belongs to whichever task publishes the
 * ontology release. `ontologyVersion` is the version string the three axes were computed
 * under, resolved through `release.scored_ontology_version_id`.
 */
export interface Scores {
  autonomy: AutonomyResult;
  security: SecurityResult;
  phaseCoverage: PhaseCoverage;
  ontologyVersion: string;
}
