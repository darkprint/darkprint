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
  // doc 3 §2 — a declared `phase` that is not one of the five closed phases.
  //
  // There is deliberately no code for an *absent* phase. The author's ruling supersedes
  // doc 3 §1's cardinality row: the five phases describe the factory, not every node in
  // it, so a card that declares none is complete, not deficient. `card/missing-phase` was
  // deleted rather than renamed for that reason — nothing in the engine may treat "no
  // phase" as a gap, and leaving a code with "missing" in its name would invite it back.
  | "card/unknown-phase"
  // doc 3 §7 — `phase` is the one dimension local namespaces may not extend.
  | "card/namespaced-phase"
  // The same phase declared twice on one card. A warning: it describes one node in one
  // phase either way, so the card still loads with the repeat collapsed.
  | "card/duplicate-phase"
  // A key the schema used to carry and no longer does.
  //
  // `requires_human` is the one that put it here. It stored whether a person acts at the
  // node beside a `type` that already said so, the two could disagree, and nothing
  // compared them; `type` is now the whole answer. A card written before that still
  // carries the key, and the generic unknown-key `info` would tell its author their field
  // was "not part of the card schema" and invite them to check the spelling — true, and
  // useless, for a key that was deliberately withdrawn.
  //
  // A WARNING, never an error. Every card published before the withdrawal carries the
  // key, and refusing to load them would turn a schema change into an archive-wide
  // outage; the value is also recoverable, since the answer the key used to give is
  // derivable from the field that remains. The message says where the answer comes from
  // now and what the card's own `type` currently answers, so the author can see whether
  // deleting the line changes anything.
  | "card/retired-field"
  // doc 1 §3.2 — `spec` is present but too short to instruct an agent on its own.
  | "card/spec-too-thin"
  // A `will_not` entry names a `data-type` the resolver could have enforced.
  //
  // The one diagnostic the `cannot` / `will_not` split needed. `cannot` holds the term ids
  // the resolver checks and `will_not` holds the author's own sentences, and the failure
  // mode of two fields is writing a value into the wrong one: an author who puts
  // `acceptance-criteria` under `will_not` has stated a rule the engine could have held
  // the graph to, in the field where it never will. Nothing else would say so, because a
  // free-text field has nothing to be wrong against.
  //
  // A WARNING rather than an error, on two grounds. The entry still says what it says and
  // the card is still readable, so refusing to load it would report a legible card as
  // broken. And the vocabulary grows: a sentence that names no term today can name one
  // after the next ontology version, and a card published clean must not become a card
  // that fails to load because somebody else minted a term.
  | "card/prohibition-misfiled"
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
  // An overlay term reuses a curated core id, so that id means something different for
  // everybody reading this bundle. Raised by `ontology/resolve.ts`'s `validate()`, and by
  // nothing else: `bundle/resolve.ts` used to raise it twice more, once when a manifest's
  // declared `ontologyVersion` disagreed with the vocabulary it was being read against and
  // once per card that disagreed with the manifest. Those were three hand-maintained copies
  // of one number reporting that they had drifted, and neither the manifest nor a card
  // declares a version any more. This one is about the vocabulary itself and stays.
  | "bundle/ontology-mismatch"
  // A card's `cannot` names an ontology `data-type` and an incoming edge can carry it.
  //
  // The one place doc 2 §3's isolation argument stops being prose. §3 claims isolation is
  // a property of the topology rather than of a prompt, and a claim about topology can be
  // checked on a topology: the card states what it must not receive, the resolver reads
  // the edges, and an author who wires the two together is told at the point of the edge.
  // An error rather than a warning, because the card and the graph state opposite things
  // and only the author knows which one they meant.
  //
  // Reads `cannot` and nothing else. `will_not` holds the author's own sentences about
  // what the node undertakes never to do, and this resolver has no way to decide "never
  // opens a shell" against a topology — so it does not look, and nothing here may report
  // an unchecked undertaking as a defect.
  | "bundle/prohibition-violated"
  // §4's bump rule, applied to a blueprint rather than to a card. A blueprint's diff is
  // its DOT plus the set of card refs it pins, and a release declaring a smaller bump than
  // that diff implies is refused. Namespaced `bundle/` rather than `blueprint/` because
  // that is the namespace this union gives a bundle, and `diagnostics.test.ts` enforces it.
  | "bundle/version-bump-too-small"
  // COMPATIBILITY (format rename, topology.dot replaces blueprint.dot): raised by the
  // upload classifier, not by `resolveBundle` — a `Bundle` carries one `dot: string` with
  // no filename of its own, so a dropped-folder concern like "which of two .dot files did
  // we read" cannot be reported from in here. Declared in this shared union anyway, since
  // `Diagnostic[]` is how every stage of this app reports a user-data problem and the
  // upload flow already merges non-engine diagnostics into the same list (see
  // `components/upload/UploadFlow.tsx`'s `ontology.validate()` merge). Fires only when a
  // dropped folder carries BOTH names — `blueprint.dot` alone still resolves silently, as
  // it always did before the rename.
  | "bundle/legacy-topology-file"
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
  // The same rule for a vocabulary version: removing a term or narrowing a `broader` chain
  // is major, adding one is minor, and a release declaring less than it did is refused.
  | "ontology/version-bump-too-small"
  // analysis/
  | "analysis/empty-graph"
  // Doc 3 §6 divides by *nodi totali*, and a node whose card is not in the bundle has no
  // `type` to read: it is counted, and the reader is told the fraction includes it.
  | "analysis/unresolved-node"
  | "analysis/criteria-leak-suspected"
  // Doc 3 §4.1 calls `criteria-leak` the most important check in the system, and a check
  // that reports nothing looks exactly like a check that passed. These two exist so it can
  // never be silently inert: they report that the engine does **not know**, which is a
  // third state, distinct from finding a leak and from finding none. Neither ever fires
  // the `criteria-leak` marker — an unknown is not evidence.
  //
  // `analysis/criteria-leak-unanchored` — a validation node judges somebody's output, but
  // no node in the blueprint declares an `acceptance-criteria` output, so there is no
  // producer to trace a path from and the check did not run.
  | "analysis/criteria-leak-unanchored"
  // `analysis/criteria-out-of-band` — a node's `params` name a criteria set that no node
  // in the graph produces. The criteria reach it outside the topology, so doc 2 §3's
  // claim that isolation is a property of the topology cannot be checked here at all.
  | "analysis/criteria-out-of-band"
  // `analysis/criteria-relayed-through-judge` — the criteria reach a `validation` node
  // whose own output then flows on to a node whose work is judged. The walk stops at a
  // judge on purpose (doc 2 §5.5 endorses `tester → debugger → tester` by name), so this
  // is the one place the topological detector deliberately declines to follow. Whether
  // what the judge forwards is the failure evidence doc 2 §5.5 allows or the criteria set
  // it forbids is a property of the prose, and the two shapes are isomorphic in the
  // graph — so the analyzer reports that it stopped looking instead of guessing either
  // way. Never fires the marker: declining to follow is not evidence of a leak.
  | "analysis/criteria-relayed-through-judge";

/** Where a diagnostic points. Every field is optional — a bundle-wide problem has none. */
export interface DiagnosticLocation {
  /** Bundle-relative file, e.g. "topology.dot" or "cards/solver@1.2.0.yaml". */
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
