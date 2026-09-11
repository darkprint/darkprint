/* ============================================================
   POST /api/validate/card
   One card document on its own. Mirrors `lib/core`'s own
   `CardValidation`: the card comes back only when nothing of
   error severity was reported, and every complaint is a 200.

   Checked against the curated core vocabulary alone, because the
   published surface takes no overlay. A card naming a local term
   therefore reports `card/unknown-term` here, which is the honest
   answer for a card checked on its own — the term is unknown
   until some bundle supplies the file that defines it.
   ============================================================ */

import { badRequest, ok } from "@/lib/server/http";
import { validateCardSource } from "@/lib/server/engine";
import { isRefusal, readObjectBody, readString, withLimits } from "../body";

export async function POST(request: Request): Promise<Response> {
  const parsed = await readObjectBody(request);
  if ("refusal" in parsed) return parsed.refusal;

  const source = readString(parsed.body, "source");
  if (isRefusal(source)) return badRequest(request, source.detail);

  return withLimits(request, () => ok(validateCardSource(source.value)));
}
