/* ============================================================
   DarkPrint backend — graphsOf()
   D-260-14: `/blueprints` draws a schematic on every row and no
   published surface carried one. `BlueprintSummary` is the index's
   answer and the drawing is not part of it — a record carrying a
   DOT topology would make every reader pay for one — so the
   drawing is a reader of its own (D-132-01).

   ── BATCH, and that is the whole point ──
   A client-side-filtering shelf needs a schematic for EVERY tile on
   EVERY request, so a per-blueprint reader would be N calls where
   this is one.

   **The statement count, stated exactly rather than as "no extra
   queries", which is what the first draft of this comment claimed
   and is false.** `loadSnapshot`'s four, plus ONE PER DISTINCT
   ONTOLOGY VERSION, and nothing per blueprint. The reassembly
   material really is free — `loadSnapshot` already selects whole
   `release` and `card_version` rows, so the DOT, the local
   vocabulary and the archived YAML are in hand by the time the
   index is built and `ReleaseSource` only stops them being dropped.
   The ONTOLOGY is not free: `openView` reads its version row, and
   it deliberately holds no module-scope cache (its own header says
   a cache is T080's projection concern, which is `ViewCache`
   below). So the total is `4 + K` where K counts distinct base
   versions among releases with no overlay, plus one for each
   release that has one. K is 1 on today's corpus and is bounded by
   N in the worst case; it is never zero when anything is drawn.

   ── it consumes the current-release rule, it does not restate it ──
   Which release a blueprint IS is D-80-03's decision and it is
   made once, in `loadSnapshot`. `ReleaseSource` exists so this
   file can read that decision's output instead of issuing a second
   query and sorting the result again (D-132-01: extract, never
   duplicate). Nothing here mentions semver or a row id.

   ── why `resolveBundle` rather than `loadBundle` (D-132-02 C-9) ──
   `export/build.ts` is the merged reassembly this follows, and it
   calls `loadBundle`, which is `resolveBundle` plus
   `analyzeBlueprint` plus a diagnostic merge. It needs the analysis
   as a fallback for the folder's README; this reader returns no
   analysis and would discard all of it. Ruled: take `resolveBundle`.
   The decision that must not be duplicated is which release, which
   cards and which ontology — all three are consumed above — and
   dropping a scoring pass duplicates none of them.

   ── every failure is a VALUE ──
   An absent entry means one of: no such key, a bundle this actor
   may not see, a release naming an ontology version nobody
   published, a local vocabulary the column's one reader refuses, or
   a bundle that does not resolve. A caller drawing a shelf can do
   nothing with the difference and a caller who could tell them
   apart has the existence oracle B-03 closed. So this module
   publishes no class of its own, and `error-hygiene` does not move.

   **A store fault is NOT folded into that.** `openView` reads
   Postgres, and answering "no schematic" for a driver failure would
   turn an outage into a shelf that quietly draws nothing. Only
   `UnknownOntologyVersionError` — a fact about the release — is
   caught; everything else reaches `withRegistryStore` and leaves as
   `RegistryStoreError`.
   ============================================================ */

import { graphForBlueprint, requiredAgents, requiredTools } from "@/lib/graph-seed";
import {
  hasErrors,
  resolveBundle,
  type Bundle,
  type CardRef,
  type OntologyTerm,
  type OntologyView,
} from "@/lib/core";
import { cardFilePath } from "@/lib/content/bundle-export";
import type { Db } from "@/lib/db";
import { parseStoredVocabulary } from "@/lib/server/archive";
import { UnknownOntologyVersionError, openView } from "@/lib/server/ontology";
import type { Actor } from "@/lib/server/policy";
import type { BlueprintKey, BlueprintSchematic, BlueprintSummary } from "./types";
import { keyOf, loadSnapshot, type ReleaseSource } from "./snapshot";
import { withRegistryStore } from "./store";

/**
 * The schematic of every requested blueprint this actor may see and this registry can
 * resolve, keyed `${ownerHandle}/${slug}`.
 *
 * **An absent entry is an answer, not a refusal.** A key nothing holds, a bundle the caller
 * may not read and a release that does not reassemble are one value, for B-03's reason: a
 * caller able to tell them apart has the existence oracle the 404 was closing.
 *
 * Duplicate keys in `keys` are one entry. An empty `keys` answers an empty map without
 * issuing a statement, the way `countNamespacedTerms` treats an empty slug list.
 */
export async function graphsOf(
  db: Db,
  actor: Actor,
  keys: readonly BlueprintKey[],
): Promise<ReadonlyMap<string, BlueprintSchematic>> {
  return withRegistryStore("graphsOf", () => readGraphs(db, actor, keys));
}

/**
 * The body, so the store boundary above is one line. Every caller-supplied string reaches
 * only a Map lookup — the operation handed to `withRegistryStore` is a literal, so no
 * handle or slug can enter a rendering (D-13).
 */
async function readGraphs(
  db: Db,
  actor: Actor,
  keys: readonly BlueprintKey[],
): Promise<ReadonlyMap<string, BlueprintSchematic>> {
  const drawn = new Map<string, BlueprintSchematic>();
  if (keys.length === 0) return drawn;

  const snapshot = await loadSnapshot(db, actor);

  /* Narrowed to what the index holds BEFORE any work is done, and de-duplicated by the
     same key the answer is returned under. A key the snapshot does not hold is invisible,
     unpublished or unknown, and all three are the same absent entry. */
  const wanted = new Map<string, { release: ReleaseSource; summary: BlueprintSummary }>();
  for (const key of keys) {
    const k = keyOf(key);
    const release = snapshot.releaseByKey.get(k);
    const summary = snapshot.byKey.get(k);
    if (release !== undefined && summary !== undefined) wanted.set(k, { release, summary });
  }

  const views = new ViewCache(db);
  for (const [key, { release, summary }] of wanted) {
    const schematic = await draw(views, release, summary, snapshot.sourceByRef);
    if (schematic !== undefined) drawn.set(key, schematic);
  }
  return drawn;
}

/** One blueprint reassembled and drawn, or `undefined` if it does not resolve. */
async function draw(
  views: ViewCache,
  release: ReleaseSource,
  summary: BlueprintSummary,
  sourceByRef: ReadonlyMap<CardRef, string>,
): Promise<BlueprintSchematic | undefined> {
  /* The column's ONE published reading (T133), consumed rather than re-derived — a second
     opinion about `release.local_vocabulary` here is the defect that task exists to end.
     A row it refuses makes this blueprint unresolvable, which is an absent entry: the
     overlay is what its cards' terms resolve against, so drawing it against the bare core
     would silently draw a different graph from the one the site scored. */
  let overlay;
  try {
    overlay = parseStoredVocabulary(release.vocabulary, "graphsOf");
  } catch {
    return undefined;
  }

  const ontology = await views.open(release.manifest.ontologyVersion, overlay?.terms);
  if (ontology === undefined) return undefined;

  /* `summary.cardRefs` rather than the release's own `card_refs`, and that is correctness
     and not convenience. The stored column holds the pins AS WRITTEN, and two blueprints
     may spell one pin differently because `parseCardRef` trims — `snapshot.ts` canonicalises
     every pin to `id@version` before keying the index on it, so a padded spelling misses
     `sourceByRef` entirely and would also put its padding into the filename below, which is
     the defect `serve-card.ts` records for building a path out of the caller's spelling.
     `cardRefs` is that canonical set already, narrowed to the rows this actor may read.

     A pin whose card is private to someone else is therefore absent, and the DOT node that
     instantiated it has no card file — `resolveBundle` reports `bundle/missing-card` at
     error severity and the blueprint answers absent. That is the honest end state rather
     than a partial drawing: a schematic short a node is a different factory, and AC6
     forbids the alternative. Order is immaterial here in a way it is not in
     `export/build.ts`: `resolveBundle` reads the topology from the DOT and sorts its
     diagnostics, so nothing downstream of this record depends on which pin came first. */
  const cardFiles: Record<string, string> = {};
  for (const ref of summary.cardRefs) {
    const text = sourceByRef.get(ref);
    if (text === undefined) continue;
    cardFiles[cardFilePath(ref)] = text;
  }

  const bundle: Bundle = { manifest: release.manifest, dot: release.dot, cardFiles };
  const resolved = resolveBundle(bundle, ontology);
  /* Both halves, and the second is not redundant: `resolveBundle` returns a blueprint for
     a bundle carrying error diagnostics, and `readContent()` refuses to ship one. A stored
     release is held to the same bar, which is `build.ts`'s rule read one line further. */
  if (resolved.blueprint === undefined || hasErrors(resolved.diagnostics)) return undefined;

  return Object.freeze({
    /* `cardsInRegistry: true` — the archive path, and the only caller that can promise a
       page exists behind every card ref (`GraphSeedOptions`). Every card drawn here came
       out of the registry index by construction, so the promise is one this reader can
       make and the upload wizard's cannot. */
    graph: graphForBlueprint(resolved.blueprint, { cardsInRegistry: true }),
    requiredAgents: Object.freeze(requiredAgents(resolved.blueprint)),
    requiredTools: Object.freeze(requiredTools(resolved.blueprint)),
  });
}

/**
 * One merged view per distinct base version, for the releases that add nothing to the core.
 *
 * `openView` deliberately holds no module-scope cache — that would serve two callers
 * different vocabularies under one version and its own header says a cache is T080's
 * projection concern, which is this. The cache is per CALL and never outlives it, so a
 * release published mid-batch cannot change what a request already drew.
 *
 * **Keyed on the version alone, and only for an absent overlay.** A local vocabulary makes
 * the merged view specific to that release, and a key built by serialising the overlay
 * would be a content digest of caller-adjacent data written for a cache — more moving parts
 * than the case is worth. Overlays are the minority (most bundles add nothing to the
 * curated core) and they pay one read each.
 */
class ViewCache {
  private readonly db: Db;
  /** `undefined` is a cached ANSWER — a version nobody published stays unpublished. */
  private readonly base = new Map<string, OntologyView | undefined>();

  constructor(db: Db) {
    this.db = db;
  }

  async open(
    version: string,
    terms: readonly OntologyTerm[] | undefined,
  ): Promise<OntologyView | undefined> {
    if (terms !== undefined && terms.length > 0) return this.read(version, terms);
    /* `has` before the value, not `?? read()`: `undefined` IS the cached answer for an
       unpublished version, so a nullish test would re-read it once per blueprint. */
    if (this.base.has(version)) return this.base.get(version);
    const view = await this.read(version, undefined);
    this.base.set(version, view);
    return view;
  }

  private async read(
    version: string,
    terms: readonly OntologyTerm[] | undefined,
  ): Promise<OntologyView | undefined> {
    try {
      return await openView(this.db, version, terms);
    } catch (err) {
      /* A release naming a version nobody published is a FACT ABOUT THE RELEASE and an
         absent entry. Anything else is the ontology read failing — the same distinction
         `build.ts` draws at its own `openView` — and it must not be dressed as "this
         blueprint has no schematic", so it leaves for `withRegistryStore` to seal. */
      if (err instanceof UnknownOntologyVersionError) return undefined;
      throw err;
    }
  }
}
