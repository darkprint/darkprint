/* ============================================================
   darkprint CLI — `bump`
   AC2: refuse a declared version below the one the change
   requires, NAMING THE REASONS. Nothing is recomputed here — the
   subject is the BUNDLE (D-270-05(1)), so this is
   `inferBlueprintBump` over two snapshots followed by
   `checkDeclaredBump("bundle", …)`, both `@/lib/server/versioning`'s
   and neither reimplemented. T270 is that function's first
   production consumer.

   ── the two snapshots are assembled the SAME way ──
   `cardRefs` comes from the engine's own resolved nodes on BOTH
   sides, after the same load `validate` performs (D-270-07(3)).
   Deriving one side from file names and the other from the graph
   would make a card that fails to load read as a repin, and the
   diff would be a fact about the two readers rather than about
   the two releases.
   ============================================================ */

import {
  checkDeclaredBump,
  inferBlueprintBump,
  type BlueprintSnapshot,
} from "../../../lib/server/versioning";
import { validateBundle, validateVocabularySource } from "../../../lib/server/engine";
import { latestVersion, type Diagnostic, type OntologyTerm } from "../../../lib/core";
import { ONTOLOGY_EXTENSIONS_FILE } from "../../../lib/content/ontology-file";
import { CliError } from "./errors";
import { readBundleDirectory, stubManifestFor } from "./layout";
import {
  fetchFile,
  fetchFileList,
  fetchReleases,
  resolveOptions,
  type RegistryOverrides,
} from "./registry";

export interface BumpOptions extends RegistryOverrides {
  /** `<owner>/<slug>`. Required: nothing in a bundle directory can supply it (D-270-07(1)). */
  target?: string;
}

/**
 * Is `declare` a big enough version for what changed since the last release?
 *
 * Answers `checkDeclaredBump`'s own diagnostics, unaltered — **the empty array is success**.
 * A caller rendering them must print `hint` as well as `message`: the engine puts the
 * reasons in `hint` and `message` alone is exactly the reasons-free sentence AC2 forbids
 * (D-270-04(2)).
 */
export async function bump(
  dir: string,
  declare: string,
  options: BumpOptions | undefined = undefined,
): Promise<readonly Diagnostic[]> {
  /* Before any network call, so a caller who forgot the target learns it offline rather
     than through a 404 about a blueprint nobody named. */
  const target = options?.target;
  if (target === undefined || target === "") {
    throw new CliError("bump: give --target <owner>/<slug>.");
  }
  const parts = target.split("/");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    throw new CliError(`bump: \`${target}\` is not an <owner>/<slug>.`);
  }
  const [owner, slug] = parts;

  const local = readBundleDirectory(dir);
  const next = snapshotOf(local.dot, local.cardFiles, local.extensions, slug);

  const registry = resolveOptions(options);
  const releases = await fetchReleases(registry, owner, slug);
  const latest = latestVersion(releases.map((release) => release.version));
  const previousRelease = releases.find((release) => release.version === latest);
  if (previousRelease === undefined) {
    throw new CliError("bump: this blueprint has no published release to compare against.");
  }

  const previous = await fetchSnapshot(registry, owner, slug, previousRelease.digest);
  const inferred = inferBlueprintBump(previous, next);
  return checkDeclaredBump("bundle", previousRelease.version, declare, inferred);
}

/**
 * One release as a snapshot, fetched file by file.
 *
 * The file LIST is the server's, so this reads whatever the exporter wrote rather than
 * guessing at a folder shape — the same list `clone` writes to disk.
 */
async function fetchSnapshot(
  registry: ReturnType<typeof resolveOptions>,
  owner: string,
  slug: string,
  digest: string,
): Promise<BlueprintSnapshot> {
  const paths = await fetchFileList(registry, owner, slug, digest);
  let dot = "";
  const cardFiles: Record<string, string> = {};
  let vocabulary: string | undefined;

  for (const path of paths) {
    if (path !== "blueprint.dot" && !path.startsWith("cards/") && path !== ONTOLOGY_EXTENSIONS_FILE) {
      continue;
    }
    const text = await fetchFile(registry, owner, slug, digest, path);
    if (path === "blueprint.dot") dot = text;
    else if (path === ONTOLOGY_EXTENSIONS_FILE) vocabulary = text;
    else cardFiles[path] = text;
  }

  return snapshotOf(dot, cardFiles, extensionsOf(vocabulary), slug);
}

/**
 * The fetched release's overlay, through the engine's own reader.
 *
 * The same function `/api/validate/bundle` uses on a submitted vocabulary, so the previous
 * release is resolved against the terms the server resolved it against. A broken overlay
 * yields no terms, which is that route's own recorded behaviour rather than a choice here.
 */
function extensionsOf(text: string | undefined): readonly OntologyTerm[] | undefined {
  return text === undefined ? undefined : validateVocabularySource(text).terms;
}

/**
 * A bundle's `{ dot, cardRefs }`, with `cardRefs` taken from the engine's resolved nodes.
 *
 * The manifest is D3's stub: a snapshot is `dot` plus `cardRefs` and no manifest field
 * reaches either, so the stub cannot influence the comparison — it is here only because
 * `validateBundle` needs one to run at all.
 */
function snapshotOf(
  dot: string,
  cardFiles: Record<string, string>,
  extensions: readonly OntologyTerm[] | undefined,
  name: string,
): BlueprintSnapshot {
  const result = validateBundle({
    manifest: stubManifestFor(name),
    dot,
    cardFiles,
    ...(extensions === undefined ? {} : { extensions }),
  });
  return { dot, cardRefs: (result.blueprint?.nodes ?? []).map((node) => node.ref) };
}
