/* ============================================================
   darkprint mcp: the 429, rendered for an agent
   One renderer for both transports. The stdio server reads the
   registry's problem document off the wire; the remote endpoint
   builds the same document from the limit it just refused. Either
   way the model gets the ceiling, the instant it resets, how long
   that is in words, and that a key raises it, which are the four
   things a caller needs to wait correctly or stop being unkeyed.
   ============================================================ */

/** RFC 9457's members plus the three the registry adds. Every member optional: this is wire data. */
export interface ProblemDocument {
  title?: unknown;
  detail?: unknown;
  status?: unknown;
  limit?: unknown;
  remaining?: unknown;
  resetAt?: unknown;
  keysAvailable?: unknown;
}

/**
 * The sentence a rate-limited tool call answers with.
 *
 * Every number is read from the document and none is derived. `resetAt` is an ISO instant
 * the registry puts there for this purpose; the "in N minutes" is computed from it and said
 * to be approximate, because a countdown against the client's own clock is what drifts.
 * Every field is defended against being absent: a message that throws while formatting is
 * an opaque refusal with extra steps.
 */
export function rateLimitText(problem: ProblemDocument, now: number = Date.now()): string {
  const parts: string[] = ["Rate limited by the DarkPrint registry."];

  const detail = detailOf(problem);
  if (detail !== undefined) parts.push(detail);
  else if (typeof problem.limit === "number") parts.push(`The ceiling is ${problem.limit} requests.`);

  const resetAt = typeof problem.resetAt === "string" ? problem.resetAt : undefined;
  if (resetAt !== undefined) {
    const at = new Date(resetAt);
    const wait = Number.isNaN(at.getTime()) ? undefined : describeWait(at.getTime() - now);
    parts.push(
      wait === undefined
        ? `The limit resets at ${resetAt}.`
        : `The limit resets at ${resetAt}, about ${wait} from now. Wait rather than retrying.`,
    );
  }

  /* `keysAvailable` is a fact about the product and never about this caller, so it is safe
     to act on; an agent that cannot learn a key exists has no move except to keep failing. */
  if (problem.keysAvailable === true) {
    parts.push(
      "An API key raises this ceiling. Mint one under Settings on darkprint.io and send it " +
        "as `Authorization: Bearer <key>`; the stdio server sends it for you when " +
        "DARKPRINT_API_KEY is set.",
    );
  }

  return parts.join(" ");
}

/** "3 minutes", "2 hours". Approximate by construction, and said so at the call site. */
function describeWait(ms: number): string {
  if (ms <= 0) return "no time";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** The problem's own sentence, when it carries one. */
export function detailOf(problem: ProblemDocument): string | undefined {
  if (typeof problem.detail === "string" && problem.detail !== "") return problem.detail;
  if (typeof problem.title === "string" && problem.title !== "") return problem.title;
  return undefined;
}
