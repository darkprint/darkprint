/* ============================================================
   DarkPrint backend — serveCard
   AC5: a card resolves at an address of its own, naming no
   blueprint. `cardHref` says why — a card's copy inside a bundle
   is reachable only through the blueprint that pins it, which is
   the wrong address for a page about the card: it would print a
   slug the reader did not ask about and 404 the day that
   blueprint left the archive.

   The bytes are the same document, not a second one. This serves
   `card_version.source`, which is the verbatim YAML T020 archived
   and the same string `exportBundle` puts in a folder.
   ============================================================ */

import { cardRef, type CardRef } from "@/lib/core";
import type { Db } from "@/lib/db";
import { resolveCardRef } from "@/lib/server/cards";
import type { Actor } from "@/lib/server/policy";
import { cardFilePath } from "@/lib/content/bundle-export";
import { contentTypeFor } from "./content-type";
import { recordDownload } from "./downloads";
import type { ServedFile } from "./types";

/**
 * `undefined` for a ref that does not parse, that names no row, or that this actor may
 * not read — B-07's private card, which is invisible rather than forbidden (B-03).
 *
 * There is no throwing path here: `serveFile`'s refusal exists because a release resolved
 * and a *file within it* did not, and a card ref names one document with nothing inside
 * it to miss.
 *
 * `path` is `cards/<id>@<version>.yaml`, built from the stored row's own id and version
 * rather than from the caller's spelling — `parseCardRef` tolerates surrounding
 * whitespace, so the ref that came in and the ref the archive holds can differ by
 * characters that must not reach a filename.
 */
export async function serveCard(db: Db, actor: Actor, ref: CardRef): Promise<ServedFile | undefined> {
  const record = await resolveCardRef(db, actor, ref);
  if (record === undefined) return undefined;

  const path = cardFilePath(cardRef(record.cardId, record.version));
  const served: ServedFile = {
    path,
    bytes: new TextEncoder().encode(record.source),
    contentType: contentTypeFor(path),
  };

  // Per bare `cardId`, never `id@version`: B-10 aggregates card counters per id, so two
  // versions of one card are two downloads of that card.
  await recordDownload(db, { kind: "card", refId: record.cardId });
  return served;
}
