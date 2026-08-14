/* ============================================================
   DarkPrint backend — naming: one grammar, derived from the engine
   T070's contract: "Ids must satisfy the engine's grammars
   (`CARD_ID`, `REF_VERSION`, `lib/core/card/schema.ts:167,174`) so
   a stored id is one a DOT node can pin." `CARD_ID` is private to
   that file and `lib/core/**` is not this task's to edit, so the
   grammar is *derived* through `parseCardRef` — the exported
   function that applies it — rather than restated here as a second
   regex beside the truth. A tightening in the engine is a
   tightening here for free, which is the same argument
   `lib/server/cards/constraint.ts` makes about a constraint name.

   Handle, slug and namespace are one shape: a single `CARD_ID`
   segment. A handle is "the author field on every card you
   publish" (`app/settings/page.tsx:258-265`), which is a card id's
   namespace; a slug is a path segment of `/blueprints/{owner}/{slug}`
   (B-09) and every slug in the archive is that shape. Stated here
   because the contract publishes the card-id grammar and leaves the
   other three to be read off it.
   ============================================================ */

import { cardRef, error, parseCardRef, splitTermId, type Diagnostic } from "@/lib/core";

/**
 * Satisfies `REF_VERSION` so the probe reference below parses on its version half
 * and the only thing under test is the id half. Never stored, never returned.
 */
const PROBE_VERSION = "0.0.0";

/**
 * True when `id` is exactly what the engine's own `CARD_ID` accepts.
 *
 * Round-tripped rather than merely parsed. `parseCardRef` trims its argument, so
 * `parseCardRef(cardRef(" solver", v)) !== undefined` is true for an id carrying a
 * leading space — the check would pass a name the caller did not ask for and the
 * store would hold a different string from the one on screen. Comparing the parsed
 * id back against the input is what makes the guard exact rather than approximate.
 */
export function isCardId(id: string): boolean {
  return parseCardRef(cardRef(id, PROBE_VERSION))?.id === id;
}

/**
 * A single `CARD_ID` segment: legal as a card id *and* carrying no namespace.
 *
 * The second half is asked of `splitTermId`, which owns where the separator is,
 * rather than of a `"/"` literal restated here. `splitTermId` reports `namespace`
 * only for a well-formed single separator, and `isCardId` refuses the malformed
 * spellings it hands back whole (`"a/"`, `"a//b"`), so the two together are exactly
 * "one segment".
 */
export function isNameSegment(value: string): boolean {
  return isCardId(value) && splitTermId(value).namespace === undefined;
}

/**
 * `card/bad-id` for both validators, and it is a deliberate reuse rather than a
 * missing code: `DiagnosticCode` is a closed union in `lib/core/diagnostics.ts`,
 * which this task may not edit, and `card/bad-id` is the code the engine itself
 * emits for exactly this grammar (`lib/core/card/validate.ts:163`). Inventing a
 * `naming/*` namespace would mean editing a Forbidden-by-`Owns` file.
 */
const BAD_ID = "card/bad-id";

/** Pure, grammar only. `[]` means the id is one a DOT node can pin. */
export function validateCardId(id: string): Diagnostic[] {
  if (isCardId(id)) return [];
  return [
    error(BAD_ID, `Card id \`${id}\` is not a legal identifier.`, {
      hint: "Use lowercase words joined by single hyphens, optionally namespaced: `berti/solver-a`.",
    }),
  ];
}

/** Pure. A namespace is one segment: the half before the `/` in a namespaced id. */
export function validateNamespace(namespace: string): Diagnostic[] {
  if (isNameSegment(namespace)) return [];
  return [
    error(BAD_ID, `Namespace \`${namespace}\` is not a legal identifier.`, {
      hint: "Use lowercase words joined by single hyphens, with no `/`: `berti`.",
    }),
  ];
}
