/* ============================================================
   DarkPrint backend — serveCardSource
   `serveCard`'s bytes, minus B-14's download event. `release-
   files.ts:38-40` states the rule this reuses rather than
   re-derives: "No `recordDownload`. A listing is not a download:
   nothing left, and counting the panel's render would count every
   page view as a file transfer." A card's source rendered inline
   on its own page is the same non-event — nothing left the server
   as a file the reader saved — so this is `serveCard` with the one
   call that makes it a download removed, not a second reader with
   a second opinion about the bytes.

   `serveCard` itself is UNCHANGED (T280's contract): the download
   panel's own fetch of a card still counts, and duplicating the
   read here rather than composing `serveCard` and unwinding its
   side effect is what keeps that route's count intact while this
   one exists beside it.
   ============================================================ */

import { cardRef, type CardRef } from "@/lib/core";
import type { Db } from "@/lib/db";
import { resolveCardRef } from "@/lib/server/cards";
import type { Actor } from "@/lib/server/policy";
import { cardFilePath } from "@/lib/content/bundle-export";
import { contentTypeFor } from "./content-type";
import { readFailed } from "./errors";
import type { ServedFile } from "./types";

/**
 * `undefined` for the same three silences `serveCard` answers with (B-03): a ref that
 * does not parse, one that names no row, one this actor may not read. `path` is built
 * from the stored row's own `(cardId, version)`, never the caller's spelling, for the
 * reason `serveCard` states — `parseCardRef` tolerates surrounding whitespace, and a
 * caller's padding must not reach a filename.
 */
export async function serveCardSource(
  db: Db,
  actor: Actor,
  ref: CardRef,
): Promise<ServedFile | undefined> {
  let record;
  try {
    record = await resolveCardRef(db, actor, ref);
  } catch (err) {
    // D-90-A's consistency half, `serveCard`'s own reasoning: an outage here must answer
    // 500 the same way an outage on the blueprint path does, not the 404 an absent card
    // answers with two lines down.
    throw readFailed(err);
  }
  if (record === undefined) return undefined;

  const path = cardFilePath(cardRef(record.cardId, record.version));
  return {
    path,
    bytes: new TextEncoder().encode(record.source),
    contentType: contentTypeFor(path),
  };
}
