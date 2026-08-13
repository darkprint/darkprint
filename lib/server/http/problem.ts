/* ============================================================
   DarkPrint backend — the response envelope, problem half
   B-03: transport, auth and shape failures are RFC 9457
   `application/problem+json`. A payload's own content failures
   (a bundle that resolves with errors) are not this — see ok.ts.
   ============================================================ */

const PROBLEM_TYPE_BASE = "https://darkprint.io/problems";
const CONTENT_TYPE = "application/problem+json";

export interface ProblemDetails {
  /** URI reference identifying the problem type. Not required to resolve to anything. */
  type: string;
  title: string;
  status: number;
  detail?: string;
  /** URI reference identifying this specific occurrence, e.g. the request path. */
  instance?: string;
  /** RFC 9457 §3.2: problem-specific extension members, e.g. a rate limit's `resetAt`. */
  [extension: string]: unknown;
}

/** Serialises a `ProblemDetails` as `application/problem+json` at its own `status`. */
export function problem(details: ProblemDetails): Response {
  return Response.json(details, {
    status: details.status,
    headers: { "content-type": CONTENT_TYPE },
  });
}

/**
 * A private resource the caller may not see returns this, never `forbidden` (B-03) —
 * existence must not leak through the status code either.
 */
export function notFound(detail?: string, instance?: string): Response {
  return problem({
    type: `${PROBLEM_TYPE_BASE}/not-found`,
    title: "Not found",
    status: 404,
    detail,
    instance,
  });
}

/** No session, or a session that failed to verify. The guarded handler never runs. */
export function unauthorized(detail = "Sign in required.", instance?: string): Response {
  return problem({
    type: `${PROBLEM_TYPE_BASE}/unauthorized`,
    title: "Unauthorized",
    status: 401,
    detail,
    instance,
  });
}

/** The request itself is malformed — not a content diagnostic, which is a 200 (B-03). */
export function badRequest(detail: string, instance?: string): Response {
  return problem({
    type: `${PROBLEM_TYPE_BASE}/bad-request`,
    title: "Bad request",
    status: 400,
    detail,
    instance,
  });
}

export function conflict(detail: string, instance?: string): Response {
  return problem({
    type: `${PROBLEM_TYPE_BASE}/conflict`,
    title: "Conflict",
    status: 409,
    detail,
    instance,
  });
}
