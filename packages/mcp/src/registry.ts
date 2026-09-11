/* ============================================================
   darkprint mcp: the HTTP client
   Every tool the stdio server runs goes through `request`, and
   none of them knows what a database is. A non-2xx answer is
   rendered for an agent rather than for a log: a 429 becomes the
   sentence in `rate-limit.ts`, a 404 the one in `refusals.ts`, and
   an unreachable host says so instead of reading as a refusal.
   ============================================================ */

import { rateLimitText, detailOf, type ProblemDocument } from "./rate-limit";
import { NOT_FOUND_TEXT, unreachableText } from "./refusals";

/** Every non-2xx answer, rendered for an agent rather than for a log. */
export class RegistryError extends Error {}

export interface RegistryOptions {
  /** Defaults to the public registry. `DARKPRINT_URL` overrides it, for a local backend. */
  baseUrl: string;
  /** `DARKPRINT_API_KEY`. Absent is the normal case. */
  apiKey?: string;
  fetch: typeof fetch;
}

/** The host production serves, spelled with `www` because that is the host that answers. */
export const DEFAULT_BASE_URL = "https://www.darkprint.io";

export function optionsFromEnv(env: NodeJS.ProcessEnv): RegistryOptions {
  const options: RegistryOptions = {
    baseUrl: (env.DARKPRINT_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    fetch,
  };
  const key = env.DARKPRINT_API_KEY;
  if (key !== undefined && key !== "") options.apiKey = key;
  return options;
}

/** What a caller may add to a request. Absent means the GET every read route takes. */
export interface RequestInit_ {
  method?: string;
  /** Serialized already. The caller owns the encoding and declares it in `headers`. */
  body?: string;
  /** Merged OVER the defaults below, so a caller can add a header and not lose them. */
  headers?: Record<string, string>;
}

/**
 * One request against the registry, returning the body as text.
 *
 * `path` is always built by this package from a caller's arguments through
 * `encodeURIComponent`, never concatenated raw: a slug is agent-supplied text and a `..`
 * segment in it would otherwise address a different route.
 *
 * The third parameter carries a method, a body and extra headers for the CLI's one verb that
 * posts. It is spelled `= undefined` rather than `?` so `Function.length` stays at 2, and it
 * grants no authority: a caller that needs a credential sends it through `headers`.
 */
export async function request(
  options: RegistryOptions,
  path: string,
  init: RequestInit_ | undefined = undefined,
): Promise<string> {
  const headers: Record<string, string> = { accept: "application/json, text/yaml" };
  if (options.apiKey !== undefined) headers.authorization = `Bearer ${options.apiKey}`;
  Object.assign(headers, init?.headers);

  let response: Response;
  try {
    response = await options.fetch(`${options.baseUrl}${path}`, {
      headers,
      ...(init?.method === undefined ? {} : { method: init.method }),
      ...(init?.body === undefined ? {} : { body: init.body }),
    });
  } catch (cause) {
    throw new RegistryError(unreachableText(options.baseUrl, cause));
  }

  if (response.ok) return await response.text();

  const problem = await problemOf(response);
  if (response.status === 429) throw new RegistryError(rateLimitText(problem));
  if (response.status === 404) throw new RegistryError(NOT_FOUND_TEXT);
  throw new RegistryError(detailOf(problem) ?? `The registry answered ${response.status}.`);
}

async function problemOf(response: Response): Promise<ProblemDocument> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === "object" && parsed !== null ? (parsed as ProblemDocument) : {};
  } catch {
    /* A refusal that is not `problem+json`, a proxy's own error page most likely. The caller
       falls back to the status code, which is still more than nothing. */
    return {};
  }
}
