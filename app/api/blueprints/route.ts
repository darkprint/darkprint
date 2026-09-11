/* ============================================================
   GET /api/blueprints
   The gallery's list. Every response here is B-03's
   envelope at 200; nothing on this route can 404, because "no
   blueprints you may see" is an empty list and not a failure.

   It could 500, and until T081 nothing said so: this handler was
   two lines with no `try`, no `catch` and no wrapper, so a driver
   failure escaped as a raw `DrizzleQueryError` opening with the
   full `select … from "bundle"` (D-13). `withRegistryErrors` is
   the fault path; the success path is unchanged.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { actorFrom, blueprints, withRegistryErrors } from "@/lib/server/registry";

export async function GET(request: Request): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { db } = getSharedDbClient();
    return ok({ blueprints: await blueprints(db, actorFrom(request)) });
  });
}
