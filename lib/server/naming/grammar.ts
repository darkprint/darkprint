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
 * The longest name this module will admit, and the reason it exists at all is D-70-13:
 * the grammar bounded the alphabet and not the length, so `checkHandle` answered
 * `available` for a name `allocateHandle` could not store. `handle` is the primary key
 * of `handle_reservation`, and a btree index tuple has a hard ceiling — measured on this
 * server, a random `[a-z0-9-]` handle stores up to **2692** characters and raises
 * SQLSTATE 54000 from 2700 on. That broke this module's own stated invariant, that
 * availability and allocation never disagree, through the one input the grammar did not
 * constrain; and below the ceiling it let a caller mint a **permanent** primary key of
 * any size, since AC4 forbids ever deleting the row.
 *
 * **255 is mine, not the contract's, and it is chosen to be a correctness bound rather
 * than a product opinion.** The measured ceiling is a property of this server's 8 KB
 * page size — `BTMaxItemSize` scales with `BLCKSZ`, so a 4 KB build ceilings near 1300
 * and a 2 KB build near 640. A bound of 255 holds on every page size Postgres supports,
 * which is what makes it a guarantee instead of a reading off one machine. The product
 * bound — a handle is a URL segment and the author field on every published card, and
 * the longest one the archive holds is 11 characters — is still owed by the contract and
 * is reported as D-70-15. One constant changes it.
 *
 * `naming.scratch.test.ts` allocates a name of exactly this length, so the constant
 * cannot be raised past what the store accepts without a red. That test, not this
 * number, is what makes the bound safe.
 */
export const MAX_NAME_LENGTH = 255;

/**
 * A single `CARD_ID` segment: legal as a card id, carrying no namespace, and short
 * enough to store.
 *
 * The namespace half is asked of `splitTermId`, which owns where the separator is,
 * rather than of a `"/"` literal restated here. `splitTermId` reports `namespace`
 * only for a well-formed single separator, and `isCardId` refuses the malformed
 * spellings it hands back whole (`"a/"`, `"a//b"`), so the two together are exactly
 * "one segment".
 *
 * Length is checked **first**, and not only to save work: the alphabet is single-byte
 * ASCII, so a character count is a byte count and there is no encoding step between
 * this bound and the one Postgres applies. Everything this admits, the store accepts.
 */
export function isNameSegment(value: string): boolean {
  return value.length <= MAX_NAME_LENGTH && isCardId(value) && splitTermId(value).namespace === undefined;
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
