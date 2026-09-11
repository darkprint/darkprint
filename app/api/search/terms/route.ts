/* ============================================================
   GET /api/search/terms?q&kind&origin
   The vocabulary's search (D-200-16). `/api/ontology/*` is T080's
   and Forbidden, so this lives under this task's own `Owns`.

   It reads BOTH corpora (D-200-17) — the registry's published
   terms and the local vocabularies public releases declare — which
   is what makes `origin=local` a filter rather than a decoration.
   The public-only rule is applied inside `searchTerms`, at the
   bundle universe, because a local term is not a row with a
   visibility column and inherits its bundle's.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom } from "@/lib/server/registry";
import { searchParams, searchTerms, withSearchErrors } from "@/lib/server/search";

export async function GET(request: Request): Promise<Response> {
  return withSearchErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok(await searchTerms(db, actorFrom(request), searchParams(request.url)));
  });
}
