/* ============================================================
   DarkPrint core — ontology term resolution
   Lookup, deprecation redirects and subsumption over a layered
   vocabulary: the curated core plus local namespaced extensions.
   Doc 1 §6 (the ontology is the contract, the cards are its
   instances) and doc 3 §7 (namespaces locali), whose three rules
   `validate()` enforces:

     - `phase` is closed and not extensible;
     - a local term must declare `broader` reaching the core,
       because otherwise "l'analisi statica … la ignora
       silenziosamente, che è il peggior esito possibile";
     - a local risk marker with no weight counts 0.

   The first two are errors and the third a warning, which is the
   difference between a term the engine cannot interpret and one it
   interprets as harmless.
   ============================================================ */

import { DARKPRINT_CONFIG } from "../config";
import { error, sortDiagnostics, warning } from "../diagnostics";
import type { Diagnostic } from "../diagnostics";
import type { Ontology, OntologyTerm, TermKind } from "./types";

/**
 * The configured marker weights, read through an index signature that admits `undefined`.
 * `Readonly<Record<string, number>>` claims every string is a key; widening to `Partial`
 * makes a miss type as `undefined` without a cast, so the lookup order of doc 3 §7 can be
 * written as a plain `??` chain.
 */
const CONFIGURED_WEIGHTS: Readonly<Partial<Record<string, number>>> =
  DARKPRINT_CONFIG.security.weights;

/** A term reached by `resolve`, plus how it was reached. */
export interface ResolvedTerm {
  term: OntologyTerm;
  /** The id actually written by the card, before deprecation redirect. */
  requestedId: string;
  /** True when `requestedId !== term.id` because a deprecation pointer was followed. */
  redirected: boolean;
}

/** A vocabulary made queryable — the only shape the rest of the engine reads it through. */
export interface OntologyView {
  readonly ontology: Ontology;
  /** Exact lookup, no redirect. */
  get(id: string): OntologyTerm | undefined;
  /** Lookup following at most one deprecation redirect chain (cycle-safe). */
  resolve(id: string, kind?: TermKind): ResolvedTerm | undefined;
  /** True when `id` is `ancestorId` or transitively `broader` of it. Cycle-safe. */
  isA(id: string, ancestorId: string): boolean;
  /** `id` and all its ancestors, nearest first, including itself. */
  ancestors(id: string): OntologyTerm[];
  /** Direct children. */
  children(id: string): OntologyTerm[];
  /** All terms of a kind, sorted by id. */
  byKind(kind: TermKind): OntologyTerm[];
  /** Structural problems in the vocabulary itself (cycles, dangling broader/replacedBy). */
  validate(): Diagnostic[];
}

const NAMESPACE_SEPARATOR = "/";

/** Code-unit comparison, not `localeCompare` — term order must not depend on the host locale. */
function cmpId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Split a namespaced id: `"berti/memory-risk"` → `{ namespace: "berti", local: "memory-risk" }`,
 * a core id → `{ local: "agent" }` with no `namespace` key at all.
 *
 * The split is structural — it counts separators and does not police the character set
 * (`card/bad-id` owns that). Anything malformed (a leading or trailing separator, or more
 * than one) comes back whole as `local`, so a bad id fails lookup as itself rather than
 * being silently repaired into a different term.
 */
export function splitTermId(id: string): { namespace?: string; local: string } {
  const first = id.indexOf(NAMESPACE_SEPARATOR);
  if (first <= 0 || first === id.length - 1 || first !== id.lastIndexOf(NAMESPACE_SEPARATOR)) {
    return { local: id };
  }
  return { namespace: id.slice(0, first), local: id.slice(first + 1) };
}

/** A vocabulary split by where its terms came from (doc 3 §7). */
export interface TermOrigins {
  /** The curated set: every term whose id carries no namespace. */
  core: OntologyTerm[];
  /** What a local overlay added, in the order the view holds them. */
  local: OntologyTerm[];
}

/**
 * Split a term list into the curated core and the local overlay.
 *
 * A view merges the two and counting it whole gives the size of *this archive's*
 * vocabulary, which is a different number from the size of the vocabulary everybody
 * writes against. `/spec` printed the merged count under the words "the curated core" and
 * so claimed 50 terms and 10 risk markers where the core has 49 and 9, with the tenth
 * being the namespaced term the same page says the core does not contain. The split is
 * here rather than repeated per page so two surfaces cannot answer it differently.
 */
export function partitionTerms(terms: readonly OntologyTerm[]): TermOrigins {
  const core: OntologyTerm[] = [];
  const local: OntologyTerm[] = [];
  for (const term of terms) {
    if (splitTermId(term.id).namespace === undefined) core.push(term);
    else local.push(term);
  }
  return { core, local };
}

/** A term's `broader` chain, memoized: ordered for `ancestors`, set-backed for `isA`. */
interface AncestorChain {
  readonly terms: readonly OntologyTerm[];
  readonly ids: ReadonlySet<string>;
}

/**
 * Build a view over `base`, with `extensions` (the local namespaced terms of §7) layered
 * on top. An extension sharing an id with a base term replaces it in place — the view keeps
 * working, and `validate()` reports the shadowing.
 *
 * The view keeps the *base* version: a local overlay does not mint a new vocabulary version,
 * which is the version every score computed against the merged view is recorded under. It is
 * also what used to let a card declare `ontology_version: 0.1.0` while using local terms,
 * back when a card declared one.
 */
export function ontologyView(base: Ontology, extensions?: readonly OntologyTerm[]): OntologyView {
  /* ---------- merge (§7) ---------- */
  const terms: OntologyTerm[] = [];
  const slotById = new Map<string, number>();

  function put(term: OntologyTerm): void {
    const slot = slotById.get(term.id);
    if (slot === undefined) {
      slotById.set(term.id, terms.length);
      terms.push(term);
    } else {
      // Later wins, in place, so an override keeps the position of the term it shadows
      // and the vocabulary's reading order stays stable.
      terms[slot] = term;
    }
  }

  for (const term of base.terms) put(term);

  const baseIds = new Set(slotById.keys());
  /** Extension ids that shadow a curated core term — reported by `validate()`. */
  const shadowed: string[] = [];
  /**
   * Ids contributed by `extensions`, first-seen order, deduplicated. These are the terms
   * doc 3 §7's rules apply to: a term is "local" because it arrived through the extension
   * channel, not because of how its id is spelled. The term in force for each id is
   * whatever `byId` ends up holding, so a duplicated id is judged once, on its last spelling.
   */
  const localIds: string[] = [];
  const seenLocal = new Set<string>();
  for (const term of extensions ?? []) {
    // Duplicates *within* `extensions` simply take the last; only collisions with the
    // curated core are worth telling the author about.
    if (baseIds.has(term.id) && !shadowed.includes(term.id)) shadowed.push(term.id);
    if (!seenLocal.has(term.id)) {
      seenLocal.add(term.id);
      localIds.push(term.id);
    }
    put(term);
  }

  /* ---------- indexes ---------- */
  const byId = new Map<string, OntologyTerm>();
  for (const term of terms) byId.set(term.id, term);

  const childrenById = new Map<string, OntologyTerm[]>();
  const termsByKind = new Map<TermKind, OntologyTerm[]>();
  for (const term of terms) {
    if (term.broader !== undefined) {
      const siblings = childrenById.get(term.broader);
      if (siblings === undefined) childrenById.set(term.broader, [term]);
      else siblings.push(term);
    }
    const ofKind = termsByKind.get(term.kind);
    if (ofKind === undefined) termsByKind.set(term.kind, [term]);
    else ofKind.push(term);
  }
  for (const ofKind of termsByKind.values()) ofKind.sort((a, b) => cmpId(a.id, b.id));

  const merged: Ontology = Object.freeze({
    version: base.version,
    title: base.title,
    terms: Object.freeze(terms.slice()),
  });

  /* ---------- subsumption ---------- */
  // Memoized per id. Mutating this cache is the view's only internal state; every method
  // stays pure as seen from outside, since the cache is a function of the merged terms.
  const chains = new Map<string, AncestorChain>();

  function chainOf(id: string): AncestorChain {
    const cached = chains.get(id);
    if (cached !== undefined) return cached;
    const walked: OntologyTerm[] = [];
    const ids = new Set<string>();
    let cursor = byId.get(id);
    // `ids` doubles as the visited guard, so a `broader` cycle walks each member once
    // and stops instead of looping for ever.
    while (cursor !== undefined && !ids.has(cursor.id)) {
      walked.push(cursor);
      ids.add(cursor.id);
      cursor = cursor.broader === undefined ? undefined : byId.get(cursor.broader);
    }
    const chain: AncestorChain = { terms: walked, ids };
    chains.set(id, chain);
    return chain;
  }

  /* ---------- local extensions (doc 3 §7) ---------- */
  /** Memo for `isRootedInCore`, filled a whole chain at a time. */
  const rootedInCore = new Map<string, boolean>();

  /**
   * True when `id`'s `broader` chain reaches a term the *base* vocabulary defines.
   *
   * The walk starts at the term itself, so an extension that overrides a core id counts as
   * rooted: it redefines something the core already names — reported on its own as
   * shadowing — rather than introducing a term floating free of the vocabulary. A chain
   * that dangles or loops simply stops without meeting a core id, which is the right
   * answer: nothing in the core subsumes it.
   *
   * `broader` is functional, so every term on one walk shares the same tail and therefore
   * the same answer; the whole path is memoized at once, which keeps validating a stack of
   * n extensions linear in n rather than quadratic.
   */
  function isRootedInCore(id: string): boolean {
    const cached = rootedInCore.get(id);
    if (cached !== undefined) return cached;

    const path: string[] = [];
    const onPath = new Set<string>();
    let answer = false;
    let cursor = byId.get(id);
    // `onPath` doubles as the cycle guard: a `broader` loop that never meets the core is
    // unrooted, and stopping is the answer rather than an error to raise here.
    while (cursor !== undefined && !onPath.has(cursor.id)) {
      const memo = rootedInCore.get(cursor.id);
      if (memo !== undefined) {
        answer = memo;
        break;
      }
      if (baseIds.has(cursor.id)) {
        answer = true;
        break;
      }
      onPath.add(cursor.id);
      path.push(cursor.id);
      cursor = cursor.broader === undefined ? undefined : byId.get(cursor.broader);
    }

    for (const walked of path) rootedInCore.set(walked, answer);
    return answer;
  }

  /**
   * The weight a risk marker carries before the fallback, following the lookup order doc 3
   * §7 implies and `security` implements: the deployment's configured weights first, then
   * the term's own `defaultWeight`. `undefined` means nobody declared one anywhere, and the
   * marker is worth `security.unknownMarkerWeight`.
   *
   * The config is consulted, not just the term, because a deployment that weights a local
   * marker in `security.weights` has declared a weight for it — warning there would be a
   * false alarm about a marker that does move the score. A declared `0` is a choice and
   * passes: `??` only falls through on `undefined`.
   */
  function declaredWeight(term: OntologyTerm): number | undefined {
    return CONFIGURED_WEIGHTS[term.id] ?? term.defaultWeight;
  }

  /* ---------- deprecation ---------- */
  function resolveTerm(id: string, kind?: TermKind): ResolvedTerm | undefined {
    const start = byId.get(id);
    if (start === undefined) return undefined;
    // The kind filter is applied to the term as written: a redirect never changes kind in
    // a well-formed vocabulary, and asking for the wrong kind is a question about the id
    // the card actually spells.
    if (kind !== undefined && start.kind !== kind) return undefined;

    let current = start;
    const seen = new Set<string>([start.id]);
    for (;;) {
      const next = current.deprecated?.replacedBy;
      if (next === undefined) break;
      const target = byId.get(next);
      // A redirect that dangles or crosses kinds is not followed: a deprecated term stays
      // valid (§6.2), so stopping at the last real term beats resolving to nothing.
      if (target === undefined || target.kind !== start.kind) break;
      // A loop has no canonical successor, so fall back to the term that was asked for
      // rather than to whichever member the walk happened to stop on.
      if (seen.has(target.id)) return { term: start, requestedId: id, redirected: false };
      seen.add(target.id);
      current = target;
    }
    return { term: current, requestedId: id, redirected: current.id !== id };
  }

  /* ---------- structural validation ---------- */
  /** Rotate to start at the smallest id so the message is the same wherever the walk began. */
  function canonicalCycle(members: readonly string[]): string[] {
    let pivot = 0;
    for (let i = 1; i < members.length; i += 1) {
      if (cmpId(members[i], members[pivot]) < 0) pivot = i;
    }
    return [...members.slice(pivot), ...members.slice(0, pivot)];
  }

  function validate(): Diagnostic[] {
    const out: Diagnostic[] = [];

    for (const term of terms) {
      if (term.broader !== undefined && !byId.has(term.broader)) {
        out.push(
          error(
            "ontology/dangling-pointer",
            `Term \`${term.id}\` declares \`broader\` \`${term.broader}\`, which is not a term in this vocabulary.`,
            { hint: `Add \`${term.broader}\`, or re-parent \`${term.id}\` onto a term that exists.` },
          ),
        );
      }
      const replacedBy = term.deprecated?.replacedBy;
      if (replacedBy !== undefined && !byId.has(replacedBy)) {
        out.push(
          error(
            "ontology/dangling-pointer",
            `Deprecated term \`${term.id}\` is replaced by \`${replacedBy}\`, which is not a term in this vocabulary.`,
            { hint: `Add \`${replacedBy}\`, or drop \`replacedBy\` and leave \`${term.id}\` deprecated without a successor.` },
          ),
        );
      }
    }

    // `broader` is a functional graph (one parent at most), so a plain walk finds every
    // cycle; `settled` keeps each one reported once however many terms lead into it.
    const settled = new Set<string>();
    for (const start of terms) {
      if (settled.has(start.id)) continue;
      const path: string[] = [];
      const seenAt = new Map<string, number>();
      let cursor: OntologyTerm | undefined = start;
      while (cursor !== undefined && !settled.has(cursor.id)) {
        const at = seenAt.get(cursor.id);
        if (at !== undefined) {
          const cycle = canonicalCycle(path.slice(at));
          out.push(
            error(
              "ontology/cyclic-broader",
              `Term \`${cycle[0]}\` is its own ancestor: ${[...cycle, cycle[0]].map((id) => `\`${id}\``).join(" → ")}.`,
              { hint: "Break the loop, one term in a `broader` chain must have no parent." },
            ),
          );
          break;
        }
        seenAt.set(cursor.id, path.length);
        path.push(cursor.id);
        cursor = cursor.broader === undefined ? undefined : byId.get(cursor.broader);
      }
      for (const id of path) settled.add(id);
    }

    /* ---- doc 3 §7, the three rules on local terms ---- */
    for (const id of localIds) {
      const term = byId.get(id);
      // Every local id was `put` into the merged map, so this cannot miss; the guard is
      // here to keep the lookup total rather than to assert a non-null.
      if (term === undefined) continue;

      if (term.kind === "phase") {
        // Doc 3 §7: "Non estendibile: `phase`. Le cinque fasi sono chiuse." The check is on
        // the *kind*, not on whether the id happens to be namespaced: an extension is a
        // local extension however its author spelled it, and a bare new phase would extend
        // the closed set just as much as a namespaced one.
        out.push(
          error(
            "ontology/phase-not-extensible",
            `Local term \`${term.id}\` is of kind \`phase\`, and the five phases are a closed set.`,
            {
              hint: "Doc 3 §2 fixes them at `planning`, `implementation`, `testing`, `debugging` and `deployment`; express the distinction as a `node-type` or a `risk-marker`, the two extensible dimensions.",
            },
          ),
        );
        // No rootedness check on a rejected phase: the phases are flat and parentless, so
        // there is no core phase to descend from, and a second error would only describe a
        // consequence of the first.
        continue;
      }

      if (!isRootedInCore(term.id)) {
        out.push(
          error(
            "ontology/local-term-unrooted",
            term.broader === undefined
              ? `Local term \`${term.id}\` declares no \`broader\`, so no term of the curated core subsumes it.`
              : `Local term \`${term.id}\` declares \`broader\` \`${term.broader}\`, which leads to no term of the curated core.`,
            {
              hint: `Point \`${term.id}\` at the core term it specialises, directly or through another local term. Doc 3 §7: a term the core does not subsume is ignored silently by every analysis, "che è il peggior esito possibile".`,
            },
          ),
        );
      }

      if (term.kind === "risk-marker") {
        const weight = declaredWeight(term);
        if (weight === undefined) {
          // A warning, not an error: doc 3 §7 gives this case a defined outcome ("vale 0 e non
          // incide"), so the vocabulary is usable — the author has just published a marker
          // that documents a risk without pricing it.
          out.push(
            warning(
              "ontology/local-marker-unweighted",
              `Local risk marker \`${term.id}\` declares no weight, so it counts ${DARKPRINT_CONFIG.security.unknownMarkerWeight} and does not move the security score.`,
              {
                hint: `Set \`defaultWeight\` on \`${term.id}\`, or give it an entry in the DarkPrint config's \`security.weights\`, for the marker to affect the score.`,
              },
            ),
          );
        } else if (!Number.isFinite(weight) || weight < 0) {
          // Doc 3 §5's score is `4 − Σ(pesi)`, so a negative weight does not make a marker
          // cheap — it makes it a *credit*, and `berti/bonus: -2` on the same node as
          // `arbitrary-code-execution` would hand a node that runs arbitrary code the top
          // security level. Doc 3 §7 says an unpriced marker counts 0 and leaves a negative
          // one unspecified; this is the decision, made loudly. A warning rather than an
          // error, for the same reason as the case above: the outcome is defined (the
          // analyzer counts it 0, see `usableWeight` in `analysis/security.ts`), so the
          // vocabulary still works — it just does not do what its author wrote.
          out.push(
            warning(
              "ontology/local-marker-bad-weight",
              `Local risk marker \`${term.id}\` declares a weight of ${weight}, which is not a cost, so it counts ${DARKPRINT_CONFIG.security.unknownMarkerWeight} instead.`,
              {
                hint: `Give \`${term.id}\` a weight of 0 or more. Doc 3 §5 subtracts every marker's weight from a starting score of 4, so a negative weight would add points back and let a local term cancel a core one.`,
              },
            ),
          );
        }
      }
    }

    for (const id of shadowed) {
      // Judgement call: none of the `ontology/*` codes fits a shadowed term — they name
      // structural defects, and an override is a deliberate divergence from the curated
      // core, which is exactly what `bundle/ontology-mismatch` says.
      out.push(
        warning(
          "bundle/ontology-mismatch",
          `Local term \`${id}\` overrides the core term with the same id.`,
          { hint: `Publish it under a namespace ("your-name/${splitTermId(id).local}") so the curated core keeps its meaning.` },
        ),
      );
    }

    return sortDiagnostics(out);
  }

  return {
    ontology: merged,
    get(id: string): OntologyTerm | undefined {
      return byId.get(id);
    },
    resolve: resolveTerm,
    isA(id: string, ancestorId: string): boolean {
      // Reflexive by identity, before any lookup: `isA(x, x)` holds even for an id this
      // view has never heard of, so callers need no special case for unknown terms.
      if (id === ancestorId) return true;
      return chainOf(id).ids.has(ancestorId);
    },
    ancestors(id: string): OntologyTerm[] {
      // Copies out of the cache: the return type is mutable and callers may sort it.
      return chainOf(id).terms.slice();
    },
    children(id: string): OntologyTerm[] {
      const found = childrenById.get(id);
      return found === undefined ? [] : found.slice();
    },
    byKind(kind: TermKind): OntologyTerm[] {
      const found = termsByKind.get(kind);
      return found === undefined ? [] : found.slice();
    },
    validate,
  };
}

/* ============================================================
   Who acts at a node — the one answer, in one place
   ------------------------------------------------------------
   A card used to say twice whether a person acts at its node:
   once as `type`, once as a `requires_human` boolean beside it.
   Nothing held the two together in the direction that mattered,
   so `type: human-gate` with `requires_human: false` was a
   document the archive would load, the schematic would draw with
   a person on it, and the autonomy reading would count as
   unattended. Two surfaces of the same page, disagreeing, with
   no diagnostic between them.

   The field is gone and `type` is the whole answer. This is
   where that answer is computed, and every reader of it —
   `card/validate.ts`, `analysis/autonomy.ts`, the node shelf,
   the profile shelves, the search facet — calls in here rather
   than testing the category itself. A second implementation is
   a second source of truth wearing a different name, which is
   the defect this replaced.

   Membership is `isA(type, "human-in-the-loop")` and nothing
   else (doc 3 §6). `impliesHuman` is deliberately NOT a second
   membership rule: it only picks the most specific term to cite
   inside a chain that already qualifies. A local type carrying
   the flag but rooted outside the category is not a human node,
   because two independent ways to be "human" would defeat the
   point of having the category at all.
   ============================================================ */

/** Doc 3 §3's abstract category, and the only membership test performed on a `type`. */
export const HUMAN_IN_THE_LOOP = "human-in-the-loop";

/** The term to name as the reason a node is staffed, and how the declared type reaches it. */
export interface HumanCitation {
  term: string;
  /** `self` — the type itself; `broader` — an ancestor; `deprecation` — its successor. */
  via: "self" | "broader" | "deprecation";
}

/**
 * Whether this `node-type` puts a person in the loop, and which term says so.
 *
 * `undefined` is the complete answer for a type that does not: a node runs unattended
 * because nothing in its type asks for a person, not because a second field said so.
 */
export function humanCitation(ontology: OntologyView, type: string): HumanCitation | undefined {
  const own = citationWithin(ontology, type);
  if (own !== undefined) return own;

  // Doc 1 §6.2: a deprecated term stays valid, and it may predate the category its
  // successor sits under, so follow the redirect once before concluding otherwise.
  const resolved = ontology.resolve(type, "node-type");
  if (resolved === undefined || resolved.term.id === type) return undefined;
  if (citationWithin(ontology, resolved.term.id) === undefined) return undefined;
  // The successor is cited rather than the ancestor that carries the flag: "superseded by
  // human-gate" is true, "superseded by human-in-the-loop" would not be.
  return { term: resolved.term.id, via: "deprecation" };
}

/**
 * True when a person acts at a node of this type.
 *
 * The derived reading of what `requires_human` used to store, and the only one. A caller
 * with no vocabulary cannot ask this question, which is why it takes a view rather than
 * defaulting to `false` on an absent one: "nobody is here" and "nothing could tell me" are
 * different answers and a surface has to be able to draw them differently.
 */
export function requiresHuman(ontology: OntologyView, type: string): boolean {
  return humanCitation(ontology, type) !== undefined;
}

/** The citation for a type taken as written, or `undefined` when it is not in the category. */
function citationWithin(ontology: OntologyView, id: string): HumanCitation | undefined {
  if (!ontology.isA(id, HUMAN_IN_THE_LOOP)) return undefined;
  for (const term of ontology.ancestors(id)) {
    if (term.impliesHuman === true) {
      return { term: term.id, via: term.id === id ? "self" : "broader" };
    }
  }
  // Reached by a term that sits under the category without repeating the flag — and by
  // the category itself, which `isA` answers reflexively even if the view has never
  // heard of it, so this branch never depends on the term object existing.
  return { term: HUMAN_IN_THE_LOOP, via: id === HUMAN_IN_THE_LOOP ? "self" : "broader" };
}

/* ============================================================
   What a node decides — the graph's control points
   ------------------------------------------------------------
   The autonomy reading used to be one headcount: the share of
   nodes nobody stands in. A headcount weighs every node the same,
   so it cannot tell a graph whose six branches all run alone from
   a graph with one node in it, and it has no way at all to say
   that a `manager-loop` decides whether the rest of the graph
   runs a second time. Who does the work and who decides what work
   happens are two questions, and one fraction was answering only
   the first.

   A *control point* is a node whose type decides whether and how
   other nodes run. Three families qualify and they do not share a
   parent: `evaluative` (a verdict the graph branches on),
   `orchestration` (how many copies of a step exist, when they
   converge, whether the run repeats), and `human-gate`, whose
   definition in doc 3 §3 is that a person approves or rejects.

   Membership is therefore the inherited `governsFlow` flag rather
   than an `isA` test. `human-gate` is the reason: `broader` holds
   one parent and its parent is already `human-in-the-loop`, so no
   single ancestor contains the set. This is the mirror image of
   the section above, where a category does exist and `isA` is the
   whole rule — and it is the one place in this file where a flag
   decides membership, which is why it is stated here rather than
   left to be inferred from the call site.
   ============================================================ */

/** The term to name as the reason a node decides, and how the declared type reaches it. */
export interface ControlCitation {
  term: string;
  /** `self` — the type itself; `broader` — an ancestor; `deprecation` — its successor. */
  via: "self" | "broader" | "deprecation";
}

/**
 * Whether this `node-type` decides whether and how other nodes run, and which term says so.
 *
 * `undefined` is the complete answer for a type that does not: an agent that writes code
 * shapes nothing about the run around it, however much of the run's value it produces.
 */
export function controlCitation(
  ontology: OntologyView,
  type: string,
): ControlCitation | undefined {
  const own = controlWithin(ontology, type);
  if (own !== undefined) return own;

  // Doc 1 §6.2, exactly as `humanCitation` reads it: a deprecated term stays valid and may
  // predate the branch its successor sits under, so follow the redirect once before
  // concluding the node decides nothing.
  const resolved = ontology.resolve(type, "node-type");
  if (resolved === undefined || resolved.term.id === type) return undefined;
  if (controlWithin(ontology, resolved.term.id) === undefined) return undefined;
  return { term: resolved.term.id, via: "deprecation" };
}

/** True when a node of this type is one of the graph's control points. */
export function isControlPoint(ontology: OntologyView, type: string): boolean {
  return controlCitation(ontology, type) !== undefined;
}

/**
 * The citation for a type taken as written, or `undefined` when nothing in its chain
 * governs the flow.
 *
 * Nearest first, so a local type rooted at `decision` cites `decision` and not
 * `evaluative`: "a kind of decision" is the specific thing that is true, the way
 * `citationWithin` prefers `human-gate` over the category above it.
 */
function controlWithin(ontology: OntologyView, id: string): ControlCitation | undefined {
  for (const term of ontology.ancestors(id)) {
    if (term.governsFlow === true) {
      return { term: term.id, via: term.id === id ? "self" : "broader" };
    }
  }
  return undefined;
}
