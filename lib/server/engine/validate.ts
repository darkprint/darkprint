/* ============================================================
   DarkPrint backend — the engine service
   The engine already runs in the browser on `/upload`; this runs
   the same pass authoritatively over submitted bytes so a publish
   does not have to trust what a tab computed.

   Every function here is synchronous and pure. No `Db`, no I/O,
   no clock, no randomness — which is what makes AC5's determinism
   a structural property rather than a promise, and it is why
   `loadBundle` is *consumed* rather than reimplemented: two
   implementations of the analysis would be two answers.

   ── What this module actually owns ──
   Almost nothing about the analysis, and that is the point. The
   parse, the resolution, the two metrics and the diagnostic order
   are all `lib/core`'s. What is owned here is the boundary: the
   size guards that decide whether the engine runs at all, the
   vocabulary the bundle resolves against, and the one input whose
   iteration order `lib/core` takes from the caller.
   ============================================================ */

import {
  CORE_ONTOLOGY,
  error,
  lintAttractor,
  loadBundle,
  loadCard,
  ontologyView,
  parseDocument,
  parseDot,
  sortDiagnostics,
} from "@/lib/core";
import type {
  BundleManifest,
  Diagnostic,
  DotGraph,
  LoadBundleResult,
  NodeCard,
  OntologyTerm,
  OntologyView,
} from "@/lib/core";
import { ONTOLOGY_EXTENSIONS_FILE, parseOntologyTerms } from "@/lib/content/ontology-file";
import {
  documentBytes,
  guardBytes,
  guardCards,
  guardNodes,
  measureSubmission,
  resolveLimits,
  type EngineLimits,
} from "./limits";

/** What `validateBundle` accepts. `manifest`, `dot` and `cardFiles` are `Bundle` (doc 1 §2). */
export interface ValidateBundleInput {
  manifest: BundleManifest;
  dot: string;
  cardFiles: Record<string, string>;
  /**
   * Doc 3 §7's local overlay, layered over the curated core — the *extensions* channel of
   * `ontologyView(base, extensions)` and not a whole vocabulary (D-40-03). A bare
   * `OntologyTerm[]` carries no version and no title, so it cannot be a base without one
   * being invented, and `BlueprintAnalysis.ontologyVersion` is what B-08 stores a score
   * against. Naming it `extensions` is what stops the other reading.
   */
  extensions?: readonly OntologyTerm[];
  /**
   * The vocabulary to resolve against, when the caller has one. Defaults to the shipped
   * core with `extensions` layered on, which is exactly what `lib/content/read.ts:146`
   * builds for the archive — so AC1 reproduces the build by construction rather than by
   * coincidence. `openView` passes one here, which is how a bundle's own overlay reaches
   * the resolution from a module that takes no `Db`. It used to be how a caller holding a
   * STORED ontology version drove B-08's re-score against an older vocabulary; there are no
   * stored versions, and the parameter is now about the overlay alone.
   */
  ontology?: OntologyView;
}

/** `parseDot` + `lintAttractor` over a lone DOT buffer. */
export interface ValidateDotResult {
  /**
   * The parsed statement tree, absent only when the source could not be read at all.
   *
   * `DotGraph` and not `lib/core`'s `Graph`: `Graph` is an interface of *methods*
   * (`successors`, `cycles`, `reachable`), so it does not survive `Response.json` — a
   * caller would receive `{}` where the seam register promises a graph. `DotGraph` is the
   * plain statement tree `parseDot` already returns, and it is what a validation endpoint
   * has to answer with anyway: what you wrote, not what it implies.
   */
  graph?: DotGraph;
  diagnostics: Diagnostic[];
}

/** A lone card document, mirroring `lib/core`'s own `CardValidation`. */
export interface ValidateCardResult {
  /** Present only when nothing of `error` severity was reported, as `CardValidation` is. */
  card?: NodeCard;
  diagnostics: Diagnostic[];
}

/** A lone vocabulary document. */
export interface ValidateVocabularyResult {
  /** Present only when nothing of `error` severity was reported, mirroring the card half. */
  terms?: readonly OntologyTerm[];
  diagnostics: Diagnostic[];
}

/**
 * The full pass: parse, resolve, score. Returns `LoadBundleResult` at 200 even when the
 * bundle is wrong in every possible way (B-03), and throws only when the submission is too
 * large to look at.
 *
 * **The verdict is the caller's** (D-40-01). `resolves` / `unfinished` / `rejected` is
 * `bundleProgress`, which lives in `components/upload/progress.ts` — Forbidden here, and
 * `LoadBundleResult` has no field that could carry a verdict. Reimplementing it would be
 * the second opinion that module's own header exists to prevent: *a predicate spelled twice
 * is a predicate that disagrees with itself on the day one copy is edited.* What comes back
 * is everything the verdict is computed from — `blueprint.nodes` for what resolved,
 * `blueprint.graph.ids` for what the DOT declared, and the diagnostics.
 */
export function validateBundle(
  input: ValidateBundleInput,
  limits?: EngineLimits,
): LoadBundleResult {
  const bounds = resolveLimits(limits);

  /* AC4, and the ordering is the criterion: both guards run before `loadBundle`, so a
     refusal here is a refusal that did no parsing. The discriminating test is that no parse
     occurred, not that a refusal came back.

     The card guard runs FIRST, and that ordering is load-bearing rather than incidental
     (D-40-A). Measuring the submission necessarily reads every card value, so with the byte
     guard first a *card-count* refusal opened every card file on its way to being refused —
     which is what the comment on `guardCards` claimed it did not do. Counting keys is O(1)
     in the values, so the cheap total question is asked before the expensive one. */
  guardCards(Object.keys(input.cardFiles).length, bounds);
  measureSubmission("validateBundle", submissionOf(input), bounds);

  const ontology = input.ontology ?? ontologyView(CORE_ONTOLOGY, input.extensions);
  const result = loadBundle(
    { manifest: input.manifest, dot: input.dot, cardFiles: sortedByKey(input.cardFiles) },
    { ontology },
  );

  /* Post-parse by ruling (D-40-06): a node count is a property of the parsed DOT, so this
     one cannot hold AC4's ordering and is not pretending to. */
  guardNodes(result.blueprint?.graph.ids.length ?? 0, bounds);

  /* Returned unmodified. `loadBundle` already applies `sortDiagnostics` on both of its
     return paths, and that order is severity-first — re-sorting by any other key here would
     produce a different order from the one the archive build produces, which is AC1. */
  return result;
}

/**
 * A lone DOT buffer, checked the two ways Attractor checks one.
 *
 * `parseDot` + `lintAttractor` (D-40-13) are what `scripts/generate-bundles.ts` calls "the
 * two checks Attractor runs before it will execute a pipeline", so a buffer that passes
 * here is one the runner will accept. All nine lint codes are warnings and none of them
 * turns the answer into a refusal.
 */
export function validateDot(dot: string, limits?: EngineLimits): ValidateDotResult {
  guardBytes("validateDot", documentBytes(dot), resolveLimits(limits));

  const parsed = parseDot(dot);
  if (parsed.graph === undefined) {
    /* AC3's case. The location carries line and column; it carries no `file`, because this
       entry point is handed bytes and never a name, and inventing one would put a filename
       the caller never sent into a diagnostic that points at their source. */
    return { diagnostics: sortDiagnostics(parsed.diagnostics) };
  }

  /* No node guard here, deliberately (D-40-16). This function parses a graph and could
     count one, and `maxNodes` is still `validateBundle`'s alone: a limit enforced in two
     places is two limits, and they drift the first time one of them is tuned. */

  const lint = lintAttractor(parsed.graph, dot);
  return { graph: parsed.graph, diagnostics: sortDiagnostics([...parsed.diagnostics, ...lint]) };
}

/**
 * A lone card document.
 *
 * Checked against the curated core alone: the published signature takes no vocabulary, so a
 * card naming a local term reports `card/unknown-term` here. That is the honest answer for a
 * card checked on its own — the term is unknown until some bundle supplies the overlay that
 * defines it — and a bundle's cards are checked against the overlay by `validateBundle`.
 */
export function validateCardSource(yaml: string, limits?: EngineLimits): ValidateCardResult {
  guardBytes("validateCardSource", documentBytes(yaml), resolveLimits(limits));

  const validation = loadCard(yaml, { ontology: ontologyView(CORE_ONTOLOGY), format: "yaml" });
  const diagnostics = sortDiagnostics(validation.diagnostics);
  return validation.card === undefined ? { diagnostics } : { card: validation.card, diagnostics };
}

/**
 * A lone vocabulary document — doc 3 §7's `terms:` file, as `/upload` drops one in.
 *
 * Three stages, and which reader owns each one matters more than the code does:
 *
 * - **syntax** is `parseDocument`, `lib/core`'s only parser. Its failures are coded
 *   `card/parse-error`, which is admissible for a non-card document (D-40-08) because the
 *   namespace names the parser and not the document; `lib/core` is Forbidden to edit here,
 *   so adding an `ontology/parse-error` is a change nobody owns.
 * - **shape** is `parseOntologyTerms`, the one existing reader of this document — the same
 *   one `lib/content/read.ts`, `bundle-export.ts` and `/upload` use. It is pure and
 *   client-safe by its own header. It throws where this must report, so its message becomes
 *   a diagnostic; what it must not become is a *third* opinion about what a term is.
 * - **structure** is `ontologyView(CORE_ONTOLOGY, terms).validate()` — the **extensions**
 *   channel, deliberately, and not T030's `validateVocabulary`. That function feeds its
 *   terms in as `base` and says so in its own docstring: it therefore reports neither
 *   `ontology/local-term-unrooted` nor `local-marker-unweighted` nor
 *   `phase-not-extensible`, which are precisely the rules an uploaded overlay has to obey.
 *   Using it here would answer a narrower question under this one's name.
 */
export function validateVocabularySource(
  yaml: string,
  limits?: EngineLimits,
): ValidateVocabularyResult {
  guardBytes("validateVocabularySource", documentBytes(yaml), resolveLimits(limits));

  const parsed = parseDocument(yaml, "yaml", ONTOLOGY_EXTENSIONS_FILE);
  if (parsed.value === undefined) return { diagnostics: sortDiagnostics(parsed.diagnostics) };

  let terms: readonly OntologyTerm[];
  try {
    /* The bundle-relative name this document has in every archive folder, so a shape
       complaint reads as being about a file rather than about nothing. It is a module
       literal: no caller-supplied filename reaches this. */
    terms = parseOntologyTerms(parsed.value, ONTOLOGY_EXTENSIONS_FILE);
  } catch (cause) {
    return {
      diagnostics: sortDiagnostics([
        ...parsed.diagnostics,
        error("card/parse-error", messageOf(cause), {
          location: { file: ONTOLOGY_EXTENSIONS_FILE },
        }),
      ]),
    };
  }

  const structural = ontologyView(CORE_ONTOLOGY, terms).validate();
  const diagnostics = sortDiagnostics([...parsed.diagnostics, ...structural]);
  return structural.some((d) => d.severity === "error")
    ? { diagnostics }
    : { terms, diagnostics };
}

/* --------------------- the boundary's own work --------------------- */

/**
 * The record rebuilt in sorted key order — the one thing on this path whose iteration order
 * `lib/core` takes from its caller.
 *
 * `resolveBundle` walks `cardFiles` as a `Record`, and a JavaScript object iterates in
 * insertion order, so two submissions carrying the same files in a different order would
 * resolve in a different order and could report the same diagnostics in a different
 * sequence. AC5 is that they must not. Sorting here rather than sorting the output is what
 * makes the guarantee falsifiable: permute the insertion order and the result must not
 * move, which a sort applied *after* the fact would satisfy while leaving the resolution
 * order untouched.
 *
 * `.sort()` with no comparator is UTF-16 code-unit order, matching `lib/core`'s own
 * `cmpString`. Never `localeCompare`, which would make the answer depend on the host.
 */
function sortedByKey(cardFiles: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(cardFiles).sort()) sorted[key] = cardFiles[key];
  return sorted;
}

/**
 * The four submitted halves, which are what AC4's byte limit is about.
 *
 * `ontology` is excluded, and it is the one place this deviates from D-40-17's
 * `JSON.stringify(input)` — reported to the orchestrator rather than taken silently.
 * An `OntologyView` is not submitted content: it is the vocabulary the submission is
 * *resolved against*, held by the caller, and it carries the whole of `CORE_ONTOLOGY` on
 * its `ontology` property. Serialising it would charge a caller the entire curated
 * vocabulary against its own upload's budget, so a small bundle could be refused for the
 * size of something it did not send and cannot make smaller.
 *
 * **The justification that stood here is WITHDRAWN** — *no route can reach that case, so for
 * every wire call the two readings are the same number, which is also why the archive's
 * 17 963 reproduces either way.* Three things were wrong with it. The figure reproduces under
 * no reading: measured through this module's own entry point the archive maximum is 17 947
 * with each bundle's own extensions and 18 195 with the shared vocabulary applied to all
 * nine. *No route can reach that case* was quantified over every route, present and future,
 * and established by reading the four that existed. And the framing was the defect rather
 * than the evidence — see **D-40-21** as published, which rules that this is a **premise** of
 * the exclusion and not a remark about its impact, on the ground that an exclusion from a
 * measured set is a bypass of the bound the moment the excluded field becomes caller-reachable.
 * Cited rather than restated: the replacement premise is the contract's, not this comment's.
 *
 * Two guards hold it now, and they are incomplete in different directions on purpose:
 * `app/api/validate/ontology-not-caller-supplied.test.ts` drives the bound against the input a
 * route actually builds, and walks `app/api/**` for a call to `ontologyView` with a second
 * argument.
 *
 * Everything the caller actually submitted is in, `extensions` included: it arrives on the
 * wire as the `vocabulary` string and is the author's own content.
 */
function submissionOf(input: ValidateBundleInput) {
  return {
    manifest: input.manifest,
    dot: input.dot,
    cardFiles: input.cardFiles,
    extensions: input.extensions,
  };
}

/** A thrown value's message, without assuming it was an `Error`. */
function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
