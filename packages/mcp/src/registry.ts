/* ============================================================
   darkprint mcp — the HTTP client, and where AC6 lives
   B-12: the server ships "over the same HTTP API". This file is
   the whole of that — every tool goes through `request` below and
   none of them knows what a database is.

   ── AC6 IS THIS FILE'S 429 BRANCH ──
   *An unkeyed client is limited and told so in a form an agent can
   act on.* D-220-09 puts that at the transport and rules it out of
   the blind suite's scope, because none of the four `Db`-taking
   verbs carries an ip, a key or a tier — no cell under
   `tests/server/t220` can drive a 429 through them.

   T230 already puts everything the message needs on the wire.
   D-230-09 publishes the 429's KEY SET, not just its members:

       type, title, status, detail, instance    RFC 9457's five
       limit, remaining, resetAt                the verdict
       keysAvailable: true                      AC6's affordance

   So this file PARSES rather than regexes the sentence — `resetAt`
   is a machine-readable member precisely so a client does not have
   to, and `limits/http.ts` declines a `retry-after` header on the
   ground that this document is where instruments look.

   ── an opaque refusal is the failure mode the criterion names ──
   "429" alone tells an agent to retry, immediately, forever. The
   message below says the ceiling, the instant it resets, how long
   that is in words, and that a key raises it — which are the four
   things a caller needs to either wait correctly or stop being
   unkeyed.
   ============================================================ */

/** Every non-2xx answer, rendered for an agent rather than for a log. */
export class RegistryError extends Error {}

/** RFC 9457's five, plus the three T230 adds. Every member optional: this is wire data. */
interface ProblemDocument {
  title?: unknown;
  detail?: unknown;
  status?: unknown;
  limit?: unknown;
  remaining?: unknown;
  resetAt?: unknown;
  keysAvailable?: unknown;
}

export interface RegistryOptions {
  /** Defaults to the public registry. `DARKPRINT_URL` overrides it, for a local backend. */
  baseUrl: string;
  /** `DARKPRINT_API_KEY`. Absent is the normal case and is what AC6 is about. */
  apiKey?: string;
  fetch: typeof fetch;
}

export function optionsFromEnv(env: NodeJS.ProcessEnv): RegistryOptions {
  const options: RegistryOptions = {
    baseUrl: (env.DARKPRINT_URL ?? "https://darkprint.io").replace(/\/+$/, ""),
    fetch,
  };
  const key = env.DARKPRINT_API_KEY;
  if (key !== undefined && key !== "") options.apiKey = key;
  return options;
}

/**
 * One GET against the registry, returning the body as text.
 *
 * `path` is always built by this package from a caller's arguments through
 * `encodeURIComponent`, never concatenated raw: a slug is agent-supplied text and a `..`
 * segment in it would otherwise address a different route.
 */
export async function request(options: RegistryOptions, path: string): Promise<string> {
  const headers: Record<string, string> = { accept: "application/json, text/yaml" };
  /* The header T220's routes read. It is the standard spelling and is UNPUBLISHED by T230,
     which mints the secret and publishes `resolveKey` and says nothing about presentation —
     reported rather than assumed silently. */
  if (options.apiKey !== undefined) headers.authorization = `Bearer ${options.apiKey}`;

  let response: Response;
  try {
    response = await options.fetch(`${options.baseUrl}${path}`, { headers });
  } catch (cause) {
    /* An unreachable registry is not a refusal and must not read like one: an agent told
       "not found" stops looking, where an agent told the host is unreachable retries or
       tells its user. */
    throw new RegistryError(
      `Could not reach the DarkPrint registry at ${options.baseUrl}. ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (response.ok) return await response.text();

  const problem = await problemOf(response);
  if (response.status === 429) throw new RegistryError(rateLimitMessage(problem));
  if (response.status === 404) {
    throw new RegistryError(
      "The registry holds nothing at that address, or it is not public. " +
        "DarkPrint answers 404 rather than 403 so that a private bundle is indistinguishable " +
        "from one that does not exist.",
    );
  }
  throw new RegistryError(detailOf(problem) ?? `The registry answered ${response.status}.`);
}

/**
 * AC6's sentence. The limit, the reset instant, and the fact that a key exists.
 *
 * Every number is READ FROM THE DOCUMENT and none is derived. `resetAt` is an ISO instant
 * T230 puts there for this purpose; the "in N minutes" is a convenience computed from it and
 * is stated as approximate, because the exact answer is the instant and a countdown computed
 * against a client's own clock is the thing that drifts.
 *
 * Every field is defended against being absent. This is wire data from a service that may be
 * older than this client, and a rate-limit message that throws while formatting is an opaque
 * refusal with extra steps.
 */
function rateLimitMessage(problem: ProblemDocument): string {
  const parts: string[] = ["Rate limited by the DarkPrint registry."];

  const detail = detailOf(problem);
  if (detail !== undefined) parts.push(detail);
  else if (typeof problem.limit === "number") parts.push(`The ceiling is ${problem.limit} requests.`);

  const resetAt = typeof problem.resetAt === "string" ? problem.resetAt : undefined;
  if (resetAt !== undefined) {
    const at = new Date(resetAt);
    const wait = Number.isNaN(at.getTime()) ? undefined : describeWait(at.getTime() - Date.now());
    parts.push(
      wait === undefined
        ? `The limit resets at ${resetAt}.`
        : `The limit resets at ${resetAt}, about ${wait} from now. Wait rather than retrying.`,
    );
  }

  /* AC6's affordance, and the reason the criterion is about a REFUSAL: an agent that cannot
     learn a key exists has no move except to keep failing. `keysAvailable` is a fact about
     the product and never about this caller (D-230-09), so it is safe to act on. */
  if (problem.keysAvailable === true) {
    parts.push(
      "An API key raises this ceiling. A signed-in account can mint one with " +
        "`POST /api/account/keys`; put it in DARKPRINT_API_KEY and this server will send it.",
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

async function problemOf(response: Response): Promise<ProblemDocument> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === "object" && parsed !== null ? (parsed as ProblemDocument) : {};
  } catch {
    /* A refusal that is not `problem+json` — a proxy's own error page, most likely. The
       caller falls back to the status code, which is still more than nothing. */
    return {};
  }
}

function detailOf(problem: ProblemDocument): string | undefined {
  if (typeof problem.detail === "string" && problem.detail !== "") return problem.detail;
  if (typeof problem.title === "string" && problem.title !== "") return problem.title;
  return undefined;
}
