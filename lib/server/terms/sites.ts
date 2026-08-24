/* ============================================================
   DarkPrint backend — the six reference sites

   A card names a term at six places and the contract enumerates
   them: `phases`, `type`, `riskMarkers`, `tools`, and each port's
   `type` on `inputs` and `outputs`
   (`components/ontology/TermTable.tsx:190-215`). This file is the
   only place in the module that knows the list, so a seventh site
   is one edit rather than three.

   ── Why the id is taken exactly as the card spells it ──
   The shipped index credits the spelling and not its successor:
   a card naming a deprecated term is counted against that term,
   which is the only way the counts can answer "is anybody still
   writing the old spelling?". Resolving `broader` chains here
   would answer a different question and would silently move the
   promotion thresholds.

   ── Why `phases` is in the list ──
   It is a structural field like the others, and leaving it out
   left every one of the five phases reading unused on a page where
   most of the archive declares them. It is spread rather than
   pushed: a card declares zero, one or several, so a card outside
   the five credits none and a card in two credits both. There is
   no bucket for "declared no phase" and there must not be one —
   this index counts terms, and a card that names no phase has
   named no term.

   ── Why every field is guarded ──
   `NodeCard` declares `phases`, `riskMarkers`, `tools`, `inputs`
   and `outputs` non-optional, but the rows these cards come from
   are `card_version.body`, a `jsonb` column nothing validated on
   the way in. `lib/server/registry/snapshot.ts:271` already pays
   for that lesson at one site: a row missing a field would
   otherwise take down every reader rather than its own bucket. An
   index over the whole archive is the worst place to learn it, so
   all six are guarded and a malformed row contributes nothing
   instead of throwing.
   ============================================================ */

import type { NodeCard, Port } from "@/lib/server/types";

/** Term ids off a list-shaped site. A non-array is a malformed row, not a crash. */
function fromList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter(isTermId) : [];
}

/** Term ids off a port list — one `type` each. */
function fromPorts(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((port: Partial<Port> | null | undefined) => port?.type)
    .filter(isTermId);
}

/**
 * A term id has to be a non-empty string to be counted.
 *
 * The empty string is skipped rather than counted as a term nobody can name, which is what
 * `tags()` and the phase buckets already do with a blank entry. It is a real case: `type`
 * is a scalar with no default, so a row written without one reads `""` rather than absent.
 */
function isTermId(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * Every term id one card names, with repeats.
 *
 * Repeats are deliberate: the caller accumulates into sets, so a card naming one term in
 * both `type` and a port's `type` collapses to one card there (AC2) rather than here. A
 * dedup at this level would be a second place for the same rule to live and would hide
 * which sites a term was reached through if that is ever wanted.
 */
export function termIdsOf(card: NodeCard): readonly string[] {
  return [
    ...fromList(card.phases),
    ...(isTermId(card.type) ? [card.type] : []),
    ...fromList(card.riskMarkers),
    ...fromList(card.tools),
    ...fromPorts(card.inputs),
    ...fromPorts(card.outputs),
  ];
}
