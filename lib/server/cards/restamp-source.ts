/* ============================================================
   DarkPrint backend — restamping a stored card document
   `card_version.source` is the verbatim bytes of the card's own
   file, and it is not decoration: `/api/files/cards/**` serves it,
   the CLI validates the folder it lands in, and an export writes
   it back out. A copy of a card whose `source` still declares the
   ORIGINAL id is a row whose document contradicts the row — the
   downloader gets `id: planner` inside `forker/planner@1.0.0`, and
   `darkprint validate` reports the mismatch as the caller's fault.

   So a rewrite touches the keys the stamp carries and nothing
   else: a fork (`forkCard`) stamps `id`, `author` and `provenance`,
   and a card published on its own (`publishCard`) stamps `id`
   alone. Everything else is the author's file, including their
   comments, their blank lines and their quoting.

   ── why the yaml Document API and not a re-emitter ──
   Re-emitting from the parsed `NodeCard` is the obvious move and
   it is lossy in both directions: `lib/core/attractor/import.ts`'s
   `cardDocument` writes `inputs: []` and `outputs: []` as
   literals, drops every port description, and normalises every
   scalar to JSON — which is right for a document compiled from a
   pipeline and wrong for one somebody wrote. `yaml`'s
   `parseDocument` keeps the original tokens for the nodes nobody
   touched, so a `doc.set` on the stamped keys is the smallest edit
   that can be made to the file at all.

   ── why the result is checked before it is returned ──
   "Only the stamped keys moved" is a property of the OUTPUT, so
   the way to know it is to read the output back: parse the
   restamped text, compare it against the parse of the original
   with the stamped keys held aside, and refuse the rewrite if
   anything else moved. A silent reformat that dropped a key would
   otherwise reach the store as a card missing a field, and the
   failure would surface three layers away in a renderer, which is
   exactly the shape `stored-card.ts` exists to end.

   **That comparison is a guard on the WRITER, and no fixture in
   this repository makes it fire — stated here rather than left to
   be mistaken for coverage.** It was probed with the documents
   that plausibly survive a round trip differently: a merge key, an
   anchor and its alias, a `!!binary` scalar, a timestamp. All four
   come back equal, because `yaml` re-emits the nodes it was not
   asked to touch. What it is FOR is the day that stops being true
   — a library upgrade that reflows, a `doc.set` that replaces a
   parent rather than a key — and on that day this returns
   `undefined` and both callers, `forkCard` and `publishCard`,
   refuse, instead of storing a document that no longer says what
   the row says. `restamp-source.test.ts`
   covers the arms that can be driven and says which one cannot.
   ============================================================ */

import { isMap, parseDocument as parseYamlDocument } from "yaml";
import { canonicalJson, parseDocument } from "@/lib/core";

/**
 * The keys a rewrite may own. A fork stamps all three; a card published on its own stamps
 * `id` alone, because the namespace is the publisher's handle and the author's other two
 * keys are theirs to keep. Every other key in the document belongs to whoever wrote it.
 */
export interface CardSourceStamp {
  id: string;
  author?: string;
  provenance?: string;
}

/**
 * `source` with the keys present in `stamp` set to its values, or `undefined` when the
 * document cannot take the edit.
 *
 * `undefined` for a source that does not parse, that is not a mapping at the top level, and
 * for a rewrite whose re-parse disagrees with the original anywhere but the stamped keys.
 * The caller decides what an unrewritable document means for its own surface —
 * `storedCard`'s rule, for the same reason: a row this old is not an exception to raise in
 * whatever function happens to be running.
 *
 * The comparison is over the PARSED values, not the bytes. Byte equality is not the property
 * anyone needs and the `yaml` writer does not promise it; what a reader of the fork needs is
 * that the document still says what it said.
 */
export function restampCardSource(source: string, stamp: CardSourceStamp): string | undefined {
  const doc = parseYamlDocument(source);
  if (doc.errors.length > 0) return undefined;
  if (!isMap(doc.contents)) return undefined;

  const stamped = stampedKeys(stamp);
  for (const key of stamped) doc.set(key, stamp[key]);
  const rewritten = doc.toString();

  return unchangedApartFromStamp(source, rewritten, stamp, stamped) ? rewritten : undefined;
}

/**
 * The keys this stamp actually carries, in a fixed order. Only these are held aside in the
 * comparison below: a key the caller did not stamp is compared like any other, so an
 * unstamped `provenance` that moved is still a rewrite this function refuses.
 */
function stampedKeys(stamp: CardSourceStamp): readonly (keyof CardSourceStamp)[] {
  const keys: (keyof CardSourceStamp)[] = ["id"];
  if (stamp.author !== undefined) keys.push("author");
  if (stamp.provenance !== undefined) keys.push("provenance");
  return keys;
}

function withoutStamp(value: Record<string, unknown>, stamped: readonly (keyof CardSourceStamp)[]): string {
  const rest: Record<string, unknown> = { ...value };
  for (const key of stamped) delete rest[key];
  return canonicalJson(rest);
}

/**
 * Whether `rewritten` says exactly what `source` said, plus the stamp.
 *
 * `parseDocument` is `lib/core`'s, so this reads the text the way every other reader of a
 * card document in this repository reads it, rather than the way the writer just wrote it.
 */
function unchangedApartFromStamp(
  source: string,
  rewritten: string,
  stamp: CardSourceStamp,
  stamped: readonly (keyof CardSourceStamp)[],
): boolean {
  const before = parseDocument(source, "yaml").value;
  const after = parseDocument(rewritten, "yaml").value;
  if (!isPlainObject(before) || !isPlainObject(after)) return false;
  for (const key of stamped) {
    if (after[key] !== stamp[key]) return false;
  }
  try {
    return withoutStamp(before, stamped) === withoutStamp(after, stamped);
  } catch {
    /* `canonicalJson` throws on a value with no JSON form — a non-finite number in `params`,
       which `validateCard` refuses but a stored row can still hold. Unrewritable rather than
       silently equal: an incomparable document is one this function cannot make a claim about. */
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
