/* ============================================================
   POST /api/validate/dot
   A lone DOT buffer, checked the two ways Attractor checks one:
   `parseDot` for the grammar and `lintAttractor` for the subset
   Attractor will actually run (D-40-13).

   A parse failure is a 200. It is the one rejection whose entire
   complaint is a character position, so the diagnostic carries
   line and column and the caller points at its own source with
   them — a 400 would throw that away and say only "bad request".
   ============================================================ */

import { badRequest, ok } from "@/lib/server/http";
import { validateDot } from "@/lib/server/engine";
import { isRefusal, readObjectBody, readString, withLimits } from "../body";

export async function POST(request: Request): Promise<Response> {
  const parsed = await readObjectBody(request);
  if ("refusal" in parsed) return parsed.refusal;

  const dot = readString(parsed.body, "dot");
  if (isRefusal(dot)) return badRequest(request, dot.detail);

  return withLimits(request, () => ok(validateDot(dot.value)));
}
