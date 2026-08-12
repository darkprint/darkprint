/* ============================================================
   DarkPrint core — content addressing
   Design doc §4: every card version is identified by the hash of
   its content, so the identifier itself proves the content has
   not changed and two identical cards deduplicate for free.
   Engine spec §6.
   ============================================================ */

import type { NodeCard } from "../card/schema";
import { canonicalJson } from "./canonical";
import { sha256Hex } from "./sha256";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-39) (cited at line 44): folded into SEAM-30; must be recomputed server-side at publish

/** The only algorithm in use; kept as a prefix so a future one can coexist. */
const ALGORITHM = "sha256";

/** Hex characters kept by `shortDigest` — enough to read aloud, not enough to trust. */
const SHORT_LENGTH = 8;

/**
 * Fields excluded from a card's identity. Both are provenance metadata: who typed
 * the file and where it came from say nothing about what the node *does*, and if
 * they counted, the same card contributed by two authors would fail to dedup (§4).
 * Everything else is included, `version` and `ontologyVersion` among them.
 */
const VOLATILE_FIELDS: readonly (keyof NodeCard)[] = ["author", "provenance"];

/** Code-unit order — the digest must not depend on the host locale. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function digestOf(canonical: string): string {
  return `${ALGORITHM}:${sha256Hex(canonical)}`;
}

/**
 * "sha256:<64 hex>" over the canonical JSON of the card, minus `author` and
 * `provenance`. Two cards that describe the same node collapse onto the same
 * digest however their YAML happened to order its keys.
 *
 * Assumes a validated card: `params` holding a non-finite number is rejected by
 * `validateCard`, and reaching here with one throws out of `canonicalJson`.
 */
export function cardDigest(card: NodeCard): string {
  // Spread rather than list the fields: a field added to NodeCard later joins the
  // identity automatically, which is the safe default for an integrity hash.
  const payload: Record<string, unknown> = { ...card };
  for (const field of VOLATILE_FIELDS) delete payload[field];
  return digestOf(canonicalJson(payload));
}

/**
 * Digest of a whole bundle: the DOT source plus the digests of the cards it pins.
 * The card digests are sorted, so the order files arrived in cannot change the
 * result — but they are not deduplicated, because pinning the same card twice is
 * a different bundle from pinning it once.
 */
export function bundleDigest(input: { dot: string; cardDigests: readonly string[] }): string {
  const cardDigests = input.cardDigests.slice().sort(byCodeUnit);
  return digestOf(canonicalJson({ cardDigests, dot: input.dot }));
}

/**
 * Display form: "sha256:ab12cd34". Purely cosmetic — never compare two short
 * digests to decide that two things are the same. Tolerates any input shape so a
 * UI can render whatever it was handed.
 */
export function shortDigest(digest: string): string {
  const colon = digest.indexOf(":");
  if (colon === -1) return digest.slice(0, SHORT_LENGTH);
  return digest.slice(0, colon + 1 + SHORT_LENGTH);
}
