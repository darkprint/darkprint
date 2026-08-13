/* ============================================================
   DarkPrint backend — versioning: ontology bump inference
   backend.md T025. An ontology's diff is its term set: removing a
   term or narrowing a `broader` chain is major, adding a term is
   minor. Deprecating a term (doc 3 §6.2's "nothing is ever
   deleted") keeps its id in the set, so it is never a removal.
   ============================================================ */

import type { BumpAnalysis, OntologyTerm } from "@/lib/core";
import { canonicalJson } from "@/lib/core";

import { summarize, type Reason } from "./reasons";

/** First occurrence wins, mirroring lib/core/version/bump.ts's `portsByName`. */
function byId(terms: readonly OntologyTerm[]): Map<string, OntologyTerm> {
  const map = new Map<string, OntologyTerm>();
  for (const term of terms) if (!map.has(term.id)) map.set(term.id, term);
  return map;
}

/**
 * Every ancestor id reachable by following `broader`, in the given snapshot.
 * Cycle-safe the same way `lib/core/ontology/resolve.ts`'s deprecation walk
 * is: a loop stops the walk rather than looping forever. Reporting the cycle
 * itself is `ontology/cyclic-broader`'s job, not this comparison's.
 */
function ancestorsOf(id: string, terms: ReadonlyMap<string, OntologyTerm>): Set<string> {
  const reached = new Set<string>();
  const visited = new Set<string>([id]);
  let current = terms.get(id);
  while (current?.broader !== undefined) {
    const parentId = current.broader;
    if (visited.has(parentId)) break;
    visited.add(parentId);
    reached.add(parentId);
    current = terms.get(parentId);
  }
  return reached;
}

function setDifference(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  return [...a].filter((id) => !b.has(id));
}

/**
 * Which bump an ontology version demands (backend.md T025).
 *
 * MAJOR — a term id present before is absent now, its `kind` changed (it now
 * fills a different structural slot on a card), or a retained term's
 * `broader` chain stopped reaching an ancestor it used to: anything that
 * classified the term under that ancestor (`isA`) stops matching, which is
 * the same "breaks something already published" test the card half uses.
 *
 * MINOR — a new term id, or a retained term's `broader` chain now reaches an
 * ancestor it did not before: that only adds classifications, breaking
 * nothing that matched before.
 *
 * PATCH — anything else on a retained term (label, description, `since`,
 * `defaultWeight`, `impliesHuman`, deprecation) — the safety net that
 * mirrors `lib/core/version/bump.ts`'s "patch otherwise".
 *
 * Deprecating a term never counts as removing it: doc 3 §6.2 keeps a
 * deprecated term's id in the vocabulary, pointed at its successor, and this
 * function only ever looks at which ids are present — never at `deprecated`
 * — to decide major vs. minor. A dangling `deprecated.replacedBy` is
 * `ontology/dangling-pointer`, checked by
 * `lib/core/ontology/resolve.ts`'s `ontologyView(...).validate()`, not this
 * function.
 */
export function inferOntologyBump(
  previous: readonly OntologyTerm[],
  next: readonly OntologyTerm[],
): BumpAnalysis {
  const reasons: Reason[] = [];
  const push = (level: Reason["level"], message: string): void => {
    reasons.push({ level, message });
  };

  const before = byId(previous);
  const after = byId(next);

  for (const [id, term] of before) {
    const updated = after.get(id);
    if (updated === undefined) {
      push("major", `term \`${id}\` was removed`);
      continue;
    }

    let changed = false;
    if (term.kind !== updated.kind) {
      push("major", `term \`${id}\` changed kind: ${term.kind} → ${updated.kind}`);
      changed = true;
    }

    const lost = setDifference(ancestorsOf(id, before), ancestorsOf(id, after));
    const gained = setDifference(ancestorsOf(id, after), ancestorsOf(id, before));
    if (lost.length > 0) {
      push(
        "major",
        `term \`${id}\`'s \`broader\` chain no longer reaches ${lost.map((a) => `\`${a}\``).join(", ")}`,
      );
      changed = true;
    } else if (gained.length > 0) {
      push(
        "minor",
        `term \`${id}\`'s \`broader\` chain now also reaches ${gained.map((a) => `\`${a}\``).join(", ")}`,
      );
      changed = true;
    }

    if (!changed && canonicalJson(term) !== canonicalJson(updated)) {
      push("patch", `term \`${id}\` changed`);
    }
  }

  for (const id of after.keys()) {
    if (!before.has(id)) push("minor", `term \`${id}\` was added`);
  }

  return summarize(reasons);
}
