/* ============================================================
   DarkPrint core — storable versus approved
   Severity answers one question. Two are being asked of it.

   The first is **may this artefact exist here**: can the bytes be
   read, can the thing be addressed by a name, is there somebody it
   belongs to. The second is **is this any good**: does the graph
   isolate what it claims to isolate, is the loop bounded, does a
   validation node judge work it also produced. `Severity` carries
   both, so `hasErrors` is read at a publish gate and at a scoring
   surface alike, and the set of things that refuse a bundle is
   whatever the union of every `error(` call site happens to be. No
   file states it, so no file can be wrong about it, and nobody can
   review it.

   That is the accident this module ends. The blocking set is
   NAMED here, one entry per code, each with the reason it is in
   it, and `DIAGNOSTIC_GATE` is a `Record<DiagnosticCode, …>`, so a
   code added to the union tomorrow does not compile until somebody
   decides which of the two questions it answers.

   ── the rule the list is written to ──
   1. **Storable is near-unconditional.** It parses, it is
      addressable, it is attributable. Nothing else may refuse
      storage, because a registry that only accepts work it approves
      of is a registry that has an opinion instead of an archive.
   2. **Approved is a score, and a score is allowed to be bad.** A
      blueprint with a leaking criteria path, an unbounded loop, a
      type that cannot flow down the edge it is wired to — all of
      that is a reading, and a reading is published beside the
      artefact rather than in place of it.
   3. **An author-declared prohibition may still block.** A card's
      `cannot:` is the author asking to be held to something, and
      honouring that is not DarkPrint having an opinion, it is
      DarkPrint doing as it was told. `bundle/prohibition-violated`
      is the one entry in the blocking set that is not about
      legibility, and it is there for that reason alone.
   4. **Nothing DarkPrint INFERS may ever block.** The autonomy
      number, the security markers the analyzer deduces rather than
      reads, the phase coverage, the Attractor lint: every one of
      them is DarkPrint's own reading of somebody else's work, and a
      reading that can refuse a publication is a reading with a veto.
      `INFERRED_CODES` names them and `gate.test.ts` holds the two
      lists disjoint.

   `lib/core/attractor/lint.ts` already gets the symmetric direction
   right and says so in its own header: every Attractor-rule finding
   is a `warning`, never an `error`, because a bundle that breaks one
   is still a valid DarkPrint bundle. That was a decision somebody
   took deliberately about one namespace. This file is the same
   decision taken deliberately about all of them.

   ── two stages, not one answer ──
   D-109, owner ruling of 2026-08-30. The question is asked twice
   and the right answer differs, so there are two ladders rather
   than one.

   `isStorable` is the DRAFT gate: `darkprint import`, which writes
   a draft when the bytes are legible and prints the readings beside
   it, and `darkprint export`, which used to refuse ANY error and
   therefore refused the draft `import` had just written — the two
   verbs contradicting each other, which is what a gate resting on
   an accident looks like from outside.

   `isReleasable` is the PUBLISH gate: `publish`, `/upload`'s step 4
   and the release export in `lib/server/export/build.ts`. It adds
   exactly the reference failures, because a release is what a
   stranger pins and its scorecard travels with it. A node pointing
   at no card is a hole in the graph the score was computed over.

   What did NOT move: a port that does not fit, a type that cannot
   flow, a term nobody has minted. Every one is DarkPrint comparing
   two things the author wrote, rule 4 forbids an inference from
   refusing anybody's work, and a release is entitled to publish a
   bad score. `RELEASE_ONLY_CLASSES` carries the argument.

   ── attribution is not in this list, and cannot be ──
   The third storable condition is that the artefact has an author.
   No `DiagnosticCode` reports its absence, because attribution is
   established by the session that submits the bytes (`lib/server/
   policy`'s `can`, and `publish`'s `resolveOwner`) rather than by
   anything inside them. It is named in the rule above so the rule
   stays whole; the enforcement lives where the owner is known.
   ============================================================ */

import type { Diagnostic, DiagnosticCode } from "./diagnostics";

/**
 * Which of the two questions a code answers, and — for the three that refuse storage —
 * on what ground.
 *
 * Four values rather than a boolean because "this blocks" is the answer and the ground is
 * the reason, and a list of codes with no reasons beside them is the same unreviewable
 * thing the severity union already was.
 */
export type GateClass =
  /** The bytes are not a document, or not the kind of document they claim to be. */
  | "unreadable"
  /** The artefact cannot be pinned to a name: no id, no version, or a pin that lies. */
  | "unaddressable"
  /** The card's own author asked to be refused this. */
  | "author-declared"
  /**
   * A node that points at no card, or at no particular version of one. Storable, because a
   * half-written folder is the normal state of work in progress and an imported foreign
   * pipeline routinely has nodes DarkPrint cannot resolve. Not releasable: see
   * `RELEASE_ONLY_CLASSES`.
   */
  | "unresolved-reference"
  /** A finding about the work. Reported, scored, shown, and never a refusal. */
  | "approval";

/**
 * Every diagnostic code, classified.
 *
 * A `Record<DiagnosticCode, GateClass>`, so this fails to compile when a code joins the
 * union and nobody classified it, and equally when a code is classified that the union no
 * longer has. `diagnostics.test.ts`'s `EMITTED_BY` uses the same device for the same
 * reason; this is the second question asked of the same closed set.
 *
 * Read the comments as the reasons, not as decoration. Each `unreadable` /
 * `unaddressable` / `author-declared` entry is a decision to refuse somebody's work, and a
 * decision to refuse somebody's work that carries no reason is one nobody can argue with.
 */
export const DIAGNOSTIC_GATE: Readonly<Record<DiagnosticCode, GateClass>> = Object.freeze({
  /* ---------- dot ---------- */
  // The file is not a graph. There is nothing to store, address or score.
  "dot/parse-error": "unreadable",
  // `graph` rather than `digraph`, or a `--` edge. It parses and it is not a blueprint:
  // every reading downstream — reachability, phases, isolation — is about direction.
  "dot/not-directed": "unreadable",
  // A construct the parser skips (an HTML label, a port specifier, a second graph). The
  // file is still a graph and the skipped part is reported.
  "dot/unsupported": "approval",
  "dot/duplicate-node": "approval",
  "dot/self-loop": "approval",

  /* ---------- card ---------- */
  "card/parse-error": "unreadable",
  // Coarse in the same way: it fires for a DOCUMENT that is not a mapping, which is not a
  // card at all, and for one FIELD of the wrong type, which is a card with a defect in it.
  // `FIELD_SCOPED` tells them apart by whether the diagnostic names a field.
  "card/bad-type": "unreadable",
  // Coarse: it fires for `id` and `version`, which ARE the address, and for `name`, `type`,
  // `action` and `spec`, which are not. `FIELD_SCOPED` below narrows it by the field the
  // diagnostic already names, so a card missing its `spec` is storable and a card that
  // cannot say what it is called is not.
  "card/missing-field": "unaddressable",
  "card/bad-id": "unaddressable",
  "card/bad-version": "unaddressable",
  // §4: a published version is never edited in place, so a version that understates its
  // own diff addresses a card that is not the card being stored. The refusal is about
  // which name the bytes go under, not about their quality.
  "card/version-bump-too-small": "unaddressable",
  // Everything below is DarkPrint reading a card against a vocabulary, a schema or a
  // house style. `card/unknown-term` is the load-bearing one: it is an ERROR today, so a
  // card naming a term nobody has minted yet does not load — and that is a judgement about
  // vocabulary coverage, not about whether the card can be stored.
  "card/duplicate-port": "approval",
  "card/unknown-term": "approval",
  "card/deprecated-term": "approval",
  "card/wrong-term-kind": "approval",
  "card/unknown-phase": "approval",
  "card/namespaced-phase": "approval",
  "card/duplicate-phase": "approval",
  "card/retired-field": "approval",
  "card/spec-too-thin": "approval",
  "card/prohibition-misfiled": "approval",

  /* ---------- bundle ---------- */
  // Two files claiming one card version with different bytes, or a node whose declared
  // digest does not match the card it points at. Both leave the reference undecidable,
  // which is an address that lies rather than an address that is missing.
  "bundle/digest-mismatch": "unaddressable",
  "bundle/version-bump-too-small": "unaddressable",
  // The one non-legibility entry, and the reason rule 3 exists. The card's `cannot:` is
  // the author's own declared rule and the resolver holds the graph to it; refusing here
  // is doing as the author asked, which is the opposite of DarkPrint having an opinion.
  "bundle/prohibition-violated": "author-declared",
  // "Not written yet" rather than "wrong" — `components/upload/progress.ts` already draws
  // that line for the wizard's copy, and it is the same line here. A half-written folder
  // is the normal state of a blueprint somebody is working on, so neither refuses storage.
  // They do refuse a RELEASE: both mean a node resolves to no particular card, and the
  // scorecard published beside a release would then be computed over a graph with a hole
  // in it. Note this is a fact about the bytes — a pointer with no target — and not an
  // inference, which is why it can block at all under rule 4.
  "bundle/missing-card": "unresolved-reference",
  "bundle/unpinned-card": "unresolved-reference",
  // A card nobody instantiates changes no node's score, so it is a finding at both stages.
  "bundle/orphan-card": "approval",
  // Every one of these is DarkPrint comparing two things the author wrote and reporting
  // that they disagree. That is a reading, it is the most useful thing the engine
  // produces, and it is not a reason to refuse to hold the file.
  "bundle/port-mismatch": "approval",
  "bundle/port-ambiguous": "approval",
  "bundle/type-mismatch": "approval",
  "bundle/undeclared-dependency": "approval",
  "bundle/missing-dependency": "approval",
  "bundle/no-entry": "approval",
  "bundle/no-exit": "approval",
  "bundle/unreachable-node": "approval",
  "bundle/ontology-mismatch": "approval",
  "bundle/legacy-topology-file": "approval",

  /* ---------- attractor ---------- */
  // Ten codes, all `warning` at the point of emission, and all `approval` here. The two
  // statements are independent and both are needed: severity says how loudly the linter
  // speaks, this says whether anybody may refuse a bundle on what it said.
  "attractor/strict-graph": "approval",
  "attractor/undirected-graph": "approval",
  "attractor/multiple-graphs": "approval",
  "attractor/bad-node-id": "approval",
  "attractor/quoted-node-id": "approval",
  "attractor/attr-separator": "approval",
  "attractor/hash-comment": "approval",
  "attractor/unsupported-value": "approval",
  "attractor/reserved-attribute": "approval",
  "attractor/condition-syntax": "approval",

  /* ---------- ontology ---------- */
  // Defects in a vocabulary somebody wrote. They change what the terms mean and therefore
  // what every score computed against them means, which is exactly a scoring concern.
  "ontology/unknown-term": "approval",
  "ontology/cyclic-broader": "approval",
  "ontology/dangling-pointer": "approval",
  "ontology/phase-not-extensible": "approval",
  "ontology/local-term-unrooted": "approval",
  "ontology/local-marker-unweighted": "approval",
  "ontology/local-marker-bad-weight": "approval",
  // The exception in this group, and it is the same rule as the two bump codes above: a
  // vocabulary release declaring less than its diff implies is being stored under a
  // version that does not describe it, and every score recorded against that version then
  // names a vocabulary the reader cannot reconstruct.
  "ontology/version-bump-too-small": "unaddressable",

  /* ---------- analysis ---------- */
  // Rule 4, and it is already true of these six by severity: nothing here is ever an
  // `error`. Saying it again as a classification is not a repetition, it is the statement
  // that makes the severity a consequence rather than the source of truth.
  "analysis/empty-graph": "approval",
  "analysis/unresolved-node": "approval",
  "analysis/criteria-leak-suspected": "approval",
  "analysis/criteria-leak-unanchored": "approval",
  "analysis/criteria-out-of-band": "approval",
  "analysis/criteria-relayed-through-judge": "approval",
});

/**
 * Which classes refuse to hold the bytes at all.
 *
 * Written out rather than expressed as "everything that is not `approval`". That negation
 * was the original derivation and it had a failure mode: a `GateClass` added later joined
 * the storage-blocking set by default, silently widening what the registry refuses. Listing
 * the members means a new class blocks nothing until somebody puts it in a list.
 */
const STORAGE_CLASSES: readonly GateClass[] = Object.freeze([
  "unreadable",
  "unaddressable",
  "author-declared",
]);

/**
 * Which classes refuse a RELEASE while still permitting storage.
 *
 * Owner ruling of 2026-08-30, recorded as D-109: the gate splits by lifecycle stage rather
 * than applying one answer everywhere. A DRAFT is near-unconditional, because an imported
 * foreign pipeline routinely has nodes DarkPrint cannot type and refusing those makes
 * `darkprint import` useless. A RELEASE is what a stranger pins, and a release whose nodes
 * do not all resolve carries a scorecard computed over a graph with a hole in it.
 *
 * The line is REFERENTIAL COMPLETENESS, not correctness, and the distinction is load
 * bearing. A dangling pointer is a fact about the bytes. A port that does not fit, a type
 * that cannot flow, a term nobody has minted: those are DarkPrint comparing two things the
 * author wrote, and rule 4 forbids them from blocking at either stage. They are findings on
 * the scorecard of a published release, which is where a reading belongs.
 */
const RELEASE_ONLY_CLASSES: readonly GateClass[] = Object.freeze(["unresolved-reference"]);

/**
 * The codes that may refuse storage, derived from the classification above.
 *
 * Derived rather than transcribed, for the reason `ATTRACTOR_UNEXPRESSED_ATTRIBUTES` is:
 * a second hand-maintained copy of a list is a list that reports its own drift, eventually,
 * to somebody who no longer knows which copy was right.
 *
 * In `DIAGNOSTIC_GATE` order, which groups them by namespace as the union is written.
 */
export const STORAGE_BLOCKING_CODES: readonly DiagnosticCode[] = Object.freeze(
  (Object.keys(DIAGNOSTIC_GATE) as DiagnosticCode[]).filter((code) =>
    STORAGE_CLASSES.includes(DIAGNOSTIC_GATE[code]),
  ),
);

/**
 * The codes that may refuse a release: everything storage refuses, plus the reference
 * failures a draft is allowed to carry.
 *
 * A superset of `STORAGE_BLOCKING_CODES` by construction, which is the invariant that makes
 * the two stages a ladder rather than two unrelated opinions: nothing storable-but-refused
 * can exist, and `gate.test.ts` holds the containment.
 */
export const RELEASE_BLOCKING_CODES: readonly DiagnosticCode[] = Object.freeze(
  (Object.keys(DIAGNOSTIC_GATE) as DiagnosticCode[]).filter(
    (code) =>
      STORAGE_CLASSES.includes(DIAGNOSTIC_GATE[code]) ||
      RELEASE_ONLY_CLASSES.includes(DIAGNOSTIC_GATE[code]),
  ),
);

/**
 * The single entry rule 3 admits: a refusal the author asked for.
 *
 * Published separately because the two grounds answer to different people. A legibility
 * refusal is DarkPrint saying "I cannot read this"; this one is DarkPrint saying "you told
 * me not to". A surface explaining a refusal has to be able to tell them apart, and a
 * surface arguing that the blocking set is too wide has to be able to see that exactly one
 * member of it is not about bytes.
 */
export const AUTHOR_DECLARED_BLOCKING_CODES: readonly DiagnosticCode[] = Object.freeze(
  (Object.keys(DIAGNOSTIC_GATE) as DiagnosticCode[]).filter(
    (code) => DIAGNOSTIC_GATE[code] === "author-declared",
  ),
);

/**
 * Everything DarkPrint works out for itself rather than reads off the submission.
 *
 * Rule 4's subject, written as its own list and NOT derived from the classification, so
 * that the two can be compared. A derivation would make the disjointness true by
 * construction and prove nothing; two lists written against different questions can
 * disagree, and `gate.test.ts` is the place they are made to agree.
 *
 * The membership test is "would this still be reported if DarkPrint knew nothing but the
 * bytes in front of it". A missing `spec` field is in the document. A criteria leak, a
 * type that cannot flow, an unreachable node, an Attractor rule, a vocabulary defect and
 * every autonomy or security reading are all conclusions drawn from the bytes by walking
 * a graph or consulting a vocabulary, and every one of them is a place where DarkPrint
 * could be wrong about somebody else's work.
 */
export const INFERRED_CODES: readonly DiagnosticCode[] = Object.freeze([
  "dot/self-loop",
  "card/unknown-term",
  "card/deprecated-term",
  "card/wrong-term-kind",
  "card/unknown-phase",
  "card/spec-too-thin",
  "card/prohibition-misfiled",
  "bundle/port-mismatch",
  "bundle/port-ambiguous",
  "bundle/type-mismatch",
  "bundle/undeclared-dependency",
  "bundle/missing-dependency",
  "bundle/no-entry",
  "bundle/no-exit",
  "bundle/unreachable-node",
  "bundle/ontology-mismatch",
  "attractor/strict-graph",
  "attractor/undirected-graph",
  "attractor/multiple-graphs",
  "attractor/bad-node-id",
  "attractor/quoted-node-id",
  "attractor/attr-separator",
  "attractor/hash-comment",
  "attractor/unsupported-value",
  "attractor/reserved-attribute",
  "attractor/condition-syntax",
  "ontology/unknown-term",
  "ontology/cyclic-broader",
  "ontology/dangling-pointer",
  "ontology/phase-not-extensible",
  "ontology/local-term-unrooted",
  "ontology/local-marker-unweighted",
  "ontology/local-marker-bad-weight",
  "analysis/empty-graph",
  "analysis/unresolved-node",
  "analysis/criteria-leak-suspected",
  "analysis/criteria-leak-unanchored",
  "analysis/criteria-out-of-band",
  "analysis/criteria-relayed-through-judge",
]);

const BLOCKING: ReadonlySet<string> = new Set(STORAGE_BLOCKING_CODES);
const RELEASE_BLOCKING: ReadonlySet<string> = new Set(RELEASE_BLOCKING_CODES);

/**
 * The two fields a card's ADDRESS is made of.
 *
 * `card/schema.ts` makes `id@version` the reference a DOT node pins and §4 makes a
 * published version immutable, so these two are what "addressable" means for a card. The
 * other four required fields say what the node does, which is a different question.
 */
export const ADDRESS_FIELDS: readonly string[] = Object.freeze(["id", "version"]);

/**
 * The two codes that answer two questions at once, and the one place this module reads
 * inside a diagnostic instead of only at its code.
 *
 * `card/missing-field` and `card/bad-type` each cover a legibility failure and an ordinary
 * defect. `card/validate.ts` already distinguishes them, in `location.path`: the
 * whole-document case (`A card must be a mapping…`) carries no path, and every field case
 * carries the key it is about. So the distinction is IN the diagnostic and this reads it
 * rather than inventing one.
 *
 * The alternative was to hold both codes on the refusing side, and it is wrong in a way
 * that shows up immediately: `darkprint import` writes a card with an empty `spec` for an
 * Attractor node that carried no `prompt`, deliberately, with a warning naming the node.
 * Refusing that draft would mean DarkPrint cannot hold a legible, addressed, attributed
 * card because one field it needs is still to be written — which is the exact opposite of
 * rule 1.
 */
const FIELD_SCOPED: ReadonlySet<string> = new Set(["card/missing-field", "card/bad-type"]);

/** The ground on which a code refuses storage, or `"approval"` when it does not. */
export function gateClassOf(code: DiagnosticCode): GateClass {
  return DIAGNOSTIC_GATE[code];
}

/**
 * Whether one diagnostic refuses storage.
 *
 * **The code AND the severity, and the pair is the point.** The code says the finding is
 * capable of refusing an artefact; the severity says this particular instance of it is the
 * serious reading rather than the mild one. `card/bad-type` is both — an ERROR for a
 * document that is not a mapping and an INFO for a key the schema does not know — so
 * classifying it as `unreadable` and stopping there would refuse a card for carrying a
 * field written against next year's schema, which `card/validate.ts` deliberately accepts.
 *
 * Severity is therefore still read, and it is now a NARROWING of a named list rather than
 * the list itself. That is the whole change.
 *
 * Two codes are narrowed a second time, by the field they name: see `FIELD_SCOPED`.
 */
export function blocksStorage(d: Diagnostic): boolean {
  return refuses(d, BLOCKING);
}

/**
 * Whether one diagnostic refuses a RELEASE.
 *
 * The same narrowing as `blocksStorage` against the wider list. Deliberately a separate
 * exported function rather than a `stage` parameter on `blocksStorage` with a default: a
 * publish path that forgot to pass the argument would silently get the draft answer and
 * accept a bundle with an unresolved node, and a gate whose loose reading is what you get by
 * forgetting is the same accident this module exists to end. Two names means every call site
 * says which of the two questions it is asking.
 */
export function blocksRelease(d: Diagnostic): boolean {
  return refuses(d, RELEASE_BLOCKING);
}

/** The shared narrowing: named severity, named code, and for two codes a named field. */
function refuses(d: Diagnostic, blocking: ReadonlySet<string>): boolean {
  if (d.severity !== "error" || !blocking.has(d.code)) return false;
  if (!FIELD_SCOPED.has(d.code)) return true;
  /* No path means the whole document is the subject, which is the unreadable case. A path
     means one field is, and only the two that carry the address refuse. */
  const path = d.location?.path;
  return path === undefined || ADDRESS_FIELDS.includes(path);
}

/** Every diagnostic in `ds` that refuses storage, in the order given. */
export function storageBlockers(ds: readonly Diagnostic[]): Diagnostic[] {
  return ds.filter(blocksStorage);
}

/**
 * Whether these bytes may be held at all.
 *
 * Near-unconditional by construction: an empty list is storable, and so is a list of forty
 * findings none of which is one of the twelve named codes at error severity.
 */
export function isStorable(ds: readonly Diagnostic[]): boolean {
  return !ds.some(blocksStorage);
}

/** Every diagnostic in `ds` that refuses a release, in the order given. */
export function releaseBlockers(ds: readonly Diagnostic[]): Diagnostic[] {
  return ds.filter(blocksRelease);
}

/**
 * Whether these bytes may be published as a release somebody else can pin.
 *
 * Stricter than `isStorable` by exactly the reference failures: every node must resolve to
 * a particular card, because the scorecard travels with the release and a score computed
 * over a graph with a hole in it describes a blueprint nobody can rebuild.
 */
export function isReleasable(ds: readonly Diagnostic[]): boolean {
  return !ds.some(blocksRelease);
}
