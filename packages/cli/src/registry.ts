/* ============================================================
   darkprint CLI — the registry addresses the network verbs use
   The CLIENT is `packages/mcp/src/registry.ts` and is consumed,
   never restated (D-270-05(2)): one env contract, one base-URL
   default, one 429 rendering. C1 makes the two packages one
   distributable, so this is an import and not a copy.

   What lives here is only the ADDRESSES — the three routes the
   CLI reads — and the two shapes they answer with. Every segment
   is percent-encoded: an owner handle and a slug are caller text,
   and a `..` in one would otherwise address a different route.
   ============================================================ */

import { optionsFromEnv, request, type RegistryOptions } from "../../mcp/src/registry";
/* The DEEP path and not `../../../lib/server/auth`. That barrel re-exports the GitHub and
   Google OAuth clients and the session guard, which pulls the `problem+json` renderer in
   behind it; this needs one string. `session.ts` imports `node:crypto` and `./cookie` and
   nothing else. Consume-never-edit (D-270-01 C7) — the cookie's NAME is the server's to
   decide, and a second spelling of it in this package would be a credential sent under a
   name nothing reads. */
import { SESSION_COOKIE_NAME } from "../../../lib/server/auth/session";

/** What a network verb accepts: any part of `RegistryOptions`, all of it optional. */
export interface RegistryOverrides {
  baseUrl?: string;
  apiKey?: string;
  fetch?: typeof fetch;
}

/**
 * The env is read HERE, at call time, and never at module scope (C11, D-270-06(3)).
 *
 * A verb given no options resolves the environment itself, which is what makes
 * `darkprint clone owner/slug` work with nothing configured; a verb given a `fetch` is
 * drivable in-process by a suite that never opens a socket, which is the reason the member
 * exists (D-270-05(2)).
 */
export function resolveOptions(overrides: RegistryOverrides | undefined): RegistryOptions {
  const base = optionsFromEnv(process.env);
  const options: RegistryOptions = {
    baseUrl: overrides?.baseUrl === undefined ? base.baseUrl : overrides.baseUrl.replace(/\/+$/, ""),
    fetch: overrides?.fetch ?? base.fetch,
  };
  const apiKey = overrides?.apiKey ?? base.apiKey;
  if (apiKey !== undefined) options.apiKey = apiKey;
  return options;
}

/** One release as the provenance route lists it. */
export interface ReleaseRef {
  version: string;
  digest: string;
}

const seg = encodeURIComponent;

/** T220's provenance route: who published it, and every release's version and digest. */
export async function fetchReleases(
  options: RegistryOptions,
  owner: string,
  slug: string,
): Promise<readonly ReleaseRef[]> {
  const body: unknown = JSON.parse(
    await request(options, `/api/mcp/blueprints/${seg(owner)}/${seg(slug)}/provenance`),
  );
  const releases = (body as { releases?: unknown }).releases;
  if (!Array.isArray(releases)) return [];
  return releases.filter(
    (r): r is ReleaseRef =>
      typeof r === "object" && r !== null &&
      typeof (r as ReleaseRef).version === "string" &&
      typeof (r as ReleaseRef).digest === "string",
  );
}

/**
 * T220's release route: the file NAMES of one release, in the exporter's own sort.
 *
 * Names and not bytes, deliberately, and that is the route's own decision (D-220-15): the
 * bytes have a route of their own and serving them twice differs in download accounting.
 * So a clone is one list fetch plus one fetch per file, which is also what the site's own
 * `curl` command does.
 */
export async function fetchFileList(
  options: RegistryOptions,
  owner: string,
  slug: string,
  digest: string,
): Promise<readonly string[]> {
  const body: unknown = JSON.parse(
    await request(options, `/api/mcp/releases/${seg(owner)}/${seg(slug)}/d/${seg(digest)}`),
  );
  const files = (body as { files?: unknown }).files;
  return Array.isArray(files) ? files.filter((f): f is string => typeof f === "string") : [];
}

/* --------------------- the one write route --------------------- */

/**
 * The environment variable carrying a signed session cookie, read at CALL time.
 *
 * ── why this is a cookie and not `DARKPRINT_API_KEY` ──
 * `POST /api/blueprints/{owner}/{slug}/runs` is wrapped in `withSession`, and `withSession`
 * reads one thing: the `darkprint_session` cookie. **No write route in this product accepts
 * an API key** — D-270-01 C4 measured that and it is still true, which is why `report` was
 * withdrawn from T270's published verb block in the first place. A key raises a read
 * ceiling and identifies nobody, so sending one here would authenticate nothing.
 *
 * So the credential is the session a signed-in person already has, handed to the CLI
 * explicitly rather than harvested from a browser profile. That is a real limit and the
 * verb says so out loud rather than pretending the transport is finished: when key-auth on
 * write routes exists, this function is what changes and the verb above it does not.
 *
 * `undefined` for absent or empty, so a caller checks once. Never logged, never echoed, and
 * never put in a message — `errors.ts`'s admissible form forbids a credential in a
 * rendering, and this is the only one this package ever holds.
 */
export function resolveSession(override: string | undefined): string | undefined {
  const value = override ?? process.env.DARKPRINT_SESSION;
  return value === undefined || value === "" ? undefined : value;
}

/**
 * T280's run-report route: one report, keyed by the addressed bundle.
 *
 * The digest is deliberately NOT this function's business. The route resolves an omitted
 * `releaseDigest` to the bundle's current release and refuses one belonging to any other
 * bundle, server-side (D-180-01), so a client that picked a default here would be making a
 * decision the route already makes, differently, from further away.
 *
 * The body is passed through as the caller built it. **No unit normalisation anywhere on
 * this path**, matching the route's own rule: `costUnits` is whatever the reporter counts
 * in, and a client that scaled it would be inventing the reference this product does not
 * have.
 */
export async function postRunReport(
  options: RegistryOptions,
  session: string,
  owner: string,
  slug: string,
  body: Record<string, unknown>,
): Promise<string> {
  return await request(options, `/api/blueprints/${seg(owner)}/${seg(slug)}/runs`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${session}`,
    },
  });
}

/** T090's file route: one file of one release, addressed by digest. */
export async function fetchFile(
  options: RegistryOptions,
  owner: string,
  slug: string,
  digest: string,
  path: string,
): Promise<string> {
  const encoded = path.split("/").map(seg).join("/");
  return await request(
    options,
    `/api/files/blueprints/${seg(owner)}/${seg(slug)}/d/${seg(digest)}/${encoded}`,
  );
}
