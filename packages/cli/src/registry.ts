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
