/* ============================================================
   DarkPrint content — the archive reader
   The ONLY module in the repo that touches the filesystem. It walks
   `content/`, assembles one `Bundle` per blueprint by pulling exactly
   the cards that blueprint's DOT pins out of the shared library, and
   hands each to the engine.

   SERVER ONLY, BUILD TIME ONLY. Every page is statically generated, so
   this runs once per build and never in a request or a browser. It is
   also the one place allowed to throw: a bundle whose diagnostics carry
   an error is broken content, and broken content must fail the build
   rather than ship a blueprint the engine could not vouch for.
   Design doc §5.1, content spec "lib/content/ — the loader".
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import {
  CORE_ONTOLOGY,
  cardRef,
  hasErrors,
  loadBundle,
  ontologyView,
  parseCardRef,
  parseDot,
  sortDiagnostics,
  type BlueprintAnalysis,
  type Bundle,
  type BundleManifest,
  type CardRef,
  type Diagnostic,
  type OntologyTerm,
  type OntologyView,
  type ResolvedBlueprint,
} from "@/lib/core";
import { parseOntologyTerms } from "./ontology-file";

/*
 * The `server-only` package would be the idiomatic guard here, but it is not in the
 * dependency set and the loader is not allowed to add one. This is the same promise
 * enforced by hand: importing the module in a browser bundle fails immediately and
 * loudly instead of at the first `readFileSync`.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "lib/content/read.ts is build-time only — it reads the archive off disk. Import lib/content from a server component instead.",
  );
}

/* --------------------- where the archive lives --------------------- */

const CONTENT_DIR = join(process.cwd(), "content");
const BLUEPRINTS_DIR = join(CONTENT_DIR, "blueprints");
const CARDS_DIR = join(CONTENT_DIR, "cards");

/** Bundle-relative names. The engine reports diagnostics against these. */
const MANIFEST_FILE = "blueprint.yaml";
const DOT_FILE = "blueprint.dot";
const CARD_PREFIX = "cards/";

/**
 * Doc 3 §7 — the archive's own namespaced vocabulary, layered over the curated core.
 * Repo-relative because that is what a diagnostic has to name for an editor to open it.
 */
const EXTENSIONS_FILE = "content/ontology/extensions.yaml";
const EXTENSIONS_PATH = join(CONTENT_DIR, "ontology", "extensions.yaml");

/* --------------------- what a read produces --------------------- */

/** One card document as the bundle carries it: bundle-relative name plus source text. */
export interface BundleCardFile {
  /** e.g. "cards/schema-gate@1.1.0.yaml" — the name diagnostics use. */
  file: string;
  /** Repo-relative path the file was actually read from. */
  path: string;
  text: string;
}

/** One blueprint, read off disk and put through `loadBundle`. */
export interface LoadedBundle {
  slug: string;
  /** Repo-relative directory, for diagnostics and the source panels. */
  dir: string;
  bundle: Bundle;
  blueprint: ResolvedBlueprint;
  analysis: BlueprintAnalysis;
  /** Everything the engine had to say. Guaranteed free of errors, or we threw. */
  diagnostics: readonly Diagnostic[];
  /** The card documents this bundle pins, in the order the DOT declares them. */
  cardFiles: readonly BundleCardFile[];
}

/* --------------------- the memoized read --------------------- */

/**
 * One ontology view for the whole build: the curated core with `content/ontology/
 * extensions.yaml` (doc 3 §7) layered on top. `isA` memoizes internally, so sharing the
 * view across the nine bundles is both cheaper and the only way the digests and
 * scores are computed against provably identical vocabulary.
 *
 * Built lazily and memoized rather than at module scope, so a malformed extensions file
 * fails inside `readContent()` — where the loader's other failures are reported — instead
 * of at import time, where the message would arrive without a build step to attribute it to.
 */
interface ContentOntology {
  view: OntologyView;
  /** `view.validate()`, run once: defects in the vocabulary itself (doc 3 §7). */
  diagnostics: readonly Diagnostic[];
  /** The file the local terms came from, when the archive has one. */
  vocabulary?: ContentVocabulary;
}

/**
 * The archive's own local vocabulary, as a file rather than as terms.
 *
 * The text is kept beside the parsed terms because a bundle whose cards use one of these
 * terms has to *carry* it: a folder with `lupo/pii-handling` in a card and no definition
 * for it resolves against the core alone, where that term is unknown, and the two scores
 * printed in its README cannot be recomputed. `bundle-export.ts` puts this document in
 * the download verbatim, for the same reason the cards go in verbatim.
 */
export interface ContentVocabulary {
  /** Repo-relative path, which is also the bundle-relative name it is written under. */
  file: string;
  /** The document, byte for byte. */
  text: string;
  terms: readonly OntologyTerm[];
}

let ontologyCache: ContentOntology | undefined;

let cache: readonly LoadedBundle[] | undefined;

function contentOntologyState(): ContentOntology {
  if (ontologyCache === undefined) {
    const vocabulary = readVocabulary();
    const view = ontologyView(CORE_ONTOLOGY, vocabulary?.terms ?? []);
    ontologyCache = {
      view,
      diagnostics: Object.freeze(sortDiagnostics(view.validate())),
      ...(vocabulary === undefined ? {} : { vocabulary }),
    };
  }
  return ontologyCache;
}

/**
 * `content/ontology/extensions.yaml`, or `undefined` when the archive adds nothing to the
 * curated core. The exporter asks for this so a downloaded bundle carries the vocabulary
 * its cards were read against.
 */
export function contentVocabulary(): ContentVocabulary | undefined {
  return contentOntologyState().vocabulary;
}

/** The ontology every bundle in `content/` was resolved against. */
export function contentOntology(): OntologyView {
  return contentOntologyState().view;
}

/**
 * What `OntologyView.validate()` had to say about the archive's own vocabulary.
 *
 * `loadBundle` deliberately does not fold this in — it reports defects in the vocabulary,
 * which is a different author's problem from a bundle being uploaded — so the caller that
 * *builds* the view owns surfacing them, and here that caller is the loader. Errors fail
 * the build alongside the bundles'; warnings are published here so a surface that lists a
 * bundle's diagnostics can list the vocabulary's too.
 */
export function contentOntologyDiagnostics(): readonly Diagnostic[] {
  return contentOntologyState().diagnostics;
}

/* --------------------- the local namespace (doc 3 §7) --------------------- */

/**
 * `content/ontology/extensions.yaml`, read and parsed.
 *
 * An absent file means "this archive adds nothing to the core" and is not an error: the
 * extension channel is optional, and the fixtures in `read.test.ts` exercise archives that
 * have no vocabulary of their own. A file that *is* present and ill-shaped throws, like a
 * malformed manifest: doc 3 §7's rules are checked by `OntologyView.validate()`, and it
 * cannot check terms `parseOntologyTerms` silently dropped.
 *
 * The text is kept alongside the terms so the exporter can put the same bytes in a
 * download without reading the file a second time.
 */
function readVocabulary(): ContentVocabulary | undefined {
  let text: string;
  try {
    text = readFileSync(EXTENSIONS_PATH, "utf8");
  } catch {
    return undefined;
  }

  const terms = parseOntologyTerms(parseYaml(text) as unknown, EXTENSIONS_FILE);
  return { file: EXTENSIONS_FILE, text, terms: Object.freeze(terms) };
}

/**
 * Every bundle under `content/blueprints/`, sorted by slug. Read once and memoized
 * at module scope: a static build touches this from dozens of pages and the archive
 * cannot change underneath it.
 *
 * Throws when any bundle carries an error-severity diagnostic, with every diagnostic
 * from every bundle formatted underneath — one broken file should not hide the rest.
 */
export function readContent(): readonly LoadedBundle[] {
  if (cache === undefined) cache = loadAll();
  return cache;
}

function loadAll(): readonly LoadedBundle[] {
  const loaded: LoadedBundle[] = [];
  const problems: string[] = [];

  // Doc 3 §7 — before any bundle is read, the vocabulary those bundles are read against
  // has to hold together. An unrooted local term "l'analisi statica … la ignora
  // silenziosamente, che è il peggior esito possibile": every card using it would validate
  // and every score would quietly be wrong, so a broken extension set fails the build
  // exactly like a broken bundle. Warnings are not fatal and are published through
  // `contentOntologyDiagnostics()`.
  const { view: ontology, diagnostics: ontologyDiagnostics } = contentOntologyState();
  if (hasErrors(ontologyDiagnostics)) {
    problems.push(...ontologyDiagnostics.map((d) => formatDiagnostic(d, EXTENSIONS_FILE)));
  }

  for (const slug of blueprintSlugs()) {
    const dir = `content/blueprints/${slug}`;
    let assembled: { bundle: Bundle; cardFiles: BundleCardFile[] };
    try {
      assembled = assembleBundle(slug, dir);
    } catch (e) {
      problems.push(`${dir}  ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const result = loadBundle(assembled.bundle, { ontology });
    const diagnostics = sortDiagnostics(result.diagnostics);
    const report = diagnostics.map((d) => formatDiagnostic(d, dir));

    if (result.blueprint === undefined || result.analysis === undefined) {
      problems.push(`${dir}  the bundle could not be resolved at all.`, ...report);
      continue;
    }
    if (hasErrors(diagnostics)) {
      problems.push(...report);
      continue;
    }

    loaded.push({
      slug,
      dir,
      bundle: assembled.bundle,
      blueprint: result.blueprint,
      analysis: result.analysis,
      diagnostics,
      cardFiles: assembled.cardFiles,
    });
  }

  if (problems.length > 0) {
    throw new Error(
      [
        `DarkPrint content is broken: ${problems.length} problem${problems.length === 1 ? "" : "s"} under content/.`,
        "",
        ...problems,
        "",
        "Fix the archive — a blueprint the engine cannot vouch for must not ship.",
      ].join("\n"),
    );
  }

  return Object.freeze(loaded);
}

/* --------------------- assembling one bundle --------------------- */

/** Directory names under `content/blueprints/`, sorted, so the read order is stable. */
function blueprintSlugs(): string[] {
  return readdirSync(BLUEPRINTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Join one blueprint directory to the shared card library.
 *
 * Only the refs the DOT actually pins are pulled in, which is what keeps the loader
 * from manufacturing its own `bundle/orphan-card` warnings: the library holds 50-odd
 * cards and each blueprint instantiates seven or eight of them. A pinned card that is
 * missing from the library is deliberately *not* reported here — it is left out of
 * `cardFiles` so the engine raises `bundle/missing-card` against the exact DOT line,
 * which is a better message than anything this function could write.
 */
function assembleBundle(
  slug: string,
  dir: string,
): { bundle: Bundle; cardFiles: BundleCardFile[] } {
  const dot = read(join(BLUEPRINTS_DIR, slug, DOT_FILE), `${dir}/${DOT_FILE}`);
  const manifestText = read(join(BLUEPRINTS_DIR, slug, MANIFEST_FILE), `${dir}/${MANIFEST_FILE}`);
  const manifest = toManifest(parseYaml(manifestText) as unknown, `${dir}/${MANIFEST_FILE}`);

  if (manifest.slug !== slug) {
    throw new Error(
      `${MANIFEST_FILE} declares slug \`${manifest.slug}\`, but it sits in a directory called \`${slug}\`.`,
    );
  }

  const cardFiles: BundleCardFile[] = [];
  const cardTexts: Record<string, string> = {};
  for (const ref of pinnedRefs(dot)) {
    const file = `${CARD_PREFIX}${ref}.yaml`;
    const path = `content/cards/${ref}.yaml`;
    let text: string;
    try {
      text = readFileSync(join(CARDS_DIR, `${ref}.yaml`), "utf8");
    } catch {
      continue;
    }
    cardTexts[file] = text;
    cardFiles.push({ file, path, text });
  }

  return { bundle: { manifest, dot, cardFiles: cardTexts }, cardFiles };
}

/**
 * The card refs a DOT pins, deduplicated, in node-declaration order. Both pointer
 * forms of §8 are honoured — `card="id@version"` and the fallback `version="…"` on a
 * node whose id doubles as the card id. Parse diagnostics are ignored here on
 * purpose: `resolveBundle` parses the same source again and reports them properly.
 */
function pinnedRefs(dot: string): CardRef[] {
  const parsed = parseDot(dot, DOT_FILE);
  if (parsed.graph === undefined) return [];

  const refs: CardRef[] = [];
  const seen = new Set<CardRef>();
  for (const node of parsed.graph.nodes) {
    const explicit = Object.prototype.hasOwnProperty.call(node.attrs, "card")
      ? node.attrs.card
      : undefined;
    const version = Object.prototype.hasOwnProperty.call(node.attrs, "version")
      ? node.attrs.version
      : undefined;
    const raw = explicit ?? (version === undefined ? undefined : cardRef(node.id, version.trim()));
    if (raw === undefined) continue;
    const parsedRef = parseCardRef(raw);
    if (parsedRef === undefined) continue;
    const ref = cardRef(parsedRef.id, parsedRef.version);
    if (seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
  }
  return refs;
}

/* --------------------- the manifest --------------------- */

/**
 * `BundleManifest` off a YAML document. The engine never sees an ill-shaped manifest:
 * unlike a card, it has no validator of its own, so anything wrong here throws before
 * `loadBundle` is even called.
 */
function toManifest(value: unknown, file: string): BundleManifest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${file} is not a YAML mapping.`);
  }
  const doc = value as Record<string, unknown>;

  const manifest: BundleManifest = {
    slug: requireString(doc, "slug", file),
    title: requireString(doc, "title", file),
    summary: requireString(doc, "summary", file),
    tags: requireStringList(doc, "tags", file),
    ontologyVersion: requireString(doc, "ontologyVersion", file),
  };
  const description = optionalString(doc, "description", file);
  if (description !== undefined) manifest.description = description;
  const category = optionalString(doc, "category", file);
  if (category !== undefined) manifest.category = category;
  const author = optionalString(doc, "author", file);
  if (author !== undefined) manifest.author = author;
  const createdAt = optionalString(doc, "createdAt", file);
  if (createdAt !== undefined) manifest.createdAt = createdAt;
  const updatedAt = optionalString(doc, "updatedAt", file);
  if (updatedAt !== undefined) manifest.updatedAt = updatedAt;
  return manifest;
}

function requireString(doc: Record<string, unknown>, key: string, file: string): string {
  const raw = doc[key];
  // YAML happily reads `ontologyVersion: 1.0.0` as a string but `1.0` as a number,
  // and a version is a string either way — coercing beats an error nobody expects.
  if (typeof raw === "number") return String(raw);
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${file} is missing a \`${key}\`, or it is not a non-empty string.`);
  }
  return raw;
}

function optionalString(
  doc: Record<string, unknown>,
  key: string,
  file: string,
): string | undefined {
  if (doc[key] === undefined || doc[key] === null) return undefined;
  return requireString(doc, key, file);
}

function requireStringList(doc: Record<string, unknown>, key: string, file: string): string[] {
  const raw = doc[key];
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    throw new Error(`${file} has a \`${key}\` that is not a list of strings.`);
  }
  return raw as string[];
}

/* --------------------- reporting --------------------- */

function read(path: string, label: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Error(`${label} is missing or unreadable.`);
  }
}

/**
 * One diagnostic as a build log wants it: where, how bad, which rule, what is wrong,
 * and what to do about it. The bundle-relative file the engine reports is rewritten to
 * the repo-relative path, because that is the thing an editor can open.
 */
function formatDiagnostic(d: Diagnostic, dir: string): string {
  const location = d.location ?? {};
  const file =
    location.file === undefined
      ? dir
      : location.file.startsWith(CARD_PREFIX)
        ? `content/${location.file}`
        : `${dir}/${location.file}`;
  const line = location.line === undefined ? "" : `:${location.line}`;
  const column = location.column === undefined ? "" : `:${location.column}`;

  const where: string[] = [];
  if (location.nodeId !== undefined) where.push(`node ${location.nodeId}`);
  if (location.edge !== undefined) where.push(`edge ${location.edge.source} -> ${location.edge.target}`);
  if (location.cardRef !== undefined) where.push(`card ${location.cardRef}`);
  if (location.path !== undefined) where.push(location.path);

  const head = `${file}${line}${column}  ${d.severity}  ${d.code}${where.length > 0 ? `  (${where.join(", ")})` : ""}`;
  const body = [`    ${d.message}`];
  if (d.hint !== undefined) body.push(`    hint: ${d.hint}`);
  return [head, ...body].join("\n");
}
