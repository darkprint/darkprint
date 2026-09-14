/* ============================================================
   DarkPrint backend — searchBlueprints
   `/blueprints` takes `q`, `tag`, `cat`, `phase`, `autonomy`,
   `df`, `forks` and `sort`. That set is fixed by the live URLs and
   may not change or shared links break; every reading here is
   taken off the gallery shelf (`components/gallery/GalleryBrowser.tsx`)
   rather than invented. `gates` is read beside them for the MCP,
   whose caller is an agent deciding whether a graph it is about to
   run will stop and wait for a person.

   ── Where the rows come from ──
   Every registry read is made with `PUBLIC_ONLY`. `actor` is
   accepted and deliberately unused; see the parameter's own note.

   ── What the expensive filters cost ──
   The four scorecard keys are read through `scoresFor`, which is
   three queries whatever the candidate count, and only when one of
   them is asked for, after the cheap filters have narrowed the
   candidates.

   ── How a task is ranked ──
   Every visible candidate gets a similarity (its stored vector
   against the encoded task) and a coverage (the share of the
   task's content words found in its lexical fields). `rank.ts`
   turns the pair into a score and the order; this file only
   gathers the two numbers.
   ============================================================ */

import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { BundleManifest } from "@/lib/server/types";
import {
  blueprints,
  categories,
  phases,
  scoresFor,
  tags,
  type BlueprintSummary,
  type Scores,
} from "@/lib/server/registry";
import { MAX_HITS, embed, encoderState } from "./embed";
import { flag, oneOf, sortKey, value } from "./params";
import {
  cmpString,
  coverageOf,
  isHit,
  lexicalMatch,
  ranked,
  scoreOf,
  similarityEvidence,
  taskWords,
  unranked,
  type Field,
  type Scored,
  similarityFrom,
} from "./rank";
import { withSearchStore } from "./store";
import { stripHarness } from "./text";
import type { Results } from "./types";
import { PUBLIC_ONLY } from "./visibility";

/**
 * `/blueprints` publishes exactly one ordering. The shelf's shipped order is by update time,
 * which `BlueprintSummary` cannot reproduce because it carries no timestamp; `slug` is the
 * registry's own published order, so it is the one value that names an order this module can
 * deliver. Anything else is ignored and the default applies.
 */
const SORT_KEYS = ["slug"] as const;

/**
 * The three fork stances `/blueprints` publishes. `rolled` is the default because it is the
 * shelf's default. `rolled` and `originals` produce the same hit set at this layer: they
 * differ only in whether a fork is presented under its upstream tile, which is the grid's
 * business and not something a flat hit list carries. Both stay in the set because the
 * parameter set is fixed and a client must be able to pass either through untouched.
 */
const FORK_STANCES = ["all", "rolled", "originals"] as const;

/**
 * Does anybody in this graph wait for a person? An agent picking a blueprint to run in its
 * own harness has to know before it starts, and neither `autonomy` nor `df` answers it:
 * `autonomy` is a four-band reading of how much of the deciding runs unattended, and `df`
 * additionally requires all five lifecycle phases, so it holds six of the sixteen while
 * `none` holds eleven.
 *
 * **The two stances are not complements, and that is the point.** `required` is positive
 * evidence: a node the bundle itself declared as human. `none` is a claim about the whole
 * graph, so it is spelled `autonomousNodes === totalNodes` rather than "no node said human"
 * — a node whose card is missing is in NEITHER set (`AutonomyResult.autonomousNodes`), so
 * the second spelling would answer `none` for a bundle that has described nothing. A bundle
 * with an unresolved node matches neither stance, which is the same answer this module
 * already gives a blueprint whose release was never scored.
 *
 * `searchCards` spells a neighbouring idea `human=1`, a flag. A flag has one side and this
 * key needs two, and the subject differs: that one asks whether a CARD wants a person, this
 * one asks whether a GRAPH stops for one.
 */
export const GATE_STANCES = ["required", "none"] as const;

/**
 * The fields a query is looked for in, and the names that reach the evidence.
 *
 * The gallery's own haystack (title, summary, description, category, tags, card refs) plus
 * two the shelf has no need of and an API does: `slug` and `owner`. Both only ever ADD a
 * match.
 *
 * `manifest` is `jsonb` and reaches this module unvalidated, so `tags` is guarded with
 * `Array.isArray`: a row missing the field must cost its own match, never the whole search.
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
 * The two stances, read off the autonomy result rather than off `humanGates`.
 *
 * `requiresHuman` is a per-node declaration and `resolved` says the node has a card at all,
 * so the counts are the honest reading: `autonomousNodes` is nodes with a card and no
 * person in them, and a node whose card is missing is in neither that set nor the human
 * one. `totalNodes > 0` keeps an empty graph out of both answers for the same reason
 * `isDarkFactory` keeps it out of that one.
 */
export function matchesGates(
  stance: (typeof GATE_STANCES)[number],
  autonomy: Scores["autonomy"],
): boolean {
  if (autonomy.totalNodes === 0) return false;
  return stance === "none"
    ? autonomy.autonomousNodes === autonomy.totalNodes
    : autonomy.contributions.some((node) => node.requiresHuman);
}

/**
 * Blueprints matching `params`, with the vocabularies to filter by next.
 *
 * `actor` is accepted and deliberately unused. Search is public-only for every caller, an
 * owner's own private blueprint included, so who is asking cannot change the answer; the
 * parameter stays because the published signature is fixed.
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

  /* Computed from the VOCABULARY and never from the hit set, so an empty result still tells
     a reader what they could have asked for. Keyed by the URL parameter names. */
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
  const gates = oneOf(params, "gates", GATE_STANCES, undefined);

  let candidates = all.filter((bp) => {
    if (category !== undefined && manifestOf(bp).category !== category) return false;
    if (tag !== undefined && !tagsOf(bp).includes(tag)) return false;
    return true;
  });

  /* The scorecard keys, paid for only when one of them is set. A blueprint whose release
     has never been scored is absent from the map and matches none of the four: a
     half-written scorecard is not a scorecard, and guessing past it would be this module
     inventing an autonomy class nobody computed.

     Read in ONE batch rather than per candidate. `scoresFor` exists for exactly this shape
     and says so: per-key `scoresOf` is three statements times N, and this is three whatever
     N is. The loop below used to be the per-key form, which put 48 round trips behind a
     single `df=1` on today's sixteen blueprints. */
  if (phase !== undefined || autonomy !== undefined || darkFactory || gates !== undefined) {
    const scores = await scoresFor(db, PUBLIC_ONLY, candidates);
    candidates = candidates.filter((bp) => {
      const card = scores.get(`${bp.ownerHandle}/${bp.slug}`);
      if (card === undefined) return false;
      if (phase !== undefined && !card.phaseCoverage.covered.includes(phase)) return false;
      if (autonomy !== undefined && card.autonomy.autonomyClass !== autonomy) return false;
      if (darkFactory && !card.autonomy.isDarkFactory) return false;
      if (gates !== undefined && !matchesGates(gates, card.autonomy)) return false;
      return true;
    });
  }

  /* `forks=all` leaves every blueprint standing; `rolled` and `originals` both take a
     published fork off the list. Absent, empty and unrecognised all resolve to `rolled`
     through the one enum rule, so `{}` and `{forks: "banana"}` agree. */
  const forkStance = oneOf(params, "forks", FORK_STANCES, "rolled");
  if (forkStance !== "all") {
    const forks = await forkedKeys(db, all);
    candidates = candidates.filter((bp) => !forks.has(`${bp.ownerHandle}/${bp.slug}`));
  }

  const query = taskWords(params);
  const lexical = new Map(
    candidates.map((bp) => [identityOf(bp), lexicalMatch(bp, FIELDS, query)] as const),
  );

  /* An explicit ordering instruction, or no query at all: the caller's own instruction and
     the registry's key order are not ranks the archive explains, so both answer unranked
     with empty evidence. Under an explicit `sort` a `q` still narrows to the lexical
     matches and the vector channel stays out, because a shared link's answer must not grow. */
  if (sortKey(params, SORT_KEYS) !== undefined || query.length === 0) {
    const kept = query.length === 0
      ? candidates
      : candidates.filter((bp) => (lexical.get(identityOf(bp))?.found ?? 0) > 0);
    return unranked(kept, facets, await encoderState());
  }

  const similarity = await similarityOf(db, stripHarness(params.q ?? ""), candidates);

  const hits: Scored<BlueprintSummary>[] = [];
  for (const bp of candidates) {
    const identity = identityOf(bp);
    const match = lexical.get(identity) ?? { evidence: [], found: 0 };
    const near = similarity.byIdentity.get(identity);
    const coverage = coverageOf(match.found, query.length);
    if (!isHit(near ?? 0, coverage)) continue;
    const evidence = near === undefined
      ? match.evidence
      : [...match.evidence, similarityEvidence(near)].sort(cmpString);
    hits.push({
      item: bp,
      evidence,
      identity,
      score: scoreOf(near ?? 0, coverage),
      similarity: near ?? 0,
    });
  }
  return ranked(hits, facets, similarity.encoder, MAX_HITS);
}

/** The key a hit is identified by, in one place because the vector channel has to agree with it. */
function identityOf(bp: BlueprintSummary): string {
  return `${bp.slug}/${bp.ownerHandle}`;
}

/**
 * The cosine similarity between the task and every visible candidate's stored vector.
 *
 * ── The candidate set is passed IN, and that is the visibility rule ──
 * `release_embedding` holds a row for every embedded release, private ones included, because
 * `reembedRelease` does not consult visibility: a vector skipped while a blueprint is private
 * has nothing to trigger it on the day the blueprint goes public. So the table is not a
 * public index, and the narrowing happens here in SQL, against the set the registry already
 * answered under `PUBLIC_ONLY` and already filtered by `tag`, `cat`, `phase` and the rest.
 * Matching on digest is a superset of the identity match below (two bundles can share a
 * digest), which is why that stricter check still runs.
 *
 * ── The distance, and the sign that is easy to get backwards ──
 * `<=>` is pgvector's cosine DISTANCE, 0 (identical) to 2 (opposite). Both vectors are unit
 * length, so `similarity = 1 - distance` is exact; `similarityFrom` does that conversion
 * once for both searchers and floors it at zero.
 *
 * No `LIMIT` and no floor in SQL: every candidate's similarity is read so the score can be
 * computed over the whole visible set, and the floor is applied by `isHit` beside the
 * coverage it is weighed against.
 */
async function similarityOf(
  db: Db,
  task: string,
  candidates: readonly BlueprintSummary[],
): Promise<{ byIdentity: ReadonlyMap<string, number>; encoder: Results<never>["encoder"] }> {
  const byIdentity = new Map<string, number>();
  if (candidates.length === 0) return { byIdentity, encoder: await encoderState() };

  const queryVector = await embed(task);
  if (queryVector === undefined) return { byIdentity, encoder: "absent" };

  /* `JSON.stringify` of a `number[]` is exactly pgvector's text form, `[0.1,0.2,…]`, and it
     travels as a bound parameter rather than interpolated text. The parentheses make the
     precedence legible: `<=>` binds tighter than a comparison either way. */
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
    .where(inArray(schema.release.digest, candidates.map((bp) => bp.digest)));

  /* Matched on the whole identity plus the digest rather than on the digest alone. A digest
     is content-addressed and takes no version, so two bundles holding identical content
     legitimately share one; matching on it alone would let a vector stored for one blueprint
     answer for another. The digest is still checked because it is how the registry says
     WHICH release is current: an older release's vector is a vector for text this blueprint
     no longer publishes. */
  const wanted = new Map(candidates.map((bp) => [`${bp.slug}/${bp.ownerHandle}#${bp.digest}`, bp]));
  for (const row of rows) {
    if (row.handle === null) continue;
    const bp = wanted.get(`${row.slug}/${row.handle}#${row.digest}`);
    if (bp === undefined) continue;
    byIdentity.set(identityOf(bp), similarityFrom(Number(row.distance)));
  }
  return { byIdentity, encoder: "present" };
}

/**
 * The `ownerHandle/slug` keys of every public blueprint that is itself a published fork of
 * another public blueprint.
 *
 * Two queries for the whole filter rather than one per blueprint. Neither reads
 * `visibility`: the universe is `blueprints(db, PUBLIC_ONLY)`, which is the registry's
 * answer to that question, and all this adds is the lineage edge.
 *
 * An upstream that is not itself in the public set leaves its fork standing, matching the
 * gallery: a fork of something private, deleted or unpublished is an original as far as
 * this list is concerned, because it has no upstream a reader could be sent to instead.
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
