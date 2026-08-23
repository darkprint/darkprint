/* ============================================================
   T200 — the public world every filter cell reads

   Not a test file. The vitest glob reaches `.test.ts` under `tests`
   and nothing else, so this module is imported by the suites beside
   it and is never collected as one itself.

   Nothing here is private. AC4's fixture lives in `privacy.test.ts`
   with its own database and its own tells, and it is separate on
   purpose: the leak sweep's claim is "these characters cannot
   appear except by leaking", which is only checkable when the
   admissible set is small enough to enumerate. A world carrying
   both halves makes that proof harder for no gain.

   ── the numbers that make the AC2 cells discriminate ──
   Four blueprints, whose slugs sort `s1 < s2 < s3 < s4` and whose
   stored autonomy levels in that order are **3, 1, 4, 2**. That
   sequence is non-monotone, and no rotation of it is: autonomy
   ascending is `s2 s4 s1 s3`, descending is `s3 s1 s4 s2`, and
   neither is the slug order. So a module that has quietly started
   ordering by autonomy cannot answer the same sequence as one that
   has not, which is the whole reason the levels are not 1, 2, 3, 4.

   ── the token that makes the AC5 cells discriminate ──
   `queryToken` appears in **s1's title, s2's title, and s3's
   summary**. Two hits therefore share one field-level fact and a
   third does not, so a response with `ordered: true` has at least
   one pair whose evidence can legitimately be identical — which is
   what gives the contiguity check something to measure. A token
   present once per blueprint would make every evidence value
   distinct and the check vacuous.
   ============================================================ */

import { CORE_ONTOLOGY, CORE_PHASE_IDS } from "@/lib/core";

import {
  insertAccount,
  insertBundle,
  insertCard,
  insertOntologyTerm,
  insertOntologyVersion,
  insertRelease,
  manifest,
  mark,
  type AccountFixture,
  type BundleFixture,
  type CardFixture,
  type OntologyFixture,
  type ReleaseFixture,
  type Scratch,
} from "./fixtures";

export interface Shelf {
  bundle: BundleFixture;
  release: ReleaseFixture;
  /** The stored `autonomy.level`, so a cell can state the sequence it expects. */
  level: number;
  autonomyClass: string;
  isDarkFactory: boolean;
}

export interface World {
  alpha: AccountFixture;
  beta: AccountFixture;

  s1: Shelf;
  s2: Shelf;
  s3: Shelf;
  /** A published fork of `s1`, so the `forks` key has something to include and exclude. */
  s4: Shelf;

  ontology: OntologyFixture;

  cardPlan: CardFixture;
  cardImpl: CardFixture;
  cardTest: CardFixture;

  /** In s1.title, s2.title and s3.summary. Three hits, two sharing one field. */
  queryToken: string;
  /** In s2's summary and nowhere else. */
  soloToken: string;
  /** In nothing at all, and not a substring of anything seeded. */
  missToken: string;

  tagA: string;
  tagB: string;
  tagC: string;
  catA: string;
  catB: string;

  /** Every slug, in the order slug-ascending puts them. */
  slugsInOrder: readonly string[];
}

/** A `PhaseCoverage` covering exactly `covered`, with the rest of the five reported missing. */
function phaseCoverage(covered: readonly string[]): Record<string, unknown> {
  const byPhase: Record<string, string[]> = {};
  for (const id of CORE_PHASE_IDS) byPhase[id] = covered.includes(id) ? ["n0"] : [];
  return {
    covered: CORE_PHASE_IDS.filter((id) => covered.includes(id)),
    missing: CORE_PHASE_IDS.filter((id) => !covered.includes(id)),
    byPhase,
    unphased: [],
  };
}

/**
 * A complete `SecurityResult`, present on every release for a reason that is not decoration.
 *
 * `scoresOf` (`lib/server/registry/scores.ts`) answers `undefined` unless `autonomy`,
 * `security`, `phase_coverage` AND `scored_ontology_version_id` are all present — "a
 * half-written scorecard is not a scorecard". A release carrying `autonomy` alone would
 * therefore be invisible to a module that reads the scorecard through T080's published
 * reader, and the `autonomy` and `df` filter cells would have reddened a correct
 * implementation for a hole in this fixture.
 */
function security(level: number): Record<string, unknown> {
  return {
    level,
    raw: level,
    penalties: [],
    findings: [],
    rationale: `fixture: level ${level}`,
    ontologyVersion: "0.1.0",
    diagnostics: [],
  };
}

function autonomy(level: number, autonomyClass: string, isDarkFactory: boolean): Record<string, unknown> {
  return {
    autonomyClass,
    isDarkFactory,
    level,
    label: autonomyClass,
    fraction: level / 4,
    autonomousNodes: level,
    totalNodes: 4,
    contributions: [],
    rationale: `fixture: level ${level}`,
    ontologyVersion: "0.1.0",
    diagnostics: [],
  };
}

export async function buildWorld(s: Scratch): Promise<World> {
  /* The published core vocabulary, seeded as rows rather than assumed.
     D-200-14 takes `/cards`'s `type` and `risk` facets and `/terms`'s `kind` facet from
     merged T030's ontology — a vocabulary, not a projection of the hit set — and T030
     reads them out of `ontology_term`. A version row with no term rows would leave those
     facets legitimately empty, and the AC3 cells would have reddened a correct module for
     a hole in this fixture. */
  const ontology: OntologyFixture = await insertOntologyVersion(s, CORE_ONTOLOGY.version);
  for (const term of CORE_ONTOLOGY.terms) {
    await insertOntologyTerm(s, {
      versionId: ontology.id,
      term: term as unknown as Record<string, unknown>,
    });
  }
  const alpha = await insertAccount(s, mark("t200a"));
  const beta = await insertAccount(s, mark("t200b"));

  const queryToken = mark("qtok");
  const soloToken = mark("stok");
  const missToken = mark("mtok");
  const tagA = mark("taga");
  const tagB = mark("tagb");
  const tagC = mark("tagc");
  const catA = mark("cata");
  const catB = mark("catb");

  const cardPlan = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-plan"),
    phases: ["planning"],
    type: "agent",
    requiresHuman: false,
    riskMarkers: [],
    name: "Plan the work",
  });
  const cardImpl = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-impl"),
    phases: ["implementation"],
    type: "tool",
    requiresHuman: true,
    riskMarkers: [],
    name: "Write the code",
  });
  const cardTest = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-test"),
    phases: ["testing"],
    type: "agent",
    requiresHuman: false,
    riskMarkers: ["irreversible-action"],
    name: "Run the suite",
  });

  const shelf = async (
    slug: string,
    o: {
      owner: AccountFixture;
      title: string;
      summary: string;
      tags: readonly string[];
      category: string;
      cards: readonly CardFixture[];
      covered: readonly string[];
      level: number;
      autonomyClass: string;
      isDarkFactory: boolean;
      lineage?: { ownerId: string; slug: string; version: string };
    },
  ): Promise<Shelf> => {
    const bundle = await insertBundle(s, { owner: o.owner, slug, visibility: "public" });
    if (o.lineage !== undefined) {
      await s.query(
        "update bundle set lineage_owner_id = $1, lineage_slug = $2, lineage_version = $3 where id = $4",
        [o.lineage.ownerId, o.lineage.slug, o.lineage.version, bundle.id],
      );
    }
    const release = await insertRelease(s, {
      bundle,
      version: "1.0.0",
      cards: o.cards,
      manifest: manifest({
        slug,
        title: o.title,
        summary: o.summary,
        tags: o.tags,
        category: o.category,
      }),
      autonomy: autonomy(o.level, o.autonomyClass, o.isDarkFactory),
      security: security(o.level),
      phaseCoverage: phaseCoverage(o.covered),
      scoredOntologyVersionId: ontology.id,
    });
    return {
      bundle,
      release,
      level: o.level,
      autonomyClass: o.autonomyClass,
      isDarkFactory: o.isDarkFactory,
    };
  };

  const slug1 = mark("t200-s1");
  const slug2 = mark("t200-s2");
  const slug3 = mark("t200-s3");
  const slug4 = mark("t200-s4");

  const s1 = await shelf(slug1, {
    owner: alpha,
    title: `First shelf ${queryToken}`,
    summary: "A blueprint that plans.",
    tags: [tagA],
    category: catA,
    cards: [cardPlan],
    covered: ["planning"],
    level: 3,
    autonomyClass: "conditional",
    isDarkFactory: false,
  });
  const s2 = await shelf(slug2, {
    owner: alpha,
    title: `Second shelf ${queryToken}`,
    summary: `A blueprint that implements, ${soloToken}.`,
    tags: [tagB],
    category: catB,
    cards: [cardImpl],
    covered: ["implementation"],
    level: 1,
    autonomyClass: "assisted",
    isDarkFactory: false,
  });
  const s3 = await shelf(slug3, {
    owner: alpha,
    title: "Third shelf",
    summary: `A blueprint that tests, ${queryToken}.`,
    tags: [tagA, tagC],
    category: catA,
    cards: [cardTest],
    covered: ["testing"],
    level: 4,
    autonomyClass: "closed-loop",
    isDarkFactory: true,
  });
  const s4 = await shelf(slug4, {
    owner: beta,
    title: "Fourth shelf, a fork of the first",
    summary: "A blueprint forked from the first.",
    tags: [],
    category: catB,
    cards: [cardPlan],
    covered: ["planning"],
    level: 2,
    autonomyClass: "supervised",
    isDarkFactory: false,
    lineage: { ownerId: alpha.id, slug: slug1, version: "1.0.0" },
  });

  return {
    ontology,
    alpha,
    beta,
    s1,
    s2,
    s3,
    s4,
    cardPlan,
    cardImpl,
    cardTest,
    queryToken,
    soloToken,
    missToken,
    tagA,
    tagB,
    tagC,
    catA,
    catB,
    slugsInOrder: [slug1, slug2, slug3, slug4],
  };
}
