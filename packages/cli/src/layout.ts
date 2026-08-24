/* ============================================================
   darkprint CLI — reading a bundle directory off disk
   D-270-01 C6: `<dir>` is the layout `/upload` already accepts —
   `blueprint.dot` required, `cards/*.yaml`, an OPTIONAL manifest —
   so `validate` accepts exactly what the wizard accepts and what
   the authoring skill writes.

   ── the card keys are the export's own, and AC1 CANNOT see it ──
   `cardFilePath` names a pinned card `cards/<id>@<version>.yaml`
   and `lib/content/read.ts` keys the archive's own submission with
   the same `cards/` prefix. `resolveBundle` hands the key to
   `loadCard` as `file`, so it is what a card diagnostic's
   `location.file` reports and what a reader opens.
   AC1 does not measure it: the nine archive bundles produce no
   card-level diagnostic once the archive vocabulary is layered, so
   `location.file` is never populated from a key anywhere in that
   fixture set — a mutation keying the cards `<name>` reddened 0 of
   11 AC1 cells and 1 of the cell in `layout.test.ts` written for
   it. Stated because a comment claiming AC1 covers this is the
   kind of thing the next reader would believe. The key is therefore the path
   relative to the bundle root, verbatim.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { CORE_ONTOLOGY, error, type BundleManifest, type Diagnostic, type OntologyTerm } from "../../../lib/core";
import { ONTOLOGY_EXTENSIONS_FILE } from "../../../lib/content/ontology-file";
import { validateVocabularySource } from "../../../lib/server/engine";
import { CliError } from "./errors";

/**
 * The manifest's accepted filenames, bound to the wizard's OWN regex
 * (`components/upload/BundleDropzone.tsx:104`) rather than to a spelling of my own.
 * D-270-02 D3 ruled one name and the blind author measured three; the file that decides
 * what `/upload` accepts is the one this has to agree with, so the pattern is copied from
 * it and cited. `components/**` is Forbidden here, which is why it is copied and not
 * imported — see `slugFrom` below for the same trade made with the reason stated.
 */
const MANIFEST_NAME = /^blueprint\.(ya?ml|json)$/i;

/** The wizard's flat vocabulary spelling, its line 106. See `readVocabulary`. */
const FLAT_VOCABULARY_NAME = /^extensions\.(ya?ml|json)$/i;

const DOT_FILE = "blueprint.dot";
const CARDS_DIR = "cards";

/** What a bundle directory holds, in the shape `validateBundle` takes. */
export interface BundleDirectory {
  /** Absolute, so a message can name what was read without depending on the cwd. */
  root: string;
  dot: string;
  cardFiles: Record<string, string>;
  manifest: BundleManifest;
  /**
   * The manifest file that was read, or `undefined` when D-270-02 D3's stub supplied it.
   * A caller rendering "no manifest, assuming defaults" needs to know which happened, and
   * `manifest` alone cannot say.
   */
  manifestFile: string | undefined;
  extensions: readonly OntologyTerm[] | undefined;
  /**
   * D-270-04(3): both vocabulary spellings present and DIFFERENT. A `Diagnostic` rather
   * than a throw or a new class, because that is what the ruling names and what every
   * other load complaint already is — and because a bundle with two overlays is still a
   * bundle worth reporting the rest of.
   */
  vocabularyConflict: Diagnostic | undefined;
}

/**
 * Read one bundle directory.
 *
 * Throws `CliError` when `blueprint.dot` is absent: a directory without a topology is not
 * an incomplete bundle, it is not one at all — `BundleDropzone`'s own wording for the same
 * condition, and the reason the DOT is the only required member.
 */
export function readBundleDirectory(dir: string): BundleDirectory {
  const root = resolve(dir);
  const entries = listing(root);

  const dot = readFileIn(root, DOT_FILE);
  if (dot === undefined) {
    throw new CliError(
      `validate: \`${dir}\` has no ${DOT_FILE}, so there is no blueprint in it to check.`,
    );
  }

  const manifestFile = entries.find((name) => MANIFEST_NAME.test(name));
  const manifest =
    manifestFile === undefined
      ? stubManifest(root)
      : readManifest(root, manifestFile, stubManifest(root));

  const vocabulary = readVocabulary(root, entries);
  return {
    root,
    dot,
    cardFiles: readCards(root),
    manifest,
    manifestFile,
    extensions: vocabulary.extensions,
    vocabularyConflict: vocabulary.conflict,
  };
}

/* --------------------- the pieces --------------------- */

/** Top-level names, or `[]` for a directory that cannot be listed. */
function listing(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function readFileIn(root: string, relative: string): string | undefined {
  try {
    return readFileSync(join(root, relative), "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Every document in `cards/`, keyed by its bundle-relative path.
 *
 * Every file is taken rather than only the ones the DOT pins, which is the opposite of
 * what `lib/content/read.ts` does and is deliberate: that reader is assembling a
 * submission out of a fifty-card shared library, where an unpinned card would be noise,
 * while this one is reading a folder somebody already assembled. A card sitting in a
 * bundle's own `cards/` and pinned by nothing is a fact about that folder, and
 * `bundle/orphan-card` is the engine's word for it. Dropping it here would hide the
 * defect the engine exists to report.
 *
 * The `.yaml`/`.yml`/`.json` set is the wizard's `DOCUMENT_EXT`, so a folder `/upload`
 * accepts does not become one `validate` refuses.
 */
function readCards(root: string): Record<string, string> {
  const cards: Record<string, string> = {};
  let entries: string[];
  try {
    entries = readdirSync(join(root, CARDS_DIR), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return cards;
  }

  for (const name of entries) {
    if (!/\.(ya?ml|json)$/i.test(name)) continue;
    const text = readFileIn(root, join(CARDS_DIR, name));
    if (text !== undefined) cards[`${CARDS_DIR}/${name}`] = text;
  }
  return cards;
}

/**
 * The local overlay, at BOTH spellings D-270-04(3) names.
 *
 * `exportBundle` writes it at `ontology/extensions.yaml` — a subdirectory — while the
 * wizard's `VOCABULARY_NAME` matches a FLAT `extensions.yaml`, because a browser drop
 * hands it a file list with no folder. C6 promises both that `validate` accepts the
 * wizard's layout and that `clone`'s output folder is validatable, and those two promises
 * name different paths, so both are read.
 *
 * Two files that AGREE are one document spelled twice and are fine. Two that DIFFER get a
 * diagnostic naming both paths and NO silent precedence: picking one would score the
 * bundle against a vocabulary the author did not necessarily mean, and say nothing.
 *
 * The source is handed to `validateVocabularySource`, which is the SAME function
 * `/api/validate/bundle` calls to turn a submitted `vocabulary` string into `extensions`
 * (its `extensionsFrom`). Parsing the YAML here and calling `parseOntologyTerms` myself
 * would be a second composition of the two, and the one thing AC1 measures is that the
 * CLI and the route compose the engine identically.
 *
 * A vocabulary that does not parse yields `undefined` terms and is left silent, which is
 * `/api/validate/bundle`'s recorded gap reproduced deliberately rather than overlooked:
 * the server scores a broken overlay against the curated core alone and tells the caller
 * nothing. AC1 measures the CLI against the server, not against what the server should do.
 */
function readVocabulary(
  root: string,
  entries: readonly string[],
): { extensions: readonly OntologyTerm[] | undefined; conflict: Diagnostic | undefined } {
  const flatName = entries.find((name) => FLAT_VOCABULARY_NAME.test(name));
  const nested = readFileIn(root, ONTOLOGY_EXTENSIONS_FILE);
  const flat = flatName === undefined ? undefined : readFileIn(root, flatName);

  if (nested !== undefined && flat !== undefined && nested !== flat) {
    return {
      extensions: undefined,
      conflict: error(
        /* The engine's own code for a complaint about this document: `validateVocabularySource`
           reports a vocabulary it cannot read as `card/parse-error` against the same file. A
           second opinion about which namespace a vocabulary complaint lives in would be a new
           code nobody owns, and D-270-04(3) rules this travels as an ordinary Diagnostic. */
        "card/parse-error",
        `This bundle carries two different local vocabularies, at \`${ONTOLOGY_EXTENSIONS_FILE}\` and \`${flatName}\`. Neither was used, because choosing one would score the blueprint against terms you may not have meant.`,
        {
          hint: `Delete one of the two files, or make them identical.`,
          location: { file: ONTOLOGY_EXTENSIONS_FILE },
        },
      ),
    };
  }

  const text = nested ?? flat;
  if (text === undefined) return { extensions: undefined, conflict: undefined };
  return { extensions: validateVocabularySource(text).terms, conflict: undefined };
}

/**
 * D-270-02 D3's stub, for a directory carrying no manifest.
 *
 * `ontologyVersion` is the behaviour-bearing member and the only one the diagnostics path
 * reads: `resolveBundle` compares it against the view's version for `bundle/ontology-mismatch`
 * and against each card's, and nothing else in `loadBundle` touches the manifest at all.
 * `slug`, `title` and `summary` are read by `emitAttractorDot` and `buildRegistry`, neither
 * of which runs here. Measured against the tree rather than reasoned about, because it is
 * the premise AC1's byte-identity rests on.
 */
function stubManifest(root: string): BundleManifest {
  const name = basename(root);
  return {
    slug: slugFrom(name) || "untitled-blueprint",
    title: name,
    summary: "",
    tags: [],
    ontologyVersion: CORE_ONTOLOGY.version,
  };
}

/**
 * `slugify` from `components/upload/BundleDropzone.tsx:322`, copied.
 *
 * A copy is the defect this run charges most often, so the reason is stated rather than
 * left to be discovered: that module is `"use client"`, imports React and
 * `@/components/ui/Button`, and `components/**` is Forbidden here — so it can be neither
 * imported into a Node distributable nor moved somewhere isomorphic by this task.
 * D-270-02 D3 names `slugify(dirname)` without a citable source, and this is the gap
 * reported rather than papered over.
 *
 * What the copy cannot cost: `manifest.slug` is read by nothing on the diagnostics path,
 * and `validate`'s published return carries no manifest, so a drift between these two
 * bodies is unobservable through every live criterion. That is the reason it is tolerable
 * today and not a reason it should stay.
 */
function slugFrom(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A manifest document, with the stub's values standing in for every key it omits.
 *
 * Merged rather than replaced, because a folder carrying a manifest that names only a
 * title is the wizard's normal case and refusing it would make `validate` stricter than
 * the upload it is meant to agree with.
 */
function readManifest(root: string, file: string, stub: BundleManifest): BundleManifest {
  const text = readFileIn(root, file);
  if (text === undefined) return stub;

  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch (cause) {
    throw new CliError(`validate: \`${file}\` is not a document I can read.`, { cause });
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return stub;

  const fields = doc as Record<string, unknown>;
  const text_ = (key: string): string | undefined => {
    const value = fields[key];
    return typeof value === "string" && value.trim() !== "" ? value : undefined;
  };

  const manifest: BundleManifest = {
    slug: text_("slug") ?? stub.slug,
    title: text_("title") ?? stub.title,
    summary: text_("summary") ?? stub.summary,
    tags: Array.isArray(fields.tags) ? fields.tags.filter((t): t is string => typeof t === "string") : stub.tags,
    ontologyVersion: text_("ontologyVersion") ?? stub.ontologyVersion,
  };

  const description = text_("description");
  if (description !== undefined) manifest.description = description;
  const category = text_("category");
  if (category !== undefined) manifest.category = category;
  const author = text_("author");
  if (author !== undefined) manifest.author = author;
  const createdAt = text_("createdAt");
  if (createdAt !== undefined) manifest.createdAt = createdAt;
  const updatedAt = text_("updatedAt");
  if (updatedAt !== undefined) manifest.updatedAt = updatedAt;

  return manifest;
}
