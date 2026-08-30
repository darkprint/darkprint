/* ============================================================
   Shared request handling for the four /api/validate routes
   Not a route: `route.ts` is the only reserved filename in a
   segment, so a helper may live beside one.

   The whole of B-03 for this tree is in two rules, and they are
   easy to conflate because both refuse:

     - the REQUEST is malformed  -> 400 problem+json
     - the CONTENT is wrong      -> 200 with diagnostics

   A DOT that does not parse, a card missing a field, a term with
   a dangling `broader` — all 200. The engine was able to answer
   and the answer is a list of complaints. Only a body that is not
   the shape the endpoint accepts is a transport failure, because
   there is nothing to run the engine on.

   The third case is the one rejection the engine throws rather
   than reports, and it is transport too: a submission too large
   to look at got no answer either.
   ============================================================ */

import { badRequest, problem } from "@/lib/server/http";
import { LimitExceededError } from "@/lib/server/engine";

/**
 * 413 for an over-limit submission (D-40-02).
 *
 * `lib/server/http` publishes no 413 helper, so this is the generic `problem()` with the
 * type URI the contract names. The base is spelled out because `problem.ts` keeps
 * `PROBLEM_TYPE_BASE` private, and a second exported constant for one call site would be
 * the kind of duplication that drifts.
 *
 * `error.message` is the whole detail. That is safe by construction rather than by
 * inspection: `LimitExceededError`'s admissible form carries the operation, the measured
 * quantity's name and the limit, and never the input — an oversized submission's own bytes
 * are the last thing a refusal about size should carry.
 */
export function tooLarge(request: Request, error: LimitExceededError): Response {
  return problem(request, {
    type: "https://darkprint.io/problems/limit-exceeded",
    title: "Payload too large",
    status: 413,
    detail: error.message,
  });
}

/**
 * Run a handler, mapping the engine's one throw to 413 and letting everything else through.
 *
 * Deliberately narrow: only `LimitExceededError` is caught. Any other throw is a fault in
 * this service rather than a verdict on the request, and it belongs in the framework's 500
 * where it will be seen — swallowing it here would report a bug as a bad request.
 */
export function withLimits(request: Request, run: () => Response): Response {
  try {
    return run();
  } catch (thrown) {
    if (thrown instanceof LimitExceededError) return tooLarge(request, thrown);
    throw thrown;
  }
}

/** A JSON object body, or the 400 that says why it is not one. */
export async function readObjectBody(
  request: Request,
): Promise<{ body: Record<string, unknown> } | { refusal: Response }> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return { refusal: badRequest(request, "The request body is not valid JSON.") };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { refusal: badRequest(request, "The request body must be a JSON object.") };
  }
  return { body: parsed as Record<string, unknown> };
}

/**
 * One required string field.
 *
 * The field's own name appears in the detail and nothing else does. Echoing the value back
 * would put caller content into a transport-level refusal, and a caller that sent the wrong
 * type already knows what it sent.
 */
export function readString(
  body: Record<string, unknown>,
  key: string,
): { value: string } | { detail: string } {
  const raw = body[key];
  if (typeof raw !== "string") return { detail: `\`${key}\` must be a string.` };
  return { value: raw };
}

/** An optional string field. Absent and `null` are both "not supplied". */
export function readOptionalString(
  body: Record<string, unknown>,
  key: string,
): { value?: string } | { detail: string } {
  const raw = body[key];
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "string") return { detail: `\`${key}\` must be a string when present.` };
  return { value: raw };
}

/**
 * `cardFiles` as a flat `Record<string, string>` — bundle-relative filename to source.
 *
 * Every value is checked, not sampled: one non-string among them reaches `parseDocument` as
 * whatever it is, and the failure would surface as a parse diagnostic about a document the
 * caller never wrote.
 */
export function readCardFiles(
  body: Record<string, unknown>,
): { value: Record<string, string> } | { detail: string } {
  const raw = body.cardFiles;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { detail: "`cardFiles` must be an object of filename to source." };
  }
  const files: Record<string, string> = {};
  for (const [name, source] of Object.entries(raw)) {
    if (typeof source !== "string") {
      return { detail: "`cardFiles` must map every filename to a string." };
    }
    files[name] = source;
  }
  return { value: files };
}

/**
 * The manifest, checked only for being an object.
 *
 * No field is required here, and that is deliberate rather than lax: `resolveBundle` reads
 * every manifest field it is given and reports what it finds as a diagnostic, which is
 * a 200 diagnostic and the right answer. Refusing a manifest at the transport layer for a
 * missing field would convert a complaint the engine already makes, in the caller's own
 * vocabulary, into a bare 400 that says less. What is checked is what would make the engine
 * throw instead of answer: a `manifest` that is not there at all.
 */
export function readManifest(
  body: Record<string, unknown>,
): { value: Record<string, unknown> } | { detail: string } {
  const raw = body.manifest;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { detail: "`manifest` must be a JSON object." };
  }
  return { value: raw as Record<string, unknown> };
}

/** Narrowing helper: every reader above returns either a value or a `detail` to refuse with. */
export function isRefusal<T extends object>(read: T | { detail: string }): read is { detail: string } {
  return "detail" in read;
}
