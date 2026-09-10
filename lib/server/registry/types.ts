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
  /**
   * `card_version.visibility`, straight off the row. Every other reader built on
   * `loadSnapshot` answers only rows `readable()` already let through, so this is
   * always `"public"` there in practice — added so `cardsOwnedBy` (the one reader
   * that deliberately admits an owner's own private rows, D-132-04 C-C) can tell a
   * caller which of the rows it returned are which, the same way
   * `OwnedBundleSummary.visibility` already does for a bundle.
   */
  visibility: "public" | "private";
}

/**
 * The stored scorecard (B-08). Read from `release`, never recomputed here: T080 owns the
 * projection and the read.
 *
 * A FOURTH MEMBER, `ontologyVersion: string`, WAS HERE AND IS GONE. It named the vocabulary
 * version the three axes were computed under, and there is one vocabulary now — the
 * Attractor spec language's — so the question it answered has a single answer for every
 * release and no longer discriminates between them. Both of its sources went with it:
 * `release.scored_ontology_version_id` was dropped by migration 0009, and
 * `AutonomyResult.ontologyVersion`, the stamp this interface actually read, is gone from
 * `lib/core`. A member whose every value is the same constant is not a fact about a score.
 */
export interface Scores {
  autonomy: AutonomyResult;
  security: SecurityResult;
  phaseCoverage: PhaseCoverage;
}

/**
 * 0007_drafts: one row of the profile shelf, over `bundle` directly rather than through
 * `loadSnapshot` — the release-skip that keeps a zero-release bundle off `blueprints()`
 * (B-06: "a bundle first exists at its first publish") is by design for the PUBLIC
 * archive shelf and stays untouched; the profile shelf is a different reader that wants
 * the draft rows precisely because they have no release yet, the GitHub empty-repo
 * analogy — "no release yet" is a thing to render, not a reason to omit the row.
 *
 * `title`/`summary` mirror `BundleRecord`'s absent-not-null convention: present only
 * when the bundle carries its own (a draft, or a bundle whose owner has since edited its
 * details), absent for a release-first bundle that has never had one written to this row.
 * `currentVersion`/`digest`/`nodeCount` are all three absent together for a zero-release
 * bundle and all three present together otherwise — there is no release to be current.
 */
export interface OwnedBundleSummary {
  slug: string;
  title?: string;
  summary?: string;
  visibility: "public" | "private";
  updatedAt: Date;
  releaseCount: number;
  currentVersion?: string;
  digest?: string;
  /** The current release's `cardRefs.length` — one entry per DOT node, duplicates
      included, matching `publish.ts`'s own "cardRefs is one entry per node". */
  nodeCount?: number;
}

/**
 * 0007_drafts: the bundle detail page's draft branch — the same row `ownedBundles`
 * projects one field for, addressed by key the way `blueprint()` is, and `undefined` on
 * the same B-03 terms (absent and unreadable answer alike).
 */
export interface DraftBundle {
  ownerHandle: string;
  slug: string;
  visibility: "public" | "private";
  title?: string;
  summary?: string;
  description?: string;
  category?: string;
  tags?: readonly string[];
  createdAt: Date;
  updatedAt: Date;
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
   * (the shelf's `viewOf` writes `diagnostics: []` and says so). This MAY carry an
   * error: `draw()` holds a stored release to `gate.ts`'s release gate, which lets a
   * reading of the author's own wiring through and prints it beside the drawing. What it
   * cannot carry is an unresolved reference, since a drawing short a node is refused.
   */
  diagnostics: readonly import("@/lib/core").Diagnostic[];
}
