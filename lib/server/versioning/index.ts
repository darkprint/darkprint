/* ============================================================
   DarkPrint backend — lib/server/versioning public surface
   backend.md T025: one versioning authority for cards, blueprints
   and ontology versions — declare a semver, compute a digest,
   infer the bump the content actually implies, hold a chain to
   it, carry deprecation forward.

   The card half already exists in lib/core and is re-exported
   here rather than reimplemented, so a caller reaches for one
   barrel regardless of which of the three primitives it needs.
   ============================================================ */

export type { BumpLevel, BumpAnalysis } from "@/lib/core";
export { inferBump, checkVersionChain, parseSemver, compareSemver } from "@/lib/core";

export type { BlueprintSnapshot } from "./blueprint-bump";
export { inferBlueprintBump } from "./blueprint-bump";
export { inferOntologyBump } from "./ontology-bump";
export type { BumpSubject } from "./declared-bump";
export { checkDeclaredBump } from "./declared-bump";
