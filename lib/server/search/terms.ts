/* ============================================================
   DarkPrint backend — searchTerms
   `/ontology` takes `q`, `kind` and `origin`, fixed by the live
   URL, and `components/ontology/VocabularyBrowser.tsx` is the
   specification for all three.

   ── Both corpora, and why that is not optional (D-200-17) ──
   The registry's terms live in `ontology_term`; a LOCAL term
   travels with the release that declares it
   (`release.localVocabulary`), because T030's merged view folds an
   overlay in per bundle rather than per registry. Reading
   `ontology_term` alone would leave `origin=local` filtering
   NOTHING, EVER, on a key the contract says may not change — a
   criterion made unsatisfiable rather than merely narrow.

   ── Which is why AC4 bites hardest here ──
   A local term is NOT a row with a visibility column: it inherits
   its bundle's. So the public-only rule (D-200-06, D-200-07) is
   applied by taking the bundle universe from
   `blueprints(db, PUBLIC_ONLY)` — T080's answer to what is public
   — and reading local vocabularies only from those bundles'
   CURRENT releases. A private bundle's local term therefore
   reaches no caller, its own owner and the operator included, and
   it does so because the universe never contained the bundle
   rather than because a filter downstream remembered to drop it.
   ============================================================ */

import { splitTermId, type TermKind } from "@/lib/core";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { Actor } from "@/lib/server/policy";
import {
  MalformedVocabularyError,
  getRelease,
  parseStoredVocabulary,
} from "@/lib/server/archive";
import { getLatestOntologyVersion } from "@/lib/server/ontology";
import { blueprints } from "@/lib/server/registry";
import type { OntologyTerm } from "@/lib/server/types";
import { value } from "./params";
import { cmpString, evidenceFor, queryWords, ranked, unranked, type Field, type Scored } from "./rank";
import { withSearchStore } from "./store";
import type { Results } from "./types";
import { PUBLIC_ONLY } from "./visibility";

/**
 * The five kinds, derived from the type rather than listed beside it.
 *
 * `Record<TermKind, true>` is exhaustive by construction: a sixth kind added to the union
 * in `lib/core/ontology/types.ts` makes this file fail to compile, which is the only
 * spelling in which the facet cannot silently fall a kind short. The order is the union's
 * own — doc 3 §1's three independent dimensions first, then the two doc 1 adds.
 */
const KIND_IS_PUBLISHED: Record<TermKind, true> = {
  phase: true,
  "node-type": true,
  "risk-marker": true,
  "data-type": true,
  tool: true,
};
const TERM_KINDS = Object.keys(KIND_IS_PUBLISHED) as readonly TermKind[];

/** `VocabularyBrowser`'s three, and it is three rather than two — a two-value reading drops a shipped filter. */
const ORIGINS = ["core", "local", "deprecated"] as const;

/**
 * The fields a query is looked for in: `VocabularyBrowser`'s own four, unchanged.
 *
 * `broader` is one of them on the shelf and stays one here, which is worth a note because
 * it looks like a mistake: searching for `evaluative` returns the terms UNDER it as well as
 * the term itself, and that is the behaviour a reader browsing a subsumption hierarchy
 * expects. The evidence says `broader:evaluative`, so nothing about it is hidden.
 */
const FIELDS: readonly Field<OntologyTerm>[] = [
  { key: "id", text: (term) => term.id },
  { key: "label", text: (term) => term.label },
  { key: "description", text: (term) => term.description },
  { key: "broader", text: (term) => term.broader },
];

/**
 * Ontology terms matching `params`, with the vocabularies to filter by next.
 *
 * `actor` is ACCEPTED AND DELIBERATELY UNUSED (D-200-07): search is public-only for every
 * caller, so who is asking cannot change the answer. See `visibility.ts`.
 */
export async function searchTerms(
  db: Db,
  actor: Actor,
  params: Record<string, string>,
): Promise<Results<OntologyTerm>> {
  void actor;
  return withSearchStore("searchTerms", () => search(db, params));
}

async function search(db: Db, params: Record<string, string>): Promise<Results<OntologyTerm>> {
  const corpus = await bothCorpora(db);

  /* AC3, keyed by the URL parameter names (D-200-18). Both are vocabularies in the strict
     sense — closed sets this surface accepts — rather than a projection of what matched. */
  const facets: Record<string, readonly string[]> = {
    kind: TERM_KINDS,
    origin: ORIGINS,
  };

  const kind = value(params, "kind");
  const origin = value(params, "origin");

  const candidates = corpus.filter((term) => {
    if (kind !== undefined && term.kind !== kind) return false;
    if (origin === "local" && !isLocal(term)) return false;
    if (origin === "core" && isLocal(term)) return false;
    if (origin === "deprecated" && term.deprecated === undefined) return false;
    return true;
  });

  const query = queryWords(params);
  const hits: Scored<OntologyTerm>[] = [];
  for (const term of candidates) {
    const evidence = evidenceFor(term, FIELDS, query);
    if (query.length > 0 && evidence === undefined) continue;
    hits.push({ item: term, evidence: evidence ?? [], identity: term.id });
  }

  /* `/ontology` publishes no `sort`, so there is no explicit-instruction branch here: a
     query ranks, and anything else is the vocabulary's own id order. */
  if (query.length === 0) {
    return unranked(
      hits.map((hit) => hit.item),
      facets,
    );
  }
  return ranked(hits, facets);
}

/**
 * A term is local when its id is NAMESPACED, which is `partitionTerms`' rule and therefore
 * the same answer `/ontology` already gives.
 *
 * Deliberately not "it arrived through the extension channel", which is `resolve.ts`'s
 * definition and the right one for a merged VIEW: this surface is a registry-wide list, and
 * the same id can arrive through the base channel in one bundle and the extension channel
 * in another. The spelling is the only property of the term itself, so it is the only one
 * that can answer the question the same way for every caller.
 */
function isLocal(term: OntologyTerm): boolean {
  return splitTermId(term.id).namespace !== undefined;
}

/**
 * The published core vocabulary, plus every local vocabulary a public blueprint's current
 * release declares, deduplicated by id.
 *
 * **The core corpus wins an id present in both.** A local term shadowing a core one is a
 * per-bundle fact — `ontologyView` replaces the base term in place and `validate()` reports
 * the shadowing — and this list is not per bundle, so promoting one bundle's overlay into
 * the registry-wide answer would state its private opinion as the vocabulary's. Among
 * local terms sharing an id the first in blueprint order wins, which is stable because
 * `blueprints()` sorts by slug then owner handle.
 */
async function bothCorpora(db: Db): Promise<readonly OntologyTerm[]> {
  const byId = new Map<string, OntologyTerm>();

  for (const term of (await getLatestOntologyVersion(db))?.terms ?? []) {
    if (!byId.has(term.id)) byId.set(term.id, term);
  }

  const core = new Set(byId.keys());
  for (const term of await localTerms(db)) {
    if (core.has(term.id) || byId.has(term.id)) continue;
    byId.set(term.id, term);
  }

  return [...byId.values()].sort((a, b) => cmpString(a.id, b.id));
}

/** Every local term declared by the current release of a blueprint the public may read. */
async function localTerms(db: Db): Promise<readonly OntologyTerm[]> {
  const universe = await blueprints(db, PUBLIC_ONLY);
  if (universe.length === 0) return [];

  /* One query for the whole mapping rather than one per blueprint. It reads no `visibility`
     column: the universe above is T080's answer to which bundles are public, and all this
     adds is the id to fetch a release by. */
  const rows = await db
    .select({
      id: schema.bundle.id,
      slug: schema.bundle.slug,
      handle: schema.account.handle,
    })
    .from(schema.bundle)
    .innerJoin(schema.account, eq(schema.bundle.ownerId, schema.account.id));
  const idOf = new Map<string, string>();
  for (const row of rows) {
    if (row.handle === null) continue;
    idOf.set(`${row.handle}/${row.slug}`, row.id);
  }

  const out: OntologyTerm[] = [];
  for (const bp of universe) {
    const bundleId = idOf.get(`${bp.ownerHandle}/${bp.slug}`);
    if (bundleId === undefined) continue;
    /* Resolved by `(bundleId, digest)` where the digest is the one T080 already chose as
       this blueprint's current release — so which release is current stays D-80-03's
       decision and is not re-derived here. */
    const release = await getRelease(db, bundleId, bp.digest);
    if (release === undefined) continue;
    try {
      out.push(...(parseStoredVocabulary(release.vocabulary, "searchTerms")?.terms ?? []));
    } catch (cause) {
      /* One malformed `local_vocabulary` costs its own bundle's terms and never the whole
         vocabulary, which is `registry/snapshot.ts`'s treatment of an unparseable pin: this
         list has nothing to attach it to, and a registry-wide read that fails on one bad
         row is a worse answer than one that is a few terms short.

         Narrow on purpose — only T133's own refusal is caught, and anything else is a fault
         this module has no reading for and must not swallow. Nothing is hidden by it: the
         surfaces that must refuse such a release, `getRelease`'s own callers and
         `exportBundle`, still do. */
      if (!(cause instanceof MalformedVocabularyError)) throw cause;
    }
  }
  return out;
}
