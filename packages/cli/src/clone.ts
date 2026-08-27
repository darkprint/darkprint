/* ============================================================
   darkprint CLI — `clone`
   AC4: by digest, the folder on disk is the server's export, byte
   for byte. Nothing is assembled here — the file NAMES come from
   T220's release route (which gets them from `exportBundle`
   through `exportRelease`) and each file's text comes from T090's
   file route. This module chooses no name and rewrites no byte,
   which is what makes the criterion structural.
   ============================================================ */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

import { latestVersion } from "../../../lib/core";
import { CliError } from "./errors";
import {
  fetchFile,
  fetchFileList,
  fetchReleases,
  resolveOptions,
  type RegistryOverrides,
} from "./registry";

export interface CloneOptions extends RegistryOverrides {
  version?: string;
  digest?: string;
  out?: string;
}

export interface CloneResult {
  /** Absolute, so a caller comparing against a directory it made does not depend on the cwd. */
  root: string;
  /** Bundle-relative, in the exporter's own sort — the server's list, unreordered. */
  files: readonly string[];
  digest: string;
  /** Present only when the caller named a version. */
  version?: string;
}

/**
 * Fetch a release into a directory.
 *
 * `target` is `<owner>/<slug>` — B-09's two-part key. The site's own `darkprint clone <slug>`
 * spelling predates it and D-270-01 C10 rules that the block governs.
 *
 * The last parameter is `= undefined` rather than `?` because the two differ at runtime:
 * `?` erases and leaves the parameter counted in `Function.length`, and T250's arity rule
 * is what the blind suite pins.
 */
export async function clone(
  target: string,
  options: CloneOptions | undefined = undefined,
): Promise<CloneResult> {
  const { owner, slug } = parseTarget(target);

  /* Before any network call, so it is drivable with the network unavailable: the two flags
     are a fact about the caller's own arguments and asking a server about them would be
     asking the wrong question. */
  if (options?.version !== undefined && options.digest !== undefined) {
    throw new CliError("clone: give --version or --digest, not both.");
  }

  const registry = resolveOptions(options);
  const digest = await resolveDigest(registry, owner, slug, options);

  const files = await fetchFileList(registry, owner, slug, digest);
  const root = resolve(options?.out ?? slug);
  for (const path of files) {
    /* The file NAMES come from the registry's response (`fetchFileList`), not from the
       caller — so a compromised, MITM'd or self-hosted server could answer `../../…` and
       walk `writeFileSync` out of the target directory onto an arbitrary file on the
       machine running the clone (CWE-22). A name is trusted for its BYTES, which the digest
       covers, never for where it writes: the destination stays under `root` or the clone
       refuses. `resolve` also collapses an absolute `path`, so `/etc/…` fails the same test. */
    const destination = resolve(root, path);
    if (destination !== root && !destination.startsWith(root + sep)) {
      throw new CliError(`clone: \`${path}\` escapes the target directory.`);
    }
    const text = await fetchFile(registry, owner, slug, digest, path);
    mkdirSync(dirname(destination), { recursive: true });
    /* Written verbatim. The digest is taken over these bytes, so any normalisation here —
       a trailing newline, a line ending — would break the one claim the folder's README
       makes that a reader can check on their own machine. */
    writeFileSync(destination, text);
  }

  return {
    root,
    files,
    digest,
    ...(options?.version === undefined ? {} : { version: options.version }),
  };
}

/** `<owner>/<slug>`, and nothing else is a target. */
function parseTarget(target: string): { owner: string; slug: string } {
  const parts = target.split("/");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    throw new CliError(`clone: \`${target}\` is not an <owner>/<slug>.`);
  }
  return { owner: parts[0], slug: parts[1] };
}

/**
 * The digest to fetch: the caller's, the one a named version resolves to, or the latest.
 *
 * A version is resolved through the provenance route because it is the only version→digest
 * map the API publishes, and resolving it to a digest before fetching is what makes a
 * `--version` clone and a `--digest` clone of one release write identical bytes rather than
 * two paths that agree by inspection.
 *
 * "Latest" is `latestVersion`, the engine's own answer, rather than the first row the route
 * happened to return: the provenance block publishes no order for `releases`, so reading
 * one off it would be a decision resting on an unpublished fact.
 */
async function resolveDigest(
  registry: ReturnType<typeof resolveOptions>,
  owner: string,
  slug: string,
  options: CloneOptions | undefined,
): Promise<string> {
  if (options?.digest !== undefined) return options.digest;

  const releases = await fetchReleases(registry, owner, slug);
  if (options?.version !== undefined) {
    const named = releases.find((release) => release.version === options.version);
    if (named === undefined) throw new CliError("clone: no release at that version.");
    return named.digest;
  }

  const latest = latestVersion(releases.map((release) => release.version));
  const release = releases.find((r) => r.version === latest);
  if (release === undefined) throw new CliError("clone: this blueprint has no releases.");
  return release.digest;
}
