/* ============================================================
   DarkPrint backend — the response envelope, success half
   B-03: a handler returns its payload at 200, including a
   payload that carries `diagnostics: Diagnostic[]` describing a
   failure of the *content* — a bundle resolving with errors is
   an answer, not a transport failure. Nothing here reshapes the
   payload: each route's own type (mirroring `LoadBundleResult`,
   `ResolveResult`, ...) is what a caller actually gets back.
   ============================================================ */

/** Plain 200 JSON. A payload carrying `diagnostics` is still a 200 — see the header. */
export function ok<T>(payload: T, init?: ResponseInit): Response {
  return Response.json(payload, { status: 200, ...init });
}
