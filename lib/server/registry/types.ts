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
/* The only import in this module that does not come through T000's barrel, and it is
   deliberate rather than an oversight. `BlueprintGraph` is `lib/types.ts`'s — the shape
   React Flow is seeded from — and `@/lib/server/types` re-exports `lib/core`'s domain types
   only, so there is nowhere on a server barrel to reach it from. `lib/server/types.ts` is
   T000's and not this task's to widen, and a second declaration here is the drift that file
   exists to prevent. Callers name it from `@/lib/types` too, which is where `ContentRow`
   already reads it, so this module re-exports nothing (D-133-02 F4 cuts the other way here:
   a caller binding `graphsOf` is not short of a place to get the type). */
import type { BlueprintGraph } from "@/lib/types";

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

/**
 * What a blueprint row draws with: the schematic, and the two capability lists printed
 * beside it (D-132-01, owed to T260 under D-260-14).
 *
 * Separate from `BlueprintSummary` rather than folded into it, because the index answers
 * this record only for a caller that asks: reassembling a bundle costs a YAML parse and a
 * layout pass per blueprint, and a shelf that wanted only titles would pay for every
 * drawing it never rendered.
 *
 * The three members are exactly `lib/content/view.ts`'s, which is the build-time model this
 * replaces — same names, same meanings, computed by the same three functions — so a row
 * cutting over from the archive to the read API draws the same picture.
 */
export interface BlueprintSchematic {
  graph: BlueprintGraph;
  /** Every distinct model or agent the graph asks for, in graph order. */
  requiredAgents: readonly string[];
  /** Every tool capability the graph asks for, as its ontology label, distinct, in graph order. */
  requiredTools: readonly string[];
  /**
   * The resolver's own list for this release, sorted as `resolveBundle` sorts it —
   * D-261-07(2): the detail page's Evidence section renders these and had no reader
   * (the shelf's `viewOf` writes `diagnostics: []` and says so). NON-error by
   * construction: `draw()` answers absent for a release with error diagnostics, so what
   * this carries is the notes-and-warnings layer of a blueprint that ships.
   */
  diagnostics: readonly import("@/lib/core").Diagnostic[];
}
