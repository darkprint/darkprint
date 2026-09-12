/* ============================================================
   DarkPrint core — the queryable index
   The database half of doc 1 §5: a pure, in-memory index over
   already resolved blueprints — which card, which version, which
   blueprints pin it, plus the tags, phases and searches the
   gallery runs. Doc 1 §5.2 draws the line this file sits on: the
   immutable content lives in the hash-keyed store (`store.ts`),
   the search metadata lives here.

   Phase coverage (doc 2 §8, doc 3 §2) is indexed here too. Doc 2
   §8 makes it a gallery badge and a `/nodes` filter, which means
   it has to be a query, not a per-page scan. It is **descriptive,
   never a score** (doc 2 §1.1): nothing this file returns counts,
   ranks or completes the five phases.
   ============================================================ */

import { parseCardRef, type CardRef, type NodeCard } from "../card/schema";
import { canonicalJson } from "../hash/canonical";
import { CORE_PHASE_IDS } from "../ontology/core";
import { compareVersionStrings } from "../version/semver";

import type { BundleManifest, ResolvedBlueprint } from "../bundle/types";

/** One published version of one card, plus the blueprints that pin it. */
export interface CardVersionRecord {
  ref: CardRef;
  id: string;
  version: string;
  digest: string;
  card: NodeCard;
  /** Blueprint slugs that pin this exact version, distinct and sorted. */
  usedIn: string[];
}

/**
 * A card published without a blueprint, as `buildRegistry` takes it.
 *
 * It carries its own digest because nothing resolved it: a pinned card's identity comes off
 * the node that pins it, and this is the same shape for a card no node does.
 */
export interface LooseCard {
  ref: CardRef;
  card: NodeCard;
  digest: string;
}

/** One blueprint as the index sees it: its searchable metadata and its pins. */
export interface BlueprintRecord {
  slug: string;
  manifest: BundleManifest;
  digest: string;
  /** Refs of every card it pins, distinct and sorted. */
  cardRefs: CardRef[];
}

/** The read-only query surface of §5.2. Every method is O(1) or a scan over precomputed data. */
export interface Registry {
  /** Every blueprint, sorted by slug. */
  blueprints(): readonly BlueprintRecord[];
  blueprint(slug: string): BlueprintRecord | undefined;
  /** All card versions, sorted by id then version descending. */
  cards(): readonly CardVersionRecord[];
  /** Every version of one card id, newest first. */
  versionsOf(id: string): readonly CardVersionRecord[];
  /** The newest version of every distinct card id, sorted by id. */
  latestCards(): readonly CardVersionRecord[];
  card(ref: CardRef): CardVersionRecord | undefined;
  /** Blueprint slugs using any version of `id`, sorted. */
  usersOf(id: string): readonly string[];
  /**
   * Cards that say the same thing under different refs — §4 dedup made visible.
   * Groups of two or more, ordered as in `cards()`.
   */
  duplicates(): readonly (readonly CardVersionRecord[])[];
  /**
   * The phases the indexed cards declare, in doc 3 §2's lifecycle order — planning,
   * implementation, testing, debugging, deployment — and never alphabetical: the order
   * is the shape of a factory, so sorting it by id would say something false about it.
   *
   * Doc 2 §8's "copertura di fase", made queryable. Descriptive, not a score (doc 2 §1.1):
   * this is the set of phases that are here, not a fraction of five.
   */
  phases(): readonly string[];
  /**
   * Every card version declaring `phase`, in the same order as `cards()`. Empty — and
   * frozen — for a phase no indexed card declares, which is a fact about the index and
   * not an error.
   *
   * The buckets cover `cards()` without partitioning it: a card may declare several phases
   * and appear in each, and a card may declare none and appear in no bucket. The latter is
   * the normal state for an intake or a retrieval step and is never a gap, so nothing may
   * derive "cards missing a phase" from the difference against `cards()`.
   */
  cardsByPhase(phase: string): readonly CardVersionRecord[];
  /** Distinct sorted values. */
  tags(): readonly string[];
  categories(): readonly string[];
  /** Case-insensitive substring match over id/name/action/notes, in `cards()` order. */
  searchCards(query: string): readonly CardVersionRecord[];
}

/** Code-unit comparison, not `localeCompare` — the order must not depend on the host locale. */
function cmpString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Freeze in place and hand back the original binding: `Object.freeze` widens an array to
 * `readonly T[]`, which the spec's mutable `usedIn: string[]` / `cardRefs: CardRef[]` fields
 * reject. The index is shared state — nothing a query returns may be edited under it.
 */
function frozen<T>(items: T[]): T[] {
  Object.freeze(items);
  return items;
}

const NO_VERSIONS: readonly CardVersionRecord[] = frozen<CardVersionRecord>([]);
const NO_SLUGS: readonly string[] = frozen<string>([]);

/** A record still being accumulated: `usedIn` is a set until every blueprint has been seen. */
interface CardDraft {
  ref: CardRef;
  id: string;
  version: string;
  digest: string;
  card: NodeCard;
  usedIn: Set<string>;
}

/**
 * The fields that *name* a card rather than describe it. `cardDigest` hashes id and
 * version — it has to, a version is what a blueprint pins — so two distinct refs can
 * never share one. Dedup is about the content underneath the name, so `duplicates()`
 * asks the question the digest cannot: is this the same card wearing another label?
 * `author`/`provenance` are excluded for the same reason `cardDigest` excludes them.
 */
const NAMING_FIELDS: readonly (keyof NodeCard)[] = ["id", "version", "author", "provenance"];

/** The identity of a card's content, as a Map key. Falls back to `ref`, which groups nothing. */
function contentKey(card: NodeCard, ref: CardRef): string {
  const payload: Record<string, unknown> = { ...card };
  for (const field of NAMING_FIELDS) delete payload[field];
  try {
    return canonicalJson(payload);
  } catch {
    // A card whose params have no JSON form cannot be compared with anything; it is
    // its own group of one rather than a reason to fail the whole index. The `\0` is
    // written as the escape and never as a raw NUL byte: one NUL makes git and grep treat
    // the entire file as binary, so `git diff` refuses to print the patch. Same string at
    // runtime, reviewable bytes on disk.
    return `\0ref:${ref}`;
  }
}

/** Sort key for `cards()`: id ascending, then version descending so the current one leads. */
function cmpCardRecords(a: CardVersionRecord, b: CardVersionRecord): number {
  const byId = cmpString(a.id, b.id);
  if (byId !== 0) return byId;
  const byVersion = compareVersionStrings(b.version, a.version);
  if (byVersion !== 0) return byVersion;
  // Equal (or unorderable) versions still need a total order, or the index would drift.
  return cmpString(a.ref, b.ref);
}

/**
 * Index a set of resolved blueprints. Pure: the same input always yields the same order,
 * and every record and array the index owns is frozen — copy before sorting or filtering in
 * place. The `manifest` and `card` objects belong to the caller and are passed through as they
 * came, so the registry never edits its own input either.
 *
 * Two sources, and the order between them is load-bearing. Blueprints first, so a card a DOT
 * node instantiates takes its identity from the node — `bundle/orphan-card`, a card sitting
 * unreferenced INSIDE a bundle, still has no digest and no user and is still not indexed;
 * `ResolvedBlueprint.cards` keeps it for the resolver's diagnostics. Then `loose`, the cards
 * published on their own, each skipped if a blueprint already claimed its ref: a second
 * opinion about a pinned card's digest is what §4's immutability forbids, so the standalone
 * reading can never override the pinned one.
 *
 * A loose card's `usedIn` is empty, which is its true answer and not a missing one.
 */
export function buildRegistry(
  blueprints: readonly ResolvedBlueprint[],
  loose: readonly LooseCard[] = [],
): Registry {
  const drafts = new Map<CardRef, CardDraft>();
  const bySlug = new Map<string, BlueprintRecord>();

  for (const bp of blueprints) {
    const slug = bp.manifest.slug;
    // The slug is the index's primary key: the first blueprint claiming one wins and a later
    // namesake is skipped whole, so no query can ever surface two rows for the same slug.
    if (bySlug.has(slug)) continue;

    const refs = new Set<CardRef>();
    for (const node of bp.nodes) {
      refs.add(node.ref);
      let draft = drafts.get(node.ref);
      if (draft === undefined) {
        // The pinned ref is the index key, so its id/version win. A ref that does not parse
        // (resolveBundle would already have raised `bundle/unpinned-card`) falls back to the
        // card's own fields rather than dropping the row.
        const parsed = parseCardRef(node.ref);
        draft = {
          ref: node.ref,
          id: parsed?.id ?? node.card.id,
          version: parsed?.version ?? node.card.version,
          // First sighting wins: §4 makes a published ref immutable, so two blueprints
          // disagreeing about its digest is a publishing bug, not a fact to average.
          digest: node.digest,
          card: node.card,
          usedIn: new Set<string>(),
        };
        drafts.set(node.ref, draft);
      }
      draft.usedIn.add(slug);
    }

    bySlug.set(
      slug,
      Object.freeze({
        slug,
        manifest: bp.manifest,
        digest: bp.digest,
        cardRefs: frozen([...refs].sort(cmpString)),
      }),
    );
  }

  /* After the blueprint loop, never before it, and `has` rather than a blind `set`. */
  for (const entry of loose) {
    if (drafts.has(entry.ref)) continue;
    const parsed = parseCardRef(entry.ref);
    drafts.set(entry.ref, {
      ref: entry.ref,
      id: parsed?.id ?? entry.card.id,
      version: parsed?.version ?? entry.card.version,
      digest: entry.digest,
      card: entry.card,
      usedIn: new Set<string>(),
    });
  }

  const cards = frozen(
    [...drafts.values()]
      .map((d): CardVersionRecord =>
        Object.freeze({
          ref: d.ref,
          id: d.id,
          version: d.version,
          digest: d.digest,
          card: d.card,
          usedIn: frozen([...d.usedIn].sort(cmpString)),
        }),
      )
      .sort(cmpCardRecords),
  );

  const byRef = new Map<CardRef, CardVersionRecord>();
  const byId = new Map<string, CardVersionRecord[]>();
  const byContent = new Map<string, CardVersionRecord[]>();
  const byPhase = new Map<string, CardVersionRecord[]>();
  const slugsById = new Map<string, Set<string>>();

  for (const rec of cards) {
    byRef.set(rec.ref, rec);
    const versions = byId.get(rec.id);
    if (versions === undefined) byId.set(rec.id, [rec]);
    else versions.push(rec);

    const key = contentKey(rec.card, rec.ref);
    const sameContent = byContent.get(key);
    if (sameContent === undefined) byContent.set(key, [rec]);
    else sameContent.push(rec);

    // The phase dimension is optional and repeatable (the five phases describe the
    // factory, not every node), so the buckets *cover* `cards()` rather than partition it:
    // a card declaring two phases is filed under both, and a card declaring none is filed
    // under no phase at all and is not thereby incomplete. A blank entry is skipped the
    // same way `tags()` skips an empty tag — `card/unknown-phase` is the validator's to
    // report, and an index that invented a phase named "" would put it on a gallery badge.
    // The `seen` guard keeps a hand-built card that repeats a phase (which the validator
    // warns about and collapses) from being listed twice in one bucket.
    const seen = new Set<string>();
    for (const phase of rec.card.phases) {
      if (phase === "" || seen.has(phase)) continue;
      seen.add(phase);
      const samePhase = byPhase.get(phase);
      if (samePhase === undefined) byPhase.set(phase, [rec]);
      else samePhase.push(rec);
    }

    const slugs = slugsById.get(rec.id);
    if (slugs === undefined) slugsById.set(rec.id, new Set(rec.usedIn));
    else for (const slug of rec.usedIn) slugs.add(slug);
  }

  // `cards` is already id-ascending / version-descending, so each bucket inherits that order
  // and the head of a bucket is by construction the newest version.
  for (const versions of byId.values()) frozen(versions);
  const latest = frozen([...byId.values()].map((versions) => versions[0]));

  // Same inheritance for the phase buckets: built by scanning `cards` once, in its order.
  for (const bucket of byPhase.values()) frozen(bucket);

  /*
   * Doc 3 §2's lifecycle order, filtered to what is actually here. `CORE_PHASE_IDS` is the
   * canonical sequence; `byKind("phase")` could not be used because it sorts by id, which
   * would report deployment before planning.
   *
   * Judgement call: a value that is not one of the five is still reported, appended after
   * them in sorted order, rather than dropped. Doc 3 §7 closes the phase dimension and the
   * validator rejects anything else, so this branch should never fire on validated content —
   * but the index is fed by callers, and `phases()` silently omitting a bucket that
   * `cardsByPhase()` happily returns would make the gallery filter lie about its own rows.
   */
  const unplaced = new Set(byPhase.keys());
  const orderedPhases: string[] = [];
  for (const id of CORE_PHASE_IDS) {
    if (unplaced.delete(id)) orderedPhases.push(id);
  }
  const phases = frozen([...orderedPhases, ...[...unplaced].sort(cmpString)]);

  const users = new Map<string, readonly string[]>();
  for (const [id, slugs] of slugsById) users.set(id, frozen([...slugs].sort(cmpString)));

  // Group order follows first appearance in `cards()`, which is itself sorted — no extra key.
  const dups = frozen(
    [...byContent.values()].filter((group) => group.length > 1).map((group) => frozen(group)),
  );

  const blueprintRecords = frozen([...bySlug.values()].sort((a, b) => cmpString(a.slug, b.slug)));

  const tagSet = new Set<string>();
  const categorySet = new Set<string>();
  for (const bp of blueprintRecords) {
    for (const tag of bp.manifest.tags) if (tag !== "") tagSet.add(tag);
    const category = bp.manifest.category;
    if (category !== undefined && category !== "") categorySet.add(category);
  }
  const tags = frozen([...tagSet].sort(cmpString));
  const categories = frozen([...categorySet].sort(cmpString));

  // Search corpus, aligned index-for-index with `cards`, folded once at build time.
  // `spec` is deliberately not in it: doc 1 §3.2 makes it a long self-sufficient
  // instruction, so folding it in would match almost any query and turn a lookup into
  // noise. Phase and type are queried through `cardsByPhase`, not through free text.
  const haystacks = cards.map((rec) =>
    [rec.id, rec.card.name, rec.card.action, rec.card.notes ?? ""].join("\n").toLowerCase(),
  );

  return {
    blueprints: () => blueprintRecords,
    blueprint: (slug) => bySlug.get(slug),
    cards: () => cards,
    versionsOf: (id) => byId.get(id) ?? NO_VERSIONS,
    latestCards: () => latest,
    card: (ref) => byRef.get(ref),
    usersOf: (id) => users.get(id) ?? NO_SLUGS,
    duplicates: () => dups,
    phases: () => phases,
    cardsByPhase: (phase) => byPhase.get(phase) ?? NO_VERSIONS,
    tags: () => tags,
    categories: () => categories,
    searchCards(query) {
      const needle = query.trim().toLowerCase();
      // An empty query is a substring of everything, so it filters nothing.
      if (needle === "") return cards;
      const hits: CardVersionRecord[] = [];
      for (let i = 0; i < cards.length; i += 1) {
        if (haystacks[i].includes(needle)) hits.push(cards[i]);
      }
      return frozen(hits);
    },
  };
}
