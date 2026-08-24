/* ============================================================
   DarkPrint backend — searchBlueprints
   `/blueprints` takes `q`, `tag`, `cat`, `phase`, `autonomy`,
   `df`, `forks` and `sort`. The set is FIXED BY THE LIVE URLS and
   may not change or shared links break, which is also why every
   reading here is taken off the merged shelf rather than invented:
   `components/gallery/GalleryBrowser.tsx` is the specification for
   what each key means, and a second reading of `tag` would be a
   second product.

   ── Where the rows come from, and why nobody's actor reaches them ──
   Every registry read is made with `PUBLIC_ONLY` (D-200-06,
   D-200-07). `actor` is accepted and deliberately unused; see the
   parameter's own note.

   ── What the expensive filters cost, stated rather than hidden ──
   Every T080 reader loads its own snapshot (four queries), and
   `scoresOf` is three more PER BLUEPRINT because the published
   surface has no batch form. So `phase`, `autonomy` and `df` are
   the costly keys, and they are only paid for WHEN ASKED: the
   scorecards are fetched after the cheap filters have narrowed the
   candidates, and not at all when none of the three is set. A
   batch reader belongs to T080, not here — deriving the scorecard
   myself would re-implement D-80-03's current-release rule, which
   is the defect this run has charged more than any other.
   ============================================================ */

import { asc, eq, lte, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { BundleManifest } from "@/lib/server/types";
import {
  blueprints,
  categories,
  phases,
  scoresOf,
  tags,
  type BlueprintSummary,
} from "@/lib/server/registry";
import { embed, SEMANTIC_K, SIMILAR_EVIDENCE, SIMILAR_MIN } from "./embed";
import { flag, oneOf, sortKey, value } from "./params";
import {
  evidenceFor,
  queryWords,
  ranked,
  rankedWithSimilar,
  unranked,
  type Field,
  type Scored,
} from "./rank";
import { withSearchStore } from "./store";
import type { Results } from "./types";
import { PUBLIC_ONLY } from "./visibility";

/**
 * `/blueprints` publishes exactly one ordering (D-200-10).
 *
 * `GalleryBrowser` never reads `sort` — only its SEAM comment names it — and its shipped
 * order is `updatedAt || createdAt` descending then title, which `BlueprintSummary` cannot
 * reproduce because it carries no timestamp. `slug` is T080's own published order
 * (by slug, then owner handle), so it is the one value that names an order this task can
 * actually deliver. Anything else is ignored and the default applies.
 */
const SORT_KEYS = ["slug"] as const;

/**
 * The three fork stances `/blueprints` publishes, and `rolled` is the default — the SHELF's
 * default and the design's (`GalleryBrowser.tsx:184`), not this module's choice.
 *
 * **This was wrong in the first version and the comment three lines away already said so
 * (D-200-37).** Absence was treated as `all`, so T260's cutover would have silently changed
 * which shelf `/blueprints` renders unless it remembered to send `forks=rolled` — a
 * correctness property holding only if the next task remembers.
 *
 * `rolled` and `originals` produce the SAME HIT SET at this layer and no cell can
 * distinguish them: `GalleryBrowser.tsx:242` filters identically for both, and they differ
 * only in whether a fork is presented under its upstream tile, which is the grid's business
 * and not something a flat hit list carries. Both stay in the set because the parameter set
 * is fixed and a client must be able to pass either through untouched.
 *
 * ── LABELLED, NOT DELETED: this whitelist changes no behaviour today ──
 *
 * Measured after the repair rather than assumed: replacing `oneOf` with a bare
 * `params.forks ?? "rolled"` passthrough reds 0 of 33 cells, and that zero is a fact about
 * the code rather than a gap in the suite. The proof is one line — the resolved value is
 * consumed by exactly one test, `!== "all"`, and both spellings answer `"all"` for the
 * string `"all"` and something else for every other string — so the two are observably
 * identical for EVERY input, not merely for the ones a cell happens to try.
 *
 * **The DEFAULT is what carried the defect and it is falsifiable: flipping it to `all` reds
 * 1.** The whitelist is kept anyway, and the reason is not behaviour: it is the single place
 * the published stance set is written down, so a fourth stance is added here or nowhere, and
 * a reader comparing this key against `sort` finds the same construction rather than two
 * shapes to reconcile. Written down because an unlabelled clause that reds nothing is
 * indistinguishable from one nobody has tested yet.
 */
const FORK_STANCES = ["all", "rolled", "originals"] as const;

/**
 * The fields a query is looked for in, and the names that reach the evidence.
 *
 * Taken from `GalleryBrowser`'s own haystack — title, summary, description, category, tags,
 * card refs — plus two the shelf has no need of and an API does: `slug` and `owner`. Both
 * only ever ADD a hit, and a caller who knows a blueprint's address and searches for it
 * getting nothing back would be the more surprising answer.
 *
 * `manifest` is `jsonb` and reaches this module unvalidated, exactly as it reaches
 * `registry/snapshot.ts` — so `tags` is guarded with `Array.isArray` here for the same
 * reason it is guarded there: a row missing the field must cost its own hit, never the
 * whole search.
 */
const FIELDS: readonly Field<BlueprintSummary>[] = [
  { key: "slug", text: (bp) => bp.slug },
  { key: "owner", text: (bp) => bp.ownerHandle },
  { key: "title", text: (bp) => manifestOf(bp).title },
  { key: "summary", text: (bp) => manifestOf(bp).summary },
  { key: "description", text: (bp) => manifestOf(bp).description },
  { key: "category", text: (bp) => manifestOf(bp).category },
  { key: "tag", text: (bp) => tagsOf(bp) },
  { key: "card", text: (bp) => bp.cardRefs },
];

function manifestOf(bp: BlueprintSummary): Partial<BundleManifest> {
  const manifest: unknown = bp.manifest;
  return typeof manifest === "object" && manifest !== null ? (manifest as BundleManifest) : {};
}

function tagsOf(bp: BlueprintSummary): readonly string[] {
  const raw = manifestOf(bp).tags;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Blueprints matching `params`, with the vocabularies to filter by next.
 *
 * `actor` is ACCEPTED AND DELIBERATELY UNUSED (D-200-07). Search is public-only for every
 * caller — an owner's own private blueprint included — so who is asking cannot change the
 * answer, and the parameter stays in the signature because the published block is fixed and
 * because a later ruling could make it load-bearing. It is not quietly dropped, and a
 * reader wondering whether its absence is an oversight is answered here rather than left to
 * guess.
 */
export async function searchBlueprints(
  db: Db,
  actor: Actor,
  params: Record<string, string>,
): Promise<Results<BlueprintSummary>> {
  void actor;
  return withSearchStore("searchBlueprints", () => search(db, params));
}

async function search(
  db: Db,
  params: Record<string, string>,
): Promise<Results<BlueprintSummary>> {
  const all = await blueprints(db, PUBLIC_ONLY);

  /* AC3: computed from the VOCABULARY and never from the hit set, so an empty result still
     tells a reader what they could have asked for. Keyed by the URL parameter names
     (D-200-18) so a client puts the key straight back in the query string. */
  const facets: Record<string, readonly string[]> = {
    tag: await tags(db, PUBLIC_ONLY),
    cat: await categories(db, PUBLIC_ONLY),
    phase: await phases(db, PUBLIC_ONLY),
  };

  const tag = value(params, "tag");
  const category = value(params, "cat");
  const phase = value(params, "phase");
  const autonomy = value(params, "autonomy");
  const darkFactory = flag(params, "df");

  let candidates = all.filter((bp) => {
    if (category !== undefined && manifestOf(bp).category !== category) return false;
    if (tag !== undefined && !tagsOf(bp).includes(tag)) return false;
    return true;
  });

  /* The scorecard keys, paid for only when one of them is set. `scoresOf` is T080's and it
     owns which release a blueprint is currently at; a blueprint whose release has never
     been scored answers `undefined`, and it matches none of the three — a half-written
     scorecard is not a scorecard, and guessing past it here would be this module inventing
     an autonomy class nobody computed. */
  if (phase !== undefined || autonomy !== undefined || darkFactory) {
    const scored: BlueprintSummary[] = [];
    for (const bp of candidates) {
      const scores = await scoresOf(db, PUBLIC_ONLY, bp.ownerHandle, bp.slug);
      if (scores === undefined) continue;
      if (phase !== undefined && !scores.phaseCoverage.covered.includes(phase)) continue;
      if (autonomy !== undefined && scores.autonomy.autonomyClass !== autonomy) continue;
      if (darkFactory && !scores.autonomy.isDarkFactory) continue;
      scored.push(bp);
    }
    candidates = scored;
  }

  /* `forks=all` leaves every blueprint standing; `rolled` and `originals` both take a
     published fork off the list. Absent, empty and unrecognised all resolve to `rolled`
     through the one enum rule, so `{}` and `{forks: "banana"}` agree — which they did not
     before D-200-37. */
  const forkStance = oneOf(params, "forks", FORK_STANCES, "rolled");
  if (forkStance !== "all") {
    const forks = await forkedKeys(db, all);
    candidates = candidates.filter((bp) => !forks.has(`${bp.ownerHandle}/${bp.slug}`));
  }

  const query = queryWords(params);
  const hits: Scored<BlueprintSummary>[] = [];
  for (const bp of candidates) {
    const evidence = evidenceFor(bp, FIELDS, query);
    if (query.length > 0 && evidence === undefined) continue;
    hits.push({ item: bp, evidence: evidence ?? [], identity: identityOf(bp) });
  }

  /* An explicit ordering instruction, or none. `sort=slug` and no `sort` at all reach the
     same rows in the same order — T080 already returns them by slug then owner handle — and
     differ in what the response CLAIMS: the caller's own instruction is not a rank the
     archive explains, so it answers unranked with empty evidence (D-200-09). */
  if (sortKey(params, SORT_KEYS) !== undefined) {
    return unranked(
      hits.map((hit) => hit.item),
      facets,
    );
  }
  if (query.length === 0) {
    return unranked(
      hits.map((hit) => hit.item),
      facets,
    );
  }

  /* D-300-02: the vector tables gain their first reader here. Only the candidates the
     lexical pass did NOT already return, so the channel can only ADD recall and can never
     move a rank — which is what keeps AC2 true, and the reason the tail is computed from
     `candidates` (post-filter) rather than from `all`. */
  const found = new Set(hits.map((hit) => hit.identity));
  const tail = await similarCandidates(
    db,
    params.q ?? "",
    candidates.filter((bp) => !found.has(identityOf(bp))),
  );
  if (tail.length === 0) return ranked(hits, facets);
  return rankedWithSimilar(hits, tail, facets);
}

/** The key a hit is identified by, in one place because the tail has to agree with it. */
function identityOf(bp: BlueprintSummary): string {
  return `${bp.slug}/${bp.ownerHandle}`;
}

/**
 * The blueprints whose stored purpose vector is nearest the query, among those the lexical
 * pass did not already find.
 *
 * ── The candidate set is passed IN, and that is the visibility rule ──
 *
 * `release_embedding` holds a row for every embedded release, private ones included —
 * `reembedRelease` deliberately does not consult visibility (D-200-25), because a vector
 * that is skipped while a blueprint is private has nothing to trigger it on the day the
 * blueprint goes public. So the table is NOT a public index and must never be treated as
 * one. The narrowing happens here, against the set T080 already answered under
 * `PUBLIC_ONLY` and already filtered by `tag`, `cat`, `phase` and the rest.
 *
 * It is narrowed IN SQL rather than after the fact, and the difference is not performance:
 * `LIMIT` applied before the filter would let private or filtered-out rows consume the
 * budget and silently return fewer than `SEMANTIC_K` results a caller was entitled to.
 *
 * ── The distance, and the sign that is easy to get backwards ──
 *
 * `<=>` is pgvector's COSINE DISTANCE, so it runs 0 (identical) to 2 (opposite), while
 * `SIMILAR_MIN` is a cosine SIMILARITY floor. `similarity = 1 - distance` is the whole of
 * the conversion and it is written once, here. Both vectors are unit length — the encoder
 * normalises and so did every stored row — so the two readings are exact rather than
 * approximate.
 *
 * The ordering is `ASC` on distance, which is DESCENDING similarity: nearest first.
 */
async function similarCandidates(
  db: Db,
  q: string,
  candidates: readonly BlueprintSummary[],
): Promise<Scored<BlueprintSummary>[]> {
  if (candidates.length === 0) return [];

  /* No encoder on this machine means no tail, and it costs one resolved promise to find
     out rather than a query (D-300-05). The lexical answer above is already complete. */
  const queryVector = await embed(q);
  if (queryVector === undefined) return [];

  /* `JSON.stringify` of a `number[]` is exactly pgvector's text form, `[0.1,0.2,…]`, and it
     travels as a BOUND PARAMETER rather than interpolated text. */
  /* PARENTHESISED, and it is not decoration. `<=>` is a user-defined operator, and
     PostgreSQL gives every such operator HIGHER precedence than a comparison — so
     `embedding <=> $1 <= $2` does already parse as `(embedding <=> $1) <= $2`. The
     parentheses are here so a reader does not have to know that to check the filter,
     because the wrong reading is silently a different query rather than an error. */
  const distance = sql<number>`(${schema.releaseEmbedding.embedding} <=> ${JSON.stringify(queryVector)}::vector)`;

  const rows = await db
    .select({
      handle: schema.account.handle,
      slug: schema.bundle.slug,
      digest: schema.release.digest,
      distance,
    })
    .from(schema.releaseEmbedding)
    .innerJoin(schema.release, eq(schema.release.id, schema.releaseEmbedding.releaseId))
    .innerJoin(schema.bundle, eq(schema.bundle.id, schema.release.bundleId))
    .innerJoin(schema.account, eq(schema.account.id, schema.bundle.ownerId))
    .where(lte(distance, 1 - SIMILAR_MIN))
    .orderBy(asc(distance))
    .limit(SEMANTIC_K);

  /* Matched on the WHOLE identity plus the digest rather than on the digest alone. A digest
     is content-addressed and `bundleDigest` takes no version, so two bundles holding
     identical content legitimately share one (D-200-03) — matching on it alone would let a
     vector stored for one blueprint answer for another. The digest is still checked,
     because it is how T080 says WHICH release is current: an older release's vector is a
     vector for text this blueprint no longer publishes. */
  const byIdentity = new Map(candidates.map((bp) => [`${bp.slug}/${bp.ownerHandle}#${bp.digest}`, bp]));
  const tail: Scored<BlueprintSummary>[] = [];
  for (const row of rows) {
    if (row.handle === null) continue;
    const bp = byIdentity.get(`${row.slug}/${row.handle}#${row.digest}`);
    if (bp === undefined) continue;
    tail.push({ item: bp, evidence: [SIMILAR_EVIDENCE], identity: identityOf(bp) });
  }
  return tail;
}

/**
 * The `ownerHandle/slug` keys of every public blueprint that is itself a published fork of
 * another public blueprint.
 *
 * Two queries for the whole filter rather than one per blueprint. Neither reads
 * `visibility`: the universe is `blueprints(db, PUBLIC_ONLY)`, which is T080's answer to
 * that question, and all this adds is the lineage EDGE — so the visibility rule is still
 * owned in one place and this function cannot disagree with it.
 *
 * An upstream that is not itself in the public set leaves its fork standing, matching
 * `GalleryBrowser`: `forkSlugs` there is built from forks OF blueprints on the shelf, so a
 * fork of something private, deleted or unpublished is an original as far as this list is
 * concerned. It has no upstream a reader could be sent to instead.
 */
async function forkedKeys(
  db: Db,
  universe: readonly BlueprintSummary[],
): Promise<ReadonlySet<string>> {
  const rows = await db
    .select({
      ownerId: schema.bundle.ownerId,
      slug: schema.bundle.slug,
      lineageOwnerId: schema.bundle.lineageOwnerId,
      lineageSlug: schema.bundle.lineageSlug,
    })
    .from(schema.bundle);
  const accounts = await db
    .select({ id: schema.account.id, handle: schema.account.handle })
    .from(schema.account);

  const handleOf = new Map(accounts.map((row) => [row.id, row.handle]));
  const present = new Set(universe.map((bp) => `${bp.ownerHandle}/${bp.slug}`));

  const forks = new Set<string>();
  for (const row of rows) {
    if (row.lineageOwnerId === null || row.lineageSlug === null) continue;
    const upstreamHandle = handleOf.get(row.lineageOwnerId);
    if (upstreamHandle === null || upstreamHandle === undefined) continue;
    if (!present.has(`${upstreamHandle}/${row.lineageSlug}`)) continue;
    const ownHandle = handleOf.get(row.ownerId);
    if (ownHandle === null || ownHandle === undefined) continue;
    forks.add(`${ownHandle}/${row.slug}`);
  }
  return forks;
}
