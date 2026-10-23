/* ============================================================
   DarkPrint backend — the read model, projected once per call
   AC6 ("no private bundle or private card appears in any
   response") is one filter at the boundary rather than twelve
   functions' worth of remembering: every reader answers from this
   snapshot, and nothing the actor may not read ever enters it.
   The filter is `visibleTo` (T060), applied to the two owner
   columns the schema has — `bundle.owner_id` and
   `card_version.owner_id`.

   The rows behind it are kept per database handle and read again
   only when a committed write has changed them, because a page
   calls several readers and each one rebuilds the snapshot. A call
   costs one small statement that answers whether anything changed;
   the projection, visibility filter included, still runs per call.
   ============================================================ */

import { inArray, sql } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { canonicalJson, cardRef, parseCardRef, CORE_PHASE_IDS } from "@/lib/core";
import { visibleTo, type Actor } from "@/lib/server/policy";
import type { BundleManifest, CardRef, NodeCard } from "@/lib/server/types";
import type { BlueprintKey, BlueprintSummary, CardSummary } from "./types";
import { storedCard } from "@/lib/server/cards/stored-card";
import {
  cmpBlueprints,
  cmpBlueprintKeys,
  cmpCards,
  cmpReleasesCurrentFirst,
  cmpString,
  frozen,
} from "./order";

/**
 * What a blueprint's current release stores that its RECORD does not carry: the DOT
 * topology and the local vocabulary overlay.
 *
 * `BlueprintSummary` is the index's answer and deliberately projects both away — nothing
 * reading the index wants a DOT source. `graphsOf` needs them to reassemble the bundle,
 * and the alternative to keeping them here is a second query issued under a second copy of
 * D-80-03's current-release rule, which is the duplicate-decision defect this project
 * charges more than any other (D-132-01: extract, never duplicate). These are references to
 * rows `loadSnapshot` has already read and would otherwise drop on the floor, so retaining
 * them costs no statement and no copy.
 *
 * **The pins are deliberately NOT here.** An earlier version carried `release.card_refs`
 * so a reassembly could read them in the order they were stored, as `export/build.ts` does.
 * That is wrong for this reader: the column holds the pins AS WRITTEN and `parseCardRef`
 * trims, so a padded spelling misses the canonical keys the index is built on. A caller
 * wants `BlueprintSummary.cardRefs`, which is canonical and visibility-filtered already.
 */
export interface ReleaseSource {
  dot: string;
  manifest: BundleManifest;
  /** `release.local_vocabulary` verbatim. `unknown` because the column's reading is T133's. */
  vocabulary: unknown;
}

/** The index one request reads. Internal: the barrel publishes readers, not this shape. */
export interface RegistrySnapshot {
  blueprints: readonly BlueprintSummary[];
  /** Keyed `${ownerHandle}/${slug}` — the whole key, since B-09 made the slug half of one. */
  byKey: ReadonlyMap<string, BlueprintSummary>;
  /** Same key. Present for every blueprint in `blueprints`, and for nothing else. */
  releaseByKey: ReadonlyMap<string, ReleaseSource>;
  /**
   * The archived YAML of every indexed card row, by ref. `CardSummary.card` is the parsed
   * `body` and `resolveBundle` reads files, so the bytes are what a reassembly needs; they
   * are also what the digest in a folder's README was computed over (`build.ts`'s
   * `pinnedCards` says the same thing about `source` versus `body`).
   */
  sourceByRef: ReadonlyMap<CardRef, string>;
  cards: readonly CardSummary[];
  byRef: ReadonlyMap<CardRef, CardSummary>;
  byId: ReadonlyMap<string, readonly CardSummary[]>;
  latest: readonly CardSummary[];
  byPhase: ReadonlyMap<string, readonly CardSummary[]>;
  usersById: ReadonlyMap<string, readonly BlueprintSummary[]>;
  duplicates: readonly (readonly CardSummary[])[];
  phases: readonly string[];
  tags: readonly string[];
  categories: readonly string[];
}

/**
 * The one visibility predicate. `visibleTo` answers `"all"` for the owner and for a
 * break-glass operator and `"public"` for everyone else, so a private row survives only
 * for a caller who owns it. Applied identically to bundles and to cards, because B-07
 * makes a private card exactly as invisible as a private bundle.
 */
export function readable(actor: Actor, row: { ownerId: string; visibility: "public" | "private" }): boolean {
  return visibleTo(actor, row.ownerId) === "all" || row.visibility === "public";
}

export function keyOf(key: BlueprintKey): string {
  return `${key.ownerHandle}/${key.slug}`;
}

/**
 * The fields that *name* a card rather than describe it, excluded before two cards are
 * compared for sameness. `lib/core/archive/registry.ts:122-129`'s list, and it cannot be
 * replaced by the stored `card_version.digest`: `cardDigest` excludes only `author` and
 * `provenance`, so `id` and `version` are inside the hash and two distinct refs can never
 * share one (D-80-05). Dedup is the question the digest cannot ask.
 */
const NAMING_FIELDS: readonly (keyof NodeCard)[] = ["id", "version", "author", "provenance"];

/** The identity of a card's content, as a Map key. Falls back to `ref`, which groups nothing. */
function contentKey(card: NodeCard, ref: CardRef): string {
  const payload: Record<string, unknown> = { ...card };
  for (const field of NAMING_FIELDS) delete payload[field];
  try {
    return canonicalJson(payload);
  } catch {
    // Unreachable through `jsonb`, which cannot hold a non-finite number in the first
    // place — kept because a body that cannot be canonicalised is its own group of one,
    // never a reason to fail the whole index. Written as the escape and not as a raw NUL
    // byte: one NUL makes git and grep treat the file as binary (T-01).
    return `\0ref:${ref}`;
  }
}

/* `EMPTY_SNAPSHOT` and the two empty arrays it was built from stood here, and went with the
   empty-bundle short circuit that was their only reader. That circuit answered a registry
   holding no bundles as though it held nothing; a registry can hold standalone cards now, so
   the body builds the real answer instead of returning a constant. */

/** One row of the join a blueprint is projected from: its bundle, its owner, its current release. */
interface CurrentBlueprint {
  key: BlueprintKey;
  digest: string;
  manifest: BundleManifest;
  /** The release's pins, verbatim — before the invisible cards are filtered out of them. */
  pinned: readonly string[];
  /** The rest of what the release stores, kept for `graphsOf` — see `ReleaseSource`. */
  source: ReleaseSource;
}

type BundleRow = typeof schema.bundle.$inferSelect;
type CardRow = typeof schema.cardVersion.$inferSelect;

/** Every release, without the columns only a current release is read for. */
interface ReleaseRow {
  id: string;
  bundleId: string;
  version: string;
  digest: string;
  cardRefs: string[];
}

/** What a current release adds to its `ReleaseRow`. */
interface ReleaseBody {
  id: string;
  dot: string;
  manifest: unknown;
  localVocabulary: unknown;
}

/**
 * The rows every snapshot is projected from, unfiltered, so one copy serves every actor. They
 * are shared across requests, so they are frozen all the way down: a reader that mutates a
 * manifest or a card body throws instead of changing what every other reader sees.
 */
interface RegistryRows {
  bundles: readonly BundleRow[];
  owners: readonly { id: string; handle: string | null }[];
  releases: readonly ReleaseRow[];
  bodies: readonly ReleaseBody[];
  cards: readonly CardRow[];
}

/** Each bundle's current release: highest semver, tiebroken on row id. */
function currentReleases(releases: readonly ReleaseRow[]): Map<string, ReleaseRow> {
  const current = new Map<string, ReleaseRow>();
  for (const row of releases) {
    const held = current.get(row.bundleId);
    if (held === undefined || cmpReleasesCurrentFirst(row, held) < 0) current.set(row.bundleId, row);
  }
  return current;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/**
 * Every release is read for its pins, because a version any release pins stays out of the
 * standalone cards, but only the current ones are read for their DOT and manifest.
 */
async function readRows(db: Db): Promise<RegistryRows> {
  const bundles = await db.select().from(schema.bundle);
  const ownerIds = [...new Set(bundles.map((b) => b.ownerId))];
  const owners =
    ownerIds.length === 0
      ? []
      : await db
          .select({ id: schema.account.id, handle: schema.account.handle })
          .from(schema.account)
          .where(inArray(schema.account.id, ownerIds));
  const releases = await db
    .select({
      id: schema.release.id,
      bundleId: schema.release.bundleId,
      version: schema.release.version,
      digest: schema.release.digest,
      cardRefs: schema.release.cardRefs,
    })
    .from(schema.release);
  const currentIds = [...currentReleases(releases).values()].map((row) => row.id);
  const bodies =
    currentIds.length === 0
      ? []
      : await db
          .select({
            id: schema.release.id,
            dot: schema.release.dot,
            manifest: schema.release.manifest,
            localVocabulary: schema.release.localVocabulary,
          })
          .from(schema.release)
          .where(inArray(schema.release.id, currentIds));
  const cards = await db.select().from(schema.cardVersion);
  return deepFreeze({ bundles, owners, releases, bodies, cards });
}

/**
 * A value that changes whenever a committed write changes what `readRows` reads. An insert or
 * an update gives its row a transaction id no row held before and a delete shortens the list,
 * so the sorted `xmin` lists move exactly when the rows do. Owner handles are hashed by value
 * instead, because an account row also changes for edits this index never reads.
 *
 * A transaction reads through its own `Db` object and so caches apart from the pool, and a
 * rolled-back transaction id never appears in committed rows, so no stamp a rollback saw can
 * come back.
 */
async function stampOf(db: Db): Promise<string> {
  const xmins = (table: typeof schema.bundle | typeof schema.release | typeof schema.cardVersion) =>
    sql`(select coalesce(string_agg(xmin::text, ',' order by xmin::text), '') from ${table})`;
  const result = await db.execute<{ stamp: string }>(sql`
    select
      md5(concat_ws('|',
        ${xmins(schema.bundle)},
        ${xmins(schema.release)},
        ${xmins(schema.cardVersion)},
        (select coalesce(string_agg(id::text || ':' || coalesce(handle, ''), ',' order by id), '')
           from ${schema.account}
          where id in (select owner_id from ${schema.bundle}))
      )) as stamp`);
  return result.rows[0].stamp;
}

/** Keyed by the `Db` object, so each test database and each server instance keeps its own copy. */
const held = new WeakMap<Db, { stamp: string; rows: Promise<RegistryRows> }>();

/**
 * The stamp is read before the rows, so a write landing between the two leaves rows newer than
 * their stamp and the next caller misses, never the reverse. Concurrent callers on one stamp
 * share one read, and a failed read is dropped so the next caller retries it.
 */
async function registryRows(db: Db): Promise<RegistryRows> {
  const stamp = await stampOf(db);
  const kept = held.get(db);
  if (kept !== undefined && kept.stamp === stamp) return kept.rows;
  const entry = { stamp, rows: readRows(db) };
  held.set(db, entry);
  entry.rows.catch(() => {
    if (held.get(db) === entry) held.delete(db);
  });
  return entry.rows;
}

export async function loadSnapshot(db: Db, actor: Actor): Promise<RegistrySnapshot> {
  const rows = await registryRows(db);

  /* No short circuit on an empty bundle list, and that is the point: a registry can hold
     cards and no blueprints — an account whose first publish is `New card` — and the second
     source below is what serves them. */
  const bundles = rows.bundles.filter((row) => readable(actor, row));
  const handleOf = new Map(rows.owners.map((o) => [o.id, o.handle]));
  const bodyOf = new Map(rows.bodies.map((body) => [body.id, body]));
  const currentByBundle = currentReleases(rows.releases);

  const current: CurrentBlueprint[] = [];
  for (const bundle of bundles) {
    const release = currentByBundle.get(bundle.id);
    // A bundle with no release is not yet a blueprint (B-06: it first exists at its first
    // publish), and an owner with no handle has no `(owner, slug)` key to be addressed by.
    if (release === undefined) continue;
    const ownerHandle = handleOf.get(bundle.ownerId);
    if (ownerHandle === null || ownerHandle === undefined) continue;
    // Absent only when the release was deleted between the two release reads, which is the
    // bundle leaving the registry.
    const body = bodyOf.get(release.id);
    if (body === undefined) continue;
    const manifest = body.manifest as BundleManifest;
    current.push({
      key: { ownerHandle, slug: bundle.slug },
      digest: release.digest,
      manifest,
      pinned: release.cardRefs,
      source: { dot: body.dot, manifest, vocabulary: body.localVocabulary },
    });
  }

  // Canonicalise every pin to `id@version` before it is used as a key: two blueprints may
  // spell one pin differently (`parseCardRef` trims) and they still name one card version.
  // A pin that does not parse names no row and is dropped — `resolveBundle` reports it as
  // `bundle/unpinned-card` at publish, and this index has nothing to attach it to.
  const pinsByBlueprint = new Map<string, Map<CardRef, { id: string; version: string }>>();
  for (const bp of current) {
    const pins = new Map<CardRef, { id: string; version: string }>();
    for (const pin of bp.pinned) {
      const parsed = parseCardRef(pin);
      if (parsed === undefined) continue;
      pins.set(cardRef(parsed.id, parsed.version), parsed);
    }
    pinsByBlueprint.set(keyOf(bp.key), pins);
  }

  // Matched on the whole `id@version` and never on the id alone: an id match would index
  // versions no release pins, which `cardRefs` omits, and the read model would contradict
  // itself. The tell is a record with an empty `usedIn`, which the indexing rule forbids.
  const pinnedRefs = new Set<CardRef>();
  for (const pins of pinsByBlueprint.values()) {
    for (const ref of pins.keys()) pinnedRefs.add(ref);
  }

  // Only cards a DOT node instantiates are indexed (contract), and only the ones this actor
  // may read: `rowsByRef` is the set of pins that resolve to a visible row.
  const visibleCards = rows.cards.filter((row) => readable(actor, row));
  const rowsByRef = new Map<CardRef, CardRow>();
  for (const row of visibleCards) {
    const ref = cardRef(row.cardId, row.version);
    if (!pinnedRefs.has(ref)) continue;
    rowsByRef.set(ref, row);
  }

  /* THE SECOND SOURCE — a card version no release anywhere pins, which the profile publishes
     through `New card` and which is a published card whether or not a graph ever uses it.

     `claimed` is the pin set of EVERY release in the table, read BEFORE any visibility
     filter, and that is the whole safety of this block. D-80-06 above narrows the pinned
     query because selecting by id alone dragged in other VERSIONS of a pinned id; that
     narrowing is untouched, and so is every rule around who may see what. Filtering on
     `pinnedRefs` here — this actor's VISIBLE pins — would have published the three things the
     suite forbids: a card pinned only by a private bundle, by a handleless owner's bundle, or
     by a release this actor cannot read. Each of those is claimed by some release, so each
     stays exactly as absent as it was.

     A version pinned only by a SUPERSEDED release is claimed too, and stays out: `cardRefs`
     of every release enters this set, not only the current one. What is left is a row no
     release has ever named. Its `usedIn` is `[]` by construction rather than by omission. */
  const claimed = new Set<CardRef>();
  for (const row of rows.releases) {
    for (const pin of row.cardRefs) {
      const parsed = parseCardRef(pin);
      if (parsed !== undefined) claimed.add(cardRef(parsed.id, parsed.version));
    }
  }

  for (const row of visibleCards) {
    const ref = cardRef(row.cardId, row.version);
    if (claimed.has(ref) || rowsByRef.has(ref)) continue;
    rowsByRef.set(ref, row);
  }

  const usedIn = new Map<CardRef, BlueprintKey[]>();
  const blueprints: BlueprintSummary[] = [];
  for (const bp of current) {
    const pins = pinsByBlueprint.get(keyOf(bp.key)) ?? new Map();
    const visibleRefs: CardRef[] = [];
    for (const ref of pins.keys()) {
      if (!rowsByRef.has(ref)) continue;
      visibleRefs.push(ref);
      const users = usedIn.get(ref);
      if (users === undefined) usedIn.set(ref, [bp.key]);
      else users.push(bp.key);
    }
    blueprints.push(
      Object.freeze({
        ownerHandle: bp.key.ownerHandle,
        slug: bp.key.slug,
        manifest: bp.manifest,
        digest: bp.digest,
        // A private card's ref is the card appearing in a response, so it is filtered out
        // of a public blueprint's pins too — AC6 is about the card, not about the row that
        // names it. The cost is that `cardRefs` no longer reproduces `digest`'s input for a
        // caller who cannot see every pin, which is the same thing 404-over-403 costs (B-03).
        cardRefs: frozen(visibleRefs.sort(cmpString)),
      }),
    );
  }
  blueprints.sort(cmpBlueprints);

  const cards = frozen(
    [...rowsByRef.entries()]
      .flatMap(([ref, row]): CardSummary[] => {
        const users = usedIn.get(ref) ?? [];
        /* Skipped, not cast: see `registry/cards.ts` and `lib/server/cards/stored-card.ts`. */
        const card = storedCard(row.body);
        if (card === undefined) return [];
        return [Object.freeze({
          ref,
          id: row.cardId,
          version: row.version,
          digest: row.digest,
          card,
          usedIn: frozen(users.sort(cmpBlueprintKeys).map((key) => Object.freeze({ ...key }))),
          // Always "public" through this constructor in practice: `cardRows` above is
          // already filtered by `readable()`, and the one caller that can see a private
          // row here is its own owner, for whom the distinction is moot. Carried anyway
          // so `CardSummary.visibility` is not a field only `cardsOwnedBy` bothers to fill.
          visibility: row.visibility,
          /* The row's own timestamp, as a string: a card version is immutable, so when its
             row was written IS when it was published, and nothing else on the card dates it. */
          createdAt: row.createdAt.toISOString(),
        })];
      })
      .sort(cmpCards),
  );

  const byRef = new Map<CardRef, CardSummary>();
  const byId = new Map<string, CardSummary[]>();
  const byContent = new Map<string, CardSummary[]>();
  const byPhase = new Map<string, CardSummary[]>();
  const usersById = new Map<string, Map<string, BlueprintKey>>();

  for (const rec of cards) {
    byRef.set(rec.ref, rec);
    const versions = byId.get(rec.id);
    if (versions === undefined) byId.set(rec.id, [rec]);
    else versions.push(rec);

    const key = contentKey(rec.card, rec.ref);
    const sameContent = byContent.get(key);
    if (sameContent === undefined) byContent.set(key, [rec]);
    else sameContent.push(rec);

    // The buckets cover `cards()` without partitioning it: a card declaring two phases is
    // filed under both, one declaring none is filed under no phase at all and is not
    // thereby incomplete (AC4). A blank entry is skipped the way `tags()` skips an empty
    // tag, and the `seen` guard keeps a card repeating a phase out of one bucket twice.
    const seen = new Set<string>();
    // `phases` is declared non-optional on `NodeCard`, but `body` is `jsonb` and this
    // module never validated what was written into it — a row missing the field would
    // otherwise take down every reader, not just its own bucket.
    for (const phase of Array.isArray(rec.card.phases) ? rec.card.phases : []) {
      if (phase === "" || seen.has(phase)) continue;
      seen.add(phase);
      const samePhase = byPhase.get(phase);
      if (samePhase === undefined) byPhase.set(phase, [rec]);
      else samePhase.push(rec);
    }

    // `usersOf` is keyed by card id and answers over every version of it, so the same
    // blueprint reached through two versions is one user (AC2's "distinct").
    let users = usersById.get(rec.id);
    if (users === undefined) {
      users = new Map<string, BlueprintKey>();
      usersById.set(rec.id, users);
    }
    for (const key of rec.usedIn) users.set(keyOf(key), key);
  }

  // `cards` is already id-ascending / version-descending, so each bucket inherits that
  // order and the head of a bucket is by construction the newest version.
  for (const versions of byId.values()) frozen(versions);
  for (const bucket of byPhase.values()) frozen(bucket);
  const latest = frozen([...byId.values()].map((versions) => versions[0]));

  const byKey = new Map(blueprints.map((bp) => [keyOf(bp), bp]));
  // Same key and the same pass: `current` is what `blueprints` was built from, one entry
  // each, so these two maps cannot disagree about which release a blueprint is.
  const releaseByKey = new Map(current.map((bp) => [keyOf(bp.key), bp.source]));
  const sourceByRef = new Map([...rowsByRef].map(([ref, row]) => [ref, row.source]));
  const usersOf = new Map<string, readonly BlueprintSummary[]>();
  for (const [id, keys] of usersById) {
    const summaries: BlueprintSummary[] = [];
    for (const key of keys.values()) {
      const summary = byKey.get(keyOf(key));
      if (summary !== undefined) summaries.push(summary);
    }
    usersOf.set(id, frozen(summaries.sort(cmpBlueprints)));
  }

  return {
    blueprints: frozen(blueprints),
    byKey,
    releaseByKey,
    sourceByRef,
    cards,
    byRef,
    byId,
    latest,
    byPhase,
    usersById: usersOf,
    // Group order follows first appearance in `cards()`, which is itself sorted.
    duplicates: frozen(
      [...byContent.values()].filter((group) => group.length > 1).map((group) => frozen(group)),
    ),
    phases: orderedPhases(byPhase.keys()),
    ...facets(blueprints),
  };
}

/**
 * Doc 3 §2's lifecycle order — planning, implementation, testing, debugging, deployment —
 * filtered to what is here, and never alphabetical: the order is the shape of a factory, so
 * sorting it by id would say something false about it. A value outside the five is still
 * reported, appended after them in sorted order, because `phases()` omitting a bucket that
 * `cardsByPhase()` happily returns would make the gallery filter lie about its own rows.
 */
function orderedPhases(present: Iterable<string>): readonly string[] {
  const unplaced = new Set(present);
  const ordered: string[] = [];
  for (const id of CORE_PHASE_IDS) if (unplaced.delete(id)) ordered.push(id);
  return frozen([...ordered, ...[...unplaced].sort(cmpString)]);
}

function facets(blueprints: readonly BlueprintSummary[]): { tags: readonly string[]; categories: readonly string[] } {
  const tagSet = new Set<string>();
  const categorySet = new Set<string>();
  for (const bp of blueprints) {
    // Same reason `phases` is guarded above: `manifest` is `jsonb` and arrives unvalidated.
    for (const tag of Array.isArray(bp.manifest.tags) ? bp.manifest.tags : []) if (tag !== "") tagSet.add(tag);
    const category = bp.manifest.category;
    if (category !== undefined && category !== "") categorySet.add(category);
  }
  return { tags: frozen([...tagSet].sort(cmpString)), categories: frozen([...categorySet].sort(cmpString)) };
}
