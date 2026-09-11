/* ============================================================
   darkprint CLI — `clone`
   Two targets, one rule: the folder on disk is the registry's own
   export, byte for byte. Nothing is assembled here. For a release
   the file NAMES come from the release route (which gets them from
   `exportBundle` through `exportRelease`) and each file's text
   from the file route; for a card the one file comes from the card
   file route under the name the export gives a pinned card. This
   module chooses no name and rewrites no byte, which is what makes
   the claim structural.
   ============================================================ */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

import { latestVersion, parseCardRef } from "../../../lib/core";
import { CliError } from "./errors";
import { CARDS_DIR } from "./layout";
import {
  fetchCard,
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
  /** Which form the target took. A release is a folder; a card is one file under `cards/`. */
  kind: "release" | "card";
  /** Absolute, so a caller comparing against a directory it made does not depend on the cwd. */
  root: string;
  /** Bundle-relative, in the exporter's own sort — the server's list, unreordered. */
  files: readonly string[];
  /** The release's digest. Absent for a card, which is pinned by the version in its reference. */
  digest?: string;
  /** The version the caller named, or the one a card reference carries. */
  version?: string;
}

/**
 * Fetch a release, or one card, into a directory.
 *
 * `target` is `<owner>/<slug>` for a release, the registry's two-part key, or a card
 * reference `<id>@<version>`, whose id may carry a namespace (`berti/memory-probe@1.0.0`).
 * The `@` is what tells the two apart: a slug never carries one and a card reference always
 * does.
 *
 * The last parameter is `= undefined` rather than `?` because the two differ at runtime:
 * `?` erases and leaves the parameter counted in `Function.length`, and the arity rule the
 * blind suite pins counts it.
 */
export async function clone(
  target: string,
  options: CloneOptions | undefined = undefined,
): Promise<CloneResult> {
  if (target.includes("@")) return await cloneCard(target, options);

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
    const destination = insideRoot(root, path);
    const text = await fetchFile(registry, owner, slug, digest, path);
    mkdirSync(dirname(destination), { recursive: true });
    /* Written verbatim. The digest is taken over these bytes, so any normalisation here —
       a trailing newline, a line ending — would break the one claim the folder's README
       makes that a reader can check on their own machine. */
    writeFileSync(destination, text);
  }

  return {
    kind: "release",
    root,
    files,
    digest,
    ...(options?.version === undefined ? {} : { version: options.version }),
  };
}

/**
 * One card, written as `cards/<id>@<version>.yaml` under `--out` (the cwd by default), which
 * is the name the export gives a pinned card inside a bundle folder, so the file drops into
 * the folder a topology pins it from.
 *
 * `--version` and `--digest` name a release. A card is pinned by the version in its own
 * reference, so either flag beside one is a mistake about what is being cloned, refused
 * before any network call.
 */
async function cloneCard(target: string, options: CloneOptions | undefined): Promise<CloneResult> {
  const ref = parseCardRef(target);
  if (ref === undefined) throw new CliError(`clone: \`${target}\` is not an <owner>/<slug> or a card <id>@<version>.`);
  if (options?.version !== undefined || options?.digest !== undefined) {
    throw new CliError("clone: a card is pinned by the version in its reference; --version and --digest name a release.");
  }

  const canonical = `${ref.id}@${ref.version}`;
  const path = `${CARDS_DIR}/${canonical}.yaml`;
  const root = resolve(options?.out ?? ".");
  const destination = insideRoot(root, path);
  const text = await fetchCard(resolveOptions(options), canonical);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text);

  return { kind: "card", root, files: [path], version: ref.version };
}

/**
 * The destination for a bundle-relative name, or a refusal when it leaves `root`.
 *
 * A release's file names come from the registry's response and not from the caller, so a
 * compromised, MITM'd or self-hosted server could answer `../../…` and walk `writeFileSync`
 * out of the target directory onto an arbitrary file on the machine running the clone
 * (CWE-22). A name is trusted for its BYTES, which the digest covers, never for where it
 * writes. `resolve` also collapses an absolute `path`, so `/etc/…` fails the same test.
 */
function insideRoot(root: string, path: string): string {
  const destination = resolve(root, path);
  if (destination !== root && !destination.startsWith(root + sep)) {
    throw new CliError(`clone: \`${path}\` escapes the target directory.`);
  }
  return destination;
}

/** `<owner>/<slug>`, and nothing else is a release target. */
function parseTarget(target: string): { owner: string; slug: string } {
  const parts = target.split("/");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    throw new CliError(`clone: \`${target}\` is not an <owner>/<slug> or a card <id>@<version>.`);
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
