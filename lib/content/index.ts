/* ============================================================
   DarkPrint content — the public API
   The join of the two halves of §5: the immutable archive under
   `content/` and the mutable index in `lib/data/community.ts`.
   Everything is read and derived once, at module scope, at build
   time; every function below is a lookup into that one result.

   SERVER ONLY — it pulls in `./read`, which touches the filesystem.
   `./layout` is the client-safe piece and may be imported directly.
   ============================================================ */

import type { Blueprint } from "@/lib/types";
import {
  buildRegistry,
  cardRef as makeCardRef,
  parseCardRef,
  type CardRef,
  type CardVersionRecord,
  type OntologyView,
  type Registry,
} from "@/lib/core";
import { communityFor } from "@/lib/data/community";
import { BUNDLE_VOCABULARY, localTermsUsed } from "./bundle-export";
import { contentOntology, contentVocabulary, readContent } from "./read";
import { toBlueprintView } from "./view";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-04) (cited at line 169): GET /api/blueprints/{slug}/source

/** The raw text behind a bundle, for the "source" panels. */
export interface BundleSource {
  dot: string;
  cards: { file: string; text: string }[];
}

/** The local vocabulary a bundle carries, when its cards declare one (doc 3 §7). */
export interface BundleVocabulary {
  /** Bundle-relative name, which is also the name the download writes it under. */
  file: string;
  text: string;
  /** The ids this bundle's cards actually declare, sorted. */
  termIds: readonly string[];
}

/* --------------------- one derivation, memoized --------------------- */

interface Content {
  blueprints: Blueprint[];
  bySlug: Map<string, Blueprint>;
  registry: Registry;
  ontology: OntologyView;
  sources: Map<string, BundleSource>;
  vocabularies: Map<string, BundleVocabulary>;
  cardText: Map<CardRef, string>;
}

let content: Content | undefined;

function build(): Content {
  const loaded = readContent();

  const blueprints = loaded
    .map((entry) =>
      toBlueprintView({
        blueprint: entry.blueprint,
        analysis: entry.analysis,
        community: communityFor(entry.slug),
        diagnostics: entry.diagnostics,
      }),
    )
    // Slug order: the same total order `registry.blueprints()` uses, so a page that
    // walks one and indexes into the other never has to think about it. Curated
    // orderings (featured first, newest first) are the gallery's business, not the
    // loader's.
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  const sources = new Map<string, BundleSource>();
  const vocabularies = new Map<string, BundleVocabulary>();
  const cardText = new Map<CardRef, string>();
  // Doc 3 §7. The same question the exporter asks, asked once here so a page linking the
  // file and the generator writing it cannot disagree about which bundles have one.
  const vocabulary = contentVocabulary();
  for (const entry of loaded) {
    sources.set(entry.slug, {
      dot: entry.bundle.dot,
      cards: entry.cardFiles.map((card) => ({ file: card.path, text: card.text })),
    });

    if (vocabulary !== undefined) {
      const used = localTermsUsed({
        blueprint: entry.blueprint,
        analysis: entry.analysis,
        cards: [],
        vocabulary: { text: vocabulary.text, terms: vocabulary.terms },
      });
      if (used.length > 0) {
        vocabularies.set(entry.slug, {
          file: BUNDLE_VOCABULARY,
          text: vocabulary.text,
          termIds: used.map((term) => term.id),
        });
      }
    }
    // A card shared by two blueprints is one file in the library, so the second write
    // is the same bytes as the first (§4: a published version is immutable).
    for (const card of entry.cardFiles) {
      const ref = card.file.replace(/^cards\//, "").replace(/\.yaml$/, "");
      cardText.set(ref, card.text);
    }
  }

  return {
    blueprints,
    bySlug: new Map(blueprints.map((b) => [b.slug, b])),
    registry: buildRegistry(loaded.map((entry) => entry.blueprint)),
    ontology: contentOntology(),
    sources,
    vocabularies,
    cardText,
  };
}

function get(): Content {
  if (content === undefined) content = build();
  return content;
}

/* --------------------- blueprints --------------------- */

/** Every blueprint in the archive, as the UI's view model, sorted by slug. */
export function allBlueprints(): Blueprint[] {
  return get().blueprints;
}

export function getBlueprintBySlug(slug: string): Blueprint | undefined {
  return get().bySlug.get(slug);
}

/* --------------------- node cards --------------------- */

/** The newest version of every distinct card id, sorted by id. */
export function allNodeCards(): CardVersionRecord[] {
  return [...get().registry.latestCards()];
}

/** One card. Without a version, the newest one published. */
export function getNodeCard(id: string, version?: string): CardVersionRecord | undefined {
  const registry = get().registry;
  if (version !== undefined) return registry.card(makeCardRef(id, version));
  // `versionsOf` is newest-first, so the head is the current version.
  return registry.versionsOf(id)[0];
}

/** Every published version of one card id, newest first. */
export function nodeCardVersions(id: string): CardVersionRecord[] {
  return [...get().registry.versionsOf(id)];
}

/* --------------------- the index and the vocabulary --------------------- */

export function getRegistry(): Registry {
  return get().registry;
}

export function getOntologyView(): OntologyView {
  return get().ontology;
}

/* --------------------- raw source --------------------- */

/** The DOT and every card document a blueprint pins, verbatim. */
export function bundleSource(slug: string): BundleSource {
  return get().sources.get(slug) ?? { dot: "", cards: [] };
}

/**
 * The local vocabulary this bundle's cards declare, or `undefined` when they declare none.
 *
 * The download carries this file whenever it is defined, because a folder holding a card
 * that names `lupo/pii-handling` and no definition for it does not resolve to the numbers
 * its own README prints.
 */
export function bundleVocabulary(slug: string): BundleVocabulary | undefined {
  return get().vocabularies.get(slug);
}

/**
 * One card document, verbatim. Accepts a pinned `id@version` ref, or a bare id — in
 * which case the newest version the archive carries is returned, which is what a
 * `/nodes/[...id]` route without a version segment means.
 */
export function cardSource(ref: string): string | undefined {
  const { cardText, registry } = get();
  const direct = cardText.get(ref);
  if (direct !== undefined) return direct;
  // A pinned ref that is not on hand names a card the archive does not carry; there is
  // no newer version of it to fall back to, so say so rather than guess at a filename.
  if (parseCardRef(ref) !== undefined) return undefined;
  const newest = registry.versionsOf(ref)[0];
  return newest === undefined ? undefined : cardText.get(newest.ref);
}
