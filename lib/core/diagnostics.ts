/* ============================================================
   DarkPrint core — the diagnostic model
   Every stage of the engine reports user-data problems as
   Diagnostic[] instead of throwing. Engine spec §1.
   ============================================================ */

/** How badly a diagnostic hurts: only `error` blocks a result from being produced. */
export type Severity = "error" | "warning" | "info";

/** Stable, greppable codes. Namespaced by the stage that emits them. */
export type DiagnosticCode =
  // dot/
  | "dot/parse-error"
  | "dot/unsupported"
  | "dot/not-directed"
  | "dot/duplicate-node"
  | "dot/self-loop"
  // card/
  | "card/parse-error"
  | "card/missing-field"
  | "card/bad-type"
  | "card/bad-id"
  | "card/bad-version"
  | "card/duplicate-port"
  | "card/unknown-term"
  | "card/deprecated-term"
  | "card/wrong-term-kind"
  | "card/version-bump-too-small"
  // doc 3 §2 — `phase` is absent, blank, or not one of the five closed phases.
  | "card/missing-phase"
  // doc 3 §7 — `phase` is the one dimension local namespaces may not extend.
  | "card/namespaced-phase"
  // doc 3 §3 — `type` ⊂ `human-in-the-loop` while `requires_human` is not true.
  | "card/human-type-inconsistent"
  // doc 1 §3.2 — `spec` is present but too short to instruct an agent on its own.
  | "card/spec-too-thin"
  // bundle/
  | "bundle/missing-card"
  | "bundle/orphan-card"
  | "bundle/unpinned-card"
  | "bundle/digest-mismatch"
  | "bundle/port-mismatch"
  | "bundle/port-ambiguous"
  | "bundle/type-mismatch"
  | "bundle/undeclared-dependency"
  | "bundle/missing-dependency"
  | "bundle/no-entry"
  | "bundle/no-exit"
  | "bundle/unreachable-node"
  | "bundle/ontology-mismatch"
  // attractor/ — the DOT subset Attractor reads (doc 1 §0.1.1, doc 2 §11 item 0).
  // Every one of these is a `warning`: a bundle that breaks an Attractor rule is
  // still a valid DarkPrint bundle, it just will not run under Attractor, and the
  // author has to be told which of the two is complaining.
  | "attractor/strict-graph"
  | "attractor/undirected-graph"
  | "attractor/multiple-graphs"
  | "attractor/bad-node-id"
  | "attractor/quoted-node-id"
  | "attractor/attr-separator"
  | "attractor/hash-comment"
  | "attractor/unsupported-value"
  | "attractor/reserved-attribute"
  // ontology/ — defects in a *vocabulary*, reported by `OntologyView.validate()`.
  // `ontology/unknown-term` is declared and deliberately not emitted by any stage today:
  // a term referenced but undefined inside a vocabulary is already
  // `ontology/dangling-pointer`, and a card naming a term nobody defined is
  // `card/unknown-term`. Kept as the reserved name for the third case — a vocabulary that
  // imports another and misses one of its terms — so it cannot be reused for anything
  // else. `diagnostics.test.ts` keeps that statement honest.
  | "ontology/unknown-term"
  | "ontology/cyclic-broader"
  | "ontology/dangling-pointer"
  // Doc 3 §7, the rules a local namespaced term must obey.
  | "ontology/phase-not-extensible"
  | "ontology/local-term-unrooted"
  | "ontology/local-marker-unweighted"
  // Doc 3 §5 subtracts a marker's weight, so a negative one is a credit, not a cheap
  // marker: a local term could cancel a core one. Reported, and counted as unweighted.
  | "ontology/local-marker-bad-weight"
  // analysis/
  | "analysis/empty-graph"
  // Doc 3 §6 divides by *nodi totali*, and a node whose card is not in the bundle has no
  // `type` to read: it is counted, and the reader is told the fraction includes it.
  | "analysis/unresolved-node"
  | "analysis/criteria-leak-suspected";

/** Where a diagnostic points. Every field is optional — a bundle-wide problem has none. */
export interface DiagnosticLocation {
  /** Bundle-relative file, e.g. "blueprint.dot" or "cards/solver@1.2.0.yaml". */
  file?: string;
  /** 1-based. */
  line?: number;
  /** 1-based. */
  column?: number;
  /** DOT node id this concerns. */
  nodeId?: string;
  /** Card reference "id@version". */
  cardRef?: string;
  /** Edge this concerns. */
  edge?: { source: string; target: string };
  /** Dotted path inside a YAML/JSON document, e.g. "inputs[1].type". */
  path?: string;
}

/** One reported problem. Never thrown — always returned. */
export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** One sentence, sentence-cased. States what is wrong. */
  message: string;
  /** Optional actionable follow-up: how to fix it. */
  hint?: string;
  location?: DiagnosticLocation;
}

/** Trailing options shared by the three constructor helpers. */
export interface DiagnosticOptions {
  hint?: string;
  location?: DiagnosticLocation;
}

/**
 * Optional keys are omitted rather than set to `undefined` so diagnostics compare
 * and serialize identically whether or not the caller passed `opts`.
 */
function make(
  severity: Severity,
  code: DiagnosticCode,
  message: string,
  opts?: DiagnosticOptions,
): Diagnostic {
  const d: Diagnostic = { code, severity, message };
  if (opts?.hint !== undefined) d.hint = opts.hint;
  if (opts?.location !== undefined) d.location = opts.location;
  return d;
}

/** Build an `error`: something that stops the engine from producing a result. */
export function error(
  code: DiagnosticCode,
  message: string,
  opts?: DiagnosticOptions,
): Diagnostic {
  return make("error", code, message, opts);
}

/** Build a `warning`: the result still stands, but something is off. */
export function warning(
  code: DiagnosticCode,
  message: string,
  opts?: DiagnosticOptions,
): Diagnostic {
  return make("warning", code, message, opts);
}

/** Build an `info`: worth surfacing, never a problem. */
export function info(
  code: DiagnosticCode,
  message: string,
  opts?: DiagnosticOptions,
): Diagnostic {
  return make("info", code, message, opts);
}

/** True when any diagnostic is an error. */
export function hasErrors(ds: readonly Diagnostic[]): boolean {
  return ds.some((d) => d.severity === "error");
}

/** Counts by severity. Every key is present, zero included. */
export function summarize(ds: readonly Diagnostic[]): {
  error: number;
  warning: number;
  info: number;
} {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of ds) counts[d.severity] += 1;
  return counts;
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** Code-unit comparison, not `localeCompare` — the order must not depend on the host locale. */
function cmpString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Diagnostics with no file/line/column sort first within their severity: a problem
 * about the bundle as a whole is more general than one about a single line of it.
 */
function cmpDiagnostic(a: Diagnostic, b: Diagnostic): number {
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (bySeverity !== 0) return bySeverity;
  const byFile = cmpString(a.location?.file ?? "", b.location?.file ?? "");
  if (byFile !== 0) return byFile;
  const byLine = (a.location?.line ?? 0) - (b.location?.line ?? 0);
  if (byLine !== 0) return byLine;
  const byColumn = (a.location?.column ?? 0) - (b.location?.column ?? 0);
  if (byColumn !== 0) return byColumn;
  return cmpString(a.code, b.code);
}

/** Stable sort: errors first, then by file, line, column, code. Returns a new array. */
export function sortDiagnostics(ds: readonly Diagnostic[]): Diagnostic[] {
  // Decorated with the input index so ties keep input order even where the host's
  // Array#sort is not stable.
  return ds
    .map((d, i) => ({ d, i }))
    .sort((x, y) => cmpDiagnostic(x.d, y.d) || x.i - y.i)
    .map((e) => e.d);
}
