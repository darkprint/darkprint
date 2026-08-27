/* ============================================================
   GET /api/names/handles/[handle]
   Published by D-70-03. 200 with the `Availability` payload and
   **no 404**, because "no row holds this name" *is* the available
   answer — a 404 here would report the good case as a failure.

   Nothing else can arrive: `checkHandle` answers rather than
   throwing for a taken name, for a reserved one and for a name
   that is not legal at all, so there is no rejection to map to a
   status. A driver fault still leaves as `NamingStoreError` and
   becomes a 500 through the framework, which is correct — that is
   the registry being unable to answer, not an answer.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { checkHandle } from "@/lib/server/naming";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await params;
  const { db } = getSharedDbClient();
  return ok(await checkHandle(db, handle));
}
