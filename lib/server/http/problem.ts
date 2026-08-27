/* ============================================================
   DarkPrint backend — the response envelope, problem half
   B-03: transport, auth and shape failures are RFC 9457
   `application/problem+json`. A payload's own content failures
   (a bundle that resolves with errors) are not this — see ok.ts.
   ============================================================ */

/**
 * The one definition of the problem-type namespace.
 *
 * Exported by ruling (T050, D-50-03), and the ruling is about the mechanism rather
 * than the convenience: T050's contract published a `handle-required` type under
 * `darkprint.dev`, a host occurring nowhere else in the repository, and it was
 * reachable only because a task needing a type this module does not construct had to
 * retype the base as a literal. A second copy of a constant that can drift is what
 * produced that defect, so the copy is removed rather than the typo corrected.
 */
export const PROBLEM_TYPE_BASE = "https://darkprint.io/problems";
const CONTENT_TYPE = "application/problem+json";

export interface ProblemDetails {
  /** URI reference identifying the problem type. Not required to resolve to anything. */
  type: string;
  title: string;
  status: number;
  detail: string;
  /** URI reference identifying this specific occurrence, e.g. the request path. */
  instance: string;
  /** RFC 9457 §3.2: problem-specific extension members, e.g. a rate limit's `resetAt`. */
  [extension: string]: unknown;
}

/**
 * `ProblemDetails` minus `instance`, spelled out rather than `Omit<ProblemDetails,
 * "instance">` — `Omit` collapses to `Record<string, unknown>` on a type carrying an
 * index signature, which would silently stop `problem()` requiring `type`/`title`/
 * `status`/`detail` at all.
 */
interface ProblemInput {
  type: string;
  title: string;
  status: number;
  detail: string;
  [extension: string]: unknown;
}

/**
 * RFC 9457 §3.1: `instance` identifies this specific occurrence. The request path
 * already is that, so every constructor below takes the request and derives it —
 * D-02 was every caller being asked to remember an `instance` string and none doing
 * so, which `Response.json` then silently dropped as `undefined`.
 */
function instanceOf(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

/** Serialises a `ProblemDetails` as `application/problem+json` at its own `status`. */
export function problem(request: Request, details: ProblemInput): Response {
  const body: ProblemDetails = { ...details, instance: instanceOf(request) };
  return Response.json(body, {
    status: body.status,
    headers: { "content-type": CONTENT_TYPE },
  });
}

/**
 * A private resource the caller may not see returns this, never `forbidden` (B-03) —
 * existence must not leak through the status code either.
 */
export function notFound(request: Request, detail = "Not found."): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/not-found`,
    title: "Not found",
    status: 404,
    detail,
  });
}

/** No session, or a session that failed to verify. The guarded handler never runs. */
export function unauthorized(request: Request, detail = "Sign in required."): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/unauthorized`,
    title: "Unauthorized",
    status: 401,
    detail,
  });
}

/** The request itself is malformed — not a content diagnostic, which is a 200 (B-03). */
export function badRequest(request: Request, detail: string): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/bad-request`,
    title: "Bad request",
    status: 400,
    detail,
  });
}

export function conflict(request: Request, detail: string): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/conflict`,
    title: "Conflict",
    status: 409,
    detail,
  });
}
