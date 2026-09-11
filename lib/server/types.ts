/* ============================================================
   DarkPrint backend — shared domain types
   Every one of these is the engine's own (`lib/core`), re-exported
   rather than restated. A second definition is how the two drift —
   see CLAUDE.md. `export type { X }
   from "@/lib/core"` is a re-export, not a copy, so there is no
   shape for a hand-written duplicate to drift from in the first
   place; `types.test.ts` pins that at the type level too.
   ============================================================ */

export type {
  AutonomyResult,
  Bundle,
  BundleManifest,
  CardRef,
  Diagnostic,
  NodeCard,
  OntologyTerm,
  PhaseCoverage,
  Port,
  ResolvedBlueprint,
  SecurityResult,
} from "@/lib/core";
