/* ============================================================
   POST /api/validate/ontology
   One doc 3 §7 vocabulary document on its own — the `terms:` file
   an author drops in beside a bundle.

   This is the endpoint that answers the question
   `/api/validate/bundle` structurally cannot: `loadBundle` leaves
   vocabulary defects to whoever built the view, and
   `LoadBundleResult` has no field for them, so a bundle submitted
   with a broken overlay is scored against the core and says
   nothing about it. A caller that wants to know asks here.
   ============================================================ */

import { badRequest, ok } from "@/lib/server/http";
import { validateVocabularySource } from "@/lib/server/engine";
import { isRefusal, readObjectBody, readString, withLimits } from "../body";

export async function POST(request: Request): Promise<Response> {
  const parsed = await readObjectBody(request);
  if ("refusal" in parsed) return parsed.refusal;

  const source = readString(parsed.body, "source");
  if (isRefusal(source)) return badRequest(request, source.detail);

  return withLimits(request, () => ok(validateVocabularySource(source.value)));
}
