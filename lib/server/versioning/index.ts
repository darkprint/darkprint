/* ============================================================
   DarkPrint backend — lib/server/versioning public surface
   One versioning authority for cards and
   blueprints — declare a semver, compute a digest, infer the bump
   the content actually implies, hold a chain to it, carry
   deprecation forward.

   T025 named a third subject, the ontology version, and there is no
   such thing any more: the owner had vocabulary versioning removed
   on 2026-09-05 (§11.0 Q7/Q26). `inferOntologyBump` went with it,
   having never had a caller outside its own tests — the vocabulary
   moves terms through `deprecated`, which is the mechanism doc 3
   §6.2 actually needs, and nothing computes a bump for it.

   The card half already exists in lib/core and is re-exported
   here rather than reimplemented, so a caller reaches for one
   barrel regardless of which of the three primitives it needs.
   ============================================================ */

export type { BumpLevel, BumpAnalysis } from "@/lib/core";
export { inferBump, checkVersionChain, parseSemver, compareSemver } from "@/lib/core";

export type { BlueprintSnapshot } from "./blueprint-bump";
export { inferBlueprintBump } from "./blueprint-bump";
export type { BumpSubject } from "./declared-bump";
export { checkDeclaredBump } from "./declared-bump";
