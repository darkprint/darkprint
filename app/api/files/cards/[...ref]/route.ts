/* ============================================================
   GET /api/files/cards/[...ref]
   AC5: one card version at an address that names no blueprint.

   A catch-all rather than a single segment, because a card id may
   carry one namespace segment — `CARD_ID` in
   `lib/core/card/schema.ts` admits `berti/memory-probe` — so
   `berti/memory-probe@1.0.0.yaml` arrives as two segments and is
   one ref.

   The `.yaml` suffix is optional and stripped, so the URL
   `cardHref` already prints (`/cards/<ref>.yaml`) and the bare
   ref both work. `curl -O` writes the file under the last segment
   either way; with the suffix that segment is already the filename
   `cardDownloadCommand` promises.
   ============================================================ */

import type { CardRef } from "@/lib/core";
import { serveCard } from "@/lib/server/export";
import { getSharedDbClient } from "@/lib/db";
import { actorFor, respondWithFile } from "@/app/api/files/serve";

export async function GET(
  request: Request,
  context: { params: Promise<{ ref: string[] }> },
): Promise<Response> {
  const { ref } = await context.params;
  const joined = ref.join("/");
  const bare = joined.endsWith(".yaml") ? joined.slice(0, -".yaml".length) : joined;
  const db = getSharedDbClient().db;
  // `serveCard` answers `undefined` for a ref that does not parse, so nothing here has to
  // decide what a ref is — `parseCardRef` is the one reader of that.
  return respondWithFile(request, () => serveCard(db, actorFor(request), bare as CardRef));
}
