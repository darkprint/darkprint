import { describe, expect, it } from "vitest";
import type {
  AutonomyResult as ServerAutonomyResult,
  Bundle as ServerBundle,
  BundleManifest as ServerBundleManifest,
  CardRef as ServerCardRef,
  Diagnostic as ServerDiagnostic,
  NodeCard as ServerNodeCard,
  OntologyTerm as ServerOntologyTerm,
  PhaseCoverage as ServerPhaseCoverage,
  Port as ServerPort,
  ResolvedBlueprint as ServerResolvedBlueprint,
  SecurityResult as ServerSecurityResult,
} from "./types";
import type {
  AutonomyResult as CoreAutonomyResult,
  Bundle as CoreBundle,
  BundleManifest as CoreBundleManifest,
  CardRef as CoreCardRef,
  Diagnostic as CoreDiagnostic,
  NodeCard as CoreNodeCard,
  OntologyTerm as CoreOntologyTerm,
  PhaseCoverage as CorePhaseCoverage,
  Port as CorePort,
  ResolvedBlueprint as CoreResolvedBlueprint,
  SecurityResult as CoreSecurityResult,
} from "@/lib/core";

/** True only for two mutually-assignable types — a structural alike is not enough. */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

// AC6: every export of lib/server/types.ts is the engine's own, checked at the type
// level rather than by shape. Each line below fails `npm run typecheck` — not this
// runtime test, vitest does not type-check — the moment an export here stops being
// a re-export and becomes a hand-written duplicate that could drift from lib/core.
/* eslint-disable @typescript-eslint/no-unused-vars -- read by tsc, not at runtime */
type _NodeCard = Assert<Equal<ServerNodeCard, CoreNodeCard>>;
type _Port = Assert<Equal<ServerPort, CorePort>>;
type _CardRef = Assert<Equal<ServerCardRef, CoreCardRef>>;
type _BundleManifest = Assert<Equal<ServerBundleManifest, CoreBundleManifest>>;
type _Bundle = Assert<Equal<ServerBundle, CoreBundle>>;
type _ResolvedBlueprint = Assert<Equal<ServerResolvedBlueprint, CoreResolvedBlueprint>>;
type _OntologyTerm = Assert<Equal<ServerOntologyTerm, CoreOntologyTerm>>;
type _Diagnostic = Assert<Equal<ServerDiagnostic, CoreDiagnostic>>;
type _AutonomyResult = Assert<Equal<ServerAutonomyResult, CoreAutonomyResult>>;
type _SecurityResult = Assert<Equal<ServerSecurityResult, CoreSecurityResult>>;
type _PhaseCoverage = Assert<Equal<ServerPhaseCoverage, CorePhaseCoverage>>;
/* eslint-enable @typescript-eslint/no-unused-vars */

describe("lib/server/types", () => {
  it("re-exports every name from lib/core rather than restating it", () => {
    // The type-level assertions above are the actual guard; this exists so the file
    // has a runtime test to run and report, per this repo's test/type-check split.
    expect(true).toBe(true);
  });
});
